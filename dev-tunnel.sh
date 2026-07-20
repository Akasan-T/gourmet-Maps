#!/usr/bin/env bash
# スマホ動作確認用トンネル起動スクリプト
#   使い方: ./dev-tunnel.sh
#   前提:   docker(backend:5001) が起動していること / cloudflared・qrencode 導入済み
#   停止:   このスクリプトを Ctrl-C（vite と cloudflared を巻き取って終了）
set -euo pipefail
cd "$(dirname "$0")"

CF_LOG="$(mktemp -t gm-cf.XXXXXX)"
PIDS=()
cleanup() { echo; echo "停止中..."; for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done; rm -f "$CF_LOG"; }
trap cleanup EXIT INT TERM

# ① backend 疎通チェック（docker が上がっているか）
if ! curl -s -o /dev/null http://localhost:5001/api/GourmetEntries; then
  echo "⚠️  backend(5001) に繋がりません。先に docker を起動してください:  docker compose up -d"
  exit 1
fi
echo "① backend(5001) OK"

# ② Vite（未起動なら起動）
if ! lsof -iTCP:5173 -sTCP:LISTEN -P >/dev/null 2>&1; then
  ( cd frontend && npm run dev >/dev/null 2>&1 ) &
  PIDS+=($!)
  echo "② Vite 起動中..."
  until lsof -iTCP:5173 -sTCP:LISTEN -P >/dev/null 2>&1; do sleep 1; done
fi
echo "② Vite(5173) OK"

# ③ cloudflared トンネル
cloudflared tunnel --url http://localhost:5173 >"$CF_LOG" 2>&1 &
PIDS+=($!)
echo "③ トンネル確立中..."
until grep -qE "https://[a-z0-9-]+\.trycloudflare\.com" "$CF_LOG" 2>/dev/null; do sleep 1; done
URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$CF_LOG" | head -1)

echo
echo "===================================================="
echo "  スマホで開く: $URL"
echo "===================================================="
command -v qrencode >/dev/null 2>&1 && qrencode -t ANSIUTF8 "$URL"
echo "（Ctrl-C で Vite とトンネルをまとめて停止）"
echo

wait
