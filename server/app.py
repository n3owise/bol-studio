"""Local API: persisted projects, one compute queue, real transcription and exports."""
from __future__ import annotations
from server.admin_analytics import admin_allowed, require_admin, overview as analytics_overview
from server.telemetry import initialize_monitoring, capture_job_error

import time
import traceback
from server.temporary_sessions import expired as temporary_session_expired, LEASE_SECONDS, CLOSE_GRACE_SECONDS

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
import signal
import threading
import tempfile
import uuid
import weakref
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from email.message import Message
from pathlib import Path
from typing import Annotated, Literal
from PIL import Image, UnidentifiedImageError

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator

from server.auth import (AUTH_ENABLED, AuthError, MEDIA_TOKEN_TTL_SECONDS, mint_media_token,
                         owner_from_media_token, user_id_from)
from server.transcription import TranscriptionCancelled, model_status, transcribe, validate_transcription_request

from server.jobs import BoundedExecutor, JobJournal, QueueFull, exclusive_store, replay_jobs
from server.diagnostics import JobFailure, JobTrace

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(ROOT / "data"))).resolve()
MAX_BYTES = 1024 * 1024 * 1024
MAX_DURATION = 20 * 60
MAX_OWNER_STORAGE_BYTES = max(1, int(os.getenv("BOL_MAX_OWNER_STORAGE_BYTES", str(10 * MAX_BYTES))))
MAX_EXPORT_BYTES = max(1, int(os.getenv("BOL_MAX_EXPORT_BYTES", str(MAX_BYTES))))
MAX_OWNER_PROJECTS = max(1, int(os.getenv("BOL_MAX_OWNER_PROJECTS", "100")))
MAX_OWNER_UPLOADS = max(1, int(os.getenv("BOL_MAX_OWNER_UPLOADS", "2")))
MAX_TOTAL_UPLOADS = max(1, int(os.getenv("BOL_MAX_TOTAL_UPLOADS", "4")))
MIN_DISK_FREE_BYTES = max(0, int(os.getenv("BOL_MIN_DISK_FREE_BYTES", str(64 * 1024 * 1024))))
MAX_PROJECT_ASSETS = max(1, int(os.getenv("BOL_MAX_PROJECT_ASSETS", "500")))
UPLOAD_MULTIPART_OVERHEAD = 1024 * 1024
UPLOAD_RESERVATIONS: dict[str, dict[str, int]] = {}
LOCK = threading.RLock()
CANCELLATIONS: set[str] = set()
JOB_CONTEXT = threading.local()
TRANSCRIPTION_LOCKS = weakref.WeakValueDictionary()
AUDIO_DOWNLOAD_LOCKS = weakref.WeakValueDictionary()
MAX_WORKERS = max(1, int(os.getenv("BOL_MAX_WORKERS", "2" if (os.cpu_count() or 1) >= 4 else "1")))
MAX_QUEUED_JOBS = max(0, int(os.getenv("BOL_MAX_QUEUED_JOBS", "8")))
MAX_OWNER_JOBS = max(1, int(os.getenv("BOL_MAX_OWNER_JOBS", "3")))
EXECUTOR = BoundedExecutor(MAX_WORKERS, MAX_QUEUED_JOBS, MAX_OWNER_JOBS)
TRANSCRIPTION_EXECUTOR = EXECUTOR
EXPORT_EXECUTOR = EXECUTOR
LOGGER = logging.getLogger("bol")
LOGGER.setLevel(logging.INFO)
if not LOGGER.hasHandlers():
    LOGGER.addHandler(logging.StreamHandler())
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

# Faces licensed for this machine only, mirroring DEV_ONLY_FONTS in
# src/lib/caption-fonts.ts. The editor offers them and the renderer draws them,
# so the validator has to admit them too — otherwise picking one saves nothing
# and the project cannot be exported, which is how this was found.
#
# Same switch as the renderer: told by the environment, never inferred. A
# deployment that does not set it rejects these names exactly as before.
LOCAL_ONLY_FONTS = {"Satoshi"} if os.getenv("BOL_LOCAL_FONTS") == "1" else set()

DEFAULT_SETTINGS = json.loads(
    (Path(__file__).resolve().parent.parent / "src" / "lib" / "caption-defaults.json").read_text()
)

# The most words one caption page may show. Mirrors MAX_WORDS_PER_PAGE in
# src/lib/pages.ts, which enforces the same ceiling when pages are built.
CAPTION_BOUNDS = json.loads((ROOT / "src/lib/caption-bounds.json").read_text())
MAX_WORDS_PER_LINE = 7


@contextmanager
def job_slot(owner: str, enabled: bool = True):
    try:
        if enabled and isinstance(EXECUTOR, BoundedExecutor):
            with EXECUTOR.admission(owner) as slot:
                yield slot
        else:
            yield EXECUTOR
    except QueueFull as error:
        raise HTTPException(429 if error.tenant else 503, str(error), headers={"Retry-After": "30"}) from error


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
    generation = getattr(JOB_CONTEXT, "generation", None)
    if generation is None:
        update_project(project_id, lambda p: p.update(progress=progress, message=message))
    else:
        update_transcription(project_id, generation, lambda p: p.update(progress=progress, message=message))


def active_output_reservations(owner: str, exclude_export: str | None = None) -> int:
    total = 0
    with LOCK:
        for path in DATA_DIR.glob("*/project.json"):
            try:
                project = json.loads(path.read_text())
            except (OSError, ValueError):
                continue
            if owns(project, owner):
                total += sum(int(job.get("storageReservationBytes", 0)) for job in project.get("exports", [])
                             if job.get("status") in {"queued", "processing"} and job.get("id") != exclude_export)
    return total


def output_quota_exceeded(path: Path, owner: str, limit: int, exclude_export: str | None = None) -> bool:
    try:
        if path.is_file() and path.stat().st_size > limit:
            return True
    except OSError:
        return False
    return owned_project_usage(owner)[1] + active_output_reservations(owner, exclude_export) > MAX_OWNER_STORAGE_BYTES


@contextmanager
def monitor_output_quota(process, path: Path, owner: str, limit: int, exclude_export: str | None = None, log_path: Path | None = None,
                         temporary_path: Path | None = None, terminate=None):
    """Stop a running encoder even if it stops emitting progress lines."""
    stop = threading.Event()
    exceeded = threading.Event()
    def watch():
        while not stop.wait(0.25):
            try:
                log_exceeded = log_path is not None and log_path.is_file() and log_path.stat().st_size > 8 * 1024 * 1024
            except OSError:
                log_exceeded = False
            temporary_bytes = 0
            if temporary_path is not None:
                for entry in temporary_path.rglob('*'):
                    try:
                        if entry.is_file(): temporary_bytes += entry.stat().st_size
                    except OSError:
                        pass
            if log_exceeded or temporary_bytes > limit or output_quota_exceeded(path, owner, limit, exclude_export):
                exceeded.set()
                try:
                    (terminate or process.kill)()
                except ProcessLookupError:
                    pass
                return
    watcher = threading.Thread(target=watch, daemon=True)
    watcher.start()
    try:
        yield exceeded
    finally:
        stop.set()
        watcher.join()


@contextmanager
def monitor_process_streams(process, streams):
    stop = threading.Event()
    exceeded = threading.Event()
    def watch():
        while not stop.wait(0.1):
            if any(os.fstat(stream.fileno()).st_size > cap for stream, cap in streams):
                exceeded.set()
                try:
                    process.kill()
                except ProcessLookupError:
                    pass
                return
    watcher = threading.Thread(target=watch, daemon=True)
    watcher.start()
    try:
        yield exceeded
    finally:
        stop.set()
        watcher.join()


def run_bounded_media_process(args: list[str], timeout: int, project: dict, limit: int) -> None:
    owner = project.get("owner", "")
    output = Path(args[-1])
    process = None
    try:
        with storage_reservation(owner, limit, upload_slot=False), tempfile.TemporaryFile() as errors:
            process = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=errors)
            with monitor_output_quota(process, output, owner, limit) as exceeded, monitor_process_streams(process, [(errors, 1024 * 1024)]) as noisy:
                try:
                    process.wait(timeout=timeout)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                    raise ValueError("Media processing took too long. Try a shorter clip.")
            if exceeded.is_set() or output_quota_exceeded(output, owner, limit):
                raise HTTPException(413, "Preparing media would exceed the workspace storage limit.")
            if noisy.is_set() or os.fstat(errors.fileno()).st_size > 1024 * 1024:
                raise ValueError("Media processing exceeded the diagnostic output limit.")
            if process.returncode:
                LOGGER.error("Media encoder failed with exit code %s", process.returncode)
                raise ValueError("The media could not be decoded. Please upload a valid media file.")
    except BaseException:
        if process is not None and process.poll() is None:
            process.kill()
            process.wait()
        output.unlink(missing_ok=True)
        raise


def run_process(args: list[str], timeout: int = 120) -> subprocess.CompletedProcess:
    process = None
    try:
        with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors:
            process = subprocess.Popen(args, stdout=output, stderr=errors)
            caps = [(output, 8 * 1024 * 1024), (errors, 1024 * 1024)]
            with monitor_process_streams(process, caps) as exceeded:
                try:
                    process.wait(timeout=timeout)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                    raise ValueError("Media processing took too long. Try a shorter clip.")
            if exceeded.is_set() or any(os.fstat(stream.fileno()).st_size > cap for stream, cap in caps):
                raise ValueError("Media processing exceeded the diagnostic output limit.")
            output.seek(0)
            errors.seek(0)
            result = subprocess.CompletedProcess(args, process.returncode,
                                                 output.read(8 * 1024 * 1024).decode("utf-8", errors="replace"),
                                                 errors.read(1024 * 1024).decode("utf-8", errors="replace"))
    except FileNotFoundError:
        raise ValueError(f"{Path(args[0]).name} is missing. Install FFmpeg and restart the server.")
    except BaseException:
        if process is not None and process.poll() is None:
            process.kill()
            process.wait()
        raise
    if result.returncode:
        LOGGER.error("Media command failed with exit code %s", result.returncode)
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


# Containers and codecs a browser plays without help. Anything else needs a
# transcoded preview; these only need their container rewritten, if that.
_BROWSER_VIDEO = {"h264", "avc1", "vp8", "vp9", "av1"}
_BROWSER_AUDIO = {"aac", "mp3", "opus", "vorbis"}


def playable_media(project: dict) -> Path:
    """The file the browser should stream for this project.

    A separate preview is only written when the upload cannot be played as it
    is, so most projects have none and this returns the source. Every caller
    goes through here rather than reaching for preview.mp4, because whether that
    file exists now depends on the upload.
    """
    directory = project_dir(project["id"])
    preview = directory / ("preview.mp4" if project["mediaType"] == "video" else "preview.m4a")
    return preview if preview.is_file() else directory / "source.bin"


