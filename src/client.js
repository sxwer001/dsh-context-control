window.__ModuleLoader__.load({
  id: 'dsh-context-control',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const COPY = {
      zh: { title: '上下文窗口', unknown: '等待模型窗口信息', used: '已用', remaining: '剩余', chars: '有效字符', threshold: '自动触发线', auto: '自动压缩', thresholdLabel: '达到以下字符数时压缩', apply: '应用', global: '设为全局默认', compact: '立即压缩', queue: '在安全边界压缩', cancel: '取消待执行压缩', busy: '正在压缩…', estimated: '估算', history: '查看压缩原文', next: '下一页', closed: '已关闭', queued: '已排队，将在下一安全边界执行。', empty: '暂无可安全压缩的旧历史。', success: '压缩完成', saved: '设置已保存', tokenInfo: '按最近请求模型计量；切换模型后下一请求更新。', inputError: '请输入 10,000 至 5,000,000 之间的整数字符数。', breakdown: '内容构成估算', system: '系统', tools: '工具定义', conversation: '对话', last: '最近压缩', detail: '查看上下文用量', close: '关闭', preview: '压缩前', after: '压缩后' },
      en: { title: 'Context window', unknown: 'Waiting for model capacity', used: 'used', remaining: 'remaining', chars: 'Active characters', threshold: 'Auto trigger', auto: 'Auto compaction', thresholdLabel: 'Compact at this character count', apply: 'Apply', global: 'Save global default', compact: 'Compact now', queue: 'Compact at a safe boundary', cancel: 'Cancel queued compaction', busy: 'Compacting…', estimated: 'estimated', history: 'Read original history', next: 'Next page', closed: 'Off', queued: 'Queued for the next safe boundary.', empty: 'No safe older history to compact yet.', success: 'Compacted', saved: 'Settings saved', tokenInfo: 'Measured against the latest request route; updates after a model switch on the next request.', inputError: 'Enter an integer from 10,000 to 5,000,000 characters.', breakdown: 'Estimated composition', system: 'System', tools: 'Tool schemas', conversation: 'Conversation', last: 'Last compaction', detail: 'Inspect context usage', close: 'Close', preview: 'Before', after: 'After' }
    };
    const CSS = `
.dsh-cc{display:inline-flex;position:relative;align-items:center;font:inherit;color:var(--dsw-alias-label-primary)}
.dsh-cc-ring{display:inline-flex;align-items:center;justify-content:center;width:22px;height:26px;padding:2px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsh-cc-ring:hover{background:var(--dsw-alias-bg-layer-2)}
.dsh-cc-ring:focus-visible,.dsh-cc-btn:focus-visible,.dsh-cc-more summary:focus-visible,.dsh-cc-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dsh-cc-pop{position:fixed;width:264px;max-width:calc(100vw - 24px);box-sizing:border-box;z-index:1200;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 6px 16px var(--dsw-alias-bg-layer-2);font-size:12px;line-height:1.5;text-align:left;overflow-y:auto}
.dsh-cc-heading{display:flex;justify-content:space-between;align-items:center;font-weight:500;font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:4px}
.dsh-cc-total{font-weight:500;font-size:14px;font-variant-numeric:tabular-nums}
.dsh-cc-muted{color:var(--dsw-alias-label-secondary);font-size:12px;overflow-wrap:anywhere}
.dsh-cc-meta{display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-variant-numeric:tabular-nums}
.dsh-cc-more{margin-top:8px;interpolate-size:allow-keywords}
.dsh-cc-more::details-content{block-size:0;overflow:clip;transition:block-size 200ms ease,content-visibility 200ms allow-discrete}
.dsh-cc-more[open]::details-content{block-size:auto}
.dsh-cc-more summary{color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;transition:margin-bottom 200ms ease}
.dsh-cc-more[open] summary{margin-bottom:10px}
.dsh-cc-divider{height:1px;background:var(--dsw-alias-border-l1);margin:10px 0}
.dsh-cc-switch{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.dsh-cc-switch input{accent-color:var(--dsw-alias-brand-primary)}
.dsh-cc-form{display:flex;gap:8px;margin-top:5px}
.dsh-cc-input{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:5px 7px;font:inherit;font-variant-numeric:tabular-nums}
.dsh-cc-btn{border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;padding:5px 8px;cursor:pointer}
.dsh-cc-btn:disabled{opacity:.5;cursor:default}
.dsh-cc-presets{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.dsh-cc-presets .dsh-cc-btn{font-size:12px;padding:4px 8px}
.dsh-cc-main{display:block;width:100%;margin-top:10px;border-color:var(--dsw-alias-border-l2);font-weight:500;padding:5px 8px}
.dsh-cc-status{margin-top:8px;font-size:12px;overflow-wrap:anywhere}
.dsh-cc-error{color:var(--dsw-alias-state-error-primary)}
.dsh-cc-history{white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;font-size:12px;margin:8px 0}
.dsh-cc-close{border:0;background:transparent;color:inherit;padding:3px 7px;cursor:pointer;font:inherit}
@media(pointer:coarse){.dsh-cc-ring{width:44px;height:44px}.dsh-cc-btn{min-height:40px}.dsh-cc-input{font-size:16px}}
@media(prefers-reduced-motion:reduce){.dsh-cc-more::details-content,.dsh-cc-more summary{transition:none}}
`;
    function Ring(props) {
      const { sessionId, useProjection, useSession } = props;
      const metrics = useProjection('contextControlMetrics');
      const pressure = useProjection('contextPressure');
      const breakdown = useProjection('contextBreakdown');
      const running = useSession(session => session.running);
      const [open, setOpen] = React.useState(false);
      const [data, setData] = React.useState(null);
      const [threshold, setThreshold] = React.useState('400000');
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [note, setNote] = React.useState('');
      const [history, setHistory] = React.useState(null);
      const [position, setPosition] = React.useState({ top: 0, left: 0 });
      const [, languageChanged] = React.useReducer(value => value + 1, 0);
      const root = React.useRef(null);
      const panel = React.useRef(null);
      const trigger = React.useRef(null);
      const mounted = React.useRef(true);
      const language = props.localeFace.getLocale();
      const chinese = /^zh/i.test(typeof language === 'string' ? language : language.active);
      const t = COPY[chinese ? 'zh' : 'en'];
      const format = value => Number(value).toLocaleString(chinese ? 'zh-CN' : 'en-US');
      const short = value => Number(value).toLocaleString(chinese ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 });
      const compactCount = value => Number(value).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }).replace('K', 'k');
      const tokens = pressure?.projectedTokens ?? data?.tokens;
      const windowSize = pressure?.contextWindow ?? data?.contextWindow;
      const percent = tokens !== undefined && windowSize > 0 ? Math.min(100, tokens / windowSize * 100) : null;
      const chars = metrics?.chars ?? data?.chars;
      const last = metrics?.last ?? data?.last;
      const compacting = busy || metrics?.busy;
      const call = React.useCallback(async args => {
        const response = await props.connection.rpc.call('/api', 'contextControl/executeUi', { args: { agentId: sessionId, request: args } });
        if (!response.ok) throw new Error(response.error.message);
        return response.value;
      }, [sessionId, props.connection]);
      React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
      React.useEffect(() => props.localeFace.subscribe(languageChanged), [props.localeFace]);
      React.useEffect(() => {
        if (!open) return;
        let cancelled = false;
        call({ action: 'status' }).then(value => { if (!cancelled) { setData(value); setThreshold(String(value.config.triggerChars)); setError(''); } }).catch(value => { if (!cancelled) setError(value.message); });
        return () => { cancelled = true; };
      }, [open, call, metrics?.last?.summarySeq, metrics?.last?.error]);
      React.useLayoutEffect(() => {
        if (!open) return;
        const place = () => {
          const anchor = trigger.current?.getBoundingClientRect();
          const height = panel.current?.getBoundingClientRect().height ?? 420;
          if (!anchor) return;
          const width = Math.min(264, window.innerWidth - 24);
          const maxHeight = Math.max(140, anchor.top - 20);
          setPosition({ left: Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12)), top: Math.max(12, anchor.top - Math.min(height, maxHeight) - 8), maxHeight });
        };
        place();
        const observer = new ResizeObserver(place);
        if (panel.current) observer.observe(panel.current);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        const dismiss = event => { if (!root.current?.contains(event.target)) setOpen(false); };
        const escape = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', escape);
        return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
      }, [open]);
      const perform = async args => {
        setBusy(true); setError(''); setNote('');
        try {
          const value = await call(args);
          if (!mounted.current) return;
          if (args.action === 'history') setHistory(value);
          else { setData(value); setThreshold(String(value.config.triggerChars)); setNote(value.outcome === 'queued' ? t.queued : value.outcome === 'no-safe-range' ? t.empty : args.action === 'configure' ? t.saved : value.outcome === 'compacted' ? t.success : ''); }
        } catch (value) { if (mounted.current) setError(value.message); }
        finally { if (mounted.current) setBusy(false); }
      };
      const save = scope => {
        const value = Number(threshold);
        if (!Number.isSafeInteger(value) || value < 10000 || value > 5000000) { setError(t.inputError); return; }
        perform({ action: 'configure', scope, settings: { triggerChars: value } });
      };
      return h('span', { className: 'dsh-cc', ref: root }, h('style', null, CSS),
        h('button', { className: 'dsh-cc-ring', ref: trigger, type: 'button', 'aria-label': t.detail, 'aria-haspopup': 'dialog', 'aria-expanded': open, title: percent === null ? t.unknown : `${Math.round(percent)}% ${t.used}`, onClick: () => setOpen(value => !value) },
          h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true, style: { transform: 'rotate(-90deg)' } },
            h('circle', { cx: 12, cy: 12, r: 9, fill: 'none', stroke: 'var(--dsw-alias-border-l2)', strokeWidth: 2.5 }),
            h('circle', { cx: 12, cy: 12, r: 9, fill: 'none', stroke: 'var(--dsw-alias-label-secondary)', strokeWidth: 2.5, strokeLinecap: 'round', pathLength: 100, strokeDasharray: `${percent ?? 0} 100` }))),
        open && h('div', { className: 'dsh-cc-pop', ref: panel, role: 'dialog', 'aria-label': t.title, style: position },
          h('div', { className: 'dsh-cc-heading' }, t.title, h('button', { className: 'dsh-cc-close', type: 'button', 'aria-label': t.close, onClick: () => setOpen(false) }, '×')),
          h('div', { className: 'dsh-cc-total' }, percent === null ? t.unknown : `${Math.round(percent)}% ${t.used} (${t.remaining} ${Math.max(0, 100 - Math.round(percent))}%)`),
          h('div', { className: 'dsh-cc-muted', title: tokens === undefined ? '' : `${format(tokens)} / ${windowSize ? format(windowSize) : '—'} · ${t.estimated}` }, tokens === undefined ? '—' : chinese ? `已用 ${compactCount(tokens)}，共 ${windowSize ? compactCount(windowSize) : '—'}` : `${compactCount(tokens)} used of ${windowSize ? compactCount(windowSize) : '—'}`),
          h('div', { className: 'dsh-cc-meta dsh-cc-muted' }, h('span', { title: t.chars }, `${chars === undefined ? '—' : short(chars)} ${t.chars}`), h('span', { title: `${t.threshold}: ${format(data?.config.triggerChars ?? 400000)} ${t.chars}` }, `${t.auto} ${data?.config.autoEnabled === false ? t.closed : short(data?.config.triggerChars ?? 400000)}`)),
          h('button', { className: 'dsh-cc-btn dsh-cc-main', type: 'button', disabled: !data || compacting, onClick: () => perform({ action: data?.pending ? 'cancel' : 'compact', ...(data?.pending ? {} : { expectedGeneration: data?.generation }) }) }, compacting ? t.busy : data?.pending ? t.cancel : running ? t.queue : t.compact),
          (error || last?.error || note || data?.failure) && h('div', { className: `dsh-cc-status${error || last?.error ? ' dsh-cc-error' : ''}`, role: 'status', 'aria-live': 'polite' }, error || last?.error || note || data?.failure),
          h('details', { className: 'dsh-cc-more' }, h('summary', null, chinese ? '设置与详情' : 'Settings and details'),
          breakdown && h('div', { className: 'dsh-cc-muted' }, `${t.breakdown}: ${t.system} ${format(breakdown.systemTokens)} · ${t.tools} ${format(breakdown.toolsTokens)} · ${t.conversation} ${format(breakdown.messageTokens)}`),
          h('div', { className: 'dsh-cc-divider' }),
          h('label', { className: 'dsh-cc-switch' }, h('input', { type: 'checkbox', checked: data?.config.autoEnabled ?? true, disabled: !data || compacting, onChange: event => perform({ action: 'configure', scope: 'session', settings: { autoEnabled: event.target.checked } }) }), t.auto),
          h('label', { className: 'dsh-cc-muted', htmlFor: `dsh-cc-threshold-${sessionId}` }, t.thresholdLabel),
          h('div', { className: 'dsh-cc-form' }, h('input', { id: `dsh-cc-threshold-${sessionId}`, className: 'dsh-cc-input', type: 'number', min: 10000, max: 5000000, step: 10000, value: threshold, disabled: !data || compacting, onChange: event => setThreshold(event.target.value) }), h('button', { className: 'dsh-cc-btn', type: 'button', disabled: !data || compacting, onClick: () => save('session') }, t.apply)),
          h('div', { className: 'dsh-cc-presets' }, ...[200000, 400000, 600000, 800000].map(value => h('button', { className: 'dsh-cc-btn', type: 'button', key: value, disabled: compacting, onClick: () => setThreshold(String(value)) }, chinese ? `${value / 10000} 万` : `${value / 1000}k`)), h('button', { className: 'dsh-cc-btn', type: 'button', disabled: !data || compacting, onClick: () => save('global') }, t.global)),
          last?.afterChars !== null && last?.afterChars !== undefined && h('div', { className: 'dsh-cc-muted' }, `${t.last}: ${format(last.beforeChars)} → ${format(last.afterChars)} ${t.chars}`),
          last && h('button', { className: 'dsh-cc-btn', style: { marginTop: 8 }, type: 'button', disabled: compacting, onClick: () => perform({ action: 'history', summarySeq: last.summarySeq }) }, t.history),
          history && h('div', null, h('pre', { className: 'dsh-cc-history' }, history.entries.map(entry => `[${entry.seq ?? 'tool'}] ${entry.type}\n${entry.text}`).join('\n\n')), (history.next || history.nextOffset !== null && history.nextOffset !== undefined) && h('button', { className: 'dsh-cc-btn', type: 'button', disabled: compacting, onClick: () => perform(history.next || { action: 'history', summarySeq: last.summarySeq, offset: history.nextOffset }) }, t.next)),
          h('div', { className: 'dsh-cc-muted', style: { marginTop: 8 } }, t.tokenInfo))));
    }
    return { inject: ['slots', 'locale', 'connection'], apply(ctx) {
      ctx.effect(() => ctx.slots.inject('conversation.input.right', () => ctx.slots.register({ name: 'conversation.input.right', id: 'dsh-context-control', order: 10 }, props => h(Ring, { ...props, connection: ctx.connection, localeFace: ctx.locale }))), 'context-control ring');
      ctx.effect(() => ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({ name: 'conversation.chat.commandview', key: 'context-control', id: 'dsh-context-control-quiet' }, () => null)), 'hide legacy panel command output');
    } };
  }
});
