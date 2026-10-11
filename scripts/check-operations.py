#!/usr/bin/env python3
"""Read-only deployment health and optional offline backup acceptance check."""
import argparse
import ipaddress
import json
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.backup import verify, MANIFEST


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def health_url(value):
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username is not None or parsed.password is not None or parsed.query or parsed.fragment:
        raise ValueError('Use an HTTP(S) base URL without credentials, query or fragment.')
    if parsed.path not in {'', '/'}:
        raise ValueError('Use the service origin without a path.')
    if parsed.scheme == 'http':
        try: loopback = ipaddress.ip_address(parsed.hostname).is_loopback
        except ValueError: loopback = parsed.hostname.lower() == 'localhost'
        if not loopback:
            raise ValueError('Remote services require HTTPS; HTTP is allowed only for loopback.')
    _ = parsed.port
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, '/api/health', '', ''))


def fetch_health(url, timeout):
    # Do not follow redirects to unrelated services or inherit proxy credentials.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with opener.open(request, timeout=timeout) as response:
        if response.status != 200: raise ValueError('Unexpected status')
        body = response.read(65537)
        if len(body) > 65536: raise ValueError('Oversized response')
    payload = json.loads(body)
    if not isinstance(payload, dict): raise ValueError('Invalid health response')
    return payload


def check(base_url, timeout=5, backup_path=None, max_age_hours=24, fetch=fetch_health, now=None):
    results = []
    def record(name, ok, reason):
        results.append({'check': name, 'status': 'pass' if ok else 'fail', 'reason': reason})
    try:
        url = health_url(base_url)
    except (ValueError, TypeError):
        record('endpoint', False, 'Provide an origin URL without credentials; remote endpoints require HTTPS.')
    else:
        try: payload = fetch(url, timeout)
        except Exception:
            record('health', False, 'Health request failed or returned invalid data; check service availability, TLS and network access.')
        else:
            record('health', payload.get('status') == 'ok', 'Service must report status ok.')
            record('media_tools', payload.get('ffmpeg') is True, 'Both FFmpeg and ffprobe must be available.')
            queue = payload.get('queue')
            queue = queue if isinstance(queue, dict) else {}
            record('durable_queue', queue.get('durable') is True, 'The persistent job journal must be attached.')
            active, capacity, limit = (queue.get(key) for key in ('active', 'capacity', 'perOwnerLimit'))
            valid = all(type(value) is int for value in (active, capacity, limit)) and 0 <= active <= capacity and capacity > 0 and limit > 0
            record('queue_configuration', valid, 'Queue counters and admission limits must be valid positive capacities.')
            if valid:
                record('queue_headroom', active < capacity, 'Queue is full; inspect sustained saturation and retry later.' if active == capacity else 'Queue has admission headroom.')
    if backup_path is not None:
        try:
            verify(backup_path)
            age = (time.time() if now is None else now) - (Path(backup_path) / MANIFEST).stat().st_mtime
            record('backup_integrity', True, 'Backup manifest, file checksums and SQLite integrity passed.')
            record('backup_freshness', 0 <= age <= max_age_hours * 3600, 'Backup manifest timestamp must be within the configured age window and not in the future.')
        except Exception:
            record('backup_integrity', False, 'Backup is missing, unreadable or invalid; create and verify a fresh offline snapshot.')
    return {'status': 'pass' if all(item['status'] == 'pass' for item in results) else 'fail', 'checks': results}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--timeout', type=float, default=5)
    parser.add_argument('--backup', type=Path)
    parser.add_argument('--max-backup-age-hours', type=float, default=24)
    args = parser.parse_args(argv)
    if not 0 < args.timeout <= 60 or not 0 < args.max_backup_age_hours < 1e6:
        print(json.dumps({'status': 'fail', 'checks': [{'check': 'configuration', 'status': 'fail', 'reason': 'Timeout must be 0–60 seconds and backup age must be positive and finite.'}]}))
        return 2
    result = check(args.url, args.timeout, args.backup, args.max_backup_age_hours)
    print(json.dumps(result, sort_keys=True))
    return 0 if result['status'] == 'pass' else 1


if __name__ == '__main__':
    raise SystemExit(main())
