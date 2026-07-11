'use strict';

// Collects metrics into Memory.stats for external polling (Grafana pipeline).
// Gated to every 10 ticks to reduce CPU overhead from Memory serialization.
const STATS_INTERVAL = 10;

export class StatsCollector {
    static collect(): void {
        // Only collect on interval to save CPU.
        if (Game.time % STATS_INTERVAL !== 0) return;

        if (!Memory.stats) Memory.stats = {};

        Memory.stats = {
            time: Game.time,
            gcl: Game.gcl.level,
            gclProgress: Game.gcl.progress,
            gclProgressTotal: Game.gcl.progressTotal,
            cpu: {
                bucket: Game.cpu.bucket,
                used: Game.cpu.getUsed(),
                limit: Game.cpu.limit,
            },
            colonies: {} as { [key: string]: any },
        };

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            // Sanitize room name for Graphite metric paths.
            const safeName = roomName.replace(/[^a-zA-Z0-9]/g, '_');

            (Memory.stats as any).colonies[safeName] = {
                rcl: room.controller.level,
                rclProgress: room.controller.progress,
                rclProgressTotal: room.controller.progressTotal,
                energyAvailable: room.energyAvailable,
                energyCapacityAvailable: room.energyCapacityAvailable,
                storageEnergy: room.storage ? room.storage.store.getUsedCapacity(RESOURCE_ENERGY) : 0,
            };
        }
    }
}