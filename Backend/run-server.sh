#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=== Backend startup script ==="

# Install Node dependencies if package.json exists
if [ -f package.json ]; then
  echo "=> Installing npm dependencies..."
  npm install
else
  echo "=> No package.json found, skipping npm install."
fi

# Sync Python environment with uv if available
if [ -f pyproject.toml ] && [ -f uv.lock ]; then
  if command -v uv >/dev/null 2>&1; then
    echo "=> Syncing Python environment with uv..."
    uv sync
  else
    echo "=> 'uv' not found, installing uv in the current Python environment..."
    python3 -m pip install --upgrade pip
    python3 -m pip install uv
    echo "=> Running uv sync..."
    uv sync
  fi
else
  echo "=> No pyproject.toml or uv.lock found, skipping uv sync."
fi

# Activate existing venv or create one if missing
if [ -d .venv ] && [ -f .venv/bin/activate ]; then
  echo "=> Activating .venv..."
  # shellcheck source=/dev/null
  source .venv/bin/activate
else
  echo "=> Creating Python venv at .venv..."
  python3 -m venv .venv
  # shellcheck source=/dev/null
  source .venv/bin/activate
  python -m pip install --upgrade pip
  if [ -f pyproject.toml ]; then
    echo "=> Installing Python project dependencies from pyproject.toml..."
    python -m pip install -e .
  fi
fi

# Run the Flask server
echo "=> Starting backend server..."
python main.py
