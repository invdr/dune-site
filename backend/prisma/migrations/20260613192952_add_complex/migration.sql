-- CreateTable
CREATE TABLE "complexes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "property_status" NOT NULL DEFAULT 'DRAFT',
    "direction" "property_direction" NOT NULL DEFAULT 'NEW',
    "country" "country" NOT NULL DEFAULT 'RU',
    "city" TEXT NOT NULL,
    "district" TEXT,
    "developer" TEXT,
    "delivery" TEXT,
    "description" TEXT,
    "photos" TEXT[],
    "placeholder_tone" TEXT,
    "badges" TEXT[],
    "features" TEXT[],
    "attributes" JSONB NOT NULL DEFAULT '[]',
    "premium" BOOLEAN NOT NULL DEFAULT false,
    "price_from" INTEGER,
    "area_from" INTEGER,
    "currency" "currency" NOT NULL DEFAULT 'RUB',
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "complexes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "complexes_slug_key" ON "complexes"("slug");

-- CreateIndex
CREATE INDEX "complexes_status_idx" ON "complexes"("status");

-- CreateIndex
CREATE INDEX "complexes_direction_idx" ON "complexes"("direction");
