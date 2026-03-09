/**
 * Ukladanie fotiek zamestnancov (employeeId → data URL) do localStorage.
 * Používa sa pre zobrazenie fotky v bunkách organigramu.
 */

const STORAGE_KEY = "org-chart-employee-photos";

export function loadEmployeePhotos(): Record<string, string> {
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

export function saveEmployeePhoto(employeeId: string, dataUrl: string): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadEmployeePhotos();
    const next = { ...prev, [employeeId]: dataUrl };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function removeEmployeePhoto(employeeId: string): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadEmployeePhotos();
    const next = { ...prev };
    delete next[employeeId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}
