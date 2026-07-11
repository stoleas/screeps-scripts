'use strict';

import { Task, SavedTask } from './task';
import { Movement } from './movement/Movement';

// Custom "task not done yet" sentinel. Must be a real runtime value.
const ERR_NOT_DONE = -4;

// Concrete Task implementations adapted from Overmind's tasks/instances/*.
// Each task: harvest, transfer, upgrade, build, withdraw, drop, pickup.

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
            // Source depleted (regenerating) — clear task so creep can find other work.
            if (result === ERR_NOT_ENOUGH_RESOURCES) return ERR_INVALID_TARGET;
            return result === OK ? ERR_NOT_DONE : result;
        }
        const moveResult = Movement.move(creep, target.pos, 1);
        // No path to source — clear task so creep can try a different source.
        if (moveResult === ERR_NO_PATH) return ERR_INVALID_TARGET;
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
        Movement.move(creep, target.pos, 1);
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
        const moveResult = Movement.move(creep, target.pos, 3);
        if (moveResult === ERR_NO_PATH) return ERR_INVALID_TARGET;
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
        const moveResult = Movement.move(creep, target.pos, 3);
        if (moveResult === ERR_NO_PATH) return ERR_INVALID_TARGET;
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
        Movement.move(creep, target.pos, 1);
        return ERR_NOT_IN_RANGE;
    }

    static fromMemory(saved: SavedTask): TaskWithdraw {
        const task = Object.create(TaskWithdraw.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('withdraw', TaskWithdraw);

// --- Pickup task (for dropped resources) ---
class TaskPickup extends Task {
    constructor(target: Resource) {
        super('pickup', target);
        this.settings.range = 1;
    }

    run(creep: Creep): number {
        const target = this.getTarget() as Resource | null;
        if (!target) return ERR_INVALID_TARGET;
        if (creep.pos.inRangeTo(target, 1)) {
            const result = creep.pickup(target);
            if (result === OK || creep.store.getFreeCapacity() === 0) {
                return OK;
            }
            return ERR_NOT_DONE;
        }
        Movement.move(creep, target.pos, 1);
        return ERR_NOT_IN_RANGE;
    }

    static fromMemory(saved: SavedTask): TaskPickup {
        const task = Object.create(TaskPickup.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('pickup', TaskPickup);

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

// --- Repair task ---
// TaskRepair: repair a damaged structure to full hits.
// Includes isValidTask/isValidTarget split per Overmind's Task architecture.
class TaskRepair extends Task {
    constructor(target: Structure) {
        super('repair', target);
        this.settings.range = 3;
    }

    isValidTask(creep: Creep): boolean {
        return creep.store[RESOURCE_ENERGY] > 0;
    }

    isValidTarget(): boolean {
        const target = this.getTarget() as Structure | null;
        return !!target && target.hits < target.hitsMax;
    }

    run(creep: Creep): number {
        const target = this.getTarget() as Structure | null;
        if (!target || target.hits >= target.hitsMax) return ERR_INVALID_TARGET;
        if (creep.store[RESOURCE_ENERGY] === 0) return OK; // out of energy
        if (creep.pos.inRangeTo(target, 3)) {
            const result = creep.repair(target);
            return result === OK ? ERR_NOT_DONE : result;
        }
        const moveResult = Movement.move(creep, target.pos, 3);
        if (moveResult === ERR_NO_PATH) return ERR_INVALID_TARGET;
        return ERR_NOT_IN_RANGE;
    }

    static fromMemory(saved: SavedTask): TaskRepair {
        const task = Object.create(TaskRepair.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('repair', TaskRepair);

// --- Fortify task ---
// TaskFortify: repair walls/ramparts up to a hits cap (not hitsMax, which is
// absurdly high for walls). Same repair() call, different semantic — the
// target's hits is compared against a cap stored in data.hitsCap.
class TaskFortify extends Task {
    constructor(target: Structure, hitsCap: number) {
        super('fortify', target);
        this.settings.range = 3;
        this.data.hitsCap = hitsCap;
    }

    run(creep: Creep): number {
        const target = this.getTarget() as Structure | null;
        if (!target) return ERR_INVALID_TARGET;
        const cap = this.data.hitsCap as number;
        if (target.hits >= cap) return OK; // reached fortify cap
        if (creep.store[RESOURCE_ENERGY] === 0) return OK; // out of energy
        if (creep.pos.inRangeTo(target, 3)) {
            const result = creep.repair(target);
            if (target.hits >= cap) return OK;
            return result === OK ? ERR_NOT_DONE : result;
        }
        const moveResult = Movement.move(creep, target.pos, 3);
        if (moveResult === ERR_NO_PATH) return ERR_INVALID_TARGET;
        return ERR_NOT_IN_RANGE;
    }

    static fromMemory(saved: SavedTask): TaskFortify {
        const task = Object.create(TaskFortify.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('fortify', TaskFortify);

// --- GoTo task ---
// TaskGoTo: move creep to an arbitrary RoomPosition. Task completes when
// the creep is within the specified range. No target object — uses a
// synthetic target with the position only.
class TaskGoTo extends Task {
    constructor(target: RoomPosition, range = 1) {
        super('goTo', { id: 'goTo', pos: target });
        this.settings.range = range;
    }

    run(creep: Creep): number {
        const pos = this.targetPos;
        if (!pos) return ERR_INVALID_TARGET;
        if (creep.pos.inRangeTo(pos, this.settings.range)) return OK;
        const result = Movement.move(creep, pos, this.settings.range);
        if (result === ERR_NO_PATH) return ERR_INVALID_TARGET;
        return ERR_NOT_IN_RANGE;
    }

    static fromMemory(saved: SavedTask): TaskGoTo {
        const task = Object.create(TaskGoTo.prototype);
        Object.assign(task, saved);
        return task;
    }
}
Task.register('goTo', TaskGoTo);

// --- Tasks factory ---
export const Tasks = {
    harvest: (target: Source) => new TaskHarvest(target),
    transfer: (target: Structure, resource?: ResourceConstant) => new TaskTransfer(target, resource),
    upgrade: (target: StructureController) => new TaskUpgrade(target),
    build: (target: ConstructionSite) => new TaskBuild(target),
    withdraw: (target: Structure, resource?: ResourceConstant) => new TaskWithdraw(target, resource),
    drop: (target: { pos: RoomPosition }) => new TaskDrop(target),
    pickup: (target: Resource) => new TaskPickup(target),
    repair: (target: Structure) => new TaskRepair(target),
    fortify: (target: Structure, hitsCap: number) => new TaskFortify(target, hitsCap),
    goTo: (target: RoomPosition, range?: number) => new TaskGoTo(target, range),

    chain(tasks: Task[]): Task | null {
        if (tasks.length === 0) return null;
        let task = tasks[tasks.length - 1];
        for (let i = tasks.length - 2; i >= 0; i--) {
            task = task.fork(tasks[i]);
        }
        return task;
    },
};