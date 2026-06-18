"use client";

import { useEffect, useState } from "react";
import type {
  ProjAssignment, PersonType, AssignmentStatus, IacEmployeeOption, ProjAllocation,
} from "@/lib/proj/types";
import { PERSON_TYPE_LABELS, STATUS_LABELS } from "@/lib/proj/types";
import * as repo from "@/lib/proj/repository";

const ARTIFEX_NAVY = "#21394F";

type AllocDraft = { id?: string; period_from: string; period_to: string; allocation_pct: number; label: string };

export function AssignmentDialog({
  projectId, departmentId, assignment, allAssignments, onClose, onSaved,
}: {
  projectId: string;
  departmentId: string | null;
  assignment: ProjAssignment | null;
  allAssignments?: ProjAssignment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(assignment);

  // Polia
  const [mode, setMode] = useState<"manual" | "iac">(assignment?.iac_employee_id ? "iac" : "manual");
  const [personName, setPersonName] = useState(assignment?.person_name ?? "");
  const [iacId, setIacId] = useState<string | null>(assignment?.iac_employee_id ?? null);
  const [iacLabel, setIacLabel] = useState<string>(assignment?.iac_employee?.meno ?? "");
  const [positionTitle, setPositionTitle] = useState(assignment?.position_title ?? "");
  const [personType, setPersonType] = useState<PersonType>(assignment?.person_type ?? "internal");
  const [homeLocation, setHomeLocation] = useState(assignment?.home_location ?? "");
  const [status, setStatus] = useState<AssignmentStatus>(assignment?.status ?? "planned");
  const [isPlaceholder, setIsPlaceholder] = useState(assignment?.is_placeholder ?? false);
  const [startDate, setStartDate] = useState(assignment?.overall_start_date ?? "");
  const [endDate, setEndDate] = useState(assignment?.overall_end_date ?? "");
  const [headcount, setHeadcount] = useState(assignment?.headcount ?? 1);
  const [note, setNote] = useState(assignment?.note ?? "");
  const [reportsToId, setReportsToId] = useState<string>(assignment?.reports_to_id ?? "");
  const [reportsToQuery, setReportsToQuery] = useState("");
  const [isGroup, setIsGroup] = useState(assignment?.is_group ?? false);

  // Alokácie
  const [allocations, setAllocations] = useState<AllocDraft[]>(
    (assignment?.allocations ?? []).map((a) => ({
      id: a.id, period_from: a.period_from, period_to: a.period_to ?? "",
      allocation_pct: a.allocation_pct, label: a.label ?? "",
    }))
  );

  // Vyhľadávanie zamestnancov
  const [empQuery, setEmpQuery] = useState("");
  const [empResults, setEmpResults] = useState<IacEmployeeOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "iac") return;
    const t = setTimeout(async () => {
      setSearching(true);
      try { setEmpResults(await repo.searchEmployees(empQuery)); }
      catch (e) { console.error(e); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [empQuery, mode]);

  function addAllocation() {
    setAllocations((prev) => [...prev, { period_from: startDate || new Date().toISOString().slice(0, 10), period_to: "", allocation_pct: 100, label: "" }]);
  }
  function updateAlloc(i: number, patch: Partial<AllocDraft>) {
    setAllocations((prev) => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  }
  function removeAlloc(i: number) {
    setAllocations((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    const hasName = mode === "iac" ? Boolean(iacId) : Boolean(personName.trim());
    const hasPosition = Boolean(positionTitle.trim());
    // Stačí aspoň jedno — meno ALEBO pozícia (nie nutne oboje)
    if (!hasName && !hasPosition && !isPlaceholder) {
      alert("Zadaj aspoň meno alebo pozíciu (stačí jedno z nich).");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<ProjAssignment> = {
        project_id: projectId,
        department_id: departmentId ?? assignment?.department_id ?? null,
        iac_employee_id: mode === "iac" ? iacId : null,
        person_name: mode === "manual" ? (personName.trim() || null) : (iacLabel || personName || null),
        position_title: positionTitle.trim() || "",
        person_type: personType,
        home_location: homeLocation.trim() || null,
        status,
        is_placeholder: isPlaceholder,
        reports_to_id: reportsToId || null,
        is_group: isGroup,
        overall_start_date: startDate || null,
        overall_end_date: endDate || null,
        headcount: Number(headcount) || 1,
        note: note.trim() || null,
      };

      let assignmentId: string;
      if (isEdit && assignment) {
        await repo.updateAssignment(assignment.id, payload);
        assignmentId = assignment.id;
        // Zmaž staré alokácie a vytvor nové (jednoduchšie než diff)
        for (const old of assignment.allocations ?? []) {
          await repo.deleteAllocation(old.id);
        }
      } else {
        const created = await repo.createAssignment(payload);
        assignmentId = created.id;
      }

      // Ulož alokácie
      for (const al of allocations) {
        if (!al.period_from) continue;
        await repo.createAllocation({
          assignment_id: assignmentId,
          period_from: al.period_from,
          period_to: al.period_to || null,
          allocation_pct: Number(al.allocation_pct) || 0,
          label: al.label.trim() || null,
        });
      }
      onSaved();
    } catch (e) {
      console.error("Uloženie zlyhalo:", e);
      alert("Uloženie zlyhalo. Skús znova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(e) => {
        // Enter uloží (okrem situácie keď píšeš do viacriadkového poľa alebo hľadáš zamestnanca)
        if (e.key === "Enter" && !e.shiftKey) {
          const tag = (e.target as HTMLElement)?.tagName;
          const isSearchBox = (e.target as HTMLInputElement)?.placeholder?.startsWith("Hľadaj");
          if (tag !== "TEXTAREA" && !isSearchBox) {
            e.preventDefault();
            if (!saving) void handleSave();
          }
        }
        if (e.key === "Escape") { e.preventDefault(); onClose(); }
      }}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-black" style={{ color: ARTIFEX_NAVY }}>
          {isEdit ? "Upraviť pridelenie" : "Nové pridelenie"}
        </h2>

        {/* Prepínač: manuál vs iac */}
        <div className="mb-4 flex gap-2 rounded-lg bg-slate-100 p-1">
          <button type="button" onClick={() => setMode("manual")}
            className={`flex-1 rounded-md py-1.5 text-sm font-semibold ${mode === "manual" ? "bg-white shadow" : "text-slate-500"}`}>
            Ručné zadanie
          </button>
          <button type="button" onClick={() => setMode("iac")}
            className={`flex-1 rounded-md py-1.5 text-sm font-semibold ${mode === "iac" ? "bg-white shadow" : "text-slate-500"}`}>
            Náš zamestnanec (IAC)
          </button>
        </div>

        {mode === "manual" ? (
          <Field label="Meno osoby">
            <input value={personName} onChange={(e) => setPersonName(e.target.value)}
              placeholder="napr. Dave Kennedy alebo nechaj prázdne pre TBD"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </Field>
        ) : (
          <Field label="Vyber zamestnanca z IAC">
            {iacId && (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <span className="text-sm font-semibold text-emerald-800">{iacLabel}</span>
                <button type="button" onClick={() => { setIacId(null); setIacLabel(""); }}
                  className="text-xs text-emerald-600 hover:underline">zmeniť</button>
              </div>
            )}
            {!iacId && (
              <>
                <input value={empQuery} onChange={(e) => setEmpQuery(e.target.value)}
                  placeholder="Hľadaj podľa mena…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                  {searching && <p className="px-3 py-2 text-xs text-slate-400">Hľadám…</p>}
                  {!searching && empResults.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Žiadne výsledky.</p>}
                  {empResults.map((emp) => (
                    <button key={emp.id} type="button"
                      onClick={() => {
                        setIacId(emp.id); setIacLabel(emp.meno);
                        if (!positionTitle) setPositionTitle(emp.funkcia_v_pz ?? "");
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                      <span className="font-semibold text-slate-800">{emp.meno}</span>
                      <span className="ml-2 text-xs text-slate-400">{emp.funkcia_v_pz ?? ""}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Field>
        )}

        <Field label="Názov pozície v projekte">
          <input value={positionTitle} onChange={(e) => setPositionTitle(e.target.value)}
            placeholder="napr. Programme Manager (nepovinné ak je vyplnené meno)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Typ osoby">
            <select value={personType} onChange={(e) => setPersonType(e.target.value as PersonType)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {(Object.keys(PERSON_TYPE_LABELS) as PersonType[]).map((t) => (
                <option key={t} value={t}>{PERSON_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </Field>
          <Field label="Stav">
            <select value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {(Object.keys(STATUS_LABELS) as AssignmentStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Lokalita">
            <input value={homeLocation} onChange={(e) => setHomeLocation(e.target.value)}
              placeholder="Lozorno / Elmdon / Pune"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </Field>
          <Field label="Počet (headcount)">
            <input type="number" min={1} value={headcount} onChange={(e) => setHeadcount(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </Field>
          <Field label="Nástup od">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </Field>
          <Field label="Potrebný do">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </Field>
        </div>

        <label className="mb-3 mt-1 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isPlaceholder} onChange={(e) => setIsPlaceholder(e.target.checked)} />
          Neobsadená pozícia (placeholder / TBD)
        </label>

        {/* Hierarchia: nadriadený + skupina */}
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Field label="Reportuje komu (nadriadený)">
            <input value={reportsToQuery} onChange={(e) => setReportsToQuery(e.target.value)}
              placeholder="Hľadaj nadriadeného podľa mena alebo pozície…"
              className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={reportsToId} onChange={(e) => setReportsToId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">— nikomu (vrchol stromu) —</option>
              {(allAssignments ?? [])
                .filter((x) => x.id !== assignment?.id)
                .map((x) => {
                  const nm = x.iac_employee?.meno ?? x.person_name ?? "";
                  const label = [x.position_title, nm].filter(Boolean).join(" — ") || "(bez názvu)";
                  return { id: x.id, label };
                })
                .filter((o) => {
                  const q = reportsToQuery.trim().toLowerCase();
                  return !q || o.label.toLowerCase().includes(q) || o.id === reportsToId;
                })
                .map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <label className="mt-1 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isGroup} onChange={(e) => setIsGroup(e.target.checked)} />
            Toto je skupina / kategória (medzi-uzol, napr. „Product Engineering“)
          </label>
        </div>

        {/* Alokácie */}
        <div className="mb-3 rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">Alokácie (% v čase)</span>
            <button type="button" onClick={addAllocation}
              className="rounded-md px-2 py-1 text-xs font-semibold text-white" style={{ background: ARTIFEX_NAVY }}>
              + Obdobie
            </button>
          </div>
          {allocations.length === 0 && <p className="text-xs text-slate-400">Žiadne alokácie. Pridaj časové okno s %.</p>}
          <div className="space-y-2">
            {allocations.map((al, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
                <input type="date" value={al.period_from} onChange={(e) => updateAlloc(i, { period_from: e.target.value })}
                  className="rounded border border-slate-300 px-2 py-1 text-xs" title="od" />
                <span className="text-xs text-slate-400">→</span>
                <input type="date" value={al.period_to} onChange={(e) => updateAlloc(i, { period_to: e.target.value })}
                  className="rounded border border-slate-300 px-2 py-1 text-xs" title="do (nepovinné)" />
                <input type="number" min={0} max={100} value={al.allocation_pct}
                  onChange={(e) => updateAlloc(i, { allocation_pct: Number(e.target.value) })}
                  className="w-16 rounded border border-slate-300 px-2 py-1 text-xs" title="%" />
                <span className="text-xs text-slate-400">%</span>
                <input value={al.label} onChange={(e) => updateAlloc(i, { label: e.target.value })}
                  placeholder="label (Q1…)" className="w-24 rounded border border-slate-300 px-2 py-1 text-xs" />
                <button type="button" onClick={() => removeAlloc(i)}
                  className="ml-auto rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">✕</button>
              </div>
            ))}
          </div>
        </div>

        <Field label="Poznámka">
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="napr. TBD by Jon, Replacement TBD…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </Field>

        {/* Akcie */}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Zrušiť
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: ARTIFEX_NAVY }}>
            {saving ? "Ukladám…" : "Uložiť"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}
