import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search, ShoppingBag, User, Star, ChevronRight, Check, Play, X, Plus, Minus, ArrowRight, Trash2, Download, Tag } from "lucide-react";
import { Toaster, toast } from "sonner";
import { api, ProductDetail, UserAddress } from "./services/api";
import VisualEditor from "./VisualEditor";
import AdminPanel from "./admin/AdminPanel";
import { useAuth } from "./context/AuthContext";
import { CmsHtmlCssBlock, CmsSectionExtras, CmsSectionOverride } from "./visual-editor/CmsCustomContent";
import { SectionCustomElements, CmsAnchor } from "./visual-editor/SectionCustomElements";
import RichTextContent from "./components/RichTextContent";
import { ELEMENT_INSERT_START } from "./visual-editor/cmsElements";
import { parsePageBlockContent } from "./visual-editor/cmsPages";
import {
  DEFAULT_FLOATING_LABELS,
  DEFAULT_HERO_GALLERY,
  DEFAULT_TIMELINE_IMAGES,
  cmsImageList,
  cmsString,
  cmsStringList,
  mergeCmsSection,
} from "./visual-editor/cmsSectionDefaults";
import { DEFAULT_HOME_BLOCKS, type HomeBlock } from "./visual-editor/cmsEditorFields";
import { renderCmsBlock } from "./visual-editor/CmsBlockView";
import { normalizeSiteConfig, pageContentKey, slugFromPublicPath, isCssGlobal } from "./visual-editor/cmsPages";
import { CmsGlobalStyles } from "./visual-editor/CmsGlobalStyles";
import { buildImageStyle, readImageSize } from "./visual-editor/cmsImageSize";
import { AppliedPromo, calcPromoDiscount, downloadOrderInvoice, formatOrderStatus, orderStatusColor } from "./utils/orderUtils";
import { plainTextFromHtml, plainTextLabel } from "./utils/plainText";
import ProductDetailPage from "./pages/ProductDetailPage";
import { spaNavigateClick } from "./utils/spaNavigate";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  id: string;
  name: string;
  qty: number;
  bottles: number;
  price: number;
  originalPrice: number;
  freeGift: boolean;
  dbId?: number;
}

export interface Plan {
  id: string;
  label: string;
  qty: string;
  bottles: number;
  price: number;
  originalPrice: number;
  tag: string | null;
  saving: string;
  extras: string[];
  freeGift: boolean;
  highlighted: boolean;
  dbId?: number;
  name: string;
  description: string;
  imageUrl?: string;
  reviewAverage?: number;
  reviewCount?: number;
}

interface AppState {
  cart: CartItem[];
  cartOpen: boolean;
  searchOpen: boolean;
  accountOpen: boolean;
  videoOpen: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OFFER_ITEMS_STATIC = [
  "FREE Bio-Collagen Deep Mask With Every Order",
  "Free Shipping Across India",
  "Cash On Delivery Available",
  "Exosome-Powered Skin Repair Technology",
];

type PlanKey = "single" | "double" | "triple";

const PLAN_UI: Record<PlanKey, Omit<Plan, "price" | "originalPrice" | "dbId" | "name" | "description" | "imageUrl" | "saving">> = {
  single: {
    id: "single",
    label: "Single Bottle",
    qty: "1 Bottle",
    bottles: 1,
    tag: null,
    extras: ["30-day supply", "Free shipping"],
    freeGift: false,
    highlighted: false,
  },
  double: {
    id: "double",
    label: "Buy 2",
    qty: "2 Bottles",
    bottles: 2,
    tag: "Most Popular",
    extras: ["60-day supply", "FREE Mask Included", "Free shipping"],
    freeGift: true,
    highlighted: true,
  },
  triple: {
    id: "triple",
    label: "Buy 3",
    qty: "3 Bottles",
    bottles: 3,
    tag: "Best Value",
    extras: ["90-day supply", "FREE Mask Included", "Free shipping", "COD Available"],
    freeGift: true,
    highlighted: false,
  },
};

export const FALLBACK_PLANS: Plan[] = (["single", "double", "triple"] as PlanKey[]).map((key) => {
  const ui = PLAN_UI[key];
  const prices = { single: [1699, 1999], double: [1999, 3998], triple: [2999, 5997] }[key];
  const savings = { single: 300, double: 1999, triple: 2998 }[key];
  return {
    ...ui,
    name: `ARGLOVE Exosome Serum (${ui.qty})`,
    description: "Powered by Exosome Technology and 5% Ethylated Vitamin C.",
    price: prices[0],
    originalPrice: prices[1],
    saving: `Save ₹${savings.toLocaleString("en-IN")}`,
    imageUrl: "https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=400&h=360&fit=crop&auto=format",
  };
});

function getPlanKeyFromName(productName: string): PlanKey | null {
  const n = plainTextFromHtml(productName).toLowerCase();
  if (n.includes("3 bottles") || (n.includes("bundle") && n.includes("3"))) return "triple";
  if (n.includes("2 bottles") || (n.includes("bundle") && n.includes("2"))) return "double";
  if (n.includes("1 bottle")) return "single";
  return null;
}

function isBundleProduct(product: ProductDetail["product"]): boolean {
  const slug = product.category_slug?.toLowerCase();
  const name = plainTextFromHtml(product.name).toLowerCase();
  return slug === "bundles" || name.includes("bundle");
}

function formatProductImage(url: string, width = 400, height = 360): string {
  if (url.includes("unsplash.com") && !url.includes("w=")) {
    return `${url}?w=${width}&h=${height}&fit=crop&auto=format`;
  }
  return url;
}

function buildPlanFromDetail(detail: ProductDetail, planKey?: PlanKey): Plan | null {
  const key = planKey ?? getPlanKeyFromName(detail.product.name);
  if (!key) return null;

  const ui = PLAN_UI[key];
  const price = parseFloat(detail.product.discount_price || detail.product.regular_price);
  const originalPrice = parseFloat(detail.product.regular_price);
  const resource = detail.resources.find((r) => r.file_role === "thumbnail") || detail.resources[0];

  return {
    ...ui,
    dbId: detail.product.id,
    name: detail.product.name,
    description: detail.product.description,
    price,
    originalPrice,
    saving: `Save ₹${Math.round(originalPrice - price).toLocaleString("en-IN")}`,
    imageUrl: resource ? formatProductImage(resource.file_url) : undefined,
    reviewAverage: detail.review_stats?.average,
    reviewCount: detail.review_stats?.count,
  };
}

export function buildPlansFromCatalog(catalog: ProductDetail[]): Plan[] {
  const assigned = new Map<PlanKey, ProductDetail>();
  const usedIds = new Set<number>();

  for (const detail of catalog) {
    const key = getPlanKeyFromName(detail.product.name);
    if (key && !assigned.has(key)) {
      assigned.set(key, detail);
      usedIds.add(detail.product.id);
    }
  }

  // Renamed single products (e.g. without "1 Bottle" in the title) still show on home
  if (!assigned.has("single")) {
    const singleCandidate = catalog
      .filter((d) => !usedIds.has(d.product.id) && !isBundleProduct(d.product))
      .sort((a, b) => parseFloat(a.product.regular_price) - parseFloat(b.product.regular_price))[0];
    if (singleCandidate) {
      assigned.set("single", singleCandidate);
      usedIds.add(singleCandidate.product.id);
    }
  }

  const plans = (["single", "double", "triple"] as PlanKey[])
    .map((key) => {
      const detail = assigned.get(key);
      return detail ? buildPlanFromDetail(detail, key) : null;
    })
    .filter((plan): plan is Plan => plan !== null);

  return plans.length > 0 ? plans : FALLBACK_PLANS;
}

export function buildOfferItems(plans: Plan[]): string[] {
  const double = plans.find((p) => p.id === "double");
  const triple = plans.find((p) => p.id === "triple");
  const dynamic: string[] = [];

  if (double) dynamic.push(`Buy 2 Bottles For ₹${double.price.toLocaleString("en-IN")}`);
  if (triple) dynamic.push(`Buy 3 Bottles For ₹${triple.price.toLocaleString("en-IN")}`);

  return [...OFFER_ITEMS_STATIC.slice(0, 1), ...dynamic, ...OFFER_ITEMS_STATIC.slice(1)];
}

const FLOATING_CARD_POSITIONS: React.CSSProperties[] = [
  { left: 8, top: "18%" },
  { right: 16, top: "14%" },
  { left: 16, bottom: "28%" },
  { right: 8, top: "42%" },
  { left: "38%", top: "8%" },
  { right: 4, bottom: "20%" },
];

const HERO_GALLERY_LAYOUT: React.CSSProperties[] = [
  { width: 170, height: 220, top: "8%", left: "6%", transform: "rotate(-4deg)" },
  { width: 155, height: 195, bottom: "12%", left: "2%", transform: "rotate(3deg)" },
  { width: 165, height: 210, top: "6%", right: "4%", transform: "rotate(4deg)" },
  { width: 150, height: 185, bottom: "10%", right: "3%", transform: "rotate(-3deg)" },
  { width: 130, height: 160, top: "38%", left: "2%", transform: "rotate(1.5deg)" },
];

function HeroVisualComposition({
  heroImage,
  galleryImages,
  floatingLabels,
  cms,
  featuredPlanName,
}: {
  heroImage: string;
  galleryImages: string[];
  floatingLabels: string[];
  cms?: any;
  featuredPlanName: string;
}) {
  return (
    <>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 70% at 50% 45%, rgba(255,204,0,0.12) 0%, transparent 70%)" }} />

      <div
        className="absolute z-20 rounded-3xl overflow-hidden"
        style={{ width: 210, height: 420, left: "50%", top: "50%", transform: "translate(-50%, -50%)", boxShadow: "0 32px 80px rgba(0,0,0,0.14), 0 8px 24px rgba(212,175,55,0.2)" }}
      >
        <img
          data-cms-el="hero.imageUrl"
          src={heroImage}
          alt={plainTextFromHtml(featuredPlanName)}
          style={{ background: "#FFF9E6", ...buildImageStyle(readImageSize(cms, "imageUrl"), { width: "100%", height: "100%", objectFit: "cover" }) }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(255,204,0,0.08) 100%)" }} />
      </div>

      {galleryImages.map((src, i) => (
        <div
          key={i}
          data-cms-el="hero.galleryImages"
          className="absolute rounded-2xl overflow-hidden z-10"
          style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.12)", ...HERO_GALLERY_LAYOUT[i] }}
        >
          <img src={src} alt={`Lifestyle ${i + 1}`} className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
        </div>
      ))}

