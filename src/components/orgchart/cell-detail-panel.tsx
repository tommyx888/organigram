"use client";

import * as React from "react";
import type { EmployeeRecord } from "@/lib/org/types";
import type { ChildLayoutStyle } from "@/lib/org/employee-child-layout";
import { CARD_COLOR_PALETTE } from "@/lib/org/chart-appearance";
import { useTranslation } from "@/lib/i18n/context";

export type ManagerOption = { value: string; label: string };

type EmployeeDetailProps = {
  record: EmployeeRecord;
  photoUrl?: string | null;
  onClose: () => void;
  onPhotoChange?: (employeeId: string, dataUrl: string) => void;
  onPhotoClear?: (employeeId: string) => void;
  /** Možnosti pre výber nadriadeného (zamestnanci + vacancy). */
  managerOptions?: ManagerOption[];
  onManagerChange?: (managerId: string | null) => void;
  /** Vlastná farba karty (hex). */
  accentColor?: string | null;
  onAccentColorChange?: (employeeId: string, hex: string) => void;
  onAccentColorClear?: (employeeId: string) => void;
  /** Rolovanie vetvy – zobraziť len ak má uzol deti. */
  hasChildren?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Ako zobrazovať podriadených (len ak má deti). */
  childLayoutStyle?: ChildLayoutStyle | null;
  onChildLayoutChange?: (nodeId: string, style: ChildLayoutStyle) => void;
  /** Zoznam priamych podriadených v aktuálnom poradí (pre zmenu poradia v líniách). */
  directReportOrder?: { id: string; label: string }[];
  onReorderDirectReports?: (orderedIds: string[]) => void;
};

const DEFAULT_COLORS = CARD_COLOR_PALETTE.map((c) => c.hex);

