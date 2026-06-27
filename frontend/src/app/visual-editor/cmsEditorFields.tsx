import React, { useEffect, useMemo, useState } from "react";
import CustomFieldsEditor from "./CustomFieldsEditor";
import ElementsEditor from "./ElementsEditor";
import HtmlCssEditor, { EditModeTabs, GlobalCssToggle, UseHtmlOnlyToggle } from "./HtmlCssEditor";
import { CmsCustomField, CSS_BLOCK_TEMPLATE, HTML_BLOCK_TEMPLATE } from "./CmsCustomContent";
import { exportSectionToHtmlCss, resolveHtmlCssForEditor } from "./sectionHtmlExport";
import { isCssGlobal, isGlobalCmsKey } from "./cmsPages";
import type { CmsImageSize } from "./cmsImageSize";
import { buildImageStyle, OBJECT_FIT_OPTIONS, readImageSize, readPropImageSize, writeImageSizePatch } from "./cmsImageSize";
import { CmsRichText } from "./RichTextEditor";

export const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  outline: "none",
};

export function linesFromArray(items?: string[]) {
  return Array.isArray(items) ? items.join("\n") : "";
}

export function arrayFromLines(text: string) {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-white/60 mb-2">{label}</div>
      {children}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl px-3 py-2 text-sm"
      style={inputStyle}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-xl p-3 text-sm"
      style={{
        ...inputStyle,
        resize: "vertical",
        fontFamily: mono
          ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          : undefined,
      }}
    />
  );
}

export function ImageSizeControls({
  size,
  onChange,
  defaultWidth = "100%",
  defaultHeight = "auto",
}: {
  size: CmsImageSize;
  onChange: (patch: Partial<CmsImageSize>) => void;
  defaultWidth?: string;
  defaultHeight?: string;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
      <div className="text-[10px] font-bold tracking-widest uppercase text-white/45">Size & fit</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width">
          <TextInput
            value={size.width ?? ""}
            onChange={(v) => onChange({ width: v })}
            placeholder={defaultWidth}
          />
        </Field>
        <Field label="Height">
          <TextInput
            value={size.height ?? ""}
            onChange={(v) => onChange({ height: v })}
            placeholder={defaultHeight}
          />
        </Field>
      </div>
      <Field label="Object fit">
        <select
          value={size.objectFit ?? "cover"}
          onChange={(e) => onChange({ objectFit: e.target.value as CmsImageSize["objectFit"] })}
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={inputStyle}
        >
          {OBJECT_FIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </Field>
      <p className="text-[10px] text-white/40">Use px, %, vh, or auto — e.g. 100%, 400px, auto</p>
    </div>
  );
}

export function ImageField({
  label,
  value,
  onChange,
  onUpload,
  size,
  onSizeChange,
  defaultSize,
  showSizeControls = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onUpload: (file: File) => Promise<string>;
  size?: CmsImageSize;
  onSizeChange?: (patch: Partial<CmsImageSize>) => void;
  defaultSize?: CmsImageSize;
  showSizeControls?: boolean;
}) {
  const previewStyle = buildImageStyle(size, defaultSize);

  return (
    <Field label={label}>
      <TextInput value={value} onChange={onChange} placeholder="https://… or upload below" />
      <input
        type="file"
        accept="image/*"
        className="mt-2 block w-full text-xs text-white/70"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const url = await onUpload(file);
          onChange(url);
          e.currentTarget.value = "";
        }}
      />
      {showSizeControls && onSizeChange ? (
        <ImageSizeControls
          size={size || {}}
          onChange={onSizeChange}
          defaultWidth={defaultSize?.width}
          defaultHeight={defaultSize?.height}
        />
      ) : null}
      {value ? (
        <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black/20 flex items-center justify-center" style={{ minHeight: 80 }}>
          <img
            src={value}
            alt=""
            style={{
              ...previewStyle,
              maxHeight: 160,
              borderRadius: 8,
            }}
          />
        </div>
      ) : null}
    </Field>
  );
}

