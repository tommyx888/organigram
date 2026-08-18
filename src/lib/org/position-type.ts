import type { KatType, PositionType } from "./types";

/** Normalizuje kat_atos / kat na SAL, INDIR1–3 alebo DIR. */
export function normalizeKat(raw: string | null | undefined): KatType | undefined {
  const k = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!k) return undefined;
  if (k === "SAL" || k === "SALARIED") return "SAL";
  if (k === "DIR" || k === "DIRECT") return "DIR";
  if (k === "INDIR3" || k === "INDIRECT3") return "INDIR3";
  if (k === "INDIR2" || k === "INDIRECT2") return "INDIR2";
  if (k === "INDIR1" || k === "INDIRECT1" || k === "INDIR" || k === "INDIRECT") return "INDIR1";
  if (k.startsWith("INDIR")) return "INDIR1";
  return undefined;
}

/** Position type from kat_atos / kat: SAL → salaried, INDIR* → indirect, DIR → direct. */
export function mapKatToPositionType(katRaw: string): PositionType | null {
  const kat = normalizeKat(katRaw);
  if (!kat) return null;
  if (kat === "SAL") return "salaried";
  if (kat === "DIR") return "direct";
  return "indirect";
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

/** KAT badge pre kartu (SAL, INDIR1–3, DIR) — kat_atos, potom kat. */
export function resolveKatBadge(
  katAtos: string | undefined | null,
  kat: string | undefined | null,
): KatType | undefined {
  return normalizeKat(katAtos) ?? normalizeKat(kat);
}

/** Kategória pre filter a farby: uložené KAT, inak odvodené z positionType. */
export function getDisplayKat(record: {
  kat?: KatType | null;
  positionType: PositionType;
}): KatType {
  if (record.kat) return record.kat;
  if (record.positionType === "salaried") return "SAL";
  if (record.positionType === "direct") return "DIR";
  return "INDIR1";
}
