# TalyerHub — Deployment Guide

Production deployment guide for TalyerHub (SaaS-ready, multi-tenant auto care shop management).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase](https://supabase.com/) project
- [Vercel](https://vercel.com/) account (recommended) or any Node.js host

## 1. Supabase Setup

### Create Project

1. Create a new Supabase project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Note your **Project URL**, **anon key**, and **service_role key** from Settings → API

### Database setup

In Supabase → SQL Editor, run the entire file on a **new empty** project:

`supabase/complete_schema.sql`

Do **not** run it twice on the same database (duplicate errors).

If registration fails with **"Cannot coerce the result to a single JSON object"** or **"System roles are not set up"**, the `roles` table is missing seed data. Run once in SQL Editor:

```sql
INSERT INTO public.roles (id, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'owner', 'Shop owner with full access'),
  ('a0000000-0000-0000-0000-000000000002', 'service_advisor', 'Service advisor managing estimates and customers'),
  ('a0000000-0000-0000-0000-000000000003', 'technician', 'Technician performing repairs'),
  ('a0000000-0000-0000-0000-000000000004', 'cashier', 'Cashier handling billing and payments'),
  ('a0000000-0000-0000-0000-000000000005', 'super_admin', 'Platform administrator with cross-shop access')
ON CONFLICT (name) DO NOTHING;
```

Then try **register** again (or **sign in** if the auth user was already created).

### Reset / wipe data

`supabase/reset.sql` — run in SQL Editor:

| Block | What it does |
|-------|----------------|
| **Block 1** (highlight only) | Clears business data — keeps shops & login accounts |
| **Block 2** (highlight only) | Full wipe — all shops, users, data; re-seeds roles |

For full reset **with a new super admin login**, prefer:

```bash
npm run db:fresh-start
```

(requires `SUPABASE_SERVICE_ROLE_KEY` and optional `SUPER_ADMIN_*` in `.env.local`)

### Enable Authentication

In Supabase Dashboard → Authentication → Providers:

- Enable **Email** provider
- **Turn OFF “Confirm email”** — registration uses admin approval instead of email verification (no confirmation email is sent)
- Configure **Site URL**: `https://your-domain.com`
- Add **Redirect URLs**:
  - `https://your-domain.com/reset-password`
  - `http://localhost:3000/reset-password` (development)

### Registration flow (no email confirmation)

1. User registers at `/register` — account is auto-confirmed server-side (no email sent)
2. Shop is created with status **pending**
3. User sees **Waiting for approval** (`/pending-approval`)
4. Super admin approves at **Platform Admin → Shops** (`/dashboard/admin/shops`)
5. After approval, shop owner can use the full dashboard

### Password reset (beta — admin-assisted)

Self-service email reset is disabled to avoid Supabase email limits.

1. Shop owner clicks **Forgot password?** on login → sees instructions to contact platform admin
2. Super admin opens **Platform Admin → Shops** → **Reset password** on the shop row
3. Set or generate a temporary password, copy it, and send it to the owner (Viber, SMS, etc.)
4. Owner signs in with that password, then goes to **Settings → Change Password**

Promote your platform admin once (SQL Editor):

```sql
UPDATE profiles SET is_super_admin = true WHERE email = 'YOUR_ADMIN_EMAIL';

DELETE FROM shops
WHERE id IN (
  SELECT shop_id FROM profiles
  WHERE email = 'YOUR_ADMIN_EMAIL' AND shop_id IS NOT NULL
);
```

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
| `NEXT_PUBLIC_APP_NAME` | Display name (default: TalyerHub) |

> **Security:** Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client. Use only in server actions.

## 3. Environments (Develop, Staging, UAT, Production)

Use **separate Supabase projects** for each environment so test data never touches live shops.

| Environment | Git branch | Purpose | Supabase (example) | Vercel project (example) |
|-------------|------------|---------|--------------------|---------------------------|
| **Development** | `develop` | Daily coding & experiments | `talyerhub-develop` | `talyerhub-develop` |
| **Staging** | `staging` | Internal QA / integration testing | `talyerhub-staging` | `talyerhub-staging` |
| **UAT** | `uat` | User acceptance — final sign-off before live | `talyerhub-uat` | `talyerhub-uat` |
| **Production** | `main` | Live customers | `talyerhub-prod` | `talyerhub-prod` |

**UAT** (User Acceptance Testing) = almost-production environment where you (or a pilot shop) verify flows before release. **Staging** = dev team testing; **UAT** = business / owner approval.

### Workflow

```
develop  →  staging  →  uat  →  main
  code        QA         sign-off   production
```

```bash
# Promote develop → staging
git checkout staging
git merge develop
git push origin staging

# Promote staging → uat
git checkout uat
git merge staging
git push origin uat

# Promote uat → production
git checkout main
git merge uat
git push origin main
```

### Supabase (one project per environment)

For **each** of develop, staging, uat, and prod:

1. Create a Supabase project  
2. Run `supabase/complete_schema.sql` once (empty project only)  
3. Auth → Email ON, **Confirm email OFF**  
4. Set **Site URL** to that environment’s app URL  
5. Promote super admin (SQL in section 1)  
6. Do not run demo seed SQL on production UAT/prod unless you add your own test data manually  

### Vercel (recommended: one project per environment)

| Vercel project | Production Branch | Supabase |
|----------------|-------------------|----------|
| `talyerhub-prod` | `main` | prod |
| `talyerhub-uat` | `uat` | uat |
| `talyerhub-staging` | `staging` | staging |
| `talyerhub-develop` | `develop` | develop |

For each Vercel project: import `pyxitsolutions/talyer-hub`, set **Production Branch** to the branch in the table, and add env vars for that Supabase project. Set `NEXT_PUBLIC_APP_URL` to that project’s URL.

### Local `.env.local`

Point your machine at the **develop** Supabase project:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co   # develop project
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 4. Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### First User Registration

1. Go to `/register`
2. Create account with shop details
3. The system creates: shop → profile → owner role assignment

## 5. Deploy to Vercel

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

## 6. Production Best Practices

### Security

- RLS is enabled on all tenant tables — verify policies after migrations
- Use `SUPABASE_SERVICE_ROLE_KEY` only in server actions (registration)
- Keep **Confirm email OFF** — approval is handled in Platform Admin, not via email link
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

## 7. Role-Based Access

| Role | Access |
|------|--------|
| Owner | Full access to all modules |
| Service Advisor | Customers, vehicles, estimates, job orders |
| Technician | Job orders, estimates, service history |
| Cashier | Invoices, sales, reports |

Assign roles via the `user_roles` table after creating team members.

## 8. Post-Deployment Checklist

- [ ] Run `supabase/complete_schema.sql` on a new Supabase project
- [ ] Configure auth redirect URLs
- [ ] **Confirm email = OFF** in Supabase (admin approval handles access)
- [ ] Set environment variables on host
- [ ] Promote super admin account (SQL above)
- [ ] Register a test shop → appears in **Pending** tab → Approve
- [ ] Verify RLS — test with two shop accounts
- [ ] Test PDF export (estimates, invoices, job orders)
- [ ] Test Excel export (reports module)
- [ ] Configure custom domain + SSL
- [ ] Test forgot-password page shows admin-contact instructions (no email sent)
- [ ] Test admin password reset from Platform Admin → Shops → Reset password

## 9. Troubleshooting

| Issue | Solution |
|-------|----------|
| "Shop not found" on login | Ensure profile has `shop_id` set during registration |
| RLS blocks inserts | Verify user profile exists and `shop_id` matches |
| PDF QR codes broken | Set `NEXT_PUBLIC_APP_URL` to production URL |
| Password reset fails | Add redirect URL in Supabase Auth settings |
| Build fails without env | Placeholder values are used; set real keys before deploy |

## Support

For schema changes, edit `supabase/complete_schema.sql` for new projects, or run targeted `ALTER` SQL on existing databases. Never modify production schema without a backup.
