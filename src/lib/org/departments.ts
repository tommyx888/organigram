/**
 * Hlavné oddelenia pre prepínanie pohľadu organigramu.
 * Používateľ môže pre každé oddelenie nastaviť manažéra a preklikávať zobrazenie.
 */
export const MAIN_DEPARTMENTS = [
  "Production",
  "Maintenance",
  "Logistics",
  "Quality",
  "Technical",
  "IT",
  "HR & HSE",
  "Finance",
  "Business",
  "Program",
] as const;

export type MainDepartmentKey = (typeof MAIN_DEPARTMENTS)[number];

export const MAIN_DEPARTMENTS_SET = new Set<string>(MAIN_DEPARTMENTS);

export function isMainDepartment(value: string): value is MainDepartmentKey {
  return MAIN_DEPARTMENTS_SET.has(value);
}
