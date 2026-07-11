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

        // Road planning: place roads from storage (or spawn) to each source.
        // Deferred to RCL3+ per Gemini — roads at RCL2 drain early energy and
        // optimal paths change once storage is placed. Only run when no other
        // construction sites are pending (lower priority than buildings).
        if (rcl >= 3) {
            const roadPlaced = this.planRoads(room);
            if (roadPlaced) return true;
        }

        return false;
    },

    // Plan roads from storage (or spawn if no storage) to each source.
    // Places one road construction site per tick along the PathFinder path.
    // Skips positions that already have roads or structures.
    planRoads(room: Room): boolean {
        // Don't plan roads if there are pending construction sites — roads
        // are lower priority than buildings.
        const pendingSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        if (pendingSites.length > 0) return false;

        const origin = room.storage ? room.storage.pos : (room.find(FIND_MY_SPAWNS)[0]?.pos || null);
        if (!origin) return false;

        const sources = room.find(FIND_SOURCES);
        for (const source of sources) {
            // Use PathFinder.search for road routing — plain cost 3, swamp 4,
            // wall 45. Existing roads cost 2 to encourage path merging.
            const result = PathFinder.search(origin, { pos: source.pos, range: 1 }, {
                roomCallback: (roomName: string) => {
                    if (roomName !== room.name) return false;
                    const costs = new PathFinder.CostMatrix();
                    // Set terrain costs.
                    const terrain = Game.map.getRoomTerrain(room.name);
                    for (let x = 0; x < 50; x++) {
                        for (let y = 0; y < 50; y++) {
                            const tile = terrain.get(x, y);
                            if (tile === TERRAIN_MASK_WALL) {
                                costs.set(x, y, 0xff);
                            } else if (tile === TERRAIN_MASK_SWAMP) {
                                costs.set(x, y, 4);
                            } else {
                                costs.set(x, y, 3);
                            }
                        }
                    }
                    // Existing roads are cheaper — encourage path reuse.
                    const roads = room.find<StructureRoad>(FIND_STRUCTURES, {
                        filter: (s: Structure) => s.structureType === STRUCTURE_ROAD,
                    });
                    for (const r of roads) {
                        costs.set(r.pos.x, r.pos.y, 2);
                    }
                    return costs;
                },
            });

            // Walk the path and find the first position without a road.
            for (const pos of result.path) {
                const existing = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                const hasRoad = existing.some(s => s.structureType === STRUCTURE_ROAD);
                if (hasRoad) continue;

                const hasSite = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y).length > 0;
                if (hasSite) continue;

                const result_code = room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
                if (result_code === OK) {
                    console.log(`[RoadPlanner] Placing road at (${pos.x},${pos.y}) toward ${source.pos.roomName}`);
                    return true;
                }
            }
        }
        return false;
    },
};