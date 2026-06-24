import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search, ShoppingBag, User, Star, ChevronRight, Check, Play, X, Plus, Minus, ArrowRight, Trash2 } from "lucide-react";
import { Toaster, toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  id: string;
  name: string;
  qty: number;
  bottles: number;
  price: number;
  originalPrice: number;
  freeGift: boolean;
}

interface AppState {
  cart: CartItem[];
  cartOpen: boolean;
  searchOpen: boolean;
  accountOpen: boolean;
  videoOpen: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OFFER_ITEMS = [
  "FREE Bio-Collagen Deep Mask With Every Order",
  "Buy 2 Bottles For ₹1999",
  "Buy 3 Bottles For ₹2999",
  "Free Shipping Across India",
  "Cash On Delivery Available",
  "Exosome-Powered Skin Repair Technology",
];

const FLOATING_CARDS: { label: string; style: React.CSSProperties }[] = [
  { label: "5% Ethylated Vitamin C", style: { left: 8, top: "18%" } },
  { label: "2% Exosome Technology", style: { right: 16, top: "14%" } },
  { label: "Fast Absorbing", style: { left: 16, bottom: "28%" } },
  { label: "Non Greasy", style: { right: 8, top: "42%" } },
  { label: "Daily Use", style: { left: "38%", top: "8%" } },
  { label: "Suitable For Indian Skin", style: { right: 4, bottom: "20%" } },
];

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

const PLANS = [
  {
    id: "single",
    label: "Single Bottle",
    qty: "1 Bottle",
    bottles: 1,
    price: 1699,
    originalPrice: 1999,
    tag: null as string | null,
    saving: "Save ₹300",
    extras: ["30-day supply", "Free shipping"],
    freeGift: false,
    highlighted: false,
  },
  {
    id: "double",
    label: "Buy 2",
    qty: "2 Bottles",
    bottles: 2,
    price: 1999,
    originalPrice: 3998,
    tag: "Most Popular",
    saving: "Save ₹1,999",
    extras: ["60-day supply", "FREE Mask Included", "Free shipping"],
    freeGift: true,
    highlighted: true,
  },
  {
    id: "triple",
    label: "Buy 3",
    qty: "3 Bottles",
    bottles: 3,
    price: 2999,
    originalPrice: 5997,
    tag: "Best Value",
    saving: "Save ₹2,998",
    extras: ["90-day supply", "FREE Mask Included", "Free shipping", "COD Available"],
    freeGift: true,
    highlighted: false,
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function scrollToBestseller() {
  document.getElementById("bestseller")?.scrollIntoView({ behavior: "smooth" });
}

// ─── Marquee ─────────────────────────────────────────────────────────────────

function MarqueeBar() {
  const repeated = [...OFFER_ITEMS, ...OFFER_ITEMS, ...OFFER_ITEMS];
  return (
    <div
      className="overflow-hidden whitespace-nowrap py-2.5 text-[11px] font-semibold tracking-[0.12em] uppercase"
      style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="inline-flex gap-12" style={{ animation: "marquee 28s linear infinite" }}>
        {repeated.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-4">
            <span className="inline-block w-1 h-1 rounded-full" style={{ background: "#1A1A1A", opacity: 0.5, flexShrink: 0 }} />
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

function Header({
  cartCount,
  onCartOpen,
  onSearchOpen,
  onAccountOpen,
}: {
  cartCount: number;
  onCartOpen: () => void;
  onSearchOpen: () => void;
  onAccountOpen: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed left-0 right-0 z-50 flex items-center justify-between px-8 transition-all duration-300"
      style={{
        top: 40,
        height: 70,
        background: scrolled ? "rgba(255,255,255,0.97)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(212,175,55,0.15)" : "none",
        boxShadow: scrolled ? "0 2px 24px rgba(0,0,0,0.04)" : "none",
      }}
    >
      <div className="flex items-center gap-1">
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, letterSpacing: "0.18em", color: "#1A1A1A" }}>
          ARGLOVE
        </span>
        <span
          className="ml-1 text-[9px] font-semibold tracking-[0.22em] uppercase"
          style={{ color: "#D4AF37", fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 6 }}
        >
          SKIN
        </span>
      </div>

      <div className="flex items-center gap-6">
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
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ onAddToCart }: { onAddToCart: (plan: typeof PLANS[0]) => void }) {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ height: "100vh", minHeight: 700, background: "#FFFFFF", paddingTop: 110 }}
    >
      <div className="h-full grid grid-cols-5 max-w-[1400px] mx-auto px-8 gap-4">
        {/* LEFT CONTENT */}
        <div className="col-span-2 flex flex-col justify-center pr-8 gap-6">
          <div>
            <span
              className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-5"
              style={{ background: "#FFF9E6", color: "#D4AF37", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "1px solid rgba(212,175,55,0.3)" }}
            >
              New Generation Anti-Aging Technology
            </span>
            <h1
              style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "clamp(52px, 5.5vw, 82px)", color: "#1A1A1A", lineHeight: 0.95, letterSpacing: "-0.02em" }}
            >
              AGE LESS.
              <br />
              <span style={{ color: "#D4AF37", fontStyle: "italic" }}>REPAIR</span>
              <br />
              MORE.
            </h1>
          </div>

          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: "#555", maxWidth: 380, lineHeight: 1.75 }}>
            Powered by Exosome Technology, Ethylated Vitamin C, Peptides, and Bio-Cellular Repair Science to visibly improve skin radiance, texture, hydration, firmness, and overall skin appearance.
          </p>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {["Improves Fine Lines", "Supports Skin Firmness", "Brightens Uneven Tone", "Supports Skin Barrier", "Deep Hydration", "Fast Absorbing Formula"].map((b) => (
              <div key={b} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#FFCC00" }} />
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: "#1A1A1A", fontWeight: 500 }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="rounded-2xl p-5 inline-flex flex-col gap-1" style={{ background: "#FFF9E6", border: "1px solid rgba(212,175,55,0.25)" }}>
            <div className="flex items-center gap-3">
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 36, color: "#1A1A1A", lineHeight: 1 }}>&#8377;1,699</span>
              <div className="flex flex-col">
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "#999", textDecoration: "line-through" }}>MRP &#8377;1,999</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Save &#8377;300</span>
              </div>
            </div>
            <p className="text-xs flex items-center gap-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#D4AF37", fontWeight: 600 }}>
              <Check size={12} strokeWidth={2.5} />
              FREE Bio-Collagen Deep Mask Included
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={scrollToBestseller}
            className="font-bold tracking-[0.12em] uppercase transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            style={{ background: "#FFCC00", color: "#1A1A1A", width: 300, height: 60, borderRadius: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, letterSpacing: "0.12em", border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(255,204,0,0.4)" }}
          >
            SHOP NOW
          </button>

          {/* Trust Strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {["4.9/5 Customer Rating", "Thousands Of Happy Customers", "Made For Indian Skin", "Dermatologically Tested"].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[11px] font-medium" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#666" }}>
                <Check size={10} strokeWidth={2.5} style={{ color: "#D4AF37" }} />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* RIGHT VISUAL */}
        <div className="col-span-3 relative flex items-center justify-center">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 70% at 50% 45%, rgba(255,204,0,0.12) 0%, transparent 70%)" }} />

          {/* Main bottle */}
          <div
            className="absolute z-20 rounded-3xl overflow-hidden"
            style={{ width: "clamp(160px, 18vw, 240px)", height: "clamp(320px, 36vw, 480px)", left: "50%", top: "50%", transform: "translate(-50%, -50%)", boxShadow: "0 32px 80px rgba(0,0,0,0.14), 0 8px 24px rgba(212,175,55,0.2)" }}
          >
            <img src="https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=480&h=960&fit=crop&auto=format" alt="ARGLOVE Exosome Serum bottle" className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(255,204,0,0.08) 100%)" }} />
          </div>

          {/* Lifestyle images */}
          <div className="absolute rounded-2xl overflow-hidden z-10" style={{ width: 170, height: 220, top: "8%", left: "6%", boxShadow: "0 12px 40px rgba(0,0,0,0.12)", transform: "rotate(-4deg)" }}>
            <img src="https://images.unsplash.com/photo-1660118248632-103511f9b337?w=340&h=440&fit=crop&auto=format" alt="Woman with glowing skin" className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
          </div>
          <div className="absolute rounded-2xl overflow-hidden z-10" style={{ width: 155, height: 195, bottom: "12%", left: "2%", boxShadow: "0 12px 40px rgba(0,0,0,0.12)", transform: "rotate(3deg)" }}>
            <img src="https://images.unsplash.com/photo-1728727242233-0924178c1fb1?w=310&h=390&fit=crop&auto=format" alt="Woman smiling with radiant skin" className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
          </div>
          <div className="absolute rounded-2xl overflow-hidden z-10" style={{ width: 165, height: 210, top: "6%", right: "4%", boxShadow: "0 12px 40px rgba(0,0,0,0.12)", transform: "rotate(4deg)" }}>
            <img src="https://images.unsplash.com/photo-1622207691293-5cd80466dab3?w=330&h=420&fit=crop&auto=format" alt="Indian woman beauty portrait" className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
          </div>
          <div className="absolute rounded-2xl overflow-hidden z-10" style={{ width: 150, height: 185, bottom: "10%", right: "3%", boxShadow: "0 12px 40px rgba(0,0,0,0.12)", transform: "rotate(-3deg)" }}>
            <img src="https://images.unsplash.com/photo-1748543668687-624e058c367c?w=300&h=370&fit=crop&auto=format" alt="Serum texture close up" className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
          </div>
          <div className="absolute rounded-2xl overflow-hidden z-10" style={{ width: 130, height: 160, top: "38%", left: "2%", boxShadow: "0 12px 40px rgba(0,0,0,0.10)", transform: "rotate(1.5deg)" }}>
            <img src="https://images.unsplash.com/photo-1695972235594-8478ab831602?w=260&h=320&fit=crop&auto=format" alt="Luxury serum bottle with plant" className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
          </div>

          {/* Floating ingredient cards */}
          {FLOATING_CARDS.map((card, i) => (
            <div
              key={i}
              className="absolute z-30 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
              style={{ background: "rgba(255,255,255,0.96)", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif", boxShadow: "0 4px 20px rgba(0,0,0,0.10)", border: "1px solid rgba(212,175,55,0.25)", backdropFilter: "blur(8px)", letterSpacing: "0.02em", ...card.style }}
            >
              <span style={{ color: "#D4AF37" }}>&#9670;</span>{" "}{card.label}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.7))" }} />
    </section>
  );
}

// ─── Bestseller ───────────────────────────────────────────────────────────────

function BestsellerSection({ onAddToCart }: { onAddToCart: (plan: typeof PLANS[0]) => void }) {
  return (
    <section id="bestseller" className="py-24 px-8" style={{ background: "#FFF9E6" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <span className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-4" style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Bestseller
          </span>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(32px, 4vw, 52px)", color: "#1A1A1A", lineHeight: 1.1 }}>
            Choose Your Transformation
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {PLANS.map((plan) => (
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
              <div className="p-8 flex flex-col gap-4 flex-1">
                <div className="rounded-2xl overflow-hidden" style={{ height: 180, background: plan.highlighted ? "rgba(255,255,255,0.3)" : "#FFF9E6" }}>
                  <img src="https://images.unsplash.com/photo-1680537260333-20fd95432044?w=400&h=360&fit=crop&auto=format" alt="ARGLOVE serum bottle" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: plan.highlighted ? "#1A1A1A" : "#999" }}>{plan.qty}</p>
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Why It Works ─────────────────────────────────────────────────────────────

function WhyItWorksSection() {
  return (
    <section className="py-24 px-8" style={{ background: "#FFFFFF" }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-5" style={{ background: "#FFF9E6", color: "#D4AF37", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "1px solid rgba(212,175,55,0.3)" }}>
              The Science
            </span>
            <h2 className="mb-4" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(30px, 3.5vw, 48px)", color: "#1A1A1A", lineHeight: 1.1 }}>Why It Works</h2>
            <p className="mb-10 leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, color: "#666", lineHeight: 1.8 }}>
              Every ingredient in ARGLOVE Serum is chosen for a reason — backed by science, tested for Indian skin, and formulated for real, visible results.
            </p>
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
            <div className="rounded-3xl overflow-hidden" style={{ height: 580, boxShadow: "0 24px 80px rgba(0,0,0,0.12)" }}>
              <img src="https://images.unsplash.com/photo-1679394270597-e90694d70350?w=700&h=1160&fit=crop&auto=format" alt="ARGLOVE serum bottle science" className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(255,204,0,0.08) 0%, transparent 60%)" }} />
            </div>
            <div className="absolute -bottom-6 -left-6 rounded-2xl p-5" style={{ background: "#FFCC00", boxShadow: "0 12px 40px rgba(255,204,0,0.3)", width: 200 }}>
              <p className="text-3xl font-bold mb-1" style={{ fontFamily: "'Fraunces', serif", color: "#1A1A1A" }}>6-in-1</p>
              <p className="text-xs font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1A1A1A" }}>Active Ingredient Complexes Working Together</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function TimelineSection() {
  const imgs = [
    "https://images.unsplash.com/photo-1643379855542-82c0c7483f3a?w=192&h=192&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1728727242233-0924178c1fb1?w=192&h=192&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1622207691293-5cd80466dab3?w=192&h=192&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1660118248632-103511f9b337?w=192&h=192&fit=crop&auto=format",
  ];
  return (
    <section className="py-24 px-8" style={{ background: "#FFF9E6" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-4" style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Results Timeline</span>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(30px, 3.5vw, 48px)", color: "#1A1A1A", lineHeight: 1.1 }}>Your Skin&apos;s Journey</h2>
        </div>
        <div className="grid grid-cols-4 gap-6 relative">
          <div className="absolute top-12 left-[12.5%] right-[12.5%] h-px pointer-events-none" style={{ background: "linear-gradient(to right, #FFCC00, #D4AF37, #FFCC00, #D4AF37)" }} />
          {TIMELINE.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 w-24 h-24 rounded-2xl overflow-hidden mb-4 flex-shrink-0" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.10)" }}>
                <img src={imgs[i]} alt={`Results at ${step.period}`} className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
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
      </div>
    </section>
  );
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

function ReviewsSection({ onVideoOpen }: { onVideoOpen: () => void }) {
  return (
    <section className="py-24 px-8" style={{ background: "#FFFFFF" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-4" style={{ background: "#FFF9E6", color: "#D4AF37", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "1px solid rgba(212,175,55,0.3)" }}>Customer Results</span>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(30px, 3.5vw, 48px)", color: "#1A1A1A", lineHeight: 1.1 }}>Real Results. Real People.</h2>
        </div>

        {/* Rating summary */}
        <div className="flex items-center justify-center gap-8 mb-14 p-8 rounded-3xl" style={{ background: "#FFF9E6", border: "1px solid rgba(212,175,55,0.2)" }}>
          <div className="text-center">
            <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 72, color: "#1A1A1A", lineHeight: 1 }}>4.9</p>
            <div className="flex items-center justify-center gap-1 mt-2">{[...Array(5)].map((_, i) => <Star key={i} size={16} fill="#FFCC00" stroke="none" />)}</div>
            <p className="text-xs mt-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999" }}>Overall Rating</p>
          </div>
          <div className="w-px h-20" style={{ background: "rgba(212,175,55,0.3)" }} />
          <div className="flex flex-col gap-2">
            {[["Skin Radiance", 98], ["Texture", 96], ["Hydration", 99], ["Firmness", 94]].map(([label, pct]) => (
              <div key={String(label)} className="flex items-center gap-3">
                <span className="text-xs font-medium w-28" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#555" }}>{label}</span>
                <div className="w-40 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(212,175,55,0.2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#FFCC00" }} />
                </div>
                <span className="text-xs font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#D4AF37" }}>{pct}%</span>
              </div>
            ))}
          </div>
          <div className="w-px h-20" style={{ background: "rgba(212,175,55,0.3)" }} />
          <div className="text-center">
            <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 36, color: "#1A1A1A", lineHeight: 1 }}>12,000+</p>
            <p className="text-xs mt-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999" }}>Happy Customers</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Video card */}
          <button
            onClick={onVideoOpen}
            className="col-span-1 rounded-3xl overflow-hidden relative cursor-pointer group text-left"
            style={{ height: 340, border: "none", padding: 0 }}
            aria-label="Watch customer story video"
          >
            <img src="https://images.unsplash.com/photo-1747264464985-2bc2e20c739e?w=500&h=680&fit=crop&auto=format" alt="Customer video review" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" style={{ background: "#FFF9E6" }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "rgba(26,26,26,0.35)" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110" style={{ background: "rgba(255,204,0,0.95)", boxShadow: "0 8px 32px rgba(255,204,0,0.5)" }}>
                <Play size={22} fill="#1A1A1A" stroke="none" style={{ marginLeft: 3 }} />
              </div>
              <p className="text-sm font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#FFFFFF" }}>Watch Customer Story</p>
            </div>
          </button>

          {/* Review cards */}
          <div className="col-span-2 grid grid-cols-2 gap-4">
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
      </div>
    </section>
  );
}

