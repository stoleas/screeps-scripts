'use strict';

import { Task, shouldClearTask } from './task';
import { Tasks } from './tasks';
import { EventEmitter } from './events/EventEmitter';

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
            const energyBefore = creep.store[RESOURCE_ENERGY] || 0;
            const result = task.run(creep);
            const energyAfter = creep.store[RESOURCE_ENERGY] || 0;
            const delta = energyAfter - energyBefore;
            if (delta !== 0) {
                const taskType = creep.memory.task ? creep.memory.task._type : 'unknown';
                const sourceMap: { [type: string]: string } = {
                    harvest: 'SOURCE',
                    transfer: 'SPAWN',
                    withdraw: 'STORAGE',
                    build: 'CONSTRUCTION',
                    upgrade: 'CONTROLLER',
                    pickup: 'DROPPED',
                };
                EventEmitter.emit('ECONOMIC', {
                    room: creep.room.name,
                    source: sourceMap[taskType] || 'UNKNOWN',
                    amount: delta,
                    actor: creep.name,
                });
            }
            const age = Game.time - task.tick;
            if (shouldClearTask(result, age)) {
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