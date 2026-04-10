import { supabaseClient } from "@/lib/supabase/client";

export type OverrideRow = { employee_id: string; override_parent_id: string };

// Backward compat alias pre sekcie
export type SectionMemberRow = { employee_id: string; section_id: string };

async function getAuthToken(): Promise<string | null> {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Nacita vsetky chart overrides (sekcie + vacancy + ine) */
export async function fetchSectionMembers(): Promise<SectionMemberRow[]> {
  const token = await getAuthToken();
  if (!token) return [];
  const res = await fetch("/api/org/chart-overrides", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const rows = await res.json() as OverrideRow[];
  // Konvertuj na SectionMemberRow format pre backward compat
  return rows.map((r) => ({ employee_id: r.employee_id, section_id: r.override_parent_id }));
}

/** Ulozi (nahradi) cely zoznam overrides */
async function saveOverrides(overrides: OverrideRow[]): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  const res = await fetch("/api/org/chart-overrides", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ overrides }),
  });
  return res.ok;
}

function toOverrideRows(members: SectionMemberRow[]): OverrideRow[] {
  return members.map((m) => ({ employee_id: m.employee_id, override_parent_id: m.section_id }));
}

export async function addEmployeeToSection(
  employeeId: string,
  sectionId: string,
  currentMembers: SectionMemberRow[],
): Promise<SectionMemberRow[]> {
  const filtered = currentMembers.filter((m) => m.employee_id !== employeeId);
  const next = [...filtered, { employee_id: employeeId, section_id: sectionId }];
  await saveOverrides(toOverrideRows(next));
  return next;
}

export async function removeEmployeeFromSection(
  employeeId: string,
  currentMembers: SectionMemberRow[],
): Promise<SectionMemberRow[]> {
  const next = currentMembers.filter((m) => m.employee_id !== employeeId);
  await saveOverrides(toOverrideRows(next));
  return next;
}

export async function removeSectionAllMembers(
  sectionId: string,
  currentMembers: SectionMemberRow[],
): Promise<SectionMemberRow[]> {
  const next = currentMembers.filter((m) => m.section_id !== sectionId);
  await saveOverrides(toOverrideRows(next));
  return next;
}

/**
 * Prirad zamestnanca pod vacancy alebo ineho rodica (universal override).
 * Pouziva sa ked admin zmeni nadriadeného zamestnanca v detail paneli.
 */
export async function setEmployeeParentOverride(
  employeeId: string,
  newParentId: string | null,
  currentMembers: SectionMemberRow[],
): Promise<SectionMemberRow[]> {
  const filtered = currentMembers.filter((m) => m.employee_id !== employeeId);
  const next = newParentId
    ? [...filtered, { employee_id: employeeId, section_id: newParentId }]
    : filtered;
  await saveOverrides(toOverrideRows(next));
  return next;
}