"""
Lightweight checks before sending user text to an LLM.
Not a substitute for full moderation APIs — blocks obvious junk / vulgar / empty input.
"""

from __future__ import annotations

import re
import unicodedata

# Basic profanity / slurs (extend as needed; keep school-safe).
_BLOCKED_SUBSTRINGS = (
    "fuck",
    "shit",
    "bitch",
    "bastard",
    "dick",
    "cock",
    "pussy",
    "cunt",
    "nigger",
    "nigga",
    "rape",
    "porn",
    "xxx",
    "slut",
    "whore",
    "Sex",
    "sex"
)

_MIN_LEN = 2
_MAX_LEN = 8000


def validate_chat_input(text: str) -> tuple[bool, str | None]:
    """
    Returns (ok, None) or (False, short_reason_for_user).
    """
    if text is None:
        return False, "Please type a message."

    raw = text.strip()
    if len(raw) < _MIN_LEN:
        return False, "Your message is too short to answer meaningfully."

    if len(raw) > _MAX_LEN:
        return False, "That message is too long. Try a shorter question (under ~8000 characters)."

    # Repeated single character spam (e.g. "aaaaaaa")
    if len(set(raw.lower())) <= 2 and len(raw) > 12:
        return False, "That doesn’t look like a real question. Try rephrasing."

    # Mostly non-letters (keyboard mash) for longer strings
    letters = sum(1 for c in raw if c.isalpha())
    if len(raw) > 20 and letters / max(len(raw), 1) < 0.15:
        return False, "That looks like random characters. Ask a clear study question."

    lowered = raw.lower()
    for bad in _BLOCKED_SUBSTRINGS:
        if bad in lowered:
            return False, "Let’s keep chat respectful and school-appropriate. Please rephrase your question."

    # Control chars / weird unicode homoglyphs — normalize and reject odd invisible runs
    normalized = unicodedata.normalize("NFKC", raw)
    if "\x00" in normalized or any(ord(c) < 9 for c in normalized if c not in "\t\n\r"):
        return False, "That message contains characters we can’t use. Please use normal text."

    # Suspicious URL-only or "hack" prompts (very light)
    if re.search(r"\b(?:rm\s+-rf|sudo\s+|mkfs\.|format\s+c:)\b", lowered, re.I):
        return False, "We can’t help with that kind of request."

    return True, None
