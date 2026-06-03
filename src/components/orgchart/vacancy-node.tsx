"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { ExpandCollapseButton } from "@/components/orgchart/expand-collapse-button";

const SOURCE_HANDLE_ID = "bottom";
const TARGET_HANDLE_ID = "top";

export type VacancyNodeData = {
  vacancyId: string;
  title: string;
  isRoot?: boolean;
  hasChildren?: boolean;
  totalSubordinateCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  hideHandles?: boolean;
  nodeWidth?: number;
  nodeHeight?: number;
  fontScale?: number;
  candidateName?: string | null;
  startDate?: string | null;
  category?: string | null;
};

type VacancyNodeType = Node<VacancyNodeData, "vacancy">;

const VACANCY_COLOR = "#D97706";
const VACANCY_LIGHT = "#FEF3C7";
const VACANCY_MID   = "#FCD34D";

export function VacancyNode(props: NodeProps<VacancyNodeType>) {
  const { data } = props;
  const showExpand  = data.hasChildren === true && data.onToggleCollapse != null;
  const showHandles = !data.hideHandles;

  const nodeWidth  = data.nodeWidth  ?? 280;
  const nodeHeight = data.nodeHeight ?? 100;
  const fontScale  = Math.min(4.4, Math.max(0.7, data.fontScale ?? 1));

  const subCount = data.totalSubordinateCount ?? 0;
  const OLIVE = "#949C58";
  const accent = VACANCY_COLOR;
  const bg     = `linear-gradient(135deg, ${accent} 0%, #B45309 100%)`;

  // Identicky s infoPill
  const avatarD    = Math.round(nodeHeight * 0.88);
  const avatarInner = avatarD - 10;
  const avatarLeft = Math.round(avatarD * -0.08);
  const pillLeft   = Math.round(avatarD * 0.06);
  const pillR      = nodeHeight / 2;
  const labelHTwo  = Math.round(nodeHeight * 0.50);
  const bodyTopTwo = labelHTwo + 4;
  const labelPadL  = Math.round(avatarD * 0.86) + 4;
  const badgeD     = Math.round(nodeHeight * 0.30);
  const fsP = (px: number) => `${Math.round(px * fontScale * 3.0)}px`;

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
          boxShadow: `0 8px 28px rgba(217,119,6,0.18), 0 2px 8px rgba(217,119,6,0.10)`,
        }} />

        {/* JANTAR LABEL TAG — nazov pozicie + kategoria */}
        <div style={{
          position: "absolute",
          left: pillLeft,
          top: Math.round(nodeHeight * 0.06),
          right: 14,
          height: labelHTwo,
          background: bg,
          borderRadius: `${labelHTwo / 2}px`,
          paddingLeft: labelPadL,
          paddingRight: 10,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "hidden",
          zIndex: 5,
          boxShadow: `0 3px 12px rgba(217,119,6,0.40)`,
          gap: 2,
        }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "inherit",
            background: "linear-gradient(180deg,rgba(255,255,255,0.18) 0%,transparent 60%)",
            pointerEvents: "none",
          }} />
          {/* Nazov — priezvisko stylem */}
          <span style={{
            position: "relative", zIndex: 1,
            fontSize: fsP(11), fontWeight: 900, letterSpacing: "0.07em",
            textTransform: "uppercase", color: "#fff",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }} title={data.title}>
            {data.title || "Voľná pozícia"}
          </span>
          {/* Kategoria — meno stylem */}
          {data.category && (
            <span style={{
              position: "relative", zIndex: 1,
              fontSize: fsP(12), fontWeight: 600, letterSpacing: "0.03em",
              color: "rgba(255,255,255,0.88)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {data.category}
            </span>
          )}
        </div>

        {/* OBSAH — volna pozicia pill + kandidat + datum */}
        <div style={{
          position: "absolute",
          left: pillLeft + labelPadL,
          top: bodyTopTwo + Math.round(nodeHeight * 0.06),
          right: 18,
          paddingBottom: Math.round(nodeHeight * 0.08),
          display: "flex",
          flexDirection: "column",
          gap: 4,
          zIndex: 5,
        }}>
          {!data.candidateName && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              alignSelf: "flex-start",
              background: VACANCY_LIGHT,
              border: `1px solid ${VACANCY_MID}`,
              borderRadius: 20,
              padding: "2px 8px",
              fontSize: fsP(8), fontWeight: 700,
              color: accent,
              letterSpacing: "0.04em",
              textTransform: "uppercase" as const,
              whiteSpace: "nowrap" as const,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, display: "inline-block" }} />
              Voľná pozícia
            </span>
          )}

          {(data.candidateName || data.startDate) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {data.candidateName && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: fsP(9), fontWeight: 600, color: "#92400e",
                }}>
                  <span style={{ fontSize: fsP(10) }}>👤</span>
                  {data.candidateName}
                </span>
              )}
              {data.startDate && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: fsP(9), fontWeight: 600, color: "#92400e",
                  whiteSpace: "nowrap" as const,
                }}>
                  <span style={{ fontSize: fsP(10) }}>📅</span>
                  {new Date(data.startDate).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* AVATAR KRUH — vlavo, vertikalne centrovany */}
        <div style={{
          position: "absolute",
          left: avatarLeft,
          top: "50%",
          transform: "translateY(-50%)",
          width: avatarD, height: avatarD,
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow: `0 6px 20px rgba(217,119,6,0.30), 0 0 0 3px #fff`,
          zIndex: 10,
        }}>
          <div style={{
            position: "absolute", inset: 4,
            borderRadius: "50%",
            background: bg,
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width={Math.round(avatarInner * 0.5)} height={Math.round(avatarInner * 0.5)} viewBox="0 0 40 46" fill="none" aria-hidden>
              <ellipse cx="20" cy="12" rx="8" ry="9" fill="rgba(255,255,255,0.9)" />
              <path d="M2 44c0-9.941 8.059-16 18-16s18 6.059 18 16" fill="rgba(255,255,255,0.75)" />
              <text x="20" y="13" textAnchor="middle" dominantBaseline="middle"
                fontSize="22" fontWeight="900" fill={accent} fontFamily="sans-serif">?</text>
            </svg>
          </div>
        </div>

        {/* BADGE pocet podriadenych — vpravo hore, olivovy */}
        {subCount > 0 && (
          <div style={{
            position: "absolute",
            top: -Math.round(badgeD * 0.28),
            right: -Math.round(badgeD * 0.08),
            height: Math.round(badgeD * 0.8),
            minWidth: Math.round(badgeD * 0.8),
            padding: `0 ${Math.round(badgeD * 0.28)}px`,
            borderRadius: Math.round(badgeD * 0.4),
            background: `linear-gradient(145deg, #c4cc72 0%, ${OLIVE} 50%, #636b30 100%)`,
            border: "2px solid rgba(255,255,255,0.88)",
            boxShadow: `0 2px 10px rgba(100,108,48,0.50), inset 0 1px 0 rgba(255,255,255,0.32)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            zIndex: 25,
          }}>
            <div style={{
              position: "absolute", top: 0, left: "8%", right: "8%", height: "42%",
              background: "linear-gradient(180deg, rgba(255,255,255,0.38) 0%, transparent 100%)",
              borderRadius: "0 0 50% 50%", pointerEvents: "none",
            }} />
            <span style={{
              position: "relative", zIndex: 1,
              color: "#fff", fontWeight: 900,
              fontSize: fsP(11),
              letterSpacing: "0.03em", lineHeight: 1,
              textShadow: "0 1px 2px rgba(0,0,0,0.35)",
              whiteSpace: "nowrap",
            }}>
              {subCount}
            </span>
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

export const vacancyHandleIds = { source: SOURCE_HANDLE_ID, target: TARGET_HANDLE_ID };