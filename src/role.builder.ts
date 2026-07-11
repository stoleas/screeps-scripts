'use strict';

import { Task } from './task';
import { Tasks } from './tasks';
import { Colony } from './colony';

// Max ticks a task can stay active before it's considered stale.
const TASK_TIMEOUT = 50;

export interface BuilderConfig {
    barrierHitsCap: number;
    fortifyDutyThreshold: number;
    colony: Colony;
}

// roleBuilder: taskHandler for builders.
// Called via BuildOverlord.autoRun(creeps, (creep) => roleBuilder.taskHandler(creep, config)).
export const roleBuilder = {
    taskHandler(creep: Creep, config?: BuilderConfig): void {
        const task = this.assignTask(creep, config);
        if (task) {
            creep.memory.task = task.save();
        }
    },

    // Direct run() for backward compatibility.
    run(creep: Creep, config?: BuilderConfig): void {
        let task = Task.load(creep);
        if (!task) {
            task = this.assignTask(creep, config);
            if (task) {
                creep.memory.task = task.save();
            }
        }
        if (task) {
            const result = task.run(creep);
            const age = Game.time - task.tick;
            if (result === OK || result === ERR_INVALID_TARGET || age > TASK_TIMEOUT) {
                creep.memory.task = null;
            }
        }
    },

    assignTask(creep: Creep, config?: BuilderConfig): Task | null {
        // 4-step priority chain (simplified from Overmind's WorkerOverlord):
        // 1. Emergency upgrade (controller about to downgrade)
        // 2. Critical repair (spawns/containers < 50% hits)
        // 3. Build (construction sites)
        // 4. Fortify/pave (roads + walls/ramparts up to RCL-scaled caps)

        const hasEnergy = creep.store[RESOURCE_ENERGY] > 0;

        // Step 1: Emergency upgrade — controller about to downgrade.
        if (hasEnergy && creep.room.controller) {
            if (creep.room.controller.ticksToDowngrade < 3000) {
                return Tasks.upgrade(creep.room.controller);
            }
        }

        // Step 2: Critical repair — spawns/containers below 50% hits.
        if (hasEnergy) {
            const critical = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s: Structure) => {
                    if (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_CONTAINER) {
                        return s.hits < s.hitsMax * 0.5;
                    }
                    return false;
                },
            });
            if (critical) {
                return Tasks.repair(critical);
            }
        }

        // Step 3: Build construction sites.
        if (hasEnergy) {
            const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            if (site) {
                return Tasks.build(site);
            }
        }

        // Step 4: Fortify/pave — only if colony has enough energy.
        if (hasEnergy && config) {
            const storageEnergy = config.colony.storage
                ? config.colony.storage.store[RESOURCE_ENERGY] || 0
                : 0;

            // Fortify barriers only if storage has > threshold energy.
            if (storageEnergy > config.fortifyDutyThreshold) {
                const barrier = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s: Structure) =>
                        (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
                        s.hits < config.barrierHitsCap,
                });
                if (barrier) {
                    return Tasks.fortify(barrier, config.barrierHitsCap);
                }
            }

            // Pave: repair existing roads that are damaged.
            const damagedRoad = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s: Structure) =>
                    s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax * 0.5,
            });
            if (damagedRoad) {
                return Tasks.repair(damagedRoad);
            }
        }

        // No work to do: harvest if empty, upgrade if has energy.
        if (!hasEnergy) {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source) {
                return Tasks.harvest(source);
            }
        }

        if (hasEnergy && creep.room.controller) {
            return Tasks.upgrade(creep.room.controller);
        }

        return null;
    },
};