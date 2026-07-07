'use strict';

// Overmind's custom "task not done yet" sentinel. Must be a real runtime
// value — a `declare const` in types.d.ts compiles to nothing at runtime,
// which makes every `return ERR_NOT_DONE` throw ReferenceError.
const ERR_NOT_DONE = -4;

// Concrete Task implementations adapted from Overmind's tasks/instances/*.
// Each task: harvest, transfer, upgrade, build, withdraw, drop.

import { Task, SavedTask } from './task';

// --- Harvest task ---
class TaskHarvest extends Task {
    constructor(target: Source) {
        super('harvest', target);
        this.settings.range = 1;
    }

    run(creep: Creep): number {
        const target = this.getTarget() as Source | null;
        if (!target) return ERR_INVALID_TARGET;
        if (creep.pos.inRangeTo(target, 1)) {
            const result = creep.harvest(target);
            if (creep.store.getFreeCapacity() === 0) {
                return OK;  // full, task done
            }
            return result === OK ? ERR_NOT_DONE : result;
        }
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
        return ERR_NOT_IN_RANGE;
    }

    static fromMemory(saved: SavedTask): TaskHarvest {
        const task = Object.create(TaskHarvest.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('harvest', TaskHarvest);

// --- Transfer task ---
class TaskTransfer extends Task {
    constructor(target: Structure, resource?: ResourceConstant) {
        super('transfer', target);
        this.data.resource = resource || RESOURCE_ENERGY;
        this.settings.range = 1;
    }

    run(creep: Creep): number {
        const target = this.getTarget() as Structure | null;
        if (!target) return ERR_INVALID_TARGET;
        if (creep.pos.inRangeTo(target, 1)) {
            const result = creep.transfer(target, this.data.resource as ResourceConstant);
            if (result === OK || result === ERR_FULL) {
                return OK;
            }
            return result;
        }
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
        return ERR_NOT_IN_RANGE;
    }

    static fromMemory(saved: SavedTask): TaskTransfer {
        const task = Object.create(TaskTransfer.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('transfer', TaskTransfer);

// --- Upgrade task ---
class TaskUpgrade extends Task {
    constructor(target: StructureController) {
        super('upgrade', target);
        this.settings.range = 3;
    }

    run(creep: Creep): number {
        const target = this.getTarget() as StructureController | null;
        if (!target) return ERR_INVALID_TARGET;
        if (creep.pos.inRangeTo(target, 3)) {
            const result = creep.upgradeController(target);
            if (creep.store[RESOURCE_ENERGY] === 0) {
                return OK;
            }
            return result === OK ? ERR_NOT_DONE : result;
        }
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
        return ERR_NOT_IN_RANGE;
    }

    static fromMemory(saved: SavedTask): TaskUpgrade {
        const task = Object.create(TaskUpgrade.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('upgrade', TaskUpgrade);

// --- Build task ---
class TaskBuild extends Task {
    constructor(target: ConstructionSite) {
        super('build', target);
        this.settings.range = 3;
    }

    run(creep: Creep): number {
        const target = this.getTarget() as ConstructionSite | null;
        if (!target) return ERR_INVALID_TARGET;
        if (creep.pos.inRangeTo(target, 3)) {
            const result = creep.build(target);
            if (result === OK && (creep.store[RESOURCE_ENERGY] === 0 || target.progressTotal === target.progress)) {
                return OK;
            }
            return result === OK ? ERR_NOT_DONE : result;
        }
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
        return ERR_NOT_IN_RANGE;
    }

    static fromMemory(saved: SavedTask): TaskBuild {
        const task = Object.create(TaskBuild.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('build', TaskBuild);

// --- Withdraw task ---
class TaskWithdraw extends Task {
    constructor(target: Structure, resource?: ResourceConstant) {
        super('withdraw', target);
        this.data.resource = resource || RESOURCE_ENERGY;
        this.settings.range = 1;
    }

    run(creep: Creep): number {
        const target = this.getTarget() as Structure | null;
        if (!target) return ERR_INVALID_TARGET;
        if (creep.pos.inRangeTo(target, 1)) {
            const result = creep.withdraw(target, this.data.resource as ResourceConstant);
            if (result === OK || result === ERR_NOT_ENOUGH_RESOURCES) {
                return OK;
            }
            return result;
        }
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
        return ERR_NOT_IN_RANGE;
    }

    static fromMemory(saved: SavedTask): TaskWithdraw {
        const task = Object.create(TaskWithdraw.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('withdraw', TaskWithdraw);

// --- Drop task ---
class TaskDrop extends Task {
    constructor(target: { pos: RoomPosition }) {
        super('drop', { id: 'drop', pos: target.pos });
        this.settings.range = 0;
    }

    run(creep: Creep): number {
        if (creep.store[RESOURCE_ENERGY] > 0) {
            creep.drop(RESOURCE_ENERGY);
        }
        return OK;
    }

    static fromMemory(saved: SavedTask): TaskDrop {
        const task = Object.create(TaskDrop.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('drop', TaskDrop);

// --- Tasks factory ---
export const Tasks = {
    harvest: (target: Source) => new TaskHarvest(target),
    transfer: (target: Structure, resource?: ResourceConstant) => new TaskTransfer(target, resource),
    upgrade: (target: StructureController) => new TaskUpgrade(target),
    build: (target: ConstructionSite) => new TaskBuild(target),
    withdraw: (target: Structure, resource?: ResourceConstant) => new TaskWithdraw(target, resource),
    drop: (target: { pos: RoomPosition }) => new TaskDrop(target),

    chain(tasks: Task[]): Task | null {
        if (tasks.length === 0) return null;
        let task = tasks[tasks.length - 1];
        for (let i = tasks.length - 2; i >= 0; i--) {
            task = task.fork(tasks[i]);
        }
        return task;
    },
};