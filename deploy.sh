#!/bin/bash
# ═══════════════════════════════════════════════════
# FiNot Deploy Script
# ═══════════════════════════════════════════════════
# Update aplikasi dari git tanpa menghapus database.
#
# Usage:
#   ./deploy.sh          → Pull + rebuild + restart bot
#   ./deploy.sh logs     → Lihat log bot (live/follow)
#   ./deploy.sh status   → Cek status semua container
#   ./deploy.sh restart  → Restart bot tanpa rebuild
#   ./deploy.sh stop     → Stop bot saja (DB tetap jalan)
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

show_banner() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo -e "${CYAN}  🧠 FiNot Deploy Script${NC}"
    echo -e "${CYAN}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo ""
}

show_status() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo -e "${CYAN}  📊 Container Status${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"

    BOT_STATUS=$(docker ps --filter "name=finot-bot" --format "{{.Status}}" 2>/dev/null || true)
    DB_STATUS=$(docker ps --filter "name=finot-db" --format "{{.Status}}" 2>/dev/null || true)

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
        log_warn "Health:   HTTP ${HEALTH_RESULT} (mungkin belum ready)"
    fi

    echo ""
}

# ═══════════════════════════════════════════════════
# COMMAND ROUTING
# ═══════════════════════════════════════════════════

ACTION="${1:-deploy}"

case "$ACTION" in

# ── ./deploy.sh logs ──────────────────────────────
logs)
    show_banner
    log_info "📜 Menampilkan log bot (Ctrl+C untuk keluar)..."
    echo -e "${CYAN}───────────────────────────────────────────${NC}"
    docker logs finot-bot --tail 50 -f 2>&1
    ;;

# ── ./deploy.sh status ────────────────────────────
status)
    show_banner
    show_status

    log_info "📜 Log terakhir bot (20 baris):"
    echo -e "${CYAN}───────────────────────────────────────────${NC}"
    docker logs finot-bot --tail 20 2>&1 || true
    echo -e "${CYAN}───────────────────────────────────────────${NC}"
    ;;

# ── ./deploy.sh restart ───────────────────────────
restart)
    show_banner
    log_info "🔄 Restarting bot container (database tetap jalan)..."
    docker compose -f ${COMPOSE_FILE} restart bot
    log_ok "Bot restarted"
    sleep 5
    show_status
    ;;

# ── ./deploy.sh stop ──────────────────────────────
stop)
    show_banner
    log_info "⏹️  Stopping bot container (database tetap jalan)..."
    docker compose -f ${COMPOSE_FILE} stop bot
    log_ok "Bot stopped"
    show_status
    ;;

# ── ./deploy.sh (default: full deploy) ────────────
deploy)
    show_banner

    # ── Step 1: Check .env ────────────────────────
    if [ ! -f ".env" ]; then
        log_error "File .env tidak ditemukan!"
        echo ""
        log_info "Buat file .env di server:"
        echo "   nano .env"
        echo ""
        log_info "Atau copy dari lokal:"
        echo "   scp .env root@your-server:~/1/.env"
        echo ""
        exit 1
    fi
    log_ok ".env file found"

    # ── Step 2: Pull latest code ──────────────────
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

    # ── Step 3: Backup database ───────────────────
    DB_RUNNING=$(docker ps --filter "name=finot-db" --format "{{.Status}}" 2>/dev/null || true)

    if [ -n "$DB_RUNNING" ]; then
        log_info "💾 Creating database backup..."
        BACKUP_DIR="./backups"
        mkdir -p "$BACKUP_DIR"
        BACKUP_FILE="${BACKUP_DIR}/finot_backup_$(date '+%Y%m%d_%H%M%S').sql"

        if docker exec finot-db pg_dump -U "${DB_USER:-finot_user}" "${DB_NAME:-finot_bot_db}" > "$BACKUP_FILE" 2>/dev/null; then
            BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
            log_ok "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
        else
            log_warn "Backup failed - continuing without backup"
            rm -f "$BACKUP_FILE"
        fi

        # Cleanup old backups (keep last 5)
        BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.sql 2>/dev/null | wc -l)
        if [ "$BACKUP_COUNT" -gt 5 ]; then
            log_info "🗑️  Cleaning old backups (keeping last 5)..."
            ls -1t "$BACKUP_DIR"/*.sql | tail -n +6 | xargs rm -f
        fi
    else
        log_warn "Database not running - skipping backup"
    fi

    # ── Step 4: Rebuild & restart bot ONLY ────────
    # Kunci utama: HANYA rebuild bot, database TIDAK disentuh
    log_info "🔨 Rebuilding & restarting bot (database tetap aman)..."
    echo ""

    # docker compose up --build -d:
    #   - Rebuild image bot jika Dockerfile/code berubah
    #   - Restart HANYA container yang berubah
    #   - Database container TIDAK di-restart jika tidak berubah
    docker compose -f ${COMPOSE_FILE} up --build -d
    log_ok "Deploy complete"

    # ── Step 5: Wait & verify ─────────────────────
    log_info "⏳ Waiting for bot to start (15 seconds)..."
    sleep 15

    show_status

    # Show recent logs
    log_info "📜 Recent bot logs:"
    echo -e "${CYAN}───────────────────────────────────────────${NC}"
    docker logs finot-bot --tail 30 2>&1 || true
    echo -e "${CYAN}───────────────────────────────────────────${NC}"

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ Deploy selesai!${NC}"
    echo -e "${GREEN}  Database: TETAP AMAN (tidak dihapus)${NC}"
    echo -e "${GREEN}  Volume: postgres_data preserved${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    ;;

# ── Unknown command ───────────────────────────────
*)
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  (kosong)   Full deploy (pull + rebuild + restart)"
    echo "  logs       Lihat log bot secara live"
    echo "  status     Cek status container"
    echo "  restart    Restart bot tanpa rebuild"
    echo "  stop       Stop bot saja (DB tetap jalan)"
    echo ""
    ;;

esac
