var roleHarvester = {

    /**
     * Harvester role with dual-mode behavior:
     *
     *  - STATIC mode (RCL2+ with a container adjacent to the source):
     *    The creep stands on the container and mines the source. Drop
     *    energy onto the container every tick; never walk back to spawn.
     *    A separate hauler role (added at RCL4 with Storage) will run
     *    container → spawn/extensions/storage. Until then, spawn/extension
     *    refills happen when a creep happens to walk past with empty store
     *    — acceptable in early RCL2 because the container fills faster
     *    than one harvester can drain.
     *
     *  - LEGACY mode (no container adjacent to the source):
     *    Same as the pre-RCL2 behavior: harvest until full, then deliver
     *    to the closest spawn/extension that has free capacity. If all
     *    spawn/extension slots are full, fall back to upgrading the
     *    controller (the IDEA.md delta #5 behavior — every spare energy
     *    unit sinks into RCL progression).
     *
     * The mode is decided each tick by inspecting the source the creep
     * is currently targeting. No persistent memory flag is needed
     * because the position relative to the container does the state-
     * tracking. This means the harvester self-heals after a container
     * is built, destroyed, or relocated.
     *
     * @param {Creep} creep
     */
    run: function (creep) {
        var source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (!source) {
            // No source reachable from current position; nothing to do.
            return;
        }

        // Is there a container adjacent to this source? If so, the creep
        // should mine-and-drop in place (static mode). The harvester does
        // NOT need to be on the container *now* — it just needs the
        // container to be within range 1 of the source so the harvester
        // can stand on it and reach the source in 1 tick.
        var containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: function (s) { return s.structureType === STRUCTURE_CONTAINER; }
        });
        var container = containers.length > 0 ? containers[0] : null;

        if (container) {
            // STATIC mode: harvest, then drop on the container.
            if (creep.pos.isEqualTo(container.pos)) {
                // We're already on the container. Mine + drop.
                var harvestResult = creep.harvest(source);
                if (harvestResult === ERR_NOT_IN_RANGE) {
                    // Source must have been destroyed; back out and re-evaluate next tick.
                    return;
                }
                if (creep.store[RESOURCE_ENERGY] > 0) {
                    creep.drop(RESOURCE_ENERGY);
                }
            } else {
                // Walk to the container (which is adjacent to the source).
                creep.moveTo(container.pos, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        // LEGACY mode: state-machine harvest → deliver, with controller fallback.
        if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            creep.say('⛏ harvest');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            creep.say('📦 deliver');
        }

        if (!creep.memory.delivering) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        // Delivering: fill spawn/extensions first, fall back to controller.
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
        } else if (creep.room.controller &&
                   creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
    }
};

module.exports = roleHarvester;
