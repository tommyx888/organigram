"use client";

import type { KatType, PositionType } from "@/lib/org/types";
import type { CellFieldsConfig, NodeAccent, NodeVisualStyle } from "@/lib/org/chart-appearance";
import { brandTokens } from "@/styles/tokens";
import { useTranslation } from "@/lib/i18n/context";

const TYPE_KEYS: Record<PositionType, string> = {
  salaried: "orgChart.positionTypeSalaried",
  indirect: "orgChart.positionTypeIndirect",
  direct: "orgChart.positionTypeDirect",
};

export type NodeCardProps = {
  fullName: string;
  positionName: string;
  department: string;
  employeeId: string;
  positionType: PositionType;
  kat?: KatType | null;
  /** Čo zobrazovať – ak nie je predané, zobrazí sa všetko. */
  cellFields?: Partial<CellFieldsConfig> | null;
  nodeStyle?: NodeVisualStyle;
  /** Akcent farba/gradient pre hlavičku; ak nie je, použije sa KAT/position. */
  accent?: NodeAccent | null;
  /** URL fotky (data URL alebo externá) – zobrazí sa ako avatar. */
  photoUrl?: string | null;
  /** Celkový počet podriadených (ľudí pod týmto človekom v strome). */
  totalSubordinateCount?: number;
  /** Farby KAT z nastavení (pre fallback keď accent nie je solid). */
  effectiveKatColors?: Record<string, string>;
};

function getHeaderColor(
  accent: NodeAccent | null,
  kat: KatType | null,
  positionType: PositionType,
  effectiveKatColors?: Record<string, string>,
): string {
  if (accent?.type === "solid" && accent.color) return accent.color;
  if (accent?.type === "gradient") return "transparent";
  const katColors = effectiveKatColors ?? (brandTokens.katColors as Record<string, string>);
  return kat && katColors[kat]
    ? katColors[kat]
    : brandTokens.positionTypeColors[positionType];
}

function getHeaderLabel(kat: KatType | null, positionType: PositionType, t: (key: string) => string): string {
  return kat ?? t(TYPE_KEYS[positionType]);
}

