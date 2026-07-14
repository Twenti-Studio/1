#!/usr/bin/env bash
# Redeploy FiNot (finot) — AI financial Telegram bot + FastAPI web
# Usage: ./redeploy.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "==> [finot] Rebuilding & restarting containers..."
docker compose up -d --build

# Attach the bot/web to the shared reverse-proxy edge network so fi-note.app
# (landing) + chat.fi-note.app (app) route here. By container name only. Reload proxy.
echo "==> [finot] Wiring into public reverse proxy (edge network)..."
docker network connect sim-rumah-maggot_maggot finot-bot 2>/dev/null && echo "   connected finot-bot" || echo "   finot-bot already attached"
docker exec sim-rumah-maggot-web-1 nginx -s reload 2>/dev/null && echo "   proxy reloaded" || echo "   (proxy reload skipped)"

echo "==> [finot] Waiting for health..."
sleep 5
docker compose ps
echo "==> [finot] Health check:"
curl -fsS -m 5 -o /dev/null -w "  bot :8002/health -> HTTP %{http_code}\n" http://localhost:8002/health || echo "  (not ready yet — check: docker compose logs -f bot)"
echo "==> [finot] Done. Web/bot: http://localhost:8002  |  DB: localhost:5438"
