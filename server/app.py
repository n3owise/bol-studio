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
import secrets
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator

from server.transcription import model_status, transcribe

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(ROOT / "data"))).resolve()
MAX_BYTES = 1024 * 1024 * 1024
MAX_DURATION = 20 * 60
LOCK = threading.RLock()
EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="bol-worker")
LOGGER = logging.getLogger("bol")
# Shared with the browser: src/lib/types.ts imports this same file. Keeping two
# hand-written copies meant a project created here opened with a different
# template, accent and words-per-line than one created in the editor.
TEMPLATE_IDS = {
    t["id"]
    for t in json.loads(
        (Path(__file__).resolve().parent.parent / "src" / "lib" / "caption-templates.json").read_text()
    )
}

CAPTION_FONTS = {
    f["family"]
    for f in json.loads(
        (Path(__file__).resolve().parent.parent / "src" / "lib" / "caption-fonts.json").read_text()
    )
}

DEFAULT_SETTINGS = json.loads(
    (Path(__file__).resolve().parent.parent / "src" / "lib" / "caption-defaults.json").read_text()
)


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
                            lambda percent, message: set_progress(project_id, percent, message),
                            glossary=project.get("glossary") or [])
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


def export_job(project_id: str, export_id: str, snapshot: dict, mode: str, resolution: int, fps: int = 60) -> None:
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
                                        str(output_path), mode, str(resolution), str(fps)], cwd=ROOT, stdout=subprocess.PIPE, stderr=error_file, text=True)
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
        res_label = "4k" if resolution == 2160 else f"{resolution}p"
        mark_export(project_id, export_id, status="ready", progress=100, message="Your video is ready.", filename=f"{name}-{mode}-{res_label}-{fps}fps.mp4")
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

# Origins default to the local dev server rather than "*". The deployed Space
# was reflecting any Origin back, so any page a visitor had open could call this
# API from their browser. Set BOL_ALLOWED_ORIGINS to your frontend's origin in
# production; "*" is still available but has to be asked for.
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://[::1]:5173"
_cors_origins = [
    v.strip()
    for v in os.getenv("BOL_ALLOWED_ORIGINS", os.getenv("CORS_ORIGINS", DEFAULT_ORIGINS)).split(",")
    if v.strip()
]
app.add_middleware(CORSMiddleware,
                   allow_origins=_cors_origins,
                   allow_methods=["*"],
                   allow_headers=["*"],
                   allow_credentials=False)

# A shared key, enabled by setting BOL_API_KEY. Unset — the local default — the
# gate is open so `npm run dev` needs no configuration.
#
# This is a deterrent, not authentication: the key ships inside the frontend
# bundle, so anyone who opens the app can read it. It stops drive-by traffic
# against a public deployment; it does not stop someone who wants in. Real
# per-user auth is a separate piece of work.
API_KEY = os.getenv("BOL_API_KEY", "").strip()
# The Gradio landing page and the health check stay reachable so the Space shows
# as up without a key.
_OPEN_PATHS = {"/", "/api/health", "/docs", "/openapi.json", "/favicon.ico"}


@app.middleware("http")
async def require_api_key(request: Request, call_next):
    if not API_KEY or request.method == "OPTIONS" or request.url.path in _OPEN_PATHS:
        return await call_next(request)
    # Media, thumbnails and downloads are loaded by <video src> and <img src>,
    # which cannot set headers, so the key is accepted as a query parameter too.
    supplied = request.headers.get("x-api-key") or request.query_params.get("key") or ""
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        supplied = supplied or authorization[7:].strip()
    if not secrets.compare_digest(supplied, API_KEY):
        return JSONResponse({"detail": "A valid API key is required."}, status_code=401)
    return await call_next(request)


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
    # Set when the word came from the project glossary rather than the recogniser.
    fromGlossary: StrictBool = False

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, value):
        if not value.strip():
            raise ValueError("Caption text cannot be blank.")
        return value


