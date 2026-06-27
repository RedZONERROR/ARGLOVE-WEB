import type { ProductResource } from "../services/api";
import type { GalleryItem } from "../components/ImageZoomGallery";

export function formatProductImage(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function resourcesToGallery(resources: ProductResource[]): GalleryItem[] {
  return resources.map((r) => ({
    id: r.id,
    url: formatProductImage(r.file_url),
    type: r.file_role === "video" || r.mime_type?.startsWith("video/") ? "video" : "image",
    alt: r.file_name,
  }));
}
