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
import type { OrgChartSettingsPayload } from "@/lib/org/org-chart-settings-types";
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
        const {
          data: { session },
        } = await client.auth.getSession();
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
        if (process.env.NODE_ENV === "development" && payload?.childOrderByParent) {
          const ids = Object.keys(payload.childOrderByParent);
          console.info("[Org chart] Načítané poradie podriadených zo Supabase:", ids.length, "nadriadených:", ids);
        }
      } catch {
        if (!cancelled) setDbSettings({});
      }
    }

    void fetchSettings().finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [useDb]);

  const saveSettings = useCallback(
    async (partial: Partial<OrgChartSettingsPayload>) => {
      const client = supabaseClient;
      const currentMerged = mergedSettingsRef.current;
      const currentLocal = localOverridesRef.current;
      if (isAdmin && useDb && client) {
        const {
          data: { session },
        } = await client.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        let body = partial;
        if (partial.childOrderByParent != null && typeof partial.childOrderByParent === "object") {
          const existing = currentMerged?.childOrderByParent;
          const merged =
            existing && typeof existing === "object"
              ? { ...existing, ...partial.childOrderByParent }
              : { ...partial.childOrderByParent };
          body = { ...partial, childOrderByParent: merged };
        }

        const res = await fetch("/api/org-chart-settings", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const payload = (await res.json()) as OrgChartSettingsPayload;
          setDbSettings(payload);
          if (body.childOrderByParent && process.env.NODE_ENV === "development") {
            const n = Object.keys(body.childOrderByParent).length;
            console.info("[Org chart] Poradie podriadených bolo úspešne uložené do Supabase. Počet riadkov (nadriadených):", n);
          }
        } else {
          if (process.env.NODE_ENV === "development") {
            const text = await res.text();
            console.warn("[Org chart] Uloženie nastavení zlyhalo:", res.status, res.statusText, text || "");
          }
        }
      } else {
        const next = { ...currentLocal, ...partial };
        setLocalOverrides(next);
        saveLocalOverrides(next);
      }
    },
    [isAdmin, useDb],
  );

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
