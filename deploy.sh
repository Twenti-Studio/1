#!/bin/bash
# ═══════════════════════════════════════════════════
# FiNot Deploy Script
# ═══════════════════════════════════════════════════
# Deploy/manage FiNot on the server.
# Frontend React SPA is built inside Docker (multi-stage).
# Nginx reverse proxy + SSL handled via setup command.
#
# Usage:
#   ./deploy.sh              → Full deploy (pull + build + migrate + restart)
#   ./deploy.sh setup        → First-time: install deps + Nginx + SSL
#   ./deploy.sh logs         → Lihat log bot (live/follow)
#   ./deploy.sh status       → Cek status semua container
#   ./deploy.sh restart      → Restart bot tanpa rebuild
#   ./deploy.sh stop         → Stop bot saja (DB tetap jalan)
#   ./deploy.sh migrate      → Jalankan Prisma migration saja
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
DOMAIN="finot.twenti.studio"
UPSTREAM_PORT=8000

# ── Helper functions ───────────────────────────────
log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_banner() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo -e "${CYAN}  🧠 FiNot Deploy Script${NC}"
    echo -e "${CYAN}  Domain: ${DOMAIN}${NC}"
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
    HEALTH_RESULT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${UPSTREAM_PORT}/health 2>/dev/null || echo "000")

    if [ "$HEALTH_RESULT" = "200" ]; then
        log_ok "Health:   HTTP 200 ✅"
    else
        log_warn "Health:   HTTP ${HEALTH_RESULT} (mungkin belum ready)"
    fi

    # Check Nginx
    if systemctl is-active --quiet nginx 2>/dev/null; then
        log_ok "Nginx:    active ✅"
    else
        log_warn "Nginx:    not running"
    fi

    echo ""
}

# ═══════════════════════════════════════════════════
# COMMAND ROUTING
# ═══════════════════════════════════════════════════

ACTION="${1:-deploy}"

case "$ACTION" in

# ── ./deploy.sh setup ─────────────────────────────
# First-time server setup: Docker, Nginx, SSL
setup)
    show_banner
    log_info "🔧 First-time server setup..."
    echo ""

    # Install Docker if not present
    if ! command -v docker &>/dev/null; then
        log_info "📦 Installing Docker..."
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
        log_ok "Docker installed"
    else
        log_ok "Docker already installed ($(docker --version | head -1))"
    fi

    # Install docker compose plugin if not present
    if ! docker compose version &>/dev/null; then
        log_info "📦 Installing Docker Compose plugin..."
        apt-get update && apt-get install -y docker-compose-plugin
        log_ok "Docker Compose plugin installed"
    else
        log_ok "Docker Compose already available"
    fi

    # Install Nginx and Certbot
    log_info "📦 Installing Nginx & Certbot..."
    apt-get update && apt-get install -y nginx certbot python3-certbot-nginx
    log_ok "Nginx & Certbot installed"

    # Create Nginx config for the domain
    log_info "📝 Configuring Nginx for ${DOMAIN}..."
    cat > /etc/nginx/sites-available/${DOMAIN} <<'NGINX_CONF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
