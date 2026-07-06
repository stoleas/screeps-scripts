'use strict';

const bodyFactory = require('bodyFactory');
const containerPlanner = require('containerPlanner');
const roleHarvester = require('role.harvester');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');

// Desired number of creeps per role.
const TARGETS = {
    harvester: 2,
    upgrader: 1,
    builder: 1
};

const loop = () => {
    // Clear memory of creeps that no longer exist so Memory doesn't leak.
    for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
            delete Memory.creeps[name];
            console.log("Clearing non-existing creep memory:", name);
        }
    }

    const spawn = Game.spawns.Spawn1;

    // RCL2 infrastructure planning: place a container construction site
    // next to each source that doesn't already have one. RCL-gated inside
    // the planner; safe to call every tick. Runs BEFORE the spawn logic
    // so that the harvester's dual-mode check picks up the container as
    // soon as it's built.
    if (spawn) {
        containerPlanner.plan(spawn.room);
    }

    // Count how many creeps of each role are currently alive.
    const counts = { harvester: 0, upgrader: 0, builder: 0 };
    for (const creepName in Game.creeps) {
        const role = Game.creeps[creepName].memory.role;
        if (role in counts) {
            counts[role]++;
        }
    }

    // Spawn the first role that is below its target (harvesters first).
    if (spawn && !spawn.spawning) {
        for (const wantedRole of Object.keys(TARGETS)) {
            if (counts[wantedRole] < TARGETS[wantedRole]) {
                // Dynamic body: scale to room.energyCapacityAvailable so we
                // automatically upgrade from [WORK,CARRY,MOVE] (200) to chunkier
                // profiles as RCL2 extensions unlock higher energy budgets.
                const body = bodyFactory.forRole(spawn.room.energyCapacityAvailable, wantedRole);
                if (body.length === 0) {
                    // Not enough energy for even tier1 (rare; usually means
                    // extensions just got placed and the room is mid-recharge).
                    // Skip this tick; we'll re-evaluate on the next one.
                    break;
                }
                const newName = `${wantedRole}${Game.time}`;
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
    if (spawn && spawn.spawning) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        spawn.room.visual.text(`🛠️ ${spawningCreep.memory.role}`, spawn.pos.x + 1, spawn.pos.y, {
            align: "left",
            opacity: 0.8
        });
    }

    // Run each creep's role logic.
    for (const runName in Game.creeps) {
        const creep = Game.creeps[runName];
        switch (creep.memory.role) {
            case "harvester":
                roleHarvester.run(creep);
                break;
            case "upgrader":
                roleUpgrader.run(creep);
                break;
            case "builder":
                roleBuilder.run(creep);
                break;
        }
    }
};

exports.loop = loop;
