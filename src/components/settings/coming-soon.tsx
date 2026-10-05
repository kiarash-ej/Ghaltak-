/** Placeholder for a settings tab whose task hasn't shipped yet. */
export function ComingSoon({ title, task }: { title: string; task: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong p-8 text-center text-muted">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm">به‌زودی ({task})</p>
    </div>
  );
}
