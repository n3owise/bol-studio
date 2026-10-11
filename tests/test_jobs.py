from pathlib import Path
import subprocess
import sys
import threading

import pytest
from server.jobs import BoundedExecutor, QueueFull, exclusive_store


def test_bounded_queue_rejects_capacity_and_owner_excess_then_reuses_slots():
    queue=BoundedExecutor(1,queued=1,per_owner=1)
    finish=threading.Event()
    try:
        with queue.admission('a') as slot:
            first=slot.submit(lambda:finish.wait(5))
        with pytest.raises(QueueFull) as owner_error:
            with queue.admission('a'):pass
        assert owner_error.value.tenant
        with queue.admission('b') as slot:
            second=slot.submit(lambda:None)
        with pytest.raises(QueueFull) as capacity_error:
            with queue.admission('c'):pass
        assert not capacity_error.value.tenant
        finish.set();first.result(timeout=5);second.result(timeout=5)
        with queue.admission('a') as slot:
            assert slot.submit(lambda:42).result(timeout=5)==42
    finally:finish.set();queue.shutdown()
    assert queue.active==0 and not queue.owners


def test_validation_and_worker_errors_release_reservations():
    queue=BoundedExecutor(1,queued=0,per_owner=1)
    try:
        with pytest.raises(ValueError):
            with queue.admission('a'):raise ValueError('validation')
        assert queue.active==0
        def fail():raise RuntimeError('worker')
        with queue.admission('a') as slot:
            future=slot.submit(fail)
        with pytest.raises(RuntimeError):future.result(timeout=5)
        with queue.admission('a') as slot:
            assert slot.submit(lambda:True).result(timeout=5)
    finally:queue.shutdown()


def test_data_store_refuses_a_second_process_and_unlocks_after_exit(tmp_path):
    code='from pathlib import Path; from server.jobs import exclusive_store; import sys\nwith exclusive_store(Path(sys.argv[1])): print("acquired")'
    with exclusive_store(tmp_path):
        result=subprocess.run([sys.executable,'-c',code,str(tmp_path)],capture_output=True,text=True)
        assert result.returncode!=0 and 'already in use' in result.stderr
    result=subprocess.run([sys.executable,'-c',code,str(tmp_path)],capture_output=True,text=True)
    assert result.returncode==0 and 'acquired' in result.stdout


def test_cancelled_queued_future_releases_capacity():
    queue=BoundedExecutor(1,queued=1,per_owner=3)
    started=threading.Event();finish=threading.Event()
    def running():started.set();finish.wait(5)
    try:
        with queue.admission('a') as slot:first=slot.submit(running)
        assert started.wait(5)
        with queue.admission('a') as slot:second=slot.submit(lambda:None)
        assert second.cancel()
        assert queue.active==1
        finish.set();first.result(timeout=5)
        assert queue.active==0
    finally:finish.set();queue.shutdown()


def test_real_process_exit_releases_store_and_startup_recovers_jobs(tmp_path):
    import json
    import os
    import uuid
    project_id=str(uuid.uuid4());export_id=str(uuid.uuid4())
    directory=tmp_path/project_id;directory.mkdir()
    project={'id':project_id,'revision':1,'status':'processing','transcriptionGeneration':4,
             'exports':[{'id':export_id,'status':'queued'},{'id':'completed','status':'ready','progress':100}]}
    (directory/'project.json').write_text(json.dumps(project))
    crash='from pathlib import Path; from server.jobs import exclusive_store; import sys, os\nwith exclusive_store(Path(sys.argv[1])): os._exit(17)'
    result=subprocess.run([sys.executable,'-c',crash,str(tmp_path)])
    assert result.returncode==17
    boot='import asyncio; from server.app import app, lifespan\nasync def main():\n async with lifespan(app): pass\nasyncio.run(main())'
    env={**os.environ,'DATA_DIR':str(tmp_path),'BOL_SUPABASE_URL':'','BOL_API_KEY':''}
    result=subprocess.run([sys.executable,'-c',boot],env=env,capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    restored=json.loads((directory/'project.json').read_text())
    assert restored['status']=='error' and restored['transcriptionGeneration']==5
    assert restored['exports'][0]['status']=='error'
    assert restored['exports'][1]==project['exports'][1]
    assert restored['revision']==2