def _streams(path: Path) -> tuple[str, str]:
    """(video codec, audio codec) for a media file, lowercase, '' when absent."""
    try:
        result = run_process(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,codec_type",
                              "-of", "json", str(path)], 45)
        streams = json.loads(result.stdout).get("streams", [])
    except (ValueError, KeyError):
        return ("", "")
    video = next((s.get("codec_name", "") for s in streams if s.get("codec_type") == "video"), "")
    audio = next((s.get("codec_name", "") for s in streams if s.get("codec_type") == "audio"), "")
    return (video.lower(), audio.lower())


# Written once the source will not be rewritten again. Its absence is what makes
# the remux safe to retry, and its presence is what stops a second one.
PLAYBACK_READY = ".playback-ready"


def remux_for_playback(project: dict) -> bool:
    """Rewrite the container so a browser can start playing straight away.

    Lossless: the streams are copied untouched and only the container changes,
    which costs seconds and loses nothing. It is worth doing even for a file
    that is already playable, because phone recordings usually put the moov atom
    at the end and a browser then has to fetch the whole clip before it can
    start. Replacing the source rather than writing a second file is what keeps
    one copy on disk serving as both the preview and the export source.

    Called at upload, before the project is handed back, because replacing a
    file is only safe while nobody is reading it. Doing it when transcription
    started rewrote the very bytes the preview was streaming: the browser had
    cached the old length, its next range request fell past the end of the new
    file, the server correctly answered 416, and playback stopped with "the
    preview could not load" moments after the captions appeared.

    Returns whether the file is now something a browser can play.
    """
    directory = project_dir(project["id"])
    source = directory / "source.bin"
    marker = directory / PLAYBACK_READY
    video_codec, audio_codec = _streams(source)
    playable = (video_codec in _BROWSER_VIDEO if project["mediaType"] == "video" else True) \
        and audio_codec in _BROWSER_AUDIO
    if not playable:
        return False
    # Already done, or a preview is serving instead. Either way the file must
    # not be rewritten again — something may be part-way through reading it.
    if marker.is_file() or (directory / "preview.mp4").is_file() or (directory / "preview.m4a").is_file():
        return True

    remuxed = directory / "source.remux.mp4"
    try:
        run_bounded_media_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-map", "0",
                                  "-c", "copy", "-movflags", "+faststart", str(remuxed)], 600,
                                  project, source.stat().st_size + 1024 * 1024)
        remuxed.replace(source)
    except ValueError:
        # Some containers refuse a straight copy. Fall through to a preview.
        remuxed.unlink(missing_ok=True)
        return False
    marker.write_text("")
    return True


def prepare_media(project: dict) -> None:
    """Make the upload playable and transcribable, storing as little as possible.

    This used to keep three copies of every upload: the original, an
    uncompressed 16 kHz wav, and a re-encoded preview. The preview was written
    at crf 19 and up to 1920px — export quality for a file only ever scrubbed —
    so a 3.3 MB clip became 10.4 MB on disk, and the preview alone was larger
    than the video it came from.

    Most uploads are already h264 and aac in an MP4, which a browser plays
    directly. Those are remuxed in place instead: the streams are copied
    untouched and only the container is rewritten, which costs seconds, loses
    nothing, and leaves one file serving as both the preview and the export
    source. The remux is worth doing even when the file is already playable,
    because phone recordings usually place the moov atom at the end and a
    browser then has to download the whole clip before it can start.

    Anything else — HEVC, AVI, ProRes — still needs a real preview, but a small
    one: a scrubbing copy has no reason to be near-lossless.
    """
    directory = project_dir(project["id"])
    source = directory / "source.bin"
    if not (directory / "audio.wav").is_file():
        run_bounded_media_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-map", "0:a:0",
                     "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(directory / "audio.tmp.wav")], 300, project, int(project["duration"] * 32000) + 4096)
        (directory / "audio.tmp.wav").replace(directory / "audio.wav")

    # Browser-extracted audio can be transcribed while the original is still
    # uploading to Drive. The original is hydrated before any export is allowed.
    if project.get("cloudAudioOnly"):
        return
    playable = remux_for_playback(project)

    if not playable and project["mediaType"] == "video" and not (directory / "preview.mp4").is_file():
        set_progress(project["id"], 15, "Preparing a browser-friendly video preview.")
        run_bounded_media_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-map", "0:V:0", "-map", "0:a:0",
                     "-vf", "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
                     "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac",
                     "-b:a", "128k", "-movflags", "+faststart", str(directory / "preview.tmp.mp4")], 1800, project, min(MAX_BYTES, int(project["duration"] * 2_000_000) + 1024 * 1024))
        (directory / "preview.tmp.mp4").replace(directory / "preview.mp4")

    if not playable and project["mediaType"] == "audio" and not (directory / "preview.m4a").is_file():
        # The recogniser's mono 16 kHz copy is never used for listening.
        run_bounded_media_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-map", "0:a:0",
                     "-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(directory / "preview.tmp.m4a")], 300, project, int(project["duration"] * 32000) + 1024 * 1024)
        (directory / "preview.tmp.m4a").replace(directory / "preview.m4a")


def _was_deleted(project_id: str) -> bool:
    """Whether this job's project has been deleted out from under it.

    A queued job is not cancellable — there is one worker and no way to reach
    into it — so deleting a project lets its job run and fail on the first
    update_project, which can no longer find the file. That is a cancellation,
    not a fault: logging it as an exception buries real failures in noise, and
    recording an "error" status for it means writing the project back, which
    recreates the directory the delete just removed.
    """
    with LOCK:
        return not (DATA_DIR / project_id / "project.json").is_file()


def transcription_cancelled(project_id: str, generation: int) -> bool:
    with LOCK:
        return (_was_deleted(project_id) or project_id in CANCELLATIONS
                or load_project(project_id).get("transcriptionGeneration", 0) != generation)


def update_transcription(project_id: str, generation: int, change) -> dict:
    with LOCK:
        if transcription_cancelled(project_id, generation):
            raise TranscriptionCancelled("Transcription was cancelled.")
        return update_project(project_id, change)


def transcription_job(project_id: str, generation: int | None = None) -> None:
    with LOCK:
        if _was_deleted(project_id):
            return
        if generation is None:
            generation = load_project(project_id).get("transcriptionGeneration", 0)
        job_lock = TRANSCRIPTION_LOCKS.setdefault(project_id, threading.Lock())
    # A cancelled worker must finish using shared media files before its retry starts.
    with job_lock:
        JOB_CONTEXT.generation = generation
        try:
            _transcription_job(project_id, generation)
        finally:
            del JOB_CONTEXT.generation


def _transcription_job(project_id: str, generation: int) -> None:
    trace = JobTrace(f'{project_id}:{generation}', 'transcription')
    try:
        with LOCK:
            if transcription_cancelled(project_id, generation):
                return
        project = update_transcription(project_id, generation, lambda p: p.update(status="processing", progress=5, message="Extracting the audio track."))
        trace.enter('extracting')
        prepare_media(project)
        is_cancelled = lambda: transcription_cancelled(project_id, generation)
        if is_cancelled():
            raise TranscriptionCancelled("Transcription was cancelled.")
        trace.enter('decoding')
        result = transcribe(project_dir(project_id) / "audio.wav", project["duration"], project["script"], project.get("language", "hi"),
                            lambda percent, message: update_transcription(project_id, generation,
                                lambda p: p.update(progress=percent, message=message)),
                            glossary=project.get("glossary") or [],
                            isolateVocals=bool(project.get("isolateVocals")),
                            source_path=project_dir(project_id) / "source.bin",
                            emoji=bool(project.get("emoji")),
                            translate=bool(project.get("translate")),
                            is_cancelled=is_cancelled)
        if is_cancelled():
            raise TranscriptionCancelled("Transcription was cancelled.")
        trace.enter('saving')
        # The current project is reread under the lock: concurrent name/style edits survive.
        update_transcription(project_id, generation, lambda p: p.update(**result, status="ready", progress=100, diagnostics=trace.finish(),
                      message=("Transcript ready. Review spelling and suggested emphasis." if result["words"] else "No speech was detected. Try a clip with clearer speech.")
                      + (" Vocal isolation was unavailable; the original audio was used." if result.get("isolationFallback") else "")))
        # Save completed captions even if the browser closed during recognition.
        if load_project(project_id).get("cloudId"):
            try:
                persist_drive_project(project_id)
            except Exception:
                LOGGER.warning("Drive caption save failed; editing session remains recoverable until its lease expires")
                with LOCK:
                    latest = load_project(project_id)
                    latest["cloudSaveError"] = True
                    write_project(latest)
        # The recogniser's copy is uncompressed 16 kHz wav and nothing reads it
        # again — a third of the stored size for a file regenerated from the
        # source in seconds if the clip is ever transcribed again.
        (project_dir(project_id) / "audio.wav").unlink(missing_ok=True)
    except TranscriptionCancelled:
        trace.emit('cancelled')
        (project_dir(project_id) / "audio.wav").unlink(missing_ok=True)
    except Exception as exc:
        if transcription_cancelled(project_id, generation):
            return
        capture_job_error(exc, "transcription")
        diagnostics = trace.finish(exc)
        LOGGER.error("transcription_failure type=%s frames=%s", type(exc).__name__,
                     [(Path(frame.filename).name, frame.name, frame.lineno) for frame in traceback.extract_tb(exc.__traceback__)])
        message = str(exc) if isinstance(exc, ValueError) else "Transcription failed. Check the local model installation or connection for its first download, then retry."
        try:
            update_transcription(project_id, generation, lambda p: p.update(status="error", progress=0, message=message, diagnostics=diagnostics))
        except TranscriptionCancelled:
            pass
    finally:
        with LOCK:
            if not _was_deleted(project_id) and load_project(project_id).get("transcriptionGeneration", 0) == generation:
                CANCELLATIONS.discard(project_id)


def mark_export(project_id: str, export_id: str, **changes) -> None:
    def mutate(project):
        for job in project["exports"]:
            if job["id"] == export_id:
                job.update(changes)
                return
    update_project(project_id, mutate)


