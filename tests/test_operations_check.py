import importlib.util
import json
import os
from pathlib import Path

import pytest

from server.backup import backup, MANIFEST

spec = importlib.util.spec_from_file_location('operations_check', Path(__file__).parents[1] / 'scripts/check-operations.py')
operations = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operations)


def healthy(url, timeout):
    return {'status': 'ok', 'ffmpeg': True, 'queue': {'durable': True, 'active': 0, 'capacity': 10, 'perOwnerLimit': 3}}


def test_healthy_service_passes():
    result = operations.check('http://127.0.0.1:8799', fetch=healthy)
    assert result['status'] == 'pass'
    assert len(result['checks']) == 5


@pytest.mark.parametrize('url', ['https://secret:token@example.com', 'https://example.com?token=secret', 'file:///tmp/x', 'http://example.com', 'https://example.com/api'])
def test_unsafe_configuration_never_requested_or_echoed(url):
    def forbidden(*args): pytest.fail('Unexpected network request')
    result = operations.check(url, fetch=forbidden)
    assert result['status'] == 'fail'
    assert url not in json.dumps(result)
    assert 'secret' not in json.dumps(result)


@pytest.mark.parametrize('change', [{'queue': {}}, {'queue': {'durable': True, 'active': 10, 'capacity': 10, 'perOwnerLimit': 3}}, {'ffmpeg': False}, {'status': 'error'}])
def test_incomplete_health_and_saturation_fail(change):
    def fetch(*args): return {**healthy(*args), **change}
    assert operations.check('https://staging.example.com', fetch=fetch)['status'] == 'fail'


def test_request_exception_details_redacted():
    def fetch(*args): raise RuntimeError('secret server response and credentials')
    result = operations.check('https://staging.example.com', fetch=fetch)
    assert result['status'] == 'fail'
    assert 'secret' not in json.dumps(result)


def test_backup_integrity_and_freshness(tmp_path):
    data = tmp_path / 'data'
    data.mkdir()
    (data / 'project.json').write_text('{}')
    snapshot = backup(data, tmp_path / 'snapshot')
    os.utime(snapshot / MANIFEST, (100000, 100000))
    assert operations.check('http://localhost:8799', backup_path=snapshot, now=100001, fetch=healthy)['status'] == 'pass'
    assert operations.check('http://localhost:8799', backup_path=snapshot, now=200000, fetch=healthy)['status'] == 'fail'
    (snapshot / 'project.json').write_text('corrupt')
    assert operations.check('http://localhost:8799', backup_path=snapshot, now=100001, fetch=healthy)['status'] == 'fail'


def test_cli_json_and_nonzero_without_network(monkeypatch, capsys):
    assert operations.main(['--url', 'http://invalid-remote']) == 1
    assert json.loads(capsys.readouterr().out)['status'] == 'fail'
    assert operations.main(['--url', 'http://localhost', '--timeout', 'nan']) == 2
    assert json.loads(capsys.readouterr().out)['status'] == 'fail'
