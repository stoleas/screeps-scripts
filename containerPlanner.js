'use strict';

// containerPlanner.js
// RCL2 container placement planner.
//
// At RCL2 the room can build STRUCTURE_CONTAINER, which is the foundation
// of the static-mining economy: a harvester stands on a container next
// to a source, mines the source, and drops energy on the container every
// tick. A separate hauler (RCL4) or the spawn refilling on pass-by
// (RCL2-3) drains the container into spawn/extensions/storage.
//
// This planner places container construction sites automatically when
// RCL2 unlocks. It runs once per tick from main.js's loop().
//
// Design notes:
//  - Throttled to ONE site placed per tick. The Screeps per-room
//    construction-site cap is 100; we have plenty of headroom but
//    rate-limiting keeps the log readable and avoids edge cases where
//    two sources both qualify and we place them on adjacent tiles
//    (which would block hauler movement).
//  - The container is placed on the first non-swamp, non-wall tile on
//    the path from source to spawn. Plain tiles are preferred over
//    swamp so haulers move at full speed (containers decay 5x faster
//    on swamp, also reducing lifespan).
//  - We check `findInRange(..., 1, ...)` for existing containers/sites,
//    NOT range 2 as the original draft did. Range 2 would accept a
//    container the harvester can't reach from in 1 tick, which breaks
//    static mining (the harvester would have to walk 1 tile to mine).
//  - No RCL1 fallback needed: if controller.level < 2, we bail before
//    doing any work. Containers don't exist at RCL1 anyway.

var containerPlanner = {

    /**
     * Plan and place at most one container construction site this tick.
     *
     * @param {Room} room - the room to plan containers for
     * @returns {boolean} true if a site was placed, false otherwise
     */
    plan: function (room) {
        // RCL gate: containers are an RCL2 structure. Bail on RCL1.
        if (!room.controller || room.controller.level < 2) {
            return false;
        }

        var spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) {
            return false;
        }

        var sources = room.find(FIND_SOURCES);
        for (var i = 0; i < sources.length; i++) {
            var source = sources[i];

            // Guard: skip sources that already have a container or a
            // planned container within range 1. We check before
            // running PathFinder to save CPU once the room is set up.
            var existing = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: function (s) { return s.structureType === STRUCTURE_CONTAINER; }
            });
            var planned = source.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1, {
                filter: function (s) { return s.structureType === STRUCTURE_CONTAINER; }
            });
            if (existing.length > 0 || planned.length > 0) {
                continue;
            }

            // Find the first walkable step on the path source -> spawn.
            // PathFinder.path is a list of RoomPosition; the first entry
            // is the first step away from the source (range 1).
            var path = PathFinder.search(source.pos, { pos: spawn.pos, range: 1 });
            if (!path.path || path.path.length === 0) {
                continue;
            }

            // Prefer the first plain (non-wall, non-swamp) tile in the
            // first 3 path steps. Fall back to the first step if all 3
            // are swamp. Walls never appear here because PathFinder
            // filters them, but we check defensively.
            var terrain = room.getTerrain();
            var chosen = null;
            var lookAhead = Math.min(3, path.path.length);
            for (var j = 0; j < lookAhead; j++) {
                var step = path.path[j];
                var t = terrain.get(step.x, step.y);
                if (t !== TERRAIN_MASK_WALL && t !== TERRAIN_MASK_SWAMP) {
                    chosen = step;
                    break;
                }
            }
            if (!chosen) {
                chosen = path.path[0];  // swamp is better than no container
            }

            var result = room.createConstructionSite(
                chosen.x, chosen.y, STRUCTURE_CONTAINER
            );
            if (result === OK) {
                console.log(
                    '[Planner] Container site placed at (' + chosen.x + ', ' +
                    chosen.y + ') for source ' + source.id
                );
                return true;  // throttle: one site per tick
            }
            // If createConstructionSite returned ERR_FULL or ERR_INVALID_ARGS,
            // move on; nothing to do this tick.
        }
        return false;
    }
};

module.exports = containerPlanner;
