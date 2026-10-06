"use server";

import { revalidatePath } from "next/cache";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/server/auth";
import { parseWholeNumber, MAX_PRICE } from "@/server/catalog/product-form";
import { isExpenseCategory } from "./expense-categories";
import { parseExpenseForm, type ExpenseFormState } from "./expense-form";
import { ensureRecurringExpenses } from "./expenses";
import { gregorianKey, monthKey, stopRepeat } from "./months";
import { jalaliOfInstant } from "./periods";

// Expenses and monthly repeats (spec §6.1, §6.4). The owner's only: every
// action checks requireOwner() itself, and every write is scoped by the seller.

const refresh = () => {
  revalidatePath("/finance", "layout");
  revalidatePath("/");
};

/** «ثبت هزینه»: a one-off expense, or a repeat from that date's month on (past months included). */
export async function addExpenseAction(_prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const owner = await requireOwner();
  const parsed = parseExpenseForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };
  const { amount, category, date, note, repeat } = parsed.data;
  if (repeat) {
    await prisma.recurringExpense.create({
      data: { sellerId: owner.id, category, amount, note, dayOfMonth: date.day, startMonth: monthKey(date) },
    });
    await ensureRecurringExpenses(owner.id);
  } else {
    await prisma.expense.create({
      data: { sellerId: owner.id, category, amount, note, spentOn: new Date(`${gregorianKey(date)}T00:00:00Z`) },
    });
  }
  refresh();
  return { ok: true, message: repeat ? "هزینهٔ ماهانه ثبت شد." : "هزینه ثبت شد." };
}

/** Edits one expense row; for a month of a repeat, that month only. */
export async function updateExpenseAction(id: string, _prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const owner = await requireOwner();
  const parsed = parseExpenseForm(formData);
  if (!parsed.ok) return { errors: parsed.errors };
  const { amount, category, date, note } = parsed.data;
  const { count } = await prisma.expense.updateMany({
    where: { id, sellerId: owner.id, voidedAt: null },
    data: { amount, category, note, spentOn: new Date(`${gregorianKey(date)}T00:00:00Z`) },
  });
  if (count === 0) return { message: "این هزینه پیدا نشد؛ شاید حذف شده باشد." };
  refresh();
  return { ok: true, message: "ذخیره شد." };
}

/** Removes an expense. A month made by a repeat is voided instead, so it isn't made again. */
export async function removeExpenseAction(id: string): Promise<void> {
  const owner = await requireOwner();
  const row = await prisma.expense.findFirst({ where: { id, sellerId: owner.id }, select: { monthKey: true } });
  if (!row) return;
  if (row.monthKey !== null) {
    await prisma.expense.updateMany({ where: { id, sellerId: owner.id }, data: { voidedAt: new Date() } });
  } else {
    await prisma.expense.deleteMany({ where: { id, sellerId: owner.id } });
  }
  refresh();
}

/** Edits a repeat: amount, category, note and day. Months already made keep their numbers. */
export async function updateRepeatAction(id: string, _prev: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const owner = await requireOwner();
  const amount = parseWholeNumber(formData.get("amount"));
  const day = parseWholeNumber(formData.get("day"));
  const category = formData.get("category");
  const note = String(formData.get("note") ?? "").trim();
  const errors: Record<string, string[]> = {};
  if (amount === null || amount < 1 || amount > MAX_PRICE) errors.amount = ["مبلغ را به تومان و با عدد وارد کنید."];
  if (day === null || day < 1 || day > 31) errors.day = ["روز ماه عددی از ۱ تا ۳۱ است."];
  if (!isExpenseCategory(category)) errors.category = ["نوع هزینه را انتخاب کنید."];
  if (note.length > 200) errors.note = ["توضیح نباید بیشتر از ۲۰۰ نویسه باشد."];
  if (Object.keys(errors).length > 0) return { errors };
  const { count } = await prisma.recurringExpense.updateMany({
    where: { id, sellerId: owner.id },
    data: { amount: amount!, dayOfMonth: day!, category: category as ExpenseCategory, note: note || null },
  });
  if (count === 0) return { message: "این هزینهٔ ماهانه پیدا نشد." };
  await ensureRecurringExpenses(owner.id);
  refresh();
  return { ok: true, message: "ذخیره شد؛ از ماه بعد با این مبلغ حساب می‌شود." };
}

/** «توقف»: no more months after the last one already made (or due today). */
export async function stopRepeatAction(id: string): Promise<void> {
  const owner = await requireOwner();
  const repeat = await prisma.recurringExpense.findFirst({ where: { id, sellerId: owner.id } });
  if (!repeat) return;
  await ensureRecurringExpenses(owner.id);
  const today = jalaliOfInstant(new Date());
  const [thisMonth, any] = await Promise.all([
    prisma.expense.count({ where: { recurringExpenseId: id, sellerId: owner.id, monthKey: monthKey(today) } }),
    prisma.expense.count({ where: { recurringExpenseId: id, sellerId: owner.id } }),
  ]);
  const stop = stopRepeat(repeat, today, { thisMonth: thisMonth > 0, any: any > 0 });
  if ("delete" in stop) {
    await prisma.recurringExpense.deleteMany({ where: { id, sellerId: owner.id } });
  } else {
    await prisma.recurringExpense.updateMany({ where: { id, sellerId: owner.id }, data: { endMonth: stop.endMonth } });
  }
  refresh();
}

/** «ادامه»: starts again from this month; the stopped months stay empty. */
export async function resumeRepeatAction(id: string): Promise<void> {
  const owner = await requireOwner();
  const today = jalaliOfInstant(new Date());
  await prisma.recurringExpense.updateMany({
    where: { id, sellerId: owner.id, endMonth: { not: null } },
    data: { startMonth: monthKey(today), endMonth: null },
  });
  await ensureRecurringExpenses(owner.id);
  refresh();
}
