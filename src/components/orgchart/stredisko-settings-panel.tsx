"use client";

import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import type { EmployeeRecord } from "@/lib/org/types";
import { useTranslation } from "@/lib/i18n/context";

type SimpleSelectOption = { value: string; label: string; disabled?: boolean };

type SimpleSelectProps = {
  value: string;
  options: SimpleSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  placeholder?: string;
};

function SimpleSelect({ value, options, onChange, disabled, label, placeholder = "— vyberte —" }: SimpleSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close, true);
    return () => document.removeEventListener("mousedown", close, true);
  }, [open]);

  return (
    <div ref={containerRef} className="relative mb-3" style={{ pointerEvents: "auto" }}>
      <label className="block text-sm font-medium text-slate-600">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="mt-1 flex w-full items-center justify-between rounded border border-slate-300 bg-white px-2 py-1.5 text-left text-sm cursor-pointer"
        style={{ pointerEvents: "auto" }}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <span className="ml-1 shrink-0 text-slate-500">▼</span>
      </button>
      {open && (
        <ul
          className="absolute left-0 top-full z-[99999] mt-1 max-h-48 w-full overflow-auto rounded border border-slate-300 bg-white shadow-lg"
          role="listbox"
          style={{ pointerEvents: "auto" }}
        >
          {options.map((opt) => (
            <li key={opt.value} role={opt.disabled ? "presentation" : "option"}>
              <button
                type="button"
                disabled={opt.disabled}
                className={`w-full px-2 py-2 text-left text-sm ${opt.disabled ? "cursor-default bg-slate-50 text-slate-500" : "hover:bg-slate-100 cursor-pointer"} ${opt.value === value ? "bg-slate-200" : ""}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!opt.disabled) {
                    onChange(opt.value);
                    setOpen(false);
                  }
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type StrediskoSettingsPanelProps = {
  department: string;
  departmentName?: string | null;
  oddelenie?: string | null;
  /** Nadradené oddelenie (napr. Production), pod ktoré stredisko patrí. */
  parentOddelenie?: string | null;
  employees: EmployeeRecord[];
  /** Manažéri môžu byť priradení aj zo strediska 90. */
  employeesFromStredisko90?: EmployeeRecord[];
  selectedManagerId: string | null;
  parentStredisko: string | null;
  availableParentStrediska: string[];
  expanded: boolean;
  onManagerChange: (employeeId: string) => void;
  onParentChange: (parentDep: string | null) => void;
  onToggleExpand: () => void;
  onClose: () => void;
  allowEdit: boolean;
  /** Aktuálna farba bunky (hex). */
  accentColor?: string | null;
  /** Zmena farby bunky. */
  onAccentColorChange?: (hex: string) => void;
  /** Skryť toto stredisko z organigramu. */
  onHide?: () => void;
  /** Vložiť do strany (pravý panel) namiesto plávajúceho portálu. */
  inline?: boolean;
};

export function StrediskoSettingsPanel(props: StrediskoSettingsPanelProps) {
  const { t } = useTranslation();
  const { inline = false } = props;
  const header = (
    <div className="shrink-0 flex items-center justify-between border-b border-slate-200 pb-2">
      <h3 className="font-semibold text-slate-800">{t("orgChart.strediskoSettings")}</h3>
      <button
        type="button"
        onClick={props.onClose}
        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label={t("common.close")}
      >
        ✕
      </button>
    </div>
  );
  const body = (
    <>
      <div className="mb-3">
        <p className="text-sm font-medium text-slate-600">{props.department}</p>
        {(props.departmentName ?? props.oddelenie) ? (
          <p className="mt-0.5 text-xs text-slate-500">{props.departmentName ?? props.oddelenie}</p>
        ) : null}
        {props.parentOddelenie ? (
          <p className="mt-0.5 text-xs text-slate-500">{t("orgChart.departmentLabel")}: {props.parentOddelenie}</p>
        ) : null}
      </div>

      <SimpleSelect
        label={t("orgChart.parentStredisko")}
        value={props.parentStredisko ?? ""}
        options={[
          { value: "", label: t("orgChart.topLevel") },
          ...props.availableParentStrediska.map((d) => ({ value: d, label: d })),
        ]}
        onChange={(v) => props.onParentChange(v || null)}
        disabled={false}
      />

      <SimpleSelect
        label={t("orgChart.strediskoManager")}
        value={props.selectedManagerId ?? ""}
        placeholder={t("common.select")}
        options={(() => {
          const inStredisko = new Set(props.employees.map((e) => e.employeeId));
          const from90 = (props.employeesFromStredisko90 ?? []).filter((e) => !inStredisko.has(e.employeeId));
          const options: SimpleSelectOption[] = [
            { value: "", label: t("common.select") },
            ...props.employees.map((emp) => ({
              value: emp.employeeId,
              label: `${emp.fullName} (#${emp.employeeId})`,
            })),
          ];
          if (from90.length > 0) {
            options.push({ value: "__sep90__", label: t("orgChart.fromStredisko90"), disabled: true });
            from90.forEach((emp) =>
              options.push({
                value: emp.employeeId,
                label: `${emp.fullName} (#${emp.employeeId})`,
              }),
            );
          }
          return options;
        })()}
        onChange={(v) => props.onManagerChange(v)}
        disabled={false}
      />

      {props.onAccentColorChange && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-slate-600">Farba bunky</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={props.accentColor ?? "#64748b"}
              onChange={(e) => props.onAccentColorChange?.(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded border border-slate-300"
            />
            <input
              type="text"
              value={props.accentColor ?? "#64748b"}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#[0-9A-Fa-f]{6}$/.test(v)) props.onAccentColorChange?.(v);
              }}
              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm font-mono"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={props.onToggleExpand}
        className="w-full rounded bg-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
      >
        {props.expanded ? t("orgChart.collapseStredisko") : t("orgChart.expandStredisko")}
      </button>

      {props.onHide && (
        <button
          type="button"
          onClick={() => {
            props.onHide?.();
            props.onClose();
          }}
          className="mt-2 w-full rounded border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          {t("orgChart.hideStredisko")}
        </button>
      )}
    </>
  );

  if (inline) {
    return (
      <div className="flex h-full flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto py-2">{body}</div>
      </div>
    );
  }

  const content = (
    <aside
      className="fixed right-4 top-24 z-[2147483647] w-80 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-lg"
      style={{ maxHeight: "calc(100vh - 6rem)", overflow: "visible", pointerEvents: "auto", isolation: "isolate" }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {header}
      {body}
    </aside>
  );

  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(content, document.body);
}
