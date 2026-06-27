import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { CSS_BLOCK_TEMPLATE, HTML_BLOCK_TEMPLATE } from "./CmsCustomContent";
import { Field, TextArea } from "./cmsEditorFields";

export default function HtmlCssEditor({
  html,
  css,
  onHtmlChange,
  onCssChange,
  label = "HTML / CSS",
  hint,
  onSyncFromFields,
  rawPreview = false,
  globalCss = false,
}: {
  html: string;
  css: string;
  onHtmlChange: (v: string) => void;
  onCssChange: (v: string) => void;
  label?: string;
  hint?: string;
  onSyncFromFields?: () => void;
  rawPreview?: boolean;
  globalCss?: boolean;
}) {
  const [showPreview, setShowPreview] = React.useState(true);

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden" style={{ background: "rgba(0,0,0,0.25)" }}>
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-white/60">{label}</span>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "none", cursor: "pointer" }}
        >
          {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
          {showPreview ? "Hide preview" : "Show preview"}
        </button>
      </div>

      {hint ? (
        <div className="px-3 py-2 text-[11px] text-emerald-300/90 border-b border-white/5" style={{ background: "rgba(34,197,94,0.08)" }}>
          {hint}
        </div>
      ) : null}

      <div className="p-3 space-y-3">
        <Field label="HTML code">
          <TextArea
            value={html}
            onChange={onHtmlChange}
            rows={8}
            mono
            placeholder="<div>Your content</div>"
          />
        </Field>

        <Field label={globalCss || rawPreview ? "CSS styles (global — entire website)" : "CSS styles (scoped to this block)"}>
          <TextArea
            value={css}
            onChange={onCssChange}
            rows={8}
            mono
            placeholder=".my-class { color: #1A1A1A; }"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {onSyncFromFields ? (
            <button
              type="button"
              onClick={onSyncFromFields}
              className="text-xs font-semibold px-2 py-1 rounded-lg"
              style={{ color: "#86efac", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", cursor: "pointer" }}
            >
              ↻ Reload from current fields
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onHtmlChange(HTML_BLOCK_TEMPLATE)}
            className="text-xs font-semibold px-2 py-1"
            style={{ color: "#FFCC00", background: "transparent", border: "none", cursor: "pointer" }}
          >
            HTML template
          </button>
          <button
            type="button"
            onClick={() => onCssChange(CSS_BLOCK_TEMPLATE)}
            className="text-xs font-semibold px-2 py-1"
            style={{ color: "#FFCC00", background: "transparent", border: "none", cursor: "pointer" }}
          >
            CSS template
          </button>
        </div>

        {showPreview ? (
          <div>
            <div className="text-xs text-white/50 mb-2">Live preview (HTML + CSS together)</div>
            <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: "#fff", color: "#1A1A1A", minHeight: 100 }}>
              {css ? <style>{rawPreview ? css : `.cms-editor-preview-scope { ${css} }`}</style> : null}
              <div
                className={rawPreview ? undefined : "cms-editor-preview-scope p-4 text-sm"}
                style={rawPreview ? undefined : { padding: 16, fontSize: 14 }}
                dangerouslySetInnerHTML={{
                  __html: html || "<p style='color:#999;margin:0'>No HTML yet — content from Fields tab appears here when you open HTML/CSS</p>",
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GlobalCssToggle({
  checked,
  onChange,
  locked,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 mb-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span className="text-xs text-white/70">
        <b className="text-white">Global CSS</b> — styles apply to the{" "}
        <b className="text-emerald-300">entire website</b> (all pages)
        {locked ? <span className="block text-white/50 mt-1">Always global for header, footer, and marquee.</span> : null}
      </span>
    </label>
  );
}

export function UseHtmlOnlyToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 mb-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span className="text-xs text-white/70">
        <b className="text-white">Replace entire section</b> with HTML/CSS only (hides built-in layout)
      </span>
    </label>
  );
}

export function EditModeTabs({
  mode,
  onChange,
}: {
  mode: "fields" | "elements" | "code" | "custom";
  onChange: (m: "fields" | "elements" | "code" | "custom") => void;
}) {
  const btn = (id: "fields" | "elements" | "code" | "custom", label: string) => (
    <button
      type="button"
      onClick={() => onChange(id)}
      className="flex-1 px-1.5 py-2 rounded-lg text-[10px] font-bold"
      style={{
        background: mode === id ? "#FFCC00" : "rgba(255,255,255,0.06)",
        color: mode === id ? "#1A1A1A" : "#fff",
        border: "none",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-1 mb-4">
      {btn("fields", "Fields")}
      {btn("elements", "Elements")}
      {btn("code", "HTML/CSS")}
      {btn("custom", "+ Add")}
    </div>
  );
}
