import { Prisma, type PrismaClient } from "@prisma/client";
import { formatMoney, statusLabel } from "@/domain/labels";
import {
  canEditDetails,
  canRemove,
  isLegalTransition,
  isLiveStatus,
  legalTransitions,
  type RequestSort,
  type RequestStatus,
  type Resolution,
} from "@/domain/lifecycle";
import type { NoteDto, RequestDto, RequestListDto } from "@/domain/types";
import type {
  CreateRequestInput,
  ListQuery,
  NoteInput,
  TransitionInput,
  UpdateRequestInput,
} from "@/domain/validation";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/errors";

const PAIR_SEPARATOR = "\u001f";
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

type NoteRow = {
  id: string;
  body: string;
  author: string;
  kind: "AGENT" | "SYSTEM";
  createdAt: Date;
};

type RequestRow = {
  id: string;
  reference: string;
  customerName: string;
  contact: string;
  orderNumber: string;
  itemName: string;
  orderKey: string;
  itemKey: string;
  quantity: number;
  reason: RequestDto["reason"];
  status: RequestStatus;
  resolution: Resolution | null;
  refundAmount: Prisma.Decimal | null;
  createdAt: Date;
  updatedAt: Date;
  notes?: NoteRow[];
  _count?: { notes: number };
};

export function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function livePairFor(
  status: RequestStatus,
  orderKey: string,
  itemKey: string,
): string | null {
  if (!isLiveStatus(status)) return null;
  return `${orderKey}${PAIR_SEPARATOR}${itemKey}`;
}

function serializeNote(note: NoteRow): NoteDto {
  return {
    id: note.id,
    body: note.body,
    author: note.author,
    kind: note.kind,
    createdAt: note.createdAt.toISOString(),
  };
}

function serialize(row: RequestRow): RequestDto {
  const notes = row.notes?.map(serializeNote);
  return {
    id: row.id,
    reference: row.reference,
    customerName: row.customerName,
    contact: row.contact,
    orderNumber: row.orderNumber,
    itemName: row.itemName,
    quantity: row.quantity,
    reason: row.reason,
    status: row.status,
    resolution: row.resolution,
    refundAmount: row.refundAmount ? row.refundAmount.toFixed(2) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    noteCount: row._count?.notes ?? notes?.length ?? 0,
    ...(notes ? { notes } : {}),
  };
}

function sortOrder(sort: RequestSort): Prisma.ReturnRequestOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }];
    case "customer":
      return [{ customerName: "asc" }];
    case "customer_desc":
      return [{ customerName: "desc" }];
    case "updated":
      return [{ updatedAt: "desc" }];
    case "reference":
      return [{ reference: "asc" }];
    case "newest":
      return [{ createdAt: "desc" }];
  }
}

async function nextReference(tx: Tx): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ next: bigint }>>`
    SELECT nextval('return_request_reference_seq') AS next
  `;
  const next = rows[0]?.next;
  if (next === undefined) {
    throw new Error("return_request_reference_seq is not available.");
  }
  return `RD-${next.toString().padStart(4, "0")}`;
}

async function lockActive(tx: Tx, id: string) {
  const current = await tx.returnRequest.findFirst({
    where: { id, removedAt: null },
  });
  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Request not found.");
  }
  return current;
}

function parseRefundAmount(value: string | number): Prisma.Decimal {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Refund amount must be a positive amount with at most two decimal places.",
      );
    }
    const cents = Math.round(value * 100);
    if (Math.abs(value * 100 - cents) > 1e-6) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Refund amount must be a positive amount with at most two decimal places.",
      );
    }
    return new Prisma.Decimal(cents).dividedBy(100);
  }

  const trimmed = value.trim();
  if (!MONEY_PATTERN.test(trimmed)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Refund amount must be a positive amount with at most two decimal places.",
    );
  }
  return new Prisma.Decimal(trimmed);
}

