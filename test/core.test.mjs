import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settings, codePoints, contentChars, foldMetrics, initialMetrics, shouldCompact, safetyThreshold, deduplicateLog, textPage } from '../src/core.js';

test('40万 is characters; code points do not split emoji, or count image base64', () => {
  assert.equal(settings().triggerChars, 400000);
  assert.equal(codePoints('中文😀'), 3);
  assert.equal(contentChars([{ type: 'text', text: '中文😀' }, { type: 'image', data: 'A'.repeat(100000) }]), 3);
});
test('only current surface counts after positional replacements with non-monotone seqs', () => {
  let state = initialMetrics();
  for (let seq = 0; seq < 3; seq++) state = foldMetrics(state, { seq, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'x'.repeat(100) }] } }, surfaceOp: 'append' });
  state = foldMetrics(state, { seq: 9, type: 'user/message', data: { content: [{ type: 'text', text: 'checkpoint' }], source: { kind: 'compact-checkpoint' } }, surfaceOp: { op: 'replace', startSeq: 0, endSeq: 1 } });
  assert.equal(state.chars, 110);
  assert.deepEqual(state.nodes.map(node => node.seq), [9, 2]);
  state = foldMetrics(state, { seq: 12, type: 'user/message', data: { content: [{ type: 'text', text: 'short' }] }, surfaceOp: { op: 'replace', startSeq: 9, endSeq: 2 } });
  assert.equal(state.chars, 5);
});
test('tool schemas and nested tool results contribute, telemetry does not', () => {
  const state = foldMetrics(initialMetrics(), { seq: 1, type: 'tool/result', data: { message: { content: [{ type: 'tool-result', content: [{ type: 'text', text: '日志😀' }] }] } }, surfaceOp: 'append' });
  assert.equal(state.chars, 3);
  const header = foldMetrics(state, { type: 'request/header', data: { header: { tools: [{ name: 'read' }] } } });
  assert.equal(header.chars, 3 + codePoints(JSON.stringify([{ name: 'read' }])));
  assert.equal(foldMetrics(header, { type: 'command/run', data: {} }), header);
});
test('auto off preserves manual freedom; safety reserves actual completion budget', () => {
  const config = settings({ autoEnabled: false });
  assert.equal(shouldCompact(config, 900000, 999999, 800000), false);
  const on = settings();
  assert.equal(shouldCompact(on, 399999, 100, null), false);
  assert.equal(shouldCompact(on, 400000, 100, null), true);
  assert.equal(safetyThreshold(on, { context: { contextWindow: 100000 }, defaultMaxTokens: 20000 }, { maxTokens: 40000 }), 55904);
});
test('invalid settings reject without silently replacing user choices', () => {
  for (const invalid of [{ triggerChars: 0 }, { triggerChars: 40000.2 }, { autoEnabled: 'false' }, { triggerTokens: 400000 }, { summarizationModel: 'cheap' }, { safetyRatio: NaN }, { toString: 'invalid' }]) assert.throws(() => settings(invalid));
});
test('output filter keeps exact error logs and compresses only repeated lines', () => {
  const text = 'progress 10%\n'.repeat(1000);
  const result = deduplicateLog(text);
  assert.match(result, /repeated 1000 times/);
  assert.equal(deduplicateLog(text + 'error: do not ignore this failure'), text + 'error: do not ignore this failure');
});
test('large originals can be reconstructed exactly from Unicode-safe pages', () => {
  const original = '中😀abc'.repeat(10000);
  let result = '', offset = 0;
  do { const page = textPage(original, offset); result += page.text; offset = page.nextOffset; } while (offset !== null);
  assert.equal(result, original);
});
