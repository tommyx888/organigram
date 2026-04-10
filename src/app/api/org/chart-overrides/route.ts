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

export type OverrideRow = { employee_id: string; override_parent_id: string };

/** GET: vrati vsetky parent overrides pre company */
export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const companyId = await resolveCompanyId(supabase);
  if (!companyId) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("org_chart_overrides")
    .select("employee_id, override_parent_id")
    .eq("company_id", companyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * PUT: nahradi cely zoznam overrides pre company.
 * Body: { overrides: { employee_id: string, override_parent_id: string }[] }
 */
export async function PUT(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  if (!await checkAdmin(supabase)) {
    return NextResponse.json({ error: "Only admin can update chart overrides" }, { status: 403 });
  }

  const companyId = await resolveCompanyId(supabase);
  if (!companyId) return NextResponse.json({ error: "No company found" }, { status: 404 });

  let body: { overrides: OverrideRow[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const overrides = body.overrides ?? [];

  const { error: delError } = await supabase
    .from("org_chart_overrides")
    .delete()
    .eq("company_id", companyId);

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  if (overrides.length > 0) {
    const rows = overrides.map((o) => ({
      company_id: companyId,
      employee_id: o.employee_id,
      override_parent_id: o.override_parent_id,
    }));
    const { error: insError } = await supabase.from("org_chart_overrides").insert(rows);
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: overrides.length });
}