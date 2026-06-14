-- Web-first account model: Telegram becomes an optional linked identity.

-- AlterTable: add Telegram linking columns
ALTER TABLE "users" ADD COLUMN "telegram_id" BIGINT;
ALTER TABLE "users" ADD COLUMN "telegram_link_code" TEXT;
ALTER TABLE "users" ADD COLUMN "telegram_link_expires_at" TIMESTAMP(3);

-- Unique constraint for telegram_id (nullable allows multiple NULLs)
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- Backfill: all existing positive-id accounts are Telegram-origin
-- (their PK currently equals their Telegram id). Negative ids are web placeholders.
UPDATE "users" SET "telegram_id" = "id" WHERE "id" > 0;

-- Dedicated sequence for new web account ids, in a high band that will never
-- collide with Telegram ids (resolved separately via the telegram_id column).
CREATE SEQUENCE IF NOT EXISTS "web_user_id_seq" START 1000000000000;