class Settings(BaseModel):
    # Every caption setting is declared below, so an unknown key means the
    # client and server have drifted; surface that instead of storing it.
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    template: str = Field(default=DEFAULT_SETTINGS["template"])

    @field_validator("template")
    @classmethod
    def _known_template(cls, value: str) -> str:
        if value not in TEMPLATE_IDS:
            raise ValueError(f"Unknown caption template: {value}")
        return value
    accent: str = Field(default=DEFAULT_SETTINGS["accent"], pattern=r"^#[0-9a-fA-F]{6}$")
    # Third line colour for stacked lockups; see Settings.accentSecondary.
    accentSecondary: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    # Declared rather than left to extra="allow": this value is interpolated
    # into a CSS font-family, so an arbitrary string is an injection surface.
    fontFamily: str | None = None

    @field_validator("fontFamily")
    @classmethod
    def _known_font(cls, value: str | None) -> str | None:
        if value is not None and value not in CAPTION_FONTS:
            raise ValueError(f"Unknown caption font: {value}")
        return value

    fontSize: float = Field(default=DEFAULT_SETTINGS["fontSize"], ge=20, le=100)
    position: float = Field(default=DEFAULT_SETTINGS["position"], ge=10, le=90)
    wordsPerLine: StrictInt = Field(default=DEFAULT_SETTINGS["wordsPerLine"], ge=1, le=8)
    uppercase: StrictBool = DEFAULT_SETTINGS["uppercase"]
    motion: float = Field(default=DEFAULT_SETTINGS["motion"], ge=0, le=2)
    aspect: Literal["original", "9:16", "1:1", "16:9"] = DEFAULT_SETTINGS["aspect"]

    # Everything the editor can set is declared here. These previously rode
    # through on extra="allow", so colours, offsets and widths reached the
    # renderer unchecked — the same gap that let an arbitrary fontFamily be
    # interpolated into a CSS font-family.
    positionX: float | None = Field(default=None, ge=0, le=100)
    textColor: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    backgroundColor: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    backgroundOpacity: float | None = Field(default=None, ge=0, le=100)
    strokeColor: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    strokeWidth: float | None = Field(default=None, ge=0, le=40)
    align: Literal["left", "center", "right"] | None = None
    showSafeArea: StrictBool | None = None


class ProjectPatch(ValidatedModel):
    words: list[Word] | None = Field(default=None, max_length=20000)
    settings: Settings | None = None
    glossary: list[str] | None = Field(default=None, max_length=200)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    videoEnabled: StrictBool | None = None
    revision: StrictInt | None = Field(default=None, ge=0)
    textElements: list[dict] | None = None
    canvasElements: list[dict] | None = None


class TranscribeRequest(ValidatedModel):
    script: Literal["roman", "native"] | None = None
    language: Literal["hi", "en", "auto"] | None = None
    # Brand names, handles and domains the recogniser cannot know. Stored on the
    # project so a re-transcription reuses them.
    glossary: list[str] | None = Field(default=None, max_length=200)


class ExportRequest(ValidatedModel):
    mode: Literal["burned", "green"] = "burned"
    resolution: Literal[720, 1080, 2160] = 720
    # Captions enter word by word; a 0.42s preset entrance is 25 frames at 60
    # and 12 at 30, where it reads as stepped. Lower rates stay available.
    fps: Literal[24, 25, 30, 50, 60] = 60


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
        if request.glossary is not None:
            project["glossary"] = [t.strip()[:80] for t in request.glossary if t and t.strip()][:200]
        if request.textElements is not None:
            project["textElements"] = request.textElements
        if request.canvasElements is not None:
            project["canvasElements"] = request.canvasElements
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
        job = {"id": export_id, "mode": request.mode, "resolution": request.resolution, "fps": request.fps, "status": "queued", "progress": 0,
               "message": "Queued for rendering.", "revision": project["revision"]}
        update_project(project_id, lambda p: p["exports"].append(job))
    EXECUTOR.submit(export_job, project_id, export_id, snapshot, request.mode, request.resolution, request.fps)
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


