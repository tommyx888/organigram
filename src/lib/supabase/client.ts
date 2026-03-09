import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabasePublicConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const isSupabaseConfigured = isSupabasePublicConfigured;

if (!supabaseUrl || !supabaseAnonKey) {
  // This guard helps during local setup before envs are configured.
  console.warn("Supabase environment variables are missing.");
}

export const supabaseClient =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function resolveActiveCompanyId(): Promise<string | null> {
  if (!supabaseClient) {
    return null;
  }

  const { data: roleRow, error: roleError } = await supabaseClient
    .from("user_company_roles")
    .select("company_id")
    .limit(1)
    .maybeSingle();

  if (!roleError && roleRow?.company_id) {
    return roleRow.company_id;
  }

  const { data: companyRows } = await supabaseClient
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  return companyRows?.[0]?.id ?? null;
}
