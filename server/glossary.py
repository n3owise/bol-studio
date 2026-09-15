"""Rewrite a transcript's proper nouns using terms the creator supplied.

Speech recognisers spell brand names, handles and domains phonetically:
"kalakar.io" comes back as "kalaakaar dot I O", "Bol Studio" as "bol studio".
No general model fixes this, because the correct spelling is not a property of
the audio — it is something only the creator knows.

So this never guesses. It only ever replaces a run of words with a term the
creator typed into the project's glossary, and every replacement stays editable
afterwards. A recogniser that writes a real Hindi word this module has not been
told about — "Ewa", say — is left exactly as it is.
"""
from __future__ import annotations

import re
import unicodedata

# A term may span at most this many spoken words: "kalaakaar dot I O" is four.
MAX_SPAN = 6
# How close a spoken run has to be to the term before it is replaced. Tuned so
# "kalaakaar dot i o" matches "kalakar.io" while ordinary words do not collide.
MIN_SIMILARITY = 0.72

# Spoken forms of the punctuation that appears in handles and domains.
_SPOKEN_SYMBOLS = {
    "dot": ".", "point": ".", "period": ".",
    "at": "@", "underscore": "_", "dash": "-", "hyphen": "-", "slash": "/",
}


def _fold(text: str) -> str:
    """Lowercase, strip accents and punctuation, and collapse whitespace."""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"[^\w\s]", "", stripped).lower().strip()


def _speech_key(text: str) -> str:
    """Reduce a term to the letters a recogniser is likely to emit.

    Roman Hinglish doubles vowels freely — "kalaakaar" and "kalakar" are the
    same word — so repeats collapse and a silent "h" is dropped. Vowels
    themselves are kept: stripping them made almost everything look alike, and
    "go to kalaakaar" started matching "kalakar.io".
    """
    folded = _fold(text).replace(" ", "")
    collapsed = re.sub(r"(.)\1+", r"\1", folded)
    return collapsed.replace("h", "") or collapsed


def _spoken_to_written(words: list[str]) -> str:
    """Turn "kalaakaar dot i o" into "kalaakaar.io" before comparing."""
    out: list[str] = []
    for word in words:
        symbol = _SPOKEN_SYMBOLS.get(_fold(word))
        if symbol:
            out.append(symbol)
        else:
            out.append(_fold(word))
    joined = ""
    for piece in out:
        if piece in _SPOKEN_SYMBOLS.values():
            joined = joined.rstrip() + piece
        elif joined and joined[-1] in _SPOKEN_SYMBOLS.values():
            joined += piece
        else:
            joined = f"{joined} {piece}".strip()
    return joined


def _similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    # Ratcliff/Obershelp is good enough here and needs no dependency.
    from difflib import SequenceMatcher
    return SequenceMatcher(None, a, b).ratio()


def _score(run: list[str], term: str) -> float:
    """How well a run of spoken words matches one glossary term."""
    written = _spoken_to_written(run)
    direct = _similarity(written.replace(" ", ""), _fold(term).replace(" ", ""))
    phonetic = _similarity(_speech_key(" ".join(run)), _speech_key(term))
    return max(direct, phonetic * 0.96)


def apply_glossary(words: list[dict], terms: list[str]) -> list[dict]:
    """Replace spoken runs with the creator's spelling.

    `words` are dicts carrying at least `text`, `start` and `end`. A matched run
    collapses into a single word spanning the run's full time range, so the
    caption keeps its timing. Returns a new list; the input is not mutated.
    """
    cleaned = [t.strip() for t in terms if t and t.strip()]
    if not words or not cleaned:
        return [dict(w) for w in words]

    # Longer terms first, so "Bol Studio" wins over "Bol".
    ordered = sorted(cleaned, key=lambda t: -len(t.split()))

    # Score every candidate run, then claim the best matches first. Scanning
    # greedily from the left made "go to kalaakaar" win over "kalaakaar dot I O",
    # because a partial match earlier in the sentence was taken before the
    # near-exact one that followed.
    candidates: list[tuple[float, int, int, str]] = []
    for index in range(len(words)):
        for term in ordered:
            span_hint = max(1, len(_fold(term).split()))
            for span in range(1, min(MAX_SPAN, len(words) - index) + 1):
                if span > span_hint + 3:
                    break
                run = [str(words[i].get("text", "")) for i in range(index, index + span)]
                if not any(_fold(r) for r in run):
                    continue
                score = _score(run, term)
                if score >= MIN_SIMILARITY:
                    candidates.append((score, span, index, term))

    # Highest score first; ties go to the longer run, then to the earlier one.
    candidates.sort(key=lambda c: (-c[0], -c[1], c[2]))
    claimed: dict[int, tuple[int, str]] = {}
    taken: set[int] = set()
    for score, span, index, term in candidates:
        positions = range(index, index + span)
        if any(i in taken for i in positions):
            continue
        claimed[index] = (span, term)
        taken.update(positions)

    out: list[dict] = []
    index = 0
    while index < len(words):
        match = claimed.get(index)
        if match:
            span, term = match
            first, last = words[index], words[index + span - 1]
            merged = dict(first)
            merged["text"] = term
            merged["original"] = " ".join(str(words[i].get("original", words[i].get("text", "")))
                                          for i in range(index, index + span)).strip()
            merged["end"] = last.get("end", first.get("end"))
            merged["fromGlossary"] = True
            out.append(merged)
            index += span
            continue
        out.append(dict(words[index]))
        index += 1
    return out
