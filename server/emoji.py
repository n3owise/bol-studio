"""Pick an emoji for a caption word, using meaning rather than a word list.

A lookup table only fires on the exact word it was given: "money" gets the bag,
"cash", "paisa" and "bucks" get nothing. A small sentence-embedding model closes
that gap — every candidate emoji carries a short description, and a word is
matched against those descriptions by meaning, so near-synonyms land on the
right emoji without anyone having listed them.

The vocabulary below is still hand-written, deliberately. The model supplies the
synonyms; the list supplies the taste. Turning it loose on all ~1800 Unicode
emoji produces matches that are technically correct and look wrong in a caption.

English only. The model is trained on English, and a Hinglish transcript written
in Latin letters ("paisa", "bahut") lands nowhere near the right description
while still scoring high enough to look deliberate. Offering this on Hinglish
would mean shipping confident nonsense, so the caller gates it on language.

Everything here is optional: with sentence-transformers absent, `available()`
is False and the feature is a no-op rather than an error.
"""
from __future__ import annotations

import logging
import re

LOGGER = logging.getLogger("bol")

# Small, fast, and English. ~90MB on first run, cached afterwards.
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

# How close a word has to sit to an emoji's description before it earns one on
# meaning alone.
#
# This is deliberately high. Measured over real transcript words, a plain cosine
# threshold cannot separate the two groups: words that should match bottom out
# around 0.32 ("data", "idea") while words that should not peak around 0.44
# ("pretty"), so any single cutoff either drops good matches or admits noise.
#
# The listed keywords close that gap instead. A word that appears in a
# description is an exact hit and skips the model entirely, which covers most of
# what a transcript actually says; the model is left to do the one job a list
# cannot, which is catching a synonym nobody wrote down. Holding it to 0.55
# keeps that job narrow and keeps the noise out.
MIN_SIMILARITY = 0.55

# Words that carry no image and must never pull an emoji, however the model
# scores them. Function words are the ones that make auto-emoji look cheap.
_NEVER = {
    "a", "an", "the", "and", "or", "but", "if", "then", "than", "so", "as", "at", "by", "for",
    "from", "in", "into", "of", "on", "to", "with", "is", "are", "was", "were", "be", "been",
    "am", "do", "does", "did", "have", "has", "had", "will", "would", "can", "could", "should",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your",
    "his", "its", "our", "their", "this", "that", "these", "those", "there", "here", "what",
    "which", "who", "when", "where", "how", "why", "not", "no", "yes", "just", "very", "really",
    "about", "up", "down", "out", "off", "over", "all", "some", "any", "one", "two", "more",
    "most", "get", "got", "go", "going", "like", "well", "now", "also", "too", "only", "even",
}

