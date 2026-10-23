/** Accessible loading placeholder shared by buyer, seller and admin screens. */
export function LoadingState({ label = 'Loading TradeNest…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-40 w-full min-w-0 items-center justify-center gap-3 rounded-[var(--tradenest-radius-card)] border border-dashed border-[var(--tradenest-border)] bg-white/75 px-4 py-8 text-center text-sm font-medium leading-6 text-[var(--tradenest-text-secondary)] sm:px-6"
    >
      <span
        aria-hidden="true"
        className="size-5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--tradenest-teal-action)]"
      />
      <span className="min-w-0 break-words">{label}</span>
    </div>
  );
}
