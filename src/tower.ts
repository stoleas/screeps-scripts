'use strict';

// Tower defense with IFF (Identification Friend or Foe) filtering.
// Targets ONLY hostile creeps not in the allies list. Allied creeps
// (including zh0ul's) are healed, never attacked.
//
// Priority order:
//   1. Attack hostile creeps (non-allied) — closest first
//   2. Heal damaged creeps (ours + allies) — most damaged first
//   3. Repair damaged structures (non-wall/rampart) — lowest hits % first
//
// Repair is gated on tower energy > 50% to preserve energy for attacks.

import { isAlly } from './alliance';

export const towerDefense = {
    run(room: Room): void {
        const towers = room.find<StructureTower>(FIND_MY_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_TOWER,
        });

        if (towers.length === 0) return;

        // --- 1. Attack hostiles (IFF: exclude allies) ---
        const hostiles = room.find(FIND_HOSTILE_CREEPS, {
            filter: (c: Creep) => !isAlly(c.owner.username),
        });

        if (hostiles.length > 0) {
            for (const tower of towers) {
                const target = tower.pos.findClosestByRange(hostiles);
                if (target) {
                    tower.attack(target);
                }
            }
            return; // attack is priority — don't waste energy on heal/repair
        }

        // --- 2. Heal damaged creeps (ours + allies) ---
        const damagedMyCreeps = room.find(FIND_MY_CREEPS, {
            filter: (c: Creep) => c.hits < c.hitsMax,
        });
        // Also heal allied (zh0ul's) creeps that appear as "hostile" but are allies.
        const damagedAlliedCreeps = room.find(FIND_HOSTILE_CREEPS, {
            filter: (c: Creep) => isAlly(c.owner.username) && c.hits < c.hitsMax,
        });
        const healTargets = [...damagedMyCreeps, ...damagedAlliedCreeps];

        if (healTargets.length > 0) {
            // Heal most-damaged first
            healTargets.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
            const target = healTargets[0];
            for (const tower of towers) {
                tower.heal(target);
            }
            return;
        }

        // --- 3. Repair damaged structures (non-wall/rampart) ---
        // Only repair if tower has > 50% energy to conserve for defense.
        const damagedStructures = room.find(FIND_STRUCTURES, {
            filter: (s: Structure) =>
                s.hits < s.hitsMax &&
                s.structureType !== STRUCTURE_WALL &&
                s.structureType !== STRUCTURE_RAMPART,
        });

        if (damagedStructures.length > 0) {
            // Sort by lowest hits percentage
            damagedStructures.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
            const target = damagedStructures[0];
            for (const tower of towers) {
                const energy = tower.store[RESOURCE_ENERGY] || 0;
                const capacity = tower.store.getCapacity(RESOURCE_ENERGY);
                if (capacity > 0 && energy > capacity * 0.5) {
                    tower.repair(target);
                }
            }
        }
    },
};