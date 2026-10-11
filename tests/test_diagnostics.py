import json
import logging
import pytest

from server.diagnostics import JobTrace


def test_failure_trace_has_stage_category_retry_without_private_exception(caplog):
    with caplog.at_level(logging.INFO, logger='bol'):
        trace = JobTrace('project:generation', 'transcription')
        trace.enter('extracting')
        trace.enter('decoding')
        summary = trace.finish(ValueError('private transcript bearer token secret'))
    records = [json.loads(item.message.split('job_trace ', 1)[1]) for item in caplog.records]
    assert [item['event'] for item in records] == ['started', 'stage_finished', 'stage_started', 'stage_finished', 'stage_started', 'failed']
    assert summary['stage'] == 'decoding' and summary['errorCategory'] == 'invalid_media_or_model'
    assert 'retry transcription' in summary['retryAction']
    assert all(item['jobId'] == 'project:generation' and item['elapsedSeconds'] >= 0 for item in records)
    assert 'private' not in caplog.text and 'bearer' not in caplog.text and 'secret' not in caplog.text


def test_success_has_no_retry_and_storage_failure_is_actionable():
    assert JobTrace('a', 'export').finish()['errorCategory'] == 'none'
    failed = JobTrace('b', 'export').finish(OSError('path secrets'))
    assert failed['errorCategory'] == 'storage_or_dependency' and 'storage' in failed['retryAction']


def test_trace_rejects_unapproved_fields():
    with pytest.raises(ValueError, match='Unsupported'):
        JobTrace('a', 'export').emit('failed', transcript='private', token='credential')
