import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { CmsCustomField } from "./CmsCustomContent";
import { Field, ImageField, TextInput } from "./cmsEditorFields";
import { CmsRichText } from "./RichTextEditor";
import HtmlCssEditor from "./HtmlCssEditor";

function newFieldId() {
  return `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

export default function CustomFieldsEditor({
  fields,
  onChange,
  onUpload,
}: {
  fields: CmsCustomField[];
  onChange: (fields: CmsCustomField[]) => void;
  onUpload: (file: File) => Promise<string>;
}) {
  const addField = (type: CmsCustomField["type"]) => {
    const base: CmsCustomField = { id: newFieldId(), type, label: "New field" };
    if (type === "text") base.value = "Your text here";
    if (type === "html") {
      base.html = "<div><p>Custom HTML block</p></div>";
      base.css = "";
    }
    if (type === "image") base.src = "";
    onChange([...fields, base]);
  };

  const updateField = (id: string, patch: Partial<CmsCustomField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => onChange(fields.filter((f) => f.id !== id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => addField("text")}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}
        >
          <Plus size={12} /> Text field
        </button>
        <button
          type="button"
          onClick={() => addField("html")}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "rgba(255,204,0,0.15)", color: "#FFCC00", border: "1px solid rgba(255,204,0,0.25)", cursor: "pointer" }}
        >
          <Plus size={12} /> HTML/CSS field
        </button>
        <button
          type="button"
          onClick={() => addField("image")}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}
        >
          <Plus size={12} /> Image field
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-xs text-white/45">No extra fields yet. Add text, HTML/CSS, or image fields below the section content.</p>
      ) : null}

      {fields.map((field, index) => (
        <div key={field.id} className="rounded-xl border border-white/10 p-3" style={{ background: "rgba(0,0,0,0.2)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white/70">Field {index + 1} · {field.type}</span>
            <button
              type="button"
              onClick={() => removeField(field.id)}
              className="p-1 rounded"
              style={{ color: "#fca5a5", background: "transparent", border: "none", cursor: "pointer" }}
            >
              <Trash2 size={14} />
            </button>
          </div>

          <Field label="Label (optional)">
            <TextInput value={field.label || ""} onChange={(v) => updateField(field.id, { label: v })} />
          </Field>

          {field.type === "text" ? (
            <Field label="Text value">
              <CmsRichText value={field.value || ""} onChange={(v) => updateField(field.id, { value: v })} onUpload={onUpload} rows={3} />
            </Field>
          ) : null}

          {field.type === "image" ? (
            <>
              <ImageField
                label="Image"
                value={field.src || ""}
                onChange={(v) => updateField(field.id, { src: v })}
                onUpload={onUpload}
                size={{ width: field.width, height: field.height, objectFit: field.objectFit as any }}
                onSizeChange={(s) =>
                  updateField(field.id, {
                    ...(s.width !== undefined ? { width: s.width } : {}),
                    ...(s.height !== undefined ? { height: s.height } : {}),
                    ...(s.objectFit !== undefined ? { objectFit: String(s.objectFit) } : {}),
                  })
                }
                defaultSize={{ width: "100%", height: "auto", objectFit: "cover" }}
              />
              <Field label="Alt text">
                <TextInput value={field.alt || ""} onChange={(v) => updateField(field.id, { alt: v })} />
              </Field>
            </>
          ) : null}

          {field.type === "html" ? (
            <HtmlCssEditor
              label="Field HTML/CSS"
              html={field.html || ""}
              css={field.css || ""}
              onHtmlChange={(v) => updateField(field.id, { html: v })}
              onCssChange={(v) => updateField(field.id, { css: v })}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
