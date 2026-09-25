# End-to-end tests

Two tests, each run against a real browser, app server and database.

## `order-lifecycle.spec.ts`

What happens after an order is placed. The seller enters a manual order and takes it through delivery, and the customer's page shows «تحویل داده شد». Then the seller returns it and cancels a second order. After each of those:

- stock comes back exactly
- the stock history shows «مرجوعی» or «لغو سفارش» with a link to the order
- the sales report stops counting the order

## `buy-flow.spec.ts`

It drives the whole Phase 1 buy flow in a real browser, against a real app server and a real database:

1. **Seller** (desktop) logs in through the SMS-code form, creates a product with one variant, and makes a purchase link.
2. **Customer** (Pixel 7 size, no account) opens the link, picks color/size and quantity, orders, and uploads a card-to-card receipt.
3. **Seller** sees the «رسید دریافت شد» badge and the receipt, confirms payment, prepares and ships with a tracking code.
4. **Customer** sees "payment confirmed", the tracking code and the amount due. The page shows no phone numbers.
5. **Seller**: stock went down by the ordered quantity, and the sales report counts the sale.

Each run creates its own seller and customer, so every number checked is exact and nothing needs to be wiped.

## Run it

One-time setup (PowerShell):

```bash
psql -U postgres -h localhost -c "CREATE DATABASE ghaltak_e2e;"
npx playwright install chromium
```

Then add `E2E_DATABASE_URL` to your `.env`. Its database name **must end in `_e2e`**, or the run refuses to start:

```bash
E2E_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/ghaltak_e2e?schema=public"
```

```bash
npm run test:e2e
```

The run applies migrations to the e2e database, then starts its own dev server on port **3100**. That server uses the e2e database and its own build folder, `.next-e2e`. It runs the tests and then stops the server.

A second dev server on port **3101** (build folder `.next-e2e-billing`) has subscription payments on (`BILLING_ENABLED=true`, the pretend gateway as the platform's gateway), for `billing.spec.ts`. The first one keeps billing off, as production does until the week-6 decision.

It runs **next to** your usual dev server on port 3000. Next.js allows only one dev server per build folder, which is why the e2e server gets its own (`APP_DIST_DIR` in `playwright.config.ts`).

## How it logs in

The app only stores a hash of the SMS code, so the test can't read the real one. After asking for a code, it replaces the newest code's hash in the e2e database with the hash of a known code, using the e2e server's own `SESSION_SECRET` from `playwright.config.ts`. It then types that code, so the real verification code path still runs.

## When it fails

Screenshots and a trace are saved in `test-results/`. Open a trace with:

```bash
npx playwright show-trace test-results/<test>/trace.zip
```

In CI the report and traces are uploaded as the `playwright-report` artifact.
