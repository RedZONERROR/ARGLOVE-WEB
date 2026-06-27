/** Generate HTML/CSS snapshot from current section field values */

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lines(items?: string[]) {
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

export function exportSectionToHtmlCss(
  cmsKey: string,
  data: Record<string, any>,
  blockType?: string
): { html: string; css: string } {
  switch (cmsKey) {
    case "header":
      return {
        html: `<header class="cms-header">
  ${data.logoImageUrl
    ? `<img class="cms-logo-img" src="${esc(data.logoImageUrl)}" alt="${esc(data.logoText || "Logo")}" />`
    : `<span class="cms-logo-text">${esc(data.logoText || "ARGLOVE")}</span>`}
  <span class="cms-logo-sub">${esc(data.logoSubText || "SKIN")}</span>
</header>`,
        css: `.cms-header { display: flex; align-items: center; gap: 8px; padding: 16px 0; }
.cms-logo-text { font-size: 22px; font-weight: 700; letter-spacing: 0.18em; color: #1A1A1A; }
.cms-logo-sub { font-size: 9px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: #D4AF37; }
.cms-logo-img { height: 28px; width: auto; object-fit: contain; }`,
      };

    case "marquee":
      return {
        html: `<div class="cms-marquee" style="background:${esc(data.bgColor || "#FFCC00")};color:${esc(data.textColor || "#1A1A1A")}">
  ${lines(data.items).map((item) => `<span class="cms-marquee-item">${esc(item)}</span>`).join("\n  ") || '<span class="cms-marquee-item">Your offer text</span>'}
</div>`,
        css: `.cms-marquee { padding: 10px 16px; font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; }
.cms-marquee-item::before { content: "◆"; margin-right: 8px; opacity: 0.5; }`,
      };

    case "hero":
      return {
        html: `<section class="cms-hero">
  <span class="cms-hero-badge">${esc(data.badge || "New Generation Anti-Aging Technology")}</span>
  <h1 class="cms-hero-title">
    <span>${esc(data.headline1 || "AGE LESS.")}</span>
    <span class="gold">${esc(data.headline2 || "REPAIR")}</span>
    <span>${esc(data.headline3 || "MORE.")}</span>
  </h1>
  <p class="cms-hero-desc">${esc(data.description || "Your product description here.")}</p>
  ${data.imageUrl ? `<img class="cms-hero-img" src="${esc(data.imageUrl)}" alt="Hero" />` : ""}
  <a href="#bestseller" class="cms-hero-cta">${esc(data.ctaText || "SHOP NOW")}</a>
  <ul class="cms-hero-trust">
    ${lines(data.trustItems).map((t) => `<li>${esc(t)}</li>`).join("\n    ")}
  </ul>
</section>`,
        css: `.cms-hero { padding: 32px; background: #FFF9E6; border-radius: 20px; }
.cms-hero-badge { display: inline-block; font-size: 10px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; padding: 6px 12px; background: #FFCC00; border-radius: 999px; margin-bottom: 16px; }
.cms-hero-title { font-size: clamp(36px, 5vw, 64px); line-height: 1.05; margin: 0 0 16px; color: #1A1A1A; }
.cms-hero-title .gold { color: #D4AF37; font-style: italic; }
.cms-hero-desc { font-size: 15px; line-height: 1.7; color: #666; max-width: 520px; margin-bottom: 20px; }
.cms-hero-img { max-width: 240px; border-radius: 20px; margin: 16px 0; display: block; }
.cms-hero-cta { display: inline-block; padding: 14px 32px; background: #FFCC00; color: #1A1A1A; font-weight: 700; text-decoration: none; border-radius: 999px; letter-spacing: 0.08em; }
.cms-hero-trust { list-style: none; padding: 0; margin: 20px 0 0; display: flex; flex-wrap: wrap; gap: 12px; }
.cms-hero-trust li { font-size: 11px; color: #666; }`,
      };

    case "bestseller":
      return {
        html: `<section class="cms-plans">
  <span class="cms-plans-badge">${esc(data.badge || "Bestseller")}</span>
  <h2 class="cms-plans-title">${esc(data.title || "Choose Your Transformation")}</h2>
  <p class="cms-plans-note">Product cards are loaded from your catalog — edit title/badge here, or use "Replace entire section" for full custom layout.</p>
</section>`,
        css: `.cms-plans { padding: 32px; text-align: center; background: #FFF9E6; border-radius: 20px; }
.cms-plans-badge { display: inline-block; font-size: 10px; font-weight: 600; letter-spacing: 0.25em; text-transform: uppercase; padding: 6px 12px; background: #FFCC00; border-radius: 999px; margin-bottom: 12px; }
.cms-plans-title { font-size: clamp(28px, 4vw, 44px); color: #1A1A1A; margin: 0 0 12px; }
.cms-plans-note { font-size: 12px; color: #888; }`,
      };

    case "finalcta":
      return {
        html: `<section class="cms-finalcta">
  <h2 class="cms-finalcta-title">${esc(data.headline || "READY TO TRANSFORM")}<br/><em>${esc(data.subheadline || "YOUR SKIN?")}</em></h2>
  <ul class="cms-finalcta-features">
    ${lines(data.features).map((f) => `<li>${esc(f)}</li>`).join("\n    ") || "<li>FREE Bio-Collagen Deep Mask</li>"}
  </ul>
  <a href="#bestseller" class="cms-finalcta-btn">${esc(data.ctaText || "BUY NOW")}</a>
</section>`,
        css: `.cms-finalcta { padding: 40px 32px; text-align: center; background: #FFFFFF; border-radius: 20px; border: 1px solid rgba(212,175,55,0.2); }
.cms-finalcta-title { font-size: clamp(32px, 4vw, 52px); color: #1A1A1A; margin: 0 0 20px; line-height: 1.1; }
.cms-finalcta-title em { color: #D4AF37; font-style: italic; }
.cms-finalcta-features { list-style: none; padding: 0; margin: 0 0 24px; }
.cms-finalcta-features li { font-size: 14px; color: #444; margin: 6px 0; }
.cms-finalcta-btn { display: inline-block; padding: 16px 40px; background: #FFCC00; color: #1A1A1A; font-weight: 800; text-decoration: none; border-radius: 999px; letter-spacing: 0.1em; }`,
      };

    case "footer":
      return {
        html: `<footer class="cms-footer">
  <p class="cms-footer-copy">${esc(data.copyright || "© ARGLOVE. All rights reserved.")}</p>
</footer>`,
        css: `.cms-footer { padding: 24px; text-align: center; border-top: 1px solid rgba(212,175,55,0.15); }
.cms-footer-copy { font-size: 12px; color: #bbb; margin: 0; }`,
      };

    default:
      if (blockType === "html") {
        return { html: data.html || "", css: data.css || "" };
      }
      return {
        html: `<!-- Built-in "${blockType || "section"}" layout — edit fields or replace with custom HTML below -->
<div class="cms-section-${esc(blockType || "custom")}">
  <p>Custom content for this section</p>
</div>`,
        css: `.cms-section-${blockType || "custom"} { padding: 24px; background: #FFF9E6; border-radius: 16px; text-align: center; }`,
      };
  }
}

/** Merge saved custom code with exported field snapshot (saved wins if non-empty) */
export function resolveHtmlCssForEditor(
  cmsKey: string,
  data: Record<string, any>,
  block?: { type?: string; props?: Record<string, any> }
): { html: string; css: string; fromFields: boolean } {
  const isHtmlBlock = block?.type === "html";
  const content = isHtmlBlock ? block?.props || {} : data;
  const savedHtml = isHtmlBlock ? String(content.html ?? "") : String(content.customHtml ?? "");
  const savedCss = isHtmlBlock ? String(content.css ?? "") : String(content.customCss ?? "");

  if (savedHtml.trim() || savedCss.trim()) {
    return { html: savedHtml, css: savedCss, fromFields: false };
  }

  const exported = exportSectionToHtmlCss(cmsKey, data, block?.type);
  return { html: exported.html, css: exported.css, fromFields: true };
}
