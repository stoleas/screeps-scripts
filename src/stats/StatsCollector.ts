'use strict';

// Collects metrics into Memory.stats for external polling (Grafana pipeline).
// Gated to every 10 ticks to reduce CPU overhead from Memory serialization.
// Output format aligned with screepers/screeps-grafana (see ADR 0001).

import { EventEmitter } from '../events/EventEmitter';

const STATS_INTERVAL = 10;

export class StatsCollector {
    static collect(): void {
        // Only collect on interval to save CPU.
        if (Game.time % STATS_INTERVAL !== 0) return;

        Memory.stats = {
            time: Game.time,
            gcl: {
                level: Game.gcl.level,
                progress: Game.gcl.progress,
                progressTotal: Game.gcl.progressTotal,
            },
            cpu: {
                bucket: Game.cpu.bucket,
                used: Game.cpu.getUsed(),
                limit: Game.cpu.limit,
            },
            rooms: {} as { [key: string]: any },
        };

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            // Sanitize room name for Graphite metric paths.
            const safeName = roomName.replace(/[^a-zA-Z0-9]/g, '_');

            (Memory.stats as any).rooms[safeName] = {
                controllerLevel: room.controller.level,
                controllerProgress: room.controller.progress,
                controllerProgressTotal: room.controller.progressTotal,
                energyAvailable: room.energyAvailable,
                energyCapacityAvailable: room.energyCapacityAvailable,
                storageEnergy: room.storage ? room.storage.store.getUsedCapacity(RESOURCE_ENERGY) : 0,
                terminalEnergy: room.terminal ? room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) : 0,
            };

            // Emit room snapshot event for Dolt pipeline.
            EventEmitter.emit('ROOM_SNAPSHOT', {
                room: roomName,
                controllerLevel: room.controller.level,
                controllerProgress: room.controller.progress,
                energyAvailable: room.energyAvailable,
                energyCapacity: room.energyCapacityAvailable,
                storageEnergy: room.storage ? room.storage.store.getUsedCapacity(RESOURCE_ENERGY) : 0,
                terminalEnergy: room.terminal ? room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) : 0,
                creepCount: Object.values(Game.creeps).filter(c => c.memory.colony === roomName).length,
                hostileCount: room.find(FIND_HOSTILE_CREEPS).length,
            });
        }

        // Emit global snapshot for Dolt pipeline (CPU + GCL metrics).
        EventEmitter.emit('GLOBAL_SNAPSHOT', {
            cpuUsed: Game.cpu.getUsed(),
            cpuLimit: Game.cpu.limit,
            cpuBucket: Game.cpu.bucket,
            gclLevel: Game.gcl.level,
            gclProgress: Game.gcl.progress,
            gclProgressTotal: Game.gcl.progressTotal,
            creepCount: Object.keys(Game.creeps).length,
        });
    }
}