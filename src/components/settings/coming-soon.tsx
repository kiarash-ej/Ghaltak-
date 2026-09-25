/** Placeholder for a settings tab whose task hasn't shipped yet. */
export function ComingSoon({ title, task }: { title: string; task: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">
      <p className="font-medium text-neutral-800">{title}</p>
      <p className="mt-1 text-sm">به‌زودی ({task})</p>
    </div>
  );
}
