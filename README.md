# ReturnDesk

A returns desk for a small online store. An agent raises a return or replacement, finds it among the others, moves it through a fixed lifecycle, leaves notes, and can take an open or rejected request off the desk without deleting the row.

The live desk is at https://returndesk-sepia.vercel.app. The same app also runs locally.

## Setup

You need Node.js 20 or newer, npm, and Docker Desktop with the engine running.

```bash
copy .env.example .env
npm install
npm run db:setup
npm run dev
```

Open http://localhost:3000.

`npm run db:setup` starts Postgres, waits until it is healthy, applies migrations, and loads the seed. The same steps one at a time:

```bash
docker compose up -d --wait
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Postgres listens on `localhost:5432` with user, password, and database `returndesk`. If that port is already taken, change the host port in `docker-compose.yml` and the host port in `DATABASE_URL` together.

`npx prisma db seed` can be run again. It clears return requests and notes, restarts the reference sequence at 1001, and inserts a fresh desk. That reset lives only in the seed script. The application API never hard-deletes a request or a note.

Optional check of the business rules against the local database:

```bash
npx tsx scripts/check-rules.ts
```

That script creates rows whose order numbers start with `RULE-`, asserts the refusals, and deletes only those rows when it finishes.

## What the seed contains

32 requests on the desk, spread across every status and every reason. Some have notes. `ORD-24018` / `Linen sheet set` appears twice: once completed, and once open again after that. `RD-1033` is an open request that was soft-removed, so it is absent from the list and from `GET`, and it still occupies that order and item.

## Stack

- Next.js App Router (route handlers, not a separate Express server)
- React and Tailwind CSS
- PostgreSQL 16 via Docker Compose
- Prisma 6 and Zod
- TypeScript

Prisma is the query layer because the schema file is the data model, `migrate deploy` rebuilds it from empty, and the generated client keeps the route handlers thin. The migration SQL also adds the check constraints and the reference sequence, which is the part of the model Prisma's schema language does not express directly. Prisma is pinned to 6.19 because that version still uses `url = env("DATABASE_URL")` and `prisma migrate deploy`. Newer Prisma releases move connection setup into a different config and adapter flow, which is more machinery than this app needs.

## Data model

`return_requests` holds the customer, contact, order, item, quantity, reason, status, and, once approved, the resolution. `notes` are a child table. The foreign key uses `ON DELETE RESTRICT`, and there is no delete path for either table in the API.

`live_pair` is a nullable unique column. It is set to a normalized `order + item` key while the request is Open, In Review, or Approved, and cleared when the request becomes Rejected or Completed. Postgres unique indexes allow many nulls, so a later request can reuse the order and item only after the earlier one is closed out. A soft-removed Open request keeps its `live_pair`, so it still blocks a duplicate.

The database also checks that quantity is positive, that a refund amount exists only for a Refund and is greater than zero, and that a resolution exists only on Approved and Completed requests.

References are `RD-1001`, `RD-1002`, and so on, from the sequence `return_request_reference_seq`. Clients cannot supply one.

## API

All errors use this JSON body. They are not returned as HTTP 200, and they are not HTML pages.

```json
{
  "error": {
    "code": "ILLEGAL_TRANSITION",
    "message": "Cannot move a request from Open to Completed.",
    "details": { "from": "OPEN", "to": "COMPLETED", "allowed": ["IN_REVIEW"] }
  }
}
```

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/requests` | Search, filter, sort, and paginate in one query. Soft-removed rows are excluded. |
| `POST` | `/api/requests` | Create an Open request and issue a reference. |
| `GET` | `/api/requests/:id` | One request and its notes, oldest first. |
| `PATCH` | `/api/requests/:id` | Edit customer and item details while Open or In Review. |
| `POST` | `/api/requests/:id/transitions` | Move to a legal next status. |
| `POST` | `/api/requests/:id/notes` | Append a note. |
| `DELETE` | `/api/requests/:id` | Soft-remove an Open or Rejected request. |

List query parameters are `q`, `status`, `reason`, `sort` (`newest`, `oldest`, `customer`, `customer_desc`, `updated`, `reference`), `page`, and `pageSize` (1–50, default 10). `q` matches customer, order number, or reference, case-insensitively. An invalid filter is a 400, not a silent ignore.

Status codes used on purpose: `201` created, `200` read or updated, `400` malformed input, `404` missing or already removed, `409` a business rule refused the action.

Rule codes: `ILLEGAL_TRANSITION`, `RESOLUTION_REQUIRED`, `REFUND_AMOUNT_REQUIRED`, `REFUND_AMOUNT_NOT_ALLOWED`, `DUPLICATE_LIVE_REQUEST`, `DETAILS_LOCKED`, `REMOVAL_NOT_ALLOWED`, `VALIDATION_ERROR`, `NOT_FOUND`.

## How the rules are enforced

1. **Status.** The only legal moves are Open → In Review → Approved → Completed, and In Review → Rejected. Rejected and Completed have no exit. The check runs in the transition handler before the update, and the update itself is conditional on the status just read so two overlapping moves cannot both succeed.
2. **Approval.** Approving requires Refund, Replacement, or Store Credit. Refund requires an amount greater than zero, stored with two decimal places. Any other resolution must omit the amount. A check constraint repeats that invariant.
3. **One live request per order and item.** Order and item are compared after trim, case folding, and collapsing internal spaces. The unique `live_pair` column is what makes a race return 409 instead of two live rows.
4. **Locked once decided.** Customer, contact, order, item, quantity, and reason cannot be patched once the status is Approved, Rejected, or Completed. Notes still can.
5. **Removal.** `DELETE` sets `removed_at`. The row stays. List and detail queries require `removed_at` to be null, so a removed request is a 404. Only Open and Rejected requests can be removed.

## Interface

The desk searches on the server. The search box waits 350ms after typing stops before it changes the query string and fetches. Status, reason, sort, and page are applied with that same request. Status is a text badge, not color alone. Buttons are limited to the transitions, edits, and removal the current status allows. Loading, empty, and error states are on the desk and on a request. A refusal from the server is shown with the message from the JSON body.

The layout is a single column of cards with stacked filters, so it stays usable at 375px wide.

## Assumptions

- There is no login. The name on a note is whatever the agent types, remembered in `localStorage` under `returndesk.agentName`. If they leave it blank, the note is stored as "Agent".
- "How to reach them" is one contact string, an email or a phone, at least 3 characters. It is not verified.
- An item is identified by its name. The brief does not mention SKUs. `Wool Throw` and `wool throw` are the same item on an order.
- Reason and quantity lock together with the customer and item once a decision is recorded. Changing them later would rewrite the facts the decision was based on.
- Resolution is chosen at approval and is not edited afterwards. The brief locks customer and item details, and does not provide a way back out of Approved.
- A soft-removed Open or Rejected request has not reached a final status, so it still counts as the live request for that order and item. Rejected rows already have a null `live_pair`, so only a removed Open request continues to block.
- Each transition, detail edit, and removal appends a system note. Agent notes and system notes are both append-only. There is no route to edit or delete a note.
- Money is USD for display. The API stores the refund amount as a decimal string with two places.

## Done

- Create, list, detail, lifecycle, notes, and soft-remove
- All five business rules enforced in the route handlers and backed by database constraints
- Seed of 32 visible requests plus one hidden row
- Docker Compose, migration, `.env.example`
- Public deployment at https://returndesk-sepia.vercel.app

## Not done

- Accounts, roles, or an audit log beyond the note timeline
- Photos, email to the customer, or a warehouse integration

Hours spent: 8
