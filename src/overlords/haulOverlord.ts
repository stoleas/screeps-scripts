'use strict';

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';
import { bodyFactory } from '../bodyFactory';
import { LogisticsNetwork } from '../logistics/LogisticsNetwork';
import { Task, shouldClearTask } from '../task';
import { Tasks } from '../tasks';
import { EventEmitter } from '../events/EventEmitter';

export class HaulerOverlord extends Overlord {
    logistics: LogisticsNetwork;

    constructor(colony: Colony, logistics: LogisticsNetwork) {
        super(colony, 'haul', Priority.NormalHigh);
        this.logistics = logistics;
    }

    init(hatchery: Hatchery): void {
        // Only spawn haulers if we have storage or containers.
        // At RCL2, source containers enable static mining → hauler transport.
        const hasStorage = !!this.colony.storage;
        const hasContainers = this.colony.room.find(FIND_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER,
        }).length > 0;

        if (!hasStorage && !hasContainers) return;

        // Scale hauler count: 2 per source (to keep up with miner output),
        // min 2 so the colony doesn't stall with 1 source.
        const count = Math.max(2, this.colony.sources.length * 2);
        this.requestCreep(hatchery, bodyFactory.PROFILES.hauler, 'hauler', count);
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