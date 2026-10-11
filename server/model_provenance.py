"""Immutable model revisions and content fingerprints; never reads user media."""
from __future__ import annotations
import hashlib
import json
import os
import re
from pathlib import Path
from functools import lru_cache

PINS = json.loads(Path(__file__).with_name('model-revisions.json').read_text())
ALIASES = {'large': 'Systran/faster-whisper-large-v3',
           'turbo': 'mobiuslabsgmbh/faster-whisper-large-v3-turbo',
           'large-v3': 'Systran/faster-whisper-large-v3',
           'large-v3-turbo': 'mobiuslabsgmbh/faster-whisper-large-v3-turbo'}

def model_revision(model: str, override: str | None = None) -> str | None:
    if Path(model).is_dir():
        return None
    revision = override or PINS.get(ALIASES.get(model, model))
    if revision and not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Model revision must be an immutable 40-character commit SHA.')
    if not revision:
        raise ValueError(f'No pinned revision for {model}. Set BOL_MODEL_REVISION to a commit SHA or prepare a local model directory.')
    return revision

def configured_revision(model: str) -> str | None:
    # Per-repository overrides prevent one checkpoint's SHA leaking into a companion.
    overrides = json.loads(os.getenv('BOL_MODEL_REVISIONS', '{}'))
    repo = ALIASES.get(model, model)
    override = overrides.get(repo)
    if not override and model == os.getenv('BOL_MODEL', os.getenv('WHISPER_MODEL')):
        override = os.getenv('BOL_MODEL_REVISION')
    return model_revision(model, override)

def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def local_manifest(folder: Path, filenames: list[str] | None = None) -> dict:
    files = [folder / name for name in filenames] if filenames else sorted(
        p for p in folder.iterdir() if p.is_file() and p.suffix in {'.onnx', '.npz', '.safetensors', '.json', '.txt', '.bin'} and p.name != 'provenance.json')
    return {'files': {p.name: {'sha256': file_hash(p), 'bytes': p.stat().st_size} for p in files},
            'revision': folder.name if re.fullmatch(r'[0-9a-f]{40}', folder.name) else None,
            'sourceVerified': False}

def model_provenance(model: str) -> dict:
    folder = Path(model)
    signature = tuple((p.name, p.stat().st_size, p.stat().st_mtime_ns) for p in sorted(folder.iterdir()) if p.is_file()) if folder.is_dir() else ()
    return _cached_provenance(model, signature)

@lru_cache(maxsize=8)
def _cached_provenance(model: str, signature: tuple) -> dict:
    folder = Path(model)
    if folder.is_dir():
        manifest = local_manifest(folder)
        saved = folder / 'provenance.json'
        if saved.is_file():
            recorded = json.loads(saved.read_text())
            if recorded.get('files') == manifest['files']:
                manifest.update({k: recorded[k] for k in ('repo', 'revision', 'sourceVerified') if k in recorded})
        return manifest
    return {'repo': ALIASES.get(model, model), 'revision': configured_revision(model),
            'sourceVerified': True}

def mlx_model_path(model: str) -> str:
    if Path(model).is_dir():
        return model
    from huggingface_hub import snapshot_download
    return snapshot_download(repo_id=model, revision=configured_revision(model))
