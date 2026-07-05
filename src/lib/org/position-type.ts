import type { KatType, PositionType } from "./types";
import { ALLOWED_KAT_VALUES } from "./types";

const allowedKatSet = new Set<string>(ALLOWED_KAT_VALUES);

/** Position type from kat_atos / kat: SAL → salaried, INDIR* → indirect, DIR → direct. */
export function mapKatToPositionType(katRaw: string): PositionType | null {
  const k = katRaw.trim().toUpperCase().replace(/\s+/g, "");
  if (!k) return null;
  if (k === "SAL" || k === "SALARIED") return "salaried";
  if (k === "DIR" || k === "DIRECT") return "direct";
  if (k === "INDIR2" || k === "INDIR3" || k.startsWith("INDIR")) return "indirect";
  return null;
}

export function mapEmployeeTypeToPositionType(value: string | undefined | null): PositionType | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("salary") || normalized.includes("salaried") || normalized === "s") {
    return "salaried";
  }
  if (normalized.includes("direct") || normalized === "d" || normalized === "dir") {
    return "direct";
  }
  if (normalized.includes("indirect") || normalized === "i" || normalized.startsWith("indir")) {
    return "indirect";
  }
  if (normalized === "internal") return "salaried";
  if (normalized === "agency") return "indirect";
  return null;
}

/**
 * Určí positionType z iac_employees stĺpcov.
 * kat_atos má prioritu, ale neznáma hodnota sa nesmie sama prepísať na indirect —
 * najprv sa skúsi stĺpec kat a employee_type.
 */
export function resolvePositionType(
  katAtos: string | undefined | null,
  kat: string | undefined | null,
  employeeType: string | undefined | null,
): PositionType | null {
  const katAtosNorm = String(katAtos ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const katNorm = String(kat ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return (
    mapKatToPositionType(katAtosNorm) ??
    mapKatToPositionType(katNorm) ??
    mapEmployeeTypeToPositionType(employeeType)
  );
}

/** KAT badge pre kartu (SAL, INDIR2, INDIR3) — kat_atos, potom kat. */
export function resolveKatBadge(
  katAtos: string | undefined | null,
  kat: string | undefined | null,
): KatType | undefined {
  const katAtosNorm = String(katAtos ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const katNorm = String(kat ?? "").trim().toUpperCase().replace(/\s+/g, "");

  if (allowedKatSet.has(katAtosNorm)) return katAtosNorm as KatType;
  if (allowedKatSet.has(katNorm)) return katNorm as KatType;
  if (mapKatToPositionType(katAtosNorm) === "salaried" || mapKatToPositionType(katNorm) === "salaried") {
    return "SAL";
  }
  return undefined;
}
