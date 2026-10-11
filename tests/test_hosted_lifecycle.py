"""Exercise Gradio's application rebuild without downloads or an external server."""
import os
from pathlib import Path
import subprocess
import sys


def test_hosted_lifecycle_survives_gradio_launch_rebuild(tmp_path):
    root = Path(__file__).resolve().parents[1]
    env = {**os.environ, 'DATA_DIR': str(tmp_path), 'BOL_SUPABASE_URL': '',
           'BOL_API_KEY': '', 'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1'}
    code = '''
import subprocess
subprocess.run = lambda *args, **kwargs: None
import app as entry
from gradio.routes import App
from fastapi.testclient import TestClient
# launch() calls create_app with the supplied app and its app_kwargs.
rebuilt = App.create_app(entry.demo, app=entry.application, app_kwargs=entry.backend_app_kwargs)
with TestClient(rebuilt) as client:
    result = client.get('/api/health').json()
    assert result['queue']['durable'], result
    import threading
    assert any(t.name == 'temporary-session-cleanup' for t in threading.enumerate())
assert not any(t.name == 'temporary-session-cleanup' for t in threading.enumerate())
'''
    result = subprocess.run([sys.executable, '-c', code], cwd=root, env=env,
                            capture_output=True, text=True, timeout=40)
    assert result.returncode == 0, result.stdout + result.stderr
