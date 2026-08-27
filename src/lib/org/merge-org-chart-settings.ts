import type { OrgChartSettingsPayload } from "@/lib/org/org-chart-settings-types";

/** Nested record keys that must be deep-merged so concurrent PATCHes do not drop sibling updates. */
const NESTED_RECORD_KEYS = [
  "appearance",
  "positions",
  "strediskoColors",
  "employeeColors",
  "employeePhotoOffsets",
  "katColors",
  "employeeChildLayout",
  "childOrderByParent",
  "departmentManagers",
] as const satisfies ReadonlyArray<keyof OrgChartSettingsPayload>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Merges a partial settings update into a base payload.
 * Arrays and scalars are replaced; nested records are shallow-merged per key.
 */
export function mergeSettingsPartial<T extends Partial<OrgChartSettingsPayload>>(
  base: T | null | undefined,
  incoming: Partial<OrgChartSettingsPayload>,
): T & Partial<OrgChartSettingsPayload> {
  const next = { ...(base ?? {}), ...incoming } as T & Partial<OrgChartSettingsPayload>;
  if (!base) return next;

  for (const key of NESTED_RECORD_KEYS) {
    const existing = base[key];
    const patch = incoming[key];
    if (isPlainObject(existing) && isPlainObject(patch)) {
      (next as Record<string, unknown>)[key] = { ...existing, ...patch };
    }
  }
  return next;
}