// ─── About ────────────────────────────────────────────────────────────────────

function AboutSection() {
  return (
    <section className="py-24 px-8" style={{ background: "#FFF9E6" }}>
      <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-center">
        <div className="relative">
          <div className="rounded-3xl overflow-hidden" style={{ height: 520, boxShadow: "0 24px 80px rgba(0,0,0,0.10)" }}>
            <img src="https://images.unsplash.com/photo-1619002117199-47c7f0427d21?w=700&h=1040&fit=crop&auto=format" alt="ARGLOVE brand story" className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
          </div>
          <div className="absolute -top-4 -right-4 rounded-2xl p-6" style={{ background: "#FFFFFF", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", border: "1px solid rgba(212,175,55,0.2)", width: 180 }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#D4AF37" }}>Founded With Purpose</p>
            <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#1A1A1A" }}>For Indian Skin</p>
          </div>
        </div>
        <div>
          <span className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-5" style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Our Story</span>
          <h2 className="mb-6" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "clamp(28px, 3vw, 44px)", color: "#1A1A1A", lineHeight: 1.15 }}>
            Built For the Skin That Isn&apos;t Represented Enough
          </h2>
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
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTASection({ onAddToCart }: { onAddToCart: (plan: typeof PLANS[0]) => void }) {
  return (
    <section className="relative overflow-hidden py-28 px-8 text-center" style={{ background: "#FFFFFF" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 80% at 50% 50%, rgba(255,204,0,0.10) 0%, transparent 70%)" }} />
      <div className="relative max-w-4xl mx-auto flex flex-col items-center gap-8">
        <div className="rounded-3xl overflow-hidden mx-auto" style={{ width: 200, height: 320, boxShadow: "0 32px 80px rgba(0,0,0,0.12)" }}>
          <img src="https://images.unsplash.com/photo-1650529192647-ce4eb5fb3314?w=400&h=640&fit=crop&auto=format" alt="ARGLOVE serum collection" className="w-full h-full object-cover" style={{ background: "#FFF9E6" }} />
        </div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "clamp(36px, 5vw, 68px)", color: "#1A1A1A", lineHeight: 1, letterSpacing: "-0.02em" }}>
          READY TO TRANSFORM
          <br />
          <span style={{ color: "#D4AF37", fontStyle: "italic" }}>YOUR SKIN?</span>
        </h2>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 42, color: "#1A1A1A", lineHeight: 1 }}>&#8377;1,699</p>
            <p className="text-sm mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999", textDecoration: "line-through" }}>MRP &#8377;1,999</p>
          </div>
          <div className="w-px h-16" style={{ background: "rgba(212,175,55,0.3)" }} />
          <div className="text-left flex flex-col gap-1.5">
            {["FREE Bio-Collagen Deep Mask", "Free Shipping Across India", "Cash On Delivery Available"].map((f) => (
              <p key={f} className="flex items-center gap-2 text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#444" }}>
                <Check size={14} strokeWidth={2.5} style={{ color: "#D4AF37" }} />
                {f}
              </p>
            ))}
          </div>
        </div>
        <button
          onClick={() => onAddToCart(PLANS[0])}
          className="font-bold tracking-[0.14em] uppercase transition-all duration-200 hover:shadow-2xl active:scale-[0.98]"
          style={{ background: "#FFCC00", color: "#1A1A1A", width: 320, height: 64, borderRadius: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, letterSpacing: "0.14em", border: "none", cursor: "pointer", boxShadow: "0 8px 40px rgba(255,204,0,0.45)" }}
        >
          BUY NOW
        </button>
        <div className="flex items-center gap-6 flex-wrap justify-center">
          {["4.9/5 Rating", "12,000+ Customers", "Dermatologically Tested", "Made For Indian Skin"].map((t) => (
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

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({
  open,
  cart,
  onClose,
  onQtyChange,
  onRemove,
}: {
  open: boolean;
  cart: CartItem[];
  onClose: () => void;
  onQtyChange: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}) {
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
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
        className="fixed top-0 right-0 h-full z-[70] flex flex-col transition-transform duration-300"
        style={{ width: 420, background: "#FFFFFF", transform: open ? "translateX(0)" : "translateX(100%)", boxShadow: "-8px 0 40px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
          <div>
            <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20, color: "#1A1A1A" }}>Your Cart</p>
            <p className="text-xs mt-0.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999" }}>{totalItems} {totalItems === 1 ? "item" : "items"}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors" style={{ color: "#1A1A1A" }} aria-label="Close cart">
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
                    <p className="text-xs mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#999" }}>{item.name}</p>
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
                        <button onClick={() => onRemove(item.id)} className="p-1 rounded-full hover:bg-red-50 transition-colors" style={{ color: "#ccc", border: "none", cursor: "pointer", background: "transparent" }} aria-label="Remove item">
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
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="px-6 py-5 border-t" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#555" }}>Subtotal</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 24, color: "#1A1A1A" }}>₹{total.toLocaleString("en-IN")}</span>
            </div>
            <button
              onClick={() => toast.success("Order placed! We'll confirm via WhatsApp shortly.", { duration: 4000 })}
              className="w-full py-4 rounded-xl font-bold tracking-[0.1em] uppercase text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(255,204,0,0.4)" }}
            >
              Proceed to Checkout
              <ArrowRight size={16} strokeWidth={2} />
            </button>
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

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
              onKeyDown={(e) => { if (e.key === "Enter" && query) toast.info(`Searching for "${query}"...`); }}
            />
            {query && (
              <button onClick={() => setQuery("")} className="p-1 hover:bg-black/5 rounded-full transition-colors" style={{ color: "#aaa", border: "none", cursor: "pointer", background: "transparent" }}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#D4AF37" }}>Popular Searches</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); toast.info(`Searching for "${s}"...`); onClose(); }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-[#FFCC00] hover:text-[#1A1A1A]"
                  style={{ background: "#FFF9E6", color: "#555", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "1px solid rgba(212,175,55,0.2)", cursor: "pointer" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Account Modal ────────────────────────────────────────────────────────────

function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields."); return; }
    toast.success(tab === "login" ? "Welcome back!" : "Account created! Welcome to ARGLOVE.");
    onClose();
    setEmail(""); setPassword("");
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] transition-opacity duration-200"
        style={{ background: "rgba(26,26,26,0.5)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-[70] transition-all duration-300"
        style={{ transform: `translate(-50%, ${open ? "-50%" : "-44%"})`, width: "min(440px, 92vw)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      >
        <div className="rounded-3xl overflow-hidden" style={{ background: "#FFFFFF", boxShadow: "0 32px 100px rgba(0,0,0,0.18)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-8 pt-8 pb-4">
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#1A1A1A" }}>ARGLOVE</span>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 transition-colors" style={{ border: "none", cursor: "pointer", background: "transparent", color: "#1A1A1A" }} aria-label="Close">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FFF9E6", border: "1px solid rgba(212,175,55,0.25)", color: "#1A1A1A" }}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl font-bold text-sm tracking-[0.1em] uppercase transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif", border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(255,204,0,0.35)" }}
            >
              {tab === "login" ? "Sign In" : "Create Account"}
            </button>
            {tab === "login" && (
              <p className="text-center text-xs" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#aaa" }}>
                Forgot your password?{" "}
                <button type="button" onClick={() => toast.info("Password reset link sent to your email.")} className="underline" style={{ color: "#D4AF37", background: "transparent", border: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "inherit" }}>Reset it</button>
              </p>
            )}
          </form>
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
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/20"
            style={{ background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", color: "#FFFFFF" }}
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

function Footer() {
  return (
    <footer className="py-8 px-8 text-center border-t" style={{ borderColor: "rgba(212,175,55,0.15)", background: "#FFFFFF" }}>
      <p className="text-xs" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#bbb" }}>
        &copy; 2024 ARGLOVE. All rights reserved. Results may vary. These statements have not been evaluated by any regulatory authority.
      </p>
    </footer>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, setState] = useState<AppState>({
    cart: [],
    cartOpen: false,
    searchOpen: false,
    accountOpen: false,
    videoOpen: false,
  });

  const setOpen = (key: keyof Omit<AppState, "cart">, value: boolean) =>
    setState((s) => ({ ...s, [key]: value }));

  const handleAddToCart = useCallback((plan: typeof PLANS[0]) => {
    setState((s) => {
      const existing = s.cart.find((i) => i.id === plan.id);
      const newCart = existing
        ? s.cart.map((i) => i.id === plan.id ? { ...i, qty: i.qty + 1 } : i)
        : [...s.cart, { id: plan.id, name: plan.qty, qty: 1, bottles: plan.bottles, price: plan.price, originalPrice: plan.originalPrice, freeGift: plan.freeGift }];
      return { ...s, cart: newCart, cartOpen: true };
    });
    toast.success(`${plan.qty} added to cart!`, {
      description: plan.freeGift ? "FREE Bio-Collagen Deep Mask included." : "Free shipping included.",
      duration: 3000,
    });
  }, []);

  const handleQtyChange = useCallback((id: string, delta: number) => {
    setState((s) => {
      const newCart = s.cart
        .map((i) => i.id === id ? { ...i, qty: i.qty + delta } : i)
        .filter((i) => i.qty > 0);
      return { ...s, cart: newCart };
    });
  }, []);

  const handleRemove = useCallback((id: string) => {
    setState((s) => ({ ...s, cart: s.cart.filter((i) => i.id !== id) }));
    toast.info("Item removed from cart.");
  }, []);

  const cartCount = state.cart.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div className="w-full" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FFFFFF", color: "#1A1A1A" }}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, background: "#1A1A1A", color: "#FFFFFF", border: "1px solid rgba(255,204,0,0.3)" },
        }}
      />
      <MarqueeBar />
      <Header
        cartCount={cartCount}
        onCartOpen={() => setOpen("cartOpen", true)}
        onSearchOpen={() => setOpen("searchOpen", true)}
        onAccountOpen={() => setOpen("accountOpen", true)}
      />
      <main>
        <HeroSection onAddToCart={handleAddToCart} />
        <BestsellerSection onAddToCart={handleAddToCart} />
        <WhyItWorksSection />
        <TimelineSection />
        <ReviewsSection onVideoOpen={() => setOpen("videoOpen", true)} />
        <AboutSection />
        <FinalCTASection onAddToCart={handleAddToCart} />
      </main>
      <Footer />

      <CartDrawer
        open={state.cartOpen}
        cart={state.cart}
        onClose={() => setOpen("cartOpen", false)}
        onQtyChange={handleQtyChange}
        onRemove={handleRemove}
      />
      <SearchModal open={state.searchOpen} onClose={() => setOpen("searchOpen", false)} />
      <AccountModal open={state.accountOpen} onClose={() => setOpen("accountOpen", false)} />
      <VideoModal open={state.videoOpen} onClose={() => setOpen("videoOpen", false)} />
    </div>
  );
}
