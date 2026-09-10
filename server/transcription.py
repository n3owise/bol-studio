"""Local speech recognition and conservative, editable prosody suggestions.

Whisper's alignment is retained: an ASR unit containing several words stays one
unit. We never manufacture per-word timestamps by evenly dividing a segment.
"""
from __future__ import annotations

import importlib.util
import math
import os
import platform
import re
from functools import lru_cache
from pathlib import Path
from typing import Callable

import numpy as np
from scipy.io import wavfile


DEFAULT_MLX_MODEL = "mlx-community/whisper-large-v3-turbo"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_HINGLISH_MODEL = PROJECT_ROOT / "data" / "models" / "hinglish-swift" / "hi-hinglish-swift"
DEFAULT_HINGLISH_APEX_MODEL = PROJECT_ROOT / "data" / "models" / "hinglish-apex" / "hi-hinglish-apex"
EMPHASIS_METHOD = "Acoustic suggestion from relative loudness, pitch and word duration; review and edit."

# Familiar spellings for function words; all other Hindi words use uroman.
# These are transliterations, not a language-model rewrite of what was spoken.
COMMON_HINDI = {
    "मैं": "main", "में": "mein", "मुझे": "mujhe", "मेरा": "mera", "मेरी": "meri",
    "मेरे": "mere", "हम": "hum", "हमें": "humein", "हमारा": "hamara", "हमारी": "hamari",
    "आप": "aap", "आपको": "aapko", "आपकी": "aapki", "आपका": "aapka", "आपके": "aapke",
    "तुम": "tum", "तुम्हें": "tumhein", "तेरा": "tera", "तेरी": "teri", "तू": "tu",
    "यह": "yeh", "ये": "ye", "वह": "woh", "वो": "wo", "इस": "is", "उस": "us",
    "इसमें": "ismein", "उसमें": "usmein", "इसका": "iska", "इसके": "iske", "इसकी": "iski",
    "उसका": "uska", "उसकी": "uski", "उसके": "uske", "इसे": "ise", "उसे": "use",
    "है": "hai", "हैं": "hain", "हूँ": "hoon", "हूं": "hoon", "हो": "ho", "था": "tha",
    "थी": "thi", "थे": "the", "होगा": "hoga", "होगी": "hogi", "होंगे": "honge",
    "क्या": "kya", "क्यों": "kyun", "कैसे": "kaise", "कैसा": "kaisa", "कैसी": "kaisi",
    "कौन": "kaun", "कहाँ": "kahan", "कहां": "kahan", "कब": "kab", "कितना": "kitna",
    "कितनी": "kitni", "कितने": "kitne", "कि": "ki", "की": "ki", "का": "ka", "के": "ke",
    "को": "ko", "से": "se", "पर": "par", "पे": "pe", "और": "aur", "या": "ya",
    "भी": "bhi", "ही": "hi", "तो": "toh", "ने": "ne", "नहीं": "nahi", "नही": "nahi",
    "हाँ": "haan", "हां": "haan", "ना": "na", "न": "na", "मत": "mat", "बस": "bas",
    "अब": "ab", "अभी": "abhi", "आज": "aaj", "कल": "kal", "जब": "jab", "तब": "tab",
    "फिर": "phir", "पहले": "pehle", "बाद": "baad", "साथ": "saath", "लिए": "liye",
    "लेकिन": "lekin", "मगर": "magar", "क्योंकि": "kyunki", "अगर": "agar", "इसलिए": "isliye",
    "जो": "jo", "कुछ": "kuch", "कोई": "koi", "सब": "sab", "सभी": "sabhi", "हर": "har",
    "बहुत": "bahut", "ज्यादा": "zyada", "ज़्यादा": "zyada", "थोड़ा": "thoda", "थोड़ी": "thodi",
    "अच्छा": "achha", "अच्छी": "achhi", "अच्छे": "achhe", "सही": "sahi", "गलत": "galat",
    "ऐसा": "aisa", "ऐसी": "aisi", "ऐसे": "aise", "वैसे": "waise", "इतना": "itna",
    "कर": "kar", "करना": "karna", "करने": "karne", "करते": "karte", "करता": "karta",
    "करती": "karti", "करो": "karo", "किया": "kiya", "किए": "kiye", "करेंगे": "karenge",
    "रहा": "raha", "रही": "rahi", "रहे": "rahe", "रखना": "rakhna", "होना": "hona",
    "हुआ": "hua", "हुई": "hui", "होने": "hone", "गया": "gaya", "गई": "gayi", "गए": "gaye",
    "जाना": "jana", "जाता": "jata", "जाती": "jati", "जाते": "jate", "जाओ": "jao",
    "आना": "aana", "आता": "aata", "आती": "aati", "आते": "aate", "आया": "aaya",
    "देखो": "dekho", "देख": "dekh", "देखना": "dekhna", "देखते": "dekhte",
    "बोल": "bol", "बोलो": "bolo", "बोलना": "bolna", "बात": "baat", "बातें": "baatein",
    "चाहिए": "chahiye", "चाहते": "chahte", "सकते": "sakte", "सकता": "sakta", "सकती": "sakti",
    "पता": "pata", "शायद": "shayad", "ज़रूरी": "zaroori", "जरूरी": "zaroori", "दोस्तों": "doston",
    "दोस्त": "dost", "यार": "yaar", "भाई": "bhai", "चलो": "chalo", "ठीक": "theek",
    "एक": "ek", "दो": "do", "तीन": "teen", "चार": "chaar", "पांच": "paanch", "पाँच": "paanch",
    "वीडियो": "video", "ऑडियो": "audio", "कैप्शन": "caption", "कैप्शन्स": "captions",
    "वायरल": "viral", "कंटेंट": "content", "मॉडल": "model", "अपलोड": "upload", "डाउनलोड": "download",
    "एडिट": "edit", "एडिटिंग": "editing", "टाइम": "time", "लाइक": "like", "शेयर": "share",
    "कमेंट": "comment", "फॉलो": "follow", "सब्सक्राइब": "subscribe", "इंग्लिश": "English",
    "हिंग्लिश": "Hinglish", "हिंदी": "Hindi", "हिन्दी": "Hindi", "स्क्रिप्ट": "script",
}

