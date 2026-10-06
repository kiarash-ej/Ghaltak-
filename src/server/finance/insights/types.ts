import type { FinanceTotals } from "../summary";

// The advice engine's shapes (spec §6.5). Owner only: facts and insights
// carry money.

export type InsightTone = "good" | "warn" | "tip";

export type Insight = {
  /** Stable id, one per rule («sales-trend»), so the page and tests can find it. */
  id: string;
  /** The rule's number in spec §6.5, the last tie-breaker when ranking. */
  rule: number;
  tone: InsightTone;
  title: string;
  body: string;
  /** Roughly how many tomans this is worth acting on, where that can be said. */
  impactToman?: number;
  action?: { label: string; href: string };
};

/** One product's sales in the period and the one before (sale orders only). */
export type ProductFacts = {
  productId: string;
  name: string;
  sales: number;
  units: number;
  /** Sales and cost of the lines that have a cost. */
  costedSales: number;
  cogs: number;
  previousSales: number;
  /** Units on orders placed in the period that were returned. */
  returnedUnits: number;
};

/** A variant of a best-selling product: how fast it sells and what is left. */
export type StockFacts = {
  variantId: string;
  productId: string;
  name: string;
  color: string | null;
  size: string | null;
  stock: number;
  /** Units of this variant sold in the last 30 days. */
  units30: number;
  /** Units of its product sold in the last 30 days (top-5 products only). */
  productUnits30: number;
};

export type LinkFacts = { linkId: string; title: string | null; views: number; paid: number };

export type InsightFacts = {
  /** «این ماه (مهر)» and «همین بازه در شهریور», for the texts. */
  label: string;
  compareLabel: string;
  current: FinanceTotals;
  previous: FinanceTotals;
  /** Products sold in either period, by sales in this period (largest first). */
  products: ProductFacts[];
  /** Ads expenses dated in the period. */
  adsExpenses: number;
  /** Orders waiting for payment for more than 48 hours (not tied to the period). */
  staleUnpaid: { orders: number; amount: number; withReceipt: number };
  /** Variants of the top-5 products by units over the last 30 days. */
  stock: StockFacts[];
  /** Active purchase links, this Jalali month. */
  links: LinkFacts[];
  /** People who bought in the period; returning = bought before it too. */
  customers: { buyers: number; returningBuyers: number; returningSales: number };
  /** Sales by Tehran weekday over the last 8 full weeks, Saturday first. */
  weekdays: { sales: number[]; orders: number; daysSinceFirstSale: number | null };
};
