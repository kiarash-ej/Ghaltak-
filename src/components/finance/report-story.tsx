import type { Story } from "@/server/finance/story";

/** The period in one sentence (layout A, spec §6.4): the amounts in fire, then what they mean. */
export function ReportStory({ story }: { story: Story }) {
  return (
    <section aria-label="خلاصهٔ دوره" className="relative animate-rise overflow-hidden rounded-2xl border border-brand-2/35 bg-glow p-5">
      <span aria-hidden className="pointer-events-none absolute inset-0 animate-sheen bg-[linear-gradient(105deg,transparent_35%,rgb(255_255_255/0.06)_50%,transparent_65%)]" />
      <p className="text-lg leading-9 font-black sm:text-xl">
        {story.lead.map((part, i) => (typeof part === "string" ? part : <b key={i} className="text-fire">{part.strong}</b>))}
      </p>
      {story.detail && <p className="mt-1.5 text-sm leading-7 text-ink-soft">{story.detail}</p>}
    </section>
  );
}
