"use client";

import { useState } from "react";

import type { CustomStredisko } from "@/lib/org/stredisko-view";

type StrediskoViewControlsProps = {
  allDepartments: string[];
  visibleStrediskaFilter: string[] | null;
  onVisibleStrediskaFilterChange: (value: string[] | null) => void;
  customStrediska: CustomStredisko[];
  onCustomStrediskaChange: (value: CustomStredisko[]) => void;
  hiddenStrediska: Set<string>;
  onToggleHidden: (dep: string) => void;
  saveVisibleStrediska: (value: string[] | null) => void;
};

export function StrediskoViewControls(props: StrediskoViewControlsProps) {
  const {
    allDepartments,
    visibleStrediskaFilter,
    onVisibleStrediskaFilterChange,
    customStrediska,
    onCustomStrediskaChange,
    hiddenStrediska,
    onToggleHidden,
    saveVisibleStrediska,
  } = props;

  const [newStrediskoId, setNewStrediskoId] = useState("");
  const [newStrediskoName, setNewStrediskoName] = useState("");

  const showOnlySelected = visibleStrediskaFilter !== null;
  const selectedSet = new Set(visibleStrediskaFilter ?? []);

  const toggleDepartment = (dep: string) => {
    const next = new Set(selectedSet);
    if (next.has(dep)) next.delete(dep);
    else next.add(dep);
    const arr = Array.from(next).sort();
    onVisibleStrediskaFilterChange(arr.length === 0 ? null : arr);
    saveVisibleStrediska(arr.length === 0 ? null : arr);
  };

  const handleShowOnlySelectedChange = (checked: boolean) => {
    if (!checked) {
      onVisibleStrediskaFilterChange(null);
      saveVisibleStrediska(null);
    } else if (allDepartments.length > 0) {
      const arr = allDepartments.filter((d) => !hiddenStrediska.has(d));
      onVisibleStrediskaFilterChange(arr.length ? arr : [...allDepartments]);
      saveVisibleStrediska(arr.length ? arr : [...allDepartments]);
    }
  };

  const addCustom = () => {
    const id = newStrediskoId.trim();
    const name = newStrediskoName.trim() || id;
    if (!id) return;
    if (customStrediska.some((c) => c.id === id)) return;
    onCustomStrediskaChange([...customStrediska, { id, name }]);
    setNewStrediskoId("");
    setNewStrediskoName("");
  };

  const removeCustom = (id: string) => {
    onCustomStrediskaChange(customStrediska.filter((c) => c.id !== id));
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
        Strediská / oddelenia
      </h3>

      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showOnlySelected}
            onChange={(e) => handleShowOnlySelectedChange(e.target.checked)}
          />
          Zobraziť len vybrané oddelenia
        </label>

        {hiddenStrediska.size > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50/50 p-2">
            <p className="mb-2 text-xs font-medium text-amber-800">Skryté strediská</p>
            <div className="flex flex-wrap gap-2">
              {allDepartments.filter((d) => hiddenStrediska.has(d)).map((dep) => (
                <span key={dep} className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-sm">
                  {dep}
                  <button
                    type="button"
                    onClick={() => onToggleHidden(dep)}
                    className="rounded px-1.5 py-0.5 text-xs text-amber-700 hover:bg-amber-100"
                  >
                    Zobraziť
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {showOnlySelected && (
          <div className="max-h-48 overflow-auto rounded border border-slate-200 bg-slate-50/50 p-2">
            <p className="mb-2 text-xs text-slate-500">
              Zaškrtnite oddelenia, ktoré chcete zobraziť. (Skryté sa nezobrazia vôbec.)
            </p>
            <div className="grid gap-1 sm:grid-cols-2">
              {allDepartments.map((dep) =>
                hiddenStrediska.has(dep) ? (
                  <div key={dep} className="flex items-center justify-between gap-2 text-sm text-slate-500">
                    <span>{dep}</span>
                    <button
                      type="button"
                      onClick={() => onToggleHidden(dep)}
                      className="rounded px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
                    >
                      Zobraziť
                    </button>
                  </div>
                ) : (
                  <label key={dep} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(dep)}
                      onChange={() => toggleDepartment(dep)}
                    />
                    {dep}
                  </label>
                ),
              )}
            </div>
          </div>
        )}

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vytvoriť nové stredisko
          </h4>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="ID (napr. 99)"
              value={newStrediskoId}
              onChange={(e) => setNewStrediskoId(e.target.value)}
              className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              placeholder="Názov"
              value={newStrediskoName}
              onChange={(e) => setNewStrediskoName(e.target.value)}
              className="min-w-[120px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={addCustom}
              className="rounded bg-[var(--artifex-navy)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Pridať
            </button>
          </div>
          {customStrediska.length > 0 && (
            <ul className="mt-2 space-y-1">
              {customStrediska.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm text-slate-700">
                  <span>
                    <strong>{c.id}</strong> {c.name && `– ${c.name}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCustom(c.id)}
                    className="rounded px-2 py-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                  >
                    Odstrániť
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
