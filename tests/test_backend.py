import copy
import re
from pathlib import Path
import io
import json
import subprocess
import uuid
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pytest
from fastapi.testclient import TestClient
from scipy.io import wavfile

from server import app as backend
from server import emoji as emoji_module
from server import transcription as transcription_module
from server.transcription import (_sherpa_tokens_to_words, merge_code_mixed_english, model_config,
                                  normalize_words, refine_word_boundaries_with_vad, romanize_hinglish, suggest_emphasis, transcribe)


class FakeQueue:
    def __init__(self):
        self.jobs = []

    def submit(self, fn, *args):
        self.jobs.append((fn, args))


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(backend, "DATA_DIR", tmp_path)
    monkeypatch.setattr(backend, "EXECUTOR", FakeQueue())
    with TestClient(backend.app) as test_client:
        yield test_client


@pytest.fixture
def project(client):
    value = {"id": str(uuid.uuid4()), "name": "My clip", "filename": "clip.wav", "mediaType": "audio", "duration": 3,
             "width": 720, "height": 1280, "created": "2026-09-09T00:00:00Z", "status": "ready", "progress": 100,
             "message": "Ready", "words": [word()], "settings": copy.deepcopy(backend.DEFAULT_SETTINGS), "waveform": [],
             "exports": [], "script": "roman", "language": "hi", "revision": 1}
    backend.write_project(value)
    return value


def word(**changes):
    return {"id": "w1", "text": "hello", "original": "hello", "start": .1, "end": .7,
            "confidence": .9, "emphasis": False, "emphasisScore": .5, **changes}


def audio_bytes(silent=False):
    rate = 16000
    samples = np.zeros(rate, dtype=np.int16) if silent else (np.sin(2*np.pi*220*np.arange(rate)/rate)*8000).astype(np.int16)
    buffer = io.BytesIO()
    wavfile.write(buffer, rate, samples)
    return buffer.getvalue()


def test_upload_valid_audio_persists_and_queues_once(client):
    response = client.post("/api/projects", files={"file": ("../my speech.wav", audio_bytes(), "audio/wav")}, data={"script": "roman", "language": "hi"})
    assert response.status_code == 201, response.text
    project = response.json()
    assert project["filename"] == "my speech.wav"
    assert project["mediaType"] == "audio"
    assert project["duration"] == 1
    assert project["status"] == "queued"
    assert len(backend.EXECUTOR.jobs) == 1
    assert backend.load_project(project["id"]) == project
    # Playable straight away: the upload is served as-is rather than waiting for
    # a re-encoded preview, which most uploads no longer need at all.
    assert client.get(f"/api/projects/{project['id']}/media").status_code == 200


def test_upload_invalid_media_is_rejected_and_cleaned(client):
    response = client.post("/api/projects", files={"file": ("fake.mp4", b"this is not media", "video/mp4")})
    assert response.status_code == 422
    assert list(backend.DATA_DIR.iterdir()) == []


def test_empty_and_oversize_upload(client, monkeypatch):
    assert client.post("/api/projects", files={"file": ("empty.wav", b"", "audio/wav")}).status_code == 422
    monkeypatch.setattr(backend, "MAX_BYTES", 10)
    assert client.post("/api/projects", files={"file": ("large.wav", audio_bytes(), "audio/wav")}).status_code == 413
    assert list(backend.DATA_DIR.iterdir()) == []


@pytest.mark.parametrize("words", [
    [word(start=1, end=.5)], [word(end=3.1)], [word(start=-1)],
    [word(), word(id="w2", start=.6, end=.9)],
    [word(), word(start=1, end=2)], [word(text=" ")],
    [word(start="0.1")], [word(emphasis="yes")], [word(confidence=2)],
])
def test_invalid_word_edits_are_rejected_without_mutation(client, project, words):
    response = client.patch(f"/api/projects/{project['id']}", json={"words": words})
    assert response.status_code == 422, response.text
    assert backend.load_project(project["id"]) == project


def test_revision_conflict_and_partial_settings(client, project):
    url = f"/api/projects/{project['id']}"
    response = client.patch(url, json={"revision": 1, "settings": {"accent": "#ff8800"}})
    assert response.status_code == 200
    assert response.json()["settings"]["fontSize"] == 54
    assert response.json()["revision"] == 2
    assert client.patch(url, json={"revision": 1, "name": "Stale"}).status_code == 409
    assert backend.load_project(project["id"])["name"] == "My clip"


def test_video_layer_can_be_removed_without_removing_audio(client, project):
    video_project = copy.deepcopy(project)
    video_project["mediaType"] = "video"
    video_project["videoEnabled"] = True
    backend.write_project(video_project)
    url = f"/api/projects/{project['id']}"
    response = client.patch(url, json={"videoEnabled": False})
    assert response.status_code == 200
    assert response.json()["videoEnabled"] is False
    assert client.patch(url, json={"videoEnabled": True}).json()["videoEnabled"] is True


@pytest.mark.parametrize("settings", [{"accent": "red"}, {"template": "unknown"}, {"fontSize": 999}, {"wordsPerLine": 0}, {"uppercase": "true"}, {"aspect": "12:4"}])
def test_invalid_settings(client, project, settings):
    assert client.patch(f"/api/projects/{project['id']}", json={"settings": settings}).status_code == 422