# A small, intentionally conservative vocabulary used only when a second
# English decoding agrees with the same audio interval. It prevents common
# Hinglish borrowings from being displayed as Devanagari transliterations while
# avoiding a wholesale English rewrite of Hindi speech.
CODE_MIXED_ENGLISH = {
    "a", "about", "after", "all", "and", "animation", "animations", "are", "audio", "back", "be", "because",
    "before", "best", "big", "but", "called", "caption", "captions", "come", "content", "create", "day", "do",
    "download", "edit", "editing", "english", "every", "file", "find", "for", "from", "good", "hard", "has",
    "hello", "how", "important", "in", "is", "it", "just", "ki", "let", "lets", "like", "make", "means",
    "model", "more", "most", "my", "new", "now", "of", "on", "one", "only", "or", "our", "out", "pages",
    "pick", "play", "post", "ready", "reel", "reels", "render", "rest", "right", "school", "script", "seconds",
    "select", "share", "show", "small", "something", "start", "step", "style", "template", "text", "the", "these",
    "this", "time", "to", "today", "tool", "upload", "use", "video", "videos", "viral", "watch", "we", "word",
    "words", "with", "you", "your", "there",
}
COMMON_HINDI_ROMAN = {value.lower() for value in COMMON_HINDI.values()}
# Roman words that are common in code-mixed speech but may not occur in the
# small Devanagari spelling table above. They are used only to prevent an
# English verification pass from translating Hindi words such as "baaki" into
# an English paraphrase such as "the rest".
COMMON_HINDI_ROMAN |= {
    "baaki", "saare", "saari", "hote", "hoti", "hota", "hain", "ghanton", "ghante", "jaate",
    "chiz", "cheez", "andar", "uske", "liye", "wala", "wali", "wale", "karne", "karna", "par",
}

HOOK_KEYWORDS = {
    "step", "rule", "secret", "trick", "hack", "point", "formula", "part", "tip", "lesson", "method",
    "best", "worst", "free", "viral", "huge", "biggest", "never", "always", "stop", "wait",
    "easy", "fast", "simple", "crazy", "insane", "magic", "important", "great", "bold",
    "sabse", "bada", "badi", "bade", "asli", "kamaal", "bawal", "sach", "pakka", "bilkul",
    "shandaar", "shaandaar", "dhyaan", "zaruri", "zaroori", "sahi", "khatarnak", "ekdam",
}

STOP_PARTICLES = {
    "ke", "ki", "ka", "ko", "se", "mein", "par", "pe", "ne", "aur", "ya", "bhi", "hi", "to", "toh",
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "by", "for", "with", "is", "are", "was",
}


