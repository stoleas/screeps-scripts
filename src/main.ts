'use strict';

import { Mem } from './memory';
import { Colony } from './colony';
import { ALLIANCE, getFlagAllies } from './alliance';
import { towerDefense } from './tower';
import { comms } from './comms';
import { terminalNetwork } from './terminal';
import { PRODUCTION } from './production';
import { Hatchery } from './hatchery';
import { HarvestOverlord } from './overlords/harvestOverlord';
import { UpgradeOverlord } from './overlords/upgradeOverlord';
import { BuildOverlord } from './overlords/buildOverlord';
import { Overlord } from './overlord';
import { roomPlanner } from './roomPlanner';

export const loop = (): void => {
    // Memory management: init, CPU bucket gate, garbage collection.
    Mem.load();
    if (!Mem.shouldRun()) return;
    Mem.clean();

    // Scan in-game flags for ally:username entries. This populates the
    // per-tick cache used by tower IFF and comms, and logs when the set changes.
    getFlagAllies();

    // Alliance: activate our outbound segment and request zh0ul's foreign
    // segment on interval. Data arrives next tick in RawMemory.segments
    // and RawMemory.foreignSegment respectively.
    if (Game.time % ALLIANCE.commsRefreshInterval === 0) {
        // Activate our segment so we can write to it.
        RawMemory.setActiveSegments([ALLIANCE.SEGMENT_OUR]);
        // Request zh0ul's public segment for reading.
        RawMemory.setActiveForeignSegment('zh0ul', ALLIANCE.SEGMENT_ALLY);
        // Publish our status (writes to segment, marks public).
        comms.publishOurStatus();
    }

    // Read ally's status from foreign segment (available if requested last tick).
    const allyStatus = comms.readAllyStatus();
    if (allyStatus) {
        if (allyStatus.defenseRequests.length > 0) {
            console.log(`[Comms] Ally ${allyStatus.player} requests defense:`,
                allyStatus.defenseRequests.map(r => r.roomName).join(', '));
        }
        if (allyStatus.energyDeficits.length > 0) {
            console.log(`[Comms] Ally ${allyStatus.player} energy deficits:`,
                allyStatus.energyDeficits.map(d => `${d.roomName} (${d.energy})`).join(', '));
        }
    }

    // Tower defense for every owned room (IFF-filtered).
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (room.controller && room.controller.my) {
            towerDefense.run(room);
        }
    }

    // Terminal network: ship energy to allies under siege or in deficit.
    terminalNetwork.run();

    // Build colony objects (one per owned room) and tag creeps.
    const colonies: Colony[] = [];
    for (const spawnName in Game.spawns) {
        const room = Game.spawns[spawnName].room;
        if (!_.find(colonies, (c: Colony) => c.name === room.name)) {
            colonies.push(new Colony(room));
        }
    }

    // Tag creeps with their colony (room name) for Colony.creeps filtering.
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (!creep.memory.colony && creep.room.controller && creep.room.controller.my) {
            creep.memory.colony = creep.room.name;
        }
    }

    // Per-colony: plan containers, build overlords, spawn via hatchery,
    // then run overlord logic. CPU gate: harvest+spawn always run;
    // build+upgrade+room-planning only run when bucket is healthy.
    for (const colony of colonies) {
        // Room planning: place structures from bunker layout.
        // Skipped when CPU bucket is low (non-essential).
        if (!PRODUCTION.isCpuWarning()) {
            roomPlanner.plan(colony.room);
        }

        // Build overlords for this colony.
        const overlords: Overlord[] = [
            new HarvestOverlord(colony),
        ];
        // Upgrade and build overlords are non-essential when CPU is low.
        if (!PRODUCTION.isCpuWarning()) {
            overlords.push(new UpgradeOverlord(colony));
            overlords.push(new BuildOverlord(colony));
        }

        // Refresh creep assignments, request spawns, then run.
        const hatchery = new Hatchery(colony);
        for (const overlord of overlords) {
            overlord.refresh();
            overlord.init(hatchery);
        }
        hatchery.run();

        for (const overlord of overlords) {
            overlord.run();
        }

        // Show what's currently being spawned above each spawn.
        for (const spawn of colony.spawns) {
            if (spawn.spawning) {
                const spawningCreep = Game.creeps[spawn.spawning.name];
                spawn.room.visual.text(`🛠️ ${spawningCreep.memory.role}`, spawn.pos.x + 1, spawn.pos.y, {
                    align: 'left',
                    opacity: 0.8
                });
            }
        }
    }
};