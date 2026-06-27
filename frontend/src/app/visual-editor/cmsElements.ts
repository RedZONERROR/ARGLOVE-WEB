import { CSS_BLOCK_TEMPLATE, HTML_BLOCK_TEMPLATE } from "./CmsCustomContent";

export type ElementFieldType = "text" | "heading" | "textarea" | "color" | "image" | "list" | "imagelist";

export type BoundElementDef = {
  id: string;
  fieldKey: string;
  label: string;
  type: ElementFieldType;
  multiline?: boolean;
  hint?: string;
};

export type CustomElement = {
  id: string;
  type: "text" | "heading" | "button" | "image" | "html";
  label: string;
  content?: string;
  html?: string;
  css?: string;
  href?: string;
  src?: string;
  alt?: string;
  width?: string;
  height?: string;
  objectFit?: string;
  /** Insert after this bound element id, or __start__ / __end__ */
  insertAfter?: string;
  /** Text / heading styling */
  color?: string;
  fontSize?: string;
  bold?: boolean;
};

export const ELEMENT_INSERT_START = "__start__";
export const ELEMENT_INSERT_END = "__end__";

export const SECTION_BOUND_ELEMENTS: Record<string, BoundElementDef[]> = {
  header: [
    { id: "header.logoText", fieldKey: "logoText", label: "Logo text", type: "text" },
    { id: "header.logoSubText", fieldKey: "logoSubText", label: "Logo sub-text", type: "text" },
    { id: "header.logoImageUrl", fieldKey: "logoImageUrl", label: "Logo image", type: "image" },
  ],
  marquee: [
    { id: "marquee.items", fieldKey: "items", label: "Marquee messages", type: "list", multiline: true },
    { id: "marquee.bgColor", fieldKey: "bgColor", label: "Background color", type: "color" },
    { id: "marquee.textColor", fieldKey: "textColor", label: "Text color", type: "color" },
  ],
  hero: [
    { id: "hero.badge", fieldKey: "badge", label: "Badge", type: "text" },
    { id: "hero.headline1", fieldKey: "headline1", label: "Headline line 1", type: "heading" },
    { id: "hero.headline2", fieldKey: "headline2", label: "Headline line 2", type: "heading" },
    { id: "hero.headline3", fieldKey: "headline3", label: "Headline line 3", type: "heading" },
    { id: "hero.description", fieldKey: "description", label: "Description", type: "textarea", multiline: true },
    { id: "hero.ctaText", fieldKey: "ctaText", label: "Button text", type: "text" },
    { id: "hero.imageUrl", fieldKey: "imageUrl", label: "Main product photo (center)", type: "image" },
    {
      id: "hero.galleryImages",
      fieldKey: "galleryImages",
      label: "Gallery photos (5 around product)",
      type: "imagelist",
      multiline: true,
      hint: "One image URL per line — up to 5 lifestyle photos",
    },
    { id: "hero.floatingLabels", fieldKey: "floatingLabels", label: "Floating tag labels", type: "list", multiline: true },
    { id: "hero.freeGiftText", fieldKey: "freeGiftText", label: "Free gift text (pricing box)", type: "text" },
    { id: "hero.trustItems", fieldKey: "trustItems", label: "Trust items (bottom strip)", type: "list", multiline: true },
    { id: "hero.benefitItems", fieldKey: "benefitItems", label: "Benefit bullet points", type: "list", multiline: true },
  ],
  bestseller: [
    { id: "bestseller.badge", fieldKey: "badge", label: "Badge", type: "text" },
    { id: "bestseller.title", fieldKey: "title", label: "Section title", type: "heading" },
    { id: "bestseller.planImage1", fieldKey: "planImage1", label: "Plan 1 bottle — photo override", type: "image", hint: "Leave empty to use product catalog image" },
    { id: "bestseller.planImage2", fieldKey: "planImage2", label: "Plan 2 bottles — photo override", type: "image" },
    { id: "bestseller.planImage3", fieldKey: "planImage3", label: "Plan 3 bottles — photo override", type: "image" },
  ],
  why: [
    { id: "why.badge", fieldKey: "badge", label: "Badge", type: "text" },
    { id: "why.title", fieldKey: "title", label: "Section title", type: "heading" },
    { id: "why.description", fieldKey: "description", label: "Description", type: "textarea", multiline: true },
    { id: "why.imageUrl", fieldKey: "imageUrl", label: "Main section photo", type: "image" },
    { id: "why.statNumber", fieldKey: "statNumber", label: "Stat card number", type: "text" },
    { id: "why.statLabel", fieldKey: "statLabel", label: "Stat card label", type: "textarea", multiline: true },
  ],
  timeline: [
    { id: "timeline.badge", fieldKey: "badge", label: "Badge", type: "text" },
    { id: "timeline.title", fieldKey: "title", label: "Section title", type: "heading" },
    {
      id: "timeline.timelineImages",
      fieldKey: "timelineImages",
      label: "Timeline step photos (4 images)",
      type: "imagelist",
      multiline: true,
      hint: "One URL per line — Day 1, Week 1, Week 3, Week 6",
    },
  ],
  reviews: [
    { id: "reviews.badge", fieldKey: "badge", label: "Badge", type: "text" },
    { id: "reviews.title", fieldKey: "title", label: "Section title", type: "heading" },
    { id: "reviews.rating", fieldKey: "rating", label: "Overall rating number", type: "text" },
    { id: "reviews.customers", fieldKey: "customers", label: "Happy customers count", type: "text" },
    { id: "reviews.videoImageUrl", fieldKey: "videoImageUrl", label: "Video thumbnail photo", type: "image" },
    { id: "reviews.videoLabel", fieldKey: "videoLabel", label: "Video button label", type: "text" },
    { id: "reviews.statLabels", fieldKey: "statLabels", label: "Stat bar labels", type: "list", multiline: true },
    { id: "reviews.statValues", fieldKey: "statValues", label: "Stat bar percentages", type: "list", multiline: true },
  ],
  about: [
    { id: "about.badge", fieldKey: "badge", label: "Badge", type: "text" },
    { id: "about.title", fieldKey: "title", label: "Section title", type: "heading" },
    { id: "about.imageUrl", fieldKey: "imageUrl", label: "Main section photo", type: "image" },
    { id: "about.cardLabel", fieldKey: "cardLabel", label: "Floating card label", type: "text" },
    { id: "about.cardTitle", fieldKey: "cardTitle", label: "Floating card title", type: "text" },
  ],
  finalcta: [
    { id: "finalcta.headline", fieldKey: "headline", label: "Headline", type: "heading" },
    { id: "finalcta.subheadline", fieldKey: "subheadline", label: "Sub-headline", type: "heading" },
    { id: "finalcta.features", fieldKey: "features", label: "Feature list", type: "list", multiline: true },
    { id: "finalcta.ctaText", fieldKey: "ctaText", label: "Button text", type: "text" },
    { id: "finalcta.bottomStats", fieldKey: "bottomStats", label: "Bottom trust stats", type: "list", multiline: true },
  ],
  footer: [
    { id: "footer.copyright", fieldKey: "copyright", label: "Copyright text", type: "text" },
  ],
  banner: [
    { id: "banner.badge", fieldKey: "badge", label: "Badge", type: "text" },
    { id: "banner.title", fieldKey: "title", label: "Title", type: "heading" },
    { id: "banner.subtitle", fieldKey: "subtitle", label: "Subtitle", type: "textarea", multiline: true },
    { id: "banner.imageUrl", fieldKey: "imageUrl", label: "Banner image", type: "image" },
    { id: "banner.bgColor", fieldKey: "bgColor", label: "Background color", type: "color" },
  ],
  "product-main": [
    { id: "product-main.name", fieldKey: "name", label: "Product name", type: "heading" },
    {
      id: "product-main.shortDescription",
      fieldKey: "shortDescription",
      label: "Short description (under title)",
      type: "textarea",
      multiline: true,
    },
    {
      id: "product-main.longDescription",
      fieldKey: "longDescription",
      label: "Description tab content",
      type: "textarea",
      multiline: true,
    },
    {
      id: "product-main.keyBenefits",
      fieldKey: "keyBenefits",
      label: "Key benefits (one per line)",
      type: "list",
      multiline: true,
    },
    { id: "product-main.categoryBadge", fieldKey: "categoryBadge", label: "Category badge", type: "text" },
    { id: "product-main.ctaText", fieldKey: "ctaText", label: "Add to cart button", type: "text" },
    { id: "product-main.shippingNote", fieldKey: "shippingNote", label: "Shipping note", type: "text" },
  ],
  html: [
    { id: "html.block", fieldKey: "html", label: "HTML content", type: "textarea", multiline: true },
  ],
  image: [
    { id: "image.src", fieldKey: "src", label: "Image URL", type: "image" },
    { id: "image.alt", fieldKey: "alt", label: "Alt text", type: "text" },
  ],
};

