# غلتک (Ghaltak)

Ghaltak helps small Iranian online sellers, the ones who sell through Instagram and Telegram, run their shop in one
place: products and stock, customers, orders, payments, shipping and sales numbers. The app is in Persian, right to
left, with Jalali dates, Persian digits and amounts in tomans, and loads nothing from outside Iran at runtime.

## Status: Phase 1 (MVP) is built

Every Phase 1 task is merged into `main`. What's left of Phase 1 is the joint end-to-end test of the buy flow and pilot
prep (see [What's next](#whats-next)). The plan, rules and per-task notes are in [`docs/phase1/`](docs/phase1/README.md).

### What a seller can do

**Log in and dashboard**
- Log in with a mobile number and a 6-digit SMS code (Kavenegar). No passwords.
- Right-to-left dashboard with a sidebar; light theme.

**Catalog (Track A)**
- **Products** (`/products`): create and edit products with a photo, price, category and color/size variants, each with its own SKU and stock. Hide a product without deleting it.
- **Inventory** (`/inventory`): every variant with its stock and a status badge (enough / low / out). Add, subtract or set stock after a count. Every change is logged with a reason and, for orders, a link to the order. Filters for «نیاز به تأمین» and out of stock.
- **Customers** (`/customers`): search by name or mobile, a profile with order history and total spent, and tag suggestions (new / loyal / inactive).

**Sales (Track B)**
- **Orders** (`/orders`): list with status filter, search by customer name or mobile, pagination. Enter an order by hand for an existing or new customer. Prices are read on the server and frozen on each order line.
- **Seven order statuses** with fixed rules: awaiting payment → paid → preparing → shipped → delivered, plus canceled (before shipping) and returned (after). Canceling or returning gives the stock back.
- **Purchase links** (`/orders/links`): make a link for one or more products and send it in a chat. The customer orders on their phone with no account at `/buy/...`, and the order appears in the seller's list.
- **Payment**: confirm a payment by hand (card to card, cash, other). Customers can upload a card-to-card receipt from their order page, and the seller confirms or rejects it. Receipts are private to the seller.
- **Shipping**: method (post, courier, in person), cost and tracking code. An order can't be marked shipped without a method. The customer sees the status and tracking code on their order page.
- **Sales report** (`/reports`): sales today, this week (from Saturday) and this Jalali month, order count and average order value, a 30-day daily chart, new vs returning buyers, top products, unfinished orders and low stock. Everything is in Iran time.

### What the customer sees
- `/buy/<token>`: only the products on that link, a color/size picker, a quantity (up to 10 of each item) and name/mobile/address.
- `/buy/order/<token>`: the order code, items, amount due, payment state (with receipt upload) and shipping with the tracking code.

### Safety built in
- **Every seller sees only their own data.** Every query is scoped by the logged-in seller (`requireSeller()`), and a seller id sent from the browser is never trusted.
- **Stock never oversells.** Stock changes are atomic and never go below zero. Five simultaneous orders for the last item produce exactly one order, and stock is changed in a fixed order so orders can't deadlock.
- **Purchase links are protected against abuse:**
  - validation with Zod on every field
  - a per-IP limit that reads only what our own proxy writes (#10)
  - at most 3 unpaid orders per phone per link, and 50 orders per link per hour, checked under a per-link lock (#18)
  - unpaid link orders expire after 48 hours and give their stock back
- **Double submits are safe.** Two simultaneous orders from the same new phone share one customer (#17).
- **Uploads are checked by content.** Images are checked by their actual bytes, not the file name. Receipts are never public or cached.

## Tech

Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, TypeScript, Tailwind CSS 4, Prisma 7 with the `pg`
driver adapter, PostgreSQL, Zod 4, `jose` for the session cookie, Vitest. Self-hosted Vazirmatn font. Money is stored
as integer tomans everywhere.

## Run it locally

Needs Node.js and PostgreSQL.

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL and SESSION_SECRET
npm run db:deploy           # apply migrations
npm run db:seed             # demo seller, 20 products, 15 customers, 30 orders
npm run dev
```

Open http://localhost:3000 and log in with `09120000000`. Without SMS credentials the 6-digit code is printed in the
server console (`[dev sms] login code for ...`). Run `npm run db:seed` again after pulling changes to the seed.

## Checks

```bash
npm run lint
npm run typecheck
npm test          # unit tests; database tests are skipped without TEST_DATABASE_URL
npm run build
```

Files named `*.int.test.ts` run against a real, separate PostgreSQL database when `TEST_DATABASE_URL` is set. They
cover stock, order races, expiry and the sales report. With the database tests there are 223 tests. CI runs all of
them, plus lint, type-check and build, on every pull request. Setup is in
[`docs/phase1/README.md`](docs/phase1/README.md#database-integration-tests).

## Project layout

| Path | What's there |
|---|---|
| `src/app/(dashboard)/` | Seller pages: products, inventory, customers, orders, reports |
| `src/app/buy/` | Public purchase-link and customer order pages (no login) |
| `src/app/help/`, `public/help/` | Public seller guide with screenshots, and its FAQ (Track C) |
| `src/app/login/`, `src/app/logout/` | Login with SMS code, logout |
| `src/app/privacy/` | Public privacy page (Track C) |
| `src/server/catalog/` | Products, images, inventory and `adjustStock` (Track A) |
| `src/server/customers/` | Customer list, profile and stats (Track A) |
| `src/server/exports/` | CSV export of products, customers and orders, streamed, owner only (Track C) |
| `src/server/orders/` | Orders, status rules, purchase links, payment, shipping, stock calls, limits (Track B) |
| `src/server/reports/` | Sales report queries and Iran-time periods (Track B) |
| `src/server/home/` | Dashboard home: the «شروع کار» checklist and today's summary (Track C) |
| `src/components/ui/` | Shared UI: button, input, label, card, badge |
| `src/lib/format.ts` | Persian digits, tomans, Jalali dates in Tehran time, mobile number parsing |
| `prisma/` | Schema, migrations and seed |
| `docs/phase1/` | The Phase 1 plan, team rules and per-task status |

## Before going live

- **Hosting:** run in Iran (for example Liara or ArvanCloud), with a persistent volume for `UPLOAD_DIR` (product photos and receipts) and database backups.
- **Reverse proxy:** put a proxy in front of the app that appends the client IP to `X-Forwarded-For` (nginx: `$proxy_add_x_forwarded_for`), and set `TRUSTED_PROXY_HOPS`. Without it the per-IP limit can be bypassed. See `.env.example`.
- **SMS:** set `KAVENEGAR_API_KEY` and `KAVENEGAR_TEMPLATE`. They're required in production.
- **Branch protection:** turn on for `main` once the repo is on GitHub Pro or public. Until then, merge only through PRs with green CI.

## What's next

**Finish Phase 1:**
- a joint end-to-end browser test of the whole buy flow
- bug fixes from that test
- pilot prep with a few real sellers

**Known small gaps:**
- There's no field for the seller's card number, so the customer page can't say where to pay by card to card. This needs a small schema change.
- The per-IP limiter lives in memory. It needs the database or Redis if the app runs on more than one server.

**Phase 2 candidates:**
- online payment through Zarinpal or IDPay (B3 left a `PaymentGateway` hook for this)
- Telegram/Instagram messaging and notifications
- courier integrations
- subscription billing
- AI features

We'll order them by what the pilot sellers ask for.

## Team

Phase 1 was built by two people, each with a coding agent: Track A (catalog) and Track B (sales). Phase 2 adds a
third person:

- **Track A:** platform and seller account (storage, store settings, SMS service, plans, team members)
- **Track B:** online payment and the customer side (gateway, customer SMS, link funnel, print sheet)
- **Track C:** infrastructure, quality and pilot sellers (production, backups, CI, pilot programme, seller help,
  data export)

The Phase 2 plan and each track's tasks are in [`docs/phase2/`](docs/phase2/README.md) (in Persian). The folders each
track owns, and the review rules, are in [`docs/phase1/README.md`](docs/phase1/README.md#ownership-rules).
