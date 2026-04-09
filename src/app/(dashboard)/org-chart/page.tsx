"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ErrorFallback } from "@/components/error-fallback";
import { canEdit, useAuthContext } from "@/components/auth/auth-context";
import { OrgChartCanvas } from "@/components/orgchart/org-chart-canvas";
import { useTranslation } from "@/lib/i18n/context";
import { OrgChartSettingsProvider, useOrgChartSettings } from "@/components/orgchart/org-chart-settings-context";
import type { OrgChartSettingsPayload } from "@/lib/org/org-chart-settings-types";
import { getShareableViewStateFromSearch } from "@/lib/org/shareable-view-state";
import { getEmployeeRecords, saveEmployeeRecords } from "@/lib/org/repository";
import { isSupabasePublicConfigured } from "@/lib/supabase/client";
import type { EmployeeRecord } from "@/lib/org/types";

const UNDO_STACK_MAX = 50;

type UndoEntry =
  | { records: EmployeeRecord[] }
  | { settings: OrgChartSettingsPayload };

function OrgChartContent({
  records,
  allowEdit,
  onRecordsChange,
  onRestoreRecords,
  onPhotoChanged,
  initialShareableViewState,
}: {
  records: EmployeeRecord[];
  allowEdit: boolean;
  onRecordsChange: (next: EmployeeRecord[]) => Promise<void>;
  onRestoreRecords: (prev: EmployeeRecord[]) => void;
  onPhotoChanged?: () => void;
  initialShareableViewState?: { viewport?: { x: number; y: number; zoom: number }; collapsedNodes?: string[] } | null;
}) {
  const auth = useAuthContext();
  const settingsCtx = useOrgChartSettings();
  const useDbSettings =
    Boolean(isSupabasePublicConfigured && auth.authenticated && settingsCtx);
  const useDbPhotos = Boolean(isSupabasePublicConfigured && auth.authenticated);

  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const recordsRef = useRef(records);
  recordsRef.current = records;

  const pushUndo = useCallback((entry: UndoEntry) => {
    setUndoStack((prev) => {
      const next = [...prev, entry];
      return next.length > UNDO_STACK_MAX ? next.slice(-UNDO_STACK_MAX) : next;
    });
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    queueMicrotask(() => {
      if ("records" in entry) {
        onRestoreRecords(entry.records);
      } else if ("settings" in entry && settingsCtx?.replaceSettingsForUndo) {
        void settingsCtx.replaceSettingsForUndo(entry.settings);
      }
    });
  }, [undoStack, onRestoreRecords, settingsCtx]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
        e.preventDefault();
        if (undoStack.length > 0) undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undoStack.length, undo]);

  const wrappedOnRecordsChange = useCallback(
    (next: EmployeeRecord[]) => {
      pushUndo({ records: recordsRef.current });
      void onRecordsChange(next);
    },
    [pushUndo, onRecordsChange],
  );

  const wrappedOnSettingsChange = useCallback(
    (partial: Partial<OrgChartSettingsPayload>) => {
      if (settingsCtx) {
        pushUndo({ settings: settingsCtx.settings });
        void settingsCtx.saveSettings(partial);
      }
    },
    [pushUndo, settingsCtx],
  );

  const { t } = useTranslation();

  if (useDbSettings && settingsCtx?.isLoading) {
    return <p className="text-sm text-slate-500">{t("orgChart.loadingSettings")}</p>;
  }

  const isAdmin = settingsCtx?.isAdmin ?? false;

  // Admin: vsetky zmeny idu do DB a vsetci ich vidia
  // Non-admin: onSettingsChange=undefined - cita nastavenia z DB (initialSettings)
  //            ale nemoze ich menit; drag/collapse stav sa neuklada (read-only session)
  const settingsChangeHandler = useDbSettings && settingsCtx && isAdmin
    ? wrappedOnSettingsChange
    : undefined;

  return (
    <OrgChartCanvas
      records={records}
      allowEdit={allowEdit}
      onRecordsChange={wrappedOnRecordsChange}
      initialSettings={useDbSettings && settingsCtx ? settingsCtx.settings : null}
      onSettingsChange={settingsChangeHandler}
      onResetToDefaults={
        useDbSettings && settingsCtx && isAdmin ? settingsCtx.resetSettingsToDefaults : undefined
      }
      useDbPhotos={useDbPhotos}
      onPhotoChanged={onPhotoChanged}
      initialShareableViewState={initialShareableViewState}
    />
  );
}

export default function OrgChartPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const auth = useAuthContext();
  const allowEdit = canEdit(auth.role);
  const [records, setRecords] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"iac_employees" | "employees" | "local">("local");

  const initialShareableViewState = getShareableViewStateFromSearch(searchParams.toString());

  async function loadData() {
    setLoading(true);
    const result = await getEmployeeRecords("live");
    setRecords(result.records);
    setDataSource(result.source);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-8 md:px-10">
      <section className="mx-auto max-w-[1720px] space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-[var(--artifex-navy)]">{t("orgChart.pageTitle")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{t("orgChart.pageDesc")}</p>
          <p className="mt-2 text-xs text-slate-500">
            Data mode: {isSupabasePublicConfigured ? t("dashboard.dataModeSupabase") : t("dashboard.dataModeLocal")} ·
            Source: {dataSource}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t("auth.role")}: {allowEdit ? t("dashboard.accessEdit") : t("dashboard.accessReadOnly")}
            {isSupabasePublicConfigured && auth.authenticated && auth.role !== "admin" && (
              <> · {t("dashboard.settingsLocalNote")}</>
            )}
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-slate-500">{t("orgChart.loadingData")}</p>
        ) : (
          <ErrorFallback>
            <OrgChartSettingsProvider>
              <OrgChartContent
                records={records}
                allowEdit={allowEdit}
                onRecordsChange={async (next) => {
                  setRecords(next);
                  await saveEmployeeRecords(next);
                }}
                onRestoreRecords={(prev) => {
                  setRecords(prev);
                  void saveEmployeeRecords(prev);
                }}
                onPhotoChanged={loadData}
                initialShareableViewState={initialShareableViewState}
              />
            </OrgChartSettingsProvider>
          </ErrorFallback>
        )}
      </section>
    </main>
  );
}
