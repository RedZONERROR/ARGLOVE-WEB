import React from "react";
import { CmsHtmlCssBlock, CmsSectionExtras } from "../visual-editor/CmsCustomContent";
import { mergeBoundTextStyle } from "../visual-editor/cmsBoundStyles";
import RichTextContent from "./RichTextContent";
import { buildImageStyle, readImageSize } from "../visual-editor/cmsImageSize";
import { CmsAnchor, SectionCustomElements } from "../visual-editor/SectionCustomElements";
import { ELEMENT_INSERT_START } from "../visual-editor/cmsElements";

const sans = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const serif = { fontFamily: "'Fraunces', serif" } as const;

type Props = {
  blockId: string;
  props?: Record<string, any>;
};

export default function ProductBannerBlock({ blockId, props = {} }: Props) {
  if (props.useHtmlOnly && props.customHtml) {
    return (
      <section style={{ background: props.bgColor || "#FFF9E6" }}>
        <div className="max-w-5xl mx-auto px-8 py-10">
          <CmsHtmlCssBlock html={props.customHtml} css={props.customCss} scopeId={`${blockId}-banner`} />
          <CmsSectionExtras cms={props} scopeId={`${blockId}-banner`} />
        </div>
      </section>
    );
  }

  const bg = String(props.bgColor || "#FFF9E6");
  const title = String(props.title || "").trim();
  const subtitle = String(props.subtitle || "").trim();
  const badge = String(props.badge || "").trim();
  const imageUrl = String(props.imageUrl || "").trim();

  if (!title && !subtitle && !imageUrl && !badge && !props.customHtml) {
    return (
      <section style={{ background: bg }}>
        <div className="max-w-5xl mx-auto px-8 py-12">
          <div
            className="rounded-2xl py-16 px-8 text-center text-sm"
            style={{ border: "2px dashed rgba(212,175,55,0.35)", color: "#888", ...sans }}
          >
            Banner section — add title, subtitle, or image in the sidebar
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ background: bg }}>
      <div className="max-w-5xl mx-auto px-8 py-12">
        <CmsAnchor cms={props} insertAfter={ELEMENT_INSERT_START} scopeId={`${blockId}-banner`} />
        <div className={`grid gap-10 items-center ${imageUrl ? "lg:grid-cols-2" : ""}`}>
          {imageUrl ? (
            <div className="rounded-3xl overflow-hidden" style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.08)" }}>
              <img
                src={imageUrl}
                alt={title || "Product banner"}
                style={buildImageStyle(readImageSize(props, "imageUrl"), {
                  width: "100%",
                  height: "auto",
                  objectFit: "cover",
                  display: "block",
                })}
              />
            </div>
          ) : null}
          <div>
            {badge ? (
              <RichTextContent
                html={badge}
                as="span"
                inline
                className="inline-block text-[10px] font-semibold tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-4"
                style={mergeBoundTextStyle({ background: "#FFCC00", color: "#1A1A1A", ...sans }, props, "badge")}
                data-cms-el="banner.badge"
              />
            ) : null}
            {title ? (
              <RichTextContent
                html={title}
                as="h2"
                className="mb-3"
                style={mergeBoundTextStyle({ ...serif, fontWeight: 700, fontSize: "clamp(28px, 3vw, 44px)", color: "#1A1A1A", lineHeight: 1.1 }, props, "title")}
                data-cms-el="banner.title"
              />
            ) : null}
            {subtitle ? (
              <RichTextContent
                html={subtitle}
                as="p"
                className="text-sm leading-relaxed"
                style={mergeBoundTextStyle({ ...sans, color: "#555", lineHeight: 1.75, maxWidth: 480 }, props, "subtitle")}
                data-cms-el="banner.subtitle"
              />
            ) : null}
            <CmsAnchor cms={props} insertAfter="banner.subtitle" scopeId={`${blockId}-banner`} />
          </div>
        </div>
        <SectionCustomElements cms={props} scopeId={`${blockId}-banner`} />
      </div>
    </section>
  );
}
