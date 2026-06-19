# TalyerHub

Auto care shop management system for talyers. Multi-tenant SaaS built with Next.js, TypeScript, Supabase, and shadcn/ui. Each shop is isolated via `shop_id` and Row Level Security.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)

## Features

- **Multi-tenant SaaS** — Shops isolated by `shop_id` + Supabase RLS
- **Shop registration & approval** — Pending → Platform Admin approves → active
- **Basic & Pro plans** — Basic ₱349/mo, Pro ₱649/mo (manual billing via support)
- **Role-based access** — Owner, Service Advisor, Technician, Cashier (+ Platform Super Admin)
- **Dashboard** — KPIs and charts (advanced charts on Pro)
- **Customers & vehicles** — CRUD, soft deactivate, service history
- **Repair estimates** — Draft / approve / reject / released, PDF export
- **Job orders** — From estimates, inventory deduction, status workflow
- **Invoices** — Payments, QR verification, PDF export
- **Units received** — Visit logging (Basic + Pro)
- **Inventory, sales, expenses** — Pro plan
- **Reports** — Basic: units, job orders, invoices (PDF). Pro: sales, expenses, P&L + Excel
- **Activity log** — Pro plan audit trail
- **Team management** — Pro: advisors, technicians, cashiers
- **Platform admin** — Approve shops, assign plan, deactivate, reset passwords, MRR reports
- **Privacy & terms** — `/privacy`, `/terms`, consent on register (R.A. 10173)
- **Dark mode**

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 App Router, TypeScript, Tailwind CSS 4 |
| UI | shadcn/ui, Lucide Icons, Recharts |
| Forms | React Hook Form, Zod |
| Data | TanStack Query, TanStack Table |
| Backend | Next.js Server Actions |
| Database | Supabase PostgreSQL |
| Auth | Supabase Authentication |
| Hosting | Vercel (recommended) |
| Export | jsPDF, xlsx, QRCode |

## Quick Start

```bash
npm install

cp .env.example .env.local
# Add Supabase URL, anon key, service role key

# New Supabase project → SQL Editor → run:
#   supabase/complete_schema.sql

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → `/register` → wait for Platform Admin approval.

Promote super admin (SQL Editor, after first register or reset):

```sql
UPDATE profiles SET is_super_admin = true WHERE email = 'your@email.com';

DELETE FROM shops
WHERE id IN (
  SELECT shop_id FROM profiles
  WHERE email = 'your@email.com' AND shop_id IS NOT NULL
);
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only (registration, team) |
| `NEXT_PUBLIC_APP_URL` | Yes | Deployed app URL (invoice QR codes) |
| `NEXT_PUBLIC_APP_NAME` | No | Default: `TalyerHub` |

See `.env.example` and [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel, Supabase auth, and per-environment setup.

## Git Branches & Environments

| Branch | Environment |
|--------|-------------|
| `develop` | Development |
| `staging` | Internal QA |
| `uat` | User acceptance testing |
| `main` | Production |

Promotion flow: `develop` → `staging` → `uat` → `main`

## Supabase SQL

| File | Use |
|------|-----|
| `supabase/complete_schema.sql` | Full setup on a **new empty** project (run once) |
| `supabase/reset.sql` | Block 1: clear business data. Block 2: full wipe |

Full reset with super admin via CLI:

```bash
npm run db:fresh-start
```

## Scripts

```bash
npm run dev           # Development server
npm run build         # Production build
npm run start         # Production server
npm run lint          # ESLint
npm run db:reset      # Wipe data + optional super admin (.env.local)
npm run db:fresh-start
npm run favicon       # Regenerate favicon from logo
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/                 # login, register, password reset
│   ├── (dashboard)/            # shop dashboard + status pages
│   │   ├── dashboard/          # customers, JO, invoices, reports, …
│   │   │   ├── admin/            # platform admin (super admin)
│   │   │   └── upgrade/          # plan upgrade page
│   │   ├── pending-approval/
│   │   ├── shop-disabled/
│   │   └── shop-rejected/
│   ├── privacy/ & terms/
│   └── verify/[code]/          # public invoice QR verify
├── components/                 # ui, layout, legal, shared
├── features/                   # domain modules (customers, invoices, …)
│   ├── platform-admin/
│   └── team/
├── lib/                        # auth, plans, supabase, pdf, rbac
└── types/database.ts

supabase/
├── complete_schema.sql
└── reset.sql
```

## Database (main tables)

All business tables include `shop_id`, `created_at`, `updated_at`.

| Table | Purpose |
|-------|---------|
| `shops` | Tenants (`status`, `plan`: basic/pro) |
| `profiles` / `user_roles` | Users and RBAC |
| `customers` / `vehicles` | Customer records |
| `repair_estimates` / `job_orders` / `invoices` | Core workflow |
| `inventory_*` / `units_received` | Stock and visit logs |
| `expenses` / `sales_records` | Finance |
| `activity_logs` | Pro audit trail |

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for:

- Supabase setup (confirm email **OFF**, Site URL)
- Vercel env vars per environment
- UAT / staging / prod checklist
- Post-deploy smoke tests

## License

Private — TalyerHub. Commercial use for auto care shop management.
