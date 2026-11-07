# DSH 0.2.2-rc.1 compatibility investigation

Validated on 2026-11-07, Windows / Node 24.15.0. This change does **not** add
0.2.2-rc.1 to `engines.dsh` or the peer ranges, and does not publish a release.
The new host requires Node >=24.9. Its package compatibility gate still rejects
the current manifest before ordinary installation; direct SDK tests below are
separate from that version declaration.

## Relevant API changes and fixes

- [Projection registration](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/session/session-projection/src/index.ts)
  is now awaitable and yields a retained handle. The host still exposes a callable
  compatibility shim, so the old registration is not proof of universal startup
  failure. The plugin now awaits registration before exposing commands/tools and
  retains the handle. Tests delay its readiness, reject acquisition, and dispose
  the owning fiber during startup. Disposal removes the projection and consumers.
- [Agent model selection](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/core/agent/src/model-selection.ts)
  now belongs to `agent.model.current()` and the fixed `modelSelection` in the
  pre-step payload. Reading only the last request header ignores a pending model
  switch. Status and manual compaction now prefer the current selection; pre-step
  compaction preserves its fixed selection. A compaction attempt retains one route
  across asynchronous capacity lookup and summarization. Explicit configured
  summarization-provider/model overrides retain their previous behavior.
- The plugin registers one unconditional tool. It does not call the changed
  `tools.resolve/executable` API, change request routes in `agent/request`, assemble
  system prompts, or configure `tools.mode`. A native `ToolRuntime` regression
  registers its real definition, resolves the new step admission, executes status,
  and verifies that unloading removes the tool even from the admitted set.
- Existing Session log/surface reads and synchronous projection snapshots remain
  available through the host's compatibility interfaces. Native Session, JSON
  storage, projection, RPC gateway, and vendored compaction-transaction tests pass
  on the new SDK. The vendored engine is not silently replaced or marked as an
  unchanged 0.2.2 upstream implementation.

With the original `fe1fb931` production sources and the new SDK, four targeted
regressions fail: publication before delayed projection readiness, stale status/
manual-summary routing, automatic-route capture, and fixed pre-step routing.
These are controlled regressions; the readiness failure is demonstrated with an
injected asynchronous handoff, not claimed as a failure of every normal startup.

## Automated matrix

Use a separate checkout and a task-owned `node_modules` resolver for each exact
official SDK version, then run:

```sh
npm run check
npm test
```

| SDK dependencies | Check | Tests |
| --- | --- | --- |
| DSH 0.2.0-rc.2 | pass | 29 pass, 1 skip |
| DSH 0.2.1-rc.5 | pass | 29 pass, 1 skip |
| DSH 0.2.2-rc.1 / Cordis 4.1.0 | pass | 30 pass, 0 skip |

The single old-host skip is rejection during the *new asynchronous registration
handoff*, which those synchronous APIs do not provide. The new host runs that
test. Existing tests cover settings persistence, cancellation, failure/truncation
rollback, concurrent compaction, paged originals, exact disk replay, repeated
checkpoints, tool-call pairing, and RPC behavior. Model streams are scripted;
native tool registration, Session, projection, storage and RPC implementations
come from the selected SDK. Tests create and delete only owned temporary data.

## Cross-version recovery probe

A separate ignored probe generated an already-compacted Session and JSON storage
with the 0.2.1-rc.5 SDK, then loaded the same data with 0.2.2-rc.1. It verified:

- exact visible messages and surface sequence;
- all 10 paged original-history entries;
- a 23,000-character archived tool output, retrieved by its original hash;
- persisted global settings.

All comparisons passed. The probe uses `Session.create()` and the native JSON
StorageDomain on fixture-generated data. It is distinct from the same-version
disk-replay tests and from a full Desktop persistence-loader upgrade. Local
evidence is retained only under the owned `.test-state/upgrade-*` and
`.test-state/matrix-*` paths; no user history or credentials were accessed.

## Remaining validation

No Desktop UI, authenticated model API, or native package-manager update/failure
rollback acceptance was performed. The controlled startup/disposal tests cover
plugin-owned resources, not installer rollback. Old Session compatibility APIs
may eventually be retired. Output/headroom calculations still use the latest
request header's `maxTokens` and existing policy; this patch does not change
budget semantics or certify every model-switch/default-budget combination.
The SDK results justify reviewing these code fixes, not a general host support
claim or bypassing the declared version gate.
