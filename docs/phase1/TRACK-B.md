# Track B — Sales (Person B)

Read [README.md](./README.md) first (shared rules, Step 0, the `adjustStock` contract).

**Your job:** everything from "a customer wants to buy" to "the order is delivered": orders, the public purchase
link, payment status, shipping and the sales report.

## Before Step 0 merges (week 0)

Review Person A's Step 0 PR, especially the schema (the `Order` fields are yours to sanity-check) and
`requireSeller()`. Meanwhile design the purchase-link page (mobile-first, RTL, works on slow connections).

## What you own (edit only these)

```
src/app/(dashboard)/orders/**
src/app/(dashboard)/reports/**
src/app/buy/**                (public purchase link, no login)
src/server/orders/**
src/server/reports/**
src/components/orders/**
```

## Tasks

### B1 — Orders (week 1)
- Order list: filter by status, search by customer name/phone, pagination
- Manual order entry: pick or create a customer, pick products/variants, quantities, address; total computed on the server
- Seven statuses: `PENDING_PAYMENT → PAID → PREPARING → SHIPPED → DELIVERED`, plus `CANCELED` and `RETURNED`. Put the allowed transitions in one function (`canTransition(from, to)`) with tests; reject invalid ones
- Stock: create the order and reduce stock in ONE transaction using `adjustStock(variantId, -qty, tx)`. Restore stock on cancel/return. Until Track A ships A4, use the stub from the README
- Snapshot `unitPrice` on each `OrderItem` at order time (later price changes must not alter old orders)
- Work on the seed data; do not wait for Track A's UI
- **Done when:** a seller can create an order, see stock drop, cancel it and see stock come back

### B2 — Purchase link (week 2)
- Seller generates a link for a product or a set of products: `/buy/[token]`
- Public page (no login): product, choose color and size, quantity, enter name/phone/address, submit
- Creates an order with `source = PURCHASE_LINK`, status `PENDING_PAYMENT`, reduces stock, and shows the customer an order code plus payment instructions
- Tokens are random and unguessable; the page shows only the products attached to that link and no seller data
- Rate-limit submissions (basic per-IP limit) and validate everything with Zod, since this page is public
- **Done when:** someone with no account can place an order from a phone, and it appears in the seller's order list

### B3 — Payment status (week 3)
- Seller marks an order paid manually (method: card-to-card, cash, other) with a timestamp
- Card-to-card receipt: customer or seller uploads a receipt image; the seller reviews it and confirms
- Confirming payment moves the order to `PAID`
- No gateway yet (Zarinpal/IDPay is Phase 2), but keep the payment code behind a small interface so a gateway can be added
- **Done when:** an order can go from `PENDING_PAYMENT` to `PAID` with a receipt attached

### B4 — Shipping (week 3)
- On each order: method (post, courier, in-person), cost, tracking code, shipping status
- Moving an order to `SHIPPED` requires a method; tracking code optional
- Show the shipping info on the order page and on the customer's confirmation page
- **Done when:** the seller can record a shipment and the customer can see the tracking code

### B5 — Sales report (week 4)
- Dashboard: sales today / this week / this month, order count, average order value, new vs returning customers, top-selling products, low-stock products, unfinished orders
- Jalali dates and Persian digits; charts must not load external scripts
- Query design: aggregate in SQL (`groupBy`/raw), not by loading all orders into memory
- **Done when:** the numbers match a hand count on the seed data

### Week 4–5
- Swap the `adjustStock` stub for Track A's real function
- Joint end-to-end test of the buy flow, and fix bugs found

## Working with your coding agent

- Give it this file and the README at the start of each session, and tell it which task you're on
- Tell it explicitly: edit only the folders listed above; read `node_modules/next/dist/docs/` before Next.js code
- Ask it to write tests for status transitions, totals and stock handling with the code
- Review every diff for a missing `sellerId` scope. The public `/buy` page is the one exception: it resolves the seller from the token, never from client input

## Handoffs

| From | When | What you get |
|---|---|---|
| Person A | Step 0 merged | Seed data, auth helper, schema |
| Person A | A4 merged | Real `adjustStock`, `getProductsForSeller` |
| To Person A | Any time | Ask for review if you need a schema or shared-UI change |
