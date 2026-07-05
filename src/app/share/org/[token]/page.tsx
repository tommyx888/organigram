"use client";

/**
 * Verejný náhľad organizačnej štruktúry (iba aktívni SAL zamestnanci).
 * Prístup cez zdieľateľný odkaz /share/org/[token] – bez prihlásenia.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import type { PublicOrgPayload, PublicOrgPerson } from "@/lib/org/public-org-types";
import { STREDISKO_NAMES } from "@/lib/org/stredisko-names";

import "./public-org.css";

type Lang = "sk" | "en";

const L: Record<Lang, Record<string, string>> = {
  sk: {
    title: "Organizačná štruktúra",
    subtitle: "Prehľad vedenia a oddelení spoločnosti",
    leadership: "Vedenie spoločnosti",
    departments: "Oddelenia",
    employees: "zamestnancov",
    employees2: "zamestnanci",
    people: "ľudí",
    print: "Tlačiť / PDF",
    generated: "Vygenerované",
    confidential:
      "Tento náhľad je určený na zdieľanie mimo organizácie a obsahuje iba aktívnych THP (salaried) zamestnancov.",
    loading: "Načítavam organizačnú štruktúru…",
    errTitle: "Odkaz nie je platný",
    errBody:
      "Tento odkaz na náhľad organizačnej štruktúry neexistuje, bol deaktivovaný alebo mu vypršala platnosť.",
    deptLead: "Vedúci oddelenia",
    legendSolid: "priama línia riadenia",
    legendDashed: "nepriama (prerušovaná) línia",
    vacancy: "Voľná pozícia",
  },
  en: {
    title: "Organization Structure",
    subtitle: "Company leadership and departments overview",
    leadership: "Company Leadership",
    departments: "Departments",
    employees: "employees",
    employees2: "employees",
    people: "people",
    print: "Print / PDF",
    generated: "Generated",
    confidential:
      "This view is intended for sharing outside the organization and contains active salaried employees only.",
    loading: "Loading organization structure…",
    errTitle: "Link is not valid",
    errBody:
      "This organization structure link does not exist, has been disabled or has expired.",
    deptLead: "Department lead",
    legendSolid: "direct reporting line",
    legendDashed: "indirect (dotted) line",
    vacancy: "Open position",
  },
};

/** Farby oddelení podľa čísla strediska (Artifex paleta + odvodené odtiene). */
const DEPT_COLORS: Record<string, string> = {
  "10": "#21394F", // Production – navy
  "20": "#75909C", // Maintenance – steel
  "30": "#F06909", // Logistic – orange
  "40": "#949C58", // Quality – olive
  "50": "#3E6B8C", // Technical
  "60": "#0E7490", // IT
  "70": "#D4517E", // HR & HSE – pink
  "80": "#7A5C9E", // Finance
  "90": "#21394F", // Management
  "91": "#B0813B", // CI
  "92": "#5B8A72", // Purchase
  "95": "#A34E68", // Business
  "98": "#5C6B7A", // Programe
};

const FALLBACK_COLORS = ["#21394F", "#949C58", "#D4517E", "#F06909", "#75909C", "#3E6B8C"];

/**
 * Vedenie – plná čiara (priama línia riadenia) pre menovaných priamych podriadených.
 * Voľné pozície (vacancy) s vlastným tímom sú plnou čiarou automaticky.
 * os_c: Jurčišin.
 */
const LEADERSHIP_SOLID_IDS = ["31003938"];

/** Vylúčení z vedenia – zobrazujú sa iba vo vlastnej sekcii (Blažek Peter → CI). */
const LEADERSHIP_EXCLUDED_IDS = new Set(["31001503"]);

/** Strediská bez samostatnej sekcie (90 Management pokrýva sekcia Vedenie). */
const HIDDEN_DEPT_SECTIONS = new Set(["90"]);

/** Premapovanie stredísk pre verejný náhľad (93 patrí pod Purchase, nie Technical). */
const DEPT_REMAP: Record<string, { code: string; name: string }> = {
  "93": { code: "92", name: "Purchase" },
};

function countEmployees(people: PublicOrgPerson[]): number {
  return people.filter((p) => !p.isVacancy).length;
}

