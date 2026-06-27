import React, { useEffect, useMemo, useState } from "react";
import { api } from "./services/api";
import { useAuth } from "./context/AuthContext";

const DEFAULT_KEYS = ["header", "marquee", "hero", "bestseller", "finalcta", "footer", "home"];

const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  outline: "none",
};

function safePrettyJson(value: any) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

type HomeBlockType =
  | "marquee"
  | "hero"
  | "plans"
  | "why"
  | "timeline"
  | "reviews"
  | "about"
  | "finalcta"
  | "html"
  | "image";

type HomeBlock = {
  id: string;
  type: HomeBlockType;
  props?: Record<string, any>;
};

const DEFAULT_HOME_BLOCKS: HomeBlock[] = [
  { id: "marquee", type: "marquee" },
  { id: "hero", type: "hero" },
  { id: "plans", type: "plans" },
  { id: "why", type: "why" },
  { id: "timeline", type: "timeline" },
  { id: "reviews", type: "reviews" },
  { id: "about", type: "about" },
  { id: "finalcta", type: "finalcta" },
];

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function move<T>(arr: T[], from: number, to: number) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function linesFromArray(items?: string[]) {
  return Array.isArray(items) ? items.join("\n") : "";
}

function arrayFromLines(text: string) {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-white/60 mb-2">{label}</div>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl px-3 py-2 text-sm"
      style={inputStyle}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-xl p-3 text-sm"
      style={{
        ...inputStyle,
        resize: "vertical",
        fontFamily: mono
          ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          : undefined,
      }}
    />
  );
}

