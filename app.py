"""Hugging Face Spaces entrypoint for the Bol Studio backend.

The important thing here is which object ends up serving requests.

This used to build a Gradio app and call `demo.app.include_router(app.router)`,
which copies the routes off the FastAPI app and none of its middleware. Every
protection in server/app.py is middleware — the API key gate, the per-workspace
ownership check, the CORS allowlist — so all three were silently absent on the
deployment while the endpoints themselves worked perfectly. A Space deployed
that way is an open, unscoped backend that looks correct from the outside.

So the FastAPI app is the application, and Gradio is mounted onto it as the
landing page. Requests reach the middleware stack first, exactly as they do
locally and in the tests.
"""
from __future__ import annotations

import os
import subprocess
import sys
import threading
from pathlib import Path

# ZeroGPU inspects the module for this at startup, so it is defined before
# anything else runs. Nothing here needs a GPU: transcription is ONNX on CPU and
# exports are headless Chromium plus libx264. It exists to satisfy the check.
import spaces


@spaces.GPU(duration=120)
def gpu_worker():
    """Satisfies the Hugging Face ZeroGPU startup check."""
    return None


def _background_init():
    """Fetch the model and Node dependencies after the server is already up.

    Doing this at import time would leave the Space showing as starting for
    several minutes; doing it in a thread means the health check answers
    immediately and the first transcription waits instead.
    """
    model_file = Path("data/models/hinglish-apex/hi-hinglish-apex/encoder.int8.onnx")
    if not model_file.is_file():
        print("Preparing Roman-Hinglish Apex model in background...", flush=True)
        try:
            subprocess.run([sys.executable, "scripts/prepare-hinglish-model.py", "--variant", "apex"], check=True)
            print("Roman-Hinglish Apex model ready.", flush=True)
        except Exception as error:
            print(f"Warning: Apex model preparation failed: {error}", flush=True)

    if not Path("node_modules").is_dir():
        print("Installing Node dependencies in background...", flush=True)
        try:
            subprocess.run(["npm", "install", "--omit=dev"], check=True)
            print("Node dependencies ready.", flush=True)
        except Exception as error:
            print(f"Warning: npm install failed: {error}", flush=True)


threading.Thread(target=_background_init, daemon=True).start()

import gradio as gr

from server.app import ALLOWED_ORIGINS, API_KEY, DATA_DIR, MAX_EXPORT_SECONDS, app

DATA_DIR.mkdir(parents=True, exist_ok=True)

_gated = "on" if API_KEY else "OFF — anyone with this URL can use the API"
_origins = ", ".join(ALLOWED_ORIGINS) if ALLOWED_ORIGINS else "same-origin only"
_cap = f"{int(MAX_EXPORT_SECONDS // 60)} min" if MAX_EXPORT_SECONDS else "no limit"

with gr.Blocks(title="Bol Studio API Engine") as demo:
    gr.Markdown(
        f"""
        # 🎙️ Bol Studio Backend

        Hinglish speech transcription and caption rendering.

        - **API base**: `/api/`
        - **Transcription**: Sherpa-ONNX Roman-Hinglish specialist, Whisper fallback
        - **Rendering**: Remotion frames composited with FFmpeg

        ### Configuration

        - **API key**: {_gated}
        - **Allowed origins**: {_origins}
        - **Export length cap**: {_cap}

        The configuration is printed here because the three things most worth
        getting wrong are invisible otherwise — a deployment with the gate off
        behaves exactly like one with it on until someone finds it.
        """
    )
    status_btn = gr.Button("GPU Check", visible=False)
    status_btn.click(fn=gpu_worker)

# Gradio hangs off the FastAPI app, not the other way round, so every request
# passes through the middleware in server/app.py before it reaches a route.
application = gr.mount_gradio_app(app, demo, path="/")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(application, host="0.0.0.0", port=int(os.getenv("PORT", 7860)))
