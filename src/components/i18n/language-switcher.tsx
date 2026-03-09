"use client";

import { useTranslation } from "@/lib/i18n/context";

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50/80 px-1 py-0.5">
      <button
        type="button"
        onClick={() => setLocale("sk")}
        className={`rounded px-2 py-1 text-xs font-medium transition ${
          locale === "sk"
            ? "bg-[var(--artifex-navy)] text-white"
            : "text-slate-600 hover:bg-slate-200 hover:text-slate-800"
        }`}
        aria-pressed={locale === "sk"}
        aria-label="Slovenčina"
      >
        SK
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded px-2 py-1 text-xs font-medium transition ${
          locale === "en"
            ? "bg-[var(--artifex-navy)] text-white"
            : "text-slate-600 hover:bg-slate-200 hover:text-slate-800"
        }`}
        aria-pressed={locale === "en"}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}
