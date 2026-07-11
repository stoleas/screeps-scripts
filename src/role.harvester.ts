'use strict';

import { Task } from './task';
import { Tasks } from './tasks';
import { cache } from './cache';

// roleHarvester: taskHandler for mobile harvesters (bootstrap fallback).
// Called via Overlord.autoRun(creeps, roleHarvester.taskHandler).
// The autoRun pattern handles task load/save/clear — this function only
// assigns a new task when the creep is idle.

export const roleHarvester = {
    // Task handler: called by autoRun when the creep has no valid task.
    // Assigns harvest → transfer to spawn/extension (legacy mode) or
    // harvest → drop to container (static mode).
    taskHandler(creep: Creep): void {
        const task = this.assignTask(creep);
        if (task) {
            creep.memory.task = task.save();
        }
    },

    // Direct run() for backward compatibility (e.g. BootstrapOverlord).
    run(creep: Creep): void {
        let task = Task.load(creep);
        if (!task) {
            task = this.assignTask(creep);
            if (task) {
                creep.memory.task = task.save();
            }
        }
        if (task) {
            const result = task.run(creep);
            if (result === OK || result === ERR_INVALID_TARGET) {
                creep.memory.task = null;
            }
        }
    },

    assignTask(creep: Creep): Task | null {
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (!source) return null;

        // Check for adjacent container (static mode) — cached lookup
        const containers = cache.structures('source_' + source.id + '_containers', () =>
            source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER,
            })
        );

        if (containers.length > 0) {
            const container = containers[0];
            if (creep.pos.isEqualTo(container.pos)) {
                if (creep.store.getFreeCapacity() > 0) {
                    return Tasks.harvest(source);
                } else {
                    return Tasks.drop(container);
                }
            }
            // Not on the container yet — only harvest if we have room.
            if (creep.store.getFreeCapacity() > 0) {
                return Tasks.harvest(source);
            }
        }

        // Legacy mode: harvest → transfer to spawn/extension
        if (creep.store.getFreeCapacity() > 0) {
            return Tasks.harvest(source);
        }

        const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s: Structure) =>
                (s.structureType === STRUCTURE_SPAWN ||
                 s.structureType === STRUCTURE_EXTENSION) &&
                (s as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0,
        });

        if (target) {
            return Tasks.transfer(target, RESOURCE_ENERGY);
        }

        if (creep.room.controller) {
            return Tasks.upgrade(creep.room.controller);
        }

        return null;
    },
};