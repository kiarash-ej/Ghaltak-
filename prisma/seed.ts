import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { OrderStatus, Prisma } from "../src/generated/prisma/client";

type ProductWithVariants = Prisma.ProductGetPayload<{ include: { variants: true } }>;

// Deterministic development data: 1 seller, 20 products with variants,
// 15 customers, 30 orders in mixed statuses. Safe to run repeatedly: it
// wipes and recreates the demo seller's data (identified by DEMO_MOBILE).

const DEMO_MOBILE = "09120000000";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Small deterministic PRNG so the seed is reproducible.
let state = 42;
function rand() {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const PRODUCT_NAMES = [
  ["مانتو کتان", "پوشاک زنانه"], ["شومیز ساتن", "پوشاک زنانه"], ["شال نخی", "اکسسوری"],
  ["کیف دوشی چرم", "کیف"], ["کیف دستی", "کیف"], ["کفش کتانی", "کفش"],
  ["کفش اسپرت", "کفش"], ["صندل تابستانی", "کفش"], ["پیراهن مردانه", "پوشاک مردانه"],
  ["شلوار جین", "پوشاک مردانه"], ["تی‌شرت نخی", "پوشاک مردانه"], ["کاپشن", "پوشاک مردانه"],
  ["گردنبند نقره", "زیورآلات"], ["دستبند", "زیورآلات"], ["گوشواره", "زیورآلات"],
  ["ساعت مچی", "اکسسوری"], ["عینک آفتابی", "اکسسوری"], ["کلاه بافت", "اکسسوری"],
  ["جوراب پک ۵ تایی", "پوشاک"], ["کمربند چرم", "اکسسوری"],
];
const COLORS = ["مشکی", "سفید", "سرمه‌ای", "قرمز", "بژ"];
const SIZES = ["S", "M", "L", "XL"];
const CUSTOMER_NAMES = [
  "سارا احمدی", "علی رضایی", "مریم کریمی", "حسین موسوی", "زهرا محمدی",
  "رضا حسینی", "نگار صادقی", "امیر نوری", "الهام جعفری", "محمد کاظمی",
  "فاطمه یوسفی", "مهدی اکبری", "نیلوفر رحیمی", "پویا فرهادی", "شیرین قاسمی",
];
const ORDER_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "DELIVERED",
  "DELIVERED", "DELIVERED", "CANCELED", "RETURNED",
];

