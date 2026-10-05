// The «شروع کار» checklist on the dashboard home (Phase 2, C5). Pure, no
// database: queries.ts reads the facts, this turns them into steps.

export type OnboardingFacts = {
  /** The store has a real name (not the default) and at least one way to be contacted. */
  storeComplete: boolean;
  hasProduct: boolean;
  /** Only whether a card is saved. The card number is never decrypted for this. */
  hasCard: boolean;
  hasPurchaseLink: boolean;
  hasOrder: boolean;
};

export type OnboardingStepKey = keyof OnboardingFacts;

export type OnboardingStep = {
  key: OnboardingStepKey;
  title: string;
  description: string;
  href: string;
  done: boolean;
};

const STEPS: Omit<OnboardingStep, "done">[] = [
  {
    key: "storeComplete",
    title: "اطلاعات فروشگاه را کامل کنید",
    description: "نام فروشگاه و دست‌کم یک راه تماس (موبایل، اینستاگرام یا تلگرام) را وارد کنید. مشتری این‌ها را در صفحهٔ خرید می‌بیند.",
    href: "/settings",
  },
  {
    key: "hasProduct",
    title: "اولین محصول را اضافه کنید",
    description: "قیمت و عکس بگذارید و برای هر رنگ و سایز، موجودی جداگانه ثبت کنید.",
    href: "/products/new",
  },
  {
    key: "hasCard",
    title: "شمارهٔ کارت را ثبت کنید",
    description: "تا مشتری در صفحهٔ سفارشش ببیند مبلغ را به کدام کارت واریز کند.",
    href: "/settings/payments",
  },
  {
    key: "hasPurchaseLink",
    title: "اولین لینک خرید را بسازید",
    description: "لینک را در اینستاگرام یا تلگرام بفرستید تا مشتری بدون تماس سفارش بدهد.",
    href: "/orders/links",
  },
  {
    key: "hasOrder",
    title: "اولین سفارش را ثبت کنید",
    description: "با لینک خرید، یا سفارشی را که در دایرکت گرفته‌اید دستی وارد کنید.",
    href: "/orders/new",
  },
];

export function onboardingSteps(facts: OnboardingFacts): OnboardingStep[] {
  return STEPS.map((step) => ({ ...step, done: facts[step.key] }));
}

/** The checklist disappears once every step is done. */
export function isOnboardingComplete(steps: OnboardingStep[]): boolean {
  return steps.every((s) => s.done);
}
