# Phase 4: Mid-Game Systems (RCL4-8) Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Adopt HiveClusters, LogisticsNetwork, Zerg wrapper, Movement system, RCL5-8 bunker layouts, and a RoomVisual dashboard into our TypeScript Screeps AI — transitioning from flat role modules to Overmind's cluster-based architecture for the mid-game.

**Architecture:** We wrap existing flat modules into HiveCluster classes (SporeCrawler absorbs tower.ts), introduce a LogisticsNetwork that pairs haulers with provide/request nodes, wrap creeps in Zerg objects with task pipelines, add a Movement module with stuck detection, extend bunker layouts to RCL8, and add a visualizer dashboard. Each task is independently deployable and backwards-compatible with RCL1-3 rooms.

**Tech Stack:** TypeScript (strict, ES2017), `@types/screeps`, Rollup bundling, Screeps RoomVisual API.

---

## Current State Assessment

### What exists (Phases 0-3, on `main` branch)

| File | Purpose |
|---|---|
| `src/main.ts` (122 lines) | Main loop: Mem, alliance, comms, terminal, towerDefense, Colony build, 3 overlords, Hatchery, roomPlanner |
| `src/colony.ts` (44 lines) | Colony abstraction: room, controller, spawns, sources, storage, stage, creeps |
| `src/overlord.ts` (51 lines) | Base Overlord: refresh(), requestCreep(), abstract init/run |
| `src/overlords/{harvest,upgrade,build}Overlord.ts` | 3 concrete overlords, each delegates to role.* modules |
| `src/role.{harvester,upgrader,builder}.ts` | Role modules with inline Task.load/assignTask pattern |
| `src/hatchery.ts` (57 lines) | Spawn-request queue, priority-sorted |
| `src/task.ts` + `src/tasks.ts` (94+198 lines) | Task base class + 6 concrete tasks (harvest/transfer/upgrade/build/withdraw/drop) |
| `src/creepSetup.ts` (99 lines) | Pattern-based body generator |
| `src/bodyFactory.ts` (76 lines) | Role→CreepSetup registry. **Already has `hauler` profile (unused).** |
| `src/tower.ts` (89 lines) | Flat tower defense module with IFF (3 ally detection mechanisms) |
| `src/layouts/bunker.ts` (65 lines) | Bunker layout RCL 1-4 only |
| `src/roomPlanner.ts` (32 lines) | Places structures from bunker layout, one site/tick |
| `src/cache.ts` (53 lines) | GlobalCache with TTL-cached find* lookups |
| `src/memory.ts` (64 lines) | Mem: CPU bucket gate, GC, heap clean |
| `src/alliance.ts` (127 lines) | Alliance constants, isAlly/isAllyBySign/isAllyByFlag/isFriend |
| `src/comms.ts` | RawMemory segment comms |
| `src/terminal.ts` | Terminal energy sharing |
| `src/production.ts` | MMO hardening: CPU gate, shard awareness |
| `src/priorities.ts` (9 lines) | Priority enum |
| `src/types.d.ts` (43 lines) | CreepMemory augmentation, console, ERR_NOT_DONE, global |

### Key observations for Phase 4

1. **`bodyFactory` already defines a `hauler` CreepSetup** (CARRY/CARRY/MOVE/MOVE, sizeLimit 6) but no HaulerOverlord or LogisticsNetwork uses it. Phase 4 wires this in.
2. **`tower.ts` is a flat module** — SporeCrawler HiveCluster will absorb its logic. The flat `towerDefense.run(room)` call in main.ts gets replaced by `sporeCrawler.refresh(); sporeCrawler.run();`.
3. **Role modules do inline `Task.load`/`assignTask`** — the Zerg wrapper centralizes this. But we must NOT break existing behavior: Zerg wraps the same Task.load + run + clear-on-OK pattern that role files already implement.
4. **Bunker layout stops at RCL4** — we need RCL5-8 entries for storage links, terminals, labs, factories, power spawns, observers.
5. **No Movement module** — all tasks call `creep.moveTo()` directly. The Movement module adds stuck detection and path caching without changing the Task interface.

### Build state

```bash
cd /home/equail/Projects/screeps-scripts
npx tsc -p . --noEmit    # currently passes clean (exit 0)
npm run compile           # produces dist/main.js
```

---

## Task Breakdown

### Task 1: Create HiveCluster base abstraction

**Objective:** Create the abstract HiveCluster class that groups structures by functional responsibility. This is the base for SporeCrawler (towers) and future HiveClusters (CommandCenter, EvolutionChamber).

**Files:**
- Create: `src/hiveClusters/_HiveCluster.ts`

**Step 1: Create the base class**

```typescript
// src/hiveClusters/_HiveCluster.ts
'use strict';

import { Colony } from '../colony';

export abstract class HiveCluster {
    colony: Colony;
    room: Room;
    pos: RoomPosition;
    name: string;
    ref: string;

    constructor(colony: Colony, headStructure: { pos: RoomPosition }, name: string) {
        this.colony = colony;
        this.room = colony.room;
        this.pos = headStructure.pos;
        this.name = name;
        this.ref = `${colony.name}>${name}`;
    }

    abstract refresh(): void;
    abstract init(): void;
    abstract run(): void;
}
```

**Step 2: Verify type-check passes**

Run: `npx tsc -p . --noEmit`
Expected: PASS (no errors — file is new, not imported yet)

**Step 3: Commit**

```bash
git add src/hiveClusters/_HiveCluster.ts
git commit -m "feat: add abstract HiveCluster base class

Adapted from Overmind's _HiveCluster.ts. Groups structures by
functional responsibility (towers, storage, labs) instead of
iterating all structures in a room each tick."
```

---

### Task 2: Implement SporeCrawler HiveCluster (absorb tower.ts)

**Objective:** Wrap the existing tower defense logic into a SporeCrawler HiveCluster. This replaces the flat `towerDefense.run(room)` call in main.ts with an instantiated cluster. The IFF logic (3 ally detection mechanisms) is preserved exactly.

**Files:**
- Create: `src/hiveClusters/sporeCrawler.ts`
- Modify: `src/main.ts` (replace `towerDefense.run(room)` with SporeCrawler instantiation)
- Delete: `src/tower.ts` (after SporeCrawler is wired in and verified)

**Step 1: Create SporeCrawler**

