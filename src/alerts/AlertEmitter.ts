'use strict';

// AlertEmitter: detects in-game anomalies and writes them to Memory.alerts
// as a FIFO queue. The external screeps-grafana connector polls Memory.alerts
// and POSTs to an EDA webhook for automated response.
//
// Alert types:
// - DEFENSE_BREACH: hostile creeps in an owned room with insufficient towers
// - CPU_SPIKE: CPU bucket dropped below threshold (sustained high CPU)
//
// Memory shape:
//   Memory.alerts = [{ type, tick, room?, severity, message }]

import { EventEmitter } from '../events/EventEmitter';

const MAX_ALERTS = 20;
const CPU_BUCKET_THRESHOLD = 2000;

interface Alert {
    type: string;
    tick: number;
    room?: string;
    severity: 'warning' | 'critical';
    message: string;
}

export const AlertEmitter = {
    check(): void {
        if (!Memory.alerts) Memory.alerts = [];

        const newAlerts: Alert[] = [];

        // --- DEFENSE_BREACH: hostiles in owned rooms ---
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const hostiles = room.find(FIND_HOSTILE_CREEPS);
            if (hostiles.length === 0) continue;

            // Check if we have towers to defend.
            const towers = room.find<StructureTower>(FIND_MY_STRUCTURES, {
                filter: (s: Structure) => s.structureType === STRUCTURE_TOWER,
            });

            const towersReady = towers.filter(t => t.store[RESOURCE_ENERGY] > 10).length;
            const safeMode = !!room.controller.safeMode;

            if (towersReady === 0 && !safeMode) {
                newAlerts.push({
                    type: 'DEFENSE_BREACH',
                    tick: Game.time,
                    room: roomName,
                    severity: 'critical',
                    message: `${hostiles.length} hostile(s) in ${roomName}, 0 ready towers, no safe mode`,
                });
            } else if (towersReady < hostiles.length) {
                newAlerts.push({
                    type: 'DEFENSE_BREACH',
                    tick: Game.time,
                    room: roomName,
                    severity: 'warning',
                    message: `${hostiles.length} hostile(s) vs ${towersReady} ready tower(s) in ${roomName}`,
                });
            }
        }

        // --- CPU_SPIKE: bucket critically low ---
        if (Game.cpu.bucket < CPU_BUCKET_THRESHOLD) {
            newAlerts.push({
                type: 'CPU_SPIKE',
                tick: Game.time,
                severity: 'critical',
                message: `CPU bucket low: ${Game.cpu.bucket} (threshold ${CPU_BUCKET_THRESHOLD}), used: ${Game.cpu.getUsed().toFixed(1)}/${Game.cpu.limit}`,
            });
        }

        // Append new alerts to FIFO, cap at MAX_ALERTS.
        if (newAlerts.length > 0) {
            for (const alert of newAlerts) {
                Memory.alerts.push(alert);
                console.log(`[Alert] ${alert.type}: ${alert.message}`);
                // Mirror to EventEmitter for Dolt pipeline.
                EventEmitter.emit('ALERT', {
                    type: alert.type,
                    room: alert.room,
                    severity: alert.severity,
                    message: alert.message,
                });
            }
            // Trim oldest if over cap.
            if (Memory.alerts.length > MAX_ALERTS) {
                Memory.alerts = Memory.alerts.slice(-MAX_ALERTS);
            }
        }
    },
};