import { NextRequest, NextResponse } from "next/server";

import type { OrgChartSettingsPayload } from "@/lib/org/org-chart-settings-types";
import { createServerSupabaseClientWithUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const token = getAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data: row, error } = await supabase
    .from("org_chart_settings")
    .select("payload")
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload: OrgChartSettingsPayload = (row?.payload as OrgChartSettingsPayload) ?? {};
  return NextResponse.json(payload);
}

export async function PATCH(request: NextRequest) {
  const token = getAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_company_roles")
    .select("role")
    .limit(1)
    .maybeSingle();

  if (roleError) {
    return NextResponse.json({ error: "Role check failed" }, { status: 500 });
  }
  if (roleRow?.role !== "admin") {
    return NextResponse.json(
      { error: "Only admin can update org chart settings" },
      { status: 403 },
    );
  }

  let body: Partial<OrgChartSettingsPayload> & { _replace?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { _replace, ...partial } = body;
  const replaceEntire = _replace === true;

  const { data: existing } = await supabase
    .from("org_chart_settings")
    .select("id, payload")
    .limit(1)
    .maybeSingle();

  const currentPayload = (existing?.payload as OrgChartSettingsPayload) ?? {};
  const mergedPayload: OrgChartSettingsPayload = replaceEntire
    ? (partial as OrgChartSettingsPayload)
    : { ...currentPayload, ...partial };

  const authRes = await supabase.auth.getUser();
  const updatedBy =
    (authRes as { data?: { user?: { id: string } }; user?: { id: string } }).data?.user?.id ??
    (authRes as { user?: { id: string } }).user?.id ??
    null;

  const singletonId = "00000000-0000-0000-0000-000000000001";
  const { error: upsertError } = await supabase
    .from("org_chart_settings")
    .upsert(
      {
        id: singletonId,
        payload: mergedPayload,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: "id" },
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json(mergedPayload);
}

function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