function SectionPanel({
  title,
  description,
  saving,
  onSave,
  children,
}: {
  title: string;
  description?: string;
  saving: boolean;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <div className="font-semibold tracking-widest uppercase text-xs text-white/80">{title}</div>
          {description ? <div className="text-xs text-white/50 mt-1">{description}</div> : null}
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          style={{ background: "#FFCC00", color: "#1A1A1A", border: "none", cursor: "pointer" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ImageField({
  label,
  value,
  onChange,
  onUpload,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onUpload: (file: File) => Promise<string>;
}) {
  return (
    <Field label={label}>
      <TextInput value={value} onChange={onChange} placeholder="https://… or upload below" />
      <input
        type="file"
        accept="image/*"
        className="mt-2 block w-full text-xs text-white/70"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const url = await onUpload(file);
          onChange(url);
          e.currentTarget.value = "";
        }}
      />
      {value ? (
        <div className="mt-3 rounded-xl overflow-hidden border border-white/10">
          <img src={value} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover" }} />
        </div>
      ) : null}
    </Field>
  );
}

export default function CmsAdmin() {
  const { user, setUser, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sectionData, setSectionData] = useState<Record<string, any>>({});
  const [tab, setTab] = useState<"builder" | "json">("builder");
  const [homeBlocks, setHomeBlocks] = useState<HomeBlock[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const keys = useMemo(() => DEFAULT_KEYS, []);

  const patchSection = (key: string, patch: Record<string, any>) => {
    setSectionData((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      if (!isAuthenticated) {
        if (mounted) {
          setError("Login required.");
          setLoading(false);
        }
        return;
      }
      try {
        const profile = await api.getProfile();
        const cms = await api.getCmsSections(keys);
        if (!mounted) return;
        setUser(profile.user);

        const nextDrafts: Record<string, string> = {};
        const nextSections: Record<string, any> = {};
        for (const key of keys) {
          const content = cms.sections?.[key]?.content ?? {};
          nextDrafts[key] = safePrettyJson(content);
          if (key !== "home") nextSections[key] = content;
        }
        setDrafts(nextDrafts);
        setSectionData(nextSections);

        const home = cms.sections?.home?.content as any;
        setHomeBlocks(Array.isArray(home?.blocks) ? home.blocks : []);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load CMS.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [keys]);

  const save = async (key: string) => {
    setSavingKey(key);
    setError(null);
    setSuccess(null);
    try {
      const parsed = JSON.parse(drafts[key] || "{}");
      await api.updateCmsSection(key, parsed);
      if (key !== "home") setSectionData((s) => ({ ...s, [key]: parsed }));
      setSuccess(`${key} saved.`);
    } catch (e: any) {
      setError(e?.message || "Failed to save CMS.");
    } finally {
      setSavingKey(null);
    }
  };

  const saveSection = async (key: string) => {
    setSavingKey(key);
    setError(null);
    setSuccess(null);
    try {
      const content = sectionData[key] || {};
      await api.updateCmsSection(key, content);
      setDrafts((d) => ({ ...d, [key]: safePrettyJson(content) }));
      setSuccess(`${key} saved.`);
    } catch (e: any) {
      setError(e?.message || "Failed to save CMS.");
    } finally {
      setSavingKey(null);
    }
  };

  const saveHome = async () => {
    setSavingKey("home");
    setError(null);
    setSuccess(null);
    try {
      await api.updateCmsSection("home", { blocks: homeBlocks });
      setDrafts((d) => ({ ...d, home: safePrettyJson({ blocks: homeBlocks }) }));
      setSuccess("Home layout saved.");
    } catch (e: any) {
      setError(e?.message || "Failed to save home layout.");
    } finally {
      setSavingKey(null);
    }
  };

  const uploadImage = async (file: File) => {
    if (!isAuthenticated || !user?.id) throw new Error("Login required to upload.");
    const resource = await api.uploadResource(file, "User", user.id, "banner");
    return resource.file_url;
  };

  const handleUpload = async (file: File) => {
    try {
      return await uploadImage(file);
    } catch (err: any) {
      setError(err?.message || "Upload failed");
      throw err;
    }
  };

  const addBlock = (type: HomeBlockType) => {
    const base: HomeBlock = { id: newId(type), type, props: {} };
    if (type === "html") base.props = { html: "<div>New block</div>" };
    if (type === "image") base.props = { src: "", alt: "Image", width: "100%", height: "auto" };
    setHomeBlocks((b) => [...b, base]);
  };

  const updateBlockProps = (id: string, propsPatch: Record<string, any>) => {
    setHomeBlocks((blocks) =>
      blocks.map((b) => (b.id === id ? { ...b, props: { ...(b.props || {}), ...propsPatch } } : b))
    );
  };

  const removeBlock = (id: string) => setHomeBlocks((blocks) => blocks.filter((b) => b.id !== id));

  const isAllowed = user?.role === "admin";

  const renderSectionEditor = (key: string) => {
    const data = sectionData[key] || {};
    const saving = savingKey === key;

    switch (key) {
      case "header":
        return (
          <SectionPanel title="Header / Logo" description="Site logo and brand text" saving={saving} onSave={() => saveSection("header")}>
            <Field label="Logo text">
              <TextInput value={String(data.logoText ?? "")} onChange={(v) => patchSection("header", { logoText: v })} placeholder="ARGLOVE" />
            </Field>
            <Field label="Logo sub-text">
              <TextInput value={String(data.logoSubText ?? "")} onChange={(v) => patchSection("header", { logoSubText: v })} placeholder="SKIN" />
            </Field>
            <ImageField label="Logo image (optional — replaces text)" value={String(data.logoImageUrl ?? "")} onChange={(v) => patchSection("header", { logoImageUrl: v })} onUpload={handleUpload} />
          </SectionPanel>
        );

      case "marquee":
        return (
          <SectionPanel title="Top marquee bar" description="Scrolling offers at the top" saving={saving} onSave={() => saveSection("marquee")}>
            <Field label="Messages (one per line)">
              <TextArea
                value={linesFromArray(data.items)}
                onChange={(v) => patchSection("marquee", { items: arrayFromLines(v) })}
                rows={4}
                placeholder="Free Shipping Across India"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Background color">
                <TextInput value={String(data.bgColor ?? "#FFCC00")} onChange={(v) => patchSection("marquee", { bgColor: v })} />
              </Field>
              <Field label="Text color">
                <TextInput value={String(data.textColor ?? "#1A1A1A")} onChange={(v) => patchSection("marquee", { textColor: v })} />
              </Field>
            </div>
          </SectionPanel>
        );

      case "hero":
        return (
          <SectionPanel title="Hero section" description="Main banner at the top of the page" saving={saving} onSave={() => saveSection("hero")}>
            <Field label="Badge text">
              <TextInput value={String(data.badge ?? "")} onChange={(v) => patchSection("hero", { badge: v })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Headline 1"><TextInput value={String(data.headline1 ?? "")} onChange={(v) => patchSection("hero", { headline1: v })} /></Field>
              <Field label="Headline 2"><TextInput value={String(data.headline2 ?? "")} onChange={(v) => patchSection("hero", { headline2: v })} /></Field>
              <Field label="Headline 3"><TextInput value={String(data.headline3 ?? "")} onChange={(v) => patchSection("hero", { headline3: v })} /></Field>
            </div>
            <Field label="Description">
              <TextArea value={String(data.description ?? "")} onChange={(v) => patchSection("hero", { description: v })} rows={4} />
            </Field>
            <Field label="Button text">
              <TextInput value={String(data.ctaText ?? "")} onChange={(v) => patchSection("hero", { ctaText: v })} placeholder="SHOP NOW" />
            </Field>
            <ImageField label="Hero image" value={String(data.imageUrl ?? "")} onChange={(v) => patchSection("hero", { imageUrl: v })} onUpload={handleUpload} />
            <Field label="Trust items (one per line)">
              <TextArea value={linesFromArray(data.trustItems)} onChange={(v) => patchSection("hero", { trustItems: arrayFromLines(v) })} rows={3} />
            </Field>
            <Field label="Benefit items (one per line)">
              <TextArea value={linesFromArray(data.benefitItems)} onChange={(v) => patchSection("hero", { benefitItems: arrayFromLines(v) })} rows={4} />
            </Field>
          </SectionPanel>
        );

      case "bestseller":
        return (
          <SectionPanel title="Bestseller / Plans section" saving={saving} onSave={() => saveSection("bestseller")}>
            <Field label="Badge">
              <TextInput value={String(data.badge ?? "")} onChange={(v) => patchSection("bestseller", { badge: v })} placeholder="Bestseller" />
            </Field>
            <Field label="Section title">
              <TextInput value={String(data.title ?? "")} onChange={(v) => patchSection("bestseller", { title: v })} placeholder="Choose Your Transformation" />
            </Field>
          </SectionPanel>
        );

      case "finalcta":
        return (
          <SectionPanel title="Final call-to-action" saving={saving} onSave={() => saveSection("finalcta")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Headline"><TextInput value={String(data.headline ?? "")} onChange={(v) => patchSection("finalcta", { headline: v })} /></Field>
              <Field label="Sub-headline"><TextInput value={String(data.subheadline ?? "")} onChange={(v) => patchSection("finalcta", { subheadline: v })} /></Field>
            </div>
            <Field label="Features (one per line)">
              <TextArea value={linesFromArray(data.features)} onChange={(v) => patchSection("finalcta", { features: arrayFromLines(v) })} rows={3} />
            </Field>
            <Field label="Button text">
              <TextInput value={String(data.ctaText ?? "")} onChange={(v) => patchSection("finalcta", { ctaText: v })} placeholder="BUY NOW" />
            </Field>
          </SectionPanel>
        );

      case "footer":
        return (
          <SectionPanel title="Footer" saving={saving} onSave={() => saveSection("footer")}>
            <Field label="Copyright text">
              <TextInput value={String(data.copyright ?? "")} onChange={(v) => patchSection("footer", { copyright: v })} />
            </Field>
          </SectionPanel>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "#0B0B0B", color: "#fff", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Visual Site Editor</h1>
            <p className="text-sm text-white/70 mt-1">
              Logged in as: <span className="font-semibold text-white">{user?.email || "Unknown"}</span>{" "}
              <span className="text-white/50">({user?.role || "no role"})</span>
            </p>
          </div>
          <a
            href="/"
            className="px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#FFCC00", color: "#1A1A1A", textDecoration: "none" }}
          >
            Back to site
          </a>
        </div>

        {loading && <div className="p-4 rounded-xl bg-white/5 border border-white/10">Loading…</div>}

        {!loading && error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-100 mb-4">{error}</div>
        )}

        {!loading && success && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-100 mb-4">{success}</div>
        )}

        {!loading && !isAllowed && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-50">
            You do not have access. Set this user&apos;s role to <b>admin</b> in the database, then log in again.
          </div>
        )}

        {!loading && isAllowed && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setTab("builder")}
                className="px-3 py-2 rounded-lg text-sm font-semibold"
                style={{ background: tab === "builder" ? "#FFCC00" : "rgba(255,255,255,0.06)", color: tab === "builder" ? "#1A1A1A" : "#fff", border: "1px solid rgba(255,255,255,0.10)" }}
              >
                Visual Editor
              </button>
              <button
                onClick={() => setTab("json")}
                className="px-3 py-2 rounded-lg text-sm font-semibold"
                style={{ background: tab === "json" ? "#FFCC00" : "rgba(255,255,255,0.06)", color: tab === "json" ? "#1A1A1A" : "#fff", border: "1px solid rgba(255,255,255,0.10)" }}
              >
                Advanced (JSON)
              </button>
            </div>

            {tab === "builder" ? (
              <div className="space-y-4">
                <p className="text-sm text-white/60 mb-2">
                  Edit text, colors, and images below — no code required. Click <b>Save</b> on each section, then refresh the homepage to see changes.
                </p>

                {(["header", "marquee", "hero", "bestseller", "finalcta", "footer"] as const).map((key) => (
                  <React.Fragment key={key}>{renderSectionEditor(key)}</React.Fragment>
                ))}

                <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div>
                      <div className="font-semibold tracking-widest uppercase text-xs text-white/80">Home page layout</div>
                      <div className="text-xs text-white/50 mt-1">Drag blocks to reorder. Optional — leave empty to use the default layout.</div>
                    </div>
                    <button
                      onClick={saveHome}
                      disabled={savingKey === "home"}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                      style={{ background: "#FFCC00", color: "#1A1A1A", border: "none", cursor: "pointer" }}
                    >
                      {savingKey === "home" ? "Saving…" : "Save layout"}
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(["hero", "plans", "why", "timeline", "reviews", "about", "finalcta", "html", "image"] as HomeBlockType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => addBlock(t)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.10)" }}
                        >
                          + {t}
                        </button>
                      ))}
                      {homeBlocks.length === 0 ? (
                        <button
                          onClick={() => setHomeBlocks(DEFAULT_HOME_BLOCKS)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{ background: "rgba(255,204,0,0.12)", color: "#FFCC00", border: "1px solid rgba(255,204,0,0.25)" }}
                        >
                          Load default layout
                        </button>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      {homeBlocks.map((block, index) => (
                        <div
                          key={block.id}
                          draggable
                          onDragStart={() => setDragIndex(index)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragIndex === null || dragIndex === index) return;
                            setHomeBlocks((b) => move(b, dragIndex, index));
                            setDragIndex(null);
                          }}
                          className="rounded-2xl border border-white/10 overflow-hidden"
                          style={{ background: "rgba(0,0,0,0.35)" }}
                        >
                          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold tracking-widest uppercase text-white/70" title="Drag to reorder">⠿</span>
                              <div className="text-sm font-semibold">{block.type}</div>
                            </div>
                            <button
                              onClick={() => removeBlock(block.id)}
                              className="px-2 py-1 rounded-lg text-xs font-semibold"
                              style={{ background: "rgba(255,0,0,0.12)", border: "1px solid rgba(255,0,0,0.25)", color: "#ffd7d7" }}
                            >
                              Remove
                            </button>
                          </div>

                          <div className="p-4">
                            {block.type === "html" ? (
                              <Field label="HTML content">
                                <TextArea
                                  value={String(block.props?.html ?? "")}
                                  onChange={(v) => updateBlockProps(block.id, { html: v })}
                                  rows={6}
                                  mono
                                />
                              </Field>
                            ) : block.type === "image" ? (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <ImageField
                                    label="Image"
                                    value={String(block.props?.src ?? "")}
                                    onChange={(v) => updateBlockProps(block.id, { src: v })}
                                    onUpload={handleUpload}
                                  />
                                  <Field label="Alt text">
                                    <TextInput value={String(block.props?.alt ?? "")} onChange={(v) => updateBlockProps(block.id, { alt: v })} />
                                  </Field>
                                </div>
                                <div>
                                  <div className="text-xs text-white/60 mb-2">Preview</div>
                                  <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    {block.props?.src ? (
                                      <img src={String(block.props.src)} alt={String(block.props?.alt ?? "")} style={{ width: "100%", height: 180, objectFit: "cover" }} />
                                    ) : (
                                      <div className="h-[180px] flex items-center justify-center text-xs text-white/40">No image</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-white/60">
                                Built-in section — edit its content in the matching section above (e.g. hero block → Hero section).
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-white/60">Advanced mode — edit raw JSON. Use only if you need fields not shown in the visual editor.</p>
                {keys.filter((k) => k !== "home").map((key) => (
                  <div key={key} className="rounded-2xl overflow-hidden border border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                      <div className="font-semibold tracking-widest uppercase text-xs text-white/80">{key}</div>
                      <button
                        onClick={() => save(key)}
                        disabled={savingKey === key}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                        style={{ background: "#FFCC00", color: "#1A1A1A", border: "none", cursor: "pointer" }}
                      >
                        {savingKey === key ? "Saving…" : "Save"}
                      </button>
                    </div>
                    <div className="p-4">
                      <textarea
                        value={drafts[key] ?? "{}"}
                        onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                        className="w-full rounded-xl p-3 text-sm"
                        style={{
                          minHeight: 220,
                          ...inputStyle,
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
