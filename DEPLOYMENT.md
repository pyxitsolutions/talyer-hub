# PyX AutoCare Pro — Deployment Guide

Production deployment guide for PyX AutoCare Pro (SaaS-ready, multi-tenant auto care shop management).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase](https://supabase.com/) project
- [Vercel](https://vercel.com/) account (recommended) or any Node.js host

## 1. Supabase Setup

### Create Project

1. Create a new Supabase project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Note your **Project URL**, **anon key**, and **service_role key** from Settings → API

### Run Database Migrations

In the Supabase SQL Editor, run these files in order:

1. `supabase/migrations/001_initial_schema.sql` — Tables, indexes, triggers, functions
2. `supabase/migrations/002_rls_policies.sql` — Row Level Security policies
3. `supabase/seed.sql` — Demo roles, shop, customers, inventory (optional)

### Enable Authentication

In Supabase Dashboard → Authentication → Providers:

- Enable **Email** provider
- Configure **Site URL**: `https://your-domain.com`
- Add **Redirect URLs**:
  - `https://your-domain.com/reset-password`
  - `http://localhost:3000/reset-password` (development)

### Storage (Optional — Shop Logos)

1. Create a bucket named `shop-logos`
2. Set public access or use signed URLs
3. Add storage policies scoped to authenticated users

## 2. Environment Variables

Copy `.env.example` to `.env.local` for development:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, for registration) |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g. `https://yourapp.vercel.app`) |
| `NEXT_PUBLIC_APP_NAME` | Display name (default: PyX AutoCare Pro) |

> **Security:** Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client. Use only in server actions.

## 3. Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### First User Registration

1. Go to `/register`
2. Create account with shop details
3. The system creates: shop → profile → owner role assignment

## 4. Deploy to Vercel

### Via CLI

```bash
npm i -g vercel
vercel
```

### Environment Variables on Vercel

Add all variables from `.env.example` in Project Settings → Environment Variables.

### Build Settings

- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next` (default)

## 5. Production Best Practices

### Security

- RLS is enabled on all tenant tables — verify policies after migrations
- Use `SUPABASE_SERVICE_ROLE_KEY` only in server actions (registration)
- Enable Supabase email confirmation in production
- Set strong password requirements in Supabase Auth settings

### Multi-Tenancy

- Every business table includes `shop_id`
- `get_user_shop_id()` function scopes all RLS policies
- Users can only access data belonging to their shop

### Performance

- Database indexes are created for common query patterns
- Use TanStack Query caching on the client
- Dashboard uses server actions for KPI aggregation
- Consider Supabase connection pooling for high traffic (Supavisor)

### Monitoring

- Enable Vercel Analytics
- Use Supabase Dashboard for query performance
- Set up error tracking (Sentry recommended)

### Backups

- Enable Supabase daily backups (Pro plan)
- Export critical reports regularly via the Reports module

## 6. Role-Based Access

| Role | Access |
|------|--------|
| Owner | Full access to all modules |
| Service Advisor | Customers, vehicles, estimates, job orders |
| Technician | Job orders, estimates, service history |
| Cashier | Invoices, sales, reports |

Assign roles via the `user_roles` table after creating team members.

## 7. Post-Deployment Checklist

- [ ] Run all SQL migrations
- [ ] Configure auth redirect URLs
- [ ] Set environment variables on host
- [ ] Register first shop owner account
- [ ] Verify RLS — test with two shop accounts
- [ ] Test PDF export (estimates, invoices, job orders)
- [ ] Test Excel export (reports module)
- [ ] Configure custom domain + SSL
- [ ] Enable email confirmation (production)

## 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| "Shop not found" on login | Ensure profile has `shop_id` set during registration |
| RLS blocks inserts | Verify user profile exists and `shop_id` matches |
| PDF QR codes broken | Set `NEXT_PUBLIC_APP_URL` to production URL |
| Password reset fails | Add redirect URL in Supabase Auth settings |
| Build fails without env | Placeholder values are used; set real keys before deploy |

## Support

For schema changes, add new migration files under `supabase/migrations/` and run them in order. Never modify production schema directly without a migration.
