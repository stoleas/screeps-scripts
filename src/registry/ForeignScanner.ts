'use strict';

import { isAlly, isAllyByFlag, isAllyBySign } from '../alliance';
import { EventEmitter } from '../events/EventEmitter';

// ForeignScanner: scans owned rooms for foreign non-ally creeps,
// classifies them by body composition, creates/removes attack flags,
// and emits intrusion events to Memory.events.
//
// Classification (Decision #4):
// - ENERGY_THIEF: WORK parts near sources (dist ≤ 2)
// - ARMED_SCOUT: ATTACK/RANGED_ATTACK parts
// - CLAIMER: CLAIM part
// - SCOUT: small body, no combat/work parts
//
// ALL foreign non-ally creeps get attack: flags (Decision #6 — always RED).
// Flags auto-remove after 100 consecutive clear ticks with vision (Decision #7/#16).
// Timer pauses on vision loss — we never remove what we can't see.

const CLEAR_TICKS = 100;  // Decision #16: 100 ticks clearance before flag removal

type Classification = 'ENERGY_THIEF' | 'ARMED_SCOUT' | 'CLAIMER' | 'SCOUT' | 'ALLY';

export const ForeignScanner = {
    scan(): void {
        // Get all owned rooms.
        const ownedRooms = Object.values(Game.rooms).filter(
            r => r.controller && r.controller.my,
        );

        // Track which rooms currently have foreign threats.
        const threatenedRooms = new Set<string>();

        for (const room of ownedRooms) {
            const signAlly = isAllyBySign(room);
            const foreignCreeps = room.find(FIND_HOSTILE_CREEPS, {
                filter: (c: Creep) =>
                    !isAlly(c.owner.username) &&
                    !isAllyByFlag(c.owner.username) &&
                    c.owner.username !== signAlly,
            });

            if (foreignCreeps.length === 0) {
                // No foreign creeps — check clearance timer for existing flag.
                this.checkClearance(room);
                continue;
            }

            // Foreign creeps present — ensure flag exists, classify each.
            threatenedRooms.add(room.name);

            for (const creep of foreignCreeps) {
                const classification = this.classify(creep, room);
                if (classification === 'ALLY') continue;

                // Emit intrusion event.
                EventEmitter.emit('INTRUSION', {
                    room: room.name,
                    creepName: creep.name,
                    owner: creep.owner.username,
                    bodyParts: creep.body.map(b => b.type),
                    classification,
                    flagAction: 'NONE',
                });
            }

            // Ensure flag exists (create if not).
            const flagName = 'attack:' + room.name;
            if (!Game.flags[flagName]) {
                // Create flag at room center (CombatOverlord uses 25,25 as rally).
                const result = room.createFlag(25, 25, flagName, COLOR_RED);
                if (result === flagName || typeof result === 'string') {
                    console.log(`[ForeignScanner] Created ${flagName} — ${foreignCreeps.length} foreign creep(s) in ${room.name}`);
                    EventEmitter.emit('FLAG_CREATED', {
                        room: room.name,
                        classification: foreignCreeps.map(c => this.classify(c, room)).filter(c => c !== 'ALLY'),
                    });
                }
            }

            // Reset clearance timer — room is threatened.
            const flag = Game.flags[flagName];
            if (flag) {
                flag.memory.clearSince = 0;
            }
        }

        // Also check flags for rooms we HAD vision of but may have lost.
        // Timer pauses on vision loss (Decision #7).
        for (const flagName in Game.flags) {
            if (!flagName.startsWith('attack:')) continue;
            const roomName = flagName.slice('attack:'.length);
            if (threatenedRooms.has(roomName)) continue;  // already handled
            if (!(roomName in Game.rooms)) continue;       // no vision — timer pauses
            // We have vision but no foreign creeps — check clearance.
            const room = Game.rooms[roomName];
            if (room) this.checkClearance(room);
        }
    },

    classify(creep: Creep, room: Room): Classification {
        const parts: { [key: string]: number } = {};
        for (const b of creep.body) {
            parts[b.type] = (parts[b.type] || 0) + 1;
        }

        // ENERGY_THIEF: WORK parts near a source (dist ≤ 2).
        if ((parts[WORK] || 0) > 0) {
            const sources = room.find(FIND_SOURCES);
            const nearSource = sources.some(s => creep.pos.inRangeTo(s.pos, 2));
            if (nearSource) return 'ENERGY_THIEF';
        }

        // CLAIMER: has CLAIM part.
        if ((parts[CLAIM] || 0) > 0) return 'CLAIMER';

        // ARMED_SCOUT: has ATTACK or RANGED_ATTACK.
        if ((parts[ATTACK] || 0) > 0 || (parts[RANGED_ATTACK] || 0) > 0) return 'ARMED_SCOUT';

        // SCOUT: everything else (small body, no combat/work parts).
        return 'SCOUT';
    },

    checkClearance(room: Room): void {
        const flagName = 'attack:' + room.name;
        const flag = Game.flags[flagName];
        if (!flag) return;  // no flag to clear

        // Increment clearance timer.
        const clearSince = (flag.memory.clearSince || 0) + 1;
        flag.memory.clearSince = clearSince;

        if (clearSince >= CLEAR_TICKS) {
            // Remove the flag — room is clear.
            flag.remove();
            console.log(`[ForeignScanner] Removed ${flagName} — clear for ${CLEAR_TICKS} ticks`);
            EventEmitter.emit('FLAG_REMOVED', {
                room: room.name,
                clearDuration: CLEAR_TICKS,
            });
        }
    },
};