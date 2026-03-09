"use client";

import { useState } from "react";
import type {
  CellFieldsConfig,
  ChartAppearanceState,
  ChartLayoutType,
  ColorScheme,
  ConnectionLineStyle,
  ExpansionStyle,
  NodeRole,
  NodeStyleByType,
  NodeVisualStyle,
} from "@/lib/org/chart-appearance";
import {
  DEFAULT_CHART_APPEARANCE,
  DEFAULT_UNIFIED_COLOR,
} from "@/lib/org/chart-appearance";
import { useTranslation } from "@/lib/i18n/context";

export type FilterColorOption = { hex: string; label: string };

type ChartAppearanceControlsProps = {
  appearance: ChartAppearanceState;
  onAppearanceChange: (next: ChartAppearanceState) => void;
  /** Možnosti farieb pre filter „zobraziť len vybrané farby karty“. Ak je prázdne/undefined, sekcia sa nezobrazí. */
  filterColorOptions?: FilterColorOption[];
};

const NODE_STYLE_KEYS: Record<NodeVisualStyle, string> = {
  card: "orgChart.nodeStyleCard",
  gradient: "orgChart.nodeStyleGradient",
  pill: "orgChart.nodeStylePill",
  bubble: "orgChart.nodeStyleBubble",
};

const CONNECTION_STYLE_KEYS: Record<ConnectionLineStyle, string> = {
  straight: "orgChart.connectionStraight",
  step: "orgChart.connectionStep",
  smoothstep: "orgChart.connectionSmooth",
};

const COLOR_SCHEME_KEYS: Record<ColorScheme, string> = {
  byPosition: "orgChart.colorByPosition",
  byBranch: "orgChart.colorByBranch",
  byLevel: "orgChart.colorByLevel",
  unified: "orgChart.colorUnified",
};

const CELL_FIELD_KEYS: Record<keyof CellFieldsConfig, string> = {
  name: "orgChart.cellFieldName",
  position: "orgChart.cellFieldPosition",
  department: "orgChart.cellFieldDepartment",
  employeeId: "orgChart.cellFieldEmployeeId",
  typeLabel: "orgChart.cellFieldType",
  subordinateCount: "orgChart.cellFieldSubordinateCount",
};

const NODE_ROLE_KEYS: Record<NodeRole, string> = {
  root: "orgChart.nodeRoleRoot",
  employee: "orgChart.nodeRoleEmployee",
  stredisko: "orgChart.nodeRoleStredisko",
};

const STYLE_OPTION_GLOBAL = "__global__";

const LAYOUT_KEYS: Record<ChartLayoutType, string> = {
  vertical: "orgChart.layoutClassic",
  horizontal: "orgChart.layoutClassicHoriz",
  compact: "orgChart.layoutClassicCompact",
};

const EXPANSION_STYLE_KEYS: Record<ExpansionStyle, string> = {
  tree: "orgChart.expansionTreeShort",
  layers: "orgChart.expansionLayersShort",
  horizontal: "orgChart.expansionHorizontalShort",
  twocol: "orgChart.expansionTwocolShort",
};

