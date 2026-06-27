import React, { useMemo, useState } from "react";
import { Star, ShoppingBag, Check } from "lucide-react";
import ImageZoomGallery from "./ImageZoomGallery";
import type { ProductDetail, ProductResource, ProductVariant } from "../services/api";
import { formatProductImage, resourcesToGallery } from "../utils/productImage";
import { mergeBoundTextStyle } from "../visual-editor/cmsBoundStyles";
import RichTextContent from "./RichTextContent";
import { CmsAnchor, SectionCustomElements } from "../visual-editor/SectionCustomElements";
import { ELEMENT_INSERT_START } from "../visual-editor/cmsElements";

type Tab = "description" | "reviews" | "benefits";

type Props = {
  product: ProductDetail["product"] & { long_description?: string; key_benefits?: string[] };
  resources: ProductResource[];
  variants: ProductVariant[];
  reviewStats: { count: number; average: number };
  reviews?: { id: number; reviewer_name: string; rating: number; title?: string; body: string; photos?: { id: number; file_url: string }[] }[];
  previewMode?: boolean;
  overrides?: Record<string, any>;
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

export default function ProductMainPreview({
  product,
  resources,
  variants: options,
  reviewStats,
  reviews = [],
  previewMode = false,
  overrides = {},
}: Props) {
  const defaultOption = options.find((v) => v.is_default) || options[0];
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(defaultOption?.id ?? null);
  const [tab, setTab] = useState<Tab>("description");

  const selectedOption = options.find((v) => v.id === selectedOptionId) || null;
  const regular = selectedOption
    ? parseFloat(String(selectedOption.regular_price))
    : parseFloat(product.regular_price);
  const price = selectedOption
    ? parseFloat(String(selectedOption.discount_price || selectedOption.regular_price))
    : parseFloat(product.discount_price || product.regular_price);
  const discountPct = regular > price ? Math.round((1 - price / regular) * 100) : 0;
  const savings = regular > price ? regular - price : 0;
  const gallery = useMemo(() => resourcesToGallery(resources), [resources]);
  const displayName = String(overrides.name || product.name);
  const displayDescription = String(overrides.shortDescription || product.description);
  const displayLongDescription = String(overrides.longDescription || product.long_description || product.description);
  const displayCategory = String(overrides.categoryBadge || product.category_name || "");
  const ctaText = String(overrides.ctaText || "Add to cart");
  const shippingNote = String(overrides.shippingNote || "Free shipping across India");
  const benefits = Array.isArray(overrides.keyBenefits)
    ? overrides.keyBenefits
    : Array.isArray(product.key_benefits)
      ? product.key_benefits
      : [];

  return (
    <section style={{ background: "#FFF9E6" }}>
      <div className="max-w-5xl mx-auto px-8 py-16">
        {previewMode ? (
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-6 text-center" style={{ ...sans, color: "#D4AF37" }}>
            Live preview — gallery, price & buy box from your product data
          </p>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          <CmsAnchor cms={overrides} insertAfter={ELEMENT_INSERT_START} scopeId="product-main" />
          {gallery.length > 0 ? (
            <ImageZoomGallery items={gallery} discountPct={discountPct} />
          ) : (
            <div
              className="aspect-square rounded-3xl flex items-center justify-center text-sm text-center px-6"
              style={{ background: "#FFFFFF", border: GOLD_BORDER, ...sans, color: "#999" }}
            >
              No photos yet — add images in Admin → Product editor
            </div>
          )}

          <div>
            {displayCategory ? (
              <RichTextContent
                html={displayCategory}
                as="span"
                inline
                className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-4"
                style={mergeBoundTextStyle({ background: "#FFCC00", color: "#1A1A1A", ...sans }, overrides, "categoryBadge")}
                data-cms-el="product-main.categoryBadge"
              />
            ) : null}

            <RichTextContent
              html={displayName}
              as="h1"
              className="mb-3"
              style={mergeBoundTextStyle({ ...serif, fontWeight: 700, fontSize: "clamp(28px, 3vw, 40px)", color: "#1A1A1A", lineHeight: 1.15 }, overrides, "name")}
              data-cms-el="product-main.name"
            />

            <div className="flex items-center gap-3 mb-5">
              <Stars rating={reviewStats?.average || 0} />
              <span className="text-sm" style={{ ...sans, color: "#666" }}>
                ({reviewStats?.count || 0} reviews)
              </span>
            </div>

            <RichTextContent
              html={displayDescription}
              as="p"
              className="text-sm leading-relaxed mb-8"
              style={mergeBoundTextStyle({ ...sans, color: "#555", lineHeight: 1.75 }, overrides, "shortDescription")}
              data-cms-el="product-main.shortDescription"
            />
            <CmsAnchor cms={overrides} insertAfter="product-main.shortDescription" scopeId="product-main" />

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
                <span style={{ ...serif, fontWeight: 700, fontSize: 36, color: "#1A1A1A", lineHeight: 1 }}>
                  ₹{price.toLocaleString("en-IN")}
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
              disabled={previewMode}
              className="w-full py-4 rounded-xl font-bold text-sm tracking-[0.12em] uppercase flex items-center justify-center gap-2 mb-4"
              style={{
                background: "#FFCC00",
                color: "#1A1A1A",
                ...sans,
                border: "none",
                cursor: previewMode ? "default" : "pointer",
                opacity: previewMode ? 0.85 : 1,
                boxShadow: "0 4px 20px rgba(255,204,0,0.4)",
              }}
            >
              <ShoppingBag size={18} />{" "}
              <RichTextContent html={ctaText} inline />
            </button>

            <p
              className="text-xs flex items-center gap-1.5"
              style={mergeBoundTextStyle({ ...sans, color: "#D4AF37", fontWeight: 600 }, overrides, "shippingNote")}
              data-cms-el="product-main.shippingNote"
            >
              <Check size={12} strokeWidth={2.5} />
              <RichTextContent html={shippingNote} inline />
            </p>
            <CmsAnchor cms={overrides} insertAfter="product-main.shippingNote" scopeId="product-main" />
          </div>
        </div>

        <SectionCustomElements cms={overrides} scopeId="product-main" />

        <div className="mt-16 rounded-3xl overflow-hidden" style={{ background: "#FFFFFF", border: GOLD_BORDER }}>
          <div className="flex gap-6 px-8 border-b" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
            {(["description", "reviews", "benefits"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="py-4 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors"
                style={{
                  ...sans,
                  color: tab === t ? "#1A1A1A" : "#999",
                  borderBottom: tab === t ? "2px solid #FFCC00" : "2px solid transparent",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                {t === "reviews" ? `Reviews (${reviewStats?.count || 0})` : t === "benefits" ? "Key benefits" : "Description"}
              </button>
            ))}
          </div>

          <div className="p-8">
            {tab === "description" && (
              <RichTextContent
                html={displayLongDescription}
                as="div"
                className="text-sm max-w-3xl"
                style={mergeBoundTextStyle({ ...sans, color: "#555", lineHeight: 1.8 }, overrides, "longDescription")}
                data-cms-el="product-main.longDescription"
              />
            )}
            {tab === "description" ? (
              <CmsAnchor cms={overrides} insertAfter="product-main.longDescription" scopeId="product-main" />
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
              <div className="space-y-6 max-w-2xl">
                {reviews.length === 0 ? (
                  <p className="text-sm" style={{ ...sans, color: "#999" }}>
                    No reviews yet.
                  </p>
                ) : (
                  reviews.slice(0, 3).map((r) => (
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
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