def test_edit_and_retry_conflicts_during_transcription(client, project):
    url = f"/api/projects/{project['id']}"
    assert client.post(url + "/transcribe", json={"script": "native"}).status_code == 200
    assert client.post(url + "/transcribe").status_code == 409
    assert client.patch(url, json={"words": [word(text="edited")]}).status_code == 409
    assert client.patch(url, json={"name": "Renamed"}).status_code == 200
    assert backend.load_project(project["id"])["script"] == "native"


def test_exports_snapshot_before_later_edits(client, project):
    url = f"/api/projects/{project['id']}"
    response = client.post(url + "/exports", json={"mode": "green", "resolution": 720})
    assert response.status_code == 202
    snapshot = backend.EXECUTOR.jobs[0][1][2]
    assert client.patch(url, json={"words": [word(text="updated")]}).status_code == 200
    assert snapshot["words"][0]["text"] == "hello"
    assert client.post(url + "/exports", json={"mode": "burned", "resolution": 720}).status_code == 409
    assert client.get(url + f"/exports/{response.json()['id']}/download").status_code == 409


def test_export_options_4k_and_custom_fps(client, project):
    url = f"/api/projects/{project['id']}"
    # Test valid 4K 60fps export request
    resp = client.post(url + "/exports", json={"mode": "burned", "resolution": 2160, "fps": 60})
    assert resp.status_code == 202
    job_data = resp.json()
    assert job_data["resolution"] == 2160
    assert job_data["fps"] == 60
    job_call = backend.EXECUTOR.jobs[-1]
    assert job_call[1][3] == "burned"
    assert job_call[1][4] == 2160
    assert job_call[1][5] == 60

    # Test rejection of invalid resolution (e.g. 480)
    invalid_res = client.post(url + "/exports", json={"mode": "burned", "resolution": 480, "fps": 30})
    assert invalid_res.status_code == 422

    # Test rejection of invalid fps (e.g. 120)
    invalid_fps = client.post(url + "/exports", json={"mode": "burned", "resolution": 1080, "fps": 120})
    assert invalid_fps.status_code == 422



def test_concurrent_atomic_updates_keep_all_changes(client, project):
    def increment(_):
        backend.update_project(project["id"], lambda value: value.update(counter=value.get("counter", 0) + 1))
    with ThreadPoolExecutor(max_workers=6) as executor:
        list(executor.map(increment, range(20)))
    stored = backend.load_project(project["id"])
    assert stored["counter"] == 20
    assert stored["revision"] == 21
    assert list(backend.project_dir(project["id"]).glob("*.tmp")) == []


def test_restart_marks_interrupted_jobs_retryable(client, project):
    backend.update_project(project["id"], lambda p: p.update(status="processing", exports=[{"id": str(uuid.uuid4()), "status": "queued"}]))
    with TestClient(backend.app):
        restored = backend.load_project(project["id"])
    assert restored["status"] == "error"
    assert "restart" in restored["message"]
    assert restored["exports"][0]["status"] == "error"


def test_alignment_preserves_real_multiword_units():
    segments = [{"words": [{"word": " hello world", "start": .32, "end": 1.23, "probability": .8},
                            {"word": " आज", "start": 1.3, "end": 1.7, "probability": .9}]}]
    words = normalize_words(segments, 2, "roman")
    assert len(words) == 2
    assert words[0]["start"] == .32 and words[0]["end"] == 1.23
    assert words[0]["text"] == "hello world" and words[0]["timingApproximate"]
    assert words[1]["text"] == "aaj" and words[1]["original"] == "आज"


def test_romanization_preserves_english_and_common_hindi():
    assert romanize_hinglish("मैं आज video upload कर रहा हूँ।") == "main aaj video upload kar raha hoon."
    assert romanize_hinglish("OpenAI API") == "OpenAI API"
    # Exercise uroman for a token outside the common-spelling dictionary.
    assert not any("\u0900" <= char <= "\u097f" for char in romanize_hinglish("पुस्तकालय"))


def test_code_mixed_merge_keeps_english_words_in_latin_script():
    words = normalize_words([{"words": [
        {"word": " Come", "start": .0, "end": .3, "probability": .95},
        {"word": " ऑन", "start": .3, "end": .5, "probability": .9},
        {"word": " वीडियो", "start": .5, "end": .9, "probability": .9},
        {"word": " आज", "start": .9, "end": 1.2, "probability": .95},
    ]}], 2, "roman")
    merge_code_mixed_english(words, [{"words": [
        {"word": " Come", "start": .0, "end": .3, "probability": .95},
        {"word": " on", "start": .3, "end": .5, "probability": .9},
        {"word": " video", "start": .5, "end": .9, "probability": .95},
        {"word": " aaj", "start": .9, "end": 1.2, "probability": .95},
    ]}])
    assert [word["text"] for word in words] == ["Come", "on", "video", "aaj"]


def test_english_verifier_repairs_basic_words_without_translating_hindi():
    words = normalize_words([{"words": [
        {"word": " Is", "start": .0, "end": .2, "probability": .75},
        {"word": " something", "start": .2, "end": .42, "probability": .75},
        {"word": " capsules", "start": .64, "end": 1.0, "probability": .75},
        {"word": " baaki", "start": 1.0, "end": 1.3, "probability": .75},
    ]}], 2, "roman")
    merge_code_mixed_english(words, [{"words": [
        {"word": " There", "start": .0, "end": .14, "probability": .497},
        {"word": " is", "start": .14, "end": .24, "probability": .94},
        {"word": " captions", "start": .66, "end": .96, "probability": .88},
        {"word": " the", "start": 1.02, "end": 1.16, "probability": .80},
    ]}])
    assert [word["text"] for word in words] == ["There", "is", "something", "captions", "baaki"]


