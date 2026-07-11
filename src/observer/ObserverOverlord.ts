'use strict';

// Observer-based remote room scanning, replacing scout creeps at RCL8.
// Uses a round-robin queue stored in Memory to observe one target room
// per tick per Observer. The observed room is visible on the next tick,
// allowing CombatIntel.scanVisibleRooms() to pick it up automatically.

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';

// Observer range is 10 rooms (linear/Chebyshev distance).
const OBSERVER_RANGE = 10;

export class ObserverOverlord extends Overlord {
    observer: StructureObserver | null;

    constructor(colony: Colony) {
        super(colony, 'observer', Priority.NormalLow);
        this.observer = null;
    }

    // Find the Observer structure in this colony's room.
    private findObserver(): StructureObserver | null {
        const observers = this.colony.room.find<StructureObserver>(FIND_MY_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_OBSERVER,
        });
        return observers[0] || null;
    }

    init(hatchery: Hatchery): void {
        // No-op — Observers don't spawn creeps. The Observer is a structure
        // built by the RoomPlanner when the room hits RCL8.
    }

    run(): void {
        this.observer = this.findObserver();
        if (!this.observer) return;
        if (!this.observer.isActive()) return;

        // Get or initialize the target room list for this colony.
        // The list is stored in Memory so it persists across ticks.
        const memKey = `observer_${this.colony.name}`;
        if (!Memory.observers) Memory.observers = {};
        if (!Memory.observers[memKey]) {
            Memory.observers[memKey] = {
                targets: [],
                lastIndex: -1,
            };
        }
        const obsMem = Memory.observers[memKey];

        // If no targets configured, try to auto-discover rooms within range.
        // This is a simple heuristic — the user can manually set targets
        // via game console: Memory.observers.observer_W1N1.targets = ['E1S1', 'E1S2']
        if (obsMem.targets.length === 0) {
            // Auto-discover: scan rooms within OBSERVER_RANGE using Game.map.
            // We parse the current room name to generate candidate coordinates.
            const roomName = this.colony.name;
            const parsed = this.parseRoomName(roomName);
            if (parsed) {
                const targets: string[] = [];
                for (let dx = -OBSERVER_RANGE; dx <= OBSERVER_RANGE; dx++) {
                    for (let dy = -OBSERVER_RANGE; dy <= OBSERVER_RANGE; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const target = this.buildRoomName(parsed.hDir, parsed.hVal, dx, parsed.vDir, parsed.vVal, dy);
                        // Only include rooms that exist on the map.
                        const status = Game.map.getRoomStatus(target);
                        if (status && status.status === 'normal') {
                            targets.push(target);
                        }
                    }
                }
                obsMem.targets = targets;
                console.log(`[Observer] Auto-discovered ${targets.length} rooms within range of ${roomName}`);
            }
        }

        if (obsMem.targets.length === 0) return;

        // Round-robin: pick the next target.
        let nextIndex = obsMem.lastIndex + 1;
        if (nextIndex >= obsMem.targets.length) nextIndex = 0;

        const target = obsMem.targets[nextIndex];

        // Only observe if we don't already have vision (saves the observation
        // for rooms we can't see — no point observing a room we already see).
        if (target in Game.rooms) {
            obsMem.lastIndex = nextIndex;
            return;
        }

        const result = this.observer.observeRoom(target);
        if (result === OK) {
            obsMem.lastIndex = nextIndex;
            // Store the expected room so CombatIntel knows to scan it next tick.
            Memory.nextExpectedRoom = target;
        }
    }

    // Parse a Screeps room name into directional components.
    // Example: "W1N2" → { hDir: 'W', hVal: 1, vDir: 'N', vVal: 2 }
    // Returns null if the name doesn't match the expected pattern.
    private parseRoomName(name: string): { hDir: string; hVal: number; vDir: string; vVal: number } | null {
        const match = name.match(/^([WE])(\d+)([NS])(\d+)$/);
        if (!match) return null;
        return {
            hDir: match[1],
            hVal: parseInt(match[2], 10),
            vDir: match[3],
            vVal: parseInt(match[4], 10),
        };
    }

    // Convert a room name component to a linear coordinate.
    // W1 → -1, W2 → -2, E1 → +1, E0 → 0 (origin).
    private dirToLinear(dir: string, val: number): number {
        return dir === 'W' ? -val : val;
    }

    // Convert a linear coordinate back to a directional component.
    // -1 → {W, 1}, +1 → {E, 1}, 0 → {E, 0}.
    private linearToDir(coord: number): { dir: string; val: number } {
        if (coord < 0) return { dir: 'W', val: Math.abs(coord) };
        return { dir: 'E', val: coord };
    }

    // Build a room name from linear offsets, handling hemisphere transitions.
    private buildRoomName(baseH: string, baseHVal: number, dx: number, baseV: string, baseVVal: number, dy: number): string {
        const hCoord = this.dirToLinear(baseH, baseHVal) + dx;
        const vCoord = this.dirToLinear(baseV, baseVVal) + dy;
        const h = this.linearToDir(hCoord);
        const v = this.linearToDir(vCoord);
        return `${h.dir}${h.val}${v.dir}${v.val}`;
    }
}