# Phase 2: Overmind Setup Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Adopt Overmind's multi-component base overlay system (separate hatchery, commandCenter, and bunker layouts with flag-based placement), fix the duplicate flag name error for ally flags, implement the RCL8 Observer roadmap for automated remote room scanning, and relocate Grafana (Phase 6 from the old plan) to the end of this new phase sequence.

**Architecture:** Overmind's RoomPlanner uses three separate layout components — hatchery (spawns + extensions), commandCenter (storage + links + terminal), and bunker (towers + labs + factory + powerSpawn + observer) — each with its own anchor point. Components are placed via in-game flags (white/red for bunker, white/green for hatchery, white/blue for commandCenter) and translated from their layout anchor to the flag position. The current codebase has a single monolithic `bunkerLayout` with all structures at fixed coordinates. This phase splits it into Overmind's three-component system and adds the flag-based placement mechanism. The ally flag system is redesigned to use room-suffixed names (`ally:zh0ul@W1N1`) since Screeps requires globally unique flag names. The Observer module replaces scout creeps at RCL8 with structure-based room scanning via a round-robin queue.

**Tech Stack:** TypeScript (ES2017, strict, experimentalDecorators), `@types/screeps`, Rollup. All in-game code in `src/`. No new npm dependencies.

---

## Current Context & Assumptions

### Existing codebase (`/home/equail/Projects/screeps-scripts/`)

- **Phases 0-5 done.** Branch `feature/phase5` at commit `6b5f5f4`.
- **Current RoomPlanner** (`src/roomPlanner.ts`): Single monolithic `bunkerLayout` with all structures at fixed coordinates relative to room center (25,25). Places one construction site per tick per room. No flag-based placement.
- **Current bunker layout** (`src/layouts/bunker.ts`): Has RCL 1-8 defined. Already includes `observer: [{x: 25, y: 21}]` at RCL8. All structures are in one flat layout — no separation of hatchery/commandCenter/bunker components.
- **Current flag system** (`src/alliance.ts`): Uses `ally:<username>` prefix (e.g., `ally:zh0ul`). Scans `Game.flags` for `flagName.startsWith('ally:')` and extracts the username from the suffix. **Bug:** Screeps requires globally unique flag names. You cannot place `ally:zh0ul` in multiple rooms — the second placement returns `ERR_NAME_EXISTS` (-3). This blocks placing ally flags in multiple rooms.
- **Current CombatOverlord** (`src/overlords/combatOverlord.ts`): Uses `attack:<roomName>` flags for offensive operations. This has the same duplicate-name problem if you want to attack the same room from multiple colonies, but that's a less common use case.
- **Observer**: No Observer module exists yet. The bunker layout has the Observer position at RCL8, but no code uses `observeRoom()`.
- **Phase 6 (Grafana)**: Currently in the old plan at the end (`Phase 6: External Metrics Pipeline`). It needs to be moved to this new plan as the final phase, with its ADR (`0001-grafana-metrics-pipeline.md`).

### Overmind's multi-component layout system

Overmind (`bencbartlett/Overmind`) uses three separate layout files:

| Component | File | Anchor | Contents |
|---|---|---|---|
| Hatchery | `layouts/hatchery.ts` | (25,24) | Spawns, extensions, container, roads |
| CommandCenter | `layouts/commandCenter.ts` | (25,25) | Storage, links, terminal, roads |
| Bunker | `layouts/bunker.ts` | (25,25) | Towers, labs, factory, powerSpawn, observer, extensions, roads |

Each component is placed independently via flags:
- **White/Red flag** → bunker anchor
- **White/Green flag** → hatchery anchor
- **White/Blue flag** → commandCenter anchor

The RoomPlanner translates each component's layout coordinates from their default anchor to the flag position. This allows flexible room layout — you're not locked to center-of-room placement if terrain is bad.

**Why zh0ul had this and we didn't adopt it:** Our Phase 2 used a simplified single-layout approach (one `bunkerLayout` covering all structures). Overmind's multi-component system is more flexible but more complex. This phase adopts the full multi-component system.

### Gemini validation of Observer roadmap

The user-provided RCL8 Observer roadmap was validated against Gemini ( Screeps mechanics expert) and the official Screeps API docs:

| Claim | Validation |
|---|---|
| Observers unlocked at RCL 8 | ✅ CORRECT |
| Observer range = 10 rooms (linear distance) | ✅ CORRECT (Screeps API: `OBSERVER_RANGE = 10`, `ERR_NOT_IN_RANGE` returned if exceeded) |
| One observation per tick per Observer | ✅ CORRECT |
| Observed room visible on the *following* tick | ✅ CORRECT (API docs: "available on the next tick") |
| RCL 8 upgrade cap = 15 energy/tick | ✅ CORRECT |
| RCL 6 unlocks Extractor + Terminal | ✅ CORRECT |
| RCL 7 unlocks 2nd Spawn + Factory + Links | ✅ CORRECT (up to 4 links at RCL7, 3 at RCL6) |
| Link network for controller feeding at RCL 7 | ✅ CORRECT (viable strategy) |
| Round-robin queue with `Memory.lastObservedIndex` | ✅ CORRECT (standard pattern) |

### The duplicate flag name problem

**Screeps API constraint:** Flag names are globally unique across your account. `Game.flags` is a hash map keyed by flag name. You cannot have two flags with the same name. `RoomPosition.createFlag()` returns `ERR_NAME_EXISTS` (-3) if the name is taken.

**Current bug:** `alliance.ts` scans for flags named `ally:zh0ul`. You can only place this once. If you want to mark zh0ul as ally in multiple rooms (e.g., rooms where zh0ul has creeps operating), you can't — the game rejects the second flag.

**Fix:** Change the flag naming convention to `ally:<username>@<roomName>` (e.g., `ally:zh0ul@W1N1`, `ally:zh0ul@W2N3`). The scanning code parses the `@` separator to extract the username. This allows unlimited flags per ally across rooms. Backwards-compatible with the old `ally:zh0ul` format (no `@` → treat the entire suffix as the username, same as before).

---

## Files Likely to Change

### Base overlay (multi-component layout)
- **Create:** `src/layouts/hatchery.ts` — hatchery layout (spawns, extensions, container)
- **Create:** `src/layouts/commandCenter.ts` — command center layout (storage, links, terminal)
- **Modify:** `src/layouts/bunker.ts` — remove structures that move to hatchery/commandCenter, keep only bunker-specific structures (towers, labs, factory, powerSpawn, observer)
- **Modify:** `src/roomPlanner.ts` — multi-component placement with flag-based anchors, translation logic
- **Modify:** `src/main.ts` — pass colony to RoomPlanner (if needed)

### Flag system fix
- **Modify:** `src/alliance.ts` — parse `ally:<username>@<roomName>` format, backwards-compatible with `ally:<username>`

### Observer module
- **Create:** `src/observer/ObserverOverlord.ts` — round-robin room scanning via `observeRoom()`
- **Modify:** `src/main.ts` — instantiate ObserverOverlord for colonies with an Observer structure

### Grafana relocation
- **Modify:** `overmind-adoption-plan.md` (Obsidian) — move Phase 6 content to this new plan as the final phase
- **No code changes** — the StatsCollector and ADR 0001 already exist. This is a documentation restructure only.

