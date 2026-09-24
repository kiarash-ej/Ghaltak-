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

### A2 — Inventory (week 2)
- Inventory screen: every variant with its stock, sortable, with a low-stock filter
- Manual stock adjustment with a reason note (keep a `StockMovement` log if Step 0 added it; otherwise ask before adding a model)
- Low-stock warning badge using `Product.lowStockThreshold`
- **Done when:** adjusting stock updates the list immediately and a variant under its threshold is flagged

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
