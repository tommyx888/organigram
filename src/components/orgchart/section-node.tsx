"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { ExpandCollapseButton } from "@/components/orgchart/expand-collapse-button";

const SOURCE_HANDLE_ID = "bottom";
const TARGET_HANDLE_ID = "top";

export type SectionNodeData = {
  sectionId: string;
  name: string;
  color?: string;
  icon?: string;
  memberCount?: number;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  hideHandles?: boolean;
  nodeWidth?: number;
};

type SectionNodeType = Node<SectionNodeData, "section">;

export const SECTION_COLORS = [
  "#21394F",
  "#949C58",
  "#F06909",
  "#2563EB",
  "#7C3AED",
  "#059669",
  "#DC2626",
  "#0891B2",
];

export function getDefaultSectionColor(index: number): string {
  return SECTION_COLORS[index % SECTION_COLORS.length];
}

export function SectionNode(props: NodeProps<SectionNodeType>) {
  const { data } = props;
  const showExpand = data.hasChildren && data.onToggleCollapse;
  const showHandles = !data.hideHandles;
  const color = data.color ?? "#21394F";
  const width = data.nodeWidth ?? 280;

  const bgColor = `${color}18`;
  const borderColor = `${color}60`;

  return (
    <>
      {showHandles && <Handle type="target" position={Position.Top} id={TARGET_HANDLE_ID} />}
      <div
        className="flex flex-col items-center justify-start pt-2"
        style={{ width, minHeight: 100 }}
      >
        <div
          className="w-full overflow-hidden rounded-2xl border-2"
          style={{
            borderColor,
            backgroundColor: bgColor,
            boxShadow: `0 2px 12px ${color}20`,
          }}
        >
          <div
            className="flex items-center justify-between gap-2 px-4 py-2.5"
            style={{ backgroundColor: color }}
          >
            <div className="flex items-center gap-2">
              {data.icon && (
                <span className="text-lg leading-none">{data.icon}</span>
              )}
              <span className="text-xs font-bold uppercase tracking-widest text-white/80">
                Sekcia
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {data.memberCount !== undefined && data.memberCount > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: `${color}80` }}
                >
                  {data.memberCount}
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
          <div className="px-4 py-3">
            <p
              className="text-base font-bold leading-snug"
              style={{ color }}
              title={data.name}
            >
              {data.name || "—"}
            </p>
            {data.memberCount !== undefined && (
              <p className="mt-0.5 text-xs" style={{ color: `${color}90` }}>
                {data.memberCount} {data.memberCount === 1 ? "zamestnanec" : data.memberCount < 5 ? "zamestnanci" : "zamestnancov"}
              </p>
            )}
          </div>
        </div>
      </div>
      {showHandles && <Handle type="source" position={Position.Bottom} id={SOURCE_HANDLE_ID} />}
    </>
  );
}

export const sectionHandleIds = { source: SOURCE_HANDLE_ID, target: TARGET_HANDLE_ID };