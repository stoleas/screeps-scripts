'use strict';

interface MovementData {
    lastPos?: { x: number; y: number; roomName: string };
    stuckCount?: number;
}

export class Movement {
    // Move a creep toward a target position with stuck detection.
    // range: how close the creep needs to be to be "done" (default 1).
    static move(creep: Creep, target: RoomPosition, range = 1): number {
        // Already in range — done.
        if (creep.pos.inRangeTo(target, range)) return OK;

        const mem = creep.memory;
        if (!mem._moveData) mem._moveData = {};
        const data = mem._moveData as MovementData;

        // Stuck detection: if position hasn't changed, increment counter.
        if (
            data.lastPos &&
            creep.pos.x === data.lastPos.x &&
            creep.pos.y === data.lastPos.y &&
            creep.pos.roomName === data.lastPos.roomName
        ) {
            data.stuckCount = (data.stuckCount || 0) + 1;
        } else {
            data.stuckCount = 0;
        }

        data.lastPos = {
            x: creep.pos.x,
            y: creep.pos.y,
            roomName: creep.pos.roomName,
        };

        // If stuck for > 3 ticks, re-path around creeps.
        if (data.stuckCount && data.stuckCount > 3) {
            return creep.moveTo(target, {
                ignoreCreeps: false,
                visualizePathStyle: { stroke: '#ff0000' },
            });
        }

        // Normal pathing: ignore creeps (cheaper, reuses cached path).
        return creep.moveTo(target, {
            ignoreCreeps: true,
            visualizePathStyle: { stroke: '#00ff00' },
        });
    }
}