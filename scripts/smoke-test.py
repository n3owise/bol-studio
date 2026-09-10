#!/usr/bin/env python3
"""Exercise the running local API with explicitly labelled synthetic speech.

This is an integration check, not an ASR accuracy benchmark. Original recognizer
output is saved before any editor test changes, alongside an exact edit record.
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import re
import subprocess
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "data" / "test-fixtures"
OUTPUT = FIXTURES / "smoke-output"
POLL_TIMEOUT = 300


def save_json(name: str, value):
    (OUTPUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2))


def check_response(response: httpx.Response) -> httpx.Response:
    if response.is_error:
        raise RuntimeError(f"{response.request.method} {response.request.url.path} returned {response.status_code}: {response.text[:500]}")
    return response


def wait_project(client: httpx.Client, project_id: str) -> dict:
    deadline = time.monotonic() + POLL_TIMEOUT
    previous = None
    while time.monotonic() < deadline:
        project = check_response(client.get(f"/projects/{project_id}")).json()
        marker = (project["status"], project["progress"])
        if marker != previous:
            print(f"Transcription {marker[0]} {marker[1]}%: {project['message']}", flush=True)
            previous = marker
        if project["status"] == "ready":
            return project
        if project["status"] == "error":
            raise RuntimeError(project["message"])
        time.sleep(2)
    raise TimeoutError("Transcription did not finish within five minutes.")


def validate_words(project: dict, native: bool = False):
    assert project["words"], "No speech words were produced."
    previous_end = 0.0
    for word in project["words"]:
        assert word["text"].strip()
        assert math.isfinite(word["start"]) and math.isfinite(word["end"])
        assert previous_end <= word["start"] < word["end"] <= project["duration"] + .001
        assert 0 <= word["confidence"] <= 1 and 0 <= word["emphasisScore"] <= 1
        previous_end = word["end"]
        if native:
            assert word["text"] == word["original"], "Native output unexpectedly rewrote the original token."
    if native:
        assert re.search(r"[\u0900-\u097f]", " ".join(w["text"] for w in project["words"])), "Native output has no Hindi script."


def upload(client: httpx.Client, filename: str, script: str, name: str) -> dict:
    print(f"Uploading synthetic {filename} ({script})", flush=True)
    with (FIXTURES / filename).open("rb") as handle:
        response = check_response(client.post("/projects", files={"file": (filename, handle)}, data={"script": script, "language": "hi"}))
    project = response.json()
    check_response(client.patch(f"/projects/{project['id']}", json={"name": name}))
    project = wait_project(client, project["id"])
    validate_words(project, native=script == "native")
    return project


def check_range(client: httpx.Client, project: dict):
    response = check_response(client.get(f"/projects/{project['id']}/media", headers={"Range": "bytes=0-1023"}))
    assert response.status_code == 206, f"Media seeking needs 206, got {response.status_code}."
    assert response.headers["content-range"].startswith("bytes 0-1023/")
    assert len(response.content) == 1024
    return {"status": response.status_code, "contentType": response.headers["content-type"], "contentRange": response.headers["content-range"]}


def probe(path: Path) -> dict:
    result = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def render_and_download(client: httpx.Client, project: dict, mode: str, filename: str) -> dict:
    response = check_response(client.post(f"/projects/{project['id']}/exports", json={"mode": mode, "resolution": 720}))
    job_id = response.json()["id"]
    deadline, previous = time.monotonic() + POLL_TIMEOUT, None
    while time.monotonic() < deadline:
        current = check_response(client.get(f"/projects/{project['id']}")).json()
        job = next(j for j in current["exports"] if j["id"] == job_id)
        marker = (job["status"], job["progress"])
        if marker != previous:
            print(f"Export {mode}: {marker[0]} {marker[1]}%", flush=True)
            previous = marker
        if job["status"] == "error":
            raise RuntimeError(job["message"])
        if job["status"] == "ready":
            break
        time.sleep(2)
    else:
        raise TimeoutError("Export did not finish within five minutes.")
    response = check_response(client.get(f"/projects/{project['id']}/exports/{job_id}/download"))
    path = OUTPUT / filename
    path.write_bytes(response.content)
    metadata = probe(path)
    video = next(s for s in metadata["streams"] if s["codec_type"] == "video")
    audio = [s for s in metadata["streams"] if s["codec_type"] == "audio"]
    assert video["avg_frame_rate"] == "30/1", "Video should play at 30fps."
    assert video["codec_name"] == "h264"
    assert abs(float(metadata["format"]["duration"]) - project["duration"]) < .15
    assert bool(audio) == (mode == "burned"), "Burned exports retain audio; green overlays must be silent."
    if audio:
        assert audio[0]["codec_name"] == "aac"
    if mode == "green":
        pixel = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-frames:v", "1", "-vf", "crop=2:2:0:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], check=True, capture_output=True).stdout[:3]
        assert pixel[0] < 20 and pixel[1] > 230 and pixel[2] < 20, f"Expected a green background, found {list(pixel)}."
    print(f"Verified {filename}: {video['width']}×{video['height']}, 30fps, audio={bool(audio)}", flush=True)
    return {"job": job, "path": str(path), "metadata": metadata}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:5173/api")
    arguments = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {"purpose": "Synthetic local API integration test only; not an accuracy benchmark.", "baseUrl": arguments.base_url, "edits": []}
    # HTTPX resolves a leading slash against base_url's path, so the base keeps
    # a trailing slash and calls use relative URLs through this tiny subclass.
    class ApiClient(httpx.Client):
        def request(self, method, url, *args, **kwargs):
            return super().request(method, str(url).lstrip("/"), *args, **kwargs)
    try:
        with ApiClient(base_url=arguments.base_url.rstrip("/") + "/", timeout=60) as client:
            report["health"] = check_response(client.get("/health")).json()
            roman = upload(client, "hinglish.mp4", "roman", "Hinglish test · synthetic voice")
            save_json("original-asr-roman.json", roman)
            report["romanProjectId"] = roman["id"]
            report["romanOriginalTranscript"] = " ".join(w["text"] for w in roman["words"])
            print("Unedited Roman transcript: " + report["romanOriginalTranscript"], flush=True)
            report["videoRange"] = check_range(client, roman)
            edited = copy.deepcopy(roman)
            first = edited["words"][0]
            before = copy.deepcopy(first)
            # Purely mechanical editor checks; never correct a recognition error
            # or replace the model transcript with the known reference text.
            first["text"] = first["text"].upper()
            if first["text"] == before["text"]:
                first["text"] += "!"
            first["emphasis"] = not first["emphasis"]
            edited["settings"].update(template="bounce", accent="#ff8bb5", motion=1.25)
            report["edits"] = [{"reason": "Mechanical editor persistence check; no ASR error correction.", "wordBefore": before, "wordAfter": copy.deepcopy(first),
                                "settingsBefore": roman["settings"], "settingsAfter": edited["settings"]}]
            response = check_response(client.patch(f"/projects/{roman['id']}", json={"words": edited["words"], "settings": edited["settings"], "revision": roman["revision"]}))
            persisted = check_response(client.get(f"/projects/{roman['id']}")).json()
            assert persisted["words"] == response.json()["words"] == edited["words"]
            assert persisted["settings"] == edited["settings"]
            save_json("edited-project.json", persisted)
            report["burnedExport"] = render_and_download(client, persisted, "burned", "hinglish-burned.mp4")
            report["greenExport"] = render_and_download(client, persisted, "green", "hinglish-green.mp4")
            native = upload(client, "hinglish.wav", "native", "Hinglish test · synthetic voice · native audio")
            save_json("original-asr-native.json", native)
            report["nativeProjectId"] = native["id"]
            report["nativeOriginalTranscript"] = " ".join(w["text"] for w in native["words"])
            print("Unedited native transcript: " + report["nativeOriginalTranscript"], flush=True)
            report["audioRange"] = check_range(client, native)
            assert report["audioRange"]["contentType"].startswith("audio/mp4"), "Audio playback should use the source-quality AAC preview."
            report["nativeAudioExport"] = render_and_download(client, native, "burned", "native-audio-burned.mp4")
            report["reference"] = json.loads((FIXTURES / "manifest.json").read_text())["speech_fixtures"][0]
            report["status"] = "passed"
            print("All API integration checks passed. Original ASR output and exact test edits are saved separately.", flush=True)
    except Exception as exc:
        report.update(status="failed", error=str(exc))
        raise
    finally:
        save_json("report.json", report)


if __name__ == "__main__":
    main()
