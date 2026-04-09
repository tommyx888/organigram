/**
 * Nastavenia čistej hierarchie: General Manager (root) a vacancy (voľné pozície).
 * Ukladá sa do localStorage; neskôr môže byť presunuté do DB.
 */

import type { VacancyPlaceholder } from "@/lib/org/types";

const STORAGE_GENERAL_MANAGER = "org-chart-general-manager-id";
/** Predvolený General Manager (Janotka Andrej), kým používateľ nezmení. */
export const DEFAULT_GENERAL_MANAGER_ID = "31000154";
const STORAGE_VACANCIES = "org-chart-vacancies";
const STORAGE_MAX_VISIBLE_LAYERS = "org-chart-max-visible-layers";

/** Počet zobrazených vrstiev: 1 = len GM, 2 = GM + priama línia, … 5 = všetko. */
export type MaxVisibleLayers = 1 | 2 | 3 | 4 | 5 | 6;

const VACANCY_ID_PREFIX = "vacancy-";
const SECTION_ID_PREFIX = "section-";

export function getVacancyIdPrefix(): string {
  return VACANCY_ID_PREFIX;
}

export function generateVacancyId(): string {
  return `${VACANCY_ID_PREFIX}${crypto.randomUUID()}`;
}

export function isVacancyId(id: string): boolean {
  return id.startsWith(VACANCY_ID_PREFIX);
}

export function generateSectionId(): string {
  return `${SECTION_ID_PREFIX}${crypto.randomUUID()}`;
}

export function isSectionId(id: string): boolean {
  return id.startsWith(SECTION_ID_PREFIX);
}

export function loadGeneralManagerId(): string {
  if (typeof window === "undefined") return DEFAULT_GENERAL_MANAGER_ID;
  try {
    const raw = localStorage.getItem(STORAGE_GENERAL_MANAGER);
    if (raw === null || raw === "") return DEFAULT_GENERAL_MANAGER_ID;
    return raw;
  } catch {
    return DEFAULT_GENERAL_MANAGER_ID;
  }
}

export function saveGeneralManagerId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_GENERAL_MANAGER);
    } else {
      localStorage.setItem(STORAGE_GENERAL_MANAGER, id);
    }
  } catch {}
}

export function loadVacancies(): VacancyPlaceholder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_VACANCIES);
    if (!raw) return [];
    const arr = JSON.parse(raw) as VacancyPlaceholder[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveVacancies(value: VacancyPlaceholder[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_VACANCIES, JSON.stringify(value));
  } catch {}
}

export function addVacancy(vacancy: VacancyPlaceholder): void {
  const list = loadVacancies();
  if (list.some((v) => v.id === vacancy.id)) return;
  saveVacancies([...list, vacancy]);
}

export function updateVacancy(id: string, patch: Partial<Pick<VacancyPlaceholder, "title" | "parentId">>): void {
  const list = loadVacancies();
  const next = list.map((v) => (v.id === id ? { ...v, ...patch } : v));
  saveVacancies(next);
}

export function removeVacancy(id: string): void {
  saveVacancies(loadVacancies().filter((v) => v.id !== id));
}

const DEFAULT_MAX_VISIBLE_LAYERS: MaxVisibleLayers = 4;

export function loadMaxVisibleLayers(): MaxVisibleLayers {
  if (typeof window === "undefined") return DEFAULT_MAX_VISIBLE_LAYERS;
  try {
    const raw = localStorage.getItem(STORAGE_MAX_VISIBLE_LAYERS);
    if (raw === null) return DEFAULT_MAX_VISIBLE_LAYERS;
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= 6) return n as MaxVisibleLayers;
    return DEFAULT_MAX_VISIBLE_LAYERS;
  } catch {
    return DEFAULT_MAX_VISIBLE_LAYERS;
  }
}

export function saveMaxVisibleLayers(value: MaxVisibleLayers): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_MAX_VISIBLE_LAYERS, String(value));
  } catch {}
}

const STORAGE_CHILD_ORDER_BY_PARENT = "org-chart-child-order-by-parent";

/** Poradie priamych podriadených pod každým nadriadeným (parentId -> ordered child IDs). */
export function loadChildOrderByParent(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_CHILD_ORDER_BY_PARENT);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, string[]>;
    if (typeof o !== "object" || o === null) return {};
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(o)) {
      if (Array.isArray(v) && v.every((id) => typeof id === "string")) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveChildOrderByParent(value: Record<string, string[]>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_CHILD_ORDER_BY_PARENT, JSON.stringify(value));
  } catch {}
}
