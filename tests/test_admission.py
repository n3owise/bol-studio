"""Small boundary fixtures for request, account and media admission."""
import asyncio
import copy
import json
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from server import app as backend


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(backend, 'DATA_DIR', tmp_path)
    monkeypatch.setattr(backend, 'UPLOAD_RESERVATIONS', {})
    with TestClient(backend.app) as client:
        yield client


def project(owner='alice', **changes):
    value = {'id': str(uuid.uuid4()), 'owner': owner, 'name': 'clip', 'filename': 'clip.mp4',
             'mediaType': 'video', 'duration': 3, 'width': 100, 'height': 100,
             'created': '', 'status': 'ready', 'progress': 100, 'message': '',
             'words': [{'text': 'Hello'}], 'settings': copy.deepcopy(backend.DEFAULT_SETTINGS),
             'waveform': [], 'exports': [], 'revision': 1, **changes}
    backend.write_project(value)
    return value


def canvas(**changes):
    return {'id': 'layer', 'assetId': 'primary', 'name': 'Main', 'type': 'video',
            'url': '', 'x': 50, 'y': 50, 'scale': 1, **changes}


def test_declared_body_rejected_before_receive_or_endpoint(client, monkeypatch):
    monkeypatch.setattr(backend, 'MAX_BYTES', 10)
    monkeypatch.setattr(backend, 'UPLOAD_MULTIPART_OVERHEAD', 20)
    response = client.post('/api/projects', content=b'x' * 31,
                           headers={'content-type': 'multipart/form-data; boundary=fixture'})
    assert response.status_code == 413
    assert not list(backend.DATA_DIR.glob('*/project.json'))
    assert not backend.UPLOAD_RESERVATIONS


@pytest.mark.parametrize('declared', [None, '15'])
def test_streamed_body_cap_precedes_downstream_parser(client, monkeypatch, declared):
    monkeypatch.setattr(backend, 'MAX_BYTES', 10)
    monkeypatch.setattr(backend, 'UPLOAD_MULTIPART_OVERHEAD', 10)
    called = []
    async def downstream(scope, receive, send):
        called.append(True)
    headers = [(b'x-bol-owner', b'alice')]
    if declared is not None:
        headers.append((b'content-length', declared.encode()))
    scope = {'type': 'http', 'method': 'POST', 'path': '/api/projects', 'headers': headers,
             'query_string': b'', 'state': {}}
    messages = iter([{'type': 'http.request', 'body': b'x' * 10, 'more_body': True},
                     {'type': 'http.request', 'body': b'x' * 11, 'more_body': False}])
    sent = []
    async def receive():
        return next(messages)
    async def send(message):
        sent.append(message)
    asyncio.run(backend.UploadAdmissionMiddleware(downstream)(scope, receive, send))
    assert not called
    assert sent[0]['status'] == 413
    assert backend.UPLOAD_RESERVATIONS == {}


def test_storage_and_project_budgets_do_not_consume_another_owner(client, monkeypatch):
    monkeypatch.setattr(backend, 'MAX_OWNER_PROJECTS', 1)
    monkeypatch.setattr(backend, 'MAX_OWNER_STORAGE_BYTES', 10000)
    value = project()
    (backend.project_dir(value['id']) / 'source.bin').write_bytes(b'x' * 9500)
    alice = client.post('/api/projects', content=b'x' * 600, headers={'x-bol-owner': 'alice'})
    assert alice.status_code in {413, 429}
    # Bob passes account admission; endpoint rejects invalid multipart rather than quota.
    bob = client.post('/api/projects', content=b'x' * 10, headers={'x-bol-owner': 'bob'})
    assert bob.status_code == 422
    assert backend.UPLOAD_RESERVATIONS == {}