function rethrowKnown(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = JSON.stringify(error.meta?.target ?? "");
    if (target.includes("live_pair")) {
      throw new ApiError(
        409,
        "DUPLICATE_LIVE_REQUEST",
        "A live request already exists for this item on this order. Close it out before opening another.",
      );
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (message.includes("return_requests_refund_matches_resolution")) {
    throw new ApiError(
      409,
      "REFUND_AMOUNT_NOT_ALLOWED",
      "A refund needs an amount greater than zero, and other resolutions cannot store a refund amount.",
    );
  }
  if (message.includes("return_requests_resolution_follows_status")) {
    throw new ApiError(
      409,
      "RESOLUTION_REQUIRED",
      "Approved and completed requests must have a resolution.",
    );
  }

  throw error;
}

function transitionNote(
  to: RequestStatus,
  resolution: Resolution | null,
  refundAmount: Prisma.Decimal | null,
): string {
  if (to === "IN_REVIEW") return "Moved to In Review.";
  if (to === "REJECTED") return "Rejected the request.";
  if (to === "COMPLETED") return "Marked the request completed.";
  if (to === "APPROVED" && resolution === "REFUND" && refundAmount) {
    return `Approved a refund of ${formatMoney(refundAmount.toFixed(2))}.`;
  }
  if (to === "APPROVED" && resolution === "REPLACEMENT") return "Approved a replacement.";
  if (to === "APPROVED" && resolution === "STORE_CREDIT") return "Approved store credit.";
  return `Moved the request to ${statusLabel(to)}.`;
}

const detailInclude = {
  notes: { orderBy: { createdAt: "asc" as const } },
  _count: { select: { notes: true } },
};

export async function getRequest(id: string): Promise<RequestDto> {
  const row = await prisma.returnRequest.findFirst({
    where: { id, removedAt: null },
    include: detailInclude,
  });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Request not found.");
  return serialize(row);
}

export async function listRequests(query: ListQuery): Promise<RequestListDto> {
  const where: Prisma.ReturnRequestWhereInput = {
    removedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.reason ? { reason: query.reason } : {}),
    ...(query.q
      ? {
          OR: [
            { customerName: { contains: query.q, mode: "insensitive" } },
            { orderNumber: { contains: query.q, mode: "insensitive" } },
            { reference: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.returnRequest.count({ where }),
    prisma.returnRequest.findMany({
      where,
      orderBy: [...sortOrder(query.sort), { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { _count: { select: { notes: true } } },
    }),
  ]);

  return {
    data: rows.map((row) => serialize(row)),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
  };
}

export async function createRequest(input: CreateRequestInput): Promise<RequestDto> {
  const orderKey = normalizeKey(input.orderNumber);
  const itemKey = normalizeKey(input.itemName);

  try {
    const id = await prisma.$transaction(async (tx) => {
      const reference = await nextReference(tx);
      const created = await tx.returnRequest.create({
        data: {
          reference,
          customerName: input.customerName,
          contact: input.contact,
          orderNumber: input.orderNumber,
          itemName: input.itemName,
          orderKey,
          itemKey,
          livePair: livePairFor("OPEN", orderKey, itemKey),
          quantity: input.quantity,
          reason: input.reason,
          status: "OPEN",
        },
      });
      return created.id;
    });
    return getRequest(id);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    rethrowKnown(error);
  }
}

export async function updateRequest(
  id: string,
  input: UpdateRequestInput,
): Promise<RequestDto> {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await lockActive(tx, id);
      if (!canEditDetails(current.status)) {
        throw new ApiError(
          409,
          "DETAILS_LOCKED",
          "Customer and item details are locked once a request is approved, rejected, or completed. Notes can still be added.",
        );
      }

      const customerName = input.customerName ?? current.customerName;
      const contact = input.contact ?? current.contact;
      const orderNumber = input.orderNumber ?? current.orderNumber;
      const itemName = input.itemName ?? current.itemName;
      const quantity = input.quantity ?? current.quantity;
      const reason = input.reason ?? current.reason;
      const orderKey = normalizeKey(orderNumber);
      const itemKey = normalizeKey(itemName);

      const changed =
        customerName !== current.customerName ||
        contact !== current.contact ||
        orderNumber !== current.orderNumber ||
        itemName !== current.itemName ||
        quantity !== current.quantity ||
        reason !== current.reason;

      const updated = await tx.returnRequest.updateMany({
        where: {
          id,
          removedAt: null,
          status: { in: ["OPEN", "IN_REVIEW"] },
        },
        data: {
          customerName,
          contact,
          orderNumber,
          itemName,
          orderKey,
          itemKey,
          livePair: livePairFor(current.status, orderKey, itemKey),
          quantity,
          reason,
        },
      });

      if (updated.count !== 1) {
        const again = await tx.returnRequest.findFirst({ where: { id, removedAt: null } });
        if (!again) throw new ApiError(404, "NOT_FOUND", "Request not found.");
        throw new ApiError(
          409,
          "DETAILS_LOCKED",
          "Customer and item details are locked once a request is approved, rejected, or completed. Notes can still be added.",
        );
      }

      if (changed) {
        await tx.note.create({
          data: {
            requestId: id,
            kind: "SYSTEM",
            author: "ReturnDesk",
            body: "Updated customer and item details.",
          },
        });
      }
    });

    return getRequest(id);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    rethrowKnown(error);
  }
}

export async function transitionRequest(
  id: string,
  input: TransitionInput,
): Promise<RequestDto> {
  const sentResolution = input.resolution !== undefined;
  const sentAmount = input.refundAmount !== undefined && input.refundAmount !== null;
  if (input.to !== "APPROVED" && (sentResolution || sentAmount)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Resolution and refund amount are only accepted when approving a request.",
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const current = await lockActive(tx, id);
      if (!isLegalTransition(current.status, input.to)) {
        throw new ApiError(
          409,
          "ILLEGAL_TRANSITION",
          `Cannot move a request from ${statusLabel(current.status)} to ${statusLabel(input.to)}.`,
          {
            from: current.status,
            to: input.to,
            allowed: [...legalTransitions(current.status)],
          },
        );
      }

      let resolution = current.resolution;
      let refundAmount = current.refundAmount;

      if (input.to === "APPROVED") {
        if (!input.resolution) {
          throw new ApiError(
            409,
            "RESOLUTION_REQUIRED",
            "Approving a request requires a resolution of Refund, Replacement, or Store Credit.",
          );
        }

        if (input.resolution === "REFUND") {
          if (input.refundAmount === undefined || input.refundAmount === null) {
            throw new ApiError(
              409,
              "REFUND_AMOUNT_REQUIRED",
              "A refund needs an amount greater than zero.",
            );
          }
          const amount = parseRefundAmount(input.refundAmount);
          if (amount.lte(0)) {
            throw new ApiError(
              409,
              "REFUND_AMOUNT_REQUIRED",
              "A refund needs an amount greater than zero.",
            );
          }
          resolution = "REFUND";
          refundAmount = amount;
        } else {
          if (sentAmount) {
            throw new ApiError(
              409,
              "REFUND_AMOUNT_NOT_ALLOWED",
              "A refund amount can only be recorded when the resolution is Refund.",
            );
          }
          resolution = input.resolution;
          refundAmount = null;
        }
      }

      const updated = await tx.returnRequest.updateMany({
        where: { id, removedAt: null, status: current.status },
        data: {
          status: input.to,
          resolution,
          refundAmount,
          livePair: livePairFor(input.to, current.orderKey, current.itemKey),
        },
      });

      if (updated.count !== 1) {
        throw new ApiError(
          409,
          "ILLEGAL_TRANSITION",
          "This request changed before the update was saved. Refresh and try again.",
        );
      }

      await tx.note.create({
        data: {
          requestId: id,
          kind: "SYSTEM",
          author: "ReturnDesk",
          body: transitionNote(input.to, resolution, refundAmount),
        },
      });
    });

    return getRequest(id);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    rethrowKnown(error);
  }
}