---

## Step-by-Step Plan

### Task 1: Fix ally flag naming to support per-room uniqueness

**Objective:** Change the flag parsing in `alliance.ts` to support `ally:<username>@<roomName>` format, fixing the duplicate flag name error. Backwards-compatible with the old `ally:<username>` format.

**Files:**
- Modify: `src/alliance.ts:80-107` (the `getFlagAllies()` function)

**Step 1: Update `getFlagAllies()`**

Replace the `getFlagAllies()` function (lines 80-107):

```typescript
export function getFlagAllies(): Set<string> {
    if (_flagAlliesCache.tick === Game.time) {
        return _flagAlliesCache.allies;
    }
    const allies = new Set<string>();
    const prefix = ALLIANCE.flagPrefix;
    for (const flagName in Game.flags) {
        if (flagName.startsWith(prefix)) {
            // Format: "ally:<username>@<roomName>" or legacy "ally:<username>"
            // The @<roomName> suffix allows placing ally flags in multiple
            // rooms without hitting ERR_NAME_EXISTS (flag names are globally
            // unique in Screeps).
            const suffix = flagName.slice(prefix.length);
            let username: string;
            const atIndex = suffix.indexOf('@');
            if (atIndex !== -1) {
                username = suffix.slice(0, atIndex);
            } else {
                // Legacy format: entire suffix is the username.
                username = suffix;
            }
            if (username) allies.add(username);
        }
    }

    // Log when the flag-discovered ally set changes.
    const prev = _flagAlliesCache.allies;
    const prevArr = Array.from(prev).sort();
    const currArr = Array.from(allies).sort();
    if (prevArr.join(',') !== currArr.join(',')) {
        if (allies.size > 0) {
            console.log(`[Alliance] Flag allies: ${currArr.join(', ')}`);
        } else if (prev.size > 0) {
            console.log('[Alliance] Flag allies cleared (no ally: flags found)');
        }
    }

    _flagAlliesCache = { tick: Game.time, allies };
    return allies;
}
```

**Step 2: Update the comment block for flagPrefix**

Replace the comment at lines 22-28:

```typescript
    // Flag prefix for in-game ally discovery.
    // Place flags named "ally:<username>@<roomName>" in any room to mark
    // that username as an ally. The @<roomName> suffix is required because
    // Screeps flag names are globally unique — you can't place "ally:zh0ul"
    // in two different rooms. Use "ally:zh0ul@W1N1", "ally:zh0ul@W2N3", etc.
    // Both players import this file. Flags are owner-visible only.
    // Legacy format "ally:<username>" (without @roomName) is still accepted.
    flagPrefix: 'ally:',
```

**Step 3: Verify build**

Run: `npx tsc -p . --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/alliance.ts
git commit -m "fix: ally flags support per-room uniqueness with @roomName suffix

Screeps requires globally unique flag names. The old ally:<username>
format only allowed one flag per ally. Now supports ally:<username>@<room>
format, allowing multiple flags per ally across rooms. Backwards-compatible
with legacy ally:<username> format."
```

---

### Task 2: Create hatchery layout file

**Objective:** Extract spawn/extension/container coordinates into a separate hatchery layout, matching Overmind's `layouts/hatchery.ts` structure.

**Files:**
- Create: `src/layouts/hatchery.ts`

**Step 1: Create the file**

