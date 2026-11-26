# KUFIX Production Deployment & Ownership Guide

This document provides step-by-step instructions for deploying KUFIX to your own production infrastructure (such as Vercel, Railway, Render, or a VPS) and connecting it to your own PostgreSQL database and Paystack account.

---

## 1. What is Inside This Archive

- **Complete Source Code**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide icons.
- **Database Schema & Migrations**: Drizzle ORM schema (`src/db/schema.ts`), config (`drizzle.config.json`).
- **Full Database Dump**: `kufix-database-backup.sql` with all tables, constraints, active service categories, and seed data.
- **Static Assets**: Logos (`kufix-logo.svg`, `kufix-logo-light.svg`), hero photos (`hero-technician.jpg`), PWA manifest and icons (`icon.svg`, `icon-192.png`, `icon-512.png`), and PWA service worker (`sw.js`).
- **Environment Configuration**: `.env.example` with exact variable definitions.

---

## 2. Deploying to Vercel (Recommended)

### Step 1: Push Code to Your GitHub / GitLab Repository
```bash
git init
git add .
git commit -m "Initial commit of complete KUFIX platform"
git branch -M main
git remote add origin https://github.com/your-username/kufix.git
git push -u origin main
```

### Step 2: Set Up Managed PostgreSQL
You can use any PostgreSQL provider (Neon, Supabase, Vercel Postgres, AWS RDS, Railway):
1. Create a new PostgreSQL database (e.g. at [Neon.tech](https://neon.tech) or [Supabase.com](https://supabase.com)).
2. Copy your connection URI, e.g.:
   `postgresql://username:password@ep-sample-123.us-east-2.aws.neon.tech/kufix?sslmode=require`
3. Restore the included database dump:
   ```bash
   psql "YOUR_DATABASE_URL" < kufix-database-backup.sql
   ```
   *Or* push the Drizzle schema directly:
   ```bash
   npx drizzle-kit push
   ```

### Step 3: Connect to Vercel
1. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Select your `kufix` GitHub repository.
3. Keep default settings (Framework: Next.js).
4. In **Environment Variables**, add:
   - `DATABASE_URL`: Your PostgreSQL connection string.
   - `SESSION_SECRET`: A secure random 64-character hex string (run `openssl rand -hex 32` to generate).
   - `PAYSTACK_SECRET_KEY`: (Optional) Your live Paystack secret key `sk_live_...` or test key `sk_test_...`.
   - `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`: (Optional) Your public Paystack key `pk_live_...` or `pk_test_...`.
5. Click **Deploy**.

---

## 3. Deploying to Railway / Render / Docker

### Using Docker
A standard Node.js 20+ Dockerfile can be built and run:
```bash
# Build
docker build -t kufix .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e SESSION_SECRET="your-secret-key" \
  kufix
```

---

## 4. Admin Credentials & Access

The platform has a pre-configured administrator account:
- **Email**: `Kufix.official@gmail.com`
- **Password**: `12345678`
- **Admin Capabilities**:
  - Full marketplace dashboard at `/dashboard`
  - Document verification approval/rejection queue
  - Category manager (create, edit, activate/deactivate services)
  - Dispute resolution & manual escrow override
  - User suspension & account controls
  - Real-time customer care chat inbox

---

## 5. Paystack Integration Notes

When ready to enable live payments:
1. Log in to [Paystack Dashboard](https://dashboard.paystack.com) -> Settings -> API Keys & Webhooks.
2. Copy your Secret Key and add it to your server environment:
   `PAYSTACK_SECRET_KEY=sk_live_...`
3. In Paystack Webhooks settings, set your Webhook URL to:
   `https://yourdomain.com/api/paystack/webhook`
4. The system will automatically switch from simulated payments to live Paystack payments and bank account resolution.
