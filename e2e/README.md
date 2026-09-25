# End-to-end tests

Each test runs against a real browser, app server and database. The main ones are below; the others
(`card-to-card`, `customer-sms`, `online-payment`) describe themselves at the top of the file.

## `order-lifecycle.spec.ts`

What happens after an order is placed. The seller enters a manual order and takes it through delivery, and the customer's page shows «تحویل داده شد». Then the seller returns it and cancels a second order. After each of those:

- stock comes back exactly
- the stock history shows «مرجوعی» or «لغو سفارش» with a link to the order
- the sales report stops counting the order

## `data-export.spec.ts`

C6. A new seller enters a product and an order for a customer named «=2+3 مشتری», then downloads the three files
from «تنظیمات» ← «خروجی داده»: each starts with a UTF-8 BOM, the product row shows the stock the inventory page
shows, the formula-looking name is written as text, and the orders file follows today's Jalali date and the status
filter. A bad date is explained on the page. `/privacy` opens on a phone without logging in, and the export sends a
visitor to the login page.

## `buy-flow.spec.ts`

It drives the whole Phase 1 buy flow in a real browser, against a real app server and a real database:

1. **Seller** (desktop) logs in through the SMS-code form, creates a product with one variant, and makes a purchase link.
2. **Customer** (Pixel 7 size, no account) opens the link, picks color/size and quantity, orders, and uploads a card-to-card receipt.
3. **Seller** sees the «رسید دریافت شد» badge and the receipt, confirms payment, prepares and ships with a tracking code.
4. **Customer** sees "payment confirmed", the tracking code and the amount due. The page shows no phone numbers.
5. **Seller**: stock went down by the ordered quantity, and the sales report counts the sale.

Each run creates its own seller and customer, so every number checked is exact and nothing needs to be wiped.

## `onboarding.spec.ts`

The dashboard's «شروع کار» checklist (C5). A brand-new seller sees five undone steps. The test does each one (store
details, product, card number, purchase link, order) and checks it ticks. A store name alone doesn't complete step 1;
a contact does. After the fifth step the checklist is gone and «خلاصهٔ امروز» counts the order and the item that now
needs restocking. Then a phone with no session opens `/help` and a guide: every screenshot loads and nothing scrolls
sideways.

## `help-screenshots.spec.ts` (not a test)

Re-takes the screenshots of the seller guide into `public/help/` from the real app, on a phone-sized screen with a
made-up shop. It is skipped unless you ask for it:

```bash
HELP_SCREENSHOTS=1 npx playwright test help-screenshots
```

Run it after changing a screen that the guide shows, and commit the new images. Every image has a fixed size, so
`src/app/help/guides.ts` keeps the same dimensions.

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
