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
};