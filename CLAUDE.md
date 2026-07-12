# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TypeScript Screeps AI with an Overmind-inspired architecture. Runs a co-op alliance with another player (zh0ul).

## Commands

```bash
npm install          # install dependencies
npm run build         # type-check only (tsc -p . --noEmit) — no emitted output
npm run compile        # bundle to dist/main.js (rollup -c)
npm run clean         # rm -rf dist
```

There is no test runner wired into `package.json` — treat `npm run build` (tsc strict type-check) as the primary correctness gate before considering a change done.

Deploy: copy `dist/main.js` to the Steam client's watch directory (manual step, not scripted).

## Architecture

The whole bot is a single `loop()` function (`src/main.ts`) invoked once per Screeps tick. Read `src/main.ts` top-to-bottom before making structural changes — it's the map of how every subsystem wires together and in what order.

**Tick sequence (in order):**
1. `Mem.load()` / `Mem.shouldRun()` / `Mem.clean()` (`src/memory.ts`) — CPU bucket gate (hard floor: skip tick below bucket 500) and Memory garbage collection.
2. `AutomationConsumer.consume()` (`src/automation/`) — applies whitelisted directives written into `Memory.automation` by an external pipeline via the Screeps REST API (e.g. safe mode triggers). Runs early so effects land before this tick's defense logic.
3. Alliance/comms: `getFlagAllies()`, `RawMemory` segment publish/read on `ALLIANCE.commsRefreshInterval`, `terminalNetwork.run()`.
4. `CombatIntel.scanVisibleRooms()` — cheap intel scan of currently-visible rooms only.
5. Build one `Colony` (`src/colony.ts`) per owned room; tag creeps with `creep.memory.colony`.
6. Per colony: room planning, tower defense (`SporeCrawler`), `LogisticsNetwork`, construct that colony's `Overlord`s, run `Hatchery`, run overlords, render `visualizer`.
7. Offensive combat: scan `attack:<roomName>` flags, spawn remote `CombatOverlord`s.
8. Profiler auto-dump, `AlertEmitter.check()`, `StatsCollector.collect()`.

**CPU gating.** Two tiers, both centered in `src/production.ts` (`PRODUCTION`):
- `Mem.shouldRun()` — hard floor, bucket < 500: skip the entire tick.
- `PRODUCTION.isCpuWarning()` — bucket < 2000: skip non-essential work (room planning, `UpgradeOverlord`, `BuildOverlord`). Harvest, hauling, and spawning always run. Check this flag before adding any new non-critical per-tick work.

**Overlord pattern** (`src/overlord.ts`, `src/overlords/*.ts`): decouples spawning from role logic. Each `Overlord` subclass owns one behavior (harvest, haul, build, upgrade, combat, observer). Lifecycle per tick is `refresh()` (re-associate live creeps via `creep.memory.overlord === this.ref`) → `init(hatchery)` (call `requestCreep` to queue spawn requests) → `run()` (drive creep behavior). New creep roles are added by creating a new `Overlord` subclass, not by branching inside an existing one.

**Hatchery** (`src/hatchery.ts`): priority-ordered spawn request queue. Overlords call `requestCreep`/`hatchery.request()` during `init`; `hatchery.run()` actually spawns.

**Task system** (`src/task.ts`, `src/tasks.ts`): composable, serializable "travel to target → act → detect completion" action chains stored in `creep.memory.task`. Tasks self-register into a static registry (`Task.register`) so they can be rehydrated from Memory via `Task.load`/`fromMemory`. Tasks can `fork()` a parent task to run next on completion.

**GlobalCache** (`src/cache.ts`): TTL-cached structure/number lookups, held on the `global` object; cleared automatically when CPU bucket drops below `Mem.BUCKET_CLEAR_CACHE`.

**Room planner** (`src/roomPlanner.ts`, `src/layouts/*.ts`): places structures from a static bunker layout (RCL 1-4 supported); non-essential, skipped under CPU warning.

**Alliance / IFF** (`src/alliance.ts`, `src/comms.ts`, `src/terminal.ts`): three independent, additive mechanisms for recognizing friendly players — a static `allies` array in `alliance.ts`, controller-sign discovery (both players sign controllers with a shared secret keyword, read via `controller.sign.text`), and `ally:<username>` flags scanned each tick (`getFlagAllies`/`autoFlagAllies`). Friend recognition feeds tower IFF (`SporeCrawler`) and healer targeting. `comms.ts` publishes/reads alliance status over `RawMemory` segments; `terminal.ts` auto-ships energy to allies under siege or in deficit.

**MMO hardening** (`src/production.ts`): differences from private servers to keep in mind when writing new code — ticks are event-driven on `Game.time` (2.5-5s/tick, not wall-clock), CPU cap can be as low as 20 (free tier / shard3, see `isLowCpuShard`), and NPC invaders spawn automatically in neutral rooms once harvesting thresholds are met.

**Alerts / metrics egress** (`src/alerts/AlertEmitter.ts`, `src/stats/StatsCollector.ts`): `AlertEmitter.check()` detects anomalies (defense breach, CPU spike) and appends to `Memory.alerts` (FIFO) for an external connector to poll and dispatch. `StatsCollector.collect()` runs every 10 ticks and feeds an external Grafana pipeline (the `metrics/` directory holds that external, gitignored connector setup — not part of the in-game bot).

## Conventions

- `strict: true` in `tsconfig.json`; `baseUrl` is `src/`. New modules should type-check cleanly under `npm run build`.
- Rollup bundles from `src/main.ts` only (`rollup.config.js`), CJS output to `dist/main.js`, `treeshake: false`.
- Screeps and lodash globals come from `@types/screeps` and `@types/lodash`; `src/types.d.ts` holds project-specific ambient type augmentations (e.g. custom `Memory`/`CreepMemory` fields) — extend it rather than casting to `any` when adding new Memory shapes.
