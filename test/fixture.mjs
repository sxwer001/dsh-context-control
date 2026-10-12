import { Context, Service } from '@deepseek-ai/cordis';
import { SessionStore, Session, SessionId } from '@deepseek-ai/dsh-session';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { TokenMeter } from '@deepseek-ai/dsh-token-meter';
import { createUserMessage, createSystemMessage, createAssistantMessage } from '@deepseek-ai/dsh-llm';
import { apply } from '../src/host.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Storage } from '@deepseek-ai/dsh-storage';
import { apply as applyJson } from '@deepseek-ai/dsh-storage-json';
import { apply as applyDomain } from '@deepseek-ai/dsh-storage-domain';

export async function fixture(config = {}, mode = {}) {
  const ctx = new Context();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-context-control-'));
  new SessionStore(ctx);
  new SessionProjectionRegistry(ctx);
  const calls = [];
  const llm = new Service(ctx, 'llm');
  llm.resolveModelInfo = async () => ({ context: { contextWindow: 1000000 }, defaultMaxTokens: 8192 });
  llm.imageRequestPricing = () => undefined;
  llm.fileRequestText = ref => ref.name;
  llm.stream = async function* (options) {
    calls.push(options);
    if (mode.delay) await mode.delay();
    if (mode.failure) throw new Error('scripted provider failure');
    yield { type: 'block-start', index: 0, blockType: 'text' };
    yield { type: 'text-delta', index: 0, text: 'Goal: continue the task. Files: src/main.js. Verified tests: node --test passed. Pending: fix the final issue. Next: inspect the failing case.' };
    yield { type: 'usage', usage: { inputTokens: 20000, outputTokens: 50, cacheReadTokens: 18000 } };
    yield { type: 'finish', reason: { kind: mode.truncated ? 'max-tokens' : 'stop' } };
  };
  new TokenMeter(ctx);
  const commands = new Service(ctx, 'commands');
  const commandDefinitions = new Map();
  commands.register = definition => { commandDefinitions.set(definition.name, definition); return () => commandDefinitions.delete(definition.name); };
  const tools = new Service(ctx, 'tools');
  const toolDefinitions = new Map();
  tools.register = definition => { toolDefinitions.set(definition.name, definition); return () => toolDefinitions.delete(definition.name); };
  const agents = new Service(ctx, 'agents');
  new Storage(ctx);
  applyJson(ctx, { root: path.join(dir, 'storage') });
  await applyDomain(ctx, { backend: 'json' });
  const openDomain = ctx.storageDomain.open.bind(ctx.storageDomain);
  let domainSpec;
  ctx.storageDomain.open = spec => { domainSpec = spec; return openDomain(spec); };
  await apply(ctx, { retainRecentTokens: 100, retainRecentMessages: 2, ...config });
  const session = ctx.sessions.create(SessionId('test-session'), { meta: { cwd: dir } });
  ctx.on('session/flush', async current => {
    await fs.writeFile(path.join(dir, 'session.json'), JSON.stringify({ header: current.header, events: Array.from({ length: current.seq }, (_, seq) => current.eventAt(seq)) }));
  });
  let maintenance = false;
  const agent = { id: session.id, ctx, session, options: { provider: 'scripted', model: 'fixture' }, status: 'idle', runMaintenance: async job => {
    if (maintenance || agent.status !== 'idle') throw new Error('agent is not idle');
    maintenance = true;
    try { return await job(new AbortController().signal); } finally { maintenance = false; }
  } };
  agents.requireInitiator = () => agent;
  const signal = new AbortController().signal;
  const user = text => session.append('user/message', createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }), { surfaceOp: 'append' });
  const assistant = (text, step, turn = 0) => {
    const message = createAssistantMessage({ source: { kind: 'model', provider: 'scripted', model: 'fixture' }, content: [{ type: 'text', text }] });
    session.append('assistant/message', { turn, step, message, stream: [{ type: 'chunk', chunk: { type: 'block-end', index: 0, block: { type: 'text', text } } }, { type: 'chunk', chunk: { type: 'finish', reason: { kind: 'stop' } } }] }, { surfaceOp: 'append' });
  };
  function history(count = 10, size = 10000) {
    session.append('turn/start', { turn: 0 });
    session.append('step/start', { turn: 0, step: 0 });
    session.append('system/message', { turn: 0, step: 0, message: createSystemMessage({ content: [{ type: 'text', text: 'You are a coding assistant.' }], source: { kind: 'system-prompt' } }) }, { surfaceOp: 'append' });
    user('Do not delete config.json. Use npm test. Preserve the exact ID ABC-42.');
    session.append('request/header', { header: { config: { provider: 'scripted', model: 'fixture', maxTokens: 8192 } }, reason: 'initial' });
    session.append('request/context', { provider: 'scripted', model: 'fixture', contextWindow: 1000000 });
    assistant('completed work ' + 'x'.repeat(size), 0);
    session.append('step/end', { turn: 0, step: 0 });
    for (let step = 1; step < count; step++) { session.append('step/start', { turn: 0, step }); assistant('More verified details ' + 'y'.repeat(size), step); session.append('step/end', { turn: 0, step }); }
    session.append('turn/end', { turn: 0, reason: { kind: 'completed' } });
    user('Continue the final issue and keep the original constraints.');
  }
  return { ctx, dir, session, agent, signal, calls, user, assistant, history, mode, commands: commandDefinitions, tools: toolDefinitions, reloadSettings: async () => { const control = ctx.contextControl; await control.domain.close(); control.domain = await ctx.storageDomain.open(domainSpec); control.sessionsConfig = control.domain.table('sessions'); control.originals = control.domain.table('originals'); }, restore: async () => { const persisted = JSON.parse(await fs.readFile(path.join(dir, 'session.json'), 'utf8')); return Session.create(session.id, persisted.events, persisted.header); }, close: async () => { await ctx.fiber.dispose(); if (path.dirname(path.resolve(dir)) !== path.resolve(os.tmpdir()) || !path.basename(dir).startsWith('dsh-context-control-')) throw new Error('Refusing cleanup outside the owned test directory.'); await fs.rm(dir, { recursive: true, force: true }); } };
}
