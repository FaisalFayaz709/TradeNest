export function LoadingState({ label = 'Loading TradeNest…' }: { label?: string }) {
  return <div className="flex min-h-40 items-center justify-center rounded-[var(--tradenest-radius-card)] border border-dashed border-[var(--tradenest-border)] bg-white/70 px-6 text-sm font-medium text-[var(--tradenest-text-secondary)]"><span className="mr-3 size-4 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--tradenest-teal)]" />{label}</div>;
}
