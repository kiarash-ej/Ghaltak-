import { expect, test } from "@playwright/test";
import { E2E_BILLING_PORT } from "../playwright.config";
import { logIn, toman, uniqueMobile } from "./helpers";

// A9, subscriptions. The usual server has BILLING_ENABLED off (as production
// does until week 6); a second one has it on, with the pretend gateway as the
// platform's gateway (playwright.config.ts).

test("billing off: the plan and usage are shown, with no way to pay", async ({ page }) => {
  await logIn(page, uniqueMobile("0916"));
  await page.goto("/settings/billing");

  await expect(page.getByText("پلن فعلی: آزمایشی")).toBeVisible();
  await expect(page.getByText("دورهٔ آزمایشی", { exact: true })).toBeVisible();
  await expect(page.getByText("مصرف این ماه")).toBeVisible();
  await expect(page.getByText(`${toman(400_000)} در ماه`)).toBeVisible();
  await expect(page.getByText("پرداخت اشتراک هنوز فعال نشده است")).toBeVisible();
  await expect(page.getByRole("button", { name: /پرداخت|تمدید/ })).toHaveCount(0);
});

test.describe("billing on", () => {
  test.use({ baseURL: `http://localhost:${E2E_BILLING_PORT}` });

  test("a trial store cancels once at the gateway, then pays for PRO", async ({ page }) => {
    await logIn(page, uniqueMobile("0917"));
    await page.goto("/settings/billing");
    await expect(page.getByText("پلن فعلی: آزمایشی")).toBeVisible();

    const proCard = page.locator("div", { has: page.getByText(`${toman(2_200_000)} در ماه`) }).last();

    await test.step("cancel at the gateway: nothing changes", async () => {
      await proCard.getByRole("button", { name: "انتخاب و پرداخت" }).click();
      await expect(page.getByRole("heading", { name: "درگاه آزمایشی" })).toBeVisible();
      await expect(page.getByText(toman(2_200_000))).toBeVisible();
      await page.getByRole("link", { name: "انصراف از پرداخت" }).click();
      await expect(page.getByText("پرداخت لغو شد. چیزی تغییر نکرد.")).toBeVisible();
      await expect(page.getByText("پلن فعلی: آزمایشی")).toBeVisible();
    });

    await test.step("pay: PRO for a month, and the invoice is paid", async () => {
      await proCard.getByRole("button", { name: "انتخاب و پرداخت" }).click();
      await page.getByRole("link", { name: "پرداخت موفق" }).click();
      await expect(page.getByText("پرداخت انجام شد و اشتراک شما تمدید شد.")).toBeVisible();
      await expect(page.getByText("پلن فعلی: حرفه‌ای")).toBeVisible();
      await expect(page.getByText("پرداخت‌شده")).toHaveCount(1);
    });

    await test.step("the gateway's return opened again changes nothing", async () => {
      await page.goBack(); // the pretend gateway page is gone once paid: go back to its return instead
      await page.goto("/settings/billing");
      await expect(page.getByText("پرداخت‌شده")).toHaveCount(1);
    });
  });
});
