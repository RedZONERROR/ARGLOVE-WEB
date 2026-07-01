import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  ShoppingCart,
  Star,
  Tag,
  Users,
  Plus,
  Pencil,
  Archive,
  RefreshCw,
  X,
  ExternalLink,
  Check,
  XCircle,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  api,
  AdminOrder,
  AdminProduct,
  AdminPromo,
  AdminReview,
  AdminUser,
  ProductFormData,
  PromoFormData,
} from "../services/api";
import ProductEditor from "./ProductEditor";
import { formatOrderStatus } from "../utils/orderUtils";
import { plainTextLabel } from "../utils/plainText";
import { useAuth } from "../context/AuthContext";
import { spaNavigateClick } from "../utils/spaNavigate";

type Tab = "dashboard" | "products" | "orders" | "coupons" | "users" | "reviews";

const inputCls =
  "w-full rounded-xl px-3 py-2.5 text-sm border border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50";
const btnPrimary =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-none";
const btnGhost =
  "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer border border-white/10 bg-white/5 text-white/80";

function fmtMoney(n: number | string) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    pending: "#f59e0b",
    processing: "#3b82f6",
    completed: "#22c55e",
    cancelled: "#ef4444",
    refunded: "#9333ea",
  };
  return map[status] || "#94a3b8";
}

const emptyProduct: ProductFormData = {
  name: "",
  description: "",
  regular_price: 0,
  discount_price: null,
  stock_quantity: 0,
  category_id: null,
  is_published: true,
};

const emptyPromo: PromoFormData = {
  code: "",
  discount_type: "percentage",
  discount_value: 10,
  expiry_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
};

