import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OnboardingStep } from "@/server/home/onboarding";

function StepMarker({ index, done }: { index: number; done: boolean }) {
  if (done) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-neutral-300 text-sm font-semibold text-neutral-500">
      {formatNumber(index + 1)}
    </span>
  );
}

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card>
      <CardHeader>
        {/* An h2 (CardTitle is an h3): it sits right under the page's h1 (C7, heading order). */}
        <h2 className="text-lg font-semibold leading-none">شروع کار</h2>
        <CardDescription>
          {formatNumber(doneCount)} از {formatNumber(steps.length)} مرحله انجام شده. با انجام همه، این فهرست
          پنهان می‌شود.
        </CardDescription>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100"
          role="progressbar"
          aria-label="پیشرفت شروع کار"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
        >
          <div className="h-full rounded-full bg-green-600" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col divide-y divide-neutral-100">
          {steps.map((step, i) => (
            <li key={step.key} className="py-1 first:pt-0 last:pb-0">
              <Link
                href={step.href}
                className={cn(
                  "flex items-start gap-3 rounded-lg p-2 hover:bg-neutral-50",
                  step.done && "text-neutral-500",
                )}
              >
                <StepMarker index={i} done={step.done} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("font-medium", !step.done && "text-neutral-900")}>{step.title}</span>
                  <span className="text-sm text-neutral-500">{step.description}</span>
                </span>
                <span className={cn("shrink-0 self-center text-xs", step.done ? "text-green-700" : "text-neutral-400")}>
                  {step.done ? "انجام شد" : "انجام نشده"}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
