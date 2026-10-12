# Changelog

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
