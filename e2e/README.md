# End-to-end test

`buy-flow.spec.ts` drives the whole Phase 1 buy flow in a real browser, against a real app server and a real database:

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

The run applies migrations to the e2e database, starts its own dev server on port **3100** with that database, runs the test and stops the server. It doesn't touch your usual dev server on port 3000.

## How it logs in

The app only stores a hash of the SMS code, so the test can't read the real one. After asking for a code, it replaces the newest code's hash in the e2e database with the hash of a known code, using the e2e server's own `SESSION_SECRET` from `playwright.config.ts`. It then types that code, so the real verification code path still runs.

## When it fails

Screenshots and a trace are saved in `test-results/`. Open a trace with:

```bash
npx playwright show-trace test-results/<test>/trace.zip
```

In CI the report and traces are uploaded as the `playwright-report` artifact.
