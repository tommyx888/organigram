"use client";

import { useEffect, useMemo, useState } from "react";

import { canEdit, useAuthContext } from "@/components/auth/auth-context";
import { JobDescriptionEditor } from "@/components/job-description/job-description-editor";
import { useTranslation } from "@/lib/i18n/context";
import {
  getJobDescriptions,
  updateJobDescriptionStatus,
  upsertJobDescription,
} from "@/lib/job-descriptions/repository";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { JobDescriptionRecord, JobDescriptionStatus } from "@/lib/job-descriptions/types";

export default function JobDescriptionsPage() {
  const { t } = useTranslation();
  const auth = useAuthContext();
  const allowEdit = canEdit(auth.role);
  const [records, setRecords] = useState<JobDescriptionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadRecords() {
      const data = await getJobDescriptions();
      setRecords(data);
      setSelectedId(data[0]?.id ?? "");
    }

    void loadRecords();
  }, []);

  const selectedRecord = useMemo(() => {
    return records.find((record) => record.id === selectedId) ?? records[0] ?? null;
  }, [records, selectedId]);

  async function handleSave() {
    if (!selectedRecord || !allowEdit) {
      return;
    }

    setSaving(true);
    const nextVersion = selectedRecord.status === "approved" ? selectedRecord.version + 1 : selectedRecord.version;
    const next = await upsertJobDescription({ ...selectedRecord, version: nextVersion });
    setRecords(next);
    setSaving(false);
  }

  async function handleStatusChange(status: JobDescriptionStatus) {
    if (!selectedRecord || !allowEdit) {
      return;
    }
    const next = await updateJobDescriptionStatus(selectedRecord.id, status);
    setRecords(next);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 md:px-10">
      <section className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-[var(--artifex-navy)]">{t("jobDescriptions.pageTitle")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("jobDescriptions.pageDesc")}</p>
          <p className="mt-2 text-xs text-slate-500">
            Data mode: {isSupabaseConfigured ? t("dashboard.dataModeSupabaseFallback") : t("dashboard.dataModeLocal")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t("auth.role")}: {allowEdit ? t("dashboard.accessEdit") : t("dashboard.accessReadOnly")}
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">{t("jobDescriptions.assignedPositions")}</h2>
          <ul className="space-y-2">
            {records.map((position) => (
              <li
                key={position.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{position.positionTitle}</p>
                  <p className="text-xs text-slate-500">
                    {position.positionCode} · v{position.version}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">
                    {position.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedId(position.id)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    {allowEdit ? t("jobDescriptions.edit") : t("jobDescriptions.view")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {selectedRecord ? (
          <JobDescriptionEditor
            draft={selectedRecord}
            onChange={(draft) =>
              setRecords((prev) => prev.map((record) => (record.id === draft.id ? draft : record)))
            }
            readOnly={!allowEdit}
            onSave={handleSave}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <p className="text-sm text-slate-500">{t("jobDescriptions.loading")}</p>
        )}
        {saving ? <p className="text-xs text-slate-500">{t("jobDescriptions.saving")}</p> : null}
      </section>
    </main>
  );
}
