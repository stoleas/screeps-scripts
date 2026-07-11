'use strict';

// Extend Screeps' CreepMemory with our custom fields used across roles.
// This augments the global CreepMemory interface from @types/screeps so
// `creep.memory.role` (and role-specific state flags) are type-safe.

interface CreepMemory {
    role?: string;
    colony?: string;
    overlord?: string;
    delivering?: boolean;
    upgrading?: boolean;
    building?: boolean;
    task?: any;
    _moveData?: { lastPos?: { x: number; y: number; roomName: string }; stuckCount?: number };
}

// Screeps provides a global `console` at runtime but @types/screeps does
// not declare it (it only appears in doc comments). Declare it here so
// TypeScript doesn't reject `console.log()` calls.

declare const console: {
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    info(...args: any[]): void;
};

// Overmind uses a custom ERR_NOT_DONE constant (-4) to signal that a
// Task is still in progress. Screeps doesn't define this; declare it.
declare const ERR_NOT_DONE: number;

// Screeps provides a `global` object at runtime but @types/screeps
// doesn't declare it in a way TS modules can access. Declare it.
declare const global: any;

// Augment Memory with optional stats field used by Mem.load().
interface Memory {
    stats?: any;
    observers?: { [key: string]: { targets: string[]; lastIndex: number } };
    nextExpectedRoom?: string;
    alerts?: AlertEntry[];
    automation?: AutomationEntry[];
}

interface AlertEntry {
    type: string;
    tick: number;
    room?: string;
    severity: 'warning' | 'critical';
    message: string;
}

interface AutomationEntry {
    action: string;
    tick: number;
    room?: string;
    data?: { [key: string]: any };
}

// Augment RoomMemory with optional intel field used by CombatIntel.
interface RoomMemory {
    intel?: {
        // Slow fields (structural, retained 5000 ticks)
        tick: number;               // lastScan for slow fields
        owner?: string;
        rcl?: number;
        sourceCount?: number;
        hasStorage?: boolean;
        // Fast fields (tactical, expired at 1000 ticks)
        fastTick?: number;          // lastScan for fast fields
        hostileCount?: number;
        dangerScore?: number;
        hasTowerThreat?: boolean;
        hasHealers?: boolean;
        hasRanged?: boolean;
    };
}