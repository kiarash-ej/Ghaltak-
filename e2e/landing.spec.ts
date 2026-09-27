import { devices, expect, test } from "@playwright/test";
import { setLoginCode, uniqueMobile } from "./helpers";

// The public landing page: a visitor without a session sees it at / (for the
// SMS providers' review and for new sellers), with the «امکانات» and «راهنما»
// submenus. Anything that needs an account opens the login popup, and logging
// in there lands on the dashboard. Seller pages still send visitors to /login.

test("a visitor sees the landing page at / and logs in from its popup", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("فروش اینستاگرامی و تلگرامی");
  await expect(page.getByRole("heading", { name: "امکانات", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "پیامک‌هایی که غلتک می‌فرستد" })).toBeVisible();

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
    await expect(page.getByRole("heading", { name: "ارسال", level: 3 })).toBeInViewport();

    await page.getByRole("button", { name: "راهنما" }).click();
    await expect(page.getByRole("link", { name: "تأیید کارت‌به‌کارت" })).toHaveAttribute("href", "/help/card-to-card");
    await page.keyboard.press("Escape");
  });

  await test.step("«شروع کنید» opens the login popup; logging in there opens the dashboard", async () => {
    const mobile = uniqueMobile("0917");
    await page.getByRole("link", { name: "شروع کنید" }).first().click();
    const dialog = page.getByRole("dialog", { name: "ورود یا ساخت حساب" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/(#shipping)?$/); // still on the landing page

    await dialog.getByLabel("شمارهٔ موبایل").fill(mobile);
    await dialog.getByRole("button", { name: "دریافت کد تأیید" }).click();
    await expect(dialog.getByLabel("کد تأیید")).toBeVisible();
    await setLoginCode(mobile, "135790");
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
    await expect(page.getByRole("link", { name: /شروع کنید|ورود یا ساخت حساب/ })).toHaveCount(0);
  });
});

test("the popup closes, and seller pages still send a visitor to /login", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "شروع کنید" }).first().click();
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
  for (const url of ["/", "/help", "/privacy"]) {
    await phone.goto(url);
    expect(await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), url).toBeLessThanOrEqual(0);
  }

  await phone.goto("/");
  await phone.getByRole("button", { name: "منو" }).click();
  await expect(phone.getByRole("link", { name: "حریم خصوصی" }).first()).toBeVisible();
  await phone.getByRole("link", { name: /^تیم/ }).click();
  await expect(phone).toHaveURL(/#team$/);
  await expect(phone.getByRole("button", { name: "منو" })).toHaveAttribute("aria-expanded", "false");
  await context.close();
});
