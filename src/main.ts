'use strict';

import { bodyFactory } from './bodyFactory';
import { containerPlanner } from './containerPlanner';
import { roleHarvester } from './role.harvester';
import { roleUpgrader } from './role.upgrader';
import { roleBuilder } from './role.builder';

// Desired number of creeps per role.
const TARGETS: { [role: string]: number } = {
    harvester: 2,
    upgrader: 1,
    builder: 1
};

export const loop = (): void => {
    // Clear memory of creeps that no longer exist so Memory doesn't leak.
    for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }

    // Count how many creeps of each role are currently alive. The counts
    // are room-wide: if a room has two spawns they share the same creep
    // pool, so each spawn independently consults these numbers when
    // deciding what to queue next.
    const counts: { [role: string]: number } = { harvester: 0, upgrader: 0, builder: 0 };
    for (const creepName in Game.creeps) {
        const role = Game.creeps[creepName].memory.role;
        if (role && role in counts) {
            counts[role]++;
        }
    }

    // Iterate every spawn we own. With one spawn this loop runs once;
    // with two (e.g. RCL7+ second spawn) each one independently evaluates
    // the quotas against the shared creep pool and the first idle one
    // queues the next under-quota role.
    let spawnCounter = 0;
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        const spawnTag = String.fromCharCode(65 + (spawnCounter++ % 26));

        // RCL2 infrastructure planning: place a container construction
        // site next to each source that doesn't already have one.
        // RCL-gated inside the planner; safe to call every tick. Runs
        // BEFORE the spawn logic so that the harvester's dual-mode check
        // picks up the container as soon as it's built. Idempotent across
        // spawns in the same room — the planner dedupes by source.
        containerPlanner.plan(spawn.room);

        // Spawn the first role that is below its target (harvesters
        // first). The !spawn.spawning guard prevents re-queuing while the
        // previous creep is still being born.
        if (!spawn.spawning) {
            for (const wantedRole of Object.keys(TARGETS)) {
                if (counts[wantedRole] < TARGETS[wantedRole]) {
                    // Dynamic body: scale to room.energyCapacityAvailable
                    // so we automatically upgrade from [WORK,CARRY,MOVE]
                    // (200) to chunkier profiles as RCL2 extensions
                    // unlock higher energy budgets.
                    const body = bodyFactory.forRole(spawn.room.energyCapacityAvailable, wantedRole);
                    if (body.length === 0) {
                        // Not enough energy for even tier1 (rare; usually
                        // means extensions just got placed and the room
                        // is mid-recharge). Skip this tick; we'll
                        // re-evaluate on the next one.
                        break;
                    }
                    const newName = `${wantedRole}${Game.time}${spawnTag}`;
                    const result = spawn.spawnCreep(body, newName, {
                        memory: { role: wantedRole }
                    });
                    if (result === OK) {
                        console.log(`Spawning new ${wantedRole}: ${newName} (${bodyFactory.costOf(body)} energy, ${body.length} parts)`);
                    }
                    break;
                }
            }
        }

        // Show what's currently being spawned above the spawn.
        if (spawn.spawning) {
            const spawningCreep = Game.creeps[spawn.spawning.name];
            spawn.room.visual.text(`🛠️ ${spawningCreep.memory.role}`, spawn.pos.x + 1, spawn.pos.y, {
                align: 'left',
                opacity: 0.8
            });
        }
    }

    // Run each creep's role logic.
    for (const runName in Game.creeps) {
        const creep = Game.creeps[runName];
        switch (creep.memory.role) {
            case 'harvester':
                roleHarvester.run(creep);
                break;
            case 'upgrader':
                roleUpgrader.run(creep);
                break;
            case 'builder':
                roleBuilder.run(creep);
                break;
        }
    }
};