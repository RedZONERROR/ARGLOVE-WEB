import React from "react";
import { GripVertical, Pencil, Trash2, Plus } from "lucide-react";

type Props = {
  id: string;
  label: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove?: () => void;
  onAddBelow?: () => void;
  removable?: boolean;
  global?: boolean;
  children: React.ReactNode;
};

export default function EditableSection({
  id,
  label,
  selected,
  onSelect,
  onRemove,
  onAddBelow,
  removable = false,
  global: isGlobal = false,
  children,
}: Props) {
  return (
    <div className="relative group" data-editor-section={id}>
      <div
        className="absolute inset-0 z-20 cursor-pointer transition-all"
        style={{
          outline: selected ? "2px solid #22c55e" : undefined,
          outlineOffset: -2,
          boxShadow: selected ? "inset 0 0 0 9999px rgba(34,197,94,0.06)" : undefined,
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(id);
        }}
      />

      {(selected || undefined) && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-1 rounded-md shadow-lg"
          style={{ top: -14, background: "#22c55e", color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em" }}
        >
          <GripVertical size={12} />
          {isGlobal ? "GLOBAL · " : "SECTION · "}{label.toUpperCase()}
        </div>
      )}

      {selected && (
        <div
          className="absolute top-3 right-3 z-30 flex items-center gap-1 rounded-lg overflow-hidden shadow-lg"
          style={{ background: "#1A1A1A" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Edit in sidebar"
            className="p-2 hover:bg-white/10"
            style={{ color: "#fff", border: "none", cursor: "pointer", background: "transparent" }}
            onClick={() => onSelect(id)}
          >
            <Pencil size={14} />
          </button>
          {removable && onRemove ? (
            <button
              type="button"
              title="Remove section"
              className="p-2 hover:bg-red-500/20"
              style={{ color: "#fca5a5", border: "none", cursor: "pointer", background: "transparent" }}
              onClick={onRemove}
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      )}

      <div style={{ pointerEvents: "none" }}>{children}</div>

      {onAddBelow ? (
        <div className="relative z-20 flex justify-center py-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddBelow();
            }}
            className="flex items-center gap-1 px-4 py-2 rounded-full text-xs font-bold tracking-wider"
            style={{ background: "#1A1A1A", color: "#fff", border: "none", cursor: "pointer" }}
          >
            <Plus size={14} /> ADD SECTION
          </button>
        </div>
      ) : null}
    </div>
  );
}
