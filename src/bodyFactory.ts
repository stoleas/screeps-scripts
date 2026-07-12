'use strict';

import { CreepSetup, bodyCost } from './creepSetup';

// Role → CreepSetup registry. The forRole() interface is unchanged
// from the JS version, so main.ts doesn't need modification.
//
// The pattern approach means RCL3 (800 energy), RCL4 (1300), RCL5 (1800)
// all get the right body automatically — the pattern repeats as many
// times as the energy budget allows, capped by sizeLimit and MAX_CREEP_SIZE.

const PROFILES: { [role: string]: CreepSetup } = {
    // Harvester: 2W+1C per repeat, 3 MOVE for 3 fat parts (1:1 ratio).
    // sizeLimit=4 → max 4 repeats = 8W+4C+12M = 24 parts, 1400 energy.
    harvester: new CreepSetup('harvester', {
        pattern: [WORK, WORK, CARRY, MOVE, MOVE, MOVE],  // 350 per repeat
        sizeLimit: 4,
    }),

    // RCL1 fallback: [WORK, CARRY, MOVE] = 200, fits the 300-energy spawn.
    harvesterStarter: new CreepSetup('harvester', {
        pattern: [WORK, CARRY, MOVE],  // 200 per repeat
        sizeLimit: 1,
    }),

    upgrader: new CreepSetup('upgrader', {
        pattern: [WORK, WORK, CARRY, MOVE, MOVE, MOVE],  // 350 per repeat
        sizeLimit: 4,
    }),

    upgraderStarter: new CreepSetup('upgrader', {
        pattern: [WORK, CARRY, MOVE],
        sizeLimit: 1,
    }),

    builder: new CreepSetup('builder', {
        pattern: [WORK, CARRY, CARRY, MOVE, MOVE, MOVE],  // 350 per repeat
        sizeLimit: 4,
    }),

    builderStarter: new CreepSetup('builder', {
        pattern: [WORK, CARRY, MOVE],
        sizeLimit: 1,
    }),

    // Miner: static miner that sits on a container next to a source.
    // 5W+2M per repeat = 550 energy, sizeLimit=1 → max 5W+2M = 7 parts, 550 energy.
    // No CARRY: drops energy onto container, haulers pick it up.
    miner: new CreepSetup('miner', {
        pattern: [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE],  // 550 per repeat
        sizeLimit: 1,
    }),

    // RCL1-2 fallback: [WORK, WORK, MOVE] = 250 energy, fits 300-energy spawn.
    minerStarter: new CreepSetup('miner', {
        pattern: [WORK, WORK, MOVE],  // 250 per repeat
        sizeLimit: 1,
    }),

    // Hauler: CARRY-heavy for container→storage transport (RCL4+).
    // 2C+2M per repeat = 200 energy, 1:1 fat:MOVE ratio (full speed).
    hauler: new CreepSetup('hauler', {
        pattern: [CARRY, CARRY, MOVE, MOVE],  // 200 per repeat
        sizeLimit: 6,
    }),

    // Brawler: melee fighter for defense. TOUGH+ATTACK+MOVE x2 per repeat.
    // 1 TOUGH (10) + 1 ATTACK (80) + 2 MOVE (100) = 190 per repeat.
    // sizeLimit=5 → max 5 repeats = 5T+5A+10M = 20 parts, 950 energy.
    brawler: new CreepSetup('brawler', {
        pattern: [TOUGH, ATTACK, MOVE, MOVE],  // 190 per repeat
        sizeLimit: 5,
    }),

    // RCL1-2 fallback: minimal defender that fits 300-energy spawn.
    brawlerStarter: new CreepSetup('brawler', {
        pattern: [TOUGH, ATTACK, MOVE],  // 110 per repeat
        sizeLimit: 2,
    }),
};

// Body-signature → role mapping for purpose inference.
// Ordered by specificity — first match wins.
const BODY_SIGNATURES: { role: string; test: (parts: { [key: string]: number }) => boolean }[] = [
    // Miner: WORK-heavy, NO CARRY (static, drops on container)
    { role: 'miner',     test: p => (p[WORK] || 0) >= 3 && (p[CARRY] || 0) === 0 },
    // Hauler: CARRY-heavy, no or minimal WORK
    { role: 'hauler',    test: p => (p[CARRY] || 0) >= 2 && (p[WORK] || 0) === 0 },
    // Brawler: has ATTACK or RANGED_ATTACK
    { role: 'brawler',   test: p => (p[ATTACK] || 0) > 0 || (p[RANGED_ATTACK] || 0) > 0 },
    // Healer: has HEAL
    { role: 'healer',    test: p => (p[HEAL] || 0) > 0 },
    // Harvester: mixed WORK + CARRY (also matches upgrader/builder — ambiguous, overlord disambiguates)
    { role: 'harvester', test: p => (p[WORK] || 0) > 0 && (p[CARRY] || 0) > 0 },
    // Claimer: has CLAIM
    { role: 'claimer',   test: p => (p[CLAIM] || 0) > 0 },
];

export const bodyFactory = {
    COSTS: BODYPART_COST,

    costOf(body: BodyPartConstant[]): number {
        return bodyCost(body);
    },

    PROFILES,

    forRole(energy: number, role: string): BodyPartConstant[] {
        const profile = PROFILES[role];
        if (!profile) {
            return [WORK, CARRY, MOVE];
        }
        let body = profile.generateBody(energy);
        if (body.length === 0) {
            const starter = PROFILES[role + 'Starter'];
            if (starter) {
                body = starter.generateBody(energy);
            }
        }
        return body;
    },

    inferRole(body: BodyPartDefinition[] | BodyPartConstant[]): string {
        const parts: { [key: string]: number } = {};
        for (const part of body) {
            const type = typeof part === 'string' ? part : (part as BodyPartDefinition).type;
            parts[type] = (parts[type] || 0) + 1;
        }
        for (const sig of BODY_SIGNATURES) {
            if (sig.test(parts)) return sig.role;
        }
        return 'unknown';
    },
};