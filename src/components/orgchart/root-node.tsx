"use client";

import { useTranslation } from "@/lib/i18n/context";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { ExpandCollapseButton } from "@/components/orgchart/expand-collapse-button";
import type { CellFieldsConfig, NodeAccent, NodeVisualStyle } from "@/lib/org/chart-appearance";
import { brandTokens } from "@/styles/tokens";

const SOURCE_HANDLE_ID = "bottom";

export type RootNodeData = {
  fullName: string;
  positionName: string;
  employeeId: string;
  /** Voliteľné nastavenia vzhľadu. */
  cellFields?: Partial<CellFieldsConfig> | null;
  nodeStyle?: NodeVisualStyle;
  accent?: NodeAccent | null;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Skryť handle bodky (pri bublina + sekcie vizuálne oddelené). */
  hideHandles?: boolean;
  /** Celkový počet podriadených (ľudí pod vrcholom v strome). */
  totalSubordinateCount?: number;
};

type RootNodeType = Node<RootNodeData, "root">;

function getRootAccentColor(accent: NodeAccent | null): string {
  if (accent?.type === "solid" && accent.color) return accent.color;
  if (accent?.type === "gradient") return "transparent";
  return brandTokens.colors.navy;
}

export function RootNode(props: NodeProps<RootNodeType>) {
  const { t } = useTranslation();
  const { data } = props;
  const style = data.nodeStyle ?? "card";
  const accent = data.accent ?? null;
  const fields = data.cellFields ?? { name: true, position: true, employeeId: true };
  const bgColor = getRootAccentColor(accent);
  const gradientBg = accent?.type === "gradient" ? accent.gradient : null;
  const showHandles = !data.hideHandles;
  const sharedHandle = showHandles ? <Handle type="source" position={Position.Bottom} id={SOURCE_HANDLE_ID} /> : null;

  if (style === "gradient") {
    return (
      <>
        <div className="flex flex-col items-center overflow-hidden rounded-[20px] border border-slate-200/80 bg-white" style={{ minWidth: 240, boxShadow: brandTokens.node.shadow }}>
          <div
            className="relative flex h-16 w-20 shrink-0 items-center justify-center border-2 border-slate-200/60 bg-slate-200"
            style={{
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              marginBottom: -8,
              zIndex: 1,
            }}
          >
            <div className="h-12 w-12 rounded-full bg-slate-300" />
          </div>
          <div
            className="w-full rounded-2xl px-4 pb-3 pt-5 text-white"
            style={{
              background: gradientBg ?? bgColor,
              borderRadius: 16,
              boxShadow: brandTokens.node.shadow,
            }}
          >
            {fields.name && (
              <p className="text-lg font-bold uppercase leading-tight">{data.fullName}</p>
            )}
            {fields.position && (
              <p className="mt-0.5 text-sm font-medium opacity-95">{data.positionName}</p>
            )}
            {fields.employeeId && <p className="mt-1 text-xs opacity-80">#{data.employeeId}</p>}
            {fields.subordinateCount && data.totalSubordinateCount !== undefined && (
              <p className="mt-1 text-xs opacity-80">
                {data.totalSubordinateCount === 0
                  ? t("common.noSubordinates")
                  : data.totalSubordinateCount === 1
                    ? t("common.oneSubordinate")
                    : `${data.totalSubordinateCount} ${t("common.subordinatesPlural")}`}
              </p>
            )}
          </div>
        </div>
        {sharedHandle}
      </>
    );
  }

  if (style === "pill") {
    return (
      <>
        <div
          className="flex min-w-[260px] items-center gap-3 rounded-full border border-slate-200/90 bg-white py-1 pl-1 pr-4"
          style={{ boxShadow: brandTokens.node.shadow }}
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: gradientBg ?? bgColor }}
          >
            <span className="text-lg font-bold text-white/90">
              {data.fullName.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1 py-1.5">
            {fields.name && (
              <p className="mt-0.5 text-base font-bold text-[var(--artifex-navy)]">
                {data.fullName}
              </p>
            )}
            {fields.position && (
              <p className="text-sm text-slate-600">{data.positionName}</p>
            )}
            {fields.employeeId && (
              <p className="mt-0.5 text-xs text-slate-500">#{data.employeeId}</p>
            )}
            {fields.subordinateCount && data.totalSubordinateCount !== undefined && (
              <p className="mt-0.5 text-xs text-slate-500">
                {data.totalSubordinateCount === 0
                  ? t("common.noSubordinates")
                  : data.totalSubordinateCount === 1
                    ? t("common.oneSubordinate")
                    : `${data.totalSubordinateCount} ${t("common.subordinatesPlural")}`}
              </p>
            )}
          </div>
        </div>
        {sharedHandle}
      </>
    );
  }

  if (style === "bubble") {
    return (
      <>
        <div
          className="flex min-w-[220px] items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5"
          style={{ borderRadius: brandTokens.node.borderRadius, boxShadow: brandTokens.node.shadow }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: gradientBg ?? bgColor }}
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            {fields.name && (
              <p className="mt-1 text-sm font-bold uppercase text-[var(--artifex-navy)]">
                {data.fullName}
              </p>
            )}
            {fields.position && <p className="text-xs text-slate-600">{data.positionName}</p>}
            {fields.employeeId && <p className="text-xs text-slate-500">#{data.employeeId}</p>}
          </div>
        </div>
        {sharedHandle}
      </>
    );
  }

  // card (default) – čisté linie
  const showExpand = data.hasChildren && data.onToggleCollapse;

  return (
    <>
      <div
        className="min-w-[280px] overflow-hidden rounded-xl border border-slate-200/90 bg-white"
        style={{ boxShadow: brandTokens.node.shadow }}
      >
        <div
          className="px-4 py-3 text-white"
        style={{
          backgroundColor: gradientBg ? undefined : bgColor,
          background: gradientBg ?? undefined,
        }}
        >
          {fields.employeeId && <span className="text-xs opacity-90">#{data.employeeId}</span>}
        </div>
        <div className="flex items-end justify-between gap-2 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-1">
            {fields.name && (
              <p className="text-lg font-semibold text-[var(--artifex-navy)]">{data.fullName}</p>
            )}
            {fields.position && <p className="text-sm text-slate-600">{data.positionName}</p>}
            {fields.subordinateCount && data.totalSubordinateCount !== undefined && (
              <p className="text-xs text-slate-500">
                {data.totalSubordinateCount === 0
                  ? t("common.noSubordinates")
                  : data.totalSubordinateCount === 1
                    ? t("common.oneSubordinate")
                    : `${data.totalSubordinateCount} ${t("common.subordinatesPlural")}`}
              </p>
            )}
          </div>
          {showExpand && (
            <ExpandCollapseButton
              isCollapsed={data.isCollapsed ?? false}
              onToggle={data.onToggleCollapse!}
            />
          )}
        </div>
      </div>
      {sharedHandle}
    </>
  );
}

export const rootHandleId = SOURCE_HANDLE_ID;