def inspect_asset_file(path: Path, original_filename: str) -> dict:
    ext = Path(original_filename).suffix.lower()
    video_exts = {".mp4", ".mov", ".webm", ".avi", ".mkv"}
    audio_exts = {".mp3", ".wav", ".m4a"}
    image_exts = {".png", ".jpg", ".jpeg", ".webp"}
    if ext not in (video_exts | audio_exts | image_exts):
        raise HTTPException(422, "Unsupported file type.")

    result = run_process(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)], 30)
    try:
        info = json.loads(result.stdout)
        streams = info.get("streams", [])
        format_info = info.get("format", {})
        video_stream = next((s for s in streams if s.get("codec_type") == "video" and not s.get("disposition", {}).get("attached_pic")), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
    except Exception:
        raise HTTPException(422, "The media file could not be decoded.")

    if ext in image_exts:
        # Fallback to image stream if any
        img_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        width = int(img_stream.get("width", 0)) if img_stream else 800
        height = int(img_stream.get("height", 0)) if img_stream else 600
        return {"mediaType": "image", "width": width, "height": height, "duration": None}
    elif ext in audio_exts or (audio_stream and not video_stream):
        duration = float(format_info.get("duration") or (audio_stream or {}).get("duration") or 0)
        return {"mediaType": "audio", "duration": round(duration, 2), "width": None, "height": None}
    else:
        duration = float(format_info.get("duration") or (video_stream or {}).get("duration") or 0)
        width = int(video_stream.get("width", 720)) if video_stream else 720
        height = int(video_stream.get("height", 1280)) if video_stream else 1280
        return {"mediaType": "video", "duration": round(duration, 2), "width": width, "height": height}


def generate_asset_thumb(source_path: Path, thumb_path: Path, media_type: str) -> None:
    try:
        thumb_path.parent.mkdir(parents=True, exist_ok=True)
        if media_type == "video":
            run_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", "0.5", "-i", str(source_path),
                         "-frames:v", "1", "-vf", "scale=360:-1", str(thumb_path)], 20)
        elif media_type == "image":
            run_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source_path),
                         "-vf", "scale=360:-1", str(thumb_path)], 20)
    except Exception as exc:
        LOGGER.warning("Thumbnail generation skipped for %s: %s", source_path.name, exc)


@app.get("/api/projects/{project_id}/media-thumbnail")
def project_media_thumbnail(project_id: str):
    directory = project_dir(project_id)
    thumb_path = directory / "preview.thumb.jpg"
    if not thumb_path.is_file():
        source_path = directory / ("preview.mp4" if (directory / "preview.mp4").is_file() else "source.bin")
        if source_path.is_file():
            generate_asset_thumb(source_path, thumb_path, "video")
    if thumb_path.is_file():
        return FileResponse(thumb_path, media_type="image/jpeg")
    raise HTTPException(404, "Thumbnail not ready.")


@app.get("/api/projects/{project_id}/assets")
def list_project_assets(project_id: str):
    project = load_project(project_id)
    directory = project_dir(project_id)
    assets = list(project.get("mediaAssets", []))
    
    # Ensure primary project media is synthesized as an asset if not present
    has_primary = any(a.get("id") == "primary" for a in assets)
    if not has_primary and project.get("filename"):
        source_file = directory / "source.bin"
        size = source_file.stat().st_size if source_file.is_file() else 0
        primary_asset = {
            "id": "primary",
            "name": project.get("name", "Main Video"),
            "filename": project.get("filename", "clip.mp4"),
            "mediaType": project.get("mediaType", "video"),
            "size": size,
            "duration": project.get("duration"),
            "width": project.get("width"),
            "height": project.get("height"),
            "createdAt": project.get("created"),
            "url": f"/api/projects/{project_id}/media",
            "thumbnailUrl": f"/api/projects/{project_id}/media-thumbnail",
            "greenScreen": project.get("greenScreen")
        }
        assets.insert(0, primary_asset)
    return assets


@app.post("/api/projects/{project_id}/assets", status_code=201)
async def upload_project_asset(project_id: str, file: Annotated[UploadFile, File()]):
    directory = project_dir(project_id)
    assets_dir = directory / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    
    raw_filename = Path((file.filename or "media").replace("\\", "/")).name[:240]
    ext = Path(raw_filename).suffix.lower()
    asset_id = str(uuid.uuid4())
    dest_path = assets_dir / f"{asset_id}{ext}"
    thumb_path = assets_dir / f"{asset_id}.thumb.jpg"

    total = 0
    try:
        with dest_path.open("wb") as out_file:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_BYTES:
                    raise HTTPException(413, "This file is larger than 1 GB.")
                out_file.write(chunk)
        if total == 0:
            raise HTTPException(422, "The uploaded file is empty.")

        meta = await asyncio.to_thread(inspect_asset_file, dest_path, raw_filename)
        await asyncio.to_thread(generate_asset_thumb, dest_path, thumb_path, meta["mediaType"])

        name_stem = Path(raw_filename).stem[:120] or "Untitled media"
        asset = {
            "id": asset_id,
            "name": name_stem,
            "filename": raw_filename,
            "mediaType": meta["mediaType"],
            "size": total,
            "duration": meta["duration"],
            "width": meta["width"],
            "height": meta["height"],
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "sourceFile": f"assets/{asset_id}{ext}",
            "thumbnailFile": f"assets/{asset_id}.thumb.jpg" if thumb_path.is_file() else None,
            "url": f"/api/projects/{project_id}/assets/{asset_id}/file",
            "thumbnailUrl": f"/api/projects/{project_id}/assets/{asset_id}/thumbnail" if thumb_path.is_file() else None,
            "greenScreen": None,
        }

        def append_asset(p):
            if "mediaAssets" not in p or not isinstance(p["mediaAssets"], list):
                p["mediaAssets"] = []
            p["mediaAssets"].append(asset)
        update_project(project_id, append_asset)
        return asset
    except HTTPException:
        dest_path.unlink(missing_ok=True)
        thumb_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        dest_path.unlink(missing_ok=True)
        thumb_path.unlink(missing_ok=True)
        LOGGER.exception("Asset upload failed")
        raise HTTPException(500, f"Upload failed: {exc}")
    finally:
        await file.close()