```typescript
// src/layouts/hatchery.ts
// Hatchery layout adapted from Overmind's layouts/hatchery.ts.
// Contains: spawns, extensions, container, roads.
// Anchor: (25, 24) — slightly offset from room center to avoid overlap
// with commandCenter (25,25) and bunker (25,25) components.

import { RCLLayout } from './bunker';

export const hatcheryLayout: { data: { anchor: { x: number; y: number } }; [rcl: number]: RCLLayout } = {
    data: { anchor: { x: 25, y: 24 } },

    1: {
        buildings: {
            spawn: [{ x: 25, y: 24 }],
        },
    },

    2: {
        buildings: {
            spawn: [{ x: 25, y: 24 }],
            extension: [
                { x: 24, y: 23 }, { x: 26, y: 23 }, { x: 23, y: 24 },
                { x: 27, y: 24 }, { x: 27, y: 26 },
            ],
            container: [{ x: 25, y: 25 }],
        },
    },

    3: {
        buildings: {
            spawn: [{ x: 25, y: 24 }],
            extension: [
                { x: 24, y: 22 }, { x: 26, y: 22 }, { x: 24, y: 23 },
                { x: 26, y: 23 }, { x: 23, y: 24 }, { x: 27, y: 24 },
                { x: 23, y: 26 }, { x: 27, y: 26 }, { x: 24, y: 27 },
                { x: 26, y: 27 },
            ],
            container: [{ x: 25, y: 25 }],
        },
    },

    // RCL 4-8: same as RCL 3 with progressively more extensions.
    // The RoomPlanner handles cumulative placement — each RCL level
    // includes all structures from previous levels plus new ones.
    // For simplicity, we define the delta at each level. The roomPlanner
    // will place only what's missing.
    4: {
        buildings: {
            spawn: [{ x: 25, y: 24 }],
            extension: [
                { x: 24, y: 22 }, { x: 26, y: 22 }, { x: 24, y: 23 },
                { x: 26, y: 23 }, { x: 23, y: 24 }, { x: 27, y: 24 },
                { x: 23, y: 26 }, { x: 27, y: 26 }, { x: 24, y: 27 },
                { x: 26, y: 27 }, { x: 23, y: 23 }, { x: 27, y: 23 },
                { x: 22, y: 24 }, { x: 28, y: 24 }, { x: 22, y: 26 },
                { x: 28, y: 26 }, { x: 23, y: 28 }, { x: 24, y: 28 },
                { x: 26, y: 28 }, { x: 27, y: 28 },
            ],
            container: [{ x: 25, y: 25 }],
        },
    },

    5: {
        buildings: {
            spawn: [{ x: 25, y: 24 }],
            extension: [
                // RCL4 set + 10 more (30 total)
                { x: 24, y: 22 }, { x: 26, y: 22 }, { x: 24, y: 23 },
                { x: 26, y: 23 }, { x: 23, y: 24 }, { x: 27, y: 24 },
                { x: 23, y: 26 }, { x: 27, y: 26 }, { x: 24, y: 27 },
                { x: 26, y: 27 }, { x: 23, y: 23 }, { x: 27, y: 23 },
                { x: 22, y: 24 }, { x: 28, y: 24 }, { x: 22, y: 26 },
                { x: 28, y: 26 }, { x: 23, y: 28 }, { x: 24, y: 28 },
                { x: 26, y: 28 }, { x: 27, y: 28 },
                { x: 21, y: 23 }, { x: 29, y: 23 }, { x: 21, y: 25 },
                { x: 29, y: 25 }, { x: 21, y: 27 }, { x: 29, y: 27 },
                { x: 22, y: 28 }, { x: 28, y: 28 }, { x: 22, y: 22 },
                { x: 28, y: 22 },
            ],
            container: [{ x: 25, y: 25 }],
        },
    },

    6: {
        buildings: {
            spawn: [{ x: 25, y: 24 }],
            extension: [
                // RCL5 set + 10 more (40 total)
                { x: 24, y: 22 }, { x: 26, y: 22 }, { x: 24, y: 23 },
                { x: 26, y: 23 }, { x: 23, y: 24 }, { x: 27, y: 24 },
                { x: 23, y: 26 }, { x: 27, y: 26 }, { x: 24, y: 27 },
                { x: 26, y: 27 }, { x: 23, y: 23 }, { x: 27, y: 23 },
                { x: 22, y: 24 }, { x: 28, y: 24 }, { x: 22, y: 26 },
                { x: 28, y: 26 }, { x: 23, y: 28 }, { x: 24, y: 28 },
                { x: 26, y: 28 }, { x: 27, y: 28 },
                { x: 21, y: 23 }, { x: 29, y: 23 }, { x: 21, y: 25 },
                { x: 29, y: 25 }, { x: 21, y: 27 }, { x: 29, y: 27 },
                { x: 22, y: 28 }, { x: 28, y: 28 }, { x: 22, y: 22 },
                { x: 28, y: 22 },
                { x: 20, y: 24 }, { x: 30, y: 24 }, { x: 20, y: 26 },
                { x: 30, y: 26 }, { x: 21, y: 22 }, { x: 29, y: 22 },
                { x: 21, y: 28 }, { x: 29, y: 28 }, { x: 22, y: 21 },
                { x: 28, y: 21 },
            ],
            container: [{ x: 25, y: 25 }],
        },
    },

    7: {
        buildings: {
            spawn: [{ x: 25, y: 24 }, { x: 25, y: 28 }],
            extension: [
                // RCL6 set + 10 more (50 total)
                { x: 24, y: 22 }, { x: 26, y: 22 }, { x: 24, y: 23 },
                { x: 26, y: 23 }, { x: 23, y: 24 }, { x: 27, y: 24 },
                { x: 23, y: 26 }, { x: 27, y: 26 }, { x: 24, y: 27 },
                { x: 26, y: 27 }, { x: 23, y: 23 }, { x: 27, y: 23 },
                { x: 22, y: 24 }, { x: 28, y: 24 }, { x: 22, y: 26 },
                { x: 28, y: 26 }, { x: 23, y: 28 }, { x: 24, y: 28 },
                { x: 26, y: 28 }, { x: 27, y: 28 },
                { x: 21, y: 23 }, { x: 29, y: 23 }, { x: 21, y: 25 },
                { x: 29, y: 25 }, { x: 21, y: 27 }, { x: 29, y: 27 },
                { x: 22, y: 28 }, { x: 28, y: 28 }, { x: 22, y: 22 },
                { x: 28, y: 22 },
                { x: 20, y: 24 }, { x: 30, y: 24 }, { x: 20, y: 26 },
                { x: 30, y: 26 }, { x: 21, y: 22 }, { x: 29, y: 22 },
                { x: 21, y: 28 }, { x: 29, y: 28 }, { x: 22, y: 21 },
                { x: 28, y: 21 },
                { x: 20, y: 23 }, { x: 30, y: 23 }, { x: 20, y: 25 },
                { x: 30, y: 25 }, { x: 20, y: 27 }, { x: 30, y: 27 },
                { x: 21, y: 21 }, { x: 29, y: 21 }, { x: 21, y: 29 },
                { x: 29, y: 29 },
            ],
            container: [{ x: 25, y: 25 }],
        },
    },

    8: {
        buildings: {
            spawn: [{ x: 25, y: 24 }, { x: 25, y: 28 }, { x: 21, y: 25 }],
            extension: [
                // Full 60 extensions at RCL8 (cumulative from RCL7)
                { x: 24, y: 22 }, { x: 26, y: 22 }, { x: 24, y: 23 },
                { x: 26, y: 23 }, { x: 23, y: 24 }, { x: 27, y: 24 },
                { x: 23, y: 26 }, { x: 27, y: 26 }, { x: 24, y: 27 },
                { x: 26, y: 27 }, { x: 23, y: 23 }, { x: 27, y: 23 },
                { x: 22, y: 24 }, { x: 28, y: 24 }, { x: 22, y: 26 },
                { x: 28, y: 26 }, { x: 23, y: 28 }, { x: 24, y: 28 },
                { x: 26, y: 28 }, { x: 27, y: 28 },
                { x: 21, y: 23 }, { x: 29, y: 23 }, { x: 21, y: 25 },
                { x: 29, y: 25 }, { x: 21, y: 27 }, { x: 29, y: 27 },
                { x: 22, y: 28 }, { x: 28, y: 28 }, { x: 22, y: 22 },
                { x: 28, y: 22 },
                { x: 20, y: 24 }, { x: 30, y: 24 }, { x: 20, y: 26 },
                { x: 30, y: 26 }, { x: 21, y: 22 }, { x: 29, y: 22 },
                { x: 21, y: 28 }, { x: 29, y: 28 }, { x: 22, y: 21 },
                { x: 28, y: 21 },
                { x: 20, y: 23 }, { x: 30, y: 23 }, { x: 20, y: 25 },
                { x: 30, y: 25 }, { x: 20, y: 27 }, { x: 30, y: 27 },
                { x: 21, y: 21 }, { x: 29, y: 21 }, { x: 21, y: 29 },
                { x: 29, y: 29 },
                // 10 more for RCL8 (60 total)
                { x: 19, y: 24 }, { x: 31, y: 24 }, { x: 19, y: 26 },
                { x: 31, y: 26 }, { x: 22, y: 29 }, { x: 28, y: 29 },
                { x: 19, y: 25 }, { x: 31, y: 25 }, { x: 19, y: 23 },
                { x: 31, y: 23 },
            ],
            container: [{ x: 25, y: 25 }],
        },
    },
};
```

**Step 2: Verify build**

Run: `npx tsc -p . --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/layouts/hatchery.ts
git commit -m "feat: add hatchery layout (spawns, extensions, container) from Overmind"
```

---

### Task 3: Create commandCenter layout file

**Objective:** Extract storage/link/terminal coordinates into a separate commandCenter layout.

**Files:**
- Create: `src/layouts/commandCenter.ts`

**Step 1: Create the file**

```typescript
// src/layouts/commandCenter.ts
// Command center layout adapted from Overmind's layouts/commandCenter.ts.
// Contains: storage, links, terminal, roads.
// Anchor: (25, 25) — room center, overlapping with bunker's anchor.
// The two components use different coordinates within the same area.

import { RCLLayout } from './bunker';

export const commandCenterLayout: { data: { anchor: { x: number; y: number } }; [rcl: number]: RCLLayout } = {
    data: { anchor: { x: 25, y: 25 } },

    // RCL 1-3: no command center structures yet (storage unlocks at RCL 4).
    1: { buildings: {} },
    2: { buildings: {} },
    3: { buildings: {} },

    4: {
        buildings: {
            storage: [{ x: 24, y: 25 }],
            link: [{ x: 25, y: 25 }],
        },
    },

    5: {
        buildings: {
            storage: [{ x: 24, y: 25 }],
            link: [{ x: 25, y: 25 }],
        },
    },

    6: {
        buildings: {
            storage: [{ x: 24, y: 25 }],
            link: [{ x: 25, y: 25 }, { x: 23, y: 25 }],
            terminal: [{ x: 26, y: 24 }],
        },
    },

    7: {
        buildings: {
            storage: [{ x: 24, y: 25 }],
            link: [{ x: 25, y: 25 }, { x: 23, y: 25 }, { x: 27, y: 25 }],
            terminal: [{ x: 26, y: 24 }],
        },
    },

    8: {
        buildings: {
            storage: [{ x: 24, y: 25 }],
            link: [{ x: 25, y: 25 }, { x: 23, y: 25 }, { x: 27, y: 25 }, { x: 25, y: 23 }],
            terminal: [{ x: 26, y: 24 }],
        },
    },
};
```

