# Ghaltak UI overhaul and finance section: design

**Status:** approved in brainstorming (2026-10-06), awaiting written-spec review.
**Owner:** Track B (Person B), with reviews from Person A and Person C for the files in their folders.
**Why now:** competitors are appearing. The product works; it now has to look and feel like the best option, and give sellers a real picture of their money.

Mockups from the brainstorming session (open in a browser; they use the brand logo and Vazirmatn):
- `.superpowers/brainstorm/400-1791231416/content/direction-c-refined-v2.html`: the chosen look, desktop and phone.
- `.superpowers/brainstorm/400-1791231416/content/finance-layout.html`: finance overview, layout **B** chosen.
- `.superpowers/brainstorm/400-1791231416/content/daily-brief-motion.html`: daily brief option **1** chosen, plus finance motion.

`.superpowers/` is not committed (it is in `.gitignore`); the decisions below are the source of truth.

---

## 1. Decisions

| Topic | Decision |
|---|---|
| Order of work | Foundation first: design system and shell, then finance, then deeper per-page work |
| Look | Full dark navy with the Ghaltak fire gradient and the real logo symbol |
| Navigation | Grouped sidebar on desktop. Phone: bottom bar with Home, Orders, ➕, Products and stock, Purchase links; ☰ for the rest |
| Handiest features | Orders, purchase links, products and stock (chosen by the owner) |
| Profit | Cost price per product, copied onto order lines, plus expenses with monthly repeats |
| Finance overview | Layout B: six headline numbers each with a ؟ explanation, daily chart, advice list |
| Daily brief | Inline card on Home on the first visit of the Tehran day, folds into a one-line pill |
| Period recaps | Every Jalali month, season (فصل) and year, as a recap on Home and as an archive in finance |
| Period reports | Printable A4 page per period, saved as PDF from the browser |
| Motion | Count-ups, staggered rise, self-drawing charts, sliding tab highlight; off under reduced motion |
| Approach | Design tokens + rebuilt component kit + a hand-finished design pass on every page; Radix primitives (Dialog, Popover) only for complex interactive pieces; hand-made SVG charts |
| Advice engine | Rules over the seller's own data. No runtime AI or foreign service (project rule 7, Iran connectivity) |

## 2. Out of scope

- Customer-facing pages (`/buy`, `/buy/order`, `/pay`) and all print pages keep their light look.
- The public landing page and `/help` keep their own theme (`marketing.module.css`).
- A light theme for the dashboard. Tokens make it a later value swap, but it is not built now.
- Net-profit accounting beyond sales, cost of goods and expenses (no taxes, depreciation, inventory valuation).
- CSV export of finance (the owner chose printable pages; C6 already exports orders).

---

## 3. Design system

### 3.1 Colour roles
Defined once as CSS variables in `src/app/globals.css`, scoped to the dashboard (a `data-app-theme="dark"` attribute on the dashboard layout root), and exposed to Tailwind through `@theme inline`. Pages use role names (`bg-raised`, `text-muted`, `border-line`), never raw greys.

| Role | Value | Use |
|---|---|---|
| `bg` | `#0B1020` | page background |
| `sidebar` | `#0E1424` | sidebar, top bar, bottom bar |
| `raised` | `#121A30` | cards, tiles, rows |
| `raised-2` | `#1A2340` | active tab, hover, inputs |
| `line` | `#1D2740` | borders, dividers |
| `ink` | `#E7EDF6` | main text |
| `muted` | `#8A97AE` | secondary text |
| `faint` | `#5E6B84` | group labels, placeholders |
| `brand-1..4` | `#FFB000` `#FF5A1F` `#E8283F` `#C2185B` | the fire gradient, in that order |
| `success` | text `#6EE7B7`, bg `#0F3A2C` | up trends, paid |
| `warning` | text `#FFC069`, bg `#3A2A12` | receipts waiting, low stock |
| `danger` | text `#FF8FA0`, bg `#3A1621` | unpaid, returns, destructive |
| `info` | text `#B5C2D5`, bg `#1E2944` | neutral pills |

