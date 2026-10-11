"""Bounded single-process execution and exclusive access to a local data store."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from pathlib import Path
import fcntl
import threading
import json
import sqlite3
import uuid
import logging
import time

_CURRENT_JOB = threading.local()


def current_job_id():
    return getattr(_CURRENT_JOB, 'id', None)


class JobJournal:
    """Persist only unfinished work; a process lock must protect replay.

    SQLite commits precede submitting to threads. A crash can replay a job, so
    handlers must fence generations and skip outputs already marked ready.
    """
    def __init__(self, directory):
        self.path = Path(directory) / '.bol-jobs.sqlite3'
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, kind TEXT NOT NULL, args TEXT NOT NULL, state TEXT NOT NULL)')
            if 'created' not in {row[1] for row in db.execute('PRAGMA table_info(jobs)')}:
                db.execute('ALTER TABLE jobs ADD COLUMN created REAL NOT NULL DEFAULT 0')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        try:
            db.execute('PRAGMA synchronous=FULL')
            with db: yield db
        finally: db.close()

    def add(self, owner, kind, args):
        job_id = str(uuid.uuid4())
        encoded = json.dumps(args, ensure_ascii=False, allow_nan=False)
        with self.connect() as db:
            db.execute('INSERT INTO jobs (id,owner,kind,args,state,created) VALUES (?,?,?,?,?,?)', (job_id, owner, kind, encoded, 'pending', time.time()))
        return job_id

    def queued_at(self, job_id):
        with self.connect() as db:
            row = db.execute('SELECT created FROM jobs WHERE id=?', (job_id,)).fetchone()
        return row[0] if row else 0

    def state(self, job_id, state):
        with self.connect() as db:
            db.execute('UPDATE jobs SET state=? WHERE id=?', (state, job_id))

    def complete(self, job_id):
        with self.connect() as db:
            db.execute('DELETE FROM jobs WHERE id=?', (job_id,))

    def unfinished(self):
        with self.connect() as db:
            return [(job_id, owner, kind, json.loads(args)) for job_id, owner, kind, args in
                    db.execute("SELECT id,owner,kind,args FROM jobs WHERE state != 'quarantined' ORDER BY rowid")]

    def recover(self):
        with self.connect() as db:
            db.execute("UPDATE jobs SET state='pending' WHERE state != 'quarantined'")


def replay_jobs(executor, journal, handlers):
    """Drain restart backlog without bypassing tenant or global admission."""
    stop = threading.Event()
    journal.recover()
    backlog = journal.unfinished()
    def replay():
        while backlog and not stop.is_set():
            progress = False
            for item in list(backlog):
                if stop.is_set(): break
                job_id, owner, kind, args = item
                handler = handlers.get(kind)
                if handler is None:
                    logging.getLogger('bol').error('job_recovery_unknown_kind job_id=%s', job_id)
                    journal.state(job_id, 'quarantined')
                    backlog.remove(item)
                    continue
                try:
                    with executor.admission(owner) as slot:
                        slot.submit_existing(job_id, handler, *args)
                except QueueFull:
                    continue
                backlog.remove(item)
                progress = True
            if not progress: stop.wait(.25)
    thread = threading.Thread(target=replay, name='bol-recovery', daemon=True)
    thread.start()
    def close():
        stop.set()
        thread.join()
    return close


class QueueFull(Exception):
    def __init__(self, tenant=False):
        self.tenant = tenant
        super().__init__('This workspace already has its maximum number of jobs. Retry after a job finishes.' if tenant
                         else 'The processing queue is full. Retry after a job finishes.')


class BoundedExecutor:
    def __init__(self, workers, queued=8, per_owner=3):
        self.pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix='bol-worker')
        self.capacity = workers + queued
        self.per_owner = per_owner
        self.owners = {}
        self.active = 0
        self.lock = threading.Lock()
        self.closed = False
        self.journal = None

    @contextmanager
    def admission(self, owner):
        with self.lock:
            if self.closed: raise QueueFull()
            if self.owners.get(owner, 0) >= self.per_owner: raise QueueFull(tenant=True)
            if self.active >= self.capacity: raise QueueFull()
            self.active += 1
            self.owners[owner] = self.owners.get(owner, 0) + 1
        submitted = False
        released = False
        def release():
            nonlocal released
            with self.lock:
                if released: return
                released = True
                self.active -= 1
                self.owners[owner] -= 1
                if not self.owners[owner]: del self.owners[owner]
        class Slot:
            def submit(slot, fn, *args):
                if submitted: raise RuntimeError('A reserved job slot can only be submitted once.')
                job_id = self.journal.add(owner, fn.__name__, args) if self.journal else None
                return slot.submit_existing(job_id, fn, *args)

            def submit_existing(slot, job_id, fn, *args):
                nonlocal submitted
                if submitted: raise RuntimeError('A reserved job slot can only be submitted once.')
                def run():
                    try:
                        if job_id:
                            self.journal.state(job_id, 'running')
                            _CURRENT_JOB.id = job_id
                            created = self.journal.queued_at(job_id)
                            logging.getLogger('bol').info('job_queue %s', json.dumps({'event': 'dequeued', 'jobId': job_id, 'kind': fn.__name__, 'queueSeconds': round(max(0, time.time() - created), 3) if created else None}))
                        result = fn(*args)
                        if job_id: self.journal.complete(job_id)
                        return result
                    finally:
                        if hasattr(_CURRENT_JOB, 'id'): del _CURRENT_JOB.id
                        release()
                future = self.pool.submit(run)
                submitted = True
                future.add_done_callback(lambda _: release())
                return future
        try: yield Slot()
        finally:
            if not submitted: release()

    def shutdown(self):
        with self.lock: self.closed = True
        self.pool.shutdown(wait=True, cancel_futures=True)


@contextmanager
def exclusive_store(directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / '.bol-process.lock').open('a') as handle:
        try: fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('This data directory is already in use. Bol JSON storage supports one server process per data directory; do not run multiple workers.') from None
        try: yield
        finally: fcntl.flock(handle, fcntl.LOCK_UN)
