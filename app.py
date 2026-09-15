"""Hugging Face Spaces entrypoint for the Bol Studio backend.

The important thing here is which object ends up serving requests.

This used to build a Gradio app and call `demo.app.include_router(app.router)`,
which copies the routes off the FastAPI app and none of its middleware. Every
protection in server/app.py is middleware — the API key gate, the per-workspace
ownership check, the CORS allowlist — so all three were silently absent on the
deployment while the endpoints themselves worked perfectly. A Space deployed
that way is an open, unscoped backend that looks correct from the outside.

Gradio has to own the server here: a Gradio-SDK Space runs `demo.launch()`, and
ZeroGPU's wrapper already holds port 7860, so starting our own uvicorn beside it
fails to bind. Handing our FastAPI app to `demo.launch(_app=...)` does not work
either — Gradio 6 requires its own App subclass there.

The app that serves has to be built here, because `demo.launch()` calls
`App.create_app()` internally and discards whatever is hanging off `demo.app`.
Attaching the routes and middleware to `demo.app` therefore attached them to an
object that was thrown away before the first request: the deployment answered
Gradio's own routes and 404ed every one of ours.

So the Gradio App is constructed once, given our routes and our middleware, and
handed back to `launch` — which accepts it because it is a real Gradio App,
unlike the plain FastAPI app it refuses.
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

from server.app import (ALLOWED_ORIGINS, API_KEY, DATA_DIR, MAX_EXPORT_SECONDS, app,
                        install_middleware)

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

from gradio.routes import App as GradioApp

# Build it once, and keep a reference: `demo.app` is a different object that
# launch() replaces, so anything registered there never serves a request.
#
# `parent_app` is how Gradio is told to keep its hands off CORS. Its
# CustomCORSMiddleware reflects whatever Origin it is sent unless the parent app
# already has a CORSMiddleware, and it looks for that on this argument alone.
# Without it the deployment happily told https://evil.example it was allowed,
# overruling our allowlist from inside.
application = GradioApp.create_app(demo, parent_app=app)
# The routes, and then the protections that guard them. The second call is the
# one that was missing: include_router copies routes and no middleware, so the
# Space ran open and unscoped while every endpoint behaved perfectly.
application.include_router(app.router)
install_middleware(application)

if __name__ == "__main__":
    demo.launch(_app=application, server_name="0.0.0.0",
                server_port=int(os.getenv("PORT", 7860)), ssr_mode=False)
