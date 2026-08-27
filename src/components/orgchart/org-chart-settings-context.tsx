"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuthContext } from "@/components/auth/auth-context";
import { mergeSettingsPartial } from "@/lib/org/merge-org-chart-settings";
import type { OrgChartSettingsPayload } from "@/lib/org/org-chart-settings-types";
import { beginPersist, endPersist } from "@/lib/org/persist-status";
import { isSupabasePublicConfigured, supabaseClient } from "@/lib/supabase/client";

const LOCAL_OVERRIDES_KEY = "org-chart-local-overrides";

type OrgChartSettingsContextValue = {
  /** Nastavenia z DB (admin) alebo DB + lokálne overrides (neadmin). */
  settings: OrgChartSettingsPayload;
  /** Načítavanie z API ešte prebehlo. */
  isLoading: boolean;
  /** Iba admin môže ukladať do DB. Neadmin môže meniť len lokálne (prezeranie/hranie). */
  isAdmin: boolean;
  /** Uloží časť nastavení: admin → PATCH do DB, inak len lokálne overrides. */
  saveSettings: (partial: Partial<OrgChartSettingsPayload>) => Promise<void>;
  /** Obnoviť lokálne overrides (napr. „zrušiť hranie“). */
  clearLocalOverrides: () => void;
  /** Admin: vynulovať nastavenia v DB. Neadmin: vynulovať lokálne overrides. */
  resetSettingsToDefaults: () => Promise<void>;
  /** Obnoviť celé nastavenia (pre Ctrl+Z undo). */
  replaceSettingsForUndo: (payload: OrgChartSettingsPayload) => Promise<void>;
};

const OrgChartSettingsContext = createContext<OrgChartSettingsContextValue | null>(null);

function loadLocalOverrides(): Partial<OrgChartSettingsPayload> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<OrgChartSettingsPayload>;
  } catch {
    return {};
  }
}

function saveLocalOverrides(partial: Partial<OrgChartSettingsPayload>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_OVERRIDES_KEY, JSON.stringify(partial));
  } catch {}
}

