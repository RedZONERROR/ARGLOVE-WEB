import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link,
  Code,
  Quote,
  Image,
  Palette,
  Highlighter,
  ALargeSmall,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { inputStyle } from "./cmsEditorFields";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  onUpload?: (file: File) => Promise<string>;
  heading?: boolean;
};

function ToolbarBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex items-center justify-center w-7 h-7 rounded-md transition-colors shrink-0"
      style={{
        background: active ? "rgba(255,255,255,0.18)" : "transparent",
        color: active ? "#fff" : "rgba(255,255,255,0.75)",
        border: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <div className="w-px h-5 mx-0.5 shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Type here…",
  minHeight = 88,
  onUpload,
  heading,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const fgRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || syncing.current) return;
    const next = value || "";
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    syncing.current = true;
    onChange(el.innerHTML);
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, [onChange]);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
  };

  const insertLink = () => {
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    exec("createLink", url);
  };

  const insertCode = () => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const text = sel?.toString() || "code";
    document.execCommand("insertHTML", false, `<code>${text.replace(/</g, "&lt;")}</code>`);
    emit();
  };

  const insertImage = async (url: string) => {
    editorRef.current?.focus();
    document.execCommand(
      "insertHTML",
      false,
      `<img src="${url.replace(/"/g, "&quot;")}" alt="" style="max-width:100%;height:auto;border-radius:8px;" />`,
    );
    emit();
  };

  const changeFontSize = (delta: number) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      exec("fontSize", delta > 0 ? "5" : "2");
      return;
    }
    const span = document.createElement("span");
    span.style.fontSize = delta > 0 ? "1.25em" : "0.875em";
    try {
      range.surroundContents(span);
    } catch {
      document.execCommand("fontSize", false, delta > 0 ? "5" : "2");
    }
    emit();
  };

  const empty = !value || value === "<br>" || value.replace(/<[^>]+>/g, "").trim() === "";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${focused ? "rgba(255,204,0,0.35)" : "rgba(255,255,255,0.12)"}`,
        background: "rgba(0,0,0,0.45)",
      }}
    >
      <div
        className="flex flex-wrap items-center gap-0.5 px-1.5 py-1.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.25)" }}
      >
        <ToolbarBtn title="Bold" onClick={() => exec("bold")}>
          <Bold size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Italic" onClick={() => exec("italic")}>
          <Italic size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Underline" onClick={() => exec("underline")}>
          <Underline size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Strikethrough" onClick={() => exec("strikeThrough")}>
          <Strikethrough size={14} strokeWidth={2.5} />
        </ToolbarBtn>

        <ToolbarSep />

        <ToolbarBtn title="Bulleted list" onClick={() => exec("insertUnorderedList")}>
          <List size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Numbered list" onClick={() => exec("insertOrderedList")}>
          <ListOrdered size={14} strokeWidth={2.5} />
        </ToolbarBtn>

        <ToolbarSep />

        <ToolbarBtn title="Highlight color" onClick={() => bgRef.current?.click()}>
          <Highlighter size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <input
          ref={bgRef}
          type="color"
          className="sr-only"
          defaultValue="#FFF59D"
          onChange={(e) => exec("hiliteColor", e.target.value)}
        />
        <ToolbarBtn title="Text color" onClick={() => fgRef.current?.click()}>
          <Palette size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <input
          ref={fgRef}
          type="color"
          className="sr-only"
          defaultValue="#1A1A1A"
          onChange={(e) => exec("foreColor", e.target.value)}
        />
        <ToolbarBtn title="Increase text size" onClick={() => changeFontSize(1)}>
          <span className="flex items-center gap-0">
            <ALargeSmall size={13} strokeWidth={2.5} />
            <ChevronUp size={10} strokeWidth={3} />
          </span>
        </ToolbarBtn>
        <ToolbarBtn title="Decrease text size" onClick={() => changeFontSize(-1)}>
          <span className="flex items-center gap-0">
            <ALargeSmall size={11} strokeWidth={2.5} />
            <ChevronDown size={10} strokeWidth={3} />
          </span>
        </ToolbarBtn>

        <ToolbarSep />

        <ToolbarBtn title="Block quote" onClick={() => exec("formatBlock", "blockquote")}>
          <Quote size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Insert link" onClick={insertLink}>
          <Link size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        <ToolbarBtn title="Inline code" onClick={insertCode}>
          <Code size={14} strokeWidth={2.5} />
        </ToolbarBtn>
        {onUpload ? (
          <>
            <ToolbarBtn title="Insert image" onClick={() => fileRef.current?.click()}>
              <Image size={14} strokeWidth={2.5} />
            </ToolbarBtn>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await onUpload(file);
                await insertImage(url);
                e.currentTarget.value = "";
              }}
            />
          </>
        ) : (
          <ToolbarBtn
            title="Insert image"
            onClick={() => {
              const url = window.prompt("Image URL", "https://");
              if (url) void insertImage(url);
            }}
          >
            <Image size={14} strokeWidth={2.5} />
          </ToolbarBtn>
        )}
      </div>

      <div className="relative">
        {empty && !focused ? (
          <div
            className="absolute top-3 left-3 text-sm pointer-events-none select-none"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            {placeholder}
          </div>
        ) : null}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="cms-rich-editor px-3 py-2.5 text-sm outline-none overflow-y-auto"
          style={{
            ...inputStyle,
            border: "none",
            background: "transparent",
            minHeight,
            maxHeight: 320,
            fontWeight: heading ? 700 : undefined,
            fontSize: heading ? "1.125rem" : undefined,
          }}
        />
      </div>
    </div>
  );
}

/** Shorthand for CMS form fields — passes upload when available */
export function CmsRichText({
  value,
  onChange,
  rows = 3,
  onUpload,
  heading,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  onUpload?: (file: File) => Promise<string>;
  heading?: boolean;
  placeholder?: string;
}) {
  return (
    <RichTextEditor
      value={value}
      onChange={onChange}
      minHeight={Math.max(44, rows * 26)}
      onUpload={onUpload}
      heading={heading}
      placeholder={placeholder}
    />
  );
}
