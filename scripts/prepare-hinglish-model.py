#!/usr/bin/env python3
"""Download the quantized Roman-Hinglish specialist used by the local worker."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


REPO = "parismitaglobalsolutions/indicconformer-sherpa-onnx"
FILES = [
    "hi-hinglish-swift/encoder.int8.onnx",
    "hi-hinglish-swift/decoder.int8.onnx",
    "hi-hinglish-swift/tokens.txt",
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variant", choices=("swift", "apex"), default="swift",
                        help="Swift is the small local/browser-friendly model; Apex is larger and more accurate.")
    parser.add_argument("--offline", action="store_true", help="Check existing files without network access.")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    variant = args.variant
    files = [item.replace("swift", variant) for item in FILES]
    output = args.output or Path(os.getenv("BOL_HINGLISH_MODEL_DIR", f"data/models/hinglish-{variant}/hi-hinglish-{variant}"))
    output.mkdir(parents=True, exist_ok=True)
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        parser.exit(1, "Install backend dependencies first: .venv/bin/pip install -r server/requirements.txt\n")
    for filename in files:
        target = output / Path(filename).name
        if args.offline:
            if not target.is_file():
                parser.exit(1, f"Missing {target}; rerun without --offline.")
            continue
        downloaded = hf_hub_download(repo_id=REPO, filename=filename, local_dir=output.parent.parent)
        source = Path(downloaded)
        if source.resolve() != target.resolve():
            target.write_bytes(source.read_bytes())
    print(json.dumps({"repo": REPO, "variant": variant, "model": str(output.resolve()),
                      "ready": all((output / Path(item).name).is_file() for item in files)}, indent=2))


if __name__ == "__main__":
    main()
