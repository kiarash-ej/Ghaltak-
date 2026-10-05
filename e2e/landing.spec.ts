import { devices, expect, test } from "@playwright/test";
import { setLoginCode, uniqueMobile } from "./helpers";

// The public landing page: a visitor without a session sees it at / (for the
// new sellers), with the «امکانات» and «راهنما»
// submenus. Anything that needs an account opens the login popup, and logging
// in there lands on the dashboard. Seller pages still send visitors to /login.

test("a visitor sees the landing page at / and logs in from its popup", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("همهٔ سفارش‌ها");
  await expect(page.getByRole("heading", { name: "ابزارهای کار روزانهٔ فروشگاهتان.", level: 2 })).toBeVisible();

  await test.step("the submenus open, close on Escape, and lead to the page's sections and the guide", async () => {
    const features = page.getByRole("button", { name: "امکانات" });
    await features.click();
    await expect(features).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: /پرداخت/ }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(features).toHaveAttribute("aria-expanded", "false");
    await expect(features).toBeFocused();

    await features.click();
    await page.getByRole("link", { name: /^ارسال/ }).click();
    await expect(page).toHaveURL(/#shipping$/);
    await expect(page.getByRole("heading", { name: "ارسال و پیگیری", level: 3 })).toBeInViewport();

    await page.getByRole("button", { name: "راهنما" }).click();
    await expect(page.getByRole("link", { name: "تأیید کارت‌به‌کارت" })).toHaveAttribute("href", "/help/card-to-card");
    await page.keyboard.press("Escape");
  });

  await test.step("«ساخت حساب» opens the login popup; logging in there opens the dashboard", async () => {
    const mobile = uniqueMobile("0917");
    const correctedMobile = uniqueMobile("0918");
    await page.getByRole("link", { name: "ساخت حساب", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "ورود یا ساخت حساب" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/(#shipping)?$/); // still on the landing page

    await dialog.getByLabel("شمارهٔ موبایل").fill(mobile);
    await dialog.getByRole("button", { name: "دریافت کد تأیید" }).click();
    await expect(dialog.getByLabel("کد تأیید")).toBeVisible();
    await dialog.getByRole("button", { name: "تغییر شماره یا دریافت کد جدید" }).click();
    await expect(dialog.getByLabel("شمارهٔ موبایل")).toBeVisible();
    await dialog.getByLabel("شمارهٔ موبایل").fill(correctedMobile);
    await dialog.getByRole("button", { name: "دریافت کد تأیید" }).click();
    await expect(dialog.getByLabel("کد تأیید")).toBeVisible();
    await setLoginCode(correctedMobile, "135790");
    await dialog.getByLabel("کد تأیید").fill("135790");
    await dialog.getByRole("button", { name: "ورود" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "خروج" })).toBeVisible(); // the dashboard's sidebar
    await expect(page.getByRole("heading", { name: "امکانات", level: 2 })).toHaveCount(0);
  });

  await test.step("a signed-in seller on a public page gets «ورود به داشبورد» instead of the login buttons", async () => {
    await page.goto("/welcome");
    const toDashboard = page.getByRole("link", { name: "ورود به داشبورد" });
    await expect(toDashboard.first()).toBeVisible();
    for (const href of await toDashboard.evaluateAll((els) => els.map((a) => a.getAttribute("href")))) {
      expect(href).toBe("/");
    }
    await expect(page.getByRole("link", { name: /ساخت حساب/ })).toHaveCount(0);
  });
});

test("the popup closes, and seller pages still send a visitor to /login", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "ساخت حساب", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "ورود یا ساخت حساب" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "بستن" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/orders");
  await expect(page).toHaveURL(/\/login$/);
});

test("on a phone: one «منو» button with every group, and no sideways scrolling", async ({ browser }) => {
  const context = await browser.newContext({ ...devices["Pixel 7"], locale: "fa-IR" });
  const phone = await context.newPage();
  for (const url of ["/", "/help", "/help/sms", "/privacy"]) {
    await phone.goto(url);
    expect(await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), url).toBeLessThanOrEqual(0);
  }

  await phone.goto("/");
  await phone.getByRole("button", { name: "منو" }).click();
  await expect(phone.getByRole("link", { name: "حریم خصوصی" }).first()).toBeVisible();
  await phone.getByRole("link", { name: /^همکاری با تیم/ }).click();
  await expect(phone).toHaveURL(/#team$/);
  await expect(phone.getByRole("button", { name: "منو" })).toHaveAttribute("aria-expanded", "false");
  await phone.getByRole("button", { name: "منو" }).click();
  await phone.getByRole("link", { name: "پیامک‌های غلتک" }).click();
  await expect(phone).toHaveURL(/\/help\/sms$/);
  await expect(phone.getByRole("heading", { level: 1, name: "پیامک‌های غلتک" })).toBeVisible();
  await context.close();
});

test("the FAQ works with a keyboard and SMS information is available under the guide", async ({ page }) => {
  await page.goto("/");
  const question = page.locator("summary").filter({ hasText: "مشتری برای خرید باید حساب بسازد؟" });
  const answer = page.getByText("خیر. مشتری لینک خرید را باز می‌کند، محصول را انتخاب می‌کند، مشخصات ارسال را می‌نویسد و سفارش می‌دهد.", { exact: false });
  await expect(answer).toBeHidden();
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(answer).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(answer).toBeHidden();

  // No standalone SMS tab or old anchor; the public reference is in Help.
  await expect(page.locator('header a[href$="#sms"]')).toHaveCount(0);
  await expect(page.locator('header a[href="/help/sms"]')).toHaveCount(0);
  await page.getByRole("button", { name: "راهنما", exact: true }).click();
  await page.getByRole("link", { name: "پیامک‌های غلتک" }).click();
  await expect(page).toHaveURL(/\/help\/sms$/);
  await expect(page.getByRole("heading", { name: "کد ورود", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "یادآوری تمدید اشتراک", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "تنظیم پیامک‌های مشتریان", exact: true })).toBeVisible();
});
