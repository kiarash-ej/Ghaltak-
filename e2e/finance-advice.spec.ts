import { expect, test } from "@playwright/test";
import { createManualOrder, createProduct, logIn, uniqueMobile } from "./helpers";

// «پیشنهادهای غلتک» (spec §6.5) on real sales. One product sells with almost
// no margin (cost 200,000 of 210,000), another has no cost at all: missing
// costs is pinned first, the thin margin comes next with what a 10% price
// rise would bring, and its action opens that product.

test("finance advice: missing costs pinned first, then a thin-margin best seller", async ({ page }) => {
  const mobile = uniqueMobile("0919");
  await logIn(page, mobile);
  const thin = `کم‌سود ${mobile.slice(-5)}`;
  const noCost = `بی‌قیمت ${mobile.slice(-5)}`;

  for (const p of [
    { name: thin, price: 210_000, cost: 200_000 },
    { name: noCost, price: 100_000 },
  ]) {
    const variantId = await createProduct(page, { ...p, stock: 5 });
    const order = await createManualOrder(page, { variantId, quantity: 1, customerName: "مشتری", customerPhone: uniqueMobile("0938") });
    await page.goto(`/orders/${order.id}`);
    await page.getByRole("button", { name: "تأیید پرداخت" }).click();
    await expect(page.getByText("کارت‌به‌کارت", { exact: true })).toBeVisible();
  }

  await page.goto("/finance");
  const advice = page.locator("[data-insight]");
  await expect(advice.first()).toHaveAttribute("data-insight", "missing-costs");
  // 210,000 of 310,000 in sales has a cost.
  await expect(advice.first()).toContainText("فقط ۶۸٪ فروش‌های این بازه قیمت خرید دارند؛ ۱ محصول فروش‌رفته قیمت خرید ندارد");

  const margin = page.locator('[data-insight="thin-margin"]');
  await expect(margin).toContainText(`«${thin}» پرفروش است ولی کم‌سود`);
  await expect(margin).toContainText("فقط ۵٪ سود ناخالص");
  await expect(margin).toContainText("حدود ۲۱ هزار تومان");
  await margin.getByRole("link", { name: "قیمت این محصول ←" }).click();
  await expect(page).toHaveURL(/\/products\/[a-z0-9]+\/edit$/);
  await expect(page.getByLabel("نام محصول")).toHaveValue(thin);
});