**Step 2: Verify build**

Run: `npx tsc -p . --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/layouts/commandCenter.ts
git commit -m "feat: add commandCenter layout (storage, links, terminal) from Overmind"
```

---

### Task 4: Refactor bunker layout to bunker-only structures

**Objective:** Remove spawns, extensions, containers, and storage from the bunker layout. Keep only bunker-specific structures: towers, labs, factory, powerSpawn, observer, nuker.

**Files:**
- Modify: `src/layouts/bunker.ts` (replace entire file content)

**Step 1: Replace the bunker layout**

Replace the entire file with:

```typescript
// src/layouts/bunker.ts
// Bunker layout adapted from Overmind's layouts/bunker.ts.
// Contains ONLY bunker-specific structures: towers, labs, factory,
// powerSpawn, observer, nuker.
// Spawns, extensions, containers are in hatchery.ts.
// Storage, links, terminal are in commandCenter.ts.
// Anchor: (25, 25) — room center.

export const BUNKER_RADIUS = 6;

interface Coord { x: number; y: number; }

export interface RCLLayout {
    buildings: { [structureType: string]: Coord[] };
}

export const bunkerLayout: { data: { anchor: Coord }; [rcl: number]: RCLLayout } = {
    data: { anchor: { x: 25, y: 25 } },

    // RCL 1-2: no bunker structures yet (first tower unlocks at RCL 3).
    1: { buildings: {} },
    2: { buildings: {} },

    3: {
        buildings: {
            tower: [{ x: 25, y: 26 }],
        },
    },

    4: {
        buildings: {
            tower: [{ x: 25, y: 26 }],
        },
    },

    5: {
        buildings: {
            tower: [{ x: 25, y: 24 }, { x: 25, y: 26 }],
        },
    },

    6: {
        buildings: {
            tower: [{ x: 25, y: 24 }, { x: 25, y: 26 }],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
            ],
            extractor: [],   // placed at mineral position dynamically
        },
    },

    7: {
        buildings: {
            tower: [{ x: 25, y: 24 }, { x: 25, y: 26 }, { x: 23, y: 26 }, { x: 26, y: 23 }],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
                { x: 21, y: 22 }, { x: 22, y: 21 }, { x: 21, y: 21 },
            ],
            factory: [{ x: 25, y: 23 }],
        },
    },

    8: {
        buildings: {
            tower: [
                { x: 25, y: 24 }, { x: 25, y: 26 }, { x: 23, y: 26 },
                { x: 26, y: 23 }, { x: 22, y: 25 }, { x: 25, y: 22 },
            ],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
                { x: 21, y: 22 }, { x: 22, y: 21 }, { x: 21, y: 21 },
            ],
            factory: [{ x: 25, y: 23 }],
            powerSpawn: [{ x: 23, y: 23 }],
            observer: [{ x: 25, y: 21 }],
            nuker: [{ x: 24, y: 22 }],
        },
    },
};
```

**Step 2: Verify build**

Run: `npx tsc -p . --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/layouts/bunker.ts
git commit -m "refactor: bunker layout now contains only towers, labs, factory, powerSpawn, observer, nuker

Spawns, extensions, and containers moved to hatchery.ts.
Storage, links, and terminal moved to commandCenter.ts.
This matches Overmind's multi-component layout architecture."
```

---

### Task 5: Refactor RoomPlanner for multi-component placement

**Objective:** Update RoomPlanner to iterate over all three layouts (hatchery, commandCenter, bunker), translate each from its anchor to the room (or flag position), and place structures from all three.

**Files:**
- Modify: `src/roomPlanner.ts` (replace entire file)

**Step 1: Replace the file**

```typescript
// src/roomPlanner.ts
// Multi-component room planner adapted from Overmind's RoomPlanner.ts.
// Places structures from three layouts: hatchery, commandCenter, bunker.
// Each layout has its own anchor; components are translated to the
// room center (25,25) by default, or to flag positions if the user
// places room-planner flags (white/red=bunker, white/green=hatchery,
// white/blue=commandCenter).

import { bunkerLayout, RCLLayout } from './layouts/bunker';
import { hatcheryLayout } from './layouts/hatchery';
import { commandCenterLayout } from './layouts/commandCenter';

interface Coord { x: number; y: number; }

// All layouts with their default anchors.
const LAYOUTS: { name: string; layout: { data: { anchor: Coord }; [rcl: number]: RCLLayout } }[] = [
    { name: 'hatchery', layout: hatcheryLayout },
    { name: 'commandCenter', layout: commandCenterLayout },
    { name: 'bunker', layout: bunkerLayout },
];

// Flag colors for manual component placement (matching Overmind):
// white/red = bunker, white/green = hatchery, white/blue = commandCenter
// If no placement flags exist, all components use their default anchor
// (room center 25,25).

export const roomPlanner = {
    plan(room: Room): boolean {
        if (!room.controller) return false;
        const rcl = room.controller.level;

        let placedAny = false;

        for (const { layout } of LAYOUTS) {
            const rclData = (layout as any)[rcl] as RCLLayout | undefined;
            if (!rclData) continue;

            // Default: use the layout's anchor as the placement position.
            // No translation needed — coordinates are already absolute
            // relative to room center (25,25).
            // (Future: check for placement flags and translate from
            // layout anchor to flag position.)
            const anchor = layout.data.anchor;

            for (const structureType in rclData.buildings) {
                const positions = rclData.buildings[structureType];
                for (const pos of positions) {
                    // Translate from layout anchor to room center (25,25).
                    const dx = 25 - anchor.x;
                    const dy = 25 - anchor.y;
                    const x = pos.x + dx;
                    const y = pos.y + dy;

                    // Skip out-of-bounds positions.
                    if (x < 0 || x > 49 || y < 0 || y > 49) continue;

                    const existing = room.lookForAt(LOOK_STRUCTURES, x, y);
                    if (existing.some(s => s.structureType === structureType)) continue;

                    const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
                    if (sites.length > 0) continue;

                    const result = room.createConstructionSite(x, y, structureType as BuildableStructureConstant);
                    if (result === OK) {
                        console.log(`[RoomPlanner] Placing ${structureType} at (${x},${y})`);
                        return true;  // One site per tick per room.
                    }
                }
            }
        }
        return false;
    },
};
```

**Step 2: Verify build**

