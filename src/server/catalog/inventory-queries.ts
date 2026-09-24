import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getVariantStockStatus, type StockStatus } from "./stock-status";

// Raw SQL because the "needs restock" filter compares a variant's stock with
// its product's threshold, which Prisma's query builder cannot express across
// a relation. Every value is passed as a bound parameter (Prisma.sql), and the
// ORDER BY comes from a fixed whitelist.

export const INVENTORY_PAGE_SIZE = 30;

export type InventoryFilter = "all" | "low" | "out";
export type InventorySort = "name" | "stock-asc" | "stock-desc";

export type InventoryRow = {
  variantId: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  isActive: boolean;
  color: string | null;
  size: string | null;
  sku: string | null;
  stock: number;
  lowStockThreshold: number;
  status: StockStatus;
};

const ORDER_BY: Record<InventorySort, Prisma.Sql> = {
  name: Prisma.sql`p."name" ASC, v."color" ASC NULLS FIRST, v."size" ASC NULLS FIRST, v."id" ASC`,
  "stock-asc": Prisma.sql`v."stock" ASC, p."name" ASC, v."id" ASC`,
  "stock-desc": Prisma.sql`v."stock" DESC, p."name" ASC, v."id" ASC`,
};

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function baseWhere(sellerId: string, productId?: string) {
  return Prisma.sql`v."sellerId" = ${sellerId} AND p."sellerId" = ${sellerId}
    ${productId ? Prisma.sql`AND p."id" = ${productId}` : Prisma.empty}`;
}

/**
 * "Needs restock": a variant of an ACTIVE product at or below the product's
 * threshold. A product the seller turned off doesn't need restocking. This is
 * the same rule as the sales report's low-stock count (src/server/reports),
 * which links to this tab, so the two numbers always match.
 */
const NEEDS_RESTOCK = Prisma.sql`p."isActive" AND v."stock" <= p."lowStockThreshold"`;

type RawRow = Omit<InventoryRow, "status">;

export async function listInventory(
  sellerId: string,
  opts: { q?: string; filter?: InventoryFilter; sort?: InventorySort; productId?: string; page?: number },
) {
  const q = opts.q?.trim();
  const filter = opts.filter ?? "all";
  const where = Prisma.sql`${baseWhere(sellerId, opts.productId)}
    ${q
      ? Prisma.sql`AND (p."name" ILIKE ${likePattern(q)} ESCAPE '\\' OR v."sku" ILIKE ${likePattern(q)} ESCAPE '\\')`
      : Prisma.empty}
    ${filter === "low" ? Prisma.sql`AND ${NEEDS_RESTOCK}` : Prisma.empty}
    ${filter === "out" ? Prisma.sql`AND v."stock" <= 0` : Prisma.empty}`;

  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count
    FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
    WHERE ${where}`;
  const total = Number(count);
  const pageCount = Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page ?? 1), pageCount);

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT v."id" AS "variantId", p."id" AS "productId", p."name" AS "productName",
           p."imageUrl", p."isActive", v."color", v."size", v."sku", v."stock", p."lowStockThreshold"
    FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
    WHERE ${where}
    ORDER BY ${ORDER_BY[opts.sort ?? "name"]}
    LIMIT ${INVENTORY_PAGE_SIZE} OFFSET ${(page - 1) * INVENTORY_PAGE_SIZE}`;

  return {
    items: rows.map((r) => ({ ...r, status: getVariantStockStatus(r.stock, r.lowStockThreshold) })),
    total,
    page,
    pageCount,
  };
}

/** Counts for the filter tabs (ignores the search box). */
export async function inventorySummary(sellerId: string, productId?: string) {
  const [row] = await prisma.$queryRaw<{ total: bigint; low: bigint; out: bigint }[]>`
    SELECT count(*) AS total,
           count(*) FILTER (WHERE ${NEEDS_RESTOCK}) AS low,
           count(*) FILTER (WHERE v."stock" <= 0) AS out
    FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
    WHERE ${baseWhere(sellerId, productId)}`;
  return { total: Number(row.total), low: Number(row.low), out: Number(row.out) };
}

export const HISTORY_LIMIT = 100;

export async function getVariantHistory(sellerId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, sellerId },
    select: {
      id: true,
      color: true,
      size: true,
      sku: true,
      stock: true,
      product: { select: { id: true, name: true, imageUrl: true, lowStockThreshold: true } },
    },
  });
  if (!variant) return null;

  const [movements, totalMovements] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { variantId: variant.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: HISTORY_LIMIT,
      select: { id: true, delta: true, reason: true, note: true, orderId: true, createdAt: true },
    }),
    prisma.stockMovement.count({ where: { variantId: variant.id } }),
  ]);
  return { variant, movements, totalMovements };
}
