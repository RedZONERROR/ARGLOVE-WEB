import React, { useCallback, useEffect, useState } from "react";
import { X, Trash2, Upload, Video, Image as ImageIcon, Star } from "lucide-react";
import { toast } from "sonner";
import { spaNavigateClick } from "../utils/spaNavigate";
import { api, ProductFormData, ProductVariant } from "../services/api";

const inputCls =
  "w-full rounded-xl px-3 py-2.5 text-sm border border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50";
const btnPrimary =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-none";

type Props = {
  productId: number;
  categories: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
};

export default function ProductEditor({ productId, categories, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProductFormData>({
    name: "",
    description: "",
    long_description: "",
    key_benefits: [],
    regular_price: 0,
    discount_price: null,
    stock_quantity: 0,
    category_id: null,
    is_published: true,
  });
  const [benefitInput, setBenefitInput] = useState("");
  const [media, setMedia] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminProduct(productId);
      const p = data.product;
      setForm({
        name: p.name,
        description: p.description,
        long_description: p.long_description || "",
        key_benefits: Array.isArray(p.key_benefits) ? p.key_benefits : [],
        regular_price: parseFloat(p.regular_price),
        discount_price: p.discount_price ? parseFloat(p.discount_price) : null,
        stock_quantity: p.stock_quantity,
        category_id: p.category_id,
        is_published: !!p.is_published,
      });
      setMedia(data.resources || []);
      setReviews(data.reviews || []);
      setVariants(data.variants || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateProduct(productId, { ...form, variants });
      toast.success("Product saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async (files: FileList | null, role: "gallery" | "thumbnail" | "video") => {
    if (!files?.length) return;
    setUploading(true);
    try {
      let order = media.length;
      for (const file of Array.from(files)) {
        await api.uploadProductMedia(file, productId, role, order++);
      }
      toast.success("Media uploaded");
      load();
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = async (id: number) => {
    if (!confirm("Delete this file?")) return;
    try {
      await api.deleteResource(id);
      toast.success("Removed");
      load();
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const moderate = async (reviewId: number, status: string) => {
    try {
      await api.moderateReview(reviewId, status);
      toast.success(`Review ${status}`);
      load();
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const addBenefit = () => {
    if (!benefitInput.trim()) return;
    setForm({ ...form, key_benefits: [...(form.key_benefits || []), benefitInput.trim()] });
    setBenefitInput("");
  };

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        label: "",
        regular_price: form.regular_price || 0,
        discount_price: form.discount_price ?? null,
        stock_quantity: 0,
        badge: "",
        is_default: prev.length === 0,
      },
    ]);
  };

  const updateVariant = (index: number, patch: Partial<ProductVariant>) => {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const setDefaultVariant = (index: number) => {
    setVariants((prev) => prev.map((v, i) => ({ ...v, is_default: i === index })));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0B0B0B", color: "#fff" }}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <div>
          <h1 className="font-bold text-lg">Product editor</h1>
          <p className="text-xs text-white/40">Photos, video, description & reviews</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/cms/product/${productId}`}
            onClick={(e) => spaNavigateClick(e, `/cms/product/${productId}`)}
            className="text-xs text-amber-400 px-3 py-2 font-semibold"
          >
            Design page (CMS) →
          </a>
          <a
            href={`/product/${productId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-amber-400 px-3 py-2"
          >
            Preview ↗
          </a>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white p-2">
            <X size={22} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-white/50">Loading…</div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section className="rounded-2xl border border-white/10 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                <h2 className="font-bold text-sm uppercase tracking-wider text-amber-400/80">Media gallery</h2>
                <div className="grid grid-cols-3 gap-2">
                  {media.map((m) => (
                    <div key={m.id} className="relative group rounded-xl overflow-hidden aspect-square bg-black/30">
                      {m.file_role === "video" || m.mime_type?.startsWith("video/") ? (
                        <video src={m.file_url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={m.file_url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(m.id)}
                        className="absolute top-1 right-1 p-1 rounded bg-red-600/90 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                      <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 px-1 rounded">{m.file_role}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className={btnPrimary + " cursor-pointer"} style={{ background: "#FFCC00", color: "#1A1A1A" }}>
                    <ImageIcon size={14} /> Photos
                    <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={(e) => { uploadFiles(e.target.files, "gallery"); e.target.value = ""; }} />
                  </label>
                  <label className={btnPrimary + " cursor-pointer"} style={{ background: "#333", color: "#fff" }}>
                    <Upload size={14} /> Thumbnail
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { uploadFiles(e.target.files, "thumbnail"); e.target.value = ""; }} />
                  </label>
                  <label className={btnPrimary + " cursor-pointer"} style={{ background: "#333", color: "#fff" }}>
                    <Video size={14} /> Video
                    <input type="file" accept="video/mp4,video/webm" className="hidden" disabled={uploading} onChange={(e) => { uploadFiles(e.target.files, "video"); e.target.value = ""; }} />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                <h2 className="font-bold text-sm uppercase tracking-wider text-amber-400/80">Reviews ({reviews.length})</h2>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {reviews.map((r) => (
                    <div key={r.id} className="text-sm border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <Star size={12} className="text-amber-400" /> {r.rating}/5 — {r.reviewer_name}
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: r.status === "approved" ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)" }}>
                          {r.status}
                        </span>
                      </div>
                      <p className="text-white/60 text-xs mt-1 line-clamp-2">{r.body}</p>
                      {r.status === "pending" ? (
                        <div className="flex gap-2 mt-2">
                          <button type="button" onClick={() => moderate(r.id, "approved")} className="text-xs font-semibold text-emerald-400">Accept</button>
                          <button type="button" onClick={() => moderate(r.id, "rejected")} className="text-xs font-semibold text-red-400">Deny</button>
                        </div>
                      ) : r.status === "rejected" ? (
                        <button type="button" onClick={() => moderate(r.id, "approved")} className="text-xs font-semibold text-emerald-400 mt-2">Accept</button>
                      ) : (
                        <button type="button" onClick={() => moderate(r.id, "rejected")} className="text-xs font-semibold text-red-400 mt-2">Deny</button>
                      )}
                    </div>
                  ))}
                  {reviews.length === 0 && <p className="text-white/40 text-xs">No reviews yet</p>}
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <input className={inputCls} placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <textarea className={inputCls + " min-h-[60px]"} placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <textarea className={inputCls + " min-h-[120px]"} placeholder="Full description (product detail tab)" value={form.long_description || ""} onChange={(e) => setForm({ ...form, long_description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} type="number" placeholder="Regular price ₹" value={form.regular_price || ""} onChange={(e) => setForm({ ...form, regular_price: parseFloat(e.target.value) || 0 })} />
                <input className={inputCls} type="number" placeholder="Sale price" value={form.discount_price ?? ""} onChange={(e) => setForm({ ...form, discount_price: e.target.value ? parseFloat(e.target.value) : null })} />
                <input className={inputCls} type="number" placeholder="Stock" value={form.stock_quantity || ""} onChange={(e) => setForm({ ...form, stock_quantity: parseInt(e.target.value, 10) || 0 })} />
                <select className={inputCls} value={form.category_id ?? ""} onChange={(e) => setForm({ ...form, category_id: e.target.value ? parseInt(e.target.value, 10) : null })}>
                  <option value="">Category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-2">Key benefits</p>
                <div className="flex gap-2">
                  <input className={inputCls} placeholder="Add benefit" value={benefitInput} onChange={(e) => setBenefitInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBenefit())} />
                  <button type="button" onClick={addBenefit} className={btnPrimary} style={{ background: "#333", color: "#fff" }}>Add</button>
                </div>
                <ul className="mt-2 space-y-1">
                  {(form.key_benefits || []).map((b, i) => (
                    <li key={i} className="flex justify-between text-sm text-white/70">
                      {b}
                      <button type="button" onClick={() => setForm({ ...form, key_benefits: form.key_benefits?.filter((_, j) => j !== i) })} className="text-red-400 text-xs">Remove</button>
                    </li>
                  ))}
                </ul>
              </div>

              <section className="rounded-2xl border border-white/10 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold text-sm uppercase tracking-wider text-amber-400/80">Size / pack options</h2>
                  <button type="button" onClick={addVariant} className={btnPrimary} style={{ background: "#333", color: "#fff" }}>
                    Add option
                  </button>
                </div>
                <p className="text-xs text-white/40">
                  Optional. Shown on the product page as selectable pills (e.g. 20g, 50g). Leave empty to use the main product price only.
                </p>
                {variants.length === 0 ? (
                  <p className="text-xs text-white/40">No options yet.</p>
                ) : (
                  <div className="space-y-3">
                    {variants.map((v, i) => (
                      <div key={i} className="rounded-xl border border-white/10 p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className={inputCls}
                            placeholder="Label (e.g. 30ml)"
                            value={v.label}
                            onChange={(e) => updateVariant(i, { label: e.target.value })}
                          />
                          <input
                            className={inputCls}
                            placeholder="Badge (e.g. Best Value)"
                            value={v.badge || ""}
                            onChange={(e) => updateVariant(i, { badge: e.target.value })}
                          />
                          <input
                            className={inputCls}
                            type="number"
                            placeholder="Regular ₹"
                            value={v.regular_price || ""}
                            onChange={(e) => updateVariant(i, { regular_price: parseFloat(e.target.value) || 0 })}
                          />
                          <input
                            className={inputCls}
                            type="number"
                            placeholder="Sale ₹"
                            value={v.discount_price ?? ""}
                            onChange={(e) => updateVariant(i, { discount_price: e.target.value ? parseFloat(e.target.value) : null })}
                          />
                          <input
                            className={inputCls}
                            type="number"
                            placeholder="Stock"
                            value={v.stock_quantity || ""}
                            onChange={(e) => updateVariant(i, { stock_quantity: parseInt(e.target.value, 10) || 0 })}
                          />
                          <label className="flex items-center gap-2 text-xs text-white/70 px-1">
                            <input
                              type="radio"
                              name="defaultVariant"
                              checked={!!v.is_default}
                              onChange={() => setDefaultVariant(i)}
                            />
                            Default option
                          </label>
                        </div>
                        <button type="button" onClick={() => removeVariant(i)} className="text-xs text-red-400">
                          Remove option
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_published !== false} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
                Published on store
              </label>
              <button type="button" disabled={saving} onClick={save} className={btnPrimary + " w-full justify-center"} style={{ background: "#FFCC00", color: "#1A1A1A" }}>
                {saving ? "Saving…" : "Save product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