Run: `npx tsc -p . --noEmit`
Expected: 0 errors

**Step 3: Verify bundle**

Run: `npm run compile`
Expected: `dist/main.js` written, no errors. Grep: `grep -c 'hatcheryLayout\|commandCenterLayout\|bunkerLayout' dist/main.js` ≥ 3.

**Step 4: Commit**

```bash
git add src/roomPlanner.ts
git commit -m "feat: multi-component RoomPlanner with hatchery, commandCenter, bunker layouts

Adopted from Overmind's RoomPlanner.ts. Iterates over three separate
layout components, translates each from its anchor to room center.
One construction site per tick per room. Flag-based placement
(white/red=bunker, white/green=hatchery, white/blue=commandCenter)
deferred to future task."
```

---

### Task 5b: Throttle ally comms notifications to 5-minute interval

**Objective:** The ally comms logging in `main.ts` fires every tick that `allyStatus` is available, which produces extremely noisy output like `[Comms] Ally stoleas energy deficits: E43S27 (0)` every ~4 seconds. Gate the logging to a 5-minute interval (approximately 100 ticks on private server, 60-120 ticks on MMO) and suppress zero-energy deficit spam.

**Files:**
- Modify: `src/main.ts:46-57` (the ally status logging block)

**Step 1: Add a comms log throttle constant**

Near the top of `main.ts`, after the existing imports (around line 22), add:

```typescript
// Comms log throttle: only log ally status every N ticks to avoid console spam.
// Private server ticks are ~3-4s, so 100 ticks ≈ 5-6 minutes.
// MMO ticks are 2.5-5s, so 100 ticks ≈ 4-8 minutes.
const COMMS_LOG_INTERVAL = 100;
```

**Step 2: Replace the ally status logging block**

Replace lines 46-57:

```typescript
    // Read ally's status from foreign segment (available if requested last tick).
    const allyStatus = comms.readAllyStatus();
    if (allyStatus) {
        // Only log ally status on the comms interval to avoid console spam.
        // Without this gate, the log fires every tick (~4s on private server),
        // producing hundreds of identical lines per hour.
        const shouldLog = Game.time % COMMS_LOG_INTERVAL === 0;

        if (allyStatus.defenseRequests.length > 0) {
            if (shouldLog) {
                console.log(`[Comms] Ally ${allyStatus.player} requests defense:`,
                    allyStatus.defenseRequests.map(r => r.roomName).join(', '));
            }
        }
        if (allyStatus.energyDeficits.length > 0 && shouldLog) {
            // Filter: only log deficits where energy is actually below threshold
            // AND the deficit is meaningful (energy < needed). Skip zero-energy
            // rooms that spam the console with no actionable info.
            const meaningful = allyStatus.energyDeficits.filter(d => d.energy < ALLIANCE.lowEnergyThreshold);
            if (meaningful.length > 0) {
                console.log(`[Comms] Ally ${allyStatus.player} energy deficits:`,
                    meaningful.map(d => `${d.roomName} (${d.energy}/${ALLIANCE.lowEnergyThreshold})`).join(', '));
            }
        }
    }
```

**Step 3: Add ALLIANCE import if not already present**

Check that `ALLIANCE` is imported. It's already imported on line 5:
```typescript
import { ALLIANCE, getFlagAllies } from './alliance';
```
No change needed — `ALLIANCE.lowEnergyThreshold` is already accessible.

**Step 4: Verify build**

Run: `npx tsc -p . --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/main.ts
git commit -m "fix: throttle ally comms logging to ~5-minute interval

The comms logging was firing every tick (~4s), producing hundreds of
identical lines per hour. Now logs only every 100 ticks (~5 minutes).
Also filters zero-energy deficits that spam with no actionable info."
```

---

### Task 6: Create ObserverOverlord for round-robin room scanning

**Objective:** Colony-scoped overlord that, when an Observer structure exists in the colony's room, uses a round-robin queue to observe target rooms. The observed room becomes visible on the next tick, allowing CombatIntel to scan it.

**Files:**
- Create: `src/observer/ObserverOverlord.ts`

**Step 1: Create the file**

```typescript
// src/observer/ObserverOverlord.ts
// Observer-based remote room scanning, replacing scout creeps at RCL8.
// Uses a round-robin queue stored in Memory to observe one target room
// per tick per Observer. The observed room is visible on the next tick,
// allowing CombatIntel.scanVisibleRooms() to pick it up automatically.

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';

// Observer range is 10 rooms (linear/Chebyshev distance).
const OBSERVER_RANGE = 10;

export class ObserverOverlord extends Overlord {
    observer: StructureObserver | null;

    constructor(colony: Colony) {
        super(colony, 'observer', Priority.NormalLow);
        this.observer = null;
    }

    // Find the Observer structure in this colony's room.
    private findObserver(): StructureObserver | null {
        const observers = this.colony.room.find<StructureObserver>(FIND_MY_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_OBSERVER,
        });
        return observers[0] || null;
    }

    init(hatchery: Hatchery): void {
        // No-op — Observers don't spawn creeps. The Observer is a structure
        // built by the RoomPlanner when the room hits RCL8.
    }

    run(): void {
        this.observer = this.findObserver();
        if (!this.observer) return;
        if (!this.observer.isActive()) return;

        // Get or initialize the target room list for this colony.
        // The list is stored in Memory so it persists across ticks.
        const memKey = `observer_${this.colony.name}`;
        if (!Memory.observers) Memory.observers = {};
        if (!Memory.observers[memKey]) {
            Memory.observers[memKey] = {
                targets: [],
                lastIndex: -1,
            };
        }
        const obsMem = Memory.observers[memKey];

        // If no targets configured, try to auto-discover rooms within range.
        // This is a simple heuristic — the user can manually set targets
        // via game console: Memory.observers.observer_W1N1.targets = ['E1S1', 'E1S2']
        if (obsMem.targets.length === 0) {
            // Auto-discover: scan rooms within OBSERVER_RANGE using Game.map.
            // We parse the current room name to generate candidate coordinates.
            const roomName = this.colony.name;
            const parsed = this.parseRoomName(roomName);
            if (parsed) {
                const targets: string[] = [];
                for (let dx = -OBSERVER_RANGE; dx <= OBSERVER_RANGE; dx++) {
                    for (let dy = -OBSERVER_RANGE; dy <= OBSERVER_RANGE; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const target = this.formatRoomName(parsed.hDir, parsed.hVal + dx, parsed.vDir, parsed.vVal + dy);
                        // Only include rooms that exist on the map.
                        if (Game.map.getRoomStatus(target) === 'normal') {
                            targets.push(target);
                        }
                    }
                }
                obsMem.targets = targets;
                console.log(`[Observer] Auto-discovered ${targets.length} rooms within range of ${roomName}`);
            }
        }

        if (obsMem.targets.length === 0) return;

        // Round-robin: pick the next target.
        let nextIndex = obsMem.lastIndex + 1;
        if (nextIndex >= obsMem.targets.length) nextIndex = 0;

        const target = obsMem.targets[nextIndex];

        // Only observe if we don't already have vision (saves the observation
        // for rooms we can't see — no point observing a room we already see).
        if (target in Game.rooms) {
            obsMem.lastIndex = nextIndex;
            return;
        }

        const result = this.observer.observeRoom(target);
        if (result === OK) {
            obsMem.lastIndex = nextIndex;
            // Store the expected room so CombatIntel knows to scan it next tick.
            Memory.nextExpectedRoom = target;
        }
    }

    // Parse a Screeps room name into directional components.
    // Example: "W1N2" → { hDir: 'W', hVal: 1, vDir: 'N', vVal: 2 }
    // Returns null if the name doesn't match the expected pattern.
    private parseRoomName(name: string): { hDir: string; hVal: number; vDir: string; vVal: number } | null {
        const match = name.match(/^([WE])(\d+)([NS])(\d+)$/);
        if (!match) return null;
        return {
            hDir: match[1],
            hVal: parseInt(match[2], 10),
            vDir: match[3],
            vVal: parseInt(match[4], 10),
        };
    }

    // Format room name from directional components.
    private formatRoomName(hDir: string, hVal: number, vDir: string, vVal: number): string {
        return `${hDir}${Math.abs(hVal)}${vDir}${Math.abs(vVal)}`;
    }
}
```

