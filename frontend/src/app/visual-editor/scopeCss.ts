/** Prefix CSS selectors so page-imported styles cannot break header/footer */
export function scopeCssToContainer(css: string, scopeSelector: string): string {
  if (!css?.trim() || !scopeSelector.trim()) return css || "";

  const out: string[] = [];
  let i = 0;
  const src = css.trim();

  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i++;

    if (src.slice(i, i + 2) === "/*") {
      const end = src.indexOf("*/", i);
      if (end === -1) break;
      out.push(src.slice(i, end + 2));
      i = end + 2;
      continue;
    }

    if (src[i] === "@") {
      const brace = src.indexOf("{", i);
      if (brace === -1) break;
      const header = src.slice(i, brace).trim();
      const close = findMatchingBrace(src, brace);
      const inner = src.slice(brace + 1, close);

      if (/^@(keyframes|font-face|-webkit-keyframes)/i.test(header)) {
        out.push(src.slice(i, close + 1));
      } else {
        out.push(`${header} { ${scopeCssToContainer(inner, scopeSelector)} }`);
      }
      i = close + 1;
      continue;
    }

    const brace = src.indexOf("{", i);
    if (brace === -1) break;
    const selectors = src.slice(i, brace).trim();
    const close = findMatchingBrace(src, brace);
    const body = src.slice(brace + 1, close).trim();
    out.push(`${prefixSelectorList(selectors, scopeSelector)} { ${body} }`);
    i = close + 1;
  }

  return out.join("\n");
}

function findMatchingBrace(src: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return src.length - 1;
}

function prefixSelectorList(selectors: string, scope: string): string {
  return selectors
    .split(",")
    .map((s) => {
      const sel = s.trim();
      if (!sel) return sel;
      if (sel === "html" || sel === "body" || sel === ":root") return scope;
      if (sel.startsWith(scope)) return sel;
      return `${scope} ${sel}`;
    })
    .join(", ");
}

export function cmsBlockScopeClass(blockId: string): string {
  return `cms-block-${blockId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
