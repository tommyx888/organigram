"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as repo from "@/lib/proj/repository";
import {
  CANDIDATE_STATUS_LABELS,
  TARGET_TYPE_LABELS,
  IT_ACCOUNT_ACTION_LABELS,
  type CandidateStatus,
  type TargetType,
  type TrackedPosition,
  type ProjPositionCandidate,
  type ProjPositionDocument,
  type ItAccountForm,
  type ItAccountAction,
} from "@/lib/proj/types";

const EMPTY_CAND = {
  name: "",
  agency: "",
  monthly_cost: "",
  currency: "EUR",
  status: "contacted" as CandidateStatus,
  profile_url: "",
  note: "",
};

function emptyItForm(): ItAccountForm {
  return {
    action: "zriadit",
    effective_from: null,
    supervisor_name: null,
    comment: null,
    user_section: { meno: "", priezvisko: "", vzor: "", oddelenie: "", zaradenie: "" },
    pc: { desktop: false, laptop: false, ucet: false, mobil: false, dci: false },
    ibm: { qad: false, as400: false, lotus: false, dci: false },
    access: { adresare: "", tlaciarne: "", ine: "" },
  };
}

export default function PositionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const assignmentId = id;

  const [pos, setPos] = useState<TrackedPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // meta formular
  const [targetType, setTargetType] = useState<TargetType | "">("");
  const [seat, setSeat] = useState("");
  const [recruitingUrl, setRecruitingUrl] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [costOverride, setCostOverride] = useState("");
  const [metaNote, setMetaNote] = useState("");

  // novy kandidat
  const [cand, setCand] = useState({ ...EMPTY_CAND });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // IT ziadost o ucet (formular ako v portali)
  const [itOpen, setItOpen] = useState(false);
  const [itForm, setItForm] = useState<ItAccountForm>(emptyItForm());
  const [itSaving, setItSaving] = useState(false);
  const [itSentMsg, setItSentMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await repo.fetchTrackedPosition(assignmentId);
    setPos(data);
    if (data?.meta) {
      setTargetType((data.meta.target_type as TargetType) ?? "");
      setSeat(data.meta.seat_location ?? "");
      setRecruitingUrl(data.meta.recruiting_url ?? "");
      setPortalUrl(data.meta.portal_it_url ?? "");
      setCostOverride(data.meta.monthly_cost_override != null ? String(data.meta.monthly_cost_override) : "");
      setMetaNote(data.meta.note ?? "");
    }
  }, [assignmentId]);

  useEffect(() => {
    async function load() {
      try { await reload(); } finally { setLoading(false); }
    }
    void load();
  }, [reload]);

  // Mesacne naklady: override ak je zadany, inak sucet cien vybranych kandidatov,
  // a ak nikto nie je vybrany, sucet vsetkych "selected" stavov.
  const monthlyCost = useMemo(() => {
    if (!pos) return 0;
    if (pos.meta?.monthly_cost_override != null) return pos.meta.monthly_cost_override;
    const selected = pos.candidates.filter((c) => c.status === "selected");
    const pool = selected.length > 0 ? selected : [];
    return pool.reduce((sum, c) => sum + (c.monthly_cost ?? 0), 0);
  }, [pos]);

  async function saveMeta() {
    setSaving(true);
    try {
      await repo.upsertPositionMeta(assignmentId, {
        target_type: targetType || null,
        seat_location: seat.trim() || null,
        recruiting_url: recruitingUrl.trim() || null,
        portal_it_url: portalUrl.trim() || null,
        monthly_cost_override: costOverride.trim() ? Number(costOverride) : null,
        note: metaNote.trim() || null,
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  // Odfajknutie stavu (poziadavka na nabor / IT) - ulozi sa hned
  async function toggleFlag(field: "recruiting_requested" | "it_requested", value: boolean) {
    await repo.upsertPositionMeta(assignmentId, { [field]: value });
    await reload();
  }

  // Otvor IT formular a predvypln z pozicie (meno, oddelenie, zaradenie)
  function openItForm() {
    const f = emptyItForm();
    if (pos) {
      const a = pos.assignment;
      const full = a.iac_employee?.meno ?? a.person_name ?? "";
      const parts = full.trim().split(/\s+/);
      f.user_section.meno = parts[0] ?? "";
      f.user_section.priezvisko = parts.slice(1).join(" ");
      f.user_section.zaradenie = a.position_title ?? "";
    }
    setItForm(f);
    setItSentMsg(null);
    setItOpen(true);
  }

  async function submitItRequest() {
    if (!itForm.user_section.meno.trim() && !itForm.user_section.priezvisko.trim()) {
      alert("Vyplň aspoň meno alebo priezvisko.");
      return;
    }
    setItSaving(true);
    try {
      const employeeId = pos?.assignment.iac_employee_id ?? null;
      await repo.createItAccountRequest(itForm, employeeId);
      // automaticky odfajkni „Žiadosť na IT odoslaná“
      await repo.upsertPositionMeta(assignmentId, { it_requested: true });
      await reload();
      setItOpen(false);
      setItSentMsg("Žiadosť na IT bola vytvorená.");
    } catch (e) {
      alert("Nepodarilo sa vytvoriť IT žiadosť: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setItSaving(false);
    }
  }

  async function addCandidate() {
    if (!cand.name.trim()) return;
    setSaving(true);
    try {
      await repo.createCandidate({
        assignment_id: assignmentId,
        name: cand.name.trim(),
        agency: cand.agency.trim() || null,
        monthly_cost: cand.monthly_cost.trim() ? Number(cand.monthly_cost) : null,
        currency: cand.currency || "EUR",
        status: cand.status,
        profile_url: cand.profile_url.trim() || null,
        note: cand.note.trim() || null,
      });
      setCand({ ...EMPTY_CAND });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function setCandidateStatus(c: ProjPositionCandidate, status: CandidateStatus) {
    await repo.updateCandidate(c.id, { status });
    await reload();
  }

  async function removeCandidate(c: ProjPositionCandidate) {
    if (!confirm(`Zmazať kandidáta ${c.name}?`)) return;
    await repo.deleteCandidate(c.id);
    await reload();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await repo.uploadPositionDocument(assignmentId, file, null);
      await reload();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function openDoc(doc: ProjPositionDocument) {
    const url = await repo.getDocumentUrl(doc.storage_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function removeDoc(doc: ProjPositionDocument) {
    if (!confirm(`Zmazať dokument ${doc.file_name}?`)) return;
    await repo.deletePositionDocument(doc);
    await reload();
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 px-6 py-8"><p className="text-sm text-slate-500">Načítavam…</p></main>;
  }
  if (!pos) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-8 md:px-10">
        <section className="mx-auto max-w-3xl space-y-4">
          <p className="text-sm text-slate-600">Pozícia sa nenašla.</p>
          <Link href="/interim" className="text-sm text-cyan-700 underline">← Späť na zoznam</Link>
        </section>
      </main>
    );
  }

  const a = pos.assignment;
  const isTbd = a.person_type === "tbd" || a.status === "tbd";
  const accent = isTbd ? "#7C3AED" : "#0891B2";
  const personName = a.iac_employee?.meno ?? a.person_name ?? null;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 md:px-10">
      <section className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: accent }} />
            <div>
              <h1 className="text-2xl font-black text-[var(--artifex-navy)]">{a.position_title || "—"}</h1>
              <p className="text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wide" style={{ color: accent }}>
                  {isTbd ? "TBD / neobsadené" : "Interim"}
                </span>
                {personName ? ` • ${personName}` : ""}
                {pos.projectName ? ` • ${pos.projectName}` : ""}
              </p>
            </div>
          </div>
          <Link href="/interim" className="text-sm text-slate-500 underline">← Zoznam</Link>
        </div>

        {/* Mesacne naklady */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Mesačné náklady</h2>
            <span className="text-xl font-black" style={{ color: accent }}>
              {monthlyCost.toLocaleString("sk-SK")} {pos.candidates[0]?.currency ?? "EUR"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {pos.meta?.monthly_cost_override != null
              ? "Ručne nastavená suma."
              : "Súčet z vybraných kandidátov (stav „Vybraný”). Môžeš prepísať ručne v Nastaveniach pozície nižšie."}
          </p>
        </div>

        {/* Nastavenia pozicie (meta) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-700">Nastavenia pozície</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {isTbd && (
              <label className="text-xs font-semibold text-slate-600">
                Cieľové obsadenie
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as TargetType | "")}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal"
                >
                  <option value="">— nezvolené —</option>
                  {(Object.keys(TARGET_TYPE_LABELS) as TargetType[]).map((t) => (
                    <option key={t} value={t}>{TARGET_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs font-semibold text-slate-600">
              Kde bude sedieť
              <input value={seat} onChange={(e) => setSeat(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Mesačné náklady (ručne)
              <input value={costOverride} onChange={(e) => setCostOverride(e.target.value)}
                inputMode="decimal" placeholder="napr. 4500"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Odkaz na nábor (recruiting.artifex-systems.sk)
              <input value={recruitingUrl} onChange={(e) => setRecruitingUrl(e.target.value)}
                placeholder="https://recruiting.artifex-systems.sk/…"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              IT požiadavka (portal.artifex-systems.sk)
              <input value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)}
                placeholder="https://portal.artifex-systems.sk/…"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
              Poznámka
              <textarea value={metaNote} onChange={(e) => setMetaNote(e.target.value)} rows={2}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={saveMeta} disabled={saving}
              className="rounded bg-[var(--artifex-navy)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Ukladám…" : "Uložiť nastavenia"}
            </button>
            {recruitingUrl.trim() && (
              <a href={recruitingUrl} target="_blank" rel="noopener noreferrer"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Otvoriť nábor ↗</a>
            )}
            {portalUrl.trim() && (
              <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Otvoriť IT portál ↗</a>
            )}
          </div>
        </div>

        {/* Odkazy na externe portaly + odfajknutie stavu - zobrazene vzdy */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-700">Nábor a IT</h2>
          <div className="space-y-2">
            {/* Poziadavka na nabor */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox"
                  checked={pos.meta?.recruiting_requested ?? false}
                  onChange={(e) => toggleFlag("recruiting_requested", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300" />
                <span className={pos.meta?.recruiting_requested ? "font-medium text-slate-800" : ""}>
                  Požiadavka na nábor podaná
                </span>
              </label>
              <a href={recruitingUrl.trim() || "https://recruiting.artifex-systems.sk"} target="_blank" rel="noopener noreferrer"
                className="shrink-0 rounded bg-[var(--artifex-navy)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
                Otvoriť nábor ↗
              </a>
            </div>
            {/* Ziadost na IT */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox"
                  checked={pos.meta?.it_requested ?? false}
                  onChange={(e) => toggleFlag("it_requested", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300" />
                <span className={pos.meta?.it_requested ? "font-medium text-slate-800" : ""}>
                  Žiadosť na IT odoslaná
                </span>
              </label>
              <button type="button" onClick={itOpen ? () => setItOpen(false) : openItForm}
                className="shrink-0 rounded bg-[var(--artifex-navy)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
                {itOpen ? "Zavrieť formulár" : "Vyplniť žiadosť na IT"}
              </button>
            </div>
            {itSentMsg && <p className="text-xs font-medium text-green-700">{itSentMsg}</p>}
          </div>

          {/* IT formular (rovnaky ako v portali) */}
          {itOpen && (
            <div className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              {/* Akcia + datum + nadriadeny */}
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold text-slate-600">
                  Akcia
                  <select value={itForm.action}
                    onChange={(e) => setItForm({ ...itForm, action: e.target.value as ItAccountAction })}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal">
                    {(Object.keys(IT_ACCOUNT_ACTION_LABELS) as ItAccountAction[]).map((k) => (
                      <option key={k} value={k}>{IT_ACCOUNT_ACTION_LABELS[k]}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Platnosť od
                  <input type="date" value={itForm.effective_from ?? ""}
                    onChange={(e) => setItForm({ ...itForm, effective_from: e.target.value || null })}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Nadriadený
                  <input value={itForm.supervisor_name ?? ""}
                    onChange={(e) => setItForm({ ...itForm, supervisor_name: e.target.value || null })}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                </label>
              </div>

              {/* Pouzivatel */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Používateľ</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600">Meno
                    <input value={itForm.user_section.meno}
                      onChange={(e) => setItForm({ ...itForm, user_section: { ...itForm.user_section, meno: e.target.value } })}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Priezvisko
                    <input value={itForm.user_section.priezvisko}
                      onChange={(e) => setItForm({ ...itForm, user_section: { ...itForm.user_section, priezvisko: e.target.value } })}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Oddelenie
                    <input value={itForm.user_section.oddelenie}
                      onChange={(e) => setItForm({ ...itForm, user_section: { ...itForm.user_section, oddelenie: e.target.value } })}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Zaradenie (pozícia)
                    <input value={itForm.user_section.zaradenie}
                      onChange={(e) => setItForm({ ...itForm, user_section: { ...itForm.user_section, zaradenie: e.target.value } })}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Vzor (podľa koho nastaviť prístupy)
                    <input value={itForm.user_section.vzor}
                      onChange={(e) => setItForm({ ...itForm, user_section: { ...itForm.user_section, vzor: e.target.value } })}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                  </label>
                </div>
              </div>

              {/* PC + IBM checkboxy */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">PC / vybavenie</p>
                  <div className="space-y-1.5">
                    {([["desktop", "Desktop"], ["laptop", "Laptop"], ["ucet", "Účet"], ["mobil", "Mobil"], ["dci", "DCI"]] as const).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={itForm.pc[k]}
                          onChange={(e) => setItForm({ ...itForm, pc: { ...itForm.pc, [k]: e.target.checked } })}
                          className="h-4 w-4 rounded border-slate-300" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">IBM / systémy</p>
                  <div className="space-y-1.5">
                    {([["qad", "QAD"], ["as400", "AS400"], ["lotus", "Lotus"], ["dci", "DCI"]] as const).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={itForm.ibm[k]}
                          onChange={(e) => setItForm({ ...itForm, ibm: { ...itForm.ibm, [k]: e.target.checked } })}
                          className="h-4 w-4 rounded border-slate-300" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pristupy (textove) */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Prístupy</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-600">Adresáre
                    <input value={itForm.access.adresare}
                      onChange={(e) => setItForm({ ...itForm, access: { ...itForm.access, adresare: e.target.value } })}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Tlačiarne
                    <input value={itForm.access.tlaciarne}
                      onChange={(e) => setItForm({ ...itForm, access: { ...itForm.access, tlaciarne: e.target.value } })}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Iné
                    <input value={itForm.access.ine}
                      onChange={(e) => setItForm({ ...itForm, access: { ...itForm.access, ine: e.target.value } })}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
                  </label>
                </div>
              </div>

              {/* Poznamka */}
              <label className="block text-xs font-semibold text-slate-600">Poznámka
                <textarea value={itForm.comment ?? ""} rows={2}
                  onChange={(e) => setItForm({ ...itForm, comment: e.target.value || null })}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal" />
              </label>

              <div className="flex items-center gap-2">
                <button type="button" onClick={submitItRequest} disabled={itSaving}
                  className="rounded bg-[var(--artifex-navy)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {itSaving ? "Odosielam…" : "Odoslať žiadosť na IT"}
                </button>
                <button type="button" onClick={() => setItOpen(false)}
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">
                  Zrušiť
                </button>
              </div>
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-400">
            Požiadavka na nábor vedie na portál; žiadosť na IT vyplníš priamo tu — uloží sa do systému IT (it_account_requests).
          </p>
        </div>

        {/* Kandidati */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-700">Kandidáti</h2>

          {/* Novy kandidat */}
          <div className="mb-4 grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-2">
            <input value={cand.name} onChange={(e) => setCand({ ...cand, name: e.target.value })}
              placeholder="Meno kandidáta" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
            <input value={cand.agency} onChange={(e) => setCand({ ...cand, agency: e.target.value })}
              placeholder="Agentúra" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
            <input value={cand.monthly_cost} onChange={(e) => setCand({ ...cand, monthly_cost: e.target.value })}
              inputMode="decimal" placeholder="Mesačná cena" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
            <select value={cand.status} onChange={(e) => setCand({ ...cand, status: e.target.value as CandidateStatus })}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm">
              {(Object.keys(CANDIDATE_STATUS_LABELS) as CandidateStatus[]).map((s) => (
                <option key={s} value={s}>{CANDIDATE_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <input value={cand.profile_url} onChange={(e) => setCand({ ...cand, profile_url: e.target.value })}
              placeholder="Odkaz na profil/CV (voliteľné)" className="rounded border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2" />
            <div className="sm:col-span-2">
              <button type="button" onClick={addCandidate} disabled={saving || !cand.name.trim()}
                className="rounded bg-[var(--artifex-navy)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                + Pridať kandidáta
              </button>
            </div>
          </div>

          {pos.candidates.length === 0 ? (
            <p className="text-xs text-slate-500">Zatiaľ žiadni kandidáti.</p>
          ) : (
            <ul className="space-y-2">
              {pos.candidates.map((c) => (
                <li key={c.id} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {c.profile_url ? (
                          <a href={c.profile_url} target="_blank" rel="noopener noreferrer" className="text-cyan-700 underline">{c.name}</a>
                        ) : c.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {c.agency ?? "—"}
                        {c.monthly_cost != null ? ` • ${c.monthly_cost.toLocaleString("sk-SK")} ${c.currency}/mes` : ""}
                      </p>
                      {c.note ? <p className="mt-0.5 text-xs text-slate-600">{c.note}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <select value={c.status} onChange={(e) => setCandidateStatus(c, e.target.value as CandidateStatus)}
                        className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                        {(Object.keys(CANDIDATE_STATUS_LABELS) as CandidateStatus[]).map((s) => (
                          <option key={s} value={s}>{CANDIDATE_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeCandidate(c)}
                        className="rounded px-1.5 py-1 text-xs text-red-600 hover:bg-red-50">Zmazať</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Dokumenty */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Dokumenty</h2>
            <label className="cursor-pointer rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              {uploading ? "Nahrávam…" : "+ Nahrať PDF"}
              <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={onUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
          {pos.documents.length === 0 ? (
            <p className="text-xs text-slate-500">Žiadne dokumenty.</p>
          ) : (
            <ul className="space-y-1.5">
              {pos.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <button type="button" onClick={() => openDoc(d)} className="truncate text-sm text-cyan-700 underline">
                    {d.file_name}
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.size_bytes != null && (
                      <span className="text-[11px] text-slate-400">{Math.round(d.size_bytes / 1024)} kB</span>
                    )}
                    <button type="button" onClick={() => removeDoc(d)} className="rounded px-1.5 py-1 text-xs text-red-600 hover:bg-red-50">Zmazať</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