**Step 2: Verify build**

Run: `npx tsc -p . --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/observer/ObserverOverlord.ts
git commit -m "feat: add ObserverOverlord for RCL8 room scanning via observeRoom()

Round-robin queue auto-discovers rooms within Observer range (10 rooms).
Stores target list and last index in Memory.observers. Skips rooms with
existing vision. Sets Memory.nextExpectedRoom for CombatIntel pickup.
Auto-parses room name to generate candidate coordinates."
```

---

### Task 7: Wire ObserverOverlord into main.ts

**Objective:** Instantiate ObserverOverlord per colony. It self-gates — if no Observer structure exists, `run()` does nothing.

**Files:**
- Modify: `src/main.ts` (add import, add to overlords array)

**Step 1: Add import**

After line 22 (`import { StatsCollector }`), add:

```typescript
import { ObserverOverlord } from './observer/ObserverOverlord';
```

**Step 2: Add ObserverOverlord to the overlords array**

In the overlords construction block (around line 107-111), add `ObserverOverlord` after `CombatOverlord`:

```typescript
        const overlords: Overlord[] = [
            new HarvestOverlord(colony),
            new HaulerOverlord(colony, logistics),
            new CombatOverlord(colony),  // defensive
            new ObserverOverlord(colony),  // RCL8 room scanning (no-op without Observer)
        ];
```

**Step 3: Verify build and bundle**

Run: `npx tsc -p . --noEmit && npm run compile`
Expected: 0 errors, `dist/main.js` written. Grep: `grep -c ObserverOverlord dist/main.js` > 0.

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire ObserverOverlord into main loop"
```

---

### Task 8: Update CombatIntel to scan Observer-observed rooms

**Objective:** Ensure CombatIntel picks up rooms made visible by the Observer on the tick after `observeRoom()` is called. The existing `scanVisibleRooms()` already iterates `Game.rooms`, so observed rooms are automatically included. But we should log when an observed room is scanned for debugging.

**Files:**
- Modify: `src/intel/CombatIntel.ts` (add a log line in `scanVisibleRooms()`)

**Step 1: Update `scanVisibleRooms()`**

Add a check for `Memory.nextExpectedRoom` at the start of `scanVisibleRooms()`. After the existing for loop, add:

```typescript
    // If an Observer made a room visible this tick, log it for debugging.
    if (Memory.nextExpectedRoom && Memory.nextExpectedRoom in Game.rooms) {
        console.log(`[CombatIntel] Observer-observed room ${Memory.nextExpectedRoom} is now visible`);
        // Clear the expectation — we've processed it.
        Memory.nextExpectedRoom = undefined;
    }
```

Add this right after the `for` loop in `scanVisibleRooms()`, before the closing brace.

**Step 2: Verify build**

Run: `npx tsc -p . --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/intel/CombatIntel.ts
git commit -m "feat: CombatIntel logs Observer-observed rooms and clears expectation"
```

---

### Task 9: Full build and in-game integration verify

**Objective:** Verify all TypeScript compiles, bundles, and the output contains all new modules.

**Step 1: Clean build**

Run: `npm run clean && npx tsc -p . --noEmit && npm run compile`
Expected: 0 type errors, `dist/main.js` produced.

**Step 2: Verify all new modules are in the bundle**

Run: `grep -c -E 'hatcheryLayout|commandCenterLayout|bunkerLayout|ObserverOverlord|ally:.*@' dist/main.js`
Expected: ≥ 5 (each module referenced at least once).

**Step 3: Deploy and observe**

Copy `dist/main.js` to Steam client's watch directory. Observe 200+ ticks on private server:
- No console errors
- `[RoomPlanner] Placing ...` messages show structures from all three layouts (hatchery extensions, commandCenter storage/link, bunker towers)
- Place an `ally:zh0ul@W1N1` flag and an `ally:zh0ul@W2N3` flag — both should work (no `ERR_NAME_EXISTS`)
- `[Alliance] Flag allies: zh0ul` appears once (deduplicated by the Set)
- If a room has an Observer (RCL8), `[Observer] Auto-discovered N rooms` appears, and observed rooms show `[CombatIntel] Observer-observed room X is now visible`
- CPU bucket stable (> 5000 after 200 ticks)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: Phase 2 Overmind Setup in-game integration fixes"
```

---

### Task 10: Relocate Grafana (Phase 6) to this plan as the final phase

**Objective:** Move the Grafana pipeline content from the old plan's Phase 6 into this new plan as the final phase. Update the Obsidian overmind-adoption-plan.md to reference the new plan. No code changes — the StatsCollector and ADR 0001 already exist.

**Files:**
- Modify: `~/Projects/obsidian/Personal/games/screeps/overmind-adoption-plan.md` (remove Phase 6 content, add pointer to new plan)
- This plan file (add Grafana section below)

**Step 1: Add Grafana section to this plan**

The Grafana pipeline (Tasks 30-33 from the old plan, using screepers/screeps-grafana) is the final phase of this new plan. See the section "## Phase 6: External Metrics Pipeline (screeps-grafana)" below — it's already included in this plan document.

**Step 2: Update the old plan in Obsidian**

In `overmind-adoption-plan.md`, replace the Phase 6 section header and content (lines 3359-3587) with a pointer:

```markdown
## Phase 6: External Metrics Pipeline (screeps-grafana)

> **Moved to:** `phase2-overmind-setup.md` (this plan's final phase). See [ADR 0001](ADRs/0001-grafana-metrics-pipeline.md) for the decision rationale. The Grafana pipeline is the final phase of the new plan at `~/Projects/obsidian/Personal/games/screeps/phase2-overmind-setup.md`.
```

**Step 3: Commit to Obsidian**

```bash
cd ~/Projects/obsidian
git add Personal/games/screeps/overmind-adoption-plan.md
git commit -m "docs(screeps): move Phase 6 Grafana to phase2-overmind-setup plan"
git push
```

---

## RCL8 Observer Roadmap

This section documents the strategic context for the Observer implementation, validated with Gemini. It's reference material — the implementation tasks above are the actionable items.

