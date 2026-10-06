import { expect, test } from "@playwright/test";
import pg from "pg";
import { createManualOrder, createProduct, logIn, uniqueMobile } from "./helpers";

// Period reports (spec §6.4): a sale from last month shows up in the archive,
// its report tells the month in one sentence, and the printable copy is one
// A4 page with no dashboard around it.

const PRICE = 100_000;
const COST = 40_000; // net profit 60,000: no expenses in this store

const TEHRAN = "Asia/Tehran";
const jalaliDay = (d: Date) => Number(new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { timeZone: TEHRAN, day: "numeric" }).format(d));
/** «شهریور ۱۴۰۵», as the app names a month. */
function monthLabel(d: Date) {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: TEHRAN, month: "long", year: "numeric" }).formatToParts(d);
  return `${parts.find((p) => p.type === "month")!.value} ${parts.find((p) => p.type === "year")!.value}`;
}

/** PDF pages and the first page's size in points (A4 = 595 × 842). */
function pdfPages(pdf: Buffer) {
  const text = pdf.toString("latin1");
  const box = text.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
  return { count: (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length, width: Number(box?.[1]), height: Number(box?.[2]) };
}

test("period reports: last month in the archive, its story, one A4 page to print", async ({ page }, testInfo) => {
  const mobile = uniqueMobile("0922");
  await logIn(page, mobile);
  const product = `محصول گزارش ${mobile.slice(-5)}`;
  // Today's day of the month, that many days back: the last day of last month.
  const lastMonth = new Date(Date.now() - jalaliDay(new Date()) * 24 * 60 * 60 * 1000);
  const label = monthLabel(lastMonth);

  await test.step("a paid sale, moved into last month", async () => {
    const variantId = await createProduct(page, { name: product, price: PRICE, cost: COST, stock: 5 });
    const order = await createManualOrder(page, { variantId, quantity: 1, customerName: "مشتری ماه قبل", customerPhone: uniqueMobile("0940") });
    await page.goto(`/orders/${order.id}`);
    await page.getByRole("button", { name: "تأیید پرداخت" }).click();
    await expect(page.getByText("کارت‌به‌کارت", { exact: true })).toBeVisible();
    const client = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL });
    await client.connect();
    try {
      // Noon (Tehran) on last month's last day: today's Tehran midnight, minus
      // today's day of the month in days, plus 12 hours. Computed in SQL and
      // stored as UTC, like the column; a JS Date would be written in the test
      // machine's local time and land in this month late in the evening.
      await client.query(
        `UPDATE "Order"
         SET "createdAt" = ((date_trunc('day', now() AT TIME ZONE 'Asia/Tehran') - make_interval(days => $2::int) + interval '12 hours')
                            AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'UTC'
         WHERE id = $1`,
        [order.id, jalaliDay(new Date())],
      );
    } finally {
      await client.end();
    }
  });

  await test.step("the archive lists last month, and its report tells it", async () => {
    await page.goto("/finance/reports");
    await page.getByRole("link", { name: new RegExp(`^${label}`) }).click();
    await expect(page).toHaveURL(/\/finance\/reports\/\d{4}-\d{2}$/);
    await expect(page.getByRole("heading", { level: 1, name: `گزارش ${label}` })).toBeVisible();
    await expect(page.getByRole("region", { name: "خلاصهٔ دوره" })).toContainText(`در ${label}، ۱۰۰ هزار تومان فروختید و ۶۰ هزار تومان سود خالص بردید.`);
    await expect(page.getByRole("row").filter({ hasText: product }).first()).toBeVisible();
  });

  await test.step("the printable copy: one A4 page, nothing of the dashboard", async () => {
    await page.getByRole("link", { name: "نسخهٔ چاپی و PDF" }).click();
    const sheet = page.getByRole("article", { name: `گزارش مالی ${label}` });
    await expect(sheet).toContainText("ارقام به تومان. فروش بدون هزینهٔ ارسال.");
    await expect(sheet.getByRole("row").filter({ hasText: "سود خالص" })).toContainText("۶۰٬۰۰۰ تومان");

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "چاپ یا ذخیرهٔ PDF" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "منوی اصلی" })).toBeHidden();
    await page.emulateMedia({ media: null });

    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    await testInfo.attach("period-report.pdf", { body: pdf, contentType: "application/pdf" });
    const pages = pdfPages(pdf);
    expect(pages.count).toBe(1);
    expect(Math.round(pages.width)).toBe(595); // A4: 210 mm
    expect(Math.round(pages.height)).toBe(842); // 297 mm
  });
});
