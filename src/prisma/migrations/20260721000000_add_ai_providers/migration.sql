-- AlterTable: Add AI config fields to workspaces
ALTER TABLE "workspaces" ADD COLUMN "defaultAIProviderId" TEXT,
ADD COLUMN "defaultAIModel" TEXT;

-- CreateTable: AI Providers
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AI Provider Models
CREATE TABLE "ai_provider_models" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "modelCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AI Provider Headers
CREATE TABLE "ai_provider_headers" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_headers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on workspace + providerId
CREATE UNIQUE INDEX "ai_providers_workspaceId_providerId_key" ON "ai_providers"("workspaceId", "providerId");

-- AddForeignKey: AI Provider -> Workspace
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AI Provider Model -> AI Provider
ALTER TABLE "ai_provider_models" ADD CONSTRAINT "ai_provider_models_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AI Provider Header -> AI Provider
ALTER TABLE "ai_provider_headers" ADD CONSTRAINT "ai_provider_headers_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
