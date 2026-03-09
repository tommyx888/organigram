"use client";

import { defaultEmployeeRecords } from "@/lib/org/mock-data";
import type { EmployeeRecord, OrgDataLoadResult } from "@/lib/org/types";
import {
  isSupabaseConfigured,
  resolveActiveCompanyId,
  supabaseClient,
} from "@/lib/supabase/client";

const STORAGE_KEY = "organigram.employeeRecords";

export async function getEmployeeRecords(mode: "live" | "fallback" = "live"): Promise<OrgDataLoadResult> {
  try {
    const session = (await supabaseClient?.auth.getSession())?.data?.session;
    const headers: HeadersInit = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    const response = await fetch(`/api/org/records?mode=${mode}`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers,
    });

    if (response.ok) {
      const data = (await response.json()) as OrgDataLoadResult;
      return data;
    }
  } catch (error) {
    console.warn("Server org route failed, falling back to local.", error);
  }

  return readFromLocalStorage();
}

export async function saveEmployeeRecords(records: EmployeeRecord[]): Promise<void> {
  if (isSupabaseConfigured && supabaseClient) {
    const companyId = await resolveActiveCompanyId();
    const { error } = await writeEmployeesToSupabase(records, companyId);
    if (error) {
      console.warn("Supabase write failed. Data stored locally only.", error.message);
    }
  }

  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

async function writeEmployeesToSupabase(records: EmployeeRecord[], companyId: string | null) {
  if (!supabaseClient || !companyId) {
    return { error: null as { message: string } | null };
  }

  const { error: companyError } = await supabaseClient.from("companies").upsert(
    [{ id: companyId, code: "default", name: "Default Company" }],
    { onConflict: "id" },
  );
  if (companyError) {
    return { error: companyError };
  }

  const uniqueDepartments = Array.from(new Set(records.map((record) => record.department))).map((department) => ({
    company_id: companyId,
    code: slug(department),
    name: department,
  }));

  const { error: departmentError } = await supabaseClient.from("departments").upsert(uniqueDepartments, {
    onConflict: "company_id,code",
  });
  if (departmentError) {
    return { error: departmentError };
  }

  const { data: departmentRows, error: departmentReadError } = await supabaseClient
    .from("departments")
    .select("id, name")
    .eq("company_id", companyId);
  if (departmentReadError) {
    return { error: departmentReadError };
  }

  const departmentByName = new Map((departmentRows ?? []).map((row) => [row.name, row.id]));

  const uniquePositions = Array.from(
    new Map(
      records.map((record) => {
        const departmentId = departmentByName.get(record.department) ?? null;
        const key = `${record.positionName}-${record.positionType}-${departmentId ?? "none"}`;
        return [
          key,
          {
            company_id: companyId,
            department_id: departmentId,
            code: slug(`${record.positionName}-${record.positionType}`),
            title: record.positionName,
            position_type: record.positionType,
            active_flag: true,
          },
        ];
      }),
    ).values(),
  );

  const { error: positionError } = await supabaseClient.from("positions").upsert(uniquePositions, {
    onConflict: "company_id,code",
  });
  if (positionError) {
    return { error: positionError };
  }

  const { data: positionRows, error: positionReadError } = await supabaseClient
    .from("positions")
    .select("id, title, position_type, department_id")
    .eq("company_id", companyId);
  if (positionReadError) {
    return { error: positionReadError };
  }

  const positionKeyToId = new Map(
    (positionRows ?? []).map((row) => [
      `${row.title}-${row.position_type}-${row.department_id ?? "none"}`,
      row.id,
    ]),
  );

  const employeeRows = records.map((record) => {
    const departmentId = departmentByName.get(record.department) ?? null;
    const positionId =
      positionKeyToId.get(`${record.positionName}-${record.positionType}-${departmentId ?? "none"}`) ?? null;
    return {
      company_id: companyId,
      employee_id: record.employeeId,
      full_name: record.fullName,
      position_id: positionId,
      department_id: departmentId,
      manager_employee_id: record.managerEmployeeId ?? null,
      active_flag: true,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: employeeError } = await supabaseClient.from("employees").upsert(employeeRows, {
    onConflict: "company_id,employee_id",
  });

  return { error: employeeError };
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function readFromLocalStorage(): OrgDataLoadResult {
  if (typeof window === "undefined") {
    return {
      source: "local",
      records: defaultEmployeeRecords,
      issues: [],
      mode: "fallback",
      requestId: "server-local",
      attempts: [],
      finalReason: "Server-side local fallback.",
    };
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultEmployeeRecords));
    return {
      source: "local",
      records: defaultEmployeeRecords,
      issues: [],
      mode: "fallback",
      requestId: "client-local-init",
      attempts: [],
      finalReason: "Local storage initialized with demo dataset.",
    };
  }

  try {
    const parsed = JSON.parse(raw) as EmployeeRecord[];
    return {
      source: "local",
      records: parsed.length > 0 ? parsed : defaultEmployeeRecords,
      issues: [],
      mode: "fallback",
      requestId: "client-local-cache",
      attempts: [],
      finalReason: "Loaded from local storage cache.",
    };
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultEmployeeRecords));
    return {
      source: "local",
      records: defaultEmployeeRecords,
      issues: [],
      mode: "fallback",
      requestId: "client-local-recovery",
      attempts: [],
      finalReason: "Corrupted local cache recovered with demo dataset.",
    };
  }
}
