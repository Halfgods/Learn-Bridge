# guard.py

import re

# Common abusive words (expand this list)
ABUSIVE_WORDS = {
    "fuck",
    "shit",
    "bitch",
    "bastard",
    "asshole",
    "idiot",
    "moron",
    "stupid",
}

# Keyboard smash patterns
RANDOM_PATTERNS = [
    r"^[asdfghjkl]+$",
    r"^[qwertyuiop]+$",
    r"^[zxcvbnm]+$",
    r"^(.)\1{4,}$",  # repeated chars like aaaaa
]


def is_abusive(text: str) -> bool:
    """Detect abusive/offensive words."""
    words = re.findall(r"\b\w+\b", text.lower())
    for word in words:
        if word in ABUSIVE_WORDS:
            return True
    return False


def is_keyboard_smash(text: str) -> bool:
    """Detect random keyboard smashing."""
    text = text.lower().strip()

    # Very short nonsense
    if len(text) <= 2:
        return True

    # Match keyboard row smashing
    for pattern in RANDOM_PATTERNS:
        if re.match(pattern, text):
            return True

    # Detect low vowel ratio
    vowels = sum(1 for c in text if c in "aeiou")
    ratio = vowels / max(len(text), 1)
    if len(text) > 5 and ratio < 0.15:
        return True

    # Detect repetitive/random sequences (exclude spaces from unique ratio)
    chars = text.replace(" ", "")
    if len(chars) > 6:
        unique_ratio = len(set(chars)) / len(chars)
        if unique_ratio < 0.2:
            return True

    return False


def validate_chat_input(text: str) -> tuple[bool, str]:
    """
    Main validation function.
    Returns (is_valid, error_message).
    ALL return paths must return a (bool, str) tuple.
    """
    text = text.strip()

    if not text:
        return False, "Message cannot be empty."

    if is_abusive(text):
        return False, "Please keep the conversation respectful."

    if is_keyboard_smash(text):
        return False, "That doesn't look like a real question. Try asking something about your studies!"

    return True, ""
