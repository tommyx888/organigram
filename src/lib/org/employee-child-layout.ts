/**
 * Per-node nastavenie, ako zobrazovať podriadených pod daným manažérom:
 * row = vedľa seba v jednej línii, pairs = v dvoch stĺpcoch (páry), fours = v sekciách po 4.
 * Ukladá sa do localStorage (nodeId = employeeId alebo vacancy id).
 */

export type ChildLayoutStyle = "row" | "pairs" | "fours";

const STORAGE_KEY = "org-chart-employee-child-layout";

export function loadChildLayoutByNodeId(): Record<string, ChildLayoutStyle> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (typeof parsed !== "object" || parsed === null) return {};
    const result: Record<string, ChildLayoutStyle> = {};
    const valid: ChildLayoutStyle[] = ["row", "pairs", "fours"];
    for (const [id, v] of Object.entries(parsed)) {
      if (typeof v === "string" && valid.includes(v as ChildLayoutStyle)) {
        result[id] = v as ChildLayoutStyle;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function saveChildLayout(nodeId: string, style: ChildLayoutStyle): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadChildLayoutByNodeId();
    const next = { ...prev, [nodeId]: style };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function removeChildLayout(nodeId: string): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadChildLayoutByNodeId();
    const next = { ...prev };
    delete next[nodeId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}
