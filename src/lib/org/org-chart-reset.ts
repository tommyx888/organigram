/**
 * Reset rozloženia organigramu na predvolenú „neviditeľnú“ šablónu.
 * Vymaže všetky uložené vrstvy (pozície, manažéri stredísk, rodičia, farby,
 * rozbalené strediská, vzhľad) a obnoví predvolený stav.
 */

const ORG_CHART_STORAGE_KEYS = [
  "org-chart-visible-strediska",
  "org-chart-custom-strediska",
  "org-chart-stredisko-colors",
  "org-chart-hidden-strediska",
  "org-chart-expanded",
  "org-chart-stredisko-manager",
  "org-chart-positions",
  "org-chart-stredisko-parent",
  "org-chart-positions-locked",
  "org-chart-hide-strediska",
  "org-chart-appearance",
  "org-chart-general-manager-id",
  "org-chart-vacancies",
  "org-chart-collapsed-nodes",
  "org-chart-employee-colors",
] as const;

/**
 * Obnoví všetko rozloženie a nastavenia organigramu podľa predvolenej šablóny.
 * Vymaže všetky relevantné položky z localStorage – po obnovení stránky sa
 * načítajú predvolené hodnoty (všetky strediská, žiadne vlastné pozície,
 * predvolený vzhľad a vrstvy).
 */
export function resetOrgChartToTemplate(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of ORG_CHART_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
