"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProjProject, ProjDepartment, ProjAssignment,
} from "@/lib/proj/types";
import {
  PERSON_TYPE_COLORS, PERSON_TYPE_LABELS, PROJECT_STATUS_LABELS,
} from "@/lib/proj/types";
import * as repo from "@/lib/proj/repository";
import { resolveActiveCompanyId } from "@/lib/supabase/client";
import { AssignmentDialog } from "./assignment-dialog";
import { ProjectDialog } from "./project-dialog";
import { DepartmentDialog } from "./department-dialog";
import { DepartmentSection } from "./department-section";
import { ProjectOrgchartView } from "./project-orgchart-view";

const ARTIFEX_NAVY = "#21394F";
const OLIVE = "#949C58";

export function ProjectTracker() {
  const [projects, setProjects] = useState<ProjProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<ProjDepartment[]>([]);
  const [assignments, setAssignments] = useState<ProjAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Dialógy
  const [editingAssignment, setEditingAssignment] = useState<ProjAssignment | null>(null);
  const [creatingInDept, setCreatingInDept] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjProject | "new" | null>(null);
  const [editingDept, setEditingDept] = useState<ProjDepartment | "new" | null>(null);
  const [newDeptParentId, setNewDeptParentId] = useState<string | null>(null);

  // Filtre
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Pohľad: zoznam vs org-chart
  const [viewMode, setViewMode] = useState<"list" | "chart">("chart");

  // Počet otvorených / interim pozícií (naprieč projektmi)
  const [openPositionCount, setOpenPositionCount] = useState<number | null>(null);

  // Načítaj projekty
  useEffect(() => {
    void (async () => {
      try {
        const [projs, cid] = await Promise.all([repo.fetchProjects(), resolveActiveCompanyId()]);
        setProjects(projs);
        setCompanyId(cid);
        if (projs.length > 0) setActiveProjectId(projs[0].id);
      } catch (e) {
        console.error("Načítanie projektov zlyhalo:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const tracked = await repo.fetchTrackedPositions();
        setOpenPositionCount(tracked.length);
      } catch (e) {
        console.error("Načítanie otvorených pozícií zlyhalo:", e);
      }
    })();
  }, []);

  // Načítaj detail projektu.
  // silent = tichý refresh (po uložení/zmene): nezobrazí "Načítavam…", takže
  // sa canvas neodmountuje a zostane zachovaný zoom/pozícia/scroll.
  const loadDetail = useCallback(async (projectId: string, silent = false) => {
    if (!silent) setLoadingDetail(true);
    try {
      const [depts, assigns] = await Promise.all([
        repo.fetchDepartments(projectId),
        repo.fetchAssignments(projectId),
      ]);
      setDepartments(depts);
      setAssignments(assigns);
    } catch (e) {
      console.error("Načítanie detailu zlyhalo:", e);
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (activeProjectId) void loadDetail(activeProjectId);
  }, [activeProjectId, loadDetail]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  // Zoskup assignmenty podľa oddelení + filter
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (filterType !== "all" && a.person_type !== filterType) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        const name = (a.iac_employee?.meno ?? a.person_name ?? "").toLowerCase();
        const pos = a.position_title.toLowerCase();
        if (!name.includes(s) && !pos.includes(s)) return false;
      }
      return true;
    });
  }, [assignments, filterType, search]);

  const assignmentsByDept = useMemo(() => {
    const map = new Map<string, ProjAssignment[]>();
    for (const a of filteredAssignments) {
      const key = a.department_id ?? "none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [filteredAssignments]);

  // Statistiky projektu - len za karty NA PLATNE org-chartu (canvas_x != null)
  // A zaroven s home_location = Lozorno
  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    let totalFte = 0;
    const lozorno = assignments.filter(
      (a) =>
        a.canvas_x != null &&
        (a.home_location ?? "").trim().toLowerCase() === "lozorno",
    );
    for (const a of lozorno) {
      byType[a.person_type] = (byType[a.person_type] ?? 0) + 1;
      const alloc = a.allocations?.[0]?.allocation_pct ?? 0;
      totalFte += (alloc / 100) * (a.headcount ?? 1);
    }
    return { byType, totalFte, total: lozorno.length };
  }, [assignments]);

  // ─── Akcie ───
  const handleSaveAssignment = useCallback(async () => {
    if (activeProjectId) await loadDetail(activeProjectId, true);
    setEditingAssignment(null);
    setCreatingInDept(null);
    setCreatingNew(false);
  }, [activeProjectId, loadDetail]);

  const handleDeleteAssignment = useCallback(async (id: string) => {
    if (!confirm("Naozaj odstrániť toto pridelenie?")) return;
    await repo.deleteAssignment(id);
    if (activeProjectId) await loadDetail(activeProjectId, true);
  }, [activeProjectId, loadDetail]);

  const handleSaveProject = useCallback(async () => {
    const projs = await repo.fetchProjects();
    setProjects(projs);
    setEditingProject(null);
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    if (!confirm("Naozaj odstrániť celý projekt vrátane všetkých pridelení?")) return;
    await repo.deleteProject(id);
    const projs = await repo.fetchProjects();
    setProjects(projs);
    if (activeProjectId === id) setActiveProjectId(projs[0]?.id ?? null);
  }, [activeProjectId]);

  const handleSaveDept = useCallback(async () => {
    if (activeProjectId) {
      const depts = await repo.fetchDepartments(activeProjectId);
      setDepartments(depts);
    }
    setEditingDept(null);
  }, [activeProjectId]);

  const handleDeleteDept = useCallback(async (id: string) => {
    if (!confirm("Odstrániť oddelenie? Pridelenia v ňom ostanú bez oddelenia.")) return;
    await repo.deleteDepartment(id);
    if (activeProjectId) await loadDetail(activeProjectId, true);
  }, [activeProjectId, loadDetail]);

  // Nastavenie nadriadeného (org-chart spojenie) — optimisticky
  const handleSetReportsTo = useCallback(async (childId: string, parentId: string | null) => {
    setAssignments((prev) => prev.map((a) =>
      a.id === childId ? { ...a, reports_to_id: parentId } : a
    ));
    try {
      await repo.setReportsTo(childId, parentId);
    } catch (e) {
      console.error("Spojenie zlyhalo:", e);
      if (activeProjectId) await loadDetail(activeProjectId, true);
    }
  }, [activeProjectId, loadDetail]);

  if (loading) {
    return <div className="p-8 text-sm text-slate-600">Načítavam projekty…</div>;
  }

  return (
    <div className="mx-auto max-w-[1720px] px-6 py-6">
      {/* Návrat na org-chart */}
      <a href="/org-chart"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
        ← Späť na organigram
      </a>

      {/* HORNÝ PANEL — projekty ako taby */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Projekty</h2>
          <Link
            href="/interim"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-900 transition hover:border-cyan-300 hover:bg-cyan-100"
          >
            Otvorené &amp; interim pozície
            {openPositionCount != null ? (
              <span className="rounded-full bg-cyan-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {openPositionCount}
              </span>
            ) : null}
          </Link>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveProjectId(p.id)}
              className={`rounded-xl border px-4 py-2.5 text-left transition ${
                p.id === activeProjectId
                  ? "border-transparent shadow-md"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              style={p.id === activeProjectId ? { background: p.color, color: "#fff" } : {}}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ background: p.id === activeProjectId ? "#fff" : p.color }}
                />
                <span className="text-sm font-bold">{p.name}</span>
              </div>
              <div className={`mt-0.5 text-xs ${p.id === activeProjectId ? "text-white/80" : "text-slate-500"}`}>
                {p.code} · {PROJECT_STATUS_LABELS[p.status]}
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEditingProject("new")}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
          >
            + Nový projekt
          </button>
          {projects.length === 0 && (
            <p className="self-center text-xs text-slate-400">Zatiaľ žiadne projekty.</p>
          )}
        </div>
      </div>

      {/* DETAIL projektu — plná šírka */}
      <main className="min-w-0">
        {!activeProject ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
            Vyber projekt hore alebo vytvor nový.
          </div>
        ) : (
          <>
            {/* Hlavička projektu */}
            <div className="mb-5 flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-4">
                <span className="inline-block h-12 w-12 rounded-xl" style={{ background: activeProject.color }} />
                <div>
                  <h1 className="text-2xl font-black" style={{ color: ARTIFEX_NAVY }}>{activeProject.name}</h1>
                  <p className="text-sm text-slate-500">
                    {activeProject.code} · {PROJECT_STATUS_LABELS[activeProject.status]}
                    {activeProject.description ? ` · ${activeProject.description}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingProject(activeProject)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Upraviť
                </button>
                <button type="button" onClick={() => handleDeleteProject(activeProject.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                  Zmazať
                </button>
              </div>
            </div>

            {/* Štatistiky */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <StatCard label="Pozícií spolu" value={String(stats.total)} color={ARTIFEX_NAVY} />
              <StatCard label="FTE (súčet %)" value={stats.totalFte.toFixed(1)} color={OLIVE} />
              {(Object.keys(PERSON_TYPE_LABELS) as Array<keyof typeof PERSON_TYPE_LABELS>).map((t) =>
                stats.byType[t] ? (
                  <StatCard key={t} label={PERSON_TYPE_LABELS[t]} value={String(stats.byType[t])} color={PERSON_TYPE_COLORS[t]} />
                ) : null
              )}
            </div>

            {/* Filtre */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {/* Prepínač pohľadu */}
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                <button type="button" onClick={() => setViewMode("list")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${viewMode === "list" ? "bg-white shadow" : "text-slate-500"}`}>
                  Zoznam
                </button>
                <button type="button" onClick={() => setViewMode("chart")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${viewMode === "chart" ? "bg-white shadow" : "text-slate-500"}`}>
                  Org-chart
                </button>
              </div>
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Hľadať meno alebo pozíciu…"
                className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="all">Všetky typy</option>
                {(Object.keys(PERSON_TYPE_LABELS) as Array<keyof typeof PERSON_TYPE_LABELS>).map((t) => (
                  <option key={t} value={t}>{PERSON_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <div className="flex-1" />
              <button type="button" onClick={() => { setNewDeptParentId(null); setEditingDept("new"); }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                + Oddelenie
              </button>
            </div>

            {/* Oddelenia + pridelenia */}
            {loadingDetail ? (
              <div className="p-8 text-sm text-slate-500">Načítavam…</div>
            ) : viewMode === "chart" ? (
              <ProjectOrgchartView
                project={activeProject}
                departments={departments}
                assignments={filteredAssignments}
                onEditPerson={setEditingAssignment}
                onDeletePerson={handleDeleteAssignment}
                onAddPerson={(deptId) => { if (deptId) { setCreatingInDept(deptId); } else { setCreatingNew(true); } }}
                onSetReportsTo={handleSetReportsTo}
                onPositionsChanged={() => { if (activeProjectId) void loadDetail(activeProjectId, true); }}
              />
            ) : (
              <div className="space-y-5">
                {departments.map((dept) => (
                  <DepartmentSection
                    key={dept.id}
                    dept={dept}
                    assignments={assignmentsByDept.get(dept.id) ?? []}
                    onAddPerson={() => setCreatingInDept(dept.id)}
                    onEditPerson={setEditingAssignment}
                    onDeletePerson={handleDeleteAssignment}
                    onEditDept={() => setEditingDept(dept)}
                    onDeleteDept={() => handleDeleteDept(dept.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* DIALÓGY */}
      {(editingAssignment || creatingInDept || creatingNew) && activeProjectId && (
        <AssignmentDialog
          projectId={activeProjectId}
          departmentId={creatingInDept}
          assignment={editingAssignment}
          allAssignments={assignments}
          onClose={() => { setEditingAssignment(null); setCreatingInDept(null); setCreatingNew(false); }}
          onSaved={handleSaveAssignment}
        />
      )}
      {editingProject && (
        <ProjectDialog
          project={editingProject === "new" ? null : editingProject}
          companyId={companyId}
          onClose={() => setEditingProject(null)}
          onSaved={handleSaveProject}
        />
      )}
      {editingDept && activeProjectId && (
        <DepartmentDialog
          projectId={activeProjectId}
          department={editingDept === "new" ? null : editingDept}
          existingCount={departments.length}
          allDepartments={departments}
          defaultParentId={editingDept === "new" ? newDeptParentId : null}
          onClose={() => { setEditingDept(null); setNewDeptParentId(null); }}
          onSaved={handleSaveDept}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-2xl font-black" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

