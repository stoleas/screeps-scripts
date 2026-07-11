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

Three mechanisms for friend detection:

### 1. Static allies list (`src/alliance.ts`)

Update the `allies` array with in-game usernames. Both players must keep
this synced.

### 2. Controller-sign discovery (dynamic)

Both players sign their controllers with the same secret keyword:

```typescript
signKeyword: 'ZERG_ALLIANCE'
```

In-game, have a creep sign your controller. The in-game console doesn't expose
a `creep` variable — you must look one up by name first:

```javascript
// Find a creep in the room (replace with an actual creep name from your UI)
const c = Game.creeps['YourCreepNameHere']
c.signController(c.room.controller, 'ZERG_ALLIANCE')
```

Or as a one-liner:
```javascript
Game.creeps['YourCreepNameHere'].signController(Game.creeps['YourCreepNameHere'].room.controller, 'ZERG_ALLIANCE')
```

When your script scouts a room, it reads `controller.sign.text`. If it
matches the keyword, `controller.sign.username` is recognized as a friend
— towers won't attack them, healers will heal their creeps. This lets you
add new allies without editing code: they just sign their controller.

### 3. In-game flags (dynamic, easiest)

Place a flag named `ally:<username>` in any room:

```
ally:zh0ul
ally:stoleas
```

The script scans `Game.flags` for names starting with `ally:` and
recognizes the rest of the name as an ally. Flags are owner-visible only
— each player places their own flags to manage their friend list.

No code changes needed to add or remove friends — just place or remove
flags in-game. Matches Overmind's `name:id` naming convention.

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
- **Phase 1.1** ✅ Overmind setup (Colony, Overlord, Hatchery, RoomPlanner)
- **Phase 1.2** ✅ Economy (miner/hauler split, AlertEmitter, AutomationConsumer)
- **Phase 1.3** ✅ Colony maintenance (bootstrap, safe mode, repair/fortify, Zerg, LinkNetwork)
- **Phase 4** ⬜ Mid-game (HiveClusters, Logistics, RCL5-8)
- **Phase 5** ⬜ Military + profiling

See `obsidian/personal/games/screeps/overmind-adoption-plan.md` for the full plan.