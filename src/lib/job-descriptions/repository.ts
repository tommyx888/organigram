"use client";

import type { JobDescriptionRecord, JobDescriptionStatus } from "@/lib/job-descriptions/types";
import { isSupabaseConfigured, resolveActiveCompanyId, supabaseClient } from "@/lib/supabase/client";

const STORAGE_KEY = "organigram.jobDescriptions";

const initialRecords: JobDescriptionRecord[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    positionCode: "MFG-LEAD-001",
    positionTitle: "Manufacturing Team Leader",
    responsibilities:
      "Lead shift operations, coordinate staffing, ensure quality compliance, and escalate process deviations.",
    requirements: "3+ years in manufacturing, people leadership, Lean basics, quality systems knowledge.",
    kpi: "OEE, scrap rate, rework ratio, attendance stability, safety incidents.",
    version: 3,
    status: "approved",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    positionCode: "HR-BP-002",
    positionTitle: "HR Business Partner",
    responsibilities: "Support workforce planning, talent review, and policy implementation.",
    requirements: "HR background, communication, labor law awareness.",
    kpi: "Time to fill, retention, training completion.",
    version: 2,
    status: "review",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    positionCode: "QMS-ENG-010",
    positionTitle: "QMS Engineer",
    responsibilities: "Maintain process documentation and CAPA follow-up.",
    requirements: "Quality systems experience, problem solving, audit literacy.",
    kpi: "Audit findings closure, CAPA lead time.",
    version: 1,
    status: "draft",
    updatedAt: new Date().toISOString(),
  },
];

export async function getJobDescriptions(): Promise<JobDescriptionRecord[]> {
  if (isSupabaseConfigured && supabaseClient) {
    const companyId = await resolveActiveCompanyId();
    if (!companyId) {
      return localFallback();
    }

    const { data, error } = await supabaseClient
      .from("job_descriptions")
      .select("id, status, positions(code, title), job_description_versions(version_no, content_json, created_at)")
      .eq("company_id", companyId);

    if (!error && data && data.length > 0) {
      return data.map((row) => {
        const position = Array.isArray(row.positions) ? row.positions[0] : row.positions;
        const versions = (Array.isArray(row.job_description_versions) ? row.job_description_versions : [])
          .slice()
          .sort((a, b) => b.version_no - a.version_no);
        const latestVersion = versions[0];
        const content = (latestVersion?.content_json ?? {}) as {
          responsibilities?: string;
          requirements?: string;
          kpi?: string;
        };

        return {
          id: row.id,
          positionCode: position?.code ?? "UNASSIGNED",
          positionTitle: position?.title ?? "Undefined Position",
          responsibilities: content.responsibilities ?? "",
          requirements: content.requirements ?? "",
          kpi: content.kpi ?? "",
          version: latestVersion?.version_no ?? 1,
          status: (row.status ?? "draft") as JobDescriptionStatus,
          updatedAt: latestVersion?.created_at ?? new Date().toISOString(),
        };
      });
    }

    if (error) {
      console.warn("Supabase JD read failed. Falling back to local mode.", error.message);
    }
  }

  return localFallback();
}

export async function upsertJobDescription(
  record: Omit<JobDescriptionRecord, "updatedAt"> & { updatedAt?: string },
): Promise<JobDescriptionRecord[]> {
  if (isSupabaseConfigured && supabaseClient) {
    const companyId = await resolveActiveCompanyId();
    const { error } = await writeJobDescriptionToSupabase(record, companyId);
    if (error) {
      console.warn("Supabase JD write failed. Data stored locally only.", error.message);
    } else {
      return getJobDescriptions();
    }
  }

  const all = await getJobDescriptions();
  const nextRecord: JobDescriptionRecord = {
    ...record,
    updatedAt: record.updatedAt ?? new Date().toISOString(),
  };

  const index = all.findIndex((item) => item.id === nextRecord.id);
  const next = [...all];
  if (index >= 0) {
    next[index] = nextRecord;
  } else {
    next.push(nextRecord);
  }

  persist(next);
  return next;
}

export async function updateJobDescriptionStatus(
  id: string,
  status: JobDescriptionStatus,
): Promise<JobDescriptionRecord[]> {
  if (isSupabaseConfigured && supabaseClient) {
    const companyId = await resolveActiveCompanyId();
    if (!companyId) {
      return localFallback();
    }

    const { error } = await supabaseClient
      .from("job_descriptions")
      .update({ status })
      .eq("id", id)
      .eq("company_id", companyId);

    if (!error) {
      return getJobDescriptions();
    }
    console.warn("Supabase JD status update failed. Using local mode.", error.message);
  }

  const all = await getJobDescriptions();
  const next = all.map((item) =>
    item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item,
  );
  persist(next);
  return next;
}

function persist(records: JobDescriptionRecord[]) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

async function writeJobDescriptionToSupabase(
  record: Omit<JobDescriptionRecord, "updatedAt">,
  companyId: string | null,
) {
  if (!supabaseClient || !companyId) {
    return { error: null as { message: string } | null };
  }

  const { error: companyError } = await supabaseClient.from("companies").upsert(
    [{ id: companyId, code: "default", name: "Default Company" }],
    { onConflict: "id" },
  );
  if (companyError) {
    return { error: companyError };
  }

  const positionCode = record.positionCode.trim();
  const positionTitle = record.positionTitle.trim();

  const { error: positionError } = await supabaseClient.from("positions").upsert(
    [
      {
        company_id: companyId,
        code: positionCode,
        title: positionTitle,
        position_type: "indirect",
        active_flag: true,
      },
    ],
    { onConflict: "company_id,code" },
  );
  if (positionError) {
    return { error: positionError };
  }

  const { data: positionRow, error: positionReadError } = await supabaseClient
    .from("positions")
    .select("id")
    .eq("company_id", companyId)
    .eq("code", positionCode)
    .maybeSingle();
  if (positionReadError || !positionRow) {
    return { error: positionReadError ?? { message: "Position not found after upsert." } };
  }

  const { error: jdError } = await supabaseClient.from("job_descriptions").upsert(
    [
      {
        id: record.id,
        company_id: companyId,
        position_id: positionRow.id,
        document_key: positionCode,
        status: record.status,
      },
    ],
    { onConflict: "id" },
  );
  if (jdError) {
    return { error: jdError };
  }

  const { error: versionError } = await supabaseClient.from("job_description_versions").upsert(
    [
      {
        job_description_id: record.id,
        version_no: record.version,
        content_json: {
          responsibilities: record.responsibilities,
          requirements: record.requirements,
          kpi: record.kpi,
        },
      },
    ],
    { onConflict: "job_description_id,version_no" },
  );

  return { error: versionError };
}

function localFallback(): JobDescriptionRecord[] {
  if (typeof window === "undefined") {
    return initialRecords;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialRecords));
    return initialRecords;
  }

  try {
    const parsed = JSON.parse(raw) as JobDescriptionRecord[];
    return parsed.length > 0 ? parsed : initialRecords;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialRecords));
    return initialRecords;
  }
}
