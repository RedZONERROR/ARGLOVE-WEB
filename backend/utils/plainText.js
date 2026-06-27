/** Strip HTML for cart, orders, invoices, emails, and admin lists. */
function plainTextFromHtml(value) {
  if (!value) return '';
  return String(value)
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function mapPlainItemNames(items) {
  return items.map((item) => ({
    ...item,
    name: plainTextFromHtml(item.name),
  }));
}

module.exports = { plainTextFromHtml, mapPlainItemNames };
