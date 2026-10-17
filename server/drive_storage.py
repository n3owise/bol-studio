"""User-owned Drive storage. No broad scopes, public media links or client refresh tokens."""
from __future__ import annotations
import json
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

DRIVE = "https://www.googleapis.com/drive/v3"
TOKEN = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/drive.file"


def configured():
    return all(os.getenv(key, '').strip() for key in (
        'BOL_SUPABASE_URL', 'BOL_SUPABASE_SERVICE_ROLE_KEY', 'BOL_GOOGLE_CLIENT_ID',
        'BOL_GOOGLE_CLIENT_SECRET', 'BOL_GOOGLE_REDIRECT_URI', 'BOL_DRIVE_ENCRYPTION_KEY', 'BOL_STUDIO_URL'))


def cipher():
    try:
        return Fernet(os.environ['BOL_DRIVE_ENCRYPTION_KEY'].encode())
    except (KeyError, ValueError):
        raise HTTPException(503, 'Drive saving has not been configured yet.')


def db(path, method='GET', body=None, prefer='return=representation'):
    if not configured():
        raise HTTPException(503, 'Drive saving has not been configured yet.')
    key = os.environ['BOL_SUPABASE_SERVICE_ROLE_KEY']
    try:
        r = httpx.request(method, os.environ['BOL_SUPABASE_URL'].rstrip('/') + '/rest/v1/' + path,
                          headers={'apikey': key, 'Authorization': 'Bearer ' + key, 'Prefer': prefer},
                          json=body, timeout=30)
        r.raise_for_status()
        return r.json() if r.content else None
    except httpx.HTTPError:
        raise HTTPException(503, 'Project storage is unavailable. Your current edits are still in this tab; retry saving.')


def connection(owner):
    rows = db('bol_drive_connections?' + urlencode({'owner': 'eq.' + owner, 'select': '*'}))
    if not rows:
        raise HTTPException(409, 'Connect Google Drive to save or reopen this project.')
    return rows[0]


def project(owner, project_id):
    rows = db('bol_saved_projects?' + urlencode({'id': 'eq.' + str(project_id), 'owner': 'eq.' + owner}))
    if not rows:
        raise HTTPException(404, 'Saved project not found.')
    return rows[0]


def token(owner):
    c = connection(owner)
    try:
        refresh = cipher().decrypt(c['credentials'].encode()).decode()
    except (InvalidToken, ValueError):
        raise HTTPException(409, 'Please reconnect Google Drive.')
    try:
        r = httpx.post(TOKEN, data={'client_id': os.environ['BOL_GOOGLE_CLIENT_ID'],
            'client_secret': os.environ['BOL_GOOGLE_CLIENT_SECRET'], 'refresh_token': refresh,
            'grant_type': 'refresh_token'}, timeout=20)
        r.raise_for_status()
        return r.json()['access_token']
    except (httpx.HTTPError, KeyError):
        raise HTTPException(409, 'Google Drive needs to be reconnected. Your saved files have not been deleted.')


def google(method, path, access, **kwargs):
    try:
        r = httpx.request(method, DRIVE + path, headers={'Authorization': 'Bearer ' + access}, timeout=30, **kwargs)
        if r.status_code in (401, 403):
            raise HTTPException(409, 'Google Drive access was refused. Check storage space or reconnect.')
        if r.status_code == 404:
            raise HTTPException(409, 'A project file or the Bol Studio folder was removed from Drive.')
        r.raise_for_status()
        return r.json() if r.content else {}
    except httpx.HTTPError:
        raise HTTPException(502, 'Google Drive is unavailable. Please retry.')


