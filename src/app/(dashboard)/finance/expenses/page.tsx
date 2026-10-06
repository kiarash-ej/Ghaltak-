import type { Metadata } from "next";
import { BarList } from "@/components/finance/bar-list";
import { ActionButton, EditButton } from "@/components/finance/expense-actions";
import { ExpenseForm } from "@/components/finance/expense-form";
import { FinanceHeader } from "@/components/finance/finance-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber, formatToman } from "@/lib/format";
import { requireOwner } from "@/server/auth";
import { formatJalaliDate } from "@/server/exports/jalali";
import {
  addExpenseAction,
  removeExpenseAction,
  resumeRepeatAction,
  stopRepeatAction,
  updateExpenseAction,
  updateRepeatAction,
} from "@/server/finance/expense-actions";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from "@/server/finance/expense-categories";
import { ensureRecurringExpenses, listExpenses, listRepeats } from "@/server/finance/expenses";
import { parseMonthKey } from "@/server/finance/months";
import { MONTH_NAMES, resolveFinanceRange } from "@/server/finance/periods";

// «هزینه‌ها» (spec §6.4): quick add (with «هر ماه تکرار شود»), totals by
// category, the period's expenses with edit and remove, and the monthly
// repeats with stop and resume. The owner's only (a 404 for operators).

export const metadata: Metadata = { title: "هزینه‌ها | مالی و گزارش | غلتک" };

const persianDigits = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
/** A stored Tehran day ("2026-10-06") as the form writes it («۱۴۰۵/۰۷/۱۴»). */
const jalaliText = (dayKey: string) => persianDigits(formatJalaliDate(new Date(`${dayKey}T08:30:00Z`)));
const monthName = (key: string) => {
  const m = parseMonthKey(key);
  return m ? `${MONTH_NAMES[m.month - 1]} ${formatNumber(m.year).replace(/٬/g, "")}` : key;
};

export default async function ExpensesPage(props: PageProps<"/finance/expenses">) {
  const owner = await requireOwner();
  const now = new Date();
  const { range, error } = resolveFinanceRange(await props.searchParams, now);
  await ensureRecurringExpenses(owner.id, now);
  const [expenses, repeats] = await Promise.all([listExpenses(owner.id, range.from, range.to), listRepeats(owner.id)]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = EXPENSE_CATEGORIES.map((c) => {
    const rows = expenses.filter((e) => e.category === c);
    return { key: c, label: CATEGORY_LABELS[c], value: rows.reduce((s, e) => s + e.amount, 0), count: rows.length };
  })
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const today = persianDigits(formatJalaliDate(now));

  return (
    <div className="flex flex-col gap-6">
      <FinanceHeader basePath="/finance/expenses" range={range} error={error} isOwner />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>ثبت هزینه</CardTitle>
            <CardDescription>هر خرجی برای کار: تبلیغ، بسته‌بندی، پیک، اجاره… تا سود خالص درست حساب شود.</CardDescription>
          </CardHeader>
          <CardContent>
            <ExpenseForm action={addExpenseAction} initial={{ date: today }} mode="add" idPrefix="add" />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>هزینه‌ها به تفکیک</CardTitle>
            <CardDescription>{range.label}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              جمع: <span className="text-lg font-black text-ink">{formatToman(total)}</span>
            </p>
            <BarList
              empty="در این بازه هزینه‌ای ثبت نشده است."
              items={byCategory.map((c) => ({ key: c.key, label: c.label, value: c.value, display: formatToman(c.value), sub: `${formatNumber(c.count)} مورد` }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>هزینه‌های این بازه</CardTitle>
          <CardDescription>{range.label}، تازه‌ترین بالا</CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted">در این بازه هزینه‌ای ثبت نشده است.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {expenses.map((e) => {
                const date = formatDate(new Date(`${e.spentOn}T08:30:00Z`));
                const label = `${CATEGORY_LABELS[e.category]}، ${date}`;
                return (
                  <li key={e.id} data-expense={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{CATEGORY_LABELS[e.category]}</span>
                        {e.repeat && <Badge>ماهانه</Badge>}
                      </span>
                      <span className="truncate text-xs text-muted">
                        {date}
                        {e.note && <> · {e.note}</>}
                      </span>
                    </div>
                    <span className="whitespace-nowrap font-bold tabular-nums">{formatToman(e.amount)}</span>
                    <div className="flex shrink-0">
                      <EditButton
                        title="ویرایش هزینه"
                        label={label}
                        action={updateExpenseAction.bind(null, e.id)}
                        initial={{ amount: e.amount, category: e.category, date: jalaliText(e.spentOn), note: e.note }}
                        mode="edit"
                        idPrefix={`edit-${e.id}`}
                      />
                      <ActionButton
                        action={removeExpenseAction.bind(null, e.id)}
                        label={`حذف ${label}`}
                        icon="remove"
                        confirm={e.repeat ? "این ماهِ هزینهٔ ماهانه حذف شود؟ ماه‌های دیگر سر جایشان می‌مانند." : "این هزینه حذف شود؟"}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>هزینه‌های ماهانه</CardTitle>
          <CardDescription>هر ماه در روز خودش خودکار ثبت می‌شوند. تغییر مبلغ از ماه بعد اثر دارد؛ ماه‌های ثبت‌شده را در فهرست بالا ویرایش کنید.</CardDescription>
        </CardHeader>
        <CardContent>
          {repeats.length === 0 ? (
            <p className="text-sm text-muted">هزینهٔ ماهانه‌ای ندارید. هنگام ثبت هزینه، «هر ماه تکرار شود» را بزنید.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {repeats.map((r) => {
                const label = `${CATEGORY_LABELS[r.category]}${r.note ? ` (${r.note})` : ""}`;
                return (
                  <li key={r.id} data-repeat={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{label}</span>
                        {r.endMonth === null ? <Badge variant="success">فعال</Badge> : <Badge>متوقف</Badge>}
                      </span>
                      <span className="text-xs text-muted">
                        هر ماه روز {formatNumber(r.dayOfMonth)} · از {monthName(r.startMonth)}
                        {r.endMonth !== null && <> تا {monthName(r.endMonth)}</>}
                      </span>
                    </div>
                    <span className="whitespace-nowrap font-bold tabular-nums">{formatToman(r.amount)}</span>
                    <div className="flex shrink-0">
                      <EditButton
                        title="ویرایش هزینهٔ ماهانه"
                        label={label}
                        action={updateRepeatAction.bind(null, r.id)}
                        initial={{ amount: r.amount, category: r.category, day: r.dayOfMonth, note: r.note }}
                        mode="repeat"
                        idPrefix={`repeat-${r.id}`}
                      />
                      {r.endMonth === null ? (
                        <ActionButton
                          action={stopRepeatAction.bind(null, r.id)}
                          label={`توقف ${label}`}
                          icon="stop"
                          confirm="از این به بعد دیگر ثبت نشود؟ ماه‌های ثبت‌شده می‌مانند."
                        />
                      ) : (
                        <ActionButton action={resumeRepeatAction.bind(null, r.id)} label={`ادامهٔ ${label}`} icon="resume" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