- Gradients: `brand` (90°, orange → red → magenta) for primary buttons; `brand-glow` (radial orange top corner + magenta bottom corner over `raised`) for hero cards; `brand-text` for highlighted numbers.
- Every text/background pair meets WCAG AA (4.5:1 body, 3:1 large). Checked with axe in the C7 way before each phase ships.
- `color-scheme: dark` on the dashboard root so native inputs, selects and scrollbars match.
- Print pages and customer pages declare the light scope explicitly, so nothing dark leaks onto paper.

### 3.2 Type
- Vazirmatn (already self-hosted through `@fontsource-variable/vazirmatn`). No new font downloads.
- Weights: 400 body, 600 labels, 800 headings, 900 big numbers.
- Numbers use tabular figures (`font-feature-settings: "tnum"`) so columns and count-ups don't jitter.
- Scale: 12 / 13 / 14 / 16 / 20 / 24 / 32 px.

### 3.3 Brand assets
From the owner's kit (`GHALTAK_brand_assets.zip`), produce web-ready files in `public/brand/` and `src/app/`:
- Logo symbol at 256 px (trimmed PNG; `next/image` serves WebP/AVIF at the sizes each page asks for), from `logo_symbol_only.png` (1600 px master). `scripts/brand-assets.mjs` regenerates every file from the kit.
- Logo with name and text-only logo for wide places.
- Favicons and app icons from `web_icon_*` and `app_icon_dark` / `app_icon_light`; `manifest.ts` uses the dark icon.
- Masters stay out of the repo (931 KB symbol); only the resized files are committed.

### 3.4 Component kit (`src/components/ui/`)
Rebuilt on the colour roles. Existing names and props are kept where they exist, so pages keep compiling.

