import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  isPublicOrgScope,
  parseExportDepartments,
  parsePublicCardFields,
  type PublicOrgScope,
} from "@/lib/org/public-org-types";
import { createServerSupabaseClientWithUser } from "@/lib/supabase/server";

const SHARE_LINK_COLUMNS =
  "id, token, label, is_enabled, expires_at, created_at, scope, export_departments, card_fields";
const SHARE_LINK_COLUMNS_LEGACY = "id, token, label, is_enabled, expires_at, created_at, scope";
const SHARE_LINK_COLUMNS_MIN = "id, token, label, is_enabled, expires_at, created_at";

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

  let { data, error } = await supabase
    .from("org_share_links")
    .select(SHARE_LINK_COLUMNS)
    .order("created_at", { ascending: false });

  if (error && /export_departments|card_fields/i.test(error.message)) {
    const retry = await supabase
      .from("org_share_links")
      .select(SHARE_LINK_COLUMNS_LEGACY)
      .order("created_at", { ascending: false });
    data = (retry.data ?? []).map((row) => ({
      ...row,
      export_departments: null,
      card_fields: null,
    }));
    error = retry.error;
  }

  if (error && /scope/i.test(error.message)) {
    const retry = await supabase
      .from("org_share_links")
      .select(SHARE_LINK_COLUMNS_MIN)
      .order("created_at", { ascending: false });
    data = (retry.data ?? []).map((row) => ({
      ...row,
      scope: "salaried",
      export_departments: null,
      card_fields: null,
    }));
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = getUserClient(request);
  if (!supabase) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    scope?: string;
    departments?: unknown;
    cardFields?: unknown;
  };
  const scope: PublicOrgScope = isPublicOrgScope(body.scope) ? body.scope : "salaried";
  const defaultLabel =
    scope === "salaried_indirect" ? "Verejný náhľad (SAL + Indirect)" : "Verejný náhľad (SAL)";
  const label = String(body.label ?? "").trim() || defaultLabel;
  const exportDepartments = parseExportDepartments(body.departments);
  if (exportDepartments && exportDepartments.length === 0) {
    return NextResponse.json({ error: "no_departments" }, { status: 400 });
  }
  const cardFields = parsePublicCardFields(body.cardFields, scope);
  if (!Object.values(cardFields).some(Boolean)) {
    return NextResponse.json({ error: "no_card_fields" }, { status: 400 });
  }

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

  const insertRow = {
    company_id: roleRow.company_id,
    token,
    label,
    scope,
    export_departments: exportDepartments,
    card_fields: cardFields,
  };

  let { data, error } = await supabase
    .from("org_share_links")
    .insert(insertRow)
    .select(SHARE_LINK_COLUMNS)
    .single();

  if (error && /export_departments|card_fields/i.test(error.message)) {
    return NextResponse.json(
      {
        error: "export_options_missing",
        message: "Najprv spustite migráciu 013_org_share_export_options.sql.",
      },
      { status: 503 },
    );
  }

  if (error && /scope/i.test(error.message)) {
    if (scope !== "salaried") {
      return NextResponse.json(
        { error: "scope_column_missing", message: "Najprv spustite migráciu 011_org_share_links_scope.sql." },
        { status: 503 },
      );
    }
    const retry = await supabase
      .from("org_share_links")
      .insert({ company_id: roleRow.company_id, token, label })
      .select(SHARE_LINK_COLUMNS_MIN)
      .single();
    data = retry.data
      ? { ...retry.data, scope: "salaried", export_departments: null, card_fields: null }
      : retry.data;
    error = retry.error;
  }

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
