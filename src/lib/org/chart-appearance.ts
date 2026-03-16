/**
 * Nastavenia vzhľadu organigramu: prepojenia, grafický štýl buniek, zobrazované údaje, farebnosti.
 * Inšpirované best practices a modernými organigramami (gradient, pill, bubble štýly).
 */

export type ConnectionLineStyle = "straight" | "step" | "smoothstep";
export type ConnectionMarker = "arrow" | "arrowClosed" | "none";

export type NodeVisualStyle =
  | "card"
  | "gradient"
  | "pill"
  | "bubble"
  | "executive"
  | "banner"
  | "hexBadge"
  | "stackedCorporate"
  | "classicBoard"
  | "profileRibbon"
  | "infoPill";
/** card = klasická karta s hlavičkou; gradient = hexagon + zaoblený obdĺžnik s gradientom; pill = kruh (avatar) + kapsula; bubble = zaoblená bublina s ikonou; executive = minimalistická karta s avatarom hore; banner = farebný pásikový blok; hexBadge = hexagon avatar + štítok; stackedCorporate = svetlá karta s avatarom v hornej časti; classicBoard = starší „board“ štýl s ľavým avatarom; profileRibbon = veľký avatar vľavo + horný ribbon + číslo v badge */

export type ColorScheme = "byPosition" | "byBranch" | "byLevel" | "unified";
/** byPosition = podľa KAT/position type; byBranch = podľa oddelenia/strediska; byLevel = root / 2. úroveň / 3. úroveň; unified = jedna farba */

export type NodeRole = "root" | "employee" | "stredisko";
/** Špecifický štýl pre typ uzla – ak nie je nastavený, použije sa globálny nodeStyle. */
export type NodeStyleByType = Partial<Record<NodeRole, NodeVisualStyle>>;

export type CellFieldId = "name" | "position" | "department" | "employeeId" | "typeLabel" | "subordinateCount";
export type CellFieldsConfig = Record<CellFieldId, boolean>;

/** Rozloženie stromu: zhora dole, zľava doprava, alebo kompaktné zhora dole. */
export type ChartLayoutType = "vertical" | "horizontal" | "compact";

/** Paleta farieb karty (rovnaká ako vo výbere „Farba karty“ v detaile bunky). Používa sa na filter „zobraziť len farby karty“. */
export const CARD_COLOR_PALETTE: { hex: string; label: string }[] = [
  { hex: "#1e3a5f", label: "Tmavomodrá" },
  { hex: "#0f766e", label: "Tyrkysová" },
  { hex: "#0369a1", label: "Modrá" },
  { hex: "#b45309", label: "Oranžová" },
  { hex: "#be123c", label: "Červená" },
  { hex: "#6b21a8", label: "Fialová" },
  { hex: "#15803d", label: "Zelená" },
  { hex: "#4f46e5", label: "Indigo" },
  { hex: "#21394F", label: "Artifex Navy" },
  { hex: "#949C58", label: "Artifex Olive" },
];

/** Štýl rozloženia pri rozbalení: deti priamo pod rodičom, vrstvy, vedľa seba, dva stĺpce. */
export type ExpansionStyle =
  | "tree"      // deti priamo pod nadriadeným (klasický strom)
  | "layers"    // vrstvy – jedna horizontálna línia na úroveň
  | "horizontal" // horizontálne – root vľavo, deti vpravo od rodiča
  | "twocol";   // dva stĺpce – pod rodičom deti v dvoch skupinách (ľavá/pravá)

export interface ConnectionAppearance {
  lineStyle: ConnectionLineStyle;
  strokeWidth: number;
  marker: ConnectionMarker;
  /** Farba čiary; ak null, použije sa farba z colorScheme (branch/level). */
  strokeColor: string | null;
  /** Farba čiar podľa vetvy (ak colorScheme byBranch) – použije sa ak strokeColor je null. */
  useBranchColorOnEdges: boolean;
}

