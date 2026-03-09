"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { ExpandCollapseButton } from "@/components/orgchart/expand-collapse-button";

const SOURCE_HANDLE_ID = "bottom";
const TARGET_HANDLE_ID = "top";

export type VacancyNodeData = {
  vacancyId: string;
  title: string;
  /** Ak je true, zobrazíme ako vrchol (General Manager). */
  isRoot?: boolean;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Skryť handle bodky (pri bublina + sekcie vizuálne oddelené). */
  hideHandles?: boolean;
};

type VacancyNodeType = Node<VacancyNodeData, "vacancy">;

export function VacancyNode(props: NodeProps<VacancyNodeType>) {
  const { data } = props;
  const isRoot = data.isRoot === true;
  const showExpand = data.hasChildren && data.onToggleCollapse;
  const showHandles = !data.hideHandles;

  return (
    <>
      {showHandles && <Handle type="target" position={Position.Top} id={TARGET_HANDLE_ID} />}
      <div
        className="flex flex-col items-center justify-start pt-2"
        style={{ width: 280, minHeight: 160 }}
      >
        <div
          className="w-full max-w-[280px] overflow-hidden rounded-[18px] border-2 border-dashed border-amber-400 bg-amber-50/80"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <div className="flex min-h-[44px] items-center justify-between gap-2 px-4 py-2.5 bg-amber-200/90 text-amber-900">
            <span className="text-xs font-semibold uppercase tracking-wide">
              Voľná pozícia
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {isRoot && (
                <span className="rounded bg-amber-300/80 px-2 py-0.5 text-xs font-medium">
                  Vrchol
                </span>
              )}
              {showExpand && (
                <ExpandCollapseButton
                  isCollapsed={data.isCollapsed ?? false}
                  onToggle={data.onToggleCollapse!}
                />
              )}
            </div>
          </div>
          <div className="space-y-1.5 px-4 py-3.5">
            <p className="line-clamp-2 min-h-[2.25rem] text-base font-semibold leading-snug text-slate-800" title={data.title}>
              {data.title || "—"}
            </p>
            <p className="text-xs text-slate-500">Pod túto pozíciu sa napájajú ľudia v organigrame.</p>
          </div>
        </div>
      </div>
      {showHandles && <Handle type="source" position={Position.Bottom} id={SOURCE_HANDLE_ID} />}
    </>
  );
}

export const vacancyHandleIds = { source: SOURCE_HANDLE_ID, target: TARGET_HANDLE_ID };
