"use client";

import Link from "next/link";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useTranslation } from "@/lib/i18n/context";

export function HomeContent() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-16">
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>
      <section className="mx-auto max-w-4xl space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--artifex-steel)] uppercase">
            {t("home.platform")}
          </p>
          <h1 className="text-4xl leading-tight font-bold text-[var(--artifex-navy)]">
            {t("home.title")}
          </h1>
          <p className="max-w-3xl text-slate-600">{t("home.subtitle")}</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/org-chart"
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-[var(--artifex-steel)] hover:shadow-sm"
          >
            <p className="text-sm font-semibold text-[var(--artifex-navy)]">
              {t("home.orgStructure")}
            </p>
            <p className="mt-1 text-sm text-slate-600">{t("home.orgStructureDesc")}</p>
          </Link>
          <Link
            href="/job-descriptions"
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-[var(--artifex-orange)] hover:shadow-sm"
          >
            <p className="text-sm font-semibold text-[var(--artifex-navy)]">
              {t("home.jobLibrary")}
            </p>
            <p className="mt-1 text-sm text-slate-600">{t("home.jobLibraryDesc")}</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