def test_pending_upload_limits_are_atomic_and_release(client, monkeypatch):
    monkeypatch.setattr(backend, 'MAX_OWNER_UPLOADS', 1)
    with backend.storage_reservation('alice', 10):
        with pytest.raises(HTTPException) as error:
            with backend.storage_reservation('alice', 10):
                pass
        assert error.value.status_code == 429
        with backend.storage_reservation('bob', 10):
            pass
    assert backend.UPLOAD_RESERVATIONS == {}
    with pytest.raises(RuntimeError):
        with backend.storage_reservation('alice', 10):
            raise RuntimeError('cancelled')
    assert backend.UPLOAD_RESERVATIONS == {}


@pytest.mark.parametrize('change', [{'x': -1}, {'y': 101}, {'scale': 0}, {'scale': 4},
                                   {'rotation': 361}, {'start': 3, 'end': 2},
                                   {'end': 4}, {'type': 'image'}, {'visible': 'yes'},
                                   {'greenScreen': {'enabled': True, 'color': 'red', 'tolerance': 50,
                                                    'spillReduction': True, 'smoothEdges': True}}])
def test_canvas_invalid_fields_never_mutate(client, change):
    value = project()
    response = client.patch(f"/api/projects/{value['id']}", json={'canvasElements': [canvas(**change)]},
                            headers={'x-bol-owner': 'alice'})
    assert response.status_code == 422, response.text
    assert backend.load_project(value['id']) == value


