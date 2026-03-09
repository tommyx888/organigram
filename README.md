## Artifex Organigram

Web application starter for:
- enterprise organization chart rendering,
- CSV import validation for hierarchy data,
- Job Description library with versioning workflow,
- Supabase schema foundation (RLS + audit-ready structure).

## Getting Started

1) Install dependencies:

```bash
npm install
```

2) Configure environment variables:

```bash
cp .env.example .env.local
```

Required for Supabase mode:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Single-tenant mode:
- app resolves one active company automatically from `user_company_roles` (or first record in `companies`).

3) Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Main routes

- `/` - landing page and module navigation
- `/org-chart` - interactive org chart canvas with display filters
- `/job-descriptions` - starter UI for job description workflow

## CSV import format

Expected headers:

```csv
employee_type,os_c,meno,kat,str,odd,funkcia,priamy_nadr,status
direct,1201,Peter Urban,A,AA,Production,Production Manager,Eva Novak,active
```

Import rules:
- only rows with `status=active` are loaded,
- `os_c` -> employee ID, `meno` -> full name, `odd` -> department, `funkcia` -> position name,
- `employee_type` is mapped to `salaried/indirect/direct`,
- hierarchy uses `priamy_nadr` with name-based matching,
- duplicate manager names are blocking errors (`ambiguous_manager_name`) and must be resolved manually.
- live org chart prefers data from `public.iac_employees`; if unavailable, app falls back to `employees` projection and then local mode.
- org chart data is now loaded through server route `GET /api/org/records` with explicit `mode=live|fallback`.
- position name mapping in `iac_employees` prefers `funkcia_v_pz` (fallback to `funkcia`/`pozicia` when present).

## Supabase structure

Migrations:
- `supabase/migrations/001_init_org_schema.sql`
- `supabase/migrations/002_rls_policies.sql`
- `supabase/migrations/003_job_description_schema.sql`
- `supabase/migrations/004_auth_roles.sql`

Edge function stubs:
- `supabase/functions/import-org-data/index.ts`
- `supabase/functions/publish-snapshot/index.ts`
- `supabase/functions/publish-job-description/index.ts`

## Notes

- Brand palette and typography tokens are defined in `src/styles/tokens.ts`.
- Frontend currently uses mock data for UI preview; next step is wiring realtime Supabase reads/writes.
- Dashboard routes now support auth gate and role mode (`admin`, `hr_editor`, `viewer`).
- To grant access, insert your user into `user_company_roles` after login.
- This repository currently reports dependency vulnerabilities from upstream packages; review with `npm audit`.

