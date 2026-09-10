"""Local API: persisted projects, one compute queue, real transcription and exports."""
from __future__ import annotations

import asyncio
import copy
import json
import logging
import math
import os
import re
import shutil
import subprocess
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator

from server.transcription import model_status, transcribe

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(ROOT / "data"))).resolve()
MAX_BYTES = 1024 * 1024 * 1024
MAX_DURATION = 20 * 60
LOCK = threading.RLock()
EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="bol-worker")
LOGGER = logging.getLogger("bol")
DEFAULT_SETTINGS = {"template": "karaoke", "accent": "#c2a1ff", "fontSize": 54, "position": 70,
                    "wordsPerLine": 4, "uppercase": False, "motion": 1, "aspect": "original"}


def project_dir(project_id: str) -> Path:
    try:
        if str(uuid.UUID(project_id)) != project_id:
            raise ValueError
    except (ValueError, AttributeError):
        raise HTTPException(404, "Project not found.")
    return DATA_DIR / project_id


def load_project(project_id: str) -> dict:
    with LOCK:
        path = project_dir(project_id) / "project.json"
        if not path.is_file():
            raise HTTPException(404, "Project not found.")
        return json.loads(path.read_text())


def write_project(project: dict) -> None:
    with LOCK:
        directory = project_dir(project["id"])
        directory.mkdir(parents=True, exist_ok=True)
        temporary = directory / f".project-{uuid.uuid4()}.tmp"
        try:
            with temporary.open("w") as handle:
                json.dump(project, handle, ensure_ascii=False, allow_nan=False)
                handle.flush()
                os.fsync(handle.fileno())
            temporary.replace(directory / "project.json")
        finally:
            temporary.unlink(missing_ok=True)


def update_project(project_id: str, change) -> dict:
    with LOCK:
        project = load_project(project_id)
        change(project)
        project["revision"] = project.get("revision", 0) + 1
        write_project(project)
        return copy.deepcopy(project)


def set_progress(project_id: str, progress: int, message: str) -> None:
    update_project(project_id, lambda p: p.update(progress=progress, message=message))


def run_process(args: list[str], timeout: int = 120) -> subprocess.CompletedProcess:
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        raise ValueError(f"{Path(args[0]).name} is missing. Install FFmpeg and restart the server.")
    except subprocess.TimeoutExpired:
        raise ValueError("Media processing took too long. Try a shorter clip.")
    if result.returncode:
        LOGGER.error("Media command failed: %s", result.stderr[-2000:])
        raise ValueError("The media could not be decoded. Please upload a valid video or audio file.")
    return result


def inspect_media(path: Path) -> dict:
    result = run_process(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)], 45)
    try:
        info = json.loads(result.stdout)
        streams = info.get("streams", [])
        audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
        video = next((s for s in streams if s.get("codec_type") == "video" and not s.get("disposition", {}).get("attached_pic")), None)
        duration = float(info.get("format", {}).get("duration") or (audio or {}).get("duration") or 0)
    except (ValueError, TypeError):
        raise ValueError("The file has invalid media metadata.")
    if not audio:
        raise ValueError("This file has no audio track to transcribe.")
    if not math.isfinite(duration) or duration <= .05:
        raise ValueError("The file has no readable duration or is too short.")
    if duration > MAX_DURATION:
        raise ValueError("Please upload a clip of 20 minutes or less.")
    width, height = (int(video.get("width", 0)), int(video.get("height", 0))) if video else (720, 1280)
    if video and (min(width, height) < 1 or max(width, height) > 8192):
        raise ValueError("The video dimensions are unsupported (maximum 8192 pixels).")
    if video:
        rotation = next((s.get("rotation", 0) for s in video.get("side_data_list", []) if "rotation" in s), video.get("tags", {}).get("rotate", 0))
        if int(float(rotation)) % 180:
            width, height = height, width
    return {"duration": round(duration, 3), "width": width, "height": height,
            "mediaType": "video" if video else "audio"}


def prepare_media(project: dict) -> None:
    directory = project_dir(project["id"])
    source = directory / "source.bin"
    if not (directory / "audio.wav").is_file():
        run_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-map", "0:a:0",
                     "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(directory / "audio.tmp.wav")], 300)
        (directory / "audio.tmp.wav").replace(directory / "audio.wav")
    if project["mediaType"] == "video" and not (directory / "preview.mp4").is_file():
        set_progress(project["id"], 15, "Preparing a browser-friendly video preview.")
        run_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-map", "0:V:0", "-map", "0:a:0",
                     "-vf", "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
                     "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac",
                     "-b:a", "192k", "-movflags", "+faststart", str(directory / "preview.tmp.mp4")], 1800)
        (directory / "preview.tmp.mp4").replace(directory / "preview.mp4")
    if project["mediaType"] == "audio" and not (directory / "preview.m4a").is_file():
        # Keep the original channel layout/sample rate for listening; mono16k is
        # exclusively a recognizer input and is never used as export audio.
        run_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-map", "0:a:0",
                     "-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(directory / "preview.tmp.m4a")], 300)
        (directory / "preview.tmp.m4a").replace(directory / "preview.m4a")


