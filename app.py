"""Hugging Face Spaces Entrypoint for Bol Studio Backend."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

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

# 3. Import the FastAPI application
import uvicorn
from server.app import app

# 4. Mount a clean Gradio status dashboard
try:
    import gradio as gr

    with gr.Blocks(title="Bol Studio API Engine") as demo:
        gr.Markdown(
            """
            # 🎙️ Bol Studio Backend Engine
            
            This Hugging Face Space powers the **AI Hinglish speech transcription** and **video rendering** for Bol Studio on Vercel.
            
            ### 🟢 Status: Online & Active
            - **Transcription Engine**: Sherpa-ONNX Roman-Hinglish Specialist + Whisper fallback
            - **Video Processing**: Native FFmpeg + Canvas Motion Renderer
            """
        )

    app = gr.mount_gradio_app(app, demo, path="/")
except Exception as e:
    print(f"Gradio mounting skipped: {e}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
