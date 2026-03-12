"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAIN_DEPARTMENTS } from "@/lib/org/departments";
import type { EmployeeRecord } from "@/lib/org/types";
import { useTranslation } from "@/lib/i18n/context";

/** Odstráni diakritiku pre vyhľadávanie (napr. "ľubica" → "lubica"). */
function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function filterEmployees(employees: EmployeeRecord[], query: string): EmployeeRecord[] {
  const trimmed = query.trim();
  if (!trimmed) return employees;
  const q = normalizeForSearch(trimmed);
  return employees.filter(
    (e) =>
      normalizeForSearch(e.fullName).includes(q) ||
      normalizeForSearch(e.employeeId).includes(q) ||
      (e.positionName && normalizeForSearch(e.positionName).includes(q)),
  );
}

type DepartmentBarProps = {
  selectedDepartment: string;
  onSelectDepartment: (key: string) => void;
  departmentManagers: Record<string, string>;
  onDepartmentManagerChange: (department: string, employeeId: string | null) => void;
  employees: EmployeeRecord[];
  allowEdit?: boolean;
};

export function DepartmentBar({
  selectedDepartment,
  onSelectDepartment,
  departmentManagers,
  onDepartmentManagerChange,
  employees,
  allowEdit = false,
}: DepartmentBarProps) {
  const { t } = useTranslation();
  const [openManagerFor, setOpenManagerFor] = useState<string | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<{ x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const getManagerName = (employeeId: string) => {
    const emp = employees.find((e) => e.employeeId === employeeId);
    return emp?.fullName ?? employeeId;
  };

  const openDropdown = useCallback((dep: string) => {
    setOpenManagerFor(dep);
    setDropdownAnchor(null);
    requestAnimationFrame(() => {
      const el = anchorRef.current;
      if (el && typeof document !== "undefined") {
        const rect = el.getBoundingClientRect();
        setDropdownAnchor({ x: rect.left, y: rect.bottom + 4 });
      }
    });
  }, []);

  const closeDropdown = useCallback(() => {
    setOpenManagerFor(null);
    setSearchQuery("");
  }, []);

  useEffect(() => {
    if (openManagerFor === null) setDropdownAnchor(null);
  }, [openManagerFor]);

  useEffect(() => {
    if (openManagerFor !== null) searchInputRef.current?.focus();
  }, [openManagerFor]);

  const filteredEmployees = filterEmployees(employees, searchQuery);

  const handleSelectManager = useCallback(
    (dep: string, employeeId: string | null) => {
      onDepartmentManagerChange(dep, employeeId);
      setOpenManagerFor(null);
    },
    [onDepartmentManagerChange],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="mb-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-normal text-slate-500">
        Oddelenia – výber zobrazenia
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectDepartment("all")}
          className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
            selectedDepartment === "all"
              ? "bg-[var(--artifex-navy)] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Celá štruktúra
        </button>
        {MAIN_DEPARTMENTS.map((dep) => {
          const managerId = departmentManagers[dep];
          const isSelected = selectedDepartment === dep;
          const hasManager = Boolean(managerId);

          return (
            <div key={dep} className="relative flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelectDepartment(dep)}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-[var(--artifex-navy)] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {dep}
                {hasManager && (
                  <span className="ml-1.5 text-xs opacity-90" title={getManagerName(managerId)}>
                    ({getManagerName(managerId).split(" ")[0]}.)
                  </span>
                )}
              </button>
              {allowEdit && (
                <>
                  <button
                    ref={openManagerFor === dep ? anchorRef : undefined}
                    type="button"
                    onClick={() => (openManagerFor === dep ? closeDropdown() : openDropdown(dep))}
                    className={`rounded-lg p-1.5 transition-colors ${
                      openManagerFor === dep ? "bg-slate-200" : "hover:bg-slate-100"
                    }`}
                    title={hasManager ? `${t("orgChart.departmentManager")}: ${getManagerName(managerId)} – ${t("orgChart.changeDepartmentManager")}` : t("orgChart.setDepartmentManager")}
                    aria-label={hasManager ? t("orgChart.changeDepartmentManager") : t("orgChart.setDepartmentManager")}
                    aria-expanded={openManagerFor === dep}
                    aria-haspopup="listbox"
                  >
                    <span className="text-slate-500" aria-hidden>⚙</span>
                  </button>
                  {openManagerFor === dep &&
                    dropdownAnchor &&
                    typeof document !== "undefined" &&
                    createPortal(
                      <>
                        <div
                          className="fixed inset-0 z-[100]"
                          aria-hidden
                          onClick={closeDropdown}
                        />
                        <div
                          ref={dropdownRef}
                          className="fixed z-[101] flex w-72 max-h-80 flex-col rounded-xl border border-slate-200 bg-white shadow-lg"
                          role="listbox"
                          style={{ left: dropdownAnchor.x, top: dropdownAnchor.y }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
                            {t("orgChart.departmentManager")}: {dep}
                          </div>
                          <div className="border-b border-slate-100 px-2 pb-2">
                            <input
                              ref={searchInputRef}
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                                e.stopPropagation();
                              }}
                              placeholder={t("common.searchPlaceholder")}
                              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                              autoComplete="off"
                              aria-label={t("orgChart.searchManager")}
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto py-1">
                            <button
                              type="button"
                              onClick={() => handleSelectManager(dep, null)}
                              className="w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                            >
                              — Žiadny (nezobraziť oddelenie) —
                            </button>
                            {filteredEmployees.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-slate-500">Žiadne záznamy</p>
                            ) : (
                              filteredEmployees.map((emp) => (
                                <button
                                  key={emp.employeeId}
                                  type="button"
                                  onClick={() => handleSelectManager(dep, emp.employeeId)}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                                    managerId === emp.employeeId ? "bg-slate-100 font-medium" : "text-slate-700"
                                  }`}
                                >
                                  {emp.fullName}
                                  {emp.positionName ? ` · ${emp.positionName}` : ""}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </>,
                      document.body,
                    )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
