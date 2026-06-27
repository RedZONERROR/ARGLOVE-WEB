import React from "react";
import { sanitizeCmsHtml } from "../utils/sanitizeHtml";

export { plainTextFromHtml, plainTextLabel } from "../utils/plainText";

export function isRichHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(String(value || "").trim());
}

type Props = {
  html: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  /** When true, renders inline (span) for use inside headings/labels with icons */
  inline?: boolean;
} & React.HTMLAttributes<HTMLElement>;

export default function RichTextContent({ html, as: Tag = "div", className, style, inline, ...rest }: Props) {
  const raw = String(html || "");
  const sanitized = sanitizeCmsHtml(raw);
  const rich = isRichHtml(sanitized);

  if (!rich) {
    if (inline) {
      return (
        <Tag className={className} style={style} {...rest}>
          {raw}
        </Tag>
      );
    }
    return (
      <Tag className={className} style={style} {...rest}>
        {raw.split("\n").map((line, i, arr) => (
          <React.Fragment key={i}>
            {line}
            {i < arr.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </Tag>
    );
  }

  const Wrapper = inline ? "span" : Tag;
  return (
    <Wrapper
      className={`cms-rich-text${className ? ` ${className}` : ""}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitized }}
      {...rest}
    />
  );
}
