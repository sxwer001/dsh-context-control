export const DEFAULTS = Object.freeze({ autoEnabled: true, triggerChars: 400000, retainRecentTokens: 16000, retainRecentMessages: 8, summaryMaxOutputTokens: 4096, safetyRatio: 0.85, headroomTokens: 4096, overflowRecoveryEnabled: true, summarizationProvider: '', summarizationModel: '' });
export function settings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Settings must be an object.');
  for (const key of Object.keys(value)) if (!Object.hasOwn(DEFAULTS, key)) throw new TypeError(`Unknown setting: ${key}`);
  const result = { ...DEFAULTS, ...value };
  for (const key of ['triggerChars', 'retainRecentTokens', 'retainRecentMessages', 'summaryMaxOutputTokens', 'headroomTokens']) if (!Number.isSafeInteger(result[key]) || result[key] < 1) throw new TypeError(`${key} must be a positive integer.`);
  if (result.triggerChars < 10000 || result.triggerChars > 5000000) throw new TypeError('triggerChars must be between 10000 and 5000000.');
  if (result.retainRecentMessages > 1000 || result.retainRecentTokens > 500000 || result.summaryMaxOutputTokens > 32768 || result.headroomTokens > 500000) throw new TypeError('A retention or output budget is too large.');
  if (typeof result.autoEnabled !== 'boolean' || typeof result.overflowRecoveryEnabled !== 'boolean') throw new TypeError('Switches must be booleans.');
  if (!Number.isFinite(result.safetyRatio) || result.safetyRatio < 0.5 || result.safetyRatio > 0.95) throw new TypeError('safetyRatio must be between 0.5 and 0.95.');
  if (typeof result.summarizationProvider !== 'string' || typeof result.summarizationModel !== 'string' || Boolean(result.summarizationProvider) !== Boolean(result.summarizationModel)) throw new TypeError('Set both summarizationProvider and summarizationModel, or neither.');
  return result;
}
export function codePoints(text) { let count = 0; for (const _ of String(text)) count++; return count; }
export function contentChars(content) {
  if (typeof content === 'string') return codePoints(content);
  if (!Array.isArray(content)) return 0;
  return content.reduce((count, block) => {
    if (block.type === 'text' || block.type === 'reasoning') return count + codePoints(block.text || '');
    if (block.type === 'tool-call') { const args = block.input ?? block.arguments ?? {}; return count + codePoints(block.name || '') + codePoints(typeof args === 'string' ? args : JSON.stringify(args)); }
    if (block.type === 'tool-result') return count + contentChars(block.content);
    if (block.type === 'file') return count + codePoints(block.attachment?.name || '');
    return count; // Binary image bytes are not context characters.
  }, 0);
}
export function textOf(content) { return typeof content === 'string' ? content : (content || []).filter(block => block.type === 'text').map(block => block.text).join('\n'); }
export function textPage(text, offset = 0, limit = 16000) {
  // ponytail: linear scan per page; add stored byte offsets only if large-log retrieval becomes slow.
  const page = [];
  let index = 0;
  for (const character of text) {
    if (index >= offset + limit) return { text: page.join(''), nextOffset: offset + limit };
    if (index >= offset) page.push(character);
    index++;
  }
  return { text: page.join(''), nextOffset: null };
}
export function initialMetrics() { return { nodes: [], toolsChars: 0, chars: 0, busy: false, last: null }; }
/** Incremental, positional surface fold. Original bodies stay in DSH, not this cache. */
export function foldMetrics(state, event) {
  if (event.type === 'request/header') {
    const tools = event.data.header.tools;
    const toolsChars = tools ? codePoints(JSON.stringify(tools)) : 0;
    return toolsChars === state.toolsChars ? state : { ...state, toolsChars, chars: state.chars - state.toolsChars + toolsChars };
  }
  if (event.type === 'compaction/start') return { ...state, busy: true };
  if (event.type === 'compaction/end') return { ...state, busy: false, ...(event.data.error ? { last: { ...state.last, error: 'Compaction failed; inspect the current history before retrying.' } } : {}) };
  if (event.type === 'compaction/summary') return { ...state, last: { summarySeq: event.seq, originalTokens: event.data.shadowedTokenCount, originalItems: event.data.shadowedSeqs.length, beforeChars: state.chars, afterChars: null, time: event.time, summaryOutputTokens: event.data.usage?.outputTokens ?? null } };
  if (!event.surfaceOp) return state;
  const message = event.data.message ?? event.data;
  const node = { seq: event.seq, chars: contentChars(message.content) };
  if (event.surfaceOp === 'append') return { ...state, nodes: [...state.nodes, node], chars: state.chars + node.chars };
  const start = state.nodes.findIndex(item => item.seq === event.surfaceOp.startSeq);
  const end = state.nodes.findIndex(item => item.seq === event.surfaceOp.endSeq);
  if (start < 0 || end < start) throw new Error('Context projection received a replacement outside its current surface.');
  const removed = state.nodes.slice(start, end + 1).reduce((sum, item) => sum + item.chars, 0);
  const chars = state.chars - removed + node.chars;
  const last = message.source?.kind === 'compact-checkpoint' && state.last ? { ...state.last, afterChars: chars } : state.last;
  return { ...state, nodes: [...state.nodes.slice(0, start), node, ...state.nodes.slice(end + 1)], chars, last };
}
export function metricsView(state) { return { chars: state.chars, busy: state.busy, last: state.last }; }
export function safetyThreshold(config, info, requestConfig = {}) {
  const window = info?.context?.contextWindow;
  if (!Number.isSafeInteger(window) || window <= 0) return null;
  const output = requestConfig.maxTokens ?? info.defaultMaxTokens ?? 0;
  return Math.max(0, Math.floor(Math.min(window * config.safetyRatio, window - output - config.headroomTokens)));
}
export function shouldCompact(config, chars, tokens, safety) { return config.autoEnabled && (chars >= config.triggerChars || safety !== null && tokens >= safety); }
export function safeError(error) { return error?.code === 'MAX_TOKENS' ? 'The summary reached its output limit. Original history was preserved.' : error?.message || String(error); }
/** Conservative first-version output filtering: exact repeated lines only, with errors untouched. */
export function deduplicateLog(text) {
  if (text.length < 8192 || /\b(error|failed|failure|fatal|exception|panic|traceback)\b/i.test(text)) return text;
  const lines = text.split('\n');
  const result = [];
  for (let index = 0; index < lines.length;) {
    let end = index + 1;
    while (end < lines.length && lines[end] === lines[index]) end++;
    result.push(lines[index]);
    if (end - index > 2) result.push(`[identical line repeated ${end - index} times]`);
    else if (end - index === 2) result.push(lines[index]);
    index = end;
  }
  const reduced = result.join('\n');
  return reduced.length + 300 < text.length ? reduced : text;
}
