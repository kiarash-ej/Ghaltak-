import type { ExpenseCategory } from "@/generated/prisma/enums";

// Expense categories and their Persian names (spec §6.1). Pure; safe for client components.

export const EXPENSE_CATEGORIES = ["ADS", "PACKAGING", "SHIPPING", "RENT", "SALARY", "SERVICES", "OTHER"] as const satisfies readonly ExpenseCategory[];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  ADS: "تبلیغات",
  PACKAGING: "بسته‌بندی",
  SHIPPING: "ارسال و پیک",
  RENT: "اجاره",
  SALARY: "حقوق",
  SERVICES: "سرویس‌ها و اشتراک‌ها",
  OTHER: "سایر",
};

export const isExpenseCategory = (v: unknown): v is ExpenseCategory => (EXPENSE_CATEGORIES as readonly unknown[]).includes(v);
