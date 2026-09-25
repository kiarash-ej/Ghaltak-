import { readFile } from "node:fs/promises";
import { devices, expect, test, type Locator, type Page } from "@playwright/test";
import { createManualOrder, createProduct, logIn, uniqueMobile } from "./helpers";

// C6: the store owner downloads products, customers and orders as CSV from
// «تنظیمات» ← «خروجی داده». Files start with a UTF-8 BOM (Persian in Excel),
// a customer name that looks like a formula stays text, and the orders file
// follows the Jalali date and status filter. An operator gets a 404 instead.
// Then /privacy opens on a phone.

async function download(page: Page, trigger: Locator) {
  const [file] = await Promise.all([page.waitForEvent("download"), trigger.click()]);
  const bytes = await readFile((await file.path())!);
  return { name: file.suggestedFilename(), bytes, text: bytes.toString("utf8") };
}

/** Today in Tehran as "1405/07/04". */
function jalaliToday() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}/${parts.month}/${parts.day}`;
}

test("data export: three CSV files for the owner, safe in Excel; the privacy page", async ({ page: seller, browser }) => {
  const sellerMobile = uniqueMobile("0916");
  const productName = `محصول خروجی ${sellerMobile.slice(-5)}`;
  const customerPhone = uniqueMobile("0934");
  await logIn(seller, sellerMobile);

  const variantId = await createProduct(seller, { name: productName, price: 150_000, stock: 4 });
  const order = await createManualOrder(seller, {
    variantId,
    quantity: 1,
    customerName: "=2+3 مشتری",
    customerPhone,
  });

  await seller.goto("/settings");
  await seller.getByRole("link", { name: "خروجی داده" }).click();
  await expect(seller).toHaveURL(/\/settings\/data$/);

  await test.step("products: BOM, header, and the stock the inventory page shows", async () => {
    const file = await download(seller, seller.getByRole("link", { name: "دریافت فایل محصولات" }));
    expect(file.name).toMatch(/^ghaltak-products-\d{4}-\d{2}-\d{2}\.csv$/);
    expect([...file.bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(file.text).toContain("نام محصول,دسته‌بندی,قیمت (تومان),فعال,رنگ,سایز,کد کالا,موجودی");
    // 4 in stock, 1 ordered: 3, at the default threshold of 3.
    expect(file.text).toContain(`${productName},,150000,بله,مشکی,M,,3,3,کم‌موجودی\r\n`);
  });

  await test.step("customers: a formula-looking name stays text; the mobile keeps its zero", async () => {
    const file = await download(seller, seller.getByRole("link", { name: "دریافت فایل مشتریان" }));
    const phone = `${customerPhone.slice(0, 4)} ${customerPhone.slice(4, 7)} ${customerPhone.slice(7)}`;
    expect(file.text).toContain(`'=2+3 مشتری,${phone},`);
    expect(file.text).not.toMatch(/(^|,)=2\+3/m);
  });

  await test.step("orders: today's date and «در انتظار پرداخت» include the order", async () => {
    await seller.getByLabel("از تاریخ").fill(jalaliToday());
    await seller.getByLabel("تا تاریخ (خود این روز هم می‌آید)").fill(jalaliToday());
    await seller.getByLabel("وضعیت").selectOption({ label: "در انتظار پرداخت" });
    const file = await download(seller, seller.getByRole("button", { name: "دریافت فایل سفارش‌ها" }));
    expect(file.text).toContain(`${order.code},${jalaliToday()},`);
    expect(file.text).toContain(",در انتظار پرداخت,خیر,دستی,'=2+3 مشتری,");
    expect(file.text).toContain(`${productName} (مشکی / M) × 1`);
  });

  await test.step("orders: another status leaves it out; a bad date is explained", async () => {
    await seller.goto("/settings/data");
    await seller.getByLabel("وضعیت").selectOption({ label: "لغوشده" });
    const file = await download(seller, seller.getByRole("button", { name: "دریافت فایل سفارش‌ها" }));
    expect(file.text).not.toContain(order.code);

    await seller.getByLabel("از تاریخ").fill("1405/13/01");
    await seller.getByRole("button", { name: "دریافت فایل سفارش‌ها" }).click();
    await expect(seller.getByRole("alert")).toContainText("تاریخ «از» درست نیست");
  });

  await test.step("an operator (A10) can't export: 404 on the page and on a direct download", async () => {
    const operatorMobile = `0917${String(Date.now() + 11).slice(-7)}`;
    await seller.goto("/settings/team");
    await seller.getByLabel("شمارهٔ موبایل عضو جدید").fill(operatorMobile);
    await seller.getByRole("button", { name: "افزودن" }).click();
    await expect(seller.getByText("عضو اضافه شد")).toBeVisible();

    const context = await browser.newContext({ locale: "fa-IR", timezoneId: "Asia/Tehran" });
    const operator = await context.newPage();
    await logIn(operator, operatorMobile);
    expect((await operator.goto("/settings/data"))?.status()).toBe(404);
    // The downloads, fetched with the operator's own session cookie.
    for (const kind of ["products", "customers", "orders"]) {
      const res = await context.request.get(`/settings/data/export/${kind}`, { maxRedirects: 0 });
      expect(res.status(), kind).toBe(404);
      expect(await res.text(), kind).not.toContain("نام محصول");
    }
    await operator.goto("/settings/devices");
    await expect(operator.getByRole("link", { name: "خروجی داده" })).toHaveCount(0);
    await context.close();
  });

  await test.step("the privacy page is public and fits a phone", async () => {
    const context = await browser.newContext({ ...devices["Pixel 7"], locale: "fa-IR", timezoneId: "Asia/Tehran" });
    const phone = await context.newPage();
    await phone.goto("/privacy");
    await expect(phone).toHaveURL(/\/privacy$/);
    await expect(phone.getByRole("heading", { level: 1, name: "حریم خصوصی" })).toBeVisible();
    await expect(phone.getByRole("heading", { name: "خروجی گرفتن و حذف" })).toBeVisible();
    expect(await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    // A visitor can't download anything: the export sends them to log in.
    await phone.goto("/settings/data/export/customers");
    await expect(phone).toHaveURL(/\/login$/);
    await context.close();
  });
});
