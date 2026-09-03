-- CreateEnum
CREATE TYPE "feedback_type" AS ENUM ('bug', 'suggestion', 'feedback');

-- CreateEnum
CREATE TYPE "feedback_status" AS ENUM ('open', 'in_progress', 'replied', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "feedback_sender_type" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "feedback_admin_alert_status" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "feedback_tickets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "feedback_type" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "feedback_status" NOT NULL DEFAULT 'open',
    "device_info" JSONB,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_attachments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID,
    "uploader_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sender_type" "feedback_sender_type" NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_admin_alert_outbox" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "status" "feedback_admin_alert_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "dispatched_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_admin_alert_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_tickets_user_id_created_at_idx" ON "feedback_tickets"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "feedback_tickets_status_type_created_at_idx" ON "feedback_tickets"("status", "type", "created_at");

-- CreateIndex
CREATE INDEX "feedback_attachments_ticket_id_idx" ON "feedback_attachments"("ticket_id");

-- CreateIndex
CREATE INDEX "feedback_attachments_uploader_id_idx" ON "feedback_attachments"("uploader_id");

-- CreateIndex
CREATE INDEX "feedback_messages_ticket_id_created_at_idx" ON "feedback_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "feedback_admin_alert_outbox_status_created_at_idx" ON "feedback_admin_alert_outbox"("status", "created_at");

-- CreateIndex
CREATE INDEX "feedback_admin_alert_outbox_ticket_id_idx" ON "feedback_admin_alert_outbox"("ticket_id");

-- AddForeignKey
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_attachments" ADD CONSTRAINT "feedback_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "feedback_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_attachments" ADD CONSTRAINT "feedback_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "feedback_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_admin_alert_outbox" ADD CONSTRAINT "feedback_admin_alert_outbox_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "feedback_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
