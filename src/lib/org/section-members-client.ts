import { supabaseClient } from "@/lib/supabase/client";

export type SectionMemberRow = { employee_id: string; section_id: string };

async function getAuthToken(): Promise<string | null> {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Nacita vsetky section member overrides pre aktualnnu company */
export async function fetchSectionMembers(): Promise<SectionMemberRow[]> {
  const token = await getAuthToken();
  if (!token) return [];
  const res = await fetch("/api/org/section-members", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json() as Promise<SectionMemberRow[]>;
}

/** Ulozi (nahradi) cely zoznam section members */
export async function saveSectionMembers(members: SectionMemberRow[]): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  const res = await fetch("/api/org/section-members", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ members }),
  });
  return res.ok;
}

/**
 * Prida zamestnanca do sekcie (ulozi override).
 * Ak uz bol v inej sekcii, ta sa prepise.
 */
export async function addEmployeeToSection(
  employeeId: string,
  sectionId: string,
  currentMembers: SectionMemberRow[],
): Promise<SectionMemberRow[]> {
  const filtered = currentMembers.filter((m) => m.employee_id !== employeeId);
  const next = [...filtered, { employee_id: employeeId, section_id: sectionId }];
  await saveSectionMembers(next);
  return next;
}

/**
 * Odoberie zamestnanca zo sekcie (zrusi override).
 */
export async function removeEmployeeFromSection(
  employeeId: string,
  currentMembers: SectionMemberRow[],
): Promise<SectionMemberRow[]> {
  const next = currentMembers.filter((m) => m.employee_id !== employeeId);
  await saveSectionMembers(next);
  return next;
}

/**
 * Odoberie vsetkych clenov danej sekcie (pri mazani sekcie).
 */
export async function removeSectionAllMembers(
  sectionId: string,
  currentMembers: SectionMemberRow[],
): Promise<SectionMemberRow[]> {
  const next = currentMembers.filter((m) => m.section_id !== sectionId);
  await saveSectionMembers(next);
  return next;
}