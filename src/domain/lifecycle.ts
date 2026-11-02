export const STATUSES = [
  "OPEN",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
] as const;

export const REASONS = [
  "DAMAGED",
  "WRONG_ITEM",
  "SIZE_ISSUE",
  "NOT_AS_DESCRIBED",
  "CHANGED_MIND",
] as const;

export const RESOLUTIONS = ["REFUND", "REPLACEMENT", "STORE_CREDIT"] as const;

export const SORTS = [
  "newest",
  "oldest",
  "customer",
  "customer_desc",
  "updated",
  "reference",
] as const;

export type RequestStatus = (typeof STATUSES)[number];
export type ReturnReason = (typeof REASONS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];
export type RequestSort = (typeof SORTS)[number];

const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  OPEN: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};

export function legalTransitions(status: RequestStatus): readonly RequestStatus[] {
  return TRANSITIONS[status];
}

export function isLegalTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Customer and item details stay editable until a decision is recorded. */
export function canEditDetails(status: RequestStatus): boolean {
  return status === "OPEN" || status === "IN_REVIEW";
}

/** Soft-remove is only legal before review finishes, or after a rejection. */
export function canRemove(status: RequestStatus): boolean {
  return status === "OPEN" || status === "REJECTED";
}

export function isLiveStatus(status: RequestStatus): boolean {
  return status === "OPEN" || status === "IN_REVIEW" || status === "APPROVED";
}
