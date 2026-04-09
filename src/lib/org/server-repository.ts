import { randomUUID } from "crypto";

import { defaultEmployeeRecords } from "@/lib/org/mock-data";
import { PRODUCTION_COLLAPSED_STREDISKA } from "@/lib/org/stredisko-names";
import type { EmployeeRecord, ImportIssue, OrgDataLoadResult, OrgSource, PositionType, SourceAttempt } from "@/lib/org/types";
import { ALLOWED_KAT_VALUES, type KatType } from "@/lib/org/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LoadOptions = {
  mode: "live" | "fallback";
  source?: OrgSource;
  /** Ak je nastavené, použije sa táto company (napr. z JWT); inak prvá company v DB. */
  companyId?: string | null;
};

type SourceOutcome = {
  source: OrgSource;
  records: EmployeeRecord[];
  issues: ImportIssue[];
  reason: string;
  ok: boolean;
};

export async function loadOrgRecords(options: LoadOptions): Promise<OrgDataLoadResult> {
  const requestId = randomUUID();
  const attempts: SourceAttempt[] = [];
  const client = createServerSupabaseClient();

  if (!client) {
    return finalize({
      requestId,
      mode: options.mode,
      source: "local",
      records: defaultEmployeeRecords,
      issues: [
        {
          row: 1,
          level: "warning",
          message: "Supabase environment variables are missing. Local dataset is used.",
          code: "source_unavailable",
        },
      ],
      attempts,
      finalReason: "Supabase client is not configured on server.",
    });
  }

  const sourcePlan = buildSourcePlan(options);

  for (let index = 0; index < sourcePlan.length; index += 1) {
    const source = sourcePlan[index];
    const outcome = await loadBySource(client, source, options.companyId);
    attempts.push({
      source,
      ok: outcome.ok,
      rowCount: outcome.records.length,
      reason: outcome.reason,
    });

    if (outcome.ok) {
      const finalReason = outcome.reason;
      await logLoadEvent(client, source, attempts, requestId, finalReason);
      return finalize({
        requestId,
        mode: options.mode,
        source,
        records: outcome.records,
        issues: outcome.issues,
        attempts,
        finalReason,
      });
    }

    const isLastAttempt = index === sourcePlan.length - 1;
    const shouldStopInLiveMode = options.mode === "live";
    if (isLastAttempt || shouldStopInLiveMode) {
      const finalSource = source;
      const finalReason = outcome.reason;
      await logLoadEvent(client, finalSource, attempts, requestId, finalReason);
      return finalize({
        requestId,
        mode: options.mode,
        source: finalSource,
        records: outcome.records,
        issues: outcome.issues,
        attempts,
        finalReason,
      });
    }
  }

  const finalReason = "No source returned data.";
  await logLoadEvent(client, "local", attempts, requestId, finalReason);
  return finalize({
    requestId,
    mode: options.mode,
    source: "local",
    records: defaultEmployeeRecords,
    issues: [
      {
        row: 1,
        level: "warning",
        message: "No source returned data, fallback local dataset used.",
        code: "source_unavailable",
      },
    ],
    attempts,
    finalReason,
  });
}

async function loadBySource(
  client: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  source: OrgSource,
  companyIdOverride?: string | null,
) {
  if (source === "iac_employees") {
    return loadFromIacEmployees(client, companyIdOverride);
  }
  if (source === "employees") {
    return loadFromEmployeesProjection(client, companyIdOverride);
  }
  return {
    source,
    records: defaultEmployeeRecords,
    issues: [],
    reason: "Local demo source selected explicitly.",
    ok: true,
  } satisfies SourceOutcome;
}

