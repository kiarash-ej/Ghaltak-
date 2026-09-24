# Phase 1 — Shared rules and foundation

Ghaltak is a platform that helps small Iranian online sellers (Instagram/Telegram) manage products, inventory,
customers, orders, payments and shipping in one place. Phase 1 is the MVP. Two people, each with a coding agent,
work in parallel on two tracks:

- [Track A — Catalog](./TRACK-A.md): products, variants, inventory, customers
- [Track B — Sales](./TRACK-B.md): orders, purchase link, payment status, shipping, report

Read this file first, then your track file.

## Step 0 — Shared foundation (do this BEFORE the tracks start)

Owner: Person A. Reviewer: Person B. Nobody starts a track until this is merged into `main`.

Status: **merged into `main`** (PR #1). The tracks can start. Checked items below are done and verified (lint, type-check, 20 unit tests, production build, and a manual browser test of login, logout and the route guard).

- [x] RTL + Persian: `<html lang="fa" dir="rtl">`, Vazirmatn font (self-hosted via `@fontsource-variable/vazirmatn`, no CDN), Persian digits and Jalali date helpers in `src/lib/format.ts`
- [x] Dashboard shell: sidebar layout in `src/app/(dashboard)/layout.tsx`. Sidebar entries live in `src/components/dashboard/nav-items.ts`
- [x] UI kit: `Button`, `Input`, `Label`, `Card` in `src/components/ui/`, written by hand (see "Deviations")
- [x] Auth: mobile number + SMS code login, signed session cookie, and `requireSeller()` in `src/server/auth.ts` that returns the current seller or redirects to `/login`
- [x] Route guard: `src/proxy.ts` (Next 16's replacement for `middleware.ts`). Public paths: `/login` and `/buy/*`
- [x] Final Phase 1 schema in one migration (`prisma/migrations/20260924160000_phase1_schema`)
- [x] Money: integer tomans (`Int`) everywhere
- [x] Seed script: `npm run db:seed` gives demo seller `09120000000` with 20 products, 15 customers, 30 orders
- [x] CI: `.github/workflows/ci.yml` runs lint, type-check, tests and build on every PR
- [x] `.env.example` with every variable the app needs
- [x] `adjustStock` stub at `src/server/catalog/inventory.stub.ts`
- [ ] Branch protection on `main` (PR required, CI must pass): **blocked.** GitHub does not allow branch protection or rulesets on a private repo owned by a free personal account. It needs GitHub Pro on the owner's account (or the repo made public). Until then, follow rule 3 by hand: never push to `main` directly, always merge through a PR with green CI

### How to run it locally

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL and SESSION_SECRET
npm run db:deploy           # apply migrations
npm run db:seed             # demo data
npm run dev
```

Log in with `09120000000`. Without SMS credentials the 6-digit code is printed in the server console (`[dev sms] login code for ...`).

### Database integration tests

Files named `*.int.test.ts` test code against a real Postgres. They are **skipped** unless `TEST_DATABASE_URL` is set, and they must never point at your development database (they create and delete their own rows). CI runs them against a throwaway Postgres service.

One-time setup, then run (PowerShell):

```bash
psql -U postgres -h localhost -c "CREATE DATABASE ghaltak_test;"
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/ghaltak_test?schema=public"; npm run db:deploy
$env:TEST_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/ghaltak_test?schema=public"; npm test
```

After pulling new migrations, run `db:deploy` against the test database again.

### Shared conventions added after Step 0

- **Iran time.** Dates are stored in UTC and always formatted in `Asia/Tehran` (`APP_TIME_ZONE` in `src/lib/format.ts`), whatever time zone the server runs in. Anything that computes "today" or "this month" (Track B's report) must use Tehran day boundaries too.
- **Light theme only.** The components are designed for light mode; the dark-mode switch from the Next.js template was removed until a dark theme is designed.
- **Stale sessions.** If the session cookie is valid but its seller no longer exists, `requireSeller()` sends the user to `/logout`, which clears the cookie.

### Deviations from the original plan

- **No Auth.js.** Sessions use a signed cookie (`jose`) with a database table for one-time codes, which is the approach Next.js 16's own authentication guide recommends. Fewer moving parts, and it works with an Iranian SMS provider directly.
- **No shadcn CLI.** `ui.shadcn.com` is not reachable from every network (it timed out here), so the four base components are hand-written in the same style. Add more components by hand or copy them from the shadcn site.
- **`purchaseLink` is its own model** (`PurchaseLink`, many-to-many with `Product`), because one link can cover several products. `Order.publicToken` is for the customer's order confirmation/tracking page instead.
- **`StockMovement` model added** for the inventory audit log (task A2). The real `adjustStock` (A4) must write a row for every change.
- **`SessionPayload` holds only `sellerId`.** Never put the mobile number or other personal data in the cookie.

### Schema additions (all done in Step 0)

| Model | Field | Purpose |
|---|---|---|
| `Seller` | `mobile String @unique` (was `email`) | Login identity, normalized `09xxxxxxxxx` |
| `OtpCode` | new model | Hashed SMS codes with expiry, attempt count and consumed flag |
| `Product` | `lowStockThreshold Int @default(3)` | Low-stock warning (Track A, read by Track B report) |
| `Product` | `isActive Boolean @default(true)` | Hide products without deleting |
| `StockMovement` | new model | Audit log of every stock change |
| `ProductVariant` | `sellerId` (added in A1, migration `20260924170000`) | SKU unique per seller; direct tenant scoping of stock queries. Must equal the product's `sellerId` |
| `Customer` | `tag CustomerTag` (`NEW`, `LOYAL`, `INACTIVE`) | Customer grouping |
| `Order` | `publicToken`, `purchaseLinkId` | Customer-facing order page, and which link created the order |
| `Order` | `paymentMethod`, `paidAt`, `receiptImageUrl` | Payment status |
| `Order` | `shippingStatus` (`NOT_SHIPPED`, `IN_TRANSIT`, `DELIVERED`, `FAILED`) | Shipping tracking |
| `Order` | `source` (`MANUAL`, `PURCHASE_LINK`) | Where the order came from |
| `PurchaseLink` | new model | Public `/buy/[token]` links |

## Ownership rules

1. **Folder ownership.** Edit only the folders your track owns. If you must change anything else, open a small separate PR and get the other person to review it.
2. **Schema and migrations.** After Step 0, only ONE schema PR is open at a time. Say so in the team chat, merge it quickly, and the other person rebases. Never edit or delete an existing migration; add a new one.
3. **Branches.** `main` is protected. Use `track-a/<task>` or `track-b/<task>`. One PR = at most about a day of work.
4. **Shared UI.** New shared components go in `src/components/ui/`. Do not change an existing shared component without asking.
5. **Tenant safety.** Every query and mutation must be scoped by `sellerId` from `requireSeller()`. Never trust a `sellerId` sent from the client. A seller must never see another seller's data.
6. **Money.** Integer tomans everywhere. Format only at the display edge.
7. **No runtime foreign dependencies.** No Google Fonts, CDNs or other foreign services loaded at runtime (Iran connectivity restrictions).
8. **Next.js 16.** This is not the Next.js in older tutorials. Before writing code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.
9. **Prisma 7.** The client is imported from `@/generated/prisma/client` and needs the `pg` driver adapter. Use the shared client in `src/lib/prisma.ts`.

## The one cross-track contract

Orders reduce stock, and stock belongs to Track A.

```ts
// src/server/catalog/inventory.ts  (owned by Track A)
import type { Prisma } from "@/generated/prisma/client";

export function adjustStock(
  variantId: string,
  delta: number, // negative to reduce
  tx?: Prisma.TransactionClient, // pass the order transaction so both succeed or fail together
  options?: {
    reason?: "ORDER_PLACED" | "ORDER_CANCELED" | "ORDER_RETURNED"; // default by sign: placed / canceled
    orderId?: string | null; // shown in the stock history
  },
): Promise<void>;
```

- **Implemented in A4.** It wraps `changeStock()` (A2): one conditional UPDATE, so concurrent orders cannot oversell, and every change is logged in `StockMovement`.
- **Errors** (import them from `inventory.ts`):
  - `InsufficientStockError`: stock would go below zero. Show "out of stock". Nothing was changed.
  - `VariantNotFoundError`: the variant doesn't exist.
  - `RangeError`: `reason` doesn't match the sign of `delta` (e.g. `ORDER_PLACED` with a positive delta). This is a bug in the caller.
- The caller must already have checked that the variant belongs to the seller it acts for. Track B's order code does: order lines come from seller-scoped queries.
- **Live** since Track B's switch (#14, after issue #10 was fixed in #13). Orders use the real function through `src/server/orders/stock.ts`:
  - `takeStock(orderId, lines, tx)` logs `ORDER_PLACED` with the order id.
  - `returnStock(orderId, reason, tx)` gives back what the order's **own stock movements** took (cancel `ORDER_CANCELED`, return `ORDER_RETURNED`): never twice, and nothing for orders created while the stub was active.
  - Only `InsufficientStockError` becomes `OutOfStockError` ("out of stock").
  - Stock is always changed in variant-id order (added in A5), so two orders with the same variants can't deadlock.
- **The stub is deleted** (A5).
- **Development data:** run `npm run db:seed` after pulling. The seed makes its demo orders take stock like real ones, so the stock history shows them and canceling a demo order gives back what it took.
- **Tests:** Track B's `src/server/orders/orders.int.test.ts` (take, cancel once, return, stub-era orders, race for the last item, expiry) and the cross-track `src/test/integration/order-stock.int.test.ts` (all-or-nothing orders, no deadlock, Track A's stock invariant).

## Definition of done (every task)

- Works on the seed data and in RTL
- Every query scoped by `sellerId`
- Type-check, lint and tests pass in CI
- Tests cover the business logic (stock, status transitions, totals)
- PR description says what changed and how to try it

## Timeline (about 5 weeks)

| Week | Person A | Person B |
|---|---|---|
| 0 | Step 0 (B reviews) | Review; design the purchase-link page |
| 1 | A1 products | B1 orders (on seed data) |
| 2 | A2 inventory | B2 purchase link |
| 3 | A3 customers, A4 real `adjustStock` | B3 payment status, B4 shipping |
| 4 | Swap stub for real `adjustStock`; integration tests | B5 report dashboard |
| 5 | Joint: end-to-end test of the buy flow, bug fixes, pilot prep | |

## Out of scope for Phase 1

Payment gateway (Zarinpal/IDPay), subscription billing, Telegram/Instagram messaging, AI features, courier API
integrations. These are Phase 2 and later.
