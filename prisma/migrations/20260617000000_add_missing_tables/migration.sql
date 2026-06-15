-- Repair drift: these models existed in schema.prisma but their tables were
-- never created by a migration on some databases (they had only been `db push`ed
-- in dev). Idempotent so it is safe to run on every environment.

-- ── site_settings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "site_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

-- ── legal_documents ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "legal_documents" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "legal_documents_slug_key" ON "legal_documents"("slug");

-- ── reports ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "reports" (
    "id" SERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'bug',
    "status" TEXT NOT NULL DEFAULT 'open',
    "admin_reply" TEXT,
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "reports_user_id_idx" ON "reports"("user_id");
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports"("status");
CREATE INDEX IF NOT EXISTS "reports_created_at_idx" ON "reports"("created_at");

-- ── ai_conversations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ai_conversations" (
    "id" SERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "feature" TEXT NOT NULL,
    "user_query" TEXT,
    "ai_response" TEXT,
    "ai_meta" JSONB,
    "credit_used" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_conversations_user_id_idx" ON "ai_conversations"("user_id");
CREATE INDEX IF NOT EXISTS "ai_conversations_feature_idx" ON "ai_conversations"("feature");
CREATE INDEX IF NOT EXISTS "ai_conversations_created_at_idx" ON "ai_conversations"("created_at");

-- Foreign keys (added only when missing, since CREATE TABLE IF NOT EXISTS may skip)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_user_id_fkey') THEN
        ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_conversations_user_id_fkey') THEN
        ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
