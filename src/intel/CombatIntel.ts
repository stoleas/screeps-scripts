'use strict';

import { CombatPlanner } from '../strategy/CombatPlanner';

// Two-tier intel expiry constants.
const FAST_FIELD_EXPIRY = 1000;   // ticks before tactical data is unreliable
const SLOW_FIELD_EXPIRY = 5000;   // ticks before structural data is forgotten

export class CombatIntel {
    static scanRoom(room: Room): void {
        if (!Memory.rooms) Memory.rooms = {};

        const threat = CombatPlanner.evaluateRoom(room);
        const controller = room.controller;

        Memory.rooms[room.name] = Memory.rooms[room.name] || {};

        // Merge with existing intel so we don't lose slow fields if we only
        // briefly glimpse the room (e.g. a creep passing through without
        // controller vision — threat data still valid, structural data
        // may not be visible).
        const existing: Partial<NonNullable<RoomMemory['intel']>> =
            Memory.rooms[room.name].intel || {};
        Memory.rooms[room.name].intel = {
            // Slow fields — update only if we can see the controller.
            tick: Game.time,
            owner: controller?.owner?.username ?? existing.owner,
            rcl: controller?.level ?? existing.rcl,
            sourceCount: room.find(FIND_SOURCES).length || existing.sourceCount,
            hasStorage: (room.storage !== undefined) || existing.hasStorage,
            // Fast fields — always overwrite with fresh scan.
            fastTick: Game.time,
            hostileCount: threat.hostileCount,
            dangerScore: threat.dangerScore,
            hasTowerThreat: threat.hasTowerThreat,
            hasHealers: threat.hasHealers,
            hasRanged: threat.hasRanged,
        };
    }

    static getIntel(roomName: string): RoomMemory['intel'] | null {
        const roomMem = Memory.rooms?.[roomName];
        if (!roomMem || !roomMem.intel) return null;

        const intel = roomMem.intel;

        // Inline expiry: if fast fields are older than 1000 ticks, zero them
        // on read so the caller knows they are unreliable.
        if (intel.fastTick !== undefined && (Game.time - intel.fastTick) > FAST_FIELD_EXPIRY) {
            intel.hostileCount = 0;
            intel.dangerScore = 0;
            intel.hasTowerThreat = false;
            intel.hasHealers = false;
            intel.hasRanged = false;
        }

        return intel;
    }

    // Scan all currently-visible rooms. Called once per tick from main.
    static scanVisibleRooms(): void {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            // Skip owned rooms without hostiles (colony logic handles those).
            if (room.controller && room.controller.my && !room.find(FIND_HOSTILE_CREEPS).length) {
                continue;
            }
            this.scanRoom(room);
        }
    }
}