@app.get("/api/projects/{project_id}/assets/{asset_id}/file")
def get_asset_file(project_id: str, asset_id: str):
    directory = project_dir(project_id)
    if asset_id == "primary":
        project = load_project(project_id)
        path = directory / ("preview.mp4" if project["mediaType"] == "video" else "preview.m4a")
        if not path.is_file():
            path = directory / "source.bin"
        if not path.is_file():
            raise HTTPException(404, "Primary media file not found.")
        return FileResponse(path, media_type="video/mp4" if project["mediaType"] == "video" else "audio/mp4")

    # Look in assets directory
    assets_dir = directory / "assets"
    matching = list(assets_dir.glob(f"{asset_id}.*"))
    file_path = next((p for p in matching if not p.name.endswith(".thumb.jpg")), None)
    if not file_path or not file_path.is_file():
        raise HTTPException(404, "Asset file not found.")

    ext = file_path.suffix.lower()
    mime = "application/octet-stream"
    if ext in {".mp4", ".mov", ".webm", ".avi", ".mkv"}:
        mime = "video/mp4" if ext == ".mp4" else f"video/{ext[1:]}"
    elif ext in {".mp3", ".wav", ".m4a"}:
        mime = "audio/mpeg" if ext == ".mp3" else ("audio/wav" if ext == ".wav" else "audio/mp4")
    elif ext in {".png", ".jpg", ".jpeg", ".webp"}:
        mime = f"image/{'jpeg' if ext in ('.jpg', '.jpeg') else ext[1:]}"

    return FileResponse(file_path, media_type=mime)


@app.get("/api/projects/{project_id}/assets/{asset_id}/thumbnail")
def get_asset_thumbnail(project_id: str, asset_id: str):
    directory = project_dir(project_id)
    if asset_id == "primary":
        return project_media_thumbnail(project_id)
    
    thumb_path = directory / "assets" / f"{asset_id}.thumb.jpg"
    if thumb_path.is_file():
        return FileResponse(thumb_path, media_type="image/jpeg")
    raise HTTPException(404, "Thumbnail not found.")


@app.get("/api/projects/{project_id}/assets/{asset_id}/download")
def download_asset_file(project_id: str, asset_id: str):
    project = load_project(project_id)
    directory = project_dir(project_id)
    
    if asset_id == "primary":
        path = directory / "source.bin"
        if not path.is_file():
            path = directory / ("preview.mp4" if project["mediaType"] == "video" else "preview.m4a")
        if not path.is_file():
            raise HTTPException(404, "Primary media file not found.")
        return FileResponse(path, filename=project.get("filename", "clip.mp4"))

    matching = list((directory / "assets").glob(f"{asset_id}.*"))
    file_path = next((p for p in matching if not p.name.endswith(".thumb.jpg")), None)
    if not file_path or not file_path.is_file():
        raise HTTPException(404, "Asset file not found.")

    # Find filename in mediaAssets
    asset = next((a for a in project.get("mediaAssets", []) if a.get("id") == asset_id), None)
    filename = asset.get("filename", file_path.name) if asset else file_path.name
    return FileResponse(file_path, filename=filename)


class AssetPatchRequest(BaseModel):
    name: str | None = None
    greenScreen: dict | None = None


