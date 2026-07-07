'use strict';

interface UpgraderMemory extends CreepMemory {
    upgrading?: boolean;
}

export const roleUpgrader = {
    run(creep: Creep): void {
        const mem = creep.memory as UpgraderMemory;
        if (mem.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
            mem.upgrading = false;
            creep.say('⛏ harvest');
        }
        if (!mem.upgrading && creep.store.getFreeCapacity() === 0) {
            mem.upgrading = true;
            creep.say('⚡ upgrade');
        }

        if (mem.upgrading) {
            if (creep.room.controller &&
                creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
};