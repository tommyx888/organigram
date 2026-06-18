// Typy pre projektový tracking (proj_* tabuľky)
// Samostatné od klasického orgchartu

export type PersonType = "internal" | "interim" | "external" | "supplier" | "tbd";
export type AssignmentStatus = "planned" | "active" | "confirmed" | "tbd" | "closed";
export type ProjectStatus = "active" | "planning" | "closed" | "on_hold";
export type ContactType = "direct" | "indirect" | null;

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  internal: "Interný (náš)",
  interim: "Interim",
  external: "Externý",
  supplier: "Dodávateľ",
  tbd: "Neobsadené (TBD)",
};

export const PERSON_TYPE_COLORS: Record<PersonType, string> = {
  internal: "#21394F",   // navy
  interim: "#0891B2",    // cyan
  external: "#7C3AED",   // fialová
  supplier: "#D97706",   // amber
  tbd: "#7C3AED",        // fialová (TBD)
};

// Farby kariet podľa lokality (home_location). Fialová = TBD / neobsadené.
// `accent` = výrazná (okraj, badge), `bg` = svetlé pozadie karty.
export type LocationColor = { accent: string; bg: string };

export const LOCATION_COLORS: Record<string, LocationColor> = {
  elmdon:  { accent: "#2563EB", bg: "#DBEAFE" }, // modrá
  uk:      { accent: "#64748B", bg: "#E2E8F0" }, // sivá
  lozorno: { accent: "#16A34A", bg: "#DCFCE7" }, // zelená
  germany: { accent: "#16A34A", bg: "#DCFCE7" }, // zelená
  taco:    { accent: "#CA8A04", bg: "#FEF9C3" }, // žltá
};

// Fialová pre TBD / neobsadené / bez lokality.
export const TBD_LOCATION_COLOR: LocationColor = { accent: "#7C3AED", bg: "#EDE9FE" };

// Vráti farbu karty podľa lokality + typu osoby + stavu.
// Pravidlá: TBD osoba ALEBO stav TBD alebo prázdna lokalita -> fialová;
// inak podľa LOCATION_COLORS; ak lokalita nie je v zozname (napr. Pune) -> null
// (volajúci použije pôvodnú farbu).
export function locationColor(
  homeLocation: string | null | undefined,
  personType?: PersonType,
  status?: AssignmentStatus,
): LocationColor | null {
  if (personType === "tbd" || status === "tbd") return TBD_LOCATION_COLOR;
  const key = (homeLocation ?? "").trim().toLowerCase();
  if (!key) return TBD_LOCATION_COLOR;
  return LOCATION_COLORS[key] ?? null;
}

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  planned: "Plánované",
  active: "Aktívne",
  confirmed: "Potvrdené",
  tbd: "TBD",
  closed: "Ukončené",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Aktívny",
  planning: "Plánovanie",
  closed: "Ukončený",
  on_hold: "Pozastavený",
};

