import path from "node:path";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { logIn, uniqueMobile } from "./helpers";

// Not a test: re-takes the screenshots of the seller guide (/help, C5) from the
// real app, so the guide matches the screens. Skipped unless asked for:
//
//   HELP_SCREENSHOTS=1 npx playwright test help-screenshots
//
// It walks a sample shop through the whole flow on a phone-sized screen and
// writes JPEGs to public/help/. Every image is a fixed size (the numbers below
// are CSS pixels, saved at 2x), so src/app/help/guides.ts never needs new
// dimensions. All names and numbers are made up.

test.skip(!process.env.HELP_SCREENSHOTS, "set HELP_SCREENSHOTS=1 to re-take the /help screenshots");
// Persian browser UI, so file inputs read as they do on a seller's phone.
test.use({ launchOptions: { args: ["--lang=fa"] } });

const OUT = path.resolve("public/help");
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** Saves a 390×`height` shot of the page starting at `from`'s top edge (minus a small margin). */
async function shot(page: Page, name: string, from: Locator, height: number) {
  await from.scrollIntoViewIfNeeded();
  const box = await from.boundingBox();
  if (!box) throw new Error(`nothing to photograph for ${name}`);
  const scrollY = await page.evaluate(() => window.scrollY);
  const top = Math.max(0, box.y + scrollY - 12);
  // The dev server's floating Next.js badge is not part of the app.
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
  // Pad short pages so the image is still exactly `height` tall.
  await page.evaluate((min) => {
    document.body.style.minHeight = `${min}px`;
  }, top + height);
  await page.screenshot({
    path: path.join(OUT, name),
    type: "jpeg",
    quality: 78,
    fullPage: true,
    clip: { x: 0, y: top, width: 390, height },
  });
  await page.evaluate(() => {
    document.body.style.minHeight = "";
  });
}

/** A picture drawn in the browser (no outside image), as PNG bytes. */
async function drawPng(page: Page, kind: "product" | "logo" | "receipt"): Promise<Buffer> {
  const dataUrl = await page.evaluate(async (k) => {
    await document.fonts.ready;
    const font = getComputedStyle(document.body).fontFamily;
    const c = document.createElement("canvas");
    const g = c.getContext("2d")!;
    g.direction = "rtl";
    g.textAlign = "center";
    if (k === "product") {
      c.width = c.height = 800;
      const bg = g.createLinearGradient(0, 0, 800, 800);
      bg.addColorStop(0, "#f5efe6");
      bg.addColorStop(1, "#e7dccb");
      g.fillStyle = bg;
      g.fillRect(0, 0, 800, 800);
      // A simple coat outline.
      g.fillStyle = "#1f2937";
      g.beginPath();
      g.moveTo(330, 150);
      g.lineTo(470, 150);
      g.lineTo(600, 260);
      g.lineTo(560, 330);
      g.lineTo(520, 300);
      g.lineTo(540, 690);
      g.lineTo(260, 690);
      g.lineTo(280, 300);
      g.lineTo(240, 330);
      g.lineTo(200, 260);
      g.closePath();
      g.fill();
      g.fillStyle = "#f5efe6";
      g.beginPath();
      g.moveTo(360, 150);
      g.lineTo(400, 230);
      g.lineTo(440, 150);
      g.closePath();
      g.fill();
    } else if (k === "logo") {
      c.width = c.height = 400;
      g.fillStyle = "#0f766e";
      g.beginPath();
      g.arc(200, 200, 200, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.font = `bold 150px ${font}`;
      g.direction = "ltr";
      g.fillText("ب", 200, 255);
    } else {
      c.width = 600;
      c.height = 900;
      g.fillStyle = "#fff";
      g.fillRect(0, 0, 600, 900);
      g.fillStyle = "#1e3a8a";
      g.fillRect(0, 0, 600, 140);
      g.fillStyle = "#fff";
      g.font = `bold 44px ${font}`;
      g.fillText("رسید انتقال وجه", 300, 88);
      g.fillStyle = "#16a34a";
      g.font = `bold 40px ${font}`;
      g.fillText("انتقال موفق", 300, 230);
      g.textAlign = "right";
      g.fillStyle = "#111827";
      g.font = `32px ${font}`;
      const rows = [
        ["مبلغ", "۱۲٬۸۰۰٬۰۰۰ ریال"],
        ["کارت مقصد", "۶۰۳۷-۹۹**-****-۷۸۹۳"],
        ["نام صاحب کارت", "سارا نمونه"],
        ["شمارهٔ پیگیری", "۴۸۲۷۱۹"],
      ];
      rows.forEach(([label, value], i) => {
        const y = 340 + i * 110;
        g.fillStyle = "#6b7280";
        g.fillText(label, 560, y);
        g.fillStyle = "#111827";
        g.fillText(value, 560, y + 48);
      });
    }
    return c.toDataURL("image/png");
  }, kind);
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function phonePage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...PHONE, locale: "fa-IR", timezoneId: "Asia/Tehran" });
  return context.newPage();
}

