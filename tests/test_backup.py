import json
from pathlib import Path
import threading

import pytest

from server.backup import backup, restore, verify, MANIFEST
from server.jobs import BoundedExecutor, JobJournal, exclusive_store, replay_jobs


def fixture_store(tmp_path):
    data = tmp_path / 'data'
    project = data / 'project'
    project.mkdir(parents=True)
    (project / 'project.json').write_text('{"status":"queued"}')
    (project / 'source.mp4').write_bytes(b'original media\x00\xff')
    journal = JobJournal(data)
    job_id = journal.add('owner', 'resume', ['project', 7])
    journal.state(job_id, 'running')
    return data, job_id


def test_restored_media_and_journal_replay(tmp_path):
    data, job_id = fixture_store(tmp_path)
    snapshot = backup(data, tmp_path / 'snapshot')
    assert len(verify(snapshot)) == 3
    restored = restore(snapshot, tmp_path / 'restored')
    assert (restored / 'project/source.mp4').read_bytes() == b'original media\x00\xff'
    assert not (restored / '.bol-process.lock').exists()
    assert not (restored / 'backup-manifest.json').exists()
    executor = BoundedExecutor(1)
    executor.journal = JobJournal(restored)
    assert executor.journal.unfinished() == [(job_id, 'owner', 'resume', ['project', 7])]
    calls = []
    done = threading.Event()
    def resume(project, generation):
        calls.append((project, generation))
        done.set()
    with exclusive_store(restored):
        close = replay_jobs(executor, executor.journal, {'resume': resume})
        assert done.wait(3)
        close()
        executor.shutdown()
    assert calls == [('project', 7)]
    assert executor.journal.unfinished() == []


def test_live_store_refused_without_output(tmp_path):
    data, _ = fixture_store(tmp_path)
    with exclusive_store(data):
        with pytest.raises(RuntimeError, match='already in use'):
            backup(data, tmp_path / 'snapshot')
    assert not (tmp_path / 'snapshot').exists()


@pytest.mark.parametrize('mutation', ['corrupt', 'missing', 'unexpected', 'traversal', 'absolute', 'symlink'])
def test_invalid_backup_never_published(tmp_path, mutation):
    data, _ = fixture_store(tmp_path)
    snapshot = backup(data, tmp_path / 'snapshot')
    media = snapshot / 'project/source.mp4'
    if mutation == 'corrupt': media.write_bytes(b'changed')
    elif mutation == 'missing': media.unlink()
    elif mutation == 'unexpected': (snapshot / 'extra').write_text('extra')
    elif mutation == 'symlink':
        media.unlink()
        media.symlink_to(data / 'project/source.mp4')
    else:
        path = snapshot / 'backup-manifest.json'
        manifest = json.loads(path.read_text())
        manifest['files']['../escape' if mutation == 'traversal' else '/escape'] = {'size': 0, 'sha256': '0' * 64}
        path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError): restore(snapshot, tmp_path / 'restored')
    assert not (tmp_path / 'restored').exists()


@pytest.mark.parametrize('operation', [backup, restore])
def test_existing_destination_never_overwritten(tmp_path, operation):
    data, _ = fixture_store(tmp_path)
    source = data if operation == backup else backup(data, tmp_path / 'snapshot')
    target = tmp_path / 'existing'
    target.mkdir()
    with pytest.raises(FileExistsError): operation(source, target)
    assert target.is_dir() and not list(target.iterdir())


def test_source_symlinks_and_nested_destination_refused(tmp_path):
    data, _ = fixture_store(tmp_path)
    with pytest.raises(ValueError): backup(data, data / 'nested')
    (data / 'link').symlink_to(tmp_path)
    with pytest.raises(ValueError): backup(data, tmp_path / 'snapshot')


def test_corrupt_database_not_accepted_even_with_matching_hash(tmp_path):
    from server.backup import _digest
    import sqlite3
    data, _ = fixture_store(tmp_path)
    snapshot = backup(data, tmp_path / 'snapshot')
    journal = snapshot / '.bol-jobs.sqlite3'
    journal.write_bytes(b'not a database')
    manifest_path = snapshot / 'backup-manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['files'][journal.name] = _digest(journal)
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(sqlite3.DatabaseError): restore(snapshot, tmp_path / 'restored')


def test_kernel_publication_does_not_replace_racing_destination(tmp_path):
    from server.backup import _publish
    source = tmp_path / 'staged'
    target = tmp_path / 'racing'
    source.mkdir()
    target.mkdir()
    with pytest.raises(FileExistsError): _publish(source, target)
    assert source.is_dir() and target.is_dir()


def test_sqlite_wal_is_consolidated_into_backup(tmp_path):
    import sqlite3
    data, _ = fixture_store(tmp_path)
    db = sqlite3.connect(data / '.bol-jobs.sqlite3')
    try:
        db.execute('PRAGMA journal_mode=WAL')
        db.execute("UPDATE jobs SET owner='wal-owner'")
        db.commit()
        snapshot = backup(data, tmp_path / 'snapshot')
        assert not (snapshot / '.bol-jobs.sqlite3-wal').exists()
        restored = restore(snapshot, tmp_path / 'restored')
        assert JobJournal(restored).unfinished()[0][1] == 'wal-owner'
    finally:
        db.close()


def test_unreadable_subtree_fails_without_partial_backup(tmp_path):
    import os
    data, _ = fixture_store(tmp_path)
    subtree = data / 'private'
    subtree.mkdir()
    (subtree / 'important.mp4').write_bytes(b'important')
    subtree.chmod(0)
    try:
        if os.access(subtree, os.R_OK):
            pytest.skip('Process can bypass directory permissions')
        with pytest.raises(PermissionError): backup(data, tmp_path / 'snapshot')
        assert not (tmp_path / 'snapshot').exists()
        assert not list(tmp_path.glob('.bol-backup-*'))
    finally:
        subtree.chmod(0o700)


@pytest.mark.parametrize('payload', [[], None, 'invalid', 42])
def test_invalid_manifest_type_rejected(tmp_path, payload):
    data, _ = fixture_store(tmp_path)
    snapshot = backup(data, tmp_path / 'snapshot')
    (snapshot / MANIFEST).write_text(json.dumps(payload))
    with pytest.raises(ValueError, match='Unsupported backup manifest'):
        restore(snapshot, tmp_path / 'restored')
    assert not (tmp_path / 'restored').exists()
