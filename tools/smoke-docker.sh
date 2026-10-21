#!/usr/bin/env bash
# Docker image smoke test (CI). Use: tools/smoke-docker.sh [image]
set -euo pipefail
IMAGE="${1:-eduspark:ci}"; NAME="eduspark-smoke"; PORT=18080; BASE="http://127.0.0.1:$PORT"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
fail() { echo "❌ $1"; docker logs "$NAME" 2>&1 | tail -20 || true; exit 1; }

docker run -d --name "$NAME" -p "$PORT:8080" "$IMAGE" >/dev/null
ok=0
for i in $(seq 1 30); do
  if curl -fsS "$BASE/healthz" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[ "$ok" = 1 ] || fail "/healthz 30 sec me nahi aaya"

home="$(curl -fsS "$BASE/")" || fail "home page fetch nahi hua"
[[ "$home" == *EduSpark* ]] || fail "home page me EduSpark nahi"
h="$(curl -fsSI "$BASE/sw.js")"
echo "$h" | grep -qi '^cache-control: no-cache' || fail "sw.js par Cache-Control: no-cache nahi"
echo "$h" | grep -qi '^x-content-type-options: nosniff' || fail "nosniff header nahi"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/nope-404")" = 404 ] || fail "unknown path 404 nahi"
# Image me ye files nahi honi chahiye (secrets / server code / tests)
for f in worker.js scripts/send-notifications.js tests/run-all.js package.json firestore.rules Dockerfile; do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$f")" = 404 ] || fail "/$f image me exposed hai"
done
[ "$(docker exec "$NAME" id -u)" != 0 ] || fail "container root se chal raha hai"
echo "✅ Docker smoke test pass"