async function loadFromIacEmployees(
  client: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  companyIdOverride?: string | null,
): Promise<SourceOutcome> {
  const { data, error } = await client
    .from("iac_employees")
    .select("*")
    .eq("status", "active")
    .limit(5000);
  if (error) {
    return {
      source: "iac_employees",
      records: [],
      issues: [
        {
          row: 1,
          level: "error",
          message: `Unable to read iac_employees: ${error.message}`,
          code: "source_unavailable",
        },
      ],
      reason: `iac_employees query failed: ${error.message}`,
      ok: false,
    };
  }

  if (!data || data.length === 0) {
    return {
      source: "iac_employees",
      records: [],
      issues: [
        {
          row: 1,
          level: "warning",
          message: "iac_employees query returned 0 rows for this user/session.",
          code: "empty_remote_dataset",
        },
      ],
      reason: "iac_employees returned empty set.",
      ok: false,
    };
  }

  // Supabase query už filtruje status = 'active', takže všetky vrátené riadky sú aktívne
  const activeRows = data;
  if (activeRows.length === 0) {
    return {
      source: "iac_employees",
      records: [],
      issues: [
        {
          row: 1,
          level: "warning",
          message: "iac_employees loaded, but no active rows matched status filter.",
          code: "inactive_skipped",
        },
      ],
      reason: "No active rows in iac_employees.",
      ok: true,
    };
  }

  const issues: ImportIssue[] = [];
  const records: EmployeeRecord[] = [];
  const sourceRowsForRecords: Array<Record<string, unknown>> = [];
  const seenIds = new Set<string>();

  const allowedKatSet = new Set<string>(ALLOWED_KAT_VALUES);

  activeRows.forEach((rawRow, index) => {
    const row = rawRow as Record<string, unknown>;
    const rowNumber = index + 2;
    const katRaw = String(row.kat_atos ?? row.kat ?? "").trim().toUpperCase().replace(/\s+/g, "");
    const kat = allowedKatSet.has(katRaw) ? (katRaw as KatType) : undefined;

    const employeeId = String(row.os_c ?? "").trim();
    const fullName = String(row.meno ?? "").trim();
    const str = String(row.str ?? "").trim();
    const odd = String(row.odd ?? "").trim();
    let department = str || odd || "Unassigned";
    let departmentName = String(row.department ?? "").trim() || undefined;
    if (PRODUCTION_COLLAPSED_STREDISKA.has(str)) {
      department = "10";
      departmentName = "Production";
    }
    const positionName =
      String(row.funkcia_v_pz ?? "").trim() ||
      String(row.funkcia ?? "").trim() ||
      String(row.pozicia ?? "").trim() ||
      "Undefined Position";
    const katAtosRaw = String(row.kat_atos ?? row.kat ?? "").trim().toUpperCase().replace(/\s+/g, "");
    const employeeTypeRaw = String(row.employee_type ?? "").trim();
    const positionType =
      mapKatToPositionType(katAtosRaw) ??
      (katAtosRaw.length > 0 ? "indirect" : mapEmployeeType(employeeTypeRaw));

    if (!employeeId) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: "Missing os_c in iac_employees.",
        code: "missing_employee_id",
      });
      return;
    }

    if (!fullName) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: `Missing meno for employee ${employeeId}.`,
        code: "missing_employee_name",
      });
      return;
    }

    if (seenIds.has(employeeId)) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: `Duplicate os_c "${employeeId}" in iac_employees.`,
        code: "duplicate_employee_id",
      });
      return;
    }

    if (!positionType) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: `Unsupported kat_atos/employee_type "${String(row.kat_atos ?? row.kat ?? row.employee_type ?? "")}" for ${employeeId}.`,
        code: "unknown_position_type",
      });
      return;
    }

    seenIds.add(employeeId);
    sourceRowsForRecords.push(row);
    records.push({
      employeeId,
      fullName,
      department,
      departmentName,
      oddelenie: odd || undefined,
      positionType,
      positionName,
      managerEmployeeId: null,
      kat: kat ?? undefined,
    });
  });

  resolveManagerLinksByEmployeeId(records, sourceRowsForRecords, issues);

  await enrichRecordsWithPhotoUrls(client, records, companyIdOverride);
  await applySectionMemberOverrides(client, records, companyIdOverride);

  return {
    source: "iac_employees",
    records,
    issues,
    reason: `iac_employees loaded ${records.length} active employees.`,
    ok: true,
  };
}

