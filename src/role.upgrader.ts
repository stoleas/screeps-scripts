'use strict';

import { Task } from './task';
import { Tasks } from './tasks';

// Max ticks a task can stay active before it's considered stale.
const TASK_TIMEOUT = 50;

// roleUpgrader: taskHandler for upgraders.
// Called via Overlord.autoRun(creeps, roleUpgrader.taskHandler).
export const roleUpgrader = {
    taskHandler(creep: Creep): void {
        const task = this.assignTask(creep);
        if (task) {
            creep.memory.task = task.save();
        }
    },

    // Direct run() for backward compatibility.
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
        if (creep.store.getFreeCapacity() > 0) {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source) {
                return Tasks.harvest(source);
            }
            return null;
        }

        if (creep.room.controller) {
            return Tasks.upgrade(creep.room.controller);
        }

        return null;
    },
};