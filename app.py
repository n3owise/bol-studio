"""Hugging Face Spaces Entrypoint for Bol Studio Backend."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

# 0. ZeroGPU startup requirement
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
import uvicorn
from server.app import app, DATA_DIR

DATA_DIR.mkdir(parents=True, exist_ok=True)

# 3. Create the Gradio status interface
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

# 4. Mount Gradio onto the FastAPI app (with ssr_mode=False so Node proxy does not conflict with port 7860)
app = gr.mount_gradio_app(app, demo, path="/", ssr_mode=False)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
