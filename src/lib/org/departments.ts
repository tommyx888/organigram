import type { EmployeeRecord } from "@/lib/org/types";

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
  "Purchase",
  "CI",
  "Business",
  "Program",
] as const;

export type MainDepartmentKey = (typeof MAIN_DEPARTMENTS)[number];

export const MAIN_DEPARTMENTS_SET = new Set<string>(MAIN_DEPARTMENTS);

export function isMainDepartment(value: string): value is MainDepartmentKey {
  return MAIN_DEPARTMENTS_SET.has(value);
}

function fieldMatchesDepartment(value: string | null | undefined, departmentKey: string): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === departmentKey.trim().toLowerCase();
}

export function employeeBelongsToDepartment(record: EmployeeRecord, departmentKey: string): boolean {
  if (!departmentKey || departmentKey === "all") return true;
  return (
    fieldMatchesDepartment(record.departmentName, departmentKey) ||
    fieldMatchesDepartment(record.oddelenie, departmentKey) ||
    fieldMatchesDepartment(record.department, departmentKey)
  );
}

/** Najvyšší človek v oddelení, ak admin ešte nenastavil department managera. */
export function findDepartmentHeadEmployeeId(
  records: EmployeeRecord[],
  departmentKey: string,
): string | null {
  const members = records.filter((r) => employeeBelongsToDepartment(r, departmentKey));
  if (members.length === 0) return null;
  const ids = new Set(members.map((r) => r.employeeId));
  const heads = members.filter((r) => !r.managerEmployeeId || !ids.has(r.managerEmployeeId));
  return (heads[0] ?? members[0]).employeeId;
}
