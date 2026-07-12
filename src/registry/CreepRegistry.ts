'use strict';

import { bodyFactory } from '../bodyFactory';
import { EventEmitter } from '../events/EventEmitter';

// CreepRegistry: auto-discovers all deployed creeps on global reset,
// infers their purpose, and backfills memory fields so overlords
// can claim them. Per-tick validate() catches any drift.
//
// Purpose inference priority (Decision #2):
// 1. memory.overlord exists → extract role from overlord name
// 2. memory.role exists → keep it
// 3. Body composition → inferRole() fallback
// 4. All else → 'unknown' (flagged for attention — no unknown creeps allowed)

// Overlord name → role mapping (matches main.ts construction order).
const OVERLORD_TO_ROLES: { [overlordName: string]: string } = {
    harvest: 'harvester',  // also covers 'miner' — overlord handles both
    haul: 'hauler',
    upgrade: 'upgrader',
    build: 'builder',
    combat: 'brawler',
    observer: 'observer',  // no creeps, but handle for completeness
};

// Role → overlord name mapping (for backfilling overlord ref from role).
const ROLE_TO_OVERLORD: { [role: string]: string } = {
    miner: 'harvest',
    harvester: 'harvest',
    hauler: 'haul',
    upgrader: 'upgrade',
    builder: 'build',
    brawler: 'combat',
};

interface DiscoveryReport {
    total: number;
    assigned: number;
    repaired: number;
    unknown: number;
    byRole: { [role: string]: number };
}

export const CreepRegistry = {
    isGlobalReset(): boolean {
        return !(global as any).__creepRegistryLoaded;
    },

    register(): DiscoveryReport | null {
        if (!this.isGlobalReset()) return null;

        const report: DiscoveryReport = {
            total: 0, assigned: 0, repaired: 0, unknown: 0, byRole: {},
        };

        // Build set of owned room names.
        const ownedRooms: Set<string> = new Set();
        for (const spawnName in Game.spawns) {
            const room = Game.spawns[spawnName].room;
            if (room.controller && room.controller.my) {
                ownedRooms.add(room.name);
            }
        }

        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            report.total++;

            // 1. Infer role: overlord memory first, then existing role, then body.
            let role = creep.memory.role;

            if (!role && creep.memory.overlord) {
                // Extract role from overlord ref: "colonyName>overlordName"
                const overlordName = creep.memory.overlord.split('>')[1];
                if (overlordName && OVERLORD_TO_ROLES[overlordName]) {
                    role = OVERLORD_TO_ROLES[overlordName];
                    creep.memory.role = role;
                    report.repaired++;
                }
            }

            if (!role) {
                // Body composition fallback.
                const inferred = bodyFactory.inferRole(creep.body);
                role = inferred;
                creep.memory.role = inferred;
                report.repaired++;
                if (inferred === 'unknown') {
                    report.unknown++;
                    console.log(`[Registry] WARNING: could not infer role for ${creepName}: body=${creep.body.map(b => b.type).join(',')}`);
                    // Emit alert — no unknown creeps allowed.
                    EventEmitter.emit('ALERT', {
                        type: 'UNKNOWN_CREEP',
                        room: creep.room.name,
                        severity: 'warning',
                        message: `Cannot infer role for creep ${creepName} (body: ${creep.body.map(b => b.type).join(',')}) — needs manual assignment`,
                    });
                }
            } else {
                report.assigned++;
            }

            // 2. Assign colony if missing.
            if (!creep.memory.colony) {
                if (creep.room.controller && creep.room.controller.my) {
                    creep.memory.colony = creep.room.name;
                    report.repaired++;
                } else if (ownedRooms.size > 0) {
                    creep.memory.colony = Array.from(ownedRooms)[0];
                    report.repaired++;
                }
            }

            // 3. Assign overlord ref if missing.
            if (!creep.memory.overlord && creep.memory.colony) {
                const overlordName = ROLE_TO_OVERLORD[role || ''];
                if (overlordName) {
                    creep.memory.overlord = creep.memory.colony + '>' + overlordName;
                    report.repaired++;
                }
            }

            // 4. Clear stale task — targets may not exist after reload.
            if (creep.memory.task) {
                creep.memory.task = null;
            }

            // 5. Track role counts.
            const r = role || 'unknown';
            report.byRole[r] = (report.byRole[r] || 0) + 1;
        }

        (global as any).__creepRegistryLoaded = true;

        // Emit discovery report as an event.
        EventEmitter.emit('DISCOVERY', report);

        console.log(`[Registry] Global reset detected. Discovered ${report.total} creeps: ${report.assigned} OK, ${report.repaired} repaired, ${report.unknown} unknown.`);
        const roleSummary = Object.entries(report.byRole).map(([r, c]) => `${r}=${c}`).join(', ');
        console.log(`[Registry] Roles: ${roleSummary}`);

        return report;
    },

    // Per-tick safety net: backfill any untagged creep.
    validate(): void {
        if (this.isGlobalReset()) return;  // register() handles reset ticks
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            if (!creep.memory.role) {
                // Try overlord memory first.
                if (creep.memory.overlord) {
                    const overlordName = creep.memory.overlord.split('>')[1];
                    if (overlordName && OVERLORD_TO_ROLES[overlordName]) {
                        creep.memory.role = OVERLORD_TO_ROLES[overlordName];
                        continue;
                    }
                }
                // Body fallback.
                creep.memory.role = bodyFactory.inferRole(creep.body);
            }
            if (!creep.memory.colony && creep.room.controller && creep.room.controller.my) {
                creep.memory.colony = creep.room.name;
            }
        }
    },
};