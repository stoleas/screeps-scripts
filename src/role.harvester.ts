'use strict';

interface HarvesterMemory extends CreepMemory {
    delivering?: boolean;
}

export const roleHarvester = {
    run(creep: Creep): void {
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (!source) {
            return;
        }

        const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER
        });
        const container = containers.length > 0 ? containers[0] : null;

        if (container) {
            // STATIC mode: harvest, then drop on the container.
            if (creep.pos.isEqualTo(container.pos)) {
                const harvestResult = creep.harvest(source);
                if (harvestResult === ERR_NOT_IN_RANGE) {
                    return;
                }
                if (creep.store[RESOURCE_ENERGY] > 0) {
                    creep.drop(RESOURCE_ENERGY);
                }
            } else {
                creep.moveTo(container.pos, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        // LEGACY mode: state-machine harvest → deliver, with controller fallback.
        const mem = creep.memory as HarvesterMemory;
        if (mem.delivering && creep.store[RESOURCE_ENERGY] === 0) {
            mem.delivering = false;
            creep.say('⛏ harvest');
        }
        if (!mem.delivering && creep.store.getFreeCapacity() === 0) {
            mem.delivering = true;
            creep.say('📦 deliver');
        }

        if (!mem.delivering) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s: Structure) =>
                (s.structureType === STRUCTURE_SPAWN ||
                 s.structureType === STRUCTURE_EXTENSION) &&
                (s as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else if (creep.room.controller &&
                   creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
    }
};