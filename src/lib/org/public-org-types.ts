/**
 * Typy pre verejný náhľad organigramu (zdieľateľný odkaz pre ľudí mimo organizácie).
 * Payload obsahuje iba aktívnych zamestnancov podľa scope odkazu a bezpečné polia.
 */

import { STREDISKO_NAMES } from "./stredisko-names";

export type PublicOrgScope = "salaried" | "salaried_indirect";

export const PUBLIC_ORG_SCOPES: PublicOrgScope[] = ["salaried", "salaried_indirect"];

export function isPublicOrgScope(value: unknown): value is PublicOrgScope {
  return value === "salaried" || value === "salaried_indirect";
}

export type PublicOrgPersonType = "salaried" | "indirect";

export const PUBLIC_EXPORT_LEADERSHIP = "__leadership__";

export type PublicCardFieldId = "photo" | "name" | "position" | "department" | "typeLabel";

export type PublicOrgCardFields = Record<PublicCardFieldId, boolean>;

export const PUBLIC_CARD_FIELD_KEYS: PublicCardFieldId[] = [
  "photo",
  "name",
  "position",
  "department",
  "typeLabel",
];

export const PUBLIC_CARD_FIELD_LABELS: Record<PublicCardFieldId, string> = {
  photo: "Fotka",
  name: "Meno",
  position: "Pozícia",
  department: "Oddelenie",
  typeLabel: "Typ (SAL / Indirect)",
};

export function defaultPublicCardFields(scope: PublicOrgScope): PublicOrgCardFields {
  return {
    photo: true,
    name: true,
    position: true,
    department: true,
    typeLabel: scope === "salaried_indirect",
  };
}

export function parsePublicCardFields(value: unknown, scope: PublicOrgScope): PublicOrgCardFields {
  const base = defaultPublicCardFields(scope);
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const raw = value as Record<string, unknown>;
  for (const key of PUBLIC_CARD_FIELD_KEYS) {
    if (typeof raw[key] === "boolean") base[key] = raw[key];
  }
  return base;
}

/** null = všetky oddelenia (staré odkazy). */
export function parseExportDepartments(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const codes = value.map((v) => String(v).trim()).filter(Boolean);
  return codes.length ? codes : [];
}

export function publicExportDepartmentOptions(): { code: string; name: string }[] {
  return [
    { code: PUBLIC_EXPORT_LEADERSHIP, name: "Vedenie spoločnosti" },
    ...Object.entries(STREDISKO_NAMES)
      .filter(([code]) => code !== "90")
      .map(([code, name]) => ({ code, name })),
  ];
}

export type PublicOrgPerson = {
  /** Interné id na stavbu stromu (os_c). Nezobrazuje sa v UI. */
  id: string;
  name: string;
  position: string;
  /** Číslo strediska (napr. "70"). */
  department: string;
  /** Názov strediska (napr. "HR & HSE"). */
  departmentName: string | null;
  /** Id nadriadeného (iba ak je tiež v zobrazenom sete), inak null. */
  managerId: string | null;
  photoUrl: string | null;
  /** Voľná pozícia (vacancy) – zobrazuje sa ako otvorená pozícia, nie osoba. */
  isVacancy?: boolean;
  /** Typ osoby v náhľade (pre SAL + Indirect). */
  personType?: PublicOrgPersonType;
};

export type PublicOrgPayload = {
  companyName: string;
  generatedAt: string;
  people: PublicOrgPerson[];
  /** Ak chýba (staré odkazy), ide o SAL-only náhľad. */
  scope?: PublicOrgScope;
  /** null / chýba = všetky oddelenia. Inak kódy stredísk + __leadership__. */
  departments?: string[] | null;
  cardFields?: PublicOrgCardFields;
};

export function matchesPublicOrgScope(
  record: { kat?: string | null; positionType?: string | null },
  scope: PublicOrgScope,
): boolean {
  const isSalaried = record.kat === "SAL" || record.positionType === "salaried";
  const isIndirect =
    record.kat === "INDIR2" ||
    record.kat === "INDIR3" ||
    record.positionType === "indirect";
  if (scope === "salaried_indirect") return isSalaried || isIndirect;
  return isSalaried;
}

export function publicPersonType(
  record: { kat?: string | null; positionType?: string | null },
): PublicOrgPersonType {
  if (record.kat === "SAL" || record.positionType === "salaried") return "salaried";
  return "indirect";
}