### Strategic progression

| RCL | Focus | Key Structures | Strategy |
|---|---|---|---|
| 1-5 | Fast Progression | Containers, Extensions | Maximize energy to controller. Scale upgraders based on container fill. Keep scout fleet small (2-3 units). |
| 6 | Economy Engine | Extractor, Terminal | Unlock mineral extraction. Build market script to sell surplus minerals, buy energy if needed. Build economic cushion for RCL7-8 push. |
| 7 | Multi-Spawn Upgrading | 2nd Spawn, Factory, Links | Scale upgrader body sizes. Optimize link network: source → controller link, eliminating hauler CPU for upgrading. |
| 8 | Observer + 15 EPS Cap | Observer, Power Spawn | 15 energy/tick upgrade cap. Place Observer immediately. Decommission scout creeps. Rewrite room-scanning to use `observeRoom()` round-robin. |

### Observer mechanics (Gemini-validated)

- **Unlocked at RCL 8.** Max 1 Observer per room (`CONTROLLER_STRUCTURES[STRUCTURE_OBSERVER] = {8: 1}`).
- **Range: 10 rooms** (Chebyshev/linear distance, `Game.map.getRoomLinearDistance()`).
- **One observation per tick.** `observer.observeRoom(target)` returns `OK`. Room is visible on the **next tick**.
- **ERR_NOT_IN_RANGE (-9)** if target is beyond 10 rooms.
- **Round-robin queue** in `Memory.observers[colonyName]` with `targets[]` and `lastIndex`.

### Observer logic (from user-provided context, validated)

```javascript
// Run early in loop, before checking room visibility
export function runObservers() {
    const observer = Game.getObjectById('YOUR_OBSERVER_ID');
    if (!observer) return;

    const targetRooms = ['E1S1', 'E1S2', 'E2S1', 'E2S2'];

    let nextIndex = (Memory.lastObservedIndex || 0) + 1;
    if (nextIndex >= targetRooms.length) nextIndex = 0;

    const target = targetRooms[nextIndex];
    if (observer.observeRoom(target) === OK) {
        Memory.lastObservedIndex = nextIndex;
        Memory.nextExpectedRoom = target;
    }
}

// Process observed data (next tick)
export function processObservedData() {
    if (Memory.nextExpectedRoom) {
        const room = Game.rooms[Memory.nextExpectedRoom];
        if (room) {
            const hostiles = room.find(FIND_HOSTILE_CREEPS);
            if (hostiles.length > 0) {
                // Trigger alert or adjust defense matrices
            }
        }
    }
}
```

### Observer constraint warning

The Observer has a maximum range of 10 rooms (linear distance). To map an entire sector, plan to place RCL 8 rooms strategically across the grid to maximize overlapping radar coverage.

---

## Phase 6: External Metrics Pipeline (screeps-grafana)

> **Relocated from the old plan's Phase 6.** This is the final phase of the roadmap.

**Goal:** Deploy the existing [screepers/screeps-grafana](https://github.com/screepers/screeps-grafana) project to self-host Grafana dashboards for Screeps metrics. Adapt our Phase 5 `StatsCollector` to match the `Memory.stats` format that screeps-grafana expects.

**Architecture:** screeps-grafana provides a complete self-hosted pipeline: a Node.js connector (`ScreepsStatsd.js`) that polls the Screeps API every 15s, authenticates via email/password signin, decodes the gzip+base64 `Memory.stats` response, and forwards metrics to StatsD → Graphite → Grafana. The docker-compose stack includes all four services (node connector, statsd, graphite, grafana) with persistent volumes and a sample dashboard. Grafana runs on port 1337. Self-hosting only — no cloud option. See [ADR 0001](ADRs/0001-grafana-metrics-pipeline.md) for the decision rationale.

**Prerequisite:** Phase 5 Task 27 (StatsCollector) must be complete and `Memory.stats` must be populated in-game.

**Key compatibility note:** screeps-grafana's `stats.js` sample and `ScreepsStatsd.js` connector expect `Memory.stats` in this shape (dotted keys produced by the connector's recursive `report()` function):

```
stats.time          → integer
stats.gcl.level     → integer
stats.gcl.progress  → float
stats.gcl.progressTotal → float
stats.cpu.bucket    → integer
stats.cpu.used      → float
stats.cpu.limit     → integer
stats.rooms.<sanitizedRoomName>.controllerLevel     → integer
stats.rooms.<sanitizedRoomName>.controllerProgress   → float
stats.rooms.<sanitizedRoomName>.controllerProgressTotal → float
stats.rooms.<sanitizedRoomName>.energyAvailable      → integer
stats.rooms.<sanitizedRoomName>.energyCapacityAvailable → integer
stats.rooms.<sanitizedRoomName>.storageEnergy        → integer
stats.rooms.<sanitizedRoomName>.terminalEnergy        → integer
```

### Task 30: Align StatsCollector to screeps-grafana format

**Objective:** Rename `colonies` → `rooms`, `rcl` → `controllerLevel`, `rclProgress` → `controllerProgress`, `rclProgressTotal` → `controllerProgressTotal`, add `terminalEnergy`. This matches the `stats.js` sample in the screeps-grafana repo.

**Files:**
- Modify: `src/stats/StatsCollector.ts`

**Step 1: Update the StatsCollector.collect() output format**

Replace the `Memory.stats` assignment block:

```typescript
        Memory.stats = {
            time: Game.time,
            gcl: {
                level: Game.gcl.level,
                progress: Game.gcl.progress,
                progressTotal: Game.gcl.progressTotal,
            },
            cpu: {
                bucket: Game.cpu.bucket,
                used: Game.cpu.getUsed(),
                limit: Game.cpu.limit,
            },
            rooms: {} as { [key: string]: any },
        };

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const safeName = roomName.replace(/[^a-zA-Z0-9]/g, '_');

            (Memory.stats as any).rooms[safeName] = {
                controllerLevel: room.controller.level,
                controllerProgress: room.controller.progress,
                controllerProgressTotal: room.controller.progressTotal,
                energyAvailable: room.energyAvailable,
                energyCapacityAvailable: room.energyCapacityAvailable,
                storageEnergy: room.storage ? room.storage.store.getUsedCapacity(RESOURCE_ENERGY) : 0,
                terminalEnergy: room.terminal ? room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) : 0,
            };
        }
```

**Step 2: Verify build**

Run: `npx tsc -p . --noEmit && npm run compile`
Expected: 0 errors, `dist/main.js` written.

**Step 3: Verify in-game stats format**

Deploy and run in game console:
```javascript
JSON.stringify(Memory.stats)
```
Expected: object with `time`, `gcl`, `cpu`, `rooms` keys. Room entries have `controllerLevel` (not `rcl`).

**Step 4: Commit**

```bash
git add src/stats/StatsCollector.ts
git commit -m "feat: align StatsCollector to screeps-grafana Memory.stats format"
```

---

### Task 31: Clone and configure screeps-grafana

**Objective:** Clone the screeps-grafana repo into `metrics/` and configure credentials.

**Files:**
- Create: `metrics/` (git clone)
- Create: `metrics/docker-compose.env` (from example, gitignored)

