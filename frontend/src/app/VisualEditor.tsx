import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eye, FilePlus, Layers, Save, Trash2 } from "lucide-react";
import { toast, Toaster } from "sonner";
import { api } from "./services/api";
import { useAuth, canAccessCms } from "./context/AuthContext";
import { spaNavigate, spaNavigateClick } from "./utils/spaNavigate";
import { plainTextFromHtml } from "./utils/plainText";
import EditableSection from "./visual-editor/EditableSection";
import {
  BLOCK_LABELS,
  CMS_KEYS,
  DEFAULT_HOME_BLOCKS,
  HomeBlock,
  HomeBlockType,
  UNIVERSAL_INSERT_BLOCKS,
  buildEditorSections,
  getPageSectionBlockTypes,
  Field,
  newBlockId,
  renderSectionFields,
  TextArea,
} from "./visual-editor/cmsEditorFields";
import { mergeCmsSection } from "./visual-editor/cmsSectionDefaults";
import { CSS_BLOCK_TEMPLATE, HTML_BLOCK_TEMPLATE } from "./visual-editor/CmsCustomContent";
import { renderCmsBlock } from "./visual-editor/CmsBlockView";
import { CmsGlobalStyles } from "./visual-editor/CmsGlobalStyles";
import {
  CmsPageDef,
  CmsSiteConfig,
  normalizeSiteConfig,
  newPageSlug,
  pageContentKey,
  pageEditorPath,
  pagePublicPath,
  parsePageBlockContent,
  serializePageBlockContent,
  slugFromEditorPath,
} from "./visual-editor/cmsPages";
import {
  DEFAULT_PRODUCT_BLOCKS,
  enrichProductBlocksFromProduct,
  normalizeProductBlocks,
  parseProductEditorPath,
  productContentKey,
  productEditorPath,
  productPublicPath,
} from "./visual-editor/productCms";
import ProductBannerBlock from "./components/ProductBannerBlock";
import ProductMainPreview from "./components/ProductMainPreview";
import { CmsRawHtmlBlock } from "./visual-editor/CmsBlockView";
import {
  MarqueeBar,
  Header,
  HeroSection,
  BestsellerSection,
  WhyItWorksSection,
  TimelineSection,
  ReviewsSection,
  AboutSection,
  FinalCTASection,
  Footer,
  buildPlansFromCatalog,
  buildOfferItems,
  FALLBACK_PLANS,
  type Plan,
} from "./App";

const noop = () => {};

