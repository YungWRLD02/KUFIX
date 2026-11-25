# KUFIX Setup Guide

This guide covers local development, database setup, verification, common problems and production deployment.

For product scope, architecture and feature descriptions, start with [README.md](./README.md).

---

## 1. Requirements

### Local development

- Node.js **20.9+** (Node 22 is used in the project sandbox).
- npm 10+.
- PostgreSQL **14+**, running locally or reachable over the network.
- A POSIX shell (macOS, Linux, WSL, or Git Bash on Windows).

Check your tools:

```bash
node --version
npm --version
psql --version
```

### Production

- Node.js 20.9+ runtime.
- Managed PostgreSQL or a self-managed PostgreSQL instance with TLS.
- HTTPS termination.
- A single, persistent `SESSION_SECRET`.
- A persistent Node host: Railway, Fly.io, Render, or a VPS with systemd. (See section 12 — Option 2 is the only supported deployment path.)

---

## 2. Clone and install

```bash
git clone <your-repository-url> kufix
cd kufix
npm install
```

If your organisation uses another package manager, use its equivalent lockfile workflow. Do not mix lockfiles in the same commit.

---

## 3. PostgreSQL setup

### Option A: Local PostgreSQL

Create a database and user:

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE USER kufix WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE kufix_db OWNER kufix;
GRANT ALL PRIVILEGES ON DATABASE kufix_db TO kufix;
\q
```

The connection string becomes:

```dotenv
DATABASE_URL=postgresql://kufix:choose-a-strong-password@127.0.0.1:5432/kufix_db
```

### Option B: Use the sandbox default

The provided environment uses:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
```

Ensure the database exists:

```bash
createdb app_db
```

If it already exists, continue.

### Option C: Docker

```bash
docker run --name kufix-postgres \
  -e POSTGRES_USER=kufix \
  -e POSTGRES_PASSWORD=kufix_dev_password \
  -e POSTGRES_DB=kufix_db \
  -p 5432:5432 \
  -v kufix-pgdata:/var/lib/postgresql/data \
  -d postgres:16-alpine
```

Connection string:

```dotenv
DATABASE_URL=postgresql://kufix:kufix_dev_password@127.0.0.1:5432/kufix_db
```

Stop and restart:

```bash
docker stop kufix-postgres
docker start kufix-postgres
```

---

## 4. Environment variables

Create `.env` in the project root:

```dotenv
# Required. PostgreSQL connection string.
DATABASE_URL=postgresql://kufix:choose-a-strong-password@127.0.0.1:5432/kufix_db

# Strongly recommended. Use a long random value in every deployed environment.
# Generate one with: openssl rand -hex 32
SESSION_SECRET=replace-with-your-random-secret
```

### Variable reference

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | `src/db/index.ts`, Drizzle Kit | Must include host, port, database, user and password. |
| `SESSION_SECRET` | Production recommended | `src/lib/auth.ts` | Signs session tokens. Keep identical across instances. Rotating it signs everyone out. |
| `PAYSTACK_SECRET_KEY` | Optional | `src/lib/paystack.ts` | Enables Paystack deposits and withdrawal payouts. Get from **Settings → API Keys & Webhooks**. Never commit — server-side only. Unset = simulated payments. |
| `NODE_ENV` | Managed by Next.js | Cookies/build | Set automatically; do not normally edit it. |
| `NEXT_PUBLIC_*` | None currently | Browser | The app intentionally has no public secrets. |

Never commit `.env` or put secrets in source files. Restart the server after changing environment variables.

---

## 4.5 Wallet and verification flows

### Wallet

The wallet is a simulated, per-user balance in `wallets` with an immutable ledger in `wallet_transactions`. Deposits are instant and simulated. Withdrawal requests are held as `pending` and are approved or rejected by admins; rejecting restores the funds.

A booking or quote acceptance holds the agreed price in escrow before work begins. Funds are released to the provider only after **both** parties confirm the job is done. Cancelling a booking or rejecting it refunds the customer.

Behaviours to verify locally:

1. Register a customer and provider.
2. In **Wallet & escrow**, deposit funds (minimum ₦500).
3. Book the provider for an amount less than your wallet balance.
4. Check your dashboard bookings — the booking should show **Held in escrow**.
5. In the provider workspace, accept and start the job, then mark it complete.
6. Back in the customer workspace, click **Confirm job done** — funds are released to the provider.
7. Try a new booking and cancel it — the customer gets a refund shown in Wallet & escrow.
8. Request a withdrawal and approve it from the admin workspace.

