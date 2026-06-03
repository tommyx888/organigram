"use client";

import { useState, useRef } from "react";
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
  onNameChange?: (id: string, name: string) => void;
  hideHandles?: boolean;
  nodeWidth?: number;
  nodeHeight?: number;
  fontScale?: number;
};

type SectionNodeType = Node<SectionNodeData, "section">;

export const SECTION_COLORS = [
  "#21394F", "#949C58", "#F06909", "#2563EB",
  "#7C3AED", "#059669", "#DC2626", "#0891B2",
];

export function getDefaultSectionColor(index: number): string {
  return SECTION_COLORS[index % SECTION_COLORS.length];
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export function SectionNode(props: NodeProps<SectionNodeType>) {
  const { data } = props;
  const showExpand  = data.hasChildren && data.onToggleCollapse;
  const showHandles = !data.hideHandles;

  const color      = data.color ?? "#21394F";
  const rgb        = hexToRgb(color);
  const nodeWidth  = data.nodeWidth  ?? 280;
  const nodeHeight = data.nodeHeight ?? 100;
  const fontScale  = Math.min(4.4, Math.max(0.7, data.fontScale ?? 1));
  const count      = data.memberCount ?? 0;

  // Rovnaka logika ako infoPill
  const avatarD    = Math.round(nodeHeight * 0.88);
  const pillLeft   = Math.round(avatarD * 0.06);
  const pillR      = nodeHeight / 2;
  const labelH     = Math.round(nodeHeight * 0.50);
  const labelPadL  = Math.round(avatarD * 0.86) + 4;
  const bodyTop    = labelH + 4;
  const badgeD     = Math.round(nodeHeight * 0.36);
  const fsP        = (px: number) => `${Math.round(px * fontScale * 3.0)}px`;
  const OLIVE      = "#949C58";

  // Editovatelny nazov sekcie (session only)
  const [editing, setEditing]   = useState(false);
  const [nameVal, setNameVal]   = useState(data.name ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName = nameVal || data.name || "Sekcia";

  return (
    <>
      {showHandles && <Handle type="target" position={Position.Top} id={TARGET_HANDLE_ID} />}

      <div style={{ width: nodeWidth, minHeight: nodeHeight, position: "relative" }}>

        {/* BIELA PILL */}
        <div style={{
          position: "absolute",
          left: pillLeft, top: 0, right: 0, bottom: 0,
          minHeight: nodeHeight,
          background: "#ffffff",
          borderRadius: pillR,
          boxShadow: `0 8px 28px rgba(${rgb},0.14), 0 2px 8px rgba(${rgb},0.08)`,
        }} />

        {/* FAREBNY LABEL TAG — nazov sekcie, editovatelny */}
        <div style={{
          position: "absolute",
          left: pillLeft,
          top: Math.round(nodeHeight * 0.06),
          right: badgeD / 2 + 14,
          height: labelH,
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
          borderRadius: `${labelH / 2}px`,
          paddingLeft: labelPadL,
          paddingRight: 12,
          display: "flex",
          alignItems: "center",
          zIndex: 5,
          boxShadow: `0 3px 12px rgba(${rgb},0.40)`,
          cursor: "text",
          overflow: "hidden",
        }}
          onClick={() => {
            setEditing(true);
            setTimeout(() => inputRef.current?.focus(), 30);
          }}
        >
          <div style={{
            position: "absolute", inset: 0, borderRadius: "inherit",
            background: "linear-gradient(180deg,rgba(255,255,255,0.18) 0%,transparent 60%)",
            pointerEvents: "none",
          }} />
          {editing ? (
            <input
              ref={inputRef}
              className="nodrag"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={() => {
                setEditing(false);
                data.onNameChange?.(data.sectionId, nameVal);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  setEditing(false);
                  data.onNameChange?.(data.sectionId, nameVal);
                }
              }}
              style={{
                position: "relative", zIndex: 1,
                width: "100%", background: "transparent",
                border: "none", outline: "2px solid rgba(255,255,255,0.6)",
                outlineOffset: 2, borderRadius: 4,
                color: "#fff", fontWeight: 900,
                fontSize: fsP(14), letterSpacing: "0.07em",
                textTransform: "uppercase",
                padding: "2px 4px",
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{
              position: "relative", zIndex: 1,
              color: "#fff", fontWeight: 900,
              fontSize: fsP(14), letterSpacing: "0.07em",
              textTransform: "uppercase",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }} title={displayName}>
              {displayName}
              {/* Ceruzka indikator */}
              <span style={{ marginLeft: 6, opacity: 0.55, fontSize: fsP(9) }}>✎</span>
            </span>
          )}
        </div>

        {/* OBSAH — pocet clenov + skupina pill */}
        <div style={{
          position: "absolute",
          left: pillLeft + labelPadL,
          top: bodyTop + Math.round(nodeHeight * 0.06),
          right: 18,
          paddingBottom: Math.round(nodeHeight * 0.08),
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 5,
          flexWrap: "wrap",
        }}>
          {/* Pocet clenov */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: `rgba(${rgb},0.08)`,
            border: `1px solid rgba(${rgb},0.2)`,
            borderRadius: 20,
            padding: "2px 8px",
            fontSize: fsP(9), fontWeight: 700,
            color: color,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block" }} />
            {count === 0 ? "0 členov" : count === 1 ? "1 člen" : `${count} členov`}
          </div>

          {/* Skupina pill */}
          {data.icon && (
            <span style={{ fontSize: fsP(12) }}>{data.icon}</span>
          )}
        </div>

        {/* AVATAR — farebny kruh vlavo (bez fotky, iba dekorativny) */}
        <div style={{
          position: "absolute",
          left: Math.round(avatarD * -0.08),
          top: "50%",
          transform: "translateY(-50%)",
          width: avatarD, height: avatarD,
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow: `0 6px 20px rgba(${rgb},0.30), 0 0 0 3px #fff`,
          zIndex: 10,
        }}>
          <div style={{
            position: "absolute", inset: 4,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {data.icon ? (
              <span style={{ fontSize: Math.round(avatarD * 0.38) }}>{data.icon}</span>
            ) : (
              <svg width={Math.round(avatarD * 0.44)} height={Math.round(avatarD * 0.44)} viewBox="0 0 40 40" fill="none" aria-hidden>
                <rect x="8" y="8" width="10" height="10" rx="2" fill="rgba(255,255,255,0.85)" />
                <rect x="22" y="8" width="10" height="10" rx="2" fill="rgba(255,255,255,0.6)" />
                <rect x="8" y="22" width="10" height="10" rx="2" fill="rgba(255,255,255,0.6)" />
                <rect x="22" y="22" width="10" height="10" rx="2" fill="rgba(255,255,255,0.85)" />
              </svg>
            )}
          </div>
        </div>

        {/* BADGE pocet — vpravo hore, olivovy */}
        {count > 0 && (
          <div style={{
            position: "absolute",
            top: -Math.round(badgeD * 0.28),
            right: -Math.round(badgeD * 0.08),
            width: Math.round(badgeD * 0.8), height: Math.round(badgeD * 0.8),
            borderRadius: Math.round(badgeD * 0.4),
            background: `linear-gradient(145deg, #c4cc72 0%, ${OLIVE} 50%, #636b30 100%)`,
            border: "2px solid rgba(255,255,255,0.85)",
            boxShadow: `0 2px 8px rgba(100,108,48,0.45), inset 0 1px 0 rgba(255,255,255,0.3)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: fsP(count > 99 ? 8 : 10), fontWeight: 900, color: "#fff",
            letterSpacing: "0.03em",
            textShadow: "0 1px 2px rgba(0,0,0,0.35)",
            zIndex: 20,
          }}>
            {count > 99 ? "99+" : count}
          </div>
        )}

        {/* COLLAPSE BUTTON — stred dna */}
        {showExpand && (
          <div style={{
            position: "absolute", bottom: 0,
            left: "50%", transform: "translateX(-50%) translateY(50%)",
            zIndex: 30,
          }}>
            <ExpandCollapseButton
              isCollapsed={data.isCollapsed ?? false}
              onToggle={data.onToggleCollapse!}
              size="lg"
            />
          </div>
        )}
      </div>

      {showHandles && <Handle type="source" position={Position.Bottom} id={SOURCE_HANDLE_ID} />}
    </>
  );
}

export const sectionHandleIds = { source: SOURCE_HANDLE_ID, target: TARGET_HANDLE_ID };