```typescript
// src/hiveClusters/sporeCrawler.ts
'use strict';

import { HiveCluster } from './_HiveCluster';
import { Colony } from '../colony';
import { isAlly, isAllyBySign, isAllyByFlag } from '../alliance';
import { cache } from '../cache';

export class SporeCrawler extends HiveCluster {
    towers: StructureTower[];

    constructor(colony: Colony, primaryTower: StructureTower) {
        super(colony, primaryTower, 'SporeCrawler');
        this.towers = [];
    }

    refresh(): void {
        this.towers = cache.structures<StructureTower>(
            this.room.name + '_towers',
            () => this.room.find<StructureTower>(FIND_MY_STRUCTURES, {
                filter: (s: Structure) => s.structureType === STRUCTURE_TOWER,
            })
        );
    }

    init(): void {
        // Towers don't request creeps — nothing to init.
    }

    run(): void {
        if (this.towers.length === 0) return;

        // --- 1. Attack hostiles (IFF: exclude allies via all 3 mechanisms) ---
        const signAlly = isAllyBySign(this.room);
        const hostiles = this.room.find(FIND_HOSTILE_CREEPS, {
            filter: (c: Creep) =>
                !isAlly(c.owner.username) &&
                !isAllyByFlag(c.owner.username) &&
                c.owner.username !== signAlly,
        });

        if (hostiles.length > 0) {
            for (const tower of this.towers) {
                const target = tower.pos.findClosestByRange(hostiles);
                if (target) tower.attack(target);
            }
            return;
        }

        // --- 2. Heal damaged creeps (ours + allies) ---
        const damagedMyCreeps = this.room.find(FIND_MY_CREEPS, {
            filter: (c: Creep) => c.hits < c.hitsMax,
        });
        const damagedAlliedCreeps = this.room.find(FIND_HOSTILE_CREEPS, {
            filter: (c: Creep) =>
                (isAlly(c.owner.username) ||
                 isAllyByFlag(c.owner.username) ||
                 c.owner.username === signAlly) &&
                c.hits < c.hitsMax,
        });
        const healTargets = [...damagedMyCreeps, ...damagedAlliedCreeps];

        if (healTargets.length > 0) {
            healTargets.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
            for (const tower of this.towers) {
                tower.heal(healTargets[0]);
            }
            return;
        }

        // --- 3. Repair damaged structures (non-wall/rampart) ---
        // Gate: only repair if tower energy > 50% to conserve for defense.
        const damagedStructures = this.room.find(FIND_STRUCTURES, {
            filter: (s: Structure) =>
                s.hits < s.hitsMax &&
                s.structureType !== STRUCTURE_WALL &&
                s.structureType !== STRUCTURE_RAMPART,
        });

        if (damagedStructures.length > 0) {
            damagedStructures.sort((a, b) => a.hits / a.hitsMax - b.hits / a.hitsMax);
            const target = damagedStructures[0];
            for (const tower of this.towers) {
                const energy = tower.store[RESOURCE_ENERGY] || 0;
                const capacity = tower.store.getCapacity(RESOURCE_ENERGY);
                if (capacity > 0 && energy > capacity * 0.5) {
                    tower.repair(target);
                }
            }
        }
    }
}
```

**Step 2: Wire into main.ts**

Replace the flat tower loop in `src/main.ts`:

```typescript
// REMOVE this block:
// for (const roomName in Game.rooms) {
//     const room = Game.rooms[roomName];
//     if (room.controller && room.controller.my) {
//         towerDefense.run(room);
//     }
// }

// ADD inside the per-colony loop, before overlord init:
import { SporeCrawler } from './hiveClusters/sporeCrawler';

// After colony is built, before overlords:
const primaryTower = colony.room.find<StructureTower>(FIND_MY_STRUCTURES, {
    filter: (s: Structure) => s.structureType === STRUCTURE_TOWER,
})[0];
if (primaryTower) {
    const sporeCrawler = new SporeCrawler(colony, primaryTower);
    sporeCrawler.refresh();
    sporeCrawler.run();
}
```

Also remove `import { towerDefense } from './tower';` from main.ts.

**Step 3: Delete tower.ts**

```bash
git rm src/tower.ts
```

**Step 4: Verify type-check and bundle pass**

Run: `npx tsc -p . --noEmit`
Expected: PASS

Run: `npm run compile`
Expected: `dist/main.js` produced, contains SporeCrawler references

Run: `grep -c "SporeCrawler" dist/main.js`
Expected: ≥1

**Step 5: Commit**

```bash
git add src/hiveClusters/sporeCrawler.ts src/main.ts
git commit -m "refactor: wrap tower logic in SporeCrawler HiveCluster

Absorbs flat tower.ts into a HiveCluster class. IFF logic
(3 ally detection mechanisms) preserved exactly. Tower
lookups now use GlobalCache instead of raw find() each tick."
```

---

### Task 3: Create LogisticsNetwork for hauler energy routing

**Objective:** Decouple energy producers (containers, storage, dropped resources) from consumers (spawns, extensions, towers) using a request/provide registry. Haulers query the network for the best task matching their carry state.

**Files:**
- Create: `src/logistics/LogisticsNetwork.ts`

**Step 1: Create LogisticsNetwork**

