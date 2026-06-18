"use client";

import { useState } from "react";
import type { ProjDepartment } from "@/lib/proj/types";
import * as repo from "@/lib/proj/repository";

const ARTIFEX_NAVY = "#21394F";
const PRESET_COLORS = ["#21394F", "#7C3AED", "#059669", "#DC2626", "#0891B2", "#D97706", "#949C58", "#2563EB"];

export function DepartmentDialog({
  projectId, department, existingCount, allDepartments, defaultParentId, onClose, onSaved,
}: {
  projectId: string;
  department: ProjDepartment | null;
  existingCount: number;
  allDepartments?: ProjDepartment[];
  defaultParentId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(department);
  const [name, setName] = useState(department?.name ?? "");
  const [color, setColor] = useState(department?.color ?? "");
  const [icon, setIcon] = useState(department?.icon ?? "");
  const [parentId, setParentId] = useState<string>(department?.parent_id ?? defaultParentId ?? "");
  const [saving, setSaving] = useState(false);

  // Možní rodičia — všetky okrem seba (zabráni cyklu)
  const parentOptions = (allDepartments ?? []).filter((d) => d.id !== department?.id && !d.parent_id);

  async function handleSave() {
    if (!name.trim()) { alert("Zadaj názov oddelenia."); return; }
    setSaving(true);
    try {
      const payload: Partial<ProjDepartment> = {
        name: name.trim(), color: color || null, icon: icon.trim() || null,
        parent_id: parentId || null,
      };
      if (isEdit && department) {
        await repo.updateDepartment(department.id, payload);
      } else {
        await repo.createDepartment({ ...payload, project_id: projectId, display_order: existingCount });
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
          {isEdit ? "Upraviť sekciu / group" : (parentId ? "Nový group (podsekcia)" : "Nová sekcia")}
        </h2>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Názov</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="napr. Product Design"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        {parentOptions.length > 0 && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Nadradené oddelenie (podsekcia)</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">— žiadne (hlavné oddelenie) —</option>
              {parentOptions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Ikona (emoji, nepovinné)</label>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🔧"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Farba (nepovinné, prepíše farbu projektu)</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setColor("")}
              className="h-8 rounded-lg border-2 px-3 text-xs"
              style={{ borderColor: !color ? "#000" : "#e2e8f0" }}>auto</button>
            {PRESET_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="h-8 w-8 rounded-lg border-2"
                style={{ background: c, borderColor: color === c ? "#000" : "transparent" }} />
            ))}
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