# Emoji, and the description a word is matched against. Descriptions are written
# as a short phrase rather than a single synonym: the model compares meanings,
# and a phrase pins down which sense is meant ("fire" the excitement, not the
# emergency).
VOCABULARY: list[tuple[str, str]] = [
    ("💰", "money cash wealth rich earnings income profit"),
    ("💸", "spending expensive costly wasting paying out"),
    ("📈", "growth increase rising improving scaling up"),
    ("📉", "decline falling dropping losing decreasing"),
    ("🔥", "fire hot flame amazing exciting impressive"),
    ("⚡", "fast quick speed instant energy power"),
    ("💡", "idea insight tip lightbulb realisation clever"),
    ("🎯", "target goal aim focus bullseye precise"),
    ("🚀", "rocket launch takeoff growth fast progress"),
    ("⏰", "time clock hours deadline timing schedule"),
    ("📅", "date day calendar schedule appointment"),
    ("🧠", "brain mind thinking intelligence smart memory"),
    ("❤️", "love affection heart care adore"),
    ("😂", "funny laughing hilarious joke comedy"),
    ("😮", "surprise shock astonishing unexpected wow"),
    ("😴", "sleep tired boring exhausted rest"),
    ("👀", "eyes look watch see notice attention"),
    ("👍", "good approve agree correct yes positive"),
    ("👎", "bad disapprove wrong negative disagree"),
    ("🙏", "thanks gratitude please pray request"),
    ("💪", "muscle strength strong effort power workout"),
    ("🏆", "trophy winning victory champion award prize"),
    ("🎁", "gift present free giveaway reward"),
    ("📱", "phone mobile smartphone call device"),
    ("💻", "laptop computer coding software desk work"),
    ("🎬", "video film movie cinema footage shooting"),
    ("📸", "camera photo picture photography shoot"),
    ("🎵", "music song audio sound tune melody"),
    ("🎤", "microphone singing voice speaking podcast"),
    ("📚", "book reading study school education learning"),
    ("✏️", "writing notes pencil drafting editing"),
    ("🔍", "search find research looking investigate"),
    ("🔒", "secure locked private safety protected"),
    ("🔑", "key access unlock solution secret"),
    ("🌍", "world global earth international everywhere"),
    ("🏠", "home house living residence family"),
    ("🚗", "car driving vehicle road travel"),
    ("✈️", "flight plane travel airport journey abroad"),
    ("🍕", "pizza food eating meal snack hungry"),
    ("☕", "coffee tea drink morning cafe"),
    ("💧", "water drink liquid hydration rain"),
    ("🌱", "growing plant beginning start small seed"),
    ("☀️", "sun sunny bright day weather warm"),
    ("🌙", "night moon evening late dark"),
    ("❄️", "cold winter snow freezing chill"),
    ("⚠️", "warning caution danger careful risk problem"),
    ("❌", "wrong no incorrect stop mistake failure"),
    ("✅", "correct done complete right finished confirmed"),
    ("❓", "question asking query doubt wondering"),
    ("❗", "important urgent critical crucial attention"),
    ("🎉", "celebration party congratulations festive launch"),
    ("😍", "beautiful gorgeous stunning lovely attractive"),
    ("🤯", "mind blown shocking overwhelming incredible"),
    ("😤", "frustrated annoyed angry irritated"),
    ("😢", "sad crying upset unhappy emotional"),
    ("🤔", "thinking wondering considering confused unsure hmm"),
    ("👨‍💻", "developer programmer engineer coding technical"),
    ("👥", "people team group crowd audience community"),
    ("📊", "data chart graph statistics analytics numbers"),
    ("📝", "notes list writing document report"),
    ("🛒", "shopping buying cart purchase store"),
    ("🏢", "office company business corporate workplace"),
    ("🎓", "graduation degree university college student"),
    ("⚙️", "settings configuration system mechanism process"),
    ("🔧", "fixing repair tool maintenance adjust"),
    ("🧩", "puzzle piece solving fitting together complex"),
    ("🪄", "magic transformation instantly effortless trick"),
    ("🎨", "art design creative colour painting"),
    ("🩺", "health doctor medical diagnosis treatment"),
    ("🏃", "running exercise moving fast hurry fitness"),
    ("🧘", "calm relax meditation peace mindfulness"),
    ("🍎", "apple fruit healthy eating nutrition"),
    ("🐶", "dog pet puppy animal"),
    ("🐱", "cat pet kitten animal"),
    ("🌊", "wave ocean sea water beach"),
    ("🏔️", "mountain peak climbing height summit"),
    ("🔋", "battery charge power energy level"),
    ("📡", "signal broadcast network connection transmission"),
    ("💬", "comment message chat talking conversation"),
    ("📢", "announcement shouting promote broadcast telling"),
    ("🤝", "deal agreement partnership handshake together"),
    ("🧪", "experiment testing science lab trying"),
    ("🎮", "gaming game play console video game"),
    ("⚽", "football sport soccer match game"),
    ("🏋️", "gym lifting weights training strength"),
    ("🕐", "hour duration length minutes waiting"),
    ("🗓️", "week month year planning long term"),
    ("🧾", "bill receipt invoice payment charge"),
    ("🏦", "bank account savings finance loan"),
    ("💳", "card payment credit spending checkout"),
    ("📦", "package delivery shipping box product"),
    ("🔔", "notification alert reminder bell subscribe"),
    ("👑", "king queen best premium royal top"),
    ("💎", "diamond premium valuable rare quality luxury"),
    ("🪙", "coin crypto token currency small money"),
]

