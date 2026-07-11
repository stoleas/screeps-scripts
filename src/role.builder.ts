'use strict';

import { Task } from './task';
import { Tasks } from './tasks';

// Max ticks a task can stay active before it's considered stale.
// Prevents creeps from getting stuck on unreachable targets or depleted sources.
const TASK_TIMEOUT = 50;

export const roleBuilder = {
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
            const age = Game.time - task.tick;
            if (result === OK || result === ERR_INVALID_TARGET || age > TASK_TIMEOUT) {
                creep.memory.task = null;
            }
        }
    },

    assignTask(creep: Creep): Task | null {
        // Priority: build with any energy we have, harvest only when empty.
        // This prevents the builder from idling with partial energy when
        // sources are temporarily depleted (regenerating).
        if (creep.store[RESOURCE_ENERGY] > 0) {
            const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            if (target) {
                return Tasks.build(target);
            }
            // Nothing to build: help upgrade the controller instead.
            if (creep.room.controller) {
                return Tasks.upgrade(creep.room.controller);
            }
        }

        // Empty (or no work to do): go harvest.
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source) {
            return Tasks.harvest(source);
        }

        // Has energy but no source and nothing to build — upgrade if possible.
        if (creep.store[RESOURCE_ENERGY] > 0 && creep.room.controller) {
            return Tasks.upgrade(creep.room.controller);
        }

        return null;
    },
};