export default function AdminPanel() {
  const { user, setUser, isAuthenticated, authReady } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const refreshPendingReviews = useCallback(async () => {
    try {
      const data = await api.getAdminReviews("pending");
      setPendingReviewCount(data.reviews.length);
    } catch {
      setPendingReviewCount(0);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!authReady) return;
      if (!isAuthenticated) {
        setError("Login required. Sign in on the store, then open the admin panel.");
        setLoading(false);
        return;
      }
      try {
        const profile = await api.getProfile();
        setUser(profile.user);
        if (profile.user?.role === "admin") {
          await refreshPendingReviews();
        }
      } catch (e: any) {
        setError(e?.message || "Login required.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, authReady, setUser, refreshPendingReviews]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [tab]);

  const isAllowed = user?.role === "admin";

  if (loading || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0B0B0B", color: "#fff" }}>
        Loading admin…
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{ background: "#0B0B0B", color: "#fff" }}>
        <p className="text-white/70">{error || "Please log in as admin."}</p>
        <a href="/" onClick={(e) => spaNavigateClick(e, "/")} className="text-amber-400 underline">← Back to store</a>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{ background: "#0B0B0B", color: "#fff" }}>
        <p>Admin access required. Set your account role to <b>admin</b> in the database.</p>
        <p className="text-sm text-white/50">Logged in as {user.email} ({user.role})</p>
        <a href="/" onClick={(e) => spaNavigateClick(e, "/")} className="text-amber-400 underline">← Back to store</a>
      </div>
    );
  }

  const nav: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { id: "products", label: "Products", icon: <Package size={18} /> },
    { id: "orders", label: "Orders", icon: <ShoppingCart size={18} /> },
    { id: "coupons", label: "Coupons", icon: <Tag size={18} /> },
    { id: "reviews", label: "Reviews", icon: <MessageSquare size={18} /> },
    { id: "users", label: "Users", icon: <Users size={18} /> },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "#0B0B0B", color: "#fff", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Toaster position="top-center" />

      {mobileNavOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-56 shrink-0 flex flex-col border-r border-white/10 transition-transform duration-200 md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "#111" }}
      >
        <div className="p-4 border-b border-white/10">
          <div className="font-bold text-sm tracking-wide">ARGLOVE Admin</div>
          <div className="text-[10px] text-white/40 mt-1 truncate">{user.email}</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left"
              style={{
                background: tab === n.id ? "rgba(255,204,0,0.15)" : "transparent",
                color: tab === n.id ? "#FFCC00" : "rgba(255,255,255,0.7)",
                border: tab === n.id ? "1px solid rgba(255,204,0,0.25)" : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              {n.icon}
              {n.label}
              {n.id === "reviews" && pendingReviewCount > 0 ? (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#f59e0b", color: "#1A1A1A" }}>
                  {pendingReviewCount}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-2">
          <a href="/cms" onClick={(e) => spaNavigateClick(e, "/cms")} className="flex items-center gap-2 text-xs text-emerald-400 hover:underline px-2">
            <ExternalLink size={12} /> Edit website (CMS)
          </a>
          <a href="/" onClick={(e) => spaNavigateClick(e, "/")} className="flex items-center gap-2 text-xs text-white/50 hover:text-white px-2">
            <ArrowLeft size={12} /> Back to store
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        <header className="sticky top-0 z-10 px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3" style={{ background: "rgba(11,11,11,0.95)", backdropFilter: "blur(8px)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden p-2 rounded-lg border border-white/10 bg-white/5 cursor-pointer shrink-0"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-lg font-bold capitalize truncate">
              {tab === "coupons" ? "Coupon codes" : tab === "reviews" ? "Review moderation" : tab}
            </h1>
          </div>
        </header>
        <div className="p-4 sm:p-6 max-w-6xl">
          {tab === "dashboard" && <DashboardView />}
          {tab === "products" && <ProductsView />}
          {tab === "orders" && <OrdersView />}
          {tab === "coupons" && <CouponsView />}
          {tab === "users" && <UsersView currentUserId={user.id} />}
          {tab === "reviews" && <ReviewsView onPendingChange={refreshPendingReviews} />}
        </div>
      </main>
    </div>
  );
}

function DashboardView() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMetrics(await api.getAdminDashboard());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-white/50">Loading metrics…</p>;
  if (!metrics) return null;

  const cards = [
    { label: "Total revenue", value: fmtMoney(metrics.total_revenue), icon: <BarChart3 size={20} /> },
    { label: "Customers", value: metrics.total_customers, icon: <Users size={20} /> },
    { label: "Pending orders", value: metrics.order_stats?.pending || 0, icon: <ShoppingCart size={20} /> },
    { label: "Completed orders", value: metrics.order_stats?.completed || 0, icon: <Package size={20} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button type="button" onClick={load} className={btnGhost}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl p-5 border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="flex items-center gap-2 text-white/40 mb-2">{c.icon}<span className="text-xs font-semibold uppercase tracking-wider">{c.label}</span></div>
            <div className="text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>{c.value}</div>
          </div>
        ))}
      </div>

      {metrics.low_stock_alerts?.length > 0 && (
        <div className="rounded-2xl p-5 border border-amber-500/30" style={{ background: "rgba(245,158,11,0.08)" }}>
          <h3 className="font-bold text-amber-300 mb-3">Low stock alerts</h3>
          <ul className="space-y-2 text-sm">
            {metrics.low_stock_alerts.map((p: any) => (
              <li key={p.id} className="flex justify-between"><span className="line-clamp-1">{plainTextLabel(p.name, 60)}</span><span className="text-amber-300">{p.stock_quantity} left</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl p-5 border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
        <h3 className="font-bold mb-3">Recent activity</h3>
        <ul className="space-y-2 text-sm text-white/70">
          {(metrics.recent_logs || []).map((log: any) => (
            <li key={log.id} className="flex justify-between gap-4 border-b border-white/5 pb-2">
              <span>{log.action}</span>
              <span className="text-white/40 shrink-0">{fmtDate(log.created_at)}</span>
            </li>
          ))}
          {(!metrics.recent_logs || metrics.recent_logs.length === 0) && <li className="text-white/40">No recent activity</li>}
        </ul>
      </div>
    </div>
  );
}

function ProductsView() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<ProductFormData>(emptyProduct);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", slug: "" });
  const [showCatForm, setShowCatForm] = useState(false);
  const [editorId, setEditorId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([api.getAdminProducts(), api.getCategories()]);
      setProducts(prods);
      setCategories(cats);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm(emptyProduct);
    setEditId(null);
    setModal("create");
  };

  const openEdit = (p: AdminProduct) => {
    setForm({
      name: p.name,
      description: p.description,
      regular_price: parseFloat(p.regular_price),
      discount_price: p.discount_price ? parseFloat(p.discount_price) : null,
      stock_quantity: p.stock_quantity,
      category_id: p.category_id,
      is_published: !!p.is_published,
    });
    setEditId(p.id);
    setModal("edit");
  };

  const save = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      toast.error("Name and description are required");
      return;
    }
    setSaving(true);
    try {
      if (modal === "create") {
        const created = await api.createProduct(form);
        toast.success("Product created");
        setModal(null);
        setEditorId(created.id);
      } else if (editId) {
        await api.updateProduct(editId, form);
        toast.success("Product updated");
      }
      setModal(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id: number) => {
    if (!confirm("Archive this product? It will be hidden from the store.")) return;
    try {
      await api.archiveProduct(id);
      toast.success("Product archived");
      load();
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const restore = async (p: AdminProduct) => {
    try {
      await api.updateProduct(p.id, {
        name: p.name,
        description: p.description,
        regular_price: parseFloat(p.regular_price),
        discount_price: p.discount_price ? parseFloat(p.discount_price) : null,
        stock_quantity: p.stock_quantity,
        category_id: p.category_id,
        is_published: true,
      });
      toast.success("Product restored");
      load();
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const uploadThumb = async (productId: number, file: File) => {
    try {
      await api.uploadResource(file, "Product", productId, "thumbnail");
      toast.success("Image uploaded");
      load();
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const saveCategory = async () => {
    if (!catForm.name || !catForm.slug) return toast.error("Name and slug required");
    try {
      await api.createCategory(catForm);
      toast.success("Category created");
      setCatForm({ name: "", slug: "" });
      setShowCatForm(false);
      load();
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between">
        <button type="button" onClick={openCreate} className={btnPrimary} style={{ background: "#FFCC00", color: "#1A1A1A" }}>
          <Plus size={16} /> New product
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowCatForm(!showCatForm)} className={btnGhost}>+ Category</button>
          <button type="button" onClick={load} className={btnGhost}><RefreshCw size={14} /></button>
        </div>
      </div>

      {showCatForm && (
        <div className="rounded-2xl p-4 border border-white/10 grid grid-cols-2 gap-3" style={{ background: "rgba(255,255,255,0.03)" }}>
          <input className={inputCls} placeholder="Category name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} />
          <input className={inputCls} placeholder="slug" value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} />
          <button type="button" onClick={saveCategory} className={btnPrimary} style={{ background: "#FFCC00", color: "#1A1A1A" }}>Save category</button>
        </div>
      )}

      {loading ? <p className="text-white/50">Loading…</p> : (
        <div className="rounded-2xl border border-white/10 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.04)" }}>
                <th className="p-3">Product</th>
                <th className="p-3">Price</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/20"><Package size={16} /></div>
                      )}
                      <div>
                        <div className="font-semibold line-clamp-2">{plainTextLabel(p.name, 80)}</div>
                        <div className="text-xs text-white/40">{p.category_name || "Uncategorized"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    {fmtMoney(p.discount_price || p.regular_price)}
                    {p.discount_price && <span className="text-xs text-white/40 line-through ml-1">{fmtMoney(p.regular_price)}</span>}
                  </td>
                  <td className="p-3">{p.stock_quantity}</td>
                  <td className="p-3">
                    <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: p.is_published ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: p.is_published ? "#4ade80" : "#f87171" }}>
                      {p.is_published ? "Live" : "Archived"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => setEditorId(p.id)} className={btnGhost} title="Full editor">Manage</button>
                      <button type="button" onClick={() => openEdit(p)} className={btnGhost}><Pencil size={12} /></button>
                      <label className={btnGhost + " cursor-pointer"}>
                        📷
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadThumb(p.id, f); e.target.value = ""; }} />
                      </label>
                      {p.is_published ? (
                        <button type="button" onClick={() => archive(p.id)} className={btnGhost} title="Archive"><Archive size={12} /></button>
                      ) : (
                        <button type="button" onClick={() => restore(p)} className={btnGhost} title="Restore"><RefreshCw size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <p className="p-6 text-center text-white/40">No products yet</p>}
        </div>
      )}

      {editorId ? (
        <ProductEditor
          productId={editorId}
          categories={categories}
          onClose={() => setEditorId(null)}
          onSaved={load}
        />
      ) : null}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: "#161616" }}>
            <div className="flex justify-between items-center">
              <h2 className="font-bold">{modal === "create" ? "New product" : "Edit product"}</h2>
              <button type="button" onClick={() => setModal(null)} className="text-white/50 hover:text-white"><X size={20} /></button>
            </div>
            <input className={inputCls} placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <textarea className={inputCls + " min-h-[80px]"} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} type="number" placeholder="Regular price (₹)" value={form.regular_price || ""} onChange={(e) => setForm({ ...form, regular_price: parseFloat(e.target.value) || 0 })} />
              <input className={inputCls} type="number" placeholder="Sale price (optional)" value={form.discount_price ?? ""} onChange={(e) => setForm({ ...form, discount_price: e.target.value ? parseFloat(e.target.value) : null })} />
              <input className={inputCls} type="number" placeholder="Stock qty" value={form.stock_quantity || ""} onChange={(e) => setForm({ ...form, stock_quantity: parseInt(e.target.value, 10) || 0 })} />
              <select className={inputCls} value={form.category_id ?? ""} onChange={(e) => setForm({ ...form, category_id: e.target.value ? parseInt(e.target.value, 10) : null })}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_published !== false} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
              Published (visible on store)
            </label>
            <button type="button" disabled={saving} onClick={save} className={btnPrimary + " w-full justify-center"} style={{ background: "#FFCC00", color: "#1A1A1A" }}>
              {saving ? "Saving…" : "Save product"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersView() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await api.getAdminOrders());
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: number) => {
    try {
      setDetail(await api.getAdminOrder(id));
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const result = await api.updateOrderStatus(id, status);
      const finalStatus = result.status || status;
      if (result.refund?.refund_id) {
        toast.success(`Order #${id} refunded via Razorpay (${result.refund.refund_id})`);
      } else {
        toast.success(`Order #${id} → ${formatOrderStatus(finalStatus)}`);
      }
      load();
      if (detail?.order?.id === id) openDetail(id);
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const markDelivered = (id: number) => updateStatus(id, "completed");

  const cancelAndRefund = async (id: number) => {
    if (!confirm("Cancel this order and refund payment via Razorpay?")) return;
    try {
      const result = await api.refundOrder(id);
      toast.success(`Refund processed: ${result.refund?.refund_id || "OK"}`);
      load();
      if (detail?.order?.id === id) openDetail(id);
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["all", "pending", "processing", "completed", "cancelled", "refunded"].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={btnGhost} style={{ background: filter === s ? "rgba(255,204,0,0.15)" : undefined, color: filter === s ? "#FFCC00" : undefined }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button type="button" onClick={load} className={btnGhost}><RefreshCw size={14} /></button>
      </div>

      {loading ? <p className="text-white/50">Loading…</p> : (
        <div className="rounded-2xl border border-white/10 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.04)" }}>
                <th className="p-3">Order</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Total</th>
                <th className="p-3">Razorpay Txn</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="p-3 font-semibold">#{o.id}</td>
                  <td className="p-3 text-white/70">{o.user_email}</td>
                  <td className="p-3">{fmtMoney(o.total_amount)}</td>
                  <td className="p-3 text-[10px] font-mono text-white/50 max-w-[140px] truncate" title={o.razorpay_payment_id || o.razorpay_order_id || ""}>
                    {o.razorpay_payment_id || o.razorpay_order_id || "—"}
                  </td>
                  <td className="p-3">
                    <select
                      value={o.status}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      className="text-xs font-bold rounded-lg px-2 py-1 border-none cursor-pointer"
                      style={{ background: `${statusColor(o.status)}22`, color: statusColor(o.status) }}
                    >
                      {["pending", "processing", "completed", "cancelled", "refunded"].map((s) => (
                        <option key={s} value={s}>{formatOrderStatus(s)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-white/50 text-xs">{fmtDate(o.created_at)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => openDetail(o.id)} className={btnGhost}>View</button>
                      {o.status === "processing" ? (
                        <button type="button" onClick={() => markDelivered(o.id)} className={btnGhost} style={{ color: "#4ade80" }}>Deliver</button>
                      ) : null}
                      {["processing", "completed"].includes(o.status) ? (
                        <button type="button" onClick={() => cancelAndRefund(o.id)} className={btnGhost} style={{ color: "#f87171" }}>Refund</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-6 text-center text-white/40">No orders</p>}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: "#161616" }}>
            <div className="flex justify-between items-center">
              <h2 className="font-bold">Order #{detail.order.id}</h2>
              <button type="button" onClick={() => setDetail(null)} className="text-white/50"><X size={20} /></button>
            </div>
            <div className="text-sm space-y-1 text-white/70">
              <p><b>Customer:</b> {detail.order.user_email}</p>
              <p><b>Total:</b> {fmtMoney(detail.order.total_amount)}</p>
              <p><b>Status:</b> <span style={{ color: statusColor(detail.order.status) }}>{formatOrderStatus(detail.order.status)}</span></p>
              <p><b>Shipping:</b> {detail.order.shipping_address}</p>
              {detail.order.razorpay_order_id ? <p><b>Razorpay Order ID:</b> <span className="font-mono text-xs">{detail.order.razorpay_order_id}</span></p> : null}
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase text-white/40 mb-2">Items</h3>
              <ul className="space-y-2 text-sm">
                {detail.items?.map((it: any, i: number) => (
                  <li key={i} className="flex justify-between border-b border-white/5 pb-2">
                    <span>{plainTextLabel(it.name, 100)} × {it.quantity}</span>
                    <span>{fmtMoney(it.price_at_purchase)}</span>
                  </li>
                ))}
              </ul>
            </div>
            {detail.payments?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase text-white/40 mb-2">Razorpay Payments</h3>
                {detail.payments.map((pay: any) => (
                  <div key={pay.id} className="text-sm text-white/60 space-y-1 mb-2 p-2 rounded-lg bg-white/5">
                    <div><b>Payment ID:</b> <span className="font-mono text-xs">{pay.razorpay_payment_id || "—"}</span></div>
                    <div><b>Order ID:</b> <span className="font-mono text-xs">{pay.razorpay_order_id || "—"}</span></div>
                    {pay.razorpay_refund_id ? <div><b>Refund ID:</b> <span className="font-mono text-xs text-purple-300">{pay.razorpay_refund_id}</span></div> : null}
                    <div>{pay.status} — {fmtMoney(pay.amount)} ({pay.payment_method || "razorpay"})</div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {detail.order.status === "processing" ? (
                <button type="button" onClick={() => { markDelivered(detail.order.id); }} className={btnPrimary} style={{ background: "#22c55e", color: "#fff" }}>Mark Delivered</button>
              ) : null}
              {["processing", "completed"].includes(detail.order.status) ? (
                <button type="button" onClick={() => { cancelAndRefund(detail.order.id); }} className={btnPrimary} style={{ background: "#ef4444", color: "#fff" }}>Cancel & Refund</button>
              ) : null}
              {detail.order.status === "pending" ? (
                <button type="button" onClick={() => { updateStatus(detail.order.id, "cancelled"); }} className={btnPrimary} style={{ background: "#64748b", color: "#fff" }}>Cancel Order</button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CouponsView() {
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<PromoFormData>(emptyPromo);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPromos(await api.getAdminPromos());
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ ...emptyPromo, expiry_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16) });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (p: AdminPromo) => {
    setForm({
      code: p.code,
      discount_type: p.discount_type,
      discount_value: parseFloat(p.discount_value),
      expiry_date: p.expiry_date.slice(0, 16),
    });
    setEditId(p.id);
    setModal(true);
  };

  const save = async () => {
    if (!form.code.trim()) return toast.error("Code required");
    setSaving(true);
    try {
      const payload = { ...form, expiry_date: new Date(form.expiry_date).toISOString() };
      if (editId) await api.updatePromo(editId, payload);
      else await api.createPromo(payload);
      toast.success(editId ? "Coupon updated" : "Coupon created");
      setModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this coupon?")) return;
    try {
      await api.deletePromo(id);
      toast.success("Deleted");
      load();
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const isExpired = (d: string) => new Date(d) < new Date();

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" onClick={openCreate} className={btnPrimary} style={{ background: "#FFCC00", color: "#1A1A1A" }}><Plus size={16} /> New coupon</button>
        <button type="button" onClick={load} className={btnGhost}><RefreshCw size={14} /></button>
      </div>

      {loading ? <p className="text-white/50">Loading…</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {promos.map((p) => (
            <div key={p.id} className="rounded-2xl p-4 border border-white/10 flex justify-between items-start" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div>
                <div className="font-bold text-lg tracking-wider" style={{ color: "#FFCC00" }}>{p.code}</div>
                <div className="text-sm text-white/60 mt-1">
                  {p.discount_type === "percentage" ? `${p.discount_value}% off` : `${fmtMoney(p.discount_value)} off`}
                </div>
                <div className="text-xs text-white/40 mt-2">
                  Expires {fmtDate(p.expiry_date)} · Used {p.usage_count || 0}×
                </div>
                {isExpired(p.expiry_date) && <span className="text-xs text-red-400 font-bold">EXPIRED</span>}
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => openEdit(p)} className={btnGhost}><Pencil size={12} /></button>
                <button type="button" onClick={() => remove(p.id)} className={btnGhost}><X size={12} /></button>
              </div>
            </div>
          ))}
          {promos.length === 0 && <p className="text-white/40 col-span-2 text-center py-8">No coupon codes yet</p>}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-4" style={{ background: "#161616" }}>
            <div className="flex justify-between items-center">
              <h2 className="font-bold">{editId ? "Edit coupon" : "New coupon"}</h2>
              <button type="button" onClick={() => setModal(false)} className="text-white/50"><X size={20} /></button>
            </div>
            <input className={inputCls} placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <div className="grid grid-cols-2 gap-3">
              <select className={inputCls} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as any })}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount (₹)</option>
              </select>
              <input className={inputCls} type="number" placeholder="Value" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })} />
            </div>
            <input className={inputCls} type="datetime-local" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            <button type="button" disabled={saving} onClick={save} className={btnPrimary + " w-full justify-center"} style={{ background: "#FFCC00", color: "#1A1A1A" }}>
              {saving ? "Saving…" : "Save coupon"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersView({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await api.getAdminUsers());
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (u: AdminUser) => {
    try {
      await api.toggleUserStatus(u.id, !u.is_active);
      toast.success(u.is_active ? "User deactivated" : "User activated");
      load();
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const changeRole = async (u: AdminUser, role: string) => {
    try {
      await api.updateUserRole(u.id, role);
      toast.success("Role updated");
      load();
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button type="button" onClick={load} className={btnGhost}><RefreshCw size={14} /></button></div>
      {loading ? <p className="text-white/50">Loading…</p> : (
        <div className="rounded-2xl border border-white/10 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.04)" }}>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Joined</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="p-3">{u.email}{u.id === currentUserId && <span className="text-xs text-amber-400 ml-2">(you)</span>}</td>
                  <td className="p-3">
                    <select
                      value={u.role}
                      disabled={u.id === currentUserId}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className={inputCls + " !py-1 !text-xs w-auto"}
                    >
                      <option value="customer">customer</option>
                      <option value="editor">editor</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-bold" style={{ color: u.is_active ? "#4ade80" : "#f87171" }}>{u.is_active ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="p-3 text-white/50 text-xs">{fmtDate(u.created_at)}</td>
                  <td className="p-3">
                    {u.id !== currentUserId && (
                      <button type="button" onClick={() => toggleActive(u)} className={btnGhost}>
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function reviewStatusStyle(status: AdminReview["status"]) {
  if (status === "approved") return { bg: "rgba(34,197,94,0.2)", color: "#4ade80" };
  if (status === "rejected") return { bg: "rgba(239,68,68,0.2)", color: "#f87171" };
  return { bg: "rgba(245,158,11,0.2)", color: "#fbbf24" };
}

function ReviewsView({ onPendingChange }: { onPendingChange: () => Promise<void> }) {
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminReviews(filter === "all" ? undefined : filter);
      setReviews(data.reviews);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: number, status: "approved" | "rejected") => {
    try {
      await api.moderateReview(id, status);
      toast.success(status === "approved" ? "Review approved — now visible on the store" : "Review rejected");
      await load();
      await onPendingChange();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update review");
    }
  };

  const filters: { id: typeof filter; label: string }[] = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        Approve reviews to show them on product pages. Only <b className="text-white/70">approved</b> reviews appear in the store UI and rating counts.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: filter === f.id ? "rgba(255,204,0,0.18)" : "rgba(255,255,255,0.06)",
              color: filter === f.id ? "#FFCC00" : "rgba(255,255,255,0.65)",
              border: `1px solid ${filter === f.id ? "rgba(255,204,0,0.35)" : "rgba(255,255,255,0.1)"}`,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
        <button type="button" onClick={load} className={btnGhost + " ml-auto"}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-white/50">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-8 text-center text-white/45 text-sm" style={{ background: "rgba(255,255,255,0.03)" }}>
          No {filter === "all" ? "" : filter} reviews.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const st = reviewStatusStyle(r.status);
            return (
              <div
                key={r.id}
                className="rounded-2xl border border-white/10 p-4"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-sm font-semibold">
                        <Star size={14} className="text-amber-400" fill="#fbbf24" />
                        {r.rating}/5
                      </span>
                      <span className="text-sm text-white/80">{r.reviewer_name}</span>
                      <span className="text-xs text-white/40">{r.reviewer_email}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-white/45 mt-1">
                      {r.product_name} · {fmtDate(r.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {r.status !== "approved" ? (
                      <button
                        type="button"
                        onClick={() => setStatus(r.id, "approved")}
                        className={btnGhost + " !text-emerald-400 !border-emerald-500/30"}
                      >
                        <Check size={14} /> Accept
                      </button>
                    ) : null}
                    {r.status !== "rejected" ? (
                      <button
                        type="button"
                        onClick={() => setStatus(r.id, "rejected")}
                        className={btnGhost + " !text-red-400 !border-red-500/30"}
                      >
                        <XCircle size={14} /> Deny
                      </button>
                    ) : null}
                  </div>
                </div>
                {r.title ? <p className="text-sm font-semibold text-white/85 mb-1">{r.title}</p> : null}
                <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{r.body}</p>
                <a
                  href={`/product/${r.product_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-3 text-xs text-amber-400 hover:underline"
                >
                  View product page ↗
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
