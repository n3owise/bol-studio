"""Drive privacy boundaries, OAuth replay prevention, and real-media recovery with mocked providers."""
import io
import uuid
import wave
from datetime import datetime, timezone
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient

from server import app as backend
from server import drive_storage as drive


@pytest.fixture
def settings(monkeypatch):
    for key, value in {
        'BOL_SUPABASE_URL': 'https://database.test', 'BOL_SUPABASE_SERVICE_ROLE_KEY': 'server-secret',
        'BOL_GOOGLE_CLIENT_ID': 'client-id', 'BOL_GOOGLE_CLIENT_SECRET': 'client-secret',
        'BOL_GOOGLE_REDIRECT_URI': 'https://worker.test/api/cloud/google/callback',
        'BOL_DRIVE_ENCRYPTION_KEY': Fernet.generate_key().decode(), 'BOL_STUDIO_URL': 'https://studio.test/studio',
    }.items():
        monkeypatch.setenv(key, value)


def test_oauth_limited_scope_and_expiring_single_use_state(settings, monkeypatch):
    calls = []
    monkeypatch.setattr(drive, 'db', lambda *a, **k: calls.append((a, k)))
    result = drive.begin_connect(str(uuid.uuid4()))
    query = parse_qs(urlparse(result['url']).query)
    assert query['scope'] == [drive.SCOPE]
    assert query['access_type'] == ['offline']
    state = calls[1][0][2]
    assert state['id'] == query['state'][0]
    assert datetime.fromisoformat(state['expires_at']) > datetime.now(timezone.utc)
    # A consumed or expired state must never exchange a code.
    monkeypatch.setattr(drive, 'db', lambda *a, **k: [])
    monkeypatch.setattr(drive.httpx, 'post', lambda *a, **k: pytest.fail('replayed OAuth code was exchanged'))
    with pytest.raises(HTTPException) as e:
        drive.finish_connect(state['id'], 'replayed-code')
    assert e.value.status_code == 400


def test_connection_tokens_are_encrypted_and_never_in_authorization_url(settings, monkeypatch):
    owner = str(uuid.uuid4())
    state_used = False
    written = []
    def db(path, method='GET', body=None, **kwargs):
        nonlocal state_used
        if path.startswith('bol_drive_oauth_states'):
            assert method == 'DELETE'
            if state_used: return []
            state_used = True
            return [{'owner': owner}]
        written.append(body)
        return []
    monkeypatch.setattr(drive, 'db', db)
    monkeypatch.setattr(drive.httpx, 'post', lambda *a, **k: httpx.Response(200,
        request=httpx.Request('POST', drive.TOKEN), json={
            'access_token': 'access', 'refresh_token': 'private-refresh', 'scope': drive.SCOPE}))
    monkeypatch.setattr(drive, 'google', lambda method, path, *a, **k: {'files': [{'id': 'folder'}]})
    drive.finish_connect('state', 'code')
    assert written[0]['credentials'] != 'private-refresh'
    assert drive.cipher().decrypt(written[0]['credentials'].encode()).decode() == 'private-refresh'
    assert 'access_token' not in written[0]
    assert written[0]['owner'] == owner


def test_owner_filter_and_cross_device_conflict(settings, monkeypatch):
    captured = []
    monkeypatch.setattr(drive, 'db', lambda *a, **k: captured.append(a) or [])
    with pytest.raises(HTTPException) as e:
        drive.project('owner-a', str(uuid.uuid4()))
    assert e.value.status_code == 404
    assert 'owner=eq.owner-a' in captured[0][0]
    with pytest.raises(HTTPException) as e:
        drive.save('owner-a', 'project', 2, {})
    assert e.value.status_code == 409
    assert captured[-1][2]['p_revision'] == 2
    assert captured[-1][2]['p_owner'] == 'owner-a'


def test_folder_escape_rejected(settings, monkeypatch):
    monkeypatch.setattr(drive, 'connection', lambda _: {'folder_id': 'approved-folder'})
    monkeypatch.setattr(drive, 'google', lambda *a, **k: {'parents': ['unrelated-folder']})
    with pytest.raises(HTTPException) as e:
        drive.metadata('owner', 'file', access='token')
    assert e.value.status_code == 409


