'use strict';

import { Task } from '../task';

export class Zerg {
    creep: Creep;
    name: string;
    pos: RoomPosition;
    body: BodyPartDefinition[];
    store: StoreDefinition;
    memory: CreepMemory;

    constructor(creep: Creep) {
        this.creep = creep;
        this.name = creep.name;
        this.pos = creep.pos;
        this.body = creep.body;
        this.store = creep.store;
        this.memory = creep.memory;
    }

    get task(): Task | null {
        return Task.load(this.creep);
    }

    set task(newTask: Task | null) {
        if (!newTask) {
            this.creep.memory.task = null;
        } else {
            this.creep.memory.task = newTask.save();
        }
    }

    // Execute the current task. Returns the task result code.
    // Clears the task on OK or ERR_INVALID_TARGET.
    executeTask(): number | null {
        const activeTask = this.task;
        if (!activeTask) return null;

        const result = activeTask.run(this.creep);
        if (result === OK || result === ERR_INVALID_TARGET) {
            this.task = null;
        }
        return result;
    }

    // Shorthand movement wrappers (delegates to Movement module when available).
    move(direction: DirectionConstant): number {
        return this.creep.move(direction);
    }

    moveToPos(targetPos: RoomPosition): number {
        return this.creep.moveTo(targetPos, {
            maxOps: 2000,
            visualizePathStyle: { stroke: '#ff00ff' },
        });
    }
}