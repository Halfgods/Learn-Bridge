import json
import logging
import os
import uvicorn
from collections import defaultdict

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from guard import validate_chat_input

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OLLAMA_URL    = "http://localhost:11434/api/chat"   # /api/chat supports message history
FALLBACK_CHAIN = ["llama3.1:8b", "gemma3:12b"]
MAX_HISTORY   = 20   # max messages kept per session (rolling window)

GEMINI_API_TMPL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

# session_id -> list of {"role": "user"|"assistant", "content": str}
_sessions: dict[str, list[dict]] = defaultdict(list)

SYSTEM_PROMPT = """
You are Sam — a warm, enthusiastic teacher who explains things like a cool older friend.
Your audience is kids aged 8–12. Never show your thinking. Just teach.

# What Good Teaching Actually Looks Like

Good teaching doesn't follow a checklist. It feels like a conversation that builds.
You start where the kid already is. You walk them forward slowly.
You don't move on until the idea has actually landed.

Here's what that looks like in practice:

---
EXAMPLE — Teaching "Why the sky is blue"

You know how when you shine a flashlight through a glass of water, the light bends?
Light actually does that all the time — it bends and bounces when it hits things.

Now, sunlight isn't just one color. It's actually ALL the colors mixed together.
You've seen this when light hits a prism or a soap bubble — suddenly there's a rainbow.
All those colors were hiding inside the white light the whole time.

Here's where it gets cool. When sunlight enters Earth's atmosphere — the giant blanket
of air around our planet — it smashes into tiny invisible gas particles.
Blue light bounces off those particles WAY more than red or yellow light does.
It scatters in every direction, filling the whole sky.
So no matter where you look up, you're seeing that scattered blue light.

That's why the sky is blue. Not because the air IS blue — but because blue light
bounces around the most and reaches your eyes from everywhere at once.

Think of it like this: imagine you're in a room throwing a blue rubber ball and a red
rubber ball. The blue one bounces off every wall and comes flying back at you from
all directions. The red one just rolls to the corner. The sky is full of blue bouncing.

WOW moment — at sunset, sunlight has to travel through MORE atmosphere to reach you.
By then, the blue has scattered away completely, so only the red and orange are left.
That's literally what a sunset is.

Common mix-up: a lot of people think the sky reflects the ocean. It's actually the
opposite — the ocean looks blue because it's reflecting the sky!

Remember it like this: Blue Bounces Best.

So — the sky is blue because sunlight is all colors mixed, blue bounces off air the most,
and it scatters across the whole sky into your eyes from every direction.

🟢 What are the colors hidden inside white sunlight called?
🟡 Why do you think the sky on Mars is pinkish-red instead of blue?
🟠 If Earth had no atmosphere at all, what color do you think the sky would be — and why?
---

That example is your target. Notice what it does:
- Every idea gets unpacked, not just named
- Analogies do real work — they're stretched and explained, not just dropped
- It flows like one continuous thought, not a checklist
- The WOW, mistake, memory trick, and questions appear naturally — not as labeled boxes
- The explanation is the longest part by far

Now do this for whatever concept you're asked to teach.
Length of explanation matters. Depth matters more than coverage.
A kid should feel genuinely smarter by the last line — not just informed.
"""
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
    # Rolling window — keep last MAX_HISTORY messages
    if len(history) > MAX_HISTORY:
        _sessions[session_id] = history[-MAX_HISTORY:]

def _build_messages(session_id: str) -> list[dict]:
    """Return the full message list ready for /api/chat."""
    return list(_sessions[session_id])   # shallow copy


def _gemini_key_list() -> list[str]:
    raw = os.environ.get("GEMINI_API_KEYS", "") or ""
    return [k.strip() for k in raw.split(",") if k.strip()]


def _redact_keys(text: str) -> str:
    out = text
    for key in _gemini_key_list():
        if len(key) > 8 and key in out:
            out = out.replace(key, f"{key[:4]}…REDACTED")
    return out


def _gemini_model_name() -> str:
    m = (os.environ.get("GEMINI_MODEL", "") or "gemini-2.0-flash").strip() or "gemini-2.0-flash"
    return m.split("/")[-1]


# ---------------------------------------------------------------------------
# Streaming helpers  (Ollama /api/chat)
# ---------------------------------------------------------------------------

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

    # Persist the full assistant reply to history
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


# ---------------------------------------------------------------------------
# Sync: aggregate Ollama stream + optional Gemini fallback
# ---------------------------------------------------------------------------

async def _collect_standard_text(session_id: str, model: str) -> str:
    messages = _build_messages(session_id)
    parts: list[str] = []
    async for chunk in _ollama_chat_stream(model, messages, think=False):
        token = chunk.get("message", {}).get("content", "") or ""
        if token:
            parts.append(token)
    return "".join(parts)


