import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OnboardingStep } from "@/server/home/onboarding";

function StepMarker({ index, done }: { index: number; done: boolean }) {
  if (done) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-canvas">
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-line-strong text-sm font-semibold text-muted">
      {formatNumber(index + 1)}
    </span>
  );
}

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card>
      <CardHeader>
        {/* An h2: it sits right under the page's h1 (C7, heading order). */}
        <h2 className="text-lg font-semibold leading-none">شروع کار</h2>
        <CardDescription>
          {formatNumber(doneCount)} از {formatNumber(steps.length)} مرحله انجام شده. وقتی همهٔ مراحل را انجام دهید،
          این فهرست پنهان می‌شود.
        </CardDescription>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-raised-2"
          role="progressbar"
          aria-label="پیشرفت شروع کار"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
        >
          <div className="h-full rounded-full bg-fire" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col divide-y divide-line">
          {steps.map((step, i) => (
            <li key={step.key} className="py-1 first:pt-0 last:pb-0">
              <Link
                href={step.href}
                className={cn(
                  "flex items-start gap-3 rounded-lg p-2 hover:bg-raised-2",
                  step.done && "text-muted",
                )}
              >
                <StepMarker index={i} done={step.done} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("font-medium", !step.done && "text-ink")}>{step.title}</span>
                  <span className="text-sm text-muted">{step.description}</span>
                </span>
                <span className={cn("shrink-0 self-center text-xs", step.done ? "text-success" : "text-faint")}>
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
