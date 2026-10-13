import copy
import time
import uuid

import pytest
from fastapi.testclient import TestClient
from server import app as backend
from server.temporary_sessions import expired, LEASE_SECONDS


@pytest.fixture
def session_project(tmp_path, monkeypatch):
    monkeypatch.setattr(backend, 'DATA_DIR', tmp_path)
    project = {'id': str(uuid.uuid4()), 'owner': 'session-owner', 'status': 'ready',
               'revision': 3, 'exports': [], 'words': [],
               'temporarySession': {'id': str(uuid.uuid4()), 'expiresAt': time.time() - 1}}
    backend.write_project(project)
    return project


def test_only_explicit_finite_temporary_leases_expire():
    for project in ({}, {'temporarySession': {}}, {'temporarySession': {'id': 'x', 'expiresAt': float('nan')}},
                    {'temporarySession': {'id': 'x', 'expiresAt': True}}):
        assert not expired(project, time.time())
    assert expired({'temporarySession': {'id': 'x', 'expiresAt': 1}}, 2)


def test_cleanup_preserves_existing_and_active_work(session_project):
    original = copy.deepcopy(session_project)
    original['id'] = str(uuid.uuid4())
    original.pop('temporarySession')
    backend.write_project(original)
    session_project['status'] = 'processing'
    backend.write_project(session_project)
    backend.reap_temporary_projects()
    assert backend.project_dir(original['id']).exists()
    assert backend.project_dir(session_project['id']).exists()
    session_project['status'] = 'ready'
    backend.write_project(session_project)
    backend.reap_temporary_projects()
    assert not backend.project_dir(session_project['id']).exists()
    assert backend.project_dir(original['id']).exists()


def test_cleanup_waits_for_export(session_project):
    session_project['exports'] = [{'status': 'processing'}]
    backend.write_project(session_project)
    backend.reap_temporary_projects()
    assert backend.project_dir(session_project['id']).exists()


def test_lease_requires_owner_and_session_and_preserves_revision(session_project):
    client = TestClient(backend.app)
    route = f"/api/projects/{session_project['id']}/temporary-session"
    headers = {'X-Bol-Owner': session_project['owner'],
               'X-Bol-Temporary-Session': session_project['temporarySession']['id']}
    assert client.post(route, headers={**headers, 'X-Bol-Owner': 'other'}).status_code == 404
    assert client.post(route, headers={**headers, 'X-Bol-Temporary-Session': 'other'}).status_code == 404
    assert client.post(route, headers=headers).status_code == 204
    updated = backend.load_project(session_project['id'])
    assert updated['revision'] == 3
    assert updated['temporarySession']['expiresAt'] > time.time() + LEASE_SECONDS - 5
    assert client.post(route + '?closing=true', headers=headers).status_code == 204
    assert backend.load_project(session_project['id'])['temporarySession']['expiresAt'] < time.time() + 20


def test_expired_cleanup_removes_source_exports_and_intermediate_files(session_project):
    directory = backend.project_dir(session_project['id'])
    for name in ('source.bin', 'preview.mp4', 'audio.wav', 'export-test.mp4', 'export-test.json'):
        (directory / name).write_bytes(b'temporary fixture')
    scratch = directory / 'export-test-temporary'
    scratch.mkdir()
    (scratch / 'pixel-buffer').write_bytes(b'temporary frame data')
    backend.reap_temporary_projects()
    assert not directory.exists()


def test_cleanup_retries_after_expired_export_finishes(session_project):
    session_project['exports'] = [{'status': 'processing'}]
    backend.write_project(session_project)
    backend.reap_temporary_projects()
    assert backend.project_dir(session_project['id']).exists()
    session_project['exports'][0]['status'] = 'ready'
    backend.write_project(session_project)
    backend.reap_temporary_projects()
    assert not backend.project_dir(session_project['id']).exists()
