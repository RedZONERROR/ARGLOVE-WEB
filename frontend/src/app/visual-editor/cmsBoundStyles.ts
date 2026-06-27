import type React from "react";

export type TextStyle = {
  color?: string;
  fontSize?: string;
  bold?: boolean;
};

export function boundStyleStorageKey(fieldKey: string): string {
  return `${fieldKey}Style`;
}

export function readBoundFieldStyle(data: Record<string, any>, fieldKey: string): TextStyle {
  const raw = data?.[boundStyleStorageKey(fieldKey)];
  if (!raw || typeof raw !== "object") return {};
  return {
    color: raw.color ? String(raw.color) : undefined,
    fontSize: raw.fontSize ? String(raw.fontSize) : undefined,
    bold: Boolean(raw.bold),
  };
}

export function patchBoundFieldStyle(fieldKey: string, patch: Partial<TextStyle>, data: Record<string, any>): Record<string, any> {
  const prev = readBoundFieldStyle(data, fieldKey);
  return {
    [boundStyleStorageKey(fieldKey)]: { ...prev, ...patch },
  };
}

export function textStyleToCss(style: TextStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (style.color) css.color = style.color;
  if (style.fontSize) css.fontSize = style.fontSize;
  if (style.bold) css.fontWeight = 700;
  return css;
}

export function mergeBoundTextStyle(
  base: React.CSSProperties,
  data: Record<string, any>,
  fieldKey: string
): React.CSSProperties {
  return { ...base, ...textStyleToCss(readBoundFieldStyle(data, fieldKey)) };
}
