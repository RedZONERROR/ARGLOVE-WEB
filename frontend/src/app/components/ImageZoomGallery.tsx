import React, { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, ZoomIn } from "lucide-react";

export type GalleryItem = {
  id?: number;
  url: string;
  type: "image" | "video";
  alt?: string;
};

type Props = {
  items: GalleryItem[];
  discountPct?: number;
};

const GOLD_BORDER = "1px solid rgba(212,175,55,0.25)";

export default function ImageZoomGallery({ items, discountPct }: Props) {
  const [index, setIndex] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  const safeItems = items.length > 0 ? items : [{ url: "", type: "image" as const, alt: "Product" }];
  const current = safeItems[Math.min(index, safeItems.length - 1)];

  const prev = () => setIndex((i) => (i - 1 + safeItems.length) % safeItems.length);
  const next = () => setIndex((i) => (i + 1) % safeItems.length);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || current.type === "video") return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setZoomPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    },
    [current.type],
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef}
        className="relative rounded-3xl overflow-hidden aspect-square"
        style={{ background: "#FFF9E6", border: GOLD_BORDER, boxShadow: "0 24px 80px rgba(0,0,0,0.08)" }}
        onMouseEnter={() => current.type === "image" && current.url && setZooming(true)}
        onMouseLeave={() => setZooming(false)}
        onMouseMove={onMouseMove}
      >
        {discountPct && discountPct > 0 ? (
          <span
            className="absolute top-4 right-4 z-10 text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 rounded-full"
            style={{ background: "#FFCC00", color: "#1A1A1A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Save {discountPct}%
          </span>
        ) : null}

        {safeItems.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "rgba(255,255,255,0.96)", border: GOLD_BORDER, color: "#1A1A1A", cursor: "pointer" }}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "rgba(255,255,255,0.96)", border: GOLD_BORDER, color: "#1A1A1A", cursor: "pointer" }}
            >
              <ChevronRight size={20} />
            </button>
          </>
        ) : null}

        {current.type === "video" && current.url ? (
          <video src={current.url} controls className="w-full h-full object-contain bg-black" />
        ) : current.url ? (
          <>
            <img
              src={current.url}
              alt={current.alt || "Product"}
              className="w-full h-full object-contain transition-opacity duration-200"
              style={{ opacity: zooming ? 0 : 1 }}
            />
            {zooming ? (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `url(${current.url})`,
                  backgroundSize: "200%",
                  backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                  backgroundRepeat: "no-repeat",
                }}
              />
            ) : null}
            <div className="absolute bottom-3 left-3 flex gap-2">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.96)", border: GOLD_BORDER, color: "#D4AF37" }}
              >
                <ZoomIn size={16} />
              </span>
              {safeItems.some((i) => i.type === "video") ? (
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.96)", border: GOLD_BORDER, color: "#D4AF37" }}
                >
                  <Play size={16} />
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: "#D4AF37" }}>
            No image
          </div>
        )}
      </div>

      {safeItems.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {safeItems.map((item, i) => (
            <button
              key={item.id ?? i}
              type="button"
              onClick={() => setIndex(i)}
              className="shrink-0 w-20 h-20 rounded-2xl overflow-hidden transition-all"
              style={{
                border: i === index ? "2px solid #D4AF37" : GOLD_BORDER,
                boxShadow: i === index ? "0 4px 16px rgba(212,175,55,0.25)" : "none",
                cursor: "pointer",
                background: "#FFF9E6",
              }}
            >
              {item.type === "video" ? (
                <div className="w-full h-full flex items-center justify-center" style={{ background: "#1A1A1A", color: "#FFCC00" }}>
                  <Play size={20} />
                </div>
              ) : (
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
