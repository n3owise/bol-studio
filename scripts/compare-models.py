"""Run several transcription models over the same clips and score them.

Nothing here is imported by the app. It is a bench: it reads clips, runs each
model in turn, compares the output against what you say was actually spoken,
and writes a standalone HTML page. The running site is untouched.

The scoring is word error rate — the share of words that would have to be
inserted, deleted or changed to turn the model's transcript into yours. 0.00 is
perfect, 0.25 means one word in four is wrong. It is compared on lowercased,
depunctuated text, because "Hai." and "hai" are the same word to a viewer and
counting that as an error would flatter or punish models for their punctuation
habits rather than their hearing.

Romanisation is the real difficulty and worth being honest about. "jaate" and
"jate" are the same spoken word, and a plain word-error rate calls one of them
wrong. So two numbers are reported: the strict one, and a lenient one that
folds common Hinglish spelling variation before comparing. Read them together —
a model that only loses on the strict score is spelling differently, not
mishearing.

Usage:
    python scripts/compare-models.py clips/            # writes the report
    python scripts/compare-models.py clips/ --only A,B

`clips/` holds the audio or video, and beside each file a .txt of the same name
containing what was actually said. A clip with no .txt is transcribed and shown
but not scored, since there is nothing to score it against.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

AUDIO_SUFFIXES = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus"}
VIDEO_SUFFIXES = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}


@dataclass
class Model:
    key: str
    name: str
    note: str
    runner: str
    target: str


MODELS = [
    Model("A", "hinglish-apex", "What Bol uses today. IndicConformer via sherpa-onnx, writes Roman Hinglish directly.",
          "sherpa", "data/models/hinglish-apex/hi-hinglish-apex"),
    Model("B", "hinglish-swift", "Same family, six times smaller. Worth knowing how much accuracy that costs.",
          "sherpa", "data/models/hinglish-swift/hi-hinglish-swift"),
    Model("C", "whisper-large-v3-turbo", "A general multilingual model, not a Hinglish specialist. Writes Devanagari.",
          "mlx", "mlx-community/whisper-large-v3-turbo"),
    Model("D", "Trelis/whisper-hinglish-preview", "A Whisper fine-tuned on Hinglish. Downloads ~1.5GB the first time.",
          "transformers", "Trelis/whisper-hinglish-preview"),
]


@dataclass
class Result:
    model: Model
    clip: str
    text: str = ""
    seconds: float = 0.0
    error: str = ""
    wer: float | None = None
    lenient_wer: float | None = None
    diff: list[tuple[str, str, str]] = field(default_factory=list)


# ---------------------------------------------------------------- normalising

# Spelling variation that is not a mishearing. Applied only to the lenient
# score, so the strict number stays honest about what each model literally
# wrote.
_FOLD = [
    (r"aa+", "a"), (r"ee+", "i"), (r"ii+", "i"), (r"oo+", "u"), (r"uu+", "u"),
    (r"([bcdfghjklmnpqrstvwxyz])\1", r"\1"),   # jaatte -> jaate
    (r"ph", "f"), (r"v", "w"), (r"z", "j"), (r"kh", "k"), (r"gh", "g"),
    (r"th", "t"), (r"dh", "d"), (r"ch", "c"), (r"sh", "s"),
    (r"h$", ""),                               # tumhe / tumheh
    (r"ck", "k"), (r"y$", "i"),
]


def normalise(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    text = re.sub(r"[^\w\sऀ-ॿ]", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def fold(word: str) -> str:
    """Reduce a Roman Hinglish word to a rough phonetic skeleton."""
    out = word
    for pattern, replacement in _FOLD:
        out = re.sub(pattern, replacement, out)
    return out or word


def score(reference: str, hypothesis: str) -> tuple[float, float]:
    import jiwer
    ref, hyp = normalise(reference), normalise(hypothesis)
    if not ref:
        return (0.0, 0.0)
    if not hyp:
        return (1.0, 1.0)
    strict = jiwer.wer(ref, hyp)
    lenient = jiwer.wer(" ".join(fold(w) for w in ref.split()),
                        " ".join(fold(w) for w in hyp.split()))
    return (strict, lenient)


def word_diff(reference: str, hypothesis: str) -> list[tuple[str, str, str]]:
    """Aligned differences, as (kind, expected, heard)."""
    from difflib import SequenceMatcher
    ref, hyp = normalise(reference).split(), normalise(hypothesis).split()
    out: list[tuple[str, str, str]] = []
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, ref, hyp).get_opcodes():
        if tag == "equal":
            continue
        out.append((tag, " ".join(ref[i1:i2]), " ".join(hyp[j1:j2])))
    return out


# ------------------------------------------------------------------- decoding

def to_wav(source: Path) -> Path:
    """16 kHz mono, which every model here expects."""
    target = Path(tempfile.mkstemp(suffix=".wav")[1])
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
         "-i", str(source), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(target)],
        check=True, timeout=600,
    )
    return target


def run_sherpa(model: Model, wav: Path) -> str:
    """Load it exactly the way server/transcription.py does.

    These are Whisper-architecture ONNX exports, so `from_whisper` — not the
    NeMo or transducer constructors. Guessing the wrong one here would still
    produce text and would be comparing something the app never runs.
    """
    import numpy as np
    import sherpa_onnx
    from scipy.io import wavfile

    directory = PROJECT_ROOT / model.target
    recognizer = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=str(directory / "encoder.int8.onnx"),
        decoder=str(directory / "decoder.int8.onnx"),
        tokens=str(directory / "tokens.txt"),
        language="hi",
        task="transcribe",
        num_threads=4,
        decoding_method="greedy_search",
        provider="cpu",
    )
    rate, data = wavfile.read(str(wav))
    samples = data.astype(np.float32) / 32768.0
    stream = recognizer.create_stream()
    stream.accept_waveform(rate, samples)
    recognizer.decode_stream(stream)
    return stream.result.text.strip()


def run_mlx(model: Model, wav: Path) -> str:
    import mlx_whisper
    result = mlx_whisper.transcribe(str(wav), path_or_hf_repo=model.target,
                                    language=None, task="transcribe", verbose=None)
    return (result.get("text") or "").strip()


def run_transformers(model: Model, wav: Path) -> str:
    import torch
    from transformers import pipeline
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    asr = pipeline("automatic-speech-recognition", model=model.target,
                   device=device, chunk_length_s=30)
    return (asr(str(wav)).get("text") or "").strip()


RUNNERS = {"sherpa": run_sherpa, "mlx": run_mlx, "transformers": run_transformers}


# --------------------------------------------------------------------- report

def render(results: list[Result], clips: list[tuple[str, str]], models: list[Model]) -> str:
    def esc(value: str) -> str:
        return html.escape(value or "")

    by = {(r.model.key, r.clip): r for r in results}
    scored = [c for c, truth in clips if truth]

    rows = []
    for model in models:
        got = [by[(model.key, c)] for c, _ in clips if (model.key, c) in by]
        ok = [r for r in got if r.wer is not None]
        mean = sum(r.wer for r in ok) / len(ok) if ok else None
        lenient = sum(r.lenient_wer for r in ok) / len(ok) if ok else None
        seconds = sum(r.seconds for r in got)
        rows.append((model, mean, lenient, seconds, any(r.error for r in got)))

    ranked = sorted([r for r in rows if r[1] is not None], key=lambda r: r[1])
    best = ranked[0][0].key if ranked else None

    parts = [f"""<!doctype html><meta charset="utf-8">
