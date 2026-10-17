import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudioNotice } from '../src/components/StudioNotice';
import { Modal } from '../src/components/Modal';

test('upload feedback exposes bounded progress to assistive technology', () => {
  const markup = renderToStaticMarkup(<StudioNotice title="Uploading" tone="progress" progress={140}/>);
  assert.match(markup, /role="progressbar"/);
  assert.match(markup, /aria-valuenow="100"/);
  assert.match(markup, /scaleX\(1\)/);
});
test('error feedback is urgent while routine progress remains polite', () => {
  assert.match(renderToStaticMarkup(<StudioNotice title="Save failed" tone="error"/>), /role="alert"/);
  assert.match(renderToStaticMarkup(<StudioNotice title="Saving" tone="progress"/>), /role="status"/);
});
test('non-cancellable upload dialogs have no misleading close control', () => {
  const markup = renderToStaticMarkup(<Modal title="Uploading" dismissible={false} onClose={() => {}}>Keep this tab open.</Modal>);
  assert.doesNotMatch(markup, /Close dialog/);
  assert.match(markup, /aria-labelledby=/);
});
test('ordinary dialogs and dismissible notices retain accessible close controls', () => {
  assert.match(renderToStaticMarkup(<Modal title="Workspace" onClose={() => {}}>Projects</Modal>), /aria-label="Close dialog"/);
  assert.match(renderToStaticMarkup(<StudioNotice title="Saved" onDismiss={() => {}}/>), /aria-label="Dismiss notification"/);
});
