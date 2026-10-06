import { expect, test } from "@playwright/test";
import pg from "pg";
import { createManualOrder, logIn, toman, uniqueMobile } from "./helpers";

// Cost price (finance spec §6.1). The owner enters what a product costs and
// sees the profit per sale as they type; an order copies the cost onto its
// line. An operator manages the same product without ever seeing the cost:
// no field, nothing in the page's data, and their save leaves it alone.

// Distinctive numbers, so a match can't be an accident.
const PRICE = 148_000;
const COST = 61_370;

async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  const client = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

test("cost price: the owner's only, copied onto orders", async ({ page: owner, browser }) => {
  const mobile = uniqueMobile("0912");
  const productName = `محصول هزینه ${mobile.slice(-5)}`;
  await logIn(owner, mobile);

  let productId = "";
  let variantId = "";
  await test.step("the owner enters a cost and sees the profit per sale", async () => {
    await owner.goto("/products/new");
    await owner.getByLabel("نام محصول").fill(productName);
    await owner.getByLabel("قیمت (تومان)").fill(String(PRICE));
    await owner.getByLabel("قیمت خرید (تومان، اختیاری)").fill(String(COST));
    // 148,000 − 61,370 = 86,630 tomans, 59% of the price.
    await expect(owner.getByText(`سود هر فروش: ${toman(PRICE - COST)}`)).toBeVisible();
    await owner.locator("#color-0").fill("مشکی");
    await owner.locator("#size-0").fill("M");
    await owner.locator("#stock-0").fill("5");
    await owner.getByRole("button", { name: "ثبت محصول" }).click();
    await expect(owner).toHaveURL(/\/products$/);

    const [row] = await query<{ id: string; costPrice: number; variantId: string }>(
      `SELECT p.id, p."costPrice", v.id AS "variantId" FROM "Product" p JOIN "ProductVariant" v ON v."productId" = p.id WHERE p.name = $1`,
      [productName],
    );
    expect(row.costPrice).toBe(COST);
    productId = row.id;
    variantId = row.variantId;
  });

  await test.step("an order copies the cost onto its line", async () => {
    const order = await createManualOrder(owner, {
      variantId,
      quantity: 1,
      customerName: "مشتری هزینه",
      customerPhone: uniqueMobile("0935"),
    });
    const [line] = await query<{ unitCost: number }>(`SELECT "unitCost" FROM "OrderItem" WHERE "orderId" = $1`, [order.id]);
    expect(line.unitCost).toBe(COST);
  });

  await test.step("an operator edits the product without ever getting the cost", async () => {
    const operatorMobile = uniqueMobile("0913");
    await owner.goto("/settings/team");
    await owner.getByLabel("شمارهٔ موبایل همکار").fill(operatorMobile);
    await owner.getByRole("button", { name: "افزودن" }).click();
    await expect(owner.getByText("همکار اضافه شد")).toBeVisible();

    const context = await browser.newContext({ locale: "fa-IR", timezoneId: "Asia/Tehran" });
    const operator = await context.newPage();
    await logIn(operator, operatorMobile);
    await operator.goto(`/products/${productId}/edit`);
    await expect(operator.getByLabel("نام محصول")).toHaveValue(productName);
    await expect(operator.getByLabel("قیمت خرید (تومان، اختیاری)")).toHaveCount(0);

    // Not in the page's data either (the form is a client component).
    const html = await (await operator.request.get(`/products/${productId}/edit`)).text();
    expect(html).not.toContain(String(COST));
    const ownerHtml = await (await owner.request.get(`/products/${productId}/edit`)).text();
    expect(ownerHtml).toContain(String(COST)); // so the check above could fail

    // The operator's save keeps the owner's cost.
    await operator.getByLabel("نام محصول").fill(`${productName} (ویرایش)`);
    await operator.getByRole("button", { name: "ذخیرهٔ تغییرات" }).click();
    await expect(operator).toHaveURL(/\/products$/);
    const [after] = await query<{ costPrice: number; name: string }>(`SELECT "costPrice", name FROM "Product" WHERE id = $1`, [productId]);
    expect(after).toEqual({ costPrice: COST, name: `${productName} (ویرایش)` });
    await context.close();
  });
});
