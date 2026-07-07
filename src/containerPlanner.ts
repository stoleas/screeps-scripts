'use strict';

export const containerPlanner = {
    plan(room: Room): boolean {
        if (!room.controller || room.controller.level < 2) {
            return false;
        }

        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) {
            return false;
        }

        const sources = room.find(FIND_SOURCES);
        for (const source of sources) {
            const existing = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER
            });
            const planned = source.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1, {
                filter: (s: ConstructionSite) => s.structureType === STRUCTURE_CONTAINER
            });
            if (existing.length > 0 || planned.length > 0) {
                continue;
            }

            const path = PathFinder.search(source.pos, { pos: spawn.pos, range: 1 });
            if (!path.path || path.path.length === 0) {
                continue;
            }

            const terrain = room.getTerrain();
            let chosen: RoomPosition | null = null;
            const lookAhead = Math.min(3, path.path.length);
            for (let j = 0; j < lookAhead; j++) {
                const step = path.path[j];
                const t = terrain.get(step.x, step.y);
                if (t !== TERRAIN_MASK_WALL && t !== TERRAIN_MASK_SWAMP) {
                    chosen = step;
                    break;
                }
            }
            if (!chosen) {
                chosen = path.path[0];
            }

            const result = room.createConstructionSite(chosen.x, chosen.y, STRUCTURE_CONTAINER);
            if (result === OK) {
                console.log(`[Planner] Container site placed at (${chosen.x}, ${chosen.y}) for source ${source.id}`);
                return true;
            }
        }
        return false;
    }
};