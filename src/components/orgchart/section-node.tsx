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

/** Hex -> r,g,b string pre rgba() */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export function SectionNode(props: NodeProps<SectionNodeType>) {
  const { data } = props;
  const showExpand = data.hasChildren && data.onToggleCollapse;
  const showHandles = !data.hideHandles;
  const color = data.color ?? "#21394F";
  const width = data.nodeWidth ?? 280;
  const count = data.memberCount ?? 0;
  const rgb = hexToRgb(color);

  const memberLabel =
    count === 0 ? "Žiadni členovia"
    : count === 1 ? "1 člen"
    : `${count} členovia`;

  return (
    <>
      {showHandles && (
        <Handle type="target" position={Position.Top} id={TARGET_HANDLE_ID} />
      )}

      <div style={{ width, paddingTop: 8 }}>
        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            background: "#fff",
            boxShadow: `0 2px 8px rgba(${rgb},0.12), 0 8px 24px rgba(${rgb},0.10), 0 0 0 1.5px rgba(${rgb},0.18)`,
          }}
        >

          {/* === GRADIENT HEADER === */}
          <div
            style={{
              background: `linear-gradient(135deg, ${color} 0%, rgba(${rgb},0.82) 100%)`,
              padding: "12px 14px 10px 14px",
              position: "relative",
            }}
          >
            {/* Decorative circles */}
            <div style={{
              position: "absolute", right: -18, top: -18,
              width: 72, height: 72, borderRadius: "50%",
              background: `rgba(255,255,255,0.07)`,
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", right: 8, top: -28,
              width: 50, height: 50, borderRadius: "50%",
              background: `rgba(255,255,255,0.05)`,
              pointerEvents: "none",
            }} />

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, position: "relative" }}>
              {/* Lava strana */}
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* Label + ikona */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: "rgba(255,255,255,0.65)",
                    lineHeight: 1,
                  }}>
                    Sekcia
                  </span>
                  {data.icon && (
                    <span style={{ fontSize: 14, lineHeight: 1 }}>{data.icon}</span>
                  )}
                </div>
                {/* Nazov */}
                <p style={{
                  margin: 0, fontSize: 14, fontWeight: 800, color: "#fff",
                  lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }} title={data.name}>
                  {data.name || "—"}
                </p>
              </div>

              {/* Prava strana: badge + collapse */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                {count > 0 && (
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    backdropFilter: "blur(4px)",
                    border: "1.5px solid rgba(255,255,255,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, color: "#fff",
                    flexShrink: 0,
                  }}>
                    {count > 99 ? "99+" : count}
                  </div>
                )}
                {showExpand && (
                  <ExpandCollapseButton
                    isCollapsed={data.isCollapsed ?? false}
                    onToggle={data.onToggleCollapse!}
                  />
                )}
              </div>
            </div>
          </div>

          {/* === SPODNA CAST === */}
          <div style={{
            padding: "8px 14px 10px 14px",
            background: `linear-gradient(180deg, rgba(${rgb},0.04) 0%, rgba(${rgb},0.01) 100%)`,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          }}>
            {/* Pocet clenov s ikonou */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: color, opacity: 0.7, flexShrink: 0,
              }} />
              <span style={{
                fontSize: 11, fontWeight: 600, color: `rgba(${rgb},0.75)`,
              }}>
                {memberLabel}
              </span>
            </div>

            {/* Mini pill "skupina" */}
            <div style={{
              borderRadius: 20,
              padding: "2px 8px",
              background: `rgba(${rgb},0.1)`,
              border: `1px solid rgba(${rgb},0.2)`,
              fontSize: 10, fontWeight: 700,
              color: color,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}>
              Skupina
            </div>
          </div>

          {/* Dolny farebny pruh */}
          <div style={{
            height: 3,
            background: `linear-gradient(90deg, ${color} 0%, rgba(${rgb},0.3) 70%, transparent 100%)`,
          }} />
        </div>
      </div>

      {showHandles && (
        <Handle type="source" position={Position.Bottom} id={SOURCE_HANDLE_ID} />
      )}
    </>
  );
}

export const sectionHandleIds = { source: SOURCE_HANDLE_ID, target: TARGET_HANDLE_ID };