@pytest.fixture
def cloud_client(tmp_path, monkeypatch):
    monkeypatch.setattr(backend, 'DATA_DIR', tmp_path)
    monkeypatch.setattr(backend, 'AUTH_ENABLED', True)
    monkeypatch.setattr(backend, 'API_KEY', '')
    async def identity(token):
        if token not in ('alice', 'bob'):
            raise backend.AuthError('unauthenticated', 'Sign in.')
        return token
    monkeypatch.setattr(backend, 'user_id_from', identity)
    with TestClient(backend.app) as client:
        yield client


def wav():
    output = io.BytesIO()
    with wave.open(output, 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(16000)
        f.writeframes(b'\x00\x01' * 16000)
    return output.getvalue()


def test_restore_private_source_captions_settings_and_worker_isolation(cloud_client, monkeypatch):
    cloud_id = str(uuid.uuid4())
    row = {'id': cloud_id, 'revision': 4, 'source_file_id': 'original',
           'snapshot': {'name': 'Saved edit', 'words': [{'text': 'hello', 'start': 0.1, 'end': .7}],
                        'settings': {**backend.DEFAULT_SETTINGS, 'textColor': '#123456'}}}
    def project(owner, _):
        if owner != 'alice': raise HTTPException(404, 'Saved project not found.')
        return row
    def download(owner, file_id, destination, limit):
        assert owner == 'alice' and file_id == 'original'
        destination.write_bytes(wav())
        return {'name': 'private.wav', 'appProperties': {'bolProject': cloud_id}}
    monkeypatch.setattr(drive, 'project', project)
    monkeypatch.setattr(drive, 'download', download)
    headers = {'Authorization': 'Bearer alice', 'X-Bol-Temporary-Session': str(uuid.uuid4())}
    first = cloud_client.post(f'/api/cloud/projects/{cloud_id}/open', json={}, headers=headers)
    assert first.status_code == 200, first.text
    p = first.json()
    assert p['name'] == 'Saved edit' and p['words'][0]['text'] == 'hello'
    assert p['settings']['textColor'] == '#123456'
    assert p['cloudRevision'] == 4 and p['owner'] == 'alice'
    assert 'temporarySession' in p  # Worker cache expires; canonical Drive/DB data does not.
    second = cloud_client.post(f'/api/cloud/projects/{cloud_id}/open', json={}, headers=headers)
    assert second.status_code == 200, second.text
    assert second.json()['id'] != p['id']
    denied = cloud_client.post(f'/api/cloud/projects/{cloud_id}/open', json={}, headers={'Authorization': 'Bearer bob'})
    assert denied.status_code == 404
    assert cloud_client.get(f"/api/projects/{p['id']}", headers={'Authorization': 'Bearer bob'}).status_code == 404


def test_cloud_refuses_anonymous_local_owner_header(cloud_client, monkeypatch):
    monkeypatch.setattr(backend, 'AUTH_ENABLED', False)
    response = cloud_client.get('/api/cloud/status', headers={'X-Bol-Owner': 'alice'})
    assert response.status_code == 401


def test_new_original_import_uses_backend_extraction_fallback(cloud_client, monkeypatch):
    cloud_id = str(uuid.uuid4())
    monkeypatch.setattr(drive, 'project', lambda *a: {'snapshot': {}, 'revision': 0, 'source_file_id': 'source'})
    def download(owner, file_id, destination, limit):
        destination.write_bytes(wav())
        return {'name': 'audio.wav', 'appProperties': {'bolProject': cloud_id}}
    snapshots = []
    monkeypatch.setattr(drive, 'download', download)
    monkeypatch.setattr(drive, 'save', lambda owner, pid, revision, snap: snapshots.append(snap) or {'revision': 1})
    response = cloud_client.post(f'/api/cloud/projects/{cloud_id}/open', json={}, headers={
        'Authorization': 'Bearer alice', 'X-Bol-Temporary-Session': str(uuid.uuid4())})
    assert response.status_code == 200, response.text
    p = response.json()
    assert p['cloudRevision'] == 1
    # No browser extraction was provided. The existing prepare_media path creates
    # the real mono audio consumed by HF from the securely retrieved source.
    backend.prepare_media(p)
    assert (backend.project_dir(p['id']) / 'audio.wav').is_file()
    assert snapshots and 'owner' not in snapshots[0] and 'temporarySession' not in snapshots[0]


def test_local_audio_starts_before_drive_original_is_available(cloud_client, monkeypatch):
    cloud_id = str(uuid.uuid4())
    monkeypatch.setattr(drive, 'project', lambda *a: {'snapshot': {}, 'revision': 0,
        'source_file_id': 'source', 'name': 'Mobile video'})
    monkeypatch.setattr(drive, 'download', lambda *a, **k: pytest.fail('Audio fast path waited for the Drive original'))
    headers = {'Authorization': 'Bearer alice', 'X-Bol-Temporary-Session': str(uuid.uuid4()), 'Content-Type': 'audio/wav'}
    response = cloud_client.put(f'/api/cloud/projects/{cloud_id}/audio?kind=video&width=1080&height=1920',
        content=wav(), headers=headers)
    assert response.status_code == 200, response.text
    p = response.json()
    assert p['cloudAudioOnly'] is True and p['width'] == 1080 and p['height'] == 1920
    assert p['name'] == 'Mobile video' and p['mediaType'] == 'video'
    backend.prepare_media(p)
    assert (backend.project_dir(p['id']) / 'audio.wav').is_file()
    export = cloud_client.post(f"/api/projects/{p['id']}/exports", json={'mode': 'burned', 'resolution': 720, 'fps': 30}, headers={**headers, 'Content-Type': 'application/json'})
    assert export.status_code == 409
    assert 'original' in export.json()['detail']


def test_hydration_finishes_fast_audio_session_and_saves_captions(cloud_client, monkeypatch):
    cloud_id = str(uuid.uuid4())
    row = {'snapshot': {}, 'revision': 0, 'source_file_id': 'source', 'name': 'Mobile video'}
    monkeypatch.setattr(drive, 'project', lambda *a: row)
    headers = {'Authorization': 'Bearer alice', 'X-Bol-Temporary-Session': str(uuid.uuid4())}
    response = cloud_client.put(f'/api/cloud/projects/{cloud_id}/audio', content=wav(), headers=headers)
    assert response.status_code == 200, response.text
    p = response.json()
    p['words'] = [{'text': 'Already transcribed', 'start': 0.1, 'end': .8}]
    backend.write_project(p)
    def download(owner, file_id, path, limit):
        assert owner == 'alice'
        path.write_bytes(wav())
        return {'name': 'original.wav', 'appProperties': {'bolProject': cloud_id}}
    monkeypatch.setattr(drive, 'download', download)
    saved = []
    monkeypatch.setattr(drive, 'save', lambda owner, pid, rev, snap: saved.append(snap) or {'revision': 1})
    result = cloud_client.post(f'/api/cloud/projects/{cloud_id}/commit', json={'workerId': p['id'], 'revision': 0}, headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()['cloudAudioOnly'] is False
    assert result.json()['cloudRevision'] == 1
    assert result.json()['words'][0]['text'] == 'Already transcribed'
    assert saved[0]['filename'] == 'original.wav'
    assert 'cloudAudioOnly' not in saved[0]


def test_rejects_non_pcm_audio_for_fast_path(cloud_client, monkeypatch):
    cloud_id = str(uuid.uuid4())
    monkeypatch.setattr(drive, 'project', lambda *a: {'revision': 0})
    response = cloud_client.put(f'/api/cloud/projects/{cloud_id}/audio', content=b'not WAV audio',
        headers={'Authorization': 'Bearer alice'})
    assert response.status_code == 422
    assert not list(backend.DATA_DIR.glob('*/project.json'))
