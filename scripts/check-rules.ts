import assert from "node:assert/strict";
import { prisma } from "../src/server/db";
import { listQuerySchema } from "../src/domain/validation";
import { ApiError } from "../src/server/errors";
import {
  addNote,
  createRequest,
  getRequest,
  listRequests,
  removeRequest,
  transitionRequest,
  updateRequest,
} from "../src/server/requests";

const run = Date.now().toString(36);

async function expectFail(
  runCase: () => Promise<unknown>,
  status: number,
  code: string,
) {
  let caught: unknown;
  try {
    await runCase();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ApiError, `expected ${code}, got ${String(caught)}`);
  assert.equal(caught.status, status, caught.message);
  assert.equal(caught.code, code, caught.message);
}

async function cleanup() {
  const rows = await prisma.returnRequest.findMany({
    where: { orderNumber: { startsWith: "RULE-" } },
    select: { id: true },
  });
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return;
  await prisma.note.deleteMany({ where: { requestId: { in: ids } } });
  await prisma.returnRequest.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  await cleanup();

  const parsed = listQuerySchema.parse({});
  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 10);
  assert.equal(parsed.sort, "newest");
  assert.throws(() => listQuerySchema.parse({ status: "CLOSED" }));

  const first = await createRequest({
    customerName: "Rule Customer",
    contact: "rule@example.com",
    orderNumber: `RULE-${run}-A`,
    itemName: "Wool Throw",
    quantity: 1,
    reason: "DAMAGED",
  });
  assert.match(first.reference, /^RD-\d{4}$/);
  assert.equal(first.status, "OPEN");
  assert.equal(first.resolution, null);
  assert.equal(first.refundAmount, null);

  await expectFail(
    () =>
      createRequest({
        customerName: "Someone Else",
        contact: "other@example.com",
        orderNumber: `  rule-${run}-a  `,
        itemName: "wool   throw",
        quantity: 2,
        reason: "CHANGED_MIND",
      }),
    409,
    "DUPLICATE_LIVE_REQUEST",
  );

  await expectFail(
    () => transitionRequest(first.id, { to: "COMPLETED" }),
    409,
    "ILLEGAL_TRANSITION",
  );
  await expectFail(
    () => transitionRequest(first.id, { to: "REJECTED" }),
    409,
    "ILLEGAL_TRANSITION",
  );
  await expectFail(
    () => transitionRequest(first.id, { to: "APPROVED", resolution: "REPLACEMENT" }),
    409,
    "ILLEGAL_TRANSITION",
  );

  const reviewing = await transitionRequest(first.id, { to: "IN_REVIEW" });
  assert.equal(reviewing.status, "IN_REVIEW");
  await expectFail(
    () => transitionRequest(first.id, { to: "COMPLETED" }),
    409,
    "ILLEGAL_TRANSITION",
  );
  await expectFail(
    () => transitionRequest(first.id, { to: "APPROVED" }),
    409,
    "RESOLUTION_REQUIRED",
  );
  await expectFail(
    () => transitionRequest(first.id, { to: "APPROVED", resolution: "REFUND" }),
    409,
    "REFUND_AMOUNT_REQUIRED",
  );
  await expectFail(
    () =>
      transitionRequest(first.id, {
        to: "APPROVED",
        resolution: "REFUND",
        refundAmount: "0.00",
      }),
    409,
    "REFUND_AMOUNT_REQUIRED",
  );
  await expectFail(
    () =>
      transitionRequest(first.id, {
        to: "APPROVED",
        resolution: "REPLACEMENT",
        refundAmount: "12.00",
      }),
    409,
    "REFUND_AMOUNT_NOT_ALLOWED",
  );
  await expectFail(
    () => transitionRequest(first.id, { to: "REJECTED", resolution: "REFUND" }),
    400,
    "VALIDATION_ERROR",
  );

  const edited = await updateRequest(first.id, { quantity: 3, contact: "+1 415 555 0100" });
  assert.equal(edited.quantity, 3);
  assert.equal(edited.contact, "+1 415 555 0100");

  const approved = await transitionRequest(first.id, {
    to: "APPROVED",
    resolution: "REFUND",
    refundAmount: "15.5",
  });
  assert.equal(approved.resolution, "REFUND");
  assert.equal(approved.refundAmount, "15.50");
  await expectFail(
    () => updateRequest(first.id, { customerName: "Changed" }),
    409,
    "DETAILS_LOCKED",
  );
  const note = await addNote(first.id, { body: "Refund queued with finance.", author: "Priya" });
  assert.equal(note.kind, "AGENT");
  await expectFail(
    () => transitionRequest(first.id, { to: "REJECTED" }),
    409,
    "ILLEGAL_TRANSITION",
  );
  await expectFail(() => removeRequest(first.id), 409, "REMOVAL_NOT_ALLOWED");

  const completed = await transitionRequest(first.id, { to: "COMPLETED" });
  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.refundAmount, "15.50");
  await expectFail(
    () => transitionRequest(first.id, { to: "IN_REVIEW" }),
    409,
    "ILLEGAL_TRANSITION",
  );

  const again = await createRequest({
    customerName: "Rule Customer",
    contact: "rule@example.com",
    orderNumber: `RULE-${run}-A`,
    itemName: "Wool Throw",
    quantity: 1,
    reason: "SIZE_ISSUE",
  });
  assert.notEqual(again.id, first.id);

  const sibling = await createRequest({
    customerName: "Rule Customer",
    contact: "rule@example.com",
    orderNumber: `RULE-${run}-A`,
    itemName: "Stoneware mug",
    quantity: 1,
    reason: "WRONG_ITEM",
  });
  assert.equal(sibling.status, "OPEN");

  const hidden = await createRequest({
    customerName: "Rule Customer",
    contact: "rule@example.com",
    orderNumber: `RULE-${run}-HIDE`,
    itemName: "Canvas tote",
    quantity: 1,
    reason: "CHANGED_MIND",
  });
  const removed = await removeRequest(hidden.id);
  assert.equal(removed.removed, true);
  await expectFail(() => getRequest(hidden.id), 404, "NOT_FOUND");
  const hiddenList = await listRequests({
    q: hidden.reference,
    sort: "newest",
    page: 1,
    pageSize: 10,
  });
  assert.equal(hiddenList.total, 0);
  const stillThere = await prisma.returnRequest.findUnique({ where: { id: hidden.id } });
  assert.ok(stillThere?.removedAt);
  await expectFail(
    () =>
      createRequest({
        customerName: "Rule Customer",
        contact: "rule@example.com",
        orderNumber: `RULE-${run}-HIDE`,
        itemName: "Canvas tote",
        quantity: 1,
        reason: "DAMAGED",
      }),
    409,
    "DUPLICATE_LIVE_REQUEST",
  );

  const rejected = await createRequest({
    customerName: "Rule Customer",
    contact: "rule@example.com",
    orderNumber: `RULE-${run}-REJ`,
    itemName: "Leather belt",
    quantity: 1,
    reason: "NOT_AS_DESCRIBED",
  });
  await transitionRequest(rejected.id, { to: "IN_REVIEW" });
  await transitionRequest(rejected.id, { to: "REJECTED" });
  await expectFail(
    () => updateRequest(rejected.id, { itemName: "Other belt" }),
    409,
    "DETAILS_LOCKED",
  );
  await addNote(rejected.id, { body: "Customer accepted the decision." });
  await removeRequest(rejected.id);
  await expectFail(() => getRequest(rejected.id), 404, "NOT_FOUND");

  const blocked = await createRequest({
    customerName: "Rule Customer",
    contact: "rule@example.com",
    orderNumber: `RULE-${run}-REV`,
    itemName: "Oak desk lamp",
    quantity: 1,
    reason: "DAMAGED",
  });
  await transitionRequest(blocked.id, { to: "IN_REVIEW" });
  await expectFail(() => removeRequest(blocked.id), 409, "REMOVAL_NOT_ALLOWED");

  for (let index = 0; index < 6; index += 1) {
    await createRequest({
      customerName: "Rule Customer",
      contact: "rule@example.com",
      orderNumber: `RULE-${run}-LIST`,
      itemName: `Listed item ${index}`,
      quantity: 1,
      reason: index < 4 ? "DAMAGED" : "SIZE_ISSUE",
    });
  }

  const page = await listRequests({
    q: "rule customer",
    status: "OPEN",
    reason: "DAMAGED",
    sort: "reference",
    page: 2,
    pageSize: 2,
  });
  assert.equal(page.total, 4);
  assert.equal(page.page, 2);
  assert.equal(page.data.length, 2);
  assert.ok(page.data.every((row) => row.reason === "DAMAGED" && row.status === "OPEN"));
  assert.ok(page.data[0].reference < page.data[1].reference);

  const byReference = await listRequests({
    q: first.reference,
    sort: "newest",
    page: 1,
    pageSize: 10,
  });
  assert.equal(byReference.total, 1);
  assert.equal(byReference.data[0].id, first.id);

  console.log("Business rules passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
