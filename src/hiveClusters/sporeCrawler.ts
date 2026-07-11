'use strict';

import { HiveCluster } from './_HiveCluster';
import { Colony } from '../colony';
import { isAlly, isAllyBySign, isAllyByFlag } from '../alliance';
import { cache } from '../cache';

export class SporeCrawler extends HiveCluster {
    towers: StructureTower[];

    constructor(colony: Colony, primaryTower: StructureTower) {
        super(colony, primaryTower, 'SporeCrawler');
        this.towers = [];
    }

    refresh(): void {
        this.towers = cache.structures<StructureTower>(
            this.room.name + '_towers',
            () => this.room.find<StructureTower>(FIND_MY_STRUCTURES, {
                filter: (s: Structure) => s.structureType === STRUCTURE_TOWER,
            })
        );
    }

    init(): void {
        // Towers don't request creeps — nothing to init.
    }

    run(): void {
        if (this.towers.length === 0) return;

        // --- 1. Attack hostiles (IFF: exclude allies via all 3 mechanisms) ---
        const signAlly = isAllyBySign(this.room);
        const hostiles = this.room.find(FIND_HOSTILE_CREEPS, {
            filter: (c: Creep) =>
                !isAlly(c.owner.username) &&
                !isAllyByFlag(c.owner.username) &&
                c.owner.username !== signAlly,
        });

        if (hostiles.length > 0) {
            for (const tower of this.towers) {
                const target = tower.pos.findClosestByRange(hostiles);
                if (target) tower.attack(target);
            }
            return;
        }

        // --- 2. Heal damaged creeps (ours + allies) ---
        const damagedMyCreeps = this.room.find(FIND_MY_CREEPS, {
            filter: (c: Creep) => c.hits < c.hitsMax,
        });
        const damagedAlliedCreeps = this.room.find(FIND_HOSTILE_CREEPS, {
            filter: (c: Creep) =>
                (isAlly(c.owner.username) ||
                 isAllyByFlag(c.owner.username) ||
                 c.owner.username === signAlly) &&
                c.hits < c.hitsMax,
        });
        const healTargets = [...damagedMyCreeps, ...damagedAlliedCreeps];

        if (healTargets.length > 0) {
            healTargets.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
            for (const tower of this.towers) {
                tower.heal(healTargets[0]);
            }
            return;
        }

        // --- 3. Repair damaged structures (non-wall/rampart) ---
        // Gate: only repair if tower energy > 50% to conserve for defense.
        const damagedStructures = this.room.find(FIND_STRUCTURES, {
            filter: (s: Structure) =>
                s.hits < s.hitsMax &&
                s.structureType !== STRUCTURE_WALL &&
                s.structureType !== STRUCTURE_RAMPART,
        });

        if (damagedStructures.length > 0) {
            damagedStructures.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
            const target = damagedStructures[0];
            for (const tower of this.towers) {
                const energy = tower.store[RESOURCE_ENERGY] || 0;
                const capacity = tower.store.getCapacity(RESOURCE_ENERGY);
                if (capacity > 0 && energy > capacity * 0.5) {
                    tower.repair(target);
                }
            }
        }
    }
}