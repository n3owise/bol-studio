import os
import subprocess
import sys
import threading
import time
import json
import uuid

from server.jobs import BoundedExecutor, JobJournal, replay_jobs


def test_real_crash_retains_exact_payload_and_replays_once(tmp_path):
    code = '''from server.jobs import JobJournal
import os, sys
j = JobJournal(sys.argv[1])
j.add('tenant', 'render', ['project', {'words': [{'text': 'नमस्ते'}]}, 24])
os._exit(23)
'''
    assert subprocess.run([sys.executable, '-c', code, str(tmp_path)]).returncode == 23
    journal = JobJournal(tmp_path)
    queue = BoundedExecutor(1, 0, 1)
    queue.journal = journal
    seen = []
    done = threading.Event()
    def render(*args):
        seen.append(args)
        done.set()
    close = replay_jobs(queue, journal, {'render': render})
    try:
        assert done.wait(5)
    finally:
        close(); queue.shutdown()
    assert seen == [('project', {'words': [{'text': 'नमस्ते'}]}, 24)]
    assert journal.unfinished() == []


def test_recovery_backlog_is_bounded_and_other_owners_are_not_blocked(tmp_path):
    journal = JobJournal(tmp_path)
    for owner, number in [('a', 1), ('a', 2), ('b', 3)]:
        journal.add(owner, 'work', [number])
    queue = BoundedExecutor(2, 0, 1); queue.journal = journal
    entered = threading.Event(); unblock = threading.Event(); seen = []
    def work(number):
        seen.append(number)
        if number == 1:
            entered.set(); unblock.wait(5)
    close = replay_jobs(queue, journal, {'work': work})
    try:
        assert entered.wait(5)
        deadline = time.monotonic() + 5
        while 3 not in seen and time.monotonic() < deadline: time.sleep(.01)
        assert 3 in seen and 2 not in seen
        assert queue.active <= 2 and queue.owners.get('a') == 1
        unblock.set()
        deadline = time.monotonic() + 5
        while journal.unfinished() and time.monotonic() < deadline: time.sleep(.01)
        assert not journal.unfinished()
    finally:
        unblock.set(); close(); queue.shutdown()
    assert sorted(seen) == [1, 2, 3]


def test_queued_shutdown_and_running_crash_are_replayable(tmp_path):
    journal = JobJournal(tmp_path)
    queue = BoundedExecutor(1, 1, 2); queue.journal = journal
    entered = threading.Event(); unblock = threading.Event()
    def work(number):
        if number == 1: entered.set(); unblock.wait(5)
    try:
        with queue.admission('a') as slot: first = slot.submit(work, 1)
        assert entered.wait(5)
        with queue.admission('a') as slot: queued = slot.submit(work, 2)
        assert queued.cancel()
        assert len(journal.unfinished()) == 2
        unblock.set(); first.result(5)
        assert journal.unfinished()[0][3] == [2]
        job_id = journal.unfinished()[0][0]
        journal.state(job_id, 'running')
        journal.recover()
        assert journal.unfinished()[0][0] == job_id
    finally: unblock.set(); queue.shutdown()


def test_application_restart_resumes_snapshot_and_skips_cancelled_generations(tmp_path):
    project_id, export_id = str(uuid.uuid4()), str(uuid.uuid4())
    directory = tmp_path / project_id; directory.mkdir()
    project = {'id': project_id, 'owner': 'tenant', 'status': 'processing', 'revision': 7,
               'transcriptionGeneration': 2, 'name': 'newer edit',
               'exports': [{'id': export_id, 'status': 'processing'}]}
    (directory / 'project.json').write_text(json.dumps(project))
    journal = JobJournal(tmp_path)
    journal.add('tenant', 'transcription_job', [project_id, 1])
    journal.add('tenant', 'transcription_job', [project_id, 2])
    journal.add('tenant', 'export_job', [project_id, export_id, {'name': 'frozen snapshot'}, 'burn', 720, 24])
    boot = '''import asyncio, time
from server import app as b
def transcribe(project_id, generation):
 assert generation == 2, 'cancelled generation replayed'
 b.update_project(project_id, lambda p:p.update(status='ready', replayedGeneration=generation))
def export(project_id, export_id, snapshot, mode, resolution, fps):
 assert snapshot['name'] == 'frozen snapshot'
 b.mark_export(project_id, export_id, status='ready', replayedSnapshot=snapshot['name'])
b.transcription_job=transcribe; b.export_job=export
async def main():
 async with b.lifespan(b.app):
  for _ in range(500):
   if not b.EXECUTOR.journal.unfinished(): return
   await asyncio.sleep(.01)
  raise RuntimeError('recovery did not drain')
asyncio.run(main())
'''
    env = {**os.environ, 'DATA_DIR': str(tmp_path), 'BOL_SUPABASE_URL': '', 'BOL_API_KEY': ''}
    result = subprocess.run([sys.executable, '-c', boot], env=env, capture_output=True, text=True, timeout=15)
    assert result.returncode == 0, result.stderr
    restored = json.loads((directory / 'project.json').read_text())
    assert restored['replayedGeneration'] == 2 and restored['name'] == 'newer edit'
    assert restored['exports'][0]['replayedSnapshot'] == 'frozen snapshot'
    assert journal.unfinished() == []


def test_unknown_job_is_quarantined_and_does_not_repeat_on_restart(tmp_path, caplog):
    journal = JobJournal(tmp_path)
    journal.add('a', 'unknown', ['private transcript'])
    queue = BoundedExecutor(1); queue.journal = journal
    close = replay_jobs(queue, journal, {})
    close(); queue.shutdown()
    journal.recover()
    assert journal.unfinished() == []
    assert 'job_recovery_unknown_kind' in caplog.text
    assert 'private transcript' not in caplog.text
