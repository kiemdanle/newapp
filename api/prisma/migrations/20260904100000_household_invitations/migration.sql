-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "household_invitation_status" AS ENUM ('pending', 'accepted', 'declined', 'expired', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "household_invitations" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "inviter_user_id" UUID NOT NULL,
    "invited_email" TEXT NOT NULL,
    "invited_user_id" UUID,
    "token" TEXT NOT NULL,
    "status" "household_invitation_status" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "household_invitations_token_key" ON "household_invitations"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "household_invitations_invited_email_status_idx" ON "household_invitations"("invited_email", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "household_invitations_household_id_status_idx" ON "household_invitations"("household_id", "status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
