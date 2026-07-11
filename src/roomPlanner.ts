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

        // Find existing spawns in the room. If a spawn already exists and no
        // placement flag is set, we snap the hatchery layout to the existing
        // spawn position so extensions and containers are placed relative to
        // the actual spawn rather than the default (25,24). This keeps the
        // planner backwards-compatible with rooms that were already seeded
        // with a spawn at an arbitrary position.
        const spawns = room.find(FIND_MY_SPAWNS);
        const firstSpawnPos = spawns.length > 0 ? spawns[0].pos : null;

        for (const { name, layout, flagColor } of LAYOUTS) {
            const rclData = (layout as any)[rcl] as RCLLayout | undefined;
            if (!rclData) continue;

            const defaultAnchor = layout.data.anchor;
            const flag = findPlacementFlag(room, flagColor);

            // Determine the translation offset for this component.
            let dx: number;
            let dy: number;

            if (flag) {
                // Placement flag overrides everything.
                dx = flag.pos.x - defaultAnchor.x;
                dy = flag.pos.y - defaultAnchor.y;
            } else if (name === 'hatchery' && firstSpawnPos) {
                // Backwards-compat: snap hatchery to existing spawn.
                // The hatchery layout's first spawn is at its anchor (25,24).
                // We translate so that (25,24) lands on the actual spawn.
                dx = firstSpawnPos.x - defaultAnchor.x;
                dy = firstSpawnPos.y - defaultAnchor.y;
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
                        const source = flag ? 'flag' : (name === 'hatchery' && firstSpawnPos) ? 'spawn' : 'default';
                        console.log(`[RoomPlanner] Placing ${structureType} at (${x},${y}) [${source}]`);
                        return true;  // One site per tick per room.
                    }
                }
            }
        }
        return false;
    },
};