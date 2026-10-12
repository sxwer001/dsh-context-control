import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
import { textOf } from '../src/core.js';
import { createAssistantMessage, createToolResultMessage } from '@deepseek-ai/dsh-llm';
import { TypertRegistry } from '@deepseek-ai/dsh-typert-registry';
import { TypertGatewayService } from '@deepseek-ai/dsh-api-gateway';

test('manual compaction uses real DSH sessions, retains user instructions, and replays from disk', async () => {
  const f = await fixture();
  try {
    f.history();
    const before = await f.ctx.contextControl.status(f.agent, f.signal);
    const originals = Array.from({ length: f.session.seq }, (_, seq) => JSON.stringify(f.session.eventAt(seq)));
    const result = await f.ctx.contextControl.operation(f.agent, { action: 'compact' }, f.signal, { manual: true });
    assert.equal(result.outcome, 'compacted');
    assert.ok(result.chars < before.chars);
    assert.equal(f.calls.length, 1);
    const checkpoint = f.session.surface.nodes.map(seq => f.session.eventAt(seq)).find(event => event.data.source?.kind === 'compact-checkpoint');
    assert.match(textOf(checkpoint.data.content), /Do not delete config.json/);
    assert.match(textOf(checkpoint.data.content), /ABC-42/);
    for (let index = 0; index < originals.length; index++) assert.equal(JSON.stringify(f.session.eventAt(index)), originals[index]);
    assert.match(JSON.stringify(f.session.deriveMessages()), /Continue the final issue/);
    const restored = await f.restore();
    assert.deepEqual(restored.surface.nodes, f.session.surface.nodes);
    assert.equal(JSON.stringify(restored.deriveMessages()), JSON.stringify(f.session.deriveMessages()));
    const page = f.ctx.contextControl.history(f.agent, { offset: 0, charOffset: 0 });
    assert.ok(page.entries.length);
    assert.match(page.entries.map(entry => entry.text).join(''), /Do not delete config.json/);
  } finally { await f.close(); }
});
test('400000 active characters triggers automatic compaction inside a real open turn', async () => {
  const f = await fixture();
  try {
    f.history(45, 10000);
    assert.ok((await f.ctx.contextControl.status(f.agent, f.signal)).chars > 400000);
    f.session.append('turn/start', { turn: 1 }); f.agent.status = 'running';
    assert.equal(await f.ctx.contextControl.automatic(f.agent, f.signal, false, 1), true);
    assert.equal(f.calls.length, 1);
    assert.ok((await f.ctx.contextControl.status(f.agent, f.signal)).chars < 400000);
    assert.equal(await f.ctx.contextControl.automatic(f.agent, f.signal, false, 1), false);
  } finally { await f.close(); }
});
test('auto disabled never summarizes; manual compaction remains available', async () => {
  const f = await fixture({ autoEnabled: false });
  try {
    f.history(45, 10000);
    f.session.append('turn/start', { turn: 1 }); f.agent.status = 'running';
    assert.equal(await f.ctx.contextControl.automatic(f.agent, f.signal, false, 1), false);
    assert.equal(f.calls.length, 0);
    f.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } }); f.agent.status = 'idle';
    assert.equal((await f.ctx.contextControl.operation(f.agent, { action: 'compact' }, f.signal, { manual: true })).outcome, 'compacted');
  } finally { await f.close(); }
});
test('cancellation during summarization retains the surface and closes the durable lock', async () => {
  let resolve;
  const f = await fixture({}, { delay: () => new Promise(done => { resolve = done; }) });
  try {
    f.history(); const nodes = [...f.session.surface.nodes]; const abort = new AbortController();
    const attempt = f.ctx.contextControl.operation(f.agent, { action: 'compact' }, abort.signal, { manual: true });
    await new Promise(done => setImmediate(done)); abort.abort(); resolve();
    await assert.rejects(attempt);
    assert.deepEqual(f.session.surface.nodes, nodes);
    assert.equal(f.ctx.sessionProjections.snapshot(f.session, ['contextControlMetrics']).values.contextControlMetrics.busy, false);
  } finally { await f.close(); }
});
test('failed or truncated summaries leave the exact visible history unchanged', async () => {
  for (const mode of [{ failure: true }, { truncated: true }]) {
    const f = await fixture({}, mode);
    try { f.history(); const nodes = [...f.session.surface.nodes]; await assert.rejects(f.ctx.contextControl.operation(f.agent, { action: 'compact' }, f.signal, { manual: true })); assert.deepEqual(f.session.surface.nodes, nodes); assert.equal(f.ctx.sessionProjections.snapshot(f.session, ['contextControlMetrics']).values.contextControlMetrics.busy, false); }
    finally { await f.close(); }
  }
});
test('concurrent clicks admit one summary and reject a second writer', async () => {
  let resolve;
  const f = await fixture({}, { delay: () => new Promise(done => { resolve = done; }) });
  try {
    f.history();
    const first = f.ctx.contextControl.operation(f.agent, { action: 'compact' }, f.signal, { manual: true });
    await new Promise(done => setImmediate(done));
    await assert.rejects(f.ctx.contextControl.operation(f.agent, { action: 'compact' }, f.signal, { manual: true }), /already running/);
    resolve(); await first; assert.equal(f.calls.length, 1);
  } finally { await f.close(); }
});
test('settings persist, session choices override global choices, UI and tool share the same operation', async () => {
  const f = await fixture();
  try {
    const command = f.commands.get('context-control');
    const response = await command.handler({ agent: f.agent, rawInput: JSON.stringify({ action: 'configure', scope: 'session', settings: { triggerChars: 600000, autoEnabled: false } }), signal: f.signal });
    assert.equal(response.kind, 'success');
    const tool = f.tools.get('context_control');
    await tool.execute({ action: 'configure', scope: 'global', settings: { triggerChars: 200000 } }, { agent: f.agent, signal: f.signal });
    await f.reloadSettings();
    const status = await tool.execute({ action: 'status' }, { agent: f.agent, signal: f.signal });
    assert.equal(status.config.triggerChars, 600000);
    assert.equal(status.config.autoEnabled, false);
    const parsed = JSON.parse(response.text);
    assert.deepEqual(parsed.config, status.config);
  } finally { await f.close(); }
});
test('manual request during work queues and can be cancelled without altering history', async () => {
  const f = await fixture();
  try {
    f.history(); f.agent.status = 'running'; const nodes = [...f.session.surface.nodes];
    assert.equal((await f.ctx.contextControl.operation(f.agent, { action: 'compact' }, f.signal, { manual: true })).outcome, 'queued');
    assert.equal((await f.ctx.contextControl.operation(f.agent, { action: 'cancel' }, f.signal)).pending, false);
    assert.deepEqual(f.session.surface.nodes, nodes); assert.equal(f.calls.length, 0);
  } finally { await f.close(); }
});

