/**
 * Typy pre verejný náhľad organigramu (zdieľateľný odkaz pre ľudí mimo organizácie).
 * Payload obsahuje iba aktívnych zamestnancov podľa scope odkazu a bezpečné polia.
 */

export type PublicOrgScope = "salaried" | "salaried_indirect";

export const PUBLIC_ORG_SCOPES: PublicOrgScope[] = ["salaried", "salaried_indirect"];

export function isPublicOrgScope(value: unknown): value is PublicOrgScope {
  return value === "salaried" || value === "salaried_indirect";
}

export type PublicOrgPersonType = "salaried" | "indirect";

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
