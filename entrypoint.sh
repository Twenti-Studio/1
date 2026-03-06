#!/bin/bash
set -e

echo "🧠 Starting FiNot - AI Financial Assistant"
echo "========================================="

# Set default PORT
if [ -z "$PORT" ]; then
    export PORT=8000
    echo "⚠️  PORT not set, using default: $PORT"
else
    echo "✅ Using PORT: $PORT"
fi

echo "   Environment: ${DEPLOYMENT_ENV:-production}"
echo "   Database: ${DATABASE_URL:0:50}..."
echo "========================================="

# Sync schema to database
echo ""
echo "🔄 Applying Prisma migrations..."
if python -m prisma migrate deploy 2>&1; then
    echo "✅ Migrations applied successfully"
else
    echo "⚠️  Migration failed - falling back to db push..."
    python -m prisma db push 2>&1 || echo "⚠️  Schema sync failed - will retry on next restart"
fi

# Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
python -m prisma generate

# Start application
echo ""
echo "🚀 Starting Uvicorn on 0.0.0.0:$PORT"
echo "========================================="
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --log-level info
