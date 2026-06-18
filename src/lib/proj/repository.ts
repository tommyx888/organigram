// Repository pre projektový tracking — Supabase client-side CRUD
import { supabaseClient } from "@/lib/supabase/client";
import type {
  ProjProject, ProjDepartment, ProjAssignment, ProjAllocation, IacEmployeeOption,
  ProjInterimLog, InterimPerson,
  ProjPositionMeta, ProjPositionCandidate, ProjPositionDocument, TrackedPosition,
  ItAccountForm,
} from "./types";

function db() {
  if (!supabaseClient) throw new Error("Supabase nie je nakonfigurovaný");
  return supabaseClient;
}

// ─── PROJEKTY ───
export async function fetchProjects(): Promise<ProjProject[]> {
  const { data, error } = await db()
    .from("proj_projects").select("*").order("display_order");
  if (error) throw error;
  return data ?? [];
}

export async function createProject(p: Partial<ProjProject>): Promise<ProjProject> {
  const { data, error } = await db().from("proj_projects").insert(p).select().single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, p: Partial<ProjProject>): Promise<void> {
  const { error } = await db().from("proj_projects")
    .update({ ...p, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await db().from("proj_projects").delete().eq("id", id);
  if (error) throw error;
}

// ─── ODDELENIA ───
export async function fetchDepartments(projectId: string): Promise<ProjDepartment[]> {
  const { data, error } = await db()
    .from("proj_departments").select("*")
    .eq("project_id", projectId).order("display_order");
  if (error) throw error;
  return data ?? [];
}

export async function createDepartment(d: Partial<ProjDepartment>): Promise<ProjDepartment> {
  const { data, error } = await db().from("proj_departments").insert(d).select().single();
  if (error) throw error;
  return data;
}

export async function updateDepartment(id: string, d: Partial<ProjDepartment>): Promise<void> {
  const { error } = await db().from("proj_departments").update(d).eq("id", id);
  if (error) throw error;
}

export async function deleteDepartment(id: string): Promise<void> {
  const { error } = await db().from("proj_departments").delete().eq("id", id);
  if (error) throw error;
}

// ─── PRIDELENIA ───
export async function fetchAssignments(projectId: string): Promise<ProjAssignment[]> {
  const { data, error } = await db()
    .from("proj_assignments")
    .select(`*, allocations:proj_allocations(*), iac_employee:iac_employees(id, meno, funkcia_v_pz, os_c)`)
    .eq("project_id", projectId)
    .order("display_order");
  if (error) throw error;
  return (data ?? []) as ProjAssignment[];
}

export async function createAssignment(a: Partial<ProjAssignment>): Promise<ProjAssignment> {
  const { allocations, iac_employee, ...clean } = a as Record<string, unknown> & ProjAssignment;
  const { data, error } = await db().from("proj_assignments").insert(clean).select().single();
  if (error) throw error;
  return data;
}

export async function updateAssignment(id: string, a: Partial<ProjAssignment>): Promise<void> {
  const { allocations, iac_employee, ...clean } = a as Record<string, unknown> & Partial<ProjAssignment>;
  const { error } = await db().from("proj_assignments")
    .update({ ...clean, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await db().from("proj_assignments").delete().eq("id", id);
  if (error) throw error;
}

// Presun pridelenia do ineho oddelenia
export async function moveAssignment(id: string, departmentId: string | null): Promise<void> {
  const { error } = await db().from("proj_assignments")
    .update({ department_id: departmentId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Nastavenie nadriadeneho (hierarchia osob)
export async function setReportsTo(id: string, reportsToId: string | null): Promise<void> {
  const { error } = await db().from("proj_assignments")
    .update({ reports_to_id: reportsToId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Ulozenie pozicie karty na canvas (free-form org-chart). null x/y = vrat do zasobnika
export async function setCanvasPosition(
  id: string, x: number | null, y: number | null, colSpan?: number
): Promise<void> {
  const patch: Record<string, unknown> = { canvas_x: x, canvas_y: y };
  if (colSpan != null) patch.canvas_col_span = colSpan;
  const { error } = await db().from("proj_assignments").update(patch).eq("id", id);
  if (error) throw error;
}

// Ulozenie velkosti karty
export async function setCanvasSize(id: string, w: number, h: number): Promise<void> {
  const { error } = await db().from("proj_assignments")
    .update({ canvas_w: w, canvas_h: h }).eq("id", id);
  if (error) throw error;
}

// Skopiruje vybrane karty (assignments) do INEHO projektu ako nove karty.
// Zachova canvas poziciu/velkost a hierarchiu reports_to MEDZI vybranymi kartami
// (reports_to smerujuci mimo vyberu sa zahodi). Vrati pocet skopirovanych kariet.
export async function copyAssignmentsToProject(
  sourceIds: string[], targetProjectId: string,
): Promise<number> {
  if (sourceIds.length === 0) return 0;
  // Nacitaj zdrojove karty (len skutocne vybrane)
  const { data, error } = await db()
    .from("proj_assignments").select("*").in("id", sourceIds);
  if (error) throw error;
  const rows = (data ?? []) as ProjAssignment[];
  if (rows.length === 0) return 0;

  const selected = new Set(rows.map((r) => r.id));
  // Mapovanie stare ID -> nove ID (vygenerujeme dopredu, aby sme vedeli premapovat reports_to)
  const idMap = new Map<string, string>();
  for (const r of rows) {
    const nid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    idMap.set(r.id, nid);
  }

  const now = new Date().toISOString();
  const payload = rows.map((r) => {
    // ponechame len stlpce, ktore chceme kopirovat (department_id sa nekopiruje — ine projekty maju ine oddelenia)
    const parentInSel = r.reports_to_id && selected.has(r.reports_to_id);
    return {
      id: idMap.get(r.id)!,
      project_id: targetProjectId,
      department_id: null,
      iac_employee_id: r.iac_employee_id ?? null,
      person_name: r.person_name ?? null,
      position_title: r.position_title ?? "",
      person_type: r.person_type,
      home_location: r.home_location ?? null,
      contact_type: r.contact_type ?? null,
      status: r.status,
      is_placeholder: r.is_placeholder ?? false,
      overall_start_date: r.overall_start_date ?? null,
      overall_end_date: r.overall_end_date ?? null,
      headcount: r.headcount ?? 1,
      note: r.note ?? null,
      reports_to_id: parentInSel ? idMap.get(r.reports_to_id as string)! : null,
      is_group: r.is_group ?? false,
      canvas_x: r.canvas_x ?? null,
      canvas_y: r.canvas_y ?? null,
      canvas_col_span: r.canvas_col_span ?? 1,
      canvas_w: r.canvas_w ?? null,
      canvas_h: r.canvas_h ?? null,
      card_color: r.card_color ?? null,
      display_order: r.display_order ?? 0,
      created_at: now,
      updated_at: now,
    };
  });

  const { error: insErr } = await db().from("proj_assignments").insert(payload);
  if (insErr) throw insErr;
  return payload.length;
}

// Hromadne ulozenie pozicii (po auto-layoute)
export async function saveCanvasPositions(
  items: { id: string; canvas_x: number; canvas_y: number; canvas_col_span?: number }[]
): Promise<void> {
  for (const it of items) {
    const patch: Record<string, unknown> = { canvas_x: it.canvas_x, canvas_y: it.canvas_y };
    if (it.canvas_col_span != null) patch.canvas_col_span = it.canvas_col_span;
    const { error } = await db().from("proj_assignments").update(patch).eq("id", it.id);
    if (error) throw error;
  }
}

// Hromadna aktualizacia poradia pridelenii
export async function reorderAssignments(items: { id: string; display_order: number }[]): Promise<void> {
  for (const it of items) {
    const { error } = await db().from("proj_assignments")
      .update({ display_order: it.display_order }).eq("id", it.id);
    if (error) throw error;
  }
}

// Hromadna aktualizacia poradia oddeleni
export async function reorderDepartments(items: { id: string; display_order: number }[]): Promise<void> {
  for (const it of items) {
    const { error } = await db().from("proj_departments")
      .update({ display_order: it.display_order }).eq("id", it.id);
    if (error) throw error;
  }
}

// ─── ALOKÁCIE ───
export async function createAllocation(a: Partial<ProjAllocation>): Promise<ProjAllocation> {
  const { data, error } = await db().from("proj_allocations").insert(a).select().single();
  if (error) throw error;
  return data;
}

export async function updateAllocation(id: string, a: Partial<ProjAllocation>): Promise<void> {
  const { error } = await db().from("proj_allocations").update(a).eq("id", id);
  if (error) throw error;
}

export async function deleteAllocation(id: string): Promise<void> {
  const { error } = await db().from("proj_allocations").delete().eq("id", id);
  if (error) throw error;
}

// ─── iac_employees výber ───
export async function searchEmployees(query: string): Promise<IacEmployeeOption[]> {
  let q = db().from("iac_employees")
    .select("id, meno, funkcia_v_pz, os_c, department")
    .eq("a_n", "A").order("meno").limit(30);
  if (query.trim()) q = q.ilike("meno", `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as IacEmployeeOption[];
}

// ─── INTERIM TRACKING ───
// Načíta všetkých interim ľudí naprieč VŠETKÝMI projektmi a zoskupí ich
// podľa iac_employee_id (alebo mena, ak zamestnanec nie je nalinkovaný).
export async function fetchInterimPeople(): Promise<InterimPerson[]> {
  const { data, error } = await db()
    .from("proj_assignments")
    .select(`*, allocations:proj_allocations(*), iac_employee:iac_employees(id, meno, funkcia_v_pz, os_c)`)
    .eq("person_type", "interim")
    .order("display_order");
  if (error) throw error;
  const rows = (data ?? []) as ProjAssignment[];

  const map = new Map<string, InterimPerson>();
  for (const a of rows) {
    const name = a.iac_employee?.meno ?? a.person_name ?? a.position_title ?? "—";
    const key = a.iac_employee_id ?? `name:${name.trim().toLowerCase()}`;
    const existing = map.get(key);
    if (existing) existing.assignments.push(a);
    else map.set(key, { key, iac_employee_id: a.iac_employee_id, name, assignments: [a] });
  }
  return [...map.values()].sort((x, y) => x.name.localeCompare(y.name, "sk"));
}

// Načíta jedného interim človeka podľa kľúča (iac_employee_id alebo "name:<meno>").
export async function fetchInterimPerson(key: string): Promise<InterimPerson | null> {
  const people = await fetchInterimPeople();
  return people.find((p) => p.key === key) ?? null;
}

// Log úkonov pre daného interim človeka (podľa iac_employee_id alebo mena).
export async function fetchInterimLog(
  iacEmployeeId: string | null, personName: string | null,
): Promise<ProjInterimLog[]> {
  let q = db().from("proj_interim_log").select("*").order("created_at", { ascending: false });
  if (iacEmployeeId) q = q.eq("iac_employee_id", iacEmployeeId);
  else if (personName) q = q.eq("person_name", personName);
  else return [];
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProjInterimLog[];
}

export async function createInterimLog(entry: Partial<ProjInterimLog>): Promise<ProjInterimLog> {
  const { data, error } = await db().from("proj_interim_log").insert(entry).select().single();
  if (error) throw error;
  return data as ProjInterimLog;
}

export async function updateInterimLog(id: string, entry: Partial<ProjInterimLog>): Promise<void> {
  const { error } = await db().from("proj_interim_log")
    .update({ ...entry, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteInterimLog(id: string): Promise<void> {
  const { error } = await db().from("proj_interim_log").delete().eq("id", id);
  if (error) throw error;
}

// ─── POSITION TRACKING (interim + TBD obsadzovanie) ───
// Pozície na obsadenie = person_type 'interim' alebo 'tbd', alebo status 'tbd',
// naprieč VŠETKÝMI projektmi. Vracia základný zoznam (bez ťažkých joinov).
export async function fetchTrackedPositions(): Promise<TrackedPosition[]> {
  const { data, error } = await db()
    .from("proj_assignments")
    .select(`*, allocations:proj_allocations(*), iac_employee:iac_employees(id, meno, funkcia_v_pz, os_c), project:proj_projects(id, name)`)
    .or("person_type.eq.interim,person_type.eq.tbd,status.eq.tbd")
    .order("display_order");
  if (error) throw error;
  const rows = (data ?? []) as (ProjAssignment & { project?: { id: string; name: string } | null })[];
  return rows.map((a) => ({
    assignment: a,
    projectName: a.project?.name ?? null,
    meta: null,
    candidates: [],
    documents: [],
  }));
}

// Detail jednej pozície s meta, kandidátmi a dokumentmi.
export async function fetchTrackedPosition(assignmentId: string): Promise<TrackedPosition | null> {
  const { data: a, error: ae } = await db()
    .from("proj_assignments")
    .select(`*, allocations:proj_allocations(*), iac_employee:iac_employees(id, meno, funkcia_v_pz, os_c), project:proj_projects(id, name)`)
    .eq("id", assignmentId)
    .maybeSingle();
  if (ae) throw ae;
  if (!a) return null;
  const asg = a as ProjAssignment & { project?: { id: string; name: string } | null };

  const [metaRes, candRes, docRes] = await Promise.all([
    db().from("proj_position_meta").select("*").eq("assignment_id", assignmentId).maybeSingle(),
    db().from("proj_position_candidates").select("*").eq("assignment_id", assignmentId).order("created_at"),
    db().from("proj_position_documents").select("*").eq("assignment_id", assignmentId).order("uploaded_at", { ascending: false }),
  ]);
  if (metaRes.error) throw metaRes.error;
  if (candRes.error) throw candRes.error;
  if (docRes.error) throw docRes.error;

  return {
    assignment: asg,
    projectName: asg.project?.name ?? null,
    meta: (metaRes.data as ProjPositionMeta | null) ?? null,
    candidates: (candRes.data ?? []) as ProjPositionCandidate[],
    documents: (docRes.data ?? []) as ProjPositionDocument[],
  };
}

// META — upsert (1:1 s assignment)
export async function upsertPositionMeta(
  assignmentId: string, patch: Partial<ProjPositionMeta>,
): Promise<ProjPositionMeta> {
  const { data, error } = await db()
    .from("proj_position_meta")
    .upsert({ assignment_id: assignmentId, ...patch, updated_at: new Date().toISOString() },
            { onConflict: "assignment_id" })
    .select().single();
  if (error) throw error;
  return data as ProjPositionMeta;
}

// KANDIDÁTI
export async function createCandidate(c: Partial<ProjPositionCandidate>): Promise<ProjPositionCandidate> {
  const { data, error } = await db().from("proj_position_candidates").insert(c).select().single();
  if (error) throw error;
  return data as ProjPositionCandidate;
}

export async function updateCandidate(id: string, c: Partial<ProjPositionCandidate>): Promise<void> {
  const { error } = await db().from("proj_position_candidates")
    .update({ ...c, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteCandidate(id: string): Promise<void> {
  const { error } = await db().from("proj_position_candidates").delete().eq("id", id);
  if (error) throw error;
}

// DOKUMENTY — upload do Storage + záznam v DB
const POS_BUCKET = "position-docs";

export async function uploadPositionDocument(
  assignmentId: string, file: File, candidateId?: string | null,
): Promise<ProjPositionDocument> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${assignmentId}/${Date.now()}_${safeName}`;
  const { error: upErr } = await db().storage.from(POS_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream", upsert: false,
  });
  if (upErr) throw upErr;
  const { data, error } = await db().from("proj_position_documents").insert({
    assignment_id: assignmentId,
    candidate_id: candidateId ?? null,
    file_name: file.name,
    storage_path: path,
    mime_type: file.type || null,
    size_bytes: file.size,
  }).select().single();
  if (error) throw error;
  return data as ProjPositionDocument;
}

// Podpísaná URL na stiahnutie/náhľad dokumentu (privatny bucket)
export async function getDocumentUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await db().storage.from(POS_BUCKET).createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function deletePositionDocument(doc: ProjPositionDocument): Promise<void> {
  await db().storage.from(POS_BUCKET).remove([doc.storage_path]);
  const { error } = await db().from("proj_position_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

// ─── IT ŽIADOSŤ O ÚČET (zapis do it_account_requests, rovnako ako portál) ───
export async function createItAccountRequest(
  form: ItAccountForm, employeeId?: string | null,
): Promise<{ id: string }> {
  // token je NOT NULL v it_account_requests (portál ho používa na verejný podpisový link)
  const token = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const { data, error } = await db()
    .from("it_account_requests")
    .insert({
      action: form.action,
      status: "pending",
      token,
      employee_id: employeeId ?? null,
      supervisor_name: form.supervisor_name,
      effective_from: form.effective_from,
      comment: form.comment,
      user_section: form.user_section,
      pc: form.pc,
      ibm: form.ibm,
      access: form.access,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}
