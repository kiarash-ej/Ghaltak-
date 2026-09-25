import { expect, test } from "@playwright/test";
import { createManualOrder, createProduct, logIn, publicTokenOf, uniqueMobile } from "./helpers";

// B6, card-to-card: the seller saves their card in «پرداخت» settings, and the
// customer's own order page shows it while the order waits for payment.

const CARD = "6037991234567893";
const CARD_SPACED = "6037 9912 3456 7893";
const SHEBA = "IR820540102680020817909002";

test("card-to-card: settings keep it masked, the customer's order page shows it", async ({
  page: seller,
  browser,
}) => {
  const sellerMobile = uniqueMobile("0914");
  await logIn(seller, sellerMobile);

  await test.step("an invalid card number is refused", async () => {
    await seller.goto("/settings/payments");
    await seller.getByLabel("شمارهٔ کارت", { exact: true }).fill("6037991234567890");
    await seller.getByLabel("نام صاحب کارت").fill("سارا احمدی");
    await seller.getByRole("button", { name: "ذخیرهٔ اطلاعات کارت" }).click();
    await expect(seller.getByText("شمارهٔ کارت معتبر نیست.", { exact: false })).toBeVisible();
  });

  await test.step("the seller saves card, holder and Sheba; settings show only the last four", async () => {
    await seller.getByLabel("شمارهٔ کارت", { exact: true }).fill(CARD_SPACED);
    await seller.getByLabel("شمارهٔ شبا (اختیاری)").fill(SHEBA);
    await seller.getByRole("button", { name: "ذخیرهٔ اطلاعات کارت" }).click();
    await expect(seller.getByText("ذخیره شد.")).toBeVisible();
    await expect(seller.getByLabel("شمارهٔ کارت", { exact: true })).toHaveValue("");

    await seller.reload();
    await expect(seller.getByText("•••• 7893")).toBeVisible();
    const html = await seller.content();
    expect(html).not.toContain(CARD);
    expect(html).not.toContain(CARD_SPACED);
    expect(html).not.toContain(SHEBA);
  });

  const variantId = await createProduct(seller, {
    name: `محصول کارت ${sellerMobile.slice(-5)}`,
    price: 150_000,
    stock: 5,
  });
  const order = await createManualOrder(seller, {
    variantId,
    quantity: 1,
    customerName: "مشتری کارت",
    customerPhone: uniqueMobile("0938"),
  });
  const orderPage = `/buy/order/${await publicTokenOf(order.id)}`;

  const customerContext = await browser.newContext({ locale: "fa-IR", timezoneId: "Asia/Tehran" });
  const customer = await customerContext.newPage();

  await test.step("the customer's order page shows the card while payment is due", async () => {
    await customer.goto(orderPage);
    // The store header (A6's StoreHeader) now sits on the order page too.
    await expect(customer.locator("header").getByText("فروشگاه من")).toBeVisible();
    await expect(customer.getByText(CARD_SPACED)).toBeVisible();
    await expect(customer.getByText("به نام: سارا احمدی")).toBeVisible();
    await expect(customer.getByText("IR82 0540 1026 8002 0817 9090 02")).toBeVisible();
    await expect(customer.getByRole("button", { name: "کپی شماره کارت" })).toBeVisible();
  });

  await test.step("once the seller confirms payment, the card is no longer shown", async () => {
    await seller.goto(`/orders/${order.id}`);
    await seller.getByRole("button", { name: "تأیید پرداخت" }).click();
    await expect(seller.getByText("کارت به کارت", { exact: true })).toBeVisible();

    await customer.reload();
    await expect(customer.getByText("پرداخت شما تأیید شد.")).toBeVisible();
    await expect(customer.getByText(CARD_SPACED)).toHaveCount(0);
  });

  await customerContext.close();
});
