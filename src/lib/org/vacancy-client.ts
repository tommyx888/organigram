import { supabaseClient, resolveActiveCompanyId } from "@/lib/supabase/client";
import type { VacancyPlaceholder } from "@/lib/org/types";

export type VacancyDbRow = {
  id: string;
  title: string;
  parent_id: string | null;
  color?: string | null;
  department?: string | null;
  notes?: string | null;
};

async function getToken(): Promise<string | null> {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Nacita vsetky vacancies priamo cez Supabase JS client (bez HTTP round-trip).
 * Funguje pre adminov aj non-adminov — RLS politika dovoli SELECT pre vsetkych authenticated.
 */
export async function fetchVacanciesFromDb(): Promise<VacancyPlaceholder[]> {
  if (!supabaseClient) return [];

  const companyId = await resolveActiveCompanyId();
  if (!companyId) return [];

  const { data, error } = await supabaseClient
    .from("org_vacancies")
    .select("id, title, parent_id")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[vacancies] fetchVacanciesFromDb error:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    parentId: r.parent_id,
  }));
}

/** Ulozi novu vacancy do DB */
export async function createVacancyInDb(vacancy: VacancyPlaceholder): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  const res = await fetch("/api/org/vacancies", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id: vacancy.id, title: vacancy.title, parent_id: vacancy.parentId }),
  });
  return res.ok;
}

/** Aktualizuje vacancy v DB */
export async function updateVacancyInDb(vacancy: VacancyPlaceholder): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  const res = await fetch("/api/org/vacancies", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id: vacancy.id, title: vacancy.title, parent_id: vacancy.parentId }),
  });
  return res.ok;
}

/** Zmaze vacancy z DB */
export async function deleteVacancyFromDb(vacancyId: string): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  const res = await fetch(`/api/org/vacancies?id=${encodeURIComponent(vacancyId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}