### Verification documents

Providers capture Nigerian documents through the provider verification tab:

- National ID Card
- International Passport
- Driver's License
- NIN Slip
- CAC Business Registration
- Utility Bill (address proof)
- Professional Certificate / Licensed Trade Document

Supported formats: JPEG, PNG, WebP, HEIC, PDF (5 MB max). Files are stored in `private/uploads/verification/` and are only served to the owning provider and administrators. Admins review and approve/reject/request-more-info in the admin verification tab; approving a document updates the provider's verification label.

Do not commit `private/` (it is in `.gitignore`). Never upload identity documents to public profile fields or chat.

## 5. Apply the database schema

The schema source of truth is `src/db/schema.ts`. Drizzle Kit reads `drizzle.config.json`.

```bash
npx drizzle-kit push
```

Expected output includes:

```text
Pulling schema from database...
Changes applied
```

To verify the tables:

```bash
psql "$DATABASE_URL" -c '\dt'
```

You should see:

- `users`
- `providers`
- `wallets`
- `wallet_transactions`
- `verification_documents`
- `service_categories`
- `bookings`
- `quote_requests`
- `quotes`
- `reviews`
- `support_requests`
- `job_posts`
- `job_offers`
- `work_posts`
- `chat_threads`
- `chat_messages`

Also added to `bookings`: price, payment status, confirmation flags and escrow timestamps.

### Schema changes during development

1. Edit `src/db/schema.ts`.
2. Run `npx drizzle-kit push`.
3. Re-run type generation, TypeScript, build and preview.
4. Test affected workflows.

For production, prefer reviewed SQL migrations over `push` if multiple developers or environments share the database.

---

## 6. Start the application

### Development

```bash
npm run dev
```

Open <http://localhost:3000>.

Development server features:

- Hot reload.
- Server actions and route handlers.
- Dynamic rendering for dashboards and marketplace data.

### Production locally

```bash
npm run build
npm run start
```

Open <http://localhost:3000>.

Do not use `npm run start` before `npm run build`.

### Healthcheck

```bash
curl -sS http://localhost:3000/api/health
```

Success:

```json
{"ok":true}
```

Failure returns HTTP 500 with `{"ok":false}` and usually means PostgreSQL is unreachable or tables are missing.

---

## 7. First-run data

On the first public-page request, the application seeds:

- Six active service categories: Electrical, Plumbing, AC & Refrigeration, Generator & Inverter, Cleaning, Carpentry & Furniture.
- Six demonstration provider profiles.

Seeding uses conflict-safe inserts, so restarting the app does not duplicate records.

Sample providers are permanently labelled and do not represent real available professionals.

---

## 8. Sign in

Visit <http://localhost:3000/login>.

### One-click demos

- **Customer demo**
- **Provider demo**
- **Admin demo**

### Manual demo credentials

```text
Email:    customer@kufix.test
Password: Demo123!
```

Other demo addresses:

- `provider@kufix.test`
- `admin@kufix.test`

All use `Demo123!`.

Demo accounts are isolated. They never read or modify real users, bookings, support tickets or chat threads.

### Create a real account

Use `/signup` and select **I need a service** or **I provide services**. Real provider registration also creates a linked provider profile in the same database transaction.

To create a real admin account for development:

```bash
# Register normally through /signup first, then:
psql "$DATABASE_URL" -c \
  "UPDATE users SET role = 'admin' WHERE email = 'you@example.com';"
```

Log out and back in to refresh the session.

---

## 9. Explore the workflows

### Customer

1. Open `/professionals` and filter by category or location.
2. Open a real provider profile.
3. Use **Send booking request** or **Request a quote**.
4. Open `/dashboard?tab=posts` and post a job.
5. Open `/dashboard?tab=messages` to message a provider or customer care.
6. Track everything from `/dashboard`.

### Provider

1. Sign in with a real provider account.
2. Open `/dashboard?tab=bookings` to accept or decline work.
3. Open `/dashboard?tab=posts` to offer on customer jobs and publish a job-done post.
4. Open `/dashboard?tab=quotes` to submit prices.
5. Open `/dashboard?tab=settings` to update services and availability.

### Admin

