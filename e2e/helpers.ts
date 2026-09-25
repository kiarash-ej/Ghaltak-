import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { E2E_SESSION_SECRET } from "../playwright.config";

const faNumber = new Intl.NumberFormat("fa-IR");

/** 500000 -> "۵۰۰٬۰۰۰ تومان", exactly as the app renders amounts. */
export const toman = (n: number) => `${faNumber.format(n)} تومان`;
export const faDigits = (n: number) => faNumber.format(n);

/** A fresh, valid Iranian mobile number for this run. */
export function uniqueMobile(prefix: `09${number}`): string {
  return `${prefix}${String(Date.now()).slice(-7)}`;
}

/**
 * Replaces the newest login code for `mobile` with `code`. The app only stores
 * an HMAC of the code (with SESSION_SECRET), so the test can't read the real
 * one; setting a known one still exercises the real verification path.
 */
export async function setLoginCode(mobile: string, code: string) {
  const client = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL });
  await client.connect();
  try {
    const hash = createHmac("sha256", E2E_SESSION_SECRET).update(`${mobile}:${code}`).digest("hex");
    const { rowCount } = await client.query(
      `UPDATE "OtpCode" SET "codeHash" = $1
       WHERE id = (SELECT id FROM "OtpCode" WHERE mobile = $2 AND NOT consumed ORDER BY "createdAt" DESC LIMIT 1)`,
      [hash, mobile],
    );
    if (rowCount !== 1) throw new Error(`no login code found for ${mobile}`);
  } finally {
    await client.end();
  }
}

/** Logs in through the real login form (mobile, then SMS code). */
export async function logIn(page: Page, mobile: string) {
  await page.goto("/login");
  await page.getByLabel("شمارهٔ موبایل").fill(mobile);
  await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
  await expect(page.getByLabel("کد تأیید")).toBeVisible();

  await setLoginCode(mobile, "246810");
  await page.getByLabel("کد تأیید").fill("246810");
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** A tiny valid PNG, for the receipt upload. */
export const RECEIPT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

/** The public token of an order, for opening the customer's order page. */
export async function publicTokenOf(orderId: string): Promise<string> {
  const client = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(`SELECT "publicToken" FROM "Order" WHERE id = $1`, [orderId]);
    if (!rows[0]?.publicToken) throw new Error(`no public token for order ${orderId}`);
    return rows[0].publicToken as string;
  } finally {
    await client.end();
  }
}

/** Creates a product with one "مشکی / M" variant; returns that variant's id. */
export async function createProduct(page: Page, p: { name: string; price: number; stock: number }) {
  await page.goto("/products/new");
  await page.getByLabel("نام محصول").fill(p.name);
  await page.getByLabel("قیمت (تومان)").fill(String(p.price));
  await page.locator("#color-0").fill("مشکی");
  await page.locator("#size-0").fill("M");
  await page.locator("#stock-0").fill(String(p.stock));
  await page.getByRole("button", { name: "ثبت محصول" }).click();
  await expect(page).toHaveURL(/\/products$/);

  await page.goto(`/inventory?q=${encodeURIComponent(p.name)}`);
  const href = await page
    .getByRole("listitem")
    .filter({ hasText: p.name })
    .locator('a[href^="/inventory/"]')
    .first()
    .getAttribute("href");
  const variantId = href?.split("/").pop();
  if (!variantId) throw new Error(`no inventory row for ${p.name}`);
  return variantId;
}

/** The variant's stock as the inventory page shows it (Persian digits). */
export async function stockOf(page: Page, productName: string) {
  await page.goto(`/inventory?q=${encodeURIComponent(productName)}`);
  return page.getByRole("listitem").filter({ hasText: productName }).locator("div.text-2xl").innerText();
}

/** Enters a manual order for a new customer; returns the order id and code. */
export async function createManualOrder(
  page: Page,
  o: { variantId: string; quantity: number; customerName: string; customerPhone: string },
) {
  await page.goto("/orders/new");
  await page.getByRole("radio", { name: "مشتری جدید" }).click();
  await page.getByLabel("نام مشتری").fill(o.customerName);
  await page.getByLabel("شمارهٔ موبایل").fill(o.customerPhone);
  await page.locator('select[name="items.0.variantId"]').selectOption(o.variantId);
  await page.locator('input[name="items.0.quantity"]').fill(String(o.quantity));
  await page.getByLabel("آدرس ارسال").fill("تهران، خیابان آزادی، پلاک ۱۲");
  await page.getByRole("button", { name: "ثبت سفارش" }).click();

  // The order's own page (not /orders/new, which the same pattern would match).
  await expect(page).toHaveURL(/\/orders\/(?!new$)[a-z0-9]+$/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  const code = (await page.locator("h1 span.font-mono").innerText()).trim();
  return { id, code };
}

/** Clicks a status button that asks for confirmation (cancel/return) and accepts it. */
export async function changeStatusConfirmed(page: Page, label: string) {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: label, exact: true }).click();
}
