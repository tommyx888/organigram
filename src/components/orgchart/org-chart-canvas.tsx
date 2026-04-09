"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ChartAppearanceControls } from "@/components/orgchart/chart-appearance-controls";
import { NodeCard } from "@/components/orgchart/node-card";
import { RootNode, type RootNodeData } from "@/components/orgchart/root-node";
import { VacancyNode, vacancyHandleIds, type VacancyNodeData } from "@/components/orgchart/vacancy-node";
import { SectionNode, sectionHandleIds, getDefaultSectionColor, type SectionNodeData } from "@/components/orgchart/section-node";
import { ExpandCollapseButton } from "@/components/orgchart/expand-collapse-button";
import { HierarchySidebar } from "@/components/orgchart/hierarchy-sidebar";
import { DepartmentBar } from "@/components/orgchart/department-bar";
import { CellDetailPanel } from "@/components/orgchart/cell-detail-panel";
import {
  CARD_COLOR_PALETTE,
  getNodeAccent,
  getBranchColor,
  getEffectiveNodeStyle,
  loadChartAppearance,
  saveChartAppearance,
  type ChartAppearanceState,
  type ConnectionLineStyle,
} from "@/lib/org/chart-appearance";
import { loadEmployeePhotos, removeEmployeePhoto, saveEmployeePhoto } from "@/lib/org/employee-photos";
import { loadEmployeeColors, removeEmployeeColor, saveEmployeeColor } from "@/lib/org/employee-colors";
import {
  loadChildLayoutByNodeId,
  saveChildLayout,
  type ChildLayoutStyle,
} from "@/lib/org/employee-child-layout";
import { resetOrgChartToTemplate } from "@/lib/org/org-chart-reset";
import { buildShareUrl, type ShareableViewState } from "@/lib/org/shareable-view-state";
import { useTranslation } from "@/lib/i18n/context";
import {
  fetchSectionMembers,
  addEmployeeToSection,
  removeEmployeeFromSection,
  removeSectionAllMembers,
  type SectionMemberRow,
} from "@/lib/org/section-members-client";
import {
  loadGeneralManagerId,
  saveGeneralManagerId,
  loadMaxVisibleLayers,
  saveMaxVisibleLayers,
  loadVacancies,
  saveVacancies,
  loadChildOrderByParent,
  saveChildOrderByParent,
  generateVacancyId,
  generateSectionId,
  isVacancyId,
  isSectionId,
  addVacancy as persistAddVacancy,
  removeVacancy as persistRemoveVacancy,
  type MaxVisibleLayers,
} from "@/lib/org/hierarchy-settings";
import type { OrgChartSettingsPayload } from "@/lib/org/org-chart-settings-types";
import { DEFAULT_CHART_APPEARANCE } from "@/lib/org/chart-appearance";
import { ALLOWED_KAT_VALUES, type EmployeeRecord, type VacancyPlaceholder, type SectionGroup } from "@/lib/org/types";
import { supabaseClient } from "@/lib/supabase/client";
import { brandTokens } from "@/styles/tokens";

/** Fallback GM ak používateľ ešte nenastavil. */
const FALLBACK_GM_EMPLOYEE_ID = "31000154";
const STORAGE_POSITIONS = "org-chart-positions";
const STORAGE_POSITIONS_LOCKED = "org-chart-positions-locked";
const STORAGE_COLLAPSED_NODES = "org-chart-collapsed-nodes";

const SOURCE_HANDLE_ID = "bottom";
const TARGET_HANDLE_ID = "top";

/** Východzie technické parametre mriežky na zarovnanie. */
const DEFAULT_GRID_GAP = 24;
const DEFAULT_GRID_LINE_WIDTH = 0.75;
const DEFAULT_GRID_COLOR = "#94a3b8";
const GRID_GAP_MIN = 8;
const GRID_GAP_MAX = 200;
const GRID_LINE_WIDTH_MIN = 0.25;
const GRID_LINE_WIDTH_MAX = 2;

type GridSettings = {
  gap: number;
  lineWidth: number;
  color: string;
  variant: "lines" | "cross";
};

type OrgChartCanvasProps = {
  records: EmployeeRecord[];
  allowEdit?: boolean;
  onRecordsChange?: (records: EmployeeRecord[]) => void;
  /** Pri použití Supabase: nastavenia z DB (a lokálne overrides pre neadmina). */
  initialSettings?: OrgChartSettingsPayload | null;
  /** Pri zmene nastavení volať (admin → ukladá do DB, inak len lokálne). */
  onSettingsChange?: (partial: Partial<OrgChartSettingsPayload>) => void;
  /** Pri „Obnoviť rozloženie“ volať pred resetom (vynuluje nastavenia v DB / lokálne overrides). */
  onResetToDefaults?: () => Promise<void>;
  /** Ak true, fotky sa ukladajú do DB (Supabase Storage + employees.photo_url); inak len do localStorage. */
  useDbPhotos?: boolean;
  /** Po uložení / zmazaní fotky v DB volať (napr. refetch záznamov). */
  onPhotoChanged?: () => void;
  /** Zo zdieľateľného linku (?v=…): viewport a zbalené uzly na aplikovanie pri prvom načítaní. */
  initialShareableViewState?: ShareableViewState | null;
};

type OrgNodeData = {
  record: EmployeeRecord;
  showEmployeeId: boolean;
  showDepartment: boolean;
  cellFields: ChartAppearanceState["cellFields"];
  nodeStyle: ChartAppearanceState["nodeStyle"];
  accent: ReturnType<typeof getNodeAccent>;
  levelIndex?: 0 | 1 | 2;
  branchIndex?: number;
  photoUrl?: string | null;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Počet podriadených pri zbalenej vetve (pre vizuál „kopy“) – rátajú sa aj nezobrazené vrstvy. */
  collapsedStackCount?: number;
  /** Celkový počet ľudí pod týmto človekom v strome (rekurzívne až dole, vrátane nezobrazených vrstiev). */
  totalSubordinateCount?: number;
  /** Skryť handle bodky (pri bublina + sekcie vizuálne oddelené). */
  hideHandles?: boolean;
  /** Farby KAT z nastavení (pre fallback v NodeCard). */
  effectiveKatColors?: Record<string, string>;
  nodeWidth: number;
  nodeHeight: number;
  fontScale: number;
  photoScale: number;
  photoFrameScale: number;
  photoFrameBorderWidth: number;
  photoOffsetX: number;
  photoOffsetY: number;
  /** Farby priamych detí – pre kruhový prechod na source handle. */
  childAccentColors?: string[];
};

type OrgFlowNode = Node<OrgNodeData, "orgNode"> | Node<VacancyNodeData, "vacancy"> | Node<RootNodeData, "root"> | Node<SectionNodeData, "section">;

function loadPositions(): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_POSITIONS);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, { x: number; y: number }>;
    return typeof o === "object" && o !== null ? o : {};
  } catch {
    return {};
  }
}

function savePositions(record: Record<string, { x: number; y: number }>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_POSITIONS, JSON.stringify(record));
  } catch {}
}

function loadPositionsLocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_POSITIONS_LOCKED) === "1";
  } catch {
    return false;
  }
}

function loadCollapsedNodes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_COLLAPSED_NODES);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function loadSelectedDepartment(): string {
  if (typeof window === "undefined") return "all";
  try {
    return localStorage.getItem("org-chart-selected-department") ?? "all";
  } catch {
    return "all";
  }
}

function loadDepartmentManagers(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("org-chart-department-managers");
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, string>;
    return typeof o === "object" && o !== null ? o : {};
  } catch {
    return {};
  }
}

function loadEmployeePhotoOffsets(): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("org-chart-employee-photo-offsets");
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { x?: number; y?: number }>;
    if (typeof parsed !== "object" || parsed === null) return {};
    const next: Record<string, { x: number; y: number }> = {};
    Object.entries(parsed).forEach(([id, value]) => {
      if (typeof value?.x === "number" || typeof value?.y === "number") {
        next[id] = { x: Number(value.x ?? 0), y: Number(value.y ?? 0) };
      }
    });
    return next;
  } catch {
    return {};
  }
}

function saveCollapsedNodes(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_COLLAPSED_NODES, JSON.stringify([...set]));
  } catch {}
}

function saveEmployeePhotoOffsets(value: Record<string, { x: number; y: number }>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("org-chart-employee-photo-offsets", JSON.stringify(value));
  } catch {}
}

function savePositionsLocked(locked: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_POSITIONS_LOCKED, locked ? "1" : "0");
  } catch {}
}

/**
 * 1) Collision-free tree layout.
 *
 * Kazdy uzol ma "bounding box" = obdlznik ktory obsahuje jeho kartu + vsetky karty potomkov.
 * Sibling subtrees sa nikdy neprekryvaju - su rozlozene vedla seba (row) alebo pod sebou (pairs/fours).
 *
 * Klucove funkcie:
 *   subtreeSize(id) -> { w: px, h: px }  -- bounding box celeho podstromu
 *   placeSubtree(id, left, top)           -- umiestni uzol a vsetkych potomkov
 */
function layoutTreeUnderParent(
  getChildren: (nodeId: string) => string[],
  centerX: number,
  startY: number,
  nodeWidth: number,
  nodeHeight: number,
  rowGap: number,
  nodeGapX: number,
  getChildLayoutStyle?: (nodeId: string) => ChildLayoutStyle | undefined,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  // Cache pre subtreeSize aby sa neratala opakovane
  const sizeCache = new Map<string, { w: number; h: number }>();

  /**
   * Vypocita bounding box celeho podstromu uzla v pixeloch.
   * w = sirka (horizontalny priestor ktory zabera podstrom)
   * h = vyska (vertikalny priestor ktory zabera podstrom vcetane samotneho uzla)
   */
  function subtreeSize(id: string): { w: number; h: number } {
    const cached = sizeCache.get(id);
    if (cached) return cached;

    const children = getChildren(id);
    if (children.length === 0) {
      const result = { w: nodeWidth, h: nodeHeight };
      sizeCache.set(id, result);
      return result;
    }

    const style = getChildLayoutStyle?.(id) ?? "row";
    const childGap = (style === "pairs" || style === "fours") ? rowGap * 0.65 : rowGap / 2;

    if (style === "pairs" || style === "fours") {
      const perRow = style === "pairs" ? 2 : 4;
      let totalH = nodeHeight + childGap;
      let maxRowW = 0;
      let idx = 0;
      while (idx < children.length) {
        const rowKids = children.slice(idx, idx + perRow);
        // Sirka riadku = suma W subtrees + medzery
        const rowW = rowKids.reduce((sum, k) => sum + subtreeSize(k).w, 0) + (rowKids.length - 1) * nodeGapX;
        maxRowW = Math.max(maxRowW, rowW);
        // Vyska riadku = max H subtrees v tom riadku
        const rowH = Math.max(...rowKids.map((k) => subtreeSize(k).h));
        totalH += rowH + rowGap;
        idx += rowKids.length;
      }
      const result = { w: Math.max(nodeWidth, maxRowW), h: totalH };
      sizeCache.set(id, result);
      return result;
    }

    // row: deti vedla seba
    // Sirka = suma W subtrees + medzery
    const totalW = children.reduce((sum, k) => sum + subtreeSize(k).w, 0) + (children.length - 1) * nodeGapX;
    // Vyska = vyska uzla + medzera + max vyska child subtrees
    const maxChildH = Math.max(...children.map((k) => subtreeSize(k).h));
    const result = { w: Math.max(nodeWidth, totalW), h: nodeHeight + childGap + maxChildH };
    sizeCache.set(id, result);
    return result;
  }

  /**
   * Umiestni uzol a rekurzivne vsetkych potomkov.
   * left = lava hrana bounding boxu uzla
   * top  = horna hrana bounding boxu uzla (= Y pozicia karty uzla)
   */
  function placeSubtree(id: string, left: number, top: number): void {
    // Pozicia karty samotneho uzla (horizontalne centrovana v bounding boxe)
    const { w: myW } = subtreeSize(id);
    const cardX = left + (myW - nodeWidth) / 2;
    positions.set(id, { x: cardX, y: top });

    const children = getChildren(id);
    if (children.length === 0) return;

    const style = getChildLayoutStyle?.(id) ?? "row";
    const childGap = (style === "pairs" || style === "fours") ? rowGap * 0.65 : rowGap / 2;
    const childrenTop = top + nodeHeight + childGap;

    if (style === "pairs" || style === "fours") {
      const perRow = style === "pairs" ? 2 : 4;
      let currentTop = childrenTop;
      let idx = 0;
      while (idx < children.length) {
        const rowKids = children.slice(idx, idx + perRow);
        // Celkova sirka riadku
        const rowTotalW = rowKids.reduce((sum, k) => sum + subtreeSize(k).w, 0) + (rowKids.length - 1) * nodeGapX;
        // Riadok centrovany v bounding boxe rodica
        let kidLeft = left + (myW - rowTotalW) / 2;
        rowKids.forEach((kid) => {
          const kidSize = subtreeSize(kid);
          placeSubtree(kid, kidLeft, currentTop);
          kidLeft += kidSize.w + nodeGapX;
        });
        // Nasledujuci riadok za maximom H tohto riadku
        const rowH = Math.max(...rowKids.map((k) => subtreeSize(k).h));
        currentTop += rowH + rowGap;
        idx += rowKids.length;
      }
      return;
    }

    // row: deti vedla seba, centrovane pod rodicom
    const totalChildW = children.reduce((sum, k) => sum + subtreeSize(k).w, 0) + (children.length - 1) * nodeGapX;
    let kidLeft = left + (myW - totalChildW) / 2;
    children.forEach((kid) => {
      const kidSize = subtreeSize(kid);
      placeSubtree(kid, kidLeft, childrenTop);
      kidLeft += kidSize.w + nodeGapX;
    });
  }

  // Umiestni root-level uzly (deti "root") vedla seba
  const rootKids = getChildren("root");
  if (rootKids.length === 0) return positions;

  const totalRootW = rootKids.reduce((sum, k) => sum + subtreeSize(k).w, 0) + (rootKids.length - 1) * nodeGapX;
  let off = centerX - totalRootW / 2;
  rootKids.forEach((id) => {
    const { w } = subtreeSize(id);
    placeSubtree(id, off, startY);
    off += w + nodeGapX;
  });

  return positions;
}

/** 2) Vrstvy: jedna horizontálna línia na úroveň, všetci rovnakej úrovne vedľa seba. */
function layoutByLevels(
  getChildren: (nodeId: string) => string[],
  centerX: number,
  startY: number,
  nodeWidth: number,
  nodeHeight: number,
  rowGap: number,
  nodeGapX: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const rows: string[][] = [];
  let currentRow = getChildren("root");
  if (currentRow.length === 0) return positions;

  rows.push(currentRow);
  const visited = new Set<string>(currentRow);
  while (currentRow.length > 0) {
    const nextRow: string[] = [];
    currentRow.forEach((id) => {
      getChildren(id).forEach((child) => {
        if (!visited.has(child)) {
          visited.add(child);
          nextRow.push(child);
        }
      });
    });
    if (nextRow.length > 0) rows.push(nextRow);
    currentRow = nextRow;
  }

  const rowHeight = nodeHeight + rowGap;
  rows.forEach((row, rowIndex) => {
    const n = row.length;
    const totalWidth = n * nodeWidth + (n - 1) * nodeGapX;
    const startX = centerX - totalWidth / 2;
    const y = startY + rowIndex * rowHeight;
    row.forEach((id, colIndex) => {
      const x = startX + colIndex * (nodeWidth + nodeGapX);
      positions.set(id, { x, y });
    });
  });

  return positions;
}

