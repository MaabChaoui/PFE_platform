#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Missing project venv Python: $PYTHON_BIN" >&2
  exit 1
fi

if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
  echo "Missing frontend/node_modules. Run: cd frontend && npm install" >&2
  exit 1
fi

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

if [[ -z "${AI_GRID_API_KEY:-}" ]]; then
  echo "Live mode requires AI_GRID_API_KEY in $ROOT_DIR/.env or the environment." >&2
  exit 1
fi

# Host-local paths. This script runs on the host, not inside docker-compose.
export AKN_RLM_AKN_DIR="$ROOT_DIR/latest_dataset/akn"
export AKN_RLM_TXT_DIR="$ROOT_DIR/latest_dataset/txt"
export AKN_RLM_RDF_DIR="$ROOT_DIR/latest_dataset/rdf"
export AKN_RLM_PDF_DIR="$ROOT_DIR/latest_dataset/pdf"
export AKN_RLM_KG_PATH="$ROOT_DIR/latest_dataset/rdf/algerian_legal_kg.ttl"
export AKN_RLM_EXTRACTION_REPORT_PATH="$ROOT_DIR/latest_dataset/rdf/extraction_report.json"
export AKN_RLM_BENCHMARK_PATH="$ROOT_DIR/latest_dataset/AlgerianLegalBench_v3.0_final.json"
export INDICES_DIR="$ROOT_DIR/akn_rlm/data/indices"
export EVAL_RESULTS_DIR="$ROOT_DIR/akn_rlm/eval_results"
export KG_INDEX_PATH="$ROOT_DIR/backend/data/kg_index.sqlite"

# Live-mode backend config. OFFLINE_MODE must be false or /api/health reports
# llm:"disabled" by design. LIVE_TF_CD=replay avoids the heavy live KG path.
export OFFLINE_MODE=false
export AI_GRID_BASE_URL="${AI_GRID_BASE_URL:-http://app.ai-grid.io:4000/v1}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:$FRONTEND_PORT}"
export NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE:-http://localhost:$BACKEND_PORT/api}"
export KG_BUILD_ON_START="${KG_BUILD_ON_START:-false}"
export WARM_DISPATCHER_ON_START="${WARM_DISPATCHER_ON_START:-true}"
export LIVE_TF_CD="${LIVE_TF_CD:-replay}"

pids=()

cleanup() {
  local exit_code=$?
  trap - INT TERM EXIT

  if ((${#pids[@]} > 0)); then
    echo
    echo "Stopping backend and frontend..."
  fi

  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    fi
  done

  local deadline=$((SECONDS + 10))
  local alive=0
  while ((SECONDS < deadline)); do
    alive=0
    for pid in "${pids[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        alive=1
      fi
    done
    ((alive == 0)) && break
    sleep 0.2
  done

  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
  done

  wait "${pids[@]}" 2>/dev/null || true
  exit "$exit_code"
}

trap cleanup INT TERM EXIT

echo "Starting backend on http://localhost:$BACKEND_PORT/api (live mode)"
setsid bash -c '
  cd "$1"
  exec "$2" -m uvicorn app.main:app --reload --host 0.0.0.0 --port "$3"
' bash "$ROOT_DIR/backend" "$PYTHON_BIN" "$BACKEND_PORT" &
pids+=("$!")

echo "Starting frontend on http://localhost:$FRONTEND_PORT"
setsid bash -c '
  cd "$1"
  exec npm run dev -- -p "$2"
' bash "$ROOT_DIR/frontend" "$FRONTEND_PORT" &
pids+=("$!")

cat <<EOF

Running:
  Backend health:  curl -s http://localhost:$BACKEND_PORT/api/health
  Frontend:        http://localhost:$FRONTEND_PORT

Press Ctrl+C to stop both processes.
EOF

wait -n "${pids[@]}" || true