export function newCustomElementId() {
  return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

export function getCustomElements(data: Record<string, any>): CustomElement[] {
  return Array.isArray(data.elements) ? data.elements : [];
}

export function elementInsertAfter(el: CustomElement): string {
  return el.insertAfter || ELEMENT_INSERT_END;
}

export function elementsAfterAnchor(elements: CustomElement[], anchor: string): CustomElement[] {
  return elements.filter((el) => elementInsertAfter(el) === anchor);
}

export function insertCustomElementAt(
  elements: CustomElement[],
  type: CustomElement["type"],
  insertAfter: string
): CustomElement[] {
  const el = { ...createCustomElement(type), insertAfter };
  return [...elements, el];
}

/** Inline styles for text & heading custom elements */
export function customElementTextStyle(el: CustomElement): Record<string, string | number> {
  const style: Record<string, string | number> = { margin: "0" };
  if (el.color) style.color = el.color;
  if (el.fontSize) style.fontSize = el.fontSize;
  if (el.bold) style.fontWeight = 700;
  return style;
}

export function createCustomElement(type: CustomElement["type"], insertAfter?: string): CustomElement {
  const base: CustomElement = { id: newCustomElementId(), type, label: "New element", insertAfter };
  switch (type) {
    case "text":
      base.label = "Text block";
      base.content = "Your text here";
      base.color = "#1A1A1A";
      base.fontSize = "16px";
      base.bold = false;
      break;
    case "heading":
      base.label = "Heading";
      base.content = "New Heading";
      base.color = "#1A1A1A";
      base.fontSize = "28px";
      base.bold = true;
      break;
    case "button":
      base.label = "Button";
      base.content = "CLICK HERE";
      base.href = "#bestseller";
      break;
    case "image":
      base.label = "Image";
      base.src = "";
      base.alt = "Image";
      break;
    case "html":
      base.label = "HTML block";
      base.html = HTML_BLOCK_TEMPLATE;
      base.css = CSS_BLOCK_TEMPLATE;
      break;
  }
  return base;
}

export function boundElementsForSection(cmsKey: string, blockType?: string): BoundElementDef[] {
  if (cmsKey && SECTION_BOUND_ELEMENTS[cmsKey]) return SECTION_BOUND_ELEMENTS[cmsKey];
  const key = blockType && SECTION_BOUND_ELEMENTS[blockType] ? blockType : blockType;
  if (key && SECTION_BOUND_ELEMENTS[key]) return SECTION_BOUND_ELEMENTS[key];
  return [];
}

export function readBoundValue(data: Record<string, any>, def: BoundElementDef): string {
  const val = data[def.fieldKey];
  if (def.type === "list" && Array.isArray(val)) return val.join("\n");
  if (def.type === "imagelist" && Array.isArray(val)) return val.join("\n");
  return String(val ?? "");
}

export function writeBoundPatch(def: BoundElementDef, value: string): Record<string, any> {
  if (def.type === "list") {
    return { [def.fieldKey]: value.split("\n").map((s) => s.trim()).filter(Boolean) };
  }
  if (def.type === "imagelist") {
    return { [def.fieldKey]: value.split("\n").map((s) => s.trim()).filter(Boolean) };
  }
  return { [def.fieldKey]: value };
}