      {floatingLabels.map((label, i) => (
        <div
          key={i}
          data-cms-el="hero.floatingLabels"
          className="absolute z-30 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
          style={{ background: "rgba(255,255,255,0.96)", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif", boxShadow: "0 4px 20px rgba(0,0,0,0.10)", border: "1px solid rgba(212,175,55,0.25)", backdropFilter: "blur(8px)", letterSpacing: "0.02em", ...FLOATING_CARD_POSITIONS[i] }}
        >
          <span style={{ color: "#D4AF37" }}>&#9670;</span>{" "}{label}
        </div>
      ))}
    </>
  );
}

const INGREDIENTS = [
  { name: "5% Ethylated Vitamin C", benefit: "Brightens uneven skin tone and supports collagen production without irritation" },
  { name: "2% Exosome Complex", benefit: "Cell-to-cell communication technology that helps accelerate skin renewal and repair" },
  { name: "Peptide Renewal Complex", benefit: "Visibly firms and smooths skin by supporting structural protein production" },
  { name: "Barrier Support Complex", benefit: "Strengthens the skin's natural protective barrier against environmental stress" },
  { name: "Hydration Complex", benefit: "Draws and locks moisture deep within skin layers for lasting suppleness" },
  { name: "Recovery Complex", benefit: "Helps calm and restore skin after exposure to daily environmental aggressors" },
];

const TIMELINE = [
  { period: "Day 1–3", results: ["Instant hydration", "Visible glow", "Comfort and calm"] },
  { period: "Week 1–2", results: ["Smoother texture", "Reduced dullness", "More even appearance"] },
  { period: "Week 3–4", results: ["Brighter overall tone", "Fine lines less visible", "Firmer feel"] },
  { period: "Week 6–8", results: ["Visible transformation", "Confident bare skin", "Long-term results"] },
];

const REVIEWS = [
  { name: "Priya M.", location: "Mumbai", rating: 5, text: "I have tried every brightening serum on the market. Nothing came close to what ARGLOVE did in just 3 weeks. My skin literally glows." },
  { name: "Shreya K.", location: "Bengaluru", rating: 5, text: "The texture is so lightweight and absorbs instantly. No greasy residue. My morning routine is now incomplete without it." },
  { name: "Ananya R.", location: "Delhi", rating: 5, text: "I was skeptical but the results spoke for themselves. My hyperpigmentation has faded noticeably. Worth every rupee." },
  { name: "Divya S.", location: "Chennai", rating: 5, text: "Dermatologist recommended this after I asked about Exosome technology. The best investment I made for my skin this year." },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function scrollToBestseller() {
  document.getElementById("bestseller")?.scrollIntoView({ behavior: "smooth" });
}

// ─── Marquee ─────────────────────────────────────────────────────────────────

export function MarqueeBar({ items, bgColor = "#FFCC00", textColor = "#1A1A1A" }: { items: string[]; bgColor?: string; textColor?: string }) {
  const repeated = [...items, ...items, ...items];
  return (
    <div
      className="arglove-marquee overflow-hidden whitespace-nowrap py-2.5 text-[11px] font-semibold tracking-[0.12em] uppercase"
      style={{ background: bgColor, color: textColor, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="inline-flex gap-12" style={{ animation: "marquee 28s linear infinite" }}>
        {repeated.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-4">
            <span className="inline-block w-1 h-1 rounded-full" style={{ background: textColor, opacity: 0.5, flexShrink: 0 }} />
            {item}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }
      `}</style>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header({
  cartCount,
  onCartOpen,
  onSearchOpen,
  onAccountOpen,
  cms,
  editorMode = false,
}: {
  cartCount: number;
  onCartOpen: () => void;
  onSearchOpen: () => void;
  onAccountOpen: () => void;
  cms?: any;
  /** In visual CMS editor — use in-flow layout so the header is clickable/editable */
  editorMode?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (editorMode) return;
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [editorMode]);

  if (cms?.useHtmlOnly && cms?.customHtml) {
    const cssGlobal = isCssGlobal("header", cms);
    return (
      <div
        className="arglove-header-cms w-full"
        style={{
          position: editorMode ? "relative" : "fixed",
          top: editorMode ? 0 : 40,
          left: 0,
          right: 0,
          zIndex: 50,
        }}
      >
        <CmsHtmlCssBlock html={String(cms.customHtml)} css={String(cms.customCss || "")} scopeId="header" raw omitCss={cssGlobal} />
        <CmsSectionExtras cms={{ customFields: cms.customFields }} scopeId="header" />
        <SectionCustomElements cms={cms} scopeId="header" />
      </div>
    );
  }

  const logoText = cms?.logoText || "ARGLOVE";
  const logoSubText = cms?.logoSubText || "SKIN";
  const logoImageUrl = cms?.logoImageUrl;

  return (
    <>
      <header
        className="left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 transition-all duration-300 w-full"
        style={{
          position: editorMode ? "relative" : "fixed",
          top: editorMode ? 0 : 40,
          height: 70,
          background: editorMode || scrolled ? "rgba(255,255,255,0.97)" : "transparent",
          backdropFilter: editorMode || scrolled ? "blur(12px)" : "none",
          borderBottom: editorMode || scrolled ? "1px solid rgba(212,175,55,0.15)" : "none",
          boxShadow: editorMode || scrolled ? "0 2px 24px rgba(0,0,0,0.04)" : "none",
        }}
      >
        <div className="flex items-center gap-1">
          {logoImageUrl ? (
            <img
              data-cms-el="header.logoImageUrl"
              src={String(logoImageUrl)}
              alt={String(logoText)}
              style={buildImageStyle(readImageSize(cms, "logoImageUrl"), { height: "28px", width: "auto", objectFit: "contain" })}
            />
          ) : (
            <span data-cms-el="header.logoText" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, letterSpacing: "0.18em", color: "#1A1A1A" }}>
              <RichTextContent html={String(logoText)} inline />
            </span>
          )}
          <span
            data-cms-el="header.logoSubText"
            className="ml-1 text-[9px] font-semibold tracking-[0.22em] uppercase"
            style={{ color: "#D4AF37", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6 }}
          >
            <RichTextContent html={String(logoSubText)} inline />
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <button
            onClick={onSearchOpen}
            className="p-1.5 rounded-full transition-colors duration-200 hover:bg-black/5"
            style={{ color: "#1A1A1A" }}
            aria-label="Search"
          >
            <Search size={18} strokeWidth={1.5} />
          </button>

          <button
            onClick={onCartOpen}
            className="p-1.5 rounded-full transition-colors duration-200 hover:bg-black/5 relative"
            style={{ color: "#1A1A1A" }}
            aria-label="Cart"
          >
            <ShoppingBag size={18} strokeWidth={1.5} />
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {cartCount}
              </span>
            )}
          </button>

          <button
            onClick={onAccountOpen}
            className="p-1.5 rounded-full transition-colors duration-200 hover:bg-black/5"
            style={{ color: "#1A1A1A" }}
            aria-label="Account"
          >
            <User size={18} strokeWidth={1.5} />
          </button>
        </div>
      </header>
      {cms?.customHtml && !cms?.useHtmlOnly ? (
        <div className="px-4 sm:px-8 py-2" style={{ marginTop: editorMode ? 0 : undefined }}>
          <CmsHtmlCssBlock html={String(cms.customHtml)} css={String(cms.customCss || "")} scopeId="header-inline" raw={isCssGlobal("header", cms)} omitCss={isCssGlobal("header", cms)} />
        </div>
      ) : null}
      <CmsSectionExtras cms={cms} scopeId="header" />
      <CmsAnchor cms={cms} insertAfter={ELEMENT_INSERT_START} scopeId="header" />
      <SectionCustomElements cms={cms} scopeId="header" />
    </>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function HeroSection({ featuredPlan, cms }: { featuredPlan: Plan; cms?: any }) {
  if (cms?.useHtmlOnly && cms?.customHtml) {
    return (
      <CmsSectionOverride
        cms={cms}
        scopeId="hero"
        fallback={null}
        wrapperClassName="relative overflow-hidden py-16 px-8"
        wrapperStyle={{ background: "#FFF9E6" }}
      />
    );
  }

  const heroImage =
    cms?.imageUrl ||
    featuredPlan.imageUrl ||
    "https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=480&h=960&fit=crop&auto=format";
  const savings = Math.round(featuredPlan.originalPrice - featuredPlan.price);
  const badge = cms?.badge || "New Generation Anti-Aging Technology";
  const headline1 = cms?.headline1 || "AGE LESS.";
  const headline2 = cms?.headline2 || "REPAIR";
  const headline3 = cms?.headline3 || "MORE.";
  const description = cms?.description || featuredPlan.description;
  const ctaText = cms?.ctaText || "SHOP NOW";
  const trustItems: string[] = Array.isArray(cms?.trustItems) && cms.trustItems.length > 0 ? cms.trustItems : ["4.9/5 Customer Rating", "Thousands Of Happy Customers", "Made For Indian Skin", "Dermatologically Tested"];
  const benefitItems: string[] = Array.isArray(cms?.benefitItems) && cms.benefitItems.length > 0 ? cms.benefitItems : ["Improves Fine Lines", "Supports Skin Firmness", "Brightens Uneven Tone", "Supports Skin Barrier", "Deep Hydration", "Fast Absorbing Formula"];
  const galleryImages = cmsImageList(cms, "galleryImages", DEFAULT_HERO_GALLERY);
  const floatingLabels = cmsStringList(cms, "floatingLabels", DEFAULT_FLOATING_LABELS);
  const freeGiftText = cmsString(cms, "freeGiftText", "FREE Bio-Collagen Deep Mask Included");

  return (
    <section
      className="relative w-full overflow-hidden pt-24 sm:pt-[110px] lg:min-h-[700px] lg:h-screen"
      style={{ background: "#FFFFFF" }}
    >
      <div className="h-full grid grid-cols-1 lg:grid-cols-5 max-w-[1400px] mx-auto px-4 sm:px-8 gap-6 lg:gap-4">
        {/* LEFT CONTENT */}
        <div className="col-span-1 lg:col-span-2 flex flex-col justify-center lg:pr-8 gap-5 lg:gap-6 pb-8 lg:pb-0">
          <CmsAnchor cms={cms} insertAfter={ELEMENT_INSERT_START} scopeId="hero" />
          <div>
            <RichTextContent
              html={badge}
              as="span"
              inline
              className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-4 lg:mb-5"
              style={{ background: "#FFF9E6", color: "#D4AF37", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "1px solid rgba(212,175,55,0.3)" }}
              data-cms-el="hero.badge"
            />
            <CmsAnchor cms={cms} insertAfter="hero.badge" scopeId="hero" />
            <h1
              style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "clamp(44px, 11vw, 82px)", color: "#1A1A1A", lineHeight: 0.95, letterSpacing: "-0.02em" }}
            >
              <RichTextContent html={headline1} as="span" inline data-cms-el="hero.headline1" />
              <br />
              <RichTextContent html={headline2} as="span" inline style={{ color: "#D4AF37", fontStyle: "italic" }} data-cms-el="hero.headline2" />
              <br />
              <RichTextContent html={headline3} as="span" inline data-cms-el="hero.headline3" />
            </h1>
          </div>

          {/* Mobile hero visual — scaled desktop composition */}
          <div className="lg:hidden relative w-full overflow-hidden" style={{ height: "clamp(280px, 68vw, 380px)" }}>
            <div
              className="absolute left-1/2 top-1/2 w-[680px] h-[500px]"
              style={{ transform: "translate(-50%, -50%) scale(0.52)", transformOrigin: "center center" }}
            >
              <div className="relative w-full h-full">
                <HeroVisualComposition
                  heroImage={heroImage}
                  galleryImages={galleryImages}
                  floatingLabels={floatingLabels}
                  cms={cms}
                  featuredPlanName={featuredPlan.name}
                />
              </div>
            </div>
          </div>

          <RichTextContent
            html={description}
            as="p"
            className="max-w-full lg:max-w-[380px]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "#555", lineHeight: 1.75 }}
            data-cms-el="hero.description"
          />
          <CmsAnchor cms={cms} insertAfter="hero.description" scopeId="hero" />

          <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2">
            {benefitItems.map((b) => (
              <div key={b} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#FFCC00" }} />
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: "#1A1A1A", fontWeight: 500 }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="rounded-2xl p-5 flex flex-col gap-1 w-full sm:w-auto sm:inline-flex" style={{ background: "#FFF9E6", border: "1px solid rgba(212,175,55,0.25)" }}>
            <div className="flex items-center gap-3">
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 36, color: "#1A1A1A", lineHeight: 1 }}>&#8377;{featuredPlan.price.toLocaleString("en-IN")}</span>
              <div className="flex flex-col">
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "#999", textDecoration: "line-through" }}>MRP &#8377;{featuredPlan.originalPrice.toLocaleString("en-IN")}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Save &#8377;{savings.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <p className="text-xs flex items-center gap-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#D4AF37", fontWeight: 600 }}>
              <Check size={12} strokeWidth={2.5} />
              <RichTextContent html={freeGiftText} as="span" inline data-cms-el="hero.freeGiftText" />
            </p>
          </div>

          {/* CTA */}
          <button
            data-cms-el="hero.ctaText"
            onClick={scrollToBestseller}
            className="w-full sm:max-w-[300px] font-bold tracking-[0.12em] uppercase transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            style={{ background: "#FFCC00", color: "#1A1A1A", height: 56, borderRadius: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, letterSpacing: "0.12em", border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(255,204,0,0.4)" }}
          >
            <RichTextContent html={ctaText} inline />
          </button>

          {/* Trust Strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2" data-cms-el="hero.trustItems">
            {trustItems.map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[11px] font-medium" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#666" }}>
                <Check size={10} strokeWidth={2.5} style={{ color: "#D4AF37" }} />
                {t}
              </span>
            ))}
          </div>

          {cms?.customHtml ? (
            <div
              className="rounded-2xl p-4 text-sm"
              style={{ background: "#FFFFFF", border: "1px solid rgba(212,175,55,0.25)" }}
            >
              <CmsHtmlCssBlock html={String(cms.customHtml)} css={String(cms.customCss || "")} scopeId="hero-inline" />
            </div>
          ) : null}
          <CmsSectionExtras cms={cms} scopeId="hero" />
          <SectionCustomElements cms={cms} scopeId="hero" />
        </div>

        {/* RIGHT VISUAL — desktop only */}
        <div className="hidden lg:flex col-span-3 relative items-center justify-center min-h-[420px]">
          <HeroVisualComposition
            heroImage={heroImage}
            galleryImages={galleryImages}
            floatingLabels={floatingLabels}
            cms={cms}
            featuredPlanName={featuredPlan.name}
          />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.7))" }} />
    </section>
  );
}

// ─── Bestseller ───────────────────────────────────────────────────────────────

function PlanReviewStars({ rating, count, highlighted }: { rating: number; count: number; highlighted?: boolean }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={13}
            fill={n <= Math.round(rating) ? (highlighted ? "#1A1A1A" : "#D4AF37") : "none"}
            stroke={n <= Math.round(rating) ? (highlighted ? "#1A1A1A" : "#D4AF37") : highlighted ? "rgba(26,26,26,0.35)" : "#ccc"}
          />
        ))}
      </div>
      <span className="text-xs" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: highlighted ? "#1A1A1A" : "#666" }}>
        {rating.toFixed(1)} ({count})
      </span>
    </div>
  );
}

export function BestsellerSection({ onAddToCart, plans, cms }: { onAddToCart: (plan: Plan) => void; plans: Plan[]; cms?: any }) {
  if (cms?.useHtmlOnly && cms?.customHtml) {
    return (
      <CmsSectionOverride
        cms={cms}
        scopeId="bestseller"
        fallback={null}
        wrapperClassName="py-16 sm:py-24 px-4 sm:px-8"
        wrapperStyle={{ background: "#FFF9E6" }}
      />
    );
  }

  const badge = cms?.badge || "Bestseller";
  const title = cms?.title || "Choose Your Transformation";
  const planImageOverrides: Record<string, string> = {
    single: String(cms?.planImage1 || "").trim(),
    double: String(cms?.planImage2 || "").trim(),
    triple: String(cms?.planImage3 || "").trim(),
  };
  return (
    <section id="bestseller" className="py-16 sm:py-24 px-4 sm:px-8" style={{ background: "#FFF9E6" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <RichTextContent
            html={badge}
            as="span"
            inline
            className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-4"
            style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            data-cms-el="bestseller.badge"
          />
          <RichTextContent
            html={title}
            as="h2"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(32px, 4vw, 52px)", color: "#1A1A1A", lineHeight: 1.1 }}
            data-cms-el="bestseller.title"
          />
        </div>

        {cms?.customHtml ? (
          <div className="mb-8 rounded-2xl p-5" style={{ background: "#FFFFFF", border: "1px solid rgba(212,175,55,0.25)" }}>
            <CmsHtmlCssBlock html={String(cms.customHtml)} css={String(cms.customCss || "")} scopeId="bestseller-inline" />
          </div>
        ) : null}
        <CmsSectionExtras cms={cms} scopeId="bestseller" />
        <SectionCustomElements cms={cms} scopeId="bestseller" />

        <div className={`grid gap-6 ${plans.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {plans.map((plan, planIndex) => (
            <div
              key={plan.id}
              className="relative flex flex-col rounded-3xl overflow-hidden transition-transform duration-200 hover:-translate-y-1"
              style={{ background: plan.highlighted ? "#FFCC00" : "#FFFFFF", border: plan.highlighted ? "none" : "1px solid rgba(212,175,55,0.25)", boxShadow: plan.highlighted ? "0 20px 60px rgba(255,204,0,0.35)" : "0 4px 24px rgba(0,0,0,0.06)" }}
            >
              {plan.tag && (
                <div className="text-center py-2 text-[10px] font-bold tracking-[0.2em] uppercase" style={{ background: plan.highlighted ? "#1A1A1A" : "#FFCC00", color: plan.highlighted ? "#FFCC00" : "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {plan.tag}
                </div>
              )}
              <div className="p-6 sm:p-8 flex flex-col gap-4 flex-1">
                <div className="rounded-2xl overflow-hidden" style={{ height: 180, background: plan.highlighted ? "rgba(255,255,255,0.3)" : "#FFF9E6" }}>
                  <img
                    data-cms-el={`bestseller.planImage${planIndex + 1}`}
                    src={planImageOverrides[plan.id] || plan.imageUrl || "https://images.unsplash.com/photo-1680537260333-20fd95432044?w=400&h=360&fit=crop&auto=format"}
                    alt={plainTextFromHtml(plan.name)}
                    style={buildImageStyle(readImageSize(cms, `planImage${planIndex + 1}`), { width: "100%", height: "100%", objectFit: "cover" })}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: plan.highlighted ? "#1A1A1A" : "#999" }}>{plan.qty}</p>
                  <p className="text-sm font-medium mb-1 line-clamp-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#666" }}>
                    {plainTextLabel(plan.name, 100)}
                  </p>
                  <PlanReviewStars rating={plan.reviewAverage || 0} count={plan.reviewCount || 0} highlighted={plan.highlighted} />
                  <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 32, color: "#1A1A1A", lineHeight: 1 }}>₹{plan.price.toLocaleString("en-IN")}</p>
                  <p className="text-sm mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: plan.highlighted ? "#1A1A1A" : "#999", textDecoration: "line-through" }}>₹{plan.originalPrice.toLocaleString("en-IN")}</p>
                  <span className="inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: plan.highlighted ? "#1A1A1A" : "#FFF9E6", color: plan.highlighted ? "#FFCC00" : "#D4AF37", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {plan.saving}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5 flex-1">
                  {plan.extras.map((e) => (
                    <li key={e} className="flex items-center gap-2 text-xs" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1A1A1A" }}>
                      <Check size={12} strokeWidth={2.5} style={{ color: plan.highlighted ? "#1A1A1A" : "#D4AF37", flexShrink: 0 }} />
                      {e}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onAddToCart(plan)}
                  className="w-full py-3.5 rounded-xl font-bold tracking-[0.1em] uppercase text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                  style={{ background: plan.highlighted ? "#1A1A1A" : "#FFCC00", color: plan.highlighted ? "#FFCC00" : "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "none", cursor: "pointer" }}
                >
                  Buy Now
                </button>
                {plan.dbId ? (
                  <a
                    href={`/product/${plan.dbId}`}
                    onClick={(e) => spaNavigateClick(e, `/product/${plan.dbId}`)}
                    className="block text-center text-xs font-semibold mt-2 underline"
                    style={{ color: plan.highlighted ? "#1A1A1A" : "#666" }}
                  >
                    View product details
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Why It Works ─────────────────────────────────────────────────────────────

export function WhyItWorksSection({ cms }: { cms?: any }) {
  if (cms?.useHtmlOnly && cms?.customHtml) {
    return (
      <CmsSectionOverride
        cms={cms}
        scopeId="why"
        fallback={null}
        wrapperClassName="py-16 sm:py-24 px-4 sm:px-8"
        wrapperStyle={{ background: "#FFFFFF" }}
      />
    );
  }

  const badge = cmsString(cms, "badge", "The Science");
  const title = cmsString(cms, "title", "Why It Works");
  const description = cmsString(
    cms,
    "description",
    "Every ingredient in ARGLOVE Serum is chosen for a reason — backed by science, tested for Indian skin, and formulated for real, visible results."
  );
  const imageUrl = cmsString(cms, "imageUrl", "https://images.unsplash.com/photo-1679394270597-e90694d70350?w=700&h=1160&fit=crop&auto=format");
  const statNumber = cmsString(cms, "statNumber", "6-in-1");
  const statLabel = cmsString(cms, "statLabel", "Active Ingredient Complexes Working Together");

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8" style={{ background: "#FFFFFF" }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <RichTextContent html={badge} as="span" inline className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-5" style={{ background: "#FFF9E6", color: "#D4AF37", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "1px solid rgba(212,175,55,0.3)" }} data-cms-el="why.badge" />
            <RichTextContent html={title} as="h2" className="mb-4" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(30px, 3.5vw, 48px)", color: "#1A1A1A", lineHeight: 1.1 }} data-cms-el="why.title" />
            <RichTextContent html={description} as="p" className="mb-10 leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, color: "#666", lineHeight: 1.8 }} data-cms-el="why.description" />
            <div className="flex flex-col gap-4">
              {INGREDIENTS.map((ing) => (
                <div key={ing.name} className="flex gap-4 p-4 rounded-2xl transition-colors duration-200 hover:bg-[#FFF9E6]" style={{ border: "1px solid rgba(212,175,55,0.15)" }}>
                  <div className="w-2 flex-shrink-0 rounded-full mt-1" style={{ background: "#FFCC00", height: 20, alignSelf: "flex-start" }} />
                  <div>
                    <p className="font-semibold text-sm mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1A1A1A" }}>{ing.name}</p>
                    <p className="text-xs leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#777" }}>{ing.benefit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl overflow-hidden h-[280px] sm:h-[420px] lg:h-[580px]" style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.12)" }}>
              <img
                data-cms-el="why.imageUrl"
                src={imageUrl}
                alt="ARGLOVE serum bottle science"
                style={{ background: "#FFF9E6", ...buildImageStyle(readImageSize(cms, "imageUrl"), { width: "100%", height: "100%", objectFit: "cover" }) }}
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(255,204,0,0.08) 0%, transparent 60%)" }} />
            </div>
            <div className="relative sm:absolute sm:-bottom-6 sm:-left-6 mt-4 sm:mt-0 rounded-2xl p-5" style={{ background: "#FFCC00", boxShadow: "0 12px 40px rgba(255,204,0,0.3)", width: 200, maxWidth: "100%" }}>
              <RichTextContent html={statNumber} as="p" className="text-3xl font-bold mb-1" style={{ fontFamily: "'Fraunces', serif", color: "#1A1A1A" }} data-cms-el="why.statNumber" />
              <RichTextContent html={statLabel} as="p" className="text-xs font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1A1A1A" }} data-cms-el="why.statLabel" />
            </div>
          </div>
        </div>
        <CmsSectionExtras cms={cms} scopeId="why" />
        <SectionCustomElements cms={cms} scopeId="why" />
      </div>
    </section>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export function TimelineSection({ cms }: { cms?: any }) {
  if (cms?.useHtmlOnly && cms?.customHtml) {
    return (
      <CmsSectionOverride
        cms={cms}
        scopeId="timeline"
        fallback={null}
        wrapperClassName="py-16 sm:py-24 px-4 sm:px-8"
        wrapperStyle={{ background: "#FFF9E6" }}
      />
    );
  }

  const badge = cmsString(cms, "badge", "Results Timeline");
  const title = cmsString(cms, "title", "Your Skin's Journey");
  const imgs = cmsImageList(cms, "timelineImages", DEFAULT_TIMELINE_IMAGES);

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8" style={{ background: "#FFF9E6" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <RichTextContent html={badge} as="span" inline className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-4" style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }} data-cms-el="timeline.badge" />
          <RichTextContent html={title} as="h2" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(30px, 3.5vw, 48px)", color: "#1A1A1A", lineHeight: 1.1 }} data-cms-el="timeline.title" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px pointer-events-none" style={{ background: "linear-gradient(to right, #FFCC00, #D4AF37, #FFCC00, #D4AF37)" }} />
          {TIMELINE.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 w-24 h-24 rounded-2xl overflow-hidden mb-4 flex-shrink-0" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.10)" }}>
                <img data-cms-el="timeline.timelineImages" src={imgs[i]} alt={`Results at ${step.period}`} className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)" }} />
              </div>
              <div className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3" style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {step.period}
              </div>
              <div className="rounded-2xl p-4 w-full" style={{ background: "#FFFFFF", border: "1px solid rgba(212,175,55,0.2)" }}>
                {step.results.map((r) => (
                  <p key={r} className="text-xs py-1 border-b last:border-b-0" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1A1A1A", fontWeight: 500, borderColor: "rgba(212,175,55,0.15)" }}>{r}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <CmsSectionExtras cms={cms} scopeId="timeline" />
        <SectionCustomElements cms={cms} scopeId="timeline" />
      </div>
    </section>
  );
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export function ReviewsSection({ onVideoOpen, cms }: { onVideoOpen: () => void; cms?: any }) {
  if (cms?.useHtmlOnly && cms?.customHtml) {
    return (
      <CmsSectionOverride
        cms={cms}
        scopeId="reviews"
        fallback={null}
        wrapperClassName="py-16 sm:py-24 px-4 sm:px-8"
        wrapperStyle={{ background: "#FFFFFF" }}
      />
    );
  }

  const badge = cmsString(cms, "badge", "Customer Results");
  const title = cmsString(cms, "title", "Real Results. Real People.");
  const rating = cmsString(cms, "rating", "4.9");
  const customers = cmsString(cms, "customers", "12,000+");
  const videoImageUrl = cmsString(cms, "videoImageUrl", "https://images.unsplash.com/photo-1747264464985-2bc2e20c739e?w=500&h=680&fit=crop&auto=format");
  const videoLabel = cmsString(cms, "videoLabel", "Watch Customer Story");
  const statLabels = cmsStringList(cms, "statLabels", ["Skin Radiance", "Texture", "Hydration", "Firmness"]);
  const statValues = cmsStringList(cms, "statValues", ["98", "96", "99", "94"]);
  const statBars = statLabels.map((label, i) => [label, Number(statValues[i] || 0)] as const);

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8" style={{ background: "#FFFFFF" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <RichTextContent html={badge} as="span" inline className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-4" style={{ background: "#FFF9E6", color: "#D4AF37", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "1px solid rgba(212,175,55,0.3)" }} data-cms-el="reviews.badge" />
          <RichTextContent html={title} as="h2" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(30px, 3.5vw, 48px)", color: "#1A1A1A", lineHeight: 1.1 }} data-cms-el="reviews.title" />
        </div>

        {/* Rating summary */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-8 mb-14 p-6 sm:p-8 rounded-3xl" style={{ background: "#FFF9E6", border: "1px solid rgba(212,175,55,0.2)" }}>
          <div className="text-center">
            <RichTextContent html={rating} as="p" style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "clamp(48px, 12vw, 72px)", color: "#1A1A1A", lineHeight: 1 }} data-cms-el="reviews.rating" />
            <div className="flex items-center justify-center gap-1 mt-2">{[...Array(5)].map((_, i) => <Star key={i} size={16} fill="#FFCC00" stroke="none" />)}</div>
            <p className="text-xs mt-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999" }}>Overall Rating</p>
          </div>
          <div className="hidden lg:block w-px h-20 shrink-0" style={{ background: "rgba(212,175,55,0.3)" }} />
          <div className="w-full max-w-md flex flex-col gap-2" data-cms-el="reviews.statLabels">
            {statBars.map(([label, pct]) => (
              <div key={String(label)} className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs font-medium w-20 sm:w-28 shrink-0" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#555" }}>{label}</span>
                <div className="flex-1 min-w-0 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(212,175,55,0.2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#FFCC00" }} />
                </div>
                <span className="text-xs font-semibold shrink-0" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#D4AF37" }}>{pct}%</span>
              </div>
            ))}
          </div>
          <div className="hidden lg:block w-px h-20 shrink-0" style={{ background: "rgba(212,175,55,0.3)" }} />
          <div className="text-center">
            <RichTextContent html={customers} as="p" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(28px, 6vw, 36px)", color: "#1A1A1A", lineHeight: 1 }} data-cms-el="reviews.customers" />
            <p className="text-xs mt-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999" }}>Happy Customers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video card */}
          <button
            onClick={onVideoOpen}
            className="lg:col-span-1 rounded-3xl overflow-hidden relative cursor-pointer group text-left w-full"
            style={{ height: 280, border: "none", padding: 0 }}
            aria-label="Watch customer story video"
          >
            <img
              data-cms-el="reviews.videoImageUrl"
              src={videoImageUrl}
              alt="Customer video review"
              className="transition-transform duration-500 group-hover:scale-105"
              style={{ background: "#FFF9E6", ...buildImageStyle(readImageSize(cms, "videoImageUrl"), { width: "100%", height: "100%", objectFit: "cover" }) }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "rgba(26,26,26,0.35)" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110" style={{ background: "rgba(255,204,0,0.95)", boxShadow: "0 8px 32px rgba(255,204,0,0.5)" }}>
                <Play size={22} fill="#1A1A1A" stroke="none" style={{ marginLeft: 3 }} />
              </div>
              <RichTextContent html={videoLabel} as="p" className="text-sm font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#FFFFFF" }} data-cms-el="reviews.videoLabel" />
            </div>
          </button>

          {/* Review cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {REVIEWS.map((r) => (
              <div key={r.name} className="rounded-2xl p-6 flex flex-col gap-3" style={{ background: "#FFF9E6", border: "1px solid rgba(212,175,55,0.2)" }}>
                <div className="flex gap-0.5">{[...Array(r.rating)].map((_, i) => <Star key={i} size={12} fill="#FFCC00" stroke="none" />)}</div>
                <p className="text-sm leading-relaxed flex-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#333", lineHeight: 1.7 }}>&ldquo;{r.text}&rdquo;</p>
                <div>
                  <p className="text-xs font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1A1A1A" }}>{r.name}</p>
                  <p className="text-[10px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999" }}>{r.location} &middot; Verified Purchase</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <CmsSectionExtras cms={cms} scopeId="reviews" />
        <SectionCustomElements cms={cms} scopeId="reviews" />
      </div>
    </section>
  );
}

// ─── About ────────────────────────────────────────────────────────────────────

export function AboutSection({ cms }: { cms?: any }) {
  if (cms?.useHtmlOnly && cms?.customHtml) {
    return (
      <CmsSectionOverride
        cms={cms}
        scopeId="about"
        fallback={null}
        wrapperClassName="py-16 sm:py-24 px-4 sm:px-8"
        wrapperStyle={{ background: "#FFF9E6" }}
      />
    );
  }

  const badge = cmsString(cms, "badge", "Our Story");
  const title = cmsString(cms, "title", "Built For the Skin That Isn't Represented Enough");
  const imageUrl = cmsString(cms, "imageUrl", "https://images.unsplash.com/photo-1619002117199-47c7f0427d21?w=700&h=1040&fit=crop&auto=format");
  const cardLabel = cmsString(cms, "cardLabel", "Founded With Purpose");
  const cardTitle = cmsString(cms, "cardTitle", "For Indian Skin");

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8" style={{ background: "#FFF9E6" }}>
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="relative order-2 lg:order-1">
          <div className="rounded-3xl overflow-hidden h-[280px] sm:h-[400px] lg:h-[520px]" style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.10)" }}>
            <img
              data-cms-el="about.imageUrl"
              src={imageUrl}
              alt="ARGLOVE brand story"
              style={{ background: "#FFF9E6", ...buildImageStyle(readImageSize(cms, "imageUrl"), { width: "100%", height: "100%", objectFit: "cover" }) }}
            />
          </div>
          <div className="relative sm:absolute sm:-top-4 sm:-right-4 mt-4 sm:mt-0 rounded-2xl p-6" style={{ background: "#FFFFFF", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", border: "1px solid rgba(212,175,55,0.2)", width: 180, maxWidth: "100%" }}>
            <RichTextContent html={cardLabel} as="p" className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#D4AF37" }} data-cms-el="about.cardLabel" />
            <RichTextContent html={cardTitle} as="p" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#1A1A1A" }} data-cms-el="about.cardTitle" />
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <RichTextContent html={badge} as="span" inline className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-5" style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }} data-cms-el="about.badge" />
          <RichTextContent html={title} as="h2" className="mb-6" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(28px, 3vw, 44px)", color: "#1A1A1A", lineHeight: 1.15 }} data-cms-el="about.title" />
          {[
            { title: "Why ARGLOVE Exists", body: "Most skincare brands are designed for Western skin types. ARGLOVE was created specifically for Indian skin — our unique melanin levels, climate exposure, and lifestyle demands." },
            { title: "Exosome Technology", body: "Exosomes are nano-sized cellular messengers that help trigger skin repair at a biological level. We are among the first Indian brands to integrate this breakthrough at an effective clinical concentration." },
            { title: "Radical Transparency", body: "Every ingredient is listed with its concentration on our packaging. No hidden fillers. No misleading percentages. You know exactly what you are putting on your skin." },
            { title: "Premium Manufacturing", body: "Formulated in GMP-certified facilities. Every batch undergoes stability and safety testing before it leaves our lab. No compromises." },
          ].map((item) => (
            <div key={item.title} className="mb-6 flex items-start gap-3">
              <ChevronRight size={16} style={{ color: "#D4AF37", marginTop: 3, flexShrink: 0 }} />
              <div>
                <p className="font-semibold mb-1 text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1A1A1A" }}>{item.title}</p>
                <p className="text-sm leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#666", lineHeight: 1.75 }}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
        <CmsSectionExtras cms={cms} scopeId="about" />
        <SectionCustomElements cms={cms} scopeId="about" />
      </div>
    </section>
  );
}

export function FinalCTASection({ onAddToCart, plan, cms }: { onAddToCart: (plan: Plan) => void; plan?: Plan; cms?: any }) {
  if (!plan) return null;

  if (cms?.useHtmlOnly && cms?.customHtml) {
    return (
      <CmsSectionOverride
        cms={cms}
        scopeId="finalcta"
        fallback={null}
        wrapperClassName="py-16 sm:py-28 px-4 sm:px-8"
        wrapperStyle={{ background: "#FFFFFF" }}
      />
    );
  }

  const headline = cms?.headline || "READY TO TRANSFORM";
  const subheadline = cms?.subheadline || "YOUR SKIN?";
  const features: string[] = Array.isArray(cms?.features) && cms.features.length > 0
    ? cms.features
    : ["FREE Bio-Collagen Deep Mask", "Free Shipping Across India", "Cash On Delivery Available"];
  const ctaText = cms?.ctaText || "BUY NOW";
  const bottomStats = cmsStringList(cms, "bottomStats", ["4.9/5 Rating", "12,000+ Customers", "Dermatologically Tested", "Made For Indian Skin"]);

  return (
    <section className="relative overflow-hidden py-16 sm:py-28 px-4 sm:px-8 text-center" style={{ background: "#FFFFFF" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 80% at 50% 50%, rgba(255,204,0,0.10) 0%, transparent 70%)" }} />
      <div className="relative max-w-4xl mx-auto flex flex-col items-center gap-8">
        <div className="rounded-3xl overflow-hidden mx-auto" style={{ width: 200, height: 320, boxShadow: "0 32px 80px rgba(0,0,0,0.12)" }}>
          <img
            src={plan.imageUrl || "https://images.unsplash.com/photo-1650529192647-ce4eb5fb3314?w=400&h=640&fit=crop&auto=format"}
            alt={plainTextFromHtml(plan.name)}
            className="w-full h-full object-cover"
            style={{ background: "#FFF9E6" }}
          />
        </div>
        <h2 data-cms-el="finalcta.headline" style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "clamp(36px, 5vw, 68px)", color: "#1A1A1A", lineHeight: 1, letterSpacing: "-0.02em" }}>
          <RichTextContent html={headline} inline />
          <br />
          <RichTextContent html={subheadline} as="span" inline style={{ color: "#D4AF37", fontStyle: "italic" }} data-cms-el="finalcta.subheadline" />
        </h2>
        <div className="flex flex-col sm:flex-row items-center gap-6 w-full max-w-lg mx-auto">
          <div className="text-center">
            <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(32px, 8vw, 42px)", color: "#1A1A1A", lineHeight: 1 }}>&#8377;{plan.price.toLocaleString("en-IN")}</p>
            <p className="text-sm mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999", textDecoration: "line-through" }}>MRP &#8377;{plan.originalPrice.toLocaleString("en-IN")}</p>
          </div>
          <div className="hidden sm:block w-px h-16 shrink-0" style={{ background: "rgba(212,175,55,0.3)" }} />
          <div className="text-left flex flex-col gap-1.5 w-full sm:w-auto">
            {features.map((f) => (
              <p key={f} className="flex items-center gap-2 text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#444" }}>
                <Check size={14} strokeWidth={2.5} style={{ color: "#D4AF37" }} />
                {f}
              </p>
            ))}
          </div>
        </div>
        {cms?.customHtml ? (
          <div className="rounded-2xl p-5 text-left" style={{ background: "#FFF9E6", border: "1px solid rgba(212,175,55,0.25)" }}>
            <CmsHtmlCssBlock html={String(cms.customHtml)} css={String(cms.customCss || "")} scopeId="finalcta-inline" />
          </div>
        ) : null}
        <CmsSectionExtras cms={cms} scopeId="finalcta" />
        <SectionCustomElements cms={cms} scopeId="finalcta" />
        <button
          data-cms-el="finalcta.ctaText"
          onClick={() => plan && onAddToCart(plan)}
          className="w-full max-w-[320px] font-bold tracking-[0.14em] uppercase transition-all duration-200 hover:shadow-2xl active:scale-[0.98]"
          style={{ background: "#FFCC00", color: "#1A1A1A", height: 56, borderRadius: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, letterSpacing: "0.14em", border: "none", cursor: "pointer", boxShadow: "0 8px 40px rgba(255,204,0,0.45)" }}
        >
          <RichTextContent html={ctaText} inline />
        </button>
        <div className="flex items-center gap-6 flex-wrap justify-center" data-cms-el="finalcta.bottomStats">
          {bottomStats.map((t) => (
            <span key={t} className="text-[11px] font-medium flex items-center gap-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#888" }}>
              <span className="w-1 h-1 rounded-full inline-block" style={{ background: "#FFCC00" }} />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
// ─── Profile Panel ────────────────────────────────────────────────────────────

function ProfilePanel({
  user,
  addresses,
  orders,
  onLogout,
  onAddAddress,
  onDeleteAddress
}: {
  user: any;
  addresses: UserAddress[];
  orders: any[];
  onLogout: () => void;
  onAddAddress: (addr: UserAddress) => Promise<void>;
  onDeleteAddress: (id: number) => Promise<void>;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName || !streetAddress || !city || !stateName || !postalCode || !phoneNumber) {
      toast.error("Please fill in all address details.");
      return;
    }
    try {
      await onAddAddress({
        address_type: 'shipping',
        recipient_name: recipientName,
        street_address: streetAddress,
        city,
        state: stateName,
        postal_code: postalCode,
        phone_number: phoneNumber
      });
      setShowAddForm(false);
      setRecipientName(""); setStreetAddress(""); setCity(""); setStateName(""); setPostalCode(""); setPhoneNumber("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add address.");
    }
  };

  return (
    <div className="px-4 sm:px-8 pb-8 flex flex-col gap-6 max-h-[70vh] overflow-y-auto" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-400 font-semibold tracking-wider">LOGGED IN AS</p>
          <p className="text-sm font-bold text-gray-800 truncate max-w-[200px]">{user.email}</p>
        </div>
        <button
          onClick={onLogout}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition cursor-pointer"
        >
          Sign Out
        </button>
      </div>

      <div className="border-t pt-4" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Saved Addresses</p>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs font-semibold text-amber-600 hover:underline cursor-pointer"
          >
            {showAddForm ? "Cancel" : "+ Add New"}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddSubmit} className="flex flex-col gap-3 p-4 rounded-2xl mb-4 bg-amber-50/50 border border-amber-200">
            <input
              placeholder="Recipient Name"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              className="p-2.5 rounded-lg text-xs outline-none bg-white border border-amber-200"
            />
            <input
              placeholder="Street Address"
              value={streetAddress}
              onChange={e => setStreetAddress(e.target.value)}
              className="p-2.5 rounded-lg text-xs outline-none bg-white border border-amber-200"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="City"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="p-2.5 rounded-lg text-xs outline-none bg-white border border-amber-200"
              />
              <input
                placeholder="State"
                value={stateName}
                onChange={e => setStateName(e.target.value)}
                className="p-2.5 rounded-lg text-xs outline-none bg-white border border-amber-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Postal Code"
                value={postalCode}
                onChange={e => setPostalCode(e.target.value)}
                className="p-2.5 rounded-lg text-xs outline-none bg-white border border-amber-200"
              />
              <input
                placeholder="Phone Number"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                className="p-2.5 rounded-lg text-xs outline-none bg-white border border-amber-200"
              />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#FFCC00] hover:opacity-90 transition text-[#1A1A1A] cursor-pointer border-none">
              Save Address
            </button>
          </form>
        )}

        {addresses.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No saved addresses found.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {addresses.map(addr => (
              <div key={addr.id} className="p-3 rounded-xl border flex items-center justify-between text-xs bg-[#FFF9E6]" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
                <div>
                  <p className="font-bold">{addr.recipient_name}</p>
                  <p className="text-gray-500">{addr.street_address}, {addr.city}, {addr.state} - {addr.postal_code}</p>
                  <p className="text-gray-400">{addr.phone_number}</p>
                </div>
                {addr.id && (
                  <button onClick={() => onDeleteAddress(addr.id!)} className="p-1 text-gray-300 hover:text-red-500 transition cursor-pointer border-none bg-transparent">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-4" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">Order History</p>
        {orders.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No previous orders found.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map(order => (
              <div key={order.id} className="p-3 rounded-xl border text-xs bg-[#FFF9E6]" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
                <div className="flex justify-between font-bold mb-1">
                  <span>Order #{order.id}</span>
                  <span className="font-semibold" style={{ color: orderStatusColor(order.status, order.payment_status) }}>
                    {formatOrderStatus(order.status, order.payment_status)}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 mb-2">
                  {new Date(order.created_at).toLocaleDateString()}
                  {order.promo_code ? (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-emerald-600 font-semibold">
                      <Tag size={10} /> {order.promo_code}
                    </span>
                  ) : null}
                </div>
                {order.razorpay_payment_id ? (
                  <div className="text-[10px] text-gray-500 mb-2 font-mono break-all">
                    Payment ID: {order.razorpay_payment_id}
                  </div>
                ) : null}
                {order.razorpay_refund_id ? (
                  <div className="text-[10px] text-purple-600 mb-2 font-mono break-all">
                    Refund ID: {order.razorpay_refund_id}
                  </div>
                ) : null}
                <div className="border-t pt-1.5 flex flex-col gap-1" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
                  {order.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-gray-600">
                      <span>{plainTextFromHtml(item.name)} x {item.quantity}</span>
                      <span>₹{parseFloat(item.price_at_purchase).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t mt-2 pt-1.5 flex justify-between font-bold" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
                  <span>Total Amount</span>
                  <span>₹{parseFloat(order.total_amount).toLocaleString("en-IN")}</span>
                </div>
                {order.status !== "pending" && order.status !== "cancelled" ? (
                  <button
                    type="button"
                    onClick={() => downloadOrderInvoice(order, user.email)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold border-none cursor-pointer transition hover:opacity-90"
                    style={{ background: "#1A1A1A", color: "#FFCC00" }}
                  >
                    <Download size={12} /> Download Invoice
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({
  open,
  cart,
  onClose,
  onQtyChange,
  onRemove,
  user,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onCheckout,
  onOpenAccount,
  promoInput,
  onPromoInputChange,
  appliedPromo,
  onApplyPromo,
  onRemovePromo,
  applyingPromo,
}: {
  open: boolean;
  cart: CartItem[];
  onClose: () => void;
  onQtyChange: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  user: any;
  addresses: UserAddress[];
  selectedAddressId: number | null;
  onSelectAddress: (id: number) => void;
  onCheckout: () => void;
  onOpenAccount: () => void;
  promoInput: string;
  onPromoInputChange: (v: string) => void;
  appliedPromo: AppliedPromo | null;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
  applyingPromo: boolean;
}) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = appliedPromo ? calcPromoDiscount(subtotal, appliedPromo) : 0;
  const total = Math.max(subtotal - discount, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] transition-opacity duration-300"
        style={{ background: "rgba(26,26,26,0.4)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-[70] flex flex-col transition-transform duration-300 w-full max-w-[420px]"
        style={{ background: "#FFFFFF", transform: open ? "translateX(0)" : "translateX(100%)", boxShadow: "-8px 0 40px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
          <div>
            <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20, color: "#1A1A1A" }}>Your Cart</p>
            <p className="text-xs mt-0.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999" }}>{totalItems} {totalItems === 1 ? "item" : "items"}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors border-none bg-transparent cursor-pointer" style={{ color: "#1A1A1A" }} aria-label="Close cart">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <ShoppingBag size={48} strokeWidth={1} style={{ color: "#D4AF37", opacity: 0.4 }} />
              <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, color: "#1A1A1A" }}>Your cart is empty</p>
              <p className="text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999" }}>Add the ARGLOVE Serum to begin your skin transformation.</p>
              <button
                onClick={() => { onClose(); scrollToBestseller(); }}
                className="mt-2 px-6 py-3 rounded-xl font-bold text-sm tracking-wider uppercase transition-all duration-200 hover:opacity-90"
                style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "none", cursor: "pointer" }}
              >
                Shop Now
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 rounded-2xl" style={{ background: "#FFF9E6", border: "1px solid rgba(212,175,55,0.15)" }}>
                  <div className="rounded-xl overflow-hidden flex-shrink-0" style={{ width: 72, height: 88, background: "#FFFFFF" }}>
                    <img src="https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=144&h=176&fit=crop&auto=format" alt="ARGLOVE Serum" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-0.5 truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1A1A1A" }}>ARGLOVE Exosome Serum</p>
                    <p className="text-xs mb-1 line-clamp-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999" }}>
                      {plainTextLabel(item.name, 80)}
                    </p>
                    {item.freeGift && (
                      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2" style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        + FREE Mask
                      </span>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onQtyChange(item.id, -1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-black/10"
                          style={{ background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", color: "#1A1A1A" }}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1A1A1A" }}>{item.qty}</span>
                        <button
                          onClick={() => onQtyChange(item.id, 1)}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-black/10"
                          style={{ background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", color: "#1A1A1A" }}
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-sm" style={{ fontFamily: "'Fraunces', serif", color: "#1A1A1A" }}>₹{(item.price * item.qty).toLocaleString("en-IN")}</p>
                        <button onClick={() => onRemove(item.id)} className="p-1 rounded-full hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer" style={{ color: "#ccc" }} aria-label="Remove item">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Free gifts notice */}
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "#FFF9E6", border: "1px solid rgba(212,175,55,0.2)" }}>
                <Check size={16} strokeWidth={2.5} style={{ color: "#D4AF37", flexShrink: 0 }} />
                <p className="text-xs" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#555" }}>
                  Free shipping + FREE Bio-Collagen Deep Mask included with every order.
                </p>
              </div>

              {/* Address selector section */}
              {user && (
                <div className="border-t pt-4 mt-2" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Shipping Address</p>
                  {addresses.length === 0 ? (
                    <div className="text-xs text-gray-500">
                      No shipping address saved.{" "}
                      <button onClick={onOpenAccount} className="text-amber-600 font-semibold hover:underline bg-transparent border-none cursor-pointer">
                        Add one in your account settings
                      </button>{" "}
                      to checkout.
                    </div>
                  ) : (
                    <select
                      value={selectedAddressId || ""}
                      onChange={e => onSelectAddress(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl text-xs outline-none bg-amber-50/50 border border-amber-200"
                    >
                      <option value="" disabled>-- Select Shipping Address --</option>
                      {addresses.map(addr => (
                        <option key={addr.id} value={addr.id}>
                          {addr.recipient_name} - {addr.street_address}, {addr.city}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="px-6 py-5 border-t" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
            {user ? (
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1">
                  <Tag size={12} /> Coupon code
                </p>
                {appliedPromo ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                    <span className="font-bold text-emerald-700">{appliedPromo.code} applied</span>
                    <button type="button" onClick={onRemovePromo} className="text-red-500 font-semibold bg-transparent border-none cursor-pointer">Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => onPromoInputChange(e.target.value.toUpperCase())}
                      placeholder="e.g. WELCOME10"
                      className="flex-1 p-2.5 rounded-xl text-xs outline-none bg-amber-50/50 border border-amber-200 uppercase"
                    />
                    <button
                      type="button"
                      onClick={onApplyPromo}
                      disabled={applyingPromo || !promoInput.trim()}
                      className="px-3 py-2 rounded-xl text-xs font-bold border-none cursor-pointer disabled:opacity-50"
                      style={{ background: "#FFCC00", color: "#1A1A1A" }}
                    >
                      {applyingPromo ? "…" : "Apply"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#555" }}>Subtotal</span>
              <span className="text-sm font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "#1A1A1A" }}>₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            {discount > 0 ? (
              <div className="flex items-center justify-between mb-2 text-xs text-emerald-600 font-semibold">
                <span>Coupon discount</span>
                <span>− ₹{discount.toLocaleString("en-IN")}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1A1A1A" }}>Total</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 24, color: "#1A1A1A" }}>₹{total.toLocaleString("en-IN")}</span>
            </div>

            {user ? (
              <button
                onClick={onCheckout}
                disabled={!selectedAddressId}
                className={`w-full py-4 rounded-xl font-bold tracking-[0.1em] uppercase text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] border-none ${!selectedAddressId ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-400' : 'hover:opacity-90 bg-[#FFCC00] text-[#1A1A1A]'}`}
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: selectedAddressId ? "pointer" : "not-allowed", boxShadow: selectedAddressId ? "0 4px 20px rgba(255,204,0,0.4)" : "none" }}
              >
                Proceed to Checkout
                <ArrowRight size={16} strokeWidth={2} />
              </button>
            ) : (
              <button
                onClick={onOpenAccount}
                className="w-full py-4 rounded-xl font-bold tracking-[0.1em] uppercase text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98] border-none"
                style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer", boxShadow: "0 4px 20px rgba(255,204,0,0.4)" }}
              >
                Sign In to Checkout
                <ArrowRight size={16} strokeWidth={2} />
              </button>
            )}

            <p className="text-center text-[10px] mt-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#aaa" }}>
              Cash on Delivery available &middot; Free shipping across India
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Search Modal ─────────────────────────────────────────────────────────────

function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; name: string; description: string; regular_price: string; discount_price: string | null }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
      setResults([]);
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const products = await api.getProducts(query.trim());
        setResults(products);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const suggestions = ["Exosome Serum", "Anti-Aging", "Vitamin C Serum", "Bio-Collagen Mask", "Brightening", "Hydration"];

  return (
    <>
      <div
        className="fixed inset-0 z-[60] transition-opacity duration-200"
        style={{ background: "rgba(26,26,26,0.5)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 z-[70] transition-all duration-300"
        style={{ top: open ? 120 : 80, transform: "translateX(-50%)", width: "min(600px, 92vw)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      >
        <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid rgba(212,175,55,0.15)" }}>
            <Search size={18} strokeWidth={1.5} style={{ color: "#D4AF37", flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, ingredients..."
              className="flex-1 outline-none bg-transparent text-sm"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1A1A1A" }}
              onKeyDown={(e) => { if (e.key === "Enter" && query && results.length === 0 && !searching) toast.info(`No products found for "${query}"`); }}
            />
            {query && (
              <button onClick={() => setQuery("")} className="p-1 hover:bg-black/5 rounded-full transition-colors border-none bg-transparent cursor-pointer" style={{ color: "#aaa" }}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="px-5 py-4">
            {query.trim() ? (
              <>
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#D4AF37" }}>
                  {searching ? "Searching..." : `Results (${results.length})`}
                </p>
                {results.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {results.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => { toast.success(`Found: ${plainTextFromHtml(product.name)}`); onClose(); scrollToBestseller(); }}
                        className="text-left px-3 py-2 rounded-xl transition-colors hover:bg-[#FFF9E6] border border-transparent hover:border-amber-200 cursor-pointer bg-transparent"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        <p className="text-sm font-semibold line-clamp-2" style={{ color: "#1A1A1A" }}>{plainTextLabel(product.name, 80)}</p>
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "#666" }}>{plainTextLabel(product.description, 120)}</p>
                        <p className="text-xs mt-1 font-bold" style={{ color: "#D4AF37" }}>
                          ₹{parseFloat(product.discount_price || product.regular_price).toLocaleString("en-IN")}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : !searching ? (
                  <p className="text-xs" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999" }}>No products found.</p>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#D4AF37" }}>Popular Searches</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setQuery(s)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-[#FFCC00] hover:text-[#1A1A1A] border border-amber-200 cursor-pointer"
                      style={{ background: "#FFF9E6", color: "#555", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Account Modal ────────────────────────────────────────────────────────────

function AccountModal({
  open,
  onClose,
  user,
  addresses,
  orders,
  onLogin,
  onRegister,
  onLogout,
  onAddAddress,
  onDeleteAddress
}: {
  open: boolean;
  onClose: () => void;
  user: any;
  addresses: UserAddress[];
  orders: any[];
  onLogin: (email: string, pass: string) => Promise<void>;
  onRegister: (email: string, pass: string) => Promise<void>;
  onLogout: () => void;
  onAddAddress: (addr: UserAddress) => Promise<void>;
  onDeleteAddress: (id: number) => Promise<void>;
}) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields."); return; }
    setLoading(true);
    try {
      if (tab === "login") {
        await onLogin(email, password);
        toast.success("Welcome back!");
      } else {
        await onRegister(email, password);
        toast.success("Account created successfully!");
      }
      onClose();
      setEmail(""); setPassword("");
    } catch (err: any) {
      toast.error(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] transition-opacity duration-200"
        style={{ background: "rgba(26,26,26,0.5)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-[70] transition-all duration-300"
        style={{ transform: `translate(-50%, ${open ? "-50%" : "-44%"})`, width: "min(460px, 92vw)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      >
        <div className="rounded-3xl overflow-hidden" style={{ background: "#FFFFFF", boxShadow: "0 32px 100px rgba(0,0,0,0.18)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-8 pt-8 pb-4">
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#1A1A1A" }}>ARGLOVE</span>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors border-none bg-transparent cursor-pointer" style={{ color: "#1A1A1A" }} aria-label="Close">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          {user ? (
            <ProfilePanel
              user={user}
              addresses={addresses}
              orders={orders}
              onLogout={onLogout}
              onAddAddress={onAddAddress}
              onDeleteAddress={onDeleteAddress}
            />
          ) : (
            <>
              {/* Tabs */}
              <div className="flex mx-8 mb-6 rounded-xl overflow-hidden" style={{ background: "#FFF9E6" }}>
                {(["login", "signup"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 py-2.5 text-sm font-semibold transition-all duration-200"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: tab === t ? "#FFCC00" : "transparent", color: "#1A1A1A", border: "none", cursor: "pointer", borderRadius: tab === t ? 10 : 0 }}
                  >
                    {t === "login" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="px-8 pb-8 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#555" }}>Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FFF9E6", border: "1px solid rgba(212,175,55,0.25)", color: "#1A1A1A" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#555" }}>Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FFF9E6", border: "1px solid rgba(212,175,55,0.25)", color: "#1A1A1A" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-bold text-sm tracking-[0.1em] uppercase transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 border-none"
                  style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 16px rgba(255,204,0,0.35)" }}
                >
                  {loading ? "Processing..." : (tab === "login" ? "Sign In" : "Create Account")}
                </button>
                {tab === "login" && (
                  <p className="text-center text-xs" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#aaa" }}>
                    Forgot your password?{" "}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!email) { toast.error("Please enter your email above first."); return; }
                        try {
                          await api.forgotPassword(email);
                          toast.success("Password reset instructions sent.");
                        } catch (err: any) {
                          toast.error(err.message || "Failed to trigger password reset.");
                        }
                      }}
                      className="underline bg-transparent border-none cursor-pointer"
                      style={{ color: "#D4AF37", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "inherit" }}
                    >
                      Reset it
                    </button>
                  </p>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Video Modal ──────────────────────────────────────────────────────────────

function VideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-[60] transition-opacity duration-300"
        style={{ background: "rgba(10,10,10,0.85)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-[70] transition-all duration-300"
        style={{ transform: `translate(-50%, ${open ? "-50%" : "-44%"})`, width: "min(800px, 92vw)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      >
        <div className="relative rounded-3xl overflow-hidden" style={{ background: "#000", boxShadow: "0 40px 120px rgba(0,0,0,0.6)" }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/20 border-none bg-transparent cursor-pointer"
            style={{ color: "#FFFFFF" }}
            aria-label="Close video"
          >
            <X size={18} strokeWidth={1.5} />
          </button>

          {/* 16:9 video container */}
          <div style={{ aspectRatio: "16/9", position: "relative" }}>
            <img
              src="https://images.unsplash.com/photo-1747264464985-2bc2e20c739e?w=1200&h=675&fit=crop&auto=format"
              alt="Customer story"
              className="w-full h-full object-cover"
              style={{ opacity: 0.6 }}
            />
            {/* Centered play state */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(255,204,0,0.95)", boxShadow: "0 8px 40px rgba(255,204,0,0.6)" }}>
                <Play size={28} fill="#1A1A1A" stroke="none" style={{ marginLeft: 4 }} />
              </div>
              <div className="text-center">
                <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#FFFFFF", lineHeight: 1.2 }}>
                  "ARGLOVE Changed My Skin in 30 Days"
                </p>
                <p className="mt-2 text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  Priya M. &middot; Mumbai &middot; 4 weeks with ARGLOVE Exosome Serum
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export function Footer({ cms }: { cms?: any }) {
  if (cms?.useHtmlOnly && cms?.customHtml) {
    const cssGlobal = isCssGlobal("footer", cms);
    return (
      <>
        <CmsHtmlCssBlock html={String(cms.customHtml)} css={String(cms.customCss || "")} scopeId="footer" raw omitCss={cssGlobal} />
        <CmsSectionExtras cms={{ customFields: cms.customFields }} scopeId="footer" />
      </>
    );
  }

  const customHtml = cms?.customHtml;
  const copyrightText =
    cms?.copyright ||
    "© 2024 ARGLOVE. All rights reserved. Results may vary. These statements have not been evaluated by any regulatory authority.";
  const cssGlobal = isCssGlobal("footer", cms);

  return (
    <footer className="py-8 px-4 sm:px-8 text-center border-t" style={{ borderColor: "rgba(212,175,55,0.15)", background: "#FFFFFF" }}>
      {customHtml ? (
        <div className="max-w-4xl mx-auto mb-4 text-left">
          <CmsHtmlCssBlock html={String(customHtml)} css={String(cms?.customCss || "")} scopeId="footer-inline" raw={cssGlobal} omitCss={cssGlobal} />
        </div>
      ) : null}
      <CmsSectionExtras cms={cms} scopeId="footer" />
      <SectionCustomElements cms={cms} scopeId="footer" />
      <RichTextContent html={copyrightText} as="p" className="text-xs" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#bbb" }} data-cms-el="footer.copyright" />
    </footer>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, isAuthenticated, setUser, login, register, logout } = useAuth();
  const [pathname, setPathname] = useState(
    typeof window !== "undefined" ? window.location.pathname : "/"
  );

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const pageSlug = slugFromPublicPath(pathname) ?? "home";

  const [state, setState] = useState<AppState>({
    cart: [],
    cartOpen: false,
    searchOpen: false,
    accountOpen: false,
    videoOpen: false,
  });

  const [activePlans, setActivePlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [cmsSections, setCmsSections] = useState<Record<string, any>>({});
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);

  const productMatch = pathname.match(/^\/product\/(\d+)/);
  const productPageId = productMatch ? parseInt(productMatch[1], 10) : null;

  const isCmsAdminPath = pathname.startsWith("/cms");
  const isStoreAdminPath = pathname.startsWith("/admin");

  // Refresh profile details, addresses, and order history
  const refreshUserData = async () => {
    try {
      const data = await api.getProfile();
      setUser(data.user);
      setAddresses(data.addresses);
      if (data.addresses.length > 0) {
        setSelectedAddressId(data.addresses[0].id || null);
      }
      const history = await api.getOrderHistory();
      setOrders(history);
    } catch (err) {
      console.error("Failed to load user profile data:", err);
    }
  };

  const syncCartFromDb = async () => {
    try {
      const data = await api.getCart();
      const newCart = data.items.map(item => {
        let planId = 'single';
        let bottles = 1;
        let freeGift = false;

        const plainName = plainTextFromHtml(item.name);
        if (plainName.includes('2 Bottles')) {
          planId = 'double';
          bottles = 2;
          freeGift = true;
        } else if (plainName.includes('3 Bottles')) {
          planId = 'triple';
          bottles = 3;
          freeGift = true;
        }

        return {
          id: planId,
          name: item.name,
          qty: item.quantity,
          bottles,
          price: parseFloat(item.discount_price || item.regular_price),
          originalPrice: parseFloat(item.regular_price),
          freeGift,
          dbId: item.product_id
        };
      });

      setState(s => ({ ...s, cart: newCart }));
    } catch (err) {
      console.error("Failed to load cart from database:", err);
    }
  };

  const syncLocalCartToDb = async (localCart: CartItem[]) => {
    try {
      for (const item of localCart) {
        if (item.dbId) {
          await api.addToCart(item.dbId, item.qty);
        }
      }
      await syncCartFromDb();
    } catch (err) {
      console.error("Error syncing local cart to database:", err);
    }
  };

  // Load products from API on start and check login
  useEffect(() => {
    api.loadProductCatalog()
      .then((catalog) => setActivePlans(buildPlansFromCatalog(catalog)))
      .catch((err) => console.error("Error loading products:", err));

    const pKey = pageContentKey(pageSlug);
    api.getCmsSections(["header", "marquee", "hero", "bestseller", "why", "timeline", "reviews", "about", "finalcta", "footer", "home", "site", pKey])
      .then(({ sections }) => {
        const next: Record<string, any> = {};
        for (const [key, value] of Object.entries(sections || {})) {
          const content = (value as any)?.content ?? {};
          if (key === "home" || key === "site" || key.startsWith("page:")) {
            next[key] = content;
          } else {
            next[key] = mergeCmsSection(key, content);
          }
        }
        setCmsSections(next);
      })
      .catch((err) => console.error("Error loading CMS:", err));

    if (isAuthenticated) {
      refreshUserData();
      syncCartFromDb();
    }
  }, [pageSlug, isAuthenticated]);

  const setOpen = (key: keyof Omit<AppState, "cart">, value: boolean) =>
    setState((s) => ({ ...s, [key]: value }));

  const offerItems = buildOfferItems(activePlans);
  const marqueeCms = cmsSections.marquee || {};
  const marqueeItems =
    Array.isArray(marqueeCms.items) && marqueeCms.items.length > 0 ? marqueeCms.items : offerItems;
  const marqueeBgColor = marqueeCms.bgColor || "#FFCC00";
  const marqueeTextColor = marqueeCms.textColor || "#1A1A1A";

  const headerCms = mergeCmsSection("header", cmsSections.header);
  const heroCms = mergeCmsSection("hero", cmsSections.hero);
  const bestsellerCms = mergeCmsSection("bestseller", cmsSections.bestseller);
  const whyCms = mergeCmsSection("why", cmsSections.why);
  const timelineCms = mergeCmsSection("timeline", cmsSections.timeline);
  const reviewsCms = mergeCmsSection("reviews", cmsSections.reviews);
  const aboutCms = mergeCmsSection("about", cmsSections.about);
  const finalCtaCms = mergeCmsSection("finalcta", cmsSections.finalcta);
  const footerCms = mergeCmsSection("footer", cmsSections.footer);

  const siteConfig = normalizeSiteConfig(cmsSections.site);
  const globalBlocks: HomeBlock[] = siteConfig.globalBlocks || [];
  const pKey = pageContentKey(pageSlug);
  const pageContent = cmsSections[pKey] ?? (pageSlug === "home" ? cmsSections.home : null);
  const parsedPage = parsePageBlockContent(pageContent);
  let pageBlocks: HomeBlock[] = parsedPage.blocks;
  const preContentBlocks = parsedPage.preContentBlocks;
  const postContentBlocks = parsedPage.postContentBlocks;
  if (pageSlug === "home" && pageBlocks.length === 0 && globalBlocks.length === 0) {
    pageBlocks = DEFAULT_HOME_BLOCKS;
  }

  const featuredPlan = activePlans.find((p) => p.id === "single") || activePlans[0];

  const handleAddToCart = useCallback(async (plan: Plan) => {
    if (!plan.dbId) {
      toast.error("Product catalog mapping not ready.");
      return;
    }

    if (isAuthenticated) {
      try {
        await api.addToCart(plan.dbId, 1);
        await syncCartFromDb();
        setOpen("cartOpen", true);
        toast.success(`${plan.qty} added to cart!`);
      } catch (err: any) {
        toast.error(err.message || "Failed to sync cart item.");
      }
    } else {
      setState((s) => {
        const existing = s.cart.find((i) => i.id === plan.id);
        const newCart = existing
          ? s.cart.map((i) => i.id === plan.id ? { ...i, qty: i.qty + 1 } : i)
          : [...s.cart, { id: plan.id, name: plan.name, qty: 1, bottles: plan.bottles, price: plan.price, originalPrice: plan.originalPrice, freeGift: plan.freeGift, dbId: plan.dbId }];
        return { ...s, cart: newCart, cartOpen: true };
      });
      toast.success(`${plan.qty} added to cart locally!`, {
        description: "Log in to save your cart permanently."
      });
    }
  }, [activePlans, isAuthenticated]);

  const handleAddToCartByProductId = useCallback(async (productId: number, qty = 1, variantId?: number) => {
    const plan = activePlans.find((p) => p.dbId === productId);
    if (plan && !variantId) {
      await handleAddToCart(plan);
      return;
    }
    if (isAuthenticated) {
      try {
        await api.addToCart(productId, qty, variantId ?? null);
        await syncCartFromDb();
        setOpen("cartOpen", true);
        toast.success("Added to cart!");
      } catch (err: any) {
        toast.error(err.message || "Failed to add to cart.");
      }
    } else {
      toast.error("Please log in to add this product to your cart.");
      setOpen("accountOpen", true);
    }
  }, [activePlans, isAuthenticated, handleAddToCart]);

  const blockCtx = {
    featuredPlan,
    activePlans,
    heroCms,
    bestsellerCms,
    whyCms,
    timelineCms,
    reviewsCms,
    aboutCms,
    finalCtaCms,
    onAddToCart: handleAddToCart,
    onVideoOpen: () => setOpen("videoOpen", true),
    HeroSection,
    BestsellerSection,
    WhyItWorksSection,
    TimelineSection,
    ReviewsSection,
    AboutSection,
    FinalCTASection,
  };

  const handleQtyChange = useCallback(async (id: string, delta: number) => {
    if (isAuthenticated) {
      const item = state.cart.find(i => i.id === id);
      if (item && item.dbId) {
        const newQty = item.qty + delta;
        try {
          if (newQty <= 0) {
            await api.removeFromCart(item.dbId);
          } else {
            await api.updateCart(item.dbId, newQty);
          }
          await syncCartFromDb();
        } catch (err: any) {
          toast.error(err.message || "Failed to update quantity on server.");
        }
      }
    } else {
      setState((s) => {
        const newCart = s.cart
          .map((i) => i.id === id ? { ...i, qty: i.qty + delta } : i)
          .filter((i) => i.qty > 0);
        return { ...s, cart: newCart };
      });
    }
  }, [state.cart, isAuthenticated]);

  const handleRemove = useCallback(async (id: string) => {
    if (isAuthenticated) {
      const item = state.cart.find(i => i.id === id);
      if (item && item.dbId) {
        try {
          await api.removeFromCart(item.dbId);
          await syncCartFromDb();
          toast.info("Item removed from cart.");
        } catch (err: any) {
          toast.error(err.message || "Failed to remove item on server.");
        }
      }
    } else {
      setState((s) => ({ ...s, cart: s.cart.filter((i) => i.id !== id) }));
      toast.info("Item removed from cart.");
    }
  }, [state.cart, isAuthenticated]);

  const handleLogin = async (email: string, pass: string) => {
    await login(email, pass);
    await refreshUserData();
    await syncLocalCartToDb(state.cart);
  };

  const handleRegister = async (email: string, pass: string) => {
    await register(email, pass);
    await refreshUserData();
    await syncLocalCartToDb(state.cart);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setAddresses([]);
    setOrders([]);
    setSelectedAddressId(null);
    setState(s => ({ ...s, cart: [] }));
    toast.success("Signed out successfully.");
  };

  const handleAddAddress = async (addr: UserAddress) => {
    await api.addAddress(addr);
    await refreshUserData();
  };

  const handleDeleteAddress = async (id: number) => {
    await api.deleteAddress(id);
    await refreshUserData();
  };

  const handleCheckout = async () => {
    if (!selectedAddressId) {
      toast.error("Please select a shipping address first.");
      return;
    }
    const addressObj = addresses.find(a => a.id === selectedAddressId);
    if (!addressObj) {
      toast.error("Invalid shipping address selected.");
      return;
    }

    const fullAddressString = `${addressObj.recipient_name}, ${addressObj.street_address}, ${addressObj.city}, ${addressObj.state} - ${addressObj.postal_code}. Phone: ${addressObj.phone_number}`;

    try {
      const checkoutData = await api.createOrder(fullAddressString, appliedPromo?.code);

      if (!(window as any).Razorpay) {
        toast.info("Razorpay SDK not loaded, executing mock checkout bypass...");
        await api.verifyPayment(
          checkoutData.razorpay_order_id,
          'pay_mock_' + Math.random().toString(36).substring(7),
          'mock_sig_hash123'
        );
        toast.success("Order checked out successfully (dev fallback)!");
        await syncCartFromDb();
        await refreshUserData();
        setAppliedPromo(null);
        setPromoInput("");
        setState(s => ({ ...s, cartOpen: false }));
        return;
      }

      if (checkoutData.razorpay_order_id.startsWith('order_mock_')) {
        toast.error("Backend Razorpay keys are missing or invalid. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env, then restart the server.");
        return;
      }

      const razorpayKey =
        checkoutData.razorpay_key_id ||
        import.meta.env.VITE_RAZORPAY_KEY_ID ||
        'dummy_id';

      const options = {
        key: razorpayKey,
        currency: checkoutData.currency,
        name: 'ARGLOVE SKIN',
        description: 'Exosome anti-aging products purchase',
        order_id: checkoutData.razorpay_order_id,
        handler: async function (response: any) {
          try {
            await api.verifyPayment(
              checkoutData.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            toast.success("Payment verified and order placed successfully!");
            await syncCartFromDb();
            await refreshUserData();
            setAppliedPromo(null);
            setPromoInput("");
            setState(s => ({ ...s, cartOpen: false }));
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed.");
          }
        },
        prefill: {
          email: user?.email || '',
          contact: addressObj.phone_number || ''
        },
        theme: {
          color: '#FFCC00'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        toast.error(response.error?.description || "Payment failed. Please try again.");
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate checkout order.");
    }
  };

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setApplyingPromo(true);
    try {
      const result = await api.validatePromo(code);
      setAppliedPromo({
        code: result.promo.code,
        discount_type: result.promo.discount_type,
        discount_value: result.promo.discount_value,
      });
      toast.success(`Coupon ${result.promo.code} applied!`);
    } catch (err: any) {
      toast.error(err.message || "Invalid coupon code");
      setAppliedPromo(null);
    } finally {
      setApplyingPromo(false);
    }
  };

  const cartCount = state.cart.reduce((sum, i) => sum + i.qty, 0);

  const renderHomeBlock = (block: HomeBlock) => renderCmsBlock(block, blockCtx);

  const firstPageBlock = pageBlocks[0];
  const needsMainOffset =
    !!productPageId ||
    pageSlug !== "home" ||
    (firstPageBlock && firstPageBlock.type !== "hero") ||
    globalBlocks.length > 0;

  if (isCmsAdminPath) {
    return <VisualEditor />;
  }
  if (isStoreAdminPath) {
    return <AdminPanel />;
  }

  return (
    <div id="arglove-site-shell" className="w-full" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FFFFFF", color: "#1A1A1A" }}>
      <CmsGlobalStyles cmsSections={cmsSections} siteConfig={siteConfig} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, background: "#1A1A1A", color: "#FFFFFF", border: "1px solid rgba(255,204,0,0.3)" },
        }}
      />
      <MarqueeBar items={marqueeItems} bgColor={marqueeBgColor} textColor={marqueeTextColor} />
      <Header
        cartCount={cartCount}
        onCartOpen={() => setOpen("cartOpen", true)}
        onSearchOpen={() => setOpen("searchOpen", true)}
        onAccountOpen={() => setOpen("accountOpen", true)}
        cms={headerCms}
      />
      {preContentBlocks.map((b) => (
        <React.Fragment key={`pre-${b.id}`}>{renderHomeBlock(b)}</React.Fragment>
      ))}
      <main className={needsMainOffset ? "cms-main-offset" : undefined}>
        {productPageId ? (
          <ProductDetailPage
            productId={productPageId}
            onAddToCart={handleAddToCartByProductId}
            onOpenAccount={() => setOpen("accountOpen", true)}
          />
        ) : (
          <>
            {globalBlocks.map((b) => (
              <React.Fragment key={`g-${b.id}`}>{renderHomeBlock(b)}</React.Fragment>
            ))}
            {pageBlocks.map((b) => (
              <React.Fragment key={b.id}>{renderHomeBlock(b)}</React.Fragment>
            ))}
          </>
        )}
      </main>
      {postContentBlocks.map((b) => (
        <React.Fragment key={`post-${b.id}`}>{renderHomeBlock(b)}</React.Fragment>
      ))}
      <Footer cms={footerCms} />

      <CartDrawer
        open={state.cartOpen}
        cart={state.cart}
        onClose={() => setOpen("cartOpen", false)}
        onQtyChange={handleQtyChange}
        onRemove={handleRemove}
        user={user}
        addresses={addresses}
        selectedAddressId={selectedAddressId}
        onSelectAddress={setSelectedAddressId}
        onCheckout={handleCheckout}
        onOpenAccount={() => { setOpen("cartOpen", false); setOpen("accountOpen", true); }}
        promoInput={promoInput}
        onPromoInputChange={setPromoInput}
        appliedPromo={appliedPromo}
        onApplyPromo={handleApplyPromo}
        onRemovePromo={() => { setAppliedPromo(null); setPromoInput(""); }}
        applyingPromo={applyingPromo}
      />
      <SearchModal open={state.searchOpen} onClose={() => setOpen("searchOpen", false)} />
      <AccountModal
        open={state.accountOpen}
        onClose={() => setOpen("accountOpen", false)}
        user={user}
        addresses={addresses}
        orders={orders}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onLogout={handleLogout}
        onAddAddress={handleAddAddress}
        onDeleteAddress={handleDeleteAddress}
      />
      <VideoModal open={state.videoOpen} onClose={() => setOpen("videoOpen", false)} />

      {user?.role === "admin" && (
        <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-2">
          <a
            href="/admin"
            onClick={(e) => spaNavigateClick(e, "/admin")}
            className="flex items-center gap-2 px-4 py-3 rounded-full text-xs font-bold tracking-wider shadow-xl"
            style={{ background: "#1A1A1A", color: "#FFCC00", textDecoration: "none", border: "1px solid rgba(255,204,0,0.3)" }}
          >
            ⚙ Store Admin
          </a>
          <a
            href="/cms"
            onClick={(e) => spaNavigateClick(e, "/cms")}
            className="flex items-center gap-2 px-4 py-3 rounded-full text-xs font-bold tracking-wider shadow-xl"
            style={{ background: "#22c55e", color: "#fff", textDecoration: "none" }}
          >
            ✎ Edit Site
          </a>
        </div>
      )}
    </div>
  );
}
