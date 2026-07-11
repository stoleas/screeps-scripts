'use strict';

// Inter-player communication via RawMemory public segments.
// We write our status to segment SEGMENT_OUR (marked public) so zh0ul
// can read it. We read zh0ul's status from RawMemory.foreignSegment
// (activated in main.ts via setActiveForeignSegment).
//
// Data schema (JSON written to our segment):
// {
//   tick: number,           // when this was written
//   player: string,         // who wrote it
//   defenseRequests: [],    // rooms under attack needing help
//   energyDeficits: [],      // rooms below lowEnergyThreshold
//   attackTargets: [],       // known enemy rooms to coordinate on
// }
//
// RawMemory API:
//   - setActiveSegments([id])  → makes segment available next tick
//   - RawMemory.segments[id]   → read/write segment data (saved at end of tick)
//   - setPublicSegments([id])  → marks segment readable by other players
//   - setActiveForeignSegment(user, id) → requests ally's segment for next tick
//   - RawMemory.foreignSegment → { username, id, data } from ally

import { ALLIANCE } from './alliance';

export interface DefenseRequest {
    roomName: string;
    threatLevel: number;  // 1-10 scale
    enemyCount: number;
}

export interface EnergyDeficit {
    roomName: string;
    energy: number;       // current storage energy
    needed: number;       // how much we need
}

export interface AttackTarget {
    roomName: string;
    priority: number;
}

export interface AllyMessage {
    tick: number;
    player: string;
    defenseRequests: DefenseRequest[];
    energyDeficits: EnergyDeficit[];
    attackTargets: AttackTarget[];
}

export const comms = {
    // Write our status to our public segment for zh0ul to read.
    // Requires segment to be activated (setActiveSegments called previously).
    publishOurStatus(): void {
        const message: AllyMessage = {
            tick: Game.time,
            player: ALLIANCE.allies[0],  // our username
            defenseRequests: this.gatherDefenseRequests(),
            energyDeficits: this.gatherEnergyDeficits(),
            attackTargets: [],  // populated by scout/intel system later
        };

        // Write data to our segment (saved at end of tick).
        RawMemory.segments[ALLIANCE.SEGMENT_OUR] = JSON.stringify(message);

        // Mark it public so zh0ul can read via setActiveForeignSegment.
        RawMemory.setPublicSegments([ALLIANCE.SEGMENT_OUR]);
    },

    // Read zh0ul's published status from the foreign segment.
    // The foreign segment is activated in main.ts on the comms interval.
    readAllyStatus(): AllyMessage | null {
        const raw = RawMemory.foreignSegment.data;
        if (!raw) return null;
        try {
            return JSON.parse(raw) as AllyMessage;
        } catch (e) {
            console.log('[Comms] Failed to parse ally segment:', e);
            return null;
        }
    },

    // Gather defense requests from our owned rooms under attack.
    gatherDefenseRequests(): DefenseRequest[] {
        const requests: DefenseRequest[] = [];
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const hostiles = room.find(FIND_HOSTILE_CREEPS, {
                filter: (c: Creep) => !ALLIANCE.allies.includes(c.owner.username),
            });
            if (hostiles.length > 0) {
                requests.push({
                    roomName: room.name,
                    threatLevel: Math.min(10, hostiles.length),
                    enemyCount: hostiles.length,
                });
            }
        }
        return requests;
    },

    // Gather rooms below the energy threshold.
    gatherEnergyDeficits(): EnergyDeficit[] {
        const deficits: EnergyDeficit[] = [];
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const storage = room.storage;
            const energy = storage ? (storage.store[RESOURCE_ENERGY] || 0) : 0;
            if (energy < ALLIANCE.lowEnergyThreshold) {
                deficits.push({
                    roomName: room.name,
                    energy,
                    needed: ALLIANCE.lowEnergyThreshold - energy,
                });
            }
        }
        return deficits;
    },
};