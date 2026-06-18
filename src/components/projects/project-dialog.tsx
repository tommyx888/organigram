"use client";

import { useState } from "react";
import type { ProjProject, ProjectStatus } from "@/lib/proj/types";
import { PROJECT_STATUS_LABELS } from "@/lib/proj/types";
import * as repo from "@/lib/proj/repository";

const ARTIFEX_NAVY = "#21394F";
const PRESET_COLORS = ["#21394F", "#7C3AED", "#059669", "#DC2626", "#0891B2", "#D97706", "#949C58", "#2563EB"];

export function ProjectDialog({
  project, companyId, onClose, onSaved,
}: {
  project: ProjProject | null;
  companyId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(project);
  const [code, setCode] = useState(project?.code ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [color, setColor] = useState(project?.color ?? PRESET_COLORS[0]);
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");
  const [startDate, setStartDate] = useState(project?.start_date ?? "");
  const [sopDate, setSopDate] = useState(project?.sop_date ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !code.trim()) { alert("Zadaj názov aj kód projektu."); return; }
    setSaving(true);
    try {
      const payload: Partial<ProjProject> = {
        code: code.trim(), name: name.trim(), description: description.trim() || null,
        color, status, start_date: startDate || null, sop_date: sopDate || null,
      };
      if (isEdit && project) {
        await repo.updateProject(project.id, payload);
      } else {
        await repo.createProject({ ...payload, company_id: companyId, display_order: 99 });
      }
      onSaved();
    } catch (e) {
      console.error(e); alert("Uloženie zlyhalo.");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-black" style={{ color: ARTIFEX_NAVY }}>
          {isEdit ? "Upraviť projekt" : "Nový projekt"}
        </h2>

        <div className="mb-3 grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Kód</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="L463-DP"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Názov</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="L463 Door Panels"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Popis</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Farba</label>
          <div className="flex gap-2">
            {PRESET_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="h-8 w-8 rounded-lg border-2 transition"
                style={{ background: c, borderColor: color === c ? "#000" : "transparent" }} />
            ))}
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Stav</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
              {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Štart</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">SOP</label>
            <input type="date" value={sopDate} onChange={(e) => setSopDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Zrušiť</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: ARTIFEX_NAVY }}>
            {saving ? "Ukladám…" : "Uložiť"}
          </button>
        </div>
      </div>
    </div>
  );
}
