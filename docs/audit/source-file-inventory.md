# Source file and symbol inventory

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

Every baseline first-party file is recorded below with hash/ranges in inventory.json. Named functions/classes/components/types and line references are extracted with the Python and TypeScript parsers after manual source review. Calls are lexical expressions, not a sound runtime call graph; callbacks, HTTP callers and framework invocation are explained in the architecture documents. Detailed unabridged per-file imports/calls/declarations live in evidence/python-symbols.json and evidence/typescript-symbols.json. “No targeted runtime coverage” does not mean the file is unreviewed.

## `.claude/launch.json`

- **File type:** .json
- **Line count:** 27
- **Responsibility:** Local development launch definitions; pre-existing user edits preserved.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `.dockerignore`

- **File type:** configuration
- **Line count:** 9
- **Responsibility:** Container context exclusions; prevents ignored runtime/dependency artifacts entering builds.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `.env.example`

- **File type:** .example
- **Line count:** 80
- **Responsibility:** Environment values withheld; variable names and consumers only
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `.env.production`

- **File type:** .production
- **Line count:** 1
- **Responsibility:** Environment values withheld; variable names and consumers only
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `.github/workflows/supabase-keepalive.yml`

- **File type:** .yml
- **Line count:** 43
- **Responsibility:** Scheduled account-service keepalive; operational automation, not application CI tests.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** Supabase auth/JWKS
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `.gitignore`

- **File type:** configuration
- **Line count:** 33
- **Responsibility:** Source-control exclusions for data, dependencies, generated output and local configuration.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `CHANGELOG.md`

- **File type:** .md
- **Line count:** 415
- **Responsibility:** Historical release claims; not authoritative current runtime behavior.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** BOL-30

## `DESIGN.md`

- **File type:** .md
- **Line count:** 323
- **Responsibility:** Design tokens and design rules; some claims drift from newer components.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `Dockerfile`

- **File type:** configuration
- **Line count:** 45
- **Responsibility:** Linux CPU container dependency installation, Swift model preparation and Uvicorn startup.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `README.md`

- **File type:** .md
- **Line count:** 128
- **Responsibility:** Setup/product/deployment overview; compare current code and audited limitations.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `app.py`

- **File type:** .py
- **Line count:** 129
- **Responsibility:** Hugging Face Gradio wrapper, dependency/runtime/model preparation and shared API installation; import has side effects.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `gpu_worker`:42
- **Imported dependencies:** `from __future__ import annotations`; `import os`; `import subprocess`; `import sys`; `import threading`; `from pathlib import Path`; `import spaces`; `import gradio as gr`; `from server.app import ALLOWED_ORIGINS, API_KEY, DATA_DIR, MAX_EXPORT_SECONDS, app, install_middleware`; `from gradio.routes import App as GradioApp`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `', '.join`, `DATA_DIR.mkdir`, `GradioApp.create_app`, `Path`, `Path('node_modules').is_dir`, `application.include_router`, `demo.launch`, `gr.Blocks`, `gr.Button`, `gr.Markdown`, `install_middleware`, `int`, `model_file.is_file`, `os.getenv`, `print`, `spaces.GPU`, `status_btn.click`, `subprocess.run`, `threading.Thread`, `threading.Thread(target=_background_init, daemon=True).start`
- **External services:** Hugging Face/model artifact hosts (download/setup)
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `docs/RESEARCH.md`

- **File type:** .md
- **Line count:** 146
- **Responsibility:** Prior model/product research and historical smoke measurements; not a new evaluation.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `index.html`

- **File type:** .html
- **Line count:** 49
- **Responsibility:** SPA document, branding, theme/bootstrap metadata and root mount.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `package-lock.json`

- **File type:** .json
- **Line count:** 5554
- **Responsibility:** Dependency lock: version-aware review
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `package.json`

- **File type:** .json
- **Line count:** 46
- **Responsibility:** Frontend/render dependencies and development/build/test scripts.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `packages.txt`

- **File type:** .txt
- **Line count:** 3
- **Responsibility:** System packages for hosted runtime.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `public/apple-touch-icon.png`

- **File type:** .png
- **Line count:** 90
- **Responsibility:** Binary asset; inspect references and rendered use
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/bol.studio-white.svg`

- **File type:** .svg
- **Line count:** 26
- **Responsibility:** Generated vector path geometry; SVG structure inspected, not every path coordinate. Static brand assets.
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/bol.studio.png`

- **File type:** .png
- **Line count:** 44
- **Responsibility:** Binary asset; inspect references and rendered use
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/bol.studio.svg`

- **File type:** .svg
- **Line count:** 26
- **Responsibility:** Generated vector path geometry; SVG structure inspected, not every path coordinate. Static brand assets.
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/bol.svg`

- **File type:** .svg
- **Line count:** 25
- **Responsibility:** Generated vector path geometry; SVG structure inspected, not every path coordinate. Static brand assets.
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/favicon-16x16.png`

- **File type:** .png
- **Line count:** 10
- **Responsibility:** Binary asset; inspect references and rendered use
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/favicon-32x32.png`

- **File type:** .png
- **Line count:** 12
- **Responsibility:** Binary asset; inspect references and rendered use
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/favicon-48x48.png`

- **File type:** .png
- **Line count:** 30
- **Responsibility:** Binary asset; inspect references and rendered use
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/favicon.ico`

- **File type:** .ico
- **Line count:** 52
- **Responsibility:** Binary asset; inspect references and rendered use
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/favicon.png`

- **File type:** .png
- **Line count:** 12
- **Responsibility:** Binary asset; inspect references and rendered use
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/favicon.svg`

- **File type:** .svg
- **Line count:** 19
- **Responsibility:** Generated vector path geometry; SVG structure inspected, not every path coordinate. Static brand assets.
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/icon-192.png`

- **File type:** .png
- **Line count:** 65
- **Responsibility:** Binary asset; inspect references and rendered use
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/icon-512.png`

