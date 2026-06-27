import { buildImageStyle } from "./cmsImageSize";
import { isGlobalCmsKey } from "./cmsPages";
import RichTextContent from "../components/RichTextContent";
import { sanitizeCmsCss, sanitizeCmsHtml } from "../utils/sanitizeHtml";

export type CmsCustomField = {
  id: string;
  type: "text" | "html" | "image";
  label?: string;
  value?: string;
  html?: string;
  css?: string;
  src?: string;
  alt?: string;
  width?: string;
  height?: string;
  objectFit?: string;
};

type HtmlCssProps = {
  html?: string;
  css?: string;
  scopeId: string;
  className?: string;
  style?: React.CSSProperties;
  /** When true, HTML/CSS render as-is with no wrapper styling or CSS scoping */
  raw?: boolean;
  /** When true, CSS is omitted here (injected site-wide via CmsGlobalStyles) */
  omitCss?: boolean;
};

/** Renders HTML + optional CSS for CMS blocks and section overrides */
export function CmsHtmlCssBlock({ html, css, scopeId, className, style, raw, omitCss }: HtmlCssProps) {
  const safeHtml = sanitizeCmsHtml(html || "");
  const safeCss = sanitizeCmsCss(css || "");
  if (!safeHtml && !safeCss) return null;
  const cssToInject = omitCss ? undefined : safeCss;

  if (raw) {
    return (
      <>
        {cssToInject ? <style>{cssToInject}</style> : null}
        {safeHtml ? <div dangerouslySetInnerHTML={{ __html: safeHtml }} /> : null}
      </>
    );
  }

  const scopeClass = `cms-scope-${scopeId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div className={className} style={style}>
      {cssToInject ? <style>{`.${scopeClass}{${cssToInject}}`}</style> : null}
      {safeHtml ? (
        <div className={scopeClass} dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : null}
    </div>
  );
}

type CmsExtrasProps = {
  cms?: {
    customHtml?: string;
    customCss?: string;
    customFields?: CmsCustomField[];
  };
  scopeId: string;
};

/** Extra custom HTML/CSS blocks and dynamic fields appended to a section */
export function CmsSectionExtras({ cms, scopeId }: CmsExtrasProps) {
  const fields = Array.isArray(cms?.customFields) ? cms.customFields : [];
  if (!cms?.customHtml && fields.length === 0) return null;

  return (
    <div className="cms-section-extras">
      {cms?.customHtml || cms?.customCss ? (
        <CmsHtmlCssBlock
          html={cms.customHtml}
          css={cms.customCss}
          scopeId={`${scopeId}-extra`}
          className="mt-4"
        />
      ) : null}
      {fields.map((field) => (
        <CmsCustomFieldView key={field.id} field={field} scopeId={`${scopeId}-${field.id}`} />
      ))}
    </div>
  );
}

export function CmsCustomFieldView({ field, scopeId }: { field: CmsCustomField; scopeId: string }) {
  if (field.type === "text") {
    return (
      <div className="cms-custom-field cms-custom-text mt-3">
        {field.label ? (
          <div className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-60">{field.label}</div>
        ) : null}
        <RichTextContent html={field.value || ""} as="p" />
      </div>
    );
  }

  if (field.type === "image") {
    if (!field.src) return null;
    return (
      <figure className="cms-custom-field cms-custom-image mt-3">
        {field.label ? <figcaption className="text-xs mb-2 opacity-60">{field.label}</figcaption> : null}
        <img
          src={field.src}
          alt={field.alt || field.label || ""}
          style={{
            borderRadius: 12,
            ...buildImageStyle(
              { width: field.width, height: field.height, objectFit: field.objectFit as any },
              { width: "100%", height: "auto", objectFit: "cover" },
            ),
          }}
        />
      </figure>
    );
  }

  return (
    <CmsHtmlCssBlock
      html={field.html}
      css={field.css}
      scopeId={scopeId}
      className="cms-custom-field cms-custom-html mt-3"
    />
  );
}

/** Full section replacement when useHtmlOnly is enabled */
export function CmsSectionOverride({
  cms,
  scopeId,
  fallback,
  wrapperClassName,
  wrapperStyle,
  raw,
}: {
  cms?: { useHtmlOnly?: boolean; customHtml?: string; customCss?: string; customFields?: CmsCustomField[] };
  scopeId: string;
  fallback: React.ReactNode;
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
  raw?: boolean;
}) {
  if (cms?.useHtmlOnly && cms.customHtml) {
    const cssIsGlobal = cms.cssGlobal !== false && (isGlobalCmsKey(scopeId) || cms.cssGlobal === true);
    if (raw || cssIsGlobal) {
      return (
        <>
          <CmsHtmlCssBlock html={cms.customHtml} css={cms.customCss} scopeId={scopeId} raw omitCss={cssIsGlobal} />
          <CmsSectionExtras cms={{ customFields: cms.customFields }} scopeId={scopeId} />
        </>
      );
    }
    return (
      <section className={wrapperClassName} style={wrapperStyle}>
        <div className="max-w-6xl mx-auto px-8 py-10">
          <CmsHtmlCssBlock html={cms.customHtml} css={cms.customCss} scopeId={scopeId} />
          <CmsSectionExtras cms={{ customFields: cms.customFields }} scopeId={scopeId} />
        </div>
      </section>
    );
  }

  return (
    <>
      {fallback}
      {(cms?.customHtml || cms?.customFields?.length) && !cms?.useHtmlOnly ? (
        <div className="max-w-6xl mx-auto px-8">
          <CmsSectionExtras cms={cms} scopeId={scopeId} />
        </div>
      ) : null}
    </>
  );
}

export const HTML_BLOCK_TEMPLATE = `<!-- Paste your HTML below -->
<section>
  <h1>Your content</h1>
</section>`;

export const CSS_BLOCK_TEMPLATE = `/* Paste your CSS below — applied as-is, no scoping */
section {
  padding: 40px;
}
`;
