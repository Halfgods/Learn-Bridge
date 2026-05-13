import asyncio
import json
import logging
import os
import uvicorn
from collections import defaultdict

import httpx
from google import genai
from google.genai import types
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
# Constants (models / limits — many overridable via env; see comments on helpers)
# ---------------------------------------------------------------------------

OLLAMA_URL = (os.environ.get("OLLAMA_CHAT_URL") or "http://localhost:11434/api/chat").strip()


def _env_str(name: str, default: str) -> str:
    v = (os.environ.get(name) or "").strip()
    return v or default


def _env_int(name: str, default: int, *, lo: int = 1, hi: int | None = None) -> int:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        n = int(raw)
    except ValueError:
        return default
    n = max(lo, n)
    if hi is not None:
        n = min(n, hi)
    return n


def _fallback_chain() -> list[str]:
    """Primary first, then alternates for _get_fallback. Lighter default = less VRAM / faster TTFT."""
    chain_raw = (os.environ.get("OLLAMA_MODEL_CHAIN") or "").strip()
    if chain_raw:
        return [x.strip() for x in chain_raw.split(",") if x.strip()]
    primary = _env_str("OLLAMA_MODEL_PRIMARY", "llama3.2:3b")
    fb = _env_str("OLLAMA_MODEL_FALLBACK", "llama3.1:8b")
    return [primary, fb] if primary != fb else [primary]


FALLBACK_CHAIN = _fallback_chain()
MAX_HISTORY = _env_int("TUTOR_MAX_HISTORY", 12, lo=2, hi=40)
# Cap total user+assistant text sent to Ollama (after system prompt) to limit prefill latency.
MAX_TRANSCRIPT_CHARS = _env_int("TUTOR_MAX_TRANSCRIPT_CHARS", 14_000, lo=2000, hi=100_000)

# session_id -> list of {"role": "user"|"assistant", "content": str}
_sessions: dict[str, list[dict]] = defaultdict(list)

# Shorter than the original long-form rubric: every token here is re-sent on each Ollama call.
SYSTEM_PROMPT = """
You are Sam — a warm teacher and cool older friend for kids aged 8–12.
Never show raw chain-of-thought or "thinking" labels; speak clearly to the student.

Teach in one flowing conversation: start from what they likely know, unpack ideas
(including analogies you actually explain), add a small "wow" or memorable hook when
it fits, mention one common mix-up if useful, and end with 1–3 quick check questions.
Depth beats coverage; the explanation should be the longest part.
"""
# ---------------------------------------------------------------------------
# Model selection
# ---------------------------------------------------------------------------

def _deep_model() -> str:
    return _env_str("OLLAMA_MODEL_DEEP", "deepseek-r1:latest")


def _select_model(query: str, deep_research: bool) -> str:
    # DeepSeek + thinking stream only when the client sets deep_research=True — never from heuristics.
    if deep_research:
        return _deep_model()
    primary = FALLBACK_CHAIN[0]
    q = query.lower()
    if any(k in q for k in ["why", "how", "explain", "derive", "proof", "deeply"]):
        return _env_str("OLLAMA_MODEL_REASONING", "llama3.1:8b")
    if any(
        k in q
        for k in ["summarize", "summarise", "list", "short", "define", "solve", "calculate"]
    ):
        return _env_str("OLLAMA_MODEL_FAST", primary)
    return primary

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
    """Return messages for /api/chat, oldest-first, capped by MAX_TRANSCRIPT_CHARS."""
    msgs = list(_sessions[session_id])
    if not msgs:
        return []

    def total_chars(rows: list[dict]) -> int:
        return sum(len(str(m.get("content") or "")) for m in rows)

    while len(msgs) > 1 and total_chars(msgs) > MAX_TRANSCRIPT_CHARS:
        msgs.pop(0)
    return msgs


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