def _hinglish_model_ready(model: str | Path) -> bool:
    folder = Path(model)
    return all((folder / filename).is_file() for filename in ("encoder.int8.onnx", "decoder.int8.onnx", "tokens.txt"))


def _preferred_hinglish_model() -> Path:
    configured = os.getenv("BOL_HINGLISH_MODEL_DIR")
    if configured:
        return Path(configured)
    # Apex is the accuracy-first local choice when it has been prepared. Swift
    # remains the documented small download for browser/free-worker targets.
    return DEFAULT_HINGLISH_APEX_MODEL if _hinglish_model_ready(DEFAULT_HINGLISH_APEX_MODEL) else DEFAULT_HINGLISH_MODEL


def model_config() -> tuple[str, str]:
    configured_backend = os.getenv("BOL_ENGINE", os.getenv("TRANSCRIPTION_BACKEND"))
    if configured_backend:
        backend = configured_backend
    elif _hinglish_model_ready(_preferred_hinglish_model()) and importlib.util.find_spec("sherpa_onnx"):
        # The code-mix specialist is the local default when its small ONNX files
        # have been prepared. It emits Roman Hinglish directly, so a second
        # script-repair pass is not allowed to rewrite its vocabulary.
        backend = "sherpa-hinglish"
    else:
        backend = "mlx" if platform.system() == "Darwin" and platform.machine() == "arm64" else "faster-whisper"
    if backend == "sherpa-hinglish":
        model = os.getenv("BOL_MODEL", str(_preferred_hinglish_model()))
    else:
        model = os.getenv("BOL_MODEL", os.getenv("WHISPER_MODEL", DEFAULT_MLX_MODEL if backend == "mlx" else "large-v3-turbo"))
    return backend, model


def model_status() -> dict:
    backend, model = model_config()
    if backend == "sherpa-hinglish":
        available = importlib.util.find_spec("sherpa_onnx") is not None and _hinglish_model_ready(model)
    else:
        module = "mlx_whisper" if backend == "mlx" else "faster_whisper"
        available = importlib.util.find_spec(module) is not None
    return {"backend": backend, "model": model, "available": available,
            "local": True, "emphasisMethod": EMPHASIS_METHOD}


@lru_cache(maxsize=1)
def romanizer():
    import uroman
    return uroman.Uroman()


def romanize_hinglish(text: str) -> str:
    def convert(match: re.Match) -> str:
        word = match.group(0)
        if word in COMMON_HINDI:
            return COMMON_HINDI[word]
        return str(romanizer().romanize_string(word, lcode="hin"))
    # Exclude danda punctuation from tokens, retaining punctuation independently.
    return re.sub(r"[\u0900-\u0963\u0966-\u097f]+", convert, text).replace("।", ".").replace("॥", ".")


def _word_is_devanagari(text: str) -> bool:
    return bool(re.search(r"[\u0900-\u097f]", text))


def _clean_latin_word(text: str) -> str:
    return re.sub(r"^[^\w]+|[^\w]+$", "", text, flags=re.UNICODE)