def test_hinglish_specialist_tokens_keep_true_word_boundaries():
    class Result:
        tokens = ["N", "am", "aste", " d", "ost", "on", ",", " a", "aj", " video"]
        timestamps = [0, .06, .28, .52, .66, .86, 1.02, 1.12, 1.3, 1.5]
        durations = [.06, .22, .24, .14, .2, .16, .1, .18, .2, .3]

    words = _sherpa_tokens_to_words(Result(), 2)
    assert [word["word"] for word in words] == ["Namaste", "doston,", "aaj", "video"]
    assert words[1]["start"] == .52 and words[1]["end"] == 1.12


def test_emphasis_responds_to_measured_loudness():
    rate = 16000
    tone = np.sin(2*np.pi*180*np.arange(rate//2)/rate).astype(np.float32)
    audio = np.concatenate([tone*.04, tone*.04, tone*.3, tone*.04, tone*.04])
    words = [word(id=f"w{i}", start=i*.5, end=(i+1)*.5) for i in range(5)]
    suggest_emphasis(words, audio, rate)
    assert words[2]["emphasis"]
    assert words[2]["emphasisScore"] > words[0]["emphasisScore"] + .25
    assert not words[0]["emphasis"]


def test_emphasis_boosts_hook_keywords_and_dampens_particles():
    rate = 16000
    tone = np.sin(2*np.pi*180*np.arange(rate//2)/rate).astype(np.float32) * .08
    audio = np.concatenate([tone, tone, tone, tone])
    words = [
        word(id="w1", text="Step", start=0.0, end=0.5),
        word(id="w2", text="2", start=0.5, end=1.0),
        word(id="w3", text="ke", start=1.0, end=1.5),
        word(id="w4", text="andar", start=1.5, end=2.0),
    ]
    suggest_emphasis(words, audio, rate)
    # Hook keywords "Step" and "2" receive positive bias over particle "ke"
    assert words[0]["emphasisScore"] > words[2]["emphasisScore"]
    assert not words[2]["emphasis"]  # "ke" should not be emphasized


def test_silence_does_not_load_model_or_invent_words(tmp_path):
    path = tmp_path / "silent.wav"
    path.write_bytes(audio_bytes(silent=True))
    progress = []
    result = transcribe(path, 1, "roman", "hi", lambda *args: progress.append(args))
    assert result["words"] == []
    assert progress == []
    assert not any(result["waveform"])


def test_malformed_project_id_is_not_a_path(client):
    assert client.get("/api/projects/not-a-uuid").status_code == 404


def test_documented_environment_names_take_precedence(monkeypatch):
    monkeypatch.setenv("BOL_ENGINE", "faster-whisper")
    monkeypatch.setenv("BOL_MODEL", "my-local-model")
    monkeypatch.setenv("TRANSCRIPTION_BACKEND", "mlx")
    monkeypatch.setenv("WHISPER_MODEL", "legacy-model")
    assert model_config() == ("faster-whisper", "my-local-model")


def test_audio_preview_preserves_stereo_source_quality(client, project):
    directory = backend.project_dir(project["id"])
    source = directory / "source.bin"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=1",
                    "-ac", "2", "-c:a", "pcm_s16le", "-f", "wav", str(source)], check=True)
    backend.prepare_media(project)
    preview = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(directory / "preview.m4a")], check=True, capture_output=True, text=True).stdout)["streams"][0]
    assert preview["channels"] == 2 and preview["sample_rate"] == "44100"
    rate, samples = wavfile.read(directory / "audio.wav")
    assert rate == 16000 and samples.ndim == 1
    response = client.get(f"/api/projects/{project['id']}/media", headers={"Range": "bytes=0-1023"})
    assert response.status_code == 206 and response.headers["content-type"] == "audio/mp4"


def test_refine_word_boundaries_with_vad_trims_silence():
    rate = 16000
    duration = 3.0
    # Audio with silence 0.0-0.4s, tone 0.4-0.8s, silence 0.8-1.5s, tone 1.5-1.9s, silence 1.9-3.0s
    samples = np.zeros(int(rate * duration), dtype=np.float32)
    t1 = np.arange(int(rate * 0.4)) / rate
    samples[int(rate * 0.4):int(rate * 0.8)] = np.sin(2 * np.pi * 300 * t1) * 0.5
    t2 = np.arange(int(rate * 0.4)) / rate
    samples[int(rate * 1.5):int(rate * 1.9)] = np.sin(2 * np.pi * 300 * t2) * 0.5

    # Simulated stretched Whisper alignments with zero gap
    words = [
        {"id": "w1", "text": "First", "start": 0.0, "end": 1.1},
        {"id": "w2", "text": "Second", "start": 1.1, "end": 2.5},
    ]
    refined = refine_word_boundaries_with_vad(words, samples, rate, duration)
    assert len(refined) == 2
    # w1 leading silence should be trimmed (start moved from 0.0 to ~0.37 with 30ms pre-roll)
    assert refined[0]["start"] >= 0.35
    # w1 trailing silence trimmed (end moved from 1.1 to ~0.84 with 40ms post-roll)
    assert refined[0]["end"] <= 0.86
    # w2 leading silence trimmed (start moved from 1.1 to ~1.47)
    assert refined[1]["start"] >= 1.45
    # w2 trailing silence trimmed (end moved from 2.5 to ~1.95)
    assert refined[1]["end"] <= 1.96

    # A real pause (> 0.5s) is created between w1 and w2
    assert refined[1]["start"] - refined[0]["end"] > 0.5

    # Refined words must strictly satisfy backend validation
    backend.validate_word_intervals(refined, duration)


