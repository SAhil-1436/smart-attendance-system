#!/usr/bin/env bash
# Exit on error
set -o errexit

export PYTHONPATH="${PYTHONPATH:-.}:./backend"
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port "${PORT:-10000}"
