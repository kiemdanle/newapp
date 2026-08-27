-- CreateTable
CREATE TABLE "admin_trusted_devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceInfo" JSONB,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_trusted_devices_tokenHash_key" ON "admin_trusted_devices"("tokenHash");

-- CreateIndex
CREATE INDEX "admin_trusted_devices_userId_idx" ON "admin_trusted_devices"("userId");

-- AddForeignKey
ALTER TABLE "admin_trusted_devices" ADD CONSTRAINT "admin_trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
