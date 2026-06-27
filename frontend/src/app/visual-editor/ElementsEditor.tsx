import React from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  BoundElementDef,
  CustomElement,
  ELEMENT_INSERT_END,
  ELEMENT_INSERT_START,
  boundElementsForSection,
  createCustomElement,
  elementInsertAfter,
  elementsAfterAnchor,
  getCustomElements,
  readBoundValue,
  writeBoundPatch,
} from "./cmsElements";
import { Field, ImageField, TextArea, TextInput } from "./cmsEditorFields";
import RichTextEditor from "./RichTextEditor";
import HtmlCssEditor from "./HtmlCssEditor";
import { readImageSize, writeImageSizePatch } from "./cmsImageSize";

type Props = {
  cmsKey: string;
  data: Record<string, any>;
  blockType?: string;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onPatchData: (patch: Record<string, any>) => void;
  onUpload: (file: File) => Promise<string>;
};

function InsertSlot({
  label,
  onInsert,
}: {
  label: string;
  onInsert: (type: CustomElement["type"]) => void;
}) {
  const btn = (type: CustomElement["type"], text: string, accent = false) => (
    <button
      key={type}
      type="button"
      onClick={() => onInsert(type)}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold"
      style={{
        background: accent ? "rgba(255,204,0,0.18)" : "rgba(255,255,255,0.08)",
        color: accent ? "#FFCC00" : "#fff",
        border: `1px solid ${accent ? "rgba(255,204,0,0.3)" : "rgba(255,255,255,0.12)"}`,
        cursor: "pointer",
      }}
    >
      <Plus size={10} /> {text}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1.5 px-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
      <span className="text-[10px] text-white/35 w-full sm:w-auto sm:flex-1 truncate">{label}</span>
      {btn("text", "Text")}
      {btn("heading", "Heading")}
      {btn("image", "Image")}
      {btn("html", "HTML", true)}
    </div>
  );
}

function BoundRichField({
  def,
  value,
  onChange,
  onUpload,
}: {
  def: BoundElementDef;
  value: string;
  onChange: (v: string) => void;
  onUpload: (file: File) => Promise<string>;
}) {
  if (def.type === "color") {
    return <TextInput value={value} onChange={onChange} placeholder="#RRGGBB" />;
  }
  if (def.type === "list" || def.type === "imagelist") {
    return (
      <TextArea
        value={value}
        onChange={onChange}
        rows={def.type === "imagelist" ? 5 : 4}
        mono={def.type === "imagelist"}
        placeholder={def.type === "imagelist" ? "https://…\nhttps://…" : undefined}
      />
    );
  }
  return (
    <RichTextEditor
      value={value}
      onChange={onChange}
      onUpload={onUpload}
      heading={def.type === "heading"}
      minHeight={def.type === "textarea" || def.multiline ? 120 : 72}
      placeholder={def.hint || "Type here…"}
    />
  );
}