def merge_code_mixed_english(words: list[dict], english_segments: list[dict]) -> list[dict]:
    """Use a second English decode only where its word interval agrees.

    The Hinglish recognizer remains authoritative for Hindi. The companion
    decode is allowed to repair an English-looking primary word (for example
    ``capsules`` -> ``captions``), but it is blocked when it would replace a
    known Roman Hindi word with an English paraphrase (``baaki`` -> ``the
    rest``). A small sentence-leading rescue handles common words such as
    ``There`` when the primary model drops them.
    """
    candidates = []
    for segment in english_segments:
        for raw in segment.get("words", []):
            candidate = _clean_latin_word(str(raw.get("word", "")))
            if not candidate or not candidate.isascii() or not candidate.isalpha():
                continue
            try:
                start, end = float(raw["start"]), float(raw["end"])
                probability = float(raw.get("probability", 0))
            except (KeyError, TypeError, ValueError):
                continue
            if not math.isfinite(start) or not math.isfinite(end) or end <= start:
                continue
            lower = candidate.lower()
            if lower not in CODE_MIXED_ENGLISH:
                continue
            candidates.append((start, end, candidate, probability))
    candidates.sort(key=lambda item: (item[0], item[1]))
    insertions: list[tuple[int, dict]] = []
    for index, word in enumerate(words):
        primary = _clean_latin_word(str(word.get("text", ""))).lower()
        primary_hindi = primary in COMMON_HINDI_ROMAN
        best = None
        for start, end, candidate, probability in candidates:
            overlap = max(0.0, min(word["end"], end) - max(word["start"], start))
            coverage = overlap / max(.001, min(word["end"] - word["start"], end - start))
            if coverage < .58:
                continue
            lower = candidate.lower()
            if lower == primary:
                continue
            primary_duration = max(.001, word["end"] - word["start"])
            candidate_duration = end - start
            duration_ratio = candidate_duration / primary_duration
            if duration_ratio < .45 or duration_ratio > 2.2:
                continue
            # Short function words are easy for a second decode to place on a
            # neighbouring Hindi word. Require a stronger probability before
            # allowing those tiny replacements.
            if len(lower) <= 3 and probability < .9:
                continue
            # Do not let the English paraphrase pass rewrite a Hindi word.
            # The sentence-leading rescue below handles a genuinely omitted
            # English word without translating a phrase such as "baaki saare"
            # into "the rest".
            if primary_hindi:
                sentence_start = index == 0 or word["start"] - words[index - 1]["end"] > .32
                leading_rescue = lower == "there" and sentence_start and probability >= .45
                if not leading_rescue:
                    continue
            if probability < .65 and not (lower == "there" and probability >= .45):
                continue
            if best is None or (coverage, probability) > (best[0], best[1]):
                best = (coverage, probability, candidate, start, end)
        if best:
            word["text"] = best[2]
            if best[2].lower() == "there" and primary_hindi:
                # The companion can see "There is" while the Hinglish model
                # emits only one token, e.g. "Is". Keep the original timing
                # for the following words and insert the missing lead word.
                next_is = next((candidate for candidate in candidates
                                if candidate[0] >= best[4] - .02 and candidate[0] <= word["end"] + .08
                                and candidate[2].lower() == "is" and candidate[3] >= .85), None)
                if next_is:
                    inserted = dict(word)
                    inserted["id"] = f'{word.get("id", f"w{index+1}")}-verify'
                    inserted["text"] = "There"
                    inserted["original"] = "There"
                    inserted["start"] = best[3]
                    inserted["end"] = min(word["end"], best[4])
                    inserted["confidenceApproximate"] = True
                    word["text"] = "is"
                    word["start"] = max(word["start"], next_is[0])
                    word["end"] = min(word["end"], next_is[1])
                    if word["end"] <= word["start"]:
                        word["end"] = min(word["start"] + .01, next_is[1])
                    insertions.append((index, inserted))
    for index, inserted in reversed(insertions):
        words.insert(index, inserted)
    return words


def read_audio(path: Path) -> tuple[np.ndarray, int]:
    rate, audio = wavfile.read(str(path))
    if np.issubdtype(audio.dtype, np.integer):
        audio = audio.astype(np.float32) / max(abs(np.iinfo(audio.dtype).min), np.iinfo(audio.dtype).max)
    else:
        audio = audio.astype(np.float32)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio, rate


def waveform_samples(audio: np.ndarray, count: int = 180) -> list[float]:
    if not len(audio):
        return [0.0] * count
    chunks = np.array_split(audio, min(count, len(audio)))
    values = np.array([np.sqrt(np.mean(chunk * chunk)) for chunk in chunks])
    ceiling = max(float(np.percentile(values, 95)), 1e-5)
    return np.round(np.clip(values / ceiling, 0, 1), 3).tolist()


