'use strict';

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';
import { bodyFactory } from '../bodyFactory';
import { Task } from '../task';
import { Tasks } from '../tasks';

// BootstrapOverlord: crash recovery. When a colony has zero creeps (or zero
// harvesters/miners), enter emergency bootstrap mode: spawn a low-cost
// harvesterStarter that harvests and dumps directly into the spawn/extensions.
// While bootstrapping: suppress normal spawning (other overlords skip init).
//
// Adapted from Overmind's directives/situational/bootstrap.ts +
// overlords/situational/bootstrap.ts.
// Gemini correction: handle at Colony/Overlord level, NOT main.ts.

// Don't spawn more bootstrap miners if energy in structures + dropped > this.
const SPAWN_BOOTSTRAP_MINER_THRESHOLD = 2500;

export class BootstrapOverlord extends Overlord {
    constructor(colony: Colony) {
        super(colony, 'bootstrap', Priority.Critical);
    }

    // Determine if the colony needs bootstrap mode.
    // Returns true if zero creeps or zero harvesters/miners exist.
    static needsBootstrap(colony: Colony): boolean {
        if (colony.creeps.length === 0) return true;
        const workers = colony.creeps.filter(c =>
            c.memory.role === 'harvester' || c.memory.role === 'miner'
        );
        return workers.length === 0;
    }

    init(hatchery: Hatchery): void {
        // Only spawn a bootstrap harvester if we don't already have one alive.
        const bootstrapCreeps = this.creeps['harvester'] || [];
        if (bootstrapCreeps.length > 0) return;

        // Don't spawn if there's already enough energy available in structures
        // + dropped resources (Overmind's spawnBootstrapMinerThreshold).
        const room = this.colony.room;
        let availableEnergy = 0;
        for (const spawn of this.colony.spawns) {
            availableEnergy += spawn.store[RESOURCE_ENERGY] || 0;
        }
        const dropped = room.find(FIND_DROPPED_RESOURCES, {
            filter: (r: Resource) => r.resourceType === RESOURCE_ENERGY,
        });
        for (const r of dropped) {
            availableEnergy += r.amount;
        }
        if (availableEnergy > SPAWN_BOOTSTRAP_MINER_THRESHOLD) return;

        // Request 1 harvesterStarter at Critical priority.
        this.requestCreep(hatchery, bodyFactory.PROFILES.harvesterStarter, 'harvester', 1);
    }

    run(): void {
        const bootstrapCreeps = this.creeps['harvester'] || [];
        for (const creep of bootstrapCreeps) {
            this.runBootstrapCreep(creep);
        }
    }

    // Bootstrap creeps harvest from the closest source and transfer directly
    // to spawn/extensions — not containers (emergency mode).
    private runBootstrapCreep(creep: Creep): void {
        let task = Task.load(creep);

        if (!task) {
            task = this.assignBootstrapTask(creep);
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

    private assignBootstrapTask(creep: Creep): Task | null {
        // If full of energy, transfer to spawn/extensions.
        if (creep.store.getFreeCapacity() === 0) {
            const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s: Structure) =>
                    (s.structureType === STRUCTURE_SPAWN ||
                     s.structureType === STRUCTURE_EXTENSION) &&
                    (s as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0,
            });
            if (target) {
                return Tasks.transfer(target, RESOURCE_ENERGY);
            }
            // No space in spawn/extensions — upgrade controller as fallback.
            if (creep.room.controller) {
                return Tasks.upgrade(creep.room.controller);
            }
        }

        // Harvest from closest active source.
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (source) {
            return Tasks.harvest(source);
        }

        return null;
    }
}