export interface ChartAppearanceState {
  connection: ConnectionAppearance;
  nodeStyle: NodeVisualStyle;
  /** Špecifické štýly podľa typu uzla (root / employee / stredisko). Majú prednosť pred nodeStyle. */
  nodeStyleByType?: NodeStyleByType;
  colorScheme: ColorScheme;
  cellFields: CellFieldsConfig;
  /** Gradientové palety pre byLevel – [root, level2, level3], každý [from, to] pre gradient. */
  levelColors: [string, string][];
  /** Farby vetiev pre byBranch (jedna farba na vetvu). */
  branchColors: string[];
  /** Pri colorScheme "unified" – jedna farba pre všetky uzly. */
  unifiedColor?: string;
  /** Rozloženie organigramu (strom od roota / strediska). */
  layoutType?: ChartLayoutType;
  /** Ako sa rozbaľujú vetvy: strom pod rodičom, vrstvy, horizontálne, dva stĺpce. */
  expansionStyle?: ExpansionStyle;
  /** Pri štýle „bublina“: jednotlivé sekcie pôsobia vizuálne oddelene (bez alebo so slabými prepojeniami). */
  bubbleSectionsDisconnected?: boolean;
  /** Vertikálna medzera medzi riadkami uzlov (px). */
  rowGap?: number;
  /** Horizontálna medzera medzi uzlami v tom istom riadku (px). */
  nodeGapX?: number;
  /** Ak je neprázdne, zobrazia sa len karty s touto farbou (hex). Prázdne/undefined = zobraziť všetky. */
  visibleCardColors?: string[];
  /** Globálna mierka bunky (karty). 1 = 100 %. */
  nodeScale?: number;
  /** Dodatočná mierka šírky bunky (detailný tuning). 1 = 100 %. */
  nodeWidthScale?: number;
  /** Dodatočná mierka výšky bunky (detailný tuning). 1 = 100 %. */
  nodeHeightScale?: number;
  /** Globálna mierka písma v bunke. 1 = 100 %. */
  fontScale?: number;
  /** Globálna mierka fotky/avatara v bunke. 1 = 100 %. */
  photoScale?: number;
  /** Globálna mierka rámca (kruhu) fotky v bunke. 1 = 100 %. */
  photoFrameScale?: number;
  /** Hrúbka rámu fotky v px. */
  photoFrameBorderWidth?: number;
  /** Horizontálny posun fotky vo vnútri rámca (px). */
  photoOffsetX?: number;
  /** Vertikálny posun fotky vo vnútri rámca (px). */
  photoOffsetY?: number;
}

const DEFAULT_CELL_FIELDS: CellFieldsConfig = {
  name: true,
  position: true,
  department: true,
  employeeId: true,
  typeLabel: true,
  subordinateCount: true,
};

const DEFAULT_LEVEL_COLORS: [string, string][] = [
  ["#F06909", "#c44a00"], // root – oranžová
  ["#e11d48", "#9d174d"], // level 2 – červeno‑fialová
  ["#2563eb", "#1e40af"], // level 3 – modrá
];

const DEFAULT_BRANCH_COLORS = [
  "#e11d48",
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
];

export const DEFAULT_UNIFIED_COLOR = "#21394F";

/** Artifex guideline paleta pre rýchle nastavenie vzhľadu organigramu. */
export const ARTIFEX_GUIDELINE_BRANCH_COLORS = [
  "#21394F", // navy
  "#949C58", // olive
];

export const ARTIFEX_GUIDELINE_LEVEL_COLORS: [string, string][] = [
  ["#21394F", "#949C58"], // root
  ["#21394F", "#949C58"], // level 2
  ["#21394F", "#949C58"], // level 3
];

export const DEFAULT_CHART_APPEARANCE: ChartAppearanceState = {
  connection: {
    lineStyle: "step",
    strokeWidth: 2,
    marker: "arrowClosed",
    strokeColor: null,
    useBranchColorOnEdges: false,
  },
  nodeStyle: "card",
  nodeStyleByType: undefined,
  colorScheme: "byPosition",
  cellFields: DEFAULT_CELL_FIELDS,
  levelColors: DEFAULT_LEVEL_COLORS,
  branchColors: DEFAULT_BRANCH_COLORS,
  unifiedColor: DEFAULT_UNIFIED_COLOR,
  layoutType: "vertical",
  expansionStyle: "tree",
  bubbleSectionsDisconnected: false,
  rowGap: 28,
  nodeGapX: 24,
  visibleCardColors: undefined,
  nodeScale: 1,
  nodeWidthScale: 1,
  nodeHeightScale: 1,
  fontScale: 1,
  photoScale: 1,
  photoFrameScale: 1,
  photoFrameBorderWidth: 3,
  photoOffsetX: 0,
  photoOffsetY: 0,
};

export function applyArtifexGuidelineColors(
  state: ChartAppearanceState,
  mode: "byBranch" | "byLevel" | "unified" = "byBranch",
): ChartAppearanceState {
  const unified = "#21394F";
  const nextScheme: ColorScheme =
    mode === "byLevel" ? "byLevel" : mode === "unified" ? "unified" : "byBranch";
  return {
    ...state,
    colorScheme: nextScheme,
    unifiedColor: unified,
    branchColors: [...ARTIFEX_GUIDELINE_BRANCH_COLORS],
    levelColors: [...ARTIFEX_GUIDELINE_LEVEL_COLORS],
    connection: {
      ...state.connection,
      strokeColor: "#949C58",
      useBranchColorOnEdges: nextScheme === "byBranch",
    },
  };
}

const STORAGE_KEY = "org-chart-appearance";