export function EmployeeDetailPanel(props: EmployeeDetailProps) {
  const {
    record,
    photoUrl,
    onClose,
    onPhotoChange,
    onPhotoClear,
    managerOptions = [],
    onManagerChange,
    accentColor,
    onAccentColorChange,
    onAccentColorClear,
    hasChildren,
    isCollapsed,
    onToggleCollapse,
    childLayoutStyle,
    onChildLayoutChange,
    directReportOrder = [],
    onReorderDirectReports,
  } = props;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const moveDirectReport = (index: number, direction: "up" | "down") => {
    if (!onReorderDirectReports || directReportOrder.length === 0) return;
    const newOrder = [...directReportOrder];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    onReorderDirectReports(newOrder.map((o) => o.id));
  };

  const { t } = useTranslation();
  const CHILD_LAYOUT_LABELS: Record<ChildLayoutStyle, string> = {
    row: t("orgChart.childLayoutRow"),
    pairs: t("orgChart.childLayoutPairs"),
    fours: t("orgChart.childLayoutFours"),
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onPhotoChange) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === "string") onPhotoChange(record.employeeId, dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 pb-2">
        <h3 className="text-sm font-semibold text-slate-800">{t("orgChart.employee")}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label={t("common.close")}
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 py-2">
        {(onPhotoChange != null || onPhotoClear != null) && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("orgChart.photo")}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {photoUrl ? (
                <>
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover border border-slate-200"
                  />
                  {onPhotoClear && (
                    <button
                      type="button"
                      onClick={() => onPhotoClear(record.employeeId)}
                      className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                    >
                      {t("orgChart.removePhoto")}
                    </button>
                  )}
                </>
              ) : null}
              {onPhotoChange && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                  >
                    {photoUrl ? t("orgChart.changePhoto") : t("orgChart.uploadPhoto")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("orgChart.name")}</p>
          <p className="mt-0.5 text-sm font-medium text-slate-800">{record.fullName}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("orgChart.position")}</p>
          <p className="mt-0.5 text-sm text-slate-700">{record.positionName}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("orgChart.departmentStredisko")}</p>
          <p className="mt-0.5 text-sm text-slate-700">{record.department}</p>
          {record.departmentName && (
            <p className="mt-0.5 text-xs text-slate-500">{record.departmentName}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("orgChart.osCislo")}</p>
          <p className="mt-0.5 font-mono text-sm text-slate-700">{record.employeeId}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("orgChart.type")}</p>
          <p className="mt-0.5 text-sm text-slate-700">
            {(record.positionType === "salaried" ? t("orgChart.positionTypeSalaried") : record.positionType === "indirect" ? t("orgChart.positionTypeIndirect") : record.positionType === "direct" ? t("orgChart.positionTypeDirect") : record.positionType)}
            {record.kat ? ` · ${record.kat}` : ""}
          </p>
        </div>

        {onManagerChange && managerOptions.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("orgChart.manager")}</p>
            <select
              value={record.managerEmployeeId ?? ""}
              onChange={(e) => onManagerChange(e.target.value || null)}
              className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
            >
              <option value="">{t("orgChart.managerNone")}</option>
              {managerOptions
                .filter((o) => o.value !== record.employeeId)
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
          </div>
        )}

        {(onAccentColorChange != null || onAccentColorClear != null) && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("orgChart.cardColor")}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {DEFAULT_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onAccentColorChange?.(record.employeeId, hex)}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    accentColor === hex ? "border-slate-800 scale-110" : "border-slate-200 hover:border-slate-400"
                  }`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                  aria-label={hex}
                />
              ))}
              {accentColor && onAccentColorClear && (
                <button
                  type="button"
                  onClick={() => onAccentColorClear(record.employeeId)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                >
                  {t("common.cancel")}
                </button>
              )}
            </div>
          </div>
        )}

        {hasChildren && onChildLayoutChange && (
          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("orgChart.displaySubordinates")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("orgChart.displaySubordinatesHint")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["row", "pairs", "fours"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => onChildLayoutChange(record.employeeId, style)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    (childLayoutStyle ?? "row") === style
                      ? "border-[var(--artifex-navy)] bg-[var(--artifex-navy)] text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {CHILD_LAYOUT_LABELS[style]}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasChildren && directReportOrder.length > 0 && onReorderDirectReports && (
          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("orgChart.subordinateOrder")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("orgChart.subordinateOrderHint")}</p>
            <ul className="mt-2 space-y-1">
              {directReportOrder.map((item, index) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded border border-slate-200 bg-white py-1.5 pl-2 pr-1"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800" title={item.label}>
                    {item.label}
                  </span>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveDirectReport(index, "up")}
                      disabled={index === 0}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                      title={t("common.moveUp")}
                      aria-label={t("common.moveUp")}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDirectReport(index, "down")}
                      disabled={index === directReportOrder.length - 1}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                      title={t("common.moveDown")}
                      aria-label={t("common.moveDown")}
                    >
                      ▼
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasChildren && onToggleCollapse && (
          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("orgChart.branchCollapse")}</p>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {isCollapsed ? t("orgChart.expandBranch") : t("orgChart.collapseBranch")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type CellDetailPanelProps = {
  /** Nič nie je vybraté. */
  empty?: boolean;
  /** Vybratý zamestnanec. */
  employee?: EmployeeRecord | null;
  /** URL fotky vybraného zamestnanca (pre detail). */
  employeePhotoUrl?: string | null;
  /** Obsah pre stredisko (vlastné detaily – napr. StrediskoSettingsPanel). */
  strediskoContent?: React.ReactNode;
  /** Obsah pre voľnú pozíciu (vacancy). */
  vacancyContent?: React.ReactNode;
  onCloseEmployee?: () => void;
  onPhotoChange?: (employeeId: string, dataUrl: string) => void;
  onPhotoClear?: (employeeId: string) => void;
  /** Možnosti pre nadriadeného (pre EmployeeDetailPanel). */
  managerOptions?: { value: string; label: string }[];
  onManagerChange?: (managerId: string | null) => void;
  /** Vlastná farba karty vybraného zamestnanca. */
  employeeAccentColor?: string | null;
  onAccentColorChange?: (employeeId: string, hex: string) => void;
  onAccentColorClear?: (employeeId: string) => void;
  /** Rolovanie – či má vybraný uzol deti a či je zbalený. */
  selectedNodeHasChildren?: boolean;
  selectedNodeIsCollapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Per-node štýl zobrazenia podriadených (pre zamestnanca s detmi). */
  childLayoutStyle?: ChildLayoutStyle | null;
  onChildLayoutChange?: (nodeId: string, style: ChildLayoutStyle) => void;
  /** Zoznam priamych podriadených v aktuálnom poradí (pre zmenu poradia v líniách). */
  directReportOrder?: { id: string; label: string }[];
  onReorderDirectReports?: (orderedIds: string[]) => void;
};

export function CellDetailPanel(props: CellDetailPanelProps) {
  const { t } = useTranslation();
  const {
    empty,
    employee,
    employeePhotoUrl,
    strediskoContent,
    vacancyContent,
    onCloseEmployee,
    onPhotoChange,
    onPhotoClear,
    managerOptions,
    onManagerChange,
    employeeAccentColor,
    onAccentColorChange,
    onAccentColorClear,
    selectedNodeHasChildren,
    selectedNodeIsCollapsed,
    onToggleCollapse,
    childLayoutStyle,
    onChildLayoutChange,
    directReportOrder,
    onReorderDirectReports,
  } = props;

  if (strediskoContent) {
    return <div className="flex h-full flex-col overflow-hidden">{strediskoContent}</div>;
  }

  if (vacancyContent) {
    return <div className="flex h-full flex-col overflow-hidden">{vacancyContent}</div>;
  }

  if (employee) {
    return (
      <EmployeeDetailPanel
        record={employee}
        photoUrl={employeePhotoUrl ?? null}
        onClose={onCloseEmployee ?? (() => {})}
        onPhotoChange={onPhotoChange}
        onPhotoClear={onPhotoClear}
        managerOptions={managerOptions}
        onManagerChange={onManagerChange}
        accentColor={employeeAccentColor ?? null}
        onAccentColorChange={onAccentColorChange}
        onAccentColorClear={onAccentColorClear}
        hasChildren={selectedNodeHasChildren}
        isCollapsed={selectedNodeIsCollapsed}
        onToggleCollapse={onToggleCollapse}
        childLayoutStyle={childLayoutStyle}
        onChildLayoutChange={onChildLayoutChange}
        directReportOrder={directReportOrder}
        onReorderDirectReports={onReorderDirectReports}
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
      <p className="text-sm text-slate-500">{t("orgChart.cellDetailEmpty")}</p>
    </div>
  );
}
