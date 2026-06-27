import type { HomeBlock } from "./cmsEditorFields";

export type PageBlockContent = {
  blocks?: HomeBlock[];
  /** HTML/image blocks between header and page sections */
  preContentBlocks?: HomeBlock[];
  /** HTML/image blocks between page sections and footer */
  postContentBlocks?: HomeBlock[];
};

export function parsePageBlockContent(raw?: PageBlockContent | HomeBlock[] | null): {
  blocks: HomeBlock[];
  preContentBlocks: HomeBlock[];
  postContentBlocks: HomeBlock[];
} {
  if (Array.isArray(raw)) {
    return { blocks: raw, preContentBlocks: [], postContentBlocks: [] };
  }
  return {
    blocks: Array.isArray(raw?.blocks) ? raw.blocks : [],
    preContentBlocks: Array.isArray(raw?.preContentBlocks) ? raw.preContentBlocks : [],
    postContentBlocks: Array.isArray(raw?.postContentBlocks) ? raw.postContentBlocks : [],
  };
}

export function serializePageBlockContent(
  blocks: HomeBlock[],
  preContentBlocks: HomeBlock[],
  postContentBlocks: HomeBlock[]
): PageBlockContent {
  const payload: PageBlockContent = { blocks };
  if (preContentBlocks.length > 0) payload.preContentBlocks = preContentBlocks;
  if (postContentBlocks.length > 0) payload.postContentBlocks = postContentBlocks;
  return payload;
}

export type CmsPageDef = {
  slug: string;
  title: string;
};

export type CmsSiteConfig = {
  pages: CmsPageDef[];
  globalBlocks: HomeBlock[];
  /** Extra CSS injected on every page */
  globalCss?: string;
};

/** Fixed CMS sections that always appear on every page */
export const GLOBAL_CMS_KEYS = ["header", "marquee", "footer"] as const;
export type GlobalCmsKey = (typeof GLOBAL_CMS_KEYS)[number];

export const DEFAULT_SITE_CONFIG: CmsSiteConfig = {
  pages: [{ slug: "home", title: "Home" }],
  globalBlocks: [],
  globalCss: "",
};

export function isGlobalCmsKey(key: string): key is GlobalCmsKey {
  return (GLOBAL_CMS_KEYS as readonly string[]).includes(key);
}

/** Whether section/block CSS should apply site-wide (not scoped to one block) */
export function isCssGlobal(cmsKey: string, data?: Record<string, any>, block?: HomeBlock): boolean {
  if (isGlobalCmsKey(cmsKey)) return data?.cssGlobal !== false;
  if (block?.global) return true;
  if (block?.props?.cssGlobal === true) return true;
  if (data?.cssGlobal === true) return true;
  return false;
}

/** CMS key for a page's block list */
export function pageContentKey(slug: string): string {
  const s = slug.trim() || "home";
  return s === "home" ? "home" : `page:${s}`;
}

/** Public URL path for a page */
export function pagePublicPath(slug: string): string {
  const s = slug.trim() || "home";
  return s === "home" ? "/" : `/${s}`;
}

/** CMS editor path — opens in its own tab */
export function pageEditorPath(slug: string): string {
  const s = slug.trim() || "home";
  return s === "home" ? "/cms" : `/cms/${encodeURIComponent(s)}`;
}

export function slugFromPublicPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  const slug = path.replace(/^\//, "").trim();
  if (!slug || slug === "cms" || slug.startsWith("cms/")) return null;
  return slug;
}

export function slugFromEditorPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/cms") return "home";
  if (/^\/cms\/product\/\d+$/.test(path)) return "home";
  const m = path.match(/^\/cms\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : "home";
}

export function normalizeSiteConfig(raw?: Partial<CmsSiteConfig>): CmsSiteConfig {
  const pages = Array.isArray(raw?.pages) && raw.pages.length > 0 ? raw.pages : DEFAULT_SITE_CONFIG.pages;
  const globalBlocks = Array.isArray(raw?.globalBlocks) ? raw.globalBlocks : [];
  const hasHome = pages.some((p) => p.slug === "home");
  return {
    pages: hasHome ? pages : [{ slug: "home", title: "Home" }, ...pages],
    globalBlocks,
    globalCss: typeof raw?.globalCss === "string" ? raw.globalCss : "",
  };
}

export function newPageSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || `page-${Date.now().toString(36)}`;
}

/** Gather all CSS that must load on every page */
export function collectGlobalCss(
  cmsSections: Record<string, any>,
  siteConfig: CmsSiteConfig
): string {
  const chunks: string[] = [];

  if (siteConfig.globalCss?.trim()) {
    chunks.push(siteConfig.globalCss.trim());
  }

  for (const key of GLOBAL_CMS_KEYS) {
    const cms = cmsSections[key];
    if (!cms) continue;
    if (isCssGlobal(key, cms) && cms.customCss?.trim()) {
      chunks.push(String(cms.customCss).trim());
    }
  }

  for (const block of siteConfig.globalBlocks || []) {
    if (block.type === "html" && block.props?.css?.trim()) {
      chunks.push(String(block.props.css).trim());
    } else if (block.props?.customCss?.trim()) {
      chunks.push(String(block.props.customCss).trim());
    }
  }

  const optionalGlobalKeys = ["hero", "bestseller", "why", "timeline", "reviews", "about", "finalcta"];
  for (const key of optionalGlobalKeys) {
    const cms = cmsSections[key];
    if (cms?.cssGlobal && cms?.customCss?.trim()) {
      chunks.push(String(cms.customCss).trim());
    }
  }

  return chunks.filter(Boolean).join("\n\n");
}
