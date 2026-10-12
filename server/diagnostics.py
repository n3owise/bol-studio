"""Small job traces with an allowlist of fields; never log media or captions."""
import json
import logging
import time
from server.jobs import current_job_id


class JobFailure(ValueError):
    def __init__(self, category, message):
        if category not in {'render_resource_limit', 'storage_limit', 'render_dependency', 'render_timeout'}:
            raise ValueError('Unsupported job error category.')
        self.category = category
        super().__init__(message)


class JobTrace:
    def __init__(self, job_id, kind, logger=None):
        self.id = current_job_id() or job_id
        self.kind = kind
        self.logger = logger or logging.getLogger('bol')
        self.started = self.stage_started = time.monotonic()
        self.stage = 'starting'
        self.emit('started')

    def emit(self, event, **fields):
        record = {'event': event, 'jobId': self.id, 'kind': self.kind,
                  'stage': self.stage, 'elapsedSeconds': round(time.monotonic() - self.started, 3)}
        allowed = {'stageSeconds', 'errorCategory', 'retryAction'}
        if set(fields) - allowed:
            raise ValueError('Unsupported diagnostic field.')
        record.update(fields)
        self.logger.info('job_trace %s', json.dumps(record, separators=(',', ':')))

    def enter(self, stage):
        if stage == self.stage: return
        self.emit('stage_finished', stageSeconds=round(time.monotonic() - self.stage_started, 3))
        self.stage = stage
        self.stage_started = time.monotonic()
        self.emit('stage_started')

    def finish(self, error=None):
        category = 'none'
        action = 'none'
        if error:
            if isinstance(error, JobFailure): category = error.category
            elif getattr(error, 'status_code', None) == 413: category = 'storage_limit'
            elif isinstance(error, (TimeoutError,)): category = 'timeout'
            elif isinstance(error, OSError): category = 'storage_or_dependency'
            elif isinstance(error, ValueError): category = 'invalid_media_or_model'
            else: category = 'processing'
            action = 'Check available storage and local dependencies, then retry.'
            if self.stage == 'decoding': action = 'Check the selected model installation and connection, then retry transcription.'
            if category == 'render_resource_limit': action = 'Lower export resolution, use smaller images, or reduce overlapping video layers, then retry.'
        self.emit('failed' if error else 'completed', errorCategory=category, retryAction=action,
                  stageSeconds=round(time.monotonic() - self.stage_started, 3))
        return {'jobId': self.id, 'stage': self.stage, 'errorCategory': category,
                'retryAction': action, 'elapsedSeconds': round(time.monotonic() - self.started, 3)}
