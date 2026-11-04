# Changelog

## 0.1.4 — 2026-11-04

- Support the verified DSH 0.2.0-rc.2 and 0.2.1-rc.5 hosts; align optional DSH, Schemastery and Zod peers with both distributions.
- Supply the calling Peer in the native RPC test fixture. Preserve the Moonshot/Kimi JSON Schema fix from 0.1.3.
- Prepare separate test runtimes per host, verify the upstream compaction source hash, and leave vendored source unchanged.
- Validate 23 automated tests per host and rc.5 native installation, Web settings and plugin lifecycle with scripted responses.
- Verify rc.5 with the installed executable and a real OpenCode Go model: manual/automatic checkpoints, six-fact recall, original-history recovery, transport-failure rollback and restart persistence.

## 0.1.3 — 2026-11-04

- Declare string types for the `context_control` tool's `action` and `scope` enums, fixing the missing-type Schema rejection reported with Moonshot / Kimi in #1.
- Preserve all enum values and parameter constraints; add registered-Schema and five-action regression coverage.
- Validate with 23 automated tests in isolated temporary sessions/storage using DSH 0.2.0-rc.2 dependencies and a scripted model.
- Live Moonshot API acceptance and full DSH 0.2.1-rc.5 compatibility are not verified; the DSH version constraint remains unchanged.

## 0.1.2 — 2026-10-12

- Replace panel slash commands with authenticated native RPC so inspecting usage and changing settings do not add chat command rows.
- Hide legacy `context-control` command cards without deleting session events.
- Display compact counts such as `已用 53k，共 1M` without a token label; character thresholds remain separate.
- Animate settings expansion and collapse over 200ms, respecting reduced-motion preferences.
- Declare compatibility with DSH 0.2.0-rc.2 and host-supplied optional peers.
- Validate with 21 automated checks and the native web UI.

## 0.1.1 — 2026-10-12

- Reduce the default panel to approximately 264 × 182 pixels and fold settings and history into details.
- Validate manual and automatic compaction in a real desktop session using the current model, including original-history retrieval and two recall probes.

## 0.1.0 — 2026-10-12

- Add a context usage ring beside the model selector.
- Add configurable automatic compaction at 400,000 active characters, manual compaction and queued operations at safe boundaries.
- Preserve original history, user constraints and recent work using the native durable compaction transaction.
