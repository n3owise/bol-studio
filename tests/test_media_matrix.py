"""Real small codec fixtures: no network, model inference, or user media."""
import subprocess
import pytest
from test_admission import client, project, probe_codecs
from server import app as backend


@pytest.mark.parametrize('extension,video,audio,normalized', [
    ('mp4', 'libx264', 'aac', False),
    ('webm', 'libvpx', 'vorbis', False),
    ('webm', 'libvpx-vp9', 'libopus', False),
    ('avi', 'mpeg4', 'pcm_s16le', True),
    ('mkv', 'ffv1', 'flac', True),
    ('mov', 'mjpeg', 'pcm_s16le', True),
])
def test_real_codec_upload_original_and_preview(client, tmp_path, extension, video, audio, normalized):
    source = tmp_path / f'fixture.{extension}'
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                    'testsrc2=s=64x48:r=10:d=0.4', '-f', 'lavfi', '-i',
                    'sine=frequency=440:sample_rate=48000:duration=0.4',
                    '-c:v', video, '-c:a', audio, '-strict', '-2', '-ac', '2', '-threads', '1', '-shortest', str(source)],
                   check=True, capture_output=True, timeout=30)
    original = source.read_bytes()
    item = project()
    url = f"/api/projects/{item['id']}/assets"
    headers = {'x-bol-owner': 'alice'}
    response = client.post(url, files={'file': (source.name, original, 'application/octet-stream')}, headers=headers)
    assert response.status_code == 201, response.text
    asset = response.json()
    assert asset['previewNormalized'] is normalized
    assert client.get(f"{url}/{asset['id']}/download", headers=headers).content == original
    preview = client.get(f"{url}/{asset['id']}/file", headers=headers)
    assert preview.status_code == 200
    check = tmp_path / ('preview.mp4' if normalized else source.name)
    check.write_bytes(preview.content)
    if normalized:
        assert probe_codecs(check) == {'video': 'h264', 'audio': 'aac'}
    else:
        assert preview.content == original
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(check), '-f', 'null', '-'],
                   check=True, capture_output=True, timeout=30)
    assert not backend.UPLOAD_RESERVATIONS


def test_real_alpha_prores_is_rejected_without_registered_or_partial_asset(client, tmp_path):
    source = tmp_path / 'alpha.mov'
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                    'color=c=red@0.5:s=32x32:r=10:d=0.3,format=yuva444p10le',
                    '-c:v', 'prores_ks', '-profile:v', '4', '-threads', '1', str(source)],
                   check=True, capture_output=True, timeout=30)
    item = project()
    response = client.post(f"/api/projects/{item['id']}/assets",
                           files={'file': ('alpha.mov', source.read_bytes(), 'video/quicktime')},
                           headers={'x-bol-owner': 'alice'})
    assert response.status_code == 422, response.text
    assert 'Transparent video' in response.json()['detail']
    assert not backend.load_project(item['id']).get('mediaAssets')
    assert not list((backend.project_dir(item['id']) / 'assets').iterdir())
    assert not backend.UPLOAD_RESERVATIONS
