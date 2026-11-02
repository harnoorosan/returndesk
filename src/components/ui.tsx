export const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink shadow-sm";

export const labelClass = "mb-1.5 block text-sm font-medium";

export const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-stamp px-4 text-sm font-semibold text-white hover:bg-stamp-deep disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60";

export const dangerButton =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-rose-800 px-4 text-sm font-semibold text-white hover:bg-rose-900 disabled:cursor-not-allowed disabled:opacity-60";

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950"
    >
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className={`${secondaryButton} mt-3`} onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-rose-800">{message}</p>;
}