/** 3) Horizontálne: root vľavo, deti vpravo od rodiča. Strom rastie zľava doprava. */
function layoutHorizontal(
  getChildren: (nodeId: string) => string[],
  startX: number,
  centerY: number,
  nodeWidth: number,
  nodeHeight: number,
  colGap: number,
  nodeGapY: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();

  function height(id: string): number {
    if (visited.has(id)) return 0;
    visited.add(id);
    try {
      const c = getChildren(id);
      if (c.length === 0) return 1;
      return c.reduce((s, k) => s + height(k), 0);
    } finally {
      visited.delete(id);
    }
  }

  function place(parentX: number, parentCenterY: number, nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const children = getChildren(nodeId);
    if (children.length === 0) {
      positions.set(nodeId, { x: parentX, y: parentCenterY - nodeHeight / 2 });
      return;
    }
    const totalH = children.reduce((s, k) => s + height(k), 0);
    const span = totalH * nodeHeight + (totalH - 1) * nodeGapY;
    let y = parentCenterY - span / 2 + (nodeHeight + nodeGapY) / 2;
    const x = parentX + nodeWidth + colGap;
    children.forEach((kid) => {
      const h = height(kid);
      const kidCenterY = y + (h * (nodeHeight + nodeGapY)) / 2 - (nodeHeight + nodeGapY) / 2;
      place(x, kidCenterY, kid);
      positions.set(kid, { x, y: kidCenterY - nodeHeight / 2 });
      y += h * (nodeHeight + nodeGapY);
    });
  }

  const rootKids = getChildren("root");
  if (rootKids.length === 0) return positions;
  const firstColX = startX + nodeWidth + colGap;
  const totalRoot = rootKids.reduce((s, k) => s + height(k), 0);
  let off = centerY - (totalRoot * (nodeHeight + nodeGapY) - nodeGapY) / 2 + (nodeHeight + nodeGapY) / 2;
  rootKids.forEach((id) => {
    const h = height(id);
    const cy = off + (h * (nodeHeight + nodeGapY)) / 2 - (nodeHeight + nodeGapY) / 2;
    place(firstColX, cy, id);
    positions.set(id, { x: firstColX, y: cy - nodeHeight / 2 });
    off += h * (nodeHeight + nodeGapY);
  });
  return positions;
}

/** 4) Dva stĺpce: pod rodičom deti v dvoch skupinách (ľavý / pravý stĺpec). */
function layoutTwoColumns(
  getChildren: (nodeId: string) => string[],
  centerX: number,
  startY: number,
  nodeWidth: number,
  nodeHeight: number,
  rowGap: number,
  nodeGapX: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();

  function place(parentCenterX: number, parentY: number, nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const children = getChildren(nodeId);
    if (children.length === 0) {
      positions.set(nodeId, { x: parentCenterX - nodeWidth / 2, y: parentY });
      return;
    }
    const half = Math.ceil(children.length / 2);
    const left = children.slice(0, half);
    const right = children.slice(half);
    const colWidth = Math.max(left.length, right.length) * (nodeWidth + nodeGapX) - nodeGapX;
    const leftCenterX = parentCenterX - colWidth / 2 - nodeGapX * 2;
    const rightCenterX = parentCenterX + colWidth / 2 + nodeGapX * 2;
    const y = parentY + nodeHeight + rowGap;
    left.forEach((id, i) => {
      const x = leftCenterX - (left.length * (nodeWidth + nodeGapX) - nodeGapX) / 2 + i * (nodeWidth + nodeGapX);
      positions.set(id, { x, y });
      place(x + nodeWidth / 2, y + nodeHeight + rowGap, id);
    });
    right.forEach((id, i) => {
      const x = rightCenterX - (right.length * (nodeWidth + nodeGapX) - nodeGapX) / 2 + i * (nodeWidth + nodeGapX);
      positions.set(id, { x, y });
      place(x + nodeWidth / 2, y + nodeHeight + rowGap, id);
    });
  }

  const rootKids = getChildren("root");
  if (rootKids.length === 0) return positions;
  const half = Math.ceil(rootKids.length / 2);
  const left = rootKids.slice(0, half);
  const right = rootKids.slice(half);
  const colWidth = Math.max(left.length, right.length) * (nodeWidth + nodeGapX) - nodeGapX;
  const gap = nodeGapX * 3;
  const leftStart = centerX - colWidth - gap / 2;
  const rightStart = centerX + gap / 2;
  const y = startY;
  left.forEach((id, i) => {
    const x = leftStart + i * (nodeWidth + nodeGapX);
    positions.set(id, { x, y });
    place(x + nodeWidth / 2, y + nodeHeight + rowGap, id);
  });
  right.forEach((id, i) => {
    const x = rightStart + i * (nodeWidth + nodeGapX);
    positions.set(id, { x, y });
    place(x + nodeWidth / 2, y + nodeHeight + rowGap, id);
  });
  return positions;
}

const hideHandlesBubble =
  (appearance: ChartAppearanceState) =>
    appearance.nodeStyle === "bubble" && (appearance.bubbleSectionsDisconnected ?? false);

/** Farebný kruhový prechod na mieste source handle – zobrazuje farby priamych detí. */
function BranchHandle({ colors, handleId }: { colors: string[]; handleId: string }) {
  if (colors.length === 0) return <Handle type="source" position={Position.Bottom} id={handleId} />;
  const unique = [...new Set(colors)];
  const size = 14;
  // conic-gradient: každej farbe rovnaký podiel
  const stops = unique.map((c, i) => {
    const from = (i / unique.length) * 100;
    const to = ((i + 1) / unique.length) * 100;
    return `${c} ${from}% ${to}%`;
  }).join(', ');
  return (
    <div
      className="nodrag"
      style={{
        position: 'absolute',
        bottom: -size / 2,
        left: '50%',
        transform: 'translateX(-50%)',
        width: size,
        height: size,
        borderRadius: '50%',
        background: unique.length === 1 ? unique[0] : `conic-gradient(${stops})`,
        border: '2px solid #fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      {/* skrytý ReactFlow handle na rovnakom mieste */}
      <Handle
        type="source"
        position={Position.Bottom}
        id={handleId}
        style={{ opacity: 0, width: '100%', height: '100%', bottom: 0, top: 'unset', transform: 'none', borderRadius: '50%' }}
      />
    </div>
  );
}

function OrgNode({ data }: NodeProps<Node<OrgNodeData, "orgNode">>) {
  const cellFields = {
    ...data.cellFields,
    employeeId: data.cellFields.employeeId && data.showEmployeeId,
    department: data.cellFields.department && data.showDepartment,
  };
  const showExpand = data.hasChildren && data.onToggleCollapse;
  const showHandles = !data.hideHandles;
  const childColors = data.childAccentColors ?? [];
  return (
    <>
      {showHandles && <Handle type="target" position={Position.Top} id={TARGET_HANDLE_ID} />}
      <div
        className="flex flex-col items-center justify-start pt-2"
        style={{ width: data.nodeWidth, minHeight: data.nodeHeight, position: 'relative' }}
      >
        <div className="relative">
          <NodeCard
            fullName={data.record.fullName}
            positionName={data.record.positionName}
            department={data.record.department}
            employeeId={data.record.employeeId}
            positionType={data.record.positionType}
            kat={data.record.kat}
            cellFields={cellFields}
            nodeStyle={data.nodeStyle}
            accent={
              data.accent?.type === "solid" && data.accent.color
                ? data.accent
                : data.accent?.type === "gradient"
                  ? data.accent
                  : null
            }
            photoUrl={data.photoUrl ?? null}
            totalSubordinateCount={data.totalSubordinateCount}
            effectiveKatColors={data.effectiveKatColors}
            fontScale={data.fontScale}
            photoScale={data.photoScale}
            photoFrameScale={data.photoFrameScale}
            photoFrameBorderWidth={data.photoFrameBorderWidth}
            photoOffsetX={data.photoOffsetX}
            photoOffsetY={data.photoOffsetY}
            nodeWidth={data.nodeWidth}
            nodeHeight={data.nodeHeight}
          />
          {showExpand && (
            <div className="absolute bottom-2 right-2">
              <ExpandCollapseButton
                isCollapsed={data.isCollapsed ?? false}
                onToggle={data.onToggleCollapse!}
              />
            </div>
          )}
        </div>
      </div>
      {showHandles && <Handle type="source" position={Position.Bottom} id={SOURCE_HANDLE_ID} />}
    </>
  );
}

/** Pevná šírka/výška karty zamestnanca – používa sa pre rozloženie aj obal OrgNode (bez prekrývania). */
const BASE_NODE_WIDTH = 280;
const BASE_NODE_HEIGHT = 160;
/** Minimálna medzera medzi kartami zamestnancov (rovnako ako medzi strediskami – žiadne prekrývanie). */
const MIN_NODE_GAP_X = 24;
const MIN_NODE_GAP_Y = 24;
const ROOT_Y = 0;
/** Vertikálna medzera medzi vrstvami v čistom vrstvovom layoute. */
const LAYOUT_ROW_GAP = 28;
/** Horizontálna medzera medzi uzlami v tej istej vrstve. */
const LAYOUT_NODE_GAP_X = 24;
const STREDISKO_Y = 200;
/** Klasické: priestranné, žiadne prekrývanie. */
const TREE_STEP_X = BASE_NODE_WIDTH + MIN_NODE_GAP_X + 4;       // 308
const TREE_STEP_Y = BASE_NODE_HEIGHT + MIN_NODE_GAP_Y + 4;      // 188
/** Jedno oddelenie. */
const TREE_STEP_X_SINGLE = BASE_NODE_WIDTH + MIN_NODE_GAP_X;    // 304
const TREE_STEP_Y_SINGLE = BASE_NODE_HEIGHT + MIN_NODE_GAP_Y;   // 184
/** Kompaktný: minimálne rozostupy bez prekrývania. */
const TREE_STEP_X_COMPACT = BASE_NODE_WIDTH + MIN_NODE_GAP_X;   // 304
const TREE_STEP_Y_COMPACT = BASE_NODE_HEIGHT + MIN_NODE_GAP_Y;  // 184
/** Horizontálne: čisté úrovne, väčšie kroky. */
const TREE_STEP_X_HORIZ = BASE_NODE_WIDTH + MIN_NODE_GAP_X + 16; // 320
const TREE_STEP_Y_HORIZ = BASE_NODE_HEIGHT + MIN_NODE_GAP_Y + 4;  // 188
const HORIZ_GAP = 28;

const EDGE_TYPE_MAP: Record<ConnectionLineStyle, "straight" | "step" | "smoothstep"> = {
  straight: "straight",
  step: "step",
  smoothstep: "smoothstep",
};

/** Styl dual: vodorovná priečka nad riadkom, potom zvisle do horného stredu karty. */
const PAIRS_ROW_GAP = 12;

const TREE_EDGE_RADIUS = 8;

/** Hrana: zvislá do branchY, vodorovná vetva, potom zvisle do cieľa (horný stred alebo stred bunky). Bez zigzagu. */
function TreeBranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
  markerEnd,
}: EdgeProps) {
  const hasBranchData = data?.branchY != null;
  // Ak nie je explicitný branchY (row layout), použijeme stred – klasická L-čiara
  const branchY = hasBranchData ? (data?.branchY as number) : (sourceY + targetY) / 2;
  const connectToCenter = data?.connectToCenter !== false && data?.nodeHeight != null;
  const nodeHeight = (data?.nodeHeight as number) ?? 160;
  const endY = connectToCenter ? targetY + nodeHeight / 2 : targetY;
  const rounded = data?.rounded === true;
  const r = rounded ? Math.min(TREE_EDGE_RADIUS, Math.abs(targetX - sourceX) / 2, Math.abs(branchY - sourceY) / 2, Math.abs(endY - branchY) / 2) : 0;

  let path: string;
  if (!rounded || r <= 0) {
    path = `M ${sourceX},${sourceY} L ${sourceX},${branchY} L ${targetX},${branchY} L ${targetX},${endY}`;
  } else {
    const goRight = targetX > sourceX;
    if (goRight) {
      path =
        `M ${sourceX},${sourceY} L ${sourceX},${branchY - r}` +
        ` A ${r} ${r} 0 0 1 ${sourceX + r},${branchY}` +
        ` L ${targetX - r},${branchY}` +
        ` A ${r} ${r} 0 0 1 ${targetX},${branchY + r}` +
        ` L ${targetX},${endY}`;
    } else {
      path =
        `M ${sourceX},${sourceY} L ${sourceX},${branchY - r}` +
        ` A ${r} ${r} 0 0 0 ${sourceX - r},${branchY}` +
        ` L ${targetX + r},${branchY}` +
        ` A ${r} ${r} 0 0 0 ${targetX},${branchY + r}` +
        ` L ${targetX},${endY}`;
    }
  }
  const DOT_R = 5.5;
  // Dot siedí na ohybe smerom ku child nodu (targetX, branchY) – križovatka H a V čiary
  const dotY = branchY;
  return (
    <g>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {(data?.targetDotColor as string | undefined) && (
        <>
          <circle cx={targetX} cy={dotY} r={DOT_R} fill={data?.targetDotColor as string} />
          <circle cx={targetX} cy={dotY} r={DOT_R} fill="none" stroke="#fff" strokeWidth={1.5} />
        </>
      )}
    </g>
  );
}

function getInitialFromSettings<T>(s: OrgChartSettingsPayload | null | undefined, key: keyof OrgChartSettingsPayload, fallback: () => T): T {
  const v = s?.[key];
  if (v !== undefined && v !== null) return v as T;
  return fallback();
}

