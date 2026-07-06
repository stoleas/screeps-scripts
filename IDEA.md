# Screeps AI Development Ideas & Architecture

A roadmap, architecture design, and strategic plan for my Screeps AI colony.

---

## 🚀 Core Philosophy
*What makes this AI unique? (e.g., "Event-driven, highly optimized, aggressive expansion, or defensive/turtle strategy")*
* **Primary Goal:** 
* **Design Pattern:** State machine / Event-driven / Object-oriented / Functional.
* **CPU Strategy:** Pre-compute paths, cache heavy lookups, strict execution time budgets per module.

---

## 🛠️ Architecture & Module Breakdown

### 1. Global Brain (The `Main` Loop)
* Managing global memory cleanup (deleting dead creeps to avoid memory leaks).
* High-level threat assessment and CPU bucket monitoring.

### 2. Room Planner (`RoomBrain`)
* **Infrastructure Layout:** Static layout planning using Distance Transform or standard matrices (Extensions, Links, Labs, Towers).
* **RCL Transitions:** What triggers a room to upgrade its layout when it hits a new Room Controller Level?

### 3. Economic Engine
* **Mining Operations:** Fixed-size static miners paired with optimized haulers or container-mining.
* **Upgrading Strategy:** Adjusting the number of Upgraders dynamically based on energy surplus or storage levels.
* **Market Trading:** Automated resource selling/buying based on terminal capacity and global average prices.

### 4. Defense & Military (`CombatBrain`)
* **Active Defense:** Towers targeting the lowest-health or highest-threat enemy creep. Spawning defensive brawlers/healers if walls are breached.
* **Offensive Squads:** Designing multi-creep squads (e.g., 1 Tank + 1 Healer, or 1 Wrecker + 1 Ranged Attacker) with synchronized movement.

---

## 📋 RCL Milestone Roadmap

### RCL 1 - 3: The Survival Phase
- [ ] Implement basic spawning logic (Harvest -> Upgrade -> Build).
- [ ] Automated container placement next to sources.
- [ ] Basic Tower logic to repair walls/ramparts up to 10k hits and shoot invaders.

### RCL 4 - 6: The Industrial Revolution
- [ ] **RCL 4:** Automate Storage usage. Route all source mining into Storage.
- [ ] **RCL 5:** Implement Link networks for instant energy transport from sources to Storage/Controller.
- [ ] **RCL 6:** Extractors and Lab automation (Mineral harvesting and basic boosting compounds).

### RCL 7 - 8: End Game Dominance
- [ ] **RCL 7:** Multi-room spawning defense networks. Spawning defenders in neighboring rooms.
- [ ] **RCL 8:** Power Creeps integration, automated Power Bank raiding, and automated Nuker targeting.

---

## 💡 Active Ideas & Backlog

### CPU Optimization Ideas
* [ ] **Pathfinding Caching:** Cache `RoomVisual` paths and serialize them into memory. Only re-path if a structure is placed or an obstacle appears.
* [ ] **Lazy Loading:** Don't parse complex room data for rooms that don't have active events.
* [ ] **Creep State Caching:** Store the creep's current task target ID in `creep.memory` instead of finding the closest target every tick.

### Combat & Expansion Tactics
* [ ] **Remote Mining:** Implement automated scouting, reserving, and mining of adjacent neutral rooms.
- [ ] **Automated Safe Mode:** Trigger Safe Mode immediately if a room controller is being downgraded or under heavy attack with no defenders available.
- [ ] **Dynamic Body Part Generation:** Write a utility function that scales a creep's body parts perfectly based on available room energy capacity.

---

## 📊 Memory Structure Design