def test_canvas_accepts_boundaries_and_rejects_duplicate_ids(client):
    value = project()
    url = f"/api/projects/{value['id']}"
    headers = {'x-bol-owner': 'alice'}
    element = canvas(x=0, y=100, scale=3.5, rotation=-360, start=0, end=3)
    response = client.patch(url, json={'canvasElements': [element]}, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()['canvasElements'] == [element]
    assert client.patch(url, json={'canvasElements': [element, element]}, headers=headers).status_code == 422
    assert client.patch(url, json={'canvasElements': [element] * 501}, headers=headers).status_code == 422


@pytest.mark.parametrize('extension,stream,duration', [
    ('.png', {'codec_type': 'video', 'codec_name': 'png', 'width': 0, 'height': 10}, None),
    ('.jpg', {'codec_type': 'video', 'codec_name': 'h264', 'width': 10, 'height': 10}, None),
    ('.mp4', {'codec_type': 'video', 'width': 8193, 'height': 10}, 1),
    ('.mp4', {'codec_type': 'video', 'width': 10, 'height': 10}, 1201),
    ('.wav', {'codec_type': 'audio'}, 0),
    ('.wav', {'codec_type': 'audio'}, 'NaN'),
    ('.mp4', {'codec_type': 'audio'}, 1),
])
def test_asset_metadata_rejected_consistently(client, monkeypatch, extension, stream, duration):
    info = {'streams': [stream], 'format': {'duration': duration}}
    monkeypatch.setattr(backend, 'run_process', lambda *args: SimpleNamespace(stdout=json.dumps(info)))
    with pytest.raises(HTTPException) as error:
        backend.inspect_asset_file(backend.DATA_DIR / 'fixture', 'fixture' + extension)
    assert error.value.status_code == 422


def test_asset_upload_failure_cleans_source_and_thumbnail(client, monkeypatch):
    value = project()
    monkeypatch.setattr(backend, 'inspect_asset_file', lambda *args: (_ for _ in ()).throw(HTTPException(422, 'invalid dimensions')))
    response = client.post(f"/api/projects/{value['id']}/assets", files={'file': ('bad.png', b'invalid', 'image/png')},
                           headers={'x-bol-owner': 'alice'})
    assert response.status_code == 422
    assert list((backend.project_dir(value['id']) / 'assets').iterdir()) == []
    assert backend.load_project(value['id']) == value
    assert not backend.UPLOAD_RESERVATIONS


def test_asset_limit_prevents_spooled_project_files(client, monkeypatch):
    monkeypatch.setattr(backend, 'MAX_PROJECT_ASSETS', 1)
    value = project(mediaAssets=[{'id': 'existing'}])
    response = client.post(f"/api/projects/{value['id']}/assets", files={'file': ('bad.png', b'invalid', 'image/png')},
                           headers={'x-bol-owner': 'alice'})
    assert response.status_code == 429
    assert not (backend.project_dir(value['id']) / 'assets').exists()


def test_summary_list_keeps_metadata_and_ownership(client):
    value = project()
    project('bob')
    response = client.get('/api/projects?summary=true', headers={'x-bol-owner': 'alice'})
    assert response.status_code == 200
    assert response.json() == [{**{key: val for key, val in value.items() if key != 'words'}, 'wordCount': 1}]
    assert client.get('/api/projects', headers={'x-bol-owner': 'alice'}).json() == [value]


def test_export_quota_fails_before_queue_or_project_mutation(client, monkeypatch):
    value = project()
    used = backend.owned_project_usage('alice')[1]
    monkeypatch.setattr(backend, 'MAX_OWNER_STORAGE_BYTES', used + 99)
    monkeypatch.setattr(backend, 'MAX_EXPORT_BYTES', 100)
    response = client.post(f"/api/projects/{value['id']}/exports", json={'resolution': 720, 'mode': 'burned'}, headers={'x-bol-owner': 'alice'})
    assert response.status_code == 413
    assert backend.load_project(value['id']) == value


def test_active_exports_reserve_storage_per_owner(client, monkeypatch):
    value = project(exports=[{'id': 'job', 'status': 'queued', 'storageReservationBytes': 100}])
    assert backend.active_output_reservations('alice') == 100
    assert backend.active_output_reservations('alice', 'job') == 0
    assert backend.active_output_reservations('bob') == 0
    used = backend.owned_project_usage('alice')[1]
    monkeypatch.setattr(backend, 'MAX_OWNER_STORAGE_BYTES', used + 150)
    with pytest.raises(HTTPException) as error:
        with backend.storage_reservation('alice', 51):
            pass
    assert error.value.status_code == 413
    backend.update_project(value['id'], lambda p: p['exports'][0].update(status='error'))
    with backend.storage_reservation('alice', 51):
        pass


def test_derived_encoder_cap_removes_partial_output(client):
    import sys
    value = project()
    output = backend.project_dir(value['id']) / 'derived.tmp.wav'
    args = [sys.executable, '-c', 'from pathlib import Path; import sys; Path(sys.argv[1]).write_bytes(b"x"*1000)', str(output)]
    with pytest.raises(HTTPException) as error:
        backend.run_bounded_media_process(args, 5, value, 500)
    assert error.value.status_code == 413
    assert not output.exists()
    assert not backend.UPLOAD_RESERVATIONS


def test_quota_watchdog_stops_silent_encoder(client):
    import sys
    import subprocess
    value = project()
    output = backend.project_dir(value['id']) / 'silent.tmp'
    args = [sys.executable, '-c', 'from pathlib import Path; import sys,time; Path(sys.argv[1]).write_bytes(b"x"*1000); time.sleep(10)', str(output)]
    with pytest.raises(HTTPException):
        backend.run_bounded_media_process(args, 5, value, 500)
    assert not output.exists()
    assert not backend.UPLOAD_RESERVATIONS


def test_derived_work_does_not_consume_upload_concurrency_slot(client, monkeypatch):
    monkeypatch.setattr(backend, 'MAX_OWNER_UPLOADS', 1)
    with backend.storage_reservation('alice', 100):
        with backend.storage_reservation('alice', 100, upload_slot=False):
            assert backend.UPLOAD_RESERVATIONS['alice']['uploads'] == 1
    assert not backend.UPLOAD_RESERVATIONS


def test_duplicate_storage_quota_rejected_before_copy(client, monkeypatch):
    value = project()
    source = backend.project_dir(value['id']) / 'source.bin'
    source.write_bytes(b'fixture')
    monkeypatch.setattr(backend, 'MAX_OWNER_STORAGE_BYTES', backend.owned_project_usage('alice')[1] + 1)
    response = client.post(f"/api/projects/{value['id']}/assets/primary/duplicate", headers={'x-bol-owner': 'alice'})
    assert response.status_code == 413
    assert not (source.parent / 'assets').exists()
    assert not backend.UPLOAD_RESERVATIONS


def test_export_statuses_are_metadata_only_and_owner_scoped(client):
    jobs = [{'id': str(uuid.uuid4()), 'status': 'queued', 'progress': 0, 'message': 'Queued'}]
    value = project(exports=jobs)
    url = f"/api/projects/{value['id']}/exports"
    response = client.get(url, headers={'x-bol-owner': 'alice'})
    assert response.status_code == 200
    assert response.json() == jobs
    assert 'words' not in response.text
    assert client.get(url, headers={'x-bol-owner': 'bob'}).status_code == 404


def test_project_progress_summary_omits_scene_payload_without_mutating_storage(client):
    value = project(waveform=[.1] * 100, canvasElements=[canvas()])
    url = f"/api/projects/{value['id']}?summary=true"
    response = client.get(url, headers={'x-bol-owner': 'alice'})
    assert response.status_code == 200
    summary = response.json()
    assert summary['wordCount'] == 1
    assert not {'words', 'waveform', 'canvasElements'} & summary.keys()
    assert summary['status'] == 'ready'
    assert summary['settings'] == value['settings']
    assert backend.load_project(value['id']) == value
    assert client.get(url, headers={'x-bol-owner': 'bob'}).status_code == 404


def test_global_upload_limit_bounds_many_owners(client, monkeypatch):
    monkeypatch.setattr(backend, 'MAX_TOTAL_UPLOADS', 1)
    with backend.storage_reservation('alice', 100):
        with pytest.raises(HTTPException) as error:
            with backend.storage_reservation('bob', 100):
                pass
        assert error.value.status_code == 503
        assert error.value.headers['Retry-After'] == '30'
        # Existing derived work may finish while new body admission is full.
        with backend.storage_reservation('bob', 10, upload_slot=False):
            pass
    assert not backend.UPLOAD_RESERVATIONS


def test_disk_headroom_rejected_before_reservation_and_encoder(client, monkeypatch):
    monkeypatch.setattr(backend.shutil, 'disk_usage', lambda _: SimpleNamespace(free=100))
    monkeypatch.setattr(backend, 'MIN_DISK_FREE_BYTES', 50)
    with pytest.raises(HTTPException) as error:
        with backend.storage_reservation('alice', 51):
            pytest.fail('over-budget work must never start')
    assert error.value.status_code == 507
    assert not backend.UPLOAD_RESERVATIONS


def test_global_admission_response_preserves_retry_after(client, monkeypatch):
    monkeypatch.setattr(backend, 'MAX_TOTAL_UPLOADS', 1)
    with backend.storage_reservation('alice', 100):
        response = client.post('/api/projects', content=b'invalid', headers={'x-bol-owner': 'bob'})
    assert response.status_code == 503
    assert response.headers['Retry-After'] == '30'


def test_multipart_field_and_header_limits_precede_parser(client):
    boundary = 'test-boundary'
    part = f'--{boundary}\r\nContent-Disposition: form-data; name="extra"\r\n\r\nx\r\n'.encode()
    response = client.post('/api/projects', content=part * 17 + f'--{boundary}--\r\n'.encode(),
                           headers={'content-type': f'multipart/form-data; boundary={boundary}'})
    assert response.status_code == 413
    assert 'fields' in response.json()['detail']
    huge_header = f'--{boundary}\r\nX-Header: '.encode() + b'x' * 9000 + b'\r\n\r\nfixture\r\n'
    response = client.post('/api/projects', content=huge_header,
                           headers={'content-type': f'multipart/form-data; boundary={boundary}'})
    assert response.status_code == 413
    assert 'headers' in response.json()['detail']
    assert not backend.UPLOAD_RESERVATIONS


def test_multipart_binary_contents_are_scanned_in_bounded_chunks(client):
    import io
    body = b'--b\r\nContent-Disposition: form-data; name="file"; filename="clip.mp4"\r\n\r\n' + b'x' * 200000 + b'\r\n--b--\r\n'
    stream = io.BytesIO(body)
    backend.validate_multipart_envelope(stream, 'multipart/form-data; boundary="b"')
    assert stream.tell() == 0


@pytest.mark.parametrize('fd,size', [(1, 8 * 1024 * 1024 + 1), (2, 1024 * 1024 + 1)])
def test_probe_output_limits_are_file_backed_and_checked(client, fd, size):
    import sys
    args = [sys.executable, '-c', f'import os; os.write({fd}, b"x" * {size})']
    with pytest.raises(ValueError, match='diagnostic output limit'):
        backend.run_process(args, 5)


def test_probe_completed_process_contract_is_preserved(client):
    import sys
    result = backend.run_process([sys.executable, '-c', 'print("metadata")'], 5)
    assert result.stdout == 'metadata\n'
    assert result.stderr == ''
    assert result.returncode == 0


def test_encoder_stderr_limit_cleans_output(client):
    import sys
    value = project()
    output = backend.project_dir(value['id']) / 'diagnostic.tmp'
    args = [sys.executable, '-c', 'from pathlib import Path; import os,sys; Path(sys.argv[1]).write_bytes(b"fixture"); os.write(2, b"x" * (1024 * 1024 + 1))', str(output)]
    with pytest.raises(ValueError, match='diagnostic output limit'):
        backend.run_bounded_media_process(args, 5, value, 1000)
    assert not output.exists()
    assert not backend.UPLOAD_RESERVATIONS


def prores_fixture(tmp_path):
    import subprocess
    path = tmp_path / 'original.mov'
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=48x32:r=10:d=0.6',
                    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=0.6',
                    '-c:v', 'prores_ks', '-pix_fmt', 'yuv422p10le', '-c:a', 'pcm_s16le', '-shortest', str(path)],
                   check=True, capture_output=True)
    return path.read_bytes()


