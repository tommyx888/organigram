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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  hideHandles?: boolean;
  nodeWidth?: number;
  nodeHeight?: number;
  candidateName?: string | null;
  startDate?: string | null;
  category?: string | null;
};

type VacancyNodeType = Node<VacancyNodeData, "vacancy">;

// Jantárová / zlato-oranžová paleta pre vacancy
const VACANCY_COLOR = "#D97706";   // amber-600
const VACANCY_LIGHT = "#FEF3C7";   // amber-50
const VACANCY_MID   = "#FCD34D";   // amber-300

export function VacancyNode(props: NodeProps<VacancyNodeType>) {
  const { data } = props;
  const showExpand = data.hasChildren && data.onToggleCollapse;
  const showHandles = !data.hideHandles;

  const nodeWidth  = data.nodeWidth  ?? 280;
  const nodeHeight = data.nodeHeight ?? 100;

  const accent   = VACANCY_COLOR;
  const bg       = `linear-gradient(135deg, ${accent} 0%, #B45309 100%)`;

  // Rozmery odvodené od výšky nodu (rovnaká logika ako infoPill)
  const avatarD     = Math.round(nodeHeight * 0.88);
  const avatarLeft  = Math.round(-avatarD * 0.10);
  const pillLeft    = Math.round(avatarD * 0.52);
  const pillR       = nodeHeight / 2;
  const labelPadL   = Math.round(avatarD * 0.52) + 10;
  const labelH      = Math.round(nodeHeight * 0.34);
  const bodyTop     = labelH + 4;

  return (
    <>
      {showHandles && (
        <Handle type="target" position={Position.Top} id={TARGET_HANDLE_ID} />
      )}

      <div style={{ width: nodeWidth, height: nodeHeight, position: "relative", paddingTop: 8 }}>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>

          {/* ── BIELA PILL ── */}
          <div style={{
            position: "absolute",
            left: pillLeft, top: 0, right: 0, bottom: 0,
            background: "#ffffff",
            borderRadius: pillR,
            boxShadow: `0 2px 8px rgba(217,119,6,0.15), 0 8px 24px rgba(217,119,6,0.10), inset 0 0 0 1.5px rgba(217,119,6,0.20)`,
          }} />

          {/* ── MENO — farebný gradient tag ── */}
          <div style={{
            position: "absolute",
            left: pillLeft,
            top: Math.round(nodeHeight * 0.06),
            right: 12,
            height: labelH,
            background: bg,
            borderRadius: `${labelH / 2}px`,
            paddingLeft: labelPadL,
            paddingRight: 10,
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            zIndex: 5,
            boxShadow: `0 3px 12px rgba(217,119,6,0.35)`,
          }}>
            {/* gloss */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: "inherit",
              background: "linear-gradient(180deg,rgba(255,255,255,0.18) 0%,transparent 60%)",
            }} />
            <span style={{
              position: "relative", zIndex: 1,
              fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#fff",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }} title={data.title}>
              {data.title || "Voľná pozícia"}
            </span>
            {/* Collapse button vpravo v labeli */}
            {showExpand && (
              <div style={{ marginLeft: "auto", flexShrink: 0, paddingLeft: 6 }}>
                <ExpandCollapseButton
                  isCollapsed={data.isCollapsed ?? false}
                  onToggle={data.onToggleCollapse!}
                />
              </div>
            )}
          </div>

          {/* ── INFO PILLY + kandidát/dátum/kategória ── */}
          <div style={{
            position: "absolute",
            left: pillLeft + labelPadL,
            top: bodyTop + Math.round(nodeHeight * 0.06),
            right: 14,
            bottom: Math.round(nodeHeight * 0.08),
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 3,
            zIndex: 5,
          }}>
            {/* Riadok 1: "Voľná pozícia" pill + kategória + root */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: VACANCY_LIGHT,
                border: `1px solid ${VACANCY_MID}`,
                borderRadius: 20,
                padding: "2px 8px",
                fontSize: 10, fontWeight: 700,
                color: accent,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: accent, display: "inline-block", flexShrink: 0,
                }} />
                Voľná pozícia
              </span>

              {data.category && (
                <span style={{
                  display: "inline-block",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: 20,
                  padding: "2px 7px",
                  fontSize: 9, fontWeight: 800,
                  color: "#475569",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>
                  {data.category}
                </span>
              )}

              {data.isRoot && (
                <span style={{
                  display: "inline-block",
                  background: accent,
                  borderRadius: 20,
                  padding: "2px 8px",
                  fontSize: 9, fontWeight: 700,
                  color: "#fff",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>
                  Vrchol
                </span>
              )}
            </div>

            {/* Riadok 2: kandidát + dátum (ak sú vyplnené) */}
            {(data.candidateName || data.startDate) && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {data.candidateName && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    fontSize: 10, fontWeight: 600, color: "#92400e",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    maxWidth: 110,
                  }}>
                    <span style={{ fontSize: 10 }}>👤</span>
                    {data.candidateName}
                  </span>
                )}
                {data.startDate && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    fontSize: 10, fontWeight: 600, color: "#92400e",
                    whiteSpace: "nowrap",
                  }}>
                    <span style={{ fontSize: 10 }}>📅</span>
                    {new Date(data.startDate).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── AVATAR KRUH ── */}
          <div style={{
            position: "absolute",
            left: avatarLeft,
            top: "50%",
            transform: "translateY(-50%)",
            width: avatarD,
            height: avatarD,
            borderRadius: "50%",
            background: "#ffffff",
            boxShadow: `0 6px 20px rgba(217,119,6,0.30), 0 0 0 3px #fff`,
            zIndex: 10,
          }}>
            {/* farebný disk s ikonou */}
            <div style={{
              position: "absolute", inset: 4,
              borderRadius: "50%",
              background: bg,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {/* Ikona "osoba s otáznikom" = voľná pozícia */}
              <svg
                width={Math.round(avatarD * 0.44)}
                height={Math.round(avatarD * 0.44)}
                viewBox="0 0 40 46"
                fill="none"
                aria-hidden
              >
                <ellipse cx="20" cy="12" rx="8" ry="9" fill="rgba(255,255,255,0.9)" />
                <path d="M2 44c0-9.941 8.059-16 18-16s18 6.059 18 16" fill="rgba(255,255,255,0.75)" />
                {/* otáznik */}
                <text x="20" y="13" textAnchor="middle" dominantBaseline="middle"
                  fontSize="11" fontWeight="900" fill={accent} fontFamily="sans-serif">
                  ?
                </text>
              </svg>
            </div>
          </div>

        </div>
      </div>

      {showHandles && (
        <Handle type="source" position={Position.Bottom} id={SOURCE_HANDLE_ID} />
      )}
    </>
  );
}

export const vacancyHandleIds = { source: SOURCE_HANDLE_ID, target: TARGET_HANDLE_ID };
