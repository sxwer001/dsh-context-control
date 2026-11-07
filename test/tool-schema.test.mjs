import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
import { Context } from '@deepseek-ai/cordis';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';

test('native tool registry admits context_control and removes it when unloaded', async () => {
  const f = await fixture();
  const ctx = new Context();
  try {
    new SystemPrompt(ctx, {});
    new ToolRuntime(ctx);
    const dispose = ctx.tools.register(f.tools.get('context_control'));
    const toolSet = typeof ctx.tools.resolve === 'function'
      ? await ctx.tools.resolve({ agent: f.agent, signal: f.signal, modelSelection: { provider: 'scripted', model: 'fixture' } })
      : undefined;
    const tool = toolSet ? ctx.tools.executable('context_control', f.agent, toolSet) : ctx.tools.get('context_control', f.agent);
    assert.equal((await tool.execute({ action: 'status' }, { agent: f.agent, signal: f.signal })).sessionId, f.session.id);
    await dispose();
    assert.equal(ctx.tools.get('context_control', f.agent), undefined);
    if (toolSet) {
      assert.equal(ctx.tools.executable('context_control', f.agent, toolSet), undefined);
      toolSet.dispose();
    }
  } finally { await ctx.fiber.dispose(); await f.close(); }
});

test('registered tool parameters declare explicit JSON Schema types and preserve constraints', async () => {
  const f = await fixture();
  try {
    const validTypes = new Set(['null', 'boolean', 'object', 'array', 'number', 'integer', 'string']);
    function checkTypes(schema, path) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      assert.ok(types.length && types.every(type => validTypes.has(type)), `${path} must declare a valid type`);
      for (const [key, property] of Object.entries(schema.properties ?? {})) checkTypes(property, `${path}.properties.${key}`);
      if (schema.items) checkTypes(schema.items, `${path}.items`);
      if (typeof schema.additionalProperties === 'object') checkTypes(schema.additionalProperties, `${path}.additionalProperties`);
    }
    assert.ok(f.tools.size > 0);
    for (const [name, tool] of f.tools) checkTypes(tool.parameters, `${name}.parameters`);
    assert.deepEqual(f.tools.get('context_control').parameters, {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'configure', 'compact', 'cancel', 'history'] },
        settings: { type: 'object' },
        scope: { type: 'string', enum: ['session', 'global'] },
        summarySeq: { type: 'integer', minimum: 0 },
        sourceSeq: { type: 'integer', minimum: 0 },
        charOffset: { type: 'integer', minimum: 0 },
        offset: { type: 'integer', minimum: 0 },
        originalHash: { type: 'string' },
      },
      required: ['action'],
      additionalProperties: false,
    });
  } finally { await f.close(); }
});

test('context_control retains all five actions and rejects invalid arguments', async () => {
  const f = await fixture();
  try {
    f.history();
    const tool = f.tools.get('context_control');
    const execute = args => tool.execute(args, { agent: f.agent, signal: f.signal });
    assert.equal((await execute({ action: 'status' })).sessionId, f.session.id);
    const configured = await execute({ action: 'configure', scope: 'session', settings: { autoEnabled: false, triggerChars: 600000 } });
    assert.equal(configured.config.autoEnabled, false);
    assert.equal(configured.config.triggerChars, 600000);
    for (const args of [
      { action: 'unknown' },
      { action: 1 },
      { action: 'configure', settings: {}, scope: 'other' },
      { action: 'configure', settings: {}, scope: 1 },
      { action: 'configure', settings: { triggerChars: 1 } },
      { action: 'history', offset: -1 },
      { action: 'history', originalHash: 'invalid' },
      { action: 'status', unexpected: true },
    ]) await assert.rejects(execute(args));
    f.session.append('turn/start', { turn: 1 });
    f.agent.status = 'running';
    assert.equal((await execute({ action: 'compact' })).outcome, 'compacted');
    assert.equal(f.calls.length, 1);
    const history = await execute({ action: 'history' });
    assert.match(history.entries.map(entry => entry.text).join(''), /Do not delete config.json/);
    f.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } });
    f.agent.status = 'idle';
    await f.ctx.sessions.flush(f.session);
    const restored = await f.restore();
    assert.deepEqual(restored.surface.nodes, f.session.surface.nodes);
    assert.deepEqual(restored.deriveMessages(), f.session.deriveMessages());
    f.agent.status = 'running';
    const queued = await f.commands.get('context-control').handler({ agent: f.agent, rawInput: 'compact', signal: f.signal });
    assert.equal(JSON.parse(queued.text).outcome, 'queued');
    const cancelled = await execute({ action: 'cancel' });
    assert.equal(cancelled.outcome, 'cancelled');
    assert.equal(cancelled.pending, false);
    assert.equal(f.calls.length, 1);
  } finally { await f.close(); }
});
