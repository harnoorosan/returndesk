import { statusLabel } from "@/domain/labels";
import type { RequestStatus } from "@/domain/lifecycle";

const styles: Record<RequestStatus, string> = {
  OPEN: "bg-sky-100 text-sky-950 ring-sky-200",
  IN_REVIEW: "bg-amber-100 text-amber-950 ring-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-950 ring-emerald-200",
  REJECTED: "bg-rose-100 text-rose-950 ring-rose-200",
  COMPLETED: "bg-stone-200 text-stone-800 ring-stone-300",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}
