# غلتک (Ghaltak)

Ghaltak helps small Iranian online sellers, the ones who sell through Instagram and Telegram, run their shop in one
place: products and stock, customers, orders, payments, shipping, and their sales, profit and expenses. The app is in
Persian, right to left, with Jalali dates, Persian digits and amounts in tomans, and loads nothing from outside Iran at
runtime.

## Status (November 2026)

The code for Phase 1 (the MVP), Phase 2 and the UI and finance work that followed is all merged into `main`. The app is
**not live yet**: there is no production host, so the pilot with real sellers hasn't started.

| | State |
|---|---|
| Phase 1: catalog, orders, purchase links, payment, shipping, report | Done (#1–#23) |
| Phase 2, Track A: storage, store settings, SMS, plans, team | Done (#26–#28, #33, #46, #57) |
| Phase 2, Track B: online payment, customer SMS, link funnel, print sheets | Done (#31, #34–#36, #44, #45). B10 (rate limiter in the database) not done |
| Phase 2, Track C: deploy files, CI, pilot kit, help, data export, quality pass | Repo work done (#37, #41, #42, #55, #56, #59, #60). Backups are in open PR #58 |
| Public site: landing page, login popup, dark mode, Persian copy | Done (#61–#66) |
| UI overhaul and finance («مالی و گزارش») | Done (#67–#74) |
| Production server, backups, SMS templates, pilot sellers | **Open**, waiting for a host |

What is still open, in detail, is under [Open items](#open-items).

## What it does

### For the seller (`/`, after login)

- **Login:** mobile number and a 6-digit SMS code. No passwords. A code expires after 2 minutes and allows 5 guesses.
- **Home** (`/`): a short daily brief of yesterday's numbers, the «شروع کار» checklist for a new store, today's summary,
  «نیاز به رسیدگی» (receipts to review, orders to ship, low stock) and, after a month, season or year closes, a recap.
  The same counts appear as badges in the menu.
- **Orders** (`/orders`): list, search, status filter; enter an order by hand. Seven statuses with fixed rules
  (awaiting payment → paid → preparing → shipped → delivered, plus canceled and returned). Canceling or returning gives
  the stock back. Payment by hand, card-to-card receipt review, or online. Shipping method, cost and tracking code.
  Print sheets for one order, ticked orders, or everything ready to ship.
- **Purchase links** (`/orders/links`): a link for one or more products to send in a chat. The customer orders on their
  phone without an account. Each link shows its funnel: views, orders, paid.
- **Products and stock** (`/products`, `/inventory`): products with photo, price, optional cost price, category, and
  color/size variants with their own SKU and stock. Every stock change is logged with a reason. «نیاز به شارژ» lists
  variants of active products at or below their low-stock threshold.
- **Customers** (`/customers`): search, profile with order history and total spent, tags (new / loyal / inactive).
- **Finance** («مالی و گزارش», `/finance`), for any period (today, this week, this month, last month, this season,
  this year, or a custom range up to two years):
  - «خلاصه»: sales, net profit, margin and other numbers, a daily chart, and «پیشنهادهای غلتک» (12 rule-based tips)
  - «فروش»: trend, top products, best customers, weekdays, payment methods, purchase-link funnel
  - «سود محصولات»: sales, cost of goods, gross profit and margin per product
  - «هزینه‌ها»: one-off and monthly expenses
  - «گزارش‌ها»: a report for every finished month, season and year, with a print/PDF version
  - The main numbers have a ؟ that explains them in plain Persian. The old `/reports` URL redirects here.
- **Settings** (`/settings`): store name, logo and contacts shown to customers; card-to-card details and the store's
  own Zarinpal gateway; which SMS customers get; subscription; team members; CSV export of products, customers and
  orders; signed-in devices.
- **Team:** the owner invites operators by mobile number. Operators work with orders, products and customers but don't
  see the store's financial figures (sales totals, averages, profit): finance shows them counts only, and the owner's
  settings (payments, subscription, team, data export) are a 404 for them.

### For the customer (no account)

- `/buy/<token>`: the products on that link, a color/size picker, quantity, name, mobile and address, under the store's
  name and logo.
- `/buy/order/<token>`: the order, the amount due, the seller's card number for card-to-card (with receipt upload) or
  an online payment button, and shipping with the tracking code.
- SMS when the order is placed, paid and shipped, and a reminder before an unpaid order expires. The seller chooses
  which of these go out.

### Public pages

`/` (landing page when signed out), `/help` (seller guide with an FAQ), `/privacy`. Public pages have a light/dark
switch; the dashboard is dark; checkout and print pages stay light.

## Requirements

### Product rules

Every change keeps these. Most come from the product document and the Phase 1 and Phase 2 plans in [`docs/`](docs/).

1. **Persian first.** Right to left, Jalali dates, Persian digits, tomans. "Today", "this week" (from Saturday) and
   "this month" (Jalali) are Tehran time, whatever time zone the server runs in.
2. **Nothing from outside Iran at runtime.** No CDNs, Google Fonts or foreign APIs; the Vazirmatn font is self-hosted.
   Hosting, database and storage on an Iranian provider (Liara or ArvanCloud), SMS through Kavenegar or sms.ir,
   payments through Iranian gateways.
3. **Each store sees only its own data.** Every query is scoped by the store from the session (`requireMember()`,
   `requireOwner()`), never by an id sent from the browser.
4. **Money is integer tomans** everywhere, formatted only on screen. Gateways get rials at the edge.
5. **Stock never oversells.** Stock changes are atomic, never go below zero, and run in a fixed order so orders can't
   deadlock.
6. **A payment is applied once.** Every confirmation goes through `confirmPaymentInTx()`, only after the gateway's
   `verify` succeeds and the amount matches. A repeated or racing return from the gateway changes nothing.
7. **Customers pay the seller, not the platform.** Each store connects its own gateway; card-to-card stays the default.
   The platform's own gateway is only for its subscription.
8. **Plan limits never block a customer's order.** They limit seller-side actions (products, members, SMS). Charging
   for subscriptions stays off (`BILLING_ENABLED=false`) until prices are checked with pilot sellers.
9. **Sensitive data is encrypted.** Card number, Sheba and gateway credentials are stored encrypted with `SECRETS_KEY`
   and never logged or shown in full. Receipts are private files. Login codes are stored hashed.
10. **Public endpoints are protected** by validation (Zod), per-IP and per-link limits, and content-checked uploads.

### To run it

- **Node.js 24** (what CI and the Docker image use) and npm.
- **PostgreSQL 16** (what CI and production use).
- For the browser tests: Chromium or Chrome (`npx playwright install chromium`, or `E2E_BROWSER_CHANNEL=chrome`).
- Environment variables, all listed and explained in [`.env.example`](.env.example):

| Variable | When |
|---|---|
| `DATABASE_URL`, `SESSION_SECRET` | Always |
| `SECRETS_KEY` | As soon as a seller saves card details or a gateway (32 bytes, base64) |
| `APP_URL` | Production (online payment refuses to start without it) |
| `KAVENEGAR_API_KEY` + templates, or `SMSIR_API_KEY` + templates | Production (without one, nobody can log in) |
| `TRUSTED_PROXY_HOPS` | Production, behind a proxy that appends the client IP |
| `STORAGE_DRIVER=s3` + `S3_*` | Production (two private buckets); development uses the local disk |
| `BILLING_ENABLED`, `PLATFORM_GATEWAY_*` | Only when subscription charging is turned on |
| `TEST_DATABASE_URL`, `E2E_DATABASE_URL` | Tests only; separate databases |

## Run it locally

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, SESSION_SECRET and SECRETS_KEY
npm run db:generate         # generate the Prisma client (src/generated/prisma is not committed)
npm run db:deploy           # apply migrations
npm run db:seed             # demo store: 20 products, 15 customers, 30 orders
npm run dev
```

Open http://localhost:3000 and log in with `09120000000`. Without SMS credentials the code is printed in the server
console: `[sms DEV] LOGIN_OTP to 0912***0000: <code>`. Run `npm run db:seed` again after pulling changes to the seed.

## Checks

```bash
npm run lint
npm run typecheck      # next typegen + tsc
npm test               # Vitest
npm run build
npm run test:e2e       # Playwright; needs E2E_DATABASE_URL, see e2e/README.md
```

- **Vitest:** 669 tests in 90 files. 168 of them (the `*.int.test.ts` files) run against a real, separate PostgreSQL
  database and are skipped unless `TEST_DATABASE_URL` is set. Setup:
  [`docs/phase1/README.md`](docs/phase1/README.md#database-integration-tests).
- **Playwright:** 21 specs in [`e2e/`](e2e/README.md) cover the buy flow, order lifecycle, card-to-card and online
  payment, customer SMS, link funnel, print sheets, billing, team, data export, finance, the landing page and the
  security headers.
- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of the above on every pull request, in one
  job. Pull requests that only change Markdown or `docs/` skip it. `docker.yml` checks the production image, and
  `ci-usage.yml` reports Actions minutes every week.

## How it was built

**Team and process.** Ghaltak is built by a small team, each person working with a coding agent. Work is planned in
phases from the product document, then split into tracks that own separate folders, so people rarely edit the same
files. The shared rules, which still apply:

- Every change is a pull request of about a day's work, merged only with green CI. `main` is protected; nobody
  pushes to it directly.
- Each track edits only its own folders; anything else is a small separate PR reviewed by that folder's owner.
- Only one schema PR is open at a time, and existing migrations are never edited.
- Contracts between tracks (for example `adjustStock`, `sendSms`, `canUse`) are fixed signatures, with a stub of the
  same type until the real one lands and a type test that keeps them in step.
- Anything that moves money or stock has database tests, including races and "applied only once".
- Next.js 16 and Prisma 7 differ from older tutorials: read `node_modules/next/dist/docs/` before writing code
  ([`AGENTS.md`](AGENTS.md)), and use the shared Prisma client in `src/lib/prisma.ts`.

**Timeline.** The plans were sized in weeks per person; the merges themselves span 23 September to 6 October 2026
(dates below). What's left is the part that needs the outside world: a host, SMS approval and pilot sellers.

| When | What | Where it's written down |
|---|---|---|
| 23–24 Sep 2026 | **Phase 1 (MVP).** Two people: Track A catalog (products, inventory, customers, `adjustStock`), Track B sales (orders, purchase links, payment, shipping, sales report). Then review fixes (#10, #17–#19) and the end-to-end buy-flow test (#23). | [`docs/phase1/`](docs/phase1/README.md) |
| 25–26 Sep 2026 | **Phase 2: real launch, online payment, stabilising.** Three people: Track A platform and seller account (storage, store settings, SMS, plans, team), Track B payment and the customer side (card-to-card details, Zarinpal, customer SMS, link funnel, print sheets), Track C infrastructure, quality and pilot sellers (deploy files, CI, pilot kit, help, data export, privacy, quality and security pass). | [`docs/phase2/`](docs/phase2/README.md) (Persian), with specs for [A9](docs/phase2/specs/A9-billing.md) and [A10](docs/phase2/specs/A10-team.md) |
| 27 Sep – 6 Oct 2026 | **Public site:** landing page at `/`, login in a popup, sms.ir as a second SMS provider, dark mode on public pages, Persian copy rewritten to read naturally (#61–#66). | |
| 6 Oct 2026 | **UI overhaul and finance:** design kit and dark dashboard, phone navigation, Home with the daily brief (#67); cost prices and expenses, the finance pages, the 12 tips, period reports and recaps (#68–#72); then cleanup (#73) and fixes from a codebase review (#74). | [UI and finance design spec](docs/superpowers/specs/2026-10-06-ghaltak-ui-finance-design.md) |

**Decisions worth knowing** (details in the docs above):

- Login is a signed `jose` cookie plus a `Session` table, not Auth.js: fewer moving parts and it works with an Iranian
  SMS provider directly.
- The UI kit (`src/components/ui/`) is written by hand in the shadcn style, with Radix only for the dialog and
  popover, because the shadcn CLI isn't reachable from every network in Iran.
- Files go through one storage module with a local driver (development) and an S3 driver (production), so product
  photos and receipts never depend on the server's disk.
- The app runs as **one instance**. The per-IP rate limiter is in memory; B10 moves it to the database if that ever
  changes.

## Tech

Next.js 16.3 (App Router, Server Actions, `proxy.ts`), React 19.2, TypeScript 5, Tailwind CSS 4, Prisma 7 with the
`pg` driver adapter, PostgreSQL 16, Zod 4, `jose`, Radix (dialog, popover), lucide icons, the AWS S3 client (for
Iranian S3-compatible storage), Vitest 5, Playwright 1.63. Self-hosted Vazirmatn font. Deployed as a Docker image
(`Dockerfile`, `liara.json`).

## Project layout

| Path | What's there |
|---|---|
| `src/app/(dashboard)/` | Seller pages: Home, orders, products, inventory, customers, finance, settings, store picker |
| `src/app/buy/` | Public purchase-link and customer order pages |
| `src/app/pay/` | Returns from the payment gateway (orders and subscriptions) |
| `src/app/welcome/`, `help/`, `privacy/`, `login/`, `logout/` | Public pages, login and logout |
| `src/app/uploads/`, `api/health/` | Serving product photos and logos; health check for the host |
| `src/proxy.ts` | Route guard (Next.js 16's replacement for `middleware.ts`) and the public paths |
| `src/server/auth.ts`, `sessions.ts`, `otp.ts`, `account.ts` | Login codes, sessions and devices, roles, first login |
| `src/server/catalog/`, `customers/` | Products, images, inventory and `adjustStock`; customers |
| `src/server/orders/` | Orders, status rules, purchase links, payment, receipts, shipping, stock, limits, print sheets |
| `src/server/payments/` | Card details, the seller's gateway, Zarinpal, online payment, the e2e-only fake gateway |
| `src/server/notifications/`, `sms/` | Customer SMS; the SMS service and providers (Kavenegar, sms.ir, console) |
| `src/server/finance/` | Totals, periods, breakdowns, cost prices, expenses, reports, recaps, glossary, the tips (`insights/`) |
| `src/server/dashboard/`, `home/` | Menu badges and «نیاز به رسیدگی», the daily brief; the start checklist and today's summary |
| `src/server/reports/` | The shared "what counts as a sale" (`SALE_STATUSES`, `salesSince`), Tehran-time periods, link funnel |
| `src/server/billing/`, `team/`, `store/`, `storage/`, `exports/` | Plans and subscription; team members; store profile; local/S3 storage; CSV export |
| `src/components/ui/` | Shared kit: button, input, label, card, badge, stat, page header, nav tabs, sheet, explain, empty state, skeleton, charts |
| `src/components/<area>/` | Components for each area (orders, finance, home, dashboard shell, landing, settings…) |
| `src/lib/` | Formatting (Persian digits, tomans, Jalali dates), Prisma client, encryption |
| `prisma/` | Schema, migrations, seed |
| `e2e/` | Playwright tests ([README](e2e/README.md)) |
| `scripts/` | One-off storage migrations and brand assets |
| `docs/` | Plans, specs, deploy guide, pilot programme, quality review |

## Documentation

- [`docs/phase1/`](docs/phase1/README.md): Phase 1 plan and the shared rules (English).
- [`docs/phase2/`](docs/phase2/README.md): Phase 2 plan and each track's tasks; [`DEPLOY.md`](docs/phase2/DEPLOY.md)
  (production, environment variables, release checklist, SMS templates), [`PILOT.md`](docs/phase2/PILOT.md),
  [`QUALITY.md`](docs/phase2/QUALITY.md) (Persian).
- [`docs/superpowers/specs/`](docs/superpowers/specs/2026-10-06-ghaltak-ui-finance-design.md): the UI and finance
  design, with what was built and what was left out.
- [`e2e/README.md`](e2e/README.md): running the browser tests.

## Before going live

Step by step in [`docs/phase2/DEPLOY.md`](docs/phase2/DEPLOY.md). In short:

- A host in Iran (Liara or ArvanCloud) running the Docker image, a managed PostgreSQL, and two private S3 buckets.
- A reverse proxy that appends the client IP to `X-Forwarded-For`, and the matching `TRUSTED_PROXY_HOPS`.
- `APP_URL`, `SECRETS_KEY`, and an SMS account with approved templates.
- Daily encrypted backups and one test restore (PR #58). The privacy page already promises them.

## Open items

What the plans call for that isn't done yet, as of `main` at #74.

**Needed before the pilot**
- Production host, first deploy, and the release checklist (C1). The deploy files are ready (#37).
- Backups and a test restore (C2), and the store-deletion script: written in PR #58, not merged.
- SMS templates registered and approved (C3). With sms.ir, the four customer messages that carry a link need templates
  without it, because sms.ir allows 25 characters per value.
- The pilot itself (C4) and the week-6 security review (C7). The `pilot` issue labels don't exist on GitHub yet.
- `npm audit --omit=dev` reports 9 findings, one critical in `next` 16.3. Update and re-run the checks.

**Smaller gaps**
- B10: the per-IP rate limiter is in memory, fine for one instance only.
- Only Zarinpal is implemented; `IDPAY` exists in the schema enum but has no client.
- From the UI and finance spec: no loading skeletons, no «ثبت هزینه» in the phone's ➕ sheet, Home has no net-profit
  tile, «unpaid over 2 days» row or «سفارش جدید» button, and the ؟ texts don't cover coverage, cancel rate or unpaid.
- Tests the specs ask for but that don't exist: a period report matches the overview (finance), a store can't reach
  another store's invoices (A9), the phone bottom bar (e2e).

**Phase 3 candidates:** Telegram and Instagram messaging, auto-replies, marketing tools, courier integrations, and AI
help, ordered by what the pilot sellers ask for.