- **File type:** .png
- **Line count:** 183
- **Responsibility:** Binary asset; inspect references and rendered use
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/safari-pinned-tab.svg`

- **File type:** .svg
- **Line count:** 10
- **Responsibility:** Generated vector path geometry; SVG structure inspected, not every path coordinate. Static brand assets.
- **Audit status:** EXCLUDED WITH JUSTIFICATION

## `public/site.webmanifest`

- **File type:** .webmanifest
- **Line count:** 19
- **Responsibility:** Brand icon and browser installation metadata; not an offline service worker.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `requirements.txt`

- **File type:** .txt
- **Line count:** 21
- **Responsibility:** Local Python dependency ranges and platform markers.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `scripts/backfill-owner.py`

- **File type:** .py
- **Line count:** 73
- **Responsibility:** Explicit offline migration of legacy JSON project ownership; no server coordination.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `main`:27
- **Imported dependencies:** `from __future__ import annotations`; `import argparse`; `import json`; `import sys`; `from pathlib import Path`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `(project.get('owner') or '').strip`, `SystemExit`, `argparse.ArgumentParser`, `args.data_dir.glob`, `args.data_dir.is_dir`, `json.dumps`, `json.loads`, `main`, `parser.add_argument`, `parser.parse_args`, `path.read_text`, `path.with_suffix`, `print`, `project.get`, `sorted`, `temporary.replace`, `temporary.write_text`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `scripts/compare-models.py`

- **File type:** .py
- **Line count:** 451
- **Responsibility:** Manual model benchmark, normalization/WER and disagreement outputs; executes inference.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `Model`:50, `Result`:86, `normalise`:112, `fold`:118, `score`:126, `disputes`:139, `word_diff`:186, `to_wav`:200, `run_sherpa`:211, `duration_of`:250, `run_mlx`:256, `run_transformers`:263, `render`:277, `main`:400, `esc`:278
- **Imported dependencies:** `from __future__ import annotations`; `import argparse`; `import html`; `import json`; `import re`; `import subprocess`; `import sys`; `import tempfile`; `import time`; `from dataclasses import dataclass, field`; `from pathlib import Path`; `import jiwer`; `from difflib import SequenceMatcher`; `from difflib import SequenceMatcher`; `import os`; `from server import transcription as engine`; `from scipy.io import wavfile`; `import mlx_whisper`; `import torch`; `from transformers import pipeline`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `' &nbsp;·&nbsp; '.join`, `' '.join`, `' '.join((str(w.get('text', '')).strip() for w in result.get('words', []))).strip`, `''.join`, `'\n'.join`, `(asr(str(wav)).get('text') or '').strip`, `(result.get('text') or '').strip`, `Model`, `Path`, `Path(__file__).resolve`, `RUNNERS[model.runner]`, `Result`, `SequenceMatcher`, `SequenceMatcher(None, ref, hyp).get_opcodes`, `SequenceMatcher(None, spine, other).get_opcodes`, `SystemExit`, `any`, `argparse.ArgumentParser`, `args.clips.iterdir`, `args.only.split`, `args.out.write_text`, `asr`, `asr(str(wav)).get`, `bits.append`, `by.get`, `clips.append`, `dict`, `disputes`, `duration_of`, `engine.transcribe`, `esc`, `field`, `fold`, `found.setdefault`, `found.values`, `html.escape`, `hyp.split`, `jiwer.wer`, `k.strip`, `k.strip().upper`, `len`, `list`, `main`, `max`, `mlx_whisper.transcribe`, `normalise`, `normalise(hypothesis).split`, `normalise(reference).split`, `normalise(texts[key]).split`, `normalise(texts[spine_key]).split`, `os.environ.get`, `os.environ.pop`, `out.append`, `p.suffix.lower`, `parser.add_argument`, `parser.parse_args`, `parts.append`, `path.with_suffix`, `pipeline`, `print`, `re.sub`, `re.sub('\\s+', ' ', text).strip`, `ref.split`, `render`, `result.get`, `results.append`, `row.get`, `rows.append`, `score`, `slot.get`, `slot.setdefault`, `sorted`, `str`, `str(w.get('text', '')).strip`, `subprocess.run`, `sum`, `sys.path.insert`, `tempfile.mkstemp`, `text.lower`, `time.time`, `to_wav`, `torch.backends.mps.is_available`, `truth_file.is_file`, `truth_file.read_text`, `truth_file.read_text().strip`, `type`, `w.get`, `wav.unlink`, `wavfile.read`, `word_diff`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `Model`, `Result`
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `scripts/dev.mjs`

- **File type:** .mjs
- **Line count:** 47
- **Responsibility:** Starts local frontend/backend processes and manages their lifetime.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `dotenv`:16, `stop`:45
- **Imported dependencies:** `node:child_process`; `node:fs`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `existsSync`, `console.error`, `process.exit`, `readFileSync('.env', 'utf8').split`, `readFileSync`, `/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec`, `match[2].trim().replace`, `match[2].trim`, `dotenv`, `spawn`, `children.forEach`, `c.kill`, `c.on`, `stop`, `process.on`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `scripts/make-test-media.py`

- **File type:** .py
- **Line count:** 76
- **Responsibility:** Generates deterministic and synthetic speech fixtures with provenance; no true timing labels.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `run`:22, `tone`:26, `main`:36
- **Imported dependencies:** `from __future__ import annotations`; `import argparse`; `import json`; `import math`; `import re`; `import shutil`; `import struct`; `import subprocess`; `import wave`; `from pathlib import Path`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `(output / 'manifest.json').write_text`, `Path`, `Path(__file__).resolve`, `argparse.ArgumentParser`, `args.output.resolve`, `b''.join`, `int`, `json.dumps`, `main`, `manifest.setdefault`, `manifest.setdefault('speech_generation_errors', []).append`, `manifest['speech_fixtures'].append`, `math.sin`, `next`, `output.mkdir`, `output.setframerate`, `output.setnchannels`, `output.setsampwidth`, `output.writeframes`, `parser.add_argument`, `parser.exit`, `parser.parse_args`, `print`, `range`, `re.split`, `re.split('\\s+en_IN\\s+', line)[0].strip`, `re.split('\\s+hi_IN\\s+', line)[0].strip`, `run`, `shutil.which`, `str`, `struct.pack`, `subprocess.run`, `tone`, `voices.splitlines`, `wave.open`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `scripts/prepare-hinglish-model.py`

- **File type:** .py
- **Line count:** 50
- **Responsibility:** Fetch/check selected ONNX Hinglish model assets with revision/offline options.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `main`:20
- **Imported dependencies:** `from __future__ import annotations`; `import argparse`; `import json`; `import os`; `from pathlib import Path`; `from huggingface_hub import hf_hub_download`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `(output / Path(item).name).is_file`, `Path`, `all`, `argparse.ArgumentParser`, `hf_hub_download`, `item.replace`, `json.dumps`, `main`, `os.getenv`, `output.mkdir`, `output.resolve`, `parser.add_argument`, `parser.exit`, `parser.parse_args`, `print`, `source.read_bytes`, `source.resolve`, `str`, `target.is_file`, `target.resolve`, `target.write_bytes`
- **External services:** Hugging Face/model artifact hosts (download/setup)
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `scripts/prepare-model.py`

- **File type:** .py
- **Line count:** 44
- **Responsibility:** Prepare/check multilingual model snapshot; download side effect.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `main`:16
- **Imported dependencies:** `from __future__ import annotations`; `import argparse`; `import json`; `import os`; `import platform`; `from pathlib import Path`; `from huggingface_hub import snapshot_download`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `(folder / 'config.json').is_file`, `(folder / 'weights.npz').is_file`, `Path`, `RuntimeError`, `argparse.ArgumentParser`, `folder.glob`, `json.dumps`, `list`, `main`, `os.environ.get`, `parser.add_argument`, `parser.exit`, `parser.parse_args`, `platform.machine`, `platform.system`, `print`, `snapshot_download`, `str`
- **External services:** Hugging Face/model artifact hosts (download/setup)
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `scripts/smoke-test.py`

- **File type:** .py
- **Line count:** 187
- **Responsibility:** Full media/ASR/export smoke workflow; expensive relative to unit tests and outdated fps assertion.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `save_json`:26, `check_response`:30, `wait_project`:36, `validate_words`:53, `upload`:68, `check_range`:79, `probe`:87, `render_and_download`:92, `main`:129, `ApiClient`:137, `request`:138
- **Imported dependencies:** `from __future__ import annotations`; `import argparse`; `import copy`; `import json`; `import math`; `import re`; `import subprocess`; `import time`; `from pathlib import Path`; `import httpx`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `' '.join`, `(FIXTURES / 'manifest.json').read_text`, `(FIXTURES / filename).open`, `(OUTPUT / name).write_text`, `ApiClient`, `OUTPUT.mkdir`, `Path`, `Path(__file__).resolve`, `RuntimeError`, `TimeoutError`, `abs`, `argparse.ArgumentParser`, `arguments.base_url.rstrip`, `bool`, `check_range`, `check_response`, `check_response(client.get('/health')).json`, `check_response(client.get(f"/projects/{project['id']}")).json`, `check_response(client.get(f"/projects/{roman['id']}")).json`, `check_response(client.get(f'/projects/{project_id}')).json`, `client.get`, `client.patch`, `client.post`, `copy.deepcopy`, `edited['settings'].update`, `first['text'].upper`, `float`, `json.dumps`, `json.loads`, `len`, `list`, `main`, `math.isfinite`, `next`, `parser.add_argument`, `parser.parse_args`, `path.write_bytes`, `print`, `probe`, `re.search`, `render_and_download`, `report.update`, `report['audioRange']['contentType'].startswith`, `response.headers['content-range'].startswith`, `response.json`, `save_json`, `str`, `str(url).lstrip`, `subprocess.run`, `super`, `super().request`, `time.monotonic`, `time.sleep`, `upload`, `validate_words`, `wait_project`, `word['text'].strip`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `ApiClient`
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `server/app.py`

- **File type:** .py
- **Line count:** 1568
- **Responsibility:** API middleware integration, schemas, project storage, media ingestion, assets and background jobs.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `project_dir`:78, `load_project`:87, `write_project`:95, `update_project`:110, `set_progress`:119, `run_process`:123, `inspect_media`:136, `playable_media`:169, `remux_for_playback`:200, `prepare_media`:245, `transcription_job`:303, `mark_export`:345, `export_job`:354, `lifespan`:403, `owner_of`:505, `owns`:526, `scope_to_owner`:551, `require_user`:599, `require_api_key`:632, `ValidatedModel`:648, `Word`:652, `Settings`:689, `ProjectPatch`:762, `TranscribeRequest`:775, `ExportRequest`:794, `validate_word_intervals`:802, `strip_foreign_cors`:814, `install_middleware`:839, `owned_project_usage`:873, `limits`:909, `health`:936, `projects`:943, `upload_project`:958, `get_project`:1011, `patch_project`:1016, `delete_project`:1059, `retry_transcription`:1108, `cancel_transcription`:1126, `media_token`:1137, `media`:1152, `audio_track`:1162, `create_export`:1183, `download_export`:1212, `inspect_asset_file`:1226, `generate_asset_thumb`:1260, `project_media_thumbnail`:1274, `list_project_assets`:1287, `upload_project_asset`:1316, `get_asset_file`:1379, `get_asset_thumbnail`:1408, `download_asset_file`:1420, `AssetPatchRequest`:1443, `patch_asset`:1449, `duplicate_asset`:1474, `delete_asset`:1548, `mutate`:346, `text_not_blank`:683, `mutate`:1017, `mutate`:1111, `mutate`:1450, `append`:1539, `remove`:1556, `mutate`:1130, `append_asset`:1359, `disable_video`:1551
- **Imported dependencies:** `from __future__ import annotations`; `import asyncio`; `import copy`; `import json`; `import logging`; `import math`; `import os`; `import re`; `import shutil`; `import subprocess`; `import secrets`; `import threading`; `import uuid`; `from concurrent.futures import ThreadPoolExecutor`; `from contextlib import asynccontextmanager`; `from datetime import datetime, timezone`; `from pathlib import Path`; `from typing import Annotated, Literal`; `from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile, Request`; `from fastapi.middleware.cors import CORSMiddleware`; `from starlette.middleware.base import BaseHTTPMiddleware`; `from fastapi.responses import FileResponse, JSONResponse`; `from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator`; `from server.auth import AUTH_ENABLED, AuthError, MEDIA_TOKEN_TTL_SECONDS, mint_media_token, owner_from_media_token, user_id_from`; `from server.transcription import TranscriptionCancelled, model_status, transcribe`
- **Callers:** `app.py`
- **Callees:** `(DATA_DIR / project_id / 'project.json').is_file`, `(Path(__file__).resolve().parent.parent / 'src' / 'lib' / 'caption-defaults.json').read_text`, `(Path(__file__).resolve().parent.parent / 'src' / 'lib' / 'caption-fonts.json').read_text`, `(Path(__file__).resolve().parent.parent / 'src' / 'lib' / 'caption-templates.json').read_text`, `(audio or {}).get`, `(audio_stream or {}).get`, `(directory / 'assets').glob`, `(directory / 'audio.tmp.m4a').replace`, `(directory / 'audio.tmp.wav').replace`, `(directory / 'audio.wav').is_file`, `(directory / 'preview.m4a').is_file`, `(directory / 'preview.mp4').is_file`, `(directory / 'preview.tmp.m4a').replace`, `(directory / 'preview.tmp.mp4').replace`, `(directory / 'source.bin').open`, `(file.filename or 'Untitled clip').replace`, `(file.filename or 'media').replace`, `(project.get('owner') or '').strip`, `(project_dir(project_id) / 'audio.wav').unlink`, `(video_stream or {}).get`, `CANCELLATIONS.add`, `CANCELLATIONS.discard`, `ConfigDict`, `DATA_DIR.glob`, `DATA_DIR.mkdir`, `EXECUTOR.submit`, `FastAPI`, `Field`, `File`, `FileResponse`, `Form`, `HTTPException`, `JSONResponse`, `LOGGER.error`, `LOGGER.exception`, `LOGGER.info`, `LOGGER.warning`, `Path`, `Path(__file__).resolve`, `Path(orig_filename).suffix.lower`, `Path(original_filename).suffix.lower`, `Path(os.getenv('DATA_DIR', str(ROOT / 'data'))).resolve`, `Path(raw_filename).suffix.lower`, `Response`, `ThreadPoolExecutor`, `TranscriptionCancelled`, `ValueError`, `_MEDIA_PATHS.match`, `_PROJECT_PATH.match`, `_is_guarded`, `_media_token_owner`, `_streams`, `_was_deleted`, `a.get`, `any`, `app.delete`, `app.get`, `app.patch`, `app.post`, `asset.get`, `assets.insert`, `assets_dir.glob`, `assets_dir.mkdir`, `asyncio.to_thread`, `audio.lower`, `audio_path.is_file`, `authorization.lower`, `authorization.lower().startswith`, `authorization[7:].strip`, `bool`, `call_next`, `change`, `copy.deepcopy`, `datetime.now`, `datetime.now(timezone.utc).isoformat`, `dest_path.open`, `dest_path.unlink`, `directory.exists`, `directory.mkdir`, `entry.is_file`, `entry.stat`, `error_file.read`, `error_file.seek`, `error_path.open`, `field_validator`, `file.close`, `file.read`, `file_path.is_file`, `file_path.suffix.lower`, `float`, `format_info.get`, `generate_asset_thumb`, `getattr`, `handle.fileno`, `handle.flush`, `identifiers.add`, `img_stream.get`, `info.get`, `info.get('format', {}).get`, `install_middleware`, `int`, `is_cancelled`, `isinstance`, `job.get`, `job.update`, `json.dump`, `json.dumps`, `json.loads`, `json.loads(line).get`, `json.loads(result.stdout).get`, `len`, `list`, `load_project`, `logging.getLogger`, `mark_export`, `marker.is_file`, `marker.write_text`, `match.group`, `math.isfinite`, `max`, `min`, `mint_media_token`, `model_status`, `new_assets_dir.mkdir`, `new_dest.stat`, `new_thumb.is_file`, `next`, `os.cpu_count`, `os.fsync`, `os.getenv`, `os.getenv('BOL_ALLOWED_ORIGINS', os.getenv('CORS_ORIGINS', DEFAULT_ORIGINS)).split`, `os.getenv('BOL_API_KEY', '').strip`, `out_file.write`, `output.write`, `output_path.is_file`, `output_path.stat`, `output_path.unlink`, `owned_project_usage`, `owner_from_media_token`, `owner_of`, `owns`, `p.get`, `p.name.endswith`, `p.unlink`, `p.update`, `p['exports'].append`, `p['mediaAssets'].append`, `path.is_file`, `path.parent.rglob`, `path.read_text`, `path.startswith`, `playable_media`, `prepare_media`, `preview.is_file`, `process.wait`, `project.get`, `project.update`, `project['settings'].update`, `project['settings']['accent'].lower`, `project_dir`, `project_media_thumbnail`, `re.compile`, `re.sub`, `re.sub('[^\\w .-]', '', snapshot['name']).strip`, `remux_for_playback`, `remuxed.replace`, `remuxed.unlink`, `req_data.pop`, `request.headers.get`, `request.model_dump`, `request.name.strip`, `request.query_params.get`, `request.settings.model_dump`, `result.append`, `round`, `run_process`, `s.get`, `s.get('disposition', {}).get`, `secrets.compare_digest`, `set`, `set_progress`, `shutil.copy2`, `shutil.disk_usage`, `shutil.rmtree`, `shutil.which`, `snapshot_path.write_text`, `sorted`, `source.is_file`, `source_file.is_file`, `source_file.stat`, `source_path.is_file`, `str`, `subprocess.Popen`, `subprocess.run`, `supplied.strip`, `t.strip`, `target.add_middleware`, `temporary.open`, `temporary.replace`, `temporary.unlink`, `threading.RLock`, `threading.Timer`, `thumb_path.is_file`, `thumb_path.parent.mkdir`, `thumb_path.unlink`, `timer.cancel`, `timer.start`, `transcribe`, `update_project`, `user_id_from`, `uuid.UUID`, `uuid.uuid4`, `v.strip`, `validate_word_intervals`, `value.strip`, `video.get`, `video.get('tags', {}).get`, `video.lower`, `video_stream.get`, `w.model_dump`, `write_project`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `ValidatedModel`, `Word`, `Settings`, `ProjectPatch`, `TranscribeRequest`, `ExportRequest`, `AssetPatchRequest`
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Request/worker validation and failure propagation detailed in pipeline-failure-matrix.md
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** BOL-02, BOL-16, BOL-17, BOL-23, BOL-29

## `server/auth.py`

- **File type:** .py
- **Line count:** 252
- **Responsibility:** Async JWKS cache, JWT verification and scoped HMAC media capabilities.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `AuthError`:67, `JWKSCache`:92, `user_id_from`:149, `mint_media_token`:222, `owner_from_media_token`:231, `get`:107
- **Imported dependencies:** `from __future__ import annotations`; `import asyncio`; `import base64`; `import hashlib`; `import hmac`; `import json`; `import os`; `import secrets`; `import time`; `from dataclasses import dataclass`; `import httpx`; `import jwt`; `from jwt import PyJWK`
- **Callers:** `server/app.py`
- **Callees:** `(os.getenv('BOL_MEDIA_SECRET', '').strip() or secrets.token_urlsafe(32)).encode`, `AuthError`, `JWKSCache`, `PyJWK.from_dict`, `_Keys`, `_b64`, `_cache.get`, `_unb64`, `asyncio.Lock`, `base64.urlsafe_b64decode`, `base64.urlsafe_b64encode`, `base64.urlsafe_b64encode(raw).rstrip`, `base64.urlsafe_b64encode(raw).rstrip(b'=').decode`, `bool`, `claims.get`, `client.get`, `float`, `header.get`, `hmac.compare_digest`, `hmac.new`, `hmac.new(MEDIA_SECRET, payload.encode(), hashlib.sha256).digest`, `httpx.AsyncClient`, `int`, `json.dumps`, `json.dumps({'p': project_id, 'o': owner, 'exp': int(time.time()) + MEDIA_TOKEN_TTL_SECONDS}, separators=(',', ':')).encode`, `json.loads`, `jwt.decode`, `jwt.get_unverified_header`, `key.get`, `len`, `os.getenv`, `os.getenv('BOL_MEDIA_SECRET', '').strip`, `os.getenv('BOL_SUPABASE_JWKS_URL', '').strip`, `os.getenv('BOL_SUPABASE_URL', '').strip`, `os.getenv('BOL_SUPABASE_URL', '').strip().rstrip`, `payload.encode`, `payload.get`, `response.json`, `response.raise_for_status`, `secrets.token_urlsafe`, `self._refetch`, `str`, `str(claims.get('sub') or '').strip`, `super`, `super().__init__`, `time.monotonic`, `time.time`, `token.partition`
- **External services:** Supabase auth/JWKS
- **Data structures:** `AuthError`, `_Keys`, `JWKSCache`
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Request/worker validation and failure propagation detailed in pipeline-failure-matrix.md
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `server/denoise.py`

- **File type:** .py
- **Line count:** 161
- **Responsibility:** Optional source-rate Demucs vocal separation; fallback and temporary media handling.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `available`:44, `isolate_vocals_from_source`:73
- **Imported dependencies:** `from __future__ import annotations`; `import logging`; `import subprocess`; `import tempfile`; `from pathlib import Path`; `import numpy as np`; `import torch`; `from torchaudio.pipelines import HDEMUCS_HIGH_MUSDB_PLUS`; `import torch`; `import torch`; `import torchaudio`; `import torch`; `import torchaudio`; `from scipy.io import wavfile`
- **Callers:** `server/transcription.py`, `tests/test_backend.py`
- **Callees:** `HDEMUCS_HIGH_MUSDB_PLUS.get_model`, `HDEMUCS_HIGH_MUSDB_PLUS.get_model().to`, `HDEMUCS_HIGH_MUSDB_PLUS.get_model().to(_device).eval`, `LOGGER.info`, `LOGGER.warning`, `Path`, `_load`, `_separate`, `abs`, `available`, `data.T.astype`, `data.astype`, `getattr`, `int`, `len`, `list`, `list(model.sources).index`, `logging.getLogger`, `max`, `min`, `model`, `model(chunk)[0, source_index].cpu`, `mono.squeeze`, `mono.squeeze(0).numpy`, `mono.squeeze(0).numpy().astype`, `np.ascontiguousarray`, `np.iinfo`, `np.issubdtype`, `np.pad`, `progress`, `source.is_file`, `str`, `subprocess.run`, `tempfile.mkstemp`, `tmp.unlink`, `torch.backends.mps.is_available`, `torch.cuda.is_available`, `torch.device`, `torch.from_numpy`, `torch.hann_window`, `torch.no_grad`, `torch.ones`, `torch.zeros`, `torch.zeros_like`, `torchaudio.functional.resample`, `vocals.mean`, `wave.mean`, `wave.std`, `wave.std().clamp`, `wave.unsqueeze`, `wave.unsqueeze(0).repeat`, `wave[:, start:end].unsqueeze`, `wave[:, start:end].unsqueeze(0).to`, `wavfile.read`, `weight.clamp`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Request/worker validation and failure propagation detailed in pipeline-failure-matrix.md
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `server/emoji.py`

- **File type:** .py
- **Line count:** 268
- **Responsibility:** English keyword/embedding emoji suggestion and lazy MiniLM initialization.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `available`:165, `suggest_emoji`:224
- **Imported dependencies:** `from __future__ import annotations`; `import logging`; `import re`; `from sentence_transformers import SentenceTransformer`; `import sentence_transformers`; `import numpy as np`
- **Callers:** `server/transcription.py`
- **Callees:** `LOGGER.info`, `LOGGER.warning`, `SentenceTransformer`, `_LITERAL.get`, `_candidates`, `_literal_index`, `_load`, `_model.encode`, `_stem`, `available`, `description.split`, `enumerate`, `float`, `index.setdefault`, `int`, `len`, `logging.getLogger`, `model.encode`, `np.argmax`, `out.append`, `re.sub`, `re.sub('[^A-Za-z]', '', str(word.get('text', ''))).lower`, `round`, `str`, `text.endswith`, `unresolved.append`, `word.get`
- **External services:** Hugging Face/model artifact hosts (download/setup)
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Request/worker validation and failure propagation detailed in pipeline-failure-matrix.md
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `server/glossary.py`

- **File type:** .py
- **Line count:** 150
- **Responsibility:** Fuzzy creator-vocabulary replacement and multiword-span merging.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `apply_glossary`:89
- **Imported dependencies:** `from __future__ import annotations`; `import re`; `import unicodedata`; `from difflib import SequenceMatcher`
- **Callers:** `server/transcription.py`, `tests/test_backend.py`
- **Callees:** `' '.join`, `' '.join((str(words[i].get('original', words[i].get('text', ''))) for i in range(index, index + span))).strip`, `''.join`, `SequenceMatcher`, `SequenceMatcher(None, a, b).ratio`, `_SPOKEN_SYMBOLS.get`, `_SPOKEN_SYMBOLS.values`, `_fold`, `_fold(term).replace`, `_fold(term).split`, `_fold(text).replace`, `_score`, `_similarity`, `_speech_key`, `_spoken_to_written`, `any`, `candidates.append`, `candidates.sort`, `claimed.get`, `collapsed.replace`, `dict`, `f'{joined} {piece}'.strip`, `first.get`, `joined.rstrip`, `last.get`, `len`, `max`, `min`, `out.append`, `range`, `re.sub`, `re.sub('[^\\w\\s]', '', stripped).lower`, `re.sub('[^\\w\\s]', '', stripped).lower().strip`, `set`, `sorted`, `str`, `t.split`, `t.strip`, `taken.update`, `unicodedata.combining`, `unicodedata.normalize`, `words[i].get`, `written.replace`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Request/worker validation and failure propagation detailed in pipeline-failure-matrix.md
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `server/remotion-captions.ts`

- **File type:** .ts
- **Line count:** 141
- **Responsibility:** Bundle/select Remotion composition, stream frames and serialize out-of-order delivery.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `captionBundle`:15, `createOrderedDispatcher`:47, `push`:53, `streamCaptionFrames`:87
- **Imported dependencies:** `node:path`; `@remotion/bundler`; `@remotion/renderer`; `../src/lib/types.ts`
- **Callers:** `server/render.ts`, `tests/captions.test.ts`
- **Callees:** `resolve`, `process.cwd`, `bundle`, `onProgress`, `Promise.resolve`, `Promise.reject`, `pending.set`, `queue.then`, `pending.has`, `pending.get`, `pending.delete`, `onFrame`, `ensureBrowser`, `captionBundle`, `selectComposition`, `createOrderedDispatcher`, `renderFrames`, `dispatcher.push`, `options.onProgress`, `dispatcher.settle`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Request/worker validation and failure propagation detailed in pipeline-failure-matrix.md
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `server/render.ts`

- **File type:** .ts
- **Line count:** 292
- **Responsibility:** Validate render input, load assets, composite frames and encode MP4 with FFmpeg.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `RenderMode`:26, `registerRenderFonts`:30, `record`:52, `finiteBetween`:56, `validateRenderProject`:61, `ffmpegArguments`:103, `renderCaptionVideo`:129, `progress`:168, `main`:272
- **Imported dependencies:** `node:child_process`; `node:fs/promises`; `node:fs`; `node:path`; `node:module`; `node:url`; `@napi-rs/canvas`; `../src/lib/captions.ts`; `./remotion-captions.ts`; `../src/lib/chromakey.ts`; `../src/lib/types.ts`
- **Callers:** `tests/captions.test.ts`
- **Callees:** `setChromaKeyCanvasFactory`, `createCanvas`, `c.getContext`, `createRequire`, `GlobalFonts.registerFromPath`, `require.resolve`, `Array.isArray`, `Number.isFinite`, `record`, `finiteBetween`, `/^(video|audio)(\/|$)/.test`, `templates.some`, `/^#[\da-f]{6}$/i.test`, `['left', 'center', 'right'].includes`, `String`, `Number.isInteger`, `['original', '9:16', '1:1', '16:9'].includes`, `w.text.trim`, `dimensions`, `Math.ceil`, `args.push`, `project.mediaType.startsWith`, `validateRenderProject`, `[24, 25, 30, 50, 60].includes`, `/^#00ff00$/i.test`, `resolve`, `access`, `mkdir`, `dirname`, `registerRenderFonts`, `canvas.getContext`, `spawn`, `ffmpegArguments`, `ffmpeg.stderr.on`, `(errorOutput + data.toString()).slice`, `data.toString`, `ffmpeg.stdin.on`, `ffmpeg.once`, `resolveExit`, `options.onProgress`, `progress`, `el.name.split('.').pop`, `el.name.split`, `loadImage`, `readdir`, `files.find`, `f.startsWith`, `f.endsWith`, `loadedCanvasImages.set`, `streamCaptionFrames`, `ctx.clearRect`, `loadedCanvasImages.get`, `ctx.save`, `ctx.translate`, `ctx.rotate`, `drawKeyedMedia`, `ctx.drawImage`, `ctx.restore`, `loadImage(captionPng).catch`, `ctx.fillRect`, `ffmpeg.stdin.write`, `canvas.data`, `rejectWrite`, `resolveWrite`, `Math.min`, `Math.floor`, `ffmpeg.stdin.end`, `ffmpeg.stdin.destroy`, `ffmpeg.kill`, `rm(output, { force: true }).catch`, `rm`, `errorOutput.trim`, `process.argv.slice`, `JSON.parse`, `readFile`, `Number`, `renderCaptionVideo`, `process.stdout.write`, `JSON.stringify`, `pathToFileURL`, `main().catch`, `main`, `process.stderr.write`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `RenderMode`
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Request/worker validation and failure propagation detailed in pipeline-failure-matrix.md
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** BOL-01, BOL-06