<title>Bol — transcription model comparison</title>
<style>
 :root {{ color-scheme: light dark; --line: rgba(127,127,127,.28); }}
 body {{ font: 15px/1.6 ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 32px 24px 80px; max-width: 1100px; margin-inline: auto; }}
 h1 {{ font-size: 26px; margin: 0 0 6px; letter-spacing: -.02em; }}
 .lede {{ opacity: .7; margin: 0 0 28px; }}
 table {{ border-collapse: collapse; width: 100%; margin: 12px 0 30px; }}
 th, td {{ text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }}
 th {{ font-size: 12px; text-transform: uppercase; letter-spacing: .05em; opacity: .6; }}
 .num {{ font-variant-numeric: tabular-nums; }}
 .win {{ background: rgba(34,197,94,.12); font-weight: 700; }}
 .bad {{ color: #b45309; }}
 .clip {{ border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin: 0 0 18px; }}
 .truth {{ background: rgba(34,197,94,.09); border-radius: 8px; padding: 9px 11px; margin: 6px 0 14px; }}
 .out {{ margin: 0 0 12px; }}
 .out b {{ display: inline-block; min-width: 230px; }}
 .diff {{ font-size: 13px; opacity: .8; margin: 4px 0 0 14px; }}
 .diff del {{ color: #b91c1c; text-decoration: none; }}
 .diff ins {{ color: #15803d; text-decoration: none; }}
 code {{ background: rgba(127,127,127,.14); padding: 1px 5px; border-radius: 4px; }}
 .note {{ font-size: 13px; opacity: .65; }}
</style>
<h1>Transcription model comparison</h1>
<p class="lede">Same clips, four models, scored against what was actually said.
Lower is better: <b>0.00</b> is perfect, <b>0.25</b> means one word in four is wrong.</p>

<h2>Summary</h2>
<table><tr><th>Model</th><th>What it is</th><th class="num">Word errors</th>
<th class="num">Ignoring spelling</th><th class="num">Time</th></tr>"""]

    for model, mean, lenient, seconds, failed in rows:
        cls = ' class="win"' if model.key == best else ""
        shown = f"{mean:.2f}" if mean is not None else ("failed" if failed else "—")
        soft = f"{lenient:.2f}" if lenient is not None else "—"
        parts.append(
            f"<tr{cls}><td><b>{model.key}</b> — {esc(model.name)}</td><td class='note'>{esc(model.note)}</td>"
            f"<td class='num'>{shown}</td><td class='num'>{soft}</td><td class='num'>{seconds:.1f}s</td></tr>")
    parts.append("</table>")

    if not scored:
        parts.append("<p class='note'>No ground-truth .txt files were found, so nothing is scored — "
                     "the transcripts below are shown for reading only.</p>")
    else:
        parts.append("<p class='note'><b>Word errors</b> counts any difference. "
                     "<b>Ignoring spelling</b> folds Hinglish spelling variation first, so "
                     "<code>jaate</code> and <code>jate</code> count as the same word. A model that "
                     "only loses on the strict number is spelling differently, not mishearing.</p>")

    parts.append("<h2>Clip by clip</h2>")
    for clip, truth in clips:
        parts.append(f"<div class='clip'><h3>{esc(clip)}</h3>")
        if truth:
            parts.append(f"<div class='truth'><b>Actually said:</b> {esc(truth)}</div>")
        else:
            parts.append("<p class='note'>No ground truth supplied for this clip.</p>")
        for model in models:
            r = by.get((model.key, clip))
            if not r:
                continue
            if r.error:
                parts.append(f"<div class='out'><b>{model.key} — {esc(model.name)}</b> "
                             f"<span class='bad'>failed: {esc(r.error)}</span></div>")
                continue
            head = f"<b>{model.key} — {esc(model.name)}</b> {esc(r.text) or '<i>(nothing)</i>'}"
            if r.wer is not None:
                head += f" <span class='num note'>· {r.wer:.2f} / {r.lenient_wer:.2f}</span>"
            parts.append(f"<div class='out'>{head}")
            if r.diff:
                bits = []
                for kind, expected, heard in r.diff[:12]:
                    if kind == "replace":
                        bits.append(f"<del>{esc(expected)}</del> → <ins>{esc(heard)}</ins>")
                    elif kind == "delete":
                        bits.append(f"missed <del>{esc(expected)}</del>")
                    else:
                        bits.append(f"added <ins>{esc(heard)}</ins>")
                parts.append(f"<div class='diff'>{' &nbsp;·&nbsp; '.join(bits)}</div>")
            parts.append("</div>")
        parts.append("</div>")

    return "\n".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("clips", type=Path, help="folder of audio/video, each with a matching .txt")
    parser.add_argument("--only", default="", help="comma-separated model keys, e.g. A,B")
    parser.add_argument("--out", type=Path, default=PROJECT_ROOT / "model-comparison.html")
    args = parser.parse_args()

    wanted = {k.strip().upper() for k in args.only.split(",") if k.strip()}
    models = [m for m in MODELS if not wanted or m.key in wanted]

    files = sorted(p for p in args.clips.iterdir()
                   if p.suffix.lower() in AUDIO_SUFFIXES | VIDEO_SUFFIXES)
    if not files:
        print(f"No audio or video in {args.clips}", file=sys.stderr)
        return 1

    clips: list[tuple[str, str]] = []
    for path in files:
        truth_file = path.with_suffix(".txt")
        clips.append((path.name, truth_file.read_text().strip() if truth_file.is_file() else ""))

    results: list[Result] = []
    for path in files:
        print(f"\n=== {path.name} ===", flush=True)
        wav = to_wav(path)
        truth = dict(clips)[path.name]
        try:
            for model in models:
                result = Result(model=model, clip=path.name)
                started = time.time()
                try:
                    result.text = RUNNERS[model.runner](model, wav)
                except Exception as error:
                    result.error = f"{type(error).__name__}: {error}"[:200]
                result.seconds = time.time() - started
                if truth and not result.error:
                    result.wer, result.lenient_wer = score(truth, result.text)
                    result.diff = word_diff(truth, result.text)
                mark = result.error or f"{result.wer:.2f}" if result.wer is not None else result.error or "ok"
                print(f"  {model.key} {model.name:34s} {result.seconds:6.1f}s  {mark}", flush=True)
                print(f"      {result.text[:110]}", flush=True)
                results.append(result)
        finally:
            wav.unlink(missing_ok=True)

    args.out.write_text(render(results, clips, models))
    print(f"\nReport: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
