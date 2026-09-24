# Phase 1 — Shared rules and foundation

Ghaltak is a platform that helps small Iranian online sellers (Instagram/Telegram) manage products, inventory,
customers, orders, payments and shipping in one place. Phase 1 is the MVP. Two people, each with a coding agent,
work in parallel on two tracks:

- [Track A — Catalog](./TRACK-A.md): products, variants, inventory, customers
- [Track B — Sales](./TRACK-B.md): orders, purchase link, payment status, shipping, report

Read this file first, then your track file.

## Step 0 — Shared foundation (do this BEFORE the tracks start)

Owner: Person A. Reviewer: Person B. Nobody starts a track until this is merged into `main`.

- [ ] RTL + Persian: `<html lang="fa" dir="rtl">`, Vazirmatn font (self-hosted, no CDN), Persian digits and Jalali dates helpers in `src/lib/format.ts`
- [ ] Dashboard shell: sidebar layout in `src/app/(dashboard)/layout.tsx`, shadcn/ui installed
- [ ] Auth: mobile number + SMS code login (Auth.js), session, and `requireSeller()` in `src/server/auth.ts` that returns the current `sellerId` or redirects
- [ ] Final Phase 1 schema in ONE migration (see "Schema additions" below)
- [ ] Money decision: store amounts as integer tomans (`Int`/`BigInt`), not `Decimal`. Change the existing fields in this migration
- [ ] Seed script `prisma/seed.ts`: 1 seller, 20 products with variants, 15 customers, 30 orders in mixed statuses
- [ ] CI: GitHub Action running lint, type-check, tests and build on every PR
- [ ] `.env.example` with every variable the app needs (no real secrets)
- [ ] Branch protection on `main`: PR required, CI must pass

### Schema additions (finalize in Step 0, not later)

| Model | Field | Purpose |
|---|---|---|
| `Product` | `lowStockThreshold Int @default(3)` | Low-stock warning (Track A, read by Track B report) |
| `Product` | `isActive Boolean @default(true)` | Hide products without deleting |
| `Customer` | `tag CustomerTag` (`NEW`, `LOYAL`, `INACTIVE`) | Customer grouping |
| `Order` | `publicToken String? @unique` | Purchase link `/buy/[token]` |
| `Order` | `paymentMethod`, `paidAt DateTime?`, `receiptImageUrl String?` | Payment status |
| `Order` | `shippingStatus` | Shipping tracking |
| `Order` | `source` (`MANUAL`, `PURCHASE_LINK`) | Where the order came from |

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
): Promise<void>;
```

- Track A ships the real version in task A4.
- Until then, Track B uses a stub in `src/server/catalog/inventory.stub.ts` with the same signature that only logs. Switch the import when A4 merges.
- It must throw if stock would go below zero. Track B must catch that and show "out of stock".

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
