import { expect, test, type Page } from "@playwright/test";
import { createManualOrder, createProduct, logIn, uniqueMobile } from "./helpers";

// B7, customer SMS. Without Kavenegar keys the SMS service records each
// message as DEV («آزمایشی») instead of sending it, which is what we check.

/** Texts go out after the response (after()), so reload until they show. */
async function expectSmsRow(page: Page, orderId: string, label: string) {
  await expect(async () => {
    await page.goto(`/orders/${orderId}`);
    const list = page.getByRole("heading", { name: "پیامک‌های مشتری" }).locator("../..");
    await expect(list.getByRole("listitem").filter({ hasText: label })).toContainText("آزمایشی", { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

test("customer SMS: placed and paid are texted; a switched-off event is not", async ({ page: seller }) => {
  const sellerMobile = uniqueMobile("0916");
  await logIn(seller, sellerMobile);

  await test.step("the seller switches off the «shipped» text", async () => {
    await seller.goto("/settings/payments");
    await seller.getByRole("checkbox", { name: /^ارسال/ }).uncheck();
    await seller.getByRole("button", { name: "ذخیرهٔ تنظیمات پیامک" }).click();
    await expect(seller.getByText("ذخیره شد.")).toBeVisible();
  });

  const variantId = await createProduct(seller, { name: `محصول پیامک ${sellerMobile.slice(-5)}`, price: 90_000, stock: 5 });
  const order = await createManualOrder(seller, {
    variantId,
    quantity: 1,
    customerName: "مشتری پیامک",
    customerPhone: uniqueMobile("0935"),
  });

  await test.step("placing the order texts the customer", async () => {
    await expectSmsRow(seller, order.id, "ثبت سفارش");
  });

  await test.step("confirming payment texts the customer", async () => {
    await seller.goto(`/orders/${order.id}`);
    await seller.getByRole("button", { name: "تأیید پرداخت" }).click();
    await expect(seller.getByText("کارت به کارت", { exact: true })).toBeVisible();
    await expectSmsRow(seller, order.id, "تأیید پرداخت");
  });

  await test.step("shipping doesn't, because that text is switched off", async () => {
    await seller.getByRole("button", { name: "در حال آماده‌سازی" }).click();
    await seller.getByLabel("روش ارسال").selectOption("POST");
    await seller.getByRole("button", { name: "ثبت و ارسال سفارش" }).click();
    await expect(seller.getByRole("button", { name: "تحویل‌شده" })).toBeVisible();

    await seller.waitForTimeout(1500); // give a (wrong) after() time to run
    await seller.goto(`/orders/${order.id}`);
    const list = seller.getByRole("heading", { name: "پیامک‌های مشتری" }).locator("../..");
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByRole("listitem").filter({ hasText: /^ارسال/ })).toHaveCount(0);
  });
});
