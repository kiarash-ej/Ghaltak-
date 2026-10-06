import { expect, test } from "@playwright/test";
import pg from "pg";
import { createManualOrder, createProduct, faDigits, logIn, uniqueMobile } from "./helpers";

// The daily brief on Home (UI overhaul, spec §7.1): on the first visit of the
// Tehran day the owner sees yesterday's sales; × folds it into a one-line pill
// that stays folded for the rest of the day (a cookie), and a new day brings
// the full card back. An operator gets the brief without any money: not on
// screen and not in the page's data either. The store is set up through the
// real forms; only the order's date is moved to yesterday in the database.

// A price that can't appear by accident: 2 × 93,710 = 187,420 tomans.
const PRICE = 93_710;
const TOTAL = 2 * PRICE;

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

test("daily brief: yesterday's sales, folds to a pill, comes back the next day", async ({ page: seller, context, browser }) => {
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

    const variantId = await createProduct(seller, { name: productName, price: PRICE, stock: 5 });
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
    await expect(brief).toContainText(`دیروز ${faDigits(187)} هزار تومان فروختید.`);
    await expect(brief).toContainText(`${faDigits(1)} سفارش`);
    await expect(close).toBeVisible();
    await expect(pill).toBeHidden();
  });

  await test.step("× folds it into a pill, and it stays folded today", async () => {
    await close.click();
    await expect(pill).toBeVisible();
    await expect(pill).toContainText(`دیروز: ${faDigits(187)} هزار تومان فروش · ${faDigits(1)} سفارش`);
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

  await test.step("an operator gets the brief without money, not even in the page's data", async () => {
    const operatorMobile = uniqueMobile("0911");
    await seller.goto("/settings/team");
    await seller.getByLabel("شمارهٔ موبایل همکار").fill(operatorMobile);
    await seller.getByRole("button", { name: "افزودن" }).click();
    await expect(seller.getByText("همکار اضافه شد")).toBeVisible();

    const operatorContext = await browser.newContext({ locale: "fa-IR", timezoneId: "Asia/Tehran" });
    const operator = await operatorContext.newPage();
    await logIn(operator, operatorMobile);
    const operatorBrief = operator.getByRole("region", { name: "خلاصهٔ دیروز" });
    await expect(operatorBrief).toContainText(`دیروز ${faDigits(1)} سفارش ثبت شد.`);
    await expect(operatorBrief).not.toContainText("تومان");

    // Everything the server sends for Home: the HTML (with the client
    // components' props) and the data of an in-app navigation.
    const sent = async (page: typeof seller) => {
      const html = await (await page.request.get("/")).text();
      const rsc = await (await page.request.get("/", { headers: { RSC: "1" } })).text();
      return html + rsc;
    };
    const ownerSent = await sent(seller);
    const operatorSent = await sent(operator);
    // The check would catch a leak: the owner's data does carry the amounts.
    expect(ownerSent).toContain(String(TOTAL));
    expect(ownerSent).toContain(faDigits(187));
    for (const amount of [String(TOTAL), faDigits(TOTAL), faDigits(187)]) {
      expect(operatorSent, amount).not.toContain(amount);
    }
    await operatorContext.close();
  });
});
