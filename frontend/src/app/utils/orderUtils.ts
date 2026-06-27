import { plainTextFromHtml } from "./plainText";

export type AppliedPromo = {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
};

export function formatOrderStatus(status: string, paymentStatus?: string | null): string {
  if (status === 'refunded' || paymentStatus === 'refunded') return 'Refunded';
  const map: Record<string, string> = {
    pending: "Payment Pending",
    processing: "Order Placed",
    completed: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };
  return map[status] || status.replace(/_/g, " ");
}

export function orderStatusColor(status: string, paymentStatus?: string | null): string {
  if (status === 'refunded' || paymentStatus === 'refunded') return '#9333ea';
  const map: Record<string, string> = {
    pending: "#f59e0b",
    processing: "#16a34a",
    completed: "#2563eb",
    cancelled: "#ef4444",
    refunded: "#9333ea",
  };
  return map[status] || "#d97706";
}

export function calcPromoDiscount(subtotal: number, promo: AppliedPromo): number {
  if (promo.discount_type === "percentage") {
    return Math.round(subtotal * (promo.discount_value / 100));
  }
  return Math.min(promo.discount_value, subtotal);
}

export function downloadOrderInvoice(order: {
  id: number;
  total_amount: string | number;
  status: string;
  created_at: string;
  shipping_address?: string;
  promo_code?: string | null;
  razorpay_payment_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_refund_id?: string | null;
  payment_status?: string | null;
  items?: { name: string; quantity: number; price_at_purchase: string | number }[];
}, userEmail: string) {
  const items = order.items || [];
  const subtotal = items.reduce(
    (sum, it) => sum + parseFloat(String(it.price_at_purchase)) * it.quantity,
    0
  );
  const total = parseFloat(String(order.total_amount));
  const rows = items
    .map(
      (it) =>
        `<tr><td>${esc(plainTextFromHtml(it.name))}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">₹${fmt(it.price_at_purchase)}</td><td style="text-align:right">₹${fmt(parseFloat(String(it.price_at_purchase)) * it.quantity)}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>ARGLOVE Invoice #${order.id}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; max-width: 720px; margin: 40px auto; color: #1a1a1a; }
  h1 { font-size: 28px; letter-spacing: 0.15em; margin: 0; }
  .sub { color: #888; font-size: 12px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px; }
  th, td { border-bottom: 1px solid #eee; padding: 10px 8px; text-align: left; }
  th { background: #fff9e6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
  .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 16px; }
  .meta { font-size: 12px; line-height: 1.7; color: #444; }
  @media print { body { margin: 20px; } }
</style></head><body>
  <h1>ARGLOVE</h1>
  <div class="sub">SKIN · Tax Invoice</div>
  <div class="meta" style="margin-top:24px">
    <strong>Invoice #:</strong> INV-${order.id}<br>
    <strong>Order #:</strong> ${order.id}<br>
    <strong>Date:</strong> ${new Date(order.created_at).toLocaleString("en-IN")}<br>
    <strong>Status:</strong> ${formatOrderStatus(order.status, order.payment_status)}<br>
    <strong>Customer:</strong> ${esc(userEmail)}<br>
    ${order.razorpay_order_id ? `<strong>Razorpay Order ID:</strong> ${esc(order.razorpay_order_id)}<br>` : ""}
    ${order.razorpay_payment_id ? `<strong>Razorpay Payment ID:</strong> ${esc(order.razorpay_payment_id)}<br>` : ""}
    ${order.razorpay_refund_id ? `<strong>Razorpay Refund ID:</strong> ${esc(order.razorpay_refund_id)}<br>` : ""}
    ${order.shipping_address ? `<strong>Ship to:</strong> ${esc(order.shipping_address)}<br>` : ""}
    ${order.promo_code ? `<strong>Coupon:</strong> ${esc(order.promo_code)}<br>` : ""}
  </div>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${subtotal !== total ? `<div style="text-align:right;font-size:13px;color:#666">Subtotal: ₹${fmt(subtotal)}</div>` : ""}
  <div class="total">Total: ₹${fmt(total)}</div>
  <p style="font-size:11px;color:#999;margin-top:32px">Thank you for shopping with ARGLOVE SKIN.</p>
</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ARGLOVE-Invoice-${order.id}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fmt(n: number | string) {
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