def export_job(project_id: str, export_id: str, snapshot: dict, mode: str, resolution: int, fps: int = 60) -> None:
    trace = JobTrace(export_id, 'export')
    directory = project_dir(project_id)
    snapshot_path = directory / f"export-{export_id}.json"
    output_path = directory / f"export-{export_id}.mp4"
    temporary_path = directory / f"export-{export_id}-temporary"
    try:
        trace.enter('snapshot')
        mark_export(project_id, export_id, status="processing", progress=1, message="Rendering animated captions.")
        snapshot_path.write_text(json.dumps(snapshot, ensure_ascii=False, allow_nan=False))
        # FFmpeg probes the original by content, so its neutral .bin name is safe.
        # Rendering from the source avoids a second video generation and retains
        # full-quality source audio instead of the mono16k recognition input.
        media_path = directory / "source.bin"
        error_path = directory / f"export-{export_id}.log"
        trace.enter('rendering')
        shutil.rmtree(temporary_path, ignore_errors=True)
        temporary_path.mkdir(mode=0o700)
        render_env = {**os.environ, 'TMPDIR': str(temporary_path), 'TMP': str(temporary_path),
                      'TEMP': str(temporary_path), 'REMOTION_SHARED_MEMORY_BACKEND': 'file'}
        with error_path.open("w+") as error_file:
            process = subprocess.Popen(["node", "--import", "tsx", "server/render.ts", str(snapshot_path), str(media_path),
                                        str(output_path), mode, str(resolution), str(fps)], cwd=ROOT, stdout=subprocess.PIPE, stderr=error_file, text=True,
                                       start_new_session=True, env=render_env)
            # Bound even a renderer that hangs without emitting another progress line.
            timed_out = threading.Event()
            last_activity = [time.monotonic()]
            watchdog_stop = threading.Event()
            def kill_renderer_group():
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except (ProcessLookupError, AttributeError):
                    process.kill()
            def stop_renderer():
                timed_out.set()
                kill_renderer_group()
            def watch_activity():
                while not watchdog_stop.wait(5):
                    if time.monotonic() - last_activity[0] > 300:
                        stop_renderer()
                        return
            watchdog = threading.Thread(target=watch_activity, daemon=True)
            watchdog.start()
            timer = threading.Timer(7200, stop_renderer)
            timer.daemon = True
            timer.start()
            owner = snapshot.get("owner", "")
            persisted = load_project(project_id)
            limit = next((j.get("storageReservationBytes", MAX_EXPORT_BYTES) for j in persisted.get("exports", []) if j.get("id") == export_id), MAX_EXPORT_BYTES)
            with monitor_output_quota(process, output_path, owner, limit, export_id, error_path,
                                      temporary_path=temporary_path, terminate=kill_renderer_group) as exceeded:
                last_progress = -1
                resource_error = False
                try:
                    for line in process.stdout:
                        try:
                            event = json.loads(line)
                            last_activity[0] = time.monotonic()
                            stages = {
                                'browser': 'Preparing export renderer.',
                                'bundling': 'Preparing caption templates.',
                                'composition': 'Loading caption fonts and layout.',
                                'frames': 'Rendering animated captions.',
                            }
                            if event.get('stage') in stages:
                                stage = event['stage']
                                LOGGER.info('export_renderer_stage jobId=%s stage=%s', export_id, stage)
                                mark_export(project_id, export_id, message=stages[stage])
                                continue
                            if event.get('errorCode') == 'render_resource_limit':
                                resource_error = True
                                continue
                            progress = int(float(event.get("progress", 0)))
                        except (ValueError, TypeError, AttributeError):
                            continue
                        progress = max(1, min(99, progress))
                        if progress != last_progress:
                            mark_export(project_id, export_id, progress=progress)
                            last_progress = progress
                    result = process.wait()
                finally:
                    timer.cancel()
                    watchdog_stop.set()
                    watchdog.join(timeout=6)
            if timed_out.is_set():
                raise JobFailure('render_timeout', 'Export stopped because the renderer made no progress. Please retry the export.')
            if exceeded.is_set() or error_path.stat().st_size > 8 * 1024 * 1024 or output_quota_exceeded(output_path, owner, limit, export_id):
                raise JobFailure('storage_limit', "Export exceeded the workspace or output file storage limit.")
            if resource_error:
                raise JobFailure('render_resource_limit', "This scene exceeds rendering limits. Lower export resolution, use smaller images, or reduce overlapping video layers, then retry.")
            if result or not output_path.is_file() or output_path.stat().st_size < 100:
                error_file.seek(0)
                LOGGER.error("Renderer failed with exit code %s", result)
                raise JobFailure('render_dependency', "Export failed. Verify FFmpeg and the rendering dependencies, then retry.")
        name = re.sub(r"[^\w .-]", "", snapshot["name"]).strip()[:70] or "bol-captions"
        res_label = "4k" if resolution == 2160 else f"{resolution}p"
        trace.enter('saving')
        mark_export(project_id, export_id, status="ready", progress=100, message="Your video is ready.", filename=f"{name}-{mode}-{res_label}-{fps}fps.mp4", diagnostics=trace.finish())
    except Exception as exc:
        if _was_deleted(project_id):
            return
        capture_job_error(exc, "export")
        diagnostics = trace.finish(exc)
        output_path.unlink(missing_ok=True)
        message = str(exc) if isinstance(exc, JobFailure) else "Export failed. Check the local rendering dependencies and try again."
        mark_export(project_id, export_id, status="error", progress=0, message=message, diagnostics=diagnostics)
    finally:
        # Snapshots can contain private captions; keep only project data and the output.
        snapshot_path.unlink(missing_ok=True)
        (directory / f"export-{export_id}.log").unlink(missing_ok=True)
        shutil.rmtree(temporary_path, ignore_errors=True)


def recover_interrupted_jobs(journal=None):
    unfinished = journal.unfinished() if journal else []
    transcriptions = {(args[0], args[1]) for _, _, kind, args in unfinished
                     if kind == 'transcription_job' and len(args) >= 2}
    exports = {(args[0], args[1]) for _, _, kind, args in unfinished
               if kind == 'export_job' and len(args) >= 2}
    with LOCK:
        for path in DATA_DIR.glob("*/project.json"):
            try:
                project = json.loads(path.read_text())
                changed = False
                if project.get("status") in {"queued", "processing"}:
                    if (project['id'], project.get('transcriptionGeneration', 0)) in transcriptions:
                        project.update(status="queued", progress=0, message="Resuming transcription after a server restart.")
                    else:
                        project["transcriptionGeneration"] = project.get("transcriptionGeneration", 0) + 1
                        project.update(status="error", progress=0, message="Processing was interrupted by a server restart. Retry transcription.")
                    changed = True
                for job in project.get("exports", []):
                    if job.get("status") in {"queued", "processing"}:
                        if (project['id'], job['id']) in exports:
                            job.update(status="queued", progress=0, message="Resuming export after a server restart.")
                        else:
                            job.update(status="error", progress=0, message="Export was interrupted by a server restart. Export again.")
                        changed = True
                if changed:
                    project["revision"] = project.get("revision", 0) + 1
                    write_project(project)
            except Exception:
                LOGGER.error("job_recovery_failed project_id=%s", path.parent.name)


def resume_transcription(project_id, generation):
    with LOCK:
        if _was_deleted(project_id): return
        project = load_project(project_id)
        if project.get('status') not in {'queued', 'processing'} or project.get('transcriptionGeneration', 0) != generation: return
    transcription_job(project_id, generation)


def resume_export(project_id, export_id, snapshot, mode, resolution, fps=60):
    with LOCK:
        if _was_deleted(project_id): return
        project = load_project(project_id)
        job = next((item for item in project.get('exports', []) if item['id'] == export_id), None)
        if not job or job.get('status') not in {'queued', 'processing'}: return
    export_job(project_id, export_id, snapshot, mode, resolution, fps)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global EXECUTOR, TRANSCRIPTION_EXECUTOR, EXPORT_EXECUTOR
    with exclusive_store(DATA_DIR):
        if isinstance(EXECUTOR, BoundedExecutor) and EXECUTOR.closed:
            EXECUTOR = BoundedExecutor(MAX_WORKERS, MAX_QUEUED_JOBS, MAX_OWNER_JOBS)
            TRANSCRIPTION_EXECUTOR = EXPORT_EXECUTOR = EXECUTOR
        close_replay = lambda: None
        if isinstance(EXECUTOR, BoundedExecutor):
            EXECUTOR.journal = JobJournal(DATA_DIR)
            recover_interrupted_jobs(EXECUTOR.journal)
            close_replay = replay_jobs(EXECUTOR, EXECUTOR.journal,
                                      {'transcription_job': resume_transcription, 'export_job': resume_export})
        else:
            recover_interrupted_jobs()
        stop_cleanup = threading.Event()
        def clean_temporary_sessions():
            while not stop_cleanup.wait(10):
                reap_temporary_projects()
        cleanup_thread = threading.Thread(target=clean_temporary_sessions, daemon=True, name="temporary-session-cleanup")
        cleanup_thread.start()
        try:
            yield
        finally:
            stop_cleanup.set()
            await asyncio.to_thread(cleanup_thread.join)
            if isinstance(EXECUTOR, BoundedExecutor):
                close_replay()
                # Keep the data-store lock until every running writer has stopped.
                await asyncio.to_thread(EXECUTOR.shutdown)


initialize_monitoring()
app = FastAPI(title="Bol local media API", lifespan=lifespan)

# Origins default to the local dev server rather than "*". Set
# BOL_ALLOWED_ORIGINS to your frontend's origin in production; "*" is still
# available but has to be asked for.
#
# Known limitation, measured rather than assumed: this cannot be enforced on a
# Hugging Face Space. Their proxy appends
# `access-control-allow-origin: <the request's Origin>` to every response after
# the application has answered — a 401 this module produced and stripped the
# header from still arrives carrying it, and unrelated huggingface.co endpoints
# reflect the same way. Nothing in here can remove a header added downstream of
# it.
#
# So on a Space the allowlist is not a protection, and the API key is the only
# barrier in front of the API. This code is still correct for any deployment
# that is not behind that proxy, which is why it stays.
DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://[::1]:5173"
ALLOWED_ORIGINS = [
    v.strip()
    for v in os.getenv("BOL_ALLOWED_ORIGINS", os.getenv("CORS_ORIGINS", DEFAULT_ORIGINS)).split(",")
    if v.strip()
]
# A shared key, enabled by setting BOL_API_KEY. Unset — the local default — the
# gate is open so `npm run dev` needs no configuration.
#
# This is a deterrent, not authentication: the key ships inside the frontend
# bundle, so anyone who opens the app can read it. It stops drive-by traffic
# against a public deployment; it does not stop someone who wants in. Real
# per-user auth is a separate piece of work.
# Longest clip this deployment will render, in seconds. Unset means no limit,
# which is the local default: your own machine, your own time.
#
# It exists for shared hosting. Rendering is CPU work — headless Chromium plus
# libx264, no GPU — and a 20-minute export measured 26 minutes on an M2. On a
# Space's shared vCPUs that is plausibly an hour or more, past the watchdog in
# export_job, and a container restart loses the output because Space storage is
# ephemeral. Refusing up front beats failing an hour in.
try:
    MAX_EXPORT_SECONDS = float(os.getenv("BOL_MAX_EXPORT_SECONDS", "") or 0)
except ValueError:
    MAX_EXPORT_SECONDS = 0.0

API_KEY = os.getenv("BOL_API_KEY", "").strip()
# The Gradio landing page and the health check stay reachable so the Space shows
# as up without a key.
_OPEN_PATHS = {"/api/health", "/api/docs", "/api/openapi.json", "/api/cloud/google/callback"}


def _is_guarded(path: str) -> bool:
    """Whether the key is required for this path.

    Only our own API is guarded. The landing page is Gradio's, and it calls its
    own endpoints during boot — /gradio_api/startup-events among them — from
    inside the container with no key. Answering those with 401 stopped the app
    from starting at all, which is a gate doing its job to a request that was
    never the point of having one.
    """
    return path.startswith("/api/") and path not in _OPEN_PATHS


