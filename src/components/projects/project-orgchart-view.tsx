"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import type { ProjDepartment, ProjAssignment, ProjProject, PersonType } from "@/lib/proj/types";
import { PERSON_TYPE_COLORS, PERSON_TYPE_LABELS, locationColor } from "@/lib/proj/types";
import * as repo from "@/lib/proj/repository";
import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";

type EdgePath = { id: string; d: string };

function filterEdgesForSelection(
  edges: EdgePath[], canvas: ProjAssignment[], selected: Set<string>,
): EdgePath[] {
  return edges.filter((e) => {
    const sep = e.id.indexOf("::");
    if (sep !== -1) {
      const parentId = e.id.slice(0, sep);
      if (!selected.has(parentId)) return false;
      return canvas.some((a) => a.reports_to_id === parentId && selected.has(a.id));
    }
    const child = canvas.find((a) => a.id === e.id);
    if (!child || !selected.has(e.id)) return false;
    return Boolean(child.reports_to_id && selected.has(child.reports_to_id));
  });
}

/** Bounding box SVG path (M/L/H/V/Q prikazy z naseho routera). */
function svgPathBounds(d: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let x = 0, y = 0;
  const touch = (nx: number, ny: number) => {
    minX = Math.min(minX, nx); minY = Math.min(minY, ny);
    maxX = Math.max(maxX, nx); maxY = Math.max(maxY, ny);
    x = nx; y = ny;
  };
  const re = /([MLHVQ])|(-?\d*\.?\d+)/g;
  let cmd = "";
  const nums: number[] = [];
  const flush = () => {
    if (!cmd || nums.length === 0) return;
    if (cmd === "M" || cmd === "L") {
      for (let i = 0; i + 1 < nums.length; i += 2) touch(nums[i], nums[i + 1]);
    } else if (cmd === "H") {
      for (const nx of nums) touch(nx, y);
    } else if (cmd === "V") {
      for (const ny of nums) touch(x, ny);
    } else if (cmd === "Q") {
      for (let i = 0; i + 3 < nums.length; i += 4) {
        touch(nums[i], nums[i + 1]);
        touch(nums[i + 2], nums[i + 3]);
      }
    }
    nums.length = 0;
  };
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) { flush(); cmd = m[1]; }
    else nums.push(parseFloat(m[2]));
  }
  flush();
  return isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function computeSelectionBounds(
  selected: Set<string>,
  positions: Map<string, { x: number; y: number }>,
  sizeOf: (id: string) => { w: number; h: number },
  edges: EdgePath[],
  pad: { top: number; right: number; bottom: number; left: number },
) {
  const CARD_BLEED = 8; // border, top accent, selection ring / shadow
  const STROKE_BLEED = 2;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of selected) {
    const p = positions.get(id); if (!p) continue;
    const s = sizeOf(id);
    minX = Math.min(minX, p.x - CARD_BLEED);
    minY = Math.min(minY, p.y - CARD_BLEED);
    maxX = Math.max(maxX, p.x + s.w + CARD_BLEED);
    maxY = Math.max(maxY, p.y + s.h + CARD_BLEED);
  }
  for (const e of edges) {
    const b = svgPathBounds(e.d);
    if (!b) continue;
    minX = Math.min(minX, b.minX - STROKE_BLEED);
    minY = Math.min(minY, b.minY - STROKE_BLEED);
    maxX = Math.max(maxX, b.maxX + STROKE_BLEED);
    maxY = Math.max(maxY, b.maxY + STROKE_BLEED);
  }
  if (!isFinite(minX)) return null;
  minX -= pad.left;
  minY -= pad.top;
  maxX += pad.right;
  maxY += pad.bottom;
  return { minX, minY, w: Math.ceil(maxX - minX), h: Math.ceil(maxY - minY) };
}

const EXPORT_EXTRA_TOP = 56;

const TYPE_BG: Record<PersonType, string> = {
  internal: "#CFF2F7",
  interim: "#E0F2F7",
  external: "#CFF2F7",
  supplier: "#FFF6CC",
  tbd: "#EDE9FE",
};

// Rozmery
const CARD_W = 188;
const CARD_H = 58;

type Props = {
  project: ProjProject;
  departments: ProjDepartment[];
  assignments: ProjAssignment[];
  onEditPerson?: (a: ProjAssignment) => void;
  onDeletePerson?: (id: string) => void;
  onAddPerson?: (departmentId: string | null) => void;
  onSetReportsTo?: (childId: string, parentId: string | null) => void;
  onPositionsChanged?: () => void;
};