1. Sign in with an admin account.
2. Open `/dashboard?tab=users` to review accounts.
3. Open `/dashboard?tab=verification` to apply verified labels after confirming checks.
4. Open `/dashboard?tab=categories` to manage services.
5. Open `/dashboard?tab=messages` to answer customer care chats.
6. Open `/dashboard?tab=analytics` for platform counts.

---

## 10. Validation sequence

Run all three commands before a release:

```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
```

Optional lint:

```bash
npm run lint
```

Always finish by starting the built app and checking `/api/health`.

### Automated smoke checks used during development

The following workflows were exercised end to end:

- Demo login for all three roles.
- Login and registration inside an embedded preview.
- Dashboard navigation after all cookies were cleared.
- Customer job post appearing on `/jobs`.
- Provider offer and customer acceptance creating a booking.
- Provider job-done post appearing on `/jobs`.
- Provider/customer two-way chat.
- Support chat from customers and providers.
- Admin support inbox and replies.
- Unauthorised users blocked from private threads.

---

## 11. Troubleshooting

### Port 3000 is already in use

```bash
lsof -i :3000
kill <pid>
```

Or use another port:

```bash
npm run dev -- --port 3001
```

### `DATABASE_URL is required`

The application throws this on startup when the variable is absent. Confirm `.env` exists and restart the server.

### `ECONNREFUSED` or healthcheck fails

- Confirm PostgreSQL is running.
- Confirm the host and port in `DATABASE_URL`.
- For Docker, check `docker ps`.
- For local PostgreSQL, check `pg_isready`.
- Run `npx drizzle-kit push`.

### `relation "users" does not exist`

The schema has not been applied:

```bash
npx drizzle-kit push
```

### Authentication works, then dashboard asks for login again

- Check `/api/health`.
- Clear stale `kufix_session*` cookies.
- Ensure `SESSION_SECRET` is the same across processes.
- In an embedded preview, allow the redirect to `/dashboard?t=...` to complete.
- Do not manually remove the `t` parameter from dashboard URLs.

### Dashboard is blank or uses old styling

Hard-refresh once. The service worker is versioned and excludes application chunks from caching. Registering a new worker normally updates automatically.

### Demo actions show “available only with a real account”

This is intentional. Demo workspaces are interactive previews with sample data and never write to live records.

### Georgia/old-looking logo or missing image

Confirm the files exist:

```text
public/images/kufix-logo.svg
public/images/kufix-logo-light.svg
public/images/hero-technician.jpg
```

Restart the server if assets were added while it was running.

### Chat does not refresh

The chat panel polls every five seconds. Check browser console/network errors and confirm the API route responds:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/health
```

---

## 12. Production deployment — Option 2 (persistent Node)

KUFIX targets a single deployment path: a persistent Node host. This is the only supported
path because verification document uploads live on disk (`/app/private/uploads/verification`)
and need to survive across deploys. Pick one of the four hosts below.

### 12.1 Quick start (any host with Docker)

```bash
git clone <your-repository-url> kufix
cd kufix
cp .env.example .env
$EDITOR .env               # DATABASE_URL, SESSION_SECRET, PAYSTACK_SECRET_KEY
docker compose up -d --build
docker compose run --rm migrate
```

`docker-compose.yml` starts PostgreSQL and the app together, mounts
`./private/uploads/verification` into the container, and health-checks `/api/health`.
The migrate profile applies the Drizzle schema once.

### 12.2 VPS / bare-metal (systemd)

Recommended if you want full control. The image already includes a systemd unit at
`deploy/kufix.service` that runs `npm ci`, `npm run build`, `npx drizzle-kit push` and then
`npm run start` — so the whole pipeline happens on every boot.

```bash
sudo useradd --system --home /opt/kufix --shell /usr/sbin/nologin kufix
sudo mkdir -p /opt/kufix /opt/kufix/private/uploads/verification
sudo chown -R kufix:kufix /opt/kufix
sudo git clone <your-repository-url> /opt/kufix
sudo cp deploy/kufix.service /etc/systemd/system/
sudo $EDITOR /opt/kufix/.env         # fill in secrets; see .env.example
sudo systemctl daemon-reload
sudo systemctl enable --now kufix
sudo journalctl -u kufix -f
```

The unit reads `/opt/kufix/.env` via `EnvironmentFile`. Keep it owned by `root:kufix` with
`0640` permissions so the app can read it but nobody else can.

### 12.3 Railway

1. Create a new project and add a PostgreSQL database.
2. Create a service from this repository and point Railway at `deploy/railway.json`
   (or set the build to `Dockerfile` in Railway's dashboard).
3. Set `DATABASE_URL` from the database's connection string and `SESSION_SECRET`
   (generate with `openssl rand -hex 32`).
4. Set `PAYSTACK_SECRET_KEY` if you have a Paystack account.
5. Add a persistent volume mounted at `/app/private/uploads/verification` (Railway volumes
   or a separate Persistent Disk service).
6. Run the schema once from a Railway one-off job: `npx drizzle-kit push`.
7. Open `https://<your-service>/api/health` — expect `{"ok":true}`.

