'use strict';

interface BuilderMemory extends CreepMemory {
    building?: boolean;
}

export const roleBuilder = {
    run(creep: Creep): void {
        const mem = creep.memory as BuilderMemory;
        if (mem.building && creep.store[RESOURCE_ENERGY] === 0) {
            mem.building = false;
            creep.say('⛏ harvest');
        }
        if (!mem.building && creep.store.getFreeCapacity() === 0) {
            mem.building = true;
            creep.say('🚧 build');
        }

        if (mem.building) {
            const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            if (target) {
                if (creep.build(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else {
                // Nothing to build: help upgrade the controller instead.
                if (creep.room.controller &&
                    creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        } else {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
};