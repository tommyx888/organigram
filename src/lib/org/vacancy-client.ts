import { supabaseClient } from "@/lib/supabase/client";
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

/** Nacita vsetky vacancies z DB */
export async function fetchVacanciesFromDb(): Promise<VacancyPlaceholder[]> {
  const token = await getToken();
  if (!token) return [];
  const res = await fetch("/api/org/vacancies", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const rows = await res.json() as VacancyDbRow[];
  return rows.map((r) => ({
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
