'use strict';

import { Mem } from './memory';
import { Colony } from './colony';
import { Hatchery } from './hatchery';
import { HarvestOverlord } from './overlords/harvestOverlord';
import { UpgradeOverlord } from './overlords/upgradeOverlord';
import { BuildOverlord } from './overlords/buildOverlord';
import { Overlord } from './overlord';
import { containerPlanner } from './containerPlanner';

export const loop = (): void => {
    // Memory management: init, CPU bucket gate, garbage collection.
    Mem.load();
    if (!Mem.shouldRun()) return;
    Mem.clean();

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
    // then run overlord logic.
    for (const colony of colonies) {
        // RCL2 container planning (kept until RoomPlanner replaces it).
        containerPlanner.plan(colony.room);

        // Build overlords for this colony.
        const overlords: Overlord[] = [
            new HarvestOverlord(colony),
            new UpgradeOverlord(colony),
            new BuildOverlord(colony),
        ];

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