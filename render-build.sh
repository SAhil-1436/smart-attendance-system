#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "=== Installing Python dependencies ==="
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "=== Building Frontend SPA ==="
npm --prefix frontend install
npm --prefix frontend run build

echo "=== Build Completed Successfully ==="
