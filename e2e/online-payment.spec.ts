import { expect, test } from "@playwright/test";
import { createManualOrder, createProduct, logIn, publicTokenOf, toman, uniqueMobile } from "./helpers";

// B6, online payment through the seller's own gateway, using the pretend
// gateway (src/server/payments/fake-gateway.ts; only in e2e, never production).

const PRICE = 180_000;

test("online payment: cancel at the gateway, then pay; the order becomes paid once", async ({
  page: seller,
  browser,
}) => {
  const sellerMobile = uniqueMobile("0915");
  await logIn(seller, sellerMobile);

  await test.step("the seller turns on online payment (test gateway)", async () => {
    await seller.goto("/settings/payments");
    await seller.getByLabel(/درگاه آزمایشی داخلی/).check();
    await seller.getByLabel("پرداخت آنلاین برای مشتری‌ها فعال باشد").check();
    await seller.getByRole("button", { name: "ذخیرهٔ درگاه" }).click();
    await expect(seller.getByText("ذخیره شد.")).toBeVisible();
    await seller.getByRole("button", { name: "آزمایش اتصال" }).click();
    await expect(seller.getByText("اتصال به درگاه برقرار است.")).toBeVisible();
  });

  const variantId = await createProduct(seller, {
    name: `محصول آنلاین ${sellerMobile.slice(-5)}`,
    price: PRICE,
    stock: 5,
  });
  const order = await createManualOrder(seller, {
    variantId,
    quantity: 1,
    customerName: "مشتری آنلاین",
    customerPhone: uniqueMobile("0939"),
  });
  const orderPage = `/buy/order/${await publicTokenOf(order.id)}`;

  const customerContext = await browser.newContext({ locale: "fa-IR", timezoneId: "Asia/Tehran" });
  const customer = await customerContext.newPage();
  const payButton = customer.getByRole("button", { name: `پرداخت آنلاین ${toman(PRICE)}` });

  await test.step("the customer cancels at the gateway and is told so", async () => {
    await customer.goto(orderPage);
    await payButton.click();
    await expect(customer.getByRole("heading", { name: "درگاه آزمایشی" })).toBeVisible();
    await expect(customer.getByText(toman(PRICE))).toBeVisible();
    await customer.getByRole("link", { name: "انصراف از پرداخت" }).click();

    await expect(customer).toHaveURL(/payment=canceled/);
    await expect(customer.getByText("پرداخت لغو شد.", { exact: false })).toBeVisible();
    await expect(payButton).toBeVisible(); // still unpaid, can try again
  });

  await test.step("a hand-made ?payment=paid link doesn't make the unpaid order look paid", async () => {
    await customer.goto(`${orderPage}?payment=paid`);
    await expect(payButton).toBeVisible();
    await expect(customer.getByText("پرداخت آنلاین شما انجام شد.")).toHaveCount(0);
  });

  await test.step("the customer pays and the order is paid", async () => {
    await payButton.click();
    await customer.getByRole("link", { name: "پرداخت موفق" }).click();
    await expect(customer).toHaveURL(/payment=paid/);
    await expect(customer.getByText("پرداخت آنلاین شما انجام شد.")).toBeVisible();
    await expect(customer.getByText("پرداخت شما تأیید شد.")).toBeVisible();
    await expect(payButton).toHaveCount(0);
  });

  await test.step("refreshing the return page doesn't pay twice", async () => {
    await customer.reload();
    await expect(customer.getByText("پرداخت شما تأیید شد.")).toBeVisible();
  });

  await test.step("the seller sees it paid online, with the gateway's reference", async () => {
    await seller.goto(`/orders/${order.id}`);
    await expect(seller.getByText("پرداخت آنلاین", { exact: true })).toBeVisible();
    await expect(seller.getByText(/کد پیگیری درگاه: FAKE-\d+/)).toBeVisible();
    // One verified and one canceled attempt, nothing needing review.
    await expect(seller.getByText("لغو توسط مشتری")).toHaveCount(1);
    await expect(seller.getByText("مبلغ به حساب شما آمد", { exact: false })).toHaveCount(0);
  });

  await test.step("an unknown fake-gateway page doesn't exist", async () => {
    const res = await customer.goto("/pay/fake/FAKE-not-a-real-payment");
    expect(res?.status()).toBe(404);
  });

  await customerContext.close();
});