export function ProjectOrgchartView(props: Props) {
  const { project, assignments, onEditPerson, onDeletePerson, onAddPerson, onSetReportsTo, onPositionsChanged } = props;

  // Karty s poziciou = na platne; bez pozicie = v zasobniku (nealokovane)
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  // Individualne velkosti kariet (default CARD_W/CARD_H ak nie su nastavene)
  const [sizes, setSizes] = useState<Map<string, { w: number; h: number }>>(new Map());

  useEffect(() => {
    const m = new Map<string, { x: number; y: number }>();
    const sz = new Map<string, { w: number; h: number }>();
    for (const a of assignments) {
      if (a.canvas_x != null && a.canvas_y != null) m.set(a.id, { x: Number(a.canvas_x), y: Number(a.canvas_y) });
      if (a.canvas_w != null && a.canvas_h != null) sz.set(a.id, { w: Number(a.canvas_w), h: Number(a.canvas_h) });
    }
    setPositions(m);
    setSizes(sz);
  }, [assignments]);

  const sizeOf = useCallback((id: string) => sizes.get(id) ?? { w: CARD_W, h: CARD_H }, [sizes]);

  const onCanvas = useMemo(() => assignments.filter((a) => positions.has(a.id)), [assignments, positions]);
  const [traySearch, setTraySearch] = useState("");
  const inTray = useMemo(() => {
    const base = assignments.filter((a) => !positions.has(a.id));
    const q = traySearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter((a) => {
      const nm = (a.iac_employee?.meno ?? a.person_name ?? "").toLowerCase();
      const pos = (a.position_title ?? "").toLowerCase();
      const loc = (a.home_location ?? "").toLowerCase();
      return nm.includes(q) || pos.includes(q) || loc.includes(q);
    });
  }, [assignments, positions, traySearch]);
  const trayTotal = useMemo(() => assignments.filter((a) => !positions.has(a.id)).length, [assignments, positions]);
  const editable = Boolean(onEditPerson);

  // Pan & Zoom.
  // Zoom/poziciu drzime aj v sessionStorage per projekt, aby prezili pripadny
  // remount komponentu (napr. prepnutie pohladu tam a spat) a uzivatel zostal
  // tam, kde bol. Kluc je viazany na project.id.
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewKey = `orgchart-view:${project.id}`;
  const readSavedView = (): { scale: number; offset: { x: number; y: number } } | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(viewKey);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (typeof v?.scale === "number" && typeof v?.offset?.x === "number" && typeof v?.offset?.y === "number") {
        return { scale: v.scale, offset: { x: v.offset.x, y: v.offset.y } };
      }
    } catch { /* ignoruj poskodeny zaznam */ }
    return null;
  };
  const [scale, setScale] = useState(() => readSavedView()?.scale ?? 0.85);
  const [offset, setOffset] = useState(() => readSavedView()?.offset ?? { x: 20, y: 10 });
  const panState = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const clampScale = (s: number) => Math.min(2.5, Math.max(0.2, s));

  // Uloz aktualny zoom/poziciu do sessionStorage (poistka proti remountu).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(viewKey, JSON.stringify({ scale, offset }));
    } catch { /* sessionStorage moze byt nedostupny */ }
  }, [viewKey, scale, offset]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    setScale((prev) => {
      const ns = clampScale(prev * (1 - e.deltaY * 0.0015));
      setOffset((po) => { const r = ns / prev; return { x: cx - (cx - po.x) * r, y: cy - (cy - po.y) * r }; });
      return ns;
    });
  }, []);
  // Drag karty na platne
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // === Rubber-band vyber + kopirovanie do ineho projektu + PDF export ===
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selDragRef = useRef<{ startX: number; startY: number } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [exportLayout, setExportLayout] = useState<{
    minX: number; minY: number; w: number; h: number; extraTop: number;
  } | null>(null);
  const [projects, setProjects] = useState<ProjProject[]>([]);
  const [copyTarget, setCopyTarget] = useState<string>("");
  const platnoRef = useRef<HTMLDivElement>(null);

  // Prepocet bodu z obrazovky na suradnice platna (zohladnuje offset + scale)
  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - offset.x) / scale,
      y: (clientY - rect.top - offset.y) / scale,
    };
  }, [offset, scale]);

  // Pri zapnuti rezimu vyberu nacitaj zoznam projektov (pre cielovy vyber pri kopirovani)
  useEffect(() => {
    if (!selectMode || projects.length > 0) return;
    repo.fetchProjects().then((ps) => {
      setProjects(ps);
      const first = ps.find((p) => p.id !== project.id);
      if (first) setCopyTarget(first.id);
    }).catch(console.error);
  }, [selectMode, projects.length, project.id]);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((m) => {
      const next = !m;
      if (!next) { setSelectedIds(new Set()); setSelRect(null); setCopyOpen(false); setCopyMsg(null); }
      else { setLinkSource(null); }
      return next;
    });
  }, []);

  // Kopiruj vybrane karty na cielovy projekt (vratane pozicii + zachovaj reports_to medzi vybranymi)
  const copySelectedToProject = useCallback(async () => {
    if (selectedIds.size === 0 || !copyTarget) return;
    setCopyBusy(true); setCopyMsg(null);
    try {
      const n = await repo.copyAssignmentsToProject([...selectedIds], copyTarget);
      const pname = projects.find((p) => p.id === copyTarget)?.name ?? "projektu";
      setCopyMsg(`Skopirovanych ${n} kariet do \"${pname}\".`);
    } catch (e) {
      console.error(e);
      setCopyMsg("Kopirovanie zlyhalo. Skus znova.");
    } finally {
      setCopyBusy(false);
    }
  }, [selectedIds, copyTarget, projects]);

  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (selectMode) {
      // zaciatok kreslenia vyberoveho obdlznika (v suradniciach platna)
      const p = screenToCanvas(e.clientX, e.clientY);
      selDragRef.current = { startX: p.x, startY: p.y };
      setSelRect({ x: p.x, y: p.y, w: 0, h: 0 });
      setCopyOpen(false); setCopyMsg(null);
      return;
    }
    panState.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
    setIsPanning(true);
  }, [offset, selectMode, screenToCanvas]);

  const startCardDrag = useCallback((e: React.MouseEvent, id: string) => {
    if (selectMode) return;   // v rezime vyberu sa karty nepresuvaju
    e.stopPropagation();
    const p = positions.get(id) ?? { x: 0, y: 0 };
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y };
    setDraggingId(id);
  }, [positions, selectMode]);

  // Resize karty (tahanie za roh)
  const resizeRef = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const startCardResize = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const s = sizes.get(id) ?? { w: CARD_W, h: CARD_H };
    resizeRef.current = { id, startX: e.clientX, startY: e.clientY, origW: s.w, origH: s.h };
    setResizingId(id);
  }, [sizes]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // rubber-band vyber (rezim vyberu)
      if (selDragRef.current) {
        const p = screenToCanvas(e.clientX, e.clientY);
        const s = selDragRef.current;
        const x = Math.min(s.startX, p.x), y = Math.min(s.startY, p.y);
        const w = Math.abs(p.x - s.startX), h = Math.abs(p.y - s.startY);
        setSelRect({ x, y, w, h });
        // priebezne oznac karty, ktore sa prekryvaju s obdlznikom
        const ids = new Set<string>();
        for (const a of onCanvas) {
          const pos = positions.get(a.id); if (!pos) continue;
          const cs = sizeOf(a.id);
          const hit = pos.x < x + w && pos.x + cs.w > x && pos.y < y + h && pos.y + cs.h > y;
          if (hit) ids.add(a.id);
        }
        setSelectedIds(ids);
        return;
      }
      if (resizeRef.current) {
        const r = resizeRef.current;
        const dw = (e.clientX - r.startX) / scale;
        const dh = (e.clientY - r.startY) / scale;
        const w = Math.max(120, Math.round(r.origW + dw));
        const h = Math.max(44, Math.round(r.origH + dh));
        setSizes((prev) => { const m = new Map(prev); m.set(r.id, { w, h }); return m; });
        return;
      }
      if (dragRef.current) {
        const d = dragRef.current;
        const dx = (e.clientX - d.startX) / scale;
        const dy = (e.clientY - d.startY) / scale;
        setPositions((prev) => { const m = new Map(prev); m.set(d.id, { x: d.origX + dx, y: d.origY + dy }); return m; });
        return;
      }
      if (panState.current.dragging) {
        setOffset({ x: panState.current.origX + (e.clientX - panState.current.startX), y: panState.current.origY + (e.clientY - panState.current.startY) });
      }
    };
    const onUp = () => {
      if (selDragRef.current) {
        selDragRef.current = null;
        setSelRect(null);
        // ak nic nezachytene, ostan v rezime vyberu (uzivatel moze tahat znova)
        return;
      }
      if (resizeRef.current) {
        const r = resizeRef.current;
        const s = sizes.get(r.id);
        if (s) void repo.setCanvasSize(r.id, Math.round(s.w), Math.round(s.h)).catch(console.error);
        resizeRef.current = null; setResizingId(null);
      }
      if (dragRef.current) {
        const d = dragRef.current;
        const p = positions.get(d.id);
        if (p) void repo.setCanvasPosition(d.id, Math.round(p.x), Math.round(p.y)).catch(console.error);
        dragRef.current = null; setDraggingId(null);
      }
      if (panState.current.dragging) { panState.current.dragging = false; setIsPanning(false); }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [scale, positions, sizes, onCanvas, sizeOf, screenToCanvas]);

  const zoomBy = (f: number) => setScale((s) => clampScale(s * f));
  const resetView = () => { setScale(0.85); setOffset({ x: 20, y: 10 }); };

  // Pridaj kartu zo zasobnika na platno (na default poziciu)
  const placeOnCanvas = useCallback(async (id: string) => {
    // najdi volne miesto v lavom hornom rohu, posunute podla poctu uz umiestnenych
    const n = positions.size;
    const x = 40 + (n % 6) * (CARD_W + 24);
    const y = 40 + Math.floor(n / 6) * (CARD_H + 40);
    setPositions((prev) => { const m = new Map(prev); m.set(id, { x, y }); return m; });
    await repo.setCanvasPosition(id, x, y).catch(console.error);
  }, [positions]);

  // Drop zo zasobnika presne na poziciu kurzora
  const handleCanvasDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/assignment-id");
    if (!id) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - offset.x) / scale - CARD_W / 2;
    const y = (e.clientY - rect.top - offset.y) / scale - CARD_H / 2;
    setPositions((prev) => { const m = new Map(prev); m.set(id, { x, y }); return m; });
    await repo.setCanvasPosition(id, Math.round(x), Math.round(y)).catch(console.error);
  }, [offset, scale]);

  // Odstran z platna (vrat do zasobnika) - nezmaze osobu, len poziciu
  const removeFromCanvas = useCallback(async (id: string) => {
    setPositions((prev) => { const m = new Map(prev); m.delete(id); return m; });
    await repo.setCanvasPosition(id, null, null).catch(console.error);
  }, []);

  // Prepojovanie spojnicami
  const [linkSource, setLinkSource] = useState<string | null>(null);

  function clickCard(id: string) {
    if (linkSource && linkSource !== "__pick__") {
      if (linkSource !== id && onSetReportsTo) onSetReportsTo(id, linkSource);
      setLinkSource(null);
      return;
    }
    if (linkSource === "__pick__") { setLinkSource(id); return; }
    const a = assignments.find((x) => x.id === id);
    if (a) onEditPerson?.(a);
  }

  const canvasSize = useMemo(() => {
    let maxX = 1400, maxY = 800;
    for (const [id, p] of positions.entries()) {
      const s = sizes.get(id) ?? { w: CARD_W, h: CARD_H };
      maxX = Math.max(maxX, p.x + s.w + 200); maxY = Math.max(maxY, p.y + s.h + 200);
    }
    return { w: maxX, h: maxY };
  }, [positions, sizes]);

  // Vypocet spojnic.
  // - Ak ma rodic 2+ deti POD sebou: "left side-elbow" routing ako klasicky org-chart
  //   strom: jedna zvisla zbernica vedie pri LAVEJ hrane deti a kazde dieta sa na nu
  //   napaja kratkou vodorovnou ciarou do svojej lavej hrany (deti zdielaju zbernicu).
  // - Inak (1 dieta / dieta nie je pod rodicom): povodny centrovany elbow s obchadzanim kariet.
  const edgePaths = useMemo(() => {
    const R = 8;               // polomer zaoblenia rohov
    const GAP = 26;            // odstup zbernice od hrany rodica (centrovany rezim)
    const PAD = 8;             // bezpecny odstup ciary od karty
    const STEP = 10;           // krok posunu pri hladani volneho miesta
    const TRUNK_GAP = 22;      // odstup zvislej zbernice vlavo od lavej hrany deti

    type Rect = { x: number; y: number; w: number; h: number };
    // obdlzniky vsetkych kariet (pre detekciu kolizie)
    const rects = new Map<string, Rect>();
    for (const a of onCanvas) {
      const p = positions.get(a.id); if (!p) continue;
      const s = sizeOf(a.id);
      rects.set(a.id, { x: p.x, y: p.y, w: s.w, h: s.h });
    }

    // pretina vodorovna usecka (y konst., od x1 po x2) nejaku cudziu kartu?
    function hSegHitsCard(y: number, x1: number, x2: number, ignore: Set<string>): boolean {
      const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
      for (const [id, r] of rects) {
        if (ignore.has(id)) continue;
        if (y >= r.y - PAD && y <= r.y + r.h + PAD && hi >= r.x - PAD && lo <= r.x + r.w + PAD) return true;
      }
      return false;
    }
    // pretina zvisla usecka (x konst., od y1 po y2) nejaku cudziu kartu?
    function vSegHitsCard(x: number, y1: number, y2: number, ignore: Set<string>): { id: string; r: Rect } | null {
      const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
      for (const [id, r] of rects) {
        if (ignore.has(id)) continue;
        if (x >= r.x - PAD && x <= r.x + r.w + PAD && hi >= r.y - PAD && lo <= r.y + r.h + PAD) return { id, r };
      }
      return null;
    }

    type Kid = {
      childId: string;
      cLeft: number; cTop: number; cBot: number; cMidX: number; cMidY: number;
      below: boolean; rightSide: boolean;
    };
    type Parent = { pTop: number; pBot: number; pMidX: number; pRight: number };
    const groups = new Map<string, { parent: Parent; kids: Kid[] }>();
    for (const a of onCanvas) {
      if (!a.reports_to_id) continue;
      const child = positions.get(a.id); const parent = positions.get(a.reports_to_id);
      if (!child || !parent) continue;
      const ps = sizeOf(a.reports_to_id); const cs = sizeOf(a.id);
      const below = child.y >= parent.y + ps.h;
      // dieta je "do strany vpravo": jeho lava hrana je napravo od praveho okraja rodica
      const rightSide = child.x >= parent.x + ps.w;
      const kid: Kid = {
        childId: a.id,
        cLeft: child.x, cTop: child.y, cBot: child.y + cs.h,
        cMidX: child.x + cs.w / 2, cMidY: child.y + cs.h / 2, below, rightSide,
      };
      const g = groups.get(a.reports_to_id) ?? {
        parent: { pTop: parent.y, pBot: parent.y + ps.h, pMidX: parent.x + ps.w / 2, pRight: parent.x + ps.w },
        kids: [],
      };
      g.kids.push(kid);
      groups.set(a.reports_to_id, g);
    }

    // ortogonalna polyline so zaoblenymi rohmi
    function rounded(points: { x: number; y: number }[]): string {
      if (points.length < 2) return "";
      const segs: string[] = [`M ${points[0].x} ${points[0].y}`];
      for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1], cur = points[i], next = points[i + 1];
        const inDx = Math.sign(cur.x - prev.x), inDy = Math.sign(cur.y - prev.y);
        const outDx = Math.sign(next.x - cur.x), outDy = Math.sign(next.y - cur.y);
        const r = Math.min(R, Math.hypot(cur.x - prev.x, cur.y - prev.y) / 2, Math.hypot(next.x - cur.x, next.y - cur.y) / 2);
        segs.push(`L ${cur.x - inDx * r} ${cur.y - inDy * r}`);
        segs.push(`Q ${cur.x} ${cur.y} ${cur.x + outDx * r} ${cur.y + outDy * r}`);
      }
      const last = points[points.length - 1];
      segs.push(`L ${last.x} ${last.y}`);
      return segs.join(" ");
    }

    // povodny centrovany elbow (pre 1 dieta / dieta nie pod rodicom)
    function elbow(px: number, py: number, cx: number, cy: number, busY: number, vEnterX: number): string {
      if (Math.abs(px - cx) < 1 && Math.abs(vEnterX - cx) < 1) return `M ${px} ${py} L ${cx} ${cy}`;
      const down = cy >= py;
      const vSign = down ? 1 : -1;
      const seg: string[] = [`M ${px} ${py}`];
      if (Math.abs(vEnterX - px) < 1) { seg.push(`V ${cy}`); return seg.join(" "); }
      const dir = vEnterX > px ? 1 : -1;
      const r1 = Math.min(R, Math.abs(vEnterX - px) / 2, Math.abs(busY - py));
      const r2 = Math.min(R, Math.abs(vEnterX - px) / 2, Math.abs(cy - busY));
      seg.push(`V ${busY - vSign * r1}`);
      seg.push(`Q ${px} ${busY} ${px + dir * r1} ${busY}`);
      seg.push(`H ${vEnterX - dir * r2}`);
      seg.push(`Q ${vEnterX} ${busY} ${vEnterX} ${busY + vSign * r2}`);
      seg.push(`V ${cy}`);
      return seg.join(" ");
    }

    const out: { id: string; d: string }[] = [];
    for (const [parentId, g] of groups) {
      const { parent, kids } = g;
      const ignore = new Set<string>([parentId, ...kids.map((k) => k.childId)]);
      const kidsBelow = kids.filter((k) => k.below);
      const kidsRight = kids.filter((k) => k.rightSide);

      // RIGHT SIDE-ELBOW: rodic ma 2+ deti NAPRAVO od seba.
      // Deti zoskupime do STLPCOV podla lavej hrany. HLAVA kazdeho stlpca (najvyssie
      // dieta) sa napaja PRIAMO na rodica vlastnou ciarou: z lavej hrany hlavy kusok
      // dolava (vlastny stub), zvisle hore na uroven rodica a vodorovne k rodicovi.
      // Zvysne deti v stlpci visia na zvislej zbernici, ktora ide od hlavy nadol.
      if (kidsRight.length >= 2) {
        const COL_TOL = 60;
        const parentY = (parent.pTop + parent.pBot) / 2;

        const srt = [...kidsRight].sort((x, y) => x.cLeft - y.cLeft);
        type Col = { left: number; trunkX: number; kids: Kid[] };
        const cols: Col[] = [];
        for (const k of srt) {
          const col = cols.find((c) => Math.abs(c.left - k.cLeft) <= COL_TOL);
          if (col) { col.kids.push(k); col.left = Math.min(col.left, k.cLeft); }
          else cols.push({ left: k.cLeft, trunkX: 0, kids: [k] });
        }
        for (const c of cols) { c.trunkX = c.left - TRUNK_GAP; c.kids.sort((x, y) => x.cMidY - y.cMidY); }
        cols.sort((x, y) => x.trunkX - y.trunkX);

        cols.forEach((c, i) => {
          const head = c.kids[0];           // hlava stlpca = najvyssie dieta
          const bot = Math.max(...c.kids.map((k) => k.cMidY));
          const stubX = c.trunkX;           // x zvislej vetvy tohto stlpca (kusok vlavo od neho)

          // HLAVA -> rodic PRIAMO: z lavej hrany hlavy dolava na stubX, hore na
          // uroven rodica, vodorovne k pravemu okraju rodica
          out.push({
            id: parentId + `::col${i}In`,
            d: rounded([
              { x: head.cLeft, y: head.cMidY },
              { x: stubX, y: head.cMidY },
              { x: stubX, y: parentY },
              { x: parent.pRight, y: parentY },
            ]),
          });

          // zvisla zbernica stlpca od hlavy NADOL cez ostatne deti
          if (bot > head.cMidY) {
            out.push({ id: parentId + `::col${i}V`, d: `M ${stubX} ${head.cMidY} L ${stubX} ${bot}` });
          }
          // ostatne deti (okrem hlavy): zo zbernice vodorovne do lavej hrany
          for (const k of c.kids.slice(1)) {
            out.push({
              id: k.childId,
              d: rounded([
                { x: stubX, y: k.cMidY },
                { x: k.cLeft, y: k.cMidY },
              ]),
            });
          }
        });

        // ostatne deti (pod/nad rodicom) -> centrovany elbow
        for (const k of kids.filter((x) => !x.rightSide)) {
          const py = k.below ? parent.pBot : parent.pTop;
          const cy = k.below ? k.cTop : k.cBot;
          const busY = k.below ? parent.pBot + GAP : parent.pTop - GAP;
          out.push({ id: k.childId, d: elbow(parent.pMidX, py, k.cMidX, cy, busY, k.cMidX) });
        }
        continue;
      }

      // LEFT SIDE-ELBOW / TOP-T: rodic ma 2+ deti pod sebou
      if (kidsBelow.length >= 2) {
        // Su deti v jednom RADE (vedla seba, podobne y) alebo v STLPCI (pod sebou)?
        const ysB = kidsBelow.map((k) => k.cMidY);
        const xsB = kidsBelow.map((k) => k.cMidX);
        const ySpread = Math.max(...ysB) - Math.min(...ysB);
        const xSpread = Math.max(...xsB) - Math.min(...xsB);
        const oneRow = ySpread < 40 && xSpread > 40; // vodorovny rad deti

        if (oneRow) {
          // KLASICKY T-ROZVOD ZHORA (ako Excel): z rodica jedna zvisla ciara dole,
          // vodorovna zbernica napric detmi a z nej kratke zvisle ciary do HORNEHO
          // okraja kazdeho dietata -> kazde dieta ma vlastnu samostatnu odbocku.
          const childTop = Math.min(...kidsBelow.map((k) => k.cTop));
          let busY = (parent.pBot + childTop) / 2; // zbernica v medzere medzi rodicom a detmi
          for (let i = 0; i < 60; i++) {
            const minBX = Math.min(parent.pMidX, ...kidsBelow.map((k) => k.cMidX));
            const maxBX = Math.max(parent.pMidX, ...kidsBelow.map((k) => k.cMidX));
            if (!hSegHitsCard(busY, minBX, maxBX, ignore)) break;
            busY -= STEP;
          }
          const minBX = Math.min(parent.pMidX, ...kidsBelow.map((k) => k.cMidX));
          const maxBX = Math.max(parent.pMidX, ...kidsBelow.map((k) => k.cMidX));
          // rodic: zo spodku zvisle dole na zbernicu
          out.push({ id: parentId + "::trunkIn", d: `M ${parent.pMidX} ${parent.pBot} L ${parent.pMidX} ${busY}` });
          // vodorovna zbernica napric vsetkymi detmi
          out.push({ id: parentId + "::trunkH", d: `M ${minBX} ${busY} L ${maxBX} ${busY}` });
          // kazde dieta: zo zbernice zvisle dole do svojho HORNEHO okraja
          for (const k of kidsBelow) {
            out.push({
              id: k.childId,
              d: rounded([
                { x: k.cMidX, y: busY },
                { x: k.cMidX, y: k.cTop },
              ]),
            });
          }
        } else {
          // STLPEC POD SEBOU: povodny left side-elbow (spolocna zvisla zbernica vlavo)
          const minLeft = Math.min(...kidsBelow.map((k) => k.cLeft));
          let trunkX = minLeft - TRUNK_GAP;
          const topY = parent.pBot;
          const firstY = Math.min(...kidsBelow.map((k) => k.cMidY));
          const lastY = Math.max(...kidsBelow.map((k) => k.cMidY));
          for (let i = 0; i < 80; i++) {
            if (!vSegHitsCard(trunkX, firstY, lastY, ignore)) break;
            trunkX -= STEP;
          }
          out.push({
            id: parentId + "::trunkIn",
            d: rounded([
              { x: parent.pMidX, y: topY },
              { x: parent.pMidX, y: firstY },
              { x: trunkX, y: firstY },
            ]),
          });
          if (lastY > firstY) {
            out.push({ id: parentId + "::trunkV", d: `M ${trunkX} ${firstY} L ${trunkX} ${lastY}` });
          }
          for (const k of kidsBelow) {
            out.push({
              id: k.childId,
              d: rounded([
                { x: trunkX, y: k.cMidY },
                { x: k.cLeft, y: k.cMidY },
              ]),
            });
          }
        }
        // pripadne deti, ktore nie su pod rodicom -> centrovany elbow nad rodica
        for (const k of kids.filter((x) => !x.below)) {
          const busY = parent.pTop - GAP;
          out.push({ id: k.childId, d: elbow(parent.pMidX, parent.pTop, k.cMidX, k.cBot, busY, k.cMidX) });
        }
        continue;
      }

      // INAK: centrovany elbow s obchadzanim kariet
      const below0 = kids[0].below;
      const py0 = below0 ? parent.pBot : parent.pTop;
      const xs = [parent.pMidX, ...kids.map((k) => k.cMidX)];
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      let busY = below0 ? py0 + GAP : py0 - GAP;
      for (let i = 0; i < 60; i++) {
        if (!hSegHitsCard(busY, minX, maxX, ignore)) break;
        busY += below0 ? STEP : -STEP;
      }
      for (const k of kids) {
        const py = k.below ? parent.pBot : parent.pTop;
        const cy = k.below ? k.cTop : k.cBot;
        let vEnterX = k.cMidX;
        const hit = vSegHitsCard(vEnterX, busY, cy, ignore);
        if (hit) {
          const leftX = hit.r.x - PAD, rightX = hit.r.x + hit.r.w + PAD;
          vEnterX = Math.abs(leftX - parent.pMidX) <= Math.abs(rightX - parent.pMidX) ? leftX : rightX;
        }
        out.push({ id: k.childId, d: elbow(parent.pMidX, py, k.cMidX, cy, busY, vEnterX) });
      }
    }
    return out;
  }, [onCanvas, positions, sizeOf]);

  const exportSelectionPdf = useCallback(async () => {
    if (selectedIds.size === 0 || !platnoRef.current) return;
    setPdfBusy(true); setCopyMsg(null);
    try {
      const exportEdges = filterEdgesForSelection(edgePaths, onCanvas, selectedIds);
      const bounds = computeSelectionBounds(selectedIds, positions, sizeOf, exportEdges, {
        top: 56, right: 56, bottom: 56, left: 56,
      });
      if (!bounds) { setPdfBusy(false); return; }

      const layout = { ...bounds, extraTop: EXPORT_EXTRA_TOP };
      flushSync(() => {
        setExportLayout(layout);
        setPdfExporting(true);
      });
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

      const pixelRatio = 2;
      const canvas = await toCanvas(platnoRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio,
        cacheBust: true,
      });
      const png = canvas.toDataURL("image/png");

      const exportW = canvas.width / pixelRatio;
      const exportH = canvas.height / pixelRatio;
      const pdf = new jsPDF({
        orientation: exportW >= exportH ? "landscape" : "portrait",
        unit: "pt",
        format: "a4",
      });
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const scaleFit = Math.min((pw - margin * 2) / exportW, (ph - margin * 2) / exportH);
      const dw = exportW * scaleFit, dh = exportH * scaleFit;
      pdf.addImage(png, "PNG", (pw - dw) / 2, (ph - dh) / 2, dw, dh);
      const safe = (project.name || "orgchart").replace(/[^a-zA-Z0-9-_]+/g, "_");
      pdf.save(`${safe}-sekcia.pdf`);
      setCopyMsg(`PDF vygenerovane (${selectedIds.size} kariet).`);
    } catch (e) {
      console.error(e);
      setCopyMsg("PDF export zlyhal. Skus znova.");
    } finally {
      flushSync(() => {
        setPdfExporting(false);
        setExportLayout(null);
      });
      setPdfBusy(false);
    }
  }, [selectedIds, positions, sizeOf, project.name, edgePaths, onCanvas]);

  const canvasCards = useMemo(
    () => (pdfExporting ? onCanvas.filter((a) => selectedIds.has(a.id)) : onCanvas),
    [pdfExporting, onCanvas, selectedIds],
  );
  const canvasEdges = useMemo(() => {
    if (!pdfExporting) return edgePaths;
    return filterEdgesForSelection(edgePaths, onCanvas, selectedIds);
  }, [pdfExporting, edgePaths, selectedIds, onCanvas]);

  const platnoStyle = useMemo((): CSSProperties => {
    if (pdfExporting && exportLayout) {
      return {
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: -9999,
        width: exportLayout.w,
        height: exportLayout.h + exportLayout.extraTop,
        transform: "none",
        transformOrigin: "0 0",
        background: "#ffffff",
        overflow: "visible",
      };
    }
    if (pdfExporting) {
      return {
        transform: "none",
        transformOrigin: "0 0",
        position: "absolute",
        top: 0,
        left: 0,
        width: canvasSize.w,
        height: canvasSize.h,
        background: "#ffffff",
      };
    }
    return {
      transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
      transformOrigin: "0 0",
      position: "absolute",
      top: 0,
      left: 0,
      width: canvasSize.w,
      height: canvasSize.h,
    };
  }, [pdfExporting, exportLayout, offset, scale, canvasSize]);

  const exportShift = exportLayout
    ? `translate(${-exportLayout.minX}px, ${exportLayout.extraTop - exportLayout.minY}px)`
    : undefined;

  return (
    <div className="rounded-2xl border border-slate-200 bg-[#fafbfc]">
      {/* Hlavicka + zoom */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-block h-10 w-10 rounded-lg" style={{ background: project.color }} />
          <div>
            <h2 className="text-xl font-black" style={{ color: project.color }}>{project.name}</h2>
            <p className="text-xs text-slate-500">Stavaj chart: pridaj kartu/sekciu, tahaj mysou, koliesko = zoom. Prazdne platno = postav podla seba.</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onAddPerson && (
            <button type="button" onClick={() => onAddPerson(null)}
              className="mr-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: project.color }}>+ Karta</button>
          )}
          <button type="button" onClick={() => setLinkSource(linkSource ? null : "__pick__")}
            className={`mr-2 rounded-lg px-3 py-1.5 text-xs font-semibold ${linkSource ? "bg-amber-500 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {linkSource ? "Zrus spajanie" : "Spojit ciarou"}
          </button>
          <button type="button" onClick={toggleSelectMode}
            className={`mr-2 rounded-lg px-3 py-1.5 text-xs font-semibold ${selectMode ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            title="Tahaj obdlznik cez karty na vyber sekcie">
            {selectMode ? "Zrus vyber" : "Vybrat oblast"}
          </button>
          <button type="button" onClick={() => zoomBy(0.8)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-600 hover:bg-slate-50">&minus;</button>
          <span className="w-12 text-center text-xs font-semibold text-slate-500">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.25)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-600 hover:bg-slate-50">+</button>
          <button type="button" onClick={resetView}
            className="ml-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Reset</button>
        </div>
      </div>

      {linkSource && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {linkSource === "__pick__" ? "Klikni na NADRIADENEHO, potom na podriadeneho." : "Teraz klikni na PODRIADENEHO."}
        </div>
      )}

      {selectMode && (
        <div className="flex flex-wrap items-center gap-2 border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-xs text-indigo-900">
          <span className="font-semibold">
            {selectedIds.size > 0
              ? `Vybraných kariet: ${selectedIds.size}`
              : "Tahaj obdlznik cez karty, ktoré chceš vybrať."}
          </span>
          {selectedIds.size > 0 && (
            <>
              <span className="text-indigo-400">|</span>
              <label className="flex items-center gap-1">
                <span>Do projektu:</span>
                <select value={copyTarget} onChange={(e) => setCopyTarget(e.target.value)}
                  className="rounded border border-indigo-300 bg-white px-2 py-1 text-xs text-slate-700">
                  {projects.filter((p) => p.id !== project.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  {projects.filter((p) => p.id !== project.id).length === 0 && (
                    <option value="">(žiadny iný projekt)</option>
                  )}
                </select>
              </label>
              <button type="button" onClick={copySelectedToProject} disabled={copyBusy || !copyTarget}
                className="rounded-lg bg-indigo-600 px-3 py-1 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {copyBusy ? "Kopírujem…" : "Kopírovať →"}
              </button>
              <button type="button" onClick={exportSelectionPdf} disabled={pdfBusy}
                className="rounded-lg border border-indigo-300 bg-white px-3 py-1 font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                {pdfBusy ? "Generujem…" : "PDF export"}
              </button>
              <button type="button" onClick={() => { setSelectedIds(new Set()); setSelRect(null); setCopyMsg(null); }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-600 hover:bg-slate-50">
                Zrušiť výber
              </button>
            </>
          )}
          {copyMsg && <span className="font-semibold text-emerald-700">{copyMsg}</span>}
        </div>
      )}

      <div className="flex">
        {/* ZASOBNIK nealokovanych ludi */}
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-white" style={{ height: "74vh", overflowY: "auto" }}>
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Nealokovani ({inTray.length}{traySearch.trim() ? `/${trayTotal}` : ""})
            </h3>
            <p className="text-[10px] text-slate-400">Tahaj na platno alebo klikni +</p>
            <div className="relative mt-2">
              <input
                type="text"
                value={traySearch}
                onChange={(e) => setTraySearch(e.target.value)}
                placeholder="Hladaj meno / poziciu"
                className="w-full rounded-md border border-slate-300 py-1.5 pl-7 pr-6 text-[12px] focus:border-slate-400 focus:outline-none"
              />
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">&#128269;</span>
              {traySearch && (
                <button type="button" onClick={() => setTraySearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 hover:text-slate-600" title="Vymazat">&#10005;</button>
              )}
            </div>
          </div>
          <div className="space-y-1.5 p-2">
            {inTray.map((a) => {
              const nm = a.iac_employee?.meno ?? a.person_name ?? "";
              const label = a.position_title?.trim() || nm || "(bez nazvu)";
              return (
                <div key={a.id} draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/assignment-id", a.id)}
                  className="group flex cursor-grab items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 hover:bg-white"
                  style={{ borderLeft: `3px solid ${PERSON_TYPE_COLORS[a.person_type]}` }}>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold text-slate-700">{label}</div>
                    {nm && a.position_title && <div className="truncate text-[10px] text-slate-400">{nm}</div>}
                  </div>
                  <button type="button" onClick={() => placeOnCanvas(a.id)}
                    className="ml-1 shrink-0 rounded bg-slate-200 px-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-300" title="Pridat na platno">+</button>
                </div>
              );
            })}
            {inTray.length === 0 && traySearch.trim() && <p className="px-1 text-[11px] text-slate-400">Nenaslo sa.</p>}
            {inTray.length === 0 && !traySearch.trim() && <p className="px-1 text-[11px] text-slate-400">Vsetci su na platne.</p>}
          </div>
        </aside>

        {/* PLATNO */}
        <div ref={viewportRef} onWheel={handleWheel} onMouseDown={handleViewportMouseDown}
          onDragOver={(e) => e.preventDefault()} onDrop={handleCanvasDrop}
          className="relative flex-1 overflow-hidden"
          style={{ height: "74vh", cursor: selectMode ? "crosshair" : (isPanning ? "grabbing" : "grab"),
            backgroundImage: "radial-gradient(circle, #e2e8f0 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
          <div ref={platnoRef} style={platnoStyle}>
            <div style={exportShift ? { transform: exportShift, transformOrigin: "0 0" } : undefined}>
            {/* SVG spojnice (obchadzaju karty) */}
            <svg
              width={canvasSize.w}
              height={canvasSize.h}
              overflow="visible"
              style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
            >
              {canvasEdges.map((e) => (
                <path key={e.id} d={e.d} fill="none" stroke="#94a3b8" strokeWidth={1.5}
                  strokeLinejoin="round" strokeLinecap="round" />
              ))}
            </svg>

            {/* Vyberovy obdlznik (rubber-band) */}
            {selRect && !pdfExporting && (
              <div style={{ position: "absolute", left: selRect.x, top: selRect.y, width: selRect.w, height: selRect.h,
                border: "1.5px dashed #4f46e5", background: "rgba(79,70,229,0.08)", pointerEvents: "none", zIndex: 40 }} />
            )}

            {/* Karty na platne */}
            {canvasCards.map((a) => {
              const p = positions.get(a.id)!;
              const s = sizeOf(a.id);
              return (
                <OrgCard key={a.id} a={a} x={p.x} y={p.y} w={s.w} h={s.h} editable={editable}
                  forExport={pdfExporting}
                  isLinkSource={linkSource === a.id} isDragging={draggingId === a.id}
                  isResizing={resizingId === a.id} isSelected={!pdfExporting && selectedIds.has(a.id)}
                  onMouseDownCard={(e) => startCardDrag(e, a.id)}
                  onStartResize={(e) => startCardResize(e, a.id)}
                  onClickCard={() => clickCard(a.id)}
                  onDelete={onDeletePerson ? () => onDeletePerson(a.id) : undefined}
                  onRemoveFromCanvas={() => removeFromCanvas(a.id)} />
              );
            })}

            {onCanvas.length === 0 && !pdfExporting && (
              <div className="absolute left-8 top-10 max-w-sm rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
                Prazdne platno. Tahaj ludi zo zasobnika vlavo, alebo pridaj novu kartu tlacidlom "+ Karta" hore.
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Legenda:</span>
        {(Object.keys(PERSON_TYPE_LABELS) as PersonType[]).map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ background: PERSON_TYPE_COLORS[t] }} />
            <span className="text-[11px] text-slate-600">{PERSON_TYPE_LABELS[t]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function OrgCard({
  a, x, y, w, h, editable, forExport, isLinkSource, isDragging, isResizing, isSelected, onMouseDownCard, onStartResize, onClickCard, onDelete, onRemoveFromCanvas,
}: {
  a: ProjAssignment; x: number; y: number; w: number; h: number; editable?: boolean; forExport?: boolean;
  isLinkSource?: boolean; isDragging?: boolean; isResizing?: boolean; isSelected?: boolean;
  onMouseDownCard: (e: React.MouseEvent) => void;
  onStartResize?: (e: React.MouseEvent) => void;
  onClickCard: () => void;
  onDelete?: () => void;
  onRemoveFromCanvas?: () => void;
}) {
  // Farba podľa lokality (Elmdon/UK/Lozorno/Germany/TACO) alebo fialová pre TBD.
  // Manuálne nastavená card_color má prednosť; ak lokalita nie je v zozname, padne na person_type.
  const locCol = locationColor(a.home_location, a.person_type, a.status);
  const accent = locCol?.accent ?? PERSON_TYPE_COLORS[a.person_type];
  const bg = a.card_color ?? locCol?.bg ?? TYPE_BG[a.person_type];
  const rawName = a.iac_employee?.meno ?? a.person_name ?? "";
  const hasName = Boolean(rawName.trim());
  const hasPos = Boolean(a.position_title?.trim());
  const mt = useRef({ mx: 0, my: 0 });

  return (
    <div
      className={`group/card absolute rounded-md border select-none ${forExport ? "" : "shadow-sm"} ${editable ? "cursor-move" : ""}`}
      style={{ left: x, top: y, width: w, height: h,
        background: bg, borderColor: isSelected ? "#4f46e5" : (isLinkSource ? "#f59e0b" : `${accent}66`),
        borderWidth: (isLinkSource || isSelected) ? 2 : 1, borderTopWidth: 3, borderTopColor: accent,
        padding: "5px 8px", opacity: isDragging ? 0.85 : 1, zIndex: (isDragging || isResizing) ? 50 : 1,
        boxShadow: isSelected ? "0 0 0 2px rgba(79,70,229,0.35)" : undefined,
        display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}
      onMouseDown={(e) => { mt.current = { mx: e.clientX, my: e.clientY }; onMouseDownCard(e); }}
    >
      {/* akcie pri hoveri */}
      <div className="absolute -right-1.5 -top-1.5 z-10 hidden gap-1 group-hover/card:flex">
        {editable && (
          <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onClickCard(); }}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] text-slate-500 shadow-sm hover:bg-slate-50"
            title="Upravit kartu">&#9998;</button>
        )}
        {onRemoveFromCanvas && (
          <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onRemoveFromCanvas(); }}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] text-slate-500 shadow-sm hover:bg-slate-50"
            title="Vratit do zasobnika (nezmaze osobu)">&#8617;</button>
        )}
        {a.person_type === "interim" && (
          <a
            href={`/interim/${encodeURIComponent(a.iac_employee_id ?? `name:${(a.iac_employee?.meno ?? a.person_name ?? a.position_title ?? "").trim().toLowerCase()}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-cyan-300 bg-white text-[10px] text-cyan-600 shadow-sm hover:bg-cyan-50"
            title="Detail interim cloveka"
          >&#128203;</a>
        )}
      </div>
      {hasPos && <div className="text-center text-[11px] font-bold leading-tight text-slate-700">{a.position_title}</div>}
      <div className="text-center">
        <span className={`text-[12px] font-semibold ${a.is_placeholder || !hasName ? "italic" : "text-slate-800"}`}
          style={a.is_placeholder || !hasName ? { color: "#dc2626" } : {}}>
          {hasName ? rawName : (a.is_placeholder ? "TBD" : (hasPos ? "" : "(bez mena)"))}
        </span>
      </div>
      {(a.allocations?.[0]?.allocation_pct != null || a.iac_employee_id || a.home_location) && (
        <div className="mt-0.5 flex items-center justify-center gap-1">
          {a.home_location && <span className="text-[9px] text-slate-500">{a.home_location}</span>}
          {a.iac_employee_id && <span className="rounded px-1 text-[9px] font-bold text-white" style={{ background: "#949C58" }}>IAC</span>}
          {a.allocations?.[0]?.allocation_pct != null && (
            <span className="rounded px-1 text-[9px] font-black text-white" style={{ background: accent }}>{a.allocations[0].allocation_pct}%</span>
          )}
        </div>
      )}

      {/* Resize handle - pravy dolny roh */}
      {editable && onStartResize && (
        <div
          onMouseDown={(e) => { e.stopPropagation(); onStartResize(e); }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 right-0 hidden h-3.5 w-3.5 cursor-nwse-resize group-hover/card:block"
          style={{ background: `linear-gradient(135deg, transparent 50%, ${accent} 50%)`, borderBottomRightRadius: 4 }}
          title="Tahaj pre zmenu velkosti"
        />
      )}
    </div>
  );
}