def probe_codecs(path):
    info = json.loads(backend.run_process(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(path)]).stdout)
    return {stream['codec_type']: stream['codec_name'] for stream in info['streams']}


def test_prores_asset_preview_normalizes_but_download_and_duplicate_keep_original(client, tmp_path):
    value = project()
    content = prores_fixture(tmp_path)
    headers = {'x-bol-owner': 'alice'}
    url = f"/api/projects/{value['id']}/assets"
    response = client.post(url, files={'file': ('camera.mov', content, 'video/quicktime')}, headers=headers)
    assert response.status_code == 201, response.text
    asset = response.json()
    assert asset['previewNormalized'] is True
    assert asset['previewFile'].endswith('.preview.mp4')
    original = client.get(url + f"/{asset['id']}/download", headers=headers)
    preview = client.get(url + f"/{asset['id']}/file", headers=headers)
    assert original.content == content
    assert preview.headers['content-type'] == 'video/mp4'
    preview_path = tmp_path / 'browser-preview.mp4'
    preview_path.write_bytes(preview.content)
    assert probe_codecs(preview_path) == {'video': 'h264', 'audio': 'aac'}
    assert probe_codecs(backend.project_dir(value['id']) / asset['sourceFile']) == {'video': 'prores', 'audio': 'pcm_s16le'}
    duplicate = client.post(url + f"/{asset['id']}/duplicate", headers=headers)
    assert duplicate.status_code == 200, duplicate.text
    copied = duplicate.json()
    assert copied['previewNormalized'] is True
    assert client.get(url + f"/{copied['id']}/download", headers=headers).content == content
    assert probe_codecs(backend.project_dir(value['id']) / copied['previewFile']) == {'video': 'h264', 'audio': 'aac'}