export type HomeBlockType =
  | "marquee"
  | "hero"
  | "plans"
  | "why"
  | "timeline"
  | "reviews"
  | "about"
  | "finalcta"
  | "html"
  | "image"
  | "banner"
  | "product-main";

export type HomeBlock = {
  id: string;
  type: HomeBlockType;
  props?: Record<string, any>;
  /** When true, block appears on every page (stored in site.globalBlocks) */
  global?: boolean;
};

export const DEFAULT_HOME_BLOCKS: HomeBlock[] = [
  { id: "hero", type: "hero" },
  { id: "plans", type: "plans" },
  { id: "why", type: "why" },
  { id: "timeline", type: "timeline" },
  { id: "reviews", type: "reviews" },
  { id: "about", type: "about" },
  { id: "finalcta", type: "finalcta" },
];

export function newBlockId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function moveBlock<T>(arr: T[], from: number, to: number) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function boundImageField(
  label: string,
  fieldKey: string,
  data: Record<string, any>,
  patchKey: string,
  patch: (key: string, patch: Record<string, any>) => void,
  onUpload: (file: File) => Promise<string>,
  defaultSize?: CmsImageSize,
) {
  return (
    <ImageField
      label={label}
      value={String(data[fieldKey] ?? "")}
      onChange={(v) => patch(patchKey, { [fieldKey]: v })}
      onUpload={onUpload}
      size={readImageSize(data, fieldKey)}
      onSizeChange={(s) => patch(patchKey, writeImageSizePatch(fieldKey, s))}
      defaultSize={defaultSize}
    />
  );
}

export const BLOCK_LABELS: Record<HomeBlockType, string> = {
  marquee: "Top bar",
  hero: "Hero banner",
  plans: "Product plans",
  why: "Why it works",
  timeline: "Timeline",
  reviews: "Reviews",
  about: "About",
  finalcta: "Final CTA",
  html: "Custom HTML/CSS",
  image: "Image block",
  banner: "Banner / hero",
  "product-main": "Product info (gallery & buy)",
};

export const CMS_KEYS = ["header", "marquee", "hero", "bestseller", "why", "timeline", "reviews", "about", "finalcta", "footer", "home"] as const;

/** Always available when inserting between page sections */
export const UNIVERSAL_INSERT_BLOCKS: HomeBlockType[] = ["html", "image"];

export function getPageSectionBlockTypes(isProductEditor: boolean): HomeBlockType[] {
  if (isProductEditor) {
    return ["banner", "product-main"];
  }
  return ["hero", "plans", "why", "timeline", "reviews", "about", "finalcta"];
}

export type EditorSection = {
  id: string;
  label: string;
  cmsKey?: string;
  block?: HomeBlock;
  fixed?: boolean;
};

export function buildEditorSections(homeBlocks: HomeBlock[], globalBlocks: HomeBlock[] = []): EditorSection[] {
  const mainBlocks = homeBlocks.length > 0 ? homeBlocks : [];

  const mapBlock = (b: HomeBlock, isGlobal: boolean) => ({
    id: b.id,
    label: isGlobal ? `${BLOCK_LABELS[b.type] || b.type} (global)` : BLOCK_LABELS[b.type] || b.type,
    cmsKey:
      b.type === "banner" || b.type === "product-main" || b.type === "image"
        ? undefined
      : b.type === "hero" ? "hero"
      : b.type === "plans" ? "bestseller"
      : b.type === "finalcta" ? "finalcta"
      : b.type === "why" ? "why"
      : b.type === "timeline" ? "timeline"
      : b.type === "reviews" ? "reviews"
      : b.type === "about" ? "about"
      : undefined,
    block: b,
  });

  return [
    { id: "marquee", label: "Top marquee bar (global)", cmsKey: "marquee", fixed: true },
    { id: "header", label: "Header / Logo (global)", cmsKey: "header", fixed: true },
    ...globalBlocks.map((b) => mapBlock(b, true)),
    ...mainBlocks.map((b) => mapBlock(b, false)),
    { id: "footer", label: "Footer (global)", cmsKey: "footer", fixed: true },
    { id: "site-css", label: "Site-wide CSS (global)", cmsKey: "__site_css__", fixed: true },
  ];
}

