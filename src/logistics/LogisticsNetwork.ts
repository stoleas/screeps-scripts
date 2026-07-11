'use strict';

import { Colony } from '../colony';

export enum LogisticsPriority {
    High = 0,
    Normal = 1,
    Low = 2,
}

export interface LogisticsRequest {
    id: string;
    target: Structure | Tombstone | Ruin | Resource;
    amount: number;
    resourceType: ResourceConstant;
    priority: LogisticsPriority;
    type: 'provide' | 'request'; // provide = has energy to give; request = needs energy
}

export class LogisticsNetwork {
    colony: Colony;
    requests: LogisticsRequest[];

    constructor(colony: Colony) {
        this.colony = colony;
        this.requests = [];
    }

    refresh(): void {
        this.requests = [];
        this.autoRegister();
    }

    // Register infrastructure nodes that need energy or have energy to give.
    registerRequest(
        target: Structure | Tombstone | Ruin | Resource,
        type: 'provide' | 'request',
        amount: number,
        priority: LogisticsPriority = LogisticsPriority.Normal,
        resource: ResourceConstant = RESOURCE_ENERGY,
    ): void {
        this.requests.push({
            id: (target as any).id || '',
            target,
            amount,
            resourceType: resource,
            priority,
            type,
        });
    }

    // Auto-scan the room for common provide/request nodes.
    private autoRegister(): void {
        const room = this.colony.room;

        // --- PROVIDE: dropped resources ---
        const dropped = room.find(FIND_DROPPED_RESOURCES, {
            filter: (r: Resource) => r.resourceType === RESOURCE_ENERGY && r.amount > 50,
        });
        for (const r of dropped) {
            this.registerRequest(r, 'provide', r.amount, LogisticsPriority.High);
        }

        // --- PROVIDE: tombstones with energy ---
        const tombstones = room.find(FIND_TOMBSTONES, {
            filter: (t: Tombstone) => (t.store[RESOURCE_ENERGY] || 0) > 50,
        });
        for (const t of tombstones) {
            this.registerRequest(t, 'provide', t.store[RESOURCE_ENERGY] || 0, LogisticsPriority.High);
        }

        // --- PROVIDE: containers with energy (mining containers) ---
        const containers = room.find<StructureContainer>(FIND_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER &&
                (s as StructureContainer).store[RESOURCE_ENERGY] > 100,
        });
        for (const c of containers) {
            this.registerRequest(c, 'provide', c.store[RESOURCE_ENERGY], LogisticsPriority.Normal);
        }

        // --- REQUEST: spawns and extensions needing energy ---
        const spawns = room.find(FIND_MY_STRUCTURES, {
            filter: (s: Structure) =>
                (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                (s as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0,
        });
        for (const s of spawns) {
            const free = (s as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY);
            this.registerRequest(s, 'request', free, LogisticsPriority.High);
        }

        // --- REQUEST: towers below 60% energy ---
        const towers = room.find<StructureTower>(FIND_MY_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_TOWER,
        });
        for (const t of towers) {
            const energy = t.store[RESOURCE_ENERGY] || 0;
            const capacity = t.store.getCapacity(RESOURCE_ENERGY);
            if (capacity > 0 && energy < capacity * 0.6) {
                this.registerRequest(t, 'request', capacity - energy, LogisticsPriority.Normal);
            }
        }

        // --- REQUEST: storage (low priority sink for excess energy) ---
        if (room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            this.registerRequest(
                room.storage, 'request',
                room.storage.store.getFreeCapacity(RESOURCE_ENERGY),
                LogisticsPriority.Low,
            );
        }
    }

    // Pair a hauler to the best destination matching its carry state.
    // Full hauler → find a 'request' node. Empty hauler → find a 'provide' node.
    getBestRequest(hauler: Creep): LogisticsRequest | null {
        const isFull = hauler.store.getFreeCapacity() === 0;
        const hasSome = hauler.store[RESOURCE_ENERGY] > 0;
        const targetType = isFull ? 'request' : 'provide';

        const valid = this.requests.filter(r => r.type === targetType && r.amount > 0);

        // If hauler is partially full, prefer matching its current state:
        // has some energy → can still deliver to a request node.
        if (!isFull && hasSome && targetType === 'provide') {
            const requests = this.requests.filter(r => r.type === 'request' && r.amount > 0);
            if (requests.length > 0) {
                requests.sort((a, b) => {
                    if (a.priority !== b.priority) return a.priority - b.priority;
                    return hauler.pos.getRangeTo(a.target.pos) - hauler.pos.getRangeTo(b.target.pos);
                });
                return requests[0];
            }
        }

        if (valid.length === 0) return null;

        valid.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return hauler.pos.getRangeTo(a.target.pos) - hauler.pos.getRangeTo(b.target.pos);
        });

        return valid[0];
    }
}