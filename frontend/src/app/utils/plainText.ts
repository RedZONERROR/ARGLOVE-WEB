/** Strip HTML tags and collapse whitespace — for invoices, cart, labels, etc. */
export function plainTextFromHtml(value: string): string {
  const raw = String(value || "");
  if (!raw) return "";
  if (typeof document === "undefined") {
    return raw
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  }
  const div = document.createElement("div");
  div.innerHTML = raw;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

/** Plain label with optional max length (product cards, tables). */
export function plainTextLabel(value: string, maxLength = 120): string {
  const plain = plainTextFromHtml(value);
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trim()}…`;
}