def test_asset_endpoints_flow(client, project):
    url = f"/api/projects/{project['id']}/assets"
    # Listing assets synthesizes primary asset
    res = client.get(url)
    assert res.status_code == 200
    assets = res.json()
    assert len(assets) == 1
    assert assets[0]["id"] == "primary"
    assert assets[0]["name"] == "My clip"

    # Unsupported format is rejected
    res_bad = client.post(url, files={"file": ("notes.txt", b"hello world", "text/plain")})
    assert res_bad.status_code == 422
    assert "Unsupported file type" in res_bad.text

    # Upload dummy WAV asset
    res_wav = client.post(url, files={"file": ("broll.wav", audio_bytes(), "audio/wav")})
    assert res_wav.status_code == 201
    asset_wav = res_wav.json()
    assert asset_wav["mediaType"] == "audio"
    assert asset_wav["name"] == "broll"
    assert asset_wav["duration"] == 1.0

    # List again shows 2 assets
    res_list = client.get(url)
    assert len(res_list.json()) == 2

    # Patch asset name and greenScreen
    patch_url = f"/api/projects/{project['id']}/assets/{asset_wav['id']}"
    res_patch = client.patch(patch_url, json={"name": "Background Audio", "greenScreen": {"enabled": True, "color": "#00FF00", "tolerance": 50, "spillReduction": True, "smoothEdges": True}})
    assert res_patch.status_code == 200

    # Duplicate asset
    dup_url = f"/api/projects/{project['id']}/assets/{asset_wav['id']}/duplicate"
    res_dup = client.post(dup_url)
    assert res_dup.status_code == 200
    dup_asset = res_dup.json()
    assert dup_asset["name"] == "Background Audio copy"
    assert dup_asset["filename"] == "Background Audio copy.wav"

    # Delete asset
    del_url = f"/api/projects/{project['id']}/assets/{dup_asset['id']}"
    res_del = client.delete(del_url)
    assert res_del.status_code == 200

    # Verify count is back to 2
    assert len(client.get(url).json()) == 2



def test_caption_defaults_are_shared_with_the_browser():
    """server/app.py and src/lib/types.ts must not restate caption defaults.

    They previously disagreed on template, accent and wordsPerLine, so a project
    created through the API opened with different captions than one created in
    the editor.
    """
    import json
    from pathlib import Path

    shared = json.loads(
        (Path(__file__).resolve().parent.parent / "src" / "lib" / "caption-defaults.json").read_text()
    )
    assert backend.DEFAULT_SETTINGS == shared
    # Optional extras (accentSecondary and friends) may exist beyond the shared
    # defaults; what must not drift are the values both sides do define.
    produced = backend.Settings().model_dump()
    assert {k: produced[k] for k in shared} == shared


def test_backend_accepts_every_template_the_picker_offers():
    """app.py and the caption picker must agree on the template list.

    The backend used to carry its own hardcoded Literal, so a template added in
    the editor was rejected on save with a validation error.
    """
    import json
    from pathlib import Path

    listed = {
        t["id"]
        for t in json.loads(
            (Path(__file__).resolve().parent.parent / "src" / "lib" / "caption-templates.json").read_text()
        )
    }
    assert listed == backend.TEMPLATE_IDS
    for template_id in sorted(listed):
        assert backend.Settings(template=template_id).template == template_id


def test_exports_default_to_60fps():
    """A 0.42s preset entrance is 25 frames at 60 and 12 at 30."""
    assert backend.ExportRequest(mode="burned", resolution=720).fps == 60
    assert backend.ExportRequest(mode="burned", resolution=720, fps=30).fps == 30


def test_caption_font_must_be_one_we_offer():
    """fontFamily is interpolated into a CSS font-family in the renderer."""
    assert backend.Settings(fontFamily="Poppins").fontFamily == "Poppins"
    assert backend.Settings().fontFamily is None
    with pytest.raises(Exception):
        backend.Settings(fontFamily='"; content: url(x)')


def test_api_key_gate_is_open_when_no_key_is_configured(client):
    """Local development must need no configuration."""
    assert backend.API_KEY == ""
    assert client.get("/api/projects").status_code == 200


def test_api_key_gate_closes_when_a_key_is_configured(client, monkeypatch):
    """A deployed backend was reachable by anyone who knew the URL.

    The key is a deterrent, not authentication — it ships in the frontend
    bundle — but it stops drive-by traffic against a public deployment.
    """
    monkeypatch.setattr(backend, "API_KEY", "secret-123")

    assert client.get("/api/projects").status_code == 401
    assert client.get("/api/projects", headers={"X-API-Key": "wrong"}).status_code == 401
    assert client.get("/api/projects", headers={"X-API-Key": "secret-123"}).status_code == 200
    assert client.get(
        "/api/projects", headers={"Authorization": "Bearer secret-123"}
    ).status_code == 200
    # <video src> and <img src> cannot set headers, so a query parameter works too.
    assert client.get("/api/projects?key=secret-123").status_code == 200
    # The landing page and health check stay open so the Space reads as up.
    assert client.get("/api/health").status_code == 200


def test_cors_does_not_default_to_every_origin():
    """The deployed Space reflected any Origin back, so any page a visitor had
    open could call this API from their browser."""
    assert "*" not in backend.ALLOWED_ORIGINS
    assert any("localhost:5173" in origin for origin in backend.ALLOWED_ORIGINS)