### 12.4 Fly.io

```bash
fly launch --no-deploy            # use deploy/fly.toml as the app config
fly volumes create kufix_uploads --size 1 --region <your-region>
fly secrets set DATABASE_URL=... SESSION_SECRET=... PAYSTACK_SECRET_KEY=...
fly deploy
fly ssh console -C "npx drizzle-kit push"
```

`deploy/fly.toml` mounts the `kufix_uploads` volume at
`/app/private/uploads/verification` and health-checks `/api/health`.

### 12.5 Render

1. Create a Blueprint from `deploy/render.yaml` (or import it in the dashboard).
2. Render provisions the Postgres database and a 1 GB disk mounted at
   `/app/private/uploads/verification`.
3. Fill in `PAYSTACK_SECRET_KEY` (or leave it blank to use simulated payments).
4. Render runs the Dockerfile on each deploy. The schema is applied by running
   `npx drizzle-kit push` from a one-off job on first deploy.

### 12.6 Deployment checklist (all hosts)

- [ ] PostgreSQL provisioned with backups enabled.
- [ ] HTTPS certificate configured (Fly/Render/Railway do this for you).
- [ ] `DATABASE_URL` set and points at the right host.
- [ ] `SESSION_SECRET` set to a strong random value (`openssl rand -hex 32`).
- [ ] `PAYSTACK_SECRET_KEY` set if you plan to use real Paystack deposits and payouts.
- [ ] Persistent disk mounted at `/app/private/uploads/verification`.
- [ ] Schema applied with `npx drizzle-kit push` (or the migrate profile).
- [ ] `/api/health` returns `{"ok":true}`.
- [ ] Sign in with a real account and a demo account on the deployed URL.
- [ ] Upload a test verification document and confirm it survives a redeploy.
- [ ] Confirm a test Paystack deposit and payout if `PAYSTACK_SECRET_KEY` is set.
- [ ] Logs and error monitoring enabled.

### 12.7 What changed for Option 2

- Verification document uploads now work reliably (persistent disk).
- Paystack deposits and payouts work end-to-end (server-side webhook, HMAC-SHA512).
- Escrow, wallet, chat and post engagement all work without network restrictions.
- Sessions work because the app is served from your own domain with standard cookies.
- Demo accounts remain available on the deployed URL for review and onboarding.

### 12.8 What is intentionally not in scope

- Serverless platforms (Vercel, Cloudflare Pages, Netlify) — they do not provide the
  persistent filesystem KUFIX needs for verification document uploads.
- Payment processing is handled by Paystack. The wallet is the app's ledger; Paystack is
  the money rail. No escrow, no wallet, no fees are processed outside these two layers.
- Mobile apps and native SMS/OTP are future work.

## 13. Backups and maintenance

- Back up PostgreSQL before schema changes.
- Keep at least daily backups in production.
- Test restoring a backup before launch.
- Review `review.hidden`, `support_requests.status` and provider verification labels regularly.
- Remove demo test accounts from production, or keep them only in a staging deployment.
- Monitor `/api/health` from an external uptime service.
- Rotate `SESSION_SECRET` only during a planned maintenance window because it invalidates sessions.

---

## 14. Security notes

- Never expose `DATABASE_URL` or `SESSION_SECRET` to the browser.
- Only `NEXT_PUBLIC_*` variables are bundled client-side; this app does not require any.
- Identity documents must never be placed in public profile fields or chat.
- Customer and provider phone numbers/email addresses are not rendered on public profiles.
- Admin-only actions are checked again in server actions, not only hidden in the UI.
- Chat thread access is checked server side on every read and write.
- Use HTTPS in production so secure, partitioned session cookies work reliably.