def _pitch(audio: np.ndarray, rate: int) -> float:
    """Autocorrelation on several short windows; silence/unvoiced -> zero."""
    if len(audio) < rate * .03:
        return 0.0
    decimation = max(1, rate // 4000)
    samples = audio[::decimation]
    sample_rate = rate / decimation
    window = int(sample_rate * .05)
    values = []
    for center in np.linspace(window // 2, max(window // 2, len(samples) - window // 2), 4).astype(int):
        frame = samples[max(0, center-window//2):center+window//2].astype(float)
        frame -= frame.mean()
        if len(frame) < window * .8 or np.mean(frame * frame) < 1e-6:
            continue
        frame *= np.hanning(len(frame))
        correlation = np.correlate(frame, frame, mode="full")[len(frame)-1:]
        low, high = max(1, int(sample_rate/400)), min(len(correlation), int(sample_rate/65))
        if high <= low or correlation[0] <= 0:
            continue
        lag = low + int(np.argmax(correlation[low:high]))
        if correlation[lag] / correlation[0] > .35:
            values.append(sample_rate / lag)
    return float(np.median(values)) if values else 0.0


def suggest_emphasis(words: list[dict], audio: np.ndarray, rate: int) -> None:
    """Mutate suggestions using measured acoustics combined with lexical prominence."""
    features = []
    for word in words:
        clip = audio[int(word["start"]*rate):int(word["end"]*rate)]
        rms = float(np.sqrt(np.mean(clip * clip))) if len(clip) else 0.0
        pitch = _pitch(clip, rate) if rms > .001 else 0.0
        length = max(2, len(re.sub(r"\W", "", str(word.get("text", "")))))
        features.append((rms, pitch, (word["end"] - word["start"]) / length))
    if not features:
        return
    features = np.asarray(features)
    for index, word in enumerate(words):
        neighborhood = features[max(0,index-5):min(len(words),index+6)]
        rms, pitch, duration = features[index]
        median_rms = max(float(np.median(neighborhood[:, 0])), .001)
        voiced = neighborhood[:, 1][neighborhood[:, 1] > 0]
        median_pitch = float(np.median(voiced)) if len(voiced) else 0.0
        energy_signal = np.clip(math.log2(max(rms, 1e-5) / median_rms), -2, 2)
        pitch_signal = np.clip(math.log2(pitch / median_pitch) * 2, -1, 1) if pitch and median_pitch else 0
        duration_signal = np.clip(math.log2(max(duration,.001) / max(float(np.median(neighborhood[:,2])),.001)), -1, 1)

        clean_text = re.sub(r"\W", "", str(word.get("text", ""))).lower()
        has_number = bool(re.search(r"\d", str(word.get("text", ""))))
        is_hook = clean_text in HOOK_KEYWORDS or has_number
        is_stop = clean_text in STOP_PARTICLES

        lexical_signal = 0.45 if is_hook else (-0.4 if is_stop else 0.0)

        score = 1 / (1 + math.exp(-float(1.7 * energy_signal + .8 * pitch_signal + .35 * duration_signal + 1.8 * lexical_signal)))
        word["emphasisScore"] = round(score, 3)
        word["emphasis"] = bool(len(words) >= 3 and rms > .003 and ((score >= .73 and not is_stop) or (is_hook and score >= .62)))


def normalize_words(segments: list[dict], duration: float, script: str) -> list[dict]:
    words: list[dict] = []
    previous_end = 0.0
    for segment in segments:
        for raw in segment.get("words", []):
            original = str(raw.get("word", "")).strip()
            if not original:
                continue
            try:
                raw_start, raw_end = float(raw["start"]), float(raw["end"])
            except (ValueError, TypeError, KeyError):
                continue
            if not math.isfinite(raw_start) or not math.isfinite(raw_end) or raw_end < raw_start:
                continue
            start = round(min(duration, max(previous_end, 0, raw_start)), 3)
            end = round(min(duration, max(start, raw_end)), 3)
            if start >= duration or end <= start:
                # A zero-duration alignment carries no reliable interval.
                continue
            probability = raw.get("probability", .0)
            confidence = float(probability) if isinstance(probability, (int, float)) and math.isfinite(probability) else 0.0
            word = {"id": f"w{len(words)+1}", "original": original,
                    "text": romanize_hinglish(original) if script == "roman" else original,
                    "start": start, "end": end, "confidence": round(min(1, max(0, confidence)), 3),
                    "emphasis": False, "emphasisScore": .5,
                    "confidenceApproximate": bool(raw.get("confidenceApproximate", False)),
                    "timingApproximate": abs(start-raw_start) > .005 or abs(end-raw_end) > .005 or len(original.split()) > 1}
            words.append(word)
            previous_end = end
    return words


def refine_word_boundaries_with_vad(words: list[dict], audio: np.ndarray, rate: int, duration: float) -> list[dict]:
    """Refine Whisper word intervals using acoustic energy envelope to uncover real speech pauses.

    Whisper's token cross-attention DTW aligns subwords without emitting silence tokens,
    which causes word boundaries to stretch across silent pauses (e.g. leaving 0.0s gap
    even during a 1.5s breath between sentences). This function scans the RMS energy
    envelope around each word to trim leading/trailing silence and split words off internal
    pauses, strictly preserving non-overlapping ordering and duration limits.
    """
    if not words or not len(audio) or rate <= 0:
        return words
    hop_ms = 10
    hop = int(rate * hop_ms / 1000)
    win = int(rate * 0.025)
    if win <= 0 or hop <= 0 or len(audio) < win:
        return words

    rms = np.array([float(np.sqrt(np.mean(audio[i:i + win] ** 2))) for i in range(0, len(audio) - win, hop)])
    if not len(rms):
        return words

    p15 = float(np.percentile(rms, 15))
    p90 = float(np.percentile(rms, 90))
    threshold = max(0.012, p15 + (p90 - p15) * 0.08)

    refined: list[dict] = []
    prev_end = 0.0
    for w in words:
        s_sec = max(prev_end, float(w.get("start", 0.0)))
        e_sec = min(duration, float(w.get("end", 0.0)))
        if e_sec <= s_sec:
            item = dict(w)
            item["start"] = prev_end
            item["end"] = round(min(duration, prev_end + 0.08), 3)
            refined.append(item)
            prev_end = item["end"]
            continue

        s_f = int(s_sec * 1000 / hop_ms)
        e_f = min(len(rms), int(e_sec * 1000 / hop_ms))

        # 1. Trim leading silence up to where speech starts
        cur_s = s_f
        while cur_s < e_f and rms[cur_s] < threshold:
            cur_s += 1
        # Pre-roll padding of 30ms to preserve consonant attack
        new_s_f = max(s_f, cur_s - int(30 / hop_ms))

        # 2. Trim trailing silence from the end backward
        cur_e = e_f
        while cur_e > new_s_f and rms[cur_e - 1] < threshold:
            cur_e -= 1

        # 3. Detect internal silence run for long intervals (e.g. word spoken + silence before next token)
        silence_run = 0
        speech_end = e_f
        for f in range(new_s_f + int(80 / hop_ms), e_f):
            if rms[f] < threshold:
                silence_run += 1
                if silence_run >= int(120 / hop_ms):
                    speech_end = f - silence_run + int(30 / hop_ms)
                    break
            else:
                silence_run = 0

        final_e_f = min(cur_e + int(40 / hop_ms), speech_end)
        final_e_f = max(final_e_f, new_s_f + int(80 / hop_ms))
        final_e_f = min(final_e_f, e_f)

        new_s = round(max(prev_end, new_s_f * hop_ms / 1000), 3)
        new_e = round(min(duration, max(new_s + 0.08, final_e_f * hop_ms / 1000)), 3)

        item = dict(w)
        item["start"] = new_s
        item["end"] = new_e
        refined.append(item)
        prev_end = new_e

    return refined


@lru_cache(maxsize=1)
def _faster_model(model: str):
    from faster_whisper import WhisperModel
    return WhisperModel(model, device=os.getenv("BOL_DEVICE", os.getenv("WHISPER_DEVICE", "cpu")),
                        compute_type=os.getenv("BOL_COMPUTE_TYPE", os.getenv("WHISPER_COMPUTE_TYPE", "int8")))


@lru_cache(maxsize=1)
def _hinglish_model(model_dir: str):
    """Load the Roman-Hinglish specialist once per worker process.

    This is the quantized Whisper-Hindi2Hinglish Swift export. Sherpa's
    attention alignment returns token timestamps; those are grouped back into
    spoken words below without evenly dividing a sentence duration.
    """
    import sherpa_onnx
    folder = Path(model_dir)
    if not _hinglish_model_ready(folder):
        raise ValueError("The local Hinglish model is not prepared. Run: .venv/bin/python scripts/prepare-hinglish-model.py")
    return sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=str(folder / "encoder.int8.onnx"),
        decoder=str(folder / "decoder.int8.onnx"),
        tokens=str(folder / "tokens.txt"),
        language="hi",
        task="transcribe",
        num_threads=max(1, int(os.getenv("BOL_THREADS", "4"))),
        decoding_method="greedy_search",
        provider=os.getenv("BOL_ONNX_PROVIDER", "cpu"),
        enable_token_timestamps=True,
    )


def _sherpa_tokens_to_words(result, duration: float) -> list[dict]:
    """Turn Whisper subword tokens into word intervals.

    Sherpa returns token-level DTW alignment. A token beginning with whitespace
    starts a new word; punctuation stays attached to the preceding word. This
    preserves the recognizer's actual boundaries and keeps punctuation visible
    in the caption text.
    """
    tokens = list(getattr(result, "tokens", []) or [])
    timestamps = list(getattr(result, "timestamps", []) or [])
    durations = list(getattr(result, "durations", []) or [])
    if not tokens or not timestamps:
        return []
    words: list[dict] = []
    current_text = ""
    current_start = 0.0
    current_end = 0.0

    def flush() -> None:
        nonlocal current_text, current_start, current_end
        text = current_text.strip()
        if text:
            words.append({"word": text, "start": current_start, "end": current_end,
                          "probability": .75, "confidenceApproximate": True})
        current_text = ""
        current_start = 0.0
        current_end = 0.0

    for index, token in enumerate(tokens):
        text = str(token)
        start = float(timestamps[index]) if index < len(timestamps) else current_end
        token_duration = float(durations[index]) if index < len(durations) else 0.0
        end = start + max(0.0, token_duration)
        if current_text and text[:1].isspace():
            flush()
        if not current_text:
            current_start = start
        current_text += text
        current_end = max(current_end, end, start)
    flush()
    return [{**word, "start": max(0.0, min(duration, word["start"])),
             "end": max(0.0, min(duration, word["end"]))} for word in words
            if word["end"] > word["start"]]


def _sherpa_decode(audio: np.ndarray, rate: int, duration: float, model: str, progress: Callable[[int, str], None]) -> tuple[list[dict], str]:
    recognizer = _hinglish_model(model)
    # The sherpa Whisper wrapper has a hard limit below 30 seconds per stream.
    # Decode overlapping windows so a longer reel is not silently truncated at
    # 30 seconds, then deduplicate words that occur in the overlap.
    window = 24.0
    overlap = .6
    all_words: list[dict] = []
    detected_language = "hi"
    offset = 0.0
    chunk_count = max(1, math.ceil(max(duration, .001) / (window - overlap)))
    chunk_index = 0
    while offset < duration - .001:
        chunk_start = offset
        chunk_end = min(duration, offset + window)
        chunk_audio = audio[int(chunk_start * rate):int(chunk_end * rate)]
        if len(chunk_audio):
            stream = recognizer.create_stream()
            stream.accept_waveform(rate, chunk_audio)
            recognizer.decode_stream(stream)
            result = stream.result
            detected_language = getattr(result, "lang", "hi") or detected_language
            for word in _sherpa_tokens_to_words(result, chunk_end - chunk_start):
                candidate = {**word, "start": word["start"] + chunk_start, "end": word["end"] + chunk_start}
                duplicate = next((existing for existing in reversed(all_words)
                                  if candidate["start"] < existing["end"] + .12
                                  and existing["start"] < candidate["end"] + .12
                                  and re.sub(r"\W", "", existing["word"]).lower() == re.sub(r"\W", "", candidate["word"]).lower()), None)
                if duplicate:
                    duplicate["start"] = min(duplicate["start"], candidate["start"])
                    duplicate["end"] = max(duplicate["end"], candidate["end"])
                else:
                    all_words.append(candidate)
        chunk_index += 1
        progress(34 + int(28 * min(1, chunk_index / chunk_count)), "Transcribing Hinglish locally with the code-mix specialist.")
        if chunk_end >= duration:
            break
        offset += window - overlap
    all_words.sort(key=lambda word: (word["start"], word["end"]))
    progress(62, "Aligning every Hinglish word to the spoken audio.")
    return [{"words": all_words}], detected_language


def _english_companion_decode(audio_path: Path, backend: str, model: str, progress: Callable[[int, str], None]) -> list[dict]:
    """Decode a Latin-script companion only when the primary output needs it.

    The local Sherpa specialist is excellent at preserving Roman Hinglish but
    can still miss a short English word. On Apple Silicon, a cached MLX
    large-v3-turbo pass is used as an English verifier. It never replaces the
    primary transcript wholesale; ``merge_code_mixed_english`` only accepts
    aligned English candidates. Deployments without MLX use faster-whisper
    when it is installed, and otherwise skip this optional pass.
    """
    options = {"language": "en", "task": "transcribe", "word_timestamps": True,
               "temperature": 0, "condition_on_previous_text": False,
               "initial_prompt": "Code-mixed Hindi-English speech. Keep English words in Latin letters. Example: Come on, lets start aaj ki video.",
               "no_speech_threshold": .6}
    if backend in {"mlx", "sherpa-hinglish"}:
        try:
            import mlx_whisper
        except ImportError:
            if backend == "mlx":
                return []
        else:
            verify_model = os.getenv("BOL_ENGLISH_VERIFY_MODEL", DEFAULT_MLX_MODEL)
            progress(72, "Verifying English switches with a local multilingual pass.")
            result = mlx_whisper.transcribe(str(audio_path), path_or_hf_repo=verify_model if backend == "sherpa-hinglish" else model, verbose=None,
                                            hallucination_silence_threshold=2.0, **options)
            return result.get("segments", [])
    verify_model = os.getenv("BOL_ENGLISH_VERIFY_MODEL", "large-v3-turbo") if backend == "sherpa-hinglish" else model
    if importlib.util.find_spec("faster_whisper") is None:
        return []
    progress(72, "Verifying English switches with a local multilingual pass.")
    local_model = _faster_model(verify_model)
    stream, _ = local_model.transcribe(str(audio_path), vad_filter=True, **options)
    return [{"words": [{"word": w.word, "start": w.start, "end": w.end, "probability": w.probability} for w in (segment.words or [])]} for segment in stream]


def transcribe(audio_path: Path, duration: float, script: str, language: str, progress: Callable[[int, str], None]) -> dict:
    backend, model = model_config()
    # The specialist is intentionally a Roman-Hinglish model. Keep the native
    # Devanagari option available by falling back to the multilingual model for
    # that one output mode instead of silently pretending it can produce native
    # Hindi from Roman output.
    if backend == "sherpa-hinglish" and script != "roman":
        backend, model = "mlx", DEFAULT_MLX_MODEL
    audio, rate = read_audio(audio_path)
    waveform = waveform_samples(audio)
    if not len(audio) or float(np.sqrt(np.mean(audio*audio))) < .0003:
        return {"words": [], "waveform": waveform, "model": model, "detectedLanguage": None, "emphasisMethod": EMPHASIS_METHOD}
    progress(28, "Loading the local speech model. First use downloads the model weights.")
    options = {"language": None if language == "auto" else language, "task": "transcribe",
               "word_timestamps": True, "temperature": 0, "condition_on_previous_text": False,
               "initial_prompt": "Transcribe exactly as spoken. This is code-mixed Hindi-English. Keep English words in Latin letters and Hindi words in Devanagari. Example: Come on, lets start aaj ki video.", "no_speech_threshold": .6}
    if backend == "sherpa-hinglish":
        segments, detected_language = _sherpa_decode(audio, rate, duration, model, progress)
    elif backend == "mlx":
        import mlx_whisper
        progress(34, "Transcribing locally and aligning spoken words. This may take a few minutes.")
        result = mlx_whisper.transcribe(str(audio_path), path_or_hf_repo=model, verbose=None,
                                       hallucination_silence_threshold=2.0, **options)
        segments = result.get("segments", [])
        detected_language = result.get("language")
    elif backend == "faster-whisper":
        local_model = _faster_model(model)
        progress(34, "Transcribing locally and aligning spoken words.")
        stream, info = local_model.transcribe(str(audio_path), vad_filter=True, **options)
        segments = []
        for segment in stream:
            segments.append({"words": [{"word": w.word, "start": w.start, "end": w.end, "probability": w.probability} for w in (segment.words or [])]})
            progress(min(84, 34 + int(50*segment.end/max(duration,.01))), "Transcribing and aligning spoken words.")
        detected_language = info.language
    else:
        raise ValueError("BOL_ENGINE must be sherpa-hinglish, mlx, or faster-whisper.")
    progress(68, "Preparing Hinglish spelling and measuring spoken emphasis.")
    words = normalize_words(segments, duration, script)
    if script == "roman" and backend == "sherpa-hinglish":
        verified_segments = _english_companion_decode(audio_path, backend, model, progress)
        if verified_segments:
            words = merge_code_mixed_english(words, verified_segments)
    elif backend != "sherpa-hinglish" and script == "roman" and any(_word_is_devanagari(str(raw.get("word", ""))) for segment in segments for raw in segment.get("words", [])):
        progress(72, "Checking English switches in the mixed speech.")
        words = merge_code_mixed_english(words, _english_companion_decode(audio_path, backend, model, progress))
    progress(80, "Refining speech pauses and word timing with acoustic energy analysis.")
    words = refine_word_boundaries_with_vad(words, audio, rate, duration)
    progress(88, "Preparing Hinglish spelling and measuring spoken emphasis.")
    suggest_emphasis(words, audio, rate)
    return {"words": words, "waveform": waveform, "model": model, "detectedLanguage": detected_language,
            "emphasisMethod": EMPHASIS_METHOD,
            "timingMethod": "Whisper word alignment. Multiword ASR units are kept together; flagged adjustments are approximate."}
