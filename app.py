"""Hugging Face Spaces Entrypoint for Bol Studio Backend."""
from __future__ import annotations

import os
import subprocess
import sys
import threading
from pathlib import Path

# 0. ZeroGPU startup requirement - must be defined immediately
import spaces

@spaces.GPU(duration=120)
def gpu_worker():
    """Satisfies Hugging Face ZeroGPU startup check."""
    return None

def _background_init():
    """Download model and install node dependencies asynchronously so startup is instant."""
    model_file = Path("data/models/hinglish-apex/hi-hinglish-apex/encoder.int8.onnx")
    if not model_file.is_file():
        print("Preparing Roman-Hinglish Apex model in background...")
        try:
            subprocess.run([sys.executable, "scripts/prepare-hinglish-model.py", "--variant", "apex"], check=True)
            print("Roman-Hinglish Apex model ready.")
        except Exception as e:
            print(f"Warning: Apex model preparation failed: {e}")

    node_modules = Path("node_modules")
    if not node_modules.is_dir():
        print("Installing Node dependencies in background...")
        try:
            subprocess.run(["npm", "install", "--omit=dev"], check=True)
            print("Node dependencies ready.")
        except Exception as e:
            print(f"Warning: npm install failed: {e}")

# Start initialization in background so server boots in <1s
threading.Thread(target=_background_init, daemon=True).start()

import gradio as gr
from starlette.requests import Request
from starlette.responses import Response
from server.app import app, DATA_DIR

DATA_DIR.mkdir(parents=True, exist_ok=True)

# 1. Create the Gradio status interface
with gr.Blocks(title="Bol Studio API Engine") as demo:
    gr.Markdown(
        """
        # 🎙️ Bol Studio Backend Engine
        
        This Hugging Face Space powers **AI Hinglish speech transcription** and **video rendering** for [Bol Studio](https://bol-studio.vercel.app).
        
        ### 🟢 Status: Online & Active
        - **API Base URL**: `https://n3owise-bol-studio-backend.hf.space/api/`
        - **Transcription Engine**: Sherpa-ONNX Roman-Hinglish Specialist + Whisper fallback
        - **Video Processing**: Native FFmpeg + Canvas Motion Renderer
        """
    )
    status_btn = gr.Button("GPU Check", visible=False)
    status_btn.click(fn=gpu_worker)

# 2. Add CORS headers to all responses so bol-studio.vercel.app can connect smoothly
@demo.app.middleware("http")
async def add_cors_header(request: Request, call_next):
    if request.method == "OPTIONS":
        response = Response(status_code=200)
    else:
        response = await call_next(request)
    origin = request.headers.get("origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# 3. Mount all /api routes from FastAPI directly onto demo.app
demo.app.include_router(app.router)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    # demo.launch() triggers spaces.zero startup report and starts the Uvicorn server on port 7860
    demo.launch(_app=demo.app, server_name="0.0.0.0", server_port=port, ssr_mode=False)