NGINX_CONF
    # Replace placeholders
    sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /etc/nginx/sites-available/${DOMAIN}
    sed -i "s/PORT_PLACEHOLDER/${UPSTREAM_PORT}/g" /etc/nginx/sites-available/${DOMAIN}

    # Enable site
    ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

    # Test and reload Nginx
    nginx -t && systemctl reload nginx
    log_ok "Nginx configured for ${DOMAIN}"

    # Setup SSL with Certbot
    log_info "🔒 Setting up SSL certificate with Let's Encrypt..."
    echo ""
    log_info "Make sure DNS for ${DOMAIN} points to this server IP first!"
    echo ""
    read -p "Continue with SSL setup? (y/n): " SSL_CONFIRM
    if [ "$SSL_CONFIRM" = "y" ]; then
        certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@twenti.studio --redirect
        log_ok "SSL certificate installed!"
    else
        log_warn "Skipping SSL - run 'certbot --nginx -d ${DOMAIN}' later"
    fi

    # Check .env
    if [ ! -f ".env" ]; then
        log_warn "File .env belum ada!"
        log_info "Copy dari .env.example dan isi:"
        echo "   cp .env.example .env"
        echo "   nano .env"
    else
        log_ok ".env file exists"
    fi

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ Setup selesai!${NC}"
    echo -e "${GREEN}  ${NC}"
    echo -e "${GREEN}  Next steps:${NC}"
    echo -e "${GREEN}  1. Pastikan .env sudah terisi${NC}"
    echo -e "${GREEN}  2. Jalankan: ./deploy.sh${NC}"
    echo -e "${GREEN}  3. Landing:    https://${DOMAIN}${NC}"
    echo -e "${GREEN}  4. Dashboard:  https://${DOMAIN}/login${NC}"
    echo -e "${GREEN}  5. Admin:      https://${DOMAIN}/admin/login${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    ;;

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
        log_info "Buat file .env dari example:"
        echo "   cp .env.example .env"
        echo "   nano .env"
        echo ""
        log_info "Atau untuk first-time setup:"
        echo "   ./deploy.sh setup"
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

    # ── Step 4: Build & restart ───────────────────
    # Multi-stage Docker build: React frontend + Python backend
    log_info "🔨 Building Docker image (frontend + backend)..."
    echo ""

    docker compose -f ${COMPOSE_FILE} up --build -d
    log_ok "Build complete"

    # ── Step 5: Run Prisma migrations ─────────────
    log_info "📀 Running Prisma database migrations..."
    sleep 5  # Wait for DB to be ready

    if docker exec finot-bot python -m prisma migrate deploy 2>/dev/null; then
        log_ok "Prisma migrations applied"
    else
        log_warn "Prisma migrate failed - trying prisma db push..."
        docker exec finot-bot python -m prisma db push --accept-data-loss 2>/dev/null || {
            log_warn "Prisma push also failed - schema may need manual migration"
        }
    fi

    # ── Step 6: Wait & verify ─────────────────────
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
    echo -e "${GREEN}  ${NC}"
    echo -e "${GREEN}  🌐 Landing:    https://${DOMAIN}${NC}"
    echo -e "${GREEN}  📊 Dashboard:  https://${DOMAIN}/login${NC}"
    echo -e "${GREEN}  🔐 Admin:      https://${DOMAIN}/admin/login${NC}"
    echo -e "${GREEN}  💚 Health:     https://${DOMAIN}/health${NC}"
    echo -e "${GREEN}  ${NC}"
    echo -e "${GREEN}  Database: TETAP AMAN (tidak dihapus)${NC}"
    echo -e "${GREEN}  Volume: postgres_data preserved${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    ;;

# ── ./deploy.sh migrate ──────────────────────────
migrate)
    show_banner
    log_info "📀 Running Prisma database migrations..."

    BOT_RUNNING=$(docker ps --filter "name=finot-bot" --format "{{.Status}}" 2>/dev/null || true)
    if [ -z "$BOT_RUNNING" ]; then
        log_error "Bot container belum jalan. Jalankan './deploy.sh' dulu."
        exit 1
    fi

    if docker exec finot-bot python -m prisma migrate deploy 2>/dev/null; then
        log_ok "Prisma migrations applied successfully"
    else
        log_warn "prisma migrate failed - trying prisma db push..."
        docker exec finot-bot python -m prisma db push --accept-data-loss 2>/dev/null || {
            log_error "Migration failed. Check schema manually."
            exit 1
        }
        log_ok "prisma db push completed"
    fi

    log_info "🔄 Restarting bot to pickup schema changes..."
    docker compose -f ${COMPOSE_FILE} restart bot
    sleep 5
    show_status
    ;;

# ── Unknown command ───────────────────────────────
*)
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  (kosong)   Full deploy (pull + build + migrate + restart)"
    echo "  setup      First-time: install Docker, Nginx, SSL"
    echo "  logs       Lihat log bot secara live"
    echo "  status     Cek status container"
    echo "  restart    Restart bot tanpa rebuild"
    echo "  stop       Stop bot saja (DB tetap jalan)"
    echo "  migrate    Jalankan Prisma migration saja"
    echo ""
    ;;

esac