## `server/requirements-cpu.txt`

- **File type:** .txt
- **Line count:** 2
- **Responsibility:** Adds portable faster-whisper to shared backend requirements.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Request/worker validation and failure propagation detailed in pipeline-failure-matrix.md
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `server/requirements.txt`

- **File type:** .txt
- **Line count:** 33
- **Responsibility:** Hosted backend dependency set, shared with CPU requirements.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Request/worker validation and failure propagation detailed in pipeline-failure-matrix.md
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `server/transcription.py`

- **File type:** .py
- **Line count:** 812
- **Responsibility:** Engine selection, inference, token normalization, romanization, timing, English verification and prominence.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `TranscriptionCancelled`:32, `model_config`:133, `model_status`:151, `romanizer`:163, `romanize_hinglish`:168, `merge_code_mixed_english`:186, `read_audio`:278, `waveform_samples`:289, `suggest_emphasis`:323, `normalize_words`:409, `refine_word_boundaries_with_vad`:447, `decode_plan`:693, `transcribe`:718, `convert`:169, `flush`:578
- **Imported dependencies:** `from __future__ import annotations`; `import importlib.util`; `import math`; `import os`; `import platform`; `import re`; `from functools import lru_cache`; `from pathlib import Path`; `from typing import Callable`; `import numpy as np`; `from server.denoise import available as denoise_available, isolate_vocals_from_source`; `from server.glossary import apply_glossary`; `from server.emoji import suggest_emoji as emoji_suggest`; `from scipy.io import wavfile`; `import uroman`; `from faster_whisper import WhisperModel`; `import sherpa_onnx`; `import mlx_whisper`; `import mlx_whisper`
- **Callers:** `server/app.py`, `tests/test_backend.py`
- **Callees:** `(folder / filename).is_file`, `COMMON_HINDI.values`, `Path`, `Path(__file__).resolve`, `TranscriptionCancelled`, `ValueError`, `WhisperModel`, `_cap_emphasis_per_breath`, `_clean_latin_word`, `_clean_latin_word(str(word.get('text', ''))).lower`, `_english_companion_decode`, `_faster_model`, `_hinglish_model`, `_hinglish_model_ready`, `_pitch`, `_preferred_hinglish_model`, `_sherpa_decode`, `_sherpa_tokens_to_words`, `_word_is_devanagari`, `abs`, `all`, `all_words.append`, `all_words.sort`, `any`, `apply_glossary`, `audio.astype`, `audio.mean`, `best[2].lower`, `bool`, `candidate.isalpha`, `candidate.isascii`, `candidate.lower`, `candidate[2].lower`, `candidates.append`, `candidates.sort`, `current_text.strip`, `decode_plan`, `denoise_available`, `dict`, `emoji_suggest`, `enumerate`, `features.append`, `float`, `flush`, `frame.mean`, `getattr`, `importlib.util.find_spec`, `insertions.append`, `int`, `is_cancelled`, `isinstance`, `isolate_vocals_from_source`, `len`, `list`, `local_model.transcribe`, `lru_cache`, `match.group`, `math.ceil`, `math.exp`, `math.isfinite`, `math.log2`, `max`, `merge_code_mixed_english`, `min`, `mlx_whisper.transcribe`, `model_config`, `next`, `normalize_words`, `np.argmax`, `np.array`, `np.array_split`, `np.asarray`, `np.clip`, `np.correlate`, `np.hanning`, `np.iinfo`, `np.issubdtype`, `np.linspace`, `np.linspace(window // 2, max(window // 2, len(samples) - window // 2), 4).astype`, `np.mean`, `np.median`, `np.percentile`, `np.round`, `np.round(np.clip(values / ceiling, 0, 1), 3).tolist`, `np.sqrt`, `original.split`, `os.getenv`, `platform.machine`, `platform.system`, `progress`, `range`, `raw.get`, `re.search`, `re.sub`, `re.sub('[\\u0900-\\u0963\\u0966-\\u097f]+', convert, text).replace`, `re.sub('[\\u0900-\\u0963\\u0966-\\u097f]+', convert, text).replace('।', '.').replace`, `re.sub('\\W', '', candidate['word']).lower`, `re.sub('\\W', '', existing['word']).lower`, `re.sub('\\W', '', str(word.get('text', ''))).lower`, `read_audio`, `recognizer.create_stream`, `recognizer.decode_stream`, `refine_word_boundaries_with_vad`, `refined.append`, `result.get`, `reversed`, `romanize_hinglish`, `romanizer`, `romanizer().romanize_string`, `round`, `run.append`, `runs.append`, `samples[max(0, center - window // 2):center + window // 2].astype`, `segment.get`, `segments.append`, `sherpa_onnx.OfflineRecognizer.from_whisper`, `str`, `str(raw.get('word', '')).strip`, `stream.accept_waveform`, `suggest_emphasis`, `text[:1].isspace`, `uroman.Uroman`, `value.lower`, `values.append`, `w.get`, `waveform_samples`, `wavfile.read`, `word.get`, `words.append`, `words.insert`
- **External services:** Hugging Face/model artifact hosts (download/setup)
- **Data structures:** `TranscriptionCancelled`
- **Side effects:** Filesystem/process/model/network operations; see backend/media/job docs
- **Error handling:** Request/worker validation and failure propagation detailed in pipeline-failure-matrix.md
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** BOL-03, BOL-04, BOL-14, BOL-26

## `skills-lock.json`

