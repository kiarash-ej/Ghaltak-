import { expect, test } from "@playwright/test";
import { createManualOrder, faDigits, logIn, toman, uniqueMobile } from "./helpers";

// Finance overview (spec §6.4). The owner sells one product with a cost price
// and sees sales, net profit and margin worked out from it; an operator sees
// counts only, and no amount reaches their browser at all.

const PRICE = 210_000;
const COST = 84_000; // profit 126,000 per sale: a 60% margin

test("finance overview: profit from cost prices; operators get counts only", async ({ page: owner, browser }) => {
  const mobile = uniqueMobile("0916");
  const productName = `محصول مالی ${mobile.slice(-5)}`;
  await logIn(owner, mobile);

  await test.step("a sale of a product with a cost price", async () => {
    await owner.goto("/products/new");
    await owner.getByLabel("نام محصول").fill(productName);
    await owner.getByLabel("قیمت (تومان)").fill(String(PRICE));
    await owner.getByLabel("قیمت خرید (تومان، اختیاری)").fill(String(COST));
    await owner.locator("#color-0").fill("مشکی");
    await owner.locator("#size-0").fill("M");
    await owner.locator("#stock-0").fill("5");
    await owner.getByRole("button", { name: "ثبت محصول" }).click();
    await expect(owner).toHaveURL(/\/products$/);

    await owner.goto(`/inventory?q=${encodeURIComponent(productName)}`);
    const href = await owner.getByRole("listitem").filter({ hasText: productName }).locator('a[href^="/inventory/"]').first().getAttribute("href");
    const order = await createManualOrder(owner, {
      variantId: href!.split("/").pop()!,
      quantity: 1,
      customerName: "مشتری مالی",
      customerPhone: uniqueMobile("0937"),
    });
    await owner.goto(`/orders/${order.id}`);
    await owner.getByRole("button", { name: "تأیید پرداخت" }).click();
    await expect(owner.getByText("کارت‌به‌کارت", { exact: true })).toBeVisible();
  });

  await test.step("the owner sees sales, net profit and margin from it", async () => {
    await owner.goto("/finance");
    await expect(owner.getByRole("heading", { level: 1, name: "مالی و گزارش" })).toBeVisible();
    const stat = (label: string) => owner.getByRole("group", { name: label, exact: true });
    await expect(stat("فروش")).toContainText(`${faDigits(210)}`);
    await expect(stat("سود خالص")).toContainText(`${faDigits(126)}`);
    await expect(stat("حاشیهٔ سود")).toContainText(`${faDigits(60)}٪`);
    await expect(owner.getByText(toman(PRICE - COST)).first()).toBeVisible(); // the breakdown's net profit
    // Every sale has a cost: no «based on X% of sales» warning.
    await expect(owner.getByText(/فقط .* فروش‌های این بازه قیمت خرید دارند/)).toHaveCount(0);
  });

  await test.step("a bad custom date is explained, not guessed", async () => {
    await owner.goto("/finance?period=custom&from=1405/07/40&to=1405/07/10");
    await expect(owner.getByRole("alert")).toContainText("تاریخ «از» درست نیست");
  });

  await test.step("an operator sees counts, and no amount reaches their browser", async () => {
    const operatorMobile = uniqueMobile("0918");
    await owner.goto("/settings/team");
    await owner.getByLabel("شمارهٔ موبایل همکار").fill(operatorMobile);
    await owner.getByRole("button", { name: "افزودن" }).click();
    await expect(owner.getByText("همکار اضافه شد")).toBeVisible();

    const context = await browser.newContext({ locale: "fa-IR", timezoneId: "Asia/Tehran" });
    const operator = await context.newPage();
    await logIn(operator, operatorMobile);
    await operator.goto("/finance");
    await expect(operator.getByText("سفارش‌های پرداخت‌شده", { exact: true })).toBeVisible();
    await expect(operator.locator("main").getByText(/تومان/)).toHaveCount(0);

    const sent = async (page: typeof owner) =>
      (await (await page.request.get("/finance")).text()) + (await (await page.request.get("/finance", { headers: { RSC: "1" } })).text());
    const ownerSent = await sent(owner);
    const operatorSent = await sent(operator);
    expect(ownerSent).toContain(faDigits(210)); // so the check below could fail
    expect(ownerSent).toContain("پیشنهادهای غلتک");
    for (const leak of [String(PRICE), String(PRICE - COST), faDigits(210), faDigits(126), "تومان", "پیشنهادهای غلتک", "data-insight"]) {
      expect(operatorSent, leak).not.toContain(leak);
    }
    await context.close();
  });
});