| Component | Notes |
|---|---|
| `Button` | variants: `primary` (gradient), `secondary`, `ghost`, `danger`; sizes sm / md / lg; loading state |
| `Card`, `CardHeader`, `CardTitle`… | `raised` surface; `hero` variant with `brand-glow`; `CardTitle` heading level is a prop (fixes C7 #52) |
| `Badge` / `Pill` | tones: success, warning, danger, info, brand; count badge for nav |
| `Input`, `Select`, `Label`, `Field` | dark fields, visible focus ring in brand orange, error text slot |
| `Stat` | label, value (count-up), unit, delta vs previous period, optional ؟ |
| `NavTabs` | tabs that are pages (finance tabs, products/stock): plain links with the sliding highlight, `aria-current` on the active one |
| `Explain` (؟) | Radix Popover; text comes from the finance glossary |
| `Sheet` | Radix Dialog as a bottom sheet (phone) or side panel (desktop): ➕ quick actions, ☰ menu |
| `Skeleton` | loading placeholders matching each card shape |
| `EmptyState` | icon, one sentence, one action |
| `Sparkline`, `BarChart`, `LineChart`, `ProfitBreakdown` | hand-made SVG, server-rendered, animated with CSS |

- New dependencies: the Radix packages for Dialog and Popover only (tabs are page links, so they need no Radix). `lucide-react` (already installed) for icons.
- A dev-only page `/dev/ui` (404 in production, same guard style as the fake gateway) renders every component in every state for review.

### 3.5 Motion
- Easing `cubic-bezier(.2,.8,.2,1)`; durations 150 to 600 ms; count-ups 1.1 s ease-out.
- Patterns: count-up numbers; cards rise in with a 50 to 70 ms stagger; bars grow from the baseline; chart lines draw themselves (stroke-dashoffset), then the area fades in and the latest point pops; the tab highlight slides; one soft sheen across the daily brief when it appears.
- Progressive enhancement: the server renders final values; animation only runs on first mount; numbers carry their final value in `aria-label`.
- `prefers-reduced-motion: reduce` turns every animation off (no transforms, no count-ups).
- Charts are pure SVG + CSS. The only client JavaScript for motion is a small count-up component and the tab highlight.

---

## 4. Shell and navigation

### 4.1 Desktop sidebar
Logo symbol + «غلتک», store name, then:
1. **خانه** (Home)
2. **سفارش‌ها** (Orders), badge: orders waiting for action (paid not shipped + receipts waiting)
3. **محصولات و موجودی** (Products and stock), badge: variants at or below their low-stock threshold
4. **لینک‌های خرید** (Purchase links)

Group «کسب‌وکار»:
5. **مالی و گزارش** (Finance; owner sees money, operator sees counts)
6. **مشتریان** (Customers)
7. **تنظیمات** (Settings)

Then the store switcher (A10, when the member has more than one store) and «خروج».
Active item: brand-tinted background, inline-end accent bar in `brand-2`, icon in brand orange.

### 4.2 Phone
- **Bottom bar** (fixed, 64 px plus safe area, 44 px+ touch targets): خانه · سفارش‌ها · ➕ · محصولات · لینک‌ها. The active tab has a gradient indicator; badges as on desktop.
- **➕** opens a bottom sheet: سفارش جدید · لینک خرید جدید · محصول جدید · ثبت هزینه (owner only).
- **Top bar:** logo, bell (opens the "needs attention" list, dot when anything is waiting), ☰ (drawer with Finance, Customers, Settings, store switcher, logout).

### 4.3 Products and stock merge
One nav entry. `/products` gets a segmented control «محصولات | موجودی» that switches between the existing products list and inventory list (both pages stay, the control links between them). No URL changes for existing links.

### 4.4 Badges
Counts come from one cheap query per request in the dashboard layout, scoped by `sellerId`, reusing existing definitions (`isReceiptPending` / `countPendingReceipts`, `READY_TO_SHIP`, Track A's low-stock rule).

---

## 5. Home

Order of blocks:
1. Greeting (time of day) and date.
2. **Daily brief or period recap** card (section 7), or the C5 start checklist while it is incomplete (the checklist wins; a new store has no history to brief).
3. Today's tiles: sales today (owner) or orders today (operator), orders today, net profit this month (owner).
4. **نیاز به رسیدگی** (needs attention): each row has a one-click action: receipts waiting → review; ready to ship → print sheets (B9); low stock on a best seller → add stock; unpaid over 2 days → open orders filtered.
5. Link to `/help` (C5).

The primary action «سفارش جدید» sits top-end on desktop; on phone it's in ➕.

---

## 6. Finance

### 6.1 Data model (one schema PR, coordinated with Track A)

```prisma
model Product {
  // ...existing fields
  costPrice Int? // tomans; optional purchase cost per unit
}

model OrderItem {
  // ...existing fields
  unitCost Int? // tomans; Product.costPrice copied when the order is placed
}

enum ExpenseCategory { ADS PACKAGING SHIPPING RENT SALARY SERVICES OTHER }

model Expense {
  id                 String          @id @default(cuid())
  sellerId           String
  seller             Seller          @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  category           ExpenseCategory
  amount             Int             // tomans, > 0
  spentOn            DateTime        @db.Date // Tehran calendar day
  note               String?
  recurringExpenseId String?
  recurringExpense   RecurringExpense? @relation(fields: [recurringExpenseId], references: [id], onDelete: SetNull)
  monthKey           String?         // "1405-07" for rows created from a repeat
  voidedAt           DateTime?       // a repeat's month the seller removed; counts as 0, never recreated
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  @@unique([recurringExpenseId, monthKey])
  @@index([sellerId, spentOn])
}

model RecurringExpense {
  id         String          @id @default(cuid())
  sellerId   String
  seller     Seller          @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  category   ExpenseCategory
  amount     Int
  note       String?
  dayOfMonth Int             // 1..31, clamped to the month's length
  startMonth String          // "1405-07"
  endMonth   String?         // last month included; null = until stopped
  createdAt  DateTime        @default(now())
  expenses   Expense[]

  @@index([sellerId])
}
```

- **Copying cost onto order lines:** `create-order.ts` (manual) and `link-order.ts` (purchase link) set `unitCost` from `product.costPrice` in the same transaction that creates the items.
- **Adding a cost later:** saving a cost on a product that has sold lines with `unitCost = null` offers «برای فروش‌های قبلی هم استفاده شود؟». Yes updates only this seller's null lines of that product. Lines that already have a cost are never changed.
- **Repeats:** `ensureRecurringExpenses(sellerId, now)` runs lazily when finance or the owner's Home loads. For each active repeat it creates the missing months from `startMonth` to the current month, dated on `dayOfMonth` (clamped), but only months whose day has arrived. `createMany` with `skipDuplicates` plus the unique `(recurringExpenseId, monthKey)` means two simultaneous loads can't double-count. Removing a generated month sets `voidedAt` instead of deleting, so it isn't recreated. Editing a repeat affects future months only; editing a month's row affects that month only.
- `docs/phase2/DEPLOY.md` §10 store-deletion SQL and its test must include `Expense` and `RecurringExpense` (they cascade from `Seller`; the test already fails if a new seller-linked table is missed).

### 6.2 Definitions (`src/server/finance/definitions.ts`, also the ؟ texts)

| Number | Definition |
|---|---|
| فروش (sales) | Orders in `SALE_STATUSES` (B5), items only (no shipping), by the Tehran day the order was placed |
| بهای کالای فروش‌رفته (cost of goods) | Σ `unitCost × quantity` over sale orders' lines that have a cost |
| پوشش قیمت خرید (cost coverage) | Sales of lines with a cost ÷ all sales |
| سود ناخالص (gross profit) | Sales − cost of goods |
| هزینه‌ها (expenses) | Σ non-voided `Expense.amount` with `spentOn` in the period |
| سود خالص (net profit) | Gross profit − expenses |
| حاشیهٔ سود (margin) | Net profit ÷ sales |
| سفارش‌های پرداخت‌شده | Count of sale orders |
| میانگین هر سفارش (AOV) | Sales ÷ sale orders |
| نرخ مرجوعی (return rate) | RETURNED ÷ (sale orders + RETURNED), placed in the period |
| نرخ لغو | CANCELED ÷ all orders placed in the period |
| پرداخت‌نشده (unpaid) | `amountDue` of orders still `PENDING_PAYMENT` (current, not period-bound) |

- **Missing costs are never guessed.** When coverage < 100%, profit numbers show «بر اساس ۷۸٪ فروش». Below 90% the cost-coverage advice (rule 4) is pinned above all other advice, because every profit figure depends on it.
- **Comparison:** each period is compared with the previous period of the same length, aligned to its start (first 13 days of Mehr vs first 13 days of Shahrivar; a custom range vs the equal range just before it).
- All aggregation is in SQL, scoped by `sellerId`, with Tehran days, like `src/server/reports/queries.ts`.

### 6.3 Periods (`src/server/finance/periods.ts`, pure)
- Presets: امروز · این هفته (from Saturday) · این ماه · ماه قبل · این فصل · امسال · بازهٔ دلخواه (two Jalali dates, using C6's `parseJalaliDate`).
- Seasons: بهار months 1–3, تابستان 4–6, پاییز 7–9, زمستان 10–12. Year: 1 Farvardin to the end of Esfand (leap years handled through the Intl Persian calendar, as in C6's `jalali.ts`).
- Period keys for URLs: month `1405-07`, season `1405-s3`, year `1405`.

### 6.4 Pages (`/finance`, owner sees money)
`/reports` redirects to `/finance`. Header: title, period chips, tabs.

1. **خلاصه (Overview).** Layout B:
   - Six `Stat`s, each with ؟: فروش, سود خالص, حاشیهٔ سود, سفارش‌های پرداخت‌شده, میانگین هر سفارش, نرخ مرجوعی. Each shows its delta vs the previous period.
   - A daily line chart: sales and net profit (expenses spread on their days).
   - «پیشنهادهای غلتک»: the top 4 advice items, and a link to all.
   - «پول شما از کجا آمد و کجا رفت»: the profit breakdown bars (sales → cost of goods → gross profit → expenses → net profit), from layout A, placed under the chart.
2. **فروش (Sales).**
   - The sales trend (day, or week for long ranges).
   - Sales by weekday.
   - Payment methods.
   - Purchase links vs manual orders.
   - The B8 link funnel table.
   - Top customers by sales.
3. **سود محصولات (Product profit).**
   - A sortable table: units, sales, cost of goods, gross profit, margin.
   - Rows without cost show «قیمت خرید ثبت نشده» and an inline cost field that saves with the "use for past sales?" choice.
4. **هزینه‌ها (Expenses).**
   - Totals by category (bars).
   - A list with edit and remove.
   - Quick add: amount, category, date (default today), note, and a "repeats every month" switch.
   - A repeats list with pause/end.
5. **گزارش‌های دوره‌ای (Period reports).** Every finished month, season and year since the store's first order, newest first, each with sales and net profit and a link.

**Period report page** `/finance/reports/[key]`:
- the story sentence (from layout A)
- the profit breakdown
- the six numbers vs the previous period
- best products by sales and by profit
- expenses by category
- top advice for that period
- «نسخهٔ چاپی» → `/finance/reports/[key]/print`

**Print page:** A4 portrait, light paper styles, no dashboard chrome (B9's `print:` approach). Contents:
- store name and logo, the period and the "produced on" date/time
- the breakdown and comparison tables
- best products and expenses by category
- a footer: «ارقام به تومان. فروش بدون هزینهٔ ارسال.»

It is computed live (late returns and corrected costs show up). It must fit one page for a month in a typical store; longer tables continue cleanly on a second page.

**Operators:** see «گزارش» with counts only: orders, units, top products by units, link funnel counts (A10's existing rule). Product profit, Expenses, Period reports and their routes return 404 for operators (`requireOwner`), and all finance server actions call `requireOwner()`. These files are added to `src/server/owner-only.test.ts`.

### 6.5 Advice (`src/server/finance/insights/`)
- One pure function per rule: `(facts) => Insight | null`. An `Insight` is `{ id, tone: "good" | "warn" | "tip", title, body, impactToman?, action?: { label, href } }`.
- A facts loader gathers everything in a few SQL queries.
- Ranking: rule 4 (missing costs) pinned first when it fires; then `impactToman` descending where known, then tone (warn > tip > good), then rule number.
- Overview shows 4; «همهٔ پیشنهادها» shows the rest.
- Texts are gentle suggestions in Persian, never certainties. Numbers are rounded for reading («حدود ۲۵ هزار تومان»).

| # | Rule | Fires when | Action |
|---|---|---|---|
| 1 | Sales trend | \|Δ sales\| ≥ 10% vs previous period and previous has ≥ 5 sale orders | — |
| 2 | Growth driver | rule 1 fired up; the product with the largest absolute sales increase | product |
| 3 | Thin-margin best seller | product in top 5 by sales, cost known, gross margin < 15%; impact = 10% of its price × units in period | product profit tab |
| 4 | Missing costs | cost coverage < 90% | product profit tab, filtered |
| 5 | Unpaid orders | orders `PENDING_PAYMENT` older than 48 h; shows count and total `amountDue` | orders, filtered |
| 6 | Returns jump | return rate ≥ 2× previous with ≥ 3 returns, or ≥ 10% | orders, RETURNED |
| 7 | Smaller orders | AOV down ≥ 10% with ≥ 10 sale orders in both periods | — |
| 8 | Costs outpacing sales | expense growth − sales growth ≥ 20 points, or ads ≥ 25% of sales | expenses tab |
| 9 | About to run out | a top-5 product by units over the last 30 days with stock ÷ average daily units < 7 days | inventory |
| 10 | Link not converting | link with ≥ 50 views this month and paid ÷ views < 2% | purchase links |
| 11 | Repeat customers | returning customers ≥ 30% of sales (good), or < 10% with ≥ 20 buyers (tip) | customers |
| 12 | Best weekday | ≥ 4 weeks of data and one weekday ≥ 1.4× the average | — |

### 6.6 Glossary (`src/server/finance/glossary.ts`)
One plain-Persian paragraph per number in 6.2, using the store's actual figure where it helps («این ماه از هر ۱۰۰ هزار تومان فروش، ۳۷ هزار تومان برای شما ماند»). Used by every ؟ and by the print page footnotes.

---

## 7. Daily brief and period recaps

### 7.1 Daily brief (Home, inline card)
- **When:** the first visit of a Tehran day, for stores with at least one sale order ever, after the start checklist is complete.
- **Content (owner):**
  - «📊 خلاصهٔ دیروز»
  - the sentence «دیروز X فروختید و Y سود خالص بردید.»
  - the order count and the change vs the same weekday last week
  - a 7-day sparkline with yesterday highlighted
  - today's to-dos as pills (receipts waiting, ready to ship)
  - «گزارش کامل ←» to finance
- **Content (operator):** order counts and to-dos only, no money.
- **No sales yesterday:** «دیروز فروشی ثبت نشد» plus the week's total and the to-dos (never a scolding tone).
- **Dismiss:** × folds it into the pill «📊 دیروز: ۶٫۴ م فروش · ۲٫۳ م سود». The pill stays for the rest of the day; tapping it reopens the card. The dismissal is a cookie `gk_brief=<tehran-day-key>` set by a server action, so the server renders the right state with no flash.

### 7.2 Period recaps
- After a month, season or year ends, the brief slot shows the **recap** of the largest period that just ended, during the first 7 days of the new period or until dismissed (cookie `gk_recap=<period-key>`).
- The recap card: «جمع‌بندی مهر ۱۴۰۵», with sales, net profit, margin, best product, the change vs the period before, and «گزارش کامل و نسخهٔ چاپی ←».
- On 1 Farvardin the year recap shows, with links to the Esfand and زمستان recaps.
- After the recap is dismissed, the normal daily brief resumes the next day.

---

## 8. Page design pass (Phase 1)
Every dashboard page moves to the colour roles and kit. The colour classes (405 across 47 files) are replaced by role classes in a mechanical sweep. Each page then gets a deliberate pass:
- one clear primary action
- consistent headers
- empty states with an action
- loading skeletons
- tables that become cards on phones

Areas and owners:

| Area | Folders | Owner/reviewer |
|---|---|---|
| Orders, links, print entry points | `src/app/(dashboard)/orders/**`, `src/components/orders/**` | B |
| Products and inventory | `src/app/(dashboard)/products/**`, `inventory/**`, `src/components/catalog/**` | A reviews |
| Customers | `src/app/(dashboard)/customers/**`, `src/components/customers/**` | A reviews |
| Settings (store, payments, billing, team, devices, data) | `src/app/(dashboard)/settings/**`, `src/components/settings/**`, `payments/**`, `team/**`, `billing/**` | A and C review their tabs |
| Home and start checklist | `src/app/(dashboard)/page.tsx`, `src/components/home/**` | C reviews |
| Shell | `src/app/(dashboard)/layout.tsx`, `src/components/dashboard/**` | A reviews |
| Login and store picker | `src/app/login/**`, `select-store` | A reviews |

---

## 9. Build order
Each step is one PR on top of the previous one, with CI green and the touched track's review.

**Phase 1: foundation**
1. **Kit:**
   - colour roles, type, motion helpers
   - brand assets resized
   - the component kit with Radix Dialog and Popover
   - `/dev/ui`
   - `.superpowers/` added to `.gitignore`
2. **Shell:** sidebar, phone bottom bar, ➕ sheet, ☰ drawer, bell, badges, products/stock segmented control.
3. **Page sweep and design pass:** in up to four PRs (orders · products and stock · customers · settings and login). Merged within a short window, announced to A and C as a quiet day for page edits.
4. **Home and daily brief** (cookie dismissal, operator variant).

**Phase 2: finance**
5. **Schema PR:**
   - `costPrice`, `unitCost`, `Expense`, `RecurringExpense`
   - copying cost onto order lines in `create-order.ts` / `link-order.ts`
   - the cost field on the product form (Track A review)
   - "use for past sales?"
   - deletion SQL updated
6. **Finance core and Overview:** `finance/definitions.ts`, `periods.ts`, `queries.ts`, glossary, charts, `/reports` → `/finance` redirect, `requireOwner` and the guard test.
7. **Advice engine and the 12 rules.**
8. **Sales, Product profit and Expenses tabs** (recurring materialisation).
9. **Period reports, recaps on Home, print pages.**

**Phase 3 (later, from pilot feedback):** deeper page improvements, a light theme toggle (tokens ready), more advice rules.

---

## 10. Testing

- **Unit (pure):**
  - each advice rule: fires, doesn't fire below its minimum data, ranking
  - periods: season and year boundaries, Nowruz, leap Esfand, aligned comparison ranges
  - definitions with coverage edge cases
  - the brief/recap selection (which card on which day)
  - the cookie day key
- **Database (`*.int.test.ts`, hand-counted like `src/server/reports/queries.int.test.ts`):**
  - sales, COGS, coverage, expenses and net profit for a seeded store
  - another seller never counted
  - a cost edited later doesn't change past `unitCost`
  - "use for past sales" fills only null lines of that product and seller
  - two simultaneous `ensureRecurringExpenses` calls create one row per month
  - a voided month is not recreated
  - the period report matches the overview for the same range
- **End to end (`e2e/`):**
  - phone bottom bar and ➕ sheet reach each page
  - the daily brief appears, × folds it to the pill, a reload keeps the pill, and the next day it shows again (cookie date)
  - adding a cost price and an expense changes net profit to the expected number
  - the print page produces A4 pages with the expected count (PDF check, as in `print-sheet.spec.ts`)
  - an operator sees counts only and gets 404 on owner-only finance routes
- **Existing tests:** e2e selectors that depend on the old nav or page structure are updated in the PR that changes them; none are deleted.
- **Quality gates per phase:**
  - axe/contrast on the main pages (C7's method)
  - reduced-motion check (no animation, final values shown)
  - phone (375 px) and desktop screenshots of every page in the PR
  - a slow-3G check on the dashboard: no new client JavaScript beyond Radix primitives, the count-up and the tab highlight; charts are server-rendered SVG

## 11. Rollout and risks

- **Pilot sellers:** Phase 1 lands in one short window so nobody sees a half-dark app. Person C sends a short «تازه‌ها» note (what moved where) and retakes the `/help` screenshots afterwards.
- **Sunlight readability:** dark is the default chosen by the owner. If pilots report trouble outdoors, the light theme (Phase 3) is a token swap, not a redesign.
- **Merge conflicts:** the sweep touches many files; schedule the PR 3 window with A and C and land it fast.
- **Schema:** one schema PR at a time (project rule); PR 5 is it for this work.
- **Performance:** server-rendered charts and CSS motion keep the dashboard light on 3G; Radix packages are dashboard-only and never loaded on `/buy`.
- **Accessible colour (checked while building the kit):** white text on the bright logo orange is only 3.1:1, so buttons use a deeper fire (`#D2411A → #D81F3A → #B01650`, ≥ 4.6:1) and the bright gradient is decoration only; the small-label grey is `#808CA8` (≥ 4.5:1 on every surface).
