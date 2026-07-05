import { NextRequest, NextResponse } from "next/server";

import { loadOrgRecords } from "@/lib/org/server-repository";
import type { PublicOrgPayload, PublicOrgPerson } from "@/lib/org/public-org-types";
import { getStrediskoDisplayName } from "@/lib/org/stredisko-names";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Verejný endpoint pre zdieľateľný náhľad organigramu.
 * GET /api/public-org?token=...
 * Vracia iba aktívnych SAL zamestnancov; bez auth, chránené share tokenom.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const client = createServerSupabaseClient();
  if (!client) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
  }

  const { data: link, error: linkError } = await client
    .from("org_share_links")
    .select("id, company_id, is_enabled, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (linkError || !link) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }
  if (!link.is_enabled) {
    return NextResponse.json({ error: "link_disabled" }, { status: 403 });
  }
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "link_expired" }, { status: 403 });
  }

  const result = await loadOrgRecords({ mode: "live", companyId: link.company_id });

  // Iba aktívni salaried (KAT = SAL). Zdrojový dotaz už filtruje status = 'active'.
  const salaried = result.records.filter((r) => r.kat === "SAL" || r.positionType === "salaried");
  const salIds = new Set(salaried.map((r) => r.employeeId));

  // Voľné pozície (vacancies), na ktoré reportuje aspoň jeden SAL zamestnanec –
  // musia byť v strome, inak by ich podriadení vypadli z hierarchie (napr. Plant Manager).
  const { data: vacancyRows } = await client
    .from("org_vacancies")
    .select("id, title, parent_id")
    .eq("company_id", link.company_id);

  const reportsByVacancy = new Map<string, number>();
  salaried.forEach((r) => {
    if (r.managerEmployeeId?.startsWith("vacancy-")) {
      reportsByVacancy.set(
        r.managerEmployeeId,
        (reportsByVacancy.get(r.managerEmployeeId) ?? 0) + 1,
      );
    }
  });

  const includedVacancies = (vacancyRows ?? []).filter(
    (v) => (reportsByVacancy.get(v.id) ?? 0) > 0,
  );
  const includedIds = new Set<string>([...salIds, ...includedVacancies.map((v) => v.id)]);

  const people: PublicOrgPerson[] = salaried.map((r) => ({
    id: r.employeeId,
    name: r.fullName,
    position: r.positionName,
    department: r.department,
    departmentName: getStrediskoDisplayName(r.department, r.departmentName ?? r.oddelenie),
    // Manažér sa posiela iba ak je tiež v zobrazenom sete (SAL alebo vacancy).
    managerId:
      r.managerEmployeeId && includedIds.has(r.managerEmployeeId) ? r.managerEmployeeId : null,
    photoUrl: r.photoUrl ?? null,
  }));

  // Voľné pozície ako pseudo-uzly stromu (bez mena kandidáta – externý náhľad).
  includedVacancies.forEach((v) => {
    people.push({
      id: v.id,
      name: v.title,
      position: "",
      department: "",
      departmentName: null,
      managerId: v.parent_id && includedIds.has(v.parent_id) ? v.parent_id : null,
      photoUrl: null,
      isVacancy: true,
    });
  });

  const { data: companyRow } = await client
    .from("companies")
    .select("name")
    .eq("id", link.company_id)
    .maybeSingle();

  const payload: PublicOrgPayload = {
    companyName: companyRow?.name ?? "Artifex Systems Slovakia",
    generatedAt: new Date().toISOString(),
    people,
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
