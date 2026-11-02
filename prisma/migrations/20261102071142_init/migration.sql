-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('DAMAGED', 'WRONG_ITEM', 'SIZE_ISSUE', 'NOT_AS_DESCRIBED', 'CHANGED_MIND');

-- CreateEnum
CREATE TYPE "Resolution" AS ENUM ('REFUND', 'REPLACEMENT', 'STORE_CREDIT');

-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('AGENT', 'SYSTEM');

-- CreateTable
CREATE TABLE "return_requests" (
    "id" TEXT NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "customer_name" VARCHAR(120) NOT NULL,
    "contact" VARCHAR(160) NOT NULL,
    "order_number" VARCHAR(40) NOT NULL,
    "item_name" VARCHAR(160) NOT NULL,
    "order_key" VARCHAR(40) NOT NULL,
    "item_key" VARCHAR(160) NOT NULL,
    "live_pair" VARCHAR(220),
    "quantity" INTEGER NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "Resolution",
    "refund_amount" DECIMAL(12,2),
    "removed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "author" VARCHAR(80) NOT NULL,
    "kind" "NoteKind" NOT NULL DEFAULT 'AGENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_reference_key" ON "return_requests"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_live_pair_key" ON "return_requests"("live_pair");

-- CreateIndex
CREATE INDEX "return_requests_removed_at_created_at_idx" ON "return_requests"("removed_at", "created_at");

-- CreateIndex
CREATE INDEX "return_requests_removed_at_status_idx" ON "return_requests"("removed_at", "status");

-- CreateIndex
CREATE INDEX "return_requests_removed_at_reason_idx" ON "return_requests"("removed_at", "reason");

-- CreateIndex
CREATE INDEX "return_requests_customer_name_idx" ON "return_requests"("customer_name");

-- CreateIndex
CREATE INDEX "return_requests_order_number_idx" ON "return_requests"("order_number");

-- CreateIndex
CREATE INDEX "notes_request_id_created_at_idx" ON "notes"("request_id", "created_at");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "return_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reference numbers are issued by the database. The app formats them as RD-1001.
CREATE SEQUENCE "return_request_reference_seq" START WITH 1001;

ALTER TABLE "return_requests"
  ADD CONSTRAINT "return_requests_quantity_positive" CHECK ("quantity" > 0);

-- Refund stores an amount greater than zero. Every other resolution stores none.
ALTER TABLE "return_requests"
  ADD CONSTRAINT "return_requests_refund_matches_resolution" CHECK (
    (
      "resolution"::text = 'REFUND'
      AND "refund_amount" IS NOT NULL
      AND "refund_amount" > 0
    )
    OR (
      "resolution" IS DISTINCT FROM 'REFUND'::"Resolution"
      AND "refund_amount" IS NULL
    )
  );

-- A resolution exists only after approval, and stays through completion.
ALTER TABLE "return_requests"
  ADD CONSTRAINT "return_requests_resolution_follows_status" CHECK (
    (
      "status"::text IN ('APPROVED', 'COMPLETED')
      AND "resolution" IS NOT NULL
    )
    OR (
      "status"::text IN ('OPEN', 'IN_REVIEW', 'REJECTED')
      AND "resolution" IS NULL
    )
  );

ALTER TABLE "notes"
  ADD CONSTRAINT "notes_body_not_blank" CHECK (length(btrim("body")) > 0);

ALTER TABLE "notes"
  ADD CONSTRAINT "notes_author_not_blank" CHECK (length(btrim("author")) > 0);
