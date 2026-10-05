import { expect, test } from "@playwright/test";
import pg from "pg";
import { createManualOrder, createProduct, faDigits, logIn, uniqueMobile } from "./helpers";

// The daily brief on Home (UI overhaul, spec §7.1): on the first visit of the
// Tehran day the owner sees yesterday's sales; × folds it into a one-line pill
// that stays folded for the rest of the day (a cookie), and a new day brings
// the full card back. The store is set up through the real forms; only the
// order's date is moved to yesterday in the database.

async function moveToYesterday(orderId: string) {
  const client = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL });
  await client.connect();
  try {
    // Noon yesterday, Tehran time; delivered, so it counts as a sale.
    await client.query(
      `UPDATE "Order"
       SET "createdAt" = ((date_trunc('day', now() AT TIME ZONE 'Asia/Tehran') - interval '12 hours') AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'UTC',
           status = 'DELIVERED', "paidAt" = now(), "paymentMethod" = 'CARD_TO_CARD'
       WHERE id = $1`,
      [orderId],
    );
  } finally {
    await client.end();
  }
}

test("daily brief: yesterday's sales, folds to a pill, comes back the next day", async ({ page: seller, context }) => {
  const mobile = uniqueMobile("0917");
  const productName = `محصول خلاصه ${mobile.slice(-5)}`;
  await logIn(seller, mobile);

  await test.step("the store is set up (the start checklist comes first until then)", async () => {
    await seller.goto("/settings");
    await seller.getByLabel("نام فروشگاه").fill("بوتیک خلاصه");
    await seller.getByLabel("آیدی اینستاگرام").fill("brief.shop");
    await seller.getByRole("button", { name: "ذخیرهٔ تغییرات" }).click();
    await expect(seller.getByText("تغییرات ذخیره شد.")).toBeVisible();

    await seller.goto("/settings/payments");
    await seller.getByLabel("شمارهٔ کارت", { exact: true }).fill("6037991234567893");
    await seller.getByLabel("نام صاحب کارت").fill("فروشندهٔ آزمایشی");
    await seller.getByRole("button", { name: "ذخیرهٔ اطلاعات کارت" }).click();
    await expect(seller.getByText("ذخیره شد.")).toBeVisible();

    const variantId = await createProduct(seller, { name: productName, price: 90_000, stock: 5 });
    await seller.goto("/orders/links");
    await seller.getByLabel(productName).check();
    await seller.getByRole("button", { name: "ساخت لینک خرید" }).click();
    await expect(seller.getByText("لینک ساخته شد.")).toBeVisible();

    const order = await createManualOrder(seller, {
      variantId,
      quantity: 2,
      customerName: "مشتری دیروز",
      customerPhone: uniqueMobile("0938"),
    });
    await moveToYesterday(order.id);
  });

  const brief = seller.getByRole("region", { name: "خلاصهٔ دیروز" });
  const close = brief.getByRole("button", { name: "بستن خلاصهٔ دیروز" });
  const pill = brief.getByRole("button", { name: /^دیروز:/ });

  await test.step("the first visit of the day shows yesterday in full", async () => {
    await seller.goto("/");
    // 2 × 90,000 = 180,000 tomans.
    await expect(brief).toContainText(`دیروز ${faDigits(180)} هزار تومان فروختید.`);
    await expect(brief).toContainText(`${faDigits(1)} سفارش`);
    await expect(close).toBeVisible();
    await expect(pill).toBeHidden();
  });

  await test.step("× folds it into a pill, and it stays folded today", async () => {
    await close.click();
    await expect(pill).toBeVisible();
    await expect(pill).toContainText(`دیروز: ${faDigits(180)} هزار تومان فروش · ${faDigits(1)} سفارش`);
    await expect(close).toBeHidden();

    await seller.reload();
    await expect(pill).toBeVisible();
    await expect(close).toBeHidden();

    // The pill opens it again (without forgetting it was folded today).
    await pill.click();
    await expect(close).toBeVisible();
  });

  await test.step("a new day brings the full card back", async () => {
    const [cookie] = (await context.cookies()).filter((c) => c.name === "gk_brief");
    expect(cookie?.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await context.addCookies([{ ...cookie, value: "2000-01-01" }]);
    await seller.reload();
    await expect(close).toBeVisible();
    await expect(pill).toBeHidden();
  });
});
