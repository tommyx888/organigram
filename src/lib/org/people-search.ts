/**
 * Vyhľadávanie ľudí v organigrame: meno, os. číslo, pozícia, oddelenie, e-mail.
 * Ignoruje diakritiku a hodnotí zhody (presné / začiatok slova / podreťazec).
 */

import type { EmployeeRecord } from "./types";

export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function fieldScore(field: string, token: string): number {
  const n = normalizeForSearch(field);
  if (!n || !token) return 0;
  if (n === token) return 100;
  if (n.startsWith(token)) return 85;
  const parts = n.split(/[^a-z0-9]+/).filter(Boolean);
  if (parts.some((p) => p === token)) return 80;
  if (parts.some((p) => p.startsWith(token))) return 70;
  if (n.includes(token)) return 40;
  return 0;
}

export type PersonSearchHit = {
  employee: EmployeeRecord;
  score: number;
};

export function searchEmployees(
  employees: EmployeeRecord[],
  query: string,
  limit = 25,
): PersonSearchHit[] {
  const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const hits: PersonSearchHit[] = [];
  for (const employee of employees) {
    let score = 0;
    let matched = true;
    for (const token of tokens) {
      const best = Math.max(
        fieldScore(employee.fullName, token),
        fieldScore(employee.employeeId, token) * 1.05,
        fieldScore(employee.positionName, token) * 0.75,
        fieldScore(employee.department, token) * 0.45,
        fieldScore(employee.departmentName ?? "", token) * 0.55,
        fieldScore(employee.oddelenie ?? "", token) * 0.45,
        fieldScore(employee.email ?? "", token) * 0.7,
        fieldScore(employee.kat ?? "", token) * 0.35,
      );
      if (best === 0) {
        matched = false;
        break;
      }
      score += best;
    }
    if (matched) hits.push({ employee, score });
  }

  hits.sort(
    (a, b) =>
      b.score - a.score || a.employee.fullName.localeCompare(b.employee.fullName, "sk"),
  );
  return hits.slice(0, limit);
}

export function findEmployeeByEmail(
  employees: EmployeeRecord[],
  email: string | null | undefined,
): EmployeeRecord | null {
  const needle = email?.trim().toLowerCase();
  if (!needle) return null;
  return employees.find((e) => e.email?.trim().toLowerCase() === needle) ?? null;
}

export function matchesSearchHaystack(haystack: string, query: string): boolean {
  const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const n = normalizeForSearch(haystack);
  return tokens.every((token) => n.includes(token));
}
