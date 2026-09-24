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

### A4 — Contract functions for Track B (week 3)
- `getProductsForSeller(sellerId)` — active products with variants and stock, for the order form and buy link
- `adjustStock(variantId, delta, tx?)` — exactly the signature in the README. Throws if stock would go below zero. Must work inside a caller's transaction
- Unit tests: reduce, restore (on cancel/return), reject negative stock, works inside a transaction
- **Done when:** Track B swaps their stub for your function with no other change

> **Note from A2 (decide with Person B before A4):** the real logic already exists as `changeStock()`, so `adjustStock` will be a thin wrapper. But the contract signature has gaps: it has no `reason` (placed / canceled / returned all look alike in the history), no `orderId` (the history cannot link to the order), and no `sellerId` (it trusts the caller to have checked the variant belongs to the seller). Proposal: `adjustStock(variantId, delta, { sellerId, reason, orderId }, tx?)`. Changing it now costs nothing because Track B has not used the stub yet.

### Week 4–5
- Support Track B's integration: fix catalog bugs they find
- Joint end-to-end test of the whole buy flow (product → purchase link → order → stock reduced)

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