_model = None
_matrix = None


def available() -> bool:
    """Whether emoji suggestion can run at all in this environment."""
    try:
        import sentence_transformers  # noqa: F401
    except Exception:
        return False
    return True


def _load():
    """Load the encoder once and pre-embed the vocabulary."""
    global _model, _matrix
    if _model is not None:
        return _model, _matrix
    from sentence_transformers import SentenceTransformer

    _model = SentenceTransformer(MODEL_NAME)
    _matrix = _model.encode([description for _, description in VOCABULARY],
                            convert_to_numpy=True, normalize_embeddings=True)
    LOGGER.info("Loaded emoji encoder %s over %d emoji", MODEL_NAME, len(VOCABULARY))
    return _model, _matrix


def _stem(text: str) -> str:
    """Crude singular form, enough to let "books" find the keyword "book"."""
    if len(text) > 3 and text.endswith("s") and not text.endswith("ss"):
        return text[:-1]
    return text


def _literal_index() -> dict[str, int]:
    """Keyword -> emoji, for the words somebody actually wrote down.

    Earlier keywords win a collision, so vocabulary order decides which emoji
    owns a shared word. "money" sits in the money bag's description and not in
    the flying-note's, which is why the two no longer trade places.
    """
    index: dict[str, int] = {}
    for position, (_, description) in enumerate(VOCABULARY):
        for keyword in description.split():
            index.setdefault(_stem(keyword), position)
    return index


_LITERAL = _literal_index()


def _candidates(words: list[dict]) -> list[tuple[int, str]]:
    """Word indexes worth scoring, with the bare text to score."""
    out: list[tuple[int, str]] = []
    for index, word in enumerate(words):
        text = re.sub(r"[^A-Za-z]", "", str(word.get("text", ""))).lower()
        # Two letters or fewer carries no image, and matching it produces noise.
        if len(text) < 3 or text in _NEVER:
            continue
        out.append((index, text))
    return out


def suggest_emoji(words: list[dict]) -> None:
    """Attach `emoji` and `emojiScore` in place to the words that earn one.

    Every eligible word is scored and annotated; nothing decides here how many
    finally appear. That choice belongs to whatever knows the caption pages —
    the emoji must not land on the word a page already enlarges, and only this
    side of the app knows the model while only the editor knows the pages. So
    this reports candidates, and the editor picks one per line.
    """
    if not available() or not words:
        return
    try:
        import numpy as np

        candidates = _candidates(words)
        if not candidates:
            return

        # A word somebody listed is settled without loading the model at all —
        # which is also what keeps a transcript of ordinary English from paying
        # for an encoder run it does not need.
        unresolved: list[tuple[int, str]] = []
        for index, text in candidates:
            position = _LITERAL.get(_stem(text))
            if position is None:
                unresolved.append((index, text))
                continue
            words[index]["emoji"] = VOCABULARY[position][0]
            words[index]["emojiScore"] = 1.0

        if not unresolved:
            return
        model, matrix = _load()
        vectors = model.encode([text for _, text in unresolved],
                               convert_to_numpy=True, normalize_embeddings=True)
        # Both sides are unit vectors, so the dot product is cosine similarity.
        scores = vectors @ matrix.T
        for row, (index, _) in enumerate(unresolved):
            best = int(np.argmax(scores[row]))
            score = float(scores[row][best])
            if score >= MIN_SIMILARITY:
                words[index]["emoji"] = VOCABULARY[best][0]
                words[index]["emojiScore"] = round(score, 3)
    except Exception as error:  # pragma: no cover - environment dependent
        LOGGER.warning("Emoji suggestion failed, captions stay plain: %s", error)