export function loadChartAppearance(): ChartAppearanceState {
  if (typeof window === "undefined") return DEFAULT_CHART_APPEARANCE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CHART_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<ChartAppearanceState>;
    return mergeAppearance(DEFAULT_CHART_APPEARANCE, parsed);
  } catch {
    return DEFAULT_CHART_APPEARANCE;
  }
}

export function saveChartAppearance(state: ChartAppearanceState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function mergeAppearance(
  base: ChartAppearanceState,
  partial: Partial<ChartAppearanceState>,
): ChartAppearanceState {
  return {
    connection: { ...base.connection, ...partial.connection },
    nodeStyle: partial.nodeStyle ?? base.nodeStyle,
    nodeStyleByType: partial.nodeStyleByType !== undefined ? partial.nodeStyleByType : base.nodeStyleByType,
    colorScheme: partial.colorScheme ?? base.colorScheme,
    cellFields: { ...base.cellFields, ...partial.cellFields },
    levelColors: partial.levelColors?.length ? partial.levelColors : base.levelColors,
    branchColors: partial.branchColors?.length ? partial.branchColors : base.branchColors,
    unifiedColor: partial.unifiedColor ?? base.unifiedColor ?? DEFAULT_UNIFIED_COLOR,
    layoutType: partial.layoutType ?? base.layoutType ?? "vertical",
    expansionStyle: partial.expansionStyle ?? base.expansionStyle ?? "tree",
    bubbleSectionsDisconnected: partial.bubbleSectionsDisconnected ?? base.bubbleSectionsDisconnected ?? false,
    rowGap: partial.rowGap ?? base.rowGap ?? 28,
    nodeGapX: partial.nodeGapX ?? base.nodeGapX ?? 24,
    visibleCardColors: partial.visibleCardColors !== undefined ? partial.visibleCardColors : base.visibleCardColors,
    nodeScale: partial.nodeScale ?? base.nodeScale ?? 1,
    nodeWidthScale: partial.nodeWidthScale ?? base.nodeWidthScale ?? 1,
    nodeHeightScale: partial.nodeHeightScale ?? base.nodeHeightScale ?? 1,
    fontScale: partial.fontScale ?? base.fontScale ?? 1,
    photoScale: partial.photoScale ?? base.photoScale ?? 1,
    photoFrameScale: partial.photoFrameScale ?? base.photoFrameScale ?? 1,
    photoFrameBorderWidth: partial.photoFrameBorderWidth ?? base.photoFrameBorderWidth ?? 3,
    photoOffsetX: partial.photoOffsetX ?? base.photoOffsetX ?? 0,
    photoOffsetY: partial.photoOffsetY ?? base.photoOffsetY ?? 0,
  };
}

/** Vráti CSS gradient string (linear-gradient) pre danú úroveň. */
export function getLevelGradient(levelIndex: 0 | 1 | 2, state: ChartAppearanceState): string {
  const pair = state.levelColors[levelIndex] ?? state.levelColors[0];
  return `linear-gradient(90deg, ${pair[0]}, ${pair[1]})`;
}

/** Vráti farbu pre vetvu (department index). */
export function getBranchColor(branchIndex: number, state: ChartAppearanceState): string {
  const colors = state.branchColors;
  return colors[branchIndex % colors.length] ?? colors[0]!;
}

export type NodeAccent = { type: "solid"; color: string } | { type: "gradient"; gradient: string };

/** Vráti akcent (farbu alebo gradient) pre daný uzol podľa colorScheme a úrovne/vetvy. */
export function getNodeAccent(
  state: ChartAppearanceState,
  opts: {
    levelIndex?: 0 | 1 | 2;
    branchIndex?: number;
    positionType?: string;
    kat?: string | null;
  },
): NodeAccent {
  if (state.colorScheme === "unified") {
    const c = state.unifiedColor ?? DEFAULT_UNIFIED_COLOR;
    return { type: "solid", color: c };
  }
  if (state.colorScheme === "byLevel" && opts.levelIndex != null) {
    const pair = state.levelColors[opts.levelIndex] ?? state.levelColors[0];
    return { type: "gradient", gradient: `linear-gradient(90deg, ${pair[0]}, ${pair[1]})` };
  }
  if (state.colorScheme === "byBranch" && opts.branchIndex != null) {
    const c = getBranchColor(opts.branchIndex, state);
    return { type: "solid", color: c };
  }
  if (state.colorScheme === "byPosition" && (opts.kat || opts.positionType)) {
    // Caller should pass resolved brand color for position/kat
    return { type: "solid", color: "" };
  }
  return { type: "solid", color: state.unifiedColor ?? DEFAULT_UNIFIED_COLOR };
}

/** Vráti efektívny štýl uzla pre danú rolu (root / employee / stredisko). */
export function getEffectiveNodeStyle(
  state: ChartAppearanceState,
  role: NodeRole,
): NodeVisualStyle {
  const overrides = state.nodeStyleByType;
  if (overrides?.[role]) return overrides[role]!;
  return state.nodeStyle;
}