def test_glossary_replaces_only_terms_the_creator_supplied():
    """The recogniser spells brand names phonetically, and only the creator
    knows the right spelling — so this never guesses at a word it was not told
    about. "Ewa" is a real name the model got right; it must survive."""
    from server.glossary import apply_glossary

    def word(text, start, end):
        return {"text": text, "start": start, "end": end, "original": text}

    spoken = [
        word("go", 0.7, 0.9), word("to", 0.9, 1.0), word("kalaakaar", 1.0, 1.7),
        word("dot", 1.7, 1.9), word("I", 1.9, 2.0), word("O", 2.0, 2.2),
    ]
    out = apply_glossary(spoken, ["kalakar.io"])
    assert [w["text"] for w in out] == ["go", "to", "kalakar.io"]

    merged = out[-1]
    assert merged["start"] == 1.0 and merged["end"] == 2.2, "the run keeps its full span"
    assert merged["original"] == "kalaakaar dot I O", "the spoken form is preserved"
    assert merged["fromGlossary"] is True

    untouched = apply_glossary(
        [word("Ewa", 0, 0.3), word("ko", 0.3, 0.5), word("dekh", 0.5, 0.8)],
        ["kalakar.io", "Bol Studio"],
    )
    assert [w["text"] for w in untouched] == ["Ewa", "ko", "dekh"]

    # The longest matching term wins, so "Bol" never shadows "Bol Studio".
    both = apply_glossary([word("bol", 0, 0.3), word("studio", 0.3, 0.7)], ["Bol Studio", "Bol"])
    assert [w["text"] for w in both] == ["Bol Studio"]

    # No glossary is a no-op.
    assert [w["text"] for w in apply_glossary(spoken, [])] == [w["text"] for w in spoken]


def test_glossary_round_trips_through_the_api(client):
    project = client.post("/api/projects", files={"file": ("clip.wav", audio_bytes(), "audio/wav")}).json()
    patched = client.patch(
        f"/api/projects/{project['id']}",
        json={"glossary": ["kalakar.io", "  Bol Studio  ", ""]},
    )
    assert patched.status_code == 200
    assert patched.json()["glossary"] == ["kalakar.io", "Bol Studio"], "blank terms dropped, whitespace trimmed"


def test_a_word_may_carry_the_glossary_flag():
    """transcribe() marks replaced words, and Word forbids unknown fields, so
    the flag has to be declared or every save would 422."""
    assert backend.Word(
        id="w1", text="kalakar.io", original="kalaakaar dot I O", start=0.0, end=1.0,
        confidence=1.0, emphasis=False, emphasisScore=0.5, fromGlossary=True,
    ).fromGlossary is True


def test_vocal_isolation_is_opt_in_and_round_trips(client):
    """Off by default: on a clean voiceover there is nothing to remove and it
    only costs time."""
    project = client.post("/api/projects", files={"file": ("clip.wav", audio_bytes(), "audio/wav")}).json()
    assert not project.get("isolateVocals")

    turned_on = client.patch(f"/api/projects/{project['id']}", json={"isolateVocals": True})
    assert turned_on.status_code == 200
    assert turned_on.json()["isolateVocals"] is True


def test_vocal_isolation_declines_rather_than_degrading(monkeypatch, tmp_path):
    """Every failure path returns None so the caller keeps the original audio.
    A transcription with background music beats no transcription at all."""
    from pathlib import Path
    from server import denoise

    monkeypatch.setattr(denoise, "available", lambda: False)
    assert denoise.isolate_vocals_from_source(Path("/nonexistent.mp4"), 16000, 100) is None

    monkeypatch.setattr(denoise, "available", lambda: True)
    assert denoise.isolate_vocals_from_source(tmp_path / "missing.mp4", 16000, 100) is None


def test_vocal_isolation_separates_at_the_source_rate_not_the_16k_copy():
    """Separating the 16 kHz recognition copy degraded clean speech: upsampled
    to the model's 44.1 kHz it carries no energy above 8 kHz, nothing like the
    training data, and the recogniser hallucinated a word off the artefacts.
    Only the source-reading entry point should exist."""
    from server import denoise

    assert hasattr(denoise, "isolate_vocals_from_source")
    assert not hasattr(denoise, "isolate_vocals"), (
        "the 16 kHz round-trip made clean audio worse and must not come back"
    )
    assert denoise.MODEL_RATE == 44100


def test_export_length_cap_is_off_locally_and_refuses_up_front_when_set(client, project, monkeypatch):
    """Rendering is CPU work — headless Chromium plus libx264, no GPU — and a
    20-minute export measured 26 minutes on an M2. On shared hosting that can
    outrun the watchdog, and a container restart loses the output. Refusing at
    the start beats failing an hour in."""
    # Unset: no limit, which is the local default.
    assert backend.MAX_EXPORT_SECONDS == 0
    assert client.get("/api/limits").json()["maxExportSeconds"] is None

    # Set below this clip's duration: refused, with a message that says what to do.
    monkeypatch.setattr(backend, "MAX_EXPORT_SECONDS", 1.0)
    refused = client.post(
        f"/api/projects/{project['id']}/exports",
        json={"mode": "burned", "resolution": 720},
    )
    assert refused.status_code == 422
    detail = refused.json()["detail"]
    assert "SRT" in detail and "locally" in detail, detail

    # Set above it: allowed through.
    monkeypatch.setattr(backend, "MAX_EXPORT_SECONDS", 600.0)
    allowed = client.post(
        f"/api/projects/{project['id']}/exports",
        json={"mode": "burned", "resolution": 720},
    )
    assert allowed.status_code == 202
    assert client.get("/api/limits").json()["maxExportSeconds"] == 600.0


