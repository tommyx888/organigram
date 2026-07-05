"use client";

/**
 * Tlačidlo + dialóg na správu verejných zdieľateľných odkazov na organigram.
 * Zobrazuje sa iba adminovi / hr_editorovi na stránke organigramu.
 */

import { useCallback, useEffect, useState } from "react";

import { supabaseClient } from "@/lib/supabase/client";

type ShareLink = {
  id: string;
  token: string;
  label: string;
  is_enabled: boolean;
  expires_at: string | null;
  created_at: string;
};

async function authHeaders(): Promise<Record<string, string> | null> {
  if (!supabaseClient) return null;
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

function shareUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/share/org/${token}`;
}

export function SharePublicLinkButton() {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/org/share-links", { headers });
    if (!res.ok) {
      setError("Nepodarilo sa načítať odkazy.");
      return;
    }
    const json = (await res.json()) as { links: ShareLink[] };
    setLinks(json.links ?? []);
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function createLink() {
    setBusy(true);
    setError(null);
    const headers = await authHeaders();
    if (!headers) {
      setBusy(false);
      return;
    }
    const res = await fetch("/api/org/share-links", {
      method: "POST",
      headers,
      body: JSON.stringify({ label: "Verejný náhľad" }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Vytvorenie odkazu zlyhalo (potrebné admin práva).");
      return;
    }
    await load();
  }

  async function toggleLink(link: ShareLink) {
    const headers = await authHeaders();
    if (!headers) return;
    await fetch("/api/org/share-links", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id: link.id, is_enabled: !link.is_enabled }),
    });
    await load();
  }

  async function deleteLink(link: ShareLink) {
    if (!window.confirm("Naozaj zmazať tento odkaz? Prestane fungovať pre všetkých.")) return;
    const headers = await authHeaders();
    if (!headers) return;
    await fetch(`/api/org/share-links?id=${encodeURIComponent(link.id)}`, {
      method: "DELETE",
      headers,
    });
    await load();
  }

  async function copyLink(link: ShareLink) {
    try {
      await navigator.clipboard.writeText(shareUrl(link.token));
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setError("Kopírovanie zlyhalo – skopírujte odkaz ručne.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 ml-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--artifex-olive)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--artifex-navy)] transition hover:bg-slate-50"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        Verejný náhľad (SAL)
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--artifex-navy)]">Verejný náhľad organigramu</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Odkaz zobrazuje iba aktívnych SAL zamestnancov – vedenie a oddelenia. Funguje bez
                  prihlásenia, je určený pre ľudí mimo organizácie.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Zavrieť">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {links.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                  Zatiaľ žiadne odkazy. Vytvorte prvý nižšie.
                </p>
              ) : (
                links.map((link) => (
                  <div key={link.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--artifex-navy)]">{link.label}</p>
                        <p className="truncate text-[11px] text-slate-400">{shareUrl(link.token)}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          link.is_enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {link.is_enabled ? "Aktívny" : "Vypnutý"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void copyLink(link)}
                        className="rounded-lg bg-[var(--artifex-navy)] px-3 py-1 text-[11px] font-semibold text-white">
                        {copiedId === link.id ? "✓ Skopírované" : "Kopírovať odkaz"}
                      </button>
                      <a href={shareUrl(link.token)} target="_blank" rel="noreferrer"
                        className="rounded-lg border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                        Otvoriť
                      </a>

                      <button type="button" onClick={() => void toggleLink(link)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                        {link.is_enabled ? "Vypnúť" : "Zapnúť"}
                      </button>
                      <button type="button" onClick={() => void deleteLink(link)}
                        className="ml-auto rounded-lg border border-red-200 px-3 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50">
                        Zmazať
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

            <button
              type="button"
              onClick={() => void createLink()}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-[var(--artifex-olive)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Vytváram…" : "+ Vytvoriť nový odkaz"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
