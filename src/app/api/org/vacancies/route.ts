import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClientWithUser } from "@/lib/supabase/server";

function getToken(req: NextRequest): string | null {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

async function resolveCompanyId(supabase: ReturnType<typeof createServerSupabaseClientWithUser>) {
  if (!supabase) return null;
  const { data } = await supabase.from("companies").select("id").order("created_at", { ascending: true }).limit(1);
  return data?.[0]?.id ?? null;
}

async function checkAdmin(supabase: ReturnType<typeof createServerSupabaseClientWithUser>) {
  if (!supabase) return false;
  const { data } = await supabase.from("user_company_roles").select("role").limit(1).maybeSingle();
  return data?.role === "admin";
}

export type VacancyDbRow = {
  id: string;
  title: string;
  parent_id: string | null;
  color?: string | null;
  department?: string | null;
  notes?: string | null;
};

/** GET: vrati vsetky vacancies pre company */
export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const companyId = await resolveCompanyId(supabase);
  if (!companyId) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("org_vacancies")
    .select("id, title, parent_id, color, department, notes")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST: vytvor novu vacancy */
export async function POST(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  if (!await checkAdmin(supabase)) {
    return NextResponse.json({ error: "Only admin can create vacancies" }, { status: 403 });
  }

  const companyId = await resolveCompanyId(supabase);
  if (!companyId) return NextResponse.json({ error: "No company found" }, { status: 404 });

  let body: VacancyDbRow;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { error } = await supabase.from("org_vacancies").insert({
    id: body.id,
    company_id: companyId,
    title: body.title,
    parent_id: body.parent_id ?? null,
    color: body.color ?? null,
    department: body.department ?? null,
    notes: body.notes ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** PATCH: aktualizuj vacancy */
export async function PATCH(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  if (!await checkAdmin(supabase)) {
    return NextResponse.json({ error: "Only admin can update vacancies" }, { status: 403 });
  }

  const companyId = await resolveCompanyId(supabase);
  if (!companyId) return NextResponse.json({ error: "No company found" }, { status: 404 });

  let body: Partial<VacancyDbRow> & { id: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { id, ...patch } = body;
  const { error } = await supabase
    .from("org_vacancies")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE: zmaz vacancy */
export async function DELETE(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  if (!await checkAdmin(supabase)) {
    return NextResponse.json({ error: "Only admin can delete vacancies" }, { status: 403 });
  }

  const companyId = await resolveCompanyId(supabase);
  if (!companyId) return NextResponse.json({ error: "No company found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Najprv odober vsetkych ludi priradených k tejto vacancy
  await supabase
    .from("org_chart_overrides")
    .delete()
    .eq("company_id", companyId)
    .eq("override_parent_id", id);

  const { error } = await supabase
    .from("org_vacancies")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
