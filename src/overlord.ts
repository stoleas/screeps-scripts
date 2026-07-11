'use strict';

// Base Overlord class adapted from Overmind's Overlord.ts.

import { Colony } from './colony';
import { Priority } from './priorities';
import { Hatchery } from './hatchery';
import { CreepSetup } from './creepSetup';
import { Zerg } from './zerg/Zerg';

export abstract class Overlord {
    colony: Colony;
    name: string;
    ref: string;
    priority: Priority;
    creeps: { [role: string]: Creep[] };

    constructor(colony: Colony, name: string, priority: Priority = Priority.Normal) {
        this.colony = colony;
        this.name = name;
        this.ref = colony.name + '>' + name;
        this.priority = priority;
        this.creeps = {};
    }

    refresh(): void {
        this.creeps = {};
        for (const creep of this.colony.creeps) {
            if (creep.memory.overlord === this.ref) {
                const role = creep.memory.role;
                if (!role) continue;
                if (!this.creeps[role]) this.creeps[role] = [];
                this.creeps[role].push(creep);
            }
        }
    }

    requestCreep(hatchery: Hatchery, setup: CreepSetup, role: string, count: number): void {
        const current = (this.creeps[role] || []).length;
        const needed = count - current;
        for (let i = 0; i < needed; i++) {
            hatchery.request({
                overlord: this,
                setup,
                role,
                priority: this.priority,
            });
        }
    }

    // autoRun: for each creep, if idle (no task or task invalid), call taskHandler
    // to assign a new task. Then run the task. This replaces the manual
    // Task.load → assignTask → task.run → clear pattern in each role file.
    // Adopted from Overmind's Overlord.ts:autoRun pattern.
    // Gemini correction: use isIdle + run() split, not executeTask().
    autoRun(creeps: Creep[], taskHandler: (creep: Creep) => void): void {
        for (const creep of creeps) {
            const zerg = new Zerg(creep);
            if (zerg.isIdle) {
                taskHandler(creep);
            }
            const result = zerg.run();
            // Clear task on completion or invalid target.
            if (result === OK || result === ERR_INVALID_TARGET) {
                creep.memory.task = null;
            }
        }
    }

    abstract init(hatchery: Hatchery): void;
    abstract run(): void;
}