# Which workspace a request belongs to.
#
# Projects used to be keyed by id alone, so /api/projects returned every project
# on the server: two people sharing a deployment saw each other's uploads in
# their workspace, and could open, edit and delete them. Scoping them costs one
# field, and it is the same field a real account system will fill in later —
# after login, the session's user id goes here instead of the browser's, and
# nothing else about the data model changes.
#
# It is separation, not authentication. The value arrives in a header the client
# sends, so anyone can set it to anything. It keeps friends out of each other's
# work by default; it does not defend against a friend who opens the developer
# tools. Say so plainly rather than letting it look like a security boundary.
OWNER_HEADER = "x-bol-owner"
# Matches /api/projects/<uuid>, the prefix of every per-project endpoint.
_PROJECT_PATH = re.compile(r"^/api/projects/([0-9a-fA-F-]{36})(?:/|$)")


def owner_of(request: Request) -> str:
    """Who this request belongs to.

    A verified Supabase user id wins outright. It is set by require_user, which
    has already checked the signature, so a client that also sends the old
    workspace header cannot use it to pick an identity — the header is read only
    when there is no account system configured at all.

    Media, thumbnails and downloads are fetched by <video src> and <img src>,
    which cannot set headers, so those requests carry the workspace as ?owner=
    exactly the way they already carry the API key. Without that fallback a
    browser asks for its own project's video as a stranger and is correctly
    refused. Signed in, those URLs carry a signed media token instead.
    """
    verified = getattr(request.state, "bol_owner", "")
    if verified:
        return str(verified)[:200]
    supplied = request.headers.get(OWNER_HEADER) or request.query_params.get("owner") or ""
    return supplied.strip()[:200]


def owns(project: dict, owner: str) -> bool:
    """Whether `owner` may see this project.

    With no accounts configured, a project with no owner is visible to everyone.
    That covered every project created before workspaces existed, and a local
    checkout where nobody sends the header — which is what keeps `npm run dev`
    working with no configuration.

    With accounts on, that same rule is a hole: every project already on disk has
    no owner, so it would be readable by whoever signs up. The promise that
    nothing needed migrating was true of a workspace id a browser made up, and
    stops being true the moment the owner means a person. So it fails closed —
    an unowned project belongs to nobody rather than to everybody.

    Nothing adopts those projects automatically. There is no way to tell whose
    they were, and a rule like "the first account to sign in gets them" would
    hand one person everyone else's work. scripts/backfill-owner.py exists for
    claiming a data directory on purpose.
    """
    stored = (project.get("owner") or "").strip()
    if AUTH_ENABLED:
        return bool(stored) and bool(owner) and stored == owner
    return not stored or stored == owner


async def scope_to_owner(request: Request, call_next):
    """Refuse another workspace's project before the endpoint ever sees it.

    Done here rather than in each handler because there are seventeen endpoints
    under /api/projects/{id} and the next one added would not have been covered.
    A missing check reads exactly like a working endpoint, so the safe default
    has to be structural.

    The refusal is 404, not 403: whether a project exists is itself none of the
    caller's business.
    """
    match = _PROJECT_PATH.match(request.url.path)
    if match and request.method != "OPTIONS":
        try:
            project = load_project(match.group(1))
        except HTTPException:
            project = None
        if project is not None and not owns(project, owner_of(request)):
            return JSONResponse({"detail": "Project not found."}, status_code=404)
    return await call_next(request)


# Which media paths a media token opens. Deliberately a list of exact suffixes
# rather than a prefix: a token is for watching one clip, so it must not reach
# the project JSON, the asset list, or anything that could enumerate.
_MEDIA_PATHS = re.compile(
    r"^/api/projects/[0-9a-fA-F-]{36}/(media|media-thumbnail"
    r"|exports/[0-9a-fA-F-]{36}/download"
    r"|assets/[0-9a-zA-Z-]{1,64}/(file|thumbnail|download))$"
)


def _media_token_owner(request: Request) -> str:
    """The owner a ?t= media token authorises here, or "".

    GET only, and only on the paths above. Everything else — including a POST to
    one of them — falls through to the normal token check, so a leaked media URL
    cannot be turned into a way to change anything.
    """
    token = request.query_params.get("t") or ""
    if not token or request.method != "GET":
        return ""
    match = _PROJECT_PATH.match(request.url.path)
    if not match or not _MEDIA_PATHS.match(request.url.path):
        return ""
    return owner_from_media_token(token, match.group(1))


async def require_user(request: Request, call_next):
    """Resolve the signed-in user before anything asks who is calling.

    Unconfigured — no BOL_SUPABASE_URL — this does nothing at all, and the owner
    falls back to the browser-supplied workspace header exactly as before. That
    is what keeps a local checkout working with no setup, the same bargain the
    API key gate already makes.

    Configured, every guarded request must carry a token. `_is_guarded` is the
    same predicate the key gate uses, and for the same reason: Gradio calls its
    own endpoints during boot from inside the container, and answering those
    with 401 stops the Space from starting.
    """
    if not AUTH_ENABLED or request.method == "OPTIONS" or not _is_guarded(request.url.path):
        return await call_next(request)
    media = _media_token_owner(request)
    if media:
        request.state.bol_owner = media
        return await call_next(request)
    authorization = request.headers.get("authorization", "")
    token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else ""
    if not token:
        return JSONResponse(
            {"detail": "Please sign in to continue.", "code": "unauthenticated"},
            status_code=401,
        )
    try:
        request.state.bol_owner = await user_id_from(token)
    except AuthError as error:
        return JSONResponse({"detail": error.detail, "code": error.code}, status_code=401)
    return await call_next(request)


async def require_api_key(request: Request, call_next):
    if not API_KEY or request.method == "OPTIONS" or not _is_guarded(request.url.path):
        return await call_next(request)
    # Media, thumbnails and downloads are loaded by <video src> and <img src>,
    # which cannot set headers, so the key is accepted as a query parameter too.
    # Authorization: Bearer used to be accepted here too. It carries the signed-in
    # user's token now, and one header cannot mean two credentials: a shared key
    # sent that way would satisfy this gate and fail the identity one, producing
    # two different 401s for the same request. The shared key keeps the header and
    # the query parameter it always had, and the frontend only ever used those.
    supplied = request.headers.get("x-api-key") or request.query_params.get("key") or ""
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
    # The creator's own line decision, mirroring `lineBreak` in src/lib/types.ts:
    # True always ends a caption page after this word, False never does, and
    # None leaves it to the clause breaker. Word is extra="forbid", so this has
    # to be declared here or every save carrying one would be rejected.
    lineBreak: StrictBool | None = None
    # An emoji matched to this word, and how sure the match was (1.0 when the
    # word is one the vocabulary lists outright). The editor decides which of a
    # line's candidates is actually drawn — see pickEmoji in src/lib/pages.ts.
    emoji: str | None = Field(default=None, max_length=16)
    emojiScore: float | None = Field(default=None, ge=0, le=1)
    # A position for the line this word starts, overriding the project's.
    posX: float | None = Field(default=None, ge=0, le=100)
    posY: float | None = Field(default=None, ge=0, le=100)

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
    heroFontFamily: str | None = None
    supportingFontFamily: str | None = None

    @field_validator("fontFamily", "heroFontFamily", "supportingFontFamily")
    @classmethod
    def _known_font(cls, value: str | None) -> str | None:
        if value is not None and value not in CAPTION_FONTS | LOCAL_ONLY_FONTS:
            raise ValueError(f"Unknown caption font: {value}")
        return value

    fontSize: float = Field(default=DEFAULT_SETTINGS["fontSize"], ge=CAPTION_BOUNDS["fontSize"]["min"], le=CAPTION_BOUNDS["fontSize"]["max"])
    position: float = Field(default=DEFAULT_SETTINGS["position"], ge=CAPTION_BOUNDS["position"]["min"], le=CAPTION_BOUNDS["position"]["max"])
    # Kept in step with MAX_WORDS_PER_PAGE in src/lib/pages.ts. The bound used to
    # be 8 while the editor's generate slider went to 12, so a caption could be
    # half a paragraph wide. Projects saved under the old bound are clamped on
    # the way in rather than rejected, so they still open.
    wordsPerLine: StrictInt = Field(default=DEFAULT_SETTINGS["wordsPerLine"], ge=1, le=MAX_WORDS_PER_LINE)

    @field_validator("wordsPerLine", mode="before")
    @classmethod
    def _clamp_words_per_line(cls, value):
        if isinstance(value, int) and not isinstance(value, bool) and value > MAX_WORDS_PER_LINE:
            return MAX_WORDS_PER_LINE
        return value

    uppercase: StrictBool = DEFAULT_SETTINGS["uppercase"]
    motion: float = Field(default=DEFAULT_SETTINGS["motion"], ge=0, le=2)
    effectScope: Literal["all", "emphasis"] = "all"
    aspect: Literal["original", "9:16", "1:1", "16:9"] = DEFAULT_SETTINGS["aspect"]

    # Everything the editor can set is declared here. These previously rode
    # through on extra="allow", so colours, offsets and widths reached the
    # renderer unchecked — the same gap that let an arbitrary fontFamily be
    # interpolated into a CSS font-family.
    positionX: float | None = Field(default=None, ge=0, le=100)
    textColor: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    backgroundColor: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    backgroundOpacity: float | None = Field(default=None, ge=0, le=100)
    glowRadius: float | None = Field(default=None, ge=0, le=80)
    strokeColor: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    strokeWidth: float | None = Field(default=None, ge=0, le=40)
    align: Literal["left", "center", "right"] | None = None
    showSafeArea: StrictBool | None = None
    autoHighlight: StrictBool | None = None
    heroFontSize: float | None = Field(default=None, ge=CAPTION_BOUNDS["heroFontSize"]["min"], le=CAPTION_BOUNDS["heroFontSize"]["max"])
    linkFontSizes: StrictBool | None = None
    # Typography adjustments layered over the template's own, so 1 and 0 mean
    # "leave it alone" — see src/lib/types.ts.
    lineHeight: float | None = Field(default=None, ge=0.6, le=2.0)
    letterSpacing: float | None = Field(default=None, ge=-0.1, le=0.5)
    bold: StrictBool | None = None
    italic: StrictBool | None = None
    underline: StrictBool | None = None
    strikethrough: StrictBool | None = None
    textCase: Literal["none", "upper", "lower", "sentence", "title"] | None = None
    safeArea: Literal["none", "reels", "shorts"] | None = None


class GreenScreenSettings(ValidatedModel):
    enabled: StrictBool
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    tolerance: float = Field(ge=0, le=100)
    spillReduction: StrictBool
    smoothEdges: StrictBool


class CanvasElement(ValidatedModel):
    id: str = Field(min_length=1, max_length=100)
    assetId: str = Field(min_length=1, max_length=100)
    name: str = Field(max_length=240)
    type: Literal["image", "video"]
    url: str = Field(default="", max_length=4096)
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)
    scale: float = Field(ge=0.15, le=3.5)
    rotation: float | None = Field(default=None, ge=-360, le=360)
    start: float | None = Field(default=None, ge=0, le=MAX_DURATION)
    end: float | None = Field(default=None, ge=0, le=MAX_DURATION)
    greenScreen: GreenScreenSettings | None = None
    visible: StrictBool | None = None
    locked: StrictBool | None = None
    zIndex: StrictInt | None = Field(default=None, ge=-10000, le=10000)


