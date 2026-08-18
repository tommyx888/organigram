export type PositionType = "salaried" | "indirect" | "direct";

/** KAT values used for display, colours and the category filter. */
export type KatType = "SAL" | "INDIR3" | "INDIR2" | "INDIR1" | "DIR";

export const ALLOWED_KAT_VALUES: KatType[] = ["SAL", "INDIR3", "INDIR2", "INDIR1", "DIR"];

/** Poradie v nastaveniach: Salaried, Indirect 3, Indirect 2, Indirect 1, Direct. */
export const DISPLAY_KAT_CATEGORIES: readonly KatType[] = [
  "SAL",
  "INDIR3",
  "INDIR2",
  "INDIR1",
  "DIR",
];

export type EmployeeRecord = {
  employeeId: string;
  fullName: string;
  department: string;
  /** Názov oddelenia podľa stĺpca department; zobrazuje sa vedľa čísla strediska. */
  departmentName?: string | null;
  /** Názov oddelenia (zo zdroja odd); zobrazuje sa pri stredisku ak nie je departmentName. */
  oddelenie?: string | null;
  positionType: PositionType;
  positionName: string;
  managerEmployeeId?: string | null;
  /** KAT from source (SAL, INDIR1–3, DIR). */
  kat?: KatType | null;
  /** URL fotky (z Supabase Storage alebo lokálne); trvalo uložené pri zdroji employees. */
  photoUrl?: string | null;
};

export type ImportIssue = {
  row: number;
  level: "error" | "warning";
  message: string;
  code:
    | "missing_employee_id"
    | "missing_employee_name"
    | "duplicate_employee_id"
    | "missing_manager_name"
    | "ambiguous_manager_name"
    | "self_reference"
    | "cycle_detected"
    | "unknown_position_type"
    | "inactive_skipped"
    | "source_unavailable"
    | "empty_remote_dataset";
};

export type OrgImportResult = {
  records: EmployeeRecord[];
  issues: ImportIssue[];
};

export type OrgSource = "iac_employees" | "employees" | "local";

export type SourceAttempt = {
  source: OrgSource;
  ok: boolean;
  rowCount: number;
  reason?: string;
};

export type OrgDataLoadResult = {
  records: EmployeeRecord[];
  issues: ImportIssue[];
  source: OrgSource;
  mode: "live" | "fallback";
  requestId: string;
  attempts: SourceAttempt[];
  finalReason: string;
};

/** Voľná pozícia (vacancy) – nie je v DB, ľudia sa na ňu napájajú cez managerEmployeeId. */
export type VacancyPlaceholder = {
  id: string;
  title: string;
  /** Id nadriadeného – employee_id alebo id inej vacancy. */
  parentId: string | null;
  /** Meno kandidáta (ak je už vybraný). */
  candidateName?: string | null;
  /** Plánovaný dátum nástupu (ISO date string). */
  startDate?: string | null;
  /** Kategória pozície (napr. SAL, DIR, INDIR). */
  category?: string | null;
};

/**
 * Sekcia / skupina – vizuálny kontajner ktorý zoskupuje zamestnancov pod pomenovanú skupinu.
 * Zobrazuje sa ako špeciálna karta v orgcharte; zamestnanci sa do nej priradia cez memberIds.
 */
export type SectionGroup = {
  /** Unikátny identifikátor sekcie, prefix "section-" */
  id: string;
  /** Názov sekcie, napr. "Batch procesy" */
  name: string;
  /** Id nadriadeného uzla (employee_id, vacancy_id, alebo iný section_id) */
  parentId: string | null;
  /** Farba sekcie (hex, napr. "#21394F") */
  color?: string;
  /** Emoji/ikona sekcie */
  icon?: string;
};
