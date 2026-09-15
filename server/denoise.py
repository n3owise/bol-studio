"""Strip everything but the voice before the recogniser listens.

A phone recording carries the speaker, the background music, the room and the
street all mixed into one wave. The recogniser has to pick words out of that,
and music under a voice is where its mistakes come from.

Hybrid Demucs separates a mix back into drums, bass, other and vocals. Keeping
only the vocals gives the recogniser clean speech. The exported video is never
affected: separation produces a second copy for recognition only.

Separation reads the original media at its own sample rate. An earlier version
worked from the 16 kHz recognition copy, upsampling it to the model's 44.1 kHz.
That signal has no energy above 8 kHz and looks nothing like the model's
training data; it invented artefacts, and on a clean voiceover the recogniser
then misheard a word and hallucinated one that was never spoken.

It is opt-in. On a clean voiceover there is nothing to remove and this only
costs time, so the caller decides.
"""
from __future__ import annotations

import logging
import subprocess
import tempfile
from pathlib import Path

import numpy as np

LOGGER = logging.getLogger("bol")

# Hybrid Demucs is trained at 44.1 kHz stereo, and separation happens at that
# rate, read straight from the original media. Separating the 16 kHz recognition
# copy instead made clean speech measurably worse — see isolate_vocals_from_source.
MODEL_RATE = 44100
# Separate in segments so memory stays flat on a long clip, with an overlap that
# is cross-faded to avoid a seam at each boundary.
SEGMENT_SECONDS = 10.0
OVERLAP_SECONDS = 0.5

_model = None
_device = None


def available() -> bool:
    """Whether vocal isolation can run at all in this environment."""
    try:
        import torch  # noqa: F401
        import torchaudio  # noqa: F401
    except Exception:
        return False
    return True


def _load():
    """Load Hybrid Demucs once, on the best device this machine offers."""
    global _model, _device
    if _model is not None:
        return _model, _device
    import torch
    from torchaudio.pipelines import HDEMUCS_HIGH_MUSDB_PLUS

    if torch.cuda.is_available():
        _device = torch.device("cuda")
    elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        _device = torch.device("mps")
    else:
        _device = torch.device("cpu")
    _model = HDEMUCS_HIGH_MUSDB_PLUS.get_model().to(_device).eval()
    LOGGER.info("Loaded Hybrid Demucs on %s", _device)
    return _model, _device


def isolate_vocals_from_source(source: Path, out_rate: int, samples: int, progress=None) -> np.ndarray | None:
    """Separate vocals from the original media, at the rate it was recorded.

    This exists because separating the 16 kHz recognition copy made results
    worse, not better. Hybrid Demucs is trained on 44.1 kHz audio; a 16 kHz
    track upsampled to 44.1 kHz carries no energy above 8 kHz, which is nothing
    like its training data. Asked to separate that, it invented artefacts, and
    the recogniser then hallucinated a word that was never spoken.

    Reading the untouched source keeps the full bandwidth, so the model sees the
    kind of signal it was trained on. Returns mono float32 at `out_rate`,
    trimmed or padded to `samples`, or None when separation is unavailable.
    """
    if not available() or not source.is_file():
        return None
    tmp = None
    try:
        import torch
        import torchaudio
        from scipy.io import wavfile

        # Decode at the model's own rate, in stereo, straight from the original.
        tmp = Path(tempfile.mkstemp(suffix=".wav")[1])
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", str(source),
             "-vn", "-ac", "2", "-ar", str(MODEL_RATE), "-c:a", "pcm_s16le", str(tmp)],
            check=True, timeout=900,
        )
        rate, data = wavfile.read(str(tmp))
        if np.issubdtype(data.dtype, np.integer):
            data = data.astype(np.float32) / abs(np.iinfo(data.dtype).min)
        wave = torch.from_numpy(np.ascontiguousarray(data.T.astype(np.float32)))
        if wave.ndim == 1:
            wave = wave.unsqueeze(0).repeat(2, 1)

        vocals = _separate(wave, progress)
        mono = vocals.mean(dim=0, keepdim=True)
        if rate != out_rate:
            mono = torchaudio.functional.resample(mono, rate, out_rate)
        cleaned = mono.squeeze(0).numpy().astype(np.float32)
        if len(cleaned) < samples:
            cleaned = np.pad(cleaned, (0, samples - len(cleaned)))
        return cleaned[:samples]
    except Exception as error:  # pragma: no cover - environment dependent
        LOGGER.warning("Vocal isolation failed, using the original audio: %s", error)
        return None
    finally:
        if tmp is not None:
            tmp.unlink(missing_ok=True)


def _separate(wave, progress=None):
    """Run Hybrid Demucs over a stereo tensor and return the vocals stem."""
    import torch

    model, device = _load()
    source_index = list(model.sources).index("vocals")

    mean = wave.mean()
    std = wave.std().clamp(min=1e-6)
    wave = (wave - mean) / std

    total = wave.shape[-1]
    segment = int(SEGMENT_SECONDS * MODEL_RATE)
    overlap = int(OVERLAP_SECONDS * MODEL_RATE)
    step = max(1, segment - overlap)
    out = torch.zeros_like(wave)
    weight = torch.zeros(total)
    fade = torch.hann_window(overlap * 2) if overlap > 1 else None

    with torch.no_grad():
        start = 0
        while start < total:
            end = min(total, start + segment)
            chunk = wave[:, start:end].unsqueeze(0).to(device)
            vocals = model(chunk)[0, source_index].cpu()
            window = torch.ones(end - start)
            if fade is not None and end - start > overlap * 2:
                window[:overlap] = fade[:overlap]
                window[-overlap:] = fade[overlap:]
            out[:, start:end] += vocals * window
            weight[start:end] += window
            if progress:
                progress(min(1.0, end / total))
            if end >= total:
                break
            start += step

    return (out / weight.clamp(min=1e-6)) * std + mean
