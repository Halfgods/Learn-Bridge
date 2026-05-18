#!/bin/bash
# only for Gnome

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Frontend ──────────────────────────────────────────────────────────────
gnome-terminal -- bash -c "
  cd '$SCRIPT_DIR/Frontend' && npm run dev; exec bash
"

# ── Backend API (Flask, port 5000) ────────────────────────────────────────
gnome-terminal -- bash -c "
  cd '$SCRIPT_DIR/Backend'
  if [ ! -d .venv ]; then python3 -m venv .venv; fi
  source .venv/bin/activate
  pip install -q flask flask-cors pymongo python-dotenv pyjwt bcrypt requests pydantic email-validator 2>/dev/null
  python3 main.py; exec bash
"

# ── Scrapper + RAG (FastAPI, port 8080) ────────────────────────────────────
gnome-terminal -- bash -c "
  cd '$SCRIPT_DIR/Backend/Scrapper'
  if [ ! -d .venv ]; then python3 -m venv .venv; fi
  source .venv/bin/activate
  pip install -q fastapi uvicorn requests ddgs yt-dlp faiss-cpu fastembed numpy pydantic 2>/dev/null
  python3 main.py; exec bash
"

# ── Chatbot LLM (FastAPI, port 8000) ──────────────────────────────────────
gnome-terminal -- bash -c "
  cd '$SCRIPT_DIR/Backend/Chatbot_LLM'
  if [ ! -d .venv ]; then python3 -m venv .venv; fi
  source .venv/bin/activate
  pip install -q fastapi uvicorn httpx google-genai pydantic python-dotenv 2>/dev/null
  python3 main.py; exec bash
"