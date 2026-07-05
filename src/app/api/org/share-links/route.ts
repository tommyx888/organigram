import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClientWithUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Správa verejných zdieľateľných odkazov na organigram.
 * Auth: Bearer token používateľa; RLS povolí iba admin / hr_editor.
 */
function getUserClient(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  return createServerSupabaseClientWithUser(token);
}

export async function GET(request: NextRequest) {
  const supabase = getUserClient(request);
  if (!supabase) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("org_share_links")
    .select("id, token, label, is_enabled, expires_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = getUserClient(request);
  if (!supabase) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { label?: string };
  const label = String(body.label ?? "").trim() || "Verejný náhľad";

  // Company id z RLS kontextu používateľa
  const { data: roleRow } = await supabase
    .from("user_company_roles")
    .select("company_id")
    .limit(1)
    .maybeSingle();
  if (!roleRow?.company_id) {
    return NextResponse.json({ error: "no_company_context" }, { status: 403 });
  }

  const token = randomBytes(24).toString("base64url");

  const { data, error } = await supabase
    .from("org_share_links")
    .insert({ company_id: roleRow.company_id, token, label })
    .select("id, token, label, is_enabled, expires_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = getUserClient(request);
  if (!supabase) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    is_enabled?: boolean;
    label?: string;
  };
  if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.is_enabled === "boolean") patch.is_enabled = body.is_enabled;
  if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim();
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("org_share_links")
    .update(patch)
    .eq("id", body.id)
    .select("id, token, label, is_enabled, expires_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = getUserClient(request);
  if (!supabase) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const { error } = await supabase.from("org_share_links").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
