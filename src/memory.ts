'use strict';

// Memory management adapted from Overmind's Memory.ts.

import { EventEmitter } from './events/EventEmitter';

export const Mem = {
    BUCKET_CRITICAL: 500,
    BUCKET_CLEAR_CACHE: 4000,
    HEAP_CLEAN_FREQUENCY: 200,

    shouldRun(): boolean {
        if (Game.cpu.bucket < this.BUCKET_CRITICAL) {
            console.log(`[Mem] CPU bucket critically low (${Game.cpu.bucket}), skipping tick`);
            return false;
        }
        return true;
    },

    load(): void {
        if (!Memory.creeps) Memory.creeps = {};
        if (!Memory.rooms) Memory.rooms = {};
        if (!Memory.stats) Memory.stats = {};
    },

    clean(): void {
        // Clean dead creep memory
        for (const name in Memory.creeps) {
            if (!(name in Game.creeps)) {
                // Emit death event before deleting memory.
                const creepMem = Memory.creeps[name] as any;
                EventEmitter.emit('CREEP_DEATH', {
                    creepName: name,
                    role: creepMem.role || 'unknown',
                    colony: creepMem.colony || 'unknown',
                    age: 1500 - (creepMem._moveData?.stuckCount || 0),  // approximate
                });
                delete Memory.creeps[name];
                console.log('[Mem] Clearing dead creep memory:', name);
            }
        }

        // Clean stale room memory — two-tier selective field expiry.
        if (Memory.rooms) {
            for (const roomName in Memory.rooms) {
                const roomMem = Memory.rooms[roomName] as any;
                if (!roomMem || !roomMem.intel) {
                    // No intel — delete if we don't have vision.
                    if (!(roomName in Game.rooms)) {
                        delete Memory.rooms[roomName];
                    }
                    continue;
                }

                const intel = roomMem.intel;
                const ticksSinceScan = Game.time - (intel.tick || 0);
                const ticksSinceFastScan = Game.time - (intel.fastTick || 0);

                // Pass 1: Zero out volatile fields if past 1000 ticks.
                if (ticksSinceFastScan > 1000) {
                    intel.hostileCount = 0;
                    intel.dangerScore = 0;
                    intel.hasTowerThreat = false;
                    intel.hasHealers = false;
                    intel.hasRanged = false;
                }

                // Pass 2: Delete the room entry entirely if we haven't seen
                // it in 5000 ticks AND we don't own it.
                if (ticksSinceScan > 5000 && !(roomName in Game.rooms)) {
                    const room = Game.rooms[roomName];
                    if (room && room.controller && room.controller.my) {
                        continue;  // Never delete owned rooms
                    }
                    delete Memory.rooms[roomName];
                    console.log('[Mem] Dropped stale room intel:', roomName);
                }
            }
        }

        // Clear global cache if bucket is low
        if (Game.cpu.bucket < this.BUCKET_CLEAR_CACHE && (global as any)._cache) {
            (global as any)._cache = { structures: {}, numbers: {}, expiration: {}, accessed: {} };
            console.log('[Mem] Cleared global cache (low bucket)');
        }
    },

    garbageCollect(quick?: boolean): void {
        this.clean();
        if (!quick) {
            for (const name in Memory.creeps) {
                const creepMem = Memory.creeps[name] as any;
                if (creepMem.task && creepMem.task._target) {
                    const targetId = creepMem.task._target.ref;
                    if (!Game.getObjectById(targetId)) {
                        creepMem.task = null;
                    }
                }
            }
        }
    },
};