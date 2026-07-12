'use strict';

import { EventEmitter } from '../events/EventEmitter';

// ActivityMonitor: tracks creep movement and task state to detect
// stuck/idle creeps. Runs every 5 ticks (gated for CPU).
//
// Stuck: same position for STUCK_THRESHOLD checks AND not doing
// stationary work (mining, upgrading, building — these don't require movement).
// Action: auto-clear task so overlord reassigns. Emit alert.
//
// Idle: no task for IDLE_THRESHOLD checks.
// Action: emit alert (overlord's init() should request replacement).

const MONITOR_INTERVAL = 5;    // run every N ticks
const STUCK_THRESHOLD = 2;      // 2 checks × 5 ticks = 10 ticks at same pos
const IDLE_THRESHOLD = 1;       // 1 check × 5 ticks = 5 ticks with no task

interface ActivityState {
    lastPos: { x: number; y: number; roomName: string } | null;
    stuckCount: number;
    idleCount: number;
}

export const ActivityMonitor = {
    monitor(): void {
        if (Game.time % MONITOR_INTERVAL !== 0) return;

        if (!(global as any).__activityMonitorState) {
            (global as any).__activityMonitorState = {};
        }
        const state = (global as any).__activityMonitorState as { [name: string]: ActivityState };

        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            const pos = { x: creep.pos.x, y: creep.pos.y, roomName: creep.room.name };
            const hasTask = !!creep.memory.task;

            if (!state[creepName]) {
                state[creepName] = { lastPos: pos, stuckCount: 0, idleCount: 0 };
                continue;
            }

            const s = state[creepName];

            // Track stuck.
            if (s.lastPos && s.lastPos.x === pos.x && s.lastPos.y === pos.y &&
                s.lastPos.roomName === pos.roomName) {
                s.stuckCount++;
            } else {
                s.stuckCount = 0;
            }
            s.lastPos = pos;

            // Track idle.
            if (!hasTask) {
                s.idleCount++;
            } else {
                s.idleCount = 0;
            }

            // Flag stuck creeps.
            if (s.stuckCount >= STUCK_THRESHOLD) {
                // Check if doing stationary work.
                const isMining = creep.memory.role === 'miner' &&
                    creep.body.some(b => b.type === WORK) &&
                    creep.store[RESOURCE_ENERGY] < creep.store.getCapacity();
                const isUpgrading = creep.memory.upgrading;
                const isBuilding = creep.memory.building;

                if (!isMining && !isUpgrading && !isBuilding) {
                    const msg = `${creepName} (${creep.memory.role}) stuck at ${pos.roomName}(${pos.x},${pos.y}) for ${s.stuckCount * MONITOR_INTERVAL} ticks`;
                    console.log(`[Activity] ${msg}`);
                    EventEmitter.emit('ALERT', {
                        type: 'CREEP_STUCK',
                        room: pos.roomName,
                        severity: 'warning',
                        message: msg,
                    });
                    // Auto-clear task for reassignment.
                    creep.memory.task = null;
                    s.stuckCount = 0;
                }
            }

            // Flag idle creeps.
            if (s.idleCount >= IDLE_THRESHOLD) {
                const msg = `${creepName} (${creep.memory.role}) idle (no task) for ${s.idleCount * MONITOR_INTERVAL} ticks in ${pos.roomName}`;
                console.log(`[Activity] ${msg}`);
                EventEmitter.emit('ALERT', {
                    type: 'CREEP_IDLE',
                    room: pos.roomName,
                    severity: 'warning',
                    message: msg,
                });
                s.idleCount = 0;
            }
        }

        // Clean dead creep state.
        for (const name in state) {
            if (!(name in Game.creeps)) delete state[name];
        }
    },
};