export function OrgChartCanvas(props: OrgChartCanvasProps) {
  const { t } = useTranslation();
  const { records: rawRecords, allowEdit = false, onRecordsChange, initialSettings, onSettingsChange, onResetToDefaults, useDbPhotos = false, onPhotoChanged, initialShareableViewState } = props;
  const useDbSettings = initialSettings != null && onSettingsChange != null;

  const onSettingsChangeRef = useRef(onSettingsChange);
  onSettingsChangeRef.current = onSettingsChange;

  /** Ref na setSelectedDepartment aby sme ho mohli volať z async PDF export callbacku. */
  const onSelectDepartmentRef = useRef((_dept: string) => {});
  const showEmployeeId = true;
  const showDepartment = true;
  const [showCellSettings, setShowCellSettings] = useState(false);
  const [showKatColorsSettings, setShowKatColorsSettings] = useState(false);
  const [chartAppearance, setChartAppearanceState] = useState<ChartAppearanceState>(() =>
    useDbSettings && initialSettings?.appearance
      ? { ...DEFAULT_CHART_APPEARANCE, ...initialSettings.appearance }
      : loadChartAppearance(),
  );
  const setChartAppearance = useCallback(
    (next: ChartAppearanceState) => {
      setChartAppearanceState(next);
      if (onSettingsChange) onSettingsChange({ appearance: next });
      else saveChartAppearance(next);
    },
    [onSettingsChange],
  );
  const nodeScale = Math.min(2.2, Math.max(0.6, chartAppearance.nodeScale ?? 1));
  const nodeWidthScale = Math.min(2.4, Math.max(0.6, chartAppearance.nodeWidthScale ?? 1));
  const nodeHeightScale = Math.min(2.6, Math.max(0.6, chartAppearance.nodeHeightScale ?? 1));
  const fontScale = Math.min(2.2, Math.max(0.7, chartAppearance.fontScale ?? 1));
  const photoScale = Math.min(4.5, Math.max(0.5, chartAppearance.photoScale ?? 1));
  const photoFrameScale = Math.min(3.5, Math.max(0.5, chartAppearance.photoFrameScale ?? 1));
  const photoFrameBorderWidth = Math.min(8, Math.max(0, chartAppearance.photoFrameBorderWidth ?? 3));
  const photoOffsetX = Math.min(80, Math.max(-80, chartAppearance.photoOffsetX ?? 0));
  const photoOffsetY = Math.min(80, Math.max(-80, chartAppearance.photoOffsetY ?? 0));
  // Keď sa zväčší písmo alebo fotka, bunka sa automaticky dorovná,
  // aby zostali všetky bunky rovnako veľké a nič nepretieklo.
  const autoScaleFromContent = Math.max(fontScale, photoScale, photoFrameScale);
  const effectiveWidthScale = Math.max(nodeScale * nodeWidthScale, autoScaleFromContent * 0.9);
  const effectiveHeightScale = Math.max(nodeScale * nodeHeightScale, autoScaleFromContent);
  const nodeWidth = Math.round(BASE_NODE_WIDTH * effectiveWidthScale);
  const nodeHeight = Math.round(BASE_NODE_HEIGHT * effectiveHeightScale);
  const [generalManagerId, setGeneralManagerIdState] = useState<string | null>(() =>
    getInitialFromSettings(initialSettings, "generalManagerId", loadGeneralManagerId) ?? FALLBACK_GM_EMPLOYEE_ID,
  );
  const setGeneralManagerId = useCallback(
    (id: string | null) => {
      setGeneralManagerIdState(id);
      if (onSettingsChange) onSettingsChange({ generalManagerId: id });
      else saveGeneralManagerId(id);
    },
    [onSettingsChange],
  );
  const [selectedDepartment, setSelectedDepartmentState] = useState<string>(() =>
    getInitialFromSettings(initialSettings, "selectedDepartment", loadSelectedDepartment) ?? "all",
  );
  const setSelectedDepartment = useCallback(
    (value: string) => {
      setSelectedDepartmentState(value);
      if (onSettingsChange) onSettingsChange({ selectedDepartment: value });
      else if (typeof window !== "undefined") {
        try {
          localStorage.setItem("org-chart-selected-department", value);
        } catch {}
      }
    },
    [onSettingsChange],
  );
  // Vždy aktuálny ref – potrebný pre async export callbacky
  onSelectDepartmentRef.current = setSelectedDepartment;
  const [departmentManagers, setDepartmentManagersState] = useState<Record<string, string>>(() =>
    getInitialFromSettings(initialSettings, "departmentManagers", loadDepartmentManagers) ?? {},
  );
  const setDepartmentManagers = useCallback(
    (next: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
      setDepartmentManagersState((prev) => (typeof next === "function" ? next(prev) : next));
    },
    [],
  );
  const departmentManagersPersistedRef = useRef(false);
  useEffect(() => {
    if (!departmentManagersPersistedRef.current) {
      departmentManagersPersistedRef.current = true;
      return;
    }
    const cb = onSettingsChangeRef.current;
    if (cb) {
      cb({ departmentManagers: departmentManagers });
    } else if (typeof window !== "undefined") {
      try {
        localStorage.setItem("org-chart-department-managers", JSON.stringify(departmentManagers));
      } catch {}
    }
  }, [departmentManagers]);
  const [maxVisibleLayers, setMaxVisibleLayersState] = useState<MaxVisibleLayers>(() =>
    getInitialFromSettings(initialSettings, "maxVisibleLayers", loadMaxVisibleLayers),
  );
  const setMaxVisibleLayers = useCallback(
    (value: MaxVisibleLayers) => {
      setMaxVisibleLayersState(value);
      if (onSettingsChange) onSettingsChange({ maxVisibleLayers: value });
      else saveMaxVisibleLayers(value);
    },
    [onSettingsChange],
  );
  const [vacancies, setVacanciesState] = useState<VacancyPlaceholder[]>(() =>
    getInitialFromSettings(initialSettings, "vacancies", loadVacancies),
  );
  const setVacancies = useCallback(
    (next: VacancyPlaceholder[]) => {
      setVacanciesState(next);
      if (onSettingsChange) onSettingsChange({ vacancies: next });
      else saveVacancies(next);
    },
    [onSettingsChange],
  );
  const [sectionGroups, setSectionGroupsState] = useState<SectionGroup[]>(() =>
    getInitialFromSettings(initialSettings, "sectionGroups", () => []) ?? [],
  );
  const setSectionGroups = useCallback(
    (next: SectionGroup[]) => {
      setSectionGroupsState(next);
      if (onSettingsChange) onSettingsChange({ sectionGroups: next });
    },
    [onSettingsChange],
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sectionMembers, setSectionMembers] = useState<SectionMemberRow[]>([]);
  // Nacitaj section members z DB pri starte pre vsetkych prihlasenych pouzivatelov
  useEffect(() => {
    fetchSectionMembers().then(setSectionMembers).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(() =>
    getInitialFromSettings(initialSettings, "positions", loadPositions),
  );
  const [positionsLocked, setPositionsLocked] = useState(() =>
    getInitialFromSettings(initialSettings, "positionsLocked", loadPositionsLocked),
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string | null>(null);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() =>
    getInitialFromSettings(initialSettings, "rightPanelCollapsed", () => true),
  );
  /** Mriežka na zarovnanie – štandardne vypnutá. */
  const [showGrid, setShowGrid] = useState(false);
  const [gridSettings, setGridSettings] = useState<GridSettings>(() => ({
    gap: DEFAULT_GRID_GAP,
    lineWidth: DEFAULT_GRID_LINE_WIDTH,
    color: DEFAULT_GRID_COLOR,
    variant: "lines",
  }));
  const [showGridSettingsPanel, setShowGridSettingsPanel] = useState(false);
  const [employeePhotos, setEmployeePhotos] = useState<Record<string, string>>(() => loadEmployeePhotos());
  const [employeeColors, setEmployeeColorsState] = useState<Record<string, string>>(() =>
    getInitialFromSettings(initialSettings, "employeeColors", loadEmployeeColors),
  );
  const [employeePhotoOffsets, setEmployeePhotoOffsetsState] = useState<
    Record<string, { x: number; y: number }>
  >(() => getInitialFromSettings(initialSettings, "employeePhotoOffsets", loadEmployeePhotoOffsets));
  const [childLayoutByNodeId, setChildLayoutByNodeIdState] = useState<Record<string, ChildLayoutStyle>>(() => {
    const fromSettings = initialSettings?.employeeChildLayout;
    if (fromSettings && typeof fromSettings === "object") {
      const out: Record<string, ChildLayoutStyle> = {};
      const valid: ChildLayoutStyle[] = ["row", "pairs", "fours"];
      for (const [k, v] of Object.entries(fromSettings)) {
        if (typeof v === "string" && valid.includes(v as ChildLayoutStyle)) out[k] = v as ChildLayoutStyle;
      }
      return out;
    }
    return loadChildLayoutByNodeId();
  });
  const [collapsedNodeIds, setCollapsedNodeIdsState] = useState<Set<string>>(() => {
    if (initialShareableViewState?.collapsedNodes?.length) {
      return new Set(initialShareableViewState.collapsedNodes);
    }
    const arr = initialSettings?.collapsedNodes;
    if (Array.isArray(arr)) return new Set(arr);
    return loadCollapsedNodes();
  });

  /** Farby KAT: východzie z tokens + prepis z nastavení (umožňuje nastaviť SAL, INDIR1, INDIR2, INDIR3…). */
  const effectiveKatColors = useMemo((): Record<string, string> => ({
    ...(brandTokens.katColors as Record<string, string>),
    ...(initialSettings?.katColors ?? {}),
  }), [initialSettings?.katColors]);

  /** Možnosti farieb pre filter „zobraziť len farby karty“ – vždy paleta z výberu farby karty. */
  const filterColorOptions = useMemo(
    () => CARD_COLOR_PALETTE.map((c, i) => ({ hex: c.hex, label: t(`orgChart.color${i}`) })),
    [t],
  );

  const reactFlowInstanceRef = useRef<{
    fitView: (opts?: { padding?: number; duration?: number }) => void;
    getViewport?: () => { x: number; y: number; zoom: number };
    setViewport?: (viewport: { x: number; y: number; zoom: number }, opts?: { duration?: number }) => void;
  } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingAllPdf, setIsExportingAllPdf] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const initialShareableViewStateRef = useRef(initialShareableViewState);

  const setCollapsedNodeIds = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      setCollapsedNodeIdsState((prev) => {
        const next = updater(prev);
        const cb = onSettingsChangeRef.current;
        if (cb) queueMicrotask(() => cb({ collapsedNodes: [...next] }));
        else saveCollapsedNodes(next);
        return next;
      });
    },
    [],
  );

  const toggleCollapsed = useCallback((nodeId: string) => {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, [setCollapsedNodeIds]);
  useEffect(() => {
    if (!useDbSettings && typeof window !== "undefined") {
      try {
        if (localStorage.getItem("org-chart-right-panel-collapsed") === "1") {
          setRightPanelCollapsed(true);
        }
      } catch {}
    }
  }, [useDbSettings]);
  const setRightPanelCollapsedAndSave = useCallback(
    (value: boolean) => {
      setRightPanelCollapsed(value);
      if (onSettingsChange) onSettingsChange({ rightPanelCollapsed: value });
      else if (typeof window !== "undefined") {
        try {
          localStorage.setItem("org-chart-right-panel-collapsed", value ? "1" : "0");
        } catch {}
      }
    },
    [onSettingsChange],
  );
  const nodesRef = useRef<OrgFlowNode[]>([]);

  const recordsWithKat = useMemo(() => {
    const allowed = new Set(ALLOWED_KAT_VALUES);
    const withKat = rawRecords.filter((r) => r.kat != null && allowed.has(r.kat));
    return withKat.length > 0 ? withKat : rawRecords;
  }, [rawRecords]);

  /** Pri zobrazení oddelenia: koreň stromu je manažér oddelenia; inak GM. */
  const effectiveRootId = useMemo(() => {
    const gmId = generalManagerId ?? FALLBACK_GM_EMPLOYEE_ID;
    if (selectedDepartment === "all" || !selectedDepartment) return gmId;
    const deptManagerId = departmentManagers[selectedDepartment];
    if (!deptManagerId) return gmId;
    const exists =
      rawRecords.some((r) => r.employeeId === deptManagerId) ||
      vacancies.some((v) => v.id === deptManagerId);
    return exists ? deptManagerId : gmId;
  }, [
    generalManagerId,
    selectedDepartment,
    departmentManagers,
    rawRecords,
    vacancies,
  ]);

  const layoutType = chartAppearance.layoutType ?? "vertical";
  const stepX =
    layoutType === "horizontal" ? TREE_STEP_X_HORIZ
    : layoutType === "compact" ? TREE_STEP_X_COMPACT
    : TREE_STEP_X;
  const stepY =
    layoutType === "horizontal" ? TREE_STEP_Y_HORIZ
    : layoutType === "compact" ? TREE_STEP_Y_COMPACT
    : TREE_STEP_Y;

  /** Mapovanie parentId -> deti. Používa všetkých zamestnancov (rawRecords), aby sa po výbere osoby zobrazila celá štruktúra pod ňou. */
  const hierarchyChildren = useMemo(() => {
    const map = new Map<string, string[]>();

    // Zostav mapu s section member overrides
    // Ak ma zamestnanec override v sectionMembers, jeho managerEmployeeId sa nahradi section_id
    const sectionOverrideMap = new Map(sectionMembers.map((m) => [m.employee_id, m.section_id]));

    rawRecords.forEach((r) => {
      const effectiveParentId = sectionOverrideMap.get(r.employeeId) ?? r.managerEmployeeId ?? "__root";
      const list = map.get(effectiveParentId) ?? [];
      list.push(r.employeeId);
      map.set(effectiveParentId, list);
    });
    vacancies.forEach((v) => {
      const parentId = v.parentId ?? "__root";
      const list = map.get(parentId) ?? [];
      list.push(v.id);
      map.set(parentId, list);
    });
    sectionGroups.forEach((s) => {
      const parentId = s.parentId ?? "__root";
      const list = map.get(parentId) ?? [];
      list.push(s.id);
      map.set(parentId, list);
    });
    return map;
  }, [rawRecords, vacancies, sectionGroups, sectionMembers]);

  const [childOrderByParent, setChildOrderByParentState] = useState<Record<string, string[]>>(() => {
    const fromSettings = initialSettings?.childOrderByParent;
    if (fromSettings && typeof fromSettings === "object") {
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(fromSettings)) {
        if (Array.isArray(v) && v.every((id) => typeof id === "string")) out[k] = v;
      }
      return out;
    }
    return loadChildOrderByParent();
  });

  /** Po načítaní zo servera aplikovať nastavenia z DB – useState lazy init ich nestihne ak Supabase
   *  odpovie až po prvom renderi. Každý blok sa aplikuje max raz (ref guard). */
  const dbSettingsAppliedRef = useRef({ positions: false, collapsed: false });

  useEffect(() => {
    if (dbSettingsAppliedRef.current.positions) return;
    const dbPositions = initialSettings?.positions;
    if (!dbPositions || typeof dbPositions !== "object" || Object.keys(dbPositions).length === 0) return;
    dbSettingsAppliedRef.current.positions = true;
    setNodePositions((prev) => ({ ...prev, ...dbPositions as Record<string, { x: number; y: number }> }));
  }, [initialSettings?.positions]);

  useEffect(() => {
    if (dbSettingsAppliedRef.current.collapsed) return;
    const arr = initialSettings?.collapsedNodes;
    if (!Array.isArray(arr)) return;
    dbSettingsAppliedRef.current.collapsed = true;
    setCollapsedNodeIdsState(new Set(arr));
  }, [initialSettings?.collapsedNodes]);

  /** Po načítaní zo servera zlúčiť do stavu všetkých nadriadených z initialSettings, aby sme neprepisovali DB menším množstvom. */
  useEffect(() => {
    const fromServer = initialSettings?.childOrderByParent;
    if (!fromServer || typeof fromServer !== "object") return;
    const next: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(fromServer)) {
      if (Array.isArray(v) && v.every((id) => typeof id === "string")) next[k] = v;
    }
    const serverCount = Object.keys(next).length;
    if (serverCount === 0) return;
    setChildOrderByParentState((prev) => {
      const prevCount = Object.keys(prev).length;
      if (prevCount >= serverCount) return prev;
      return { ...next, ...prev };
    });
  }, [initialSettings?.childOrderByParent]);

  const setChildOrderByParent = useCallback(
    (next: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => {
      setChildOrderByParentState((prev) => {
        const nextVal = typeof next === "function" ? next(prev) : next;
        return nextVal;
      });
    },
    [],
  );

  /** Uloženie poradia po zmene – v useEffect, aby sa nevolal parent setState počas renderu. Pri Supabase (admin) ide do DB, inak do localStorage. */
  const childOrderByParentPersistedRef = useRef(false);
  useEffect(() => {
    if (!childOrderByParentPersistedRef.current) {
      childOrderByParentPersistedRef.current = true;
      return;
    }
    const payload = Object.fromEntries(
      Object.entries(childOrderByParent).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]),
    ) as Record<string, string[]>;
    const parentIds = Object.keys(payload);
    const cb = onSettingsChangeRef.current;
    if (cb) {
      if (process.env.NODE_ENV === "development") {
        console.info("[Org chart] Ukladám poradie podriadených do Supabase:", parentIds.length, "nadriadených:", parentIds);
      }
      cb({ childOrderByParent: payload });
    } else {
      if (process.env.NODE_ENV === "development") {
        console.info("[Org chart] Ukladám poradie podriadených do localStorage:", parentIds.length, "nadriadených:", parentIds);
      }
      saveChildOrderByParent(payload);
    }
  }, [childOrderByParent]);

  /** Aplikuje uložené poradie na zoznam detí; ak nie je nastavené, vráti pôvodný zoznam. */
  const orderedHierarchyChildren = useMemo(() => {
    const result = new Map<string, string[]>();
    hierarchyChildren.forEach((childIds, parentId) => {
      const order = childOrderByParent[parentId];
      if (!order?.length) {
        result.set(parentId, childIds);
        return;
      }
      const orderSet = new Set(order);
      const ordered = order.filter((id) => childIds.includes(id));
      const rest = childIds.filter((id) => !orderSet.has(id));
      result.set(parentId, [...ordered, ...rest]);
    });
    return result;
  }, [hierarchyChildren, childOrderByParent]);

  /** Celá hierarchia (všetci zamestnanci vrátane DIR, INDIR1). Používa sa len na počítanie podriadených. */
  const hierarchyChildrenAll = useMemo(() => {
    const map = new Map<string, string[]>();
    const sectionOverrideMap = new Map(sectionMembers.map((m) => [m.employee_id, m.section_id]));
    rawRecords.forEach((r) => {
      const effectiveParentId = sectionOverrideMap.get(r.employeeId) ?? r.managerEmployeeId ?? "__root";
      const list = map.get(effectiveParentId) ?? [];
      list.push(r.employeeId);
      map.set(effectiveParentId, list);
    });
    vacancies.forEach((v) => {
      const parentId = v.parentId ?? "__root";
      const list = map.get(parentId) ?? [];
      list.push(v.id);
      map.set(parentId, list);
    });
    sectionGroups.forEach((s) => {
      const parentId = s.parentId ?? "__root";
      const list = map.get(parentId) ?? [];
      list.push(s.id);
      map.set(parentId, list);
    });
    return map;
  }, [rawRecords, vacancies, sectionGroups, sectionMembers]);

  /** Celkový počet ľudí (zamestnancov) pod daným uzlom – rekurzívne z celej hierarchie (vrátane DIR, INDIR1). */
  const totalSubordinateCountByNodeId = useMemo(() => {
    const countCache = new Map<string, number>();
    const isEmployee = (id: string) => !isVacancyId(id) && !isSectionId(id);
    function countInSubtree(id: string): number {
      const cached = countCache.get(id);
      if (cached !== undefined) return cached;
      const children = hierarchyChildrenAll.get(id) ?? [];
      let n = isEmployee(id) ? 1 : 0;
      for (const c of children) n += countInSubtree(c);
      countCache.set(id, n);
      return n;
    }
    const result = new Map<string, number>();
    rawRecords.forEach((r) => {
      const total = countInSubtree(r.employeeId);
      result.set(r.employeeId, Math.max(0, total - 1));
    });
    return result;
  }, [hierarchyChildrenAll, rawRecords]);

  /** Hĺbka uzla: root = 1, priami podriadení = 2, atď. (bez ohľadu na collapse / max layers). */
  const depthByNodeId = useMemo(() => {
    const map = new Map<string, number>();
    map.set("root", 1);
    const queue: string[] = ["root"];
    const getKids = (id: string) =>
      id === "root" ? orderedHierarchyChildren.get(effectiveRootId ?? "__root") ?? [] : orderedHierarchyChildren.get(id) ?? [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const d = map.get(id)!;
      getKids(id).forEach((kid) => {
        if (!map.has(kid)) {
          map.set(kid, d + 1);
          queue.push(kid);
        }
      });
    }
    return map;
  }, [orderedHierarchyChildren, effectiveRootId]);

  const getChildrenForLayout = useCallback(
    (nodeId: string): string[] => {
      if (collapsedNodeIds.has(nodeId)) return [];
      const depth = depthByNodeId.get(nodeId) ?? 1;
      if (depth >= maxVisibleLayers) return [];
      const raw =
        nodeId === "root"
          ? orderedHierarchyChildren.get(effectiveRootId ?? "__root") ?? []
          : orderedHierarchyChildren.get(nodeId) ?? [];
      // Nikdy nezobrazovať uzol ako vlastného potomka. Pre root: odstrániť osobu, ktorá sa ako root zobrazuje
      // (vybraná osoba alebo fallback), aby sa pri „žiadna vybraná“ nezdvojal (root = fallback, deti z __root obsahujú toho istého).
      const idToExclude =
        nodeId === "root" ? (effectiveRootId ?? FALLBACK_GM_EMPLOYEE_ID) : nodeId;
      return raw.filter((id) => id !== idToExclude);
    },
    [orderedHierarchyChildren, effectiveRootId, collapsedNodeIds, depthByNodeId, maxVisibleLayers],
  );

  const expansionStyle = chartAppearance.expansionStyle ?? "tree";
  const layoutRowGap = chartAppearance.rowGap ?? LAYOUT_ROW_GAP;
  const layoutNodeGapX = chartAppearance.nodeGapX ?? LAYOUT_NODE_GAP_X;
  const hierarchyLayoutPositions = useMemo(() => {
    const centerX = 520;
    const rootChildStyle = childLayoutByNodeId[effectiveRootId ?? ""] ?? "row";
    const firstRowGap =
      rootChildStyle === "row"
        ? layoutRowGap / 1.5
        : (rootChildStyle === "pairs" || rootChildStyle === "fours")
          ? layoutRowGap * 0.65
          : layoutRowGap;
    const firstRowY = ROOT_Y + nodeHeight + firstRowGap;
    switch (expansionStyle) {
      case "horizontal": {
        const startX = 80;
        const centerY = 360;
        return layoutHorizontal(
          getChildrenForLayout,
          startX,
          centerY,
          nodeWidth,
          nodeHeight,
          layoutRowGap,
          layoutNodeGapX,
        );
      }
      case "layers":
        return layoutByLevels(
          getChildrenForLayout,
          centerX,
          firstRowY,
          nodeWidth,
          nodeHeight,
          layoutRowGap,
          layoutNodeGapX,
        );
      case "twocol":
        return layoutTwoColumns(
          getChildrenForLayout,
          centerX,
          firstRowY,
          nodeWidth,
          nodeHeight,
          layoutRowGap,
          layoutNodeGapX,
        );
      case "tree":
      default:
        return layoutTreeUnderParent(
          getChildrenForLayout,
          centerX,
          firstRowY,
          nodeWidth,
          nodeHeight,
          layoutRowGap,
          layoutNodeGapX,
          (nodeId) => childLayoutByNodeId[nodeId === "root" ? effectiveRootId ?? "" : nodeId],
        );
    }
  }, [getChildrenForLayout, expansionStyle, childLayoutByNodeId, effectiveRootId, layoutRowGap, layoutNodeGapX, nodeWidth, nodeHeight]);

  /** Všetky id v strome (GM + jeho potomkovia). */
  /** Len uzly skutočne zobrazené – pri zbalenej vetve sa jej podriadení nezahrnú (schovajú). */
  const nodeIdsInTree = useMemo(() => {
    const set = new Set<string>();
    function collect(ids: string[]) {
      ids.forEach((id) => {
        if (set.has(id)) return;
        set.add(id);
        collect(getChildrenForLayout(id));
      });
    }
    collect(getChildrenForLayout("root"));
    return set;
  }, [getChildrenForLayout]);

  const handleSetDepartmentManager = useCallback(
    (department: string, employeeId: string | null) => {
      setDepartmentManagers((prev) => {
        const next = { ...prev };
        if (employeeId == null) delete next[department];
        else next[department] = employeeId;
        return next;
      });
    },
    [setDepartmentManagers],
  );

  const rootDisplay = useMemo(() => {
    const rootId = effectiveRootId ?? FALLBACK_GM_EMPLOYEE_ID;
    const emp = rawRecords.find((r) => r.employeeId === rootId);
    if (emp) return { type: "employee" as const, record: emp };
    const vac = vacancies.find((v) => v.id === rootId);
    if (vac) return { type: "vacancy" as const, vacancy: vac };
    return { type: "placeholder" as const };
  }, [effectiveRootId, rawRecords, vacancies]);

  const rootHasChildren = (orderedHierarchyChildren.get(effectiveRootId ?? "__root") ?? []).length > 0;
  const rootIsCollapsed = collapsedNodeIds.has("root");

  const handleAlignToTemplate = useCallback(() => {
    const centerX = 520;
    const rootPos =
      expansionStyle === "horizontal"
        ? { x: 80, y: 360 - nodeHeight / 2 }
        : { x: centerX - nodeWidth / 2, y: ROOT_Y };
    const template: Record<string, { x: number; y: number }> = { root: rootPos };
    hierarchyLayoutPositions.forEach((pos, id) => {
      template[id] = pos;
    });
    setNodePositions((prev) => {
      const next = { ...prev, ...template };
      const cb = onSettingsChangeRef.current;
      if (cb) queueMicrotask(() => cb({ positions: next }));
      else savePositions(next);
      return next;
    });
  }, [hierarchyLayoutPositions, expansionStyle, nodeHeight, nodeWidth]);

  /** Pri zmene zbalenia, rozloženia alebo štýlu vždy prepočítať pozície podľa šablóny, aby sa sekcie neprekrývali. */
  const didMountRef = useRef(false);
  const positionsLockedRef = useRef(positionsLocked);
  positionsLockedRef.current = positionsLocked;
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (positionsLockedRef.current) return;
    const centerX = 520;
    const rootPos =
      expansionStyle === "horizontal"
        ? { x: 80, y: 360 - nodeHeight / 2 }
        : { x: centerX - nodeWidth / 2, y: ROOT_Y };
    const template: Record<string, { x: number; y: number }> = { root: rootPos };
    hierarchyLayoutPositions.forEach((pos, id) => {
      // Ak má node alebo jeho rodič nastavený „custom“ layout, nepřepisuj pozici z auto-layoutu
      const parentId = [...orderedHierarchyChildren.entries()].find(([, kids]) => kids.includes(id))?.[0];
      const parentStyle = parentId ? (childLayoutByNodeId[parentId === effectiveRootId ? effectiveRootId : parentId] ?? "row") : "row";
      if (parentStyle === "custom") return;
      template[id] = pos;
    });
    setNodePositions((prev) => {
      const next = { ...prev, ...template };
      const cb = onSettingsChangeRef.current;
      if (cb) queueMicrotask(() => cb({ positions: next }));
      else savePositions(next);
      return next;
    });
  }, [
    collapsedNodeIds,
    expansionStyle,
    childLayoutByNodeId,
    effectiveRootId,
    orderedHierarchyChildren,
    maxVisibleLayers,
    hierarchyLayoutPositions,
    layoutRowGap,
    layoutNodeGapX,
    nodeHeight,
    nodeWidth,
  ]);

  /** Zbaliť všetky vetvy okrem root – zostane len vrchol a priama línia pod ním. Potom prirítniť pohľad. */
  const handleShowRootOnly = useCallback(() => {
    const allIdsUnderRoot = new Set<string>();
    function collect(ids: string[]) {
      ids.forEach((id) => {
        if (allIdsUnderRoot.has(id)) return;
        allIdsUnderRoot.add(id);
        collect(orderedHierarchyChildren.get(id) ?? []);
      });
    }
    collect(orderedHierarchyChildren.get(effectiveRootId ?? "__root") ?? []);
    setCollapsedNodeIds(() => {
      const next = new Set(allIdsUnderRoot);
      saveCollapsedNodes(next);
      return next;
    });
    requestAnimationFrame(() => {
      reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 300 });
    });
  }, [orderedHierarchyChildren, effectiveRootId, setCollapsedNodeIds]);

  const nodes = useMemo((): OrgFlowNode[] => {
    const list: OrgFlowNode[] = [];
    const centerX = 520;
    const rootPos =
      nodePositions["root"] ??
      (expansionStyle === "horizontal"
        ? { x: 80, y: 360 - nodeHeight / 2 }
        : { x: centerX - nodeWidth / 2, y: ROOT_Y });
    const appearance = chartAppearance;
    const rootAccent = getNodeAccent(appearance, { levelIndex: 0 });
    const hideHandles = hideHandlesBubble(appearance);

    /** Pomocná funkcia: vypočíta accent farbu pre daný záznam rovnako ako v hlavnej slučke. */
    const resolveAccentColor = (record: EmployeeRecord, levelIdx: 0 | 1 | 2): string => {
      const customColor = employeeColors[record.employeeId];
      if (customColor) return customColor;
      if (appearance.colorScheme === "byPosition" && (record.kat || record.positionType)) {
        return record.kat
          ? (effectiveKatColors[record.kat] ?? brandTokens.positionTypeColors[record.positionType])
          : brandTokens.positionTypeColors[record.positionType];
      }
      const a = getNodeAccent(appearance, { levelIndex: levelIdx, positionType: record.positionType, kat: record.kat ?? undefined });
      return a?.type === "solid" && a.color ? a.color : (brandTokens.colors.navy as string);
    };

    /** Pre každý parentId: zoznam accent farieb priamych viditeľných detí (len orgNode záznamy). */
    const getChildAccentColors = (parentId: string): string[] => {
      const childIds = getChildrenForLayout(parentId);
      return childIds
        .map((id) => {
          if (isVacancyId(id)) return null;
          const r = rawRecords.find((rec) => rec.employeeId === id);
          if (!r) return null;
          return resolveAccentColor(r, 1);
        })
        .filter((c): c is string => c !== null);
    };

    if (rootDisplay.type === "employee") {
      const record = rootDisplay.record;
      const accent = getNodeAccent(appearance, {
        levelIndex: 0,
        positionType: record.positionType,
        kat: record.kat ?? undefined,
      });
      const customColor = employeeColors[record.employeeId];
      const customPhotoOffset = employeePhotoOffsets[record.employeeId];
      const resolvedAccent =
        customColor
          ? { type: "solid" as const, color: customColor }
          : appearance.colorScheme === "byPosition" && (record.kat || record.positionType)
            ? { type: "solid" as const, color: record.kat ? (effectiveKatColors[record.kat] ?? brandTokens.positionTypeColors[record.positionType]) : brandTokens.positionTypeColors[record.positionType] }
            : accent;
      list.push({
        id: "root",
        type: "orgNode",
        position: rootPos,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          record,
          showEmployeeId,
          showDepartment,
          cellFields: appearance.cellFields,
          nodeStyle: getEffectiveNodeStyle(appearance, "employee"),
          accent: resolvedAccent,
          levelIndex: 0,
          photoUrl: record.photoUrl ?? employeePhotos[record.employeeId] ?? null,
          hasChildren: rootHasChildren,
          collapsedStackCount: rootIsCollapsed && rootHasChildren ? (totalSubordinateCountByNodeId.get(record.employeeId) ?? 0) : 0,
          totalSubordinateCount: totalSubordinateCountByNodeId.get(record.employeeId) ?? 0,
          isCollapsed: rootIsCollapsed,
          onToggleCollapse: () => toggleCollapsed("root"),
          hideHandles,
          effectiveKatColors,
          nodeWidth,
          nodeHeight,
          fontScale,
          photoScale,
          photoFrameScale,
          photoFrameBorderWidth,
          photoOffsetX: photoOffsetX + (customPhotoOffset?.x ?? 0),
          photoOffsetY: photoOffsetY + (customPhotoOffset?.y ?? 0),
          childAccentColors: getChildAccentColors("root"),
        },
      });
    } else if (rootDisplay.type === "vacancy") {
      list.push({
        id: "root",
        type: "vacancy",
        position: rootPos,
        data: {
          vacancyId: rootDisplay.vacancy.id,
          title: rootDisplay.vacancy.title,
          isRoot: true,
          hasChildren: rootHasChildren,
          isCollapsed: rootIsCollapsed,
          onToggleCollapse: () => toggleCollapsed("root"),
          hideHandles,
        } as VacancyNodeData,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });
    } else {
      list.push({
        id: "root",
        type: "root",
        position: rootPos,
        data: {
          fullName: t("orgChart.setGMPlaceholder"),
          positionName: t("orgChart.generalManager"),
          employeeId: "",
          cellFields: appearance.cellFields,
          nodeStyle: getEffectiveNodeStyle(appearance, "root"),
          accent: rootAccent,
          hasChildren: rootHasChildren,
          isCollapsed: rootIsCollapsed,
          onToggleCollapse: () => toggleCollapsed("root"),
          hideHandles,
        } as RootNodeData,
        sourcePosition: Position.Bottom,
      });
    }

    const defaultPositions = hierarchyLayoutPositions;
    nodeIdsInTree.forEach((id) => {
      // Ak existuje manuálne uložená pozícia (drag), vždy ju použi – bez ohľadu na positionsLocked.
      // positionsLocked=false znamená len že layout môže prepočítať pri zmene hierarchie,
      // ale manuálne posunutie má prednosť.
      const pos =
        nodePositions[id]
          ?? defaultPositions.get(id)
          ?? { x: 0, y: 200 };
      if (isSectionId(id)) {
        const sec = sectionGroups.find((s) => s.id === id);
        if (!sec) return;
        const secChildren = orderedHierarchyChildren.get(sec.id) ?? [];
        // Pocet priamych clenov sekcie (len zamestnanci, nie pod-sekcie)
        const memberCount = secChildren.filter((cid) => !isSectionId(cid) && !isVacancyId(cid)).length;
        const secIndex = sectionGroups.findIndex((s) => s.id === id);
        list.push({
          id: sec.id,
          type: "section",
          position: pos,
          data: {
            sectionId: sec.id,
            name: sec.name,
            color: sec.color ?? getDefaultSectionColor(secIndex),
            icon: sec.icon,
            memberCount,
            hasChildren: secChildren.length > 0,
            isCollapsed: collapsedNodeIds.has(sec.id),
            onToggleCollapse: () => toggleCollapsed(sec.id),
            hideHandles,
            nodeWidth,
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        });
      } else if (isVacancyId(id)) {
        const vac = vacancies.find((v) => v.id === id);
        if (!vac) return;
        const vacChildren = orderedHierarchyChildren.get(vac.id) ?? [];
        list.push({
          id: vac.id,
          type: "vacancy",
          position: pos,
          data: {
            vacancyId: vac.id,
            title: vac.title,
            isRoot: false,
            hasChildren: vacChildren.length > 0,
            isCollapsed: collapsedNodeIds.has(vac.id),
            onToggleCollapse: () => toggleCollapsed(vac.id),
            hideHandles,
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        });
      } else {
        const record = rawRecords.find((r) => r.employeeId === id);
        if (!record) return;
        const levelIndex: 0 | 1 | 2 = 1;
        const accent = getNodeAccent(appearance, {
          levelIndex,
          positionType: record.positionType,
          kat: record.kat ?? undefined,
        });
        const customColor = employeeColors[record.employeeId];
        const customPhotoOffset = employeePhotoOffsets[record.employeeId];
        const resolvedAccent =
          customColor
            ? { type: "solid" as const, color: customColor }
            : appearance.colorScheme === "byPosition" && (record.kat || record.positionType)
              ? { type: "solid" as const, color: record.kat ? (effectiveKatColors[record.kat] ?? brandTokens.positionTypeColors[record.positionType]) : brandTokens.positionTypeColors[record.positionType] }
              : accent;
        const empChildren = orderedHierarchyChildren.get(record.employeeId) ?? [];
        list.push({
          id: record.employeeId,
          type: "orgNode",
          position: pos,
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          data: {
            record,
            showEmployeeId,
            showDepartment,
            cellFields: appearance.cellFields,
            nodeStyle: getEffectiveNodeStyle(appearance, "employee"),
            accent: resolvedAccent,
            levelIndex,
            photoUrl: record.photoUrl ?? employeePhotos[record.employeeId] ?? null,
            hasChildren: empChildren.length > 0,
            collapsedStackCount:
              collapsedNodeIds.has(record.employeeId) && empChildren.length > 0
                ? (totalSubordinateCountByNodeId.get(record.employeeId) ?? 0)
                : 0,
            totalSubordinateCount: totalSubordinateCountByNodeId.get(record.employeeId) ?? 0,
            isCollapsed: collapsedNodeIds.has(record.employeeId),
            onToggleCollapse: () => toggleCollapsed(record.employeeId),
            hideHandles,
            effectiveKatColors,
          nodeWidth,
          nodeHeight,
          fontScale,
          photoScale,
          photoFrameScale,
          photoFrameBorderWidth,
          photoOffsetX: photoOffsetX + (customPhotoOffset?.x ?? 0),
          photoOffsetY: photoOffsetY + (customPhotoOffset?.y ?? 0),
          childAccentColors: getChildAccentColors(record.employeeId),
          },
        });
      }
    });

    return list;
  }, [
    rawRecords,
    rootDisplay,
    vacancies,
    nodeIdsInTree,
    totalSubordinateCountByNodeId,
    hierarchyLayoutPositions,
    nodePositions,
    positionsLocked,
    showEmployeeId,
    showDepartment,
    chartAppearance,
    expansionStyle,
    employeePhotos,
    orderedHierarchyChildren,
    collapsedNodeIds,
    toggleCollapsed,
    rootHasChildren,
    rootIsCollapsed,
    employeeColors,
    employeePhotoOffsets,
    effectiveKatColors,
    t,
    nodeWidth,
    nodeHeight,
    fontScale,
    photoScale,
    photoFrameScale,
    photoFrameBorderWidth,
    photoOffsetX,
    photoOffsetY,
    sectionGroups,
  ]);

  /** Pre vybraného zamestnanca: zoznam priamych podriadených v aktuálnom poradí (pre panel „Poradie podriadených“). */
  const selectedEmployeeDirectReportOrder = useMemo((): { id: string; label: string }[] => {
    if (!selectedEmployeeId) return [];
    const childIds = orderedHierarchyChildren.get(selectedEmployeeId) ?? [];
    return childIds.map((id) => {
      if (isSectionId(id)) {
        const s = sectionGroups.find((sec) => sec.id === id);
        return { id, label: s ? `[Sekcia] ${s.name}` : id };
      }
      if (isVacancyId(id)) {
        const v = vacancies.find((vac) => vac.id === id);
        return { id, label: v ? `[Voľná] ${v.title}` : id };
      }
      const r = rawRecords.find((emp) => emp.employeeId === id);
      return { id, label: r ? r.fullName : id };
    });
  }, [selectedEmployeeId, orderedHierarchyChildren, rawRecords, vacancies, sectionGroups]);

  /** Pre vybranú vacancy: zoznam priamych podriadených v aktuálnom poradí. */
  const selectedVacancyDirectReportOrder = useMemo((): { id: string; label: string }[] => {
    if (!selectedVacancyId) return [];
    const childIds = orderedHierarchyChildren.get(selectedVacancyId) ?? [];
    return childIds.map((id) => {
      if (isVacancyId(id)) {
        const v = vacancies.find((vac) => vac.id === id);
        return { id, label: v ? `[Voľná] ${v.title}` : id };
      }
      const r = rawRecords.find((emp) => emp.employeeId === id);
      return { id, label: r ? r.fullName : id };
    });
  }, [selectedVacancyId, orderedHierarchyChildren, rawRecords, vacancies]);

  const layoutSignature = useMemo(
    () =>
      [
        [...nodeIdsInTree].sort().join(","),
        expansionStyle,
        collapsedNodeIds.size,
      ].join("|"),
    [nodeIdsInTree, expansionStyle, collapsedNodeIds.size],
  );

  /** Pri zapnutom filtri farieb: len ID uzlov, ktoré majú zobrazovať (akcent v allowed). */
  const visibleNodeIdsByColor = useMemo(() => {
    const allowed = chartAppearance.visibleCardColors;
    if (!allowed?.length) return null;
    const set = new Set<string>();
    const levelColors = chartAppearance.levelColors ?? [];
    nodes.forEach((n) => {
      const data = n.data as {
        accent?: { type: string; color?: string };
        levelIndex?: number;
      };
      const accent = data?.accent;
      let color: string | undefined =
        accent?.type === "solid" ? accent.color : undefined;
      if (color === undefined && accent?.type === "gradient" && data.levelIndex != null) {
        const pair = levelColors[data.levelIndex];
        color = pair?.[0];
      }
      if (color === undefined || allowed.includes(color)) set.add(n.id);
    });
    return set;
  }, [nodes, chartAppearance.visibleCardColors, chartAppearance.levelColors]);

  /** Uzly s nastaveným hidden podľa filtra farieb. */
  const nodesWithVisibility = useMemo(() => {
    if (!visibleNodeIdsByColor) return nodes;
    return nodes.map((n) => ({
      ...n,
      hidden: visibleNodeIdsByColor.has(n.id) ? undefined : true,
    }));
  }, [nodes, visibleNodeIdsByColor]);

  const [flowNodes, setFlowNodes] = useState<OrgFlowNode[]>(() => nodesWithVisibility);
  const isDraggingRef = useRef(false);

  /** Synchronizácia flowNodes s nodes pri každej zmene (pozície z DB, hierarchia, viditeľnosť…). */
  useEffect(() => {
    if (isDraggingRef.current) return; // neprerušovať aktívny drag
    setFlowNodes(nodesWithVisibility);
  }, [nodesWithVisibility]);

  useEffect(() => {
    nodesRef.current = flowNodes;
  }, [flowNodes]);

  const edges = useMemo((): Edge[] => {
    const list: Edge[] = [];
    /** Pri štýle bublina s „sekcie vizuálne oddelené“ nevykresľujeme prepojenia. */
    const hideEdges =
      chartAppearance.nodeStyle === "bubble" &&
      (chartAppearance.bubbleSectionsDisconnected ?? false);
    if (hideEdges) return list;

    const conn = chartAppearance.connection;
    const edgeType = EDGE_TYPE_MAP[conn.lineStyle];
    const defaultColor = conn.strokeColor ?? "#94A3B8";

    /** Mapa nodeId → accent farba (solid) pre farebné čiary podľa cieľového nodu. */
    const nodeAccentColorMap = new Map<string, string>();
    nodes.forEach((n) => {
      const d = n.data as { accent?: { type: string; color?: string } };
      if (d?.accent?.type === "solid" && d.accent.color) {
        nodeAccentColorMap.set(n.id, d.accent.color);
      }
    });

    const strokeColor = (targetId: string, branchIndex: number): string => {
      if (conn.useBranchColorOnEdges) return getBranchColor(branchIndex, chartAppearance);
      // Ak nie je nastavená manuálna farba, použi accent farbu cieľového nodu
      if (!conn.strokeColor) {
        const nodeColor = nodeAccentColorMap.get(targetId);
        if (nodeColor) return nodeColor;
      }
      return defaultColor;
    };
    const markerEnd = (color: string) =>
      conn.marker === "none"
        ? undefined
        : conn.marker === "arrow"
          ? { type: MarkerType.Arrow, color }
          : { type: MarkerType.ArrowClosed, color };
    /** Vždy používame vlastnú TreeBranchEdge (správna L-čiara: dole → vodorovne → dole). */
    const useSimpleBranchLines = true;

    const defaultRootPos =
      expansionStyle === "horizontal"
        ? { x: 80, y: 360 - nodeHeight / 2 }
        : { x: 520 - nodeWidth / 2, y: ROOT_Y };
    const getNodePosition = (id: string) => {
      if (id === "root") return nodePositions["root"] ?? defaultRootPos;
      return nodePositions[id] ?? hierarchyLayoutPositions.get(id) ?? { x: 0, y: 0 };
    };
    const getChildLayoutStyle = (parentId: string): ChildLayoutStyle | undefined =>
      parentId === "root"
        ? (childLayoutByNodeId[effectiveRootId ?? ""] ?? "row")
        : (childLayoutByNodeId[parentId] ?? "row");
    const shouldUseTreeBranchLines = (parentId: string, childCount: number) => {
      if (childCount === 0) return false;
      const style = getChildLayoutStyle(parentId);
      return style === "pairs" || style === "fours";
    };
    const getRowSize = (parentId: string) =>
      getChildLayoutStyle(parentId) === "pairs" ? 2 : 4;
    const getFirstInRowIndex = (idx: number, rowSize: number) =>
      Math.floor(idx / rowSize) * rowSize;

    type TreeBranchData = { branchY: number; connectToCenter?: boolean; nodeHeight?: number; targetDotColor?: string };
    const pushEdge = (
      parentId: string,
      childId: string,
      idx: number,
      sourceHandle: string,
      targetHandle: string,
      branchData?: TreeBranchData | null,
    ) => {
      const color = strokeColor(childId, idx);
      // Dot farba = accent farba cieľového nodu (ak existuje), inak farba čiary
      const dotColor = nodeAccentColorMap.get(childId) ?? color;
      const base = {
        source: parentId,
        target: childId,
        sourceHandle,
        targetHandle,
        markerEnd: markerEnd(color),
        style: { stroke: color, strokeWidth: conn.strokeWidth },
      };
      // Vždy treeBranch renderer – správna L-čiara + farebný dot na križovatke
      list.push({
        ...base,
        id: `${parentId}->${childId}`,
        type: "treeBranch",
        data: { ...(branchData ?? {}), rounded: conn.lineStyle === "smoothstep", targetDotColor: dotColor },
      });
    };

    const visibleIds = visibleNodeIdsByColor;
    const skipEdge = (source: string, target: string) =>
      visibleIds !== null && (!visibleIds.has(source) || !visibleIds.has(target));

    const rootKids = getChildrenForLayout("root");
    const rootUseTreeBranch = shouldUseTreeBranchLines("root", rootKids.length);
    const rootRowSize = getRowSize("root");
    const pairsRowGap = layoutRowGap / 2;
    rootKids.forEach((childId, idx) => {
      if (skipEdge("root", childId)) return;
      const branchData: TreeBranchData | null = rootUseTreeBranch
        ? {
            branchY:
              getNodePosition(rootKids[getFirstInRowIndex(idx, rootRowSize)]).y - pairsRowGap,
            connectToCenter: false,
          }
        : null;
      pushEdge(
        "root",
        childId,
        idx,
        "bottom",
        isVacancyId(childId) ? vacancyHandleIds.target : isSectionId(childId) ? sectionHandleIds.target : TARGET_HANDLE_ID,
        branchData,
      );
    });

    nodeIdsInTree.forEach((parentId) => {
      const children = getChildrenForLayout(parentId);
      const sourceHandle = isVacancyId(parentId) ? vacancyHandleIds.source : isSectionId(parentId) ? sectionHandleIds.source : SOURCE_HANDLE_ID;
      const useTreeBranch = shouldUseTreeBranchLines(parentId, children.length);
      const rowSize = getRowSize(parentId);
      children.forEach((childId, idx) => {
        if (skipEdge(parentId, childId)) return;
        const branchData: TreeBranchData | null = useTreeBranch
          ? {
              branchY:
                getNodePosition(children[getFirstInRowIndex(idx, rowSize)]).y - pairsRowGap,
              connectToCenter: false,
            }
          : null;
        pushEdge(
          parentId,
          childId,
          idx,
          sourceHandle,
          isVacancyId(childId) ? vacancyHandleIds.target : isSectionId(childId) ? sectionHandleIds.target : TARGET_HANDLE_ID,
          branchData,
        );
      });
    });

    return list;
  }, [
    getChildrenForLayout,
    nodeIdsInTree,
    chartAppearance,
    hierarchyLayoutPositions,
    nodePositions,
    childLayoutByNodeId,
    effectiveRootId,
    expansionStyle,
    layoutRowGap,
    visibleNodeIdsByColor,
    nodeWidth,
    nodeHeight,
    nodes,
  ]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Sledovanie či práve prebieha drag
      const hasDragging = changes.some((c) => c.type === "position" && (c as { dragging?: boolean }).dragging === true);
      const hasDragEnd = changes.some((c) => c.type === "position" && (c as { dragging?: boolean }).dragging === false);
      if (hasDragging) isDraggingRef.current = true;
      if (hasDragEnd) isDraggingRef.current = false;

      setFlowNodes((prev) => applyNodeChanges(changes, prev) as OrgFlowNode[]);
      if (positionsLocked) return;
      let changed = false;
      const positionUpdates: Record<string, { x: number; y: number }> = {};
      changes.forEach((change) => {
        if (change.type === "position") {
          const c = change as { id?: string; position?: { x: number; y: number }; positionAbsolute?: { x: number; y: number } };
          const pos = c.position ?? c.positionAbsolute;
          const id = c.id;
          if (id && pos) {
            positionUpdates[id] = pos;
            changed = true;
          }
        }
      });
      if (changed) {
        setNodePositions((prev) => {
          const next = { ...prev, ...positionUpdates };
          if (hasDragEnd) {
            const cb = onSettingsChangeRef.current;
            if (cb) queueMicrotask(() => cb({ positions: next }));
            else savePositions(next);
          }
          return next;
        });
      }
    },
    [positionsLocked],
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (positionsLocked) return;
      setNodePositions((prev) => {
        const next = { ...prev, [node.id]: node.position };
        const cb = onSettingsChangeRef.current;
        if (cb) queueMicrotask(() => cb({ positions: next }));
        else savePositions(next);
        return next;
      });
    },
    [positionsLocked],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !onRecordsChange) return;
      const source = connection.source;
      const target = connection.target;
      if (source === "root" || target === "root") return;
      const targetRecord = rawRecords.find((r) => r.employeeId === target);
      if (!targetRecord) return;
      const updated = rawRecords.map((r) =>
        r.employeeId === target ? { ...r, managerEmployeeId: source } : r,
      );
      onRecordsChange(updated);
    },
    [rawRecords, onRecordsChange],
  );

  const nodeTypes = useMemo(
    () => ({
      root: RootNode,
      vacancy: VacancyNode,
      section: SectionNode,
      orgNode: OrgNode,
    }),
    [],
  );

  const edgeTypes = useMemo(
    () => ({ treeBranch: TreeBranchEdge }),
    [],
  );

  const togglePositionsLocked = useCallback(() => {
    setPositionsLocked((prev) => {
      const next = !prev;
      const cb = onSettingsChangeRef.current;
      if (cb) queueMicrotask(() => cb({ positionsLocked: next }));
      else savePositionsLocked(next);
      return next;
    });
  }, []);

  /** Export každého oddelenia ako samostatná strana do jedného PDF. */
  const downloadAllDepartmentsPdf = useCallback(async () => {
    const container = chartContainerRef.current;
    const rfInstance = reactFlowInstanceRef.current;
    if (!container || !rfInstance) return;
    setIsExportingAllPdf(true);

    const hexOverrides = `
      :root {
        --color-slate-50: #f8fafc; --color-slate-100: #f1f5f9; --color-slate-200: #e2e8f0;
        --color-slate-300: #cbd5e1; --color-slate-400: #94a3b8; --color-slate-500: #64748b;
        --color-slate-600: #475569; --color-slate-700: #334155; --color-slate-800: #1e293b;
        --color-slate-900: #0f172a; --color-red-50: #fef2f2; --color-red-700: #b91c1c;
        --color-amber-50: #fffbeb; --color-amber-400: #fbbf24; --color-amber-600: #d97706;
      }
    `;
    const styleId = "pdf-export-lab-override";
    let overlay: HTMLStyleElement | null = null;
    const stripUnsupportedColors = (text: string): string =>
      text.replace(/lab\([^)]*\)/g, "rgb(248, 250, 252)").replace(/oklch\([^)]*\)/g, "rgb(248, 250, 252)");
    const restored: { el: HTMLStyleElement; content: string }[] = [];
    const prevDept = selectedDepartment;
    const prevViewport = typeof rfInstance.getViewport === "function" ? rfInstance.getViewport() : null;

    // Zisti oddelenia ktoré majú nastaveného manažéra (iba tieto má zmysel exportovať)
    const { MAIN_DEPARTMENTS: deps } = await import("@/lib/org/departments");
    const exportableDepts = ["all", ...deps.filter((d) => departmentManagers[d])];

    try {
      document.querySelectorAll("style").forEach((el) => {
        if (el.id === styleId) return;
        const raw = el.textContent ?? "";
        if (raw.includes("lab(") || raw.includes("oklch(")) {
          restored.push({ el: el as HTMLStyleElement, content: raw });
          el.textContent = stripUnsupportedColors(raw);
        }
      });
      overlay = document.createElement("style");
      overlay.id = styleId;
      overlay.textContent = hexOverrides;
      document.head.appendChild(overlay);

      const { toCanvas } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");
      const exportBackground = "#f8fafc";

      const captureCurrentView = async (): Promise<HTMLCanvasElement> => {
        // maxZoom: 0.8 zabraňuje aby malé oddelenia (2-3 ľudia) boli príliš priblížené
        rfInstance.fitView({ padding: 0.08, duration: 0 });
        await new Promise((r) => setTimeout(r, 180));
        const hideForExport = container.querySelectorAll(".react-flow__controls, .react-flow__minimap");
        const hiddenEls: { el: Element; prev: string }[] = [];
        hideForExport.forEach((el) => {
          hiddenEls.push({ el, prev: (el as HTMLElement).style.visibility });
          (el as HTMLElement).style.visibility = "hidden";
        });
        await new Promise((r) => requestAnimationFrame(r));
        const canvas = await toCanvas(container, {
          pixelRatio: 3,
          cacheBust: true,
          backgroundColor: exportBackground,
          skipFonts: false,
          filter: (node) => {
            const el = node as HTMLElement;
            return !el.classList?.contains("react-flow__controls") && !el.classList?.contains("react-flow__minimap");
          },
        });
        hiddenEls.forEach(({ el, prev }) => { (el as HTMLElement).style.visibility = prev; });
        return canvas;
      };

      const cropCanvas = (source: HTMLCanvasElement): HTMLCanvasElement => {
        const ctx = source.getContext("2d");
        if (!ctx) return source;
        const { width, height } = source;
        const pixels = ctx.getImageData(0, 0, width, height).data;
        const bg = { r: 248, g: 250, b: 252 }; const tol = 12;
        let minX = width, minY = height, maxX = -1, maxY = -1;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (pixels[i+3] > 8 && (Math.abs(pixels[i]-bg.r)>tol || Math.abs(pixels[i+1]-bg.g)>tol || Math.abs(pixels[i+2]-bg.b)>tol)) {
            if (x < minX) minX=x; if (y < minY) minY=y; if (x > maxX) maxX=x; if (y > maxY) maxY=y;
          }
        }
        if (maxX < minX || maxY < minY) return source;
        const pad=16, cx=Math.max(0,minX-pad), cy=Math.max(0,minY-pad);
        const cw=Math.min(width-cx,maxX-minX+1+pad*2), ch=Math.min(height-cy,maxY-minY+1+pad*2);
        if (cw<=0||ch<=0) return source;
        const out=document.createElement("canvas"); out.width=cw; out.height=ch;
        const oc=out.getContext("2d"); if (!oc) return source;
        oc.fillStyle=exportBackground; oc.fillRect(0,0,cw,ch);
        oc.drawImage(source,cx,cy,cw,ch,0,0,cw,ch);
        return out;
      };

      // Prvá strana určí orientáciu PDF (landscape / portrait)
      // Pre všetky strany použijeme A4 landscape (orgcharts sú včšinou širšie)
      let doc: InstanceType<typeof jsPDF> | null = null;
      let firstPage = true;

      for (const dept of exportableDepts) {
        // Prepni oddelenie
        onSelectDepartmentRef.current(dept);
        // Počkaj kým sa ReactFlow prerenderi
        await new Promise((r) => setTimeout(r, 220));

        const raw = await captureCurrentView();
        const cropped = cropCanvas(raw);

        const isLandscape = cropped.width >= cropped.height;
        if (firstPage) {
          doc = new jsPDF({ orientation: isLandscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
          firstPage = false;
        } else {
          doc!.addPage("a4", isLandscape ? "landscape" : "portrait");
        }

        const pageW = doc!.internal.pageSize.getWidth();
        const pageH = doc!.internal.pageSize.getHeight();
        const margin = 4;
        const scale = Math.min((pageW - margin*2) / cropped.width, (pageH - margin*2) / cropped.height);
        const imgW = cropped.width * scale;
        const imgH = cropped.height * scale;
        const imgX = (pageW - imgW) / 2;
        const imgY = (pageH - imgH) / 2;
        const imgData = cropped.toDataURL("image/png");
        doc!.addImage(imgData, "PNG", imgX, imgY, imgW, imgH);

        // Pridaj názov oddelenia ako text (malý, vpravo hore)
        const label = dept === "all" ? "Cela struktura" : dept;
        doc!.setFontSize(7);
        doc!.setTextColor(150);
        doc!.text(label, pageW - margin, margin + 2, { align: "right" });
      }

      if (doc) doc.save("organigram-vsetky-oddelenia.pdf");

    } catch (err) {
      console.error("All-departments PDF export failed:", err);
    } finally {
      overlay?.remove();
      restored.forEach(({ el, content }) => { el.textContent = content; });
      // Obnov pôvodné oddelenie a viewport
      onSelectDepartmentRef.current(prevDept);
      await new Promise((r) => setTimeout(r, 100));
      if (prevViewport && typeof rfInstance.setViewport === "function") {
        rfInstance.setViewport(prevViewport, { duration: 0 });
      }
      setIsExportingAllPdf(false);
    }
  }, [departmentManagers, selectedDepartment]);

  const downloadChartAsPdf = useCallback(async () => {
    const container = chartContainerRef.current;
    const rfInstance = reactFlowInstanceRef.current;
    if (!container || !rfInstance) return;
    setIsExportingPdf(true);

    // Farby overrides pre html-to-image (oklch/lab nie sú podporované)
    const hexOverrides = `
      :root {
        --color-slate-50: #f8fafc; --color-slate-100: #f1f5f9; --color-slate-200: #e2e8f0;
        --color-slate-300: #cbd5e1; --color-slate-400: #94a3b8; --color-slate-500: #64748b;
        --color-slate-600: #475569; --color-slate-700: #334155; --color-slate-800: #1e293b;
        --color-slate-900: #0f172a; --color-red-50: #fef2f2; --color-red-700: #b91c1c;
        --color-amber-50: #fffbeb; --color-amber-400: #fbbf24; --color-amber-600: #d97706;
      }
    `;
    const styleId = "pdf-export-lab-override";
    let overlay: HTMLStyleElement | null = null;
    const stripUnsupportedColors = (text: string): string =>
      text.replace(/lab\([^)]*\)/g, "rgb(248, 250, 252)").replace(/oklch\([^)]*\)/g, "rgb(248, 250, 252)");
    const restored: { el: HTMLStyleElement; content: string }[] = [];

    // Ulož aktuálny viewport a nastav fitView pre celý graf
    const prevViewport = typeof rfInstance.getViewport === "function" ? rfInstance.getViewport() : null;

    try {
      // 1. Stripuj nekompatibilné farby
      document.querySelectorAll("style").forEach((el) => {
        if (el.id === styleId) return;
        const raw = el.textContent ?? "";
        if (raw.includes("lab(") || raw.includes("oklch(")) {
          restored.push({ el: el as HTMLStyleElement, content: raw });
          el.textContent = stripUnsupportedColors(raw);
        }
      });
      overlay = document.createElement("style");
      overlay.id = styleId;
      overlay.textContent = hexOverrides;
      document.head.appendChild(overlay);

      // 2. FitView – zobrazí celý orgchart
      rfInstance.fitView({ padding: 0.08, duration: 0 });
      // Počkaj kým sa viewport usadí
      await new Promise((r) => setTimeout(r, 120));

      // 3. Skry UI elementy ktoré nemajú byť v PDF (controls, header, side panel)
      const hideForExport = container.querySelectorAll(
        ".react-flow__controls, .react-flow__minimap, .react-flow__background"
      );
      const hiddenEls: { el: Element; prev: string }[] = [];
      hideForExport.forEach((el) => {
        hiddenEls.push({ el, prev: (el as HTMLElement).style.visibility });
        (el as HTMLElement).style.visibility = "hidden";
      });

      await new Promise((r) => requestAnimationFrame(r));

      // 4. Render do canvasu – pixelRatio 3 = ostrý text aj na retina displejoch
      const { toCanvas } = await import("html-to-image");
      const exportBackground = "#f8fafc";
      const canvas = await toCanvas(container, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: exportBackground,
        skipFonts: false,
        filter: (node) => {
          const el = node as HTMLElement;
          // Vylúč UI ovládacie prvky a sidepanel
          return (
            !el.classList?.contains("react-flow__controls") &&
            !el.classList?.contains("react-flow__minimap")
          );
        },
      });

      // Obnov skryté elementy
      hiddenEls.forEach(({ el, prev }) => { (el as HTMLElement).style.visibility = prev; });

      // 5. Orež prázdny okraj (background farba)
      const cropCanvasToContent = (source: HTMLCanvasElement): HTMLCanvasElement => {
        const ctx = source.getContext("2d");
        if (!ctx) return source;
        const { width, height } = source;
        const image = ctx.getImageData(0, 0, width, height);
        const pixels = image.data;
        const bg = { r: 248, g: 250, b: 252 };
        const tol = 12;
        let minX = width, minY = height, maxX = -1, maxY = -1;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (
              pixels[i + 3] > 8 &&
              (Math.abs(pixels[i] - bg.r) > tol || Math.abs(pixels[i+1] - bg.g) > tol || Math.abs(pixels[i+2] - bg.b) > tol)
            ) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < minX || maxY < minY) return source;
        const pad = 16;
        const cx = Math.max(0, minX - pad);
        const cy = Math.max(0, minY - pad);
        const cw = Math.min(width - cx, maxX - minX + 1 + pad * 2);
        const ch = Math.min(height - cy, maxY - minY + 1 + pad * 2);
        if (cw <= 0 || ch <= 0) return source;
        const cropped = document.createElement("canvas");
        cropped.width = cw; cropped.height = ch;
        const cc = cropped.getContext("2d");
        if (!cc) return source;
        cc.fillStyle = exportBackground;
        cc.fillRect(0, 0, cw, ch);
        cc.drawImage(source, cx, cy, cw, ch, 0, 0, cw, ch);
        return cropped;
      };

      const croppedCanvas = cropCanvasToContent(canvas);

      // 6. Zostav PDF – orientácia podľa pomeru strán, využi celú plochu A4
      const { jsPDF } = await import("jspdf");
      const isLandscape = croppedCanvas.width > croppedCanvas.height;
      const doc = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 4; // mm – minimálny okraj
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      // Vždy vyplň celú stranu (zachovaj pomer)
      const scale = Math.min(availW / croppedCanvas.width, availH / croppedCanvas.height);
      const imgW = croppedCanvas.width * scale;
      const imgH = croppedCanvas.height * scale;
      const imgX = (pageW - imgW) / 2;
      const imgY = (pageH - imgH) / 2;
      // PNG = ostrejší text (žiadna JPEG kompresia na hranách písma)
      const imgData = croppedCanvas.toDataURL("image/png");
      doc.addImage(imgData, "PNG", imgX, imgY, imgW, imgH);
      doc.save("organigram.pdf");

    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      overlay?.remove();
      restored.forEach(({ el, content }) => { el.textContent = content; });
      // Obnov pôvodný viewport
      if (prevViewport && typeof rfInstance.setViewport === "function") {
        rfInstance.setViewport(prevViewport, { duration: 0 });
      }
      setIsExportingPdf(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{t("orgChart.displayControls")}</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={positionsLocked}
              onChange={togglePositionsLocked}
              className="rounded border-slate-300"
            />
            {t("orgChart.lockPositions")}
          </label>
          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              showGrid
                ? "border-[var(--artifex-navy)] bg-[var(--artifex-navy)] text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            title={showGrid ? t("orgChart.gridHide") : t("orgChart.gridShow")}
          >
            {showGrid ? t("orgChart.gridOff") : t("orgChart.gridOn")}
          </button>
          <button
            type="button"
            disabled={isExportingPdf}
            onClick={downloadChartAsPdf}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            title={t("orgChart.downloadPdfTitle")}
          >
            {isExportingPdf ? t("orgChart.preparingPdf") : t("orgChart.downloadPdf")}
          </button>
          <button
            type="button"
            onClick={() => {
              const instance = reactFlowInstanceRef.current;
              const viewport = typeof instance?.getViewport === "function" ? instance.getViewport() : undefined;
              const state: ShareableViewState = {
                ...(viewport && { viewport }),
                collapsedNodes: collapsedNodeIds.size > 0 ? [...collapsedNodeIds] : undefined,
              };
              const path = typeof window !== "undefined" ? window.location.pathname : "/org-chart";
              const url = buildShareUrl(path, state);
              const fullUrl = typeof window !== "undefined" ? window.location.origin + url : url;
              void navigator.clipboard?.writeText(fullUrl).then(() => {
                setShareLinkCopied(true);
                window.setTimeout(() => setShareLinkCopied(false), 2000);
              });
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            title={t("orgChart.copyLinkTitle")}
          >
            {shareLinkCopied ? t("orgChart.linkCopied") : t("orgChart.copyLink")}
          </button>
          {showGrid && (
            <button
              type="button"
              onClick={() => setShowGridSettingsPanel((v) => !v)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                showGridSettingsPanel
                  ? "border-slate-400 bg-slate-100 text-slate-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              title={t("orgChart.gridSettings")}
            >
              {t("orgChart.gridSettings")}
            </button>
          )}
          <button
            type="button"
            onClick={handleShowRootOnly}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            title={t("orgChart.collapseAllTitle")}
          >
            {t("orgChart.showRoot")}
          </button>
          <button
            type="button"
            onClick={() => {
              setCollapsedNodeIds(() => new Set());
              requestAnimationFrame(() => {
                reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 300 });
              });
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            title="Rozbaľ všetky vetvy"
          >
            Rozbaľ všetko
          </button>
          {onSettingsChange && (
            <button
              type="button"
              onClick={() => {
                const id = generateSectionId();
                const newSection: SectionGroup = {
                  id,
                  name: "Nová sekcia",
                  parentId: effectiveRootId ?? null,
                  color: getDefaultSectionColor(sectionGroups.length),
                };
                setSectionGroups([...sectionGroups, newSection]);
                setSelectedSectionId(id);
                setSelectedEmployeeId(null);
                setSelectedVacancyId(null);
                setRightPanelCollapsedAndSave(false);
              }}
              className="rounded-lg border border-[#949C58] bg-[#949C58]/10 px-3 py-2 text-xs font-semibold text-[#949C58] hover:bg-[#949C58]/20 transition-colors"
              title="Pridať novú sekciu / skupinu"
            >
              + Sekcia
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCellSettings((v) => !v)}
            className="rounded-lg bg-[var(--artifex-navy)] px-3 py-2 text-xs font-semibold text-white"
          >
            {showCellSettings ? t("orgChart.closeCellSettings") : t("orgChart.cellSettings")}
          </button>
        </div>
      </div>

      {showGrid && showGridSettingsPanel && (
        <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">{t("orgChart.gridTechnicalDetails")}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t("orgChart.gridGapPx")}</label>
              <input
                type="number"
                min={GRID_GAP_MIN}
                max={GRID_GAP_MAX}
                step={4}
                value={gridSettings.gap}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) setGridSettings((s) => ({ ...s, gap: Math.max(GRID_GAP_MIN, Math.min(GRID_GAP_MAX, v)) }));
                }}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <p className="mt-0.5 text-[10px] text-slate-500">{GRID_GAP_MIN}–{GRID_GAP_MAX} px</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">{t("orgChart.lineThickness")}</label>
              <input
                type="number"
                min={GRID_LINE_WIDTH_MIN}
                max={GRID_LINE_WIDTH_MAX}
                step={0.25}
                value={gridSettings.lineWidth}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) setGridSettings((s) => ({ ...s, lineWidth: Math.max(GRID_LINE_WIDTH_MIN, Math.min(GRID_LINE_WIDTH_MAX, v)) }));
                }}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <p className="mt-0.5 text-[10px] text-slate-500">{GRID_LINE_WIDTH_MIN}–{GRID_LINE_WIDTH_MAX}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Farba</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={gridSettings.color}
                  onChange={(e) => setGridSettings((s) => ({ ...s, color: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border border-slate-300"
                />
                <input
                  type="text"
                  value={gridSettings.color}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) setGridSettings((s) => ({ ...s, color: v }));
                  }}
                  className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Tvar mriežky</label>
              <select
                value={gridSettings.variant}
                onChange={(e) => setGridSettings((s) => ({ ...s, variant: e.target.value as "lines" | "cross" }))}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="lines">Čiary (lines)</option>
                <option value="cross">Krížiky (cross)</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGridSettings({ gap: DEFAULT_GRID_GAP, lineWidth: DEFAULT_GRID_LINE_WIDTH, color: DEFAULT_GRID_COLOR, variant: "lines" })}
            className="mt-3 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Obnoviť východzie
          </button>
        </section>
      )}

      {allowEdit && (
        <p className="text-xs text-slate-500">
          Priradenie nadriadeného: ťahajte od spodku karty nadriadeného na horný okraj karty podriadeného. Pod voľnú pozíciu (vacancy) môžete napájať zamestnancov.
        </p>
      )}

      {showCellSettings && (
        <div className="space-y-4">
          <ChartAppearanceControls
            appearance={chartAppearance}
            onAppearanceChange={setChartAppearance}
            filterColorOptions={filterColorOptions}
          />
          {allowEdit &&
            onSettingsChange &&
            chartAppearance.colorScheme === "byPosition" && (
              <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <button
                  type="button"
                  onClick={() => setShowKatColorsSettings((v) => !v)}
                  className="flex w-full items-center justify-between text-left"
                  aria-expanded={showKatColorsSettings}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Farby kategórií (KAT)
                  </span>
                  <span className="text-slate-400">{showKatColorsSettings ? "▼" : "▶"}</span>
                </button>
                {showKatColorsSettings && (
                  <>
                    <p className="mb-3 mt-2 text-xs text-slate-600">
                      Jednotná farba pre všetky bunky danej kategórie (SAL, INDIR1, INDIR2, INDIR3).
                    </p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSettingsChange({
                            katColors: {
                              SAL: brandTokens.katColors.SAL,
                              INDIR1: brandTokens.katColors.INDIR1,
                              INDIR2: brandTokens.katColors.INDIR2,
                              INDIR3: brandTokens.katColors.INDIR3,
                            },
                          });
                        }}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Použiť Artifex KAT
                      </button>
                      <button
                        type="button"
                        onClick={() => onSettingsChange({ katColors: undefined })}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Zrušiť KAT prepis
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(["SAL", "INDIR1", "INDIR2", "INDIR3"] as const).map((katKey) => {
                        const currentHex =
                          effectiveKatColors[katKey] ??
                          (brandTokens.katColors as Record<string, string>)[katKey] ??
                          "#64748b";
                        return (
                          <div key={katKey} className="flex items-center gap-2">
                            <span className="w-14 shrink-0 text-sm font-medium text-slate-700">{katKey}</span>
                            <input
                              type="color"
                              value={currentHex}
                              onChange={(e) => {
                                const next = {
                                  ...(initialSettings?.katColors ?? {}),
                                  [katKey]: e.target.value,
                                };
                                onSettingsChange({ katColors: next });
                              }}
                              className="h-9 w-14 cursor-pointer rounded border border-slate-300"
                            />
                            <input
                              type="text"
                              value={currentHex}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
                                  onSettingsChange({
                                    katColors: {
                                      ...(initialSettings?.katColors ?? {}),
                                      [katKey]: v,
                                    },
                                  });
                                }
                              }}
                              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = { ...(initialSettings?.katColors ?? {}) };
                                delete next[katKey];
                                onSettingsChange({ katColors: Object.keys(next).length ? next : undefined });
                              }}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                              title={t("orgChart.resetColor")}
                            >
                              Obnoviť
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            )}
        </div>
      )}

      <DepartmentBar
        selectedDepartment={selectedDepartment}
        onSelectDepartment={setSelectedDepartment}
        departmentManagers={departmentManagers}
        onDepartmentManagerChange={handleSetDepartmentManager}
        employees={rawRecords}
        allowEdit={allowEdit && onSettingsChange != null}
        onExportAllDepartmentsPdf={downloadAllDepartmentsPdf}
        isExportingAllPdf={isExportingAllPdf}
      />

      <div className="flex items-stretch gap-4">
        <HierarchySidebar
          generalManagerId={generalManagerId}
          onGeneralManagerChange={setGeneralManagerId}
          employees={rawRecords}
          vacancies={vacancies}
          maxVisibleLayers={maxVisibleLayers}
          onMaxVisibleLayersChange={setMaxVisibleLayers}
          expansionStyle={chartAppearance.expansionStyle ?? "tree"}
          onExpansionStyleChange={(style) =>
            setChartAppearance({ ...chartAppearance, expansionStyle: style })
          }
          onAddVacancy={(title, parentId) => {
            const id = generateVacancyId();
            const v: VacancyPlaceholder = { id, title, parentId };
            persistAddVacancy(v);
            setVacancies([...vacancies, v]);
          }}
          onResetTemplate={async () => {
            if (onResetToDefaults) await onResetToDefaults();
            resetOrgChartToTemplate();
            window.location.reload();
          }}
          contentHeight="72vh"
        />
        <div
          ref={chartContainerRef}
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc]"
          style={{ height: "72vh" }}
        >
          <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-b border-slate-200 bg-white px-4 py-2">
            <img
              src="/artifex-logo.png"
              alt="Artifex"
              className="h-8 w-auto object-contain"
              width={96}
              height={32}
            />
            <span
              className="text-sm font-semibold tracking-wide text-[#21394F]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Artifex Systems Slovakia
            </span>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
          <ReactFlow
            onInit={(instance) => {
              reactFlowInstanceRef.current = instance;
              const viewFromUrl = initialShareableViewStateRef.current?.viewport;
              if (viewFromUrl && typeof (instance as { setViewport?: (v: { x: number; y: number; zoom: number }, o?: { duration?: number }) => void }).setViewport === "function") {
                (instance as { setViewport: (v: { x: number; y: number; zoom: number }, o?: { duration?: number }) => void }).setViewport(viewFromUrl, { duration: 0 });
              }
            }}
            nodes={flowNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={(_, node) => {
              if (node.type === "section") {
                const data = node.data as SectionNodeData;
                setSelectedSectionId(data.sectionId);
                setSelectedEmployeeId(null);
                setSelectedVacancyId(null);
                setRightPanelCollapsedAndSave(false);
              } else if (node.type === "vacancy") {
                const data = node.data as VacancyNodeData;
                setSelectedVacancyId(data.vacancyId);
                setSelectedEmployeeId(null);
                setSelectedSectionId(null);
                setRightPanelCollapsedAndSave(false);
              } else if (node.type === "orgNode") {
                const data = node.data as OrgNodeData;
                setSelectedEmployeeId(data.record.employeeId);
                setSelectedVacancyId(null);
                setSelectedSectionId(null);
                setRightPanelCollapsedAndSave(false);
              } else if (node.type === "root") {
                setSelectedEmployeeId(null);
                setSelectedVacancyId(null);
                setSelectedSectionId(null);
              } else {
                setSelectedEmployeeId(null);
                setSelectedVacancyId(null);
                setSelectedSectionId(null);
              }
            }}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={allowEdit ? onConnect : undefined}
            nodesConnectable={allowEdit}
            nodesDraggable={!positionsLocked}
            nodeDragThreshold={0}
            noDragClassName="nodrag"
            noPanClassName="nopan"
            connectionLineStyle={{ stroke: "#21394F", strokeWidth: 2 }}
            elementsSelectable
            panOnDrag={true}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.05}
            maxZoom={1.5}
          >
            <Background color="#d1d5db" gap={24} />
            {showGrid && (
              <Background
                id="alignment-grid"
                variant={gridSettings.variant === "cross" ? BackgroundVariant.Cross : BackgroundVariant.Lines}
                gap={gridSettings.gap}
                color={gridSettings.color}
                lineWidth={gridSettings.lineWidth}
              />
            )}
            <Controls />
          </ReactFlow>
          </div>
        </div>

        {rightPanelCollapsed ? (
          <aside
            className="flex w-12 shrink-0 flex-col items-center justify-start rounded-2xl border border-slate-200 bg-white pt-4 shadow-sm"
            style={{ height: "72vh" }}
          >
            <button
              type="button"
              onClick={() => setRightPanelCollapsedAndSave(false)}
              className="flex flex-col items-center gap-1 rounded px-1.5 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
              title={t("orgChart.expandDetail")}
              aria-label={t("orgChart.expandDetail")}
            >
              <span className="text-lg leading-none">☰</span>
              <span className="text-[10px] leading-tight text-center">Detail</span>
            </button>
          </aside>
        ) : (
          <aside className="flex h-[72vh] w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-800">{t("orgChart.detailPanel")}</h3>
              <button
                type="button"
                onClick={() => setRightPanelCollapsedAndSave(true)}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title={t("common.collapse")}
                aria-label={t("common.collapse")}
              >
                ▶
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {/* ===== SEKCIA DETAIL ===== */}
              {selectedSectionId ? (() => {
                const sec = sectionGroups.find((s) => s.id === selectedSectionId);
                if (!sec) { setSelectedSectionId(null); return null; }
                const secIndex = sectionGroups.findIndex((s) => s.id === selectedSectionId);
                const color = sec.color ?? getDefaultSectionColor(secIndex);
                // Clenovia = zamestnanci ktori maju section override v sectionMembers state
                const members = rawRecords.filter((r) =>
                  sectionMembers.some((m) => m.employee_id === r.employeeId && m.section_id === sec.id)
                );
                // Pridatelni = zamestnanci pod rovnakym nadriadenim, ktori nie su v tejto sekcii
                const addable = sec.parentId
                  ? rawRecords.filter((r) => {
                      const override = sectionMembers.find((m) => m.employee_id === r.employeeId);
                      const effectiveManager = override ? override.section_id : r.managerEmployeeId;
                      return effectiveManager === sec.parentId;
                    })
                  : [];
                const COLORS = ["#21394F","#949C58","#F06909","#2563EB","#7C3AED","#059669","#DC2626","#0891B2"];
                const secChildLayout = (childLayoutByNodeId[sec.id] ?? "row") as "row" | "pairs" | "fours";
                return (
                  <div className="flex h-full flex-col overflow-hidden">
                    {/* Farebny header */}
                    <div className="shrink-0 px-4 pt-3 pb-2" style={{ borderBottom: `2px solid ${color}` }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {sec.icon && <span className="text-xl">{sec.icon}</span>}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>Sekcia</p>
                            <p className="text-sm font-bold text-slate-900 leading-tight">{sec.name}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setSelectedSectionId(null)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {members.length} {members.length === 1 ? "zamestnanec" : members.length < 5 ? "zamestnanci" : "zamestnancov"}
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

                      {/* Nazov */}
                      {onSettingsChange ? (
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Názov sekcie</label>
                          <input key={sec.id + "-n"} type="text" defaultValue={sec.name}
                            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== sec.name) setSectionGroups(sectionGroups.map((s) => s.id === sec.id ? { ...s, name: v } : s)); }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400" />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Názov</label>
                          <p className="text-sm font-semibold" style={{ color }}>{sec.name}</p>
                        </div>
                      )}

                      {/* Ikona */}
                      {onSettingsChange && (
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Emoji ikona</label>
                          <input key={sec.id + "-i"} type="text" defaultValue={sec.icon ?? ""} placeholder="🏭 ⚙️ 📦 🔧"
                            onBlur={(e) => { const v = e.target.value.trim() || undefined; setSectionGroups(sectionGroups.map((s) => s.id === sec.id ? { ...s, icon: v } : s)); }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400" />
                        </div>
                      )}

                      {/* Farba */}
                      {onSettingsChange && (
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Farba sekcie</label>
                          <div className="flex flex-wrap gap-2">
                            {COLORS.map((c) => (
                              <button key={c} type="button"
                                onClick={() => setSectionGroups(sectionGroups.map((s) => s.id === sec.id ? { ...s, color: c } : s))}
                                className="h-7 w-7 rounded-full transition-all hover:scale-110"
                                style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none", transform: color === c ? "scale(1.15)" : undefined }} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Nadriadeny */}
                      {onSettingsChange && (
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Nadriadený sekcie</label>
                          <select key={sec.id + "-p"} value={sec.parentId ?? ""}
                            onChange={(e) => setSectionGroups(sectionGroups.map((s) => s.id === sec.id ? { ...s, parentId: e.target.value || null } : s))}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none">
                            <option value="">— bez nadriadeného —</option>
                            {rawRecords.map((r) => <option key={r.employeeId} value={r.employeeId}>{r.fullName}</option>)}
                          </select>
                        </div>
                      )}

                      {/* Zobrazovanie podriadených */}
                      {onSettingsChange && (
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Zobrazovanie podriadených</label>
                          <div className="flex gap-2">
                            {(["row", "pairs", "fours"] as const).map((style) => (
                              <button key={style} type="button"
                                onClick={() => setChildLayoutByNodeIdState((prev) => {
                                  const next = { ...prev, [sec.id]: style };
                                  const cb = onSettingsChangeRef.current;
                                  if (cb) queueMicrotask(() => cb({ employeeChildLayout: next }));
                                  return next;
                                })}
                                className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                                  secChildLayout === style ? "border-transparent text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                                style={secChildLayout === style ? { backgroundColor: color, borderColor: color } : {}}>
                                {style === "row" ? "V rade" : style === "pairs" ? "V pároch" : "Po štyroch"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Clenovia */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Členovia sekcie</label>
                          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: color }}>{members.length}</span>
                        </div>
                        {members.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Žiadni členovia. Pridaj ich nižšie.</p>
                        ) : (
                          <ul className="space-y-1">
                            {members.map((r) => (
                              <li key={r.employeeId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-slate-800 truncate">{r.fullName}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{r.positionName}</p>
                                </div>
                                {onSettingsChange && (
                                  <button type="button"
                                    onClick={() => {
                                      removeEmployeeFromSection(r.employeeId, sectionMembers)
                                        .then(setSectionMembers);
                                    }}
                                    className="ml-2 shrink-0 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-100">odobrať</button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Pridat clenov */}
                      {onSettingsChange && addable.filter((r) => r.managerEmployeeId !== sec.id).length > 0 && (
                        <div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Pridať do sekcie</label>
                          <p className="text-[10px] text-slate-400 mb-2">Zamestnanci pod rovnakým nadriadencom:</p>
                          <ul className="space-y-1 max-h-44 overflow-y-auto">
                            {addable.filter((r) => r.managerEmployeeId !== sec.id).map((r) => (
                              <li key={r.employeeId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                                <div className="min-w-0">
                                  <p className="text-xs text-slate-700 truncate">{r.fullName}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{r.positionName}</p>
                                </div>
                                <button type="button"
                                  onClick={() => {
                                    addEmployeeToSection(r.employeeId, sec.id, sectionMembers)
                                      .then(setSectionMembers);
                                  }}
                                  className="ml-2 shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold text-white"
                                  style={{ backgroundColor: color }}>+ pridať</button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Zmazat */}
                      {onSettingsChange && (
                        <div className="border-t border-slate-100 pt-3">
                          <button type="button"
                            onClick={() => {
                              removeSectionAllMembers(sec.id, sectionMembers)
                                .then(setSectionMembers);
                              setSectionGroups(sectionGroups.filter((s) => s.id !== sec.id));
                              setSelectedSectionId(null);
                            }}
                            className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                          >Odstrániť sekciu</button>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })() : (
              <div className="h-full overflow-y-auto px-4 py-3">
              <CellDetailPanel
                employee={
                  selectedEmployeeId
                    ? (rawRecords.find((r) => r.employeeId === selectedEmployeeId) ?? null)
                    : null
                }
                employeePhotoUrl={
                  selectedEmployeeId
                    ? (rawRecords.find((r) => r.employeeId === selectedEmployeeId)?.photoUrl ??
                       employeePhotos[selectedEmployeeId] ??
                       null)
                    : null
                }
                onPhotoChange={
                  allowEdit && selectedEmployeeId
                    ? (useDbPhotos && onPhotoChanged
                        ? async (id, url) => {
                            const session = (await supabaseClient?.auth.getSession())?.data?.session;
                            if (!session?.access_token) {
                              window.alert(t("orgChart.photoUploadLogin"));
                              return;
                            }
                            const res = await fetch("/api/org/employee-photo", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${session.access_token}`,
                              },
                              body: JSON.stringify({ employeeId: id, dataUrl: url }),
                            });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({})) as { error?: string; detail?: string };
                              console.warn("Employee photo upload failed:", err.error, err.detail);
                              if (err.error || err.detail) {
                                window.alert([err.error, err.detail].filter(Boolean).join(": "));
                              }
                              return;
                            }
                            onPhotoChanged();
                          }
                        : (id, url) => {
                            saveEmployeePhoto(id, url);
                            setEmployeePhotos((prev) => ({ ...prev, [id]: url }));
                          })
                    : undefined
                }
                onPhotoClear={
                  allowEdit && selectedEmployeeId
                    ? (useDbPhotos && onPhotoChanged
                        ? async (id) => {
                            const session = (await supabaseClient?.auth.getSession())?.data?.session;
                            if (!session?.access_token) {
                              window.alert(t("orgChart.photoDeleteLogin"));
                              return;
                            }
                            const res = await fetch(`/api/org/employee-photo?employeeId=${encodeURIComponent(id)}`, {
                              method: "DELETE",
                              headers: { Authorization: `Bearer ${session.access_token}` },
                            });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({})) as { error?: string; detail?: string; hint?: string };
                              console.warn("Employee photo delete failed:", err.error, err.detail, err.hint);
                              if (err.error || err.detail || err.hint) {
                                window.alert([err.error, err.detail, err.hint].filter(Boolean).join(": "));
                              }
                              return;
                            }
                            onPhotoChanged();
                          }
                        : (id) => {
                            removeEmployeePhoto(id);
                            setEmployeePhotos((prev) => {
                              const next = { ...prev };
                              delete next[id];
                              return next;
                            });
                          })
                    : undefined
                }
                managerOptions={
                  allowEdit
                    ? [
                        ...rawRecords.map((e) => ({ value: e.employeeId, label: `${e.fullName} (#${e.employeeId})` })),
                        ...vacancies.map((v) => ({ value: v.id, label: `[Voľná] ${v.title}` })),
                      ]
                    : undefined
                }
                employeePhotoOffset={
                  selectedEmployeeId ? (employeePhotoOffsets[selectedEmployeeId] ?? { x: 0, y: 0 }) : null
                }
                onPhotoOffsetChange={
                  allowEdit && selectedEmployeeId
                    ? (id, offset) => {
                        setEmployeePhotoOffsetsState((prev) => {
                          const next = {
                            ...prev,
                            [id]: {
                              x: Math.min(40, Math.max(-40, Number(offset.x) || 0)),
                              y: Math.min(40, Math.max(-40, Number(offset.y) || 0)),
                            },
                          };
                          const cb = onSettingsChangeRef.current;
                          if (cb) queueMicrotask(() => cb({ employeePhotoOffsets: next }));
                          else saveEmployeePhotoOffsets(next);
                          return next;
                        });
                      }
                    : undefined
                }
                onPhotoOffsetReset={
                  allowEdit && selectedEmployeeId
                    ? (id) => {
                        setEmployeePhotoOffsetsState((prev) => {
                          const next = { ...prev };
                          delete next[id];
                          const cb = onSettingsChangeRef.current;
                          if (cb) queueMicrotask(() => cb({ employeePhotoOffsets: next }));
                          else saveEmployeePhotoOffsets(next);
                          return next;
                        });
                      }
                    : undefined
                }
                onManagerChange={
                  allowEdit && selectedEmployeeId && onRecordsChange
                    ? (managerId) => {
                        const updated = rawRecords.map((r) =>
                          r.employeeId === selectedEmployeeId ? { ...r, managerEmployeeId: managerId } : r,
                        );
                        onRecordsChange(updated);
                      }
                    : undefined
                }
                employeeAccentColor={
                  selectedEmployeeId ? (employeeColors[selectedEmployeeId] ?? null) : null
                }
                onAccentColorChange={
                  allowEdit && selectedEmployeeId
                    ? (id, hex) => {
                        setEmployeeColorsState((prev) => {
                          const next = { ...prev, [id]: hex };
                          const cb = onSettingsChangeRef.current;
                          if (cb) queueMicrotask(() => cb({ employeeColors: next }));
                          else saveEmployeeColor(id, hex);
                          return next;
                        });
                      }
                    : undefined
                }
                onAccentColorClear={
                  allowEdit && selectedEmployeeId
                    ? (id) => {
                        setEmployeeColorsState((prev) => {
                          const next = { ...prev };
                          delete next[id];
                          const cb = onSettingsChangeRef.current;
                          if (cb) queueMicrotask(() => cb({ employeeColors: next }));
                          else removeEmployeeColor(id);
                          return next;
                        });
                      }
                    : undefined
                }
                selectedNodeHasChildren={
                  selectedEmployeeId ? (orderedHierarchyChildren.get(selectedEmployeeId)?.length ?? 0) > 0 : false
                }
                selectedNodeIsCollapsed={
                  selectedEmployeeId ? collapsedNodeIds.has(selectedEmployeeId) : false
                }
                onToggleCollapse={
                  selectedEmployeeId ? () => toggleCollapsed(selectedEmployeeId) : undefined
                }
                childLayoutStyle={
                  selectedEmployeeId ? (childLayoutByNodeId[selectedEmployeeId] ?? null) : null
                }
                onChildLayoutChange={onSettingsChange ? (nodeId, style) => {
                  setChildLayoutByNodeIdState((prev) => {
                    const next = { ...prev, [nodeId]: style };
                    const cb = onSettingsChangeRef.current;
                    if (cb) queueMicrotask(() => cb({ employeeChildLayout: next }));
                    else saveChildLayout(nodeId, style);
                    return next;
                  });
                } : undefined}
                directReportOrder={selectedEmployeeDirectReportOrder}
                onReorderDirectReports={
                  selectedEmployeeId && onSettingsChange
                    ? (orderedIds) =>
                        setChildOrderByParent((prev) => ({ ...prev, [selectedEmployeeId]: orderedIds }))
                    : undefined
                }
                vacancyContent={
                  selectedVacancyId ? (() => {
                    const vac = vacancies.find((v) => v.id === selectedVacancyId);
                    if (!vac) return null;
                    const reportCount = rawRecords.filter((r) => r.managerEmployeeId === vac.id).length
                      + vacancies.filter((v) => v.parentId === vac.id).length;
                    return (
                      <div className="flex h-full flex-col overflow-hidden">
                        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 pb-2">
                          <h3 className="text-sm font-semibold text-slate-800">Voľná pozícia</h3>
                          <button
                            type="button"
                            onClick={() => setSelectedVacancyId(null)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100"
                            aria-label={t("common.close")}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex-1 space-y-3 overflow-y-auto py-3">
                          <div>
                            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Názov pozície</label>
                            <p className="mt-0.5 text-sm font-medium text-slate-800">{vac.title}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Počet priamych reportov</label>
                            <p className="mt-0.5 text-sm text-slate-700">{reportCount} (zamestnanci alebo ďalšie vacancy)</p>
                          </div>
                          {reportCount > 0 && (
                            <div className="border-t border-slate-200 pt-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Zobrazovanie podriadených</p>
                              <p className="mt-0.5 text-xs text-slate-500">Ako sa majú zobrazovať hierarchicky pod touto pozíciou.</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(["row", "pairs", "fours"] as const).map((style) => (
                                  <button
                                    key={style}
                                    type="button"
                                    onClick={() => {
                                      setChildLayoutByNodeIdState((prev) => {
                                        const next = { ...prev, [vac.id]: style };
                                        const cb = onSettingsChangeRef.current;
                                        if (cb) queueMicrotask(() => cb({ employeeChildLayout: next }));
                                        else saveChildLayout(vac.id, style);
                                        return next;
                                      });
                                    }}
                                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                                      (childLayoutByNodeId[vac.id] ?? "row") === style
                                        ? "border-[var(--artifex-navy)] bg-[var(--artifex-navy)] text-white"
                                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                                  >
                                    {style === "row" ? t("orgChart.childLayoutRow") : style === "pairs" ? t("orgChart.childLayoutPairs") : t("orgChart.childLayoutFours")}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedVacancyDirectReportOrder.length > 0 && (
                            <div className="border-t border-slate-200 pt-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Poradie podriadených v línii</p>
                              <p className="mt-0.5 text-xs text-slate-500">Zmena poradia ľudí zobrazených pod touto pozíciou.</p>
                              <ul className="mt-2 space-y-1">
                                {selectedVacancyDirectReportOrder.map((item, index) => (
                                  <li
                                    key={item.id}
                                    className="flex items-center gap-2 rounded border border-slate-200 bg-white py-1.5 pl-2 pr-1"
                                  >
                                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800" title={item.label}>
                                      {item.label}
                                    </span>
                                    <div className="flex shrink-0 gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const order = [...selectedVacancyDirectReportOrder];
                                          if (index <= 0) return;
                                          [order[index - 1], order[index]] = [order[index], order[index - 1]];
                                          setChildOrderByParent((prev) => ({ ...prev, [vac.id]: order.map((o) => o.id) }));
                                        }}
                                        disabled={index === 0}
                                        className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                                        title={t("common.moveUp")}
                                        aria-label={t("common.moveUp")}
                                      >
                                        ▲
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const order = [...selectedVacancyDirectReportOrder];
                                          if (index >= order.length - 1) return;
                                          [order[index], order[index + 1]] = [order[index + 1], order[index]];
                                          setChildOrderByParent((prev) => ({ ...prev, [vac.id]: order.map((o) => o.id) }));
                                        }}
                                        disabled={index === selectedVacancyDirectReportOrder.length - 1}
                                        className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                                        title={t("common.moveDown")}
                                        aria-label={t("common.moveDown")}
                                      >
                                        ▼
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {allowEdit && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = vacancies.filter((v) => v.id !== vac.id);
                                  persistRemoveVacancy(vac.id);
                                  setVacancies(next);
                                  setSelectedVacancyId(null);
                                }}
                                className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                              >
                                Odstrániť vacancy
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })() : undefined
                }
                onCloseEmployee={() => { setSelectedEmployeeId(null); setSelectedVacancyId(null); setSelectedSectionId(null); }}
              />
              </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

