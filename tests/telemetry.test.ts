import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTelemetryProperties, telemetryEnabled } from '../src/lib/telemetry';

test('product events cannot include private editing or account payloads', () => {
  const result = cleanTelemetryProperties({ panel: 'style', resolution: 2160, fps: 60,
    filename: 'private.mp4', email: 'private@example.com', captions: 'Private spoken words',
    token: 'secret', mode: 'https://example.com/?token=secret', duration_seconds: Infinity });
  assert.deepEqual(result, { panel: 'style', resolution: 2160, fps: 60 });
});

test('telemetry stays disabled outside the production browser build by default', () => {
  assert.equal(Boolean(telemetryEnabled), false);
});
