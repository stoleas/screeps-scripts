'use strict';

// Collects metrics into Memory.stats for external polling (Grafana pipeline).
// Gated to every 10 ticks to reduce CPU overhead from Memory serialization.
// Output format aligned with screepers/screeps-grafana (see ADR 0001).

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
        }
    }
}