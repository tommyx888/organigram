import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClientWithUser } from "@/lib/supabase/server";

function getToken(req: NextRequest): string | null {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

type AssignmentRow = {
  id: string;
  position_title: string | null;
  person_name: string | null;
  person_type: string;
  status: string | null;
  home_location: string | null;
  project_id: string;
  iac_employee_id: string | null;
  iac_employee?: { id: string; meno: string } | null;
  project?: { id: string; name: string } | null;
};

/**
 * GET /api/positions
 * Zoznam vsetkych interim + TBD pozicii napric projektmi, s metadatami,
 * poctom kandidatov a vypocitanymi mesacnymi nakladmi.
 *
 * Query parametre (volitelne):
 *   - filter=interim|tbd  (default: oboje)
 *   - project_id=<uuid>   (filtrovat na konkretny projekt)
 */
export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const filter = req.nextUrl.searchParams.get("filter");
  const projectId = req.nextUrl.searchParams.get("project_id");

  // Pozicie na obsadenie = interim alebo tbd (typ alebo stav)
  let q = supabase
    .from("proj_assignments")
    .select(
      `id, position_title, person_name, person_type, status, home_location, project_id, iac_employee_id,
       iac_employee:iac_employees(id, meno),
       project:proj_projects(id, name)`,
    )
    .or("person_type.eq.interim,person_type.eq.tbd,status.eq.tbd")
    .order("display_order");
  if (projectId) q = q.eq("project_id", projectId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data ?? []) as unknown as AssignmentRow[];
  if (filter === "interim") {
    rows = rows.filter((a) => a.person_type === "interim");
  } else if (filter === "tbd") {
    rows = rows.filter((a) => a.person_type === "tbd" || a.status === "tbd");
  }

  const ids = rows.map((a) => a.id);
  if (ids.length === 0) return NextResponse.json({ positions: [] });

  // Meta a kandidati pre vsetky pozicie naraz
  const [metaRes, candRes] = await Promise.all([
    supabase.from("proj_position_meta").select("*").in("assignment_id", ids),
    supabase.from("proj_position_candidates").select("*").in("assignment_id", ids),
  ]);
  if (metaRes.error) return NextResponse.json({ error: metaRes.error.message }, { status: 500 });
  if (candRes.error) return NextResponse.json({ error: candRes.error.message }, { status: 500 });

  const metaByAsg = new Map<string, Record<string, unknown>>();
  for (const m of metaRes.data ?? []) metaByAsg.set((m as { assignment_id: string }).assignment_id, m);
  const candByAsg = new Map<string, { status: string; monthly_cost: number | null }[]>();
  for (const c of candRes.data ?? []) {
    const row = c as { assignment_id: string; status: string; monthly_cost: number | null };
    const list = candByAsg.get(row.assignment_id) ?? [];
    list.push(row);
    candByAsg.set(row.assignment_id, list);
  }

  const positions = rows.map((a) => {
    const meta = metaByAsg.get(a.id) ?? null;
    const cands = candByAsg.get(a.id) ?? [];
    const override = meta ? (meta as { monthly_cost_override: number | null }).monthly_cost_override : null;
    const selectedCost = cands
      .filter((c) => c.status === "selected")
      .reduce((sum, c) => sum + (c.monthly_cost ?? 0), 0);
    const monthlyCost = override != null ? override : selectedCost;
    return {
      assignment_id: a.id,
      position_title: a.position_title,
      person_name: a.iac_employee?.meno ?? a.person_name ?? null,
      person_type: a.person_type,
      status: a.status,
      is_tbd: a.person_type === "tbd" || a.status === "tbd",
      home_location: a.home_location,
      project_id: a.project_id,
      project_name: a.project?.name ?? null,
      meta,
      candidate_count: cands.length,
      monthly_cost: monthlyCost,
    };
  });

  return NextResponse.json({ positions });
}
