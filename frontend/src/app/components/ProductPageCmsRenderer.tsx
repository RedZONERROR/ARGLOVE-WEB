import React from "react";
import type { HomeBlock } from "../visual-editor/cmsEditorFields";
import { CmsRawHtmlBlock } from "../visual-editor/CmsBlockView";
import { buildImageStyle, readPropImageSize } from "../visual-editor/cmsImageSize";
import ProductBannerBlock from "./ProductBannerBlock";
import { normalizeProductBlocks } from "../visual-editor/productCms";

type Props = {
  blocks: HomeBlock[];
  productMain: React.ReactNode;
};

function renderBlock(block: HomeBlock, productMain: React.ReactNode): React.ReactNode {
  switch (block.type) {
    case "banner":
      return <ProductBannerBlock key={block.id} blockId={block.id} props={block.props} />;
    case "html":
      return (
        <section key={block.id} className="px-8 py-10" style={{ background: "#FFF9E6" }}>
          <div className="max-w-5xl mx-auto">
            <CmsRawHtmlBlock block={block} />
          </div>
        </section>
      );
    case "image":
      if (!block.props?.src) return null;
      return (
        <section key={block.id} className="px-8 py-8" style={{ background: "#FFF9E6" }}>
          <div className="max-w-5xl mx-auto">
            <img
              src={String(block.props.src)}
              alt={String(block.props.alt || "")}
              style={{
                display: "block",
                ...buildImageStyle(readPropImageSize(block.props), { width: "100%", height: "auto", objectFit: "cover" }),
              }}
            />
          </div>
        </section>
      );
    case "product-main":
      return <React.Fragment key={block.id}>{productMain}</React.Fragment>;
    default:
      return null;
  }
}

export default function ProductPageCmsRenderer({ blocks, productMain }: Props) {
  const ordered = normalizeProductBlocks(blocks);
  return <>{ordered.map((block) => renderBlock(block, productMain))}</>;
}
