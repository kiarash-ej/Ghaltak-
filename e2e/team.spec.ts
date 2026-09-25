import { expect, test } from "@playwright/test";
import { createManualOrder, createProduct, logIn, uniqueMobile } from "./helpers";

// A10, team members. The owner invites an operator; the operator signs in with
// their own mobile, works on orders, sees no money totals and no owner pages;
// the owner removes them and their next request goes to the login page.

test("owner invites an operator, the operator works, then is removed", async ({ page: owner, browser }) => {
  const ownerMobile = uniqueMobile("0918");
  const operatorMobile = `0919${String(Date.now() + 7).slice(-7)}`;
  await logIn(owner, ownerMobile);

  const variantId = await createProduct(owner, {
    name: `محصول تیم ${ownerMobile.slice(-5)}`,
    price: 250_000,
    stock: 5,
  });

  await test.step("the owner invites the operator", async () => {
    await owner.goto("/settings/team");
    await owner.getByLabel("شمارهٔ موبایل عضو جدید").fill(operatorMobile);
    await owner.getByRole("button", { name: "افزودن" }).click();
    await expect(owner.getByText("عضو اضافه شد")).toBeVisible();
    await expect(owner.getByText(operatorMobile)).toBeVisible();
    await expect(owner.getByText("اپراتور", { exact: true })).toBeVisible();
  });

  const operatorContext = await browser.newContext({ locale: "fa-IR", timezoneId: "Asia/Tehran" });
  const operator = await operatorContext.newPage();

  await test.step("the operator signs into the owner's store, not a new one", async () => {
    await logIn(operator, operatorMobile);
    await expect(operator.getByRole("heading", { name: /خوش آمدید/ })).toBeVisible();
    // An owner's-only setup checklist and today's sales in tomans are not shown.
    await expect(operator.getByText(/فروش امروز:/)).toHaveCount(0);
  });

  await test.step("the operator enters an order", async () => {
    await createManualOrder(operator, {
      variantId,
      quantity: 1,
      customerName: "مشتری اپراتور",
      customerPhone: uniqueMobile("0935"),
    });
  });

  await test.step("the operator sees sales as counts, without tomans", async () => {
    await operator.goto("/reports");
    await expect(operator.getByText("فروش این ماه")).toBeVisible();
    await expect(operator.getByText("فروش روزانه")).toHaveCount(0);
    await expect(operator.locator("main").getByText(/تومان/)).toHaveCount(0);
  });

  await test.step("owner pages are a 404 for the operator; «تنظیمات» opens their devices", async () => {
    for (const url of ["/settings/billing", "/settings/team", "/settings/payments"]) {
      const res = await operator.goto(url);
      expect(res?.status(), url).toBe(404);
    }
    await operator.goto("/");
    await operator.getByRole("link", { name: "تنظیمات" }).click();
    await expect(operator).toHaveURL(/\/settings\/devices$/);
    await expect(operator.getByText("همین دستگاه")).toBeVisible();
    await expect(operator.getByRole("link", { name: "اشتراک" })).toHaveCount(0);
  });

  await test.step("the owner removes the operator: their next request goes to login", async () => {
    await owner.goto("/settings/team");
    await owner.getByRole("button", { name: "حذف عضو" }).click();
    await expect(owner.getByText(operatorMobile)).toHaveCount(0);

    await operator.goto("/orders");
    await expect(operator).toHaveURL(/\/login$/);
  });

  await operatorContext.close();
});
