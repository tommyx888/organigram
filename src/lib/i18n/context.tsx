"use client";

import React, { useCallback, useMemo, useState } from "react";

import sk from "./translations/sk.json";
import en from "./translations/en.json";

export type Locale = "sk" | "en";

const STORAGE_KEY = "app-locale";

const messages: Record<Locale, Record<string, unknown>> = {
  sk: sk as Record<string, unknown>,
  en: en as Record<string, unknown>,
};

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "sk";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "en" || v === "sk") return v;
    return "sk";
  } catch {
    return "sk";
  }
}

function setStoredLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
}

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("sk");

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setStoredLocale(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next === "en" ? "en" : "sk";
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      const dict = messages[locale];
      const value = getNested(dict, key);
      return value ?? key;
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  React.useEffect(() => {
    setLocaleState(getStoredLocale());
    const lang = getStoredLocale();
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "en" ? "en" : "sk";
    }
  }, []);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export function useTranslation() {
  const { t, locale, setLocale } = useI18n();
  return { t, locale, setLocale };
}