export function ChartAppearanceControls(props: ChartAppearanceControlsProps) {
  const { t } = useTranslation();
  const { appearance, onAppearanceChange, filterColorOptions } = props;
  const [specificOpen, setSpecificOpen] = useState(false);

  const visibleCardColors = appearance.visibleCardColors ?? [];
  const setVisibleCardColors = (next: string[] | undefined) => {
    onAppearanceChange({ ...appearance, visibleCardColors: next?.length ? next : undefined });
  };
  const toggleFilterColor = (hex: string) => {
    const current = new Set(visibleCardColors);
    if (current.has(hex)) current.delete(hex);
    else current.add(hex);
    setVisibleCardColors(current.size ? [...current] : undefined);
  };
  const isFilterActive = visibleCardColors.length > 0;
  const isColorVisible = (hex: string) =>
    !isFilterActive || visibleCardColors.includes(hex);

  const layoutType = appearance.layoutType ?? "vertical";
  const expansionStyle = appearance.expansionStyle ?? "tree";

  const setConnection = (patch: Partial<ChartAppearanceState["connection"]>) => {
    onAppearanceChange({
      ...appearance,
      connection: { ...appearance.connection, ...patch },
    });
  };

  const setCellField = (id: keyof CellFieldsConfig, value: boolean) => {
    onAppearanceChange({
      ...appearance,
      cellFields: { ...appearance.cellFields, [id]: value },
    });
  };

  const resetToDefaults = () => {
    onAppearanceChange(DEFAULT_CHART_APPEARANCE);
  };

  const setNodeStyleByType = (role: NodeRole, value: NodeVisualStyle | typeof STYLE_OPTION_GLOBAL) => {
    const next: NodeStyleByType = { ...appearance.nodeStyleByType };
    if (value === STYLE_OPTION_GLOBAL) {
      delete next[role];
    } else {
      next[role] = value;
    }
    onAppearanceChange({ ...appearance, nodeStyleByType: Object.keys(next).length ? next : undefined });
  };

  const setLevelColor = (levelIndex: 0 | 1 | 2, fromTo: 0 | 1, hex: string) => {
    const next = [...appearance.levelColors] as [string, string][];
    if (!next[levelIndex]) next[levelIndex] = ["#21394F", "#21394F"];
    const pair = [...next[levelIndex]!] as [string, string];
    pair[fromTo] = hex;
    next[levelIndex] = pair;
    onAppearanceChange({ ...appearance, levelColors: next });
  };

  const setBranchColor = (index: number, hex: string) => {
    const next = [...appearance.branchColors];
    next[index] = hex;
    onAppearanceChange({ ...appearance, branchColors: next });
  };

  const addBranchColor = () => {
    onAppearanceChange({
      ...appearance,
      branchColors: [...appearance.branchColors, "#64748b"],
    });
  };

  const removeBranchColor = (index: number) => {
    const next = appearance.branchColors.filter((_, i) => i !== index);
    if (next.length < 1) return;
    onAppearanceChange({ ...appearance, branchColors: next });
  };

  const setUnifiedColor = (hex: string) => {
    onAppearanceChange({ ...appearance, unifiedColor: hex });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          {t("orgChart.appearancePanelTitle")}
        </h3>
        <button
          type="button"
          onClick={resetToDefaults}
          className="text-xs text-slate-500 underline hover:text-slate-700"
        >
          {t("orgChart.restoreDefaults")}
        </button>
      </div>

      <div className="space-y-5">
        {/* Rozloženie */}
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("orgChart.layoutSectionTitle")}
          </h4>
          <p className="mb-2 text-xs text-slate-500">{t("orgChart.layoutSectionHint")}</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LAYOUT_KEYS) as ChartLayoutType[]).map((layout) => (
              <button
                key={layout}
                type="button"
                onClick={() => onAppearanceChange({ ...appearance, layoutType: layout })}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  layoutType === layout
                    ? "border-[var(--artifex-navy)] bg-[var(--artifex-navy)] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t(LAYOUT_KEYS[layout])}
              </button>
            ))}
          </div>
        </section>

        {/* Štýl rozbalovania */}
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("orgChart.branchStyleSectionTitle")}
          </h4>
          <p className="mb-2 text-xs text-slate-500">{t("orgChart.branchStyleHint")}</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(EXPANSION_STYLE_KEYS) as ExpansionStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => onAppearanceChange({ ...appearance, expansionStyle: style })}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  expansionStyle === style
                    ? "border-[var(--artifex-navy)] bg-[var(--artifex-navy)] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t(EXPANSION_STYLE_KEYS[style])}
              </button>
            ))}
          </div>
        </section>

        {/* Medzery medzi riadkami a uzlami */}
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("orgChart.spacingSectionTitle")}
          </h4>
          <p className="mb-2 text-xs text-slate-500">{t("orgChart.spacingHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-600">{t("orgChart.rowGapLabel")}</span>
              <input
                type="range"
                min={12}
                max={120}
                step={4}
                value={Math.min(120, Math.max(12, appearance.rowGap ?? 28))}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) onAppearanceChange({ ...appearance, rowGap: v });
                }}
                className="h-2 w-full accent-[var(--artifex-navy)]"
              />
              <input
                type="number"
                min={12}
                max={120}
                step={4}
                value={appearance.rowGap ?? 28}
                onChange={(e) => {
                  const v = Math.min(120, Math.max(12, Number(e.target.value) || 28));
                  onAppearanceChange({ ...appearance, rowGap: v });
                }}
                className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-600">{t("orgChart.nodeGapLabel")}</span>
              <input
                type="range"
                min={12}
                max={96}
                step={4}
                value={Math.min(96, Math.max(12, appearance.nodeGapX ?? 24))}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) onAppearanceChange({ ...appearance, nodeGapX: v });
                }}
                className="h-2 w-full accent-[var(--artifex-navy)]"
              />
              <input
                type="number"
                min={12}
                max={96}
                step={4}
                value={appearance.nodeGapX ?? 24}
                onChange={(e) => {
                  const v = Math.min(96, Math.max(12, Number(e.target.value) || 24));
                  onAppearanceChange({ ...appearance, nodeGapX: v });
                }}
                className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
              />
            </label>
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("orgChart.connectionsSectionTitle")}
          </h4>
          <div className="flex flex-wrap gap-4">
            <div>
              <span className="mb-1 block text-xs text-slate-600">{t("orgChart.lineStyleLabel")}</span>
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
                value={appearance.connection.lineStyle}
                onChange={(e) =>
                  setConnection({ lineStyle: e.target.value as ConnectionLineStyle })
                }
              >
                {(Object.keys(CONNECTION_STYLE_KEYS) as ConnectionLineStyle[]).map((key) => (
                  <option key={key} value={key}>
                    {t(CONNECTION_STYLE_KEYS[key])}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-xs text-slate-600">{t("orgChart.thicknessLabel")}</span>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.5}
                value={appearance.connection.strokeWidth}
                onChange={(e) =>
                  setConnection({ strokeWidth: Number(e.target.value) })
                }
                className="w-24"
              />
              <span className="ml-2 text-xs text-slate-500">
                {appearance.connection.strokeWidth} px
              </span>
            </div>
            <div>
              <span className="mb-1 block text-xs text-slate-600">{t("orgChart.arrowLabel")}</span>
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
                value={appearance.connection.marker}
                onChange={(e) =>
                  setConnection({
                    marker: e.target.value as ChartAppearanceState["connection"]["marker"],
                  })
                }
              >
                <option value="arrow">{t("orgChart.arrowOpen")}</option>
                <option value="arrowClosed">{t("orgChart.arrowClosed")}</option>
                <option value="none">{t("orgChart.arrowNone")}</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={appearance.connection.useBranchColorOnEdges ?? false}
                onChange={(e) =>
                  setConnection({ useBranchColorOnEdges: e.target.checked })
                }
              />
              {t("orgChart.lineColorByBranch")}
            </label>
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("orgChart.cellStyleSectionTitle")}
          </h4>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(NODE_STYLE_KEYS) as NodeVisualStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => onAppearanceChange({ ...appearance, nodeStyle: style })}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  appearance.nodeStyle === style
                    ? "border-[var(--artifex-navy)] bg-[var(--artifex-navy)] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t(NODE_STYLE_KEYS[style])}
              </button>
            ))}
          </div>
          {appearance.nodeStyle === "bubble" && (
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={appearance.bubbleSectionsDisconnected ?? false}
                onChange={(e) =>
                  onAppearanceChange({
                    ...appearance,
                    bubbleSectionsDisconnected: e.target.checked,
                  })
                }
              />
              Sekcie vizuálne oddelené (bez prepojení)
            </label>
          )}
        </section>

        {/* Farebnosti */}
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Farebnosti
          </h4>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(COLOR_SCHEME_KEYS) as ColorScheme[]).map((scheme) => (
              <button
                key={scheme}
                type="button"
                onClick={() => onAppearanceChange({ ...appearance, colorScheme: scheme })}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  appearance.colorScheme === scheme
                    ? "border-[var(--artifex-navy)] bg-[var(--artifex-navy)] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t(COLOR_SCHEME_KEYS[scheme])}
              </button>
            ))}
          </div>
        </section>

        {/* Zobraziť len vybrané farby karty */}
        {filterColorOptions != null && filterColorOptions.length > 0 && (
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("orgChart.filterByCardColor")}
            </h4>
            <p className="mb-2 text-xs text-slate-600">
              {isFilterActive ? t("orgChart.filterActiveHint") : t("orgChart.filterInactiveHint")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {filterColorOptions.map(({ hex, label }) => (
                <label
                  key={hex}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={isColorVisible(hex)}
                    onChange={() => toggleFilterColor(hex)}
                    className="rounded border-slate-300"
                  />
                  <span
                    className="inline-block h-4 w-4 shrink-0 rounded border border-slate-300"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                  <span className="text-slate-700">{label}</span>
                </label>
              ))}
              {isFilterActive && (
                <button
                  type="button"
                  onClick={() => setVisibleCardColors(undefined)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {t("common.showAll")}
                </button>
              )}
            </div>
          </section>
        )}

        {/* Údaje v bunkách */}
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("orgChart.cellDataFields")}
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(CELL_FIELD_KEYS) as (keyof CellFieldsConfig)[]).map((id) => (
              <label key={id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={appearance.cellFields[id] ?? false}
                  onChange={(e) => setCellField(id, e.target.checked)}
                />
                {t(CELL_FIELD_KEYS[id])}
              </label>
            ))}
          </div>
        </section>

        {/* Špecifické nastavenia */}
        <section className="border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setSpecificOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
          >
            {t("orgChart.specificSettings")}
            <span className="text-slate-400">{specificOpen ? "▼" : "▶"}</span>
          </button>
          {specificOpen && (
            <div className="mt-4 space-y-4">
              <div>
                <h5 className="mb-2 text-xs font-medium text-slate-600">
                  {t("orgChart.nodeStyleByType")}
                </h5>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["root", "employee", "stredisko"] as NodeRole[]).map((role) => (
                    <div key={role}>
                      <label className="mb-1 block text-xs text-slate-500">
                        {t(NODE_ROLE_KEYS[role])}
                      </label>
                      <select
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
                        value={appearance.nodeStyleByType?.[role] ?? STYLE_OPTION_GLOBAL}
                        onChange={(e) =>
                          setNodeStyleByType(
                            role,
                            e.target.value === STYLE_OPTION_GLOBAL
                              ? STYLE_OPTION_GLOBAL
                              : (e.target.value as NodeVisualStyle),
                          )
                        }
                      >
                        <option value={STYLE_OPTION_GLOBAL}>{t("orgChart.global")}</option>
                        {(Object.keys(NODE_STYLE_KEYS) as NodeVisualStyle[]).map((s) => (
                          <option key={s} value={s}>
                            {t(NODE_STYLE_KEYS[s])}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Jednotná farba */}
              {appearance.colorScheme === "unified" && (
                <div>
                  <h5 className="mb-2 text-xs font-medium text-slate-600">
                    {t("orgChart.unifiedNodeColor")}
                  </h5>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={appearance.unifiedColor ?? DEFAULT_UNIFIED_COLOR}
                      onChange={(e) => setUnifiedColor(e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded border border-slate-300"
                    />
                    <input
                      type="text"
                      value={appearance.unifiedColor ?? DEFAULT_UNIFIED_COLOR}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        if (/^#[0-9A-Fa-f]{6}$/.test(v)) setUnifiedColor(v);
                      }}
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-sm font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Farby úrovní (pre byLevel) */}
              <div>
                <h5 className="mb-2 text-xs font-medium text-slate-600">
                  {t("orgChart.levelColors")}
                </h5>
                <div className="space-y-2">
                  {([t("orgChart.levelRoot"), t("orgChart.level2"), t("orgChart.level3")] as const).map((label, levelIndex) => {
                    const pair = appearance.levelColors[levelIndex] ?? ["#21394F", "#21394F"];
                    return (
                      <div
                        key={levelIndex}
                        className="flex flex-wrap items-center gap-2 rounded border border-slate-100 bg-slate-50/50 p-2"
                      >
                        <span className="w-20 text-xs text-slate-600">{label}</span>
                        <input
                          type="color"
                          value={pair[0]}
                          onChange={(e) => setLevelColor(levelIndex as 0 | 1 | 2, 0, e.target.value)}
                          className="h-8 w-10 cursor-pointer rounded border border-slate-300"
                        />
                        <input
                          type="text"
                          value={pair[0]}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            if (/^#[0-9A-Fa-f]{6}$/.test(v)) setLevelColor(levelIndex as 0 | 1 | 2, 0, v);
                          }}
                          className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-xs font-mono"
                        />
                        <span className="text-slate-400">→</span>
                        <input
                          type="color"
                          value={pair[1]}
                          onChange={(e) => setLevelColor(levelIndex as 0 | 1 | 2, 1, e.target.value)}
                          className="h-8 w-10 cursor-pointer rounded border border-slate-300"
                        />
                        <input
                          type="text"
                          value={pair[1]}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            if (/^#[0-9A-Fa-f]{6}$/.test(v)) setLevelColor(levelIndex as 0 | 1 | 2, 1, v);
                          }}
                          className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-xs font-mono"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Farby vetiev */}
              <div>
                <h5 className="mb-2 text-xs font-medium text-slate-600">
                  {t("orgChart.branchColors")}
                </h5>
                <div className="flex flex-wrap items-center gap-2">
                  {appearance.branchColors.map((hex, index) => (
                    <div key={index} className="flex items-center gap-1 rounded border border-slate-200 bg-white p-1">
                      <input
                        type="color"
                        value={hex}
                        onChange={(e) => setBranchColor(index, e.target.value)}
                        className="h-8 w-9 cursor-pointer rounded border border-slate-200"
                      />
                      <input
                        type="text"
                        value={hex}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          if (/^#[0-9A-Fa-f]{6}$/.test(v)) setBranchColor(index, v);
                        }}
                        className="w-16 rounded border border-slate-100 px-1 py-0.5 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => removeBranchColor(index)}
                        disabled={appearance.branchColors.length <= 1}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                        title={t("orgChart.removeColor")}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addBranchColor}
                    className="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-600"
                  >
                    {t("orgChart.addColor")}
                  </button>
                </div>
              </div>

              {/* Farba prepojení (ak nie podľa vetvy) */}
              <div>
                <h5 className="mb-2 text-xs font-medium text-slate-600">
                  {t("orgChart.connectionColor")}
                </h5>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={appearance.connection.strokeColor ?? "#94A3B8"}
                    onChange={(e) => setConnection({ strokeColor: e.target.value })}
                    className="h-9 w-14 cursor-pointer rounded border border-slate-300"
                  />
                  <input
                    type="text"
                    value={appearance.connection.strokeColor ?? "#94A3B8"}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v === "" || /^#[0-9A-Fa-f]{6}$/.test(v))
                        setConnection({ strokeColor: v || null });
                    }}
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-sm font-mono"
                  />
                  <span className="text-xs text-slate-500">
                    {t("orgChart.connectionColorHint")}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
