"use client";

import { useTranslation } from "@/lib/i18n/context";

/** Malé tlačidlo na rozbalenie/zborkovanie vetvy – zobrazí sa len keď má uzol deti. */
export function ExpandCollapseButton({
  isCollapsed,
  onToggle,
  className = "",
  size = "sm",
}: {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
  size?: "sm" | "lg";
}) {
  const { t } = useTranslation();
  const sizeClass = size === "lg" ? "h-12 w-12 rounded-full" : "h-10 w-10 rounded-full";
  const iconClass = size === "lg" ? "h-7 w-7" : "h-6 w-6";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`nodrag flex shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--artifex-navy)] focus:ring-offset-1 ${sizeClass} ${className}`}
      title={isCollapsed ? t("orgChart.expandBranchShort") : t("orgChart.collapseBranchShort")}
      aria-label={isCollapsed ? t("orgChart.expandBranchShort") : t("orgChart.collapseBranchShort")}
    >
      {isCollapsed ? (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      ) : (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
      )}
    </button>
  );
}
