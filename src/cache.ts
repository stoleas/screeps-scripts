'use strict';

// Global cache adapted from Overmind's GlobalCache.ts ($).
// Caches find* results with a TTL. Structures are refreshed by ID
// each tick (cheap) instead of re-finding.

const DEFAULT_TIMEOUT = 50;
const SHORT_TIMEOUT = 10;

interface CacheStore {
    structures: { [key: string]: Structure[] };
    numbers: { [key: string]: number };
    expiration: { [key: string]: number };
    accessed: { [key: string]: number };
}

function getCache(): CacheStore {
    if (!(global as any)._cache) {
        (global as any)._cache = { structures: {}, numbers: {}, expiration: {}, accessed: {} };
    }
    return (global as any)._cache as CacheStore;
}

export const cache = {
    structures<T extends Structure>(key: string, callback: () => T[], timeout?: number): T[] {
        const t = timeout || DEFAULT_TIMEOUT;
        const c = getCache();
        if (!c.structures[key] || Game.time > c.expiration[key]) {
            c.structures[key] = callback() as Structure[];
            c.expiration[key] = Game.time + t;
            c.accessed[key] = Game.time;
        } else {
            if ((c.accessed[key] || 0) < Game.time) {
                c.structures[key] = c.structures[key].filter(s => Game.getObjectById(s.id));
                c.accessed[key] = Game.time;
            }
        }
        return c.structures[key] as T[];
    },

    number(key: string, callback: () => number, timeout?: number): number {
        const t = timeout || SHORT_TIMEOUT;
        const c = getCache();
        if (c.numbers[key] === undefined || Game.time > c.expiration[key]) {
            c.numbers[key] = callback();
            c.expiration[key] = Game.time + t;
        }
        return c.numbers[key];
    },

    clear(): void {
        (global as any)._cache = { structures: {}, numbers: {}, expiration: {}, accessed: {} };
    },
};