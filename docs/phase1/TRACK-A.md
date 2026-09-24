# Track A — Catalog (Person A)

Read [README.md](./README.md) first (shared rules, Step 0, the `adjustStock` contract).

**Your job:** everything a seller needs to manage what they sell and who they sell to: products, variants,
inventory and customers.

## Step 0 owner

You own the shared foundation in the README's "Step 0" list. Person B reviews. Merge it before starting A1.

## What you own (edit only these)

```
src/app/(dashboard)/products/**
src/app/(dashboard)/inventory/**
src/app/(dashboard)/customers/**
src/app/uploads/**              (serves product images, public)
src/server/catalog/**
src/server/customers/**
src/components/catalog/**
src/components/customers/**
```

Plus Step 0 files while Step 0 is open: `prisma/`, `src/server/auth.ts`, dashboard layout, `src/lib/format.ts`, CI.

## Tasks

### A1 — Products (week 1)
- List page with search, category filter and pagination
- Create/edit form: name, price (integer tomans), category, image upload, active toggle
- Variants: add/remove color+size combinations, each with its own SKU (unique) and stock
- Server actions in `src/server/catalog/actions.ts`, queries in `queries.ts`, validation with Zod
- Product images: upload to S3-compatible storage (Arvan/Liara); use local disk storage behind an interface for dev
- **Done when:** a seller can create a product with 3 variants and see it in the list, and cannot see another seller's products

**Status: implemented** (branch `track-a/products`). Things the next tasks and Track B should know:

