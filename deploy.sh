#!/bin/bash
# ═══════════════════════════════════════════════════
# FiNot Deploy Script
# ═══════════════════════════════════════════════════
# Update aplikasi dari git tanpa menghapus database.
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ═══════════════════════════════════════════════════

set -e

# ── Colors ─────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Config ─────────────────────────────────────────
APP_NAME="finot-bot"
COMPOSE_FILE="docker-compose.yml"
BRANCH="main"

# ── Helper functions ───────────────────────────────
log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ═══════════════════════════════════════════════════
# START
# ═══════════════════════════════════════════════════

echo ""
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  🧠 FiNot Deploy Script${NC}"
echo -e "${CYAN}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo ""

# ── Step 1: Pull latest code ──────────────────────
log_info "📥 Pulling latest code from origin/${BRANCH}..."

git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/${BRANCH})

if [ "$LOCAL" = "$REMOTE" ]; then
    log_warn "Sudah up-to-date. Tidak ada perubahan baru."
    read -p "Tetap ingin rebuild? (y/n): " FORCE_REBUILD
    if [ "$FORCE_REBUILD" != "y" ]; then
        log_info "Deploy dibatalkan."
        exit 0
    fi
fi

git pull origin ${BRANCH}
log_ok "Code updated to latest commit"

# Show latest commit info
echo ""
log_info "📋 Commit terbaru:"
git log -1 --pretty=format:"   %h - %s (%cr by %an)" --abbrev-commit
echo ""
echo ""

# ── Step 2: Backup check ─────────────────────────
log_info "🔍 Checking database container..."

DB_RUNNING=$(docker ps --filter "name=finot-db" --format "{{.Status}}" 2>/dev/null || true)

if [ -n "$DB_RUNNING" ]; then
    log_ok "Database container running: ${DB_RUNNING}"
else
    log_warn "Database container not running. Will start with deploy."
fi

# ── Step 3: Backup database (optional) ────────────
log_info "💾 Creating database backup..."

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/finot_backup_$(date '+%Y%m%d_%H%M%S').sql"

if [ -n "$DB_RUNNING" ]; then
    if docker exec finot-db pg_dump -U "${DB_USER:-finot_user}" "${DB_NAME:-finot_bot_db}" > "$BACKUP_FILE" 2>/dev/null; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_ok "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
    else
        log_warn "Backup failed - continuing without backup"
        rm -f "$BACKUP_FILE"
    fi
else
    log_warn "Skipping backup - database not running"
fi

# Cleanup old backups (keep last 5)
if [ -d "$BACKUP_DIR" ]; then
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.sql 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt 5 ]; then
        log_info "🗑️  Cleaning old backups (keeping last 5)..."
        ls -1t "$BACKUP_DIR"/*.sql | tail -n +6 | xargs rm -f
    fi
fi

# ── Step 4: Rebuild bot container only ────────────
log_info "🔨 Rebuilding bot container (database tetap aman)..."
echo ""

# Build ulang HANYA bot container, tanpa sentuh database
docker compose -f ${COMPOSE_FILE} build --no-cache bot
log_ok "Bot container rebuilt"

# ── Step 5: Restart bot container ─────────────────
log_info "🔄 Restarting bot container..."

# Stop hanya bot, JANGAN stop database
docker compose -f ${COMPOSE_FILE} stop bot
docker compose -f ${COMPOSE_FILE} rm -f bot

# Start ulang (database tetap jalan, bot start fresh)
docker compose -f ${COMPOSE_FILE} up -d
log_ok "Containers started"

# ── Step 6: Wait & verify ─────────────────────────
log_info "⏳ Waiting for bot to start (15 seconds)..."
sleep 15

# Check bot health
BOT_STATUS=$(docker ps --filter "name=finot-bot" --format "{{.Status}}" 2>/dev/null || true)
DB_STATUS=$(docker ps --filter "name=finot-db" --format "{{.Status}}" 2>/dev/null || true)

echo ""
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  📊 Deploy Status${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"

if [ -n "$BOT_STATUS" ]; then
    log_ok "Bot:      ${BOT_STATUS}"
else
    log_error "Bot:      NOT RUNNING ❌"
fi

if [ -n "$DB_STATUS" ]; then
    log_ok "Database: ${DB_STATUS}"
else
    log_error "Database: NOT RUNNING ❌"
fi

# Health check via HTTP
HEALTH_RESULT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")

if [ "$HEALTH_RESULT" = "200" ]; then
    log_ok "Health:   HTTP 200 ✅"
else
    log_warn "Health:   HTTP ${HEALTH_RESULT} (mungkin masih loading...)"
fi

echo ""

# Show recent logs
log_info "📜 Recent bot logs:"
echo -e "${CYAN}───────────────────────────────────────────${NC}"
docker logs finot-bot --tail 20 2>&1 || true
echo -e "${CYAN}───────────────────────────────────────────${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Deploy selesai!${NC}"
echo -e "${GREEN}  Database: TETAP AMAN (tidak dihapus)${NC}"
echo -e "${GREEN}  Volume: postgres_data preserved${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
