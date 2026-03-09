# Revízia projektu Artifex Organigram

Stručná revízia architektúry, stavu kódu a **netradičných** návrhov na zlepšenie.

---

## 1. Čo projekt robí dobre

- **Štack:** Next.js 16, React 19, Supabase, XYFlow — modernej stack s App Routerom.
- **Štruktúra:** Rozumné rozdelenie `src/app`, `src/components`, `src/lib` (org, job-descriptions, supabase).
- **Auth a RLS:** Role (admin / hr_editor / viewer), company isolation, single-tenant z `user_company_roles`.
- **Org chart:** Bohatá funkcionalita — GM, vrstvy, vakancie, strediská, vzhľad (farby, štýly), undo (records + settings), PDF export.
- **Design:** Tokens v `tokens.ts`, Tailwind v4, tlač cez `.chart-print-area`.
- **Dáta:** Viacnásobný zdroj (iac_employees → employees → local), CSV import s validáciou, fotky do Storage + `employee_photo_urls`.

---

## 2. Slabšie miesta a riziká

| Oblasť | Stav | Riziko |
|--------|------|--------|
| **Testy** | Žiadne unit/integration/e2e testy | Regresie, ťažšia refaktorácia |
| **Veľký komponent** | `org-chart-canvas.tsx` ~2400 riadkov | Ťažká údržba, merge konflikty |
| **Prístupnosť** | Niektoré `aria-label`/focus, žiadna systematická a11y | Screen readery a klávesnica nie sú plne podporované |
| **Snapshot/verzie** | Tabuľky `org_snapshots` + `org_edges` existujú, UI ich nevyužíva | Audit a „porovnaj s minulým“ chýba |
| **README** | Základný; niektoré migrácie (005–009) nie sú v zozname | Onboarding a dokumentácia zaostávajú |

---

## 3. Návrhy na zlepšenie (štandardné)

- **Testy:** Pridať aspoň Vitest (unit pre `lib/org/*`, import, validácia) a Playwright pre kritické flow (login, načítanie chartu, export PDF).
- **Refaktor canvasu:** Rozbiť `org-chart-canvas.tsx` na menšie moduly (napr. `useOrgChartNodesEdges`, `useGridSettings`, `ChartToolbar`, `ChartReactFlowWrapper`) bez zmeny správania.
- **Dokumentácia:** Do README doplniť všetky migrácie (001–009), env premenné a stručný popis API routes.
- **A11y:** Jednotný focus management v sidebaroch, `role="tree"` / `role="treeitem"` pre hierarchiu, live region pre „undo“ / export.

---

## 4. Netradičné a „out of the box“ nápady

### 4.1 Zdieľateľný read-only odkaz na konkrétny pohľad

**Myšlienka:** Užívateľ si nastaví viewport, rozbalené uzly a filtre (stredisko, vrstvy) a dostane odkaz, ktorý to presne reprodukuje — bez editovania.

**Implementácia:**  
Enkódovať stav do query (napr. `?v=base64(...)` alebo krátky hash) alebo do DB ako „shared view“ s tokenom. Pri otvorení linku načítať len tento view (viewport + expanded + filters). Role viewer alebo anonym s tokenom len zobrazí.

**Prečo netradičné:** Väčšina org chartov rieši „export PDF“, málokto „zdieľaj presne tento pohľad jedným linkom“.

---

### 4.2 Uložené pohľady podľa strediska / vetvy

**Myšlienka:** Stredisko je už node typ a sú tam filtre. Pridať „uložené pohľady“: napr. „Celý strom“, „Výroba“, „Podľa KAT“, „Vetva X“.

**Implementácia:**  
Uložiť kombináciu: GM (ak relevantné), max layers, visible strediská, custom strediská, rozbalené node ID. Buď v DB (pre admina) alebo localStorage. UI: dropdown alebo tabs „Pohľad: [Celý strom ▼]“ s prepínaním bez manuálneho nastavovania.

**Prečo netradičné:** Typicky sa filtruje „teraz“, málokto ponúkne „jedným klikom preskočiť na iný kontext“.

---

### 4.3 Diff / porovnanie s predchádzajúcim stavom alebo snapshotom

**Myšlienka:** V DB máte `org_snapshots` a `org_edges`. Použiť to na „Porovnaj s predchádzajúcim“ alebo „Porovnaj so snapshotom X“.

**Implementácia:**  
Výpočet diffu medzi aktuálnym stromom a zvoleným snapshotom (pridané / odstránené / presunuté uzly, prípadne zmenené atribúty). Vizuálne zvýrazniť (napr. zelená = nové, červená = odstránené, oranžová = presun). Voliteľne jednoduchý textový zoznam zmien.

**Prečo netradičné:** Audit a komunikácia zmien v organizácii sú často v e-mailoch; tu by boli priamo v aplikácii.

---

### 4.4 Plná klávesnicová navigácia v org charte

**Myšlienka:** Šípky = presun medzi uzlami, Enter = otvoriť detail, Space = rozbaliť/zbaliť. Bez myši.

**Implementácia:**  
Vrstva nad React Flow: „chart focus manager“ — držať aktuálny node id, na základe šípok meniť fokus na suseda (podľa hierarchie alebo priestorového rozloženia). React Flow má podporu pre focus; treba definovať graf „susedov“ a obsluhovať keydown. Screen readery by mohli čítať názov a rolu uzla.