export function NodeCard(props: NodeCardProps) {
  const { t } = useTranslation();
  const fields = props.cellFields ?? {
    name: true,
    position: true,
    department: true,
    employeeId: true,
    typeLabel: true,
  };
  const style = props.nodeStyle ?? "card";
  const headerColor = getHeaderColor(
    props.accent ?? null,
    props.kat ?? null,
    props.positionType,
    props.effectiveKatColors,
  );
  const headerLabel = getHeaderLabel(props.kat ?? null, props.positionType, t);
  const gradientBg =
    props.accent?.type === "gradient" ? props.accent.gradient : null;
  const useGradient = Boolean(gradientBg);

  if (style === "gradient") {
    return (
      <div
        className="flex flex-col items-center overflow-hidden rounded-[20px] border border-slate-200/80 bg-white"
        style={{ boxShadow: brandTokens.node.shadow, minWidth: 200 }}
      >
        <div
          className="relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden border-2 border-slate-200/60"
          style={{
            backgroundColor: "rgb(226 232 240)",
            clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            marginBottom: -8,
            zIndex: 1,
          }}
        >
          {props.photoUrl ? (
            <img src={props.photoUrl} alt="" className="h-14 w-14 object-cover object-top rounded-full" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-slate-300" title={t("common.profile")} />
          )}
        </div>
        <div
          className="flex w-full flex-col rounded-2xl px-4 pb-3 pt-5 text-white"
          style={{
            background: gradientBg ?? headerColor,
            borderRadius: 16,
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
          }}
        >
          {fields.typeLabel && (
            <span className="text-xs font-semibold uppercase tracking-wide opacity-95">
              {headerLabel}
            </span>
          )}
          {fields.name && (
            <p className="mt-0.5 line-clamp-2 text-base font-bold leading-snug uppercase tracking-wide" title={props.fullName}>
              {props.fullName}
            </p>
          )}
          {fields.position && (
            <p className="mt-0.5 line-clamp-2 text-sm font-medium opacity-95" title={props.positionName}>
              {props.positionName}
            </p>
          )}
          {(fields.department || fields.employeeId) && (
            <p className="mt-1 truncate text-xs opacity-80">
              {fields.department && props.department}
              {fields.department && fields.employeeId && " · "}
              {fields.employeeId && `#${props.employeeId}`}
            </p>
          )}
          {fields.subordinateCount && props.totalSubordinateCount !== undefined && (
            <p className="mt-1 text-xs opacity-80">
              {props.totalSubordinateCount === 0
                ? t("common.noSubordinates")
                : props.totalSubordinateCount === 1
                  ? "1 podriadený"
                  : `${props.totalSubordinateCount} podriadených`}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (style === "pill") {
    return (
      <div
        className="flex min-w-[240px] items-center gap-3 overflow-hidden rounded-full border border-slate-200/90 bg-white py-1 pl-1 pr-4"
        style={{ boxShadow: brandTokens.node.shadow }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-white"
          style={{
            background: props.photoUrl ? undefined : (gradientBg ?? headerColor),
          }}
        >
          {props.photoUrl ? (
            <img src={props.photoUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <span className="text-lg font-bold text-white/90">
              {props.fullName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5 py-1.5">
          {fields.name && (
            <p className="line-clamp-2 text-sm font-bold text-[var(--artifex-navy)]" title={props.fullName}>{props.fullName}</p>
          )}
          {fields.position && (
            <p className="line-clamp-2 text-xs text-slate-600" title={props.positionName}>{props.positionName}</p>
          )}
          {(fields.department || fields.employeeId) && (
            <p className="truncate text-xs text-slate-500">
              {fields.department && props.department}
              {fields.employeeId && ` · #${props.employeeId}`}
            </p>
          )}
          {fields.subordinateCount && props.totalSubordinateCount !== undefined && (
            <p className="truncate text-xs text-slate-500">
              {props.totalSubordinateCount === 0
                ? t("common.noSubordinates")
                : props.totalSubordinateCount === 1
                  ? "1 podriadený"
                  : `${props.totalSubordinateCount} podriadených`}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (style === "bubble") {
    return (
      <div
        className="flex min-w-[200px] items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5"
        style={{ borderRadius: brandTokens.node.borderRadius, boxShadow: brandTokens.node.shadow }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-white"
          style={{
            background: props.photoUrl ? undefined : (gradientBg ?? headerColor),
          }}
        >
          {props.photoUrl ? (
            <img src={props.photoUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {fields.typeLabel && (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-white"
            style={{
              background: gradientBg ?? headerColor,
            }}
          >
            {headerLabel}
          </span>
          )}
          {fields.name && (
            <p className="mt-1 line-clamp-2 text-sm font-bold uppercase leading-snug text-[var(--artifex-navy)]" title={props.fullName}>
              {props.fullName}
            </p>
          )}
          {fields.position && (
            <p className="line-clamp-2 text-xs font-medium text-slate-600" title={props.positionName}>{props.positionName}</p>
          )}
          {(fields.department || fields.employeeId) && (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {fields.department && props.department}
              {fields.employeeId && ` · #${props.employeeId}`}
            </p>
          )}
          {fields.subordinateCount && props.totalSubordinateCount !== undefined && (
            <p className="mt-0.5 text-xs text-slate-500">
              {props.totalSubordinateCount === 0
                ? t("common.noSubordinates")
                : props.totalSubordinateCount === 1
                  ? "1 podriadený"
                  : `${props.totalSubordinateCount} podriadených`}
            </p>
          )}
        </div>
      </div>
    );
  }

  // card (default) – jedna osoba, čisté linie, dostatok medzier
  return (
    <div
      className="w-full max-w-[280px] overflow-hidden rounded-[18px] border border-slate-200/90 bg-white"
      style={{ boxShadow: brandTokens.node.shadow }}
    >
      <div
        className="flex min-h-[44px] items-center justify-between gap-2 px-4 py-2.5 text-white"
        style={{
          background: gradientBg ?? headerColor,
        }}
      >
        {props.photoUrl ? (
          <img src={props.photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover object-top border-2 border-white/50" />
        ) : null}
        {fields.typeLabel ? (
          <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide">{headerLabel}</span>
        ) : null}
        {fields.employeeId ? <span className="shrink-0 text-xs opacity-90">#{props.employeeId}</span> : null}
      </div>
      <div className="space-y-1.5 px-4 py-3.5">
        {fields.name && (
          <p className="line-clamp-2 min-h-[2.25rem] text-base leading-snug font-semibold text-[var(--artifex-navy)]" title={props.fullName}>
            {props.fullName}
          </p>
        )}
        {fields.position && (
          <p className="line-clamp-2 min-h-[1.25rem] text-sm leading-snug text-slate-600" title={props.positionName}>
            {props.positionName}
          </p>
        )}
        {fields.department && (
          <p className="truncate text-xs text-slate-500" title={props.department}>{props.department}</p>
        )}
        {fields.subordinateCount && props.totalSubordinateCount !== undefined && (
          <p className="truncate text-xs text-slate-500" title={t("common.totalSubordinatesTitle")}>
            {props.totalSubordinateCount === 0
              ? t("common.noSubordinates")
              : props.totalSubordinateCount === 1
                ? "1 podriadený"
                : `${props.totalSubordinateCount} podriadených`}
          </p>
        )}
      </div>
    </div>
  );
}
