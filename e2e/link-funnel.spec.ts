import { devices, expect, test, type Page } from "@playwright/test";
import { createProduct, faDigits, logIn, uniqueMobile } from "./helpers";

// B8, the purchase-link funnel. A customer opens the link twice and orders
// once; a Telegram link preview opens it too but isn't a person. The link's
// card in /orders/links and the table in /reports show views → orders → paid.

/** Views are counted after the response (after()), so reload until they show. */
async function expectLinkStats(page: Page, title: string, stats: [views: number, orders: number, paid: number, rate: string]) {
  const [views, orders, paid, rate] = stats;
  await expect(async () => {
    await page.goto("/orders/links");
    const card = page.getByRole("listitem").filter({ hasText: title });
    const numbers = card.getByRole("definition");
    await expect(numbers).toHaveText([faDigits(views), faDigits(orders), faDigits(paid), rate], { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

test("link funnel: views, orders and paid orders per link", async ({ page: seller, browser, request }) => {
  const sellerMobile = uniqueMobile("0913");
  const title = `لینک قیف ${sellerMobile.slice(-5)}`;
  const productName = `محصول قیف ${sellerMobile.slice(-5)}`;
  await logIn(seller, sellerMobile);
  await createProduct(seller, { name: productName, price: 120_000, stock: 5 });

  let linkPath = "";
  await test.step("a new link has no views yet", async () => {
    await seller.goto("/orders/links");
    await seller.getByLabel("عنوان (اختیاری، به مشتری نمایش داده می‌شود)").fill(title);
    await seller.getByLabel(productName).check();
    await seller.getByRole("button", { name: "ساخت لینک خرید" }).click();
    await expect(seller.getByText("لینک ساخته شد.")).toBeVisible();
    const card = seller.getByRole("listitem").filter({ hasText: title });
    linkPath = (await card.locator("code").innerText()).trim();
    await expectLinkStats(seller, title, [0, 0, 0, "—"]);
  });

  await test.step("a Telegram link preview is not a view", async () => {
    const preview = await request.get(linkPath, { headers: { "user-agent": "TelegramBot (like TwitterBot)" } });
    expect(preview.ok()).toBe(true);
  });

  const customerContext = await browser.newContext({ ...devices["Pixel 7"], locale: "fa-IR", timezoneId: "Asia/Tehran" });
  const customer = await customerContext.newPage();

  await test.step("the customer opens the link twice and orders once", async () => {
    await customer.goto(linkPath);
    await customer.reload();
    await customer.getByLabel(`رنگ و سایز ${productName}`).selectOption({ label: "مشکی / M" });
    await customer.getByLabel("نام و نام خانوادگی").fill("مشتری قیف");
    await customer.getByLabel("شمارهٔ موبایل").fill(uniqueMobile("0936"));
    await customer.getByLabel("آدرس کامل").fill("اصفهان، خیابان چهارباغ، پلاک ۳");
    await customer.getByRole("button", { name: "ثبت سفارش" }).click();
    await expect(customer.getByRole("heading", { name: "سفارش شما ثبت شد" })).toBeVisible();
    // Two views (the preview and the order form's post don't count), one unpaid order.
    await expectLinkStats(seller, title, [2, 1, 0, `${faDigits(0)}٪`]);
  });
  await customerContext.close();

  await test.step("once the seller confirms payment, the order counts as paid", async () => {
    await seller.goto("/orders");
    await seller.getByRole("row").filter({ hasText: "مشتری قیف" }).getByRole("link", { name: "جزئیات" }).click();
    await seller.getByRole("button", { name: "تأیید پرداخت" }).click();
    await expect(seller.getByText("کارت به کارت", { exact: true })).toBeVisible();
    await expectLinkStats(seller, title, [2, 1, 1, `${faDigits(50)}٪`]);
  });

  await test.step("the sales report shows the same numbers", async () => {
    await seller.goto("/reports");
    const row = seller
      .getByRole("heading", { name: "قیف لینک‌های خرید این ماه" })
      .locator("../..")
      .getByRole("row")
      .filter({ hasText: title });
    await expect(row.getByRole("cell")).toHaveText([title, faDigits(2), faDigits(1), faDigits(1), `${faDigits(50)}٪`]);
  });
});