function renderFormFields(
  cmsKey: string,
  data: Record<string, any>,
  patch: (key: string, patch: Record<string, any>) => void,
  onUpload: (file: File) => Promise<string>,
  block?: HomeBlock
) {
  if (block?.type === "banner") {
    const data = block.props || {};
    return (
      <>
        <Field label="Badge text">
          <CmsRichText value={String(data.badge ?? "")} onChange={(v) => patch("__block__", { badge: v })} onUpload={onUpload} placeholder="New / Bestseller" />
        </Field>
        <Field label="Title">
          <CmsRichText value={String(data.title ?? "")} onChange={(v) => patch("__block__", { title: v })} onUpload={onUpload} heading />
        </Field>
        <Field label="Subtitle">
          <CmsRichText value={String(data.subtitle ?? "")} onChange={(v) => patch("__block__", { subtitle: v })} onUpload={onUpload} rows={3} />
        </Field>
        {boundImageField("Banner image", "imageUrl", data, "__block__", patch, onUpload, { width: "100%", height: "auto", objectFit: "cover" })}
        <Field label="Background color">
          <TextInput value={String(data.bgColor ?? "#FFF9E6")} onChange={(v) => patch("__block__", { bgColor: v })} />
        </Field>
        <p className="text-xs text-white/50 mt-2">Use the <b>HTML/CSS</b> tab to replace this banner with fully custom markup.</p>
      </>
    );
  }

  if (block?.type === "product-main") {
    return (
      <p className="text-xs text-white/50">
        Use the <b>Elements</b> tab — product name, descriptions, benefits, button text, and custom HTML blocks. Click <b>Publish</b> when done.
      </p>
    );
  }

  if (block?.type === "image") {
    const data = block.props || {};
    return (
      <>
        {boundImageField("Image", "src", data, "__block__", patch, onUpload, { width: "100%", height: "auto", objectFit: "cover" })}
        <Field label="Alt text">
          <TextInput value={String(data.alt ?? "")} onChange={(v) => patch("__block__", { alt: v })} />
        </Field>
      </>
    );
  }

  switch (cmsKey) {
    case "header":
      return (
        <>
          <p className="text-xs text-emerald-300/90 mb-3 p-2 rounded-lg" style={{ background: "rgba(34,197,94,0.1)" }}>
            Global header — appears on every page. Use <b>Elements</b> or <b>HTML/CSS</b> tabs to customize fully.
          </p>
          <Field label="Logo text">
            <CmsRichText value={String(data.logoText ?? "")} onChange={(v) => patch("header", { logoText: v })} onUpload={onUpload} placeholder="ARGLOVE" />
          </Field>
          <Field label="Logo sub-text">
            <CmsRichText value={String(data.logoSubText ?? "")} onChange={(v) => patch("header", { logoSubText: v })} onUpload={onUpload} placeholder="SKIN" />
          </Field>
          {boundImageField("Logo image (optional)", "logoImageUrl", data, "header", patch, onUpload, { height: "28px", width: "auto", objectFit: "contain" })}
        </>
      );
    case "marquee":
      return (
        <>
          <Field label="Messages (one per line)">
            <TextArea value={linesFromArray(data.items)} onChange={(v) => patch("marquee", { items: arrayFromLines(v) })} rows={4} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Background">
              <TextInput value={String(data.bgColor ?? "#FFCC00")} onChange={(v) => patch("marquee", { bgColor: v })} />
            </Field>
            <Field label="Text color">
              <TextInput value={String(data.textColor ?? "#1A1A1A")} onChange={(v) => patch("marquee", { textColor: v })} />
            </Field>
          </div>
        </>
      );
    case "hero":
      return (
        <>
          <Field label="Badge">
            <CmsRichText value={String(data.badge ?? "")} onChange={(v) => patch("hero", { badge: v })} onUpload={onUpload} />
          </Field>
          <Field label="Headline line 1">
            <CmsRichText value={String(data.headline1 ?? "")} onChange={(v) => patch("hero", { headline1: v })} onUpload={onUpload} heading />
          </Field>
          <Field label="Headline line 2">
            <CmsRichText value={String(data.headline2 ?? "")} onChange={(v) => patch("hero", { headline2: v })} onUpload={onUpload} heading />
          </Field>
          <Field label="Headline line 3">
            <CmsRichText value={String(data.headline3 ?? "")} onChange={(v) => patch("hero", { headline3: v })} onUpload={onUpload} heading />
          </Field>
          <Field label="Description">
            <CmsRichText value={String(data.description ?? "")} onChange={(v) => patch("hero", { description: v })} onUpload={onUpload} rows={3} />
          </Field>
          <Field label="Button text">
            <CmsRichText value={String(data.ctaText ?? "")} onChange={(v) => patch("hero", { ctaText: v })} onUpload={onUpload} />
          </Field>
          {boundImageField("Hero image", "imageUrl", data, "hero", patch, onUpload, { width: "100%", height: "100%", objectFit: "cover" })}
          <Field label="Gallery photos (5 URLs, one per line)">
            <TextArea value={linesFromArray(data.galleryImages)} onChange={(v) => patch("hero", { galleryImages: arrayFromLines(v) })} rows={5} mono placeholder="https://… photo 1" />
          </Field>
          <Field label="Floating tag labels (one per line)">
            <TextArea value={linesFromArray(data.floatingLabels)} onChange={(v) => patch("hero", { floatingLabels: arrayFromLines(v) })} rows={4} />
          </Field>
          <Field label="Free gift text">
            <CmsRichText value={String(data.freeGiftText ?? "")} onChange={(v) => patch("hero", { freeGiftText: v })} onUpload={onUpload} />
          </Field>
          <Field label="Trust items (one per line)">
            <TextArea value={linesFromArray(data.trustItems)} onChange={(v) => patch("hero", { trustItems: arrayFromLines(v) })} rows={3} />
          </Field>
        </>
      );
    case "bestseller":
      return (
        <>
          <Field label="Badge">
            <CmsRichText value={String(data.badge ?? "")} onChange={(v) => patch("bestseller", { badge: v })} onUpload={onUpload} />
          </Field>
          <Field label="Section title">
            <CmsRichText value={String(data.title ?? "")} onChange={(v) => patch("bestseller", { title: v })} onUpload={onUpload} heading />
          </Field>
          {boundImageField("1 bottle plan photo", "planImage1", data, "bestseller", patch, onUpload, { width: "100%", height: "100%", objectFit: "cover" })}
          {boundImageField("2 bottles plan photo", "planImage2", data, "bestseller", patch, onUpload, { width: "100%", height: "100%", objectFit: "cover" })}
          {boundImageField("3 bottles plan photo", "planImage3", data, "bestseller", patch, onUpload, { width: "100%", height: "100%", objectFit: "cover" })}
        </>
      );
    case "finalcta":
      return (
        <>
          <Field label="Headline">
            <CmsRichText value={String(data.headline ?? "")} onChange={(v) => patch("finalcta", { headline: v })} onUpload={onUpload} heading />
          </Field>
          <Field label="Sub-headline">
            <CmsRichText value={String(data.subheadline ?? "")} onChange={(v) => patch("finalcta", { subheadline: v })} onUpload={onUpload} heading />
          </Field>
          <Field label="Features (one per line)">
            <TextArea value={linesFromArray(data.features)} onChange={(v) => patch("finalcta", { features: arrayFromLines(v) })} rows={3} />
          </Field>
          <Field label="Button text">
            <CmsRichText value={String(data.ctaText ?? "")} onChange={(v) => patch("finalcta", { ctaText: v })} onUpload={onUpload} />
          </Field>
          <Field label="Bottom trust stats (one per line)">
            <TextArea value={linesFromArray(data.bottomStats)} onChange={(v) => patch("finalcta", { bottomStats: arrayFromLines(v) })} rows={3} />
          </Field>
        </>
      );
    case "footer":
      return (
        <Field label="Copyright">
          <CmsRichText value={String(data.copyright ?? "")} onChange={(v) => patch("footer", { copyright: v })} onUpload={onUpload} />
        </Field>
      );
    case "why":
      return (
        <>
          <Field label="Badge"><CmsRichText value={String(data.badge ?? "")} onChange={(v) => patch("why", { badge: v })} onUpload={onUpload} /></Field>
          <Field label="Title"><CmsRichText value={String(data.title ?? "")} onChange={(v) => patch("why", { title: v })} onUpload={onUpload} heading /></Field>
          <Field label="Description"><CmsRichText value={String(data.description ?? "")} onChange={(v) => patch("why", { description: v })} onUpload={onUpload} rows={3} /></Field>
          {boundImageField("Main photo", "imageUrl", data, "why", patch, onUpload, { width: "100%", height: "100%", objectFit: "cover" })}
          <Field label="Stat number"><CmsRichText value={String(data.statNumber ?? "")} onChange={(v) => patch("why", { statNumber: v })} onUpload={onUpload} /></Field>
          <Field label="Stat label"><CmsRichText value={String(data.statLabel ?? "")} onChange={(v) => patch("why", { statLabel: v })} onUpload={onUpload} rows={2} /></Field>
        </>
      );
    case "timeline":
      return (
        <>
          <Field label="Badge"><CmsRichText value={String(data.badge ?? "")} onChange={(v) => patch("timeline", { badge: v })} onUpload={onUpload} /></Field>
          <Field label="Title"><CmsRichText value={String(data.title ?? "")} onChange={(v) => patch("timeline", { title: v })} onUpload={onUpload} heading /></Field>
          <Field label="Step photos (4 URLs, one per line)">
            <TextArea value={linesFromArray(data.timelineImages)} onChange={(v) => patch("timeline", { timelineImages: arrayFromLines(v) })} rows={4} mono />
          </Field>
        </>
      );
    case "reviews":
      return (
        <>
          <Field label="Badge"><CmsRichText value={String(data.badge ?? "")} onChange={(v) => patch("reviews", { badge: v })} onUpload={onUpload} /></Field>
          <Field label="Title"><CmsRichText value={String(data.title ?? "")} onChange={(v) => patch("reviews", { title: v })} onUpload={onUpload} heading /></Field>
          <Field label="Rating"><CmsRichText value={String(data.rating ?? "")} onChange={(v) => patch("reviews", { rating: v })} onUpload={onUpload} /></Field>
          <Field label="Customers"><CmsRichText value={String(data.customers ?? "")} onChange={(v) => patch("reviews", { customers: v })} onUpload={onUpload} /></Field>
          {boundImageField("Video thumbnail", "videoImageUrl", data, "reviews", patch, onUpload, { width: "100%", height: "100%", objectFit: "cover" })}
          <Field label="Video label"><CmsRichText value={String(data.videoLabel ?? "")} onChange={(v) => patch("reviews", { videoLabel: v })} onUpload={onUpload} /></Field>
          <Field label="Stat bar labels (one per line)">
            <TextArea value={linesFromArray(data.statLabels)} onChange={(v) => patch("reviews", { statLabels: arrayFromLines(v) })} rows={3} />
          </Field>
          <Field label="Stat bar percentages (one per line)">
            <TextArea value={linesFromArray(data.statValues)} onChange={(v) => patch("reviews", { statValues: arrayFromLines(v) })} rows={3} mono placeholder="98&#10;96&#10;99&#10;94" />
          </Field>
        </>
      );
    case "about":
      return (
        <>
          <Field label="Badge"><CmsRichText value={String(data.badge ?? "")} onChange={(v) => patch("about", { badge: v })} onUpload={onUpload} /></Field>
          <Field label="Title"><CmsRichText value={String(data.title ?? "")} onChange={(v) => patch("about", { title: v })} onUpload={onUpload} heading rows={2} /></Field>
          {boundImageField("Main photo", "imageUrl", data, "about", patch, onUpload, { width: "100%", height: "100%", objectFit: "cover" })}
          <Field label="Card label"><CmsRichText value={String(data.cardLabel ?? "")} onChange={(v) => patch("about", { cardLabel: v })} onUpload={onUpload} /></Field>
          <Field label="Card title"><CmsRichText value={String(data.cardTitle ?? "")} onChange={(v) => patch("about", { cardTitle: v })} onUpload={onUpload} heading /></Field>
        </>
      );
    default:
      if (block?.type === "image") {
        const blockSize = readPropImageSize(block.props);
        return (
          <>
            <ImageField
              label="Image URL"
              value={String(block.props?.src ?? "")}
              onChange={(v) => patch("__block__", { src: v })}
              onUpload={onUpload}
              size={blockSize}
              onSizeChange={(s) =>
                patch("__block__", {
                  ...(s.width !== undefined ? { width: s.width } : {}),
                  ...(s.height !== undefined ? { height: s.height } : {}),
                  ...(s.objectFit !== undefined ? { objectFit: s.objectFit } : {}),
                })
              }
              defaultSize={{ width: "100%", height: "auto", objectFit: "cover" }}
            />
            <Field label="Alt text">
              <TextInput value={String(block.props?.alt ?? "")} onChange={(v) => patch("__block__", { alt: v })} />
            </Field>
          </>
        );
      }
      if (block && !block.props?.useHtmlOnly) {
        return (
          <p className="text-xs text-white/50">
            Built-in section layout. Use <b>HTML/CSS</b> tab to replace it with code, or <b>+ Fields</b> to add extra content.
          </p>
        );
      }
      return null;
  }
}

