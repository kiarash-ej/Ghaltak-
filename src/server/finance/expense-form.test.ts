import { describe, expect, it } from "vitest";
import { parseExpenseForm } from "./expense-form";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("parseExpenseForm", () => {
  it("reads Persian digits, separators and a Jalali date", () => {
    expect(parseExpenseForm(form({ amount: "۱٬۸۰۰٬۰۰۰", category: "ADS", date: "۱۴۰۵/۷/۱۲", note: " استوری اینستاگرام ", repeat: "on" }))).toEqual({
      ok: true,
      data: { amount: 1_800_000, category: "ADS", date: { year: 1405, month: 7, day: 12 }, note: "استوری اینستاگرام", repeat: true },
    });
  });

  it("an empty note is no note, and repeat is off unless ticked", () => {
    const parsed = parseExpenseForm(form({ amount: "450000", category: "PACKAGING", date: "1405/07/13", note: "" }));
    expect(parsed).toMatchObject({ ok: true, data: { note: null, repeat: false } });
  });

  it("says what is wrong with each field", () => {
    const parsed = parseExpenseForm(form({ amount: "0", category: "FOOD", date: "1405/07/31", note: "x".repeat(201) }));
    expect(parsed).toEqual({
      ok: false,
      errors: {
        amount: ["مبلغ باید بیشتر از صفر باشد."],
        category: ["نوع هزینه را انتخاب کنید."],
        date: ["تاریخ را مثل ۱۴۰۵/۰۷/۱۴ وارد کنید."],
        note: ["توضیح نباید بیشتر از ۲۰۰ نویسه باشد."],
      },
    });
    expect(parseExpenseForm(form({ amount: "abc", category: "ADS", date: "1405/07/01" }))).toMatchObject({
      ok: false,
      errors: { amount: ["مبلغ را به تومان و با عدد وارد کنید."] },
    });
  });
});
