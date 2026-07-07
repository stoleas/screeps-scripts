'use strict';

import { Task } from './task';
import { Tasks } from './tasks';

export const roleUpgrader = {
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
            if (result === OK) {
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