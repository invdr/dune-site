-- CreateEnum
CREATE TYPE "property_direction" AS ENUM ('NEW', 'RESALE', 'DUBAI', 'SAUDI');

-- CreateEnum
CREATE TYPE "property_type" AS ENUM ('APARTMENT', 'STUDIO', 'HOUSE', 'VILLA');

-- CreateEnum
CREATE TYPE "property_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'SOLD');

-- CreateEnum
CREATE TYPE "currency" AS ENUM ('RUB', 'USD');

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "direction" "property_direction" NOT NULL,
    "type" "property_type" NOT NULL,
    "status" "property_status" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "rooms" INTEGER NOT NULL DEFAULT 0,
    "area" INTEGER NOT NULL,
    "floor" INTEGER,
    "total_floors" INTEGER,
    "complex" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "price" INTEGER NOT NULL,
    "currency" "currency" NOT NULL DEFAULT 'RUB',
    "premium" BOOLEAN NOT NULL DEFAULT false,
    "installment" BOOLEAN NOT NULL DEFAULT false,
    "is_new_building" BOOLEAN NOT NULL DEFAULT false,
    "delivery" TEXT,
    "photos" TEXT[],
    "placeholder_tone" TEXT,
    "badges" TEXT[],
    "features" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "properties_direction_idx" ON "properties"("direction");

-- CreateIndex
CREATE INDEX "properties_price_idx" ON "properties"("price");

-- CreateIndex
CREATE INDEX "properties_status_direction_idx" ON "properties"("status", "direction");

