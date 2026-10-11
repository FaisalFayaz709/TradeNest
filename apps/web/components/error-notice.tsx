export function ErrorNotice({ message }: { message: string }) {
  return <div role="alert" className="rounded-[var(--tradenest-radius-control)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div>;
}