def _sessions_to_genai_contents(msgs: list[dict]) -> list[types.Content]:
    """Map [{'role','content'}, ...] to google.genai Content list (user/model turns)."""
    rows: list[types.Content] = []
    for m in msgs:
        r = m.get("role")
        text = str(m.get("content") or "").strip()
        if r == "user" and text:
            rows.append(types.UserContent(parts=[types.Part.from_text(text=text)]))
        elif r == "assistant" and text:
            rows.append(types.ModelContent(parts=[types.Part.from_text(text=text)]))
    while rows and isinstance(rows[0], types.ModelContent):
        rows.pop(0)
    return rows


def _gemini_generate_sync(session_id: str) -> tuple[str, str]:
    """Blocking Gemini completion via google-genai streaming; run under asyncio.to_thread."""
    keys = _gemini_key_list()
    if not keys:
        raise RuntimeError("GEMINI_API_KEYS is not set")

    messages = _build_messages(session_id)
    if not messages:
        raise RuntimeError("No messages in session for Gemini")

    last = messages[-1]
    if last.get("role") != "user":
        raise RuntimeError("Last stored message must be user for Gemini fallback")

    prior = messages[:-1]
    prior_contents = _sessions_to_genai_contents(prior)
    latest_user = str(last.get("content") or "").strip()
    while prior_contents and isinstance(prior_contents[-1], types.UserContent):
        u = prior_contents.pop()
        prev = ""
        if getattr(u, "parts", None):
            prev = getattr(u.parts[0], "text", None) or ""
        latest_user = f"{prev}\n\n{latest_user}" if latest_user else prev

    gem_model = _gemini_model_name()
    cfg = types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT.strip())
    last_err: Exception | None = None

    if not prior_contents:
        contents_arg: str | list[types.Content] = latest_user
    else:
        contents_arg = list(prior_contents)
        if latest_user:
            contents_arg.append(
                types.UserContent(parts=[types.Part.from_text(text=latest_user)])
            )

    for key in keys:
        client = genai.Client(api_key=key)
        try:
            parts_out: list[str] = []
            stream = client.models.generate_content_stream(
                model=gem_model,
                contents=contents_arg,
                config=cfg,
            )
            for chunk in stream:
                t = getattr(chunk, "text", None) or ""
                if t:
                    parts_out.append(t)
            text = "".join(parts_out).strip()
            if not text:
                raise RuntimeError("Empty Gemini completion")
            return text, f"gemini:{gem_model}"
        except Exception as exc:
            last_err = exc
            logger.warning(
                "Gemini attempt failed: %s",
                _redact_keys(repr(exc)),
            )
            continue

    raise last_err if last_err else RuntimeError("Gemini failed")


# ---------------------------------------------------------------------------
# Streaming helpers  (Ollama /api/chat)
# ---------------------------------------------------------------------------

def _ollama_options(*, long_generation: bool) -> dict:
    """
    Ollama generation limits (see https://github.com/ollama/ollama/blob/main/docs/modelfile.md).
    Defaults favor lower latency for normal tutor turns; deep / thinking uses higher caps.
    All knobs overridable via env (integers).
    """
    if long_generation:
        np = _env_int("OLLAMA_NUM_PREDICT_DEEP", 4096, lo=256, hi=65_536)
        ctx = _env_int("OLLAMA_NUM_CTX_DEEP", 8192, lo=2048, hi=131_072)
    else:
        # ~768 tokens keeps answers punchy; raise OLLAMA_NUM_PREDICT for longer lessons.
        np = _env_int("OLLAMA_NUM_PREDICT", 768, lo=64, hi=32_768)
        # 4096 fits condensed system prompt + trimmed history on modest GPUs.
        ctx = _env_int("OLLAMA_NUM_CTX", 4096, lo=2048, hi=131_072)
    opts: dict[str, int | float] = {"num_predict": np, "num_ctx": ctx}
    temp_raw = (os.environ.get("OLLAMA_TEMPERATURE") or "").strip()
    if temp_raw:
        try:
            opts["temperature"] = float(temp_raw)
        except ValueError:
            pass
    return opts


