import "server-only";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { jalaliOfInstant } from "./periods";
import { dueMonths } from "./months";
import { dayKeys } from "./summary";

// Expenses (spec §6.1, §6.4). Owner only: callers check the role (A10).
//
// Monthly repeats are stored as a template (RecurringExpense) and turned into
// ordinary Expense rows lazily, whenever finance or the owner's Home loads:
// one row per month, on its day, once that day has come. The unique
// (recurringExpenseId, monthKey) plus skipDuplicates means two loads at once
// can't create a month twice; a removed month is voided, not deleted, so it
// is never created again.

/** Creates the rows every repeat is owed by `now`. Returns how many were created. */
export async function ensureRecurringExpenses(sellerId: string, now = new Date()): Promise<number> {
  const repeats = await prisma.recurringExpense.findMany({
    where: { sellerId },
    select: { id: true, category: true, amount: true, note: true, dayOfMonth: true, startMonth: true, endMonth: true },
  });
  if (repeats.length === 0) return 0;
  const today = jalaliOfInstant(now);
  const existing = await prisma.expense.findMany({
    where: { sellerId, recurringExpenseId: { in: repeats.map((r) => r.id) } },
    select: { recurringExpenseId: true, monthKey: true },
  });
  const have = new Set(existing.map((e) => `${e.recurringExpenseId}:${e.monthKey}`));
  const rows = repeats.flatMap((r) =>
    dueMonths(r, today)
      .filter((d) => !have.has(`${r.id}:${d.monthKey}`))
      .map((d) => ({
        sellerId,
        category: r.category,
        amount: r.amount,
        note: r.note,
        spentOn: new Date(`${d.spentOn}T00:00:00Z`),
        recurringExpenseId: r.id,
        monthKey: d.monthKey,
      })),
  );
  if (rows.length === 0) return 0;
  const { count } = await prisma.expense.createMany({ data: rows, skipDuplicates: true });
  return count;
}

export type ExpenseRow = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  /** Gregorian day key of the Tehran day ("2026-10-04"). */
  spentOn: string;
  note: string | null;
  /** Made by a monthly repeat. */
  repeat: boolean;
};

/** The period's expenses, newest first (removed months left out). */
export async function listExpenses(sellerId: string, from: Date, to: Date): Promise<ExpenseRow[]> {
  const days = dayKeys(from, to);
  const rows = await prisma.expense.findMany({
    where: {
      sellerId,
      voidedAt: null,
      spentOn: { gte: new Date(`${days.first}T00:00:00Z`), lte: new Date(`${days.last}T00:00:00Z`) },
    },
    orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }],
    select: { id: true, category: true, amount: true, spentOn: true, note: true, monthKey: true },
  });
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    amount: r.amount,
    spentOn: r.spentOn.toISOString().slice(0, 10),
    note: r.note,
    repeat: r.monthKey !== null,
  }));
}

export type RepeatRow = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  note: string | null;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
};

export async function listRepeats(sellerId: string): Promise<RepeatRow[]> {
  return prisma.recurringExpense.findMany({
    where: { sellerId },
    orderBy: [{ endMonth: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    select: { id: true, category: true, amount: true, note: true, dayOfMonth: true, startMonth: true, endMonth: true },
  });
}
