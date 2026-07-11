'use strict';

import { Task } from './task';
import { Tasks } from './tasks';
import { cache } from './cache';

// Static miner: moves to a container adjacent to a source, then harvests
// and drops energy onto the container. No CARRY parts — pure WORK+MOVE.
// Haulers pick up from the container via the logistics network.

export const roleMiner = {
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
        // Find the closest active source.
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (!source) return null;

        // Check for adjacent container (static mining position).
        const containers = cache.structures('source_' + source.id + '_containers', () =>
            source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER,
            })
        );

        if (containers.length > 0) {
            const container = containers[0];
            // Move to the container position, then harvest + drop.
            if (creep.pos.isEqualTo(container.pos)) {
                // On the container: harvest until full, then drop.
                if (creep.store.getFreeCapacity() > 0) {
                    return Tasks.harvest(source);
                } else {
                    return Tasks.drop(container);
                }
            }
            // Not on container yet — move there and harvest.
            return Tasks.harvest(source);
        }

        // No container: just harvest the source (energy drops on ground,
        // haulers will pick it up if they're present).
        return Tasks.harvest(source);
    },
};