function deptColor(code: string, index: number): string {
  return DEPT_COLORS[code] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

type TreeNode = {
  person: PublicOrgPerson;
  children: TreeNode[];
};

/** Postaví strom z plochého zoznamu; roots = ľudia bez manažéra v sete. */
function buildTree(
  people: PublicOrgPerson[],
  isRoot: (p: PublicOrgPerson) => boolean,
): TreeNode[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const childrenByManager = new Map<string, PublicOrgPerson[]>();

  people.forEach((p) => {
    if (!p.managerId || !byId.has(p.managerId)) return;
    const list = childrenByManager.get(p.managerId) ?? [];
    list.push(p);
    childrenByManager.set(p.managerId, list);
  });

  const sortPeople = (a: PublicOrgPerson, b: PublicOrgPerson) => {
    const ca = childrenByManager.get(a.id)?.length ?? 0;
    const cb = childrenByManager.get(b.id)?.length ?? 0;
    if (cb !== ca) return cb - ca; // ľudia s podriadenými prví
    return a.name.localeCompare(b.name, "sk");
  };

  const toNode = (p: PublicOrgPerson): TreeNode => ({
    person: p,
    children: (childrenByManager.get(p.id) ?? []).slice().sort(sortPeople).map(toNode),
  });

  return people.filter(isRoot).sort(sortPeople).map(toNode);
}

function countNodes(node: TreeNode): number {
  return 1 + node.children.reduce((sum, ch) => sum + countNodes(ch), 0);
}

/**
 * Vedúci oddelenia = najčastejší manažér (mimo oddelenia) členov oddelenia,
 * okrem generálneho manažéra – ten patrí do sekcie Vedenie.
 */
function computeDeptLeadId(
  people: PublicOrgPerson[],
  allById: Map<string, PublicOrgPerson>,
  globalRootId: string | null,
): string | null {
  const inDept = new Set(people.map((p) => p.id));
  const counts = new Map<string, number>();
  people.forEach((p) => {
    const mId = p.managerId;
    if (mId && !inDept.has(mId) && mId !== globalRootId && allById.has(mId) && !allById.get(mId)?.isVacancy) {
      counts.set(mId, (counts.get(mId) ?? 0) + 1);
    }
  });
  let leadId: string | null = null;
  let best = 0;
  counts.forEach((n, id) => {
    if (n > best) {
      best = n;
      leadId = id;
    }
  });
  return leadId;
}

/* ── UI komponenty ─────────────────────────────────────────────── */

function Avatar({
  person,
  size,
  ring,
}: {
  person: PublicOrgPerson;
  size: number;
  ring: string;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-slate-100 to-slate-200"
      style={{ width: size, height: size, boxShadow: `0 0 0 3px #fff, 0 0 0 5px ${ring}55` }}
    >
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photoUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${ring}, ${ring}bb)`, fontSize: size * 0.36 }}
        >
          {initials(person.name)}
        </div>
      )}
    </div>
  );
}

function PersonCard({
  person,
  color,
  size = "md",
  deptBadge,
}: {
  person: PublicOrgPerson;
  color: string;
  size?: "xl" | "lg" | "md";
  deptBadge?: string | null;
}) {
  const dims =
    size === "xl"
      ? { w: 280, avatar: 88, name: 17, pos: 13 }
      : size === "lg"
        ? { w: 230, avatar: 64, name: 14, pos: 12 }
        : { w: 200, avatar: 48, name: 13, pos: 11 };

  return (
    <div
      className="relative flex flex-col items-center rounded-2xl border border-slate-200/80 bg-white px-4 pb-4 text-center"
      style={{
        width: dims.w,
        paddingTop: dims.avatar / 2 + 14,
        marginTop: dims.avatar / 2,
        boxShadow: "0 10px 30px rgba(33,57,79,0.10), 0 2px 8px rgba(33,57,79,0.06)",
      }}
    >
      <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl" style={{ background: color }} />
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: -dims.avatar / 2 }}
      >
        <Avatar person={person} size={dims.avatar} ring={color} />
      </div>

      <p
        className="line-clamp-2 font-bold leading-snug text-[var(--artifex-navy)]"
        style={{ fontSize: dims.name }}
        title={person.name}
      >
        {person.name}
      </p>
      <p
        className="mt-1 line-clamp-2 leading-snug text-slate-500"
        style={{ fontSize: dims.pos }}
        title={person.position}
      >
        {person.position}
      </p>
      {deptBadge ? (
        <span
          className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
          style={{ background: color }}
        >
          {deptBadge}
        </span>
      ) : null}
    </div>
  );
}

/** Karta voľnej pozície (vacancy) – otvorená pozícia namiesto osoby. */
function VacancyCard({ person, label }: { person: PublicOrgPerson; label: string }) {
  return (
    <div
      className="relative flex flex-col items-center rounded-2xl border-2 border-dashed border-[var(--artifex-steel)] bg-white/80 px-4 pb-4 text-center"
      style={{ width: 230, paddingTop: 46, marginTop: 32, boxShadow: "0 8px 24px rgba(33,57,79,0.08)" }}
    >
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -32 }}>
        <div
          className="flex items-center justify-center rounded-full border-2 border-dashed border-[var(--artifex-steel)] bg-slate-50"
          style={{ width: 64, height: 64, boxShadow: "0 0 0 3px #fff" }}
        >
          <svg className="h-7 w-7 text-[var(--artifex-steel)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
          </svg>
        </div>
      </div>
      <p className="line-clamp-2 text-sm font-bold leading-snug text-[var(--artifex-navy)]" title={person.name}>
        {person.name}
      </p>
      <span className="mt-2 inline-block rounded-full bg-[var(--artifex-orange)]/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--artifex-orange)]">
        {label}
      </span>
    </div>
  );
}

/** Kompaktný stĺpec radových členov (bez podriadených) – šetrí šírku stromu. */
function StackColumn({ nodes, color }: { nodes: TreeNode[]; color: string }) {
  return (
    <div className="flex flex-col gap-2">
      {nodes.map((n) => (
        <div
          key={n.person.id}
          className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white py-2 pl-2.5 pr-3"
          style={{
            width: 252,
            borderLeft: `3px solid ${color}`,
            boxShadow: "0 4px 14px rgba(33,57,79,0.07)",
          }}
        >
          <Avatar person={n.person} size={34} ring={color} />
          <div className="min-w-0 text-left">
            <p className="truncate text-[12px] font-bold text-[var(--artifex-navy)]" title={n.person.name}>
              {n.person.name}
            </p>
            <p className="truncate text-[10.5px] text-slate-500" title={n.person.position}>
              {n.person.position}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrgTree({
  node,
  color,
  depth = 0,
  rootBadge,
}: {
  node: TreeNode;
  color: string;
  depth?: number;
  rootBadge?: string | null;
}) {
  const branches = node.children.filter((c) => c.children.length > 0);
  const leaves = node.children.filter((c) => c.children.length === 0);
  const stackLeaves = leaves.length >= 3;

  return (
    <li>
      <PersonCard
        person={node.person}
        color={color}
        size={depth === 0 ? "lg" : "md"}
        deptBadge={depth === 0 ? rootBadge : undefined}
      />
      {node.children.length > 0 ? (
        <ul>
          {branches.map((child) => (
            <OrgTree key={child.person.id} node={child} color={color} depth={depth + 1} />
          ))}
          {stackLeaves ? (
            <li>
              <StackColumn nodes={leaves} color={color} />
            </li>
          ) : (
            leaves.map((child) => (
              <OrgTree key={child.person.id} node={child} color={color} depth={depth + 1} />
            ))
          )}
        </ul>
      ) : null}
    </li>
  );
}

function DeptSection({
  code,
  name,
  people,
  color,
  lang,
  allById,
  globalRootId,
}: {
  code: string;
  name: string;
  people: PublicOrgPerson[];
  color: string;
  lang: Lang;
  allById: Map<string, PublicOrgPerson>;
  globalRootId: string | null;
}) {
  const { lead, underLead, others } = useMemo(() => {
    const inDept = new Set(people.map((p) => p.id));
    const roots = buildTree(people, (p) => !p.managerId || !inDept.has(p.managerId));
    const leadId = computeDeptLeadId(people, allById, globalRootId);
    const lead = leadId ? (allById.get(leadId) ?? null) : null;
    const underLead = lead ? roots.filter((r) => r.person.managerId === lead.id) : [];
    const others = lead ? roots.filter((r) => r.person.managerId !== lead.id) : roots;
    return { lead, underLead, others };
  }, [people, allById, globalRootId]);

  const t = L[lang];

  return (
    <section
      id={`dept-${code}`}
      className="pub-dept-section pub-rise scroll-mt-28 rounded-3xl border border-slate-200/70 bg-white/70 p-6 backdrop-blur-sm md:p-8"
      style={{ boxShadow: "0 14px 40px rgba(33,57,79,0.07)" }}
    >
      <div className="pub-dept-content">
        <header className="mb-2 flex flex-wrap items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white"
            style={{ background: color }}
          >
            {code}
          </span>
          <h3 className="text-xl font-bold text-[var(--artifex-navy)] md:text-2xl">{name}</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {people.length} {people.length === 1 ? (lang === "sk" ? "osoba" : "person") : L[lang].people}
          </span>
          <span className="ml-auto hidden h-1 flex-1 rounded-full opacity-20 md:block" style={{ background: color, maxWidth: 220 }} />
        </header>

        <div className="otree-scroll">
          <div className="otree">
            <ul>
              {lead ? (
                <OrgTree
                  node={{ person: lead, children: underLead }}
                  color={color}
                  rootBadge={t.deptLead}
                />
              ) : null}
              {others.map((root) => (
                <OrgTree key={root.person.id} node={root} color={color} depth={lead ? 1 : 0} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Hlavná stránka ────────────────────────────────────────────── */

export default function PublicOrgPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const [lang, setLang] = useState<Lang>("sk");
  const [data, setData] = useState<PublicOrgPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public-org?token=${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error(String(res.status));
        const payload = (await res.json()) as PublicOrgPayload;
        if (!cancelled) {
          setData(payload);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  /** Pred tlačou/PDF zmenší len príliš široké stromy (vedenie). */
  const applyPrintScale = useCallback(() => {
    const marginPx = 32;
    const availableW = window.innerWidth - marginPx;

    document.querySelectorAll<HTMLElement>(".otree-scroll").forEach((scroll) => {
      const otree = scroll.querySelector<HTMLElement>(".otree");
      if (!otree) return;
      const contentW = otree.scrollWidth;
      if (contentW <= availableW) return;

      const scale = availableW / contentW;
      otree.style.transform = `scale(${scale})`;
      otree.style.transformOrigin = "top center";
      scroll.style.marginInline = "auto";
      scroll.dataset.printScaled = "1";
    });
  }, []);

  const resetPrintScale = useCallback(() => {
    document.querySelectorAll<HTMLElement>(".otree-scroll").forEach((scroll) => {
      const otree = scroll.querySelector<HTMLElement>(".otree");
      scroll.style.marginInline = "";
      delete scroll.dataset.printScaled;
      if (otree) {
        otree.style.transform = "";
        otree.style.transformOrigin = "";
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener("beforeprint", applyPrintScale);
    window.addEventListener("afterprint", resetPrintScale);
    return () => {
      window.removeEventListener("beforeprint", applyPrintScale);
      window.removeEventListener("afterprint", resetPrintScale);
    };
  }, [applyPrintScale, resetPrintScale]);

  const handlePrint = useCallback(() => {
    applyPrintScale();
    window.print();
  }, [applyPrintScale]);

  const departments = useMemo(() => {
    if (!data) return [];
    const byDept = new Map<string, PublicOrgPerson[]>();
    const nameOverride = new Map<string, string>();
    data.people.forEach((p) => {
      if (p.isVacancy) return; // voľné pozície nepatria do sekcií oddelení
      const remap = DEPT_REMAP[p.department];
      const key = remap?.code ?? (p.department || "—");
      if (remap) nameOverride.set(key, remap.name);
      if (HIDDEN_DEPT_SECTIONS.has(key)) return; // 90 Management pokrýva sekcia Vedenie
      const list = byDept.get(key) ?? [];
      list.push(p);
      byDept.set(key, list);
    });

    const knownOrder = Object.keys(STREDISKO_NAMES);
    const orderIndex = (code: string) => {
      const i = knownOrder.indexOf(code);
      return i === -1 ? 999 : i;
    };

    return [...byDept.entries()]
      .sort((a, b) => orderIndex(a[0]) - orderIndex(b[0]) || a[0].localeCompare(b[0]))
      .map(([code, people], index) => ({
        code,
        name:
          nameOverride.get(code) ??
          STREDISKO_NAMES[code] ??
          people[0]?.departmentName ??
          code,
        people,
        color: deptColor(code, index),
      }));
  }, [data]);

  const leadershipRoots = useMemo(() => {
    if (!data) return [];
    const roots = buildTree(data.people, (p) => !p.managerId);
    // Hlavný strom = koreň s najväčším počtom ľudí pod sebou
    return roots.sort((a, b) => countNodes(b) - countNodes(a));
  }, [data]);

  const mainRoot = leadershipRoots[0] ?? null;

  const allById = useMemo(
    () => new Map((data?.people ?? []).map((p) => [p.id, p])),
    [data],
  );

  const leadership = useMemo(() => {
    if (!mainRoot) return { solid: [] as TreeNode[], dashed: [] as TreeNode[] };
    const children = mainRoot.children.filter(
      (c) => !LEADERSHIP_EXCLUDED_IDS.has(c.person.id),
    );
    // Plná čiara: voľné pozície s tímom (napr. Plant Manager) + menovaní; ostatní prerušovane.
    const isSolid = (c: TreeNode) =>
      Boolean(c.person.isVacancy) || LEADERSHIP_SOLID_IDS.includes(c.person.id);
    const solid = children
      .filter(isSolid)
      .sort((a, b) => Number(Boolean(b.person.isVacancy)) - Number(Boolean(a.person.isVacancy)));
    const dashed = children
      .filter((c) => !isSolid(c))
      .sort((a, b) => a.person.name.localeCompare(b.person.name, "sk"));
    return { solid, dashed };
  }, [mainRoot]);

  /** Manažér → oddelenie, ktoré vedie (badge + farba karty vo vedení). */
  const ledDeptByManager = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    departments.forEach((d) => {
      const leadId = computeDeptLeadId(d.people, allById, mainRoot?.person.id ?? null);
      if (leadId && !map.has(leadId)) map.set(leadId, { name: d.name, color: d.color });
    });
    return map;
  }, [departments, allById, mainRoot]);

  const t = L[lang];

  if (state === "loading") {
    return (
      <main className="pub-org flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--artifex-navy)] border-t-transparent" />
          <p className="text-sm text-slate-500">{t.loading}</p>
        </div>
      </main>
    );
  }

  if (state === "error" || !data) {
    return (
      <main className="pub-org flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--artifex-pink)]/10">
            <svg className="h-7 w-7 text-[var(--artifex-pink)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-[var(--artifex-navy)]">{t.errTitle}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{t.errBody}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="pub-org min-h-screen pb-16">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden text-white"
        style={{
          background:
            "linear-gradient(120deg, #1a2e40 0%, var(--artifex-navy) 45%, #2e4a63 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 120%, #949C58 0, transparent 40%), radial-gradient(circle at 85% -20%, #D4517E 0, transparent 42%)",
          }}
        />
        <div className="relative mx-auto max-w-[1400px] px-6 py-10 md:px-10 md:py-14">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/artifex-logo.png" alt="Artifex" className="h-9 w-auto rounded bg-white/95 p-1" />
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                  {data.companyName}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-bold md:text-5xl">{t.title}</h1>
              <p className="mt-2 max-w-xl text-sm text-white/70 md:text-base">{t.subtitle}</p>
            </div>

            <div className="pub-no-print flex items-center gap-2">
              <div className="flex overflow-hidden rounded-full border border-white/25 text-xs font-semibold">
                {(["sk", "en"] as Lang[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    className={`px-3 py-1.5 uppercase transition ${
                      lang === code ? "bg-white text-[var(--artifex-navy)]" : "text-white/75 hover:bg-white/10"
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-full border border-white/25 px-4 py-1.5 text-xs font-semibold text-white/90 transition hover:bg-white/10"
              >
                {t.print}
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              {countEmployees(data.people)} {t.employees}
            </span>
            <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              {departments.length} {t.departments.toLowerCase()}
            </span>
            <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/70 backdrop-blur">
              {t.generated}: {new Date(data.generatedAt).toLocaleDateString(lang === "sk" ? "sk-SK" : "en-GB")}
            </span>
          </div>
        </div>
      </header>

      {/* ── Rýchla navigácia po oddeleniach ─────────────────── */}
      <nav className="pub-no-print sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] gap-2 overflow-x-auto px-6 py-2.5 md:px-10">
          <a
            href="#leadership"
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--artifex-navy)] transition hover:border-[var(--artifex-navy)]"
          >
            ★ {t.leadership}
          </a>
          {departments.map((d) => (
            <a
              key={d.code}
              href={`#dept-${d.code}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-[var(--artifex-navy)]"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
              {d.name}
              <span className="text-slate-400">{d.people.length}</span>
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-[1400px] space-y-10 px-6 pt-10 md:px-10">
        {/* ── Vedenie ─────────────────────────────────────────── */}
        {mainRoot ? (
          <section
            id="leadership"
            className="pub-dept-section pub-rise scroll-mt-28 rounded-3xl border border-slate-200/70 bg-white/70 p-6 backdrop-blur-sm md:p-8"
            style={{ boxShadow: "0 14px 40px rgba(33,57,79,0.07)" }}
          >

            <div className="pub-dept-content">
              <header className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--artifex-navy)] text-white">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2l2.4 4.86 5.36.78-3.88 3.78.92 5.34L12 14.24l-4.8 2.52.92-5.34-3.88-3.78 5.36-.78L12 2z" />
                  </svg>
                </span>
                <h2 className="text-xl font-bold text-[var(--artifex-navy)] md:text-2xl">{t.leadership}</h2>
              </header>

              <div className="otree-scroll">
                <div className="otree">
                  <ul>
                    <li>
                      <PersonCard person={mainRoot.person} color="#21394F" size="xl" />
                      {leadership.solid.length + leadership.dashed.length > 0 ? (
                        <ul>
                          {leadership.solid.map((child, i) => {
                            if (child.person.isVacancy) {
                              return (
                                <li key={child.person.id}>
                                  <VacancyCard person={child.person} label={t.vacancy} />
                                  {child.children.length > 0 ? (
                                    <ul>
                                      {[...child.children]
                                        .sort((a, b) => a.person.name.localeCompare(b.person.name, "sk"))
                                        .map((gc, j) => {
                                        const led = ledDeptByManager.get(gc.person.id);
                                        const color = led?.color ?? deptColor(gc.person.department, j);
                                        const badge =
                                          led?.name ??
                                          STREDISKO_NAMES[gc.person.department] ??
                                          gc.person.departmentName ??
                                          gc.person.department;
                                        return (
                                          <li key={gc.person.id}>
                                            <PersonCard person={gc.person} color={color} size="lg" deptBadge={badge} />
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : null}
                                </li>
                              );
                            }
                            const led = ledDeptByManager.get(child.person.id);
                            const color = led?.color ?? deptColor(child.person.department, i);
                            const badge =
                              led?.name ??
                              STREDISKO_NAMES[child.person.department] ??
                              child.person.departmentName ??
                              child.person.department;
                            return (
                              <li key={child.person.id}>
                                <PersonCard person={child.person} color={color} size="lg" deptBadge={badge} />
                              </li>
                            );
                          })}
                          {leadership.dashed.map((child, i) => {
                            const led = ledDeptByManager.get(child.person.id);
                            const color = led?.color ?? deptColor(child.person.department, i + 6);
                            const badge =
                              led?.name ??
                              STREDISKO_NAMES[child.person.department] ??
                              child.person.departmentName ??
                              child.person.department;
                            return (
                              <li key={child.person.id} className="otree-dashed-link">
                                <PersonCard person={child.person} color={color} size="md" deptBadge={badge} />
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-0 w-8 border-t-2 border-[#8fa1b3]" />
                  {t.legendSolid}
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-block h-0 w-8 border-t-2 border-dashed border-[#8fa1b3]" />
                  {t.legendDashed}
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Oddelenia ───────────────────────────────────────── */}
        {departments.map((d) => (
          <DeptSection
            key={d.code}
            code={d.code}
            name={d.name}
            people={d.people}
            color={d.color}
            lang={lang}
            allById={allById}
            globalRootId={mainRoot?.person.id ?? null}
          />
        ))}

        {/* ── Pätička ─────────────────────────────────────────── */}
        <footer className="rounded-3xl border border-slate-200/70 bg-white/60 px-6 py-5 text-center backdrop-blur-sm">
          <p className="text-xs leading-relaxed text-slate-500">{t.confidential}</p>
          <p className="mt-1 text-xs text-slate-400">
            © {new Date().getFullYear()} {data.companyName} · {t.generated}{" "}
            {new Date(data.generatedAt).toLocaleString(lang === "sk" ? "sk-SK" : "en-GB")}
          </p>
        </footer>
      </div>
    </main>
  );
}