```typescript
// src/logistics/LogisticsNetwork.ts
'use strict';

import { Colony } from '../colony';

export enum LogisticsPriority {
    High = 0,
    Normal = 1,
    Low = 2,
}

export interface LogisticsRequest {
    id: string;
    target: Structure | Tombstone | Ruin | Resource;
    amount: number;
    resourceType: ResourceConstant;
    priority: LogisticsPriority;
    type: 'provide' | 'request'; // provide = has energy to give; request = needs energy
}

export class LogisticsNetwork {
    colony: Colony;
    requests: LogisticsRequest[];

    constructor(colony: Colony) {
        this.colony = colony;
        this.requests = [];
    }

    refresh(): void {
        this.requests = [];
        this.autoRegister();
    }

    // Register infrastructure nodes that need energy or have energy to give.
    registerRequest(
        target: Structure | Tombstone | Ruin | Resource,
        type: 'provide' | 'request',
        amount: number,
        priority: LogisticsPriority = LogisticsPriority.Normal,
        resource: ResourceConstant = RESOURCE_ENERGY,
    ): void {
        this.requests.push({
            id: (target as any).id || '',
            target,
            amount,
            resourceType: resource,
            priority,
            type,
        });
    }

    // Auto-scan the room for common provide/request nodes.
    private autoRegister(): void {
        const room = this.colony.room;

        // --- PROVIDE: dropped resources ---
        const dropped = room.find(FIND_DROPPED_RESOURCES, {
            filter: (r: Resource) => r.resourceType === RESOURCE_ENERGY && r.amount > 50,
        });
        for (const r of dropped) {
            this.registerRequest(r, 'provide', r.amount, LogisticsPriority.High);
        }

        // --- PROVIDE: tombstones with energy ---
        const tombstones = room.find(FIND_TOMBSTONES, {
            filter: (t: Tombstone) => (t.store[RESOURCE_ENERGY] || 0) > 50,
        });
        for (const t of tombstones) {
            this.registerRequest(t, 'provide', t.store[RESOURCE_ENERGY] || 0, LogisticsPriority.High);
        }

        // --- PROVIDE: containers with energy (mining containers) ---
        const containers = room.find<StructureContainer>(FIND_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER &&
                (s as StructureContainer).store[RESOURCE_ENERGY] > 100,
        });
        for (const c of containers) {
            this.registerRequest(c, 'provide', c.store[RESOURCE_ENERGY], LogisticsPriority.Normal);
        }

        // --- REQUEST: spawns and extensions needing energy ---
        const spawns = room.find(FIND_MY_STRUCTURES, {
            filter: (s: Structure) =>
                (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                (s as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0,
        });
        for (const s of spawns) {
            const free = (s as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY);
            this.registerRequest(s, 'request', free, LogisticsPriority.High);
        }

        // --- REQUEST: towers below 60% energy ---
        const towers = room.find<StructureTower>(FIND_MY_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_TOWER,
        });
        for (const t of towers) {
            const energy = t.store[RESOURCE_ENERGY] || 0;
            const capacity = t.store.getCapacity(RESOURCE_ENERGY);
            if (capacity > 0 && energy < capacity * 0.6) {
                this.registerRequest(t, 'request', capacity - energy, LogisticsPriority.Normal);
            }
        }

        // --- REQUEST: storage (low priority sink for excess energy) ---
        if (room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            this.registerRequest(
                room.storage, 'request',
                room.storage.store.getFreeCapacity(RESOURCE_ENERGY),
                LogisticsPriority.Low,
            );
        }
    }

    // Pair a hauler to the best destination matching its carry state.
    // Full hauler → find a 'request' node. Empty hauler → find a 'provide' node.
    getBestRequest(hauler: Creep): LogisticsRequest | null {
        const isFull = hauler.store.getFreeCapacity() === 0;
        const hasSome = hauler.store[RESOURCE_ENERGY] > 0;
        const targetType = isFull ? 'request' : 'provide';

        const valid = this.requests.filter(r => r.type === targetType && r.amount > 0);

        // If hauler is partially full, prefer matching its current state:
        // has some energy → can still deliver to a request node.
        if (!isFull && hasSome && targetType === 'provide') {
            const requests = this.requests.filter(r => r.type === 'request' && r.amount > 0);
            if (requests.length > 0) {
                requests.sort((a, b) => {
                    if (a.priority !== b.priority) return a.priority - b.priority;
                    return hauler.pos.getRangeTo(a.target.pos) - hauler.pos.getRangeTo(b.target.pos);
                });
                return requests[0];
            }
        }

        if (valid.length === 0) return null;

        valid.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return hauler.pos.getRangeTo(a.target.pos) - hauler.pos.getRangeTo(b.target.pos);
        });

        return valid[0];
    }
}
```

**Step 2: Verify type-check passes**

Run: `npx tsc -p . --noEmit`
Expected: PASS (not imported yet, but should compile standalone)

**Step 3: Commit**

```bash
git add src/logistics/LogisticsNetwork.ts
git commit -m "feat: add LogisticsNetwork for hauler energy routing

Decouples energy producers (containers, dropped resources, tombstones)
from consumers (spawns, extensions, towers, storage) via a
provide/request registry. Haulers query for best task by priority
and distance. Auto-registers common room nodes each tick."
```

---

### Task 4: Create HaulerOverlord using LogisticsNetwork

**Objective:** Create an overlord that spawns haulers (using the existing `hauler` bodyFactory profile) and routes them via the LogisticsNetwork. This activates the hauler role that was defined in bodyFactory but never used.

**Files:**
- Create: `src/overlords/haulOverlord.ts`
- Modify: `src/main.ts` (add LogisticsNetwork + HaulerOverlord to colony loop)
- Modify: `src/types.d.ts` (add `_moveData` to CreepMemory for Movement module)

**Step 1: Create HaulerOverlord**

```typescript
// src/overlords/haulOverlord.ts
'use strict';

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';
import { LogisticsNetwork, LogisticsRequest } from '../logistics/LogisticsNetwork';
import { Task } from '../task';
import { Tasks } from '../tasks';

export class HaulerOverlord extends Overlord {
    logistics: LogisticsNetwork;

    constructor(colony: Colony, logistics: LogisticsNetwork) {
        super(colony, 'haul', Priority.NormalHigh);
        this.logistics = logistics;
    }

    init(hatchery: Hatchery): void {
        // Only spawn haulers if we have storage or containers (RCL4+).
        const hasStorage = !!this.colony.storage;
        const hasContainers = this.colony.room.find(FIND_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER,
        }).length > 0;

        if (!hasStorage && !hasContainers) return;

        // Scale hauler count with structure load: 1 per container, min 2.
        const containerCount = this.colony.room.find(FIND_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER,
        }).length;
        const count = Math.max(2, containerCount);
        this.requestCreep(hatchery, { role: 'hauler' } as any, 'hauler', count);
    }

    run(): void {
        const haulers = this.creeps['hauler'] || [];
        for (const creep of haulers) {
            let task = Task.load(creep);

            if (!task) {
                task = this.assignTask(creep);
                if (task) {
                    creep.memory.task = task.save();
                }
            }

            if (task) {
                const result = task.run(creep);
                if (result === OK || result === ERR_INVALID_TARGET) {
                    creep.memory.task = null;
                }
            }
        }
    }

    assignTask(creep: Creep): Task | null {
        const request = this.logistics.getBestRequest(creep);
        if (!request) return null;

        const target = request.target;

        if (request.type === 'provide') {
            // Withdraw energy from the provider.
            if (target instanceof Resource) {
                // Dropped resource — use pickup
                return this.createPickupTask(target);
            }
            return Tasks.withdraw(target as Structure, RESOURCE_ENERGY);
        } else {
            // Transfer energy to the consumer.
            return Tasks.transfer(target as Structure, RESOURCE_ENERGY);
        }
    }

    // For dropped resources, we need a pickup task — but our Task system
    // doesn't have one yet. Use withdraw on the position's resource via
    // a simple moveTo + pickup inline. For now, use transfer task to
    // move near and the hauler will pick up next tick when re-assigned.
    // Better: add a TaskPickup class to tasks.ts (see Task 5).
    createPickupTask(target: Resource): Task | null {
        // Fallback: move to the resource. Next tick, if adjacent, withdraw
        // won't work on resources. We need a pickup task.
        // For now, return null and let the hauler idle — Task 5 adds pickup.
        return null;
    }
}
```