def transcription_job(project_id: str) -> None:
    try:
        project = update_project(project_id, lambda p: p.update(status="processing", progress=5, message="Extracting the audio track."))
        prepare_media(project)
        result = transcribe(project_dir(project_id) / "audio.wav", project["duration"], project["script"], project.get("language", "hi"),
                            lambda percent, message: set_progress(project_id, percent, message))
        # The current project is reread under the lock: concurrent name/style edits survive.
        update_project(project_id, lambda p: p.update(**result, status="ready", progress=100,
                      message="Transcript ready. Review spelling and suggested emphasis." if result["words"] else "No speech was detected. Try a clip with clearer speech."))
    except Exception as exc:
        LOGGER.exception("Transcription failed for %s", project_id)
        message = str(exc) if isinstance(exc, ValueError) else "Transcription failed. Check the local model installation or connection for its first download, then retry."
        update_project(project_id, lambda p: p.update(status="error", progress=0, message=message))


def mark_export(project_id: str, export_id: str, **changes) -> None:
    def mutate(project):
        for job in project["exports"]:
            if job["id"] == export_id:
                job.update(changes)
                return
    update_project(project_id, mutate)


def export_job(project_id: str, export_id: str, snapshot: dict, mode: str, resolution: int) -> None:
    directory = project_dir(project_id)
    snapshot_path = directory / f"export-{export_id}.json"
    output_path = directory / f"export-{export_id}.mp4"
    try:
        mark_export(project_id, export_id, status="processing", progress=1, message="Rendering animated captions.")
        snapshot_path.write_text(json.dumps(snapshot, ensure_ascii=False, allow_nan=False))
        # FFmpeg probes the original by content, so its neutral .bin name is safe.
        # Rendering from the source avoids a second video generation and retains
        # full-quality source audio instead of the mono16k recognition input.
        media_path = directory / "source.bin"
        error_path = directory / f"export-{export_id}.log"
        with error_path.open("w+") as error_file:
            process = subprocess.Popen(["node", "--import", "tsx", "server/render.ts", str(snapshot_path), str(media_path),
                                        str(output_path), mode, str(resolution)], cwd=ROOT, stdout=subprocess.PIPE, stderr=error_file, text=True)
            # Bound even a renderer that hangs without emitting another progress line.
            timer = threading.Timer(7200, process.kill)
            timer.daemon = True
            timer.start()
            last_progress = -1
            try:
                for line in process.stdout:
                    try:
                        progress = int(float(json.loads(line).get("progress", 0)))
                    except (ValueError, TypeError, AttributeError):
                        continue
                    progress = max(1, min(99, progress))
                    if progress != last_progress:
                        mark_export(project_id, export_id, progress=progress)
                        last_progress = progress
                result = process.wait()
            finally:
                timer.cancel()
            if result or not output_path.is_file() or output_path.stat().st_size < 100:
                error_file.seek(0)
                LOGGER.error("Renderer failed: %s", error_file.read()[-3000:])
                raise ValueError("Export failed. Verify FFmpeg and the rendering dependencies, then retry.")
        name = re.sub(r"[^\w .-]", "", snapshot["name"]).strip()[:70] or "bol-captions"
        mark_export(project_id, export_id, status="ready", progress=100, message="Your video is ready.", filename=f"{name}-{mode}.mp4")
    except Exception:
        LOGGER.exception("Export failed for %s", project_id)
        output_path.unlink(missing_ok=True)
        mark_export(project_id, export_id, status="error", progress=0, message="Export failed. Check the local rendering dependencies and try again.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Incomplete work is explicitly retryable after a restart, never left spinning.
    with LOCK:
        for path in DATA_DIR.glob("*/project.json"):
            try:
                project = json.loads(path.read_text())
                changed = False
                if project.get("status") in {"queued", "processing"}:
                    project.update(status="error", progress=0, message="Processing was interrupted by a server restart. Retry transcription.")
                    changed = True
                for job in project.get("exports", []):
                    if job.get("status") in {"queued", "processing"}:
                        job.update(status="error", progress=0, message="Export was interrupted by a server restart. Export again.")
                        changed = True
                if changed:
                    project["revision"] = project.get("revision", 0) + 1
                    write_project(project)
            except Exception:
                LOGGER.exception("Could not restore project %s", path.parent.name)
    yield


app = FastAPI(title="Bol local media API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[v.strip() for v in os.getenv("BOL_ALLOWED_ORIGINS", os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")).split(",")],
                   allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type"], allow_credentials=False)


class ValidatedModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)


class Word(ValidatedModel):
    id: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=500)
    original: str = Field(max_length=500)
    start: float = Field(ge=0, le=MAX_DURATION)
    end: float = Field(ge=0, le=MAX_DURATION)
    confidence: float = Field(ge=0, le=1)
    confidenceApproximate: StrictBool = False
    emphasis: StrictBool
    emphasisScore: float = Field(ge=0, le=1)
    timingApproximate: StrictBool = False
    spotlight: StrictBool = False
    behind: StrictBool = False

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, value):
        if not value.strip():
            raise ValueError("Caption text cannot be blank.")
        return value


class Settings(ValidatedModel):
    template: Literal[
        "karaoke", "editorial", "bounce", "kinetic", "neon", "glow-script", "scribble",
        "welcome-stack", "soft-focus", "double-trouble", "bubble-highlight", "mumbai",
        "editing-school", "kalakar-shadow", "pop-up"
    ] = "karaoke"
    accent: str = Field(default="#c2a1ff", pattern=r"^#[0-9a-fA-F]{6}$")
    fontSize: float = Field(default=54, ge=20, le=100)
    position: float = Field(default=70, ge=10, le=90)
    wordsPerLine: StrictInt = Field(default=4, ge=1, le=8)
    uppercase: StrictBool = False
    motion: float = Field(default=1, ge=0, le=2)
    aspect: Literal["original", "9:16", "1:1", "16:9"] = "original"


class ProjectPatch(ValidatedModel):
    words: list[Word] | None = Field(default=None, max_length=20000)
    settings: Settings | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    videoEnabled: StrictBool | None = None
    revision: StrictInt | None = Field(default=None, ge=0)


class TranscribeRequest(ValidatedModel):
    script: Literal["roman", "native"] | None = None
    language: Literal["hi", "en", "auto"] | None = None


class ExportRequest(ValidatedModel):
    mode: Literal["burned", "green"] = "burned"
    resolution: Literal[720, 1080] = 720


def validate_word_intervals(words: list[dict], duration: float) -> None:
    previous_end = 0.0
    identifiers = set()
    for word in words:
        if word["id"] in identifiers:
            raise HTTPException(422, "Every word must have a unique ID.")
        identifiers.add(word["id"])
        if word["end"] <= word["start"] or word["start"] < previous_end - .0001 or word["end"] > duration + .0001:
            raise HTTPException(422, "Word timestamps must be ordered, non-overlapping and within the clip duration; each end must follow its start.")
        previous_end = word["end"]


@app.get("/api/health")
def health():
    speech = model_status()
    return {"status": "ok", **speech, "ffmpeg": bool(shutil.which("ffmpeg") and shutil.which("ffprobe")),
            "maxUploadBytes": MAX_BYTES, "maxDuration": MAX_DURATION}


@app.get("/api/projects")
def projects():
    result = []
    with LOCK:
        for path in DATA_DIR.glob("*/project.json"):
            try:
                result.append(json.loads(path.read_text()))
            except (OSError, ValueError):
                continue
    return sorted(result, key=lambda p: p.get("created", ""), reverse=True)


@app.post("/api/projects", status_code=201)
async def upload_project(file: Annotated[UploadFile, File()], script: Annotated[Literal["roman", "native"], Form()] = "roman",
                         language: Annotated[Literal["hi", "en", "auto"], Form()] = "hi"):
    project_id = str(uuid.uuid4())
    directory = project_dir(project_id)
    directory.mkdir(parents=True)
    try:
        total = 0
        with (directory / "source.bin").open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_BYTES:
                    raise HTTPException(413, "Please upload a file smaller than 1 GB.")
                output.write(chunk)
        if not total:
            raise HTTPException(422, "The uploaded file is empty.")
        metadata = await asyncio.to_thread(inspect_media, directory / "source.bin")
        filename = Path((file.filename or "Untitled clip").replace("\\", "/")).name[:240]
        project = {"id": project_id, "name": Path(filename).stem[:120] or "Untitled clip", "filename": filename,
                   **metadata, "videoEnabled": metadata["mediaType"] == "video", "created": datetime.now(timezone.utc).isoformat(), "status": "queued", "progress": 0,
                   "message": "Queued for local transcription.", "words": [], "settings": copy.deepcopy(DEFAULT_SETTINGS),
                   "waveform": [], "exports": [], "script": script, "language": language, "revision": 1}
        write_project(project)
        EXECUTOR.submit(transcription_job, project_id)
        return project
    except HTTPException:
        shutil.rmtree(directory, ignore_errors=True)
        raise
    except ValueError as exc:
        shutil.rmtree(directory, ignore_errors=True)
        raise HTTPException(422, str(exc))
    except Exception:
        shutil.rmtree(directory, ignore_errors=True)
        LOGGER.exception("Upload failed")
        raise HTTPException(500, "Upload failed. Check available disk space and retry.")
    finally:
        await file.close()


