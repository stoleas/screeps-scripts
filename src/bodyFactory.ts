'use strict';

// Body part cost table. Keys MUST match runtime constants (lowercase strings).
const COSTS: { [part: string]: number } = {
    move: 50,
    work: 100,
    carry: 50,
    attack: 80,
    ranged_attack: 150,
    heal: 250,
    tough: 10,
    claim: 600
};

interface BodyProfile {
    name: string;
    body: BodyPartConstant[];
}

const PROFILES: { [role: string]: BodyProfile[] } = {
    harvester: [
        { name: 'tier1', body: [WORK, CARRY, MOVE] },
        { name: 'tier2', body: [WORK, WORK, CARRY, MOVE, MOVE, MOVE] },
        { name: 'tier3', body: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] },
        { name: 'tier4', body: [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE] }
    ],
    upgrader: [
        { name: 'tier1', body: [WORK, CARRY, MOVE] },
        { name: 'tier2', body: [WORK, WORK, CARRY, MOVE, MOVE, MOVE] },
        { name: 'tier3', body: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] }
    ],
    builder: [
        { name: 'tier1', body: [WORK, CARRY, MOVE] },
        { name: 'tier2', body: [WORK, CARRY, CARRY, MOVE, MOVE, MOVE] },
        { name: 'tier3', body: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] }
    ],
    hauler: []
};

export const bodyFactory = {
    COSTS,

    costOf(body: BodyPartConstant[]): number {
        let total = 0;
        for (const part of body) {
            total += COSTS[part] || 0;
        }
        return total;
    },

    PROFILES,

    forRole(energy: number, role: string): BodyPartConstant[] {
        const profiles = this.PROFILES[role];
        if (!profiles) {
            return [WORK, CARRY, MOVE];
        }
        let chosen: BodyProfile | null = null;
        for (const profile of profiles) {
            if (this.costOf(profile.body) <= energy) {
                chosen = profile;
            }
        }
        return chosen ? chosen.body : [];
    }
};