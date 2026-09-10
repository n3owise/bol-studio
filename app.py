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
    model_file = Path("data/models/hinglish-swift/hi-hinglish-swift/encoder.int8.onnx")
    if not model_file.is_file():
        print("Preparing Roman-Hinglish model in background...")
        try:
            subprocess.run([sys.executable, "scripts/prepare-hinglish-model.py", "--variant", "swift"], check=True)
            print("Roman-Hinglish model ready.")
        except Exception as e:
            print(f"Warning: Model preparation failed: {e}")

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
import uvicorn
from server.app import app, DATA_DIR

DATA_DIR.mkdir(parents=True, exist_ok=True)

# 1. Create the Gradio status interface
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
    status_btn = gr.Button("GPU Check", visible=False)
    status_btn.click(fn=gpu_worker)
    demo.load(fn=gpu_worker)

# 2. Mount Gradio onto the FastAPI app (ssr_mode=False disables Node proxy)
app = gr.mount_gradio_app(app, demo, path="/", ssr_mode=False)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
