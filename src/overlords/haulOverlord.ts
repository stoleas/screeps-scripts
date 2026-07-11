'use strict';

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';
import { LogisticsNetwork } from '../logistics/LogisticsNetwork';
import { Task } from '../task';
import { Tasks } from '../tasks';

export class HaulerOverlord extends Overlord {
    logistics: LogisticsNetwork;

    constructor(colony: Colony, logistics: LogisticsNetwork) {
        super(colony, 'haul', Priority.NormalHigh);
        this.logistics = logistics;
    }

    init(hatchery: Hatchery): void {
        // Only spawn haulers if we have storage or containers (RCL4+).
        const hasStorage = !!this.colony.storage;
        const hasContainers = this.colony.room.find(FIND_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER,
        }).length > 0;

        if (!hasStorage && !hasContainers) return;

        // Scale hauler count with structure load: 1 per container, min 2.
        const containerCount = this.colony.room.find(FIND_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER,
        }).length;
        const count = Math.max(2, containerCount);
        this.requestCreep(hatchery, { role: 'hauler' } as any, 'hauler', count);
    }

    run(): void {
        const haulers = this.creeps['hauler'] || [];
        for (const creep of haulers) {
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
        }
    }

    assignTask(creep: Creep): Task | null {
        const request = this.logistics.getBestRequest(creep);
        if (!request) return null;

        const target = request.target;

        if (request.type === 'provide') {
            // Withdraw energy from the provider.
            if (target instanceof Resource) {
                // Dropped resource — use pickup
                return Tasks.pickup(target);
            }
            return Tasks.withdraw(target as Structure, RESOURCE_ENERGY);
        } else {
            // Transfer energy to the consumer.
            return Tasks.transfer(target as Structure, RESOURCE_ENERGY);
        }
    }
}