def test_asset_preview_failure_is_rejected_without_partial_registration(client, tmp_path, monkeypatch):
    value = project()
    content = prores_fixture(tmp_path)
    def fail(args, timeout, project, limit):
        from pathlib import Path
        Path(args[-1]).write_bytes(b'partial')
        raise ValueError('Synthetic decoder failure')
    monkeypatch.setattr(backend, 'run_bounded_media_process', fail)
    response = client.post(f"/api/projects/{value['id']}/assets", files={'file': ('camera.mov', content, 'video/quicktime')},
                           headers={'x-bol-owner': 'alice'})
    assert response.status_code == 422
    assert backend.load_project(value['id']) == value
    assert not list((backend.project_dir(value['id']) / 'assets').iterdir())
    assert not backend.UPLOAD_RESERVATIONS


def test_asset_serving_requires_registered_uuid_and_contained_manifest(client):
    value = project()
    base = f"/api/projects/{value['id']}/assets"
    headers = {'x-bol-owner': 'alice'}
    directory = backend.project_dir(value['id']) / 'assets'
    directory.mkdir()
    asset_id = str(uuid.uuid4())
    (directory / f'{asset_id}.png').write_bytes(b'orphan')
    for suffix in ('file', 'download', 'thumbnail'):
        assert client.get(base + f'/{asset_id}/{suffix}', headers=headers).status_code == 404
        assert client.get(base + f'/*/{suffix}', headers=headers).status_code == 404
    value['mediaAssets'] = [{'id': asset_id, 'sourceFile': '../source.bin'}]
    backend.write_project(value)
    assert client.get(base + f'/{asset_id}/file', headers=headers).status_code == 404


