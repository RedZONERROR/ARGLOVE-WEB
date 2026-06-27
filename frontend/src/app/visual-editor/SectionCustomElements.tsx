import React from "react";
import RichTextContent from "../components/RichTextContent";
import { CmsHtmlCssBlock } from "./CmsCustomContent";
import { buildImageStyle } from "./cmsImageSize";
import {
  CustomElement,
  ELEMENT_INSERT_END,
  customElementTextStyle,
  elementsAfterAnchor,
  getCustomElements,
} from "./cmsElements";

export function CustomElementView({ element, scopeId }: { element: CustomElement; scopeId: string }) {
  const scopeClass = `cms-el-${scopeId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  if (element.type === "html") {
    return (
      <div className="cms-el cms-el-html my-4" data-cms-el={element.id}>
        <CmsHtmlCssBlock html={element.html} css={element.css} scopeId={scopeId} />
      </div>
    );
  }

  if (element.type === "image") {
    if (!element.src) {
      return (
        <div className="cms-el cms-el-image my-4 px-4 py-8 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl" data-cms-el={element.id}>
          Image — set URL in Elements panel
        </div>
      );
    }
    return (
      <figure className="cms-el cms-el-image my-4" data-cms-el={element.id}>
        {element.css ? <style>{`.${scopeClass} { ${element.css} }`}</style> : null}
        <img
          className={scopeClass}
          src={element.src}
          alt={element.alt || element.label}
          style={{
            borderRadius: 12,
            ...buildImageStyle(
              { width: element.width, height: element.height, objectFit: element.objectFit as any },
              { width: "100%", height: "auto", objectFit: "cover" },
            ),
          }}
        />
      </figure>
    );
  }

  if (element.type === "button") {
    return (
      <div className="cms-el cms-el-button my-4" data-cms-el={element.id}>
        {element.css ? <style>{`.${scopeClass} { ${element.css} }`}</style> : null}
        <a href={element.href || "#"} className={`${scopeClass} inline-block px-6 py-3 rounded-full font-bold no-underline`} style={{ background: "#FFCC00", color: "#1A1A1A" }}>
          <RichTextContent html={element.content || "Button"} inline />
        </a>
      </div>
    );
  }

  const Tag = element.type === "heading" ? "h3" : "p";
  const textStyle = customElementTextStyle(element);
  return (
    <div className="cms-el cms-el-text my-3" data-cms-el={element.id}>
      {element.css ? <style>{`.${scopeClass} { ${element.css} }`}</style> : null}
      <RichTextContent html={element.content || ""} as={Tag} className={scopeClass} style={textStyle} />
    </div>
  );
}

/** Render HTML/image/text elements anchored after a specific bound field inside a section. */
export function CmsAnchor({ cms, insertAfter, scopeId }: { cms?: Record<string, any>; insertAfter: string; scopeId: string }) {
  const items = elementsAfterAnchor(getCustomElements(cms || {}), insertAfter);
  if (items.length === 0) return null;
  return (
    <>
      {items.map((el) => (
        <CustomElementView key={el.id} element={el} scopeId={`${scopeId}-${el.id}`} />
      ))}
    </>
  );
}

export function SectionCustomElements({ cms, scopeId }: { cms?: Record<string, any>; scopeId: string }) {
  return <CmsAnchor cms={cms} insertAfter={ELEMENT_INSERT_END} scopeId={scopeId} />;
}