test("re-take the /help screenshots", async ({ browser }) => {
  test.setTimeout(600_000);
  const seller = await phonePage(browser);
  const customer = await phonePage(browser);
  const PRODUCT = "مانتو کتان";

  await logIn(seller, uniqueMobile("0912"));

  // getting-started-store: the store form, filled in.
  await seller.goto("/settings");
  await seller.getByLabel("نام فروشگاه").fill("بوتیک نمونه");
  await seller.getByLabel("انتخاب لوگوی فروشگاه").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: await drawPng(seller, "logo"),
  });
  await expect(seller.getByRole("img", { name: "لوگوی فروشگاه" })).toBeVisible();
  await seller.getByLabel("آیدی اینستاگرام").fill("boutique.nemoone");
  await seller.getByLabel("آیدی تلگرام").fill("boutique_nemoone");
  await shot(seller, "getting-started-store.jpg", seller.getByLabel("نام فروشگاه").locator("xpath=ancestor::form"), 1000);
  await seller.getByRole("button", { name: "ذخیرهٔ تغییرات" }).click();
  await expect(seller.getByText("تغییرات ذخیره شد.")).toBeVisible();

  // products-form: a product with a photo and two variants.
  await seller.goto("/products/new");
  await seller.getByLabel("نام محصول").fill(PRODUCT);
  await seller.getByLabel("قیمت (تومان)").fill("1280000");
  await seller.getByLabel("دسته‌بندی").fill("مانتو");
  await seller.getByLabel("انتخاب تصویر محصول").setInputFiles({
    name: "coat.png",
    mimeType: "image/png",
    buffer: await drawPng(seller, "product"),
  });
  await expect(seller.getByRole("img", { name: "پیش‌نمایش تصویر محصول" })).toBeVisible();
  await seller.locator("#color-0").fill("مشکی");
  await seller.locator("#size-0").fill("M");
  await seller.locator("#stock-0").fill("4");
  await seller.getByRole("button", { name: "افزودن تنوع" }).click();
  await seller.locator("#color-1").fill("کرم");
  await seller.locator("#size-1").fill("L");
  await seller.locator("#stock-1").fill("2");
  await shot(seller, "products-form.jpg", seller.getByText("تنوع‌ها (رنگ، سایز و موجودی)"), 700);
  await seller.getByRole("button", { name: "ثبت محصول" }).click();
  await expect(seller).toHaveURL(/\/products$/);

  // getting-started-checklist: two of five steps done.
  await seller.goto("/");
  await expect(seller.getByText("شروع کار", { exact: true })).toBeVisible();
  await shot(seller, "getting-started-checklist.jpg", seller.getByRole("heading", { level: 1 }), 518);

  // card-to-card-settings: the saved card, masked.
  await seller.goto("/settings/payments");
  await seller.getByLabel("شمارهٔ کارت", { exact: true }).fill("6037991234567893");
  await seller.getByLabel("نام صاحب کارت").fill("سارا نمونه");
  await seller.getByRole("button", { name: "ذخیرهٔ اطلاعات کارت" }).click();
  await expect(seller.getByText("ذخیره شد.")).toBeVisible();
  await seller.reload();
  await shot(seller, "card-to-card-settings.jpg", seller.getByRole("heading", { name: "کارت‌به‌کارت" }), 450);

  // purchase-links-create: a titled link.
  await seller.goto("/orders/links");
  await seller.getByLabel("عنوان (اختیاری، به مشتری نمایش داده می‌شود)").fill("فروش ویژهٔ پاییز");
  await seller.getByLabel(PRODUCT).check();
  await seller.getByRole("button", { name: "ساخت لینک خرید" }).click();
  await expect(seller.getByText("لینک ساخته شد.")).toBeVisible();
  const linkPath = (await seller.locator("code", { hasText: "/buy/" }).first().innerText()).trim();
  await shot(seller, "purchase-links-create.jpg", seller.getByText("لینک جدید", { exact: true }), 560);

  // purchase-links-customer: the customer's buy page, filled in.
  await customer.goto(linkPath);
  await customer.getByLabel(`رنگ و سایز ${PRODUCT}`).selectOption({ label: "مشکی / M" });
  await customer.getByLabel("نام و نام خانوادگی").fill("مریم نمونه");
  await customer.getByLabel("شمارهٔ موبایل").fill("09350000000");
  await customer.getByLabel("آدرس کامل").fill("شیراز، خیابان زند، کوچه ۵، پلاک ۷");
  await shot(customer, "purchase-links-customer.jpg", customer.locator("header").first(), 750);
  await customer.getByRole("button", { name: "ثبت سفارش" }).click();
  await expect(customer.getByRole("heading", { name: "سفارش شما ثبت شد" })).toBeVisible();
  const orderPage = customer.url();

  // card-to-card-customer: amount due, the seller's card and the receipt upload.
  await shot(customer, "card-to-card-customer.jpg", customer.getByRole("heading", { name: "سفارش شما ثبت شد" }), 750);
  await customer.locator("#receipt").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: await drawPng(customer, "receipt"),
  });
  await customer.getByRole("button", { name: "ارسال رسید" }).click();
  await expect(customer.getByText("رسید شما دریافت شد و در انتظار تأیید فروشنده است.")).toBeVisible();

  // card-to-card-review: the seller's order page with the receipt waiting.
  await seller.goto("/orders");
  await seller.getByRole("link", { name: "جزئیات" }).first().click();
  await expect(seller.getByRole("img", { name: "رسید پرداخت" })).toBeVisible();
  await seller.getByRole("img", { name: "رسید پرداخت" }).evaluate((img: HTMLImageElement) => img.decode());
  await shot(seller, "card-to-card-review.jpg", seller.getByText("رسید مشتری در انتظار بررسی"), 600);
  await seller.getByRole("button", { name: "تأیید پرداخت" }).click();
  await expect(seller.getByText("کارت به کارت")).toBeVisible();

  // shipping-panel: method, cost and tracking code, ready to ship.
  await seller.getByRole("button", { name: "در حال آماده‌سازی" }).click();
  await expect(seller.getByRole("button", { name: "ثبت و ارسال سفارش" })).toBeVisible();
  await seller.getByLabel("روش ارسال").selectOption("POST");
  await seller.getByLabel("هزینهٔ ارسال (تومان)").fill("75000");
  await seller.getByLabel("کد رهگیری (اختیاری)").fill("123456789012345678901234");
  await shot(seller, "shipping-panel.jpg", seller.getByLabel("روش ارسال").locator("xpath=ancestor::form"), 500);
  await seller.getByRole("button", { name: "ثبت و ارسال سفارش" }).click();
  await expect(seller.getByRole("button", { name: "تحویل‌شده" })).toBeVisible();

  // shipping-customer: the customer's page with the tracking code.
  await customer.goto(orderPage);
  await expect(customer.getByText("123456789012345678901234")).toBeVisible();
  await shot(customer, "shipping-customer.jpg", customer.getByRole("heading", { name: "ارسال" }), 190);

  // reports: the sale is counted today.
  await seller.goto("/reports");
  await shot(seller, "reports.jpg", seller.getByRole("heading", { name: "گزارش فروش" }), 700);

  await seller.context().close();
  await customer.context().close();
});