async function main() {
  const existing = await prisma.seller.findUnique({ where: { mobile: DEMO_MOBILE } });
  if (existing) {
    const sellerId = existing.id;
    // Payment attempts and invoices block deleting a seller (ON DELETE
    // RESTRICT: payment records are never removed by accident), so they go first.
    await prisma.paymentAttempt.deleteMany({ where: { sellerId } });
    await prisma.invoice.deleteMany({ where: { sellerId } });
    // SMS rows would survive with sellerId NULL (ON DELETE SET NULL); drop them.
    await prisma.smsMessage.deleteMany({ where: { sellerId } });
    await prisma.orderItem.deleteMany({ where: { order: { sellerId } } });
    await prisma.order.deleteMany({ where: { sellerId } });
    await prisma.purchaseLink.deleteMany({ where: { sellerId } });
    await prisma.customer.deleteMany({ where: { sellerId } });
    await prisma.product.deleteMany({ where: { sellerId } });
    await prisma.seller.delete({ where: { id: sellerId } });
  }

  const seller = await prisma.seller.create({
    data: { mobile: DEMO_MOBILE, name: "فروشگاه نمونه", instagram: "nemoone.shop" },
  });
  // The same account shape as a real first login (src/server/account.ts).
  const user = await prisma.user.upsert({
    where: { mobile: DEMO_MOBILE },
    update: {},
    create: { mobile: DEMO_MOBILE },
  });
  await prisma.membership.create({ data: { userId: user.id, sellerId: seller.id, role: "OWNER" } });
  await prisma.subscription.create({
    data: {
      sellerId: seller.id,
      plan: "TRIAL",
      status: "TRIALING",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const products: ProductWithVariants[] = [];
  for (const [name, category] of PRODUCT_NAMES) {
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        name,
        category,
        price: int(15, 250) * 10_000, // 150,000 .. 2,500,000 toman
        variants: {
          create: Array.from({ length: int(2, 4) }, (_, i) => ({
            sellerId: seller.id,
            color: COLORS[i % COLORS.length],
            size: SIZES[i % SIZES.length],
            stock: int(0, 12), // current stock; the history is written after the orders
          })),
        },
      },
      include: { variants: true },
    });
    products.push(product);
  }

  const customers = [];
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    customers.push(
      await prisma.customer.create({
        data: {
          sellerId: seller.id,
          name: CUSTOMER_NAMES[i],
          phone: `0912${String(1000000 + i * 7919).slice(0, 7)}`,
          address: `تهران، خیابان نمونه، پلاک ${i + 1}`,
          tag: i < 5 ? "NEW" : i < 10 ? "LOYAL" : "INACTIVE",
        },
      }),
    );
  }

  // Orders take stock like real ones: ORDER_PLACED per line, given back by
  // cancel/return. The INITIAL movement is written last so that every
  // variant's movements sum to its current stock.
  const stockLog: Prisma.StockMovementCreateManyInput[] = [];
  const heldByVariant = new Map<string, number>();

  for (let i = 0; i < 30; i++) {
    const customer = pick(customers);
    const status = pick(ORDER_STATUSES);
    const createdAt = new Date(Date.now() - int(0, 40) * 86_400_000);
    const lines = Array.from({ length: int(1, 3) }, () => {
      const product = pick(products);
      const variant = pick(product.variants);
      return { product, variant, quantity: int(1, 3) };
    });
    const totalPrice = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
    const paid = ["PAID", "PREPARING", "SHIPPED", "DELIVERED", "RETURNED"].includes(status);
    const shipped = ["SHIPPED", "DELIVERED", "RETURNED"].includes(status);

    const order = await prisma.order.create({
      select: { id: true },
      data: {
        sellerId: seller.id,
        customerId: customer.id,
        status,
        source: i % 3 === 0 ? "PURCHASE_LINK" : "MANUAL",
        totalPrice,
        paymentMethod: paid ? "CARD_TO_CARD" : null,
        paidAt: paid ? new Date(Date.now() - int(1, 25) * 86_400_000) : null,
        shippingAddress: customer.address,
        shippingMethod: shipped ? "پست پیشتاز" : null,
        shippingCost: shipped ? 60_000 : null,
        trackingCode: shipped ? String(int(10 ** 19, 10 ** 20 - 1)).slice(0, 20) : null,
        shippingStatus:
          status === "DELIVERED" ? "DELIVERED" : shipped ? "IN_TRANSIT" : "NOT_SHIPPED",
        createdAt,
        items: {
          create: lines.map((l) => ({
            productId: l.product.id,
            productVariantId: l.variant.id,
            quantity: l.quantity,
            unitPrice: l.product.price,
          })),
        },
      },
    });

    const gaveBack = status === "CANCELED" || status === "RETURNED";
    for (const l of lines) {
      stockLog.push({ variantId: l.variant.id, delta: -l.quantity, reason: "ORDER_PLACED", orderId: order.id, createdAt });
      if (gaveBack) {
        stockLog.push({
          variantId: l.variant.id,
          delta: l.quantity,
          reason: status === "CANCELED" ? "ORDER_CANCELED" : "ORDER_RETURNED",
          orderId: order.id,
          createdAt: new Date(createdAt.getTime() + 60_000),
        });
      } else {
        heldByVariant.set(l.variant.id, (heldByVariant.get(l.variant.id) ?? 0) + l.quantity);
      }
    }
  }

  const initialAt = new Date(Date.now() - 45 * 86_400_000);
  for (const product of products) {
    for (const v of product.variants) {
      const initial = v.stock + (heldByVariant.get(v.id) ?? 0);
      if (initial > 0) stockLog.push({ variantId: v.id, delta: initial, reason: "INITIAL", createdAt: initialAt });
    }
  }
  await prisma.stockMovement.createMany({ data: stockLog });

  console.log(
    `Seeded demo seller ${DEMO_MOBILE}: ${products.length} products, ${customers.length} customers, 30 orders.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