**Prečo netradičné:** Väčšina org chartov je „klikací“; málokto urobí chart skutočne navigovateľný ako strom v súborovom manažéri.

---

### 4.5 Export „decku“ / jednej vetvy ako slajd

**Myšlienka:** Namiesto jedného veľkého PDF celého stromu — „Exportuj viditeľnú vetvu ako jeden slajd“ alebo „Jedna vetva = jedna strana“.

**Implementácia:**  
Režim: vybrať root vetvy (alebo aktuálne rozbalený podstrom), generovať PDF kde každá vetva je jedna strana (alebo jeden obrázok). Použiť existujúce `html-to-image` + jspdf, ale s výrezom podstromu. Voliteľne HTML „prezentácia“ (jedna vetva na obrazovku) pre meetingy.

**Prečo netradičné:** Bežné je „export všetko“; tu by používateľ dostal priamo prezentovateľný materiál bez ručného orezávania.

---

### 4.6 „Živý“ odkaz na osobu v org charte

**Myšlienka:** Link typu `/org-chart?highlight=EMPLOYEE_ID` alebo `#node-EMPLOYEE_ID` — pri otvorení sa chart vycentruje na danú osobu, prípadne rozbalí cestu od GM k nej a zvýrazní ju.

**Implementácia:**  
Na strane stránky čítať `highlight` z URL, nájsť node, použiť `fitView` s paddingom okolo node, prípadne `setCenter` a rozbaliť všetkých predkov. Krátky animovaný „pulse“ na node. V detail paneli tlačidlo „Kopírovať odkaz na túto pozíciu“.

**Prečo netradičné:** Kombinuje „share view“ s konkrétnou osobou — užitočné pre HR alebo manažérov pri odkazovaní na konkrétne miesto v štruktúre.

---

### 4.7 Jednoduchý „režim prezentácie“

**Myšlienka:** Fullscreen režim len s chartom, bez sidebarov a toolbarov, s možnosťou šípkami alebo klikom prechádzať „kroky“ (napr. postupne rozbaliť jednu vetvu po druhej).

**Implementácia:**  
Route alebo query `?presentation=1` — skryť sidebary, zväčšiť canvas, voliteľne „kroky“ uložené ako zoznam node id + rozbalený stav. Šípka vpravo = ďalší krok (rozbaliť ďalší node), vľavo = späť. Export do PDF v tomto režime = jedna strana na krok.

**Prečo netradičné:** Org chart ako „prezentácia“ namiesto statického exportu — vhodné pre board meetingy.

---

### 4.8 Vizuálna indikácia „čerstvosti“ zmien

**Myšlienka:** Pri zmene manažéra alebo priradení (ak sa v budúcnosti bude zapisovať do DB) zobraziť pri uzle napr. „Nové / zmenené za posledných 7 dní“.

**Implementácia:**  
Ak máte `updated_at` na záznamoch alebo v snapshotoch, počítať „last changed“ a v kartičke uzla zobraziť jemný badge alebo bodku. Farba podľa veku (napr. zelená = dnes, žltá = tento týždeň). Pre lokálne dáta môže byť „zmenené v tejto session“.

**Prečo netradičné:** Organizačné zmeny sú často neviditeľné; tu by boli na prvý pohľad.

---

## 5. Prioritizácia (odporúčanie)

| Priorita | Nápad | Dôvod |
|----------|--------|--------|
| Vysoká | Zdieľateľný odkaz na pohľad (4.1) | Veľký UX zisk pri minimálnom zásahu (URL + serializácia stavu). |
| Vysoká | Odkaz na osobu (4.6) | Prirodzené rozšírenie 4.1, veľmi praktické pre HR. |
| Stredná | Uložené pohľady (4.2) | Využíva existujúci koncept strediska a filtrov. |
| Stredná | Klávesnicová navigácia (4.4) | A11y + power user, React Flow to čiastočne umožňuje. |
| Stredná | Diff vs. snapshot (4.3) | Využíva existujúcu schému; zvyšuje dôveryhodnosť produktu. |
| Nízka | Export decku (4.5) | Rozšírenie existujúceho PDF exportu. |
| Nízka | Režim prezentácie (4.7) | Špecifický use case, ale výrazne odlíši od konkurencie. |
| Nízka | Čerstvosť zmien (4.8) | Závisí od toho, či a kde budete evidovať `updated_at` v UI. |

---

## 6. Záver

Projekt je technicky v dobrom stave (Next.js, Supabase, RLS, bohatý org chart). Najväčší zisk prinesie:

1. **Refaktor veľkého canvasu** a **základné testy** — pre udržiavateľnosť.  
2. **Zdieľateľné linky (pohľad + osoba)** — netradičné a veľmi použiteľné.  
3. **Využitie snapshotov** (diff, uložené pohľady) — odlíšenie od typických „flat“ org chartov.

Ak chceš, môžeme niektorý z bodov 4.1–4.8 rozpracovať do konkrétnych krokov (API, komponenty, DB zmeny) alebo najprv spraviť refaktor canvasu a testy.
