import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClientWithUser } from "@/lib/supabase/server";

function getToken(req: NextRequest): string | null {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/**
 * GET /api/positions/[id]
 * Detail jednej pozicie: assignment + meta + kandidati + dokumenty + mesacne naklady.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: asg, error: ae } = await supabase
    .from("proj_assignments")
    .select(
      `id, position_title, person_name, person_type, status, home_location, project_id, iac_employee_id,
       iac_employee:iac_employees(id, meno),
       project:proj_projects(id, name)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });
  if (!asg) return NextResponse.json({ error: "Position not found" }, { status: 404 });

  const [metaRes, candRes, docRes] = await Promise.all([
    supabase.from("proj_position_meta").select("*").eq("assignment_id", id).maybeSingle(),
    supabase.from("proj_position_candidates").select("*").eq("assignment_id", id).order("created_at"),
    supabase.from("proj_position_documents").select("*").eq("assignment_id", id).order("uploaded_at", { ascending: false }),
  ]);
  if (metaRes.error) return NextResponse.json({ error: metaRes.error.message }, { status: 500 });
  if (candRes.error) return NextResponse.json({ error: candRes.error.message }, { status: 500 });
  if (docRes.error) return NextResponse.json({ error: docRes.error.message }, { status: 500 });

  const meta = metaRes.data as { monthly_cost_override: number | null } | null;
  const candidates = (candRes.data ?? []) as { status: string; monthly_cost: number | null }[];
  const override = meta?.monthly_cost_override ?? null;
  const selectedCost = candidates
    .filter((c) => c.status === "selected")
    .reduce((sum, c) => sum + (c.monthly_cost ?? 0), 0);
  const monthlyCost = override != null ? override : selectedCost;

  return NextResponse.json({
    assignment: asg,
    meta: metaRes.data ?? null,
    candidates: candRes.data ?? [],
    documents: docRes.data ?? [],
    monthly_cost: monthlyCost,
  });
}

/**
 * PATCH /api/positions/[id]
 * Upsert metadat pozicie (target_type, seat_location, recruiting_url,
 * portal_it_url, monthly_cost_override, note).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const allowed = ["target_type", "seat_location", "recruiting_url", "portal_it_url", "monthly_cost_override", "note"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];

  const { data, error } = await supabase
    .from("proj_position_meta")
    .upsert({ assignment_id: id, ...patch, updated_at: new Date().toISOString() }, { onConflict: "assignment_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meta: data });
}