class ProjectPatch(ValidatedModel):
    words: list[Word] | None = Field(default=None, max_length=20000)
    settings: Settings | None = None
    glossary: list[str] | None = Field(default=None, max_length=200)
    isolateVocals: StrictBool | None = None
    emoji: StrictBool | None = None
    translate: StrictBool | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    videoEnabled: StrictBool | None = None
    revision: StrictInt | None = Field(default=None, ge=0)
    canvasElements: list[CanvasElement] | None = Field(default=None, max_length=500)
    activeMediaAssetId: str | None = None


class TranscribeRequest(ValidatedModel):
    script: Literal["roman", "native"] | None = None
    language: Literal["hi", "en", "auto"] | None = None
    # Brand names, handles and domains the recogniser cannot know. Stored on the
    # project so a re-transcription reuses them.
    glossary: list[str] | None = Field(default=None, max_length=200)
    # Strip background music before recognition. Off by default: on clean speech
    # it costs time and removes nothing.
    isolateVocals: StrictBool | None = None
    # Match an emoji to words. English only — the encoder is English-trained and
    # would score Hinglish confidently and wrongly. Ignored for other languages.
    emoji: StrictBool | None = None
    # Ask the recogniser for English out of non-English audio. This is Whisper's
    # own translate task, decoded from the audio, so it replaces the transcript
    # rather than annotating it.
    translate: StrictBool | None = None
    autoHighlight: StrictBool | None = None


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


