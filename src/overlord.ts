'use strict';

// Base Overlord class adapted from Overmind's Overlord.ts.

import { Colony } from './colony';
import { Priority } from './priorities';
import { Hatchery } from './hatchery';
import { CreepSetup } from './creepSetup';

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

    abstract init(hatchery: Hatchery): void;
    abstract run(): void;
}