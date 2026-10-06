import { expect, test, type Page } from "@playwright/test";
import { createManualOrder, createProduct, faDigits, logIn, toman, uniqueMobile } from "./helpers";

// Product profit and expenses (spec §6.4): a sale without a cost price gets
// one from «سود محصولات» (and its past sale with it); then expenses, one-off
// and monthly, move net profit by exactly their amounts. All in this month.
//
// Sale 300,000; cost 120,000 → gross 180,000. Ads 30,000 → 150,000.
// Rent 50,000 a month (today's month made at once) → 100,000. Removing that
// month → 150,000 again, and it isn't made again. Ads edited to 40,000 → 140,000.

const PRICE = 300_000;
const COST = 120_000;

/** The overview's net profit, in thousands of tomans («۱۵۰ هزار تومان»). */
async function expectNetProfit(page: Page, thousands: number) {
  await page.goto("/finance");
  const net = page.getByRole("group", { name: "سود خالص", exact: true });
  await expect(net.locator("[data-countup]")).toHaveText(faDigits(thousands));
  await expect(net).toContainText("هزار تومان");
}

test("product profit and expenses: cost from the profit tab, expenses move net profit", async ({ page }) => {
  const mobile = uniqueMobile("0921");
  await logIn(page, mobile);
  const product = `بدون قیمت خرید ${mobile.slice(-5)}`;

  await test.step("a sale of a product without a cost price", async () => {
    const variantId = await createProduct(page, { name: product, price: PRICE, stock: 5 });
    const order = await createManualOrder(page, { variantId, quantity: 1, customerName: "مشتری", customerPhone: uniqueMobile("0939") });
    await page.goto(`/orders/${order.id}`);
    await page.getByRole("button", { name: "تأیید پرداخت" }).click();
    await expect(page.getByText("کارت‌به‌کارت", { exact: true })).toBeVisible();
  });

  await test.step("«سود محصولات»: the missing cost, added right on the row, also for the past sale", async () => {
    await page.goto("/finance/products?missing=1");
    const row = page.locator(`[data-product="${product}"]`);
    await expect(row).toContainText("قیمت خرید ثبت نشده");
    await row.getByLabel(`قیمت خرید ${product} (تومان)`).fill(String(COST));
    await expect(row.getByRole("checkbox", { name: /برای فروش‌های قبلیِ بدون قیمت خرید/ })).toBeChecked();
    await row.getByRole("button", { name: "ذخیرهٔ قیمت خرید" }).click();
    await expect(page.getByText("همهٔ محصولات فروخته‌شدهٔ این بازه قیمت خرید دارند. 🎉")).toBeVisible();

    await page.goto("/finance/products");
    await expect(row).toContainText(toman(PRICE - COST));
    await expect(row).toContainText(`${faDigits(60)}٪`);
    await expectNetProfit(page, 180);
  });

  await test.step("a one-off expense", async () => {
    await page.goto("/finance/expenses");
    await page.getByLabel("مبلغ (تومان)").fill("30000");
    await page.getByRole("button", { name: "ثبت هزینه" }).click();
    await expect(page.getByText("هزینه ثبت شد.")).toBeVisible();
    await expect(page.getByLabel("مبلغ (تومان)")).toHaveValue(""); // ready for the next one
    await expect(page.getByText(`جمع: ${toman(30_000)}`)).toBeVisible();
    await expectNetProfit(page, 150);
  });

  await test.step("a monthly repeat: this month's rent is made at once", async () => {
    await page.goto("/finance/expenses");
    await page.getByLabel("مبلغ (تومان)").fill("50000");
    await page.locator("label").filter({ hasText: /^اجاره$/ }).click();
    await page.getByRole("checkbox", { name: /هر ماه تکرار شود/ }).check();
    await page.getByRole("button", { name: "ثبت هزینه" }).click();
    await expect(page.getByText("هزینهٔ ماهانه ثبت شد.")).toBeVisible();
    await expect(page.locator("[data-repeat]")).toContainText("فعال");
    await expect(page.locator("[data-expense]").filter({ hasText: "اجاره" })).toContainText("ماهانه");
    await expectNetProfit(page, 100);
  });

  await test.step("removing that month brings net profit back, and it is not made again", async () => {
    await page.goto("/finance/expenses");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^حذف اجاره/ }).click();
    await expect(page.locator("[data-expense]").filter({ hasText: "اجاره" })).toHaveCount(0);
    await page.reload();
    await expect(page.locator("[data-expense]").filter({ hasText: "اجاره" })).toHaveCount(0);
    await expect(page.locator("[data-repeat]")).toContainText("فعال");
    await expectNetProfit(page, 150);
  });

  await test.step("stopping the repeat, and editing the ads expense", async () => {
    await page.goto("/finance/expenses");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^توقف اجاره/ }).click();
    await expect(page.locator("[data-repeat]")).toContainText("متوقف");

    await page.getByRole("button", { name: /^ویرایش تبلیغات/ }).click();
    const sheet = page.getByRole("dialog", { name: "ویرایش هزینه" });
    await sheet.getByLabel("مبلغ (تومان)").fill("40000");
    await sheet.getByRole("button", { name: "ذخیره" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByText(`جمع: ${toman(40_000)}`)).toBeVisible();
    await expectNetProfit(page, 140);
  });
});
