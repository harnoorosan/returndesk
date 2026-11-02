import { prisma } from "../src/server/db";
import type { Resolution, ReturnReason, RequestStatus } from "../src/domain/lifecycle";
import {
  addNote,
  createRequest,
  removeRequest,
  transitionRequest,
  updateRequest,
} from "../src/server/requests";

const reasons: ReturnReason[] = [
  "DAMAGED",
  "WRONG_ITEM",
  "SIZE_ISSUE",
  "NOT_AS_DESCRIBED",
  "CHANGED_MIND",
];

const statuses: RequestStatus[] = [
  "OPEN",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
];

const resolutions: Resolution[] = ["REFUND", "REPLACEMENT", "STORE_CREDIT"];

const refundAmounts = ["24.00", "18.50", "42.00", "15.75", "63.20", "9.99", "31.40", "12.00"];

const customers: Array<[string, string]> = [
  ["Mira Patel", "mira.patel@example.com"],
  ["Jonah Ellis", "jonah.ellis@example.com"],
  ["Priya Shah", "priya.shah@example.com"],
  ["Owen Clarke", "+1 415 555 0148"],
  ["Lena Ortiz", "lena.ortiz@example.com"],
  ["Samir Haddad", "samir.haddad@example.com"],
  ["Nora Kim", "nora.kim@example.com"],
  ["Felix Berg", "+1 206 555 0172"],
  ["Aisha Rahman", "aisha.rahman@example.com"],
  ["Hugo Bennett", "hugo.bennett@example.com"],
  ["Chloe Martin", "chloe.martin@example.com"],
  ["Ethan Brooks", "+1 312 555 0194"],
  ["Yara Nassar", "yara.nassar@example.com"],
  ["Leo Park", "leo.park@example.com"],
  ["Grace Okonkwo", "grace.okonkwo@example.com"],
  ["Mateo Silva", "+44 20 7946 0991"],
  ["Hannah Weiss", "hannah.weiss@example.com"],
  ["Arun Mehta", "arun.mehta@example.com"],
  ["Sophie Lang", "sophie.lang@example.com"],
  ["Caleb Nguyen", "+1 617 555 0133"],
  ["Ingrid Solberg", "ingrid.solberg@example.com"],
  ["Daniel Cho", "daniel.cho@example.com"],
  ["Freya Walsh", "freya.walsh@example.com"],
  ["Omar Farouk", "omar.farouk@example.com"],
  ["Lily Chen", "+1 503 555 0160"],
  ["Marcus Adeyemi", "marcus.adeyemi@example.com"],
  ["Elena Popov", "elena.popov@example.com"],
  ["Jack Rivera", "jack.rivera@example.com"],
  ["Amira Hassan", "amira.hassan@example.com"],
  ["Tomoko Sato", "+81 3 5550 0142"],
  ["Ben Carter", "ben.carter@example.com"],
  ["Ruth Goldberg", "ruth.goldberg@example.com"],
];

const items = [
  "Merino crew neck",
  "Linen sheet set",
  "Ceramic pour-over",
  "Canvas tote",
  "Oak desk lamp",
  "Running shorts",
  "Wool throw",
  "Stoneware mug",
  "Kids raincoat",
  "Leather belt",
  "Cotton duvet",
  "Trail bottle",
];

const agents = ["Priya Nair", "Jonah Cole", "Elena Voss", "Sam Okoye"];

