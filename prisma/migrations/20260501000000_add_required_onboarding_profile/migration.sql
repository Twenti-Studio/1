ALTER TABLE "users"
ADD COLUMN "full_name" TEXT,
ADD COLUMN "occupation" TEXT,
ADD COLUMN "fixed_income" INTEGER,
ADD COLUMN "monthly_dependents" INTEGER,
ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);