- Pages: `/products` (search, category filter, pagination of 20), `/products/new`, `/products/[id]/edit`. No delete: use the active toggle, because products with orders cannot be removed.
- **Stock is not editable on existing variants in the product form.** New variants take an initial stock (logged as a `StockMovement` with reason `INITIAL`). All later changes must go through the inventory page (A2) and `adjustStock` (A4), so every change is logged. A variant that appears in any order cannot be deleted from the form.
- Images: max 2MB, JPG/PNG/WebP detected by content (not by file name or MIME type). The browser shrinks photos to 1600px WebP before upload. Stored on local disk under `UPLOAD_DIR` (default `./uploads`, git-ignored) and served publicly from `/uploads/products/<uuid>`. To move to Arvan/Liara S3, change only `src/server/catalog/image-storage.ts`.
- `ProductVariant` now has its own `sellerId` (migration `20260924170000_variant_seller_scope`). SKUs are unique per seller, not globally. **Every code path that creates a variant must set `sellerId` equal to the product's `sellerId`.**
- Shared files touched: `src/proxy.ts` (`/uploads` is public), `next.config.ts` (Server Action body limit 3MB), `src/components/ui/badge.tsx` (new shared component), `prisma/schema.prisma`.
- Reusable helpers: `getStockStatus()` in `src/server/catalog/stock-status.ts` (out of stock / low / ok, used by the list and reusable by the inventory page and Track B's report).

### A2 — Inventory (week 2)
- Inventory screen: every variant with its stock, sortable, with a low-stock filter
- Manual stock adjustment with a reason note (keep a `StockMovement` log if Step 0 added it; otherwise ask before adding a model)
- Low-stock warning badge using `Product.lowStockThreshold`
- **Done when:** adjusting stock updates the list immediately and a variant under its threshold is flagged

**Status: implemented** (branch `track-a/inventory`).

- `/inventory`: every variant with stock, threshold and a status badge (کافی / کم‌موجودی / ناموجود). Tabs with counts: all, «نیاز به تأمین» (stock at or below the product's threshold, including zero), out of stock. Search by product name or SKU, sort by name or stock, 30 per page. `?product=<id>` shows one product (linked from the product edit page).
- Change stock inline, three modes: add, subtract, or "set to" (after a physical count). Optional note (max 200). Live preview of the resulting stock; the list updates without a reload.
- "Set to" only succeeds if the stock is still what the seller saw. If a sale happened meanwhile it is refused with the real number (a sale is never silently overwritten), and the row refreshes so a retry works.
- `/inventory/[variantId]`: the last 100 stock movements (time in Iran time, change, reason, note).
- **Core stock logic:** `changeStock()` and `setStock()` in `src/server/catalog/inventory.ts`. One conditional UPDATE per change, so concurrent orders cannot oversell; never below zero or above `MAX_STOCK`; writes a `StockMovement` in the same transaction; accepts a caller's transaction `tx`. **Invariant: a variant's movements sum to its stock** (the seed now follows it too).
- **Integration tests** against a real Postgres: `src/server/catalog/inventory.int.test.ts` (11 tests, including 12 concurrent orders on a stock of 5 → exactly 5 succeed). They run when `TEST_DATABASE_URL` is set, and in CI (Postgres service added). See the README.

### A3 — Customers (week 3)
- List with search by name/phone, filter by tag
- Profile page: name, phone, address, order count, total spent, average order, last purchase, order history (read-only list of Track B's orders)
- Tags `NEW` / `LOYAL` / `INACTIVE`: set manually, plus a helper that suggests a tag from order history
- Phone numbers stored normalized (Iranian format `09xxxxxxxxx`), unique per seller
- **Done when:** a seller can find a customer by phone and see their order history

**Status: implemented** (branch `track-a/customers`).

- `/customers`: search by name or phone (Persian digits and partial numbers work), tag tabs with counts, 20 per page. Each row shows purchases, total spent and last purchase.
- `/customers/[id]`: phone (tap to call), address, stats (orders, paid purchases, total spent, average, last purchase, returns), order history linking to Track B's order page, and an edit form (name, phone, address).
- **What counts as a purchase:** an order in `PAID`, `PREPARING`, `SHIPPED` or `DELIVERED` (`PURCHASE_STATUSES` in `src/server/customers/stats.ts`). Pending, canceled and returned orders don't count toward "total spent". **Track B's report (B5) should use the same definition** so the numbers match.
- **Tags:** set with their own buttons on the profile, not in the edit form, so two controls never write the same field (that caused a real bug during testing: saving the name undid a tag just applied). The suggestion is shown with its reason and never applied automatically: INACTIVE after 90 days without a purchase, LOYAL from 3 purchases, otherwise NEW.
- **Phone:** normalized to `09xxxxxxxxx` on save and unique per seller. A number that belongs to another customer is refused with a clear message. Changing a phone changes which customer future purchase-link orders attach to (Track B's buy flow matches by phone).
- Reads Track B's orders read-only, and reuses `OrderStatusBadge` and `orderCode()` from Track B.
- Tests: 11 unit tests (stats, tag rules, form) and 5 database tests (stats from real orders, phone search, tag filter, seller isolation).

### A4 — Contract functions for Track B (week 3)
- ~~`getProductsForSeller(sellerId)`~~ — not needed, see status below
- `adjustStock(variantId, delta, tx?)` — exactly the signature in the README. Throws if stock would go below zero. Must work inside a caller's transaction
- Unit tests: reduce, restore (on cancel/return), reject negative stock, works inside a transaction
- **Done when:** Track B swaps their stub for your function with no other change

**Status: implemented** (branch `track-a/stock-contract`).

- `adjustStock(variantId, delta, tx?, { reason?, orderId? })` in `src/server/catalog/inventory.ts`, a thin wrapper over `changeStock()`. Both tracks asked for `reason` and `orderId` (Person B in #4). They were added as an optional **fourth** parameter instead of changing the order of the others, so Track B's existing calls keep working and switching stays a one-line import change. `reason` defaults by the sign of `delta` and must match it.
- **`sellerId` was not added** (my earlier proposal). Track B's `takeStock`/`returnStock` don't receive it, so adding it would force changes in Track B's code. Track B's order lines already come from seller-scoped queries. The seller is read from the variant.
- The stub got the same signature, and `inventory-contract.test.ts` fails type-check if the two ever differ.
- **`getProductsForSeller` was not built.** B1 and B2 wrote their own seller-scoped queries (`getOrderFormOptions`, `getPublicLink`), so it would be dead code.
- **Switching is Track B's call, after issue #10** (see the README contract section).
- Tests: 6 database tests for the contract (Track B's exact call pattern inside a transaction, default and explicit reasons, `orderId` recorded, below-zero refused with nothing changed, reason/sign mismatch refused, unknown variant, rollback with the caller's transaction).

### Week 4–5
- Support Track B's integration: fix catalog bugs they find
- Joint end-to-end test of the whole buy flow (product → purchase link → order → stock reduced)

### A5 — Real stock for orders (week 4, from the README timeline)
Not in the original task list; defined from the timeline's week-4 item for Person A, "Swap stub for real `adjustStock`; integration tests", once issue #10 was fixed.

**Status: implemented** (branch `track-a/real-stock`, stacked on Track B's #14).

Track B did the switch itself in #14 (its own folder), with a better return rule than mine: an order gives back what its own stock movements took. A5 builds on it with the Track A side:

- **Deadlock fix in `src/server/orders/stock.ts`** (a small change in Track B's file, for Person B to review): stock is changed in variant-id order in both `takeStock` and `returnStock`. Checked: with #14 as-is, 10 simultaneous orders touching two variants in opposite line order hang until the test times out; with the fix they finish in about half a second.
- **Stub deleted**, with its signature type test (nothing imports it after #14).
- **Seed:** demo orders take stock like real ones (`ORDER_PLACED` with the order id, plus cancel/return movements), so each variant's history sums to its stock and each order's movements net to what it holds. With #14's return rule, canceling a demo order gives back exactly what it took. **Run `npm run db:seed` after pulling.**
- **Stock history** (`/inventory/[variantId]`) links each order-related change to its order.
- **Cross-track tests** (`src/test/integration/order-stock.int.test.ts`), only what Track B's own tests don't cover: all-or-nothing multi-line orders, no deadlock with opposite line order, and Track A's invariant after both.

**Found for Track B (not changed here):** a new customer's "find by phone, else create" in `createOrderInTx` fails when two orders with the same new phone arrive at once (e.g. a double-click on the buy page): the second gets a generic error. Documented as an expected-failure test (`it.fails`) in the integration file; remove `.fails` when fixed.

## Working with your coding agent

- Give it this file and the README at the start of each session, and tell it which task you're on
- Tell it explicitly: edit only the folders listed above; read `node_modules/next/dist/docs/` before Next.js code
- Ask it to write tests with the code, not after
- Review every diff for a missing `sellerId` scope before merging

## Handoffs

| To | When | What |
|---|---|---|
| Person B | Step 0 merged | Seed data, auth helper, schema |
| Person B | A4 merged | Real `adjustStock`, `getProductsForSeller` |
| From Person B | Any time | Ask for review if they need a schema or shared-UI change |