export default function VisualEditor() {
  const { user, setUser, isAuthenticated, authReady } = useAuth();
  const [pathname, setPathname] = useState(
    typeof window !== "undefined" ? window.location.pathname : "/cms"
  );

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const pageSlug = slugFromEditorPath(pathname);
  const editorProductId = parseProductEditorPath(pathname);
  const isProductEditor = editorProductId != null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("marquee");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [sectionData, setSectionData] = useState<Record<string, any>>({});
  const [siteConfig, setSiteConfig] = useState<CmsSiteConfig>(normalizeSiteConfig());
  const [globalBlocks, setGlobalBlocks] = useState<HomeBlock[]>([]);
  const [pageBlocks, setPageBlocks] = useState<HomeBlock[]>([]);
  const [preContentBlocks, setPreContentBlocks] = useState<HomeBlock[]>([]);
  const [postContentBlocks, setPostContentBlocks] = useState<HomeBlock[]>([]);
  const [activePlans, setActivePlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [productTitle, setProductTitle] = useState("");
  const [productPreview, setProductPreview] = useState<{
    product: any;
    resources: any[];
    variants: any[];
    review_stats: { count: number; average: number };
    reviews: any[];
  } | null>(null);
  const [addMenuForIndex, setAddMenuForIndex] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const currentPage = isProductEditor
    ? { slug: `product-${editorProductId}`, title: productTitle || `Product #${editorProductId}` }
    : siteConfig.pages.find((p) => p.slug === pageSlug) || { slug: pageSlug, title: pageSlug };
  const editorSections = useMemo(
    () => (isProductEditor ? buildEditorSections(pageBlocks, []) : buildEditorSections(pageBlocks, globalBlocks)),
    [pageBlocks, globalBlocks, isProductEditor]
  );
  const selectedSection = editorSections.find((s) => s.id === selectedId) || editorSections[0];

  const findBlock = (blockId: string): { block: HomeBlock; isGlobal: boolean } | null => {
    const g = globalBlocks.find((b) => b.id === blockId);
    if (g) return { block: g, isGlobal: true };
    for (const list of [pageBlocks, preContentBlocks, postContentBlocks]) {
      const p = list.find((b) => b.id === blockId);
      if (p) return { block: p, isGlobal: false };
    }
    return null;
  };

  const patchSection = (key: string, patch: Record<string, any>) => {
    if (key === "__block__" && selectedSection?.block) {
      const blockId = selectedSection.block.id;
      const update = (blocks: HomeBlock[]) =>
        blocks.map((b) => (b.id === blockId ? { ...b, props: { ...(b.props || {}), ...patch } } : b));
      if (globalBlocks.some((b) => b.id === blockId)) {
        setGlobalBlocks(update);
      } else if (preContentBlocks.some((b) => b.id === blockId)) {
        setPreContentBlocks(update);
      } else if (postContentBlocks.some((b) => b.id === blockId)) {
        setPostContentBlocks(update);
      } else {
        setPageBlocks(update);
      }
      return;
    }
    setSectionData((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
  };

  const toggleBlockGlobal = (blockId: string, makeGlobal: boolean) => {
    const found = findBlock(blockId);
    if (!found) return;
    if (makeGlobal && !found.isGlobal) {
      setPageBlocks((prev) => prev.filter((b) => b.id !== blockId));
      setGlobalBlocks((prev) => [...prev, { ...found.block, global: true }]);
    } else if (!makeGlobal && found.isGlobal) {
      setGlobalBlocks((prev) => prev.filter((b) => b.id !== blockId));
      setPageBlocks((prev) => [...prev, { ...found.block, global: false }]);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      if (!authReady) return;
      if (!isAuthenticated) {
        if (mounted) {
          setError("Login required. Sign in on the store (same browser), then open this editor again.");
          setLoading(false);
        }
        return;
      }
      try {
        const profile = await api.getProfile();
        if (!mounted) return;
        setUser(profile.user);

        if (isProductEditor && editorProductId) {
          const pKey = productContentKey(editorProductId);
          const cms = await api.getCmsSections(["header", "marquee", "footer", pKey]);
          const productDetail = await api.getProductDetail(editorProductId);
          const reviewData = await api.getProductReviews(editorProductId);
          if (!mounted) return;

          setProductTitle(plainTextFromHtml(productDetail.product.name));
          setProductPreview({
            product: productDetail.product,
            resources: productDetail.resources || [],
            variants: productDetail.variants || [],
            review_stats: productDetail.review_stats || { count: 0, average: 0 },
            reviews: reviewData.reviews || [],
          });
          const next: Record<string, any> = {};
          for (const key of ["header", "marquee", "footer"] as const) {
            next[key] = mergeCmsSection(key, cms.sections?.[key]?.content ?? {});
          }
          setSectionData(next);

          const content = cms.sections?.[pKey]?.content as any;
          const parsed = parsePageBlockContent(content);
          const blocks = enrichProductBlocksFromProduct(
            normalizeProductBlocks(parsed.blocks),
            productDetail.product,
            productDetail.resources || []
          );
          setPageBlocks(blocks);
          setPreContentBlocks(parsed.preContentBlocks);
          setPostContentBlocks(parsed.postContentBlocks);
          setGlobalBlocks([]);
          setSelectedId(blocks[0]?.id || "header");
          setLoading(false);
          return;
        }

        const pKey = pageContentKey(pageSlug);
        const cms = await api.getCmsSections([...CMS_KEYS, "site", pKey]);
        const catalog = await api.loadProductCatalog();
        if (!mounted) return;

        setActivePlans(buildPlansFromCatalog(catalog));

        const next: Record<string, any> = {};
        for (const key of CMS_KEYS) {
          if (key === "home") continue;
          next[key] = mergeCmsSection(key, cms.sections?.[key]?.content ?? {});
        }
        setSectionData(next);

        const site = normalizeSiteConfig(cms.sections?.site?.content);
        setSiteConfig(site);
        setGlobalBlocks(site.globalBlocks || []);

        const pageContent = cms.sections?.[pKey]?.content as any;
        const parsed = parsePageBlockContent(pageContent);
        let blocks: HomeBlock[] = parsed.blocks;
        if (pageSlug === "home" && blocks.length === 0) {
          const legacy = cms.sections?.home?.content as any;
          const legacyParsed = parsePageBlockContent(legacy);
          blocks = legacyParsed.blocks.length > 0 ? legacyParsed.blocks : DEFAULT_HOME_BLOCKS;
          if (legacyParsed.preContentBlocks.length > 0) parsed.preContentBlocks = legacyParsed.preContentBlocks;
          if (legacyParsed.postContentBlocks.length > 0) parsed.postContentBlocks = legacyParsed.postContentBlocks;
        }
        setPageBlocks(blocks.filter((b) => !b.global));
        setPreContentBlocks(parsed.preContentBlocks);
        setPostContentBlocks(parsed.postContentBlocks);
        setSelectedId(blocks.length > 0 ? blocks[0].id : "marquee");
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load editor.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [pageSlug, editorProductId, isProductEditor, isAuthenticated, authReady, setUser]);

  useEffect(() => {
    const el = previewRef.current?.querySelector(`[data-editor-section="${selectedId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setSelectedElementId(null);
  }, [selectedId]);

  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    root.querySelectorAll("[data-cms-el]").forEach((node) => {
      node.classList.remove("cms-el-highlight");
    });
    if (selectedElementId) {
      root.querySelector(`[data-cms-el="${selectedElementId}"]`)?.classList.add("cms-el-highlight");
      root.querySelector(`[data-cms-el="${selectedElementId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedElementId, sectionData, globalBlocks, pageBlocks]);

  const uploadImage = async (file: File) => {
    if (!isAuthenticated || !user?.id) throw new Error("Login required to upload.");
    const resource = await api.uploadResource(file, "User", user.id, "banner");
    return resource.file_url;
  };

  const handleUpload = async (file: File) => {
    try {
      return await uploadImage(file);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
      throw err;
    }
  };

  const publishAll = async () => {
    setSaving(true);
    try {
      if (isProductEditor && editorProductId) {
        await api.updateCmsSection(
          productContentKey(editorProductId),
          serializePageBlockContent(pageBlocks, preContentBlocks, postContentBlocks)
        );
        for (const key of ["header", "marquee", "footer"] as const) {
          if (sectionData[key]) {
            await api.updateCmsSection(key, sectionData[key]);
          }
        }
        const mainBlock = pageBlocks.find((b) => b.type === "product-main");
        if (mainBlock?.props && productPreview) {
          const props = mainBlock.props;
          const p = productPreview.product;
          await api.updateProduct(editorProductId, {
            name: props.name || p.name,
            description: props.shortDescription || p.description,
            long_description: props.longDescription || p.long_description || p.description,
            key_benefits: props.keyBenefits || p.key_benefits || [],
            regular_price: parseFloat(String(p.regular_price)),
            discount_price: p.discount_price ? parseFloat(String(p.discount_price)) : null,
            stock_quantity: p.stock_quantity ?? 0,
            category_id: p.category_id ?? null,
            is_published: p.is_published ?? true,
            variants: productPreview.variants,
          });
          setProductPreview((prev) =>
            prev
              ? {
                  ...prev,
                  product: {
                    ...prev.product,
                    name: props.name || prev.product.name,
                    description: props.shortDescription || prev.product.description,
                    long_description: props.longDescription || prev.product.long_description,
                    key_benefits: props.keyBenefits || prev.product.key_benefits,
                  },
                }
              : prev
          );
        }
        toast.success(`Product page "${currentPage.title}" published!`);
        return;
      }

      const keys = ["header", "marquee", "hero", "bestseller", "why", "timeline", "reviews", "about", "finalcta", "footer"] as const;
      for (const key of keys) {
        await api.updateCmsSection(key, sectionData[key] || {});
      }
      await api.updateCmsSection("site", {
        pages: siteConfig.pages,
        globalBlocks,
        globalCss: siteConfig.globalCss || "",
      });
      const pKey = pageContentKey(pageSlug);
      const pagePayload = serializePageBlockContent(pageBlocks, preContentBlocks, postContentBlocks);
      await api.updateCmsSection(pKey, pagePayload);
      if (pageSlug === "home") {
        await api.updateCmsSection("home", pagePayload);
      }
      toast.success(`"${currentPage.title}" published!`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to publish.");
    } finally {
      setSaving(false);
    }
  };

  const createNewPage = async () => {
    const title = window.prompt("New page title (e.g. Summer Sale):");
    if (!title?.trim()) return;
    const slug = newPageSlug(title);
    if (siteConfig.pages.some((p) => p.slug === slug)) {
      toast.error("A page with that slug already exists.");
      return;
    }
    const newPage: CmsPageDef = { slug, title: title.trim() };
    const nextSite = { ...siteConfig, pages: [...siteConfig.pages, newPage] };
    try {
      await api.updateCmsSection("site", { pages: nextSite.pages, globalBlocks, globalCss: siteConfig.globalCss || "" });
      await api.updateCmsSection(pageContentKey(slug), { blocks: [] });
      setSiteConfig(nextSite);
      toast.success(`Page "${title}" created — opening editor in new tab.`);
      window.open(pageEditorPath(slug), "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create page.");
    }
  };

  const deleteCurrentPage = async () => {
    if (pageSlug === "home") {
      toast.error("The home page cannot be deleted.");
      return;
    }
    if (!window.confirm(`Delete page "${currentPage.title}"?\n\nThis removes the page from your site. This cannot be undone.`)) {
      return;
    }
    const nextPages = siteConfig.pages.filter((p) => p.slug !== pageSlug);
    try {
      await api.updateCmsSection("site", {
        pages: nextPages,
        globalBlocks,
        globalCss: siteConfig.globalCss || "",
      });
      toast.success(`Page "${currentPage.title}" deleted.`);
      spaNavigate("/cms");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete page.");
    }
  };

  type InsertZone = "page" | "global" | "pre" | "post";

  const addBlockAt = (index: number, type: HomeBlockType, zone: InsertZone = "page") => {
    const asGlobal = zone === "global";
    const base: HomeBlock = { id: newBlockId(type), type, props: {}, global: asGlobal };
    if (type === "html") {
      base.props = { html: HTML_BLOCK_TEMPLATE, css: CSS_BLOCK_TEMPLATE, cssGlobal: asGlobal };
    }
    if (type === "banner") {
      base.props = { badge: "New", title: "", subtitle: "", imageUrl: "", bgColor: "#FFF9E6" };
    }
    if (type === "image") base.props = { src: "", alt: "Image", width: "100%", height: "auto", objectFit: "cover" };

    const apply = (setter: React.Dispatch<React.SetStateAction<HomeBlock[]>>) => {
      setter((prev) => {
        const copy = [...prev];
        copy.splice(index, 0, base);
        return copy;
      });
    };

    if (zone === "global") apply(setGlobalBlocks);
    else if (zone === "pre") apply(setPreContentBlocks);
    else if (zone === "post") apply(setPostContentBlocks);
    else apply(setPageBlocks);

    setSelectedId(base.id);
    setAddMenuForIndex(null);
  };

  const removeBlock = (blockId: string) => {
    setGlobalBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setPageBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setPreContentBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setPostContentBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setSelectedId("marquee");
  };

  const marqueeCms = mergeCmsSection("marquee", sectionData.marquee);
  const headerCms = mergeCmsSection("header", sectionData.header);
  const heroCms = mergeCmsSection("hero", sectionData.hero);
  const bestsellerCms = mergeCmsSection("bestseller", sectionData.bestseller);
  const whyCms = mergeCmsSection("why", sectionData.why);
  const timelineCms = mergeCmsSection("timeline", sectionData.timeline);
  const reviewsCms = mergeCmsSection("reviews", sectionData.reviews);
  const aboutCms = mergeCmsSection("about", sectionData.about);
  const finalCtaCms = mergeCmsSection("finalcta", sectionData.finalcta);
  const footerCms = mergeCmsSection("footer", sectionData.footer);
  const offerItems = buildOfferItems(activePlans);
  const marqueeItems = Array.isArray(marqueeCms.items) && marqueeCms.items.length > 0 ? marqueeCms.items : offerItems;
  const featuredPlan = activePlans.find((p) => p.id === "single") || activePlans[0];

  const blockCtx = {
    featuredPlan,
    activePlans,
    heroCms,
    bestsellerCms,
    whyCms,
    timelineCms,
    reviewsCms,
    aboutCms,
    finalCtaCms,
    onAddToCart: noop,
    onVideoOpen: noop,
    HeroSection,
    BestsellerSection,
    WhyItWorksSection,
    TimelineSection,
    ReviewsSection,
    AboutSection,
    FinalCTASection,
  };

  const renderBlockSection = (block: HomeBlock, isGlobal: boolean) => (
    <EditableSection
      id={block.id}
      label={BLOCK_LABELS[block.type]}
      global={isGlobal}
      selected={selectedId === block.id}
      onSelect={setSelectedId}
      removable
      onRemove={() => removeBlock(block.id)}
    >
      {renderCmsBlock(block, blockCtx)}
    </EditableSection>
  );

  const renderProductBlockSection = (block: HomeBlock) => (
    <EditableSection
      id={block.id}
      label={BLOCK_LABELS[block.type] || block.type}
      selected={selectedId === block.id}
      onSelect={setSelectedId}
      removable={block.type !== "product-main"}
      onRemove={() => removeBlock(block.id)}
    >
      {block.type === "product-main" ? (
        productPreview ? (
          <ProductMainPreview
            product={productPreview.product}
            resources={productPreview.resources}
            variants={productPreview.variants}
            reviewStats={productPreview.review_stats}
            reviews={productPreview.reviews}
            previewMode
            overrides={block.props || {}}
          />
        ) : (
          <div className="py-16 px-8 text-center text-sm text-gray-500" style={{ background: "#FFF9E6" }}>
            Loading product preview…
          </div>
        )
      ) : block.type === "banner" ? (
        <ProductBannerBlock blockId={block.id} props={block.props} />
      ) : block.type === "html" ? (
        <CmsRawHtmlBlock block={block} />
      ) : block.type === "image" ? (
        block.props?.src ? (
          <img src={String(block.props.src)} alt={String(block.props.alt || "")} className="w-full block" />
        ) : (
          <div className="py-12 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 mx-8 rounded-2xl">
            Image block — set image in sidebar
          </div>
        )
      ) : null}
    </EditableSection>
  );

  const renderInsertBlockSection = (block: HomeBlock) => (
    <EditableSection
      id={block.id}
      label={BLOCK_LABELS[block.type] || block.type}
      selected={selectedId === block.id}
      onSelect={setSelectedId}
      removable
      onRemove={() => removeBlock(block.id)}
    >
      {block.type === "html" ? (
        <CmsRawHtmlBlock block={block} />
      ) : block.props?.src ? (
        <img src={String(block.props.src)} alt={String(block.props.alt || "")} className="w-full block" />
      ) : (
        <div className="py-12 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 mx-8 rounded-2xl">
          Image block — set image in sidebar
        </div>
      )}
    </EditableSection>
  );

  const renderAddMenu = (index: number, zone: InsertZone = "page") => {
    if (isProductEditor && zone === "global") return null;

    const menuKey = `${zone}-${index}`;
    const sectionTypes = getPageSectionBlockTypes(isProductEditor);
    const blockTypes: HomeBlockType[] =
      zone === "pre" || zone === "post"
        ? [...UNIVERSAL_INSERT_BLOCKS]
        : [...UNIVERSAL_INSERT_BLOCKS, ...sectionTypes.filter((t) => !UNIVERSAL_INSERT_BLOCKS.includes(t))];

    const zoneLabel =
      zone === "pre"
        ? "After header"
        : zone === "post"
          ? "Before footer"
          : zone === "global"
            ? "Global section (all pages)"
            : isProductEditor
              ? "Product page section"
              : "Page section";

    return (
    <div className="relative z-30 flex justify-center py-3">
      {addMenuForIndex === menuKey ? (
        <div className="flex flex-col items-center gap-2 p-3 rounded-2xl shadow-xl max-w-lg" style={{ background: "#1A1A1A" }}>
          <div className="text-[10px] font-bold tracking-widest uppercase text-white/50">{zoneLabel}</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {blockTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addBlockAt(index, t, zone)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: UNIVERSAL_INSERT_BLOCKS.includes(t) ? "rgba(255,204,0,0.18)" : "rgba(255,255,255,0.08)",
                  color: UNIVERSAL_INSERT_BLOCKS.includes(t) ? "#FFCC00" : "#fff",
                  border: `1px solid ${UNIVERSAL_INSERT_BLOCKS.includes(t) ? "rgba(255,204,0,0.35)" : "rgba(255,255,255,0.12)"}`,
                  cursor: "pointer",
                }}
              >
                + {BLOCK_LABELS[t]}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setAddMenuForIndex(null)} className="px-3 py-1.5 text-xs text-white/50" style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddMenuForIndex(menuKey)}
          className="px-4 py-2 rounded-full text-xs font-bold tracking-wider"
          style={{
            background: zone === "pre" || zone === "post" ? "#374151" : zone === "global" ? "#1e3a5f" : isProductEditor ? "#78350f" : "#1A1A1A",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          + INSERT {zone === "pre" || zone === "post" ? "HTML / IMAGE" : zone === "global" ? "GLOBAL" : "SECTION"}
        </button>
      )}
    </div>
    );
  };

  const elementUi = { selectedElementId, onSelectElement: setSelectedElementId };
  const isAllowed = canAccessCms(user);
  const activeCmsKey = selectedSection?.cmsKey;
  const activeData = activeCmsKey ? sectionData[activeCmsKey] || {} : {};
  const selectedBlockInfo = selectedSection?.block ? findBlock(selectedSection.block.id) : null;
  const firstPageBlock = pageBlocks[0];
  const needsMainOffset =
    pageSlug !== "home" ||
    (firstPageBlock && firstPageBlock.type !== "hero") ||
    globalBlocks.length > 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#111", color: "#fff", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Toaster position="top-center" />

      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/10 shrink-0" style={{ background: "#0B0B0B" }}>
        <div className="flex items-center gap-3 min-w-0">
          <a href={isProductEditor && editorProductId ? productPublicPath(editorProductId) : pagePublicPath(pageSlug)} className="p-2 rounded-lg hover:bg-white/5 shrink-0" style={{ color: "#fff" }} title="Back to site">
            <ArrowLeft size={18} />
          </a>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">
              {isProductEditor ? "Product Page Editor" : "Visual Site Editor"} — {currentPage.title}
            </div>
            <div className="text-xs text-white/50 truncate">
              {user?.email || "…"} · {isProductEditor && editorProductId ? productPublicPath(editorProductId) : pagePublicPath(pageSlug)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {!isProductEditor ? (
          <select
            value={pageSlug}
            onChange={(e) => {
              const path = pageEditorPath(e.target.value);
              spaNavigate(path);
              setPathname(path);
            }}
            className="rounded-lg px-2 py-2 text-xs font-semibold"
            style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            {siteConfig.pages.map((p) => (
              <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
          </select>
          ) : null}
          {!isProductEditor ? (
          <button
            type="button"
            onClick={createNewPage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "rgba(59,130,246,0.2)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.35)", cursor: "pointer" }}
          >
            <FilePlus size={14} /> New page
          </button>
          ) : null}
          {!isProductEditor && pageSlug !== "home" ? (
            <button
              type="button"
              onClick={deleteCurrentPage}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)", cursor: "pointer" }}
              title="Delete this page"
            >
              <Trash2 size={14} /> Delete page
            </button>
          ) : null}
          <a
            href={isProductEditor && editorProductId ? productPublicPath(editorProductId) : pagePublicPath(pageSlug)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "rgba(255,255,255,0.06)", color: "#fff", textDecoration: "none" }}
          >
            <Eye size={14} /> Preview
          </a>
          <button
            type="button"
            disabled={saving || !isAllowed}
            onClick={publishAll}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            style={{ background: "#22c55e", color: "#fff", border: "none", cursor: "pointer" }}
          >
            <Save size={15} /> {saving ? "Publishing…" : "Publish"}
          </button>
        </div>
      </header>

      {loading || !authReady ? (
        <div className="flex-1 flex items-center justify-center text-white/60">Loading editor…</div>
      ) : error || !isAuthenticated ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md p-6 rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-50 text-sm space-y-4">
            <p>{error || "Please sign in to use the editor."}</p>
            <a
              href="/"
              className="inline-flex px-4 py-2 rounded-lg text-xs font-bold"
              style={{ background: "#FFCC00", color: "#1A1A1A", textDecoration: "none" }}
            >
              Go to store & sign in
            </a>
          </div>
        </div>
      ) : !isAllowed ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md p-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-50 text-sm">
            Admin or editor access required. Your account role is <b>{user?.role || "unknown"}</b>. Ask an admin to set your role to <b>admin</b> in the database, then log in again.
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          <div ref={previewRef} className="flex-1 overflow-y-auto min-h-[50vh] lg:min-h-0" style={{ background: "#f5f5f5" }}>
            <style>{`
              .cms-el-highlight {
                outline: 2px solid #3b82f6 !important;
                outline-offset: 3px;
                box-shadow: 0 0 0 6px rgba(59,130,246,0.2);
                border-radius: 4px;
              }
            `}</style>
            <div id="arglove-site-shell" className="w-full" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FFFFFF", color: "#1A1A1A" }}>
              <CmsGlobalStyles cmsSections={sectionData} siteConfig={siteConfig} />
              <EditableSection id="marquee" label="Marquee" global selected={selectedId === "marquee"} onSelect={setSelectedId}>
                <MarqueeBar items={marqueeItems} bgColor={marqueeCms.bgColor || "#FFCC00"} textColor={marqueeCms.textColor || "#1A1A1A"} />
              </EditableSection>

              <EditableSection id="header" label="Header" global selected={selectedId === "header"} onSelect={setSelectedId}>
                <Header cartCount={0} onCartOpen={noop} onSearchOpen={noop} onAccountOpen={noop} cms={headerCms} editorMode />
              </EditableSection>

              {renderAddMenu(0, "pre")}
              {preContentBlocks.map((block, index) => (
                <React.Fragment key={block.id}>
                  {renderInsertBlockSection(block)}
                  {renderAddMenu(index + 1, "pre")}
                </React.Fragment>
              ))}

              <main className={needsMainOffset ? "cms-main-offset" : undefined}>
                {isProductEditor ? (
                  <>
                    <div className="text-center py-4 text-[10px] font-bold tracking-widest uppercase text-amber-700/80">
                      Product page sections
                    </div>
                    {renderAddMenu(0, "page")}
                    {pageBlocks.map((block, index) => (
                      <React.Fragment key={block.id}>
                        {renderProductBlockSection(block)}
                        {renderAddMenu(index + 1, "page")}
                      </React.Fragment>
                    ))}
                  </>
                ) : (
                  <>
                <div className="text-center py-2 text-[10px] font-bold tracking-widest uppercase text-blue-600/80">Global sections (every page)</div>
                {renderAddMenu(0, "global")}
                {globalBlocks.map((block, index) => (
                  <React.Fragment key={block.id}>
                    {renderBlockSection(block, true)}
                    {renderAddMenu(index + 1, "global")}
                  </React.Fragment>
                ))}

                <div className="text-center py-4 text-[10px] font-bold tracking-widest uppercase text-green-700/80 border-t border-dashed border-gray-200 mt-4">
                  Page: {currentPage.title}
                </div>
                {renderAddMenu(0, "page")}
                {pageBlocks.length === 0 ? (
                  <div className="py-16 text-center text-sm text-gray-400">
                    This page is blank. Add sections below — only header, footer, and global blocks will show until you publish content here.
                  </div>
                ) : null}
                {pageBlocks.map((block, index) => (
                  <React.Fragment key={block.id}>
                    {renderBlockSection(block, false)}
                    {renderAddMenu(index + 1, "page")}
                  </React.Fragment>
                ))}
                  </>
                )}
              </main>

              {renderAddMenu(0, "post")}
              {postContentBlocks.map((block, index) => (
                <React.Fragment key={block.id}>
                  {renderInsertBlockSection(block)}
                  {renderAddMenu(index + 1, "post")}
                </React.Fragment>
              ))}

              <EditableSection id="footer" label="Footer" global selected={selectedId === "footer"} onSelect={setSelectedId}>
                <Footer cms={footerCms} />
              </EditableSection>
            </div>
          </div>

          <aside className="w-full lg:w-[440px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col overflow-hidden max-h-[45vh] lg:max-h-none" style={{ background: "#0B0B0B" }}>
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white/70">
              <Layers size={14} /> Page structure
            </div>

            <div className="overflow-y-auto flex-1">
              <div className="p-2 space-y-0.5">
                {editorSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setSelectedId(section.id)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{
                      background: selectedId === section.id ? "rgba(34,197,94,0.15)" : "transparent",
                      color: selectedId === section.id ? "#86efac" : "rgba(255,255,255,0.75)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {section.label}
                  </button>
                ))}
              </div>

              <div className="px-4 py-3 border-t border-white/10">
                <div className="text-xs font-bold tracking-widest uppercase text-white/50 mb-3">Edit section</div>
                {selectedBlockInfo && selectedSection?.block ? (
                  <label className="flex items-center gap-2 mb-4 text-xs text-white/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedBlockInfo.isGlobal}
                      onChange={(e) => toggleBlockGlobal(selectedSection.block!.id, e.target.checked)}
                    />
                    Show on all pages (global)
                  </label>
                ) : null}
                {error ? <div className="text-xs text-red-300 mb-2">{error}</div> : null}
                {selectedId === "site-css" ? (
                  <>
                    <p className="text-xs text-white/60 mb-3">
                      Extra CSS loaded on <b className="text-emerald-300">every page</b>. Use for fonts, variables, or shared overrides so new pages keep the same look.
                    </p>
                    <Field label="Site-wide CSS">
                      <TextArea
                        value={siteConfig.globalCss || ""}
                        onChange={(v) => setSiteConfig((s) => ({ ...s, globalCss: v }))}
                        rows={12}
                        mono
                        placeholder={"/* e.g.\n:root { --brand: #FFCC00; }\nbody { font-family: sans-serif; } */"}
                      />
                    </Field>
                  </>
                ) : activeCmsKey && activeCmsKey !== "__site_css__" ? (
                  renderSectionFields(activeCmsKey, activeData, patchSection, handleUpload, selectedSection?.block, elementUi)
                ) : selectedSection?.block ? (
                  renderSectionFields("", selectedSection.block.props || {}, patchSection, handleUpload, selectedSection.block, elementUi)
                ) : (
                  <p className="text-xs text-white/50">Select a section to edit its content.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