async function loadFromEmployeesProjection(
  client: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  companyIdOverride?: string | null,
): Promise<SourceOutcome> {
  const companyId = companyIdOverride ?? (await resolveCompanyId(client));
  if (!companyId) {
    return {
      source: "employees",
      records: [],
      issues: [
        {
          row: 1,
          level: "warning",
          message: "No company context found for employees projection.",
          code: "source_unavailable",
        },
      ],
      reason: "No company_id resolved.",
      ok: false,
    };
  }

  const { data, error } = await client
    .from("employees")
    .select("employee_id, full_name, manager_employee_id, photo_url, departments(name), positions(title, position_type)")
    .eq("company_id", companyId)
    .order("employee_id", { ascending: true });

  if (error) {
    return {
      source: "employees",
      records: [],
      issues: [
        {
          row: 1,
          level: "error",
          message: `Unable to read employees projection: ${error.message}`,
          code: "source_unavailable",
        },
      ],
      reason: `employees projection query failed: ${error.message}`,
      ok: false,
    };
  }

  if (!data || data.length === 0) {
    return {
      source: "employees",
      records: [],
      issues: [
        {
          row: 1,
          level: "warning",
          message: "Employees projection returned 0 rows.",
          code: "empty_remote_dataset",
        },
      ],
      reason: "employees projection returned empty set.",
      ok: false,
    };
  }

  const records = data.map((row) => {
    const department = Array.isArray(row.departments) ? row.departments[0] : row.departments;
    const position = Array.isArray(row.positions) ? row.positions[0] : row.positions;
    const deptName = department?.name ?? "Unassigned";
    return {
      employeeId: row.employee_id,
      fullName: row.full_name,
      department: deptName,
      departmentName: deptName !== "Unassigned" ? deptName : undefined,
      positionType: (position?.position_type ?? "indirect") as PositionType,
      positionName: position?.title ?? "Undefined Position",
      managerEmployeeId: row.manager_employee_id ?? null,
      photoUrl: row.photo_url ?? null,
    } satisfies EmployeeRecord;
  });

  return {
    source: "employees",
    records,
    issues: [],
    reason: `employees projection loaded ${records.length} records.`,
    ok: true,
  };
}

function buildSourcePlan(options: LoadOptions): OrgSource[] {
  if (options.source) {
    return [options.source];
  }
  if (options.mode === "fallback") {
    return ["iac_employees", "employees", "local"];
  }
  return ["iac_employees"];
}

function finalize(payload: Omit<OrgDataLoadResult, "mode"> & { mode: "live" | "fallback" }): OrgDataLoadResult {
  return {
    records: payload.records,
    issues: payload.issues,
    source: payload.source,
    mode: payload.mode,
    requestId: payload.requestId,
    attempts: payload.attempts,
    finalReason: payload.finalReason,
  };
}

async function resolveCompanyId(client: NonNullable<ReturnType<typeof createServerSupabaseClient>>) {
  const { data } = await client.from("companies").select("id").order("created_at", { ascending: true }).limit(1);
  return data?.[0]?.id ?? null;
}

/** Naplní photoUrl v záznamoch z tabuľky employee_photo_urls (odkaz na fotku podľa employee_id = os_c z iac_employees). */
async function enrichRecordsWithPhotoUrls(
  client: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  records: EmployeeRecord[],
  companyIdOverride?: string | null,
): Promise<void> {
  const companyId = companyIdOverride ?? (await resolveCompanyId(client));
  if (!companyId || records.length === 0) return;

  const employeeIds = records.map((r) => r.employeeId);
  const { data: rows } = await client
    .from("employee_photo_urls")
    .select("employee_id, photo_url")
    .eq("company_id", companyId)
    .in("employee_id", employeeIds);

  if (!rows?.length) return;

  const photoByEmployeeId = new Map(rows.map((row) => [row.employee_id, row.photo_url ?? null]));
  records.forEach((record) => {
    const url = photoByEmployeeId.get(record.employeeId);
    if (url !== undefined) record.photoUrl = url;
  });
}

