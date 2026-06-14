-- CreateEnum
CREATE TYPE "property_source" AS ENUM ('QUICKDEAL', 'SITE');

-- CreateEnum
CREATE TYPE "land_use" AS ENUM ('IZHS', 'SNT', 'LPH', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "commercial_kind" AS ENUM ('OFFICE', 'RETAIL', 'WAREHOUSE', 'FOOD_SERVICE', 'FREE_PURPOSE');

-- CreateEnum
CREATE TYPE "lead_status" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE', 'SPAM');

-- AlterEnum
BEGIN;
CREATE TYPE "property_type_new" AS ENUM ('APARTMENT', 'HOUSE', 'TOWNHOUSE', 'COMMERCIAL', 'LAND');
ALTER TABLE "properties" ALTER COLUMN "type" TYPE "property_type_new" USING ("type"::text::"property_type_new");
ALTER TYPE "property_type" RENAME TO "property_type_old";
ALTER TYPE "property_type_new" RENAME TO "property_type";
DROP TYPE "property_type_old";
COMMIT;

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "commercial_kind" "commercial_kind",
ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "external_source" TEXT,
ADD COLUMN     "land_use" "land_use",
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "source" "property_source" NOT NULL DEFAULT 'SITE',
ADD COLUMN     "synced_at" TIMESTAMP(3),
ADD COLUMN     "utilities" TEXT[];

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT,
    "source" TEXT,
    "direction" "property_direction",
    "property_id" UUID,
    "status" "lead_status" NOT NULL DEFAULT 'NEW',
    "consent_at" TIMESTAMP(3) NOT NULL,
    "telegram_sent_at" TIMESTAMP(3),
    "bitrix_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "direction" "property_direction" NOT NULL,
    "name" TEXT NOT NULL,
    "photo" TEXT,
    "phone" TEXT,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "telegram_bot_token" TEXT,
    "telegram_chat_id" TEXT,
    "bitrix_webhook_url" TEXT,
    "bitrix_enabled" BOOLEAN NOT NULL DEFAULT false,
    "usd_rub_surcharge" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_content" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "hero_title" TEXT,
    "hero_subtitle" TEXT,
    "hero_image_url" TEXT,
    "chosen_slugs" TEXT[],
    "tile_links" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "base" "currency" NOT NULL,
    "quote" "currency" NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "source" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_property_id_idx" ON "leads"("property_id");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "managers_direction_key" ON "managers"("direction");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_base_quote_key" ON "fx_rates"("base", "quote");

-- CreateIndex
CREATE INDEX "properties_type_idx" ON "properties"("type");

-- CreateIndex
CREATE INDEX "properties_source_idx" ON "properties"("source");

-- CreateIndex
CREATE UNIQUE INDEX "properties_source_external_id_key" ON "properties"("source", "external_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
