import React, { useEffect, useState } from "react";
import { Star, ShoppingBag, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { api, ProductDetail, ProductResource, ProductVariant } from "../services/api";
import ImageZoomGallery, { GalleryItem } from "../components/ImageZoomGallery";
import ProductPageCmsRenderer from "../components/ProductPageCmsRenderer";
import { spaNavigateClick } from "../utils/spaNavigate";
import { useAuth } from "../context/AuthContext";
import type { HomeBlock } from "../visual-editor/cmsEditorFields";
import { DEFAULT_PRODUCT_BLOCKS, enrichProductBlocksFromProduct, getProductMainOverrides, normalizeProductBlocks, productContentKey } from "../visual-editor/productCms";
import { parsePageBlockContent } from "../visual-editor/cmsPages";
import { CmsRawHtmlBlock } from "../visual-editor/CmsBlockView";
import { buildImageStyle, readPropImageSize } from "../visual-editor/cmsImageSize";
import { formatProductImage, resourcesToGallery } from "../utils/productImage";
import { mergeBoundTextStyle } from "../visual-editor/cmsBoundStyles";
import RichTextContent from "../components/RichTextContent";
import { CmsAnchor, SectionCustomElements } from "../visual-editor/SectionCustomElements";

type Props = {
  productId: number;
  onAddToCart: (productId: number, qty?: number, variantId?: number) => void;
  onOpenAccount?: () => void;
};

type Tab = "description" | "reviews" | "benefits";

type ReviewEligibility = {
  can_review: boolean;
  reason: "eligible" | "login_required" | "purchase_required" | "awaiting_delivery" | "already_reviewed" | "review_pending";
  review_status?: "pending" | "approved" | "rejected";
};

const GOLD_BORDER = "1px solid rgba(212,175,55,0.25)";
const sans = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const serif = { fontFamily: "'Fraunces', serif" } as const;

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= Math.round(rating) ? "#D4AF37" : "none"}
          stroke={n <= Math.round(rating) ? "#D4AF37" : "#ccc"}
        />
      ))}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/40";

function renderProductInsertBlock(block: HomeBlock) {
  if (block.type === "html") {
    return (
      <section key={block.id} className="px-4 sm:px-8 py-10" style={{ background: "#FFF9E6" }}>
        <div className="max-w-5xl mx-auto">
          <CmsRawHtmlBlock block={block} />
        </div>
      </section>
    );
  }
  if (block.type === "image" && block.props?.src) {
    return (
      <section key={block.id} className="px-4 sm:px-8 py-8" style={{ background: "#FFF9E6" }}>
        <div className="max-w-5xl mx-auto">
          <img
            src={String(block.props.src)}
            alt={String(block.props.alt || "")}
            style={{
              display: "block",
              ...buildImageStyle(readPropImageSize(block.props), { width: "100%", height: "auto", objectFit: "cover" }),
            }}
          />
        </div>
      </section>
    );
  }
  return null;
}

