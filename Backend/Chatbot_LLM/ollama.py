"""
AI Tutor — FastAPI streaming server + interactive CLI in one file.

Usage:
    python llm.py                        # CLI mode (talks directly to Ollama)
    python llm.py --serve                # start FastAPI server on port 8000
    python llm.py --session my_session   # CLI with a named session
    python llm.py --deep                 # CLI with deep-research mode on
    python llm.py --clear                # clear session history then start CLI

CLI commands:
    /clear      — wipe this session's history
    /history    — print stored history
    /deep       — toggle deep-research mode
    /switch     — switch to a different Ollama model
    /auto       — return to automatic model selection
    /exit       — quit
"""

import argparse
import json
import os
import sys
import logging
from collections import defaultdict
from pathlib import Path

import httpx
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from guard import validate_chat_input

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# ── App + logging ─────────────────────────────────────────────────────────────
app = FastAPI(title="AI Tutor LLM")
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Constants ─────────────────────────────────────────────────────────────────
_OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_URL = os.environ.get("OLLAMA_URL", f"{_OLLAMA_HOST}/api/chat")
OLLAMA_TAGS_URL = os.environ.get("OLLAMA_TAGS_URL", f"{_OLLAMA_HOST}/api/tags")
FALLBACK_CHAIN = ["llama3.1:8b", "gemma3:12b"]
MAX_HISTORY = 20
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

# When set, this model is used for ALL queries (overrides auto-selection)
_model_override: str | None = None

# session_id -> list of {"role": "user"|"assistant", "content": str}
_sessions: dict[str, list[dict]] = defaultdict(list)

SYSTEM_PROMPT = """\
# WHO YOU ARE
You are Sam, an expert and patient tutor. You stay in this role at ALL times.
If a student asks about you, respond as Sam the tutor — never break character
to discuss your architecture, training data, or capabilities as an AI.

# YOUR GOAL
Help students genuinely UNDERSTAND concepts — not just memorise facts.
Teach first, then guide deeper thinking. Never gatekeep knowledge behind
questions like "what do you already know?" — just teach.

# HOW TO TEACH
- Lead with what makes the topic interesting or surprising.
- Explain step by step, simplest ideas first. Define every term the moment
  you introduce it.
- Use vivid, everyday analogies and concrete examples (stories, scenarios).
- Go as deep as the topic requires. Do NOT cut explanations short to fit a
  template. If something needs five paragraphs, use five paragraphs. If a
  single paragraph is enough, keep it short.
- Adapt your structure to the topic. A mermaid diagram is great for processes
  and flows — include one when it genuinely helps, but skip it when it doesn't
  add value. A timeline is great for history. Choose what serves the student.
- End with 2–3 recall / thinking questions when the topic is educational.
  Skip them for casual or follow-up messages.
- When the student says they didn't understand, try a completely different
  angle — don't just repeat yourself with minor tweaks.

# TONE
Warm, encouraging, and direct. Treat every question as a great one.
Adapt vocabulary and depth to the student's level — if they say they're
struggling, simplify. If they want more depth, go deeper.
Never condescending. Active voice. No filler phrases.

# AUDIENCE
Students aged 6–16. If no grade is stated, default to Grade 8 level and
offer to adjust.

# CONTENT SAFETY — CRITICAL RULES
These rules are absolute and override everything else:
1. **Never fabricate information.** If you are unsure about a fact, say so
   explicitly: "I'm not fully sure about this, but..."
2. **Stick to verified, mainstream academic knowledge.** Do not teach
   fringe theories, unverified claims, or personal opinions as facts.
3. **Age-appropriate content only.** Never include violent, sexual, or
   otherwise inappropriate content. If a question touches on a sensitive
   topic (e.g., reproduction, historical violence), handle it with care
   and age-appropriate language.
4. **No harmful instructions.** Never provide instructions for anything
   dangerous, illegal, or harmful — even if framed as a "science experiment"
   or "hypothetical."
5. **Encourage verification.** Regularly remind students that checking
   multiple sources (textbooks, teachers, reputable websites) is a good habit.
6. **Stay in your lane.** If a student asks for medical, legal, or
   psychological advice, gently redirect them to a qualified professional
   or trusted adult. Do not diagnose, prescribe, or counsel.
"""