function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCHours(15, 30, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

async function main() {
  await prisma.note.deleteMany();
  await prisma.returnRequest.deleteMany();
  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE return_request_reference_seq RESTART WITH 1001`,
  );

  let approval = 0;
  let refunds = 0;

  for (let index = 0; index < 32; index += 1) {
    const status = statuses[index % statuses.length];
    const reason = reasons[(index * 3) % reasons.length];
    const [customerName, contact] = customers[index];
    const repeat = index === 4 || index === 20;
    const orderNumber = repeat ? "ORD-24018" : `ORD-${24001 + index}`;
    const itemName = repeat ? "Linen sheet set" : items[index % items.length];
    const author = agents[index % agents.length];

    const created = await createRequest({
      customerName: repeat ? "Mira Patel" : customerName,
      contact: repeat ? "mira.patel@example.com" : contact,
      orderNumber,
      itemName,
      quantity: (index % 3) + 1,
      reason,
    });

    if (index % 4 === 0) {
      await addNote(created.id, {
        author,
        body: "Customer confirmed the order number and how to reach them.",
      });
    }

    if (index === 0) {
      await updateRequest(created.id, { contact: "+1 415 555 0108" });
    }

    if (status === "OPEN") continue;

    await transitionRequest(created.id, { to: "IN_REVIEW" });
    if (status === "IN_REVIEW") {
      if (index % 4 === 2) {
        await addNote(created.id, {
          author,
          body: "Waiting on the warehouse to confirm what was packed.",
        });
      }
      continue;
    }

    if (status === "REJECTED") {
      await transitionRequest(created.id, { to: "REJECTED" });
      if (index % 4 === 2) {
        await addNote(created.id, {
          author,
          body: "Told the customer the request was rejected and why.",
        });
      }
      continue;
    }

    const resolution = resolutions[approval % resolutions.length];
    approval += 1;
    const refundAmount =
      resolution === "REFUND" ? refundAmounts[refunds++ % refundAmounts.length] : undefined;

    await transitionRequest(created.id, {
      to: "APPROVED",
      resolution,
      ...(refundAmount ? { refundAmount } : {}),
    });

    if (status === "COMPLETED") {
      if (index % 4 === 2) {
        await addNote(created.id, {
          author,
          body: "Customer has the outcome. Closing the request.",
        });
      }
      await transitionRequest(created.id, { to: "COMPLETED" });
    }
  }

  const hidden = await createRequest({
    customerName: "Ivy Dalton",
    contact: "ivy.dalton@example.com",
    orderNumber: "ORD-24999",
    itemName: "Canvas tote",
    quantity: 1,
    reason: "CHANGED_MIND",
  });
  await addNote(hidden.id, {
    author: "Priya Nair",
    body: "Customer called back and asked us to drop this one.",
  });
  await removeRequest(hidden.id);

  const rows = await prisma.returnRequest.findMany({
    include: { notes: { orderBy: { createdAt: "asc" } } },
    orderBy: { reference: "asc" },
  });

  for (const [index, row] of rows.entries()) {
    const createdAt = daysAgo(48 - index);
    for (const [noteIndex, note] of row.notes.entries()) {
      const at = new Date(createdAt.getTime() + (noteIndex + 1) * 2 * 60 * 60 * 1000);
      await prisma.note.update({ where: { id: note.id }, data: { createdAt: at } });
    }
    const updatedAt = new Date(
      createdAt.getTime() + (row.notes.length + 1) * 2 * 60 * 60 * 1000,
    );
    await prisma.$executeRaw`
      UPDATE return_requests
      SET created_at = ${createdAt},
          updated_at = ${updatedAt},
          removed_at = ${row.removedAt ? updatedAt : null}
      WHERE id = ${row.id}
    `;
  }

  const visible = rows.filter((row) => row.removedAt === null);
  const byStatus = Object.fromEntries(statuses.map((status) => [status, 0]));
  const byReason = Object.fromEntries(reasons.map((reason) => [reason, 0]));
  for (const row of visible) {
    byStatus[row.status] += 1;
    byReason[row.reason] += 1;
  }

  console.log(`Seeded ${rows.length} requests (${visible.length} on the desk).`);
  console.log(byStatus);
  console.log(byReason);
  console.log(
    `Hidden row: ${rows.find((row) => row.removedAt)?.reference ?? "none"} (soft-removed).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
