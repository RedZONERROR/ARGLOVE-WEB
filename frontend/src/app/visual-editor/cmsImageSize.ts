import type { CSSProperties } from "react";

export type CmsImageSize = {
  width?: string;
  height?: string;
  objectFit?: CSSProperties["objectFit"];
};

export const OBJECT_FIT_OPTIONS: { value: string; label: string }[] = [
  { value: "cover", label: "Cover (crop to fill)" },
  { value: "contain", label: "Contain (fit inside)" },
  { value: "fill", label: "Fill (stretch)" },
  { value: "none", label: "None (original size)" },
  { value: "scale-down", label: "Scale down" },
];

/** Derive width/height/objectFit CMS keys from an image field key */
export function imageSizeKeys(fieldKey: string) {
  const prefix = fieldKey.endsWith("Url") ? fieldKey.slice(0, -3) : fieldKey;
  return {
    widthKey: `${prefix}Width`,
    heightKey: `${prefix}Height`,
    objectFitKey: `${prefix}ObjectFit`,
  };
}

export function readImageSize(data: Record<string, any> | undefined, fieldKey: string): CmsImageSize {
  if (!data) return {};
  const { widthKey, heightKey, objectFitKey } = imageSizeKeys(fieldKey);
  return {
    width: data[widthKey] ? String(data[widthKey]) : undefined,
    height: data[heightKey] ? String(data[heightKey]) : undefined,
    objectFit: data[objectFitKey] ? (String(data[objectFitKey]) as CmsImageSize["objectFit"]) : undefined,
  };
}

export function writeImageSizePatch(fieldKey: string, patch: Partial<CmsImageSize>): Record<string, string> {
  const { widthKey, heightKey, objectFitKey } = imageSizeKeys(fieldKey);
  const out: Record<string, string> = {};
  if (patch.width !== undefined) out[widthKey] = patch.width;
  if (patch.height !== undefined) out[heightKey] = patch.height;
  if (patch.objectFit !== undefined) out[objectFitKey] = String(patch.objectFit);
  return out;
}

export function buildImageStyle(size?: CmsImageSize, defaults?: CmsImageSize): CSSProperties {
  const style: CSSProperties = {
    objectFit: (size?.objectFit || defaults?.objectFit || "cover") as CSSProperties["objectFit"],
  };
  const width = size?.width || defaults?.width;
  const height = size?.height || defaults?.height;
  if (width) style.width = width;
  if (height) style.height = height;
  if (!width && !defaults?.width) style.maxWidth = "100%";
  return style;
}

export function readPropImageSize(props?: Record<string, any>): CmsImageSize {
  if (!props) return {};
  return {
    width: props.width ? String(props.width) : undefined,
    height: props.height ? String(props.height) : undefined,
    objectFit: props.objectFit ? (String(props.objectFit) as CmsImageSize["objectFit"]) : undefined,
  };
}
