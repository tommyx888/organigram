import { supabaseClient } from "@/lib/supabase/client";
import { beginPersist, endPersist } from "@/lib/org/persist-status";

export type OverrideRow = { employee_id: string; override_parent_id: string };

// Backward compat alias pre sekcie
export type SectionMemberRow = { employee_id: string; section_id: string };

type PendingOp =
  | { type: "upsert"; row: OverrideRow }
  | { type: "remove"; employeeId: string };

let latestMembers: SectionMemberRow[] = [];
let pendingOps: PendingOp[] = [];
let writeChain: Promise<void> = Promise.resolve();
let flushRunning = false;
const membersListeners = new Set<(rows: SectionMemberRow[]) => void>();

function notifyMembers() {
  const snapshot = latestMembers;
  for (const listener of membersListeners) listener(snapshot);
}

export function subscribeSectionMembers(listener: (rows: SectionMemberRow[]) => void): () => void {
  membersListeners.add(listener);
  return () => {
    membersListeners.delete(listener);
  };
}

async function getAuthToken(): Promise<string | null> {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? null;
}

function applyOp(members: SectionMemberRow[], op: PendingOp): SectionMemberRow[] {
  if (op.type === "remove") {
    return members.filter((m) => m.employee_id !== op.employeeId);
  }
  return [
    ...members.filter((m) => m.employee_id !== op.row.employee_id),
    { employee_id: op.row.employee_id, section_id: op.row.override_parent_id },
  ];
}

function compactOps(ops: PendingOp[]): PendingOp[] {
  const lastByEmployee = new Map<string, PendingOp>();
  for (const op of ops) {
    const id = op.type === "remove" ? op.employeeId : op.row.employee_id;
    lastByEmployee.set(id, op);
  }
  return [...lastByEmployee.values()];
}

async function fetchOverridesFromNetwork(): Promise<SectionMemberRow[]> {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("org_chart_overrides")
    .select("employee_id, override_parent_id");

  if (error) {
    console.warn("[section-members] fetchSectionMembers error:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    employee_id: r.employee_id,
    section_id: r.override_parent_id,
  }));
}

/**
 * Nacita vsetky chart overrides priamo cez Supabase JS client.
 * RLS: SELECT povoleny pre vsetkych authenticated — nepotrebujeme company_id filter.
 */
export async function fetchSectionMembers(): Promise<SectionMemberRow[]> {
  if (flushRunning || pendingOps.length > 0) {
    return latestMembers;
  }
  const rows = await fetchOverridesFromNetwork();
  if (flushRunning || pendingOps.length > 0) {
    return latestMembers;
  }
  latestMembers = rows;
  return rows;
}

export function isOverridePersistPending() {
  return flushRunning || pendingOps.length > 0;
}

async function patchOverrides(ops: PendingOp[]): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) return false;
  const upsert = ops.filter((op): op is Extract<PendingOp, { type: "upsert" }> => op.type === "upsert").map((op) => op.row);
  const remove = ops.filter((op): op is Extract<PendingOp, { type: "remove" }> => op.type === "remove").map((op) => op.employeeId);
  const res = await fetch("/api/org/chart-overrides", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ upsert, remove }),
  });
  return res.ok;
}

async function flushOverrideOps() {
  if (flushRunning) return;
  if (pendingOps.length === 0) return;
  flushRunning = true;
  beginPersist();
  try {
    while (pendingOps.length > 0) {
      const batch = compactOps(pendingOps.splice(0, pendingOps.length));
      const ok = await patchOverrides(batch);
      if (!ok) {
        latestMembers = await fetchOverridesFromNetwork();
        for (const op of pendingOps) {
          latestMembers = applyOp(latestMembers, op);
        }
        notifyMembers();
        endPersist(false, "Section assignment failed");
        return;
      }
    }
    endPersist(true);
  } catch (error) {
    console.warn("[section-members] flush failed:", error);
    latestMembers = await fetchOverridesFromNetwork();
    for (const op of pendingOps) {
      latestMembers = applyOp(latestMembers, op);
    }
    notifyMembers();
    endPersist(false, "Section assignment failed");
  } finally {
    flushRunning = false;
    if (pendingOps.length > 0) {
      writeChain = writeChain.then(flushOverrideOps, flushOverrideOps);
    }
  }
}

function enqueue(op: PendingOp): Promise<SectionMemberRow[]> {
  latestMembers = applyOp(latestMembers, op);
  pendingOps.push(op);
  writeChain = writeChain.then(flushOverrideOps, flushOverrideOps);
  return Promise.resolve(latestMembers);
}

export async function addEmployeeToSection(
  employeeId: string,
  sectionId: string,
  _currentMembers?: SectionMemberRow[],
): Promise<SectionMemberRow[]> {
  return enqueue({
    type: "upsert",
    row: { employee_id: employeeId, override_parent_id: sectionId },
  });
}

export async function removeEmployeeFromSection(
  employeeId: string,
  _currentMembers?: SectionMemberRow[],
): Promise<SectionMemberRow[]> {
  return enqueue({ type: "remove", employeeId });
}

export async function removeSectionAllMembers(
  sectionId: string,
  _currentMembers?: SectionMemberRow[],
): Promise<SectionMemberRow[]> {
  const toRemove = latestMembers.filter((m) => m.section_id === sectionId);
  for (const row of toRemove) {
    latestMembers = applyOp(latestMembers, { type: "remove", employeeId: row.employee_id });
    pendingOps.push({ type: "remove", employeeId: row.employee_id });
  }
  writeChain = writeChain.then(flushOverrideOps, flushOverrideOps);
  return Promise.resolve(latestMembers);
}

/**
 * Prirad zamestnanca pod vacancy alebo ineho rodica (universal override).
 * Pouziva sa ked admin zmeni nadriadeného zamestnanca v detail paneli.
 */
export async function setEmployeeParentOverride(
  employeeId: string,
  newParentId: string | null,
  _currentMembers?: SectionMemberRow[],
): Promise<SectionMemberRow[]> {
  if (newParentId) {
    return enqueue({
      type: "upsert",
      row: { employee_id: employeeId, override_parent_id: newParentId },
    });
  }
  return enqueue({ type: "remove", employeeId });
}
