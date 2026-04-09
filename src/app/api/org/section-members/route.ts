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

/** GET: vrati vsetky section member overrides pre company */
export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const companyId = await resolveCompanyId(supabase);
  if (!companyId) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("org_section_members")
    .select("employee_id, section_id")
    .eq("company_id", companyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * PUT: nahradi cely zoznam section members pre company.
 * Body: { members: { employee_id: string, section_id: string }[] }
 */
export async function PUT(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  if (!await checkAdmin(supabase)) {
    return NextResponse.json({ error: "Only admin can update section members" }, { status: 403 });
  }

  const companyId = await resolveCompanyId(supabase);
  if (!companyId) return NextResponse.json({ error: "No company found" }, { status: 404 });

  let body: { members: { employee_id: string; section_id: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const members = body.members ?? [];

  // Zmaz vsetky existujuce zaznamy pre tuto company
  const { error: delError } = await supabase
    .from("org_section_members")
    .delete()
    .eq("company_id", companyId);

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  // Vloz nove (ak su)
  if (members.length > 0) {
    const rows = members.map((m) => ({
      company_id: companyId,
      employee_id: m.employee_id,
      section_id: m.section_id,
    }));
    const { error: insError } = await supabase.from("org_section_members").insert(rows);
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: members.length });
}