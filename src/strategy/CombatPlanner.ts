'use strict';

import { isAlly, isAllyByFlag, isAllyBySign } from '../alliance';

export interface RoomThreat {
    dangerScore: number;       // Normalized 0-10
    hasHealers: boolean;
    hasRanged: boolean;
    hasTowerThreat: boolean;
    hostileCount: number;
    ticksToSafeMode: number;
}

export class CombatPlanner {
    static evaluateRoom(room: Room): RoomThreat {
        // Filter hostiles through all three ally IFF mechanisms.
        // Allied creeps are NOT threats — this prevents friendly fire.
        const signAlly = isAllyBySign(room);
        const hostiles = room.find(FIND_HOSTILE_CREEPS, {
            filter: (c: Creep) =>
                !isAlly(c.owner.username) &&
                !isAllyByFlag(c.owner.username) &&
                c.owner.username !== signAlly,
        });

        let dangerScore = 0;
        let hasHealers = false;
        let hasRanged = false;

        for (const creep of hostiles) {
            const parts = _.countBy(creep.body, 'type');
            if (parts[ATTACK]) dangerScore += 2 * parts[ATTACK];
            if (parts[RANGED_ATTACK]) {
                dangerScore += 3 * parts[RANGED_ATTACK];
                hasRanged = true;
            }
            if (parts[HEAL]) {
                dangerScore += 4 * parts[HEAL];
                hasHealers = true;
            }
            if (parts[WORK]) dangerScore += 1 * parts[WORK];
        }

        // Enemy towers with energy are a structural threat.
        const hostileTowers = room.find(FIND_HOSTILE_STRUCTURES, {
            filter: (s: Structure) =>
                s.structureType === STRUCTURE_TOWER &&
                (s as StructureTower).store[RESOURCE_ENERGY] > 0,
        });

        return {
            dangerScore: Math.min(dangerScore, 10),
            hasHealers,
            hasRanged,
            hasTowerThreat: hostileTowers.length > 0,
            hostileCount: hostiles.length,
            ticksToSafeMode: room.controller?.safeMode || 0,
        };
    }
}