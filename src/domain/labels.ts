import type { RequestStatus, Resolution, ReturnReason } from "@/domain/lifecycle";

const STATUS_LABELS: Record<RequestStatus, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};

const REASON_LABELS: Record<ReturnReason, string> = {
  DAMAGED: "Damaged",
  WRONG_ITEM: "Wrong Item",
  SIZE_ISSUE: "Size Issue",
  NOT_AS_DESCRIBED: "Not As Described",
  CHANGED_MIND: "Changed Mind",
};

const RESOLUTION_LABELS: Record<Resolution, string> = {
  REFUND: "Refund",
  REPLACEMENT: "Replacement",
  STORE_CREDIT: "Store Credit",
};

export function statusLabel(status: RequestStatus): string {
  return STATUS_LABELS[status];
}

export function reasonLabel(reason: ReturnReason): string {
  return REASON_LABELS[reason];
}

export function resolutionLabel(resolution: Resolution): string {
  return RESOLUTION_LABELS[resolution];
}

export function formatMoney(amount: string): string {
  const value = Number(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatWhenWithTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
