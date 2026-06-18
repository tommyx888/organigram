"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import * as repo from "@/lib/proj/repository";
import {
  PERSON_TYPE_LABELS,
  type TrackedPosition,
} from "@/lib/proj/types";

type Filter = "all" | "interim" | "tbd";

export default function InterimListPage() {
  const [positions, setPositions] = useState<TrackedPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    async function load() {
      try {
        const data = await repo.fetchTrackedPositions();
        setPositions(data);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return positions.filter((p) => {
      const a = p.assignment;
      const isTbd = a.person_type === "tbd" || a.status === "tbd";
      const isInterim = a.person_type === "interim";
      if (filter === "interim" && !isInterim) return false;
      if (filter === "tbd" && !isTbd) return false;
      if (!q) return true;
      const hay = `${a.position_title ?? ""} ${a.person_name ?? ""} ${a.iac_employee?.meno ?? ""} ${p.projectName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [positions, search, filter]);

  const counts = useMemo(() => {
    let interim = 0, tbd = 0;
    for (const p of positions) {
      const a = p.assignment;
      if (a.person_type === "interim") interim++;
      if (a.person_type === "tbd" || a.status === "tbd") tbd++;
    }
    return { interim, tbd, total: positions.length };
  }, [positions]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 md:px-10">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--artifex-navy)]">Obsadzovanie pozícií</h1>
            <p className="text-sm text-slate-600">Interim a neobsadené (TBD) pozície naprieč projektmi — kandidáti, náklady, dokumenty.</p>
          </div>
          <Link href="/projects" className="text-sm text-slate-500 underline">← Projekty</Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hľadať podľa pozície, mena, projektu…"
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs">
            {(["all", "interim", "tbd"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1.5 font-semibold transition ${
                  filter === f ? "bg-[var(--artifex-navy)] text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {f === "all" ? `Všetko (${counts.total})` : f === "interim" ? `Interim (${counts.interim})` : `TBD (${counts.tbd})`}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Načítavam…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">
            Žiadne interim ani TBD pozície. Označ pozíciu ako „Interim" alebo „TBD" v projektoch a zobrazí sa tu.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const a = p.assignment;
              const isTbd = a.person_type === "tbd" || a.status === "tbd";
              const accent = isTbd ? "#7C3AED" : "#0891B2";
              const name = a.iac_employee?.meno ?? a.person_name ?? null;
              return (
                <Link
                  key={a.id}
                  href={`/interim/${a.id}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-400 hover:shadow"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      style={{ background: accent }}
                    >
                      {isTbd ? "TBD" : PERSON_TYPE_LABELS.interim}
                    </span>
                  </div>
                  <p className="mt-2 font-semibold text-slate-800">{a.position_title || "—"}</p>
                  {name ? <p className="text-xs text-slate-600">{name}</p> : null}
                  <p className="mt-1 text-xs text-slate-400">{p.projectName ?? "—"}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