def test_words_per_line_is_clamped_to_the_shared_ceiling_not_rejected(client, project):
    """A project saved when the bound was 8 still has to open.

    The editor's generate slider once reached 12 and wrote straight into
    wordsPerLine, so stored projects exist above the ceiling. Rejecting them
    would lock the creator out of their own work; they are clamped instead, to
    the same number src/lib/pages.ts enforces when it builds the pages.
    """
    url = f"/api/projects/{project['id']}"
    for asked in (8, 12, 99):
        response = client.patch(url, json={"settings": {"wordsPerLine": asked}})
        assert response.status_code == 200, response.text
        assert response.json()["settings"]["wordsPerLine"] == backend.MAX_WORDS_PER_LINE

    # Anything the slider can actually produce is stored untouched.
    assert client.patch(url, json={"settings": {"wordsPerLine": 4}}).json()["settings"]["wordsPerLine"] == 4


def test_explicit_line_breaks_survive_a_save(client, project):
    """The editor's line decisions ride on the word, so they have to round-trip.

    They used to be expressed by appending a full stop to the word's text, which
    needed no schema support but also put punctuation into the caption that
    nobody spoke. Word is extra="forbid", so an undeclared lineBreak would 422
    every save made after splitting a line by hand.
    """
    url = f"/api/projects/{project['id']}"
    base = client.get(url).json()["words"][0]
    words = [copy.deepcopy(base) | {"id": f"w{i}", "start": 0.1 + i * 0.3, "end": 0.3 + i * 0.3}
             for i in range(3)]
    words[0]["lineBreak"] = True
    words[1]["lineBreak"] = False

    response = client.patch(url, json={"words": words})
    assert response.status_code == 200, response.text
    saved = response.json()["words"]
    assert saved[0]["lineBreak"] is True
    assert saved[1]["lineBreak"] is False
    # Untouched words stay undecided rather than defaulting to a break.
    assert all(w.get("lineBreak") is None for w in saved[2:])


@pytest.mark.parametrize("label,script,language", [
    ("Hinglish", "roman", "auto"),
    ("Hindi", "native", "hi"),
    ("English", "native", "en"),
])
def test_post_upload_language_choices_are_all_accepted(client, project, label, script, language):
    """The three choices the post-upload prompt offers must each be valid.

    The prompt collapses two axes — spoken language, and the script it is
    written in — into the three combinations people actually mean. Nothing else
    checks that those pairings survive TranscribeRequest, and a rejected pair
    would surface as a failed transcription right after upload.
    """
    response = client.post(
        f"/api/projects/{project['id']}/transcribe",
        json={"script": script, "language": language},
    )
    assert response.status_code == 200, f"{label}: {response.text}"
    saved = response.json()
    assert saved["script"] == script
    assert saved["language"] == language


def test_emoji_matches_meaning_and_leaves_ordinary_words_alone():
    """The vocabulary supplies the taste; the encoder supplies the synonyms.

    A plain cosine threshold cannot separate the two groups — measured over real
    transcript words, matches bottom out near 0.32 while noise peaks near 0.44 —
    so a listed keyword is an exact hit and the model is held to a high bar for
    everything else. This pins both halves of that.
    """
    if not emoji_module.available():
        pytest.skip("sentence-transformers is optional; emoji suggestion is a no-op without it")

    words = [{"text": w} for w in
             "the most important thing is your time and your brain".split()]
    emoji_module.suggest_emoji(words)
    picked = {w["text"]: w["emoji"] for w in words if w.get("emoji")}
    assert picked == {"important": "❗", "time": "⏰", "brain": "🧠"}

    # Function words and vague nouns carry no image. These are what make
    # automatic emoji look cheap, so none of them may match at any score.
    plain = [{"text": w} for w in
             "because these words belong to the same thing and nothing else".split()]
    emoji_module.suggest_emoji(plain)
    assert not [w for w in plain if w.get("emoji")]

    # "money" sits in the money bag's keywords and not the flying note's, so the
    # two cannot trade places the way they did when both listed it.
    money = [{"text": "money"}, {"text": "cash"}]
    emoji_module.suggest_emoji(money)
    assert [w.get("emoji") for w in money] == ["💰", "💰"]


def test_translation_moves_off_the_hinglish_specialist_and_forces_english_output():
    """Translating has to change the model, not just set a flag.

    sherpa-hinglish is a Roman-Hinglish model with no translate task. Asking it
    to translate returns an ordinary Hinglish transcript labelled English — a
    result that looks entirely successful and is wrong, which is worse than the
    feature being unavailable.
    """
    plan = transcription_module.decode_plan

    # Ordinary Hinglish: the specialist keeps the job.
    assert plan("sherpa-hinglish", "hinglish", "roman", False) == ("sherpa-hinglish", "hinglish", "roman")

    # Translating: off the specialist, and the romanisation pass is switched
    # off with it — the words are already English.
    backend, model, script = plan("sherpa-hinglish", "hinglish", "roman", True)
    assert backend != "sherpa-hinglish"
    assert model != "hinglish"
    assert script == "native"

    # Native Devanagari already had this fallback; translating must not undo it.
    assert plan("sherpa-hinglish", "hinglish", "native", False)[0] != "sherpa-hinglish"

    # A multilingual backend is left alone apart from the script decision.
    assert plan("faster-whisper", "large-v3", "roman", True) == ("faster-whisper", "large-v3", "native")
    assert plan("faster-whisper", "large-v3", "roman", False) == ("faster-whisper", "large-v3", "roman")


