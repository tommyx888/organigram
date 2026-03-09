/**
 * Serializácia stavu pohľadu organigramu do URL (zdieľateľný odkaz).
 * Stav: viewport (x, y, zoom) + zoznam zbavených node ID.
 */

export type ShareableViewState = {
  viewport?: { x: number; y: number; zoom: number };
  collapsedNodes?: string[];
};

const PARAM_NAME = "v";

function base64UrlEncode(str: string): string {
  if (typeof btoa === "undefined") return "";
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  if (typeof atob === "undefined") return "";
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "====".slice(0, 4 - pad);
  return atob(s);
}

/**
 * Zakóduje stav pohľadu do URL-safe reťazca (base64url JSON).
 */
export function encodeShareableViewState(state: ShareableViewState): string {
  try {
    const json = JSON.stringify(state);
    return base64UrlEncode(encodeURIComponent(json));
  } catch {
    return "";
  }
}

/**
 * Dekóduje stav z query parametra. Pri chybe vráti null.
 */
export function decodeShareableViewState(encoded: string | null): ShareableViewState | null {
  if (!encoded || typeof encoded !== "string") return null;
  try {
    const json = decodeURIComponent(base64UrlDecode(encoded));
    const parsed = JSON.parse(json) as ShareableViewState;
    if (!parsed || typeof parsed !== "object") return null;
    const viewport = parsed.viewport;
    if (viewport != null) {
      if (
        typeof viewport.x !== "number" ||
        typeof viewport.y !== "number" ||
        typeof viewport.zoom !== "number"
      ) {
        return null;
      }
    }
    if (parsed.collapsedNodes != null && !Array.isArray(parsed.collapsedNodes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Z aktuálnej URL vyberie parameter `v` a dekóduje stav.
 */
export function getShareableViewStateFromSearch(search: string): ShareableViewState | null {
  const params = new URLSearchParams(search);
  const v = params.get(PARAM_NAME);
  return decodeShareableViewState(v);
}

/**
 * Vytvorí absolútnu URL na org-chart s daným stavom pohľadu.
 */
export function buildShareUrl(pathname: string, state: ShareableViewState): string {
  const encoded = encodeShareableViewState(state);
  if (!encoded) return pathname;
  const url = new URL(pathname, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  url.searchParams.set(PARAM_NAME, encoded);
  return url.pathname + url.search;
}
