import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';

test('activation waits for asynchronous projection registration and disposal removes consumers', async () => {
  let ready;
  const projectionReady = new Promise(resolve => { ready = resolve; });
  let activated = false;
  const mode = { projectionReady };
  const activation = fixture({}, mode).then(f => { activated = true; return f; });
  let f;
  let closed = false;
  try {
    while (!mode.projectionAcquired) await new Promise(resolve => setImmediate(resolve));
    assert.equal(activated, false);
    ready();
    f = await activation;
    assert.ok(f.ctx.contextControl.metricsProjection);
    assert.equal((await f.ctx.contextControl.status(f.agent, f.signal)).chars, 0);
    const projections = f.ctx.sessionProjections;
    await f.close();
    closed = true;
    assert.equal(f.tools.size, 0);
    assert.equal(f.commands.size, 0);
    assert.equal(projections.snapshot(f.session, ['contextControlMetrics']).values.contextControlMetrics, undefined);
  } finally {
    ready();
    f ??= await activation;
    if (!closed) await f.close();
  }
});

test('failed asynchronous registration rejects activation and releases acquired resources', async t => {
  let resolve;
  let reject;
  const projectionReady = new Promise((ready, fail) => { resolve = ready; reject = fail; });
  const mode = { projectionReady };
  const activation = fixture({}, mode);
  while (!mode.projectionAcquired) await new Promise(resolve => setImmediate(resolve));
  if (typeof mode.projectionHandle === 'function') {
    resolve();
    await (await activation).close();
    t.skip('This host has the synchronous projection API; asynchronous handoff failure is tested on 0.2.2.');
    return;
  }
  const rejected = assert.rejects(activation, /projection setup failed/);
  const projections = mode.context.sessionProjections;
  reject(new Error('projection setup failed'));
  await rejected;
  assert.equal(projections.snapshot({ seq: 0 }, ['contextControlMetrics']).values.contextControlMetrics, undefined);
});

test('automatic compaction keeps the route captured before asynchronous capacity lookup', async () => {
  const f = await fixture();
  try {
    f.history(45, 10000);
    f.session.append('turn/start', { turn: 1 });
    f.agent.status = 'running';
    let selected = { provider: 'before-provider', model: 'before-model' };
    f.agent.model = { current: () => selected };
    f.ctx.llm.resolveModelInfo = async () => {
      selected = { provider: 'after-provider', model: 'after-model' };
      return { context: { contextWindow: 1000000 }, defaultMaxTokens: 8192 };
    };
    assert.equal(await f.ctx.contextControl.automatic(f.agent, f.signal, false, 1), true);
    assert.equal(f.calls[0].provider, 'before-provider');
    assert.equal(f.calls[0].model, 'before-model');
  } finally { await f.close(); }
});

test('disposal during asynchronous activation cannot publish late consumers', async () => {
  let ready;
  const projectionReady = new Promise(resolve => { ready = resolve; });
  const mode = { projectionReady };
  const activation = fixture({}, mode);
  const rejected = assert.rejects(activation);
  while (!mode.projectionAcquired) await new Promise(resolve => setImmediate(resolve));
  const projections = mode.context.sessionProjections;
  await mode.context.fiber.dispose();
  ready();
  await rejected;
  assert.equal(projections.snapshot({ seq: 0 }, ['contextControlMetrics']).values.contextControlMetrics, undefined);
});

test('pending Agent model selection supplies status and the manual summary route', async () => {
  const f = await fixture();
  try {
    f.history();
    f.agent.model = { current: () => ({ provider: 'selected-provider', model: 'selected-model' }) };
    const status = await f.ctx.contextControl.status(f.agent, f.signal);
    assert.equal(status.provider, 'selected-provider');
    assert.equal(status.model, 'selected-model');
    assert.equal((await f.ctx.contextControl.operation(f.agent, { action: 'compact' }, f.signal, { manual: true })).outcome, 'compacted');
    assert.equal(f.calls.at(-1).provider, 'selected-provider');
    assert.equal(f.calls.at(-1).model, 'selected-model');
  } finally { await f.close(); }
});

test('pre-step compaction retains the fixed step model instead of a later selection', async () => {
  const f = await fixture();
  try {
    f.history(45, 10000);
    f.session.append('turn/start', { turn: 1 });
    f.agent.status = 'running';
    f.agent.model = { current: () => ({ provider: 'later-provider', model: 'later-model' }) };
    await f.ctx.waterfall('agent/pre-step', {
      agent: f.agent, signal: f.signal, turn: 1,
      modelSelection: { provider: 'step-provider', model: 'step-model' },
    }, async () => ({ kind: 'accept' }));
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].provider, 'step-provider');
    assert.equal(f.calls[0].model, 'step-model');
  } finally { await f.close(); }
});
