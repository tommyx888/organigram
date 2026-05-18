"use client";

import type { JobDescriptionRecord, JobDescriptionStatus } from "@/lib/job-descriptions/types";

type JobDescriptionEditorProps = {
  draft: JobDescriptionRecord;
  readOnly?: boolean;
  onChange: (draft: JobDescriptionRecord) => void;
  onSave: () => void;
  onStatusChange: (status: JobDescriptionStatus) => void;
};

export function JobDescriptionEditor(props: JobDescriptionEditorProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Job Description Editor</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
          State: {props.draft.status}
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          Position Code
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={props.draft.positionCode}
            disabled={props.readOnly}
            onChange={(event) => props.onChange({ ...props.draft, positionCode: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          Position Title
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={props.draft.positionTitle}
            disabled={props.readOnly}
            onChange={(event) => props.onChange({ ...props.draft, positionTitle: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4">
        <Field
          label="Responsibilities"
          value={props.draft.responsibilities}
          readOnly={props.readOnly}
          onChange={(value) => props.onChange({ ...props.draft, responsibilities: value })}
        />
        <Field
          label="Requirements"
          value={props.draft.requirements}
          readOnly={props.readOnly}
          onChange={(value) => props.onChange({ ...props.draft, requirements: value })}
        />
        <Field
          label="KPIs"
          value={props.draft.kpi}
          readOnly={props.readOnly}
          onChange={(value) => props.onChange({ ...props.draft, kpi: value })}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg bg-[var(--artifex-navy)] px-4 py-2 text-sm font-semibold text-white"
          disabled={props.readOnly}
          onClick={props.onSave}
        >
          Save draft
        </button>
        <button
          type="button"
          className="rounded-lg bg-[var(--artifex-orange)] px-4 py-2 text-sm font-semibold text-white"
          disabled={props.readOnly}
          onClick={() => props.onStatusChange("review")}
        >
          Send to review
        </button>
        <button
          type="button"
          className="rounded-lg bg-[var(--artifex-olive)] px-4 py-2 text-sm font-semibold text-white"
          disabled={props.readOnly}
          onClick={() => props.onStatusChange("approved")}
        >
          Approve version
        </button>
      </div>
    </section>
  );
}

type FieldProps = {
  label: string;
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
};

function Field(props: FieldProps) {
  return (
    <label className="space-y-1 text-sm text-slate-700">
      {props.label}
      <textarea
        className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
        value={props.value}
        readOnly={props.readOnly}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}
