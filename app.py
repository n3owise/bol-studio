"""Hugging Face Spaces Entrypoint for Bol Studio Backend."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

try:
    import spaces

    @spaces.GPU(duration=120)
    def gpu_worker():
        """Satisfies Hugging Face ZeroGPU startup check."""
        return True
except ImportError:
    pass

# 1. Ensure the Roman-Hinglish model is downloaded
MODEL_FILE = Path("data/models/hinglish-swift/hi-hinglish-swift/encoder.int8.onnx")
if not MODEL_FILE.is_file():
    print("Preparing Roman-Hinglish model for Bol Studio...")
    try:
        subprocess.run([sys.executable, "scripts/prepare-hinglish-model.py", "--variant", "swift"], check=True)
    except Exception as e:
        print(f"Warning: Model preparation failed: {e}")

# 2. Ensure Node dependencies are installed for canvas video rendering
NODE_MODULES = Path("node_modules")
if not NODE_MODULES.is_dir():
    print("Installing Node dependencies for canvas rendering...")
    try:
        subprocess.run(["npm", "install", "--omit=dev"], check=True)
    except Exception as e:
        print(f"Warning: npm install failed: {e}")

import gradio as gr
from fastapi.middleware.cors import CORSMiddleware
from server.app import app, DATA_DIR

DATA_DIR.mkdir(parents=True, exist_ok=True)

# 3. Create the Gradio interface
with gr.Blocks(title="Bol Studio API Engine") as demo:
    gr.Markdown(
        """
        # 🎙️ Bol Studio Backend Engine
        
        This Hugging Face Space powers **AI Hinglish speech transcription** and **video rendering** for [Bol Studio](https://vercel.com).
        
        ### 🟢 Status: Online & Active
        - **API Base URL**: `https://n3owise-bol-studio-backend.hf.space/api/`
        - **Transcription Engine**: Sherpa-ONNX Roman-Hinglish Specialist + Whisper fallback
        - **Video Processing**: Native FFmpeg + Canvas Motion Renderer
        """
    )

# 4. Mount all FastAPI /api routes onto demo.app
for r in app.routes:
    if hasattr(r, "path") and r.path.startswith("/api"):
        demo.app.routes.append(r)

# 5. Enable universal CORS for Vercel
demo.app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

if __name__ == "__main__":
    demo.launch(ssr_mode=False)
