import React from "react";
import { collectGlobalCss, CmsSiteConfig } from "./cmsPages";
import { SITE_SHELL_CSS } from "./siteShellCss";

/** Injects site-wide CSS once — keeps UI consistent on every page */
export function CmsGlobalStyles({
  cmsSections,
  siteConfig,
}: {
  cmsSections: Record<string, any>;
  siteConfig: CmsSiteConfig;
}) {
  const css = [SITE_SHELL_CSS, collectGlobalCss(cmsSections, siteConfig)].filter(Boolean).join("\n\n");
  if (!css.trim()) return null;
  return <style id="cms-global-styles">{css}</style>;
}