export async function addNote(id: string, input: NoteInput): Promise<NoteDto> {
  const author = input.author?.trim() || "Agent";
  const note = await prisma.$transaction(async (tx) => {
    await lockActive(tx, id);
    const created = await tx.note.create({
      data: {
        requestId: id,
        body: input.body,
        author,
        kind: "AGENT",
      },
    });
    await tx.returnRequest.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    return created;
  });
  return serializeNote(note);
}

export async function removeRequest(id: string): Promise<{ id: string; removed: true }> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.returnRequest.findUnique({ where: { id } });
    if (!current || current.removedAt) {
      throw new ApiError(404, "NOT_FOUND", "Request not found.");
    }
    if (!canRemove(current.status)) {
      throw new ApiError(
        409,
        "REMOVAL_NOT_ALLOWED",
        "Only open or rejected requests can be taken off the desk.",
      );
    }

    await tx.note.create({
      data: {
        requestId: id,
        kind: "SYSTEM",
        author: "ReturnDesk",
        body: "Removed from the desk. The record was kept.",
      },
    });

    const updated = await tx.returnRequest.updateMany({
      where: { id, removedAt: null, status: { in: ["OPEN", "REJECTED"] } },
      data: { removedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new ApiError(
        409,
        "REMOVAL_NOT_ALLOWED",
        "This request changed before it could be removed. Refresh and try again.",
      );
    }

    return { id, removed: true };
  });
}