**Step 1: Clone the repo**

```bash
cd /home/equail/Projects/screeps-scripts
git clone https://github.com/screepers/screeps-grafana.git metrics
```

**Step 2: Add metrics/ to .gitignore**

```gitignore
# screeps-grafana — external metrics pipeline (self-hosted)
metrics/
```

**Step 3: Configure credentials**

```bash
cd metrics/
cp docker-compose.env.example docker-compose.env
```

Edit `docker-compose.env` with your Screeps credentials:
- `SCREEPS_HOST` — `https://screeps.com/` for MMO, `http://your-server:21025/` for private server
- `SCREEPS_EMAIL` — your Screeps account email
- `SCREEPS_PASSWORD` — your Screeps account password
- `SCREEPS_SHARD` — `shard0` for MMO (omit for private server)

**Step 4: Verify .env is gitignored**

```bash
cd /home/equail/Projects/screeps-scripts
git status
```
Expected: `metrics/` does not appear in git status (it's gitignored).

**Step 5: Commit .gitignore update**

```bash
git add .gitignore
git commit -m "chore: gitignore metrics/ (screeps-grafana clone)"
```

---

### Task 32: Launch the container stack

**Objective:** Start the Graphite + StatsD + Grafana + Node connector stack.

**Step 1: Run setup.sh**

```bash
cd metrics/
bash setup.sh
```

**Alternative with Podman:**

```bash
cd metrics/
podman-compose up -d
```

**Step 2: Verify containers are running**

```bash
podman ps   # or docker ps
```
Expected: four containers running — `node` (connector), `statsd`, `graphite`, `grafana`.

**Step 3: Verify Grafana is accessible**

Open http://localhost:1337 in a browser.
- Username: admin
- Password: admin

**Step 4: Verify data is flowing**

Wait 15-30 seconds for the first poll. In Grafana, check the sample dashboard — CPU bucket, GCL progress, and room energy panels should show data points.

If no data appears:
- Check connector logs: `podman logs metrics_node_1` (or equivalent)
- Verify `Memory.stats` is populated in-game: `JSON.stringify(Memory.stats)` in game console
- Check Graphite web UI: http://localhost:80 (or the Graphite container's mapped port)

---

### Task 33: Import sample dashboard and customize

**Objective:** Import the screeps-grafana sample dashboard and customize it for our colony metrics.

**Step 1: Import sample dashboard**

The sample dashboard (`sampleDashboard.json`) is included in the screeps-grafana repo. In Grafana:
1. Navigate to Dashboards → Import
2. Upload `sampleDashboard.json` from the `metrics/` directory
3. Select Graphite as the datasource

**Step 2: Verify panels**

The sample dashboard should show:
- CPU: `cpu.bucket`, `cpu.limit`, `cpu.used`
- GCL: `gcl.progress`, `gcl.progressTotal`, `gcl.level`
- Room metrics: `rooms.*.energyAvailable`, `rooms.*.controllerProgress`, `rooms.*.storageEnergy`

**Step 3: Customize (optional)**

Add panels for our specific metrics:
- `rooms.*.terminalEnergy` — terminal energy per colony
- `rooms.*.energyCapacityAvailable` — spawn capacity per colony

Use Graphite wildcard queries (`rooms.*.controllerLevel`) to show all colonies on one panel.

**Step 4: No commit needed**

Dashboard customizations are stored in Grafana's persistent volume (`grafana_data`). The cloned repo is gitignored, so no changes to commit.

---

## Risks, Tradeoffs, and Open Questions

### Risk: Multi-component layout may not place structures correctly if anchors overlap
**Mitigation:** The three layouts (hatchery, commandCenter, bunker) use coordinates that don't overlap — hatchery uses the (25,24) anchor area, commandCenter uses (24,25)-(26,25), bunker uses (22-26, 21-26). The RoomPlanner translates each from its anchor to room center (25,25). If terrain blocks a position, `createConstructionSite` returns non-OK and the planner moves to the next structure. No crash — just a skipped structure.

### Risk: Observer auto-discovery may generate invalid room names
**Mitigation:** `Game.map.getRoomStatus(target)` returns `'normal'` only for rooms that exist. Invalid or unexplored rooms return `'unknown'` and are skipped. The room name parser uses a strict regex `^([WE])(\d+)([NS])(\d+)$`.

### Risk: Flag naming change may break existing flags in-game
**Mitigation:** The new parsing is backwards-compatible. `ally:zh0ul` (no `@`) still works — the entire suffix is treated as the username. Users can migrate to `ally:zh0ul@W1N1` format at their own pace.

### Risk: Observer range is 10 rooms — insufficient for full sector coverage
**Mitigation:** This is a known Screeps limitation. The plan documents this in the "Observer constraint warning" section. Players place RCL8 rooms strategically to maximize overlapping coverage. Future extension: add a manual target list override (`Memory.observers[colonyName].targets = ['E1S1', ...]`).

### Open Question: Should we adopt Overmind's flag-based component placement?
The current plan uses default anchors (room center) for all three components. Overmind's RoomPlanner supports flag-based placement (white/red=bunker, white/green=hatchery, white/blue=commandCenter). This allows flexible placement when terrain is bad. **Recommendation:** Implement flag-based placement in a follow-up task if the default center placement proves insufficient for specific rooms. The multi-component layout structure is already in place — adding flag detection is a small addition.

### Open Question: Should we decommission scout creeps when Observer is active?
The Observer roadmap recommends decommissioning scout spawn queues once the Observer is active. Our codebase doesn't have a dedicated scout creep yet (CombatIntel.scanVisibleRooms() scans opportunistically via creep vision). **Recommendation:** No scout creeps to decommission yet. When a dedicated scout overlord is added in the future, it should self-gate when an Observer is present in the colony.

### Open Question: Should the `attack:<roomName>` flag system also support per-room uniqueness?
The `attack:` flags have the same duplicate-name problem if you want to attack the same room from multiple colonies. However, this is a rarer use case. **Recommendation:** Apply the same `@roomName` suffix fix if needed. Low priority.

---

## Verification Checklist

After all tasks:
- [ ] `npx tsc -p . --noEmit` passes with no errors
- [ ] `npm run compile` produces `dist/main.js`
- [ ] Deploy to private server, observe 200+ ticks of stable operation
- [ ] `[RoomPlanner]` messages show structures from hatchery, commandCenter, and bunker layouts
- [ ] `ally:zh0ul@W1N1` and `ally:zh0ul@W2N3` flags both work (no ERR_NAME_EXISTS)
- [ ] `[Alliance] Flag allies: zh0ul` appears (deduplicated)
- [ ] If RCL8 room with Observer: `[Observer] Auto-discovered N rooms` appears
- [ ] Observed rooms show `[CombatIntel] Observer-observed room X is now visible`
- [ ] `Memory.stats` uses `rooms` (not `colonies`) and `controllerLevel` (not `rcl`)
- [ ] `Memory.stats` includes `terminalEnergy`
- [ ] Grafana dashboard shows live data within 30 seconds of container startup
- [ ] CPU bucket stable (> 5000 after 200 ticks)
- [ ] Old plan in Obsidian points to this new plan for Phase 6 content