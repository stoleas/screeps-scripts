'use strict';

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';
import { bodyFactory } from '../bodyFactory';
import { CombatPlanner, RoomThreat } from '../strategy/CombatPlanner';
import { isAlly, isAllyByFlag, isAllyBySign } from '../alliance';
import { Movement } from '../movement/Movement';

// CombatOverlord operates in two modes:
// - Defensive: colony-scoped, reacts to hostiles in the colony's home room.
// - Offensive: flag-based, targets a remote room via attack:<roomName> flag.
export class CombatOverlord extends Overlord {
    targetRoomName: string | null;  // null = defensive (home room)
    threat: RoomThreat | null;

    constructor(colony: Colony, targetRoomName?: string) {
        const name = targetRoomName ? `combat_${targetRoomName}` : 'combat';
        super(colony, name, Priority.High);
        this.targetRoomName = targetRoomName || null;
        this.threat = null;
    }

    // The room to evaluate and defend/attack.
    private get targetRoom(): Room | null {
        if (this.targetRoomName) {
            return Game.rooms[this.targetRoomName] || null;
        }
        return this.colony.room;
    }

    init(hatchery: Hatchery): void {
        const room = this.targetRoom;
        if (!room) return;

        this.threat = CombatPlanner.evaluateRoom(room);
        if (this.threat.dangerScore > 0) {
            // Scale defender count with threat: 1 brawler per 3 danger, min 1, max 4.
            const count = Math.min(4, Math.max(1, Math.ceil(this.threat.dangerScore / 3)));
            this.requestCreep(hatchery, bodyFactory.PROFILES.brawler, 'brawler', count);
        }
    }

    run(): void {
        if (!this.threat || this.threat.dangerScore === 0) return;

        const room = this.targetRoom;
        if (!room) return;

        const brawlers = this.creeps['brawler'] || [];
        const signAlly = isAllyBySign(room);

        // Re-evaluate hostiles each tick (they may have died or moved).
        const hostiles = room.find(FIND_HOSTILE_CREEPS, {
            filter: (c: Creep) =>
                !isAlly(c.owner.username) &&
                !isAllyByFlag(c.owner.username) &&
                c.owner.username !== signAlly,
        });

        for (const creep of brawlers) {
            // Move to target room if not there yet (offensive mode).
            if (this.targetRoomName && creep.room.name !== this.targetRoomName) {
                const targetPos = new RoomPosition(25, 25, this.targetRoomName);
                Movement.move(creep, targetPos, 20);
                continue;
            }

            if (hostiles.length === 0) {
                // No hostiles — rally near spawn (defensive) or room center (offensive).
                if (this.targetRoomName) {
                    const rally = new RoomPosition(25, 25, this.targetRoomName);
                    if (!creep.pos.inRangeTo(rally, 10)) {
                        Movement.move(creep, rally, 10);
                    }
                } else {
                    const rally = this.colony.spawns[0];
                    if (rally && !creep.pos.inRangeTo(rally.pos, 3)) {
                        Movement.move(creep, rally.pos, 3);
                    }
                }
                continue;
            }

            // Attack closest hostile.
            const target = creep.pos.findClosestByRange(hostiles);
            if (target) {
                if (!creep.pos.isNearTo(target)) {
                    Movement.move(creep, target.pos, 1);
                }
                creep.attack(target);
            }
        }
    }
}