```json
{
  "creeps": {
    "Miner_1": { "role": "miner", "sourceId": "5bbc0a899099fc012e693175", "working": true }
  },
  "rooms": {
    "W1N1": {
      "sourceIds": ["5bbc0a899099fc012e693175", "5bbc0a899099fc012e693176"],
      "storageId": "5cf67a...",
      "defenseLevel": "low"
    }
  },
  "stats": {
    "gclProgress": 0,
    "cpuUsage": []
  }
}


### 💡 Pro-Tips for using this document:
1. **CPU Tracking:** Screeps is fundamentally a game of managing CPU. I highly recommend keeping the "CPU Optimization Ideas" section updated as you profile your code.
2. **Pathfinding Notes:** One of the quickest wins in Screeps is caching paths. If your `IDEA.md` lays out exactly how your creeps store their paths, writing the code becomes much easier.

---

## 🏆 Baseline vs Shipped — Engineering Deltas

The current `main.js` + `role.*.js` is a strict superset of the vanilla tutorial baseline (saved at `.hermes/plans/2026-07-05_210000-screeps-automation.md` and mirrored in Obsidian at `obsidian/personal/games/screeps/early-game-automation.md`). The five intentional improvements that elevate it above the tutorial:

### 1. CPU Optimization — `findClosestByPath` vs static arrays
**Baseline:** `creep.room.find(FIND_SOURCES)[0]` — always picks source index 0, regardless of which source the creep is closer to. At RCL2+ with two sources spread across the room, half the harvesters pathfind across the entire map every harvest.
**Shipped:** `creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE)` — picks the source the creep can reach with the least path cost. Saves `O(room²)` moves per harvest per harvester once the second source unlocks.
**Why it matters:** Halves harvest-cycle travel time on day 1 of RCL2. Compounds across the 1500-tick creep lifespan.

### 2. Intent Safety — `!spawn.spawning` guard preventing multi-queue waste
**Baseline:** The `else if` chain in Task 5 fires the spawn condition every tick while a creep is being born. A harvester takes 3 ticks to spawn at `[WORK, CARRY, MOVE]` (200 energy / 100 per body part per tick = 3 ticks minimum, longer with extensions queued); the loop queues a new spawn 3 times in a row, hitting `ERR_BUSY` twice and `OK` once — but only the first `OK` matters, the redundant calls waste CPU evaluating `_.filter(Game.creeps, ...)` against a stale `harvesters.length` count.
**Shipped:** `if (spawn && !spawn.spawning) { ... }` — single guard around the whole priority chain. The spawn manager only re-evaluates the queue after the current spawn completes.
**Why it matters:** Clean intent. No "did that spawn actually go through" debugging. The game engine's `ERR_BUSY` is treated as a no-op signal, not a retry trigger.

### 3. UX/UI — Active `room.visual.text` tracking above the spawn
**Baseline:** No visual feedback for what's being spawned. You have to open the console and read the `Spawning new Harvester: Harvester12345` log line to know what the queue is doing.
**Shipped:** When `spawn.spawning` is truthy, draw a `🛠️ ${role}` label one tile east of the spawn via `spawn.room.visual.text`. Updates each tick; disappears the moment spawning completes.
**Why it matters:** Saves console-checking round-trips when you're watching the room from the world map.

### 4. State Machine — Explicit `delivering` / `building` / `upgrading` flags
**Baseline:** Harvester decides between harvest and deliver on every tick by checking `creep.store.getFreeCapacity() > 0`. State is implicit in store contents; the role reads its own state via the same API it mutates.
**Shipped:** Harvester has `creep.memory.delivering` (set true when full, false when empty). Upgrader has `creep.memory.upgrading`. Builder has `creep.memory.building`. Each role toggles the flag and `creep.say()`s a status emoji (`⛏ harvest` / `📦 deliver` / `⚡ upgrade` / `🚧 build`) at the transition.
**Why it matters:** The flag makes the state machine auditable — you can `JSON.stringify(creep.memory)` in the console to see what a stuck creep is "thinking." The say() emoji gives the same visibility in the world view at a glance.

### 5. Harvester Fallback — Upgrade controller when spawn/extensions are full
**Baseline:** Harvester code path: `if (getFreeCapacity() > 0) harvest(); else if (targets.length > 0) transfer();`. The inner `else` is a no-op when the spawn and all extensions are full (early-game, common state). The harvester stands still and wastes the tick.
**Shipped:** When the deliver-target list is empty, fall through to `creep.upgradeController(creep.room.controller)`. Every spare energy unit in the system gets sunk into RCL progression instead of being lost to idle ticks.
**Why it matters:** In practice this is the single biggest RCL1→RCL2 accelerator the shipped code has over the baseline. While the spawn is full, the harvester is effectively a free upgrader.

### 6. Multi-Spawn Loop — `for (name in Game.spawns)` vs `Game.spawns.Spawn1`
**Baseline:** Hardcoded `const spawn = Game.spawns.Spawn1;`. The spawn manager only knows about one spawn by name. If the room ever gets a second spawn (RCL7 in vanilla progression, RCL2 in ShardedKV, or any scenario where the user renames the spawn), the manager silently skips container planning, spawns nothing, and never shows the "currently spawning" visual.
**Shipped:** `for (const spawnName in Game.spawns) { const spawn = Game.spawns[spawnName]; ... }` — iterate every owned spawn, run container planning + quota check + visual for each. Creep counts are computed once before the loop (they're room-wide: both spawns in the same room share the same creep pool). The spawn-name suffix on the new creep name (`${role}${Game.time}${spawnTag}` where `spawnTag` is `A`/`B`/`C`/...) prevents `ERR_NAME_EXISTS` collisions when two idle spawns in the same room both try to queue a harvester on the same tick.
**Why it matters:** The 1-spawn case is byte-for-byte the same behavior (the first iteration runs Spawn1 with tag `A`). The 2-spawn case is the actual fix — without it, the second spawn returns `ERR_NAME_EXISTS` for every spawn attempt and the room's effective spawn rate halves. Container planning also runs once per spawn (idempotent for spawns in the same room, since the planner dedupes by source).

---

## 📐 Reference Architecture — Dynamic Body Scaler

**Status:** Designed, implementation in `bodyFactory.js`. See top of file for tier table rationale.

The next stage of the RCL1→RCL2 progression is replacing the hardcoded `STARTER_BODY = [WORK, CARRY, MOVE]` (200 energy) with a tiered profile that scales up as `room.energyCapacityAvailable` rises through the RCL2 extension unlocks (300, 400, 550, ...). Each role gets its own profile table because the WORK/CARRY ratio that maximizes harvester throughput is not the same as the ratio that maximizes controller-upgrade throughput.

### Body Cost History (tier rebalance 2026-07-06)

The original tier tables were under-MOVEd (e.g. harvester tier4 was 6 fat parts + 2 MOVE → 0.5 tiles/tick). A creep moves at 1 tile/tick only when `MOVE >= non-MOVE` parts. The rebalance makes every tier2+ body **1:1 fat:MOVE** so creeps walk at full speed. The energy cost per tier roughly doubles, but the new costs (200/350/500/800) align with the RCL2 extension unlock thresholds (RCL1 spawn = 300, 1st extension = 300, mid RCL2 = 550, full RCL2 = 800).

| Role | Tier | Old body | Old cost | New body | New cost |
|---|---|---|---|---|---|
| harvester | tier1 | [W,C,M] | 200 | [W,C,M] | 200 (unchanged — RCL1 floor; 2:1) |
| harvester | tier2 | [W,W,C,M] | 250 | [W,W,C,M,M,M] | 400 |
| harvester | tier3 | [W,W,C,C,M,M] | 400 | [W,W,C,C,M,M,M,M] | 500 |
| harvester | tier4 | [W,W,W,C,C,C,M,M] | 550 | [W,W,W,C,C,C,M,M,M,M,M,M] | 750 |
| upgrader | tier1-3 | (unchanged structures) | 200/250/400 | (1:1 rebalanced) | 200/400/500 |
| upgrader | tier4 | [W,W,W,C,C,M,M] | 500 | *removed* (dup of tier3) | — |
| builder | tier1-3 | (unchanged structures) | 200/300/400 | (1:1 rebalanced) | 200/350/500 |
| hauler | — | (did not exist) | — | empty placeholder for RCL4 | — |

**Why tier1 stays under-MOVEd:** the 200-energy RCL1 floor needs exactly 3 parts (1 WORK + 1 CARRY + 1 MOVE). Adding a 4th MOVE bumps the cost to 250 which exceeds the spawn's initial 200 energy capacity. The harvester walks slowly (~0.67 tiles/tick) only during the brief RCL1 window before the first extension is built; from RCL2 onward every spawned creep walks at 1 tile/tick.

**Why upgrader tier4 was removed:** the old tier4 (`[W,W,W,C,C,M,M]`, 500 energy) was structurally identical to the new tier3 (also 500 energy, 1:1 rebalanced). Keeping both was redundant.

**Implication for the IDEA.md deltas section:** the "Shipped" body of a 550-energy-room creep is now tier3 (500 energy, 8 parts) rather than the old tier4 (550 energy, 8 parts). And the new tier4 at 750 energy (12 parts) is the natural RCL2-endgame body, no longer 800. Body names in spawn logs and `Game.creeps` keys will match, but `bodyFactory.costOf(body)` and `body.length` will report different numbers than the "shipped" deltas document. The shape changes too — tier4 went from 8 parts (under-MOVEd) to 12 parts (1:1).

---

## 🚚 RCL2 Infrastructure: Container Planner

**Status:** Implemented in `containerPlanner.js`. Runs once per tick from `main.js` loop(). RCL-gated (no-op at RCL1).

When the room hits RCL2, `STRUCTURE_CONTAINER` unlocks. Containers let harvesters transition from round-trip mining (walk to source → mine → walk to spawn → drop) to static mining (stand on container → mine → drop on container every tick). The static-mining pattern is the foundation of the RCL2+ economy.

The planner places **at most one container construction site per source per run**. It uses `PathFinder.search(source.pos, { pos: spawn.pos, range: 1 })` to find the first walkable step from source toward spawn, then prefers the first plain (non-swamp, non-wall) tile in the first 3 path steps. Swamp tiles are accepted as a fallback (containers decay 5× faster on swamp, but having a container at all beats having none).

The check for existing containers uses `findInRange(..., 1, ...)` — NOT range 2. Range 2 would accept containers the harvester can't reach from in 1 tick, which breaks static mining.

### Harvester dual-mode (in `role.harvester.js`)

The harvester no longer needs a state-machine flag for mode. Each tick it:

1. Finds the closest active source.
2. Checks if a container is adjacent to that source (`findInRange(FIND_STRUCTURES, 1, ...)` filtered for `STRUCTURE_CONTAINER`).
3. **If yes → STATIC mode:** stand on the container, mine the source, drop energy on the container. No walking back to spawn.
4. **If no → LEGACY mode:** same as the pre-RCL2 behavior: harvest until full, then deliver to closest spawn/extension. If all spawn/extension slots are full, fall back to upgrading the controller (IDEA.md delta #5).

The mode is decided per-tick by inspecting the source's surroundings, not by a memory flag. This means the harvester self-heals if a container is built, destroyed, or relocated — no manual flag-clearing needed.