async def strip_foreign_cors(request: Request, call_next):
    """Remove an allow-origin header we did not authorise.

    Gradio installs its own CORS middleware, and on the deployment it answered
    a request from https://evil.example by reflecting that origin straight
    back — so any page a visitor had open could call this API from their
    browser. Ours cannot simply outrank it: it sits further out, and CORSMiddleware
    does not overwrite a header an inner layer has already set.

    So the header is checked on the way out instead. An origin on the allowlist
    keeps its header; anything else loses it, and the browser refuses the
    response as it should.
    """
    response = await call_next(request)
    if request.url.path.startswith("/api/cloud/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
    origin = request.headers.get("origin")
    if not origin or "*" in ALLOWED_ORIGINS:
        return response
    if origin not in ALLOWED_ORIGINS:
        # MutableHeaders has no pop; deleting a header that is absent raises.
        for header in ("access-control-allow-origin", "access-control-allow-credentials"):
            if header in response.headers:
                del response.headers[header]
    return response


@contextmanager
def storage_reservation(owner: str, size: int, new_project: bool = False, upload_slot: bool = True):
    """Reserve account space and an upload slot atomically before accepting bytes."""
    with LOCK:
        count, used = owned_project_usage(owner)
        pending = UPLOAD_RESERVATIONS.get(owner, {"bytes": 0, "uploads": 0, "projects": 0})
        if upload_slot and sum(entry["uploads"] for entry in UPLOAD_RESERVATIONS.values()) >= MAX_TOTAL_UPLOADS:
            raise HTTPException(503, "Upload capacity is full. Retry when an upload finishes.", headers={"Retry-After": "30"})
        if upload_slot and pending["uploads"] >= MAX_OWNER_UPLOADS:
            raise HTTPException(429, "Too many uploads are in progress. Retry when one finishes.")
        if new_project and count + pending["projects"] >= MAX_OWNER_PROJECTS:
            raise HTTPException(429, "This workspace has reached its project limit. Delete a project first.")
        if used + active_output_reservations(owner) + pending["bytes"] + size > MAX_OWNER_STORAGE_BYTES:
            raise HTTPException(413, "This workspace has reached its storage limit. Delete media before uploading.")
        reserved = sum(entry["bytes"] for entry in UPLOAD_RESERVATIONS.values())
        free = min(shutil.disk_usage(DATA_DIR).free, shutil.disk_usage(tempfile.gettempdir()).free)
        if free < reserved + size + MIN_DISK_FREE_BYTES:
            raise HTTPException(507, "Available server storage is too low. Delete media or retry later.")
        UPLOAD_RESERVATIONS[owner] = pending
        pending["bytes"] += size
        pending["uploads"] += int(upload_slot)
        pending["projects"] += int(new_project)
    try:
        yield
    finally:
        with LOCK:
            pending["bytes"] -= size
            pending["uploads"] -= int(upload_slot)
            pending["projects"] -= int(new_project)
            if not any(pending.values()):
                UPLOAD_RESERVATIONS.pop(owner, None)


def validate_multipart_envelope(buffered, content_type: str) -> None:
    """Bound parts and headers before the downstream parser allocates them."""
    header = Message()
    header["content-type"] = content_type
    boundary = header.get_param("boundary", header="content-type")
    if header.get_content_type() != "multipart/form-data" or not boundary:
        return  # FastAPI supplies its normal missing/invalid multipart error.
    if not isinstance(boundary, str) or len(boundary) > 200:
        raise HTTPException(413, "Multipart boundary is too large.")
    try:
        delimiter = b"--" + boundary.encode("ascii")
    except UnicodeEncodeError as error:
        raise HTTPException(400, "Invalid multipart boundary.") from error
    buffered.seek(0)
    parts = 0
    in_headers = False
    header_bytes = 0
    line_start = True
    while line := buffered.readline(65536):
        is_boundary = line_start and line.rstrip(b"\r\n") in {delimiter, delimiter + b"--"}
        line_start = line.endswith(b"\n")
        if is_boundary:
            if line.rstrip(b"\r\n") == delimiter + b"--":
                break
            parts += 1
            if parts > 16:
                raise HTTPException(413, "Too many multipart fields. Upload one file at a time.")
            in_headers = True
            header_bytes = 0
        elif in_headers:
            header_bytes += len(line)
            if len(line) > 8192 or header_bytes > 16384:
                raise HTTPException(413, "Multipart headers are too large.")
            if line in {b"\r\n", b"\n"}:
                in_headers = False
    buffered.seek(0)


class UploadAdmissionMiddleware:
    """Bound bodies before Starlette parses/spools multipart files.

    A capped temporary buffer allows chunked requests to be rejected before
    routing, rather than letting the multipart parser exhaust disk first.
    Auth middleware runs outside this gate, so quotas use verified identities.
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        upload = scope.get("method") == "POST" and (path == "/api/projects" or bool(re.fullmatch(r"/api/projects/[0-9a-f-]{36}/assets", path)))
        if scope["type"] != "http" or not upload:
            return await self.app(scope, receive, send)
        request = Request(scope)
        owner = owner_of(request)
        if path != "/api/projects":
            try:
                project = load_project(path.split("/")[3])
                if not owns(project, owner):
                    raise HTTPException(404, "Project not found.")
            except HTTPException as error:
                return await JSONResponse({"detail": error.detail}, status_code=error.status_code)(scope, receive, send)
        header = request.headers.get("content-length")
        try:
            declared = int(header) if header is not None else None
            if declared is not None and declared < 0:
                raise ValueError
        except ValueError:
            return await JSONResponse({"detail": "Invalid request body length."}, status_code=400)(scope, receive, send)
        cap = MAX_BYTES + UPLOAD_MULTIPART_OVERHEAD
        if declared is not None and declared > cap:
            return await JSONResponse({"detail": "Upload request exceeds the file limit."}, status_code=413)(scope, receive, send)
        try:
            with LOCK:
                _, used = owned_project_usage(owner)
                remaining = MAX_OWNER_STORAGE_BYTES - used - active_output_reservations(owner) - UPLOAD_RESERVATIONS.get(owner, {}).get("bytes", 0)
            reservation = declared if declared is not None else min(cap, remaining)
            if reservation <= 0:
                raise HTTPException(413, "This workspace has reached its storage limit.")
            with storage_reservation(owner, reservation, path == "/api/projects"):
                with tempfile.TemporaryFile() as buffered:
                    total = 0
                    while True:
                        message = await receive()
                        if message["type"] == "http.disconnect":
                            return
                        chunk = message.get("body", b"")
                        total += len(chunk)
                        if total > min(cap, reservation):
                            raise HTTPException(413, "Upload exceeds the file or workspace storage limit.")
                        buffered.write(chunk)
                        if not message.get("more_body", False):
                            break
                    validate_multipart_envelope(buffered, request.headers.get("content-type", ""))
                    buffered.seek(0)
                    exhausted = False
                    async def replay():
                        nonlocal exhausted
                        if exhausted:
                            return await receive()
                        body = buffered.read(1024 * 1024)
                        more = buffered.tell() < total
                        if not more:
                            exhausted = True
                        return {"type": "http.request", "body": body, "more_body": more}
                    await self.app(scope, replay, send)
        except HTTPException as error:
            await JSONResponse({"detail": error.detail}, status_code=error.status_code, headers=error.headers)(scope, receive, send)


def check_storage_budget(owner: str) -> None:
    if owned_project_usage(owner)[1] > MAX_OWNER_STORAGE_BYTES:
        raise HTTPException(413, "This workspace has reached its storage limit. Delete media before uploading.")


def install_middleware(target: FastAPI) -> FastAPI:
    """Put the gate, the workspace check and the CORS allowlist on `target`.

    This exists as a function because the Hugging Face entrypoint does not serve
    this module's `app` — under the Gradio SDK it serves Gradio's own FastAPI
    app with these routes copied onto it, and `include_router` copies routes
    and no middleware. Every protection here is middleware, so the deployment
    ran with all three missing while each endpoint answered perfectly.

    Registering them from one place means the deployment cannot drift from what
    the tests exercise. Applying it twice to the same app would stack duplicate
    layers, so it refuses rather than doing it quietly.
    """
    if getattr(target.state, "bol_middleware_installed", False):
        return target
    target.add_middleware(BaseHTTPMiddleware, dispatch=scope_to_owner)
    target.add_middleware(BaseHTTPMiddleware, dispatch=strip_foreign_cors)
    target.add_middleware(UploadAdmissionMiddleware)
    # Inside the key gate and outside scope_to_owner: identity has to be resolved
    # before the ownership check reads it, and a 401 still has to pass back out
    # through strip_foreign_cors to lose a CORS header it was never owed.
    target.add_middleware(BaseHTTPMiddleware, dispatch=require_user)
    target.add_middleware(BaseHTTPMiddleware, dispatch=require_api_key)
    target.add_middleware(CORSMiddleware,
                          allow_origins=ALLOWED_ORIGINS,
                          allow_methods=["*"],
                          allow_headers=["*"],
                          allow_credentials=False)
    target.state.bol_middleware_installed = True
    return target


install_middleware(app)


def owned_project_usage(owner: str) -> tuple[int, int]:
    """How many projects `owner` has, and what they weigh on disk.

    Walked one project directory at a time rather than summed over DATA_DIR as
    a whole. That sum counted whatever else lives beside the projects — the
    speech model is 1.1 GB of it, the test fixtures more — so someone with a
    single short clip was told they were using well over a gigabyte, and the
    figure was everyone's total on a shared deployment rather than theirs.

    A directory with no project.json is not a project, which is exactly what
    keeps data/models and data/test-fixtures out of the count.
    """
    count = 0
    total = 0
    with LOCK:
        for path in DATA_DIR.glob("*/project.json"):
            try:
                project = json.loads(path.read_text())
            except (OSError, ValueError):
                continue
            if not owns(project, owner):
                continue
            count += 1
            for entry in path.parent.rglob("*"):
                try:
                    if entry.is_file():
                        total += entry.stat().st_size
                except OSError:
                    # write_project saves through a temporary file and replaces
                    # it, so a name walked a moment ago can already be gone. A
                    # usage figure is not worth failing the request over.
                    continue
    return count, total


@app.get("/api/limits")
def limits(request: Request):
    """What this deployment will accept, so the editor can say so up front.

    The disk figures are reported because nothing else can see them. A hosted
    deployment's disk size is not published by its host, and each upload keeps
    the original alongside its derived copies. Without this the first sign of a
    full disk is uploads failing.
    """
    usage = shutil.disk_usage(DATA_DIR)
    count, used = owned_project_usage(owner_of(request))
    return {"maxExportSeconds": MAX_EXPORT_SECONDS or None,
            "maxUploadBytes": MAX_BYTES,
            "maxAccountStorageBytes": MAX_OWNER_STORAGE_BYTES,
            "maxExportBytes": MAX_EXPORT_BYTES,
            "maxAccountProjects": MAX_OWNER_PROJECTS,
            "maxConcurrentUploads": MAX_OWNER_UPLOADS,
            "maxTotalConcurrentUploads": MAX_TOTAL_UPLOADS,
            "maxProjectAssets": MAX_PROJECT_ASSETS,
            "maxDurationSeconds": MAX_DURATION,
            "diskTotalBytes": usage.total,
            "diskFreeBytes": usage.free,
            "projectCount": count,
            # One figure under two names while the editor crosses over. The old
            # name claimed to be "the projects" and was the whole of DATA_DIR,
            # the 1.1 GB speech model included, so it is left pointing at the
            # honest number rather than at a total nobody can act on. Anything
            # new should read diskUsedByAccountBytes, which says whose bytes
            # these are — the answer differs per caller on a shared deployment.
            "diskUsedByAccountBytes": used,
            "diskUsedByProjectsBytes": used}


@app.get("/api/admin/access")
def admin_access(request: Request):
    return {"allowed": admin_allowed(request), "userId": getattr(request.state, "bol_owner", "")}


@app.get("/api/admin/analytics")
async def admin_analytics(request: Request, days: int = 7):
    require_admin(request)
    if days not in (7, 30):
        raise HTTPException(422, "Choose 7 or 30 days.")
    result = await analytics_overview(days)
    return JSONResponse(result, headers={"Cache-Control": "private, no-store"})


@app.get("/api/health")
def health():
    speech = model_status()
    queue = {}
    if isinstance(EXECUTOR, BoundedExecutor):
        with EXECUTOR.lock:
            queue = {'active': EXECUTOR.active, 'capacity': EXECUTOR.capacity,
                     'perOwnerLimit': EXECUTOR.per_owner, 'durable': EXECUTOR.journal is not None}
    return {"status": "ok", **speech, "ffmpeg": bool(shutil.which("ffmpeg") and shutil.which("ffprobe")),
            "maxUploadBytes": MAX_BYTES, "maxDuration": MAX_DURATION, "workers": MAX_WORKERS, 'queue': queue}


@app.get("/api/projects")
def projects(request: Request, summary: bool = False):
    owner = owner_of(request)
    result = []
    with LOCK:
        for path in DATA_DIR.glob("*/project.json"):
            try:
                project = json.loads(path.read_text())
            except (OSError, ValueError):
                continue
            if owns(project, owner):
                if summary:
                    project["wordCount"] = len(project.pop("words", []))
                result.append(project)
    return sorted(result, key=lambda p: p.get("created", ""), reverse=True)


@app.post("/api/projects", status_code=201)
async def upload_project(request: Request, file: Annotated[UploadFile, File()], script: Annotated[Literal["roman", "native"], Form()] = "roman",
                         language: Annotated[Literal["hi", "en", "auto"], Form()] = "hi",
                         autostart: Annotated[bool, Form()] = True):
    project_id = str(uuid.uuid4())
    directory = project_dir(project_id)
    directory.mkdir(parents=True)
    try:
        with job_slot(owner_of(request), enabled=autostart) as queue:
            if autostart:
                validate_transcription_request(script)
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
                       **metadata, "videoEnabled": metadata["mediaType"] == "video", "created": datetime.now(timezone.utc).isoformat(),
                       "status": "queued" if autostart else "ready", "progress": 0,
                       "message": "Queued for local transcription." if autostart else "Ready when you are.",
                       "words": [], "settings": copy.deepcopy(DEFAULT_SETTINGS),
                       "waveform": [], "exports": [], "script": script, "language": language, "revision": 1,
                       "owner": owner_of(request)}
            temporary_id = request.headers.get("x-bol-temporary-session")
            if temporary_id:
                try:
                    temporary_id = str(uuid.UUID(temporary_id))
                except ValueError:
                    raise HTTPException(422, "Invalid temporary session.")
                project["temporarySession"] = {"id": temporary_id, "expiresAt": time.time() + LEASE_SECONDS}
            write_project(project)
            # Before the project is handed back, so the file the browser streams is
            # the final one. Left until transcription, this rewrote the source out
            # from under a preview that was already playing it.
            await asyncio.to_thread(remux_for_playback, project)
            check_storage_budget(owner_of(request))
            # The editor asks what language was spoken before starting, so it opts
            # out and calls /transcribe itself once the creator has answered.
            # Starting here regardless would transcribe with whatever settings were
            # left over from the previous clip, and leave the project busy — which
            # disabled the very button meant to start it.
            if autostart:
                queue.submit(transcription_job, project_id, project.get("transcriptionGeneration", 0))
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
def get_project(project_id: str, summary: bool = False):
    project = load_project(project_id)
    if summary:
        project["wordCount"] = len(project.pop("words", []))
        project.pop("waveform", None)
        project.pop("canvasElements", None)
    return project


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
            # Asking an audio project for a video layer is a real mistake. Being
            # told it has none is not — and only the first was ever meant to be
            # refused.
            #
            # An audio upload is stored with videoEnabled False, and the editor
            # autosaves the whole project on every change with that field
            # included. So every save an audio creator made came back 409
            # "Audio projects do not have a video layer": not one caption edit,
            # rename or setting was ever written to disk, and the only sign was
            # the save badge going amber. Found because the Settings panel's
            # frame-shape control would not stick on an audio clip.
            if project["mediaType"] != "video":
                if request.videoEnabled:
                    raise HTTPException(409, "Audio projects do not have a video layer.")
            else:
                project["videoEnabled"] = request.videoEnabled
        if request.isolateVocals is not None:
            project["isolateVocals"] = bool(request.isolateVocals)
        for option in ("emoji", "translate"):
            value = getattr(request, option)
            if value is not None:
                project[option] = value
        if request.glossary is not None:
            project["glossary"] = [t.strip()[:80] for t in request.glossary if t and t.strip()][:200]
        if request.activeMediaAssetId is not None:
            if request.activeMediaAssetId != "primary" and project.get("mediaType") != "video":
                raise HTTPException(422, "Primary video selection requires a video project.")
            selected = next((a for a in project.get("mediaAssets", []) if a.get("id") == request.activeMediaAssetId), None)
            if request.activeMediaAssetId != "primary" and (not selected or selected.get("mediaType") != "video"):
                raise HTTPException(422, "Select a video belonging to this project.")
            project["activeMediaAssetId"] = request.activeMediaAssetId
        if request.canvasElements is not None:
            assets = {a.get("id"): a for a in project.get("mediaAssets", [])}
            assets["primary"] = project
            seen = set()
            elements = []
            for model in request.canvasElements:
                element = model.model_dump(exclude_unset=True)
                asset = assets.get(element["assetId"])
                if not asset or asset.get("mediaType") != element["type"]:
                    raise HTTPException(422, "Canvas asset type must match media belonging to this project.")
                if element["id"] in seen:
                    raise HTTPException(422, "Canvas element identifiers must be unique.")
                seen.add(element["id"])
                start = element.get("start") if element.get("start") is not None else 0
                end = element.get("end") if element.get("end") is not None else project["duration"]
                if start >= end or end > project["duration"]:
                    raise HTTPException(422, "Canvas timing must fit inside the project duration.")
                elements.append(element)
            project["canvasElements"] = elements
    return update_project(project_id, mutate)


def reap_temporary_projects():
    """Only explicitly temporary uploads expire; existing saved work is untouched."""
    with LOCK:
        for path in DATA_DIR.glob("*/project.json"):
            try:
                project = json.loads(path.read_text())
                if temporary_session_expired(project, time.time()):
                    delete_project(path.parent.name)
            except HTTPException as exc:
                if exc.status_code not in {404, 409}:
                    LOGGER.error("temporary_cleanup_failed project_id=%s", path.parent.name)
            except Exception:
                LOGGER.error("temporary_cleanup_failed project_id=%s", path.parent.name)


@app.post("/api/projects/{project_id}/temporary-session", status_code=204)
def touch_temporary_session(project_id: str, request: Request, closing: bool = False):
    with LOCK:
        project = load_project(project_id)
        lease = project.get("temporarySession")
        if not isinstance(lease, dict) or lease.get("id") != request.headers.get("x-bol-temporary-session"):
            raise HTTPException(404, "Temporary session not found.")
        lease["expiresAt"] = time.time() + (CLOSE_GRACE_SECONDS if closing else LEASE_SECONDS)
        # Lease maintenance does not change caption revisions or Undo history.
        write_project(project)
    return Response(status_code=204)


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: str) -> Response:
    """Remove a project and every file that belongs to it.

    Nothing could, until now. The only delete on this API was for one media
    asset, so every clip anyone ever uploaded stayed on the deployment's disk
    for good — the source, the playback copy derived from it, its thumbnail and
    every export beside them — and the only remedy was reaching the machine.

    Refused only while the worker is actually inside the project. Transcription
    and export both write it back through update_project, and write_project
    recreates the directory it is handed — so a delete landing between two of
    those writes removes the media and leaves a project.json for a clip whose
    files are gone: a project that lists, opens, and can neither play nor
    export. The two running states are refused separately because the person
    waiting needs to know which one to wait for.

    Queued work is not a reason to refuse, and this is the case that matters
    most: an upload starts recognition by default, so "I picked the wrong file"
    would have meant waiting out a transcript of it — possibly behind somebody
    else's, since there is one worker. The queued job is allowed to run and find
    nothing, which both jobs now treat as a cancellation. The check and the
    removal share one lock with every update_project, so the job is either
    already processing, and this refuses, or it is not, and it never starts.

    Nothing checks ownership here on purpose: scope_to_owner has already refused
    another workspace's project before this function is reached, and repeating
    the check per endpoint is how one of them ends up missing it.
    """
    with LOCK:
        project = load_project(project_id)
        if project["status"] == "processing":
            raise HTTPException(409, "This clip is being transcribed right now. Wait for it to finish, then delete it.")
        if any(job["status"] == "processing" for job in project.get("exports", [])):
            raise HTTPException(409, "An export is still rendering. Wait for it to finish, then delete this project.")
        directory = project_dir(project_id)
        shutil.rmtree(directory, ignore_errors=True)
        if directory.exists():
            # Said out loud rather than swallowed: the editor drops the project
            # from its list the moment this returns ok, so a quiet failure looks
            # like a delete that worked until the next poll brings it back.
            raise HTTPException(500, "Some of this project's files could not be removed. Please try again.")
    # 204 and no body. There is nothing left to describe once the directory is
    # gone, and a {"status": "ok"} body invites a caller to test a field that
    # only repeats the status line — the kind of check that keeps passing after
    # the meaning behind it has changed.
    return Response(status_code=204)


@app.post("/api/projects/{project_id}/transcribe")
def retry_transcription(project_id: str, request: TranscribeRequest | None = None):
    with job_slot(load_project(project_id).get("owner", "local")) as queue:
        def mutate(project):
            if project["status"] in {"queued", "processing"}:
                raise HTTPException(409, "This clip is already queued for transcription.")
            if request:
                req_data = request.model_dump(exclude_none=True)
                if "autoHighlight" in req_data:
                    project["settings"]["autoHighlight"] = req_data.pop("autoHighlight")
                project.update(req_data)
            try:
                validate_transcription_request(project.get("script", "roman"), bool(project.get("translate")))
            except ValueError as exc:
                raise HTTPException(422, str(exc))
            project["transcriptionGeneration"] = project.get("transcriptionGeneration", 0) + 1
            CANCELLATIONS.discard(project_id)
            project.update(status="queued", progress=0, message="Queued for local transcription.")
        result = update_project(project_id, mutate)
        queue.submit(transcription_job, project_id, result["transcriptionGeneration"])
        return result


@app.post("/api/projects/{project_id}/cancel")
def cancel_transcription(project_id: str):
    load_project(project_id)
    with LOCK:
        CANCELLATIONS.add(project_id)
        def mutate(p):
            if p["status"] in {"queued", "processing"}:
                p["transcriptionGeneration"] = p.get("transcriptionGeneration", 0) + 1
                p.update(status="ready", progress=0, message="Transcription cancelled.")
        return update_project(project_id, mutate)


@app.post("/api/projects/{project_id}/media-token")
def media_token(project_id: str, request: Request):
    """A short-lived key for this project's media URLs.

    Reaching here means scope_to_owner has already proved the caller owns the
    project, so there is nothing further to check. The token it returns is what
    <video src> carries instead of a real credential.
    """
    load_project(project_id)
    return {
        "token": mint_media_token(project_id, owner_of(request)),
        "expiresIn": MEDIA_TOKEN_TTL_SECONDS,
    }


@app.get("/api/projects/{project_id}/media")
def media(project_id: str):
    project = load_project(project_id)
    directory = project_dir(project_id)
    path = playable_media(project)
    if not path.is_file():
        raise HTTPException(409, "The media preview is still being prepared.")
    return FileResponse(path, media_type="video/mp4" if project["mediaType"] == "video" else "audio/mp4")


@app.get("/api/projects/{project_id}/audio")
def audio_track(project_id: str):
    project = load_project(project_id)
    directory = project_dir(project_id)
    with LOCK:
        audio_lock = AUDIO_DOWNLOAD_LOCKS.setdefault(project_id, threading.Lock())
    # Concurrent clicks must not encode into the same temporary file.
    with audio_lock:
        preview = directory / "preview.m4a"
        audio_path = preview if project["mediaType"] == "audio" and preview.is_file() else directory / "audio.m4a"
        if not audio_path.is_file():
            source = directory / "source.bin"
            if not source.is_file():
                raise HTTPException(404, "Original media file not found.")
            temporary = directory / "audio.tmp.m4a"
            try:
                limit = int(project["duration"] * 32000) + 1024 * 1024
                with storage_reservation(project.get("owner", ""), limit, upload_slot=False):
                    run_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-map", "0:a:0",
                                 "-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-fs", str(limit), str(temporary)], 300)
                    if temporary.stat().st_size >= limit or output_quota_exceeded(temporary, project.get("owner", ""), limit):
                        raise HTTPException(413, "Audio preparation exceeded the workspace storage limit.")
                    temporary.replace(audio_path)
            finally:
                temporary.unlink(missing_ok=True)
    return FileResponse(audio_path, media_type="audio/mp4", filename=f"{project['name']}.m4a")


@app.post("/api/projects/{project_id}/exports", status_code=202)
def create_export(project_id: str, request: ExportRequest):
    if load_project(project_id).get("cloudAudioOnly"):
        raise HTTPException(409, "Wait for the original video to finish saving to Drive before exporting.")
    with job_slot(load_project(project_id).get("owner", "local")) as queue:
        export_id = str(uuid.uuid4())
        with LOCK:
            project = load_project(project_id)
            if project["status"] != "ready":
                raise HTTPException(409, "Wait for a completed transcript before exporting.")
            if not project["words"]:
                raise HTTPException(422, "There are no caption words to export.")
            if MAX_EXPORT_SECONDS and project["duration"] > MAX_EXPORT_SECONDS:
                limit = int(MAX_EXPORT_SECONDS // 60) or 1
                raise HTTPException(
                    422,
                    f"This clip is {int(project['duration'] // 60)}m {int(project['duration'] % 60)}s. "
                    f"Rendering here is capped at {limit} minutes so everyone's exports stay quick. "
                    "Download the SRT and burn it in your editor, or run Bol locally for the full length.",
                )
            if request.mode == "green" and project["settings"]["accent"].lower() == "#00ff00":
                raise HTTPException(422, "Choose an accent other than pure green so your captions remain visible after chroma keying.")
            if any(job["status"] in {"queued", "processing"} for job in project["exports"]):
                raise HTTPException(409, "An export for this clip is already in progress.")
            owner = project.get("owner", "")
            if owned_project_usage(owner)[1] + active_output_reservations(owner) + UPLOAD_RESERVATIONS.get(owner, {}).get("bytes", 0) + MAX_EXPORT_BYTES > MAX_OWNER_STORAGE_BYTES:
                raise HTTPException(413, "An export would exceed this workspace's storage limit. Delete media first.")
            snapshot = copy.deepcopy(project)
            job = {"id": export_id, "mode": request.mode, "resolution": request.resolution, "fps": request.fps, "status": "queued", "progress": 0,
                   "message": "Queued for rendering.", "revision": project["revision"], "storageReservationBytes": MAX_EXPORT_BYTES}
            update_project(project_id, lambda p: p["exports"].append(job))
        queue.submit(export_job, project_id, export_id, snapshot, request.mode, request.resolution, request.fps)
        return job


@app.get("/api/projects/{project_id}/exports")
def export_statuses(project_id: str):
    """Return export progress without resending private transcript/scene data."""
    return load_project(project_id).get("exports", [])


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


def validate_static_image(path: Path) -> None:
    try:
        if path.stat().st_size > 64 * 1024 * 1024:
            raise ValueError("Image files must be 64 MiB or smaller.")
        with Image.open(path, formats=["PNG", "JPEG", "WEBP"]) as image:
            if min(image.size) < 1 or max(image.size) > 8192:
                raise ValueError("Image dimensions must be positive and no larger than 8192 pixels.")
            if getattr(image, "is_animated", False):
                raise ValueError("Animated images are unsupported. Convert the animation to MP4 or WebM.")
            image.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise HTTPException(422, "The image file could not be decoded.") from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


def inspect_asset_file(path: Path, original_filename: str) -> dict:
    ext = Path(original_filename).suffix.lower()
    video_exts = {".mp4", ".mov", ".webm", ".avi", ".mkv"}
    audio_exts = {".mp3", ".wav", ".m4a"}
    image_exts = {".png", ".jpg", ".jpeg", ".webp"}
    if ext not in (video_exts | audio_exts | image_exts):
        raise HTTPException(422, "Unsupported file type.")
    if ext in image_exts:
        validate_static_image(path)

    result = run_process(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)], 30)
    try:
        info = json.loads(result.stdout)
        streams = info.get("streams", [])
        format_info = info.get("format", {})
        video_stream = next((s for s in streams if s.get("codec_type") == "video" and not s.get("disposition", {}).get("attached_pic")), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
    except Exception:
        raise HTTPException(422, "The media file could not be decoded.")

    try:
        if ext in image_exts:
            if not video_stream or video_stream.get("codec_name") not in {"png", "mjpeg", "webp"}:
                raise ValueError("The file is not a supported image.")
            media_type = "image"
            duration = None
        elif ext in audio_exts:
            if not audio_stream or video_stream:
                raise ValueError("The file is not an audio-only clip.")
            media_type = "audio"
            duration = float(format_info.get("duration") or audio_stream.get("duration") or 0)
        else:
            if not video_stream:
                raise ValueError("The file has no video track.")
            media_type = "video"
            duration = float(format_info.get("duration") or video_stream.get("duration") or 0)
        if duration is not None and (not math.isfinite(duration) or duration <= .05 or duration > MAX_DURATION):
            raise ValueError("Media must have a readable duration between 0.05 seconds and 20 minutes.")
        width = int(video_stream.get("width", 0)) if media_type != "audio" else None
        height = int(video_stream.get("height", 0)) if media_type != "audio" else None
        if media_type == "video":
            rotation = next((side.get("rotation", 0) for side in video_stream.get("side_data_list", []) if "rotation" in side), video_stream.get("tags", {}).get("rotate", 0))
            if int(float(rotation)) % 180:
                width, height = height, width
        if media_type != "audio" and (min(width, height) < 1 or max(width, height) > 8192 or width * height > 8192 * 8192):
            raise ValueError("Media dimensions must be positive and no larger than 8192 pixels.")
        return {"mediaType": media_type, "duration": round(duration, 3) if duration is not None else None,
                "width": width, "height": height}
    except (ValueError, TypeError, OverflowError) as error:
        raise HTTPException(422, str(error)) from error


def generate_asset_thumb(source_path: Path, thumb_path: Path, media_type: str) -> None:
    try:
        thumb_path.parent.mkdir(parents=True, exist_ok=True)
        if media_type == "video":
            run_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", "0.5", "-i", str(source_path),
                         "-frames:v", "1", "-vf", "scale=360:-1", str(thumb_path)], 20)
        elif media_type == "image":
            run_bounded_media_process(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source_path),
                         "-vf", "scale=360:-1", str(thumb_path)], 20)
    except Exception as exc:
        LOGGER.warning("Thumbnail generation skipped for %s: %s", source_path.name, exc)


def prepare_asset_preview(source: Path, destination: Path, metadata: dict, project: dict) -> bool:
    """Keep original media immutable; normalize unsupported browser video."""
    if metadata["mediaType"] != "video":
        return False
    video, audio = _streams(source)
    native_mp4 = source.suffix.lower() == ".mp4" and video == "h264" and audio in {"", "aac", "mp3"}
    native_webm = source.suffix.lower() == ".webm" and video in {"vp8", "vp9"} and audio in {"", "opus", "vorbis"}
    if native_mp4 or native_webm:
        return False
    stream_info = json.loads(run_process(["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(source)]).stdout)
    video_stream = next((stream for stream in stream_info.get("streams", []) if stream.get("codec_type") == "video"), {})
    pixel_format = str(video_stream.get("pix_fmt", "")).lower()
    if pixel_format.startswith(("yuva", "gbrap", "rgba", "bgra", "argb", "abgr", "ya")) or video_stream.get("tags", {}).get("alpha_mode") == "1":
        raise ValueError("Transparent video cannot be normalized for browser preview. Use a static PNG or remove its alpha channel before uploading.")
    temporary = destination.with_name(destination.stem + ".tmp.mp4")
    preview_project = {**project, "duration": metadata["duration"]}
    limit = min(MAX_BYTES, int(metadata["duration"] * 2_000_000) + 1024 * 1024)
    try:
        run_bounded_media_process([
            "ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source),
            "-map", "0:V:0", "-map", "0:a:0?",
            "-vf", "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(temporary),
        ], 1800, preview_project, limit)
        if _streams(temporary)[0] != "h264":
            raise ValueError("Browser video preparation did not produce a playable video.")
        temporary.replace(destination)
        return True
    finally:
        temporary.unlink(missing_ok=True)


def manifest_asset_path(project_id: str, asset_id: str, preview: bool = False) -> tuple[dict, Path]:
    try:
        if str(uuid.UUID(asset_id)) != asset_id:
            raise ValueError
    except (ValueError, AttributeError):
        raise HTTPException(404, "Asset not found.")
    project = load_project(project_id)
    asset = next((a for a in project.get("mediaAssets", []) if a.get("id") == asset_id), None)
    if not asset:
        raise HTTPException(404, "Asset not found.")
    directory = project_dir(project_id).resolve()
    use_preview = bool(preview and asset.get("previewFile"))
    relative = asset.get("previewFile") if use_preview else asset.get("sourceFile", "")
    pattern = rf"assets/{re.escape(asset_id)}\.preview\.mp4" if use_preview else rf"assets/{re.escape(asset_id)}\.[a-z0-9]+"
    if not isinstance(relative, str) or not re.fullmatch(pattern, relative):
        raise HTTPException(404, "Asset file not found.")
    assets = directory / "assets"
    path = directory / relative
    if assets.resolve() != assets or not path.is_file() or path.resolve().parent != assets:
        raise HTTPException(404, "Asset file not found.")
    return asset, path


@app.get("/api/projects/{project_id}/media-thumbnail")
def project_media_thumbnail(project_id: str):
    directory = project_dir(project_id)
    thumb_path = directory / "preview.thumb.jpg"
    if not thumb_path.is_file():
        source_path = playable_media(load_project(project_id))
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
async def upload_project_asset(project_id: str, request: Request, file: Annotated[UploadFile, File()]):
    directory = project_dir(project_id)
    project = load_project(project_id)
    if len(project.get("mediaAssets", [])) >= MAX_PROJECT_ASSETS:
        raise HTTPException(429, "This project has reached its media asset limit.")
    assets_dir = directory / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    raw_filename = Path((file.filename or "media").replace("\\", "/")).name[:240]
    ext = Path(raw_filename).suffix.lower()
    asset_id = str(uuid.uuid4())
    dest_path = assets_dir / f"{asset_id}{ext}"
    thumb_path = assets_dir / f"{asset_id}.thumb.jpg"
    preview_path = assets_dir / f"{asset_id}.preview.mp4"

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
        normalized = await asyncio.to_thread(prepare_asset_preview, dest_path, preview_path, meta, project)
        await asyncio.to_thread(generate_asset_thumb, preview_path if normalized else dest_path, thumb_path, meta["mediaType"])

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
            "previewFile": f"assets/{asset_id}.preview.mp4" if normalized else None,
            "previewNormalized": normalized,
            "thumbnailFile": f"assets/{asset_id}.thumb.jpg" if thumb_path.is_file() else None,
            "url": f"/api/projects/{project_id}/assets/{asset_id}/file",
            "thumbnailUrl": f"/api/projects/{project_id}/assets/{asset_id}/thumbnail" if thumb_path.is_file() else None,
            "greenScreen": None,
        }

        def append_asset(p):
            if "mediaAssets" not in p or not isinstance(p["mediaAssets"], list):
                p["mediaAssets"] = []
            if len(p["mediaAssets"]) >= MAX_PROJECT_ASSETS:
                raise HTTPException(429, "This project has reached its media asset limit.")
            p["mediaAssets"].append(asset)
        check_storage_budget(owner_of(request))
        update_project(project_id, append_asset)
        return asset
    except HTTPException:
        dest_path.unlink(missing_ok=True)
        thumb_path.unlink(missing_ok=True)
        preview_path.unlink(missing_ok=True)
        raise
    except ValueError as exc:
        dest_path.unlink(missing_ok=True)
        thumb_path.unlink(missing_ok=True)
        preview_path.unlink(missing_ok=True)
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        dest_path.unlink(missing_ok=True)
        thumb_path.unlink(missing_ok=True)
        preview_path.unlink(missing_ok=True)
        LOGGER.exception("Asset upload failed")
        raise HTTPException(500, "Upload failed. Check available disk space and retry.")
    finally:
        await file.close()


@app.get("/api/projects/{project_id}/assets/{asset_id}/file")
def get_asset_file(project_id: str, asset_id: str):
    directory = project_dir(project_id)
    if asset_id == "primary":
        project = load_project(project_id)
        path = playable_media(project)
        if not path.is_file():
            raise HTTPException(404, "Primary media file not found.")
        return FileResponse(path, media_type="video/mp4" if project["mediaType"] == "video" else "audio/mp4")

    _, file_path = manifest_asset_path(project_id, asset_id, preview=True)

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
    
    manifest_asset_path(project_id, asset_id)
    thumb_path = directory / "assets" / f"{asset_id}.thumb.jpg"
    if thumb_path.is_file() and thumb_path.resolve().parent == (directory / "assets").resolve():
        return FileResponse(thumb_path, media_type="image/jpeg")
    raise HTTPException(404, "Thumbnail not found.")


@app.get("/api/projects/{project_id}/assets/{asset_id}/download")
def download_asset_file(project_id: str, asset_id: str):
    project = load_project(project_id)
    directory = project_dir(project_id)
    
    if asset_id == "primary":
        path = directory / "source.bin"
        if not path.is_file():
            path = playable_media(project)
        if not path.is_file():
            raise HTTPException(404, "Primary media file not found.")
        return FileResponse(path, filename=project.get("filename", "clip.mp4"))

    asset, file_path = manifest_asset_path(project_id, asset_id)
    filename = asset.get("filename", file_path.name)
    return FileResponse(file_path, filename=filename)


class AssetPatchRequest(ValidatedModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    greenScreen: GreenScreenSettings | None = None


@app.patch("/api/projects/{project_id}/assets/{asset_id}")
def patch_asset(project_id: str, asset_id: str, request: AssetPatchRequest):
    def mutate(p):
        if asset_id == "primary":
            if request.name is not None and request.name.strip():
                p["name"] = request.name.strip()
                ext = Path(p.get("filename", "")).suffix
                p["filename"] = f"{request.name.strip()}{ext}"
            if request.greenScreen is not None:
                p["greenScreen"] = request.greenScreen.model_dump()
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
            asset["greenScreen"] = request.greenScreen.model_dump()
    return update_project(project_id, mutate)


@app.post("/api/projects/{project_id}/assets/{asset_id}/duplicate")
def duplicate_asset(project_id: str, asset_id: str, request: Request):
    project = load_project(project_id)
    if len(project.get("mediaAssets", [])) >= MAX_PROJECT_ASSETS:
        raise HTTPException(429, "This project has reached its media asset limit.")
    directory = project_dir(project_id)
    if asset_id == "primary":
        source = directory / "source.bin"
        if not source.is_file():
            source = playable_media(project)
    else:
        asset = next((a for a in project.get("mediaAssets", []) if a.get("id") == asset_id), None)
        if not asset:
            raise HTTPException(404, "Asset not found.")
        _, source = manifest_asset_path(project_id, asset_id)
    if not source.is_file():
        raise HTTPException(404, "Source file not found.")
    with storage_reservation(owner_of(request), source.stat().st_size + UPLOAD_MULTIPART_OVERHEAD):
        return _duplicate_asset(project_id, asset_id, owner_of(request))


def _duplicate_asset(project_id: str, asset_id: str, owner: str):
    directory = project_dir(project_id)
    project = load_project(project_id)
    
    if asset_id == "primary":
        source_file = directory / "source.bin"
        if not source_file.is_file():
            source_file = playable_media(project)
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
        
        _, source_file = manifest_asset_path(project_id, asset_id)

    new_id = str(uuid.uuid4())
    ext = Path(orig_filename).suffix.lower()
    new_assets_dir = directory / "assets"
    new_assets_dir.mkdir(parents=True, exist_ok=True)
    new_dest = new_assets_dir / f"{new_id}{ext}"
    new_thumb = new_assets_dir / f"{new_id}.thumb.jpg"
    new_preview = new_assets_dir / f"{new_id}.preview.mp4"
    try:
        shutil.copy2(source_file, new_dest)

        new_thumb = new_assets_dir / f"{new_id}.thumb.jpg"
        metadata = {"mediaType": orig_type, "duration": orig_duration, "width": orig_width, "height": orig_height}
        normalized = prepare_asset_preview(new_dest, new_preview, metadata, project)
        generate_asset_thumb(new_preview if normalized else new_dest, new_thumb, orig_type)

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
            "previewFile": f"assets/{new_id}.preview.mp4" if normalized else None,
            "previewNormalized": normalized,
            "thumbnailFile": f"assets/{new_id}.thumb.jpg" if new_thumb.is_file() else None,
            "url": f"/api/projects/{project_id}/assets/{new_id}/file",
            "thumbnailUrl": f"/api/projects/{project_id}/assets/{new_id}/thumbnail" if new_thumb.is_file() else None,
            "greenScreen": copy.deepcopy(orig_greenscreen) if orig_greenscreen else None,
        }

        def append(p):
            if "mediaAssets" not in p or not isinstance(p["mediaAssets"], list):
                p["mediaAssets"] = []
            if len(p["mediaAssets"]) >= MAX_PROJECT_ASSETS:
                raise HTTPException(429, "This project has reached its media asset limit.")
            p["mediaAssets"].append(new_asset)
        check_storage_budget(owner)
        update_project(project_id, append)
        return new_asset
    except Exception:
        new_dest.unlink(missing_ok=True)
        new_thumb.unlink(missing_ok=True)
        new_preview.unlink(missing_ok=True)
        raise


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

# Optional user-owned storage. Disabled until server credentials and SQL are installed.
from server.drive_routes import install as install_drive_routes
import sys as _sys
install_drive_routes(_sys.modules[__name__])
