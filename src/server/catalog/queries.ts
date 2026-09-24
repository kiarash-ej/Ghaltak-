import "server-only";
import { prisma } from "@/lib/prisma";
import { getStockStatus, type StockStatus } from "./stock-status";

// Every function takes the sellerId from requireSeller() and scopes by it.

export const PAGE_SIZE = 20;

export type ProductListItem = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  variantCount: number;
  totalStock: number;
  stockStatus: StockStatus;
};

export type ProductListResult = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listProducts(
  sellerId: string,
  opts: { q?: string; category?: string; page?: number },
): Promise<ProductListResult> {
  const q = opts.q?.trim();
  const where = {
    sellerId,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    ...(opts.category ? { category: opts.category } : {}),
  };

  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page ?? 1), pageCount);

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      imageUrl: true,
      isActive: true,
      lowStockThreshold: true,
      variants: { select: { stock: true } },
    },
  });

  const items = products.map((p) => {
    const stocks = p.variants.map((v) => v.stock);
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      imageUrl: p.imageUrl,
      isActive: p.isActive,
      variantCount: stocks.length,
      totalStock: stocks.reduce((a, b) => a + b, 0),
      stockStatus: getStockStatus(stocks, p.lowStockThreshold),
    };
  });

  return { items, total, page, pageCount };
}

export async function getProduct(sellerId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, sellerId },
    include: { variants: { orderBy: { id: "asc" } } },
  });
}

export async function listCategories(sellerId: string): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { sellerId, category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.flatMap((r) => (r.category ? [r.category] : []));
}
