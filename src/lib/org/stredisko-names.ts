/**
 * Mapovanie čísla strediska (str) na názov oddelenia (odd).
 * Používa sa na zobrazenie názvov stredísk v organigrame, ak nie sú z dát zamestnancov.
 */
export const STREDISKO_NAMES: Record<string, string> = {
  "10": "Production",
  "20": "Maintenance",
  "30": "Logistic",
  "40": "Quality",
  "50": "Technical",
  "60": "IT",
  "70": "HR & HSE",
  "80": "Finance",
  "90": "Management",
  "91": "CI",
  "95": "Business",
  "98": "Programe",
};

/**
 * Pôvodné strediská (11, 13, 14, …), ktoré sa zlučujú do jedného strediska 10 „Production“.
 * Pri načítaní dát sa department týchto zamestnancov nastaví na "10" s názvom "Production".
 */
export const PRODUCTION_COLLAPSED_STREDISKA: ReadonlySet<string> = new Set([
  "11", "13", "14", "15", "17", "18", "23", "34", "35", "36", "37", "38", "39", "42",
]);

/** Strediská patriace pod oddelenie Production (po zlúčení je to len stredisko 10). */
export const STREDISKA_POD_ODDELENIM_PRODUCTION: ReadonlySet<string> = new Set(["10"]);

/** Mapovanie stredisko id → názov nadradeného oddelenia (napr. Production). */
export const ODDELENIE_BY_STREDISKO: Record<string, string> = Object.fromEntries(
  [...STREDISKA_POD_ODDELENIM_PRODUCTION].map((id) => [id, "Production"])
);

/**
 * Vráti názov oddelenia, pod ktoré stredisko patrí (napr. "Production"), alebo null.
 */
export function getOddelenieForStredisko(strediskoId: string): string | null {
  return ODDELENIE_BY_STREDISKO[strediskoId] ?? null;
}

/**
 * Vráti zobrazený názov pre stredisko: z dát zamestnancov alebo z mapovania STREDISKO_NAMES.
 */
export function getStrediskoDisplayName(
  departmentKey: string,
  fromEmployees: string | null | undefined
): string | null {
  const fromData = fromEmployees?.trim() || null;
  if (fromData) return fromData;
  return STREDISKO_NAMES[departmentKey] ?? null;
}
