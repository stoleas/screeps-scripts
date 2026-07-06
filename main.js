'use strict';

function run$2(creep) {
    // Toggle between harvesting and delivering based on carried energy.
    if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.delivering = false;
        creep.say("⛏ harvest");
    }
    if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
        creep.memory.delivering = true;
        creep.say("📦 deliver");
    }
    if (!creep.memory.delivering) {
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
        return;
    }
    // Fill spawn and extensions first, then fall back to the controller.
    const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (s) => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (target) {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
        }
    }
    else if (creep.room.controller && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
    }
}

function run$1(creep) {
    if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.upgrading = false;
        creep.say("⛏ harvest");
    }
    if (!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) {
        creep.memory.upgrading = true;
        creep.say("⚡ upgrade");
    }
    if (creep.memory.upgrading) {
        if (creep.room.controller && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
        }
        return;
    }
    const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
}

function run(creep) {
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.building = false;
        creep.say("⛏ harvest");
    }
    if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
        creep.memory.building = true;
        creep.say("🚧 build");
    }
    if (creep.memory.building) {
        const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if (target) {
            if (creep.build(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
            }
        }
        else if (creep.room.controller && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            // Nothing to build: help upgrade the controller instead.
            creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
        }
        return;
    }
    const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
}

// Desired number of creeps per role.
const TARGETS = {
    harvester: 2,
    upgrader: 1,
    builder: 1
};
// Body used for the first creeps. Costs 200 energy, always affordable.
const STARTER_BODY = [WORK, CARRY, MOVE];
const loop = () => {
    // Clear memory of creeps that no longer exist so Memory doesn't leak.
    for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
            delete Memory.creeps[name];
            console.log("Clearing non-existing creep memory:", name);
        }
    }
    const spawn = Game.spawns.Spawn1;
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
                const newName = `${wantedRole}${Game.time}`;
                const result = spawn.spawnCreep(STARTER_BODY, newName, {
                    memory: { role: wantedRole }
                });
                if (result === OK) {
                    console.log(`Spawning new ${wantedRole}: ${newName}`);
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
                run$2(creep);
                break;
            case "upgrader":
                run$1(creep);
                break;
            case "builder":
                run(creep);
                break;
        }
    }
};

exports.loop = loop;