export default function ElementsEditor({
  cmsKey,
  data,
  blockType,
  selectedElementId,
  onSelectElement,
  onPatchData,
  onUpload,
}: Props) {
  const bound = boundElementsForSection(cmsKey, blockType);
  const customElements = getCustomElements(data);

  const updateCustom = (id: string, patch: Partial<CustomElement>) => {
    onPatchData({
      elements: customElements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    });
  };

  const removeCustom = (id: string) => {
    onPatchData({ elements: customElements.filter((el) => el.id !== id) });
    if (selectedElementId === id) onSelectElement(null);
  };

  const addCustomAt = (type: CustomElement["type"], insertAfter: string) => {
    const el = createCustomElement(type, insertAfter);
    onPatchData({ elements: [...customElements, el] });
    onSelectElement(el.id);
  };

  const addCustom = (type: CustomElement["type"]) => {
    addCustomAt(type, ELEMENT_INSERT_END);
  };

  const renderBoundEditor = (def: BoundElementDef) => {
    const value = readBoundValue(data, def);
    const selected = selectedElementId === def.id;

    return (
      <div
        key={def.id}
        className="rounded-xl border overflow-hidden transition-colors"
        style={{
          borderColor: selected ? "rgba(59,130,246,0.6)" : "rgba(255,255,255,0.1)",
          background: selected ? "rgba(59,130,246,0.1)" : "rgba(0,0,0,0.2)",
        }}
      >
        <button
          type="button"
          onClick={() => onSelectElement(selected ? null : def.id)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left"
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#fff" }}
        >
          {selected ? <ChevronDown size={14} className="text-blue-300" /> : <ChevronRight size={14} className="text-white/40" />}
          <span className="text-xs font-semibold flex-1">{def.label}</span>
          <span className="text-[10px] text-white/40 uppercase">{def.type}</span>
        </button>

        {selected ? (
          <div className="px-3 pb-3 border-t border-white/10 pt-3">
            {def.type === "image" ? (
              <ImageField
                label={def.label}
                value={value}
                onChange={(v) => onPatchData(writeBoundPatch(def, v))}
                onUpload={onUpload}
                size={readImageSize(data, def.fieldKey)}
                onSizeChange={(s) => onPatchData(writeImageSizePatch(def.fieldKey, s))}
                defaultSize={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Field label={def.hint ? `Content — ${def.hint}` : "Content"}>
                <BoundRichField
                  def={def}
                  value={value}
                  onChange={(v) => onPatchData(writeBoundPatch(def, v))}
                  onUpload={onUpload}
                />
              </Field>
            )}
            {def.type === "imagelist" ? (
              <input
                type="file"
                accept="image/*"
                className="block w-full text-xs text-white/70 mb-2"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await onUpload(file);
                  if (def.type === "imagelist") {
                    const lines = value.split("\n").map((s) => s.trim()).filter(Boolean);
                    lines.push(url);
                    onPatchData(writeBoundPatch(def, lines.join("\n")));
                  } else {
                    onPatchData(writeBoundPatch(def, url));
                  }
                  e.currentTarget.value = "";
                }}
              />
            ) : null}
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-[10px] text-white/40 mb-2">Add below this field on the page:</p>
              <InsertSlot label="" onInsert={(type) => addCustomAt(type, def.id)} />
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderCustomEditor = (el: CustomElement) => {
    const selected = selectedElementId === el.id;
    const anchorLabel =
      el.insertAfter === ELEMENT_INSERT_START
        ? "top of section"
        : el.insertAfter === ELEMENT_INSERT_END || !el.insertAfter
          ? "end of section"
          : bound.find((b) => b.id === el.insertAfter)?.label || el.insertAfter;

    return (
      <div
        key={el.id}
        className="rounded-xl border overflow-hidden"
        style={{
          borderColor: selected ? "rgba(255,204,0,0.5)" : "rgba(255,255,255,0.1)",
          background: selected ? "rgba(255,204,0,0.08)" : "rgba(0,0,0,0.2)",
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => onSelectElement(selected ? null : el.id)}
            className="flex items-center gap-2 flex-1 text-left min-w-0"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#fff" }}
          >
            {selected ? <ChevronDown size={14} className="text-amber-300 shrink-0" /> : <ChevronRight size={14} className="text-white/40 shrink-0" />}
            <span className="text-xs font-semibold truncate">{el.label}</span>
            <span className="text-[10px] text-white/40 uppercase shrink-0">{el.type}</span>
          </button>
          <button type="button" onClick={() => removeCustom(el.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#fca5a5" }}>
            <Trash2 size={14} />
          </button>
        </div>
        <div className="px-3 pb-1 text-[10px] text-white/35">After: {anchorLabel}</div>

        {selected ? (
          <div className="px-3 pb-3 border-t border-white/10 pt-3 space-y-2">
            <Field label="Element name">
              <TextInput value={el.label} onChange={(v) => updateCustom(el.id, { label: v })} />
            </Field>

            {el.type === "html" ? (
              <HtmlCssEditor
                label={`${el.label} — HTML & CSS`}
                html={el.html || ""}
                css={el.css || ""}
                hint="HTML and CSS work together — preview updates live."
                onHtmlChange={(v) => updateCustom(el.id, { html: v })}
                onCssChange={(v) => updateCustom(el.id, { css: v })}
              />
            ) : null}

            {el.type === "text" || el.type === "heading" ? (
              <Field label="Text">
                <RichTextEditor
                  value={el.content || ""}
                  onChange={(v) => updateCustom(el.id, { content: v })}
                  onUpload={onUpload}
                  heading={el.type === "heading"}
                  minHeight={100}
                />
              </Field>
            ) : null}

            {el.type === "button" ? (
              <>
                <Field label="Button label">
                  <RichTextEditor
                    value={el.content || ""}
                    onChange={(v) => updateCustom(el.id, { content: v })}
                    onUpload={onUpload}
                    minHeight={56}
                  />
                </Field>
                <Field label="Link (href)">
                  <TextInput value={el.href || ""} onChange={(v) => updateCustom(el.id, { href: v })} placeholder="#bestseller" />
                </Field>
              </>
            ) : null}

            {el.type === "image" ? (
              <>
                <ImageField
                  label="Image"
                  value={el.src || ""}
                  onChange={(v) => updateCustom(el.id, { src: v })}
                  onUpload={onUpload}
                  size={{ width: el.width, height: el.height, objectFit: el.objectFit as any }}
                  onSizeChange={(s) =>
                    updateCustom(el.id, {
                      ...(s.width !== undefined ? { width: s.width } : {}),
                      ...(s.height !== undefined ? { height: s.height } : {}),
                      ...(s.objectFit !== undefined ? { objectFit: String(s.objectFit) } : {}),
                    })
                  }
                  defaultSize={{ width: "100%", height: "auto", objectFit: "cover" }}
                />
                <Field label="Alt text">
                  <TextInput value={el.alt || ""} onChange={(v) => updateCustom(el.id, { alt: v })} />
                </Field>
              </>
            ) : null}

            {(el.type === "text" || el.type === "heading" || el.type === "button") ? (
              <Field label="Extra CSS (optional)">
                <TextArea
                  value={el.css || ""}
                  onChange={(v) => updateCustom(el.id, { css: v })}
                  rows={4}
                  mono
                  placeholder=".my-el { font-size: 18px; }"
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderAnchoredCustom = (anchor: string) => {
    const items = elementsAfterAnchor(customElements, anchor);
    if (items.length === 0) return null;
    return <div className="space-y-2 py-1">{items.map(renderCustomEditor)}</div>;
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-white/50 leading-relaxed">
        Edit built-in fields below. Use <b>+ Text</b>, <b>+ Image</b>, or <b>+ HTML</b> between any element. Click <b>Publish</b> to save.
      </p>

      {bound.length > 0 ? (
        <div>
          <div className="text-[10px] font-bold tracking-widest uppercase text-white/45 mb-2">Inside this section</div>
          <div className="space-y-2">
            <InsertSlot label="Insert at top" onInsert={(type) => addCustomAt(type, ELEMENT_INSERT_START)} />
            {renderAnchoredCustom(ELEMENT_INSERT_START)}
            {bound.map((def) => (
              <React.Fragment key={def.id}>
                {renderBoundEditor(def)}
                <InsertSlot label={`Insert after “${def.label}”`} onInsert={(type) => addCustomAt(type, def.id)} />
                {renderAnchoredCustom(def.id)}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className="text-[10px] font-bold tracking-widest uppercase text-white/45 mb-2">
          {bound.length > 0 ? "More at end of section" : "Custom elements"}
        </div>
        {bound.length === 0 ? (
          <InsertSlot label="Insert at top" onInsert={(type) => addCustomAt(type, ELEMENT_INSERT_START)} />
        ) : null}
        <div className="flex flex-wrap gap-1.5 mb-3 mt-2">
          {(["text", "heading", "button", "image", "html"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addCustom(t)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{
                background: t === "html" ? "rgba(255,204,0,0.15)" : "rgba(255,255,255,0.08)",
                color: t === "html" ? "#FFCC00" : "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                cursor: "pointer",
              }}
            >
              <Plus size={11} /> {t}
            </button>
          ))}
        </div>
        <InsertSlot label="Insert at end" onInsert={(type) => addCustomAt(type, ELEMENT_INSERT_END)} />
        <div className="space-y-2 mt-2">
          {elementsAfterAnchor(customElements, ELEMENT_INSERT_END).length === 0 ? (
            <p className="text-xs text-white/40">No elements at end — use + Text, + Image, or + HTML above.</p>
          ) : (
            elementsAfterAnchor(customElements, ELEMENT_INSERT_END).map(renderCustomEditor)
          )}
        </div>
      </div>
    </div>
  );
}
