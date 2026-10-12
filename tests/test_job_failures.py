import copy
import json
import logging
import uuid
from types import SimpleNamespace
from pathlib import Path
import threading

import pytest

from server import app as backend


@pytest.fixture
def project(tmp_path, monkeypatch):
    monkeypatch.setattr(backend, 'DATA_DIR', tmp_path)
    project = {'id': str(uuid.uuid4()), 'name': 'private caption project', 'status': 'queued',
               'revision': 1, 'transcriptionGeneration': 1, 'duration': 2,
               'script': 'roman', 'words': [], 'settings': copy.deepcopy(backend.DEFAULT_SETTINGS), 'exports': []}
    backend.write_project(project)
    return project


@pytest.mark.parametrize('stage', ['extracting', 'decoding'])
def test_failed_transcription_persists_stage_and_retry_without_logging_exception(project, monkeypatch, caplog, stage):
    def fail(*args, **kwargs): raise RuntimeError('private transcript or bearer token must stay out of logs')
    monkeypatch.setattr(backend, 'prepare_media', fail if stage == 'extracting' else lambda p: None)
    monkeypatch.setattr(backend, 'transcribe', fail)
    with caplog.at_level(logging.INFO, logger='bol'):
        backend.transcription_job(project['id'], 1)
    result = backend.load_project(project['id'])
    assert result['status'] == 'error'
    assert result['diagnostics']['stage'] == stage
    assert result['diagnostics']['errorCategory'] == 'processing'
    assert 'retry' in result['diagnostics']['retryAction'].lower()
    assert 'private transcript' not in caplog.text and 'bearer token' not in caplog.text


def test_renderer_resource_error_is_actionable_and_private_snapshot_is_removed(project, monkeypatch):
    export_id = str(uuid.uuid4())
    backend.update_project(project['id'], lambda p: p.update(status='ready', exports=[{'id': export_id, 'status': 'queued'}]))
    process = SimpleNamespace(stdout=iter([json.dumps({'errorCode': 'render_resource_limit'}) + '\n']),
                              wait=lambda: 1, kill=lambda: None)
    def spawn(*args, **kwargs):
        scratch = Path(kwargs['env']['TMPDIR'])
        assert scratch.parent == backend.project_dir(project['id'])
        assert kwargs['env']['REMOTION_SHARED_MEMORY_BACKEND'] == 'file'
        (scratch / 'pre-encode.mp4').write_bytes(b'private partial export')
        return process
    monkeypatch.setattr(backend.subprocess, 'Popen', spawn)
    backend.export_job(project['id'], export_id, project, 'burned', 720, 24)
    result = backend.load_project(project['id'])['exports'][0]
    assert result['status'] == 'error' and 'Lower export resolution' in result['message']
    assert result['diagnostics']['stage'] == 'rendering'
    assert result['diagnostics']['errorCategory'] == 'render_resource_limit'
    directory = backend.project_dir(project['id'])
    assert not (directory / f'export-{export_id}.json').exists()
    assert not (directory / f'export-{export_id}.log').exists()
    assert not (directory / f'export-{export_id}-temporary').exists()


def test_renderer_timeout_kills_child_process_group_and_allows_retry(project, monkeypatch):
    export_id = str(uuid.uuid4())
    backend.update_project(project['id'], lambda p: p.update(status='ready', exports=[{'id': export_id, 'status': 'queued'}]))
    killed = []
    process = SimpleNamespace(pid=12345, stdout=iter([]), wait=lambda: -9, kill=lambda: None)
    def spawn(*args, **kwargs):
        assert kwargs['start_new_session'] is True
        return process
    class ImmediateTimer:
        def __init__(self, seconds, callback): self.callback = callback
        def start(self): self.callback()
        def cancel(self): pass
    monkeypatch.setattr(backend.subprocess, 'Popen', spawn)
    monkeypatch.setattr(backend.threading, 'Timer', ImmediateTimer)
    monkeypatch.setattr(backend.os, 'killpg', lambda pid, sig: killed.append((pid, sig)))
    backend.export_job(project['id'], export_id, project, 'green', 2160, 60)
    result = backend.load_project(project['id'])['exports'][0]
    assert killed == [(12345, backend.signal.SIGKILL)]
    assert result['status'] == 'error'
    assert result['diagnostics']['errorCategory'] == 'render_timeout'
    assert 'retry' in result['message'].lower()
    assert not (backend.project_dir(project['id']) / f'export-{export_id}.json').exists()


def test_temporary_encoder_output_counts_toward_quota(tmp_path, monkeypatch):
    scratch = tmp_path / 'temporary'
    scratch.mkdir()
    (scratch / 'pre-encode.mp4').write_bytes(b'x' * 11)
    stopped = threading.Event()
    process = SimpleNamespace(kill=lambda: pytest.fail('must terminate the process group'))
    monkeypatch.setattr(backend, 'output_quota_exceeded', lambda *args: False)
    with backend.monitor_output_quota(process, tmp_path / 'final.mp4', 'owner', 10,
                                      temporary_path=scratch, terminate=stopped.set) as exceeded:
        assert stopped.wait(2)
        assert exceeded.is_set()
