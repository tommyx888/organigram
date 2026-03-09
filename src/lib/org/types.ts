export type PositionType = "salaried" | "indirect" | "direct";

/** KAT values shown in org chart; only these are loaded. */
export type KatType = "INDIR2" | "INDIR3" | "SAL";

export const ALLOWED_KAT_VALUES: KatType[] = ["INDIR2", "INDIR3", "SAL"];

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
  /** KAT from source; only INDIR2, INDIR3, SAL are loaded and displayed. */
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
};
