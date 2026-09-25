import { devices, expect, test, type Page } from "@playwright/test";
import { RECEIPT_PNG, faDigits, logIn, toman, uniqueMobile } from "./helpers";

// The whole Phase 1 buy flow, as a seller and a customer would do it:
//
//   seller:   log in → name the store (Phase 2, A6) → create a product → make a purchase link
//   customer: (phone, no account) sees the store, orders through the link → upload a receipt
//   seller:   sees the receipt → confirms payment → prepares → ships
//   customer: sees payment confirmed and the tracking code
//   seller:   stock went down, and the sales report counts the sale
//
// Each run makes its own seller, so every number checked here is exact.

const PRICE = 250_000;
const QUANTITY = 2;
const START_STOCK = 5;
const SHIPPING = 60_000;
const TRACKING = "1234567890123456789012";
const CONTACT_PHONE = "09171234567"; // the store's public number, not the login mobile

test("buy flow: purchase link → receipt → payment → shipping → report", async ({ page: seller, browser }) => {
  const sellerMobile = uniqueMobile("0912");
  const customerMobile = uniqueMobile("0935");
  const productName = `محصول آزمایشی ${sellerMobile.slice(-5)}`;
  const storeName = `فروشگاه آزمایشی ${sellerMobile.slice(-5)}`;

  const stockOnInventory = async (p: Page) => {
    await p.goto(`/inventory?q=${encodeURIComponent(productName)}`);
    const row = p.getByRole("listitem").filter({ hasText: productName });
    return row.locator("div.text-2xl").innerText();
  };

  await test.step("seller logs in", async () => {
    await logIn(seller, sellerMobile);
  });

  await test.step("new seller is asked to complete the store profile, and does", async () => {
    const banner = seller.getByRole("link", { name: /تکمیل اطلاعات فروشگاه/ });
    await banner.click();
    await expect(seller).toHaveURL(/\/settings$/);

    await seller.getByLabel("نام فروشگاه").fill(storeName);
    await seller.getByLabel("انتخاب لوگوی فروشگاه").setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: RECEIPT_PNG,
    });
    await expect(seller.getByRole("img", { name: "لوگوی فروشگاه" })).toBeVisible();
    await seller.getByLabel("موبایل تماس").fill(CONTACT_PHONE);
    await seller.getByLabel("آیدی اینستاگرام").fill("@test.shop");
    await seller.getByRole("button", { name: "ذخیرهٔ تغییرات" }).click();
    await expect(seller.getByText("تغییرات ذخیره شد.")).toBeVisible();
    await expect(seller.getByLabel("آیدی اینستاگرام")).toHaveValue("test.shop");

    await seller.goto("/");
    await expect(seller.getByRole("heading", { name: `خوش آمدید، ${storeName}` })).toBeVisible();
    await expect(banner).toHaveCount(0);
  });

  await test.step("seller creates a product with one variant", async () => {
    await seller.goto("/products/new");
    await seller.getByLabel("نام محصول").fill(productName);
    await seller.getByLabel("قیمت (تومان)").fill(String(PRICE));
    await seller.locator("#color-0").fill("مشکی");
    await seller.locator("#size-0").fill("M");
    await seller.locator("#stock-0").fill(String(START_STOCK));
    await seller.getByRole("button", { name: "ثبت محصول" }).click();
    await expect(seller).toHaveURL(/\/products$/);
    await expect(seller.getByText(productName)).toBeVisible();
    expect(await stockOnInventory(seller)).toBe(faDigits(START_STOCK));
  });

  let linkPath = "";
  await test.step("seller makes a purchase link for it", async () => {
    await seller.goto("/orders/links");
    await seller.getByLabel(productName).check();
    await seller.getByRole("button", { name: "ساخت لینک خرید" }).click();
    await expect(seller.getByText("لینک ساخته شد.")).toBeVisible();
    linkPath = (await seller.locator("code", { hasText: "/buy/" }).first().innerText()).trim();
    expect(linkPath).toMatch(/^\/buy\/[A-Za-z0-9_-]{16,}$/);
  });

  // The customer: a phone-sized browser with no cookies (no seller session).
  const customerContext = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "fa-IR",
    timezoneId: "Asia/Tehran",
  });
  const customer = await customerContext.newPage();
  let orderCode = "";

  await test.step("customer orders through the link on a phone", async () => {
    await customer.goto(linkPath);
    await expect(customer.getByText(productName)).toBeVisible();

    // The store as the seller published it, and nothing else about the seller.
    await expect(customer.getByText(storeName)).toBeVisible();
    const logo = customer.getByRole("img", { name: `لوگوی ${storeName}` });
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(customer.getByRole("link", { name: "@test.shop" })).toHaveAttribute(
      "href",
      "https://instagram.com/test.shop",
    );
    await expect(customer.getByRole("link", { name: CONTACT_PHONE })).toHaveAttribute("href", `tel:${CONTACT_PHONE}`);
    expect(await customer.content()).not.toContain(sellerMobile);

    await customer.getByLabel(`رنگ و سایز ${productName}`).selectOption({ label: "مشکی / M" });
    // One product on the link starts at 1; go to 2.
    await customer.getByRole("button", { name: "زیاد کردن" }).click();
    await expect(customer.getByLabel("تعداد", { exact: true })).toHaveValue(String(QUANTITY));

    await customer.getByLabel("نام و نام خانوادگی").fill("مشتری آزمایشی");
    await customer.getByLabel("شمارهٔ موبایل").fill(customerMobile);
    await customer.getByLabel("آدرس کامل").fill("شیراز، خیابان زند، کوچه ۵، پلاک ۷");
    await expect(customer.getByText(toman(PRICE * QUANTITY))).toBeVisible();
    await customer.getByRole("button", { name: "ثبت سفارش" }).click();

    await expect(customer).toHaveURL(/\/buy\/order\//);
    await expect(customer.getByRole("heading", { name: "سفارش شما ثبت شد" })).toBeVisible();
    orderCode = (await customer.locator("span.font-mono").first().innerText()).trim();
    expect(orderCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  await test.step("the order took stock", async () => {
    expect(await stockOnInventory(seller)).toBe(faDigits(START_STOCK - QUANTITY));
  });

  await test.step("customer uploads a card-to-card receipt", async () => {
    await customer.locator("#receipt").setInputFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer: RECEIPT_PNG,
    });
    await customer.getByRole("button", { name: "ارسال رسید" }).click();
    await expect(customer.getByText("رسید شما دریافت شد و در انتظار تأیید فروشنده است.")).toBeVisible();
  });

  await test.step("seller sees the receipt and confirms payment", async () => {
    await seller.goto("/orders");
    const row = seller.getByRole("row").filter({ hasText: orderCode });
    await expect(row.getByText("رسید دریافت شد")).toBeVisible();
    await expect(row.getByText("لینک خرید")).toBeVisible();
    await row.getByRole("link", { name: "جزئیات" }).click();

    await expect(seller.getByRole("img", { name: "رسید پرداخت" })).toBeVisible();
    await seller.getByRole("button", { name: "تأیید پرداخت" }).click();
    await expect(seller.getByText("کارت به کارت")).toBeVisible();
  });

  await test.step("seller prepares and ships the order", async () => {
    await seller.getByRole("button", { name: "در حال آماده‌سازی" }).click();
    await expect(seller.getByRole("button", { name: "ثبت و ارسال سفارش" })).toBeVisible();

    await seller.getByLabel("روش ارسال").selectOption("POST");
    await seller.getByLabel("هزینهٔ ارسال (تومان)").fill(String(SHIPPING));
    await seller.getByLabel("کد رهگیری (اختیاری)").fill(TRACKING);
    await seller.getByRole("button", { name: "ثبت و ارسال سفارش" }).click();

    await expect(seller.getByRole("button", { name: "تحویل‌شده" })).toBeVisible();
    await expect(seller.getByText(toman(PRICE * QUANTITY + SHIPPING))).toBeVisible();
  });

  await test.step("customer sees payment confirmed and the tracking code", async () => {
    await customer.reload();
    await expect(customer.getByText("پرداخت شما تأیید شد.")).toBeVisible();
    await expect(customer.getByText(TRACKING)).toBeVisible();
    await expect(customer.getByText("وضعیت: در راه · پست")).toBeVisible();
    await expect(customer.getByText(toman(PRICE * QUANTITY + SHIPPING))).toBeVisible();
    // The public page never shows the customer's phone or the seller's details.
    await expect(customer.getByText(customerMobile)).toHaveCount(0);
    await expect(customer.getByText(sellerMobile)).toHaveCount(0);
  });

  await test.step("the sales report counts the sale", async () => {
    await seller.goto("/reports");
    // The "sales today" tile: the label's parent holds the amount and the count.
    const today = seller.getByText("فروش امروز", { exact: true }).locator("..");
    await expect(today.getByText(toman(PRICE * QUANTITY), { exact: true })).toBeVisible();
    await expect(today.getByText(`${faDigits(1)} سفارش · میانگین ${toman(PRICE * QUANTITY)}`)).toBeVisible();

    const top = seller.getByRole("row").filter({ hasText: productName });
    await expect(top.getByText(faDigits(QUANTITY), { exact: true })).toBeVisible();
  });

  await customerContext.close();
});
