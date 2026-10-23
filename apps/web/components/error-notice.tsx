import { CircleAlert } from 'lucide-react';

/** Errors announce themselves once and stay legible even with long backend messages. */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex w-full min-w-0 items-start gap-3 rounded-[var(--tradenest-radius-control)] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-[var(--tradenest-danger-ink)]"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <p className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{message}</p>
    </div>
  );
}
