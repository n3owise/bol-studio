"""Offline, verified directory snapshots. Run with ``python -m server.backup``."""
import argparse
from contextlib import closing
import ctypes
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import stat
import sys
import tempfile

from server.jobs import exclusive_store

MANIFEST = 'backup-manifest.json'
JOURNAL = '.bol-jobs.sqlite3'
LOCK = '.bol-process.lock'


def _publish(source, destination):
    """Atomic rename with kernel-enforced no replacement (Linux/macOS)."""
    for path in _files(source):
        with path.open('rb') as stream: os.fsync(stream.fileno())
    for directory, _, _ in os.walk(source, topdown=False, onerror=_walk_error):
        fd = os.open(directory, os.O_RDONLY)
        try: os.fsync(fd)
        finally: os.close(fd)
    libc = ctypes.CDLL(None, use_errno=True)
    if sys.platform == 'darwin':
        result = libc.renamex_np(os.fsencode(source), os.fsencode(destination), 4)
    elif sys.platform.startswith('linux') and hasattr(libc, 'renameat2'):
        result = libc.renameat2(-100, os.fsencode(source), -100, os.fsencode(destination), 1)
    else:
        raise RuntimeError('Atomic no-replacement publication requires macOS or Linux.')
    if result:
        code = ctypes.get_errno()
        raise OSError(code, os.strerror(code), str(destination))
    fd = os.open(destination.parent, os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)


def _walk_error(error):
    raise error


def _files(root):
    for directory, dirs, files in os.walk(root, followlinks=False, onerror=_walk_error):
        for name in dirs + files:
            path = Path(directory) / name
            mode = path.lstat().st_mode
            if not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
                raise ValueError('Symlinks and special files are not supported.')
        for name in files:
            yield Path(directory) / name


def _digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return {'size': path.stat().st_size, 'sha256': h.hexdigest()}


def _root(path):
    path = Path(path).absolute()
    if path.is_symlink() or not path.is_dir():
        raise ValueError('Source must be an existing regular directory.')
    return path.resolve()


def _destination(path, source):
    destination = Path(path).absolute()
    if destination.exists() or destination.is_symlink():
        raise FileExistsError(destination)
    parent = destination.parent.resolve(strict=True)
    destination = parent / destination.name
    if destination == source or source in destination.parents:
        raise ValueError('Destination must be outside the source directory.')
    return destination


def _check_sqlite(path):
    if not path.exists():
        return
    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
            raise ValueError('Job journal integrity check failed.')


def backup(source, destination):
    source = _root(source)
    destination = _destination(destination, source)
    # Validate before opening the process lock, including a malicious lock symlink.
    list(_files(source))
    with exclusive_store(source):
        staging = Path(tempfile.mkdtemp(prefix='.bol-backup-', dir=destination.parent))
        os.chmod(staging, 0o700)
        try:
            entries = {}
            for path in _files(source):
                relative = path.relative_to(source).as_posix()
                if relative in {LOCK, JOURNAL + '-wal', JOURNAL + '-shm', JOURNAL + '-journal'}:
                    continue
                if relative == MANIFEST:
                    raise ValueError('Data directory contains a reserved backup manifest.')
                target = staging / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                if relative == JOURNAL:
                    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as original:
                        with closing(sqlite3.connect(target)) as copied:
                            original.backup(copied)
                            copied.execute('PRAGMA journal_mode=DELETE')
                else:
                    shutil.copyfile(path, target)
                entries[relative] = _digest(target)
            _check_sqlite(staging / JOURNAL)
            (staging / MANIFEST).write_text(json.dumps({'version': 1, 'files': entries}, indent=2) + '\n')
            _publish(staging, destination)
        finally:
            if staging.exists(): shutil.rmtree(staging)
    return destination


def verify(source):
    source = _root(source)
    actual = {p.relative_to(source).as_posix() for p in _files(source)}
    manifest = json.loads((source / MANIFEST).read_text())
    if not isinstance(manifest, dict) or manifest.get('version') != 1 or not isinstance(manifest.get('files'), dict):
        raise ValueError('Unsupported backup manifest.')
    entries = manifest['files']
    for name, expected in entries.items():
        path = PurePosixPath(name)
        if not name or path.is_absolute() or '..' in path.parts or path.as_posix() != name or name in {MANIFEST, LOCK}:
            raise ValueError('Unsafe backup path.')
        if not isinstance(expected, dict) or set(expected) != {'size', 'sha256'}:
            raise ValueError('Invalid checksum entry.')
    if actual != set(entries) | {MANIFEST}:
        raise ValueError('Backup has missing or unexpected files.')
    for name, expected in entries.items():
        if _digest(source / name) != expected:
            raise ValueError('Backup checksum mismatch: ' + name)
    _check_sqlite(source / JOURNAL)
    return entries


def restore(source, destination):
    source = _root(source)
    destination = _destination(destination, source)
    entries = verify(source)
    staging = Path(tempfile.mkdtemp(prefix='.bol-restore-', dir=destination.parent))
    os.chmod(staging, 0o700)
    try:
        for name, expected in entries.items():
            original = source / name
            # Recheck after verification and checksum the copied bytes as well.
            if original.is_symlink(): raise ValueError('Symlink in backup.')
            target = staging / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(original, target)
            if _digest(target) != expected: raise ValueError('Backup changed during restore.')
        _check_sqlite(staging / JOURNAL)
        _publish(staging, destination)
    finally:
        if staging.exists(): shutil.rmtree(staging)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['create', 'verify', 'restore'])
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path, nargs='?')
    args = parser.parse_args()
    if args.operation != 'verify' and args.destination is None:
        parser.error('create and restore require a new destination directory')
    try:
        if args.operation == 'verify': verify(args.source)
        else: {'create': backup, 'restore': restore}[args.operation](args.source, args.destination)
    except (OSError, ValueError, RuntimeError, sqlite3.Error) as exc:
        parser.exit(1, f'Backup operation failed: {exc}\n')
    print('Backup operation completed and verified.')


if __name__ == '__main__':
    main()
