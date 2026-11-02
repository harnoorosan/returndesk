import type { RequestStatus, Resolution, ReturnReason } from "@/domain/lifecycle";

export type NoteKind = "AGENT" | "SYSTEM";

export type NoteDto = {
  id: string;
  body: string;
  author: string;
  kind: NoteKind;
  createdAt: string;
};

export type RequestDto = {
  id: string;
  reference: string;
  customerName: string;
  contact: string;
  orderNumber: string;
  itemName: string;
  quantity: number;
  reason: ReturnReason;
  status: RequestStatus;
  resolution: Resolution | null;
  refundAmount: string | null;
  createdAt: string;
  updatedAt: string;
  noteCount: number;
  notes?: NoteDto[];
};

export type RequestListDto = {
  data: RequestDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