# ── ANSI colours (CLI only) ───────────────────────────────────────────────────
RESET  = "\033[0m"
BOLD   = "\033[1m"
CYAN   = "\033[96m"
YELLOW = "\033[93m"
GREEN  = "\033[92m"
RED    = "\033[91m"
DIM    = "\033[2m"

# ---------------------------------------------------------------------------
# Model selection
# ---------------------------------------------------------------------------

def _select_model(query: str, deep_research: bool) -> str:
    if deep_research:
        return "deepseek-r1:latest"
    q = query.lower()
    if any(k in q for k in ["why", "how", "explain", "derive", "proof", "deeply"]):
        return "llama3.1:8b"
    if any(k in q for k in ["summarize", "summarise", "list", "short", "define", "solve", "calculate"]):
        return "gemma3:12b"
    return "llama3.1:8b"


def _get_fallback(model: str) -> str | None:
    if model in FALLBACK_CHAIN:
        for candidate in FALLBACK_CHAIN:
            if candidate != model:
                return candidate
    return None

# ---------------------------------------------------------------------------
# History helpers
# ---------------------------------------------------------------------------

def _push(session_id: str, role: str, content: str) -> None:
    history = _sessions[session_id]
    history.append({"role": role, "content": content})
    if len(history) > MAX_HISTORY:
        _sessions[session_id] = history[-MAX_HISTORY:]


def _build_messages(session_id: str) -> list[dict]:
    return list(_sessions[session_id])

# ===========================================================================
#                       FASTAPI  STREAMING  ENDPOINTS
# ===========================================================================

# ── Async streaming helpers (Ollama /api/chat) ────────────────────────────────

async def _ollama_chat_stream(model: str, messages: list[dict], think: bool = False):
    """Yield raw parsed JSON chunks from Ollama /api/chat."""
    payload = {
        "model":    model,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
        "stream":   True,
    }
    if think:
        payload["think"] = True

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", OLLAMA_URL, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line:
                    yield json.loads(line)


async def _ollama_complete(model: str, messages: list[dict], think: bool = False) -> str:
    """Single-shot Ollama /api/chat (non-streaming)."""
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
        "stream": False,
    }
    if think:
        payload["think"] = True
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(OLLAMA_URL, json=payload)
        r.raise_for_status()
        data = r.json()
    msg = data.get("message") or {}
    text = (msg.get("content") or "").strip()
    if think and not text:
        text = (msg.get("thinking") or "").strip()
    if not text:
        raise RuntimeError("Empty Ollama response")
    return text


def _gemini_api_keys() -> list[str]:
    raw = os.environ.get("GEMINI_API_KEYS", "").strip()
    if not raw:
        return []
    return [k.strip() for k in raw.split(",") if k.strip()]


