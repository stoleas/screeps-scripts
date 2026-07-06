var roleHarvester = {

    /** @param {Creep} creep **/
    run: function (creep) {
        // Toggle between harvesting and delivering based on carried energy.
        if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            creep.say('⛏ harvest');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            creep.say('📦 deliver');
        }

        if (!creep.memory.delivering) {
            var source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        } else {
            // Fill spawn and extensions first, then fall back to the controller.
            var target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: function (s) {
                    return (s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_EXTENSION) &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }
};

module.exports = roleHarvester;