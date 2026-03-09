import Papa from "papaparse";

import { PRODUCTION_COLLAPSED_STREDISKA } from "@/lib/org/stredisko-names";
import type { EmployeeRecord, ImportIssue, OrgImportResult, PositionType } from "@/lib/org/types";
import { ALLOWED_KAT_VALUES, type KatType } from "@/lib/org/types";

export function parseCsvImport(source: string): OrgImportResult {
  const parsed = Papa.parse<Record<string, string>>(source, { header: true, skipEmptyLines: true });
  const issues: ImportIssue[] = [];
  const recordsWithMeta: Array<{
    row: number;
    record: EmployeeRecord;
    managerRaw: string | null;
  }> = [];
  const seenEmployeeIds = new Set<string>();
  const activeRows = parsed.data
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => ((row.status || "").trim().toLowerCase() === "active"));

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;
    const status = (row.status || "").trim().toLowerCase();
    if (status !== "active") {
      if (status.length > 0) {
        issues.push({
          row: rowNumber,
          level: "warning",
          message: `Row skipped because status is "${status}" (only active is imported).`,
          code: "inactive_skipped",
        });
      }
      return;
    }
  });

  const allowedKatSet = new Set<string>(ALLOWED_KAT_VALUES);

  activeRows.forEach(({ row, rowNumber }) => {
    const katRaw = (row.kat_atos ?? row.kat ?? "").trim().toUpperCase().replace(/\s+/g, "");
    const kat = allowedKatSet.has(katRaw) ? (katRaw as KatType) : undefined;

    const employeeId = (row.os_c || "").trim();
    const fullName = (row.meno || "").trim();
    const str = (row.str || "").trim();
    const odd = (row.odd || "").trim();
    let department = str || odd || "Unassigned";
    let departmentName = (row.department || "").trim() || undefined;
    if (PRODUCTION_COLLAPSED_STREDISKA.has(str)) {
      department = "10";
      departmentName = "Production";
    }
    const positionName = (row.funkcia_v_pz || row.funkcia || "").trim() || "Undefined Position";
    const positionType =
      mapKatToPositionType(katRaw) ??
      (katRaw.length > 0 ? "indirect" : mapEmployeeTypeToPositionType(row.employee_type));
    const managerRaw = (row.priamy_nadr || "").trim() || null;

    if (!employeeId) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: "Missing required employee ID in stlpec os_c.",
        code: "missing_employee_id",
      });
      return;
    }

    if (!fullName) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: "Missing required employee name in stlpec meno.",
        code: "missing_employee_name",
      });
      return;
    }

    if (seenEmployeeIds.has(employeeId)) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: `Duplicate employee ID "${employeeId}" in os_c.`,
        code: "duplicate_employee_id",
      });
      return;
    }

    if (!positionType) {
      issues.push({
        row: rowNumber,
        level: "error",
        message: `Unable to map employee_type "${row.employee_type ?? ""}" to salaried/indirect/direct.`,
        code: "unknown_position_type",
      });
      return;
    }

    seenEmployeeIds.add(employeeId);
    recordsWithMeta.push({
      row: rowNumber,
      managerRaw,
      record: {
        employeeId,
        fullName,
        department,
        departmentName,
        oddelenie: odd || undefined,
        positionType,
        positionName,
        managerEmployeeId: null,
        kat: kat ?? undefined,
      },
    });
  });

  const managerIssues = resolveManagersByEmployeeId(recordsWithMeta);
  issues.push(...managerIssues);

  const records = recordsWithMeta.map((item) => item.record);
  issues.push(...detectCycles(records));

  return { records, issues };
}

function detectCycles(records: EmployeeRecord[]): ImportIssue[] {
  const byId = new Map(records.map((record) => [record.employeeId, record]));
  const issues: ImportIssue[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function visit(employeeId: string, row: number): void {
    if (inStack.has(employeeId)) {
      issues.push({
        row,
        level: "error",
        message: `Cycle detected around employee "${employeeId}".`,
        code: "cycle_detected",
      });
      return;
    }

    if (visited.has(employeeId)) {
      return;
    }

    visited.add(employeeId);
    inStack.add(employeeId);

    const managerId = byId.get(employeeId)?.managerEmployeeId;
    if (managerId && byId.has(managerId)) {
      visit(managerId, row);
    }

    inStack.delete(employeeId);
  }

  records.forEach((record, index) => visit(record.employeeId, index + 2));
  return issues;
}

/** First 8 digits from priamy_nadr = osobné číslo; if fewer than 8 digits, returns null. */
function extractManagerEmployeeId(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits.slice(0, 8);
}

function resolveManagersByEmployeeId(
  recordsWithMeta: Array<{
    row: number;
    record: EmployeeRecord;
    managerRaw: string | null;
  }>,
): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const byEmployeeId = new Map<string, EmployeeRecord>();
  recordsWithMeta.forEach(({ record }) => byEmployeeId.set(record.employeeId, record));

  recordsWithMeta.forEach((item) => {
    const managerRaw = item.managerRaw;
    if (!managerRaw) {
      item.record.managerEmployeeId = null;
      return;
    }

    const managerId = extractManagerEmployeeId(managerRaw);
    if (!managerId) {
      item.record.managerEmployeeId = null;
      return;
    }

    const manager = byEmployeeId.get(managerId);
    if (!manager) {
      item.record.managerEmployeeId = null;
      return;
    }

    item.record.managerEmployeeId = manager.employeeId;
    if (item.record.employeeId === item.record.managerEmployeeId) {
      issues.push({
        row: item.row,
        level: "error",
        message: "Employee cannot be their own manager.",
        code: "self_reference",
      });
    }
  });

  return issues;
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

function mapEmployeeTypeToPositionType(value: string | undefined): PositionType | null {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("salary") || normalized.includes("salaried")) {
    return "salaried";
  }
  if (normalized.includes("direct") || normalized === "d" || normalized === "dir") {
    return "direct";
  }
  if (normalized.includes("indirect") || normalized === "i" || normalized.startsWith("indir")) {
    return "indirect";
  }
  if (normalized === "s") {
    return "salaried";
  }
  if (normalized === "internal") {
    return "salaried";
  }
  if (normalized === "agency") {
    return "indirect";
  }
  return null;
}