export function SectionEditor({
  cmsKey,
  data,
  patch,
  onUpload,
  block,
  patchKey,
  selectedElementId,
  onSelectElement,
}: {
  cmsKey: string;
  data: Record<string, any>;
  patch: (key: string, patch: Record<string, any>) => void;
  onUpload: (file: File) => Promise<string>;
  block?: HomeBlock;
  patchKey: string;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
}) {
  const [mode, setMode] = useState<"fields" | "elements" | "code" | "custom">("elements");

  const isHtmlBlock = block?.type === "html";
  const isProductBlock = Boolean(block && !cmsKey);
  const content = isHtmlBlock || isProductBlock ? block?.props || {} : data;
  const customFields: CmsCustomField[] = Array.isArray(content.customFields) ? content.customFields : [];

  const applyPatch = (p: Record<string, any>) => {
    if (isHtmlBlock || isProductBlock) {
      patch("__block__", p);
    } else {
      patch(patchKey, p);
    }
  };

  const useHtmlOnly = Boolean(content.useHtmlOnly);
  const isGlobalSection = isGlobalCmsKey(cmsKey);
  const isGlobalBlock = Boolean(block?.global);
  const cssGlobal = isCssGlobal(cmsKey, content, block);

  const resolved = useMemo(
    () => resolveHtmlCssForEditor(cmsKey, isHtmlBlock ? block?.props || {} : data, block),
    [cmsKey, data, block, isHtmlBlock, content.customHtml, content.customCss, content.html, content.css]
  );

  const html = isHtmlBlock
    ? String(content.html ?? resolved.html)
    : String(content.customHtml ?? "").trim()
      ? String(content.customHtml)
      : resolved.html;
  const css = isHtmlBlock
    ? String(content.css ?? resolved.css)
    : String(content.customCss ?? "").trim()
      ? String(content.customCss)
      : resolved.css;

  // When opening HTML/CSS tab, seed from current field values if nothing saved yet
  useEffect(() => {
    if (mode !== "code") return;

    const savedHtml = isHtmlBlock ? String(content.html ?? "").trim() : String(content.customHtml ?? "").trim();
    const savedCss = isHtmlBlock ? String(content.css ?? "").trim() : String(content.customCss ?? "").trim();

    if (!savedHtml && !savedCss) {
      const exported = exportSectionToHtmlCss(cmsKey, isHtmlBlock ? block?.props || {} : data, block?.type);
      if (isHtmlBlock) {
        applyPatch({ html: exported.html || HTML_BLOCK_TEMPLATE, css: exported.css || CSS_BLOCK_TEMPLATE });
      } else {
        applyPatch({ customHtml: exported.html, customCss: exported.css });
      }
    }
  }, [mode]);

  const syncFromFields = () => {
    const exported = exportSectionToHtmlCss(cmsKey, isHtmlBlock ? block?.props || {} : data, block?.type);
    if (isHtmlBlock) {
      applyPatch({ html: exported.html, css: exported.css });
    } else {
      applyPatch({ customHtml: exported.html, customCss: exported.css });
    }
  };

  const codeHint = resolved.fromFields
    ? "Showing HTML/CSS generated from your current Fields — edit both together below."
    : "Showing your saved HTML/CSS — use ↻ Reload to pull latest from Fields.";

  if (isHtmlBlock) {
    return (
      <HtmlCssEditor
        html={html}
        css={css}
        rawPreview
        globalCss={Boolean(block?.global)}
        hint={
          block?.global
            ? "Global block — CSS applies to every page."
            : "Page CSS is scoped to this block only — it won't affect header, footer, or other pages."
        }
        onHtmlChange={(v) => applyPatch({ html: v, cssGlobal: block?.global ? true : content.cssGlobal })}
        onCssChange={(v) => applyPatch({ css: v })}
      />
    );
  }

  const showFieldsTab = Boolean(cmsKey) || isProductBlock;

  return (
    <div>
      <EditModeTabs mode={mode} onChange={setMode} />

      {mode === "fields" && showFieldsTab ? (
        renderFormFields(cmsKey, isProductBlock ? block?.props || {} : data, patch, onUpload, block)
      ) : null}

      {mode === "fields" && !showFieldsTab && block ? (
        renderFormFields("", block?.props || {}, patch, onUpload, block)
      ) : null}

      {mode === "elements" ? (
        <ElementsEditor
          cmsKey={cmsKey}
          data={isHtmlBlock || (!cmsKey && block) ? block?.props || {} : data}
          blockType={block?.type}
          selectedElementId={selectedElementId ?? null}
          onSelectElement={onSelectElement || (() => {})}
          onPatchData={applyPatch}
          onUpload={onUpload}
        />
      ) : null}

      {mode === "code" ? (
        <div className="space-y-3">
          <UseHtmlOnlyToggle checked={useHtmlOnly} onChange={(v) => applyPatch({ useHtmlOnly: v })} />
          <GlobalCssToggle
            checked={cssGlobal}
            locked={isGlobalSection || isGlobalBlock}
            onChange={(v) => applyPatch({ cssGlobal: v })}
          />
          <HtmlCssEditor
            html={html}
            css={css}
            rawPreview={cssGlobal}
            globalCss={cssGlobal}
            hint={
              cssGlobal
                ? "Global CSS — styles load on every page so new CMS pages keep the same look."
                : codeHint
            }
            onSyncFromFields={syncFromFields}
            onHtmlChange={(v) => applyPatch({ customHtml: v })}
            onCssChange={(v) => applyPatch({ customCss: v })}
          />
        </div>
      ) : null}

      {mode === "custom" ? (
        <CustomFieldsEditor
          fields={customFields}
          onChange={(fields) => applyPatch({ customFields: fields })}
          onUpload={onUpload}
        />
      ) : null}
    </div>
  );
}

export function renderSectionFields(
  cmsKey: string,
  data: Record<string, any>,
  patch: (key: string, patch: Record<string, any>) => void,
  onUpload: (file: File) => Promise<string>,
  block?: HomeBlock,
  elementUi?: { selectedElementId: string | null; onSelectElement: (id: string | null) => void }
) {
  const patchKey = cmsKey || "__block__";
  return (
    <SectionEditor
      cmsKey={cmsKey}
      data={data}
      patch={patch}
      onUpload={onUpload}
      block={block}
      patchKey={patchKey}
      selectedElementId={elementUi?.selectedElementId}
      onSelectElement={elementUi?.onSelectElement}
    />
  );
}
