/**
 * Typ payloadu nastavení organigramu uloženého v DB (org_chart_settings.payload).
 * Admin môže meniť; ostatní len čítajú a môžu sa "hrať" s kópiou v lokálnom state.
 */

import type { ChartAppearanceState } from "@/lib/org/chart-appearance";
import type { VacancyPlaceholder, SectionGroup } from "@/lib/org/types";

export type MaxVisibleLayers = 1 | 2 | 3 | 4 | 5 | 6;

export type CustomStredisko = { id: string; name: string };

export interface OrgChartSettingsPayload {
  generalManagerId?: string | null;
  vacancies?: VacancyPlaceholder[];
  maxVisibleLayers?: MaxVisibleLayers;
  appearance?: ChartAppearanceState;
  positions?: Record<string, { x: number; y: number }>;
  positionsLocked?: boolean;
  collapsedNodes?: string[];
  visibleStrediska?: string[] | null;
  customStrediska?: CustomStredisko[];
  strediskoColors?: Record<string, string>;
  hiddenStrediska?: string[];
  employeeColors?: Record<string, string>;
  /** Individuálne posuny fotiek: employee_id -> { x, y } (px). */
  employeePhotoOffsets?: Record<string, { x: number; y: number }>;
  /** Farby pre kategórie KAT (SAL, INDIR1, INDIR2, INDIR3…) – prepisujú východzie z brand tokens. */
  katColors?: Record<string, string>;
  employeeChildLayout?: Record<string, string>;
  /** Poradie priamych podriadených pod každým nadriadeným (parentId -> ordered child IDs). */
  childOrderByParent?: Record<string, string[]>;
  rightPanelCollapsed?: boolean;
  leftSidebarCollapsed?: boolean;
  hierarchySidebarCollapsed?: boolean;
  /** Vybraté oddelenie pre zobrazenie (kľúč z MAIN_DEPARTMENTS alebo "all"). */
  selectedDepartment?: string;
  /** Manažér oddelenia: názov oddelenia -> employee_id. */
  departmentManagers?: Record<string, string>;
  /** Sekcie / skupiny zamestnancov v orgcharte. */
  sectionGroups?: SectionGroup[];
}