**Step 2: Add TaskPickup to tasks.ts**

Add to `src/tasks.ts` (before the `Tasks` factory):

```typescript
// --- Pickup task (for dropped resources) ---
class TaskPickup extends Task {
    constructor(target: Resource) {
        super('pickup', target);
        this.settings.range = 1;
    }

    run(creep: Creep): number {
        const target = this.getTarget() as Resource | null;
        if (!target) return ERR_INVALID_TARGET;
        if (creep.pos.inRangeTo(target, 1)) {
            const result = creep.pickup(target);
            if (result === OK || creep.store.getFreeCapacity() === 0) {
                return OK;
            }
            return result === OK ? ERR_NOT_DONE : result;
        }
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
        return ERR_NOT_IN_RANGE;
    }

    static fromMemory(saved: SavedTask): TaskPickup {
        const task = Object.create(TaskPickup.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('pickup', TaskPickup);
```

Add to the `Tasks` factory:

```typescript
    pickup: (target: Resource) => new TaskPickup(target),
```

**Step 3: Update HaulerOverlord to use TaskPickup**

Replace the `createPickupTask` method:

```typescript
    createPickupTask(target: Resource): Task | null {
        return Tasks.pickup(target);
    }
```

**Step 4: Wire into main.ts**

In the per-colony loop, after SporeCrawler and before overlords:

```typescript
import { LogisticsNetwork } from './logistics/LogisticsNetwork';
import { HaulerOverlord } from './overlords/haulOverlord';

// After colony is built:
const logistics = new LogisticsNetwork(colony);
logistics.refresh();

// Add to overlords array:
const overlords: Overlord[] = [
    new HarvestOverlord(colony),
    new HaulerOverlord(colony, logistics),
];
```

**Step 5: Update types.d.ts for hauler memory**

Add to the CreepMemory interface in `src/types.d.ts`:

```typescript
interface CreepMemory {
    role?: string;
    colony?: string;
    overlord?: string;
    delivering?: boolean;
    upgrading?: boolean;
    building?: boolean;
    task?: any;
    _moveData?: { lastPos?: { x: number; y: number; roomName: string }; stuckCount?: number };
}
```

**Step 6: Verify type-check and bundle**

Run: `npx tsc -p . --noEmit`
Expected: PASS

Run: `npm run compile`
Expected: `dist/main.js` with HaulerOverlord + LogisticsNetwork + TaskPickup

Run: `grep -c "HaulerOverlord\|LogisticsNetwork\|TaskPickup" dist/main.js`
Expected: ≥3

**Step 7: Commit**

```bash
git add src/overlords/haulOverlord.ts src/tasks.ts src/main.ts src/types.d.ts
git commit -m "feat: add HaulerOverlord with LogisticsNetwork routing

Spawns haulers (existing bodyFactory profile) and routes them
via LogisticsNetwork. Adds TaskPickup for dropped resources.
Only activates at RCL4+ (storage or containers present). Hauler
count scales with container count, min 2."
```

---

### Task 5: Create Zerg creep wrapper

**Objective:** Wrap creeps in a Zerg class that centralizes the Task.load → run → clear-on-OK pattern. Overlords will use Zerg objects instead of raw Creep objects. This is a thin wrapper — it doesn't change behavior, just centralizes the pattern.

**Files:**
- Create: `src/zerg/Zerg.ts`

**Step 1: Create Zerg**

```typescript
// src/zerg/Zerg.ts
'use strict';

import { Task } from '../task';

export class Zerg {
    creep: Creep;
    name: string;
    pos: RoomPosition;
    body: BodyPartDefinition[];
    store: StoreDefinition;
    memory: CreepMemory;

    constructor(creep: Creep) {
        this.creep = creep;
        this.name = creep.name;
        this.pos = creep.pos;
        this.body = creep.body;
        this.store = creep.store;
        this.memory = creep.memory;
    }

    get task(): Task | null {
        return Task.load(this.creep);
    }

    set task(newTask: Task | null) {
        if (!newTask) {
            this.creep.memory.task = null;
        } else {
            this.creep.memory.task = newTask.save();
        }
    }

    // Execute the current task. Returns the task result code.
    // Clears the task on OK or ERR_INVALID_TARGET.
    executeTask(): number | null {
        const activeTask = this.task;
        if (!activeTask) return null;

        const result = activeTask.run(this.creep);
        if (result === OK || result === ERR_INVALID_TARGET) {
            this.task = null;
        }
        return result;
    }

    // Shorthand movement wrappers (delegates to Movement module when available).
    move(direction: DirectionConstant): number {
        return this.creep.move(direction);
    }

    moveToPos(targetPos: RoomPosition): number {
        return this.creep.moveTo(targetPos, {
            maxOps: 2000,
            visualizePathStyle: { stroke: '#ff00ff' },
        });
    }
}
```

**Step 2: Verify type-check passes**

Run: `npx tsc -p . --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/zerg/Zerg.ts
git commit -m "feat: add Zerg creep wrapper class

Wraps native Creep with centralized task pipeline (load → run →
clear-on-OK). Overlords will use Zerg objects instead of raw Creep.
Thin wrapper — preserves all existing behavior, just centralizes
the Task.load/assignTask pattern currently duplicated in role files."
```

---

### Task 6: Create Movement system with stuck detection

**Objective:** Add a Movement module with stuck detection. When a creep hasn't moved for 3+ ticks, it re-paths with `ignoreCreeps: false` to route around other creeps. Normal movement uses `ignoreCreeps: true` for CPU savings.

**Files:**
- Create: `src/movement/Movement.ts`

**Step 1: Create Movement**