@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    return load_project(project_id)


@app.patch("/api/projects/{project_id}")
def patch_project(project_id: str, request: ProjectPatch):
    def mutate(project):
        if request.revision is not None and project["revision"] != request.revision:
            raise HTTPException(409, "This project changed. Refresh it before saving.")
        if request.words is not None:
            if project["status"] in {"queued", "processing"}:
                raise HTTPException(409, "Wait for transcription to finish before editing words.")
            words = [w.model_dump() for w in request.words]
            validate_word_intervals(words, project["duration"])
            project["words"] = words
        if request.settings is not None:
            project["settings"].update(request.settings.model_dump(exclude_unset=True))
        if request.name is not None:
            if not request.name.strip():
                raise HTTPException(422, "Project name cannot be blank.")
            project["name"] = request.name.strip()
        if request.videoEnabled is not None:
            if project["mediaType"] != "video":
                raise HTTPException(409, "Audio projects do not have a video layer.")
            project["videoEnabled"] = request.videoEnabled
    return update_project(project_id, mutate)


@app.post("/api/projects/{project_id}/transcribe")
def retry_transcription(project_id: str, request: TranscribeRequest | None = None):
    def mutate(project):
        if project["status"] in {"queued", "processing"}:
            raise HTTPException(409, "This clip is already queued for transcription.")
        if request:
            project.update(request.model_dump(exclude_none=True))
        project.update(status="queued", progress=0, message="Queued for local transcription.")
    result = update_project(project_id, mutate)
    EXECUTOR.submit(transcription_job, project_id)
    return result


@app.get("/api/projects/{project_id}/media")
def media(project_id: str):
    project = load_project(project_id)
    directory = project_dir(project_id)
    path = directory / ("preview.mp4" if project["mediaType"] == "video" else "preview.m4a")
    if not path.is_file():
        raise HTTPException(409, "The media preview is still being prepared.")
    return FileResponse(path, media_type="video/mp4" if project["mediaType"] == "video" else "audio/mp4")


@app.post("/api/projects/{project_id}/exports", status_code=202)
def create_export(project_id: str, request: ExportRequest):
    export_id = str(uuid.uuid4())
    with LOCK:
        project = load_project(project_id)
        if project["status"] != "ready":
            raise HTTPException(409, "Wait for a completed transcript before exporting.")
        if not project["words"]:
            raise HTTPException(422, "There are no caption words to export.")
        if request.mode == "green" and project["settings"]["accent"].lower() == "#00ff00":
            raise HTTPException(422, "Choose an accent other than pure green so your captions remain visible after chroma keying.")
        if any(job["status"] in {"queued", "processing"} for job in project["exports"]):
            raise HTTPException(409, "An export for this clip is already in progress.")
        snapshot = copy.deepcopy(project)
        job = {"id": export_id, "mode": request.mode, "resolution": request.resolution, "status": "queued", "progress": 0,
               "message": "Queued for rendering.", "revision": project["revision"]}
        update_project(project_id, lambda p: p["exports"].append(job))
    EXECUTOR.submit(export_job, project_id, export_id, snapshot, request.mode, request.resolution)
    return job


@app.get("/api/projects/{project_id}/exports/{export_id}/download")
def download_export(project_id: str, export_id: str):
    project = load_project(project_id)
    job = next((j for j in project["exports"] if j["id"] == export_id), None)
    if not job:
        raise HTTPException(404, "Export not found.")
    if job["status"] != "ready":
        raise HTTPException(409, "The export is not ready yet.")
    # Only the persisted UUID is used to construct the path.
    path = project_dir(project_id) / f"export-{job['id']}.mp4"
    if not path.is_file():
        raise HTTPException(404, "Export file is missing. Please export again.")
    return FileResponse(path, media_type="video/mp4", filename=job["filename"])
