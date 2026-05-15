# guard.py

import re
from spellcheck import check_text, suggest, DICTIONARY

# Common English bigrams used to distinguish real words from gibberish
_COMMON_BIGRAMS = {
    "th","he","in","er","an","on","at","en","nd","ti",
    "es","or","te","of","ed","is","it","al","ar","st",
    "nt","to","re","le","ng","se","ha","as","ou","io",
    "le","ve","co","me","de","hi","ri","ro","ic","ne",
    "ea","ra","ce","li","ch","ll","be","ma","si","om",
    "ur","ca","el","ta","la","ho","un","wh","sh","ea",
    "ht","ke","po","pa","lo","pe","me","no","di","wi",
    "sa","so","da","mo","fa","ta","fo","fe","fi","wo",
    "ve","ti","ac","ad","ag","ai","am","ap","as","au",
    "ba","bl","bo","br","bu","ci","ck","cl","cr",
    "cu","cy","dr","du","dw","dy","ec","ef","eg","em",
    "ep","eq","et","ev","ex","ey","fl","fr",
    "ft","fu","ga","ge","gi","gl","go","gr","gu","gy",
    "hu","hy","ia","ib","ic","id","ie","ig","il",
    "im","ip","ir","iv","ix","ja","je","jo","ju","ka",
    "ke","ki","kn","ko","ky","la","le","li","lo","lu",
    "ly","ma","me","mi","mm","mo","mu","my","na","nc",
    "nd","ne","ng","ni","nl","nn","no","ns","nt","nu",
    "ny","oa","oc","od","oe","of","og","oi","ok","ol",
    "om","oo","op","or","os","ot","ou","ov","ow","ox",
    "oy","pa","pe","ph","pi","pl","pm","po","pp","pr",
    "ps","pt","pu","py","qu","ra","re","ri","rn","ro",
    "rr","rs","rt","ru","ry","sa","sc","se","sh","si",
    "sk","sl","sm","sn","so","sp","ss","st","su","sw",
    "sy","ta","te","th","ti","tl","tm","to","tr","ts",
    "tu","tw","ty","ua","uc","ud","ue","ug","ui","ul",
    "um","un","up","ur","us","ut","va","ve","vi",
    "vo","wa","we","wh","wi","wo","wr","wy",
}

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
    if len(chars) > 6 and len(chars) < 50:
        unique_ratio = len(set(chars)) / len(chars)
        if unique_ratio < 0.2:
            return True

    # Single gibberish word — no spaces, not in dictionary, no close match
    if " " not in text and len(text) > 5 and text not in DICTIONARY and not suggest(text):
        # Check rare bigram ratio — gibberish has many uncommon letter pairs
        if len(text) >= 2:
            bigrams_list = [text[i:i+2] for i in range(len(text) - 1)]
            rare = sum(1 for b in bigrams_list if b not in _COMMON_BIGRAMS)
            if rare / max(len(bigrams_list), 1) > 0.45:
                return True

    return False


def check_spelling(text: str) -> str:
    """Check spelling and return a suggestion string if errors found."""
    errors = check_text(text)
    if not errors:
        return ""
    parts = []
    for e in errors[:3]:
        sugs = e["suggestions"][:2]
        if sugs:
            parts.append(f'"{e["word"]}" → {" or ".join(sugs)}')
    if not parts:
        return ""
    return "Spelling: " + "; ".join(parts)


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

    return True, check_spelling(text)