@pytest.mark.parametrize("translate", [True, False])
def test_transcribe_accepts_the_translate_flag(client, project, translate):
    response = client.post(f"/api/projects/{project['id']}/transcribe",
                           json={"language": "hi", "script": "native", "translate": translate})
    assert response.status_code == 200, response.text
    assert response.json()["translate"] is translate


def test_deployed_requirements_match_the_local_ones():
    """A Space rebuild must not quietly ship fewer features than a checkout.

    The Dockerfile installs server/requirements-cpu.txt, which includes
    server/requirements.txt — a different file from the root requirements.txt a
    local checkout uses. Vocal isolation and emoji suggestion were added to the
    root one and not the deployed one, and because both degrade to a no-op when
    their dependency is missing, the Space would have reported them unavailable
    with nothing failing and nothing to notice.
    """
    repo = Path(__file__).resolve().parent.parent

    def packages(path):
        """Every package pip would install, following -r includes the way pip does."""
        names = set()
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("-r"):
                names |= packages(path.parent / line.split(maxsplit=1)[1].strip())
                continue
            names.add(re.split(r"[<>=;\[ ]", line)[0].lower())
        return names

    # The Dockerfile installs the -cpu file, which pulls in the other one.
    missing = packages(repo / "requirements.txt") - packages(repo / "server" / "requirements-cpu.txt")
    assert not missing, (
        f"these are installed locally but not on a deployed Space: {sorted(missing)}. "
        "Add them to server/requirements.txt, or the feature silently disappears there."
    )


def test_a_workspace_cannot_see_or_touch_another_ones_projects(client):
    """Two people sharing a deployment must not share a workspace.

    /api/projects returned every project on the server, so a second visitor saw
    the first one's uploads listed as their own and could open, edit and delete
    them. This is the check that stops that, and it is enforced in middleware
    rather than per endpoint: seventeen routes sit under /api/projects/{id}, and
    a missing check on any one of them reads exactly like a working endpoint.
    """
    def upload(owner):
        response = client.post(
            "/api/projects",
            files={"file": ("clip.wav", audio_bytes(), "audio/wav")},
            headers={"X-Bol-Owner": owner},
        )
        assert response.status_code == 201, response.text
        return response.json()["id"]

    mine = upload("alice")
    theirs = upload("bob")

    # Each of us lists only our own.
    listed = lambda owner: {p["id"] for p in client.get("/api/projects", headers={"X-Bol-Owner": owner}).json()}
    assert mine in listed("alice") and theirs not in listed("alice")
    assert theirs in listed("bob") and mine not in listed("bob")

    # Reading, editing and exporting someone else's is refused — as 404, because
    # whether it exists is not the caller's business either.
    alice = {"X-Bol-Owner": "alice"}
    assert client.get(f"/api/projects/{theirs}", headers=alice).status_code == 404
    assert client.patch(f"/api/projects/{theirs}", json={"name": "stolen"}, headers=alice).status_code == 404
    assert client.get(f"/api/projects/{theirs}/media", headers=alice).status_code == 404
    # Bob gets his own media, so the 404 above is the ownership refusal and not
    # something every caller would have seen.
    assert client.get(f"/api/projects/{theirs}/media", headers={"X-Bol-Owner": "bob"}).status_code == 200
    assert client.get(f"/api/projects/{theirs}/assets", headers=alice).status_code == 404

    # Bob's project is untouched by the attempt.
    assert client.get(f"/api/projects/{theirs}", headers={"X-Bol-Owner": "bob"}).json()["name"] == "clip"

    # The query-string form works too: <video src> cannot send headers.
    assert client.get(f"/api/projects/{theirs}/media?owner=alice").status_code == 404


def test_projects_without_an_owner_stay_visible_so_nothing_needs_migrating(client):
    """Every project created before this existed has no owner field.

    Scoping those to nobody would have hidden the user's own work behind an
    upgrade, and a local checkout sends no header at all. An unowned project is
    therefore visible to everyone, which is what keeps `npm run dev` working
    with no configuration and makes deploying this a no-op for existing data.
    """
    response = client.post("/api/projects", files={"file": ("clip.wav", audio_bytes(), "audio/wav")})
    legacy = response.json()["id"]
    assert response.json().get("owner") == "", "no header means no owner is stamped"

    for owner in ({}, {"X-Bol-Owner": "alice"}, {"X-Bol-Owner": "bob"}):
        assert client.get(f"/api/projects/{legacy}", headers=owner).status_code == 200
        assert legacy in {p["id"] for p in client.get("/api/projects", headers=owner).json()}


