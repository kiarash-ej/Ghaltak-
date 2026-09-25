import "server-only";
import { prisma } from "@/lib/prisma";
import { getVariantStockStatus, type StockStatus } from "@/server/catalog/stock-status";
import { yesNo, type CsvValue } from "./csv";

// Products and variants with stock (C6): one row per variant. Stock is the
// variant's own number, the one the inventory page shows, and the status is
// Track A's getVariantStockStatus with the inventory page's labels.

export const PRODUCT_HEADER = [
  "نام محصول",
  "دسته‌بندی",
  "قیمت (تومان)",
  "فعال",
  "رنگ",
  "سایز",
  "کد کالا",
  "موجودی",
  "آستانهٔ هشدار کم‌موجودی",
  "وضعیت موجودی",
];

const STOCK_LABELS: Record<StockStatus, string> = { OUT_OF_STOCK: "ناموجود", LOW: "کم‌موجودی", OK: "کافی" };

/** Batches of rows, `batchSize` products at a time, so a big catalogue never sits in memory. */
export async function* productRows(sellerId: string, opts: { batchSize?: number } = {}): AsyncGenerator<CsvValue[][]> {
  const take = opts.batchSize ?? 200;
  let cursor: string | undefined;
  for (;;) {
    const products = await prisma.product.findMany({
      where: { sellerId },
      orderBy: { id: "asc" },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        isActive: true,
        lowStockThreshold: true,
        variants: {
          where: { sellerId },
          orderBy: [{ color: "asc" }, { size: "asc" }, { id: "asc" }],
          select: { color: true, size: true, sku: true, stock: true },
        },
      },
    });
    if (products.length === 0) return;
    cursor = products[products.length - 1].id;

    yield products.flatMap((p) => {
      const base = [p.name, p.category, p.price, yesNo(p.isActive)];
      if (p.variants.length === 0) return [[...base, null, null, null, null, p.lowStockThreshold, null]];
      return p.variants.map((v) => [
        ...base,
        v.color,
        v.size,
        v.sku,
        v.stock,
        p.lowStockThreshold,
        STOCK_LABELS[getVariantStockStatus(v.stock, p.lowStockThreshold)],
      ]);
    });
    if (products.length < take) return;
  }
}
