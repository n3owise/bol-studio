#!/usr/bin/env python3
"""Download an MLX Whisper checkpoint once, without sending media anywhere."""

from __future__ import annotations

import argparse
import json
import os
import platform
from pathlib import Path


DEFAULT_MODEL = "mlx-community/whisper-large-v3-turbo"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", DEFAULT_MODEL))
    parser.add_argument("--revision", default="main", help="Pin a model revision for reproducible deployments.")
    parser.add_argument("--offline", action="store_true", help="Check the existing cache without network access.")
    args = parser.parse_args()
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        parser.exit(1, "Install backend dependencies first: .venv/bin/pip install -r server/requirements.txt\n")
    if platform.system() != "Darwin" or platform.machine() != "arm64":
        print("This checkpoint targets Apple Silicon. For CPU/CUDA use server/requirements-cpu.txt and faster-whisper.")
    print(f"{'Checking' if args.offline else 'Preparing'} {args.model}. No audio or video is uploaded.", flush=True)
    snapshot = snapshot_download(
        repo_id=args.model,
        revision=args.revision,
        allow_patterns=["config.json", "weights.npz", "*.safetensors", "README.md"],
        local_files_only=args.offline,
    )
    folder = Path(snapshot)
    if not (folder / "config.json").is_file():
        raise RuntimeError(f"Missing model config in {folder}")
    if not list(folder.glob("*.safetensors")) and not (folder / "weights.npz").is_file():
        raise RuntimeError(f"Missing model weights in {folder}")
    print(json.dumps({"model": args.model, "snapshot": str(folder), "revision": folder.name, "ready": True}, indent=2))


if __name__ == "__main__":
    main()
