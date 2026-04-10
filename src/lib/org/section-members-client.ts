import { supabaseClient } from "@/lib/supabase/client";

export type OverrideRow = { employee_id: string; override_parent_id: string };

// Backward compat alias pre sekcie
export type SectionMemberRow = { employee_id: string; section_id: string };

async function getAuthToken(): Promise<string | null> {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Nacita vsetky chart overrides priamo cez Supabase JS client.
 * Funguje pre adminov aj non-adminov bez HTTP round-trip.
 */
export async function fetchSectionMembers(): Promise<SectionMemberRow[]> {
  if (!supabaseClient) return [];

  // Resolve company_id
  const { data: companyData } = await supabaseClient
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  const companyId = companyData?.[0]?.id;
  if (!companyId) return [];

  const { data, error } = await supabaseClient
    .from("org_chart_overrides")
    .select("employee_id, override_parent_id")
    .eq("company_id", companyId);

  if (error) {
    console.warn("[section-members] fetchSectionMembers error:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    employee_id: r.employee_id,
    section_id: r.override_parent_id,
  }));
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