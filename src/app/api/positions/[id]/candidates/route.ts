import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClientWithUser } from "@/lib/supabase/server";

function getToken(req: NextRequest): string | null {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

const CAND_FIELDS = ["name", "agency", "monthly_cost", "currency", "status", "profile_url", "note"];

function pickCandidateFields(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const k of CAND_FIELDS) if (k in body) patch[k] = body[k];
  return patch;
}

/**
 * POST /api/positions/[id]/candidates
 * Pridanie kandidata k pozicii.
 * Body: { name (povinne), agency?, monthly_cost?, currency?, status?, profile_url?, note? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Field 'name' is required" }, { status: 400 });
  }

  const insert = { assignment_id: id, ...pickCandidateFields(body) };
  const { data, error } = await supabase.from("proj_position_candidates").insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ candidate: data }, { status: 201 });
}

/**
 * PATCH /api/positions/[id]/candidates
 * Uprava kandidata. Body musi obsahovat { candidate_id, ...polia }.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const candidateId = body.candidate_id;
  if (!candidateId || typeof candidateId !== "string") {
    return NextResponse.json({ error: "Field 'candidate_id' is required" }, { status: 400 });
  }

  const patch = pickCandidateFields(body);
  const { data, error } = await supabase
    .from("proj_position_candidates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", candidateId)
    .eq("assignment_id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ candidate: data });
}

/**
 * DELETE /api/positions/[id]/candidates?candidate_id=<uuid>
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const candidateId = req.nextUrl.searchParams.get("candidate_id");
  if (!candidateId) return NextResponse.json({ error: "Missing candidate_id" }, { status: 400 });

  const { error } = await supabase
    .from("proj_position_candidates")
    .delete()
    .eq("id", candidateId)
    .eq("assignment_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
