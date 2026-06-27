import type { MouseEvent } from "react";

/** Client-side navigation that preserves in-memory React state (e.g. auth). */
export function spaNavigate(path: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function spaNavigateClick(e: MouseEvent, path: string) {
  e.preventDefault();
  spaNavigate(path);
}