def test_animated_webp_is_rejected_clearly_and_png_alpha_is_retained(client):
    import io
    from PIL import Image
    value = project()
    headers = {'x-bol-owner': 'alice'}
    url = f"/api/projects/{value['id']}/assets"
    animated = io.BytesIO()
    frames = [Image.new('RGBA', (8, 8), color) for color in ('red', 'blue')]
    frames[0].save(animated, format='WEBP', save_all=True, append_images=frames[1:], duration=100, loop=0)
    response = client.post(url, files={'file': ('animation.webp', animated.getvalue(), 'image/webp')}, headers=headers)
    assert response.status_code == 422
    assert 'Animated images' in response.json()['detail']
    assert not backend.load_project(value['id']).get('mediaAssets')
    alpha = io.BytesIO()
    Image.new('RGBA', (8, 8), (255, 0, 0, 128)).save(alpha, format='PNG')
    response = client.post(url, files={'file': ('transparent.png', alpha.getvalue(), 'image/png')}, headers=headers)
    assert response.status_code == 201, response.text
    asset = response.json()
    assert asset['previewNormalized'] is False
    assert client.get(url + f"/{asset['id']}/file", headers=headers).content == alpha.getvalue()


def test_alpha_video_normalization_is_rejected_instead_of_flattening(client, monkeypatch):
    from pathlib import Path
    value = project()
    source = backend.project_dir(value['id']) / 'alpha.mov'
    source.write_bytes(b'fixture')
    destination = source.with_name('preview.mp4')
    monkeypatch.setattr(backend, '_streams', lambda _: ('prores', ''))
    monkeypatch.setattr(backend, 'run_process', lambda *args: SimpleNamespace(stdout=json.dumps({'streams': [{'codec_type': 'video', 'pix_fmt': 'yuva444p10le'}]})))
    with pytest.raises(ValueError, match='Transparent video'):
        backend.prepare_asset_preview(source, destination, {'mediaType': 'video', 'duration': 1}, value)
    assert not destination.exists()
