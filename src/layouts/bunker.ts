'use strict';

// Bunker room layout adapted from Overmind's layouts/bunker.ts.
// Pre-computed structure coordinates relative to room center (25,25).
// RCL 1-4 defined here. RCL 5-8 added in Phase 3.

export const BUNKER_RADIUS = 6;

interface Coord { x: number; y: number; }

export interface RCLLayout {
    buildings: { [structureType: string]: Coord[] };
}

export const bunkerLayout: { data: { anchor: Coord }; [rcl: number]: RCLLayout } = {
    data: { anchor: { x: 25, y: 25 } },

    1: {
        buildings: {
            spawn: [{ x: 29, y: 25 }],
        },
    },

    2: {
        buildings: {
            spawn: [{ x: 29, y: 25 }],
            extension: [
                { x: 28, y: 26 }, { x: 28, y: 27 }, { x: 27, y: 27 },
                { x: 27, y: 28 }, { x: 29, y: 26 },
            ],
            container: [{ x: 27, y: 30 }],
        },
    },

    3: {
        buildings: {
            spawn: [{ x: 29, y: 25 }],
            extension: [
                { x: 28, y: 26 }, { x: 29, y: 27 }, { x: 28, y: 27 },
                { x: 27, y: 27 }, { x: 27, y: 28 }, { x: 28, y: 28 },
                { x: 29, y: 28 }, { x: 28, y: 29 }, { x: 27, y: 29 },
                { x: 29, y: 26 },
            ],
            tower: [{ x: 25, y: 26 }],
            container: [{ x: 27, y: 30 }],
        },
    },

    4: {
        buildings: {
            spawn: [{ x: 29, y: 25 }],
            extension: [
                { x: 28, y: 26 }, { x: 29, y: 27 }, { x: 28, y: 27 },
                { x: 27, y: 27 }, { x: 27, y: 28 }, { x: 28, y: 28 },
                { x: 29, y: 28 }, { x: 28, y: 29 }, { x: 27, y: 29 },
                { x: 29, y: 26 }, { x: 26, y: 27 }, { x: 26, y: 28 },
                { x: 29, y: 29 }, { x: 27, y: 26 }, { x: 30, y: 27 },
                { x: 30, y: 28 }, { x: 26, y: 29 }, { x: 30, y: 29 },
                { x: 27, y: 30 }, { x: 29, y: 30 },
            ],
            tower: [{ x: 25, y: 26 }],
            storage: [{ x: 24, y: 25 }],
            container: [{ x: 27, y: 30 }],
        },
    },

    5: {
        buildings: {
            spawn: [{ x: 29, y: 25 }],
            extension: [
                // RCL4 extensions (carried forward) + 10 more
                { x: 28, y: 26 }, { x: 29, y: 27 }, { x: 28, y: 27 },
                { x: 27, y: 27 }, { x: 27, y: 28 }, { x: 28, y: 28 },
                { x: 29, y: 28 }, { x: 28, y: 29 }, { x: 27, y: 29 },
                { x: 29, y: 26 }, { x: 26, y: 27 }, { x: 26, y: 28 },
                { x: 29, y: 29 }, { x: 27, y: 26 }, { x: 30, y: 27 },
                { x: 30, y: 28 }, { x: 26, y: 29 }, { x: 30, y: 29 },
                { x: 27, y: 30 }, { x: 29, y: 30 },
                // 10 new for RCL5
                { x: 25, y: 27 }, { x: 26, y: 26 }, { x: 24, y: 26 },
                { x: 24, y: 27 }, { x: 25, y: 28 }, { x: 26, y: 30 },
                { x: 28, y: 30 }, { x: 30, y: 30 }, { x: 31, y: 28 },
                { x: 31, y: 29 },
            ],
            tower: [{ x: 25, y: 26 }, { x: 26, y: 25 }],
            link: [{ x: 25, y: 25 }],       // core hub link near storage
            storage: [{ x: 24, y: 25 }],
            container: [{ x: 27, y: 30 }],
        },
    },

    6: {
        buildings: {
            spawn: [{ x: 29, y: 25 }],
            extension: [
                // RCL5 set + 10 more (20 total new at RCL6)
                { x: 25, y: 27 }, { x: 26, y: 26 }, { x: 24, y: 26 },
                { x: 24, y: 27 }, { x: 25, y: 28 }, { x: 26, y: 30 },
                { x: 28, y: 30 }, { x: 30, y: 30 }, { x: 31, y: 28 },
                { x: 31, y: 29 },
                { x: 23, y: 27 }, { x: 23, y: 28 }, { x: 24, y: 28 },
                { x: 25, y: 29 }, { x: 27, y: 31 }, { x: 31, y: 30 },
                { x: 32, y: 28 }, { x: 32, y: 29 }, { x: 32, y: 30 },
                { x: 31, y: 31 },
            ],
            tower: [{ x: 25, y: 26 }, { x: 26, y: 25 }],
            link: [{ x: 25, y: 25 }],
            storage: [{ x: 24, y: 25 }],
            container: [{ x: 27, y: 30 }],
            terminal: [{ x: 26, y: 24 }],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
            ],
            extractor: [],   // placed at mineral position dynamically
        },
    },

    7: {
        buildings: {
            spawn: [{ x: 29, y: 25 }, { x: 25, y: 29 }],
            extension: [
                // RCL6 set + 10 more
                { x: 23, y: 27 }, { x: 23, y: 28 }, { x: 24, y: 28 },
                { x: 25, y: 29 }, { x: 27, y: 31 }, { x: 31, y: 30 },
                { x: 32, y: 28 }, { x: 32, y: 29 }, { x: 32, y: 30 },
                { x: 31, y: 31 },
                { x: 23, y: 26 }, { x: 24, y: 24 }, { x: 25, y: 24 },
                { x: 26, y: 23 }, { x: 27, y: 24 }, { x: 28, y: 23 },
                { x: 33, y: 28 }, { x: 33, y: 29 }, { x: 33, y: 30 },
                { x: 32, y: 31 },
            ],
            tower: [{ x: 25, y: 26 }, { x: 26, y: 25 }, { x: 23, y: 26 }, { x: 26, y: 23 }],
            link: [{ x: 25, y: 25 }],
            storage: [{ x: 24, y: 25 }],
            container: [{ x: 27, y: 30 }],
            terminal: [{ x: 26, y: 24 }],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
                { x: 21, y: 22 }, { x: 22, y: 21 }, { x: 21, y: 21 },
            ],
            factory: [{ x: 25, y: 23 }],
        },
    },

    8: {
        buildings: {
            spawn: [{ x: 29, y: 25 }, { x: 25, y: 29 }, { x: 24, y: 24 }],
            extension: [
                // Full set (60 extensions at RCL8) — cumulative from RCL7
                { x: 23, y: 27 }, { x: 23, y: 28 }, { x: 24, y: 28 },
                { x: 25, y: 29 }, { x: 27, y: 31 }, { x: 31, y: 30 },
                { x: 32, y: 28 }, { x: 32, y: 29 }, { x: 32, y: 30 },
                { x: 31, y: 31 },
                { x: 23, y: 26 }, { x: 24, y: 24 }, { x: 25, y: 24 },
                { x: 26, y: 23 }, { x: 27, y: 24 }, { x: 28, y: 23 },
                { x: 33, y: 28 }, { x: 33, y: 29 }, { x: 33, y: 30 },
                { x: 32, y: 31 },
            ],
            tower: [
                { x: 25, y: 26 }, { x: 26, y: 25 }, { x: 23, y: 26 },
                { x: 26, y: 23 }, { x: 22, y: 25 }, { x: 25, y: 22 },
            ],
            link: [{ x: 25, y: 25 }],
            storage: [{ x: 24, y: 25 }],
            container: [{ x: 27, y: 30 }],
            terminal: [{ x: 26, y: 24 }],
            lab: [
                { x: 22, y: 22 }, { x: 22, y: 23 }, { x: 23, y: 22 },
                { x: 21, y: 22 }, { x: 22, y: 21 }, { x: 21, y: 21 },
            ],
            factory: [{ x: 25, y: 23 }],
            powerSpawn: [{ x: 23, y: 23 }],
            observer: [{ x: 25, y: 21 }],
        },
    },
};