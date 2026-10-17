"""Drive routes live outside the transient /projects namespace; every action checks ownership."""
from __future__ import annotations
import asyncio
import copy
import json
import os
import shutil
import time
from pathlib import Path
from typing import Literal
from uuid import UUID
from fastapi import HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from server import drive_storage as drive

class SourceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    mime: str = Field(max_length=120)
    size: int = Field(gt=0, le=1024 * 1024 * 1024)

class SaveRequest(BaseModel):
    workerId: UUID
    revision: int = Field(ge=0)

class OpenRequest(BaseModel):
    script: Literal['roman', 'native'] = 'roman'
    language: Literal['hi', 'en', 'auto'] = 'auto'

class ExportRequest(BaseModel):
    workerId: UUID
    exportId: UUID


def install(api):
    def owner(request):
        # Never enable cloud persistence with the local-development identity header.
        if not api.AUTH_ENABLED or not getattr(request.state, 'bol_owner', ''):
            raise HTTPException(401, 'Sign in to use Google Drive projects.')
        return api.owner_of(request)

    def worker(user, worker_id, cloud_id):
        p = api.load_project(str(worker_id))
        if not api.owns(p, user) or p.get('cloudId') != str(cloud_id):
            raise HTTPException(404, 'Project not found.')
        return p

    @api.app.get('/api/cloud/status')
    def status(request: Request):
        user = owner(request)
        if not drive.configured():
            return {'configured': False, 'connected': False}
        try:
            drive.connection(user)
            return {'configured': True, 'connected': True}
        except HTTPException as e:
            if e.status_code != 409:
                raise
            return {'configured': True, 'connected': False}

    @api.app.post('/api/cloud/connect')
    def connect(request: Request):
        return drive.begin_connect(owner(request))

    @api.app.get('/api/cloud/google/callback')
    def callback(state: str = '', code: str = ''):
        try:
            drive.finish_connect(state, code)
            outcome = 'connected'
        except HTTPException:
            outcome = 'failed'
        return RedirectResponse(os.environ.get('BOL_STUDIO_URL', 'http://localhost:5200/studio') + '?drive=' + outcome, status_code=303,
                                headers={'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store'})

    @api.app.delete('/api/cloud/connection', status_code=204)
    def disconnect(request: Request):
        drive.disconnect(owner(request))
        return api.Response(status_code=204)

    @api.app.get('/api/cloud/projects')
    def listing(request: Request):
        from urllib.parse import urlencode
        rows = drive.db('bol_saved_projects?' + urlencode({'owner': 'eq.' + owner(request), 'select': 'id,name,revision,updated_at', 'order': 'updated_at.desc', 'limit': '100'}))
        return rows

    @api.app.post('/api/cloud/uploads')
    def begin_upload(body: SourceRequest, request: Request):
        user = owner(request)
        if not body.mime.startswith(('video/', 'audio/')):
            raise HTTPException(422, 'Choose a video or audio file.')
        # Bound uncommitted rows as well as completed projects.
        from urllib.parse import urlencode
        rows = drive.db('bol_saved_projects?' + urlencode({'owner': 'eq.' + user, 'select': 'id', 'limit': '101'}))
        if len(rows) >= 100:
            raise HTTPException(429, 'Your saved project limit is 100. Remove a project before uploading another.')
        return drive.new_source(user, Path(body.name.replace('\\', '/')).name, body.mime, body.size)

    @api.app.put('/api/cloud/projects/{cloud_id}/audio')
    async def stage_audio(cloud_id: UUID, request: Request):
        user = owner(request)
        row = await asyncio.to_thread(drive.project, user, str(cloud_id))
        if row['revision'] != 0:
            raise HTTPException(409, 'Audio can only be attached to a new upload.')
        folder = api.DATA_DIR / '.drive-audio'
        folder.mkdir(exist_ok=True)
        for stale in folder.glob('*.wav'):
            if stale.stat().st_mtime < time.time() - 3600:
                stale.unlink(missing_ok=True)
        destination = folder / (str(cloud_id) + '.wav')
        temporary = folder / (str(cloud_id) + '.' + api.secrets.token_hex(8) + '.tmp')
        total = 0
        try:
            with temporary.open('wb') as f:
                async for chunk in request.stream():
                    total += len(chunk)
                    if total > 8 * 1024 * 1024:
                        raise HTTPException(413, 'Use server audio extraction for this clip.')
                    f.write(chunk)
            import wave
            try:
                with wave.open(str(temporary), 'rb') as audio:
                    if audio.getnchannels() != 1 or audio.getframerate() != 16000 or audio.getsampwidth() != 2:
                        raise ValueError('Audio must be mono 16 kHz PCM')
            except (wave.Error, EOFError, ValueError):
                raise HTTPException(422, 'Use server audio extraction for this clip.')
            meta = await asyncio.to_thread(api.inspect_media, temporary)
            if meta['mediaType'] != 'audio' or meta['duration'] > 185:
                raise HTTPException(422, 'Use server audio extraction for this clip.')
            temporary.replace(destination)
            with destination.open('rb') as content:
                with api.storage_reservation(user, total, new_project=True):
                    result = await api.upload_project(request, UploadFile(file=content, filename='caption-audio.wav'),
                        script='roman', language='auto', autostart=False)
            result.update(cloudId=str(cloud_id), cloudRevision=0, cloudAudioOnly=True, name=row['name'])
            # Geometry is provisional until we inspect the private original. It is
            # used only for local preview, never accepted as export dimensions.
            kind = request.query_params.get('kind', 'audio')
            if kind == 'video':
                try:
                    width = int(request.query_params.get('width', '720'))
                    height = int(request.query_params.get('height', '1280'))
                    if not 1 <= min(width, height) <= max(width, height) <= 8192:
                        raise ValueError()
                except ValueError:
                    raise HTTPException(422, 'Invalid video dimensions.')
                result.update(mediaType='video', width=width, height=height, videoEnabled=True)
            shutil.copyfile(destination, api.project_dir(result['id']) / 'audio.wav')
            api.write_project(result)
            return result
        finally:
            temporary.unlink(missing_ok=True)

    @api.app.post('/api/cloud/projects/{cloud_id}/open')
    async def reopen(cloud_id: UUID, body: OpenRequest, request: Request):
        user = owner(request)
        row = await asyncio.to_thread(drive.project, user, str(cloud_id))
        snapshot = row['snapshot']
        if snapshot.get('storageSchemaVersion', 1) != 1:
            raise HTTPException(409, 'This saved project needs a newer Bol Studio version.')
        # A fresh worker session per device avoids one device overwriting another's
        # local files. The database revision is the cross-device concurrency gate.
        with api.storage_reservation(user, api.MAX_BYTES, new_project=True):
            temporary = api.tempfile.TemporaryDirectory(dir=api.DATA_DIR)
            result = None
            try:
                source = Path(temporary.name) / 'source.bin'
                meta = await asyncio.to_thread(drive.download, user, row['source_file_id'], source, api.MAX_BYTES)
                if meta.get('appProperties', {}).get('bolProject') != str(cloud_id):
                    raise HTTPException(409, 'The Drive source does not match this project.')
                with source.open('rb') as f:
                    result = await api.upload_project(request, UploadFile(file=f, filename=meta['name']),
                        script=snapshot.get('script', body.script), language=snapshot.get('language', body.language), autostart=False)
                result['cloudId'] = str(cloud_id)
                result['cloudRevision'] = row['revision']
                directory = api.project_dir(result['id'])
                if snapshot and abs(float(snapshot.get('duration', result['duration'])) - result['duration']) >= 2:
                    raise HTTPException(409, 'The original video changed in Drive. Upload it as a new project to generate matching captions.')
                if result['mediaType'] == 'video' and not (directory / api.PLAYBACK_READY).is_file():
                    await asyncio.to_thread(api.prepare_asset_preview, directory / 'source.bin', directory / 'preview.mp4', result, result)
                staged = api.DATA_DIR / '.drive-audio' / (str(cloud_id) + '.wav')
                if staged.is_file():
                    audio_meta = await asyncio.to_thread(api.inspect_media, staged)
                    if abs(audio_meta['duration'] - result['duration']) < 2:
                        shutil.copyfile(staged, directory / 'audio.wav')
                    staged.unlink(missing_ok=True)
                for key in ('name', 'words', 'settings', 'canvasElements', 'glossary', 'isolateVocals', 'emoji', 'translate', 'activeMediaAssetId', 'videoEnabled', 'waveform'):
                    if key in snapshot:
                        result[key] = copy.deepcopy(snapshot[key])
                assets = copy.deepcopy(snapshot.get('mediaAssets', []))
                if len(assets) > api.MAX_PROJECT_ASSETS:
                    raise HTTPException(413, 'Too many project assets.')
                for asset in assets:
                    # The manifest was produced by our own save endpoint, but validate
                    # paths again before any filesystem write.
                    asset_id = str(UUID(asset['id']))
                    relative = asset.get('sourceFile', '')
                    if not api.re.fullmatch(r'assets/' + api.re.escape(asset_id) + r'\.[a-z0-9]+', relative):
                        raise HTTPException(422, 'Invalid saved asset.')
                    target = directory / relative
                    target.parent.mkdir(exist_ok=True)
                    await asyncio.to_thread(drive.download, user, asset['driveFileId'], target, api.MAX_BYTES)
                    api.check_storage_budget(user)
                    asset['url'] = f"/api/projects/{result['id']}/assets/{asset_id}/file"
                    asset['previewFile'] = None
                    asset['previewNormalized'] = False
                    asset['thumbnailUrl'] = None
                    asset_meta = await asyncio.to_thread(api.inspect_asset_file, target, asset['filename'])
                    preview = directory / 'assets' / (asset_id + '.preview.mp4')
                    if await asyncio.to_thread(api.prepare_asset_preview, target, preview, asset_meta, result):
                        asset['previewFile'] = 'assets/' + preview.name
                        asset['previewNormalized'] = True
                result['mediaAssets'] = assets
                for element in result.get('canvasElements', []):
                    asset_id = element['assetId']
                    element['url'] = f"/api/projects/{result['id']}/media" if asset_id == 'primary' else f"/api/projects/{result['id']}/assets/{asset_id}/file"
                api.write_project(result)
                if row['revision'] == 0:
                    saved = await asyncio.to_thread(drive.save, user, str(cloud_id), 0, clean_snapshot(result))
                    result['cloudRevision'] = saved['revision']
                    api.write_project(result)
                return result
            except Exception:
                if result:
                    shutil.rmtree(api.project_dir(result['id']), ignore_errors=True)
                raise
            finally:
                temporary.cleanup()

    @api.app.post('/api/cloud/projects/{cloud_id}/commit')
    def commit_source(cloud_id: UUID, body: SaveRequest, request: Request):
        user = owner(request)
        p = worker(user, body.workerId, cloud_id)
        row = drive.project(user, str(cloud_id))
        directory = api.project_dir(p['id'])
        target = directory / ('drive-' + api.secrets.token_hex(8) + '.bin')
        with api.storage_reservation(user, api.MAX_BYTES):
            try:
                meta = drive.download(user, row['source_file_id'], target, api.MAX_BYTES)
                if meta.get('appProperties', {}).get('bolProject') != str(cloud_id):
                    raise HTTPException(409, 'The Drive source does not match this project.')
                media = api.inspect_media(target)
                if abs(media['duration'] - p['duration']) >= 2:
                    raise HTTPException(422, 'The extracted audio does not match the original video. Reopen this project to use server extraction.')
                target.replace(directory / 'source.bin')
                prepared = {**p, **media}
                if not api.remux_for_playback(prepared) and media['mediaType'] == 'video':
                    api.prepare_asset_preview(directory / 'source.bin', directory / 'preview.mp4', media, prepared)
                with api.LOCK:
                    latest = api.load_project(p['id'])
                    latest.update(**media, filename=meta['name'], cloudAudioOnly=False)
                    latest.pop('cloudSaveError', None)
                    api.write_project(latest)
                if latest.get('status') not in ('queued', 'processing'):
                    persist_project(p['id'])
                return api.load_project(p['id'])
            finally:
                target.unlink(missing_ok=True)

    def clean_snapshot(p):
        clean = copy.deepcopy(p)
        for key in ('owner', 'temporarySession', 'exports', 'diagnostics', 'cloudId', 'cloudRevision', 'cloudSaveError', 'cloudAudioOnly'):
            clean.pop(key, None)
        clean.update(status='ready', progress=100, storageSchemaVersion=1)
        return clean

    def persist_project(project_id, expected_revision=None):
        p = api.load_project(project_id)
        if not p.get('cloudId'):
            return None
        if p.get('cloudAudioOnly'):
            raise HTTPException(409, 'The original video is still saving to Drive.')
        user = p['owner']
        revision = p.get('cloudRevision', 0) if expected_revision is None else expected_revision
        row = drive.project(user, p['cloudId'])
        if row['revision'] != revision:
            raise HTTPException(409, 'This project changed on another device. Reopen the saved project before continuing.')
        snapshot = clean_snapshot(p)
        previous = {a['id']: a for a in row['snapshot'].get('mediaAssets', [])}
        for asset in snapshot.get('mediaAssets', []):
            old = previous.get(asset['id'], {})
            _, path = api.manifest_asset_path(p['id'], asset['id'])
            asset['driveFileId'] = old.get('driveFileId') or drive.upload_path(user, path, asset['filename'],
                properties={'bolProject': p['cloudId'], 'bolAsset': asset['id']})
        saved = drive.save(user, p['cloudId'], revision, snapshot)
        with api.LOCK:
            latest = api.load_project(project_id)
            latest['cloudRevision'] = saved['revision']
            latest.pop('cloudSaveError', None)
            api.write_project(latest)
        return {'revision': saved['revision']}

    api.persist_drive_project = persist_project

    @api.app.post('/api/cloud/projects/{cloud_id}/save')
    def save(cloud_id: UUID, body: SaveRequest, request: Request):
        user = owner(request)
        p = worker(user, body.workerId, cloud_id)
        if p.get('status') in ('processing', 'queued'):
            raise HTTPException(409, 'Wait for captions to finish before saving the project.')
        return persist_project(p['id'], body.revision)

    @api.app.post('/api/cloud/projects/{cloud_id}/exports')
    def save_export(cloud_id: UUID, body: ExportRequest, request: Request):
        user = owner(request)
        drive.project(user, str(cloud_id))
        p = worker(user, body.workerId, cloud_id)
        job = next((e for e in p.get('exports', []) if e['id'] == str(body.exportId)), None)
        if not job or job.get('status') not in ('ready', 'complete'):
            raise HTTPException(409, 'Wait for the export to finish.')
        response = api.download_export(p['id'], str(body.exportId))
        path = Path(response.path)
        file_id = drive.upload_path(user, path, job.get('filename') or 'Bol Studio export.mp4', 'video/mp4',
            {'bolProject': str(cloud_id), 'bolExport': str(body.exportId)})
        return {'url': 'https://drive.google.com/file/d/' + file_id + '/view'}

    @api.app.delete('/api/cloud/projects/{cloud_id}', status_code=204)
    def forget(cloud_id: UUID, request: Request):
        from urllib.parse import urlencode
        user = owner(request)
        drive.project(user, str(cloud_id))
        # Removing from the library never silently deletes someone's Drive files.
        drive.db('bol_saved_projects?' + urlencode({'id': 'eq.' + str(cloud_id), 'owner': 'eq.' + user}), 'DELETE')
        return api.Response(status_code=204)
