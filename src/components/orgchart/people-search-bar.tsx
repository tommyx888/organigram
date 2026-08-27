"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { searchEmployees } from "@/lib/org/people-search";
import type { EmployeeRecord } from "@/lib/org/types";
import { useTranslation } from "@/lib/i18n/context";

type PeopleSearchBarProps = {
  employees: EmployeeRecord[];
  viewAsEmployeeId: string | null;
  viewAsLocked?: boolean;
  onViewAs: (employeeId: string) => void;
  onClearViewAs?: () => void;
};

export function PeopleSearchBar({
  employees,
  viewAsEmployeeId,
  viewAsLocked = false,
  onViewAs,
  onClearViewAs,
}: PeopleSearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => searchEmployees(employees, query, 20), [employees, query]);
  const viewAsPerson = viewAsEmployeeId
    ? employees.find((e) => e.employeeId === viewAsEmployeeId) ?? null
    : null;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
        return;
      }
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function selectHit(employeeId: string) {
    onViewAs(employeeId);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="mb-3 space-y-2">
      <div ref={containerRef} className="relative">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M20 20l-3-3" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActiveIndex((i) => Math.min(i + 1, Math.max(0, hits.length - 1)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const hit = hits[activeIndex];
                if (hit) selectHit(hit.employee.employeeId);
              } else if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
                inputRef.current?.blur();
              }
            }}
            placeholder={t("orgChart.peopleSearchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            autoComplete="off"
            aria-label={t("orgChart.peopleSearch")}
          />
          <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:inline">
            Ctrl K
          </kbd>
        </div>

        {open && query.trim() ? (
          <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            {hits.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">{t("orgChart.peopleSearchEmpty")}</p>
            ) : (
              hits.map((hit, index) => (
                <button
                  key={hit.employee.employeeId}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectHit(hit.employee.employeeId)}
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left ${
                    index === activeIndex ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="text-sm font-semibold text-[var(--artifex-navy)]">
                    {hit.employee.fullName}
                    <span className="ml-2 font-mono text-[11px] font-normal text-slate-400">
                      #{hit.employee.employeeId}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {hit.employee.positionName}
                    {hit.employee.departmentName || hit.employee.department
                      ? ` · ${hit.employee.departmentName || hit.employee.department}`
                      : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {viewAsPerson ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--artifex-olive)]/40 bg-[var(--artifex-olive)]/10 px-3 py-2">
          <p className="text-sm text-[var(--artifex-navy)]">
            <span className="font-semibold">{t("orgChart.viewAsBanner")}</span>{" "}
            {viewAsPerson.fullName}
            <span className="text-slate-500">
              {" "}
              · {viewAsPerson.positionName}
            </span>
          </p>
          {!viewAsLocked && onClearViewAs ? (
            <button
              type="button"
              onClick={onClearViewAs}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t("orgChart.viewAsExit")}
            </button>
          ) : (
            <span className="text-[11px] font-medium text-slate-500">{t("orgChart.viewAsOwnAccount")}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
