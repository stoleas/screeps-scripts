'use strict';

// Command center layout adapted from Overmind's layouts/commandCenter.ts.
// Contains: storage, links, terminal, roads.
// Anchor: (25, 25) — room center, overlapping with bunker's anchor.
// The two components use different coordinates within the same area.

import { RCLLayout } from './bunker';

export const commandCenterLayout: { data: { anchor: { x: number; y: number } }; [rcl: number]: RCLLayout } = {
    data: { anchor: { x: 25, y: 25 } },

    // RCL 1-3: no command center structures yet (storage unlocks at RCL 4).
    1: { buildings: {} },
    2: { buildings: {} },
    3: { buildings: {} },

    4: {
        buildings: {
            storage: [{ x: 24, y: 25 }],
            link: [{ x: 25, y: 25 }],
        },
    },

    5: {
        buildings: {
            storage: [{ x: 24, y: 25 }],
            link: [{ x: 25, y: 25 }],
        },
    },

    6: {
        buildings: {
            storage: [{ x: 24, y: 25 }],
            link: [{ x: 25, y: 25 }, { x: 23, y: 25 }],
            terminal: [{ x: 26, y: 24 }],
        },
    },

    7: {
        buildings: {
            storage: [{ x: 24, y: 25 }],
            link: [{ x: 25, y: 25 }, { x: 23, y: 25 }, { x: 27, y: 25 }],
            terminal: [{ x: 26, y: 24 }],
        },
    },

    8: {
        buildings: {
            storage: [{ x: 24, y: 25 }],
            link: [{ x: 25, y: 25 }, { x: 23, y: 25 }, { x: 27, y: 25 }, { x: 25, y: 23 }],
            terminal: [{ x: 26, y: 24 }],
        },
    },
};