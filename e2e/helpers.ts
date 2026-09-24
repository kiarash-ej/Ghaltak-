import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { E2E_SESSION_SECRET } from "../playwright.config";

const faNumber = new Intl.NumberFormat("fa-IR");

/** 500000 -> "۵۰۰٬۰۰۰ تومان", exactly as the app renders amounts. */
export const toman = (n: number) => `${faNumber.format(n)} تومان`;
export const faDigits = (n: number) => faNumber.format(n);

/** A fresh, valid Iranian mobile number for this run. */
export function uniqueMobile(prefix: "0912" | "0935"): string {
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
