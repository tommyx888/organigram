"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { EmployeeRecord } from "@/lib/org/types";
import { useTranslation } from "@/lib/i18n/context";

const TARGET_HANDLE_ID = "top";
const SOURCE_HANDLE_ID = "bottom";

export type StrediskoNodeData = {
  department: string;
  /** Názov oddelenia podľa stĺpca department (vedľa čísla strediska). */
  departmentName?: string | null;
  /** Názov oddelenia zo zdroja odd (fallback). */
  oddelenie?: string | null;
  /** Nadradené oddelenie (napr. Production), pod ktoré stredisko patrí. */
  parentOddelenie?: string | null;
  /** Vlastný názov (pre vlastné strediská alebo prepis). */
  customDisplayName?: string | null;
  /** Farba hlavičky/okraja bunky (hex). */
  accentColor?: string | null;
  employees: EmployeeRecord[];
  /** Celkový počet zamestnancov vrátane všetkých podriadených stredísk (podskupín). */
  totalEmployeeCount: number;
  selectedManagerId: string | null;
  /** Meno zvoleného manažéra strediska (zobrazené na karte). */
  selectedManagerName: string | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onManagerChange: (employeeId: string) => void;
  allowEdit: boolean;
  parentStredisko: string | null;
  onParentStrediskoChange: (parentDep: string | null) => void;
  availableParentStrediska: string[];
  /** Je to vlastné (vytvorené) stredisko bez dát. */
  isCustom?: boolean;
};

type StrediskoNodeType = Node<StrediskoNodeData, "stredisko">;

export function StrediskoNode(props: NodeProps<StrediskoNodeType>) {
  const { t } = useTranslation();
  const { data } = props;
  const headerColor = data.accentColor ?? "#64748b";
  const displayLabel = data.customDisplayName ?? data.department;

  return (
    <>
      <Handle type="target" position={Position.Top} id={TARGET_HANDLE_ID} />
      <div
        className="min-w-[240px] overflow-hidden rounded-xl border bg-white shadow-md"
        style={{ borderColor: data.accentColor ?? "#e2e8f0", borderWidth: data.accentColor ? 2 : 1 }}
      >
        <div
          className="flex flex-col gap-0.5 border-b px-3 py-2 text-white"
          style={{ backgroundColor: headerColor, borderColor: "rgba(255,255,255,0.2)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold" title={data.department}>
              {displayLabel}
            </span>
          <button
            type="button"
            className="nodrag nopan rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleExpand();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            aria-expanded={data.expanded}
          >
            {data.expanded ? t("common.collapse") : t("common.expand")}
          </button>
          </div>
          {(data.departmentName ?? data.oddelenie) && !data.customDisplayName ? (
            <span className="text-xs font-medium text-white/90 truncate block" title={String(data.departmentName ?? data.oddelenie)}>
              {data.departmentName ?? data.oddelenie}
            </span>
          ) : null}
          {data.parentOddelenie ? (
            <span className="text-xs text-white/80 truncate block">{t("orgChart.departmentLabel")}: {data.parentOddelenie}</span>
          ) : null}
        </div>
        {data.selectedManagerName ? (
          <p className="px-3 py-1 text-xs text-slate-600 border-b border-slate-100">
            <span className="font-medium">Manažér:</span> <span className="truncate block" title={data.selectedManagerName}>{data.selectedManagerName}</span>
          </p>
        ) : null}
        <p className="px-3 py-1.5 text-center text-xs text-slate-500">
          {data.totalEmployeeCount} {data.totalEmployeeCount === 1 ? "zamestnanec" : "zamestnancov"}
          {data.totalEmployeeCount !== data.employees.length ? (
            <span className="block text-slate-400">z toho {data.employees.length} priamo v stredisku</span>
          ) : null}
        </p>
        <div className="px-3 py-1.5 text-center text-xs text-slate-400">
          Klik na kartu otvorí nastavenia v paneli vpravo
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id={SOURCE_HANDLE_ID} />
    </>
  );
}

export const strediskoHandleIds = { source: SOURCE_HANDLE_ID, target: TARGET_HANDLE_ID };
