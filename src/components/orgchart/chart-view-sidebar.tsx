"use client";

import { useState } from "react";

import type { ChartLayoutType } from "@/lib/org/chart-appearance";
import { useTranslation } from "@/lib/i18n/context";

const SIDEBAR_COLLAPSED_KEY = "org-chart-left-sidebar-collapsed";

function loadSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== "0";
  } catch {
    return true;
  }
}

function saveSidebarCollapsed(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
  } catch {}
}

type ViewMode = "all" | "managerLine";

const LAYOUT_KEYS: Record<ChartLayoutType, string> = {
  vertical: "orgChart.layoutVertical",
  horizontal: "orgChart.layoutHorizontal",
  compact: "orgChart.layoutCompact",
};

type ChartViewSidebarProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /** Všetky strediská (okrem skrytých) – zobrazíme ako zoznam. */
  strediska: string[];
  /** Ktoré strediská sú vybrané na zobrazenie (ak null = všetky). */
  selectedStrediska: string[] | null;
  onSelectedStrediskaChange: (value: string[] | null) => void;
  /** Skryté strediská – v zozname ich nezobrazíme alebo označíme. */
  hiddenStrediska?: Set<string>;
  /** Aktuálne rozloženie (voliteľné – zobrazí výber v sidebare). */
  layoutType?: ChartLayoutType;
  onLayoutTypeChange?: (layout: ChartLayoutType) => void;
  /** Zarovnať strediská a root podľa šablóny (zachová nastavenia, len pekne rozloží). */
  onAlignToTemplate?: () => void;
  /** Obnoviť rozloženie a vrstvy podľa predvolenej šablóny (vymaže uložené nastavenia). */
  onResetTemplate?: () => void;
  /** Výška obsahu (napr. 72vh) pre zarovnanie s grafom. */
  contentHeight?: string;
};

export function ChartViewSidebar(props: ChartViewSidebarProps) {
  const { t } = useTranslation();
  const {
    viewMode,
    onViewModeChange,
    strediska,
    selectedStrediska,
    onSelectedStrediskaChange,
    hiddenStrediska = new Set(),
    layoutType = "vertical",
    onLayoutTypeChange,
    onAlignToTemplate,
    onResetTemplate,
    contentHeight,
  } = props;

  const selectedSet = selectedStrediska === null ? new Set(strediska) : new Set(selectedStrediska);
  const visibleList = strediska.filter((d) => !hiddenStrediska.has(d));
  const allChecked = visibleList.length > 0 && visibleList.every((d) => selectedSet.has(d));
  const someChecked = visibleList.some((d) => selectedSet.has(d));

  const toggleStredisko = (dep: string) => {
    const next = new Set(selectedSet);
    if (next.has(dep)) next.delete(dep);
    else next.add(dep);
    const arr = Array.from(next).sort();
    if (arr.length === visibleList.length) {
      onSelectedStrediskaChange(null);
    } else {
      onSelectedStrediskaChange(arr);
    }
  };

  const toggleAll = () => {
    if (allChecked) {
      onSelectedStrediskaChange([]);
    } else {
      onSelectedStrediskaChange(null);
    }
  };

  const [collapsed, setCollapsed] = useState(loadSidebarCollapsed);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      saveSidebarCollapsed(next);
      return next;
    });
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
          className="flex flex-col items-center gap-1 rounded px-1.5 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          title={t("orgChart.expandList")}
          aria-label={t("orgChart.expandList")}
        >
          <span className="text-lg leading-none">☰</span>
          <span className="text-[10px] leading-tight text-center">{t("orgChart.whatToShow")}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="flex w-56 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={contentHeight ? { height: contentHeight } : undefined}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-800">{t("orgChart.whatToShow")}</h3>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          title={t("common.collapse")}
          aria-label={t("common.collapse")}
        >
          ◀
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-1 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
            <input
              type="radio"
              name="viewMode"
              checked={viewMode === "all"}
              onChange={() => onViewModeChange("all")}
              className="text-[var(--artifex-navy)]"
            />
            <span className="font-medium text-slate-700">{t("orgChart.allItems")}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
            <input
              type="radio"
              name="viewMode"
              checked={viewMode === "managerLine"}
              onChange={() => onViewModeChange("managerLine")}
              className="text-[var(--artifex-navy)]"
            />
            <span className="font-medium text-slate-700">{t("orgChart.managerLineOnly")}</span>
          </label>
          <p className="px-2 py-1 text-xs text-slate-500">
            {viewMode === "managerLine" ? t("orgChart.viewModeManagerHint") : t("orgChart.viewModeAllHint")}
          </p>
        </div>

        {onLayoutTypeChange && (
          <div className="border-t border-slate-100 px-3 py-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("orgChart.layout")}
            </span>
            <select
              value={layoutType}
              onChange={(e) => onLayoutTypeChange(e.target.value as ChartLayoutType)}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
            >
              {(Object.keys(LAYOUT_KEYS) as ChartLayoutType[]).map((l) => (
                <option key={l} value={l}>
                  {t(LAYOUT_KEYS[l])}
                </option>
              ))}
            </select>
          </div>
        )}

        {viewMode === "all" && visibleList.length > 0 && (
          <>
            <div className="border-t border-slate-100 px-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("orgChart.strediska")}
                </span>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-slate-500 underline hover:text-slate-700"
                >
                  {allChecked ? t("orgChart.deselectAll") : t("orgChart.selectAll")}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              <ul className="space-y-0.5 py-1">
                {visibleList.map((dep) => (
                  <li key={dep}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(dep)}
                        onChange={() => toggleStredisko(dep)}
                        className="rounded border-slate-300"
                      />
                      <span className="truncate text-slate-700">{dep}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {!someChecked && (
                <p className="px-2 py-1 text-xs text-amber-600">
                  {t("orgChart.selectOneStredisko")}
                </p>
              )}
            </div>
          </>
        )}
        </div>

        {(onAlignToTemplate || onResetTemplate) && (
          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 px-3 py-3">
            {onAlignToTemplate && (
              <>
                <button
                  type="button"
                  onClick={onAlignToTemplate}
                  className="w-full rounded-lg bg-[var(--artifex-navy)] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
                >
                  {t("orgChart.align")}
                </button>
                <p className="text-xs text-slate-500">{t("orgChart.alignHint")}</p>
              </>
            )}
            {onResetTemplate && (
              <>
                <button
                  type="button"
                  onClick={onResetTemplate}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400"
                >
                  {t("orgChart.resetTemplate")}
                </button>
                <p className="text-xs text-slate-500">{t("orgChart.resetTemplateHint")}</p>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
