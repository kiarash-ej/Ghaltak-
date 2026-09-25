import { devices, expect, test, type Page } from "@playwright/test";
import { createManualOrder, createProduct, faDigits, logIn, toman, uniqueMobile } from "./helpers";

// C5: a brand-new seller sees the «شروع کار» checklist on the dashboard home,
// each step ticks as they do it, and the checklist disappears when all five
// are done. Then the public guide opens on a phone without logging in.

const STEPS = {
  store: "اطلاعات فروشگاه را کامل کنید",
  product: "اولین محصول را بسازید",
  card: "شمارهٔ کارت را ثبت کنید",
  link: "اولین لینک خرید را بسازید",
  order: "اولین سفارش را ثبت کنید",
};

const step = (page: Page, title: string) => page.getByRole("listitem").filter({ hasText: title });

async function expectDone(page: Page, done: (keyof typeof STEPS)[]) {
  await page.goto("/");
  await expect(page.getByText(`${faDigits(done.length)} از ${faDigits(5)} مرحله انجام شده`, { exact: false })).toBeVisible();
  for (const [key, title] of Object.entries(STEPS)) {
    await expect(step(page, title)).toContainText(done.includes(key as keyof typeof STEPS) ? "انجام شد" : "انجام نشده");
  }
}

test("a new seller's start checklist ticks step by step, then hides", async ({ page: seller, browser }) => {
  const sellerMobile = uniqueMobile("0915");
  const productName = `محصول شروع ${sellerMobile.slice(-5)}`;
  await logIn(seller, sellerMobile);

  await test.step("a new seller sees all five steps undone, each linking to its page", async () => {
    await expectDone(seller, []);
    await expect(step(seller, STEPS.card).getByRole("link")).toHaveAttribute("href", "/settings/payments");
    // The summary is there from day one, all zeros.
    await expect(seller.getByRole("heading", { name: "خلاصهٔ امروز" })).toBeVisible();
  });

  await test.step("1. store details: a name alone is not enough, a contact completes it", async () => {
    await step(seller, STEPS.store).getByRole("link").click();
    await expect(seller).toHaveURL(/\/settings$/);
    await seller.getByLabel("نام فروشگاه").fill("بوتیک شروع");
    await seller.getByRole("button", { name: "ذخیرهٔ تغییرات" }).click();
    await expect(seller.getByText("تغییرات ذخیره شد.")).toBeVisible();
    await expectDone(seller, []);

    await seller.goto("/settings");
    await seller.getByLabel("آیدی اینستاگرام").fill("boutique.start");
    await seller.getByRole("button", { name: "ذخیرهٔ تغییرات" }).click();
    await expect(seller.getByText("تغییرات ذخیره شد.")).toBeVisible();
    await expectDone(seller, ["store"]);
  });

  let variantId = "";
  await test.step("2. first product", async () => {
    // Stock 3 is at the default threshold, so it also shows as needing restock.
    variantId = await createProduct(seller, { name: productName, price: 90_000, stock: 3 });
    await expectDone(seller, ["store", "product"]);
  });

  await test.step("3. card number", async () => {
    await seller.goto("/settings/payments");
    await seller.getByLabel("شمارهٔ کارت", { exact: true }).fill("6037991234567893");
    await seller.getByLabel("نام صاحب کارت").fill("فروشندهٔ آزمایشی");
    await seller.getByRole("button", { name: "ذخیرهٔ اطلاعات کارت" }).click();
    await expect(seller.getByText("ذخیره شد.")).toBeVisible();
    await expectDone(seller, ["store", "product", "card"]);
    // Only whether a card exists is checked: the number never reaches the page.
    expect(await seller.content()).not.toContain("6037991234567893");
  });

  await test.step("4. first purchase link", async () => {
    await seller.goto("/orders/links");
    await seller.getByLabel(productName).check();
    await seller.getByRole("button", { name: "ساخت لینک خرید" }).click();
    await expect(seller.getByText("لینک ساخته شد.")).toBeVisible();
    await expectDone(seller, ["store", "product", "card", "link"]);
  });

  await test.step("5. first order: the checklist disappears and today's summary counts it", async () => {
    await createManualOrder(seller, {
      variantId,
      quantity: 1,
      customerName: "مشتری شروع",
      customerPhone: uniqueMobile("0939"),
    });
    await seller.goto("/");
    await expect(seller.getByRole("heading", { name: "خلاصهٔ امروز" })).toBeVisible();
    await expect(seller.getByText("شروع کار", { exact: true })).toHaveCount(0);
    for (const title of Object.values(STEPS)) await expect(step(seller, title)).toHaveCount(0);

    const tile = (label: string) => seller.getByRole("link").filter({ hasText: label });
    await expect(tile("سفارش‌های امروز")).toContainText(faDigits(1));
    // A manual order awaits payment: not a sale yet, no receipt yet.
    await expect(tile("سفارش‌های امروز")).toContainText(`فروش امروز: ${toman(0)}`);
    await expect(tile("رسیدهای منتظر بررسی")).toContainText(faDigits(0));
    // 3 in stock, 1 ordered: 2 left, at or below the threshold of 3.
    await expect(tile("نیاز به تأمین")).toContainText(faDigits(1));
    await expect(tile("نیاز به تأمین")).toHaveAttribute("href", "/inventory?filter=low");
  });

  await test.step("the guide opens on a phone without logging in", async () => {
    const context = await browser.newContext({ ...devices["Pixel 7"], locale: "fa-IR", timezoneId: "Asia/Tehran" });
    const phone = await context.newPage();

    await phone.goto("/help");
    await expect(phone).toHaveURL(/\/help$/);
    await expect(phone.getByRole("heading", { name: "راهنمای غلتک" })).toBeVisible();
    await expect(phone.getByRole("heading", { name: "پرسش‌های پرتکرار" })).toBeVisible();

    await phone.getByRole("link", { name: /^تأیید کارت‌به‌کارت/ }).click();
    await expect(phone).toHaveURL(/\/help\/card-to-card$/);
    await expect(phone.getByRole("heading", { level: 1, name: "تأیید کارت‌به‌کارت" })).toBeVisible();

    // Every screenshot loads (from our own server) and nothing scrolls sideways.
    const images = phone.locator("article img");
    expect(await images.count()).toBeGreaterThan(0);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveJSProperty("complete", true);
      expect(await image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    }
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    expect((await phone.goto("/help/no-such-guide"))?.status()).toBe(404);
    await context.close();
  });
});
