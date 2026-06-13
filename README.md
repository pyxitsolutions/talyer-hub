# PyX AutoCare Pro

Auto care shop management system by PyX. Production-ready, SaaS-ready automotive workshop ERP built with Next.js, TypeScript, Supabase, and shadcn/ui. Supports multiple repair shops through multi-tenant architecture with Row Level Security.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)

## Features

- **Multi-Tenant SaaS** — Each shop is isolated via `shop_id` + Supabase RLS
- **Role-Based Access** — Owner, Service Advisor, Technician, Cashier
- **Dashboard** — KPIs, revenue/expense/profit charts, repair category analytics
- **Customer & Vehicle Management** — Full CRUD with service history
- **Repair Estimates** — Draft/approve/reject workflow, PDF export
- **Job Orders** — Convert from estimates, inventory deduction, status tracking
- **Billing Invoices** — Payment tracking, QR verification, PDF export
- **Inventory** — Stock in/out/adjustment, low-stock alerts, auto-deduction
- **Units Received** — PMS, minor/general/body repair monitoring
- **Sales & Expenses** — Analytics with P&L calculations
- **Reports** — PDF and Excel export with date range filters
- **Dark Mode** — Stripe/Linear-inspired modern UI

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 App Router, TypeScript, Tailwind CSS 4 |
| UI | shadcn/ui, Lucide Icons, Recharts |
| Forms | React Hook Form, Zod |
| Data | TanStack Query, TanStack Table |
| Backend | Next.js Server Actions, Route Handlers |
| Database | Supabase PostgreSQL |
| Auth | Supabase Authentication |
| Export | jsPDF, xlsx, QRCode |

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run Supabase migrations (see DEPLOYMENT.md)

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register your first shop at `/register`.

## Folder Structure

```
src/
├── app/
│   ├── (auth)/              # Login, register, password reset
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (dashboard)/         # Protected dashboard routes
│   │   └── dashboard/
│   │       ├── page.tsx     # Dashboard KPIs & charts
│   │       ├── customers/
│   │       ├── vehicles/
│   │       ├── estimates/
│   │       ├── job-orders/
│   │       ├── invoices/
│   │       ├── inventory/
│   │       ├── units-received/
│   │       ├── sales/
│   │       ├── expenses/
│   │       ├── service-history/
│   │       ├── reports/
│   │       └── settings/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   ├── layout/              # Sidebar, header, mobile nav
│   ├── providers/           # Theme, query providers
│   └── shared/              # Data table, page header, badges
├── features/                # Feature-based modules
│   ├── auth/
│   ├── customers/
│   ├── vehicles/
│   ├── estimates/
│   ├── job-orders/
│   ├── invoices/
│   ├── inventory/
│   ├── units-received/
│   ├── sales/
│   ├── expenses/
│   ├── service-history/
│   ├── reports/
│   ├── dashboard/
│   └── settings/
├── lib/
│   ├── supabase/            # Client, server, middleware
│   ├── pdf/                 # PDF generation
│   ├── excel/               # Excel export
│   ├── hooks/               # useShop, useDebounce
│   ├── actions/             # Registration server action
│   ├── auth.ts              # getShopId helper
│   ├── rbac.ts              # Role permissions
│   ├── constants.ts
│   └── utils.ts
└── types/
    └── database.ts          # TypeScript types

supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 002_rls_policies.sql
└── seed.sql
```

## Database Schema

All business tables include: `id` (UUID), `shop_id`, `created_at`, `updated_at`

| Table | Purpose |
|-------|---------|
| `shops` | Tenant organizations |
| `profiles` | User profiles linked to auth.users |
| `roles` / `user_roles` | RBAC |
| `customers` | Customer records |
| `vehicles` | Vehicle records (linked to customers) |
| `repair_estimates` / `repair_estimate_items` | Repair estimates |
| `job_orders` / `job_order_parts` | Work orders |
| `invoices` / `invoice_items` | Billing |
| `inventory_items` / `inventory_transactions` | Stock management |
| `units_received` | Unit intake tracking |
| `expenses` | Shop expenses |
| `sales_records` | Sales tracking |

## Environment Variables

See `.env.example` for all required variables. See [DEPLOYMENT.md](./DEPLOYMENT.md) for full setup and production deployment guide.

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

## License

Private — PyX AutoCare Pro. Commercial use for auto care shop management.