export default function ProductDetailPage({ productId, onAddToCart, onOpenAccount }: Props) {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{
    product: ProductDetail["product"] & { long_description?: string; key_benefits?: string[] };
    resources: ProductResource[];
    variants: ProductVariant[];
    review_stats: { count: number; average: number };
  } | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [tab, setTab] = useState<Tab>("description");
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [reviewForm, setReviewForm] = useState({
    reviewer_name: "",
    rating: 5,
    title: "",
    body: "",
  });
  const [reviewPhotos, setReviewPhotos] = useState<File[]>([]);
  const [cmsBlocks, setCmsBlocks] = useState<HomeBlock[]>(DEFAULT_PRODUCT_BLOCKS);
  const [preContentBlocks, setPreContentBlocks] = useState<HomeBlock[]>([]);
  const [postContentBlocks, setPostContentBlocks] = useState<HomeBlock[]>([]);

  const loadEligibility = async () => {
    try {
      const data = await api.getReviewEligibility(productId);
      setEligibility(data);
    } catch {
      setEligibility(null);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getProductDetail(productId);
      setDetail(data);
      const options = data.variants || [];
      const defaultOption = options.find((v) => v.is_default) || options[0];
      setSelectedOptionId(defaultOption?.id ?? null);
      const rev = await api.getProductReviews(productId);
      setReviews(rev.reviews);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              review_stats: rev.stats,
            }
          : prev
      );
      const cms = await api.getCmsSections([productContentKey(productId)]);
      const content = cms.sections?.[productContentKey(productId)]?.content;
      const parsed = parsePageBlockContent(content);
      setCmsBlocks(
        enrichProductBlocksFromProduct(
          normalizeProductBlocks(parsed.blocks),
          data.product,
          data.resources || []
        )
      );
      setPreContentBlocks(parsed.preContentBlocks);
      setPostContentBlocks(parsed.postContentBlocks);
      await loadEligibility();
    } catch (e: any) {
      toast.error(e?.message || "Product not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [productId]);

  useEffect(() => {
    if (isAuthenticated) loadEligibility();
    else setEligibility({ can_review: false, reason: "login_required" });
  }, [isAuthenticated, productId]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("reviewer_name", reviewForm.reviewer_name);
      fd.append("rating", String(reviewForm.rating));
      fd.append("title", reviewForm.title);
      fd.append("body", reviewForm.body);
      reviewPhotos.forEach((f) => fd.append("photos", f));
      await api.submitProductReview(productId, fd);
      toast.success("Review submitted! It will appear after admin approval.");
      setReviewForm({ reviewer_name: "", rating: 5, title: "", body: "" });
      setReviewPhotos([]);
      const rev = await api.getProductReviews(productId);
      setReviews(rev.reviews);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              review_stats: rev.stats,
            }
          : prev
      );
      await loadEligibility();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="py-24 sm:py-32 px-4 sm:px-8 text-center" style={{ ...sans, color: "#666" }}>
        Loading product…
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="py-24 sm:py-32 px-4 sm:px-8 flex flex-col items-center gap-4" style={sans}>
        <p style={{ color: "#666" }}>Product not found</p>
        <a
          href="/"
          onClick={(e) => spaNavigateClick(e, "/")}
          className="inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "#D4AF37" }}
        >
          <ArrowLeft size={16} /> Back to store
        </a>
      </section>
    );
  }

  const { product, resources, variants: options, review_stats } = detail;
  const selectedOption = options.find((v) => v.id === selectedOptionId) || null;

  const regular = selectedOption
    ? parseFloat(String(selectedOption.regular_price))
    : parseFloat(product.regular_price);
  const price = selectedOption
    ? parseFloat(String(selectedOption.discount_price || selectedOption.regular_price))
    : parseFloat(product.discount_price || product.regular_price);
  const discountPct = regular > price ? Math.round((1 - price / regular) * 100) : 0;
  const savings = regular > price ? regular - price : 0;
  const gallery = resourcesToGallery(resources);
  const mainOverrides = getProductMainOverrides(cmsBlocks);
  const displayName = String(mainOverrides.name || product.name);
  const displayDescription = String(mainOverrides.shortDescription || product.description);
  const displayLongDescription = String(mainOverrides.longDescription || product.long_description || product.description);
  const displayCategory = String(mainOverrides.categoryBadge || product.category_name || "");
  const ctaText = String(mainOverrides.ctaText || "Add to cart");
  const shippingNote = String(mainOverrides.shippingNote || "Free shipping across India");
  const benefits = Array.isArray(mainOverrides.keyBenefits)
    ? mainOverrides.keyBenefits
    : Array.isArray(product.key_benefits)
      ? product.key_benefits
      : [];
  const displayPrice = price;

  const eligibilityMessage = (() => {
    if (!eligibility || eligibility.can_review) return null;
    switch (eligibility.reason) {
      case "login_required":
        return { text: "Sign in to write a review after your order is delivered.", action: "Sign in" as const };
      case "purchase_required":
        return { text: "Only verified buyers can review. Purchase this product and wait until it is delivered.", action: "buy" as const };
      case "awaiting_delivery":
        return { text: "Your order is on the way. You can review once it is marked delivered.", action: null };
      case "review_pending":
        return { text: "Your review was submitted and is waiting for admin approval. It will appear here once accepted.", action: null };
      case "already_reviewed":
        return { text: "You have already submitted a review for this product.", action: null };
      default:
        return null;
    }
  })();

  return (
    <>
      {preContentBlocks.map(renderProductInsertBlock)}
      <ProductPageCmsRenderer
      blocks={cmsBlocks}
      productMain={
        <section style={{ background: "#FFF9E6" }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
            <a
              href="/"
              onClick={(e) => spaNavigateClick(e, "/")}
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase mb-8 transition-opacity hover:opacity-70"
              style={{ ...sans, color: "#D4AF37" }}
            >
              <ArrowLeft size={14} /> Back to store
            </a>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
              <ImageZoomGallery items={gallery} discountPct={discountPct} />

              <div>
            {displayCategory ? (
              <RichTextContent
                html={displayCategory}
                as="span"
                inline
                className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-4"
                style={mergeBoundTextStyle({ background: "#FFCC00", color: "#1A1A1A", ...sans }, mainOverrides, "categoryBadge")}
              />
            ) : null}

            <RichTextContent
              html={displayName}
              as="h1"
              className="mb-3"
              style={mergeBoundTextStyle({ ...serif, fontWeight: 700, fontSize: "clamp(28px, 3vw, 40px)", color: "#1A1A1A", lineHeight: 1.15 }, mainOverrides, "name")}
            />

            <div className="flex items-center gap-3 mb-5">
              <Stars rating={review_stats?.average || 0} />
              <span className="text-sm" style={{ ...sans, color: "#666" }}>
                ({review_stats?.count || 0} reviews)
              </span>
            </div>

            <RichTextContent
              html={displayDescription}
              as="p"
              className="text-sm leading-relaxed mb-8"
              style={mergeBoundTextStyle({ ...sans, color: "#555", lineHeight: 1.75 }, mainOverrides, "shortDescription")}
            />
            <CmsAnchor cms={mainOverrides} insertAfter="product-main.shortDescription" scopeId="product-main" />

            {options.length > 0 ? (
              <div className="mb-6">
                <div className="flex flex-wrap gap-3">
                  {options.map((opt) => {
                    const selected = selectedOptionId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedOptionId(opt.id ?? null)}
                        className="relative min-w-[88px] px-5 py-3 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          ...sans,
                          background: selected ? "#FFF9E6" : "#FFFFFF",
                          border: selected ? "2px solid #D4AF37" : GOLD_BORDER,
                          color: "#1A1A1A",
                          cursor: "pointer",
                          boxShadow: selected ? "0 4px 16px rgba(212,175,55,0.2)" : "none",
                        }}
                      >
                        {opt.badge ? (
                          <span
                            className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: "#FFCC00", color: "#1A1A1A" }}
                          >
                            {opt.badge}
                          </span>
                        ) : null}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div
              className="rounded-2xl p-5 inline-flex flex-col gap-1 mb-8 w-full max-w-sm"
              style={{ background: "#FFFFFF", border: GOLD_BORDER }}
            >
              <div className="flex items-baseline gap-3 flex-wrap">
                <span style={{ ...serif, fontWeight: 700, fontSize: "clamp(28px, 8vw, 36px)", color: "#1A1A1A", lineHeight: 1 }}>
                  ₹{displayPrice.toLocaleString("en-IN")}
                </span>
                {savings > 0 ? (
                  <>
                    <span className="text-sm line-through" style={{ ...sans, color: "#999" }}>
                      MRP ₹{regular.toLocaleString("en-IN")}
                    </span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "#FFCC00", color: "#1A1A1A", ...sans }}
                    >
                      Save ₹{savings.toLocaleString("en-IN")}
                    </span>
                  </>
                ) : null}
              </div>
              <p className="text-xs" style={{ ...sans, color: "#999" }}>
                MRP incl. of all taxes
              </p>
            </div>

            <button
              type="button"
              onClick={() => onAddToCart(productId, 1, selectedOptionId ?? undefined)}
              className="w-full py-4 rounded-xl font-bold text-sm tracking-[0.12em] uppercase flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98] mb-4"
              style={{
                background: "#FFCC00",
                color: "#1A1A1A",
                ...sans,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(255,204,0,0.4)",
              }}
            >
              <ShoppingBag size={18} /> <RichTextContent html={ctaText} inline />
            </button>

            <p className="text-xs flex items-center gap-1.5" style={mergeBoundTextStyle({ ...sans, color: "#D4AF37", fontWeight: 600 }, mainOverrides, "shippingNote")}>
              <Check size={12} strokeWidth={2.5} /> <RichTextContent html={shippingNote} inline />
            </p>
            <CmsAnchor cms={mainOverrides} insertAfter="product-main.shippingNote" scopeId="product-main" />
          </div>
        </div>

        <SectionCustomElements cms={mainOverrides} scopeId="product-main" />

        <div className="mt-12 sm:mt-16 rounded-3xl overflow-hidden" style={{ background: "#FFFFFF", border: GOLD_BORDER }}>
          <div className="flex gap-4 sm:gap-6 px-4 sm:px-8 border-b overflow-x-auto" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
            {(["description", "reviews", "benefits"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="py-4 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors whitespace-nowrap shrink-0"
                style={{
                  ...sans,
                  color: tab === t ? "#1A1A1A" : "#999",
                  borderBottom: tab === t ? "2px solid #FFCC00" : "2px solid transparent",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                {t === "reviews" ? `Reviews (${review_stats?.count || 0})` : t === "benefits" ? "Key benefits" : "Description"}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-8">
            {tab === "description" && (
              <RichTextContent
                html={displayLongDescription}
                as="div"
                className="text-sm max-w-3xl"
                style={mergeBoundTextStyle({ ...sans, color: "#555", lineHeight: 1.8 }, mainOverrides, "longDescription")}
              />
            )}
            {tab === "description" ? (
              <CmsAnchor cms={mainOverrides} insertAfter="product-main.longDescription" scopeId="product-main" />
            ) : null}

            {tab === "benefits" && (
              <ul className="space-y-3 max-w-2xl">
                {benefits.length > 0 ? (
                  benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm p-4 rounded-2xl" style={{ ...sans, color: "#1A1A1A", border: "1px solid rgba(212,175,55,0.15)" }}>
                      <Check size={14} strokeWidth={2.5} style={{ color: "#D4AF37", flexShrink: 0, marginTop: 2 }} />
                      {b}
                    </li>
                  ))
                ) : (
                  <li className="text-sm" style={{ ...sans, color: "#999" }}>
                    No key benefits listed yet.
                  </li>
                )}
              </ul>
            )}

            {tab === "reviews" && (
              <div className="grid lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                  {reviews.length === 0 ? (
                    <p className="text-sm" style={{ ...sans, color: "#999" }}>
                      No reviews yet. Be the first!
                    </p>
                  ) : (
                    reviews.map((r) => (
                      <div key={r.id} className="pb-6 border-b" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Stars rating={r.rating} size={14} />
                          <span className="font-semibold text-sm" style={{ ...sans, color: "#1A1A1A" }}>
                            {r.reviewer_name}
                          </span>
                        </div>
                        {r.title ? (
                          <p className="font-bold text-sm mb-1" style={{ ...serif, color: "#1A1A1A" }}>
                            {r.title}
                          </p>
                        ) : null}
                        <p className="text-sm" style={{ ...sans, color: "#666", lineHeight: 1.7 }}>
                          {r.body}
                        </p>
                        {r.photos?.length > 0 ? (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {r.photos.map((p: any) => (
                              <img
                                key={p.id}
                                src={formatProductImage(p.file_url)}
                                alt=""
                                className="w-16 h-16 rounded-xl object-cover"
                                style={{ border: GOLD_BORDER }}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>

                {eligibility?.can_review ? (
                  <form
                    onSubmit={submitReview}
                    className="rounded-2xl p-6 space-y-4"
                    style={{ background: "#FFF9E6", border: GOLD_BORDER }}
                  >
                    <h3 className="font-bold" style={{ ...serif, color: "#1A1A1A", fontSize: 20 }}>
                      Write a review
                    </h3>
                    <p className="text-xs" style={{ ...sans, color: "#666" }}>
                      Verified purchase — reviewing as {user?.email}
                    </p>
                    <input
                      required
                      placeholder="Your name"
                      value={reviewForm.reviewer_name}
                      onChange={(e) => setReviewForm({ ...reviewForm, reviewer_name: e.target.value })}
                      className={inputCls}
                      style={{ ...sans, background: "#FFFFFF", border: GOLD_BORDER }}
                    />
                    <div>
                      <label className="text-xs font-semibold tracking-wider uppercase mb-1 block" style={{ ...sans, color: "#D4AF37" }}>
                        Rating
                      </label>
                      <select
                        value={reviewForm.rating}
                        onChange={(e) => setReviewForm({ ...reviewForm, rating: parseInt(e.target.value, 10) })}
                        className={inputCls}
                        style={{ ...sans, background: "#FFFFFF", border: GOLD_BORDER }}
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} stars
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      placeholder="Review title (optional)"
                      value={reviewForm.title}
                      onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                      className={inputCls}
                      style={{ ...sans, background: "#FFFFFF", border: GOLD_BORDER }}
                    />
                    <textarea
                      required
                      placeholder="Your review"
                      rows={4}
                      value={reviewForm.body}
                      onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })}
                      className={inputCls}
                      style={{ ...sans, background: "#FFFFFF", border: GOLD_BORDER }}
                    />
                    <div>
                      <label className="text-xs font-semibold tracking-wider uppercase mb-1 block" style={{ ...sans, color: "#D4AF37" }}>
                        Photos (optional, max 5)
                      </label>
                      <input type="file" accept="image/*" multiple onChange={(e) => setReviewPhotos(Array.from(e.target.files || []).slice(0, 5))} className="text-sm" style={sans} />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 rounded-xl font-bold text-sm tracking-[0.1em] uppercase transition-opacity"
                      style={{
                        background: "#FFCC00",
                        color: "#1A1A1A",
                        ...sans,
                        border: "none",
                        cursor: submitting ? "wait" : "pointer",
                        opacity: submitting ? 0.7 : 1,
                      }}
                    >
                      {submitting ? "Submitting…" : "Submit review"}
                    </button>
                    <p className="text-xs" style={{ ...sans, color: "#999" }}>
                      Reviews are moderated before publishing.
                    </p>
                  </form>
                ) : (
                  <div className="rounded-2xl p-6" style={{ background: "#FFF9E6", border: GOLD_BORDER }}>
                    <h3 className="font-bold mb-2" style={{ ...serif, color: "#1A1A1A", fontSize: 20 }}>
                      Write a review
                    </h3>
                    {eligibilityMessage ? (
                      <>
                        <p className="text-sm mb-4" style={{ ...sans, color: "#666", lineHeight: 1.7 }}>
                          {eligibilityMessage.text}
                        </p>
                        {eligibilityMessage.action === "Sign in" && onOpenAccount ? (
                          <button
                            type="button"
                            onClick={onOpenAccount}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase"
                            style={{ background: "#FFCC00", color: "#1A1A1A", ...sans, border: "none", cursor: "pointer" }}
                          >
                            Sign in
                          </button>
                        ) : eligibilityMessage.action === "buy" ? (
                          <button
                            type="button"
                            onClick={() => onAddToCart(productId, 1, selectedOptionId ?? undefined)}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase"
                            style={{ background: "#FFCC00", color: "#1A1A1A", ...sans, border: "none", cursor: "pointer" }}
                          >
                            Add to cart
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm" style={{ ...sans, color: "#999" }}>
                        Checking eligibility…
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
          </div>
        </section>
      }
    />
      {postContentBlocks.map(renderProductInsertBlock)}
    </>
  );
}
