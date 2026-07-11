'use strict';

// Bunker layout adapted from Overmind's layouts/bunker.ts.
// Contains ONLY bunker-specific structures: towers, labs, factory,
// powerSpawn, observer, nuker.
// Spawns, extensions, containers are in hatchery.ts.
// Storage, links, terminal are in commandCenter.ts.
// Anchor: (25, 25) — room center.

export const BUNKER_RADIUS = 6;

interface Coord { x: number; y: number; }

export interface RCLLayout {
    buildings: { [structureType: string]: Coord[] };
}

export const bunkerLayout: { data: { anchor: Coord }; [rcl: number]: RCLLayout } = {
    data: { anchor: { x: 25, y: 25 } },

    // RCL 1-2: no bunker structures yet (first tower unlocks at RCL 3).
    1: { buildings: {} },
    2: { buildings: {} },

    3: {
        buildings: {
            tower: [{ x: 25, y: 26 }],
        },
    },

    4: {
        buildings: {
            tower: [{ x: 25, y: 26 }],
        },
    },

    5: {
        buildings: {
            tower: [{ x: 25, y: 24 }, { x: 25, y: 26 }],
        },
    },

    6: {
        buildings: {
            tower: [{ x: 25, y: 24 }, { x: 25, y: 26 }],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
            ],
            extractor: [],   // placed at mineral position dynamically
        },
    },

    7: {
        buildings: {
            tower: [{ x: 25, y: 24 }, { x: 25, y: 26 }, { x: 23, y: 26 }, { x: 26, y: 23 }],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
                { x: 21, y: 22 }, { x: 22, y: 21 }, { x: 21, y: 21 },
            ],
            factory: [{ x: 25, y: 23 }],
        },
    },

    8: {
        buildings: {
            tower: [
                { x: 25, y: 24 }, { x: 25, y: 26 }, { x: 23, y: 26 },
                { x: 26, y: 23 }, { x: 22, y: 25 }, { x: 25, y: 22 },
            ],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
                { x: 21, y: 22 }, { x: 22, y: 21 }, { x: 21, y: 21 },
            ],
            factory: [{ x: 25, y: 23 }],
            powerSpawn: [{ x: 23, y: 23 }],
            observer: [{ x: 25, y: 21 }],
            nuker: [{ x: 24, y: 22 }],
        },
    },
};