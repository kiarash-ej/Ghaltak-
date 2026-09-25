import { expect, test } from "@playwright/test";
import { createManualOrder, createProduct, logIn, uniqueMobile } from "./helpers";

// B9, shipping sheets. The seller prints one order from its page, two ticked
// orders from the list, and «everything to ship today». On paper only the
// sheets print (no sidebar, no buttons), one order per A5 page.

const ADDRESS = "تهران، خیابان آزادی، پلاک ۱۲"; // what createManualOrder enters

/** PDF pages and the first page's size in points (A5 = 419.5 × 595.3). */
function pdfPages(pdf: Buffer) {
  const text = pdf.toString("latin1");
  const box = text.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
  return { count: (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length, width: Number(box?.[1]), height: Number(box?.[2]) };
}

test("shipping sheets: one order, ticked orders, and everything ready to ship", async ({ page }, testInfo) => {
  const mobile = uniqueMobile("0914");
  const storeName = `فروشگاه چاپ ${mobile.slice(-5)}`;
  const productName = `محصول چاپ ${mobile.slice(-5)}`;
  await logIn(page, mobile);

  await page.goto("/settings");
  await page.getByLabel("نام فروشگاه").fill(storeName);
  await page.getByRole("button", { name: "ذخیرهٔ تغییرات" }).click();
  await expect(page.getByText("تغییرات ذخیره شد.")).toBeVisible();

  const variantId = await createProduct(page, { name: productName, price: 80_000, stock: 10 });
  const first = await createManualOrder(page, {
    variantId,
    quantity: 2,
    customerName: "گیرندهٔ اول",
    customerPhone: uniqueMobile("0937"),
  });
  const second = await createManualOrder(page, {
    variantId,
    quantity: 1,
    customerName: "گیرندهٔ دوم",
    customerPhone: uniqueMobile("0938"),
  });

  await test.step("one order, from its page", async () => {
    await page.goto(`/orders/${first.id}`);
    await page.getByRole("link", { name: "چاپ برگهٔ ارسال" }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${first.id}/print$`));

    const sheet = page.getByRole("article", { name: `برگهٔ ارسال سفارش ${first.code}` });
    await expect(sheet).toContainText(storeName);
    await expect(sheet.getByRole("region", { name: "گیرنده" })).toContainText("گیرندهٔ اول");
    await expect(sheet.getByRole("region", { name: "گیرنده" })).toContainText(ADDRESS);
    await expect(sheet.getByRole("row").filter({ hasText: productName })).toContainText("۲");
  });

  await test.step("on paper: only the sheet, on A6 when chosen", async () => {
    await page.getByRole("link", { name: "A6" }).click();
    await expect(page).toHaveURL(/size=a6/);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("article")).toBeVisible();
    await expect(page.getByRole("link", { name: "سفارش‌ها", exact: true })).toBeHidden(); // sidebar
    await expect(page.getByRole("button", { name: "چاپ" })).toBeHidden();
    await page.emulateMedia({ media: null }); // back to normal: page.pdf() then uses print, as a browser does
  });

  await test.step("two ticked orders from the list, one per page", async () => {
    await page.goto("/orders");
    await page.getByLabel(`انتخاب سفارش ${first.code} برای چاپ`).check();
    await page.getByLabel(`انتخاب سفارش ${second.code} برای چاپ`).check();
    await page.getByRole("button", { name: "چاپ برگهٔ ارسال انتخاب‌شده‌ها" }).click();
    await expect(page).toHaveURL(/\/orders\/print\?id=/);
    await expect(page.getByRole("article")).toHaveCount(2);

    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    await testInfo.attach("shipping-sheets.pdf", { body: pdf, contentType: "application/pdf" });
    const pages = pdfPages(pdf);
    expect(pages.count).toBe(2);
    expect(Math.round(pages.width)).toBe(420); // A5: 148 mm
    expect(Math.round(pages.height)).toBe(595); // 210 mm
  });

  await test.step("«ready to ship» prints only paid orders", async () => {
    await page.goto(`/orders/${second.id}`);
    await page.getByRole("button", { name: "تأیید پرداخت" }).click();
    await expect(page.getByText("کارت به کارت", { exact: true })).toBeVisible();

    await page.goto("/orders");
    await page.getByRole("link", { name: "چاپ برگهٔ ارسال", exact: true }).click();
    await expect(page).toHaveURL(/\/orders\/print\?ready=1$/);
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article")).toContainText("گیرندهٔ دوم");
  });
});
