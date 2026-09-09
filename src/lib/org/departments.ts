import { isSectionId, isVacancyId } from "@/lib/org/hierarchy-settings";
import { STREDISKO_NAMES } from "@/lib/org/stredisko-names";
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

/** Názvy v STREDISKO_NAMES, ktoré sa líšia od kľúčov MAIN_DEPARTMENTS. */
const DEPARTMENT_ALIASES: Record<string, string> = {
  logistic: "logistics",
  programe: "program",
  programme: "program",
};

function normalizeDepartmentKey(value: string): string {
  const key = value.trim().toLowerCase();
  return DEPARTMENT_ALIASES[key] ?? key;
}

function fieldMatchesDepartment(value: string | null | undefined, departmentKey: string): boolean {
  if (!value) return false;
  return normalizeDepartmentKey(value) === normalizeDepartmentKey(departmentKey);
}

export function employeeBelongsToDepartment(record: EmployeeRecord, departmentKey: string): boolean {
  if (!departmentKey || departmentKey === "all") return true;
  const fromStredisko = record.department ? STREDISKO_NAMES[record.department] : undefined;
  return (
    fieldMatchesDepartment(record.departmentName, departmentKey) ||
    fieldMatchesDepartment(record.oddelenie, departmentKey) ||
    fieldMatchesDepartment(record.department, departmentKey) ||
    fieldMatchesDepartment(fromStredisko, departmentKey)
  );
}

function departmentHeadRank(record: EmployeeRecord): number {
  const title = record.positionName.toLowerCase();
  if (title.includes("manager") || title.includes("manažér") || title.includes("manazer")) return 0;
  if (title.includes("leader") || title.includes("vedúci") || title.includes("veduci")) return 1;
  return 2;
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
  const pool = heads.length > 0 ? heads : members;
  pool.sort((a, b) => departmentHeadRank(a) - departmentHeadRank(b) || a.fullName.localeCompare(b.fullName));
  return pool[0].employeeId;
}

/**
 * Pohľad oddelenia: nechaj internú hierarchiu, ale ľudí z oddelenia,
 * ktorí reportujú mimo neho, zaves pod koreň oddelenia.
 */
export function scopeHierarchyToDepartment(
  hierarchy: Map<string, string[]>,
  records: EmployeeRecord[],
  departmentKey: string,
  rootId: string,
): Map<string, string[]> {
  const memberIds = new Set(
    records.filter((r) => employeeBelongsToDepartment(r, departmentKey)).map((r) => r.employeeId),
  );
  memberIds.add(rootId);

  const parentOf = new Map<string, string>();
  for (const [parent, kids] of hierarchy) {
    for (const kid of kids) parentOf.set(kid, parent);
  }

  const keep = new Set(memberIds);
  for (const id of memberIds) {
    let current = parentOf.get(id);
    while (current && current !== "__root" && current !== "root") {
      if (memberIds.has(current) || current === rootId) break;
      if (isSectionId(current) || isVacancyId(current)) {
        keep.add(current);
        current = parentOf.get(current);
        continue;
      }
      break;
    }
  }

  const next = new Map<string, string[]>();
  const add = (parent: string, child: string) => {
    if (!parent || parent === child) return;
    const list = next.get(parent) ?? [];
    if (!list.includes(child)) list.push(child);
    next.set(parent, list);
  };

  for (const [parent, kids] of hierarchy) {
    if (!keep.has(parent) && parent !== rootId) continue;
    for (const kid of kids) {
      if (!keep.has(kid) || kid === rootId) continue;
      add(parent, kid);
    }
  }

  for (const id of keep) {
    if (id === rootId) continue;
    const parent = parentOf.get(id);
    if (parent && keep.has(parent) && parent !== "__root") continue;
    add(rootId, id);
  }

  return next;
}
