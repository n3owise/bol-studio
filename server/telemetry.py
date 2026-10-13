"""Optional backend monitoring with private request data removed before transport."""
import os
import logging

_monitoring_ready = False


def scrub_event(event, hint):
    for key in ('user', 'extra', 'request', 'breadcrumbs'):
        event.pop(key, None)
    for exception in event.get('exception', {}).get('values', []):
        exception['value'] = 'Backend operation failed; inspect stack trace.'
        for frame in exception.get('stacktrace', {}).get('frames', []):
            frame.pop('vars', None)
    if 'message' in event:
        event['message'] = 'Backend error'
    return event


def initialize_monitoring():
    global _monitoring_ready
    _monitoring_ready = False
    if not os.getenv('BOL_SENTRY_DSN'):
        return False
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=os.environ['BOL_SENTRY_DSN'], environment=os.getenv('BOL_ENVIRONMENT', 'production'),
                        release=os.getenv('BOL_APP_RELEASE'), send_default_pii=False,
                        include_local_variables=False, traces_sample_rate=0, before_send=scrub_event)
        _monitoring_ready = True
        return True
    except Exception:
        logging.getLogger(__name__).warning('Error monitoring could not initialize; application remains available.')
        return False


def capture_job_error(error, operation):
    if not _monitoring_ready:
        return
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            scope.set_tag('operation', operation)
            sentry_sdk.capture_exception(error)
    except Exception:
        # A monitoring failure must not prevent the worker writing its error status.
        pass
