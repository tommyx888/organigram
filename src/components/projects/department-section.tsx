"use client";

import type { ProjDepartment, ProjAssignment } from "@/lib/proj/types";
import { PERSON_TYPE_COLORS, PERSON_TYPE_LABELS, STATUS_LABELS } from "@/lib/proj/types";

const OLIVE = "#949C58";

export function DepartmentSection({
  dept, assignments, onAddPerson, onEditPerson, onDeletePerson, onEditDept, onDeleteDept,
}: {
  dept: ProjDepartment;
  assignments: ProjAssignment[];
  onAddPerson: () => void;
  onEditPerson: (a: ProjAssignment) => void;
  onDeletePerson: (id: string) => void;
  onEditDept: () => void;
  onDeleteDept: () => void;
}) {
  const color = dept.color ?? "#21394F";
  // FTE súčet oddelenia
  const fte = assignments.reduce((sum, a) => {
    const alloc = a.allocations?.[0]?.allocation_pct ?? 0;
    return sum + (alloc / 100) * (a.headcount ?? 1);
  }, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      {/* Hlavička oddelenia */}
      <header
        className="flex items-center justify-between rounded-t-2xl px-4 py-2.5"
        style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)` }}
      >
        <div className="flex items-center gap-2">
          {dept.icon && <span className="text-lg">{dept.icon}</span>}
          <h3 className="text-sm font-black uppercase tracking-wide text-white">{dept.name}</h3>
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold text-white">
            {assignments.length}
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/90">
            {fte.toFixed(1)} FTE
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onAddPerson}
            className="rounded-md bg-white/20 px-2 py-1 text-xs font-semibold text-white hover:bg-white/30">
            + Osoba
          </button>
          <button type="button" onClick={onEditDept}
            className="rounded-md px-1.5 py-1 text-xs text-white/80 hover:bg-white/20" title="Upraviť oddelenie">✎</button>
          <button type="button" onClick={onDeleteDept}
            className="rounded-md px-1.5 py-1 text-xs text-white/80 hover:bg-white/20" title="Zmazať oddelenie">✕</button>
        </div>
      </header>

      {/* Tabuľka ľudí */}
      {assignments.length === 0 ? (
        <p className="px-4 py-3 text-xs text-slate-400">Žiadne osoby v tomto oddelení.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {assignments.map((a) => (
            <PersonRow key={a.id} a={a} onEdit={() => onEditPerson(a)} onDelete={() => onDeletePerson(a.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function PersonRow({ a, onEdit, onDelete }: { a: ProjAssignment; onEdit: () => void; onDelete: () => void }) {
  const typeColor = PERSON_TYPE_COLORS[a.person_type];
  const name = a.iac_employee?.meno ?? a.person_name ?? "—";
  const isLinked = Boolean(a.iac_employee_id);
  const alloc = a.allocations?.[0];

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
      {/* Typ indikátor */}
      <span className="inline-block h-8 w-1 shrink-0 rounded-full" style={{ background: typeColor }} />

      {/* Meno + pozícia */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-slate-800">{name}</span>
          {a.is_placeholder && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">TBD</span>
          )}
          {isLinked && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: OLIVE }} title="Napárované na zamestnanca">
              IAC
            </span>
          )}
        </div>
        <div className="truncate text-xs text-slate-500">{a.position_title}</div>
      </div>

      {/* Lokalita */}
      <div className="hidden w-24 shrink-0 text-xs text-slate-500 sm:block">{a.home_location ?? "—"}</div>

      {/* Typ */}
      <div className="hidden w-28 shrink-0 sm:block">
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: typeColor }}>
          {PERSON_TYPE_LABELS[a.person_type]}
        </span>
      </div>

      {/* Alokácia */}
      <div className="w-16 shrink-0 text-right">
        {alloc ? (
          <span className="text-sm font-black" style={{ color: typeColor }}>{alloc.allocation_pct}%</span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </div>

      {/* Dátumy */}
      <div className="hidden w-28 shrink-0 text-right text-[11px] text-slate-400 lg:block">
        {a.overall_start_date ? `od ${fmtDate(a.overall_start_date)}` : "—"}
      </div>

      {/* Akcie */}
      <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
        <button type="button" onClick={onEdit}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-white">✎</button>
        <button type="button" onClick={onDelete}
          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50">✕</button>
      </div>
    </div>
  );
}