```typescript
// src/movement/Movement.ts
'use strict';

interface MovementData {
    lastPos?: { x: number; y: number; roomName: string };
    stuckCount?: number;
}

export class Movement {
    // Move a creep toward a target position with stuck detection.
    // range: how close the creep needs to be to be "done" (default 1).
    static move(creep: Creep, target: RoomPosition, range = 1): number {
        // Already in range — done.
        if (creep.pos.inRangeTo(target, range)) return OK;

        const mem = creep.memory;
        if (!mem._moveData) mem._moveData = {};
        const data = mem._moveData as MovementData;

        // Stuck detection: if position hasn't changed, increment counter.
        if (
            data.lastPos &&
            creep.pos.x === data.lastPos.x &&
            creep.pos.y === data.lastPos.y &&
            creep.pos.roomName === data.lastPos.roomName
        ) {
            data.stuckCount = (data.stuckCount || 0) + 1;
        } else {
            data.stuckCount = 0;
        }

        data.lastPos = {
            x: creep.pos.x,
            y: creep.pos.y,
            roomName: creep.pos.roomName,
        };

        // If stuck for > 3 ticks, re-path around creeps.
        if (data.stuckCount && data.stuckCount > 3) {
            return creep.moveTo(target, {
                ignoreCreeps: false,
                visualizePathStyle: { stroke: '#ff0000' },
            });
        }

        // Normal pathing: ignore creeps (cheaper, reuses cached path).
        return creep.moveTo(target, {
            ignoreCreeps: true,
            visualizePathStyle: { stroke: '#00ff00' },
        });
    }
}
```

**Step 2: Verify type-check passes**

Run: `npx tsc -p . --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/movement/Movement.ts
git commit -m "feat: add Movement system with stuck detection

Normal pathing uses ignoreCreeps:true (CPU-cheap, cached).
After 3 ticks stuck, re-paths with ignoreCreeps:false to route
around other creeps. Tracks last position in creep.memory._moveData."
```

---

### Task 7: Integrate Movement into Task system

**Objective:** Replace direct `creep.moveTo()` calls in tasks with `Movement.move()` so all task movement benefits from stuck detection. This is a small, surgical change to `tasks.ts`.

**Files:**
- Modify: `src/tasks.ts` (replace `creep.moveTo` with `Movement.move` in all 7 task classes)

**Step 1: Add import and replace moveTo calls**

At the top of `src/tasks.ts`, add:

```typescript
import { Movement } from './movement/Movement';
```

Replace every `creep.moveTo(target, { visualizePathStyle: ... })` call in the 7 task classes with:

```typescript
Movement.move(creep, target.pos || target, this.settings.range);
```

For tasks where `target` is a RoomObject (Source, Structure, ConstructionSite, etc.), use `target.pos`. For TaskDrop where the target is a position, use `target.pos` directly.

The specific replacements:

- **TaskHarvest**: `Movement.move(creep, target.pos, 1);` (was `creep.moveTo(target, ...)`)
- **TaskTransfer**: `Movement.move(creep, target.pos, 1);`
- **TaskUpgrade**: `Movement.move(creep, target.pos, 3);`
- **TaskBuild**: `Movement.move(creep, target.pos, 3);`
- **TaskWithdraw**: `Movement.move(creep, target.pos, 1);`
- **TaskDrop**: `Movement.move(creep, this.targetPos!, 0);` (uses targetPos getter)
- **TaskPickup**: `Movement.move(creep, target.pos, 1);`

**Step 2: Verify type-check and bundle**

Run: `npx tsc -p . --noEmit`
Expected: PASS

Run: `npm run compile`
Expected: `dist/main.js` with `Movement` references

Run: `grep -c "Movement" dist/main.js`
Expected: ≥3 (class def + move calls)

**Step 3: Commit**

```bash
git add src/tasks.ts
git commit -m "refactor: route all task movement through Movement module

Replaces direct creep.moveTo() in all 7 task classes with
Movement.move() for stuck detection and consistent pathing.
No behavior change for unstuck creeps — stuck creeps now
auto-repath after 3 ticks."
```

---

### Task 8: Extend bunker layout to RCL 5-8

**Objective:** Add structure coordinates for RCL 5-8 to the bunker layout so RoomPlanner can place links, terminals, labs, factories, power spawns, and observers as the room levels up.

**Files:**
- Modify: `src/layouts/bunker.ts`

**Step 1: Add RCL 5-8 entries**

Append to the `bunkerLayout` object in `src/layouts/bunker.ts`:

```typescript
    5: {
        buildings: {
            spawn: [{ x: 29, y: 25 }],
            extension: [
                // RCL4 extensions (carried forward) + 10 more
                { x: 28, y: 26 }, { x: 29, y: 27 }, { x: 28, y: 27 },
                { x: 27, y: 27 }, { x: 27, y: 28 }, { x: 28, y: 28 },
                { x: 29, y: 28 }, { x: 28, y: 29 }, { x: 27, y: 29 },
                { x: 29, y: 26 }, { x: 26, y: 27 }, { x: 26, y: 28 },
                { x: 29, y: 29 }, { x: 27, y: 26 }, { x: 30, y: 27 },
                { x: 30, y: 28 }, { x: 26, y: 29 }, { x: 30, y: 29 },
                { x: 27, y: 30 }, { x: 29, y: 30 },
                // 10 new for RCL5
                { x: 25, y: 27 }, { x: 26, y: 26 }, { x: 24, y: 26 },
                { x: 24, y: 27 }, { x: 25, y: 28 }, { x: 26, y: 30 },
                { x: 28, y: 30 }, { x: 30, y: 30 }, { x: 31, y: 28 },
                { x: 31, y: 29 },
            ],
            tower: [{ x: 25, y: 26 }, { x: 26, y: 25 }],
            link: [{ x: 25, y: 25 }],       // core hub link near storage
            storage: [{ x: 24, y: 25 }],
            container: [{ x: 27, y: 30 }],
        },
    },

    6: {
        buildings: {
            spawn: [{ x: 29, y: 25 }],
            extension: [
                // RCL5 set + 10 more (20 total new at RCL6)
                { x: 25, y: 27 }, { x: 26, y: 26 }, { x: 24, y: 26 },
                { x: 24, y: 27 }, { x: 25, y: 28 }, { x: 26, y: 30 },
                { x: 28, y: 30 }, { x: 30, y: 30 }, { x: 31, y: 28 },
                { x: 31, y: 29 },
                { x: 23, y: 27 }, { x: 23, y: 28 }, { x: 24, y: 28 },
                { x: 25, y: 29 }, { x: 27, y: 31 }, { x: 31, y: 30 },
                { x: 32, y: 28 }, { x: 32, y: 29 }, { x: 32, y: 30 },
                { x: 31, y: 31 },
            ],
            tower: [{ x: 25, y: 26 }, { x: 26, y: 25 }],
            link: [{ x: 25, y: 25 }],
            storage: [{ x: 24, y: 25 }],
            container: [{ x: 27, y: 30 }],
            terminal: [{ x: 26, y: 24 }],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
            ],
            extractor: [],   // placed at mineral position dynamically
        },
    },

    7: {
        buildings: {
            spawn: [{ x: 29, y: 25 }, { x: 25, y: 29 }],
            extension: [
                // RCL6 set + 10 more
                { x: 23, y: 27 }, { x: 23, y: 28 }, { x: 24, y: 28 },
                { x: 25, y: 29 }, { x: 27, y: 31 }, { x: 31, y: 30 },
                { x: 32, y: 28 }, { x: 32, y: 29 }, { x: 32, y: 30 },
                { x: 31, y: 31 },
                { x: 23, y: 26 }, { x: 24, y: 24 }, { x: 25, y: 24 },
                { x: 26, y: 23 }, { x: 27, y: 24 }, { x: 28, y: 23 },
                { x: 33, y: 28 }, { x: 33, y: 29 }, { x: 33, y: 30 },
                { x: 32, y: 31 },
            ],
            tower: [{ x: 25, y: 26 }, { x: 26, y: 25 }, { x: 23, y: 26 }, { x: 26, y: 23 }],
            link: [{ x: 25, y: 25 }],
            storage: [{ x: 24, y: 25 }],
            container: [{ x: 27, y: 30 }],
            terminal: [{ x: 26, y: 24 }],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
                { x: 21, y: 22 }, { x: 22, y: 21 }, { x: 21, y: 21 },
            ],
            factory: [{ x: 25, y: 23 }],
        },
    },

    8: {
        buildings: {
            spawn: [{ x: 29, y: 25 }, { x: 25, y: 29 }, { x: 24, y: 24 }],
            extension: [
                // Full set (60 extensions at RCL8) — cumulative from RCL7
                { x: 23, y: 27 }, { x: 23, y: 28 }, { x: 24, y: 28 },
                { x: 25, y: 29 }, { x: 27, y: 31 }, { x: 31, y: 30 },
                { x: 32, y: 28 }, { x: 32, y: 29 }, { x: 32, y: 30 },
                { x: 31, y: 31 },
                { x: 23, y: 26 }, { x: 24, y: 24 }, { x: 25, y: 24 },
                { x: 26, y: 23 }, { x: 27, y: 24 }, { x: 28, y: 23 },
                { x: 33, y: 28 }, { x: 33, y: 29 }, { x: 33, y: 30 },
                { x: 32, y: 31 },
            ],
            tower: [
                { x: 25, y: 26 }, { x: 26, y: 25 }, { x: 23, y: 26 },
                { x: 26, y: 23 }, { x: 22, y: 25 }, { x: 25, y: 22 },
            ],
            link: [{ x: 25, y: 25 }],
            storage: [{ x: 24, y: 25 }],
            container: [{ x: 27, y: 30 }],
            terminal: [{ x: 26, y: 24 }],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
                { x: 21, y: 22 }, { x: 22, y: 21 }, { x: 21, y: 21 },
            ],
            factory: [{ x: 25, y: 23 }],
            powerSpawn: [{ x: 23, y: 23 }],
            observer: [{ x: 25, y: 21 }],
        },
    },
```

**Step 2: Verify type-check and bundle**

Run: `npx tsc -p . --noEmit`
Expected: PASS

Run: `npm run compile`
Expected: `dist/main.js` with RCL5-8 layout data

Run: `grep -c "powerSpawn\|observer\|factory\|terminal" dist/main.js`
Expected: ≥4

**Step 3: Commit**

```bash
git add src/layouts/bunker.ts
git commit -m "feat: extend bunker layout to RCL 5-8

Adds coordinates for links (RCL5), terminals + labs (RCL6),
factories (RCL7), power spawns + observers (RCL8). RoomPlanner
will place these as the room levels up. Extractor position is
dynamic (mineral-dependent) so left empty."
```

---

### Task 9: Create RoomVisual dashboard (visualizer)

**Objective:** Add a visualizer that renders a dashboard using the RoomVisual API: CPU/bucket/GCL progress bars, creep role counts, hatchery energy, storage/terminal fill, lab status. Rendered client-side (zero server CPU cost for drawing, but data collection costs CPU — use cached arrays).

**Files:**
- Create: `src/visualizer.ts`

**Step 1: Create visualizer**