export type ProjProject = {
  id: string;
  company_id: string | null;
  code: string;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  start_date: string | null;
  sop_date: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type ProjDepartment = {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  display_order: number;
};

export type ProjAllocation = {
  id: string;
  assignment_id: string;
  period_from: string;
  period_to: string | null;
  allocation_pct: number;
  label: string | null;
};

export type ProjAssignment = {
  id: string;
  project_id: string;
  department_id: string | null;
  iac_employee_id: string | null;
  person_name: string | null;
  position_title: string;
  person_type: PersonType;
  home_location: string | null;
  contact_type: ContactType;
  status: AssignmentStatus;
  is_placeholder: boolean;
  reports_to_id: string | null;
  is_group: boolean;
  canvas_x: number | null;
  canvas_y: number | null;
  canvas_w: number | null;
  canvas_h: number | null;
  canvas_col_span: number;
  card_color: string | null;
  overall_start_date: string | null;
  overall_end_date: string | null;
  headcount: number;
  note: string | null;
  display_order: number;
  // joined
  allocations?: ProjAllocation[];
  iac_employee?: { id: string; meno: string; funkcia_v_pz: string | null; os_c: string | null } | null;
};

export type ProjDepartmentWithAssignments = ProjDepartment & {
  assignments: ProjAssignment[];
};

// ─── Interim tracking ───
export type InterimLogStatus = "open" | "done" | "cancelled";

export const INTERIM_LOG_STATUS_LABELS: Record<InterimLogStatus, string> = {
  open: "Otvorené",
  done: "Hotové",
  cancelled: "Zrušené",
};

export type ProjInterimLog = {
  id: string;
  iac_employee_id: string | null;
  person_name: string | null;
  entry_type: string;
  title: string | null;
  body: string | null;
  status: InterimLogStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

// Jeden interim človek zoskupený naprieč projektmi (pre tracking hub).
// Kľúč = iac_employee_id ak existuje, inak person_name.
export type InterimPerson = {
  key: string;                 // iac_employee_id alebo "name:<meno>"
  iac_employee_id: string | null;
  name: string;
  // priradenia tohto interim človeka naprieč projektmi
  assignments: ProjAssignment[];
};

// ─── Position tracking (interim + TBD obsadzovanie) ───
export type CandidateStatus = "contacted" | "interview" | "selected" | "rejected";

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  contacted: "Oslovený",
  interview: "Pohovor",
  selected: "Vybraný",
  rejected: "Zamietnutý",
};

// Cieľový typ pre TBD pozíciu (kam smeruje obsadenie)
export type TargetType = "internal" | "interim";

export const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  internal: "Interná",
  interim: "Interim",
};

export type ProjPositionMeta = {
  assignment_id: string;
  target_type: TargetType | null;
  seat_location: string | null;
  recruiting_url: string | null;
  portal_it_url: string | null;
  monthly_cost_override: number | null;
  recruiting_requested: boolean;
  it_requested: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

// ─── IT žiadosť o účet (rovnaká štruktúra ako formulár v portáli, tabuľka it_account_requests) ───
export type ItAccountAction = "zriadit" | "zrusit" | "zmenit";

export const IT_ACCOUNT_ACTION_LABELS: Record<ItAccountAction, string> = {
  zriadit: "Zriadiť",
  zrusit: "Zrušiť",
  zmenit: "Zmeniť",
};

// user_section
export type ItUserSection = {
  meno: string;
  priezvisko: string;
  vzor: string;        // vzor (existujúci používateľ na napodobnenie prístupov)
  oddelenie: string;
  zaradenie: string;   // pracovné zaradenie
};

// pc (checkboxy)
export type ItPcSection = {
  desktop: boolean;
  laptop: boolean;
  ucet: boolean;
  mobil: boolean;
  dci: boolean;
};

// ibm (checkboxy)
export type ItIbmSection = {
  qad: boolean;
  as400: boolean;
  lotus: boolean;
  dci: boolean;
};

// access (textové)
export type ItAccessSection = {
  adresare: string;
  tlaciarne: string;
  ine: string;
};

export type ItAccountForm = {
  action: ItAccountAction;
  effective_from: string | null;
  supervisor_name: string | null;
  comment: string | null;
  user_section: ItUserSection;
  pc: ItPcSection;
  ibm: ItIbmSection;
  access: ItAccessSection;
};

export type ProjPositionCandidate = {
  id: string;
  assignment_id: string;
  name: string;
  agency: string | null;
  monthly_cost: number | null;
  currency: string;
  status: CandidateStatus;
  profile_url: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjPositionDocument = {
  id: string;
  assignment_id: string;
  candidate_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
};

// Pozícia na obsadenie (interim alebo TBD) s naviazanými dátami.
export type TrackedPosition = {
  assignment: ProjAssignment;
  projectName: string | null;
  meta: ProjPositionMeta | null;
  candidates: ProjPositionCandidate[];
  documents: ProjPositionDocument[];
};

// Pre výber zamestnanca z iac_employees
export type IacEmployeeOption = {
  id: string;
  meno: string;
  funkcia_v_pz: string | null;
  os_c: string | null;
  department: string | null;
};
