import { NextRequest, NextResponse } from "next/server";

import { loadOrgRecords } from "@/lib/org/server-repository";
import type { OrgSource } from "@/lib/org/types";
import { createServerSupabaseClientWithUser } from "@/lib/supabase/server";

async function resolveCompanyIdFromToken(token: string): Promise<string | null> {
  const supabase = createServerSupabaseClientWithUser(token);
  if (!supabase) return null;
  const { data: roleRow } = await supabase
    .from("user_company_roles")
    .select("company_id")
    .limit(1)
    .maybeSingle();
  if (roleRow?.company_id) return roleRow.company_id;
  const { data: companyRows } = await supabase
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  return companyRows?.[0]?.id ?? null;
}

export async function GET(request: NextRequest) {
  const modeParam = request.nextUrl.searchParams.get("mode");
  const sourceParam = request.nextUrl.searchParams.get("source");

  const mode = modeParam === "fallback" ? "fallback" : "live";
  const source = isOrgSource(sourceParam) ? sourceParam : undefined;

  let companyId: string | null = null;
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) companyId = await resolveCompanyIdFromToken(token);
  }

  const result = await loadOrgRecords({ mode, source, companyId: companyId ?? undefined });
  return NextResponse.json(result, {
    status: 200,
    headers: {
      "x-request-id": result.requestId,
    },
  });
}

function isOrgSource(value: string | null): value is OrgSource {
  return value === "iac_employees" || value === "employees" || value === "local";
}