export function OrgChartSettingsProvider({ children }: { children: React.ReactNode }) {
  const { isConfigured, authenticated, role } = useAuthContext();
  const [dbSettings, setDbSettings] = useState<OrgChartSettingsPayload>({});
  const [localOverrides, setLocalOverrides] = useState<Partial<OrgChartSettingsPayload>>(
    loadLocalOverrides,
  );
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = role === "admin";
  const useDb = Boolean(isSupabasePublicConfigured && isConfigured && authenticated);

  const mergedSettings = useMemo<OrgChartSettingsPayload>(
    () => ({ ...dbSettings, ...localOverrides }),
    [dbSettings, localOverrides],
  );

  const mergedSettingsRef = useRef(mergedSettings);
  mergedSettingsRef.current = mergedSettings;
  const localOverridesRef = useRef(localOverrides);
  localOverridesRef.current = localOverrides;

  useEffect(() => {
    if (!useDb || !supabaseClient) {
      setIsLoading(false);
      return;
    }
    const client = supabaseClient;
    let cancelled = false;

    async function fetchSettings() {
      try {
        const { data: { session } } = await client.auth.getSession();
        const token = session?.access_token;
        if (!token || cancelled) return;
        const res = await fetch("/api/org-chart-settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const raw = await res.text();
        if (cancelled) return;
        const payload = (raw ? JSON.parse(raw) : {}) as OrgChartSettingsPayload;
        setDbSettings(payload ?? {});
      } catch {
        if (!cancelled) setDbSettings({});
      }
    }

    void fetchSettings().finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    // ── Realtime subscription ──────────────────────────────────────────────
    // Ked admin zmeni nastavenia, vsetci ostatni dostanu update okamzite
    // bez nutnosti refreshu stranky.
    const channel = client
      .channel("org-chart-settings-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "org_chart_settings",
        },
        (payload) => {
          if (cancelled) return;
          // Ignoruj realtime update ak prave prebieha save - zabrani race condition
          if (saveInFlightRef.current) return;
          // Payload obsahuje novy riadok — nacitame cely payload z DB
          const newRow = payload.new as { payload?: OrgChartSettingsPayload };
          if (newRow?.payload) {
            setDbSettings(newRow.payload);
          } else {
            // Fallback: refetch
            void fetchSettings();
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [useDb]);

  // Ref pre in-flight save — zabraňuje race condition. Musí byť true PRED akýmkoľvek await.
  const saveInFlightRef = useRef(false);
  // Queue pre zmeny ktore prisli pocas in-flight save
  const pendingPartialRef = useRef<Partial<OrgChartSettingsPayload> | null>(null);

  const drainSaves = useCallback(
    async (opts?: { keepalive?: boolean }) => {
      const client = supabaseClient;
      if (!isAdmin || !useDb || !client) return;
      if (saveInFlightRef.current) return;
      if (!pendingPartialRef.current) return;

      saveInFlightRef.current = true;
      beginPersist();
      let succeeded = false;
      try {
        while (pendingPartialRef.current) {
          const currentMerged = mergedSettingsRef.current;
          let body = pendingPartialRef.current;
          pendingPartialRef.current = null;

          if (body.childOrderByParent != null && typeof body.childOrderByParent === "object") {
            const existing = currentMerged?.childOrderByParent;
            const merged =
              existing && typeof existing === "object"
                ? { ...existing, ...body.childOrderByParent }
                : { ...body.childOrderByParent };
            body = { ...body, childOrderByParent: merged };
          }

          const {
            data: { session },
          } = await client.auth.getSession();
          const token = session?.access_token;
          if (!token) {
            pendingPartialRef.current = mergeSettingsPartial(body, pendingPartialRef.current ?? {});
            endPersist(false, "Not signed in");
            return;
          }

          const res = await fetch("/api/org-chart-settings", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
            keepalive: opts?.keepalive === true,
          });
          if (res.ok) {
            const payload = (await res.json()) as OrgChartSettingsPayload;
            setDbSettings(payload);
            if (body.childOrderByParent && process.env.NODE_ENV === "development") {
              const n = Object.keys(body.childOrderByParent).length;
              console.info("[Org chart] Poradie podriadených bolo úspešne uložené do Supabase. Počet riadkov (nadriadených):", n);
            }
          } else {
            pendingPartialRef.current = mergeSettingsPartial(body, pendingPartialRef.current ?? {});
            const text = await res.text().catch(() => "");
            if (process.env.NODE_ENV === "development") {
              console.warn("[Org chart] Uloženie nastavení zlyhalo:", res.status, res.statusText, text || "");
            }
            endPersist(false, "Save failed");
            return;
          }
        }
        endPersist(true);
        succeeded = true;
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[Org chart] Uloženie nastavení zlyhalo:", error);
        }
        endPersist(false, "Save failed");
      } finally {
        saveInFlightRef.current = false;
        if (succeeded && pendingPartialRef.current) {
          void drainSaves(opts);
        }
      }
    },
    [isAdmin, useDb],
  );

  const saveSettings = useCallback(
    async (partial: Partial<OrgChartSettingsPayload>) => {
      const client = supabaseClient;
      const currentLocal = localOverridesRef.current;
      if (isAdmin && useDb && client) {
        pendingPartialRef.current = mergeSettingsPartial(pendingPartialRef.current, partial);
        await drainSaves();
      } else {
        const next = mergeSettingsPartial(currentLocal, partial);
        setLocalOverrides(next);
        saveLocalOverrides(next);
      }
    },
    [drainSaves, isAdmin, useDb],
  );

  useEffect(() => {
    const flushOnHide = () => {
      if (document.visibilityState !== "hidden") return;
      if (!pendingPartialRef.current && !saveInFlightRef.current) return;
      void drainSaves({ keepalive: true });
    };
    document.addEventListener("visibilitychange", flushOnHide);
    return () => document.removeEventListener("visibilitychange", flushOnHide);
  }, [drainSaves]);

  const clearLocalOverrides = useCallback(() => {
    setLocalOverrides({});
    saveLocalOverrides({});
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(LOCAL_OVERRIDES_KEY);
      } catch {}
    }
  }, []);

  const resetSettingsToDefaults = useCallback(async () => {
    const client = supabaseClient;
    if (isAdmin && useDb && client) {
      const {
        data: { session },
      } = await client.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      await fetch("/api/org-chart-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ _replace: true }),
      });
      setDbSettings({});
    }
    setLocalOverrides({});
    saveLocalOverrides({});
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(LOCAL_OVERRIDES_KEY);
      } catch {}
    }
  }, [isAdmin, useDb]);

  const replaceSettingsForUndo = useCallback(
    async (payload: OrgChartSettingsPayload) => {
      if (isAdmin && useDb && supabaseClient) {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const res = await fetch("/api/org-chart-settings", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ _replace: true, ...payload }),
          });
          if (res.ok) {
            const updated = (await res.json()) as OrgChartSettingsPayload;
            setDbSettings(updated);
          }
        }
      }
      setLocalOverrides(payload);
      saveLocalOverrides(payload);
    },
    [isAdmin, useDb],
  );

  const value = useMemo<OrgChartSettingsContextValue>(
    () => ({
      settings: mergedSettings,
      isLoading,
      isAdmin,
      saveSettings,
      clearLocalOverrides,
      resetSettingsToDefaults,
      replaceSettingsForUndo,
    }),
    [mergedSettings, isLoading, isAdmin, saveSettings, clearLocalOverrides, resetSettingsToDefaults, replaceSettingsForUndo],
  );

  return (
    <OrgChartSettingsContext.Provider value={value}>
      {children}
    </OrgChartSettingsContext.Provider>
  );
}

export function useOrgChartSettings(): OrgChartSettingsContextValue | null {
  return useContext(OrgChartSettingsContext);
}