@app.patch("/api/projects/{project_id}/assets/{asset_id}")
def patch_asset(project_id: str, asset_id: str, request: AssetPatchRequest):
    def mutate(p):
        if asset_id == "primary":
            if request.name is not None and request.name.strip():
                p["name"] = request.name.strip()
                ext = Path(p.get("filename", "")).suffix
                p["filename"] = f"{request.name.strip()}{ext}"
            if request.greenScreen is not None:
                p["greenScreen"] = request.greenScreen
            return

        assets = p.get("mediaAssets", [])
        asset = next((a for a in assets if a.get("id") == asset_id), None)
        if not asset:
            raise HTTPException(404, "Asset not found.")
        if request.name is not None and request.name.strip():
            asset["name"] = request.name.strip()
            ext = Path(asset.get("filename", "")).suffix
            asset["filename"] = f"{request.name.strip()}{ext}"
        if request.greenScreen is not None:
            asset["greenScreen"] = request.greenScreen
    return update_project(project_id, mutate)


@app.post("/api/projects/{project_id}/assets/{asset_id}/duplicate")
def duplicate_asset(project_id: str, asset_id: str):
    directory = project_dir(project_id)
    project = load_project(project_id)
    
    if asset_id == "primary":
        source_file = directory / "source.bin"
        if not source_file.is_file():
            source_file = directory / "preview.mp4"
        if not source_file.is_file():
            raise HTTPException(404, "Source file not found.")
        orig_filename = project.get("filename", "clip.mp4")
        orig_name = project.get("name", "Main Video")
        orig_type = project.get("mediaType", "video")
        orig_duration = project.get("duration")
        orig_width = project.get("width")
        orig_height = project.get("height")
        orig_greenscreen = project.get("greenScreen")
    else:
        asset = next((a for a in project.get("mediaAssets", []) if a.get("id") == asset_id), None)
        if not asset:
            raise HTTPException(404, "Asset not found.")
        orig_filename = asset["filename"]
        orig_name = asset["name"]
        orig_type = asset["mediaType"]
        orig_duration = asset.get("duration")
        orig_width = asset.get("width")
        orig_height = asset.get("height")
        orig_greenscreen = asset.get("greenScreen")
        
        matching = list((directory / "assets").glob(f"{asset_id}.*"))
        source_file = next((p for p in matching if not p.name.endswith(".thumb.jpg")), None)
        if not source_file or not source_file.is_file():
            raise HTTPException(404, "Asset file not found.")

    new_id = str(uuid.uuid4())
    ext = Path(orig_filename).suffix.lower()
    new_assets_dir = directory / "assets"
    new_assets_dir.mkdir(parents=True, exist_ok=True)
    new_dest = new_assets_dir / f"{new_id}{ext}"
    shutil.copy2(source_file, new_dest)

    new_thumb = new_assets_dir / f"{new_id}.thumb.jpg"
    generate_asset_thumb(new_dest, new_thumb, orig_type)

    stem = Path(orig_filename).stem
    new_name = f"{orig_name} copy"
    new_filename = f"{stem} copy{ext}"

    new_asset = {
        "id": new_id,
        "name": new_name,
        "filename": new_filename,
        "mediaType": orig_type,
        "size": new_dest.stat().st_size,
        "duration": orig_duration,
        "width": orig_width,
        "height": orig_height,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "sourceFile": f"assets/{new_id}{ext}",
        "thumbnailFile": f"assets/{new_id}.thumb.jpg" if new_thumb.is_file() else None,
        "url": f"/api/projects/{project_id}/assets/{new_id}/file",
        "thumbnailUrl": f"/api/projects/{project_id}/assets/{new_id}/thumbnail" if new_thumb.is_file() else None,
        "greenScreen": copy.deepcopy(orig_greenscreen) if orig_greenscreen else None,
    }

    def append(p):
        if "mediaAssets" not in p or not isinstance(p["mediaAssets"], list):
            p["mediaAssets"] = []
        p["mediaAssets"].append(new_asset)
    update_project(project_id, append)
    return new_asset


@app.delete("/api/projects/{project_id}/assets/{asset_id}")
def delete_asset(project_id: str, asset_id: str):
    directory = project_dir(project_id)
    if asset_id == "primary":
        def disable_video(p):
            p["videoEnabled"] = False
        update_project(project_id, disable_video)
        return {"status": "ok", "message": "Primary media video layer disabled."}

    def remove(p):
        assets = p.get("mediaAssets", [])
        p["mediaAssets"] = [a for a in assets if a.get("id") != asset_id]
    update_project(project_id, remove)

    # Remove files
    assets_dir = directory / "assets"
    for p in assets_dir.glob(f"{asset_id}.*"):
        try:
            p.unlink(missing_ok=True)
        except Exception:
            pass
    return {"status": "ok"}
