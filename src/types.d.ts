'use strict';

// Extend Screeps' CreepMemory with our custom fields used across roles.
// This augments the global CreepMemory interface from @types/screeps so
// `creep.memory.role` (and role-specific state flags) are type-safe.

interface CreepMemory {
    role?: string;
    delivering?: boolean;
    upgrading?: boolean;
    building?: boolean;
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