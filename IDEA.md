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