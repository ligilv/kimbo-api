-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "height_cm" DOUBLE PRECISION NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "target_weight_kg" DOUBLE PRECISION,
    "activity" TEXT NOT NULL,
    "diet" TEXT NOT NULL,
    "height_unit" TEXT NOT NULL,
    "weight_unit" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "meal_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_items" (
    "id" TEXT NOT NULL,
    "meal_log_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "meal_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_logs_user_id_date_idx" ON "meal_logs"("user_id", "date");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_meal_log_id_fkey" FOREIGN KEY ("meal_log_id") REFERENCES "meal_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase exposes the public schema through its Data API (anon key). Enable RLS
-- with no policies so only this server (connecting as the owner role) can read/write.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meal_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meal_items" ENABLE ROW LEVEL SECURITY;