```typescript
// src/visualizer.ts
'use strict';

// RoomVisual dashboard using Screeps' RoomVisual API.
// Rendering is client-side (zero server CPU), but data collection
// (room.find, scanning arrays) costs CPU — pull from existing caches.

const VisualizerHelpers = {
    drawProgressBar(
        visual: RoomVisual, x: number, y: number, width: number,
        label: string, current: number, max: number, suffix = '%',
    ): void {
        const pct = Math.min(Math.max(current / max, 0), 1);
        // Background panel
        visual.rect(x, y, width, 1.2, {
            fill: 'rgba(0,0,0,0.4)', stroke: '#555555', strokeWidth: 0.05,
        });
        // Label
        visual.text(label, x + 0.3, y + 0.85, {
            font: '0.7 monospace', align: 'left', color: '#cccccc',
        });
        // Inner fill bar
        const barWidth = width * 0.4;
        const barX = x + width - barWidth - 0.3;
        visual.rect(barX, y + 0.2, barWidth, 0.8, { fill: '#333333' });
        visual.rect(barX, y + 0.2, barWidth * pct, 0.8, {
            fill: this.getColorByPct(pct),
        });
        // Value text
        visual.text(`${Math.round(current)}${suffix}`, barX + barWidth / 2, y + 0.8, {
            font: '0.6 monospace', align: 'center', color: '#ffffff',
        });
    },

    drawRow(
        visual: RoomVisual, x: number, y: number, width: number,
        key: string, value: string, color = '#ffffff',
    ): void {
        visual.text(key, x + 0.3, y + 0.7, {
            font: '0.7 monospace', align: 'left', color: '#cccccc',
        });
        visual.text(value, x + width - 0.3, y + 0.7, {
            font: '0.7 monospace', align: 'right', color,
        });
    },

    getColorByPct(pct: number): string {
        if (pct > 0.75) return '#55ff55';
        if (pct > 0.30) return '#ffcc00';
        return '#ff5555';
    },
};

export const visualizer = {
    run(room: Room): void {
        const visual = room.visual;
        let x = 1;
        let y = 1;
        const w = 7.5;

        // --- 1. Global info panel ---
        visual.rect(x, y, w, 4.2, {
            fill: 'rgba(0,0,0,0.3)', stroke: '#777777', strokeWidth: 0.05,
        });
        VisualizerHelpers.drawProgressBar(visual, x, y + 0.2, w, 'CPU', Game.cpu.getUsed(), Game.cpu.limit);
        VisualizerHelpers.drawProgressBar(visual, x, y + 1.5, w, 'BKT', Game.cpu.bucket, 10000, '');
        if (Game.gcl.progressTotal > 0) {
            VisualizerHelpers.drawProgressBar(visual, x, y + 2.8, w, 'GCL', Game.gcl.progress, Game.gcl.progressTotal);
        }
        y += 4.6;

        visual.text(
            `Colonies: ${Object.keys(Game.rooms).length} | Creeps: ${Object.keys(Game.creeps).length}`,
            x, y,
            { font: '0.6 monospace', align: 'left', color: '#aaaaaa' },
        );
        y += 1.0;

        // --- 2. Creep role panel ---
        visual.rect(x, y, w, 0.8, { fill: '#333333' });
        visual.text(`${room.name} Creeps`, x + 0.3, y + 0.6, {
            font: 'bold 0.6 monospace', align: 'left', color: '#ffffff',
        });
        y += 0.8;

        const creepRoles = this.getCreepCounts(room);
        visual.rect(x, y, w, creepRoles.length * 0.9, {
            fill: 'rgba(0,0,0,0.4)', stroke: '#555555', strokeWidth: 0.05,
        });
        for (const role of creepRoles) {
            const color = role.current < role.target ? '#ffcc00' : '#ffffff';
            VisualizerHelpers.drawRow(visual, x, y, w, role.name, `${role.current}/${role.target}`, color);
            y += 0.9;
        }
        y += 0.4;

        // --- 3. Hatchery panel ---
        visual.rect(x, y, w, 0.8, { fill: '#333333' });
        visual.text(`${room.name} Hatchery`, x + 0.3, y + 0.6, {
            font: 'bold 0.6 monospace', align: 'left', color: '#ffffff',
        });
        y += 0.8;

        visual.rect(x, y, w, 1 * 0.9, {
            fill: 'rgba(0,0,0,0.4)', stroke: '#555555', strokeWidth: 0.05,
        });
        VisualizerHelpers.drawRow(visual, x, y, w, 'Energy', `${room.energyAvailable}/${room.energyCapacityAvailable}`);
        y += 0.9;
        y += 0.4;

        // --- 4. Command center (storage / terminal) ---
        if (room.storage || room.terminal) {
            visual.rect(x, y, w, 0.8, { fill: '#333333' });
            visual.text(`${room.name} Command Center`, x + 0.3, y + 0.6, {
                font: 'bold 0.6 monospace', align: 'left', color: '#ffffff',
            });
            y += 0.8;

            const rowsCount = (room.storage ? 1 : 0) + (room.terminal ? 1 : 0);
            visual.rect(x, y, w, rowsCount * 0.9, {
                fill: 'rgba(0,0,0,0.4)', stroke: '#555555', strokeWidth: 0.05,
            });
            if (room.storage) {
                const pct = Math.round(
                    (room.storage.store.getUsedCapacity() / room.storage.store.getCapacity()) * 100,
                );
                VisualizerHelpers.drawRow(visual, x, y, w, 'Storage', `${pct}%`);
                y += 0.9;
            }
            if (room.terminal) {
                const pct = Math.round(
                    (room.terminal.store.getUsedCapacity() / room.terminal.store.getCapacity()) * 100,
                );
                VisualizerHelpers.drawRow(visual, x, y, w, 'Terminal', `${pct}%`);
                y += 0.9;
            }
            y += 0.4;
        }

        // --- 5. Evolution chamber (labs) ---
        const labs = room.find<StructureLab>(FIND_MY_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_LAB,
        });
        if (labs.length > 0) {
            visual.rect(x, y, w, 0.8, { fill: '#333333' });
            visual.text(`${room.name} Evolution Chamber`, x + 0.3, y + 0.6, {
                font: 'bold 0.6 monospace', align: 'left', color: '#ffffff',
            });
            y += 0.8;

            visual.rect(x, y, w, 1.8, {
                fill: 'rgba(0,0,0,0.4)', stroke: '#555555', strokeWidth: 0.05,
            });
            VisualizerHelpers.drawRow(visual, x, y, w, 'Labs', `${labs.length}`);
            y += 0.9;
            VisualizerHelpers.drawRow(visual, x, y, w, 'Status', 'IDLE', '#ffcc00');
            y += 0.9;
        }
    },

    getCreepCounts(room: Room): { name: string; current: number; target: number }[] {
        // Count creeps by role in this room's colony.
        const counts: { [role: string]: number } = {};
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.colony === room.name) {
                const role = creep.memory.role || 'unknown';
                counts[role] = (counts[role] || 0) + 1;
            }
        }
        // Target counts (matches main.ts TARGETS + hauler).
        const targets: { [role: string]: number } = {
            harvester: 2,
            upgrader: 1,
            builder: 1,
            hauler: 2,
        };
        const roles = Object.keys(targets);
        return roles.map(r => ({
            name: r,
            current: counts[r] || 0,
            target: targets[r],
        }));
    },
};
```

**Step 2: Wire into main.ts**

In the per-colony loop, at the end (after overlord run):

```typescript
import { visualizer } from './visualizer';

// At the end of the per-colony loop:
visualizer.run(colony.room);
```

**Step 3: Verify type-check and bundle**

Run: `npx tsc -p . --noEmit`
Expected: PASS

Run: `npm run compile`
Expected: `dist/main.js` with visualizer code

Run: `grep -c "visualizer\|RoomVisual" dist/main.js`
Expected: ≥2

**Step 4: Commit**

```bash
git add src/visualizer.ts src/main.ts
git commit -m "feat: add RoomVisual dashboard visualizer

Renders CPU/bucket/GCL progress bars, creep role counts,
hatchery energy, storage/terminal fill rates, and lab status.
Client-side rendering (zero server CPU for drawing). Data
collection uses cached creep counts, not redundant room.find."
```

---

### Task 10: Full main.ts integration and final verification

**Objective:** Ensure all Phase 4 modules are wired into main.ts in the correct order, the build passes clean, and the bundle contains all new modules.

**Files:**
- Modify: `src/main.ts` (final integration pass)

**Step 1: Review final main.ts structure**

The per-colony loop should now be:

```typescript
// 1. Mem init + CPU gate (existing)
// 2. Alliance: getFlagAllies() (existing)
// 3. Comms + terminal (existing)
// 4. Per-colony loop:
//    a. roomPlanner.plan() (existing, CPU-gated)
//    b. SporeCrawler: refresh + run (NEW — replaces flat towerDefense)
//    c. LogisticsNetwork: refresh (NEW)
//    d. Build overlords: Harvest + Hauler + Upgrade + Build (NEW: Hauler added)
//    e. Hatchery: init + run (existing)
//    f. Overlords: refresh + init + run (existing pattern)
//    g. visualizer.run() (NEW)
```

**Step 2: Verify the full build**

Run: `npx tsc -p . --noEmit`
Expected: PASS (exit 0)

Run: `npm run compile`
Expected: `dist/main.js` produced

Run these verification commands:

```bash
grep -c "SporeCrawler" dist/main.js           # Expected: ≥2
grep -c "LogisticsNetwork" dist/main.js       # Expected: ≥2
grep -c "HaulerOverlord" dist/main.js          # Expected: ≥2
grep -c "Zerg" dist/main.js                    # Expected: ≥1 (class def)
grep -c "Movement" dist/main.js                # Expected: ≥3
grep -c "TaskPickup" dist/main.js              # Expected: ≥2
grep -c "visualizer" dist/main.js              # Expected: ≥2
grep -c "powerSpawn" dist/main.js              # Expected: ≥1 (RCL8 layout)
```

**Step 3: Deploy to private server and verify**

Copy `dist/main.js` to the Steam client's watch directory.

Verify over 100+ ticks:
- [ ] No `console.log` errors in game console
- [ ] Creeps spawn and function (harvest, upgrade, build, haul)
- [ ] Towers fire on hostiles, heal allies, repair structures (SporeCrawler)
- [ ] Haulers pick up from containers/dropped resources, deliver to spawns/extensions
- [ ] Stuck creeps re-path after 3 ticks (watch for red path lines)
- [ ] RoomVisual dashboard renders on left side of owned rooms
- [ ] RCL5+ room places link/terminal/lab construction sites
- [ ] CPU bucket stays > 5000 after 200 ticks

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: integrate Phase 4 modules into main loop

SporeCrawler (tower HiveCluster), LogisticsNetwork + HaulerOverlord,
Movement system, and visualizer all wired into per-colony loop.
Order: plan → sporeCrawler → logistics → overlords → hatchery →
overlords.run → visualizer."
```

---

## Files Created/Modified Summary

### New files (7)
- `src/hiveClusters/_HiveCluster.ts` — abstract base class
- `src/hiveClusters/sporeCrawler.ts` — tower HiveCluster (absorbs tower.ts)
- `src/logistics/LogisticsNetwork.ts` — energy routing registry
- `src/overlords/haulOverlord.ts` — hauler spawning + logistics routing
- `src/zerg/Zerg.ts` — creep wrapper with task pipeline
- `src/movement/Movement.ts` — stuck detection pathing
- `src/visualizer.ts` — RoomVisual dashboard

### Modified files (4)
- `src/main.ts` — SporeCrawler, LogisticsNetwork, HaulerOverlord, visualizer wiring
- `src/tasks.ts` — add TaskPickup, route movement through Movement module
- `src/layouts/bunker.ts` — RCL 5-8 layout entries
- `src/types.d.ts` — add `_moveData` to CreepMemory

### Deleted files (1)
- `src/tower.ts` — absorbed into SporeCrawler

---

## Risks and Tradeoffs

### Risk: SporeCrawler refactoring breaks tower defense
**Mitigation:** SporeCrawler preserves the exact IFF logic (3 ally detection mechanisms) from tower.ts. The only change is structural (class vs flat module) and caching (uses cache.structures instead of raw find). Verify on private server with a hostile creep test.

### Risk: LogisticsNetwork auto-register scans every tick (CPU cost)
**Mitigation:** Auto-register uses `room.find()` which is relatively cheap in owned rooms. The scan only runs for rooms with storage/containers (RCL4+). If CPU is a concern, gate the refresh on `Game.time % 5 === 0`. Monitor CPU usage on private server.

### Risk: Haulers may not find tasks early (before RCL4)
**Mitigation:** HaulerOverlord.init() returns early if no storage or containers exist. At RCL1-3, no haulers spawn — harvesters handle their own delivery (legacy mode).

### Risk: Movement module stuck detection may cause oscillation
**Mitigation:** Stuck detection only triggers after 3 consecutive ticks of no movement. The re-path uses `ignoreCreeps: false` which is more expensive but only runs when stuck. After moving, stuckCount resets to 0.

### Risk: Bunker layout coordinates may not fit all room terrain
**Mitigation:** RoomPlanner already handles `createConstructionSite` failures gracefully (skips and tries next tick). The coordinates are based on Overmind's bunker pattern centered at (25,25). If terrain blocks a structure, RoomPlanner skips it. Rooms with unusual terrain may need a custom layout (deferred to Phase 5).

### Tradeoff: Zerg wrapper adds indirection but isn't fully adopted yet
**Decision:** We create the Zerg class in Phase 4 but don't force all overlords to use it immediately. HaulerOverlord uses the raw Task.load pattern (same as existing role files) for consistency. Migrating existing overlords to Zerg is a Phase 5 cleanup task. The Zerg class is available for new code.

### Tradeoff: Visualizer uses CPU for data collection
**Mitigation:** RoomVisual rendering is client-side (free). Data collection uses cached creep counts (single loop over Game.creeps). The `room.find` for labs only runs if labs exist. Total CPU cost is < 0.1 per room per tick. Can be gated on `Game.cpu.bucket > 5000` if needed.

---

## Open Questions

1. **Should Zerg wrapper replace role files immediately, or incrementally?** Recommendation: incrementally. HaulerOverlord uses raw Task pattern for now. Migrate existing overlords to Zerg in Phase 5 as a cleanup pass.

2. **Should LogisticsNetwork auto-register run every tick or every N ticks?** Recommendation: every tick for now (cheap in owned rooms). Add throttling if CPU becomes an issue on MMO.

3. **Bunker layout: fixed coordinates vs distance-transform?** We use fixed coordinates (Overmind's bunker). Rooms with unusual terrain may need custom layouts — deferred to Phase 5 evaluation.

4. **Should the visualizer be gated on CPU bucket?** Recommendation: no for now (cost is negligible). Add `if (Game.cpu.bucket > 5000)` gate if MMO CPU is tight.

5. **Extractor position in bunker layout?** Extractor must be placed on the mineral position, which is room-dependent. Left as empty array — RoomPlanner or a future mineral harvesting module will handle this dynamically.