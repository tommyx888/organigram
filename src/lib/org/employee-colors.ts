/**
 * Ukladanie farieb kariet zamestnancov (employeeId → hex) do localStorage.
 * Používa sa v detaile bunky a pre akcent karty v organigrame.
 */

const STORAGE_KEY = "org-chart-employee-colors";

export function loadEmployeeColors(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveEmployeeColor(employeeId: string, hex: string): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadEmployeeColors();
    const next = { ...prev, [employeeId]: hex };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function removeEmployeeColor(employeeId: string): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadEmployeeColors();
    const next = { ...prev };
    delete next[employeeId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}
