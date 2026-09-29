import { expect, test } from "@playwright/test";

const themeButton = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "حالت تیره", exact: true });

test("the saved palette is applied before the app JavaScript loads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("ghaltak-public-theme", "dark"));
  await page.route("**/_next/static/**/*.js*", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("main")).toHaveCSS("background-color", "rgb(14, 23, 38)");
});

test("public theme follows the device and remembers a keyboard selection across pages", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main")).toHaveCSS("background-color", "rgb(14, 23, 38)");
  await themeButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("main")).toHaveCSS("background-color", "rgb(255, 250, 247)");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ghaltak-public-theme"))).toBe("light");

  await page.getByRole("link", { name: "همهٔ راهنماها", exact: true }).click();
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "false");
  await page.goto("/login");
  await themeButton(page).click();
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "بازگشت به صفحهٔ اصلی" }).click();
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "ساخت حساب", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toHaveCSS("background-color", "rgb(23, 36, 55)");
});

test("system changes apply until an explicit preference is chosen, including on phones", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/help/sms");
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "false");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "true");
  await themeButton(page).click();
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "false");
  const bounds = await themeButton(page).boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test("the toggle works when browser storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "true");
  await themeButton(page).click();
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "false");
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(themeButton(page)).toHaveAttribute("aria-pressed", "false");
});
