'use strict';

// RoomVisual dashboard using Screeps' RoomVisual API.
// Rendering is client-side (zero server CPU), but data collection
// (room.find, scanning arrays) costs CPU — pull from existing caches.

const VisualizerHelpers = {
    drawProgressBar(
        visual: RoomVisual, x: number, y: number, width: number,
        label: string, current: number, max: number, suffix = '%',
    ): void {
        const pct = Math.min(Math.max(current / max, 0), 1);
        // Background panel
        visual.rect(x, y, width, 1.2, {
            fill: 'rgba(0,0,0,0.4)', stroke: '#555555', strokeWidth: 0.05,
        });
        // Label
        visual.text(label, x + 0.3, y + 0.85, {
            font: '0.7 monospace', align: 'left', color: '#cccccc',
        });
        // Inner fill bar
        const barWidth = width * 0.4;
        const barX = x + width - barWidth - 0.3;
        visual.rect(barX, y + 0.2, barWidth, 0.8, { fill: '#333333' });
        visual.rect(barX, y + 0.2, barWidth * pct, 0.8, {
            fill: this.getColorByPct(pct),
        });
        // Value text
        visual.text(`${Math.round(current)}${suffix}`, barX + barWidth / 2, y + 0.8, {
            font: '0.6 monospace', align: 'center', color: '#ffffff',
        });
    },

    drawRow(
        visual: RoomVisual, x: number, y: number, width: number,
        key: string, value: string, color = '#ffffff',
    ): void {
        visual.text(key, x + 0.3, y + 0.7, {
            font: '0.7 monospace', align: 'left', color: '#cccccc',
        });
        visual.text(value, x + width - 0.3, y + 0.7, {
            font: '0.7 monospace', align: 'right', color,
        });
    },

    getColorByPct(pct: number): string {
        if (pct > 0.75) return '#55ff55';
        if (pct > 0.30) return '#ffcc00';
        return '#ff5555';
    },
};

export const visualizer = {
    run(room: Room): void {
        const visual = room.visual;
        let x = 1;
        let y = 1;
        const w = 7.5;

        // --- 1. Global info panel ---
        visual.rect(x, y, w, 4.2, {
            fill: 'rgba(0,0,0,0.3)', stroke: '#777777', strokeWidth: 0.05,
        });
        VisualizerHelpers.drawProgressBar(visual, x, y + 0.2, w, 'CPU', Game.cpu.getUsed(), Game.cpu.limit);
        VisualizerHelpers.drawProgressBar(visual, x, y + 1.5, w, 'BKT', Game.cpu.bucket, 10000, '');
        if (Game.gcl.progressTotal > 0) {
            VisualizerHelpers.drawProgressBar(visual, x, y + 2.8, w, 'GCL', Game.gcl.progress, Game.gcl.progressTotal);
        }
        y += 4.6;

        visual.text(
            `Colonies: ${Object.keys(Game.rooms).length} | Creeps: ${Object.keys(Game.creeps).length}`,
            x, y,
            { font: '0.6 monospace', align: 'left', color: '#aaaaaa' },
        );
        y += 1.0;

        // --- 2. Creep role panel ---
        visual.rect(x, y, w, 0.8, { fill: '#333333' });
        visual.text(`${room.name} Creeps`, x + 0.3, y + 0.6, {
            font: 'bold 0.6 monospace', align: 'left', color: '#ffffff',
        });
        y += 0.8;

        const creepRoles = this.getCreepCounts(room);
        visual.rect(x, y, w, creepRoles.length * 0.9, {
            fill: 'rgba(0,0,0,0.4)', stroke: '#555555', strokeWidth: 0.05,
        });
        for (const role of creepRoles) {
            const color = role.current < role.target ? '#ffcc00' : '#ffffff';
            VisualizerHelpers.drawRow(visual, x, y, w, role.name, `${role.current}/${role.target}`, color);
            y += 0.9;
        }
        y += 0.4;

        // --- 3. Hatchery panel ---
        visual.rect(x, y, w, 0.8, { fill: '#333333' });
        visual.text(`${room.name} Hatchery`, x + 0.3, y + 0.6, {
            font: 'bold 0.6 monospace', align: 'left', color: '#ffffff',
        });
        y += 0.8;

        visual.rect(x, y, w, 1 * 0.9, {
            fill: 'rgba(0,0,0,0.4)', stroke: '#555555', strokeWidth: 0.05,
        });
        VisualizerHelpers.drawRow(visual, x, y, w, 'Energy', `${room.energyAvailable}/${room.energyCapacityAvailable}`);
        y += 0.9;
        y += 0.4;

        // --- 4. Command center (storage / terminal) ---
        if (room.storage || room.terminal) {
            visual.rect(x, y, w, 0.8, { fill: '#333333' });
            visual.text(`${room.name} Command Center`, x + 0.3, y + 0.6, {
                font: 'bold 0.6 monospace', align: 'left', color: '#ffffff',
            });
            y += 0.8;

            const rowsCount = (room.storage ? 1 : 0) + (room.terminal ? 1 : 0);
            visual.rect(x, y, w, rowsCount * 0.9, {
                fill: 'rgba(0,0,0,0.4)', stroke: '#555555', strokeWidth: 0.05,
            });
            if (room.storage) {
                const pct = Math.round(
                    (room.storage.store.getUsedCapacity() / room.storage.store.getCapacity()) * 100,
                );
                VisualizerHelpers.drawRow(visual, x, y, w, 'Storage', `${pct}%`);
                y += 0.9;
            }
            if (room.terminal) {
                const pct = Math.round(
                    (room.terminal.store.getUsedCapacity() / room.terminal.store.getCapacity()) * 100,
                );
                VisualizerHelpers.drawRow(visual, x, y, w, 'Terminal', `${pct}%`);
                y += 0.9;
            }
            y += 0.4;
        }

        // --- 5. Evolution chamber (labs) ---
        const labs = room.find<StructureLab>(FIND_MY_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_LAB,
        });
        if (labs.length > 0) {
            visual.rect(x, y, w, 0.8, { fill: '#333333' });
            visual.text(`${room.name} Evolution Chamber`, x + 0.3, y + 0.6, {
                font: 'bold 0.6 monospace', align: 'left', color: '#ffffff',
            });
            y += 0.8;

            visual.rect(x, y, w, 1.8, {
                fill: 'rgba(0,0,0,0.4)', stroke: '#555555', strokeWidth: 0.05,
            });
            VisualizerHelpers.drawRow(visual, x, y, w, 'Labs', `${labs.length}`);
            y += 0.9;
            VisualizerHelpers.drawRow(visual, x, y, w, 'Status', 'IDLE', '#ffcc00');
            y += 0.9;
        }
    },

    getCreepCounts(room: Room): { name: string; current: number; target: number }[] {
        // Count creeps by role in this room's colony.
        const counts: { [role: string]: number } = {};
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.colony === room.name) {
                const role = creep.memory.role || 'unknown';
                counts[role] = (counts[role] || 0) + 1;
            }
        }
        // Target counts (matches main.ts TARGETS + hauler).
        const targets: { [role: string]: number } = {
            harvester: 2,
            upgrader: 1,
            builder: 1,
            hauler: 2,
        };
        const roles = Object.keys(targets);
        return roles.map(r => ({
            name: r,
            current: counts[r] || 0,
            target: targets[r],
        }));
    },
};