test('long originals page through the entire checkpoint and retain later entries', async () => {
  const f = await fixture();
  try {
    f.history(10, 40000);
    await f.ctx.contextControl.operation(f.agent, { action: 'compact' }, f.signal, { manual: true });
    const seen = new Map(); let args = { action: 'history' };
    for (let page = 0; page < 100 && args; page++) {
      const value = f.ctx.contextControl.history(f.agent, { offset: 0, charOffset: 0, ...args });
      for (const entry of value.entries) seen.set(entry.seq, (seen.get(entry.seq) || '') + entry.text);
      args = value.next || (value.nextOffset === null || value.nextOffset === undefined ? null : { action: 'history', offset: value.nextOffset });
    }
    const summarySeq = (await f.ctx.contextControl.status(f.agent, f.signal)).last.summarySeq;
    const shadowed = f.session.eventAt(summarySeq).data.shadowedSeqs;
    for (const seq of shadowed) { const event = f.session.eventAt(seq); assert.equal(seen.get(seq), JSON.stringify((event.data.message ?? event.data).content)); }
    assert.equal(args, null);
  } finally { await f.close(); }
});

test('five successive checkpoints retain exact original constraints without recursive summary growth', async () => {
  const f = await fixture();
  try {
    f.history();
    for (let iteration = 0; iteration < 5; iteration++) {
      if (iteration) {
        f.session.append('turn/start', { turn: iteration });
        for (let step = 0; step < 10; step++) { f.session.append('step/start', { turn: iteration, step }); f.assistant('Additional completed work ' + 'z'.repeat(10000), step, iteration); f.session.append('step/end', { turn: iteration, step }); }
        f.session.append('turn/end', { turn: iteration, reason: { kind: 'completed' } });
        f.user(`Continue task ${iteration}, retaining ABC-42.`);
      }
      assert.equal((await f.ctx.contextControl.operation(f.agent, { action: 'compact' }, f.signal, { manual: true })).outcome, 'compacted');
      const last = f.session.surface.nodes.map(seq => f.session.eventAt(seq)).find(event => event.data.source?.kind === 'compact-checkpoint');
      const text = textOf(last.data.content);
      assert.match(text, /Do not delete config.json/);
      assert.equal(text.split('Do not delete config.json').length - 1, 1);
      assert.ok(text.length < 4000);
    }
  } finally { await f.close(); }
});

test('a single long task compacts completed work after the latest user request, with task background', async () => {
  const f = await fixture();
  try {
    f.history();
    const latest = f.session.surface.nodes.at(-1);
    f.session.append('turn/start', { turn: 1 });
    for (let step = 0; step < 10; step++) { f.session.append('step/start', { turn: 1, step }); f.assistant('Completed details ' + 'z'.repeat(10000), step, 1); f.session.append('step/end', { turn: 1, step }); }
    f.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } });
    // Remove older eligible work first, leaving the latest user followed by a long continuation.
    await f.ctx.contextControl.operation(f.agent, { action: 'compact' }, f.signal, { manual: true });
    assert.equal((await f.ctx.contextControl.operation(f.agent, { action: 'compact' }, f.signal, { manual: true })).outcome, 'compacted');
    assert.ok(f.session.surface.nodes.includes(latest));
    assert.match(JSON.stringify(f.calls.at(-1).messages), /Continue the final issue/);
  } finally { await f.close(); }
});

