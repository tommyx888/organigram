"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExpansionStyle } from "@/lib/org/chart-appearance";
import type { MaxVisibleLayers } from "@/lib/org/hierarchy-settings";
import type { EmployeeRecord } from "@/lib/org/types";
import type { VacancyPlaceholder } from "@/lib/org/types";
import { useTranslation } from "@/lib/i18n/context";

type Option = { value: string; label: string; isVacancy: boolean };

/** Odstráni diakritiku pre porovnanie (napr. "ľubica" → "lubica"), aby vyhľadávanie fungovalo aj bez diakritiky. */
function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function filterOptions(options: Option[], query: string): Option[] {
  const trimmed = query.trim();
  if (!trimmed) return options;
  const q = normalizeForSearch(trimmed);
  return options.filter(
    (o) =>
      normalizeForSearch(o.label).includes(q) ||
      normalizeForSearch(o.value).includes(q),
  );
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  noneLabel = "— Žiadny —",
  id,
  searchPlaceholder,
  searchAriaLabel,
}: {
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  noneLabel?: string;
  id: string;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = filterOptions(options, search);
  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 py-1.5 text-left text-sm text-slate-800 shadow-sm hover:border-slate-400 focus:border-[var(--artifex-navy)] focus:outline-none focus:ring-1 focus:ring-[var(--artifex-navy)]"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={placeholder}
      >
        <span className="min-w-0 truncate">
          {displayLabel}
        </span>
        <span className="shrink-0 text-slate-400" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 flex flex-col rounded border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 border-b border-slate-100 bg-white px-2 pb-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
                e.stopPropagation();
              }}
              placeholder={searchPlaceholder ?? "Hľadať…"}
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              autoComplete="off"
              aria-label={searchAriaLabel ?? "Hľadať"}
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => {
                onChange(null);
                close();
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-100"
            >
              {noneLabel}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">Žiadne záznamy</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  onClick={() => {
                    onChange(o.value);
                    close();
                  }}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${
                    value === o.value ? "bg-slate-50 font-medium text-slate-900" : "text-slate-700"
                  } ${o.isVacancy ? "italic" : ""}`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export type HierarchySidebarProps = {
  /** Aktuálne zvolený General Manager (employee_id alebo vacancy id). */
  generalManagerId: string | null;
  onGeneralManagerChange: (id: string | null) => void;
  /** Všetci zamestnanci + vacancy pre výber GM. */
  employees: EmployeeRecord[];
  vacancies: VacancyPlaceholder[];
  /** Koľko vrstiev zobraziť: 1 = len GM, 2 = GM + priama línia, … 4 = všetko. */
  maxVisibleLayers: MaxVisibleLayers;
  onMaxVisibleLayersChange: (value: MaxVisibleLayers) => void;
  /** Štýl zobrazenia vetiev: strom (deti pod rodičom) vs. vrstvy (jedna línia na úroveň). */
  expansionStyle: ExpansionStyle;
  onExpansionStyleChange: (value: ExpansionStyle) => void;
  onAddVacancy: (title: string, parentId: string | null) => void;
  onResetTemplate?: () => void;
  contentHeight?: string;
};

const SIDEBAR_COLLAPSED_KEY = "org-chart-hierarchy-sidebar-collapsed";

function loadCollapsed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (v === null) return true; // predvolene zrolovaný
    return v === "1";
  } catch {
    return true;
  }
}

function saveCollapsed(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
  } catch {}
}

const EXPANSION_KEYS: Record<ExpansionStyle, string> = {
  tree: "orgChart.expansionTree",
  layers: "orgChart.expansionLayers",
  horizontal: "orgChart.expansionHorizontal",
  twocol: "orgChart.expansionTwocol",
};

export function HierarchySidebar(props: HierarchySidebarProps) {
  const { t } = useTranslation();
  const {
    generalManagerId,
    onGeneralManagerChange,
    employees,
    vacancies,
    maxVisibleLayers,
    onMaxVisibleLayersChange,
    expansionStyle,
    onExpansionStyleChange,
    onAddVacancy,
    onResetTemplate,
    contentHeight,
  } = props;

  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [showAddVacancy, setShowAddVacancy] = useState(false);
  const [newVacancyTitle, setNewVacancyTitle] = useState("");
  const [newVacancyParentId, setNewVacancyParentId] = useState<string | null>(null);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsed(next);
      return next;
    });
  };

  const options: { value: string; label: string; isVacancy: boolean }[] = [
    ...employees.map((e) => ({ value: e.employeeId, label: `${e.fullName} (#${e.employeeId})`, isVacancy: false })),
    ...vacancies.map((v) => ({ value: v.id, label: `[Voľná] ${v.title}`, isVacancy: true })),
  ];

  const submitNewVacancy = () => {
    const title = newVacancyTitle.trim();
    if (!title) return;
    onAddVacancy(title, newVacancyParentId);
    setNewVacancyTitle("");
    setNewVacancyParentId(null);
    setShowAddVacancy(false);
  };

  if (collapsed) {
    return (
      <aside
        className="flex w-12 shrink-0 flex-col items-center justify-start rounded-2xl border border-slate-200 bg-white pt-4 shadow-sm"
        style={contentHeight ? { height: contentHeight } : undefined}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex flex-col items-center gap-1 rounded px-1.5 py-2 text-slate-600 hover:bg-slate-100"
          title={t("orgChart.expandSettings")}
        >
          <span className="text-lg leading-none">☰</span>
          <span className="text-[10px] text-center">{t("orgChart.expandSettings")}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={contentHeight ? { height: contentHeight } : undefined}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-800">{t("orgChart.hierarchy")}</h3>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
          title={t("common.collapse")}
        >
          ◀
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="sidebar-gm-select">
            {t("orgChart.fromPerson")}
          </label>
          <SearchableSelect
            id="sidebar-gm-select"
            options={options}
            value={generalManagerId}
            onChange={onGeneralManagerChange}
            placeholder={t("orgChart.selectPerson")}
            noneLabel={t("orgChart.selectPerson")}
            searchPlaceholder={t("common.searchPlaceholder")}
            searchAriaLabel={t("common.search")}
          />
          <p className="mt-1 text-xs text-slate-500">{t("orgChart.fromPersonHint")}</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="sidebar-layers-select">
            {t("orgChart.visibleLayers")}
          </label>
          <select
            id="sidebar-layers-select"
            value={maxVisibleLayers}
            onChange={(e) => onMaxVisibleLayersChange(Number(e.target.value) as MaxVisibleLayers)}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
          >
            <option value={1}>{t("orgChart.layer1")}</option>
            <option value={2}>{t("orgChart.layer2")}</option>
            <option value={3}>{t("orgChart.layer3")}</option>
            <option value={4}>{t("orgChart.layer4")}</option>
            <option value={5}>{t("orgChart.layer5")}</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">{t("orgChart.layersHint")}</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="sidebar-expansion-style">
            {t("orgChart.branchDisplay")}
          </label>
          <select
            id="sidebar-expansion-style"
            value={expansionStyle}
            onChange={(e) => onExpansionStyleChange(e.target.value as ExpansionStyle)}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
          >
            {(Object.keys(EXPANSION_KEYS) as ExpansionStyle[]).map((s) => (
              <option key={s} value={s}>
                {t(EXPANSION_KEYS[s])}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{t("orgChart.expansionHelp")}</p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAddVacancy((v) => !v)}
            className="w-full rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
          >
            {t("orgChart.addVacancy")}
          </button>
          {showAddVacancy && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <input
                type="text"
                value={newVacancyTitle}
                onChange={(e) => setNewVacancyTitle(e.target.value)}
                placeholder={t("orgChart.vacancyTitlePlaceholder")}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <div>
                <label className="mb-0.5 block text-xs text-slate-500" htmlFor="sidebar-vacancy-parent">
                  {t("orgChart.vacancyParent")}
                </label>
                <SearchableSelect
                  id="sidebar-vacancy-parent"
                  options={options}
                  value={newVacancyParentId}
                  onChange={setNewVacancyParentId}
                  placeholder={t("orgChart.vacancyParentStart")}
                  noneLabel={t("orgChart.vacancyParentStart")}
                  searchPlaceholder={t("common.searchPlaceholder")}
                  searchAriaLabel={t("common.search")}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitNewVacancy}
                  className="rounded bg-amber-600 px-2 py-1 text-sm font-medium text-white hover:bg-amber-700"
                >
                  {t("common.add")}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddVacancy(false); setNewVacancyTitle(""); setNewVacancyParentId(null); }}
                  className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">{t("orgChart.vacancyHint")}</p>
        </div>

        {onResetTemplate && (
          <div className="border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={onResetTemplate}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("orgChart.resetTemplate")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
