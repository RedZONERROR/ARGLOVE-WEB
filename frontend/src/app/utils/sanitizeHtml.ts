const BLOCKED_TAGS = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "textarea",
  "select",
  "button",
  "link",
  "meta",
  "base",
  "svg",
  "math",
]);

const ALLOWED_TAGS = new Set([
  "p",
  "div",
  "span",
  "a",
  "img",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "strike",
  "del",
  "font",
  "mark",
  "small",
  "sub",
  "sup",
  "blockquote",
  "pre",
  "code",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "section",
  "article",
  "header",
  "footer",
  "nav",
  "figure",
  "figcaption",
  "video",
  "source",
  "style",
]);

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return (
    !trimmed.startsWith("javascript:") &&
    !trimmed.startsWith("data:text/html") &&
    !trimmed.startsWith("vbscript:")
  );
}

function stripScriptsFallback(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "");
}

function sanitizeDomTree(root: ParentNode): void {
  const elements = root.querySelectorAll("*");
  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    if (BLOCKED_TAGS.has(tag) || !ALLOWED_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc") {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "src") && !isSafeUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

/** Sanitize CMS/admin HTML before rendering to prevent stored XSS */
export function sanitizeCmsHtml(html: string): string {
  if (!html) return "";

  if (typeof document === "undefined") {
    return stripScriptsFallback(html);
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  sanitizeDomTree(template.content);

  const wrapper = document.createElement("div");
  wrapper.append(...Array.from(template.content.childNodes));
  return wrapper.innerHTML;
}

/** Sanitize inline CSS — strips script-like content */
export function sanitizeCmsCss(css: string): string {
  if (!css) return "";
  return css.replace(/expression\s*\(|javascript\s*:|@import\s+url\s*\(\s*['"]?\s*javascript/gi, "");
}