test('repeated tool logs are archived in real storage and are isolated by session', async () => {
  const f = await fixture();
  try {
    const original = ('build progress complete\n').repeat(800);
    const exec = { name: 'bash', agent: f.agent, signal: f.signal };
    const decision = await f.ctx.waterfall('tools/post-execute', exec, { isError: false, content: [{ type: 'text', text: original }] }, async () => ({ kind: 'accept' }));
    const text = textOf(decision.content);
    const hash = text.match(/originalHash="([a-f0-9]+)"/)[1];
    let offset = 0; let restored = '';
    do { const page = f.ctx.contextControl.history(f.agent, { originalHash: hash, charOffset: offset }); restored += page.entries[0].text; offset = page.next?.charOffset ?? null; } while (offset !== null);
    assert.equal(restored, original);
    assert.throws(() => f.ctx.contextControl.history({ session: { id: 'other-session' } }, { originalHash: hash, charOffset: 0 }), /unavailable in this session/);
  } finally { await f.close(); }
});

test('parallel tool calls and results stay intact at every compaction boundary', async () => {
  const f = await fixture();
  try {
    f.history();
    f.session.append('turn/start', { turn: 1 }); f.agent.status = 'running';
    f.session.append('step/start', { turn: 1, step: 0 });
    const blocks = ['call-a', 'call-b'].map(id => ({ type: 'tool-call', id, name: 'bash', arguments: JSON.stringify({ command: 'echo sample' }) }));
    const message = createAssistantMessage({ content: blocks, source: { kind: 'model', provider: 'scripted', model: 'fixture' } });
    const request = f.session.append('assistant/message', { turn: 1, step: 0, message, stream: blocks.map((block, index) => ({ type: 'chunk', chunk: { type: 'block-end', index, block } })) }, { surfaceOp: 'append' });
    const calls = blocks.map(block => f.session.append('tool/call', { turn: 1, step: 0, callId: block.id, name: block.name, arguments: block.arguments }));
    const result = index => f.session.append('tool/result', { turn: 1, step: 0, message: createToolResultMessage({ callId: blocks[index].id, content: [{ type: 'text', text: 'successful output ' + 'z'.repeat(30000) }], isError: false }) }, { surfaceOp: 'append', sourceEventSeqs: [calls[index].seq] });
    const first = result(0);
    assert.ok(await f.ctx.contextControl.compactor.run(f.agent, f.signal));
    assert.ok(f.session.surface.nodes.includes(request.seq));
    assert.ok(f.session.surface.nodes.includes(first.seq));
    const second = result(1);
    f.session.append('step/end', { turn: 1, step: 0 });
    for (let step = 1; step <= 10; step++) { f.session.append('step/start', { turn: 1, step }); f.assistant('Completed work ' + 'z'.repeat(10000), step, 1); f.session.append('step/end', { turn: 1, step }); }
    assert.ok(await f.ctx.contextControl.compactor.run(f.agent, f.signal));
    for (const event of [request, first, second]) assert.equal(f.session.surface.nodes.includes(event.seq), false);
  } finally { await f.close(); }
});

test('panel RPC reads and settings do not append chat commands; compaction still works', async () => {
  const f = await fixture();
  try {
    f.history();
    new TypertRegistry(f.ctx);
    f.ctx.typert.lookups.register('agent', { parameter: 'agent', wire: 'agentId', hostTypeSymbol: 'Agent', wireTypeSymbol: 'SessionId', resolve: id => { if (id !== f.session.id) throw new Error('Session unavailable.'); return f.agent; } });
    const gateway = new TypertGatewayService(f.ctx, { websocketHeartbeatIntervalMs: 30000, streamInboxBytes: 1000000 });
    const call = request => gateway.invoke({ namespace: 'contextControl', method: 'executeUi', args: { agentId: f.session.id, request }, signal: f.signal });
    const seq = f.session.seq;
    for (let click = 0; click < 3; click++) assert.equal((await call({ action: 'status' })).sessionId, f.session.id);
    await call({ action: 'configure', settings: { triggerChars: 600000 } });
    assert.equal(f.session.seq, seq);
    assert.equal((await call({ action: 'compact' })).outcome, 'compacted');
    assert.ok((await call({ action: 'history' })).entries.length);
    assert.equal(Array.from({ length: f.session.seq }, (_, index) => f.session.eventAt(index)).filter(event => event.type.startsWith('command/')).length, 0);
    await assert.rejects(call({ action: 'configure', settings: { triggerChars: 1 } }));
  } finally { await f.close(); }
});
