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

// All layouts with their default anchors.
const LAYOUTS: { name: string; layout: { data: { anchor: Coord }; [rcl: number]: RCLLayout } }[] = [
    { name: 'hatchery', layout: hatcheryLayout },
    { name: 'commandCenter', layout: commandCenterLayout },
    { name: 'bunker', layout: bunkerLayout },
];

// Flag colors for manual component placement (matching Overmind):
// white/red = bunker, white/green = hatchery, white/blue = commandCenter
// If no placement flags exist, all components use their default anchor
// (room center 25,25).

export const roomPlanner = {
    plan(room: Room): boolean {
        if (!room.controller) return false;
        const rcl = room.controller.level;

        let placedAny = false;

        for (const { layout } of LAYOUTS) {
            const rclData = (layout as any)[rcl] as RCLLayout | undefined;
            if (!rclData) continue;

            // Default: use the layout's anchor as the placement position.
            // No translation needed — coordinates are already absolute
            // relative to room center (25,25).
            // (Future: check for placement flags and translate from
            // layout anchor to flag position.)
            const anchor = layout.data.anchor;

            for (const structureType in rclData.buildings) {
                const positions = rclData.buildings[structureType];
                for (const pos of positions) {
                    // Translate from layout anchor to room center (25,25).
                    const dx = 25 - anchor.x;
                    const dy = 25 - anchor.y;
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
                        console.log(`[RoomPlanner] Placing ${structureType} at (${x},${y})`);
                        return true;  // One site per tick per room.
                    }
                }
            }
        }
        return false;
    },
};