import React from "react";
import { CmsHtmlCssBlock, CmsSectionOverride } from "./CmsCustomContent";
import { isCssGlobal } from "./cmsPages";
import { cmsBlockScopeClass, scopeCssToContainer } from "./scopeCss";
import type { HomeBlock } from "./cmsEditorFields";
import { buildImageStyle, readPropImageSize } from "./cmsImageSize";
import { sanitizeCmsCss, sanitizeCmsHtml } from "../utils/sanitizeHtml";
import type { Plan } from "../App";

type BlockContext = {
  featuredPlan: Plan;
  activePlans: Plan[];
  heroCms: Record<string, any>;
  bestsellerCms: Record<string, any>;
  whyCms: Record<string, any>;
  timelineCms: Record<string, any>;
  reviewsCms: Record<string, any>;
  aboutCms: Record<string, any>;
  finalCtaCms: Record<string, any>;
  onAddToCart: (plan: Plan) => void;
  onVideoOpen: () => void;
  HeroSection: React.ComponentType<any>;
  BestsellerSection: React.ComponentType<any>;
  WhyItWorksSection: React.ComponentType<any>;
  TimelineSection: React.ComponentType<any>;
  ReviewsSection: React.ComponentType<any>;
  AboutSection: React.ComponentType<any>;
  FinalCTASection: React.ComponentType<any>;
};

/** CMS HTML block — global CSS site-wide; page CSS scoped so it cannot break header/footer */
export function CmsRawHtmlBlock({ block }: { block: HomeBlock }) {
  const html = sanitizeCmsHtml(String(block.props?.html || ""));
  const css = sanitizeCmsCss(String(block.props?.css || ""));
  const globalCss = isCssGlobal("", block.props, block);

  if (globalCss) {
    return (
      <CmsHtmlCssBlock html={html} css={css} scopeId={block.id} raw omitCss />
    );
  }

  const scopeClass = cmsBlockScopeClass(block.id);
  const scopedCss = scopeCssToContainer(css, `.${scopeClass}`);

  return (
    <div className={scopeClass}>
      {scopedCss ? <style>{scopedCss}</style> : null}
      {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null}
    </div>
  );
}

export function renderCmsBlock(block: HomeBlock, ctx: BlockContext): React.ReactNode {
  const blockCms = block.props || {};

  const mergeCms = (base: Record<string, any>) => ({ ...base, ...blockCms });

  const builtIn = (() => {
    switch (block.type) {
      case "hero":
        return <ctx.HeroSection featuredPlan={ctx.featuredPlan} cms={mergeCms(ctx.heroCms)} />;
      case "plans":
        return <ctx.BestsellerSection onAddToCart={ctx.onAddToCart} plans={ctx.activePlans} cms={mergeCms(ctx.bestsellerCms)} />;
      case "why":
        return <ctx.WhyItWorksSection cms={mergeCms(ctx.whyCms)} />;
      case "timeline":
        return <ctx.TimelineSection cms={mergeCms(ctx.timelineCms)} />;
      case "reviews":
        return <ctx.ReviewsSection onVideoOpen={ctx.onVideoOpen} cms={mergeCms(ctx.reviewsCms)} />;
      case "about":
        return <ctx.AboutSection cms={mergeCms(ctx.aboutCms)} />;
      case "finalcta":
        return <ctx.FinalCTASection onAddToCart={ctx.onAddToCart} plan={ctx.activePlans[0]} cms={mergeCms(ctx.finalCtaCms)} />;
      default:
        return null;
    }
  })();

  switch (block.type) {
    case "html":
      return <CmsRawHtmlBlock block={block} />;
    case "image":
      if (!block.props?.src) return null;
      return (
        <img
          src={String(block.props.src)}
          alt={String(block.props?.alt || "")}
          style={{
            display: "block",
            ...buildImageStyle(readPropImageSize(block.props), { width: "100%", height: "auto", objectFit: "cover" }),
          }}
        />
      );
    case "hero":
    case "plans":
    case "why":
    case "timeline":
    case "reviews":
    case "about":
    case "finalcta":
      if (blockCms.useHtmlOnly && blockCms.customHtml) {
        return (
          <CmsSectionOverride cms={blockCms} scopeId={block.id} fallback={null} raw={Boolean(blockCms.cssGlobal)} />
        );
      }
      return builtIn;
    default:
      return null;
  }
}
