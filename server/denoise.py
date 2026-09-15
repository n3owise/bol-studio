"""Strip everything but the voice before the recogniser listens.

A phone recording carries the speaker, the background music, the room and the
street all mixed into one wave. The recogniser has to pick words out of that,
and music under a voice is where its mistakes come from.

Hybrid Demucs separates a mix back into drums, bass, other and vocals. Keeping
only the vocals gives the recogniser clean speech. The original audio is never
touched — this runs on the copy used for recognition, so the exported video
still carries the full mix.

It is opt-in. On a clean voiceover there is nothing to remove and this only
costs time, so the caller decides.
"""
from __future__ import annotations

import logging

import numpy as np

LOGGER = logging.getLogger("bol")

# Hybrid Demucs is trained at 44.1 kHz stereo; our recognition audio is 16 kHz
# mono, so it is resampled up, separated, and brought back down.
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


def isolate_vocals(audio: np.ndarray, rate: int, progress=None) -> np.ndarray:
    """Return `audio` with everything but the voice removed.

    Takes and returns mono float32 at `rate`. On any failure the input is
    returned unchanged: a transcription with background music is far better than
    no transcription at all.
    """
    if not available() or audio is None or not len(audio):
        return audio
    try:
        import torch
        import torchaudio

        model, device = _load()
        source_index = list(model.sources).index("vocals")

        wave = torch.from_numpy(np.asarray(audio, dtype=np.float32)).unsqueeze(0)
        if rate != MODEL_RATE:
            wave = torchaudio.functional.resample(wave, rate, MODEL_RATE)
        # The model expects stereo; a mono track is duplicated across channels.
        wave = wave.repeat(2, 1)

        # Normalising to unit variance is what the pipeline was trained on; the
        # scale is restored afterwards so loudness is unchanged.
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

        out = out / weight.clamp(min=1e-6)
        out = out * std + mean
        mono = out.mean(dim=0, keepdim=True)
        if rate != MODEL_RATE:
            mono = torchaudio.functional.resample(mono, MODEL_RATE, rate)
        cleaned = mono.squeeze(0).numpy().astype(np.float32)

        # Length can drift by a sample or two through two resamples; the caller
        # indexes this array by timestamp, so it has to match exactly.
        if len(cleaned) < len(audio):
            cleaned = np.pad(cleaned, (0, len(audio) - len(cleaned)))
        return cleaned[: len(audio)]
    except Exception as error:  # pragma: no cover - environment dependent
        LOGGER.warning("Vocal isolation failed, using the original audio: %s", error)
        return audio
