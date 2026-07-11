'use strict';

// Multi-component room planner adapted from Overmind's RoomPlanner.ts.
// Places structures from three layouts: hatchery, commandCenter, bunker.
// Each layout has its own anchor; components are translated to the
// room center (25,25) by default, or to flag positions if the user
// places room-planner flags (white/red=bunker, white/green=hatchery,
// white/blue=commandCenter).

import { bunkerLayout, RCLLayout } from './layouts/bunker';
import { hatcheryLayout } from './layouts/hatchery';
import { commandCenterLayout } from './layouts/commandCenter';

interface Coord { x: number; y: number; }

// All layouts with their default anchors and flag color pairs.
// Flag format: [primary, secondary] matching Overmind conventions.
//   white/red   = bunker
//   white/green = hatchery
//   white/blue  = commandCenter
const LAYOUTS: {
    name: string;
    layout: { data: { anchor: Coord }; [rcl: number]: RCLLayout };
    flagColor: [ColorConstant, ColorConstant];
}[] = [
    { name: 'hatchery',      layout: hatcheryLayout,      flagColor: [COLOR_WHITE, COLOR_GREEN] },
    { name: 'commandCenter', layout: commandCenterLayout, flagColor: [COLOR_WHITE, COLOR_BLUE] },
    { name: 'bunker',        layout: bunkerLayout,        flagColor: [COLOR_WHITE, COLOR_RED] },
];

// Find a placement flag for a component in a room.
// Matches by color pair (primary/secondary) within the room.
function findPlacementFlag(room: Room, flagColor: [ColorConstant, ColorConstant]): Flag | null {
    const [primary, secondary] = flagColor;
    for (const flagName in Game.flags) {
        const flag = Game.flags[flagName];
        if (flag.pos.roomName !== room.name) continue;
        if (flag.color === primary && flag.secondaryColor === secondary) {
            return flag;
        }
    }
    return null;
}

export const roomPlanner = {
    plan(room: Room): boolean {
        if (!room.controller) return false;
        const rcl = room.controller.level;

        for (const { layout, flagColor } of LAYOUTS) {
            const rclData = (layout as any)[rcl] as RCLLayout | undefined;
            if (!rclData) continue;

            // Determine the placement anchor for this component.
            // If a placement flag exists, translate from the layout's default
            // anchor to the flag position. Otherwise, use the layout's anchor
            // directly (coordinates are already relative to room center 25,25).
            const defaultAnchor = layout.data.anchor;
            const flag = findPlacementFlag(room, flagColor);

            // The translation offset: how far to shift from the layout's
            // default anchor to the desired placement position.
            let dx: number;
            let dy: number;

            if (flag) {
                // Translate from layout anchor to flag position.
                dx = flag.pos.x - defaultAnchor.x;
                dy = flag.pos.y - defaultAnchor.y;
            } else {
                // Default: translate from layout anchor to room center (25,25).
                dx = 25 - defaultAnchor.x;
                dy = 25 - defaultAnchor.y;
            }

            for (const structureType in rclData.buildings) {
                const positions = rclData.buildings[structureType];
                for (const pos of positions) {
                    const x = pos.x + dx;
                    const y = pos.y + dy;

                    // Skip out-of-bounds positions.
                    if (x < 0 || x > 49 || y < 0 || y > 49) continue;

                    const existing = room.lookForAt(LOOK_STRUCTURES, x, y);
                    if (existing.some(s => s.structureType === structureType)) continue;

                    const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
                    if (sites.length > 0) continue;

                    const result = room.createConstructionSite(x, y, structureType as BuildableStructureConstant);
                    if (result === OK) {
                        const source = flag ? 'flag' : 'default';
                        console.log(`[RoomPlanner] Placing ${structureType} at (${x},${y}) [${source}]`);
                        return true;  // One site per tick per room.
                    }
                }
            }
        }
        return false;
    },
};