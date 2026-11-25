# KUFIX

**Find Skills. Get Connected. Get it Done.**

KUFIX is a production-oriented, mobile-first marketplace for local service professionals in Nigeria. It connects customers with electricians, plumbers, AC technicians, cleaners and other skilled workers. Customers can post jobs, request quotes, book directly and chat; providers can manage requests, publish completed work and build a reputation; administrators moderate the marketplace and handle support.

The application is a Next.js App Router project with server-rendered pages, server actions, PostgreSQL and Drizzle ORM. It is designed as a Progressive Web App and uses a new KUFIX visual identity based on the supplied navy, teal and gold logo.

It also includes a simulated wallet and escrow system (deposits, withdrawal requests, escrow-held payments) and a manual Nigeria-process verification flow (document capture and admin review).

---

## Table of contents

1. [What is included](#what-is-included)
2. [Technology stack](#technology-stack)
3. [Quick start](#quick-start)
4. [Demo accounts](#demo-accounts)
5. [Application map](#application-map)
6. [Roles and workflows](#roles-and-workflows)
7. [Database overview](#database-overview)
8. [Authentication and security](#authentication-and-security)
9. [Verification and sample-data policy](#verification-and-sample-data-policy)
10. [PWA behaviour](#pwa-behaviour)
11. [Validation and tests](#validation-and-tests)
12. [Troubleshooting](#troubleshooting)
13. [Deployment](#deployment)
14. [Repository conventions](#repository-conventions)

For a detailed local installation walkthrough, see [SETUP.md](./SETUP.md).

---

## What is included

### Public site

- Responsive homepage with service search, six launch categories, how-it-works, trust information, provider examples and calls to action.
- Service category discovery at `/services`.
- Filterable professional directory at `/professionals`.
- Individual professional profiles with a full list of services offered, coverage, verification wording, visible reviews, booking and chat.
- Public job board at `/jobs` with customer requests and provider job-done posts.
- Registration and login for customers and providers.
- About, contact, privacy and terms pages.
- Installable PWA manifest, home-screen icons and a limited offline cache.

### Customer workspace

- Overview metrics and recent activity.
- Post requests that appear on the public job board and receive provider offers.
- Accept an offer, which creates a booking request.
- Direct provider booking and quote requests.
- Booking status tracking, cancellation, reschedule acceptance and completed-job reviews.
- Chat with a provider and with KUFIX customer care.
- Profile, contact details and password management.
- Support requests.

### Wallet and escrow (customer and provider)

- Deposit funds through Paystack (card, bank transfer and more) when `PAYSTACK_SECRET_KEY` is configured; simulated instant deposits otherwise.
- Withdraw funds (requires admin approval) from the wallet. In Paystack mode, the approved payout is sent to the user's registered bank account directly by Paystack.
- Every booking and quote-acceptance holds the agreed price in escrow before the work starts.
- Funds are released to the provider only after **both** parties confirm the job is done.
- Cancelling a booking, or rejecting it, refunds the customer from the wallet.

### Verification (provider + admin)

- Providers upload Nigerian documents (National ID, International Passport, Driver's License, NIN Slip, CAC Business Registration, Utility Bill, Professional Certificate) with camera capture or JPEG/PNG/WebP/HEIC/PDF files.
- Files are stored outside the public directory and served only to the owning provider and administrators.
- Administrators review each document manually and approve, reject or request more information.
- Document approval sets the provider's verification label (e.g. Identity checked, Business/profile reviewed, Professional credentials checked).

### Multi-service provider options

- Providers can register a **primary** service category plus every additional category they offer.
- The directory and search filter by any offered category.
- The listing card and profile page show all offered services, experience, coverage and availability.
- Every listing includes an **Elaborate** box with full details and a link to the full profile.

### Provider workspace

- Overview metrics and incoming job activity.
- Offer prices on matching customer job-board requests.
- Accept or decline bookings, suggest alternative times and update job status.
- Respond to quote requests and submit or edit quotations.
- Publish job-done posts with an optional photo link.
- Chat with customers and customer care.
- Verification status explanation.
- Business profile, service category, coverage, availability and password settings.

### Admin workspace

- User and provider overview with account suspension and reactivation.
- Verification labels applied only after an administrator confirms a check.
- Service-category creation, editing and activation.
- Booking and quotation oversight.
- Job-board and job-done moderation.
- Review hiding/restoring.
- Support inbox and live customer care replies.
- Platform analytics based on real database records.

---

## Technology stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Drizzle ORM with the `node-postgres` driver |
| Styling | Tailwind CSS 4 plus project CSS design layers |
| Icons | `lucide-react` |
| Authentication | Password hashing with Node `scrypt`, HMAC-signed sessions, HTTP-only cookies |
| Wallet/escrow | PostgreSQL-backed ledger, atomic escrow hold/release/refund, Paystack deposits + transfer payouts |
| Document storage | Server-side files in `private/uploads/verification` served only to authorized viewers |
| PWA | Web manifest, SVG/PNG icons and `public/sw.js` |
| Validation | `next typegen`, `tsc --noEmit`, `next build` |

The application does not use a separate authentication provider. Sessions are signed on the server and can also travel in a signed URL token when an embedded preview blocks third-party cookies.

---

## Quick start

### Prerequisites

- Node.js 20.9 or newer, or the platform-managed Node environment.
- PostgreSQL 14 or newer.
- npm.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Create or update `.env`:

See `.env.example` for a ready-to-copy template:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
# Strongly recommended in any deployed environment:
SESSION_SECRET=replace-with-a-long-random-secret
```

`DATABASE_URL` is mandatory. `SESSION_SECRET` is optional locally, but set it in production so sessions survive secret rotations and remain independent of the database URL.

Create the database if it does not exist:

```bash
createdb app_db
```

### 3. Apply the schema

```bash
npm run db:push
```

This creates users, providers, service categories, bookings, quote requests, quotations, reviews, support requests, job posts, job offers, work posts, chat threads and chat messages.

### 4. Start the development server

```bash
npm run dev
```

Open <http://localhost:3000>.

### 5. Verify the service

```bash
curl http://localhost:3000/api/health
# {"ok":true}
```

The first public-page request seeds the six service categories and six clearly labelled demonstration provider profiles.

---

## Static assets

All assets used by the site are bundled in the repository. Nothing is hotlinked — the application works fully offline of third-party hosts.

| Asset | Used for |
| --- | --- |
| `public/images/kufix-logo.svg` | Header and footer brand mark (normal) |
| `public/images/kufix-logo-light.svg` | Footer brand mark on dark background |
| `public/images/hero-technician.jpg` | Homepage hero |
| `public/images/providers/*.jpg` | Six sample provider avatars (demonstration content) |
| `public/icon-192.png`, `public/icon-512.png` | PWA install icons (192 / 512) |
| `public/icon.svg` | SVG app icon |
| `public/manifest.webmanifest` | PWA manifest (name, colours, icons) |
| `public/sw.js` | Service worker (caches public pages and image assets only) |

## Demo accounts

All demo accounts use the password:

```text
Demo123!
```

| Role | Email | Dashboard entry |
| --- | --- | --- |
| Customer | `customer@kufix.test` | `/dashboard?tab=overview` |
| Provider | `provider@kufix.test` | `/dashboard?tab=overview` |
| Admin | `admin@kufix.test` | `/dashboard?tab=overview` |

On the login page, use the one-click buttons under **Explore KUFIX**. Demo sessions use illustrative data and are isolated from real customer and provider records. Demo accounts cannot change live bookings, posts, reviews or support threads.

If your preview is embedded in an iframe, sign-in redirects to `/dashboard?t=<signed-token>`. This is intentional: some browsers block third-party cookies in embedded previews.

---

## Application map

### Pages

| Route | Purpose |
| --- | --- |
| `/` | Homepage and primary search |
| `/services` | Service categories |
| `/professionals` | Directory and filters |
| `/professionals/[id]` | Provider profile and booking |
| `/jobs` | Public job board and completed work |
| `/request-quote` | Customer quote request form |
| `/become-a-provider` | Provider acquisition |
| `/about`, `/contact` | Company and support information |
| `/privacy`, `/terms` | Policies |
| `/login`, `/signup` | Authentication |
| `/dashboard` | Role-specific workspace |
| `/api/health` | Database healthcheck |

### API routes

| Route | Purpose |
| --- | --- |
| `POST /api/auth/login` | Customer, provider, admin and demo login |
| `POST /api/auth/register` | Customer and provider registration |
| `POST /api/auth/logout` | Session removal |
| `POST /api/auth/session` | Restore cookie session from signed token |
| `GET/POST /api/chat/[threadId]` | Read and send chat messages with participant checks |

Most write operations use Next.js server actions in `src/app/actions.ts`, `src/app/dashboard/actions.ts` and `src/app/community/actions.ts`.

---

## Roles and workflows

### Direct booking

1. Customer opens a professional profile.
2. Customer supplies service, description, date, time, location and optional instructions.
3. A `Pending` booking is stored and appears in the provider dashboard.
4. Provider accepts or declines.
5. Accepted jobs move to `In Progress`, then `Completed`.
6. The customer can review a completed booking once.

### Quote requests

1. Customer posts a service category, description and location.
2. Providers in that category submit price and scope.
3. Customer compares quotations.
4. Accepting one closes competing quotations and creates a booking request.

### Job board

1. Customer posts a titled request with category, urgency, description, location and optional budget.
2. Matching providers send offers.
3. Customer accepts an offer; competing offers close and a real booking is created.
4. Providers separately publish job-done posts, which appear on `/jobs` and are self-published rather than verified reviews.

### Messaging

1. A customer can start a provider chat from a real provider profile.
2. Customers or providers can start a customer care conversation from **Messages**.
3. Messages are stored per thread and polled every five seconds in the UI.
4. Administrators see support threads and reply as **KUFIX Customer Care**.
5. Only the creator, the participating provider or an administrator for support threads can read a conversation.

---

## Database overview

All models are defined in `src/db/schema.ts`.

| Table | Description |
| --- | --- |
| `users` | Accounts, role, contact details, suspension flag and password hash |
| `providers` | Business profiles, category, location, verification and availability |
| `service_categories` | Editable marketplace catalogue |
| `bookings` | Direct and accepted booking requests with lifecycle status |
| `quote_requests` | Customer quote requests |
| `quotes` | Provider responses to quote requests |
| `reviews` | Feedback attached to completed bookings, with moderation flag |

`bookings` also carries price, payment status, escrow confirmation flags and escrow timestamps.
| `support_requests` | Contact/support submissions and admin responses |
| `job_posts` | Customer requests published to the job board |
| `job_offers` | Provider offers on job posts |
| `wallets` | Per-user simulated wallet balance |
| `bank_accounts` | Verified bank account details used for payouts |
| `wallet_transactions` | Deposit, escrow hold/release, refund and withdrawal ledger (with unique `external_reference`) |
| `verification_documents` | Provider-uploaded documents and admin review state |
| `work_posts` | Provider job-done posts |
| `chat_threads` | Provider and support conversations |
| `chat_messages` | Messages inside chat threads |

`npm run db:push` applies schema changes directly. For a managed production deployment, review the generated SQL before applying it to shared data.

---

## Authentication and security

- Passwords are hashed using `scrypt` with a unique random salt.
- Session values are HMAC signed with `SESSION_SECRET`, falling back to `DATABASE_URL` locally.
- Cookies are HTTP-only, SameSite-aware and partitioned when secure.
- A signed token can be supplied as `?t=...` for embedded previews; the client adds it to dashboard links and forms.
- Server actions resolve the user from either the cookie or a signed form token.
- Chat access is checked server-side against thread participants and role.
- Cross-site POST requests to authentication and chat APIs are rejected by origin checks.
- Suspended users cannot continue using an existing session.
- Provider phone numbers, emails, identity documents and private chat content are not exposed publicly.

Known MVP limitations:

- Phone-number OTP and document uploads are not implemented.
- No real payment provider is connected; wallets are simulated.
- Image uploads are not implemented; job-done posts accept a URL to an image you own.
- Notifications are represented by dashboard activity, not SMS or email delivery.
- Provider subscriptions and featured listings are future work.
- Withdrawal processing is simulated; no real payouts occur.

---

## Verification and sample-data policy

KUFIX distinguishes verification levels instead of presenting a generic “trusted” badge:

1. Phone verified
2. Identity checked
3. Business/profile reviewed
4. Professional credentials checked

A verification label only describes the completed check. It does not guarantee skill, safety or work quality. Administrators are required to confirm a check before applying a label.

Profiles seeded for design and demonstration are marked `isDemo = true` and labelled **Sample profile**. Their reviews and chat activity are examples. Requests made to those profiles do not reach a real provider.

---

## PWA behaviour

- `public/manifest.webmanifest` provides the app name, colours, icons and standalone display mode.
- `public/icon.svg`, `icon-192.png` and `icon-512.png` provide installable icons.
- `src/components/pwa-register.tsx` registers `public/sw.js`.
- The worker caches only selected public pages and static images. It deliberately does not cache API responses, authentication, chats or dashboards.
- Live bookings, messages and dashboard actions require an internet connection.

---

## Validation and tests

Always run the complete sequence before declaring a change ready:

```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
```

`npm run build` checks compilation and TypeScript. The platform preview additionally verifies `/api/health`.

Useful manual checks:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/jobs
curl http://localhost:3000/login
```

Tested workflows include:

- Customer, provider and admin login in a normal tab and an embedded preview.
- Registration followed by dashboard access.
- Customer job post, provider offer, offer acceptance and booking creation.
- Provider job-done publication and public display.
- Two-way provider/customer chat, support chat and admin replies.
- Participant and outsider access checks on chat threads.
- Dashboard navigation for every role.

---

## Troubleshooting

### `DATABASE_URL is required`

Set the variable in `.env` and restart the server.

### Tables do not exist

Run `npm run db:push`. Confirm that the URL in `drizzle.config.ts` matches your local database.

### `Failed query: select ... from providers`

The query is valid; the database connection or schema is not. Check these in order:

1. Run `npm run db:push` so the database matches `src/db/schema.ts`.
2. If you changed `.env`, restart `npm run dev`. Next.js reads environment variables once at startup.
3. Open `/api/health` and check the server console for the underlying database error.

### Login redirects back to login

- Ensure the database is reachable and `/api/health` returns `{"ok":true}`.
- In an embedded preview, let the redirect complete and avoid manually removing `?t=...`.
- Clear old `kufix_session` cookies and sign in again after a deployment that changed the session key.
- Check that `SESSION_SECRET` is identical across all instances.

### Dashboard shows a recovery screen

The browser lost the session. If JavaScript is available, a previously saved signed token is restored automatically. Otherwise, log in again.

### Sample profiles cannot receive chat

Only real provider accounts with a linked `userId` support chat. Sample profiles explain this on their profile page.

### Stale UI after deployment

The service worker is versioned. Hard-refresh once, then reload. The worker no longer caches dashboard or application chunks.

---

## Deployment

See [SETUP.md](./SETUP.md#production-deployment) for a detailed deployment walkthrough, including PostgreSQL provisioning, environment variables, migrations, healthchecks and rollback.

Summary:

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set a strong `SESSION_SECRET`.
3. Install dependencies and build with `npm run build`.
4. Apply the schema with `npm run db:push` or reviewed migrations from a controlled job.
5. Start `npm run start` behind HTTPS.
6. Verify `/api/health`.
7. Keep all instances on the same `SESSION_SECRET` and database.

---

## Repository conventions

```text
src/app/                 Pages, route handlers and server actions
src/app/api/             Authentication, chat and healthcheck endpoints
src/components/          Reusable UI, dashboards and chat client
src/db/                  PostgreSQL connection and Drizzle schema
src/lib/                 Auth, marketplace, community and dashboard helpers
public/                  Logo, icons, manifest, hero image and service worker
```

CSS layers:

- `globals.css` — base marketplace design system.
- `kufix.css` — brand and authentication updates.
- `dashboard.css` — workspace layouts.
- `community.css` — job board and chat.

Do not edit `package.json` manually for new dependencies; use the package manager. Keep secrets server-side and never expose non-`NEXT_PUBLIC_` environment variables to the browser.
