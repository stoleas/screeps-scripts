# screeps-scripts

TypeScript Screeps AI with Overmind-inspired architecture. Co-op alliance with zh0ul.

## Build

```bash
npm install          # install dependencies
npm run build        # type-check only (tsc --noEmit)
npm run compile      # bundle to dist/main.js (rollup -c)
```

Deploy: copy `dist/main.js` to your Steam client's watch directory.

## Alliance Configuration

**Before deploying, update `src/alliance.ts`** with the correct values for your co-op:

```typescript
export const ALLIANCE = {
    allies: [
        'stoleas',    // your in-game username
        'zh0ul',      // ally's in-game username
    ],
    sharedRooms: [
        // 'W1N1', 'W1N2',  // fill in once rooms are chosen
    ],
    lowEnergyThreshold: 50000,
    underSiegeThreshold: 0.3,
    SEGMENT_OUR: 90,
    SEGMENT_ALLY: 90,
    commsRefreshInterval: 10,
};
```

Both players must keep this file synced (same allies list, same segment IDs).
The `allies` array drives IFF detection — if your username isn't in it,
towers will attack you.

## Architecture

| Module | File | Purpose |
|---|---|---|
| Memory management | `src/memory.ts` | CPU bucket gate, garbage collection |
| Colony abstraction | `src/colony.ts` | Room-level state grouping |
| Overlord pattern | `src/overlord.ts` | Decouples spawning from role logic |
| Hatchery | `src/hatchery.ts` | Priority-ordered spawn request queue |
| Room planner | `src/roomPlanner.ts` | Bunker layout placement (RCL 1-4) |
| CreepSetup | `src/creepSetup.ts` | Pattern-based body scaling |
| Task system | `src/task.ts`, `src/tasks.ts` | Composable action chains |
| GlobalCache | `src/cache.ts` | TTL-cached structure lookups |
| **Alliance** | `src/alliance.ts` | Allies list, shared rooms, thresholds |
| **Tower defense** | `src/tower.ts` | IFF-filtered tower logic |
| **Comms** | `src/comms.ts` | RawMemory segment publish/read |
| **Terminal** | `src/terminal.ts` | Automated ally resource sharing |
| **Production** | `src/production.ts` | MMO hardening (CPU gate, shard awareness) |

## Phase Progress

- **Phase 0** ✅ TypeScript + Rollup toolchain
- **Phase 1** ✅ Foundation patterns (CreepSetup, Tasks, Mem, GlobalCache)
- **Phase 2** ✅ Architecture (Colony, Overlord, Hatchery, RoomPlanner)
- **Phase 3** 🔧 Coop alliance (alliance, IFF, comms, terminal, MMO hardening)
- **Phase 4** ⬜ Mid-game (HiveClusters, Logistics, Zerg, Movement, RCL5-8)
- **Phase 5** ⬜ Military + profiling

See `obsidian/personal/games/screeps/overmind-adoption-plan.md` for the full plan.