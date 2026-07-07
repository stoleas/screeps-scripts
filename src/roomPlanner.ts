'use strict';

// RoomPlanner adapted from Overmind's RoomPlanner.ts.
// Places structures from the bunker layout, one site per tick.

import { bunkerLayout, RCLLayout } from './layouts/bunker';

export const roomPlanner = {
    plan(room: Room): boolean {
        if (!room.controller) return false;
        const rcl = room.controller.level;
        const layout = (bunkerLayout as any)[rcl] as RCLLayout | undefined;
        if (!layout) return false;

        for (const structureType in layout.buildings) {
            const positions = layout.buildings[structureType];
            for (const pos of positions) {
                const existing = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                if (existing.some(s => s.structureType === structureType)) continue;

                const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);
                if (sites.length > 0) continue;

                const result = room.createConstructionSite(pos.x, pos.y, structureType as BuildableStructureConstant);
                if (result === OK) {
                    console.log(`[RoomPlanner] Placing ${structureType} at (${pos.x},${pos.y})`);
                    return true;
                }
            }
        }
        return false;
    },
};