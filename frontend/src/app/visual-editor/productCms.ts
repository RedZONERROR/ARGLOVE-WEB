import type { HomeBlock } from "./cmsEditorFields";
import { formatProductImage } from "../utils/productImage";

export type ProductBlockType = "banner" | "product-main" | "html" | "image";

export function productContentKey(productId: number): string {
  return `product:${productId}`;
}

export function productEditorPath(productId: number): string {
  return `/cms/product/${productId}`;
}

export function productPublicPath(productId: number): string {
  return `/product/${productId}`;
}

export function parseProductEditorPath(pathname: string): number | null {
  const m = pathname.replace(/\/+$/, "").match(/^\/cms\/product\/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

export const DEFAULT_PRODUCT_BLOCKS: HomeBlock[] = [
  {
    id: "product-banner",
    type: "banner",
    props: {
      badge: "New",
      title: "",
      subtitle: "",
      imageUrl: "",
      bgColor: "#FFF9E6",
    },
  },
  { id: "product-main", type: "product-main", props: {} },
];

export const PRODUCT_BLOCK_LABELS: Record<string, string> = {
  banner: "Banner / hero",
  "product-main": "Product info (gallery & buy)",
  html: "Custom HTML/CSS",
  image: "Image block",
};

export const PRODUCT_ADD_BLOCK_TYPES = ["banner", "html", "image", "product-main"] as const;

export function normalizeProductBlocks(blocks?: HomeBlock[]): HomeBlock[] {
  if (!Array.isArray(blocks) || blocks.length === 0) return DEFAULT_PRODUCT_BLOCKS;
  const hasMain = blocks.some((b) => b.type === "product-main");
  return hasMain ? blocks : [...blocks, { id: "product-main", type: "product-main", props: {} }];
}

/** Fill empty banner fields from product data so the editor preview is not blank. */
export function enrichProductBlocksFromProduct(
  blocks: HomeBlock[],
  product: { name?: string; description?: string; long_description?: string; category_name?: string; key_benefits?: string[] },
  resources: { file_url?: string; file_role?: string; mime_type?: string }[] = []
): HomeBlock[] {
  const firstImage = resources.find(
    (r) => r.file_role !== "video" && !r.mime_type?.startsWith("video/")
  )?.file_url;

  return blocks.map((block) => {
    if (block.type === "banner") {
      const props = block.props || {};
      return {
        ...block,
        props: {
          ...props,
          badge: props.badge ?? "New",
          title: props.title || product.name || "",
          subtitle: props.subtitle || product.description || "",
          imageUrl: props.imageUrl || (firstImage ? formatProductImage(firstImage) : ""),
          bgColor: props.bgColor || "#FFF9E6",
          elements: props.elements ?? [],
        },
      };
    }

    if (block.type === "product-main") {
      const props = block.props || {};
      return {
        ...block,
        props: {
          ...props,
          name: props.name ?? product.name ?? "",
          shortDescription: props.shortDescription ?? product.description ?? "",
          longDescription: props.longDescription ?? product.long_description ?? product.description ?? "",
          keyBenefits: props.keyBenefits ?? product.key_benefits ?? [],
          categoryBadge: props.categoryBadge ?? product.category_name ?? "",
          ctaText: props.ctaText ?? "Add to cart",
          shippingNote: props.shippingNote ?? "Free shipping across India",
          elements: props.elements ?? [],
        },
      };
    }

    return block;
  });
}

export function getProductMainOverrides(blocks: HomeBlock[]): Record<string, any> {
  const main = blocks.find((b) => b.type === "product-main");
  return main?.props || {};
}
