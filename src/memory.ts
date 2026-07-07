'use strict';

// Memory management adapted from Overmind's Memory.ts.

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
                delete Memory.creeps[name];
                console.log('[Mem] Clearing dead creep memory:', name);
            }
        }

        // Clean stale room memory
        if (Memory.rooms) {
            for (const roomName in Memory.rooms) {
                if (!(roomName in Game.rooms) &&
                    (!Memory.rooms[roomName].intel ||
                     (Game.time - (Memory.rooms[roomName] as any).intel.tick > 5000))) {
                    delete Memory.rooms[roomName];
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