function resolveManagerLinksByEmployeeId(
  records: EmployeeRecord[],
  sourceRows: Array<Record<string, unknown>>,
  issues: ImportIssue[],
) {
  const byEmployeeId = new Map<string, EmployeeRecord>();
  records.forEach((record) => byEmployeeId.set(record.employeeId, record));

  records.forEach((record, index) => {
    const managerRaw = String(sourceRows[index]?.priamy_nadr ?? "").trim();
    const managerId = extractManagerEmployeeId(managerRaw);
    if (!managerId) {
      record.managerEmployeeId = null;
      return;
    }

    const manager = byEmployeeId.get(managerId);
    if (!manager) {
      record.managerEmployeeId = null;
      return;
    }

    if (manager.employeeId === record.employeeId) {
      issues.push({
        row: index + 2,
        level: "error",
        message: "Employee cannot be their own manager.",
        code: "self_reference",
      });
      return;
    }

    record.managerEmployeeId = manager.employeeId;
  });
}

/** First 8 digits from priamy_nadr = osobné číslo; if fewer than 8 digits, returns null. */
function extractManagerEmployeeId(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits.slice(0, 8);
}

/** Position type from stĺpca kat_atos/kat: SAL → salaried, INDIR* → indirect, DIR → direct. */
function mapKatToPositionType(katRaw: string): PositionType | null {
  const k = katRaw.trim().toUpperCase().replace(/\s+/g, "");
  if (!k) return null;
  if (k === "SAL") return "salaried";
  if (k === "DIR" || k === "DIRECT") return "direct";
  if (k === "INDIR2" || k === "INDIR3" || k.startsWith("INDIR")) return "indirect";
  return null;
}

function mapEmployeeType(value: string): PositionType | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("salary") || normalized.includes("salaried") || normalized === "s") {
    return "salaried";
  }
  if (normalized.includes("direct") || normalized === "d" || normalized === "dir") {
    return "direct";
  }
  if (normalized.includes("indirect") || normalized === "i" || normalized.startsWith("indir")) {
    return "indirect";
  }
  if (normalized === "internal") {
    return "salaried";
  }
  if (normalized === "agency") {
    return "indirect";
  }
  return null;
}

function isActiveStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized === "active" ||
    normalized === "a" ||
    normalized === "1" ||
    normalized === "true" ||
    normalized.startsWith("active")
  );
}

/**
 * Nahradi managerEmployeeId zamestnancom sekcii z tabulky org_section_members.
 * Povodny priamy_nadr v iac_employees ostane nedotknuty.
 * Toto sa vola az po resolveManagerLinksByEmployeeId.
 */
async function applySectionMemberOverrides(
  client: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  records: EmployeeRecord[],
  companyIdOverride?: string | null,
): Promise<void> {
  const companyId = companyIdOverride ?? (await resolveCompanyId(client));
  if (!companyId || records.length === 0) return;

  const { data: rows } = await client
    .from("org_section_members")
    .select("employee_id, section_id")
    .eq("company_id", companyId);

  if (!rows?.length) return;

  const sectionByEmployeeId = new Map(rows.map((r) => [r.employee_id, r.section_id]));
  records.forEach((record) => {
    const sectionId = sectionByEmployeeId.get(record.employeeId);
    if (sectionId) {
      // Override: zamestnanec sa zobrazuje pod sekciou, nie pod povodnym nadriadenim
      record.managerEmployeeId = sectionId;
    }
  });
}

async function logLoadEvent(
  client: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  source: OrgSource,
  attempts: SourceAttempt[],
  requestId: string,
  reason: string,
) {
  const companyId = await resolveCompanyId(client);
  await client.from("audit_events").insert({
    company_id: companyId,
    entity_name: "org_data_load",
    entity_id: requestId,
    action: "read",
    payload: {
      source,
      attempts,
      reason,
      created_at: new Date().toISOString(),
    },
  });
}
