import type { ExpenseCategory } from "@/generated/prisma/enums";
import { parseWholeNumber, MAX_PRICE, type FieldErrors } from "@/server/catalog/product-form";
import { parseJalaliDate, type JalaliDate } from "@/server/exports/jalali";
import { isExpenseCategory } from "./expense-categories";

// The expense form (spec §6.4, Expenses tab): amount, category, a Jalali
// date, a note, and «هر ماه تکرار شود». Pure, no database.

export type ExpenseInput = { amount: number; category: ExpenseCategory; date: JalaliDate; note: string | null; repeat: boolean };
export type ExpenseFormState = { ok?: boolean; errors?: FieldErrors; message?: string } | undefined;

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export function parseExpenseForm(form: FormData): { ok: true; data: ExpenseInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const amount = parseWholeNumber(form.get("amount"));
  if (amount === null) errors.amount = ["مبلغ را به تومان و با عدد وارد کنید."];
  else if (amount < 1) errors.amount = ["مبلغ باید بیشتر از صفر باشد."];
  else if (amount > MAX_PRICE) errors.amount = ["مبلغ بیش از حد مجاز است."];

  const category = form.get("category");
  if (!isExpenseCategory(category)) errors.category = ["نوع هزینه را انتخاب کنید."];

  const date = parseJalaliDate(text(form.get("date")));
  if (!date) errors.date = ["تاریخ را مثل ۱۴۰۵/۰۷/۱۴ وارد کنید."];

  const note = text(form.get("note"));
  if (note.length > 200) errors.note = ["توضیح نباید بیشتر از ۲۰۰ نویسه باشد."];

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: { amount: amount!, category: category as ExpenseCategory, date: date!, note: note || null, repeat: form.get("repeat") === "on" },
  };
}
