'use strict';

// Pattern-based body generator adapted from Overmind's CreepSetup.ts.
// A CreepSetup defines a repeatable body pattern that scales to any
// energy budget without hand-authoring tier tables per RCL.

export interface BodySetup {
    pattern: BodyPartConstant[];          // body pattern to be repeated
    sizeLimit: number;                     // maximum number of repetitions
    prefix?: BodyPartConstant[];           // parts always present at start
    suffix?: BodyPartConstant[];           // parts always present at end
    proportionalPrefixSuffix?: boolean;    // prefix/suffix scale with body size
    ordered?: boolean;                     // sort parts by damage priority
}

export function bodyCost(bodyparts: BodyPartConstant[]): number {
    return _.sum(bodyparts, (part: BodyPartConstant) => BODYPART_COST[part]);
}

export class CreepSetup {
    role: string;
    bodySetup: BodySetup;

    constructor(roleName: string, bodySetup: BodySetup) {
        this.role = roleName;
        this.bodySetup = {
            pattern: bodySetup.pattern || [],
            sizeLimit: bodySetup.sizeLimit !== undefined ? bodySetup.sizeLimit : Infinity,
            prefix: bodySetup.prefix || [],
            suffix: bodySetup.suffix || [],
            proportionalPrefixSuffix: bodySetup.proportionalPrefixSuffix || false,
            ordered: bodySetup.ordered !== undefined ? bodySetup.ordered : true,
        };
    }

    generateBody(availableEnergy: number): BodyPartConstant[] {
        const setup = this.bodySetup;
        let prefix = setup.prefix || [];
        let suffix = setup.suffix || [];
        const pattern = setup.pattern;
        const patternCostVal = bodyCost(pattern);
        const patternLength = pattern.length;

        let numRepeats: number;

        if (setup.proportionalPrefixSuffix) {
            const fullCost = bodyCost(prefix) + patternCostVal + bodyCost(suffix);
            const fullLength = prefix.length + patternLength + suffix.length;
            const energyLimit = Math.floor(availableEnergy / fullCost);
            const maxPartLimit = Math.floor(MAX_CREEP_SIZE / fullLength);
            numRepeats = Math.min(energyLimit, maxPartLimit, setup.sizeLimit);
        } else {
            const extraCost = bodyCost(prefix) + bodyCost(suffix);
            let energyForPattern = availableEnergy - extraCost;
            if (energyForPattern < patternCostVal) {
                if (extraCost === 0) {
                    return [];
                }
                // Fall back: pattern only, no prefix/suffix
                energyForPattern = availableEnergy;
                prefix = [];
                suffix = [];
            }
            const energyLimit = Math.floor(energyForPattern / patternCostVal);
            const maxPartLimit = Math.floor((MAX_CREEP_SIZE - prefix.length - suffix.length) / patternLength);
            numRepeats = Math.min(energyLimit, maxPartLimit, setup.sizeLimit);
        }

        if (numRepeats < 1) {
            return [];
        }

        // Assemble body
        const body: BodyPartConstant[] = [...prefix];

        const unarrangedParts: BodyPartConstant[] = [];
        for (let r = 0; r < numRepeats; r++) {
            for (let k = 0; k < patternLength; k++) {
                unarrangedParts.push(pattern[k]);
            }
        }

        if (setup.ordered) {
            // Sort by Screeps damage-priority weight:
            // TOUGH → WORK → CLAIM → ATTACK → RANGED_ATTACK → CARRY → MOVE → HEAL
            const partWeights: { [part: string]: number } = {
                tough: 1, work: 2, claim: 3, attack: 4,
                ranged_attack: 5, carry: 6, move: 7, heal: 8,
            };
            unarrangedParts.sort((a, b) =>
                (partWeights[a] || 9) - (partWeights[b] || 9)
            );
        }

        body.push(...unarrangedParts);
        body.push(...suffix);

        return body;
    }
}