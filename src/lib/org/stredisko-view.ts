/**
 * Nastavenia zobrazenia stredísk: viditeľné oddelenia, vlastné (vytvorené) strediská, farby buniek.
 */

export type CustomStredisko = { id: string; name: string };

const STORAGE_VISIBLE = "org-chart-visible-strediska";
const STORAGE_CUSTOM = "org-chart-custom-strediska";
const STORAGE_COLORS = "org-chart-stredisko-colors";
const STORAGE_HIDDEN = "org-chart-hidden-strediska";

/** Ak null, zobrazujú sa všetky. Ak pole, len tieto ID. */
export function loadVisibleStrediska(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_VISIBLE);
    if (!raw || raw === "all") return null;
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

export function saveVisibleStrediska(value: string[] | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_VISIBLE, value === null ? "all" : JSON.stringify(value));
  } catch {}
}

/** Vlastné strediská (bez zamestnancov z dát). */
export function loadCustomStrediska(): CustomStredisko[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CustomStredisko[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveCustomStrediska(value: CustomStredisko[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(value));
  } catch {}
}

/** Farby buniek stredísk (department id -> hex). */
export function loadStrediskoColors(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_COLORS);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, string>;
    return typeof o === "object" && o !== null ? o : {};
  } catch {
    return {};
  }
}

export function saveStrediskoColors(value: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_COLORS, JSON.stringify(value));
  } catch {}
}

/** Skryté strediská (ID ktoré sa nezobrazia vôbec). */
export function loadHiddenStrediska(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_HIDDEN);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function saveHiddenStrediska(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_HIDDEN, JSON.stringify([...set]));
  } catch {}
}
