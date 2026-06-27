-- User-defined financial schemes / budgets (FiNot warns at `threshold`% of `limit`).
CREATE TABLE "budget_schemes" (
    "id" SERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "categories" TEXT[],
    "limit" INTEGER NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "threshold" INTEGER NOT NULL DEFAULT 70,
    "last_alert_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "budget_schemes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "budget_schemes_user_id_idx" ON "budget_schemes"("user_id");

ALTER TABLE "budget_schemes"
ADD CONSTRAINT "budget_schemes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
