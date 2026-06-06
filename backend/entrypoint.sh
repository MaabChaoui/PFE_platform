#!/bin/sh
set -eu

case "${KG_BUILD_ON_START:-true}" in
  true|True|TRUE|1|yes|YES)
    python -m app.scripts.build_kg_index
    ;;
esac

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
