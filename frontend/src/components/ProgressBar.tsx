export default function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
         className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
      <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
}
