import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import { ensureRecurringExpenses, listExpenses } from "./expenses";

// Monthly repeats become expense rows lazily (spec §6.1), checked by hand.
// now = 2026-10-06 08:30Z, i.e. 14 Mehr 1405 in Tehran.
//
//  repeat  from     to       day  rows owed by 14 Mehr
//  rent    1405-05  —        31   31 Mordad (2026-08-22), 31 Shahrivar (2026-09-22); Mehr's (clamped to 30th) not yet
//  ads     1405-06  1405-06  5    5 Shahrivar (2026-08-27) only: it ended
//  web     1405-07  —        1    1 Mehr (2026-09-23)
//  other   (another seller) 1405-07, day 1: its own row, never ours

const NOW = new Date("2026-10-06T08:30:00Z");

describe.skipIf(!hasTestDatabase)("monthly expenses (database)", () => {
  const runId = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  let sellerId = "";
  let otherSellerId = "";
  let rentId = "";

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { name: "repeats", mobile: `0986${runId}` } })).id;
    otherSellerId = (await prisma.seller.create({ data: { name: "other", mobile: `0987${runId}` } })).id;
    const repeat = (owner: string, category: "RENT" | "ADS" | "SERVICES", amount: number, startMonth: string, dayOfMonth: number, endMonth: string | null = null) =>
      prisma.recurringExpense.create({ data: { sellerId: owner, category, amount, startMonth, dayOfMonth, endMonth } });
    rentId = (await repeat(sellerId, "RENT", 15_000_000, "1405-05", 31)).id;
    await repeat(sellerId, "ADS", 2_000_000, "1405-06", 5, "1405-06");
    await repeat(sellerId, "SERVICES", 300_000, "1405-07", 1);
    await repeat(otherSellerId, "RENT", 9_999, "1405-07", 1);
  });

  afterAll(async () => {
    const sellers = { sellerId: { in: [sellerId, otherSellerId] } };
    await prisma.expense.deleteMany({ where: sellers });
    await prisma.recurringExpense.deleteMany({ where: sellers });
    await prisma.seller.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  });

  const rows = () =>
    prisma.expense.findMany({
      where: { sellerId },
      orderBy: { spentOn: "asc" },
      select: { category: true, amount: true, spentOn: true, monthKey: true, voidedAt: true },
    });

  it("two loads at once still make one row per month, on its (clamped) day", async () => {
    const [a, b] = await Promise.all([ensureRecurringExpenses(sellerId, NOW), ensureRecurringExpenses(sellerId, NOW)]);
    expect(a + b).toBe(4);
    expect((await rows()).map((r) => [r.category, r.monthKey, r.spentOn.toISOString().slice(0, 10)])).toEqual([
      ["RENT", "1405-05", "2026-08-22"],
      ["ADS", "1405-06", "2026-08-27"],
      ["RENT", "1405-06", "2026-09-22"],
      ["SERVICES", "1405-07", "2026-09-23"],
    ]);
    expect(await ensureRecurringExpenses(sellerId, NOW)).toBe(0);
    expect(await prisma.expense.count({ where: { sellerId: otherSellerId } })).toBe(0);
  });

  it("a removed month is voided and never made again", async () => {
    await prisma.expense.updateMany({ where: { recurringExpenseId: rentId, monthKey: "1405-05" }, data: { voidedAt: new Date() } });
    expect(await ensureRecurringExpenses(sellerId, NOW)).toBe(0);
    expect((await rows()).filter((r) => r.monthKey === "1405-05")).toHaveLength(1);
  });

  it("this month's row comes once its day arrives (the 31st is the 30th in Mehr)", async () => {
    expect(await ensureRecurringExpenses(sellerId, new Date("2026-10-21T08:30:00Z"))).toBe(0); // 29 Mehr
    expect(await ensureRecurringExpenses(sellerId, new Date("2026-10-22T08:30:00Z"))).toBe(1); // 30 Mehr
    const rent = await prisma.expense.findFirstOrThrow({ where: { recurringExpenseId: rentId, monthKey: "1405-07" } });
    expect([rent.spentOn.toISOString().slice(0, 10), rent.amount]).toEqual(["2026-10-22", 15_000_000]);
  });

  it("lists the period's expenses newest first, leaving out removed months", async () => {
    // Shahrivar 1405: 1 Shahrivar 00:00 → 1 Mehr 00:00 Tehran.
    const list = await listExpenses(sellerId, new Date("2026-08-22T20:30:00Z"), new Date("2026-09-22T20:30:00Z"));
    expect(list.map((e) => [e.category, e.spentOn, e.repeat])).toEqual([
      ["RENT", "2026-09-22", true],
      ["ADS", "2026-08-27", true],
    ]);
  });
});