async def _gemini_generate(messages: list[dict]) -> str:
    """Google Gemini generateContent; rotates through GEMINI_API_KEYS."""
    keys = _gemini_api_keys()
    if not keys:
        raise RuntimeError("No GEMINI_API_KEYS in environment")

    gemini_contents: list[dict] = []
    for m in messages:
        if m.get("role") not in ("user", "assistant"):
            continue
        gr = "user" if m["role"] == "user" else "model"
        gemini_contents.append({"role": gr, "parts": [{"text": m["content"]}]})
    if not gemini_contents:
        raise RuntimeError("No messages for Gemini")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": gemini_contents,
    }
    last_err: Exception | None = None
    for key in keys:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                r = await client.post(f"{url}?key={key}", json=payload)
                r.raise_for_status()
                data = r.json()
            cands = data.get("candidates") or []
            if not cands:
                raise RuntimeError("No candidates in Gemini response")
            parts = cands[0].get("content", {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
            text = text.strip()
            if text:
                return text
            raise RuntimeError("Empty Gemini text")
        except Exception as e:
            last_err = e
            logger.warning("Gemini request failed: %s", e)
            continue
    raise RuntimeError(f"All Gemini keys failed: {last_err}")


async def _stream_deepseek(session_id: str, query: str, model: str):
    """Stream deepseek-r1 with thinking tokens."""
    messages = _build_messages(session_id)
    full_response = []

    async for chunk in _ollama_chat_stream(model, messages, think=True):
        msg = chunk.get("message", {})
        thinking_text = msg.get("thinking", "")
        response_text = msg.get("content",  "")

        if thinking_text:
            yield json.dumps({
                "session_id": session_id,
                "model_name": model,
                "thinking":   True,
                "response":   thinking_text,
            }) + "\n"

        if response_text:
            full_response.append(response_text)
            yield json.dumps({
                "session_id": session_id,
                "model_name": model,
                "thinking":   False,
                "response":   response_text,
            }) + "\n"

    _push(session_id, "assistant", "".join(full_response))


async def _stream_standard_raw(session_id: str, query: str, model: str):
    """Stream a standard model; raises on failure so the fallback layer can catch it."""
    messages = _build_messages(session_id)
    full_response = []

    async for chunk in _ollama_chat_stream(model, messages):
        token = chunk.get("message", {}).get("content", "")
        if token:
            full_response.append(token)
            yield json.dumps({
                "session_id": session_id,
                "model_name": model,
                "response":   token,
            }) + "\n"

    _push(session_id, "assistant", "".join(full_response))


async def _stream_with_fallback(session_id: str, query: str, model: str):
    """Try primary model; silently fall back to the other on failure."""
    try:
        async for chunk in _stream_standard_raw(session_id, query, model):
            yield chunk
        return

    except Exception as exc:
        fallback = _get_fallback(model)
        if fallback is None:
            logger.error("Model %s failed, no fallback: %s", model, exc)
            yield json.dumps({
                "session_id": session_id,
                "model_name": model,
                "error": f"Model failed: {exc}",
            }) + "\n"
            return

        logger.warning("Model %s failed (%s) → switching to %s", model, exc, fallback)
        yield json.dumps({
            "session_id": session_id,
            "model_name": fallback,
            "notice": f"Primary model '{model}' unavailable. Switched to '{fallback}'.",
        }) + "\n"

        try:
            async for chunk in _stream_standard_raw(session_id, query, fallback):
                yield chunk
        except Exception as fb_exc:
            logger.error("Fallback %s also failed: %s", fallback, fb_exc)
            yield json.dumps({
                "session_id": session_id,
                "model_name": fallback,
                "error": f"Fallback also failed: {fb_exc}",
            }) + "\n"

# ── FastAPI routes ────────────────────────────────────────────────────────────

@app.post("/chat")
async def api_chat(
    query: str = Query(..., description="Student's question"),
    session_id: str = Query("default", description="Session identifier"),
    deep_research: bool = Query(False, description="Use DeepSeek for deep reasoning"),
):
    if not query.strip():
        return JSONResponse({"error": "Please provide a non-empty query."}, status_code=400)
    ok, v_err = validate_chat_input(query)
    if not ok:
        return JSONResponse({"error": v_err}, status_code=400)

    _push(session_id, "user", query)
    model = _select_model(query, deep_research)

    if model == "deepseek-r1:latest":
        generator = _stream_deepseek(session_id, query, model)
    else:
        generator = _stream_with_fallback(session_id, query, model)

    return StreamingResponse(generator, media_type="application/x-ndjson")


class ChatSyncIn(BaseModel):
    query: str = Field(..., min_length=1)
    session_id: str = "default"
    deep_research: bool = False


@app.post("/chat/sync")
async def chat_sync(body: ChatSyncIn):
    """Non-streaming chat for web UI: Ollama first, Gemini if Ollama fails."""
    ok, v_err = validate_chat_input(body.query)
    if not ok:
        return JSONResponse({"error": v_err}, status_code=400)

    sid = body.session_id
    _push(sid, "user", body.query)
    model = _select_model(body.query, body.deep_research)
    messages = _build_messages(sid)

    try:
        if model == "deepseek-r1:latest":
            text = await _ollama_complete(model, messages, think=True)
        else:
            text = await _ollama_complete(model, messages, think=False)
        if not text.strip():
            raise RuntimeError("empty ollama reply")
        provider = "ollama"
    except Exception as ollama_exc:
        logger.warning("Ollama failed, using Gemini: %s", ollama_exc)
        try:
            text = await _gemini_generate(messages)
            provider = "gemini"
        except Exception as gem_exc:
            if _sessions.get(sid) and _sessions[sid][-1].get("role") == "user":
                _sessions[sid].pop()
            return JSONResponse(
                {"error": f"Nova is temporarily unavailable. ({gem_exc})"},
                status_code=503,
            )

    _push(sid, "assistant", text)
    return {
        "reply": text,
        "provider": provider,
        "model": model if provider == "ollama" else GEMINI_MODEL,
    }


@app.delete("/chat/history")
async def api_clear_history(session_id: str = Query("default")):
    """Clear conversation history for a session."""
    _sessions.pop(session_id, None)
    return {"cleared": True, "session_id": session_id}


@app.get("/chat/history")
async def api_get_history(session_id: str = Query("default")):
    """Inspect stored history for a session."""
    return {"session_id": session_id, "history": _sessions.get(session_id, [])}


# ===========================================================================
#                          CLI  REPL  (direct to Ollama)
# ===========================================================================

def _print_banner(session_id: str) -> None:
    print(f"\n{BOLD}{CYAN}╔══════════════════════════════════════╗")
    print(f"║       🎓  AI Tutor  Terminal         ║")
    print(f"╚══════════════════════════════════════╝{RESET}")
    print(f"{DIM}Session : {session_id}")
    print(f"Commands: /clear  /history  /deep  /switch  /auto  /exit{RESET}\n")


def _list_ollama_models() -> list[str]:
    """Fetch installed model names from Ollama."""
    try:
        with httpx.Client(timeout=10) as client:
            r = client.get(OLLAMA_TAGS_URL)
            r.raise_for_status()
            return [m["name"] for m in r.json().get("models", [])]
    except Exception as exc:
        print(f"{RED}Could not fetch models: {exc}{RESET}")
        return []


def _cli_switch() -> None:
    """Show available Ollama models and let the user pick one."""
    global _model_override
    models = _list_ollama_models()
    if not models:
        return

    print(f"\n{BOLD}Available models:{RESET}")
    for i, name in enumerate(models, 1):
        marker = f" {CYAN}← current{RESET}" if name == _model_override else ""
        print(f"  {BOLD}{i}.{RESET} {name}{marker}")
    print(f"  {DIM}0. Cancel{RESET}")

    try:
        choice = input(f"\n{YELLOW}Pick a number:{RESET} ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return

    if not choice.isdigit():
        print(f"{RED}Invalid choice.{RESET}\n")
        return

    idx = int(choice)
    if idx == 0:
        print(f"{DIM}Cancelled.{RESET}\n")
        return
    if idx < 1 or idx > len(models):
        print(f"{RED}Out of range.{RESET}\n")
        return

    _model_override = models[idx - 1]
    print(f"{GREEN}Switched to: {BOLD}{_model_override}{RESET}\n")


def _cli_chat(query: str, session_id: str, deep_research: bool) -> None:
    """Send a query directly to Ollama and stream the response to stdout."""
    _push(session_id, "user", query)
    model = _model_override if _model_override else _select_model(query, deep_research)
    messages = _build_messages(session_id)

    payload = {
        "model":    model,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
        "stream":   True,
    }

    is_deepseek = model == "deepseek-r1:latest"
    if is_deepseek:
        payload["think"] = True

    thinking_active = False
    full_response = []

    print(f"\n{DIM}[model: {model}]{RESET}")
    print(f"{GREEN}{BOLD}Tutor:{RESET} ", end="", flush=True)

    try:
        with httpx.Client(timeout=None) as client:
            with client.stream("POST", OLLAMA_URL, json=payload) as resp:
                if resp.status_code != 200:
                    print(f"{RED}Ollama error {resp.status_code}{RESET}")
                    return

                for raw_line in resp.iter_lines():
                    if not raw_line:
                        continue
                    try:
                        chunk = json.loads(raw_line)
                    except json.JSONDecodeError:
                        continue

                    msg = chunk.get("message", {})
                    thinking_text = msg.get("thinking", "") if is_deepseek else ""
                    token         = msg.get("content", "")

                    # ── thinking tokens ──
                    if thinking_text:
                        if not thinking_active:
                            print(f"\n{DIM}[Thinking...]{RESET}", flush=True)
                            thinking_active = True
                        print(f"{DIM}{thinking_text}{RESET}", end="", flush=True)

                    # ── normal content tokens ──
                    if token:
                        if thinking_active:
                            print(f"\n\n{GREEN}{BOLD}Tutor:{RESET} ", end="", flush=True)
                            thinking_active = False
                        full_response.append(token)
                        print(token, end="", flush=True)

    except httpx.ConnectError:
        print(f"\n{RED}Cannot connect to Ollama at {OLLAMA_URL}.{RESET}")
        print(f"{RED}Make sure Ollama is running (ollama serve).{RESET}")
        return
    except Exception as exc:
        # Try fallback for non-deepseek models
        fallback = _get_fallback(model)
        if fallback and not is_deepseek:
            print(f"\n{YELLOW}[{model} failed — trying {fallback}]{RESET}")
            # Remove the user message we just pushed (will re-push in recursive call)
            if _sessions[session_id] and _sessions[session_id][-1]["role"] == "user":
                _sessions[session_id].pop()
            _cli_chat(query, session_id, deep_research)
            return
        print(f"\n{RED}Error: {exc}{RESET}")
        return

    print("\n")
    if full_response:
        _push(session_id, "assistant", "".join(full_response))


def _cli_clear(session_id: str) -> None:
    _sessions.pop(session_id, None)
    print(f"{YELLOW}History cleared for session '{session_id}'.{RESET}\n")


def _cli_history(session_id: str) -> None:
    history = _sessions.get(session_id, [])
    if not history:
        print(f"{DIM}(No history yet){RESET}\n")
        return
    print(f"\n{DIM}─── Conversation history ───{RESET}")
    for msg in history:
        role  = msg["role"].capitalize()
        color = CYAN if role == "User" else GREEN
        text  = msg["content"][:120] + ("…" if len(msg["content"]) > 120 else "")
        print(f"{color}{BOLD}{role}:{RESET} {text}")
    print(f"{DIM}────────────────────────────{RESET}\n")


def _cli_main(session: str, deep: bool, clear: bool) -> None:
    _print_banner(session)

    if clear:
        _cli_clear(session)

    deep_research = deep

    while True:
        try:
            user_input = input(f"{CYAN}{BOLD}You:{RESET} ").strip()
        except (EOFError, KeyboardInterrupt):
            print(f"\n{DIM}Goodbye!{RESET}")
            sys.exit(0)

        if not user_input:
            continue

        # ── Built-in commands ─────────────────────────────────────────
        cmd = user_input.lower()

        if cmd == "/exit":
            print(f"{DIM}Goodbye!{RESET}")
            sys.exit(0)

        if cmd == "/clear":
            _cli_clear(session)
            continue

        if cmd == "/history":
            _cli_history(session)
            continue

        if cmd == "/deep":
            deep_research = not deep_research
            state = "ON" if deep_research else "OFF"
            print(f"{YELLOW}Deep-research mode: {state}{RESET}\n")
            continue

        if cmd == "/switch":
            _cli_switch()
            continue

        if cmd == "/auto":
            global _model_override
            _model_override = None
            print(f"{YELLOW}Switched back to automatic model selection.{RESET}\n")
            continue

        ok, v_err = validate_chat_input(user_input)
        if not ok:
            print(f"{RED}{v_err}{RESET}\n")
            continue

        # ── Send to Ollama ────────────────────────────────────────────
        _cli_chat(user_input, session, deep_research)


# ===========================================================================
#                               ENTRY  POINT
# ===========================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Tutor — server or CLI")
    parser.add_argument("--serve",   action="store_true", help="Start FastAPI server (port 8000)")
    parser.add_argument("--port",    type=int, default=8000, help="Server port (default 8000)")
    parser.add_argument("--session", default="default",    help="CLI session ID")
    parser.add_argument("--deep",    action="store_true",  help="CLI: enable deep-research mode")
    parser.add_argument("--clear",   action="store_true",  help="CLI: clear history on start")
    args = parser.parse_args()

    if args.serve:
        uvicorn.run(app, host="0.0.0.0", port=args.port, reload=False)
    else:
        _cli_main(args.session, args.deep, args.clear)