def test_the_space_entrypoint_actually_enforces_the_gate(monkeypatch, tmp_path):
    """The deployment must not quietly drop every protection it has.

    Two separate ways this broke, both invisible from outside. First the
    entrypoint did `demo.app.include_router(app.router)`, which copies routes
    and no middleware — every protection here is middleware, so the Space ran
    with the API key gate, the per-workspace check and the CORS allowlist all
    missing while each endpoint answered perfectly. Then, once the middleware
    was registered, it was registered on `demo.app` — a different object from
    the one `demo.launch()` builds, so it was discarded before the first
    request and the routes went with it.

    Both times the middleware looked right when inspected. So this drives the
    entrypoint's app with real requests instead of reading its attributes,
    because reading them is what gave the wrong answer twice.
    """
    pytest.importorskip("gradio", reason="the Spaces entrypoint needs gradio")
    pytest.importorskip("spaces", reason="the Spaces entrypoint needs the ZeroGPU shim")

    monkeypatch.setenv("BOL_API_KEY", "gate-open-sesame")
    import importlib
    import server.app as server_module
    importlib.reload(server_module)
    entrypoint = importlib.reload(importlib.import_module("app"))
    monkeypatch.setattr(server_module, "DATA_DIR", tmp_path)

    with TestClient(entrypoint.application) as client:
        assert client.get("/api/projects").status_code == 401, "no key must be refused"
        assert client.get("/api/projects", headers={"X-API-Key": "wrong"}).status_code == 401
        ok = client.get("/api/projects", headers={"X-API-Key": "gate-open-sesame"})
        assert ok.status_code == 200, "the right key must get through"
        # And our routes are actually mounted, not just Gradio's.
        assert client.get("/api/limits", headers={"X-API-Key": "gate-open-sesame"}).status_code == 200

    # Clear the variable before reloading, not after. API_KEY is read at module
    # level, so a reload while it is still set leaves the gate armed for every
    # test that follows — monkeypatch undoes the environment after this function
    # returns, which is too late to help.
    monkeypatch.delenv("BOL_API_KEY", raising=False)
    importlib.reload(server_module)
    assert not server_module.API_KEY, "the gate must not stay armed for later tests"


def test_the_key_guards_our_api_and_nothing_else(monkeypatch):
    """The gate must not answer requests that were never its business.

    Gradio calls its own endpoints from inside the container while booting —
    /gradio_api/startup-events among them — with no key. Guarding every path
    answered those with 401, and the Space failed to start at all: a gate doing
    its job to the wrong request, which looks identical to a broken deployment.
    """
    monkeypatch.setattr(backend, "API_KEY", "any-key")
    assert backend._is_guarded("/api/projects")
    assert backend._is_guarded("/api/projects/abc/exports")
    # Gradio's own surface, and the landing page, are not ours to guard.
    for path in ("/", "/gradio_api/startup-events", "/theme.css", "/assets/index.js"):
        assert not backend._is_guarded(path), f"{path} must not need our key"
    # Health stays reachable so uptime checks work without a key.
    assert not backend._is_guarded("/api/health")


def test_an_unlisted_origin_loses_its_cors_header_even_if_something_else_set_it(monkeypatch):
    """Gradio installs its own CORS middleware and reflected any origin back.

    On the deployment a request from https://evil.example came back with
    access-control-allow-origin set to exactly that, so any page a visitor had
    open could call this API from their browser. Our own CORSMiddleware cannot
    prevent it — it sits further out, and it does not overwrite a header an
    inner layer already set — so the header is checked on the way out instead.
    """
    monkeypatch.setattr(backend, "ALLOWED_ORIGINS", ["https://www.bol-studio.me"])

    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    from starlette.middleware.base import BaseHTTPMiddleware

    inner = FastAPI()

    @inner.get("/x")
    def _x():
        return {"ok": True}

    # Stand in for Gradio's middleware: reflect whatever origin it is given.
    async def reflect(request, call_next):
        response = await call_next(request)
        if origin := request.headers.get("origin"):
            response.headers["access-control-allow-origin"] = origin
        return response

    inner.add_middleware(BaseHTTPMiddleware, dispatch=reflect)
    inner.add_middleware(BaseHTTPMiddleware, dispatch=backend.strip_foreign_cors)

    with TestClient(inner) as client:
        evil = client.get("/x", headers={"Origin": "https://evil.example"})
        assert "access-control-allow-origin" not in evil.headers, (
            "an unlisted origin must not be told it is allowed, whoever set the header"
        )
        ours = client.get("/x", headers={"Origin": "https://www.bol-studio.me"})
        assert ours.headers.get("access-control-allow-origin") == "https://www.bol-studio.me"
        # No Origin at all is a same-origin or server-side call; nothing to strip.
        assert client.get("/x").status_code == 200


def test_an_upload_costs_about_its_own_size_on_disk(client, monkeypatch):
    """Storage was roughly three times the uploaded file, most of it needless.

    Every upload kept the original, an uncompressed 16 kHz wav for the
    recogniser, and a re-encoded preview written at crf 19 up to 1920px — export
    quality for a file that is only ever scrubbed. A 3.3 MB clip became 10.4 MB,
    and the preview alone was larger than the video it came from.

    Most uploads are already h264 and aac, which a browser plays directly, so
    they are remuxed in place rather than re-encoded and no preview is written.
    This pins that: after preparing, the stored bytes stay close to the upload.
    """
    audio = audio_bytes()
    response = client.post("/api/projects", files={"file": ("clip.wav", audio, "audio/wav")})
    assert response.status_code == 201
    project = response.json()
    directory = backend.DATA_DIR / project["id"]

    backend.prepare_media(project)
    # A wav upload is not browser-playable, so this one does get a preview —
    # the point is that it is a small one, not a near-lossless copy.
    stored = {f.name: f.stat().st_size for f in directory.iterdir() if f.is_file()}
    assert "source.bin" in stored

    # The recogniser's copy is removed once transcription has run; simulate that
    # step rather than running a real model here.
    (directory / "audio.wav").unlink(missing_ok=True)
    after = sum(f.stat().st_size for f in directory.iterdir() if f.is_file())
    assert after < len(audio) * 2, (
        f"stored {after} bytes for a {len(audio)}-byte upload; the derived copies "
        "are supposed to be small or absent, not a multiple of the original"
    )