def begin_connect(owner):
    state = secrets.token_urlsafe(40)
    db('bol_drive_oauth_states?' + urlencode({'expires_at': 'lt.' + datetime.now(timezone.utc).isoformat()}), 'DELETE')
    db('bol_drive_oauth_states', 'POST', {'id': state, 'owner': owner,
        'expires_at': (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()})
    return {'url': 'https://accounts.google.com/o/oauth2/v2/auth?' + urlencode({
        'client_id': os.environ['BOL_GOOGLE_CLIENT_ID'], 'redirect_uri': os.environ['BOL_GOOGLE_REDIRECT_URI'],
        'response_type': 'code', 'scope': SCOPE, 'access_type': 'offline', 'prompt': 'consent', 'state': state})}


def finish_connect(state, code):
    rows = db('bol_drive_oauth_states?' + urlencode({'id': 'eq.' + state,
        'expires_at': 'gt.' + datetime.now(timezone.utc).isoformat()}), 'DELETE')
    if not rows or not code:
        raise HTTPException(400, 'Drive connection expired. Start again from Bol Studio.')
    owner = rows[0]['owner']
    try:
        r = httpx.post(TOKEN, data={'code': code, 'client_id': os.environ['BOL_GOOGLE_CLIENT_ID'],
            'client_secret': os.environ['BOL_GOOGLE_CLIENT_SECRET'], 'redirect_uri': os.environ['BOL_GOOGLE_REDIRECT_URI'],
            'grant_type': 'authorization_code'}, timeout=20)
        r.raise_for_status()
        credentials = r.json()
        refresh = credentials['refresh_token']
        access = credentials['access_token']
        if SCOPE not in credentials.get('scope', '').split():
            raise HTTPException(400, 'Google Drive permission was not granted.')
    except (httpx.HTTPError, KeyError):
        raise HTTPException(400, 'Google Drive could not be connected. Please try again.')
    # Only app-created folders are visible with drive.file. Reuse by appProperties,
    # including after a disconnect, without scanning unrelated user files.
    folders = google('GET', '/files', access, params={'q': "trashed=false and mimeType='application/vnd.google-apps.folder' and appProperties has { key='bolRoot' and value='" + owner + "' }", 'fields': 'files(id)', 'pageSize': 1})['files']
    folder = folders[0] if folders else google('POST', '/files', access, json={
        'name': 'Bol Studio', 'mimeType': 'application/vnd.google-apps.folder', 'appProperties': {'bolRoot': owner}})
    db('bol_drive_connections?on_conflict=owner', 'POST', {'owner': owner,
        'folder_id': folder['id'], 'credentials': cipher().encrypt(refresh.encode()).decode(),
        'updated_at': datetime.now(timezone.utc).isoformat()}, prefer='resolution=merge-duplicates,return=representation')


def disconnect(owner):
    try:
        c = connection(owner)
        refresh = cipher().decrypt(c['credentials'].encode()).decode()
        r = httpx.post('https://oauth2.googleapis.com/revoke', data={'token': refresh}, timeout=15)
        if r.status_code not in (200, 400):
            raise HTTPException(502, 'Google could not revoke access. Please retry disconnecting.')
    except httpx.HTTPError:
        raise HTTPException(502, 'Google could not revoke access. Please retry disconnecting.')
    db('bol_drive_connections?' + urlencode({'owner': 'eq.' + owner}), 'DELETE')


def resumable(access, metadata, size, mime):
    try:
        r = httpx.post('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
            headers={'Authorization': 'Bearer ' + access, 'X-Upload-Content-Length': str(size),
                     'X-Upload-Content-Type': mime}, json=metadata, timeout=30)
        r.raise_for_status()
        location = r.headers['location']
        # Google-issued session URLs are bearer capabilities. Never persist/log them.
        if not location.startswith('https://www.googleapis.com/upload/drive/'):
            raise ValueError('Unexpected upload host')
        return location
    except (httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(502, 'Could not start the Drive upload. Check your Drive storage and retry.')


def new_source(owner, name, mime, size):
    import uuid
    access = token(owner)
    folder = connection(owner)['folder_id']
    file_id = google('GET', '/files/generateIds', access, params={'count': 1})['ids'][0]
    project_id = str(uuid.uuid4())
    db('bol_saved_projects', 'POST', {'id': project_id, 'owner': owner, 'source_file_id': file_id, 'name': name[:120]})
    session = resumable(access, {'id': file_id, 'name': name, 'parents': [folder],
        'appProperties': {'bolProject': project_id}}, size, mime)
    return {'id': project_id, 'uploadUrl': session}


def metadata(owner, file_id, access=None):
    access = access or token(owner)
    result = google('GET', '/files/' + file_id, access,
                    params={'fields': 'id,name,size,mimeType,parents,trashed,appProperties'})
    if result.get('trashed') or connection(owner)['folder_id'] not in result.get('parents', []):
        raise HTTPException(409, 'Keep project files inside your Bol Studio Drive folder to reopen them.')
    return result


def download(owner, file_id, destination: Path, limit):
    access = token(owner)
    meta = metadata(owner, file_id, access)
    if int(meta.get('size', 0)) > limit:
        raise HTTPException(413, 'The saved file exceeds the project size limit.')
    try:
        with httpx.stream('GET', DRIVE + '/files/' + file_id, params={'alt': 'media'},
                          headers={'Authorization': 'Bearer ' + access}, timeout=120) as r:
            r.raise_for_status()
            total = 0
            with destination.open('wb') as output:
                for chunk in r.iter_bytes(1024 * 1024):
                    total += len(chunk)
                    if total > limit:
                        raise HTTPException(413, 'The saved file exceeds the project size limit.')
                    output.write(chunk)
        return meta
    except httpx.HTTPError:
        destination.unlink(missing_ok=True)
        raise HTTPException(502, 'Could not retrieve the private Drive file. Retry or reconnect Google Drive.')


def upload_path(owner, path: Path, name, mime='application/octet-stream', properties=None):
    access = token(owner)
    session = resumable(access, {'name': name, 'parents': [connection(owner)['folder_id']],
        'appProperties': properties or {}}, path.stat().st_size, mime)
    try:
        with path.open('rb') as content:
            r = httpx.put(session, content=content, headers={'Content-Length': str(path.stat().st_size),
                'Content-Type': mime}, timeout=300)
        r.raise_for_status()
        return r.json()['id']
    except (httpx.HTTPError, KeyError):
        raise HTTPException(502, 'Saving this file to Drive failed. Please retry.')


def save(owner, project_id, revision, snapshot):
    if len(json.dumps(snapshot).encode()) > 5 * 1024 * 1024:
        raise HTTPException(413, 'This project has too much editing data to save.')
    rows = db('rpc/bol_save_drive_project', 'POST', {'p_id': project_id, 'p_owner': owner,
        'p_revision': revision, 'p_snapshot': snapshot})
    if not rows:
        raise HTTPException(409, 'This project changed on another device. Reopen it before saving further edits.')
    return rows[0]
