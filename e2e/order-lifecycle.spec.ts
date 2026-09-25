import { expect, test, type Page } from "@playwright/test";
import {
  changeStatusConfirmed,
  createManualOrder,
  createProduct,
  faDigits,
  logIn,
  publicTokenOf,
  stockOf,
  toman,
  uniqueMobile,
} from "./helpers";

// What happens after an order is placed, beyond the happy path in
// buy-flow.spec.ts (docs/phase2/TRACK-B.md, week 0):
//
//   delivered → the customer's page says so
//   returned  → stock comes back exactly, the stock history says «مرجوعی»
//               with a link to the order, and the report stops counting it
//   canceled  → the same, with «لغو سفارش»
//
// Each run makes its own seller, so every number checked here is exact.

const PRICE = 100_000;
const START_STOCK = 10;

/** The "sales today" tile on /reports: its amount and its order-count line. */
async function expectSalesToday(page: Page, amount: number, orders: number) {
  await page.goto("/reports");
  const tile = page.getByText("فروش امروز", { exact: true }).locator("..");
  await expect(tile.getByText(toman(amount), { exact: true })).toBeVisible();
  await expect(tile.getByText(new RegExp(`^${faDigits(orders)} سفارش`))).toBeVisible();
}

/** The stock-history row for this order with this reason (e.g. «مرجوعی»). */
async function expectHistoryRow(page: Page, variantId: string, reason: string, orderCode: string) {
  await page.goto(`/inventory/${variantId}`);
  const row = page.getByRole("row").filter({ hasText: reason }).filter({ hasText: orderCode });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("link", { name: `سفارش ${orderCode}` })).toBeVisible();
}

test("order lifecycle: delivery, return and cancel", async ({ page: seller, browser }) => {
  const sellerMobile = uniqueMobile("0913");
  const productName = `محصول چرخهٔ سفارش ${sellerMobile.slice(-5)}`;

  await logIn(seller, sellerMobile);
  const variantId = await createProduct(seller, { name: productName, price: PRICE, stock: START_STOCK });
  expect(await stockOf(seller, productName)).toBe(faDigits(START_STOCK));

  // --- Delivery, then return --------------------------------------------------
  const delivered = await createManualOrder(seller, {
    variantId,
    quantity: 3,
    customerName: "مشتری تحویل",
    customerPhone: uniqueMobile("0936"),
  });

  await test.step("the order takes stock", async () => {
    expect(await stockOf(seller, productName)).toBe(faDigits(START_STOCK - 3));
  });

  await test.step("seller takes it all the way to delivered", async () => {
    await seller.goto(`/orders/${delivered.id}`);
    await seller.getByRole("button", { name: "تأیید پرداخت" }).click();
    await seller.getByRole("button", { name: "در حال آماده‌سازی" }).click();
    await seller.getByLabel("روش ارسال").selectOption("POST");
    await seller.getByLabel("کد رهگیری (اختیاری)").fill("9876543210");
    await seller.getByRole("button", { name: "ثبت و ارسال سفارش" }).click();
    await seller.getByRole("button", { name: "تحویل‌شده" }).click();

    await expect(seller.getByText("تحویل داده شد", { exact: true })).toBeVisible();
    await expect(seller.getByRole("button", { name: "مرجوعی" })).toBeVisible();
  });

  await test.step("the customer's page shows it delivered", async () => {
    const customerContext = await browser.newContext({ locale: "fa-IR", timezoneId: "Asia/Tehran" });
    const customer = await customerContext.newPage();
    await customer.goto(`/buy/order/${await publicTokenOf(delivered.id)}`);
    await expect(customer.getByText("وضعیت: تحویل داده شد · پست")).toBeVisible();
    await expect(customer.getByText("9876543210")).toBeVisible();
    await customerContext.close();
  });

  await test.step("the report counts the delivered sale", async () => {
    await expectSalesToday(seller, 3 * PRICE, 1);
  });

  await test.step("a return gives the stock back and leaves the report", async () => {
    await seller.goto(`/orders/${delivered.id}`);
    await changeStatusConfirmed(seller, "مرجوعی");
    await expect(seller.getByText("این سفارش بسته شده است.")).toBeVisible();

    expect(await stockOf(seller, productName)).toBe(faDigits(START_STOCK));
    await expectHistoryRow(seller, variantId, "مرجوعی", delivered.code);
    await expectSalesToday(seller, 0, 0);
  });

  // --- Cancel before payment --------------------------------------------------
  const canceled = await createManualOrder(seller, {
    variantId,
    quantity: 2,
    customerName: "مشتری لغو",
    customerPhone: uniqueMobile("0937"),
  });

  await test.step("a cancel gives the stock back", async () => {
    expect(await stockOf(seller, productName)).toBe(faDigits(START_STOCK - 2));

    await seller.goto(`/orders/${canceled.id}`);
    await changeStatusConfirmed(seller, "لغوشده");
    await expect(seller.getByText("این سفارش بسته شده است.")).toBeVisible();

    expect(await stockOf(seller, productName)).toBe(faDigits(START_STOCK));
    await expectHistoryRow(seller, variantId, "لغو سفارش", canceled.code);
  });

  await test.step("the report still counts nothing", async () => {
    await expectSalesToday(seller, 0, 0);
  });
});