async def _collect_deepseek_answer_text(session_id: str, model: str) -> str:
    messages = _build_messages(session_id)
    parts: list[str] = []
    async for chunk in _ollama_chat_stream(model, messages, think=True):
        msg = chunk.get("message", {})
        c = msg.get("content", "") or ""
        if c:
            parts.append(c)
    return "".join(parts)


async def _ollama_sync_collect(session_id: str, model: str, deep_research: bool) -> tuple[str, str]:
    if deep_research or model == "deepseek-r1:latest":
        text = await _collect_deepseek_answer_text(session_id, model)
        return text, f"ollama:{model}"
    try:
        text = await _collect_standard_text(session_id, model)
        return text, f"ollama:{model}"
    except Exception:
        fallback = _get_fallback(model)
        if fallback is None:
            raise
        text = await _collect_standard_text(session_id, fallback)
        return text, f"ollama:{fallback}"


async def _gemini_generate_from_session(session_id: str) -> tuple[str, str]:
    keys = _gemini_key_list()
    if not keys:
        raise RuntimeError("GEMINI_API_KEYS is not set")

    messages = _build_messages(session_id)
    contents: list[dict] = []
    for m in messages:
        if m["role"] not in ("user", "assistant"):
            continue
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    gem_model = _gemini_model_name()
    url = GEMINI_API_TMPL.format(model=gem_model)
    payload = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT.strip()}]},
    }

    last_err: Exception | None = None
    async with httpx.AsyncClient(timeout=120.0) as client:
        for key in keys:
            try:
                r = await client.post(url, params={"key": key}, json=payload)
                r.raise_for_status()
                data = r.json()
                cand = (data.get("candidates") or [{}])[0]
                plist = (cand.get("content") or {}).get("parts") or []
                text = "".join(
                    p.get("text", "") for p in plist if isinstance(p, dict)
                )
                if not text.strip():
                    raise RuntimeError("Empty Gemini completion")
                return text, f"gemini:{gem_model}"
            except Exception as exc:
                last_err = exc
                logger.warning("Gemini attempt failed: %s", _redact_keys(repr(exc)))
                continue

    raise last_err if last_err else RuntimeError("Gemini failed")


class ChatSyncBody(BaseModel):
    query: str
    session_id: str = "default"
    deep_research: bool = False


class ClearHistoryBody(BaseModel):
    session_id: str = "default"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/chat")
async def chat(
    query:         str  = Query(...,   description="Student's question"),
    session_id:    str  = Query("default", description="Session identifier"),
    deep_research: bool = Query(False, description="Use DeepSeek for deep reasoning"),
):
    ok, reason = validate_chat_input(query)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    # Push the user message BEFORE streaming (model needs it in history)
    _push(session_id, "user", query)

    model = _select_model(query, deep_research)

    if model == "deepseek-r1:latest":
        generator = _stream_deepseek(session_id, query, model)
    else:
        generator = _stream_with_fallback(session_id, query, model)

    return StreamingResponse(generator, media_type="application/x-ndjson")


@app.post("/chat/sync")
async def chat_sync(body: ChatSyncBody):
    ok, reason = validate_chat_input(body.query)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    sid = (body.session_id or "default").strip() or "default"
    _push(sid, "user", body.query)
    model = _select_model(body.query, body.deep_research)

    try:
        text, provider = await _ollama_sync_collect(sid, model, body.deep_research)
        if not text.strip():
            raise RuntimeError("Ollama returned an empty reply")
    except Exception as ollama_exc:
        logger.warning("Ollama sync failed, trying Gemini: %s", ollama_exc)
        try:
            text, provider = await _gemini_generate_from_session(sid)
        except Exception as gem_exc:
            logger.error(
                "Tutor failure after Ollama and Gemini: ollama=%s gemini=%s",
                ollama_exc,
                _redact_keys(str(gem_exc)),
            )
            raise HTTPException(
                status_code=502,
                detail="Tutor could not produce a reply. Start Ollama, or set GEMINI_API_KEYS and GEMINI_MODEL for cloud fallback.",
            ) from gem_exc

    _push(sid, "assistant", text)
    return {"reply": text, "provider": provider}


@app.post("/chat/history/clear")
async def clear_history_post(body: ClearHistoryBody):
    """Clear conversation history (POST + JSON body for frontend / proxy)."""
    sid = (body.session_id or "default").strip() or "default"
    _sessions.pop(sid, None)
    return {"cleared": True, "session_id": sid}


@app.delete("/chat/history")
async def clear_history(session_id: str = Query("default")):
    """Clear conversation history for a session."""
    _sessions.pop(session_id, None)
    return {"cleared": True, "session_id": session_id}


@app.get("/chat/history")
async def get_history(session_id: str = Query("default")):
    """Inspect stored history for a session (useful for debugging)."""
    return {"session_id": session_id, "history": _sessions.get(session_id, [])}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)