- **File type:** .json
- **Line count:** 83
- **Responsibility:** Installed development skill provenance; tooling metadata, not runtime application code.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/AuthScreen.tsx`

- **File type:** .tsx
- **Line count:** 527
- **Responsibility:** Sign-in/signup/reset/recovery UI using Supabase; dual-face form focus and errors.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `Mode`:5, `strengthOf`:28, `AuthScreen`:84, `clearErrors`:126, `go`:134, `edit`:156, `submit`:163, `measure`:272, `renderForm`:284, `id`:290
- **Imported dependencies:** `react`; `lucide-react`; `../lib/auth`
- **Callers:** `src/main.tsx`
- **Callees:** `(import.meta.env.VITE_TERMS_URL || '').trim`, `(import.meta.env.VITE_PRIVACY_URL || '').trim`, `[/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter`, `re.test`, `useState`, `useRef`, `useEffect`, `setMode`, `document.querySelector`, `meta.getAttribute`, `meta.setAttribute`, `setNameError`, `setEmailError`, `setPasswordError`, `setFormError`, `clearErrors`, `setReveal`, `setTouchedPassword`, `setTurn`, `Math.abs`, `setFaces`, `set`, `clear`, `event.preventDefault`, `name.trim`, `LOOKS_LIKE_EMAIL.test`, `email.trim`, `passwordProblem`, `setBusy`, `supabase.auth.signInWithPassword`, `authErrorMessage`, `supabase.auth.signUp`, `go`, `supabase.auth.resetPasswordForEmail`, `/user not found/i.test`, `supabase.auth.updateUser`, `strengthOf`, `useLayoutEffect`, `setCardHeight`, `measure`, `faceRefs.current.forEach`, `observer.observe`, `observer.disconnect`, `submit`, `id`, `edit`, `[1, 2, 3].map`, `([0, 1] as const).map`, `renderForm`
- **External services:** Supabase auth/JWKS
- **Data structures:** `Mode`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/CaptionsPanel.tsx`

- **File type:** .tsx
- **Line count:** 2218
- **Responsibility:** Generation settings, grouping, search/filter, inline edits, drag/drop and caption options.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `WordSnapshot`:31, `RowSnapshot`:41, `CaptionsPanelProps`:49, `formatTimecode`:118, `parseTimecode`:126, `CaptionsPanel`:147, `handleGlobalDragEnd`:275, `handleClickOutside`:310, `handleContainerScroll`:359, `handleWordClick`:486, `handleWordDoubleClick`:512, `commitWordEdit`:523, `cancelWordEdit`:536, `extent`:653, `handleWordDragStart`:760, `handleWordDragEnd`:798, `handleGlobalDragEnter`:809, `handleGlobalDragOver`:817, `handleGlobalDrop`:862, `handleToggleWordHighlight`:914, `applyWordCase`:930, `handleGenerate`:970, `handleCopyAll`:987
- **Imported dependencies:** `react`; `lucide-react`; `../lib/types`; `../lib/captions`; `../lib/pages`; `../lib/pages`; `./WordInspector`
- **Callers:** `src/main.tsx`
- **Callees:** `Math.max`, `Math.floor`, `(s % 60).toFixed`, `String(mins).padStart`, `String`, `str.trim`, `trimmed.includes`, `trimmed.split`, `parseFloat`, `isNaN`, `Number`, `(m * 60 + s).toFixed`, `s.toFixed`, `['queued', 'processing', 'transcribing', 'extracting'].includes`, `useState`, `useMemo`, `projectAssets.filter`, `(project?.glossary ?? []).join`, `Math.min`, `useRef`, `useEffect`, `setDraggingWordIds`, `setDraggingLabel`, `setDropTarget`, `window.addEventListener`, `window.removeEventListener`, `compatibleAssets.some`, `setSelectedSourceId`, `menuRef.current.contains`, `setPanelMenuOpen`, `document.querySelector`, `rowMenuWrap.contains`, `setActiveRowMenuIdx`, `wordPopoverRef.current.contains`, `(e.target as HTMLElement).closest`, `setWordPopover`, `document.addEventListener`, `document.removeEventListener`, `groups.findIndex`, `g.find`, `clearTimeout`, `setTimeout`, `container.getBoundingClientRect`, `row.getBoundingClientRect`, `container.scrollBy`, `project.words.find`, `groups.map`, `list.filter`, `group.some`, `searchQuery.trim`, `searchQuery.toLowerCase`, `w.text.toLowerCase().includes`, `w.text.toLowerCase`, `group.map(w => w.text).join(' ').toLowerCase().includes`, `group.map(w => w.text).join(' ').toLowerCase`, `group.map(w => w.text).join`, `group.map`, `g.some`, `useCallback`, `group.forEach`, `onUpdateWord`, `recase`, `notify`, `group.filter(w => w.spotlight || w.emphasis).map`, `group.filter`, `onUpdateWords`, `setEditingGroupIdx`, `setDraftGroupText`, `g.map(w => w.text).join`, `g.map`, `setDraftGroupStart`, `formatTimecode`, `setDraftGroupEnd`, `setGroupTimeError`, `parseTimecode`, `onEditCaptionGroup`, `draftGroupText.trim`, `e.stopPropagation`, `onSelectWord`, `onSeek`, `(e.currentTarget as HTMLElement).getBoundingClientRect`, `setEditingWordId`, `setEditingWordText`, `wordInputRef.current?.focus`, `wordInputRef.current?.select`, `editingWordText.trim`, `Array.from`, `container.querySelectorAll`, `rowEls.map`, `rowEl.getBoundingClientRect`, `rowEl.querySelector`, `chipsContainer.querySelectorAll`, `wordEls
        .map`, `wEl.getBoundingClientRect`, `wEl.getAttribute`, `Boolean`, `currentLine.push`, `currentLine.reduce`, `Math.abs`, `visualLines.push`, `rowEl.getAttribute`, `parseInt`, `takeLayoutSnapshot`, `snapshots.find`, `[...snapshots].sort`, `row.words.filter`, `movingIds.includes`, `live.map`, `extent`, `targetRow.words.filter`, `targetRow.visualLines[0]?.filter`, `vl.filter`, `lineWords.reduce`, `e.preventDefault`, `selectedWordIds.has`, `project.words.filter(pw => selectedWordIds.has(pw.id)).map`, `project.words.filter`, `w.text.trim().replace`, `w.text.trim`, `e.dataTransfer.setData`, `movingIds.join`, `JSON.stringify`, `document.createElement`, `document.body.appendChild`, `e.dataTransfer.setDragImage`, `ghost.parentNode.removeChild`, `Math.round`, `getDropTargetFromSnapshot`, `e.dataTransfer.getData`, `JSON.parse`, `Array.isArray`, `txt.split(',').filter`, `txt.split`, `onDropWordsAsNewLine`, `onDropWords`, `project?.words.find`, `wordPopover.draftText.trim`, `onStartTranscription`, `brandWords.split(',').map(t => t.trim()).filter(Boolean).slice`, `brandWords.split(',').map(t => t.trim()).filter`, `brandWords.split(',').map`, `brandWords.split`, `t.trim`, `setPanelViewOverride`, `groups.map(g => g.map(w => w.text).join(' ')).join`, `navigator.clipboard.writeText`, `getContrastColor`, `downloadTranscript`, `setModalType`, `onGoToMedia`, `compatibleAssets.map`, `setSpokenLang`, `setCaptionScript`, `setShowAdvanced`, `setWordsPerCaption`, `brandWords.split(',').filter`, `setBrandWords`, `setIsolateVocals`, `setWantTranslate`, `setWantEmoji`, `onCancelTranscription`, `setSearchQuery`, `(['all', 'highlighted', 'edited'] as const).map`, `setActiveFilter`, `onUpdateSettings`, `groups.some`, `searchResults.map`, `handleGlobalDragOver`, `handleGlobalDragEnter`, `handleGlobalDrop`, `commitInlineGroupEdit`, `cancelInlineGroupEdit`, `onTogglePlay`, `gDuration.toFixed`, `startInlineGroupEdit`, `onSplitGroup`, `onMergeGroups`, `onDuplicateGroup`, `handleBatchLineCase`, `handleClearLineHighlights`, `onDeleteGroup`, `group.findIndex`, `commitWordEdit`, `cancelWordEdit`, `setInsertMenu`, `onInsertWord`, `handleWordDragStart`, `heroWordIds.has`, `handleWordClick`, `handleWordDoubleClick`, `onSplitLine`, `groups.find`, `onDeleteWord`, `onAddCaptionAtTime`, `onRegenerateCaptions`, `onClearAllCaptions`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `WordSnapshot`, `RowSnapshot`, `CaptionsPanelProps`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** BOL-21

## `src/components/CommandPalette.tsx`

- **File type:** .tsx
- **Line count:** 458
- **Responsibility:** Searchable commands/project shortcuts and keyboard selection; own dialog implementation.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `CommandPaletteProps`:23, `CommandItem`:41, `CommandPalette`:52, `onKeyDown`:354
- **Imported dependencies:** `react`; `lucide-react`; `../lib/types`
- **Callers:** `src/main.tsx`
- **Callees:** `useState`, `useRef`, `useEffect`, `setQuery`, `setSelectedIndex`, `setTimeout`, `inputRef.current?.focus`, `useMemo`, `onClose`, `onNewUpload`, `onOpenModal`, `onStartTour`, `onUpdateSettings`, `onToggleTheme`, `downloadTranscript`, `downloadAudioTrack`, `copyTranscript`, `projects.forEach`, `list.push`, `(p.duration || 0).toFixed`, `onOpenProject`, `query.trim`, `query.toLowerCase`, `commands.filter`, `c.title.toLowerCase().includes`, `c.title.toLowerCase`, `c.description.toLowerCase().includes`, `c.description.toLowerCase`, `c.category.toLowerCase().includes`, `c.category.toLowerCase`, `e.preventDefault`, `filtered[selectedIndex].perform`, `window.addEventListener`, `window.removeEventListener`, `listRef.current.querySelector`, `activeEl.scrollIntoView`, `e.stopPropagation`, `filtered.map`, `item.perform`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `CommandPaletteProps`, `CommandItem`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** BOL-11, BOL-18

## `src/components/LiveAnnouncer.tsx`

- **File type:** .tsx
- **Line count:** 68
- **Responsibility:** Screen-reader live status presentation.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `LiveAnnouncerProps`:3
- **Imported dependencies:** `react`
- **Callers:** `src/main.tsx`
- **Callees:** `React.memo`, `useState`, `useEffect`, `setAnnouncement`, `saveStatus.includes`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `LiveAnnouncerProps`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/MediaPanel.tsx`

- **File type:** .tsx
- **Line count:** 1549
- **Responsibility:** Project asset browsing/upload/rename/duplicate/delete, chromakey preview and custom dialogs.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `getExtension`:45, `getBaseName`:50, `formatDuration`:55, `getAssetUsageCount`:62, `UploadingItem`:75, `MediaPanelProps`:87, `MediaPanel`:98, `showSuccess`:160, `handleFiles`:167, `cancelUpload`:240, `retryUpload`:248, `handleDragOver`:254, `handleDragLeave`:260, `handleDrop`:266, `handleAddMediaToCanvas`:303, `handleDuplicate`:316, `handleDownload`:327, `onClick`:343, `MediaPreviewModal`:895, `onKey`:917, `togglePlay`:932, `handleSeek`:939, `MediaRenameModal`:1093, `handleSubmit`:1105, `onKey`:1112, `MediaRemoveModal`:1165, `onKey`:1177, `GreenScreenModal`:1223, `handleReset`:1242, `loop`:1293, `handleOriginalCanvasClick`:1304, `onKey`:1321
- **Imported dependencies:** `react`; `lucide-react`; `../lib/api`; `../lib/chromakey`; `../lib/types`; `../lib/utils`
- **Callers:** `src/main.tsx`
- **Callees:** `filename.split`, `parts.pop()!.toLowerCase`, `parts.pop`, `filename.lastIndexOf`, `filename.substring`, `Math.floor`, `mins.toString().padStart`, `mins.toString`, `secs.toString().padStart`, `secs.toString`, `Array.isArray`, `project.canvasElements.filter`, `useState`, `useRef`, `useCallback`, `setAssets`, `fetchMediaAssets`, `onUpdateProjectAssets`, `useEffect`, `loadAssets`, `setSuccessBanner`, `clearTimeout`, `setTimeout`, `Array.from`, `getExtension`, `SUPPORTED_EXTENSIONS.has`, `notify`, `onStartProjectFromUpload`, `Date.now`, `Math.random().toString(36).slice`, `Math.random().toString`, `Math.random`, `setUploadingList`, `uploadMediaAsset`, `prev.map`, `prev.filter`, `showSuccess`, `prev.find`, `target?.abort`, `cancelUpload`, `handleFiles`, `e.preventDefault`, `e.stopPropagation`, `setIsDraggingOver`, `useMemo`, `searchQuery.trim`, `searchQuery.toLowerCase().trim`, `searchQuery.toLowerCase`, `result.filter`, `a.name.toLowerCase().includes`, `a.name.toLowerCase`, `a.filename.toLowerCase().includes`, `a.filename.toLowerCase`, `result.sort`, `new Date(b.createdAt || 0).getTime`, `new Date(a.createdAt || 0).getTime`, `a.name.localeCompare`, `b.name.localeCompare`, `onAddMediaToCanvas`, `onAddImageToCanvas`, `onSelectMediaForCanvas`, `duplicateMediaAsset`, `ensureMediaToken`, `mediaUrl`, `document.createElement`, `document.body.appendChild`, `a.click`, `document.body.removeChild`, `setMenuAssetId`, `window.addEventListener`, `window.removeEventListener`, `uploadingList.map`, `formatBytes`, `retryUpload`, `fileInputRef.current?.click`, `setSearchQuery`, `setSortOption`, `filteredAssets.map`, `getAssetUsageCount`, `setSelectedAssetId`, `handleAddMediaToCanvas`, `e.dataTransfer.setData`, `JSON.stringify`, `formatDuration`, `setTargetAsset`, `setModalType`, `handleDuplicate`, `handleDownload`, `updateMediaAsset`, `deleteMediaAsset`, `onRemoveMediaAsset`, `onClose`, `media.play`, `media.pause`, `Number`, `setCurrentTime`, `setIsPlaying`, `setDuration`, `setIsMuted`, `videoRef.current?.requestFullscreen`, `getBaseName`, `name.trim`, `onSave`, `setName`, `setColor`, `setTolerance`, `setSpillReduction`, `setSmoothEdges`, `originalCanvas.getContext`, `processedCanvas.getContext`, `origCtx.clearRect`, `origCtx.drawImage`, `procCtx.clearRect`, `drawKeyedMedia`, `renderFrame`, `requestAnimationFrame`, `loop`, `cancelAnimationFrame`, `canvas.getBoundingClientRect`, `samplePixelColor`, `setIsEyedropperActive`, `setVideoTime`, `setVideoDuration`, `videoRef.current.pause`, `videoRef.current.play`, `color.toUpperCase`, `onApply`
- **External services:** Configured project API via api.ts
- **Data structures:** `UploadingItem`, `MediaPanelProps`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/Modal.tsx`

- **File type:** .tsx
- **Line count:** 23
- **Responsibility:** Reusable labelled modal, focus containment/return and dismissal.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `Modal`:11
- **Imported dependencies:** `react`; `lucide-react`
- **Callers:** `src/components/SettingsPanel.tsx`, `src/components/ShortcutModal.tsx`, `src/components/StudioModals.tsx`, `src/main.tsx`
- **Callees:** `useRef`, `useEffect`, `el?.showModal`, `el?.close`, `title.toLowerCase().replace`, `title.toLowerCase`, `onClose`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Word, Settings, Project and callback props
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/OnboardingTour.tsx`

- **File type:** .tsx
- **Line count:** 147
- **Responsibility:** Three-step stage/timeline/export onboarding overlay and keyboard navigation.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `OnboardingTourProps`:4, `TourStep`:9, `OnboardingTour`:44, `onKeyDown`:53
- **Imported dependencies:** `react`; `lucide-react`
- **Callers:** `src/main.tsx`
- **Callees:** `useState`, `useEffect`, `setStep`, `onClose`, `window.addEventListener`, `window.removeEventListener`, `e.stopPropagation`, `TOUR_STEPS.map`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `OnboardingTourProps`, `TourStep`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/SettingsPanel.tsx`

- **File type:** .tsx
- **Line count:** 439
- **Responsibility:** Project properties/aspect/limits/storage information and deletion confirmation.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `timecode`:10, `SettingsPanel`:45, `runDelete`:127, `retryLimits`:146, `copyProjectId`:151, `unreadable`:168
- **Imported dependencies:** `react`; `lucide-react`; `../lib/captions`; `../lib/utils`; `./Modal`; `../lib/api`; `../lib/shell`; `../lib/types`
- **Callers:** `src/main.tsx`
- **Callees:** `Math.floor(Math.max(0, s) / 60).toString().padStart`, `Math.floor(Math.max(0, s) / 60).toString`, `Math.floor`, `Math.max`, `(Math.max(0, s) % 60).toFixed(1).padStart`, `(Math.max(0, s) % 60).toFixed`, `useState`, `useEffect`, `setConfirmingDelete`, `setConfirmText`, `setDeleting`, `setCopiedId`, `dimensions`, `['processing', 'transcribing', 'extracting'].includes`, `(health?.model ?? '').split('/').filter(Boolean).at`, `(health?.model ?? '').split('/').filter`, `(health?.model ?? '').split`, `(project?.name || '').trim`, `confirmText.trim().toLowerCase`, `confirmText.trim`, `expectedWord.toLowerCase`, `project?.exports?.filter`, `onDeleteProject`, `notify`, `setRetrying`, `onRefreshLimits().finally`, `onRefreshLimits`, `copyText(project.id).then`, `copyText`, `aspectOptions.map`, `updateSettings`, `formatMinutes`, `formatBytes`, `unreadable`, `timecode`, `runDelete`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Word, Settings, Project and callback props
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/ShortcutModal.tsx`

- **File type:** .tsx
- **Line count:** 89
- **Responsibility:** Keyboard command reference content inside shared modal.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `ShortcutModalProps`:5, `ShortcutItem`:9, `ShortcutCategory`:14, `ShortcutModal`:55
- **Imported dependencies:** `react`; `./Modal`; `lucide-react`
- **Callers:** `src/components/StudioModals.tsx`
- **Callees:** `SHORTCUTS.map`, `cat.items.map`, `item.keys.map`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `ShortcutModalProps`, `ShortcutItem`, `ShortcutCategory`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/StudioModals.tsx`

- **File type:** .tsx
- **Line count:** 287
- **Responsibility:** Workspace search/sort, export, help and find-replace modal composition.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `StudioModalsProps`:7
- **Imported dependencies:** `react`; `lucide-react`; `./Modal`; `./ShortcutModal`; `../lib/types`
- **Callers:** `src/main.tsx`
- **Callees:** `React.memo`, `useState`, `useMemo`, `projects.filter`, `projectSearch.trim`, `projectSearch.toLowerCase`, `p.name.toLowerCase().includes`, `p.name.toLowerCase`, `p.id.toLowerCase().includes`, `p.id.toLowerCase`, `[...list].reverse`, `[...list].sort`, `a.name.localeCompare`, `onClose`, `onNewUpload`, `setProjectSearch`, `setProjectSort`, `filteredProjects.map`, `onOpenProject`, `timecode`, `onStartTour`, `searchFindText.trim`, `project.words.filter`, `w.text.includes`, `w.text.toLowerCase().includes`, `w.text.toLowerCase`, `searchFindText.toLowerCase`, `setSearchFindText`, `setSearchReplaceText`, `setSearchCaseSensitive`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `StudioModalsProps`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** BOL-22

## `src/components/StudioNavbar.tsx`

- **File type:** .tsx
- **Line count:** 166
- **Responsibility:** Project name/save state, theme, history, account/workspace and export entry points.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `StudioNavbarProps`:7
- **Imported dependencies:** `react`; `lucide-react`; `@/registry/magicui/animated-theme-toggler`; `../lib/types`; `../lib/shell`
- **Callers:** `src/main.tsx`
- **Callees:** `React.memo`, `useRef`, `onRenameProject`, `saveStatus.includes`, `accountButtonRef.current?.getBoundingClientRect`, `onToggleAccountMenu`, `(accountName || accountEmail)[0].toUpperCase`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `StudioNavbarProps`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/StylePanel.tsx`

- **File type:** .tsx
- **Line count:** 153
- **Responsibility:** Template filtering/selection and preview cards.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `StylePanel`:22
- **Imported dependencies:** `react`; `lucide-react`; `../lib/caption-fonts`; `../lib/captions`; `../remotion/treatments`; `../lib/pages`; `../lib/safe-area`; `../lib/types`; `./TemplateCard`
- **Callers:** `src/main.tsx`
- **Callees:** `useState`, `treatmentFor`, `useMemo`, `templates.filter`, `templateSearch.trim().toLowerCase`, `templateSearch.trim`, `t.name.toLowerCase().includes`, `t.name.toLowerCase`, `t.description.toLowerCase().includes`, `t.description.toLowerCase`, `t.tag.toLowerCase().includes`, `t.tag.toLowerCase`, `t.id.startsWith`, `setTemplateSearch`, `setShowFilters`, `(['all', 'minimal', 'bold', 'kinetic', 'editorial', 'fun'] as const).map`, `setTemplateCategory`, `cat.charAt(0).toUpperCase`, `cat.charAt`, `cat.slice`, `(['all', 'single', 'stacked'] as const).map`, `setLayoutFilter`, `filteredTemplates.map`, `updateSettings`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Word, Settings, Project and callback props
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/TemplateCard.tsx`

- **File type:** .tsx
- **Line count:** 121
- **Responsibility:** Treatment thumbnail composition, accents and selected state.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `TemplatePreview`:13, `TemplateCard`:106
- **Imported dependencies:** `react`; `lucide-react`; `../lib/captions`
- **Callers:** `src/components/StylePanel.tsx`
- **Callees:** `getContrastColor`, `template.tag.split`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Word, Settings, Project and callback props
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/TextPanel.tsx`

- **File type:** .tsx
- **Line count:** 631
- **Responsibility:** Caption font/size/color/stroke/background/position and typography controls.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `TextPanel`:24, `setCaptionSize`:47
- **Imported dependencies:** `react`; `lucide-react`; `../lib/caption-fonts`; `../lib/captions`; `../lib/pages`; `../lib/safe-area`; `../remotion/treatments`; `../lib/types`
- **Callers:** `src/main.tsx`
- **Callees:** `treatmentFor`, `Math.round`, `updateSettings`, `captionFonts.map`, `captionFonts.find`, `setCaptionSize`, `Math.max`, `Number`, `Math.min`, `((settings.lineHeight ?? 1) * 100).toFixed`, `(settings.lineHeight ?? 1).toFixed`, `(settings.letterSpacing ?? 0).toFixed`, `(settings.textColor || '#ffffff').toUpperCase`, `['#ffffff', '#f4f4f5', '#bfa4ff', '#72e6ff', '#d4fa41', '#ff8bb5', '#ffd166', '#111318'].map`, `(settings.textColor || '#ffffff').toLowerCase`, `color.toLowerCase`, `settings.accentSecondary.toUpperCase`, `['#ffd166', '#ff8bb5', '#7ee7c7', '#c9a6ff', '#57c7ff', '#ff825c'].map`, `(settings.accentSecondary || '').toLowerCase`, `settings.accent.toUpperCase`, `['#d4fa41', '#c2a1ff', '#ff8bb5', '#ff825c', '#72e6ff', '#ffffff', '#10b981', '#f59e0b'].map`, `templates.find`, `notify`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Word, Settings, Project and callback props
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** BOL-13

## `src/components/TimelineRuler.tsx`

- **File type:** .tsx
- **Line count:** 33
- **Responsibility:** Timeline tick spacing and time labels from zoom/duration.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `RulerTick`:3, `TimelineRulerProps`:9, `TimelineRuler`:18
- **Imported dependencies:** `react`
- **Callers:** `src/main.tsx`
- **Callees:** `ticks.map`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `RulerTick`, `TimelineRulerProps`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/components/WordInspector.tsx`

- **File type:** .tsx
- **Line count:** 159
- **Responsibility:** Focused word text/case/highlight/split/delete controls.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `WordCase`:5, `recase`:11, `WordInspectorProps`:20, `applyCase`:62
- **Imported dependencies:** `react`; `lucide-react`; `../lib/types`
- **Callers:** `src/components/CaptionsPanel.tsx`, `src/main.tsx`
- **Callees:** `word.text.toUpperCase`, `word.text.toLowerCase`, `word.text.replace`, `t.charAt(0).toUpperCase`, `t.charAt`, `t.substring(1).toLowerCase`, `t.substring`, `word.text.charAt(0).toUpperCase`, `word.text.charAt`, `word.text.substring(1).toLowerCase`, `word.text.substring`, `forwardRef`, `useState`, `useRef`, `useEffect`, `inputRef.current?.select`, `onApplyCase`, `setCaseMenuOpen`, `e.stopPropagation`, `onDraftChange`, `onCommit`, `(e.target as HTMLInputElement).blur`, `onRevert`, `onClose`, `applyCase`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `WordCase`, `WordInspectorProps`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/fonts/local-faces.ts`

- **File type:** .ts
- **Line count:** 59
- **Responsibility:** Conditional locally licensed Satoshi loading without bundling it as a shipped selectable font.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `registerLocalFaces`:40
- **Imported dependencies:** `remotion`
- **Callers:** `src/lib/caption-fonts.ts`
- **Callees:** `Promise.resolve`, `Promise.all`, `WEIGHTS.map`, `staticFile`, `String`, `document.fonts.add`, `face.load`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Word, Settings, Project and callback props
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/lib/api.ts`

- **File type:** .ts
- **Line count:** 328
- **Responsibility:** Origin/auth/workspace headers, fetch/XHR, token-aware media URLs and asset APIs.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `getOwner`:71, `authHeaders`:76, `mediaUrl`:97, `projectIdIn`:119, `ensureMediaToken`:140, `forgetMediaTokens`:160, `request`:164, `upload`:204, `Limits`:229, `fetchLimits`:240, `deleteProject`:257, `fetchMediaAssets`:261, `uploadMediaAsset`:265, `updateMediaAsset`:306, `duplicateMediaAsset`:318, `deleteMediaAsset`:324
- **Imported dependencies:** `./types`; `./auth`
- **Callers:** `src/components/MediaPanel.tsx`, `src/components/SettingsPanel.tsx`, `src/main.tsx`
- **Callees:** `(import.meta.env.VITE_API_BASE || defaultBase).replace`, `(import.meta.env.VITE_API_KEY || '').trim`, `localStorage.getItem`, `crypto.randomUUID`, `localStorage.setItem`, `currentUserId`, `getOwner`, `currentAccessToken`, `path.startsWith`, `query.set`, `mediaTokens.get`, `projectIdIn`, `base.includes`, `PROJECT_IN_PATH.exec`, `Date.now`, `mintingNow.get`, `request`, `mediaTokens.set`, `mintingNow.delete`, `mintingNow.set`, `mediaTokens.clear`, `mintingNow.clear`, `fetch`, `authHeaders`, `response.clone().json().catch`, `response.clone().json`, `response.clone`, `supabase.auth.refreshSession`, `supabase.auth.signOut`, `response.json`, `JSON.stringify`, `body.append`, `xhr.open`, `Object.entries`, `xhr.setRequestHeader`, `onProgress`, `Math.round`, `reject`, `JSON.parse`, `resolve`, `xhr.send`, `xhrRef.abort`
- **External services:** Configured project API via api.ts
- **Data structures:** `Limits`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/lib/auth.ts`

- **File type:** .ts
- **Line count:** 96
- **Responsibility:** Supabase client/session access and form error/password helpers.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `currentAccessToken`:39, `currentUserId`:44, `rememberSession`:48, `authErrorMessage`:61, `passwordProblem`:91
- **Imported dependencies:** `@supabase/supabase-js`
- **Callers:** `src/components/AuthScreen.tsx`, `src/lib/api.ts`, `src/main.tsx`
- **Callees:** `(import.meta.env.VITE_SUPABASE_URL || '').trim().replace`, `(import.meta.env.VITE_SUPABASE_URL || '').trim`, `(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim`, `Boolean`, `createClient`, `/invalid login credentials/i.test`, `/not confirmed/i.test`, `/already registered/i.test`, `/at least 6 characters/i.test`, `/rate limit/i.test`, `/invalid.*email/i.test`, `/fetch|network/i.test`
- **External services:** Supabase auth/JWKS
- **Data structures:** Word, Settings, Project and callback props
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/lib/caption-defaults.json`

- **File type:** .json
- **Line count:** 10
- **Responsibility:** Shared initial caption settings.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** `src/lib/types.ts`
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/lib/caption-fonts.json`

- **File type:** .json
- **Line count:** 13
- **Responsibility:** Shared shipped selectable font allowlist.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** `src/components/StylePanel.tsx`, `src/components/TextPanel.tsx`, `src/lib/caption-fonts.ts`, `src/main.tsx`, `src/remotion/CaptionPage.tsx`, `src/remotion/CaptionTrack.tsx`
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/lib/caption-fonts.ts`

- **File type:** .ts
- **Line count:** 66
- **Responsibility:** Runtime/local font choices and platform flag handling.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `CaptionFont`:4, `localFontsEnabled`:25
- **Imported dependencies:** `./caption-fonts.json`; `../fonts/local-faces`
- **Callers:** `src/components/StylePanel.tsx`, `src/components/TextPanel.tsx`, `src/main.tsx`, `src/remotion/CaptionPage.tsx`, `src/remotion/CaptionTrack.tsx`
- **Callees:** `Boolean`, `localFontsEnabled`, `registerLocalFaces`, `Promise.resolve`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `CaptionFont`
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/lib/caption-templates.json`

- **File type:** .json
- **Line count:** 170
- **Responsibility:** Shared24 template IDs/names/tags/accents/descriptions.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** `src/lib/captions.ts`
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/lib/captions.ts`

- **File type:** .ts
- **Line count:** 601
- **Responsibility:** Dimensions, text export and word/line manipulation helpers; page builder re-exports.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `dimensions`:17, `getContrastColor`:22, `subtitleText`:38, `stamp`:39, `plainTranscript`:43, `csvTranscript`:51, `escapeCsv`:52, `ensureValidIntervals`:66, `insertWord`:97, `appendWord`:170, `splitLineAtWord`:223, `mergeLines`:229, `moveWordToPreviousLine`:240, `moveWordToNextLine`:265, `moveSingleWordToLine`:276, `moveWordsToLine`:455, `moveWordsToNewLine`:504, `moveWordToLine`:535, `replaceAllOccurrences`:546, `autoDetectHighlights`:574
- **Imported dependencies:** `./caption-templates.json`; `./types`; `./pages`
- **Callers:** `server/render.ts`, `src/components/CaptionsPanel.tsx`, `src/components/SettingsPanel.tsx`, `src/components/StylePanel.tsx`, `src/components/TemplateCard.tsx`, `src/components/TextPanel.tsx`, `src/main.tsx`, `src/remotion/CaptionWord.tsx`, `tests/captions.test.ts`
- **Callees:** `Math.round`, `hexColor.replace('#', '').trim`, `hexColor.replace`, `parseInt`, `hex.substring`, `Math.max`, `String(Math.floor(ms/3600000)).padStart`, `String`, `Math.floor`, `String(Math.floor(ms/60000)%60).padStart`, `String(Math.floor(ms/1000)%60).padStart`, `String(ms%1000).padStart`, `groupWords(words,max).map`, `groupWords`, `stamp`, `g.at`, `g.map(w=>w.text).join`, `g.map`, `groupWords(words, max).map(g => g.map(w => w.text).join(' ')).join`, `groupWords(words, max).map`, `g.map(w => w.text).join`, `val.replace`, `words.map`, `escapeCsv`, `w.start.toFixed`, `w.end.toFixed`, `Math.max(0, w.end - w.start).toFixed`, `(w.confidence ?? 1).toFixed`, `[header.join(','), ...rows].join`, `header.join`, `Number`, `(prevEnd + 0.002).toFixed`, `Math.min(nextStart - 0.002, words[i].start + 0.25).toFixed`, `Math.min`, `(words[i].start + 0.03).toFixed`, `(words[lastIdx].end - duration).toFixed`, `Math.max(0.04, words[i].end - overflow).toFixed`, `Math.max(0, words[i].start - overflow).toFixed`, `(words[i + 1].start - 0.002).toFixed`, `words.findIndex`, `appendWord`, `Date.now`, `Math.random().toString(36).substring`, `Math.random().toString`, `Math.random`, `(target.end + 0.005).toFixed`, `Math.min(maxEnd, start + 0.35).toFixed`, `(target.start + keep).toFixed`, `(splitPoint - 0.005).toFixed`, `Math.min(maxEnd, start + Math.max(0.12, (maxEnd - start) * 0.8)).toFixed`, `(start + 0.05).toFixed`, `(target.start - 0.005).toFixed`, `Math.max(minStart, end - 0.35).toFixed`, `(target.end - keep).toFixed`, `Math.max(minStart, splitPoint - Math.max(0.12, (splitPoint - minStart) * 0.8)).toFixed`, `Math.max(0, start).toFixed`, `Math.min(duration, Math.max(start + 0.05, end)).toFixed`, `newText.trim`, `newWords.splice`, `ensureValidIntervals`, `(last.end + 0.01).toFixed`, `Math.min(duration, start + 0.35).toFixed`, `(last.start + Math.max(0.1, lastDur * 0.6)).toFixed`, `(split - 0.005).toFixed`, `duration.toFixed`, `Math.min(duration, 0.4).toFixed`, `newWords.push`, `w.text.replace`, `groups.findIndex`, `g.some`, `words.find`, `newWords.findIndex`, `sourceGroupWords.findIndex`, `sourceGroupWords.filter(w => w.id !== wordId).map`, `sourceGroupWords.filter`, `remainingSourceIds.includes`, `(gap - 0.08).toFixed`, `(newWords[m].start - shift).toFixed`, `(newWords[m].end - shift).toFixed`, `(movingWord.end - movingWord.start).toFixed`, `targetGroup.some`, `(movingWord.start - shift).toFixed`, `(movingWord.end - shift).toFixed`, `(movingWord.start + shift).toFixed`, `(movingWord.end + shift).toFixed`, `(prevWord.end + 0.01).toFixed`, `(nextWord.start - 0.01).toFixed`, `Math.max(minStart, movingWord.end - dur).toFixed`, `Math.min(maxEnd, movingWord.start + dur).toFixed`, `(minStart + Math.max(0.04, dur * 0.5)).toFixed`, `(movingWord.end + 0.01 - nextWord.start).toFixed`, `(newWords[j].start + shift).toFixed`, `(newWords[j].end + shift).toFixed`, `targetGroup.map(w => w.id).concat`, `targetGroup.map`, `newWords.filter`, `targetGroupWordIds.has`, `wordsInTarget[idx].text.replace`, `words.filter`, `wordIds.includes`, `moveSingleWordToLine`, `moveWordsToLine`, `moved.findIndex`, `movingIds.has`, `moved.map`, `findText.trim`, `w.text.match`, `w.text.slice`, `baseText.toLowerCase`, `query.toLowerCase`, `buildPages(words, wordsPerLine).flatMap`, `buildPages`, `group.some`, `group.map`, `group.forEach`, `Math.abs`, `scoreOf`, `isSecondaryEmphasis`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Word, Settings, Project and callback props
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** BOL-24

## `src/lib/chromakey.ts`

- **File type:** .ts
- **Line count:** 169
- **Responsibility:** Canvas green-screen color removal with tolerance/spill/edge treatment and reusable canvas factory.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `hexToRgb`:6, `rgbToHex`:23, `clamp`:24, `toHex`:25, `CanvasFactory`:32, `setChromaKeyCanvasFactory`:35, `getOffscreen`:41, `processChromaKeyData`:66, `applyChromaKey`:111, `samplePixelColor`:126, `drawKeyedMedia`:146
- **Imported dependencies:** `./types`
- **Callers:** `server/render.ts`, `src/components/MediaPanel.tsx`, `src/main.tsx`
- **Callees:** `hex.replace`, `parseInt`, `clean.slice`, `Math.max`, `Math.min`, `Math.round`, `clamp(v).toString(16).padStart`, `clamp(v).toString`, `clamp`, `toHex`, `customCanvasFactory`, `document.createElement`, `offscreenCanvas.getContext`, `hexToRgb`, `Math.sqrt`, `ctx.getImageData`, `processChromaKeyData`, `ctx.putImageData`, `getOffscreen`, `ctx.clearRect`, `ctx.drawImage`, `rgbToHex`, `targetCtx.drawImage`, `offCtx.clearRect`, `offCtx.drawImage`, `offCtx.getImageData`, `offCtx.putImageData`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `CanvasFactory`
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/lib/pages.ts`

- **File type:** .ts
- **Line count:** 433
- **Responsibility:** Page segmentation, explicit joins, phrase cost, timing hold and hero/emoji selection.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `PageOptions`:34, `CaptionPage`:59, `clean`:91, `endsSentence`:93, `breakCost`:170, `lineCost`:184, `breakSegment`:203, `splitRuns`:244, `scoreOf`:279, `isSecondaryEmphasis`:291, `pickHeroes`:308, `pickEmoji`:343, `heroRun`:360, `rebalanceCountSplits`:377, `buildPages`:394, `groupWords`:426, `pageAt`:431
- **Imported dependencies:** `./types`
- **Callers:** `src/components/CaptionsPanel.tsx`, `src/components/StylePanel.tsx`, `src/components/TextPanel.tsx`, `src/lib/captions.ts`, `src/main.tsx`, `src/remotion/CaptionPage.tsx`, `src/remotion/CaptionTrack.tsx`, `tests/captions.test.ts`
- **Callees:** `text.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase`, `text.replace`, `/[.!?।]$/.test`, `text.trim`, `clean`, `Math.min`, `endsSentence`, `BINDS_FORWARD.has`, `BINDS_BACKWARD.has`, `CLAUSE_STARTERS.has`, `CLAUSE_ENDERS.has`, `Math.abs`, `new Array<number>(n + 1).fill`, `Math.max`, `lineCost`, `breakCost`, `bounds.unshift`, `runs.push`, `words.slice`, `words.map`, `current.at`, `segments.push`, `current.push`, `segments.flatMap`, `breakSegment`, `STOP_WORDS.has`, `HOOK_WORDS.has`, `/\d/.test`, `words.flatMap`, `words.forEach`, `scoreOf`, `Math.floor`, `page.words.forEach`, `page.heroIndices.includes`, `runs.map`, `run.at`, `run.slice(0, -1).map`, `run.slice`, `next.unshift`, `run.pop`, `Math.round`, `splitRuns`, `rebalanceCountSplits`, `pickHeroes`, `buildPages(words, maxWords).map`, `buildPages`, `pages.findIndex`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `PageOptions`, `CaptionPage`
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** BOL-12

## `src/lib/safe-area.ts`

- **File type:** .ts
- **Line count:** 77
- **Responsibility:** Reels/Shorts reserved-zone definitions and position collision warnings.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `SafeAreaId`:13, `SafeAreaZone`:15, `SafeAreaSpec`:23, `safeAreaFor`:55, `positionCollides`:69
- **Imported dependencies:** No static imports extracted.
- **Callers:** `src/components/StylePanel.tsx`, `src/components/TextPanel.tsx`, `src/main.tsx`, `tests/captions.test.ts`
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `SafeAreaId`, `SafeAreaZone`, `SafeAreaSpec`
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/lib/shell.ts`

- **File type:** .ts
- **Line count:** 28
- **Responsibility:** Editor shell constants, save-state label, navigation type and Health response type.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `NavPanelId`:6, `Health`:21
- **Imported dependencies:** No static imports extracted.
- **Callers:** `src/components/SettingsPanel.tsx`, `src/components/StudioNavbar.tsx`, `src/main.tsx`
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `NavPanelId`, `Health`
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/lib/types.ts`

- **File type:** .ts
- **Line count:** 200
- **Responsibility:** Word/Settings/Project/MediaAsset/canvas contracts and shared defaults.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `Word`:2, `Settings`:30, `ExportJob`:116, `GreenScreenSettings`:117, `MediaAsset`:124, `CanvasVisualElement`:138, `Project`:155
- **Imported dependencies:** `./caption-defaults.json`
- **Callers:** `server/remotion-captions.ts`, `server/render.ts`, `src/components/CaptionsPanel.tsx`, `src/components/CommandPalette.tsx`, `src/components/MediaPanel.tsx`, `src/components/SettingsPanel.tsx`, `src/components/StudioModals.tsx`, `src/components/StudioNavbar.tsx`, `src/components/StylePanel.tsx`, `src/components/TextPanel.tsx`, `src/components/WordInspector.tsx`, `src/lib/api.ts`, `src/lib/captions.ts`, `src/lib/chromakey.ts`, `src/lib/pages.ts`, `src/main.tsx`, `src/remotion/CaptionPage.tsx`, `src/remotion/CaptionTrack.tsx`, `src/remotion/Root.tsx`, `tests/captions.test.ts`
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `Word`, `Settings`, `ExportJob`, `GreenScreenSettings`, `MediaAsset`, `CanvasVisualElement`, `Project`
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/lib/utils.ts`

- **File type:** .ts
- **Line count:** 118
- **Responsibility:** Byte/duration formatting, class-name composition and clipboard fallback helpers.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `formatBytes`:12, `formatMinutes`:36, `ClassValue`:45, `cn`:54, `process`:57, `copyText`:94
- **Imported dependencies:** No static imports extracted.
- **Callers:** `src/components/MediaPanel.tsx`, `src/components/SettingsPanel.tsx`, `tests/captions.test.ts`
- **Callees:** `Number.isFinite`, `value.toFixed`, `Math.round`, `Math.floor`, `classes.push`, `String`, `Array.isArray`, `process`, `Object.entries`, `classes.join`, `navigator.clipboard.writeText`, `document.createElement`, `field.setAttribute`, `document.body.appendChild`, `field.select`, `document.execCommand`, `field.remove`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `ClassValue`
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Partial helper/API coverage in the executed suites; no per-file coverage percentage measured.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/main.tsx`

- **File type:** .tsx
- **Line count:** 4436
- **Responsibility:** React entrypoint and editor controller: state, persistence, playback, timeline, scene and workflows.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `timecode`:45, `EditState`:46, `snapToAnchor`:74, `App`:91, `handleThemeKey`:148, `clamp`:372, `onMouseMove`:495, `onMouseUp`:507, `onWheel`:528, `onGestureStart`:582, `onGestureChange`:594, `onGestureEnd`:610, `onGlobalWheel`:630, `onGlobalGesture`:636, `onGlobalKeyDown`:640, `mint`:691, `check`:730, `handler`:818, `markEdit`:845, `updateSettings`:869, `onMouseMove`:966, `onMouseUp`:999, `onMouseMove`:1029, `onMouseUp`:1044, `onMouseMove`:1074, `onMouseUp`:1099, `updateWord`:1109, `updateWords`:1113, `selectWord`:1118, `handleDropWordsAsNewLine`:1157, `handleClearAllHighlights`:1175, `handleInsertWord`:1183, `handleAppendWordToLine`:1191, `handleAddNewLine`:1196, `handleDeleteWords`:1205, `handleDeleteWord`:1215, `handleDeleteLine`:1218, `handleSplitLine`:1221, `handleMoveToPreviousLine`:1227, `handleMoveToNextLine`:1233, `handleSplitAtCurrent`:1240, `handleAddWord`:1252, `handleDropWords`:1393, `handleDropWord`:1450, `commitInlineEdit`:1457, `cancelInlineEdit`:1466, `handleWordContextMenu`:1469, `handleTimelineWordClick`:1489, `setWordHighlight`:1518, `applyTimelineWordCase`:1534, `saveTimelineWordEdit`:1548, `calculatePopoverPosition`:1562, `handleTimelineTrackClick`:1573, `startWordHandleDrag`:1581, `onMouseMove`:1618, `onMouseUp`:1657, `startWordDividerDrag`:1679, `onMouseMove`:1708, `onMouseUp`:1729, `startWordDrag`:1756, `onMouseMove`:1793, `onMouseUp`:1812, `startGroupTrim`:1848, `onMouseMove`:1891, `onMouseUp`:1948, `startGroupDrag`:1989, `onMouseMove`:2035, `onMouseUp`:2071, `handleMergeWithNext`:2108, `handleSplitWord`:2115, `handleNudgeWordTiming`:2134, `handleTransformCase`:2148, `setVideoEnabled`:2183, `changeTiming`:2190, `undo`:2197, `redo`:2201, `seek`:2205, `tick`:2241, `onKey`:2322, `importFile`:2501, `handleDragEnter`:2519, `handleDragLeave`:2528, `handleDragOver`:2538, `handleDrop`:2543, `openProject`:2567, `startExport`:2627, `downloadTranscript`:2652, `copyTranscript`:2676, `downloadAudioTrack`:2685, `startTranscription`:2701, `retryTranscription`:2730, `move`:3149, `clamp`:3155, `up`:3168, `Root`:4402
- **Imported dependencies:** `react`; `react-dom/client`; `lucide-react`; `@fontsource/dm-sans/400.css`; `@fontsource/dm-sans/500.css`; `@fontsource/dm-sans/600.css`; `@fontsource/dm-sans/700.css`; `@fontsource/space-grotesk/500.css`; `@fontsource/space-grotesk/700.css`; `@fontsource/noto-sans-devanagari/700.css`; `@fontsource/montserrat/800.css`; `@fontsource/montserrat/900.css`; `./styles.css`; `./lib/api`; `./lib/types`; `./lib/captions`; `./lib/pages`; `./lib/shell`; `./components/Modal`; `./components/SettingsPanel`; `./components/StylePanel`; `./components/TextPanel`; `./lib/safe-area`; `./lib/caption-fonts`; `@remotion/player`; `./remotion/CaptionTrack`; `./remotion/treatments`; `./remotion/Root`; `./lib/chromakey`; `./components/MediaPanel`; `./components/CaptionsPanel`; `./components/WordInspector`; `@/registry/magicui/animated-theme-toggler`; `./components/StudioNavbar`; `./components/StudioModals`; `./components/OnboardingTour`; `./components/CommandPalette`; `./components/LiveAnnouncer`; `./components/TimelineRuler`; `./components/AuthScreen`; `./lib/auth`; `@supabase/supabase-js`; `./lib/api`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `Math.floor(Math.max(0,s)/60).toString().padStart`, `Math.floor(Math.max(0,s)/60).toString`, `Math.floor`, `Math.max`, `(Math.max(0,s)%60).toFixed(1).padStart`, `(Math.max(0,s)%60).toFixed`, `Math.abs`, `useState`, `localStorage.getItem`, `useCallback`, `setTheme`, `localStorage.setItem`, `document.documentElement.setAttribute`, `document.documentElement.classList.add`, `document.documentElement.classList.remove`, `document.querySelector`, `meta.setAttribute`, `useEffect`, `e.preventDefault`, `toggler.click`, `toggleTheme`, `window.addEventListener`, `window.removeEventListener`, `useRef`, `setActiveMediaAsset`, `setVideoEnabled`, `setProjectAssets`, `newAssets.find`, `setShowTour`, `Promise.resolve`, `treatmentFor`, `isSingleWordTemplate`, `useMemo`, `buildPages`, `pages.map`, `pages.find`, `safeAreaFor`, `positionCollides`, `pages.flatMap`, `page.heroIndices.map`, `searchQuery.trim`, `searchQuery.toLowerCase`, `groups.filter`, `g.some`, `w.text.toLowerCase().includes`, `w.text.toLowerCase`, `dimensions`, `['queued','processing','transcribing','extracting'].includes`, `project?.words.find`, `words.find`, `Math.min`, `Math.round`, `clamp`, `markEdit`, `p.words.map`, `p.words.some`, `setSettings`, `project?.exports?.at`, `project?.exports?.some`, `['queued','processing','rendering'].includes`, `words.map(w => Math.max(0.01, w.end - w.start)).sort`, `words.map`, `Math.ceil`, `Number`, `(i * majorInterval).toFixed`, `ticks.push`, `timecode`, `(t + (s * majorInterval) / (subCount + 1)).toFixed`, `requestAnimationFrame`, `timelineTrackRef.current.getBoundingClientRect`, `seek`, `cancelAnimationFrame`, `setIsScrubbing`, `e.stopPropagation`, `vp.getBoundingClientRect`, `Math.exp`, `(curZoom * scaleFactor).toFixed`, `setTimelineZoom`, `(gestureStartZoom * scale).toFixed`, `container.addEventListener`, `container.removeEventListener`, `(z * 1.35).toFixed`, `(z / 1.35).toFixed`, `clearTimeout`, `setNotice`, `supabase.auth.getUser().then`, `supabase.auth.getUser`, `setAccountEmail`, `setAccountName`, `String(data.user?.user_metadata?.full_name ?? '').trim`, `String`, `ensureMediaToken(id)
        .then`, `ensureMediaToken`, `setMediaTokenTick`, `mint`, `setInterval`, `clearInterval`, `fittedZoomFor`, `setTimeout`, `fetchLimits().then(setLimits).catch`, `fetchLimits().then`, `fetchLimits`, `setLimits`, `refreshLimits`, `Promise.all`, `request`, `setHealth`, `setProjects`, `Array.isArray`, `check`, `setProject`, `notify`, `project?.exports?.find`, `['queued', 'processing', 'rendering'].includes`, `downloadedExportIdsRef.current.has`, `setActiveExportId`, `project.exports.find`, `downloadedExportIdsRef.current.add`, `setLastDownloadedExportId`, `document.createElement`, `mediaUrl`, `document.body.appendChild`, `link.click`, `document.body.removeChild`, `saveChain.current.catch(() => {}).then`, `saveChain.current.catch`, `setSaveStatus`, `JSON.stringify`, `flushSave().catch`, `flushSave`, `forgetMediaTokens`, `supabase?.auth.signOut`, `setHistory`, `h.slice`, `setFuture`, `setCanvasElements`, `setDirty`, `prev.map`, `prev.filter`, `setSelectedCanvasElementId`, `imageCacheRef.current.has`, `imageCacheRef.current.set`, `videoCacheRef.current.has`, `videoCacheRef.current.set`, `Date.now`, `Math.random().toString(36).slice`, `Math.random().toString`, `Math.random`, `canvasElements.find`, `preview.current?.getBoundingClientRect`, `setSnapGuideX`, `setSnapGuideY`, `handleUpdateCanvasElement`, `handle.includes`, `(origScale + delta * 0.005).toFixed`, `timelineTrackRef.current?.getBoundingClientRect`, `targetIds.has`, `p.words.findIndex`, `rangeIds.add`, `setSelectedWordIds`, `setSelectedWord`, `next.has`, `next.delete`, `next.add`, `Array.from`, `moveWordsToNewLine`, `p.words.filter`, `insertWord`, `handleInsertWord`, `appendWord`, `res.words.find`, `ensureValidIntervals`, `handleDeleteWords`, `group.map`, `splitLineAtWord`, `moveWordToPreviousLine`, `moveWordToNextLine`, `p.words.find`, `handleSplitLine`, `groupWords`, `oldGroup.map`, `newText.trim().split(/\s+/).filter`, `newText.trim().split`, `newText.trim`, `tokens.map`, `(newStart + i * durationPerWord).toFixed`, `(newStart + (i + 1) * durationPerWord - 0.005).toFixed`, `Math.random().toString(36).substring`, `p.words
      .filter(w => !oldGroupIds.has(w.id))
      .map`, `p.words
      .filter`, `oldGroupIds.has`, `Math.max(w.start + 0.03, newStart - 0.005).toFixed`, `(newEnd + 0.005).toFixed`, `Math.max(clampedStart + 0.03, w.end).toFixed`, `Math.max(0.04, newStart - 0.005).toFixed`, `Math.max(0, clampedEnd - (w.end - w.start)).toFixed`, `(clampedStart + Math.max(0.03, w.end - w.start)).toFixed`, `updatedWords.sort`, `(lastWord.end + 0.05).toFixed`, `(offsetStart + relStart).toFixed`, `(offsetStart + relEnd).toFixed`, `Math.max(0, Math.min(dur - 0.5, atTime)).toFixed`, `Math.min(dur, startTime + 2.0).toFixed`, `(startTime + i * durPerWord).toFixed`, `(startTime + (i + 1) * durPerWord - (i < tokens.length - 1 ? 0.005 : 0)).toFixed`, `newWords.map`, `p.words.filter(w => sourceWordIds.includes(w.id)).map`, `sourceWordIds.includes`, `validMovingIds.includes`, `targetGroup.filter`, `moveWordsToLine`, `updatedWords.find`, `p.words.find(w => w.id === validMovingIds[0])?.text.replace`, `handleDropWords`, `editingText.trim`, `setEditingWordId`, `selectedWordIds.has`, `e.currentTarget.getBoundingClientRect`, `setTimelinePopover`, `updateWords`, `updateWord`, `recase`, `projectRef.current?.words.find`, `timelinePopover.draftText.trim`, `(prevWord.end + 0.005).toFixed`, `(nextWord.start - 0.005).toFixed`, `(origStart + dt).toFixed`, `(origEnd - MIN_WORD_DURATION).toFixed`, `(origEnd + dt).toFixed`, `(origStart + MIN_WORD_DURATION).toFixed`, `setTimelineLiveTooltip`, `(currentEnd - currentStart).toFixed`, `latestProj.words.map`, `(origSplit + dt).toFixed`, `currentSplit.toFixed`, `(e.target as HTMLElement).closest`, `(word.end - word.start).toFixed`, `(maxEnd - wordDur).toFixed`, `(e.currentTarget as HTMLElement).getBoundingClientRect`, `Math.max(minStart, Math.min(maxStart, targetStart)).toFixed`, `(clampedStart + wordDur).toFixed`, `selectWord`, `(prevWord.end + 0.01).toFixed`, `(nextWord.start - 0.01).toFixed`, `currentGStart.toFixed`, `gIds.has`, `initialWords.find`, `s.toFixed`, `e.toFixed`, `currentGEnd.toFixed`, `(currentGEnd - currentGStart).toFixed`, `(init.start + clampedDt).toFixed`, `(init.end + clampedDt).toFixed`, `(gStart + clampedDt).toFixed`, `clampedDt.toFixed`, `mergeLines`, `(target.start + dur / 2).toFixed`, `p.words.flatMap`, `(mid - 0.005).toFixed`, `list.findIndex`, `(word[key] + delta).toFixed`, `clamped.toFixed`, `text.toUpperCase`, `text.toLowerCase`, `text.charAt(0).toUpperCase`, `text.charAt`, `text.slice(1).toLowerCase`, `text.slice`, `media.current.play().then`, `media.current.play`, `setPlaying`, `media.current?.pause`, `Number.isFinite`, `min.toFixed`, `max.toFixed`, `history.at`, `future.at`, `f.slice`, `setTime`, `media.current.pause`, `element.play().catch`, `element.play`, `player.getCurrentFrame`, `player.seekTo`, `canvas.current?.getContext`, `ctx.clearRect`, `drawKeyedMedia`, `videoCacheRef.current.get`, `imageCacheRef.current.get`, `e.key.toLowerCase`, `setShowCommandPalette`, `setModal`, `setCaptionToolsOpen`, `redo`, `undo`, `handleSplitAtCurrent`, `(e.target as HTMLElement)?.closest`, `handleDeleteCanvasElement`, `['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes`, `prev.find`, `(prevW.end + 0.005).toFixed`, `(nextW.start - 0.005).toFixed`, `(curW.start + step).toFixed`, `(curW.end + step).toFixed`, `(newS + curDur).toFixed`, `(newE - curDur).toFixed`, `handleDeleteWord`, `groups.findIndex`, `g.at`, `[...groups].reverse().find`, `[...groups].reverse`, `groups.find`, `togglePlay`, `speeds.indexOf`, `setPlaybackRate`, `setUploadProgress`, `upload`, `setShowSearchBar`, `list.filter`, `setImportAutoHighlight`, `setLanguagePrompt`, `setIsDraggingOver`, `e.dataTransfer.getData`, `JSON.parse`, `handleAddMediaToCanvas`, `importFile`, `setScript`, `setLanguage`, `deleteProject`, `setActiveNavPanel`, `setExporting`, `plainTranscript`, `csvTranscript`, `subtitleText`, `URL.createObjectURL`, `project.name.replace`, `a.click`, `URL.revokeObjectURL`, `format.toUpperCase`, `navigator.clipboard.writeText(text).then`, `navigator.clipboard.writeText`, `updateSettings`, `startTranscription`, `setAccountMenu`, `NAV_PANELS.map`, `projectAssets.find`, `handleSelectMediaForCanvas`, `retryTranscription`, `signOut`, `NAV_PANELS.find`, `preview.current?.requestFullscreen().catch`, `preview.current?.requestFullscreen`, `input.current?.click`, `setPreviewHover`, `frame.getBoundingClientRect`, `setDraggingCaption`, `setCaptionSnap`, `setCaptionPosition`, `snapToAnchor`, `option.label.toLowerCase`, `setThisLineOnly`, `project.words.some`, `safeArea.zones.map`, `canvasElements.map`, `handleStartDragCanvasElement`, `handleStartResizeCanvasElement`, `setGreenScreenTargetEl`, `handleTimelineTrackClick`, `setTimelineHover`, `wf.map`, `Math.pow`, `handleStartDragTimelineMedia`, `elStart.toFixed`, `elEnd.toFixed`, `(elEnd - elStart).toFixed`, `groups.map`, `g.map(w => w.text).join`, `g.map`, `startGroupTrim`, `heroWordIds.has`, `startWordDrag`, `handleWordContextMenu`, `startWordHandleDrag`, `startWordDividerDrag`, `startGroupDrag`, `timelineLiveTooltip.lines.map`, `setExportMode`, `setResolution`, `([24, 25, 30, 50, 60] as const).map`, `setExportFps`, `startExport`, `downloadTranscript`, `openProject`, `searchFindText.trim`, `project.words.findIndex`, `w.text.includes`, `searchFindText.toLowerCase`, `target.text.replace`, `searchFindText.replace`, `target.start.toFixed`, `project.words.filter`, `replaceAllOccurrences`, `accountButtonRef.current?.focus`, `(accountName || accountEmail)[0].toUpperCase`, `calculatePopoverPosition`, `setWordHighlight`, `applyTimelineWordCase`, `React.useState`, `React.useEffect`, `supabase.auth.getSession().then`, `supabase.auth.getSession`, `rememberSession`, `setSession`, `setReady`, `supabase.auth.onAuthStateChange`, `setRecovering`, `subscription.subscription.unsubscribe`, `createRoot(document.getElementById('root')!).render`, `createRoot`, `document.getElementById`
- **External services:** Configured project API via api.ts
- **Data structures:** `EditState`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** BOL-05, BOL-07, BOL-09, BOL-10, BOL-15, BOL-19, BOL-25, BOL-27

## `src/registry/magicui/animated-theme-toggler.tsx`

- **File type:** .tsx
- **Line count:** 357
- **Responsibility:** Theme control with view-transition animation and temporary CSS properties.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `TransitionVariant`:9, `AnimatedThemeTogglerProps`:18, `polygonCollapsed`:32, `getThemeTransitionClipPaths`:41, `toX`:49, `toY`:50, `point`:51, `toRadius`:53, `starPolygon`:120, `AnimatedThemeToggler`:151, `updateTheme`:198, `applyTheme`:245, `cleanup`:288, `AnimatedThemeTogglerDemo`:351
- **Imported dependencies:** `react`; `lucide-react`; `react-dom`; `@/lib/utils`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `Array.from({ length: vertexCount }, () => point).join`, `Array.from`, `toX`, `toY`, `Math.hypot`, `point`, `toRadius`, `Math.max`, `polygonCollapsed`, `Math.sqrt`, `verts.push`, `Math.cos`, `Math.sin`, `verts.join`, `starPolygon`, `useState`, `localStorage.getItem`, `document.documentElement.classList.contains`, `document.documentElement.getAttribute`, `window.matchMedia`, `useRef`, `useCallback`, `activeAnimRef.current?.cancel`, `useEffect`, `cancelAnim`, `root.style.removeProperty`, `setInternalIsDark`, `updateTheme`, `observer.observe`, `observer.disconnect`, `button.getBoundingClientRect`, `root.setAttribute`, `root.classList.toggle`, `document.querySelector`, `meta.setAttribute`, `onThemeChange`, `localStorage.setItem`, `applyTheme`, `getThemeTransitionClipPaths`, `root.style.setProperty`, `(document as any).startViewTransition`, `flushSync`, `transition.finished.finally(cleanup).catch`, `transition.finished.finally`, `cleanup`, `ready
        .then`, `document.documentElement.animate`, `cn`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `TransitionVariant`, `AnimatedThemeTogglerProps`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/remotion/CaptionPage.tsx`

- **File type:** .tsx
- **Line count:** 354
- **Responsibility:** Template page layout and hero/row/kinetic composition.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `Props`:10, `Box`:19, `useRowMeasure`:28, `set`:39, `rgba`:43, `fontStack`:65, `CaptionPage`:68, `enterFrameFor`:105, `applyCase`:120, `renderWord`:131
- **Imported dependencies:** `react`; `remotion`; `./theme`; `./treatments`; `./CaptionWord`; `../lib/pages`; `../lib/types`; `../lib/caption-fonts`; `@fontsource/montserrat/800.css`; `@fontsource/montserrat/900.css`
- **Callers:** `src/remotion/CaptionTrack.tsx`
- **Callees:** `useRef`, `useState`, `Array.from`, `useLayoutEffect`, `setBoxes`, `prev.every`, `hex.replace`, `value.split('').map(c => c + c).join`, `value.split('').map`, `value.split`, `parseInt`, `full.slice`, `Math.min`, `Math.max`, `captionFonts.map`, `OFFERED_FONTS.has`, `useCurrentFrame`, `useVideoConfig`, `treatmentFor`, `useRowMeasure`, `Math.round`, `interpolate`, `pickEmoji`, `text.toLocaleUpperCase`, `text.toLocaleLowerCase`, `text.replace`, `c.toLocaleUpperCase`, `applyCase`, `enterFrameFor`, `fontStack`, `page.words.some`, `/[\u0900-\u097F]/.test`, `page.words.findIndex`, `heroRun`, `page.words.slice`, `set`, `prefix.map`, `renderWord`, `heroes.map`, `suffix.map`, `page.words.map`, `page.heroIndices.includes`, `rgba`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `Props`, `Box`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/remotion/CaptionTrack.tsx`

- **File type:** .tsx
- **Line count:** 88
- **Responsibility:** Time-based active page selection and bundled font imports.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `CaptionTrackProps`:32, `useFontsReady`:40, `CaptionTrack`:54
- **Imported dependencies:** `react`; `remotion`; `../lib/pages`; `./CaptionPage`; `../lib/types`; `../lib/caption-fonts`; `./treatments`; `@fontsource/dm-sans/400.css`; `@fontsource/dm-sans/700.css`; `@fontsource/space-grotesk/700.css`; `@fontsource/oswald/700.css`; `@fontsource/noto-sans-devanagari/700.css`; `@fontsource/montserrat/800.css`; `@fontsource/montserrat/900.css`; `@fontsource/montserrat/600-italic.css`; `@fontsource/montserrat/800-italic.css`; `@fontsource/stix-two-text/600.css`; `@fontsource/poppins/700.css`; `@fontsource/poppins/800.css`; `@fontsource/poppins/devanagari-700.css`; `@fontsource/mukta/700.css`; `@fontsource/mukta/800.css`; `@fontsource/anek-devanagari/700.css`; `@fontsource/anek-devanagari/800.css`; `@fontsource/anton/400.css`; `@fontsource/bebas-neue/400.css`
- **Callers:** `src/main.tsx`, `src/remotion/Root.tsx`
- **Callees:** `React.useState`, `delayRender`, `React.useEffect`, `localFacesReady
      .then(() => document.fonts.ready)
      .then`, `localFacesReady
      .then`, `continueRender`, `useVideoConfig`, `useFontsReady`, `treatmentFor`, `useMemo`, `buildPages`, `pages.map`, `Math.round`, `Math.max`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `CaptionTrackProps`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/remotion/CaptionWord.tsx`

- **File type:** .tsx
- **Line count:** 338
- **Responsibility:** Per-word typography, active/emphasis state and animated transforms.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `WordRole`:7, `Props`:9, `CaptionWord`:57
- **Imported dependencies:** `react`; `remotion`; `./theme`; `./treatments`; `../lib/captions`
- **Callers:** `src/remotion/CaptionPage.tsx`
- **Callees:** `useCurrentFrame`, `useVideoConfig`, `Math.max`, `Math.round`, `interpolate`, `spring`, `Math.sin`, `Math.min`, `(away * 100).toFixed`, `(100 - Math.ceil(typed * text.length) / Math.max(1, text.length) * 100).toFixed`, `Math.ceil`, `(x * 100).toFixed`, `[glow, shadow].filter(Boolean).join`, `[glow, shadow].filter`, `[
    blurTotal > 0.05 ? `blur(${blurTotal.toFixed(2)}px)` : '',
    glowFilter,
  ].filter`, `blurTotal.toFixed`, `enterX.toFixed`, `(rise + enterY + hop + exitY).toFixed`, `(scale * enterScale * exitScale).toFixed`, `enterRotateX.toFixed`, `(jitter + enterRotate + exitRotate).toFixed`, `(enterTracking + trackingAdd).toFixed`, `[underline && 'underline', strikethrough && 'line-through']
          .filter(Boolean).join`, `[underline && 'underline', strikethrough && 'line-through']
          .filter`, `getContrastColor`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `WordRole`, `Props`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/remotion/Root.tsx`

- **File type:** .tsx
- **Line count:** 55
- **Responsibility:** Remotion composition registration and metadata.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `CaptionsProps`:28, `RemotionRoot`:40
- **Imported dependencies:** `react`; `remotion`; `./CaptionTrack`; `../lib/types`
- **Callers:** `src/main.tsx`, `src/remotion/index.ts`
- **Callees:** `Math.round`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `CaptionsProps`
- **Side effects:** React state, DOM/media or API callbacks
- **Error handling:** UI callbacks/notifications and shared request handling; no universal error boundary
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/remotion/index.ts`

- **File type:** .ts
- **Line count:** 4
- **Responsibility:** Registers Remotion root for headless bundling.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** `remotion`; `./Root`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `registerRoot`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Word, Settings, Project and callback props
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/remotion/theme.ts`

- **File type:** .ts
- **Line count:** 80
- **Responsibility:** Shared caption palette/type/layout theme constants.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** `remotion`
- **Callers:** `src/remotion/CaptionPage.tsx`, `src/remotion/CaptionWord.tsx`
- **Callees:** `Easing.bezier`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Word, Settings, Project and callback props
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/remotion/treatments.ts`

- **File type:** .ts
- **Line count:** 181
- **Responsibility:** Template-specific typography, layout and animation settings.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `CaptionLayout`:9, `FontRole`:10, `Treatment`:12, `treatmentFor`:170
- **Imported dependencies:** No static imports extracted.
- **Callers:** `src/components/StylePanel.tsx`, `src/components/TextPanel.tsx`, `src/main.tsx`, `src/remotion/CaptionPage.tsx`, `src/remotion/CaptionTrack.tsx`, `src/remotion/CaptionWord.tsx`, `tests/captions.test.ts`
- **Callees:** `Object.assign`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `CaptionLayout`, `FontRole`, `Treatment`
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `src/styles.css`

- **File type:** .css
- **Line count:** 12274
- **Responsibility:** Complete editor/auth/panel/modal/timeline styles and responsive/theme overrides.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** `src/main.tsx`
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Type/build coverage for imported frontend; representative UI smoke only.
- **Known risks:** BOL-08, BOL-28

## `tests/captions.test.ts`

- **File type:** .ts
- **Line count:** 1708
- **Responsibility:** Node behavior and source-contract regression tests;99 executed.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `word`:18, `breakAfter`:22, `project`:23, `mk`:525, `mk`:536, `mk`:579, `mk`:588, `mk`:599, `mk`:608, `mk`:616, `editorSource`:837, `flat`:857, `mk`:872, `tagged`:1192
- **Imported dependencies:** `node:test`; `node:fs`; `node:assert/strict`; `@napi-rs/canvas`; `../src/lib/captions.ts`; `../src/lib/pages.ts`; `../src/lib/safe-area.ts`; `../src/remotion/treatments.ts`; `../src/lib/types.ts`; `../src/lib/utils.ts`; `../server/render.ts`; `../server/remotion-captions.ts`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `validateRenderProject`, `test`, `word`, `breakAfter`, `groupWords`, `assert.ok`, `groups.every`, `assert.deepEqual`, `groups[0].map`, `groups.at(-1)!.map`, `groups.at`, `groupWords([word('नमस्ते।', 0, .5), word('दोस्तों', .5, 1)], 4).map`, `dimensions`, `assert.equal`, `Math.abs`, `subtitleText`, `templates.some`, `groups[1].map`, `assert.throws`, `project`, `ffmpegArguments`, `green.includes`, `green.indexOf`, `green.filter`, `burned.includes`, `burned[burned.indexOf('-filter_complex') + 1].includes`, `burned.indexOf`, `audio.includes`, `assert.doesNotThrow`, `args.includes`, `args.indexOf`, `getContrastColor`, `insertWord`, `appendWord`, `appendRes.words.at`, `splitLineAtWord`, `g2[0].map`, `g2[1].map`, `mergeLines`, `moveWordToNextLine`, `moveWordToPreviousLine`, `initialGroups[0].map`, `initialGroups[1].map`, `moveWordToLine`, `groups1[0].map`, `groups1[1].map`, `res1.find`, `w.text.startsWith`, `groups2[0].map`, `res2.find`, `groups3[0].map`, `res3.find`, `replaceAllOccurrences`, `moveWordsToLine`, `gInit[0].map`, `gInit[1].map`, `gAfter[0].map`, `gAfter[1].map`, `autoDetectHighlights`, `highlighted.find`, `srt.includes`, `vtt.startsWith`, `vtt.includes`, `import`, `hexToRgb`, `rgbToHex`, `processChromaKeyData`, `buildPages`, `pages.find`, `groupWords(words, 5).map`, `g.map`, `mk`, `treatmentFor`, `['stack', 'rows', 'single'].includes`, `heroRun`, `nudged[1].words.some`, `kept[0].words.at`, `JSON.parse`, `readFileSync`, `Object.keys`, `declared.add`, `[...declared].filter`, `componentSource.includes`, `Object.prototype.hasOwnProperty.call`, `args24.indexOf`, `args24.some`, `arg.includes`, `args50.indexOf`, `args50.some`, `assert.rejects`, `renderCaptionVideo`, `templates.filter`, `t.id.startsWith`, `mogrt.map`, `enters.every`, `x.id.startsWith`, `source.match`, `/isHero/.test`, `/accented\s*\n?\s*\? accent/.test`, `/settings\.accentSecondary/.test`, `/textColor: color, accent: color/.test`, `dflt.indexOf`, `chosen.indexOf`, `templates.map`, `templates.slice(0, 9).map`, `templates.slice`, `firstNine.every`, `id.startsWith`, `firstNine.join`, `templates.slice(9).some`, `id.id.startsWith`, `source.slice`, `source.indexOf`, `block.match`, `/Devanagari/.test`, `['../src/main.tsx', '../src/components/StylePanel.tsx', '../src/components/TextPanel.tsx']
  .map`, `editorSource`, `new RegExp(`updateSettings\\(\\{[^}]*${field}`).test`, `/isStackedTemplate && \(/.test`, `/layout === 'stack'/.test`, `flat`, `/alwaysPromote = layout !== 'rows'/.test`, `editor.slice`, `editor.indexOf`, `/updateSettings\(\{ align: option\.align \}\)/.test`, `/{ y: CAPTION_ANCHORS_Y\[0\]/.test`, `/const grabX = /.test`, `/- grabX\)/.test`, `/Math\.abs\(ev\.clientX - startX\) < 3/.test`, `/Math\.round\(v \/ 5\) \* 5/.test`, `/const CAPTION_ANCHORS_X = \[15, 50, 85\]/.test`, `/const CAPTION_ANCHORS_Y = \[15, 50, 82\]/.test`, `/if \(anchor\.posX === nx && anchor\.posY === ny\) return;/.test`, `/<WordInspector\b/.test`, `/timeline-word-popover/.test`, `/heroRun\(page\)\s*\?\?/.test`, `/const isStack = stackRun !== null/.test`, `/else if \(!data\.session\) go\('sent'\);/.test`, `/updateSettings\(\{ textCase: option\.id, uppercase: option\.id === 'upper' \}\)/.test`, `/updateSettings\(\{ uppercase: e\.target\.checked \}\)/.test`, `/pro-badge/.test`, `css.match`, `/src=\{busy \? undefined :/.test`, `/if \(!media\.current\.paused\) media\.current\.pause\(\);/.test`, `/\.then\(\(\) => \{\n\s*setPlaying\(true\);/.test`, `/error\?\.name === 'AbortError'\) return;/.test`, `/MediaError\.MEDIA_ERR_SRC_NOT_SUPPORTED/.test`, `/if \(!token\) return '';/.test`, `/\|\| undefined\)\}/.test`, `/\|\| undefined/.test`, `/await ensureMediaToken\(project\.id\);/.test`, `shipped.some`, `/if \(typeof process !== 'undefined'\) \{\n\s*return process\.env\?\.BOL_LOCAL_FONTS === '1';/.test`, `/envVariables: process\.env\.BOL_LOCAL_FONTS === '1' \? \{ BOL_LOCAL_FONTS: '1' \} : \{\}/.test`, `/import\.meta as \{ env\?: \{ DEV\?: boolean \} \}/.test`, `/new FontFace\('Satoshi'/.test`, `/\.css'/.test`, `/apply: 'build'/.test`, `/dist\/fonts\/satoshi/.test`, `/staticFile\(`fonts\/satoshi\//.test`, `f.family.toLowerCase().replace`, `f.family.toLowerCase`, `track.includes`, `/OFFERED_FONTS\.has\(custom\)/.test`, `Array.from`, `Math.max`, `pages.map`, `buildPages(words, 3).map`, `text.split`, `parts.forEach`, `words.push`, `Number`, `(from + i * step).toFixed`, `(from + (i + 1) * step - 0.01).toFixed`, `buildPages(words, 7).map`, `p.words.map(w => w.text).join`, `p.words.map`, `flat.every`, `flat.map`, `page.heroIndices.map`, `spec.zones.find`, `spec.zones.every`, `positionCollides`, `SAFE_AREAS.reels.zones.find`, `SAFE_AREAS.shorts.zones.find`, `safeAreaFor`, `tagged`, `pickEmoji`, `page.heroIndices.includes`, `[tagged('the', 0, .2), tagged('money', .25, .6, '💰', 1), tagged('story', .65, .9)]
      .map`, `createOrderedDispatcher`, `setTimeout`, `seen.push`, `Promise.all`, `order.map`, `dispatcher.push`, `Buffer.from`, `dispatcher.settle`, `Buffer.alloc`, `words.map`, `manual[0].heroIndices.map`, `panel.includes`, `assert.match`, `words.find`, `moveWordsToNewLine`, `groupWords(split, 5).map`, `lines.some`, `JSON.stringify`, `groupWords(top, 5)[0].map`, `Object.values(treatments).map`, `Object.values`, `Math.min`, `panel.match`, `first.words.map`, `editor.includes`, `kept[0].heroIndices.map`, `formatBytes`, `formatMinutes`, `framed.add`, `body.includes`, `body.indexOf`, `/\btry\s*\{/.test`, `modals.includes`, `shortcuts.includes`, `viteConfig.includes`, `plainTranscript`, `transcript.includes`, `tour.includes`, `styles.includes`, `csvTranscript`, `csv.trim().split`, `csv.trim`, `lines[1].includes`, `lines[2].includes`, `captionsPanel.includes`, `palette.includes`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Executed suite file; see testing-and-bugs.md
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `tests/test_backend.py`

- **File type:** .py
- **Line count:** 1615
- **Responsibility:** Python API/auth/media/postprocessing regression suite;87 executed,1 deliberately excluded.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `FakeQueue`:22, `client`:31, `project`:39, `word`:48, `audio_bytes`:53, `test_upload_valid_audio_persists_and_queues_once`:61, `test_upload_invalid_media_is_rejected_and_cleaned`:77, `test_empty_and_oversize_upload`:83, `test_invalid_word_edits_are_rejected_without_mutation`:96, `test_revision_conflict_and_partial_settings`:102, `test_video_layer_can_be_removed_without_removing_audio`:112, `test_invalid_settings`:125, `test_edit_and_retry_conflicts_during_transcription`:129, `test_exports_snapshot_before_later_edits`:138, `test_export_options_4k_and_custom_fps`:149, `test_concurrent_atomic_updates_keep_all_changes`:172, `test_restart_marks_interrupted_jobs_retryable`:183, `test_alignment_preserves_real_multiword_units`:192, `test_romanization_preserves_english_and_common_hindi`:202, `test_code_mixed_merge_keeps_english_words_in_latin_script`:209, `test_english_verifier_repairs_basic_words_without_translating_hindi`:225, `test_hinglish_specialist_tokens_keep_true_word_boundaries`:241, `test_emphasis_responds_to_measured_loudness`:252, `test_emphasis_boosts_hook_keywords_and_dampens_particles`:263, `test_silence_does_not_load_model_or_invent_words`:279, `test_malformed_project_id_is_not_a_path`:289, `test_documented_environment_names_take_precedence`:293, `test_audio_preview_preserves_stereo_source_quality`:301, `test_refine_word_boundaries_with_vad_trims_silence`:315, `test_asset_endpoints_flow`:348, `test_caption_defaults_are_shared_with_the_browser`:398, `test_backend_accepts_every_template_the_picker_offers`:418, `test_exports_default_to_60fps`:438, `test_caption_font_must_be_one_we_offer`:444, `test_api_key_gate_is_open_when_no_key_is_configured`:452, `test_api_key_gate_closes_when_a_key_is_configured`:458, `test_cors_does_not_default_to_every_origin`:482, `test_glossary_replaces_only_terms_the_creator_supplied`:489, `test_glossary_round_trips_through_the_api`:524, `test_a_word_may_carry_the_glossary_flag`:534, `test_vocal_isolation_is_opt_in_and_round_trips`:543, `test_vocal_isolation_declines_rather_than_degrading`:554, `test_vocal_isolation_separates_at_the_source_rate_not_the_16k_copy`:567, `test_export_length_cap_is_off_locally_and_refuses_up_front_when_set`:581, `test_words_per_line_is_clamped_to_the_shared_ceiling_not_rejected`:610, `test_explicit_line_breaks_survive_a_save`:628, `test_post_upload_language_choices_are_all_accepted`:657, `test_transcribe_request_saves_auto_highlight`:675, `test_emoji_matches_meaning_and_leaves_ordinary_words_alone`:686, `test_translation_moves_off_the_hinglish_specialist_and_forces_english_output`:717, `test_transcribe_accepts_the_translate_flag`:746, `test_deployed_requirements_match_the_local_ones`:753, `test_a_font_licensed_for_this_machine_is_accepted_only_when_configured`:786, `test_a_workspace_cannot_see_or_touch_another_ones_projects`:823, `accounts`:898, `test_the_signed_in_user_owns_what_they_upload`:930, `test_an_expired_token_says_so_and_an_invalid_one_says_nothing`:959, `test_a_token_signed_with_the_public_key_as_a_secret_is_refused`:983, `test_a_media_token_opens_one_clip_and_nothing_else`:1019, `test_the_file_the_browser_streams_is_not_rewritten_underneath_it`:1057, `test_a_transcript_with_no_speech_says_so_rather_than_reporting_success`:1090, `test_a_media_token_outlasts_an_editing_session`:1116, `test_an_expired_or_tampered_media_token_is_refused`:1140, `test_gradio_still_boots_without_a_token`:1171, `test_the_local_checkout_still_needs_no_account`:1184, `test_an_unowned_project_belongs_to_everyone_or_to_nobody`:1198, `test_the_space_entrypoint_actually_enforces_the_gate`:1228, `test_the_key_guards_our_api_and_nothing_else`:1306, `test_an_unlisted_origin_loses_its_cors_header_even_if_something_else_set_it`:1324, `test_an_upload_costs_about_its_own_size_on_disk`:1366, `test_upload_only_starts_recognition_when_asked`:1400, `test_deleting_a_project_removes_its_files_and_frees_the_space_they_took`:1430, `test_a_project_the_worker_is_still_writing_to_refuses_to_be_deleted`:1461, `test_a_clip_can_be_deleted_the_moment_it_is_uploaded`:1493, `test_another_workspace_cannot_delete_your_project`:1517, `test_storage_usage_counts_your_own_projects_and_not_the_speech_model`:1535, `test_an_audio_project_saves_although_it_has_no_video_layer`:1567, `test_cancel_transcription_endpoint_and_job_abortion`:1602, `submit`:26, `increment`:173, `Result`:242, `word`:495, `packages`:765, `save`:801, `upload`:832, `OneKey`:913, `sign`:924, `OneKey`:1267, `reflect`:1346, `get`:914, `get`:1268
- **Imported dependencies:** `import copy`; `import re`; `from pathlib import Path`; `import io`; `import json`; `import subprocess`; `import uuid`; `from concurrent.futures import ThreadPoolExecutor`; `import numpy as np`; `import pytest`; `from fastapi.testclient import TestClient`; `from scipy.io import wavfile`; `from server import app as backend`; `from server import emoji as emoji_module`; `from server import transcription as transcription_module`; `from server.transcription import _sherpa_tokens_to_words, merge_code_mixed_english, model_config, normalize_words, refine_word_boundaries_with_vad, romanize_hinglish, suggest_emphasis, transcribe`; `import json`; `from pathlib import Path`; `import json`; `from pathlib import Path`; `from server.glossary import apply_glossary`; `from pathlib import Path`; `from server import denoise`; `from server import denoise`; `from cryptography.hazmat.primitives.asymmetric import ec`; `import time`; `import jwt`; `import jwt as pyjwt`; `from server import auth as auth_module`; `import base64`; `import hashlib`; `import hmac`; `import json as json_module`; `from cryptography.hazmat.primitives import serialization`; `from server import auth as auth_module`; `import base64`; `import json as json_module`; `from server import auth as auth_module`; `import importlib`; `import server.auth as auth_module`; `import server.app as server_module`; `import jwt as pyjwt`; `from fastapi import FastAPI`; `from fastapi.responses import JSONResponse`; `from starlette.middleware.base import BaseHTTPMiddleware`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `'because these words belong to the same thing and nothing else'.split`, `'the most important thing is your time and your brain'.split`, `(Path(__file__).resolve().parent.parent / 'src' / 'lib' / 'caption-defaults.json').read_text`, `(Path(__file__).resolve().parent.parent / 'src' / 'lib' / 'caption-templates.json').read_text`, `(backend.DATA_DIR / mine).exists`, `(backend.DATA_DIR / project['id']).exists`, `(backend.DATA_DIR / project_id).exists`, `(directory / 'audio.wav').unlink`, `(directory / 'export-old.mp4').write_bytes`, `(model / 'encoder.int8.onnx').write_bytes`, `(np.sin(2 * np.pi * 220 * np.arange(rate) / rate) * 8000).astype`, `FakeQueue`, `FastAPI`, `OneKey`, `Path`, `Path(__file__).resolve`, `Result`, `TestClient`, `ThreadPoolExecutor`, `_auth_key`, `_sherpa_tokens_to_words`, `_token`, `all`, `any`, `apply_glossary`, `audio_bytes`, `auth_module.AuthError`, `auth_module._b64`, `auth_module._unb64`, `b64`, `backend.DATA_DIR.iterdir`, `backend.ExportRequest`, `backend.Settings`, `backend.Settings().model_dump`, `backend.Word`, `backend._is_guarded`, `backend.load_project`, `backend.owns`, `backend.prepare_media`, `backend.project_dir`, `backend.project_dir(project['id']).glob`, `backend.transcription_job`, `backend.update_project`, `backend.validate_word_intervals`, `backend.write_project`, `base64.urlsafe_b64encode`, `base64.urlsafe_b64encode(raw).rstrip`, `buffer.getvalue`, `busy.json`, `call_next`, `client.delete`, `client.get`, `client.get('/api/limits').json`, `client.get('/api/limits', headers={'X-Bol-Owner': 'alice'}).json`, `client.get('/api/limits', headers={'X-Bol-Owner': 'carol'}).json`, `client.get('/api/projects').json`, `client.get('/api/projects', headers=owner).json`, `client.get('/api/projects', headers={'X-Bol-Owner': 'alice'}).json`, `client.get('/api/projects', headers={'X-Bol-Owner': owner}).json`, `client.get(f"/api/projects/{project['id']}").json`, `client.get(f'/api/projects/{project_id}').json`, `client.get(f'/api/projects/{theirs}', headers={'X-Bol-Owner': 'bob'}).json`, `client.get(url).json`, `client.patch`, `client.patch(url, json={'settings': {'wordsPerLine': 4}}).json`, `client.patch(url, json={'videoEnabled': True}).json`, `client.post`, `client.post('/api/projects', files={'file': ('clip.mp4', audio_bytes(), 'audio/wav')}).json`, `client.post('/api/projects', files={'file': ('clip.wav', audio_bytes(), 'audio/wav')}).json`, `client.post('/api/projects', files={'file': ('clip.wav', audio_bytes(), 'audio/wav')}, headers=signed_in).json`, `client.post('/api/projects', files={'file': ('clip.wav', audio_bytes(), 'audio/wav')}, headers={'X-Bol-Owner': 'alice'}).json`, `client.post(f'/api/projects/{mine}/media-token', headers=signed_in).json`, `client.post(f'/api/projects/{project_id}/media-token', headers=signed_in).json`, `copy.deepcopy`, `created.json`, `data['message'].lower`, `denoise.isolate_vocals_from_source`, `directory.exists`, `directory.iterdir`, `ec.SECP256R1`, `ec.generate_private_key`, `emoji_module.available`, `emoji_module.suggest_emoji`, `executor.map`, `expired.json`, `f.is_file`, `f.stat`, `forged.decode`, `hasattr`, `hmac.new`, `hmac.new(public_pem, signing_input, hashlib.sha256).digest`, `importlib.import_module`, `importlib.reload`, `inner.add_middleware`, `inner.get`, `int`, `io.BytesIO`, `job`, `json.loads`, `json_module.dumps`, `json_module.dumps(claims, separators=(',', ':')).encode`, `json_module.dumps(value, separators=(',', ':')).encode`, `json_module.loads`, `jwt.encode`, `len`, `line.split`, `line.split(maxsplit=1)[1].strip`, `line.startswith`, `line.strip`, `list`, `listed`, `listed.json`, `merge_code_mixed_english`, `minted.json`, `missing.json`, `model.mkdir`, `model_config`, `monkeypatch.delenv`, `monkeypatch.setattr`, `monkeypatch.setenv`, `names.add`, `normalize_words`, `np.arange`, `np.concatenate`, `np.sin`, `np.sin(2 * np.pi * 180 * np.arange(rate // 2) / rate).astype`, `np.zeros`, `other.json`, `ours.headers.get`, `p.update`, `p['exports'].append`, `p['exports'][0].update`, `packages`, `part`, `patched.json`, `path.read_text`, `path.read_text().splitlines`, `path.write_bytes`, `plan`, `private_key.public_key`, `private_key.public_key().public_bytes`, `progress.append`, `project.get`, `pyjwt.PyJWK.from_json`, `pyjwt.algorithms.ECAlgorithm.to_jwk`, `pytest.importorskip`, `pytest.mark.parametrize`, `pytest.raises`, `pytest.skip`, `range`, `re.split`, `re.split('[<>=;\\[ ]', line)[0].lower`, `refine_word_boundaries_with_vad`, `refused.json`, `rendering.json`, `rendering.json()['detail'].lower`, `request.headers.get`, `res.json`, `res_dup.json`, `res_list.json`, `res_wav.json`, `resp.json`, `response.json`, `response.json().get`, `response.json()['detail'].lower`, `romanize_hinglish`, `save`, `self.jobs.append`, `set`, `sign`, `sorted`, `source.stat`, `started.json`, `str`, `subprocess.run`, `suggest_emphasis`, `sum`, `time.time`, `token.partition`, `transcribe`, `turned_on.json`, `upload`, `uuid.uuid4`, `value.get`, `value.update`, `w.get`, `waiting.json`, `wavfile.read`, `wavfile.write`, `word`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** `FakeQueue`, `Result`, `OneKey`, `OneKey`
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Executed suite file; see testing-and-bugs.md
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `tsconfig.json`

- **File type:** .json
- **Line count:** 14
- **Responsibility:** TypeScript target/module/type-check configuration.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `vercel.json`

- **File type:** .json
- **Line count:** 16
- **Responsibility:** Frontend hosting/rewrite configuration; worker is external.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** No named code declarations; declarative data/configuration/styles.
- **Imported dependencies:** No static imports extracted.
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** No call expressions; declarative content.
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.

## `vite.config.ts`

- **File type:** .ts
- **Line count:** 64
- **Responsibility:** React build, vendor chunks, proxy and local-only font exclusion plugin.
- **Audit status:** REVIEWED
- **Exported/public and named symbols:** `excludeLocalFonts`:19
- **Imported dependencies:** `vite`; `@vitejs/plugin-react`; `fs`; `path`
- **Callers:** Framework/CLI entry point or data/document consumer; see responsibility.
- **Callees:** `path.resolve`, `fs.rmSync`, `fs.existsSync`, `fs.readdirSync`, `fs.rmdirSync`, `defineConfig`, `react`, `excludeLocalFonts`, `id.includes`
- **External services:** No direct external-service integration identified; dependencies may perform their documented work.
- **Data structures:** Module-specific configuration/media/JSON values; see responsibility and named symbols.
- **Side effects:** Pure data/helpers or configuration consumed by build/runtime; exports and call expressions above identify boundaries.
- **Error handling:** Caller-managed exceptions or declarative configuration; no independent recovery layer.
- **Test coverage:** Reviewed; no targeted runtime execution except explicitly recorded build/setup paths.
- **Known risks:** No separate confirmed issue assigned; see relevant phase report and unverified scenarios.
