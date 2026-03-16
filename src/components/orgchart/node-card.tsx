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
  /** Mierka písma v karte. 1 = 100 %. */
  fontScale?: number;
  /** Mierka fotky/avatara v karte. 1 = 100 %. */
  photoScale?: number;
  /** Mierka rámca (kruhu) fotky. 1 = 100 %. */
  photoFrameScale?: number;
  /** Hrúbka rámu fotky v px. */
  photoFrameBorderWidth?: number;
  /** Posun fotky vo vnútri rámca (px). */
  photoOffsetX?: number;
  /** Posun fotky vo vnútri rámca (px). */
  photoOffsetY?: number;
  /** Výsledná šírka bunky v px. */
  nodeWidth?: number;
  /** Výsledná výška bunky v px. */
  nodeHeight?: number;
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
  const fontScale = Math.min(1.4, Math.max(0.8, props.fontScale ?? 1));
  const photoScale = Math.min(4.5, Math.max(0.5, props.photoScale ?? 1));
  const photoFrameScale = Math.min(3.5, Math.max(0.5, props.photoFrameScale ?? 1));
  const photoFrameBorderWidth = Math.min(8, Math.max(0, props.photoFrameBorderWidth ?? 3));
  const photoOffsetX = Math.min(80, Math.max(-80, props.photoOffsetX ?? 0));
  const photoOffsetY = Math.min(80, Math.max(-80, props.photoOffsetY ?? 0));
  const effectivePhotoScale = photoScale;
  const nodeWidth = Math.max(190, props.nodeWidth ?? 280);
  const nodeHeight = Math.max(120, props.nodeHeight ?? 160);
  const fs = (px: number) => `${Math.round(px * fontScale)}px`;
  const framePx = (px: number) => `${Math.round(px * photoFrameScale)}px`;
  const photoTransform = `translate(${photoOffsetX}px, ${photoOffsetY}px) scale(${effectivePhotoScale})`;

  if (style === "gradient") {
    return (
      <div
        className="flex flex-col items-center overflow-hidden rounded-[20px] border border-slate-200/80 bg-white"
        style={{ boxShadow: brandTokens.node.shadow, width: nodeWidth, height: nodeHeight }}
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
            <div className="relative overflow-hidden rounded-full" style={{ width: framePx(56), height: framePx(56) }}>
              <img
                src={props.photoUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-top"
                style={{ transform: photoTransform, transformOrigin: "center" }}
              />
            </div>
          ) : (
            <div className="rounded-full bg-slate-300" title={t("common.profile")} style={{ width: framePx(48), height: framePx(48) }} />
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
            <span className="text-xs font-semibold uppercase tracking-wide opacity-95" style={{ fontSize: fs(12) }}>
              {headerLabel}
            </span>
          )}
          {fields.name && (
            <p className="mt-0.5 line-clamp-2 text-base font-bold leading-snug uppercase tracking-wide" title={props.fullName} style={{ fontSize: fs(16) }}>
              {props.fullName}
            </p>
          )}
          {fields.position && (
            <p className="mt-0.5 line-clamp-2 text-sm font-medium opacity-95" title={props.positionName} style={{ fontSize: fs(14) }}>
              {props.positionName}
            </p>
          )}
          {(fields.department || fields.employeeId) && (
            <p className="mt-1 truncate text-xs opacity-80" style={{ fontSize: fs(12) }}>
              {fields.department && props.department}
              {fields.department && fields.employeeId && " · "}
              {fields.employeeId && `#${props.employeeId}`}
            </p>
          )}
          {fields.subordinateCount && props.totalSubordinateCount !== undefined && (
            <p className="mt-1 text-xs opacity-80" style={{ fontSize: fs(12) }}>
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
        className="flex items-center gap-3 overflow-hidden rounded-full border border-slate-200/90 bg-white py-1 pl-1 pr-4"
        style={{ boxShadow: brandTokens.node.shadow, width: nodeWidth, height: nodeHeight }}
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-white"
          style={{
            background: props.photoUrl ? undefined : (gradientBg ?? headerColor),
            width: framePx(48),
            height: framePx(48),
          }}
        >
          {props.photoUrl ? (
            <img
              src={props.photoUrl}
              alt=""
              className="h-full w-full object-cover object-top"
              style={{ transform: photoTransform, transformOrigin: "center" }}
            />
          ) : (
            <span className="text-lg font-bold text-white/90" style={{ fontSize: fs(18) }}>
              {props.fullName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5 py-1.5">
          {fields.name && (
            <p className="line-clamp-2 text-sm font-bold text-[var(--artifex-navy)]" title={props.fullName} style={{ fontSize: fs(14) }}>{props.fullName}</p>
          )}
          {fields.position && (
            <p className="line-clamp-2 text-xs text-slate-600" title={props.positionName} style={{ fontSize: fs(12) }}>{props.positionName}</p>
          )}
          {(fields.department || fields.employeeId) && (
            <p className="truncate text-xs text-slate-500" style={{ fontSize: fs(12) }}>
              {fields.department && props.department}
              {fields.employeeId && ` · #${props.employeeId}`}
            </p>
          )}
          {fields.subordinateCount && props.totalSubordinateCount !== undefined && (
            <p className="truncate text-xs text-slate-500" style={{ fontSize: fs(12) }}>
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
        className="flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5"
        style={{ borderRadius: brandTokens.node.borderRadius, boxShadow: brandTokens.node.shadow, width: nodeWidth, height: nodeHeight }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-white"
          style={{
            background: props.photoUrl ? undefined : (gradientBg ?? headerColor),
            width: framePx(40),
            height: framePx(40),
          }}
        >
          {props.photoUrl ? (
            <img
              src={props.photoUrl}
              alt=""
              className="h-full w-full object-cover object-top"
              style={{ transform: photoTransform, transformOrigin: "center" }}
            />
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
              fontSize: fs(12),
            }}
          >
            {headerLabel}
          </span>
          )}
          {fields.name && (
            <p className="mt-1 line-clamp-2 text-sm font-bold uppercase leading-snug text-[var(--artifex-navy)]" title={props.fullName} style={{ fontSize: fs(14) }}>
              {props.fullName}
            </p>
          )}
          {fields.position && (
            <p className="line-clamp-2 text-xs font-medium text-slate-600" title={props.positionName} style={{ fontSize: fs(12) }}>{props.positionName}</p>
          )}
          {(fields.department || fields.employeeId) && (
            <p className="mt-0.5 truncate text-xs text-slate-500" style={{ fontSize: fs(12) }}>
              {fields.department && props.department}
              {fields.employeeId && ` · #${props.employeeId}`}
            </p>
          )}
          {fields.subordinateCount && props.totalSubordinateCount !== undefined && (
            <p className="mt-0.5 text-xs text-slate-500" style={{ fontSize: fs(12) }}>
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

  if (style === "executive") {
    const accent = headerColor === "transparent" ? "#0ea5e9" : headerColor;
    return (
      <div
        className="relative overflow-hidden rounded-xl border bg-[#eef2f7]"
        style={{
          boxShadow: "0 8px 20px rgba(2, 132, 199, 0.24)",
          width: nodeWidth,
          height: nodeHeight,
          borderColor: "#22d3ee",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#22d3ee]" />
        <div className="flex h-full flex-col items-center justify-center px-3 pb-3 pt-9 text-center">
          <div className="absolute right-2 top-2 flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-[#1d4ed8] text-[8px] font-black text-white">
            in
          </div>
          <div className="absolute top-1.5">
            <div
              className="relative overflow-hidden rounded-full border-[3px] border-white shadow"
              style={{
                width: framePx(38),
                height: framePx(38),
                background: "rgb(241 245 249)",
                boxShadow: "0 3px 10px rgba(15, 23, 42, 0.35)",
                borderWidth: photoFrameBorderWidth,
              }}
            >
              {props.photoUrl ? (
                <img
                  src={props.photoUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  style={{ transform: photoTransform, transformOrigin: "center" }}
                />
              ) : null}
            </div>
          </div>
          {fields.name && (
            <p
              className="line-clamp-2 font-semibold uppercase tracking-wide text-slate-800"
              style={{ fontSize: fs(13), lineHeight: 1.15 }}
              title={props.fullName}
            >
              {props.fullName}
            </p>
          )}
          {fields.position && (
            <p
              className="mt-1 line-clamp-2 text-slate-600"
              style={{ fontSize: fs(11), lineHeight: 1.1 }}
              title={props.positionName}
            >
              {props.positionName}
            </p>
          )}
          <div className="mt-1 h-px w-16 bg-slate-300/80" />
          {fields.employeeId && <span className="mt-1 text-slate-500" style={{ fontSize: fs(10) }}>#{props.employeeId}</span>}
          <div className="mt-1 flex items-center gap-1">
            <span className="rounded bg-[#0f766e] px-1.5 py-0.5 text-[9px] text-white">1</span>
            <span className="rounded bg-[#0f766e] px-1.5 py-0.5 text-[9px] text-white">2</span>
            <span className="rounded bg-[#0f766e] px-1.5 py-0.5 text-[9px] text-white">3</span>
          </div>
          <div className="mt-1 h-0.5 w-20 rounded-full bg-[#0f766e]/70" />
          <div className="mt-1 rounded px-2 py-0.5 text-[9px] text-slate-600 underline decoration-slate-400 underline-offset-2">
            {fields.department ? props.department : "Send feedback"}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: accent }} />
        </div>
      </div>
    );
  }

  if (style === "banner") {
    const accent = headerColor === "transparent" ? "#0ea5e9" : headerColor;
    return (
      <div
        className="relative overflow-hidden rounded-xl border border-white/40 text-white"
        style={{
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.32)",
          width: nodeWidth,
          height: nodeHeight,
          background: gradientBg ?? `linear-gradient(90deg, ${accent}, #0f172a)`,
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_38%)]" />
        <div className="absolute inset-y-0 left-0 w-1.5 bg-white/30" />
        <div className="relative flex h-full items-center gap-3 px-3">
          <div
            className="relative -ml-3 shrink-0 overflow-hidden rounded-full border-[3px] border-white/85 bg-white/20"
            style={{ width: framePx(50), height: framePx(50), borderWidth: photoFrameBorderWidth }}
          >
            {props.photoUrl ? (
              <img
                src={props.photoUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-top"
                style={{ transform: photoTransform, transformOrigin: "center" }}
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            {fields.name && (
              <p className="line-clamp-2 font-bold uppercase tracking-wide" style={{ fontSize: fs(12), lineHeight: 1.05 }} title={props.fullName}>
                {props.fullName}
              </p>
            )}
            {fields.position && (
              <p className="line-clamp-2 opacity-95" style={{ fontSize: fs(10), lineHeight: 1.1 }} title={props.positionName}>
                {props.positionName}
              </p>
            )}
            {fields.department && (
              <p className="truncate opacity-85" style={{ fontSize: fs(10) }} title={props.department}>
                {props.department}
              </p>
            )}
          </div>
          <div className="self-start rounded-sm bg-white/85 px-1 py-0.5 text-[8px] font-black text-[#1d4ed8] shadow-sm">
            in
          </div>
        </div>
      </div>
    );
  }

  if (style === "hexBadge") {
    const accent = headerColor === "transparent" ? "#ec4899" : headerColor;
    return (
      <div className="relative" style={{ width: nodeWidth, height: nodeHeight }}>
        <div
          className="absolute left-1/2 top-1 z-10 -translate-x-1/2 overflow-hidden border-[3px] bg-white"
          style={{
            width: framePx(56),
            height: framePx(56),
            borderColor: accent,
            clipPath: "polygon(25% 6.7%, 75% 6.7%, 100% 50%, 75% 93.3%, 25% 93.3%, 0% 50%)",
            boxShadow: "0 6px 18px rgba(15, 23, 42, 0.25)",
            borderWidth: photoFrameBorderWidth,
          }}
        >
          {props.photoUrl ? (
            <img
              src={props.photoUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-top"
              style={{ transform: photoTransform, transformOrigin: "center" }}
            />
          ) : null}
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-[22px] border border-white/20 px-3 pb-2 pt-8 text-white"
          style={{
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.22)",
            height: Math.round(nodeHeight * 0.8),
            background: gradientBg ?? `linear-gradient(90deg, #f97316, ${accent})`,
          }}
        >
          <div className="flex items-center justify-center">
            <span
              className="rounded-full bg-white/20 px-2 py-0.5 font-semibold text-white ring-1 ring-white/35"
              style={{ fontSize: fs(10) }}
            >
              {headerLabel}
            </span>
          </div>
          {fields.name && (
            <p
              className="mt-1 line-clamp-2 text-center font-semibold"
              style={{ fontSize: fs(13), lineHeight: 1.1 }}
              title={props.fullName}
            >
              {props.fullName}
            </p>
          )}
          {fields.position && (
            <p
              className="mt-0.5 line-clamp-2 text-center text-white/90"
              style={{ fontSize: fs(10), lineHeight: 1.1 }}
              title={props.positionName}
            >
              {props.positionName}
            </p>
          )}
          {fields.employeeId && (
            <p className="mt-0.5 text-center text-[9px] text-white/80">#{props.employeeId}</p>
          )}
        </div>
      </div>
    );
  }

  if (style === "stackedCorporate") {
    const accent = headerColor === "transparent" ? "#e11d48" : headerColor;
    return (
      <div
        className="relative overflow-hidden rounded-xl border bg-[#f8fafc]"
        style={{
          width: nodeWidth,
          height: nodeHeight,
          borderColor: "#d1d5db",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.16)",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-slate-300" />
        <div className="flex h-full flex-col items-center justify-center px-3 pb-2 pt-7 text-center">
          <div
            className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full"
            style={{ background: "#94a3b8" }}
          />
          <div
            className="absolute left-1/2 top-1 -translate-x-1/2 overflow-hidden border-[3px] bg-white shadow"
            style={{
              width: framePx(40),
              height: framePx(40),
              boxShadow: "0 3px 10px rgba(15, 23, 42, 0.32)",
              background: "#e2e8f0",
              clipPath: "polygon(25% 6.7%, 75% 6.7%, 100% 50%, 75% 93.3%, 25% 93.3%, 0% 50%)",
              borderWidth: photoFrameBorderWidth,
            }}
          >
            {props.photoUrl ? (
              <img
                src={props.photoUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-top"
                style={{ transform: photoTransform, transformOrigin: "center" }}
              />
            ) : null}
          </div>
          {fields.name && (
            <p
              className="line-clamp-2 font-semibold uppercase tracking-wide text-slate-800"
              style={{ fontSize: fs(13), lineHeight: 1.1 }}
              title={props.fullName}
            >
              {props.fullName}
            </p>
          )}
          <div className="mt-1 h-4 rounded bg-white px-2 text-[9px] font-semibold leading-4 text-slate-700 shadow-sm">
            {fields.typeLabel ? headerLabel : "Lorem Ipsum"}
          </div>
          {fields.position && (
            <p
              className="mt-1 line-clamp-2 text-slate-600"
              style={{ fontSize: fs(10), lineHeight: 1.1 }}
              title={props.positionName}
            >
              {props.positionName}
            </p>
          )}
          <div className="mt-1 h-px w-20 bg-slate-300/80" />
          <div className="mt-1 flex gap-1">
            <span className="rounded px-1.5 py-0.5 text-[9px] text-white" style={{ background: accent }}>A</span>
            <span className="rounded bg-[#7c3aed] px-1.5 py-0.5 text-[9px] text-white">B</span>
            <span className="rounded bg-[#06b6d4] px-1.5 py-0.5 text-[9px] text-white">C</span>
          </div>
          <p className="mt-1 text-[9px] text-slate-500">Dolor sit amet</p>
        </div>
      </div>
    );
  }

  if (style === "classicBoard") {
    const accent = headerColor === "transparent" ? "#64748b" : headerColor;
    return (
      <div
        className="overflow-hidden rounded-xl border"
        style={{
          width: nodeWidth,
          height: nodeHeight,
          borderColor: "#9ca3af",
          background: "#f8fafc",
          boxShadow: "0 10px 22px rgba(51, 65, 85, 0.22)",
        }}
      >
        <div className="flex h-full flex-col">
          <div
            className="h-8 w-full px-3 py-1 text-white"
            style={{ background: gradientBg ?? `linear-gradient(90deg, ${accent}, #64748b)` }}
          />
          <div className="flex flex-1 items-center gap-3 px-3 py-2">
            <div
              className="relative shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-slate-100 shadow"
              style={{ width: framePx(40), height: framePx(40), borderWidth: photoFrameBorderWidth }}
            >
              {props.photoUrl ? (
                <img
                  src={props.photoUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  style={{ transform: photoTransform, transformOrigin: "center" }}
                />
              ) : null}
            </div>
            <div className="min-w-0">
              {fields.typeLabel && (
                <p className="truncate uppercase text-slate-500" style={{ fontSize: fs(9) }}>
                  {headerLabel}
                </p>
              )}
              {fields.name && (
                <p className="line-clamp-2 font-semibold text-slate-800" style={{ fontSize: fs(12), lineHeight: 1.05 }} title={props.fullName}>
                  {props.fullName}
                </p>
              )}
              {fields.position && (
                <p className="line-clamp-2 text-slate-600" style={{ fontSize: fs(10), lineHeight: 1.1 }} title={props.positionName}>
                  {props.positionName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-1.5 text-slate-500">
            <span style={{ fontSize: fs(10) }}>{fields.employeeId ? `#${props.employeeId}` : ""}</span>
            <span className="rounded px-1.5 py-0.5 text-white" style={{ fontSize: fs(9), background: accent }}>
              {fields.department ? props.department : "STAFF"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (style === "profileRibbon") {
    const accent = headerColor === "transparent" ? "#2563eb" : headerColor;
    const badgeValue =
      props.totalSubordinateCount != null
        ? `${Math.max(0, Math.min(99, props.totalSubordinateCount))}`
        : "1";
    return (
      <div className="relative" style={{ width: nodeWidth, height: nodeHeight }}>
        <div
          className="absolute inset-y-2 right-0 overflow-hidden rounded-[26px] border border-slate-200/70 bg-white"
          style={{
            left: Math.round(nodeWidth * 0.17),
            boxShadow: "0 10px 22px rgba(15,23,42,0.18)",
          }}
        >
          <div
            className="absolute left-[20%] right-[12%] top-0 h-10 rounded-b-[22px] rounded-t-[22px] text-white"
            style={{ background: `linear-gradient(90deg, ${accent}, #4f46e5)` }}
          />
          <div className="relative flex h-full flex-col px-4 pb-3 pt-2">
            {fields.name && (
              <p
                className="self-center truncate font-bold uppercase text-white"
                style={{ maxWidth: "70%", fontSize: fs(12), letterSpacing: "0.04em", lineHeight: 1.1 }}
                title={props.fullName}
              >
                {props.fullName}
              </p>
            )}
            <div className="mt-3 pl-[22%]">
              {fields.position && (
                <p
                  className="line-clamp-1 font-extrabold uppercase"
                  style={{ color: accent, fontSize: fs(11), letterSpacing: "0.02em" }}
                  title={props.positionName}
                >
                  {props.positionName}
                </p>
              )}
              <p className="mt-1 line-clamp-2 text-slate-500" style={{ fontSize: fs(10), lineHeight: 1.15 }}>
                {fields.department && props.department}
                {fields.department && fields.employeeId ? " · " : ""}
                {fields.employeeId ? `#${props.employeeId}` : ""}
              </p>
            </div>
          </div>
          <div className="absolute right-3 top-2">
            <div
              className="flex items-center justify-center rounded-full text-white"
              style={{
                width: Math.round(30 * photoFrameScale),
                height: Math.round(30 * photoFrameScale),
                background: `linear-gradient(135deg, ${accent}, #4f46e5)`,
                boxShadow: "0 4px 10px rgba(79,70,229,0.35)",
                fontSize: fs(12),
                fontWeight: 700,
              }}
            >
              {badgeValue}
            </div>
          </div>
        </div>

        <div
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 overflow-hidden rounded-full border-[7px] border-white bg-slate-100 shadow-lg"
          style={{
            width: Math.round(nodeHeight * 0.72 * photoFrameScale),
            height: Math.round(nodeHeight * 0.72 * photoFrameScale),
            borderWidth: Math.max(2, Math.round(photoFrameBorderWidth + 2)),
          }}
        >
          {props.photoUrl ? (
            <img
              src={props.photoUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-top"
              style={{ transform: photoTransform, transformOrigin: "center" }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (style === "infoPill") {
    // ── infoPill v2: veľký kruhový avatar + biela pill + meno ako malý label tag + badge s počtom ──
    const accent = headerColor === "transparent" ? "#3d5fe0" : headerColor;
    const bg = gradientBg ?? `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`;

    // Rozmery
    const avatarD      = Math.round(nodeHeight * 0.88);   // priemer vonkajšieho bieleho kruhu
    const avatarInner  = avatarD - 10;                    // priemer farebného disku
    const avatarLeft   = Math.round(-avatarD * 0.1);      // avatar presahuje doľava
    const pillLeft     = Math.round(avatarD * 0.52);      // pill začína tu
    const pillR        = nodeHeight / 2;                  // zaoblenie pill
    // meno label: malý tag na vrchu pill (nie celý header)
    const labelH       = Math.round(nodeHeight * 0.34);   // výška name labelu
    // label štartuje od začiatku pill, text je paddingom posunutý za avatar
    const labelLeft    = 0;                               // label začína od okraja pill
    const labelPadL    = Math.round(avatarD * 0.52) + 10; // text začína za stredom avatara
    const bodyTop      = labelH + 4;                      // obsah pod labelom
    const badgeD       = Math.round(nodeHeight * 0.30);   // badge s počtom podriadených — trochu väčší
    // +50 % písmo pre infoPill — aplikuje sa na všetky fs() volania nižšie
    const fsP = (px: number) => `${Math.round(px * fontScale * 1.5)}px`;

    const subCount = props.totalSubordinateCount;

    return (
      <div className="relative" style={{ width: nodeWidth, height: nodeHeight }}>

        {/* ── BIELA PILL — základ ── */}
        <div
          className="absolute"
          style={{
            left: pillLeft,
            top: 0, right: 0, bottom: 0,
            background: "#ffffff",
            borderRadius: pillR,
            boxShadow: "0 8px 28px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
          }}
        />

        {/* ── MENO — malý farebný label tag na vrchu pill ── */}
        {fields.name && (
          <div
            className="absolute overflow-hidden flex items-center"
            style={{
              left: pillLeft + labelLeft,
              top: Math.round(nodeHeight * 0.06),
              right: badgeD / 2 + 14,
              height: labelH,
              background: bg,
              borderRadius: `${labelH / 2}px`,
              paddingLeft: labelPadL,
              paddingRight: 10,
              zIndex: 5,
              boxShadow: `0 3px 12px ${accent}40`,
            }}
          >
            {/* gloss */}
            <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 60%)" }} />
            <span
              className="relative truncate font-black uppercase text-white"
              style={{ fontSize: fsP(12), letterSpacing: "0.08em", zIndex: 1 }}
              title={props.fullName}
            >
              {props.fullName}
            </span>
          </div>
        )}

        {/* ── OBSAH — pozícia, oddelenie, emp ID ── */}
        <div
          className="absolute flex flex-col justify-center"
          style={{
            left: pillLeft + labelPadL,
            top: bodyTop + Math.round(nodeHeight * 0.06),
            right: 18,
            bottom: Math.round(nodeHeight * 0.08),
            gap: 3,
            zIndex: 5,
          }}
        >
          {fields.position && (
            <p
              className="truncate font-extrabold uppercase"
              style={{ color: accent, fontSize: fsP(11), letterSpacing: "0.05em", lineHeight: 1.1 }}
              title={props.positionName}
            >
              {props.positionName}
            </p>
          )}
          {(fields.department || fields.employeeId) && (
            <p className="truncate text-slate-400" style={{ fontSize: fsP(9), lineHeight: 1.4 }}>
              {fields.department && props.department}
              {fields.department && fields.employeeId ? " · " : ""}
              {fields.employeeId && `#${props.employeeId}`}
            </p>
          )}
          {fields.typeLabel && (
            <span
              className="inline-block self-start rounded-full font-bold uppercase tracking-wide text-white"
              style={{
                background: accent,
                fontSize: fsP(8),
                padding: `2px 8px`,
                lineHeight: 1.5,
                marginTop: 1,
              }}
            >
              {headerLabel}
            </span>
          )}
        </div>

        {/* ── AVATAR KRUH — vľavo, vertikálne centrovaný ── */}
        <div
          className="absolute"
          style={{
            left: avatarLeft,
            top: "50%",
            transform: "translateY(-50%)",
            width: avatarD,
            height: avatarD,
            borderRadius: "50%",
            background: "#ffffff",
            boxShadow: `0 6px 20px ${accent}44, 0 0 0 3px #fff`,
            zIndex: 10,
          }}
        >
          {/* farebný disk */}
          <div
            style={{
              position: "absolute",
              inset: 4,
              borderRadius: "50%",
              background: bg,
              overflow: "hidden",
            }}
          >
            {props.photoUrl ? (
              /* fotka — kruhový orez, cover */
              <img
                src={props.photoUrl}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center top",
                  transform: photoTransform,
                  transformOrigin: "center",
                  borderRadius: "50%",
                }}
              />
            ) : (
              /* fallback SVG ikona */
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg
                  width={Math.round(avatarInner * 0.5)}
                  height={Math.round(avatarInner * 0.5)}
                  viewBox="0 0 40 46"
                  fill="none"
                  aria-hidden
                >
                  <ellipse cx="20" cy="13" rx="8.5" ry="9.5" fill="rgba(255,255,255,0.9)" />
                  <path d="M2 44c0-9.941 8.059-16 18-16s18 6.059 18 16" fill="rgba(255,255,255,0.85)" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* ── BADGE — počet podriadených, pravý horný roh ── */}
        {fields.subordinateCount && subCount !== undefined && (
          <div
            className="absolute flex items-center justify-center font-black text-white"
            style={{
              top: -Math.round(badgeD * 0.1),
              right: -Math.round(badgeD * 0.1),
              width: badgeD,
              height: badgeD,
              borderRadius: "50%",
              background: bg,
              border: "3px solid #fff",
              boxShadow: `0 3px 10px ${accent}55`,
              fontSize: fsP(subCount !== undefined && subCount > 99 ? 8 : 10),
              zIndex: 20,
            }}
          >
            {subCount}
          </div>
        )}
      </div>
    );
  }

  // card (default) – jedna osoba, čisté linie, dostatok medzier
  return (
    <div
      className="w-full overflow-hidden rounded-[18px] border border-slate-200/90 bg-white"
      style={{ boxShadow: brandTokens.node.shadow, width: nodeWidth, height: nodeHeight }}
    >
      <div
        className="flex min-h-[44px] items-center justify-between gap-2 px-4 py-2.5 text-white"
        style={{
          background: gradientBg ?? headerColor,
        }}
      >
        {props.photoUrl ? (
          <div
            className="relative shrink-0 overflow-hidden rounded-full border-2 border-white/50"
            style={{ width: framePx(32), height: framePx(32), borderWidth: photoFrameBorderWidth }}
          >
            <img
              src={props.photoUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-top"
              style={{ transform: photoTransform, transformOrigin: "center" }}
            />
          </div>
        ) : null}
        {fields.typeLabel ? (
          <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide" style={{ fontSize: fs(12) }}>{headerLabel}</span>
        ) : null}
        {fields.employeeId ? <span className="shrink-0 text-xs opacity-90" style={{ fontSize: fs(12) }}>#{props.employeeId}</span> : null}
      </div>
      <div className="space-y-1.5 px-4 py-3.5">
        {fields.name && (
          <p className="line-clamp-2 min-h-[2.25rem] text-base leading-snug font-semibold text-[var(--artifex-navy)]" title={props.fullName} style={{ fontSize: fs(16) }}>
            {props.fullName}
          </p>
        )}
        {fields.position && (
          <p className="line-clamp-2 min-h-[1.25rem] text-sm leading-snug text-slate-600" title={props.positionName} style={{ fontSize: fs(14) }}>
            {props.positionName}
          </p>
        )}
        {fields.department && (
          <p className="truncate text-xs text-slate-500" title={props.department} style={{ fontSize: fs(12) }}>{props.department}</p>
        )}
        {fields.subordinateCount && props.totalSubordinateCount !== undefined && (
          <p className="truncate text-xs text-slate-500" title={t("common.totalSubordinatesTitle")} style={{ fontSize: fs(12) }}>
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