def _ollama_http_timeout() -> httpx.Timeout:
    """Read timeout is high for long generations; connect fails fast on dead Ollama."""
    read_default = 600.0
    r_raw = (os.environ.get("OLLAMA_HTTP_READ_TIMEOUT") or "").strip()
    try:
        read_s = float(r_raw) if r_raw else read_default
    except ValueError:
        read_s = read_default
    c_raw = (os.environ.get("OLLAMA_HTTP_CONNECT_TIMEOUT") or "").strip()
    try:
        connect_s = float(c_raw) if c_raw else 20.0
    except ValueError:
        connect_s = 20.0
    return httpx.Timeout(connect=connect_s, read=read_s, write=120.0, pool=30.0)


async def _ollama_chat_stream(model: str, messages: list[dict], think: bool = False):
    """Yield raw parsed JSON chunks from Ollama /api/chat."""
    long_gen = bool(think) or model == _deep_model()
    payload: dict = {
        "model": model,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT.strip()}] + messages,
        "stream": True,
        "options": _ollama_options(long_generation=long_gen),
    }
    if think:
        payload["think"] = True

    timeout = _ollama_http_timeout()
    async with httpx.AsyncClient(timeout=timeout) as client:
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


async def _collect_deepseek_thinking_and_answer(session_id: str, model: str) -> tuple[str, str]:
    """Collect reasoning trace and final answer from DeepSeek (Ollama `think: true`)."""
    messages = _build_messages(session_id)
    thinking_parts: list[str] = []
    answer_parts: list[str] = []
    async for chunk in _ollama_chat_stream(model, messages, think=True):
        msg = chunk.get("message", {})
        t = msg.get("thinking", "") or ""
        c = msg.get("content", "") or ""
        if t:
            thinking_parts.append(t)
        if c:
            answer_parts.append(c)
    return "".join(thinking_parts), "".join(answer_parts)


async def _ollama_sync_collect(
    session_id: str, model: str, deep_research: bool,
) -> tuple[str, str, str | None]:
    """Returns (reply_text, provider_label, optional_thinking_for_deep_models)."""
    if deep_research or model == _deep_model():
        thinking, text = await _collect_deepseek_thinking_and_answer(session_id, model)
        think_out = thinking.strip() or None
        return text, f"ollama:{model}", think_out
    try:
        text = await _collect_standard_text(session_id, model)
        return text, f"ollama:{model}", None
    except Exception:
        fallback = _get_fallback(model)
        if fallback is None:
            raise
        text = await _collect_standard_text(session_id, fallback)
        return text, f"ollama:{fallback}", None


async def _gemini_generate_from_session(session_id: str) -> tuple[str, str]:
    return await asyncio.to_thread(_gemini_generate_sync, session_id)


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

    if model == _deep_model():
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

    thinking_out: str | None = None
    try:
        text, provider, thinking_out = await _ollama_sync_collect(sid, model, body.deep_research)
        if not text.strip():
            raise RuntimeError("Ollama returned an empty reply")
    except Exception as ollama_exc:
        logger.warning("Ollama sync failed, trying Gemini: %s", ollama_exc)
        try:
            text, provider = await _gemini_generate_from_session(sid)
            thinking_out = None
        except Exception as gem_exc:
            logger.error(
                "Tutor failure after Ollama and Gemini: ollama=%s gemini=%s",
                _redact_keys(str(ollama_exc)),
                _redact_keys(str(gem_exc)),
            )
            raise HTTPException(
                status_code=502,
                detail="Tutor could not produce a reply. Start Ollama, or set GEMINI_API_KEYS and GEMINI_MODEL for cloud fallback.",
            ) from gem_exc

    _push(sid, "assistant", text)
    out: dict = {"reply": text, "provider": provider}
    if thinking_out:
        out["thinking"] = thinking_out
    return out


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
    # Port 8000 avoids conflict with the scrapper on 8080; matches Vite `/llm` proxy.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)