'use strict';

// Abstract Task base class adapted from Overmind's Task.ts.
// Encapsulates "travel to target → perform action → detect completion"
// as a serializable object stored in creep.memory.task.

interface TaskTarget {
    ref: string;       // target ID or name
    pos: { x: number; y: number; roomName: string };  // target position for vision-loss recovery
}

interface TaskData {
    [key: string]: any;
}

export interface SavedTask {
    name: string;
    _target: TaskTarget;
    _parent: SavedTask | null;
    tick: number;
    settings: { range: number };
    options: { [key: string]: any };
    data: TaskData;
}

export abstract class Task {
    name: string;
    protected _target: TaskTarget;
    protected _parent: SavedTask | null;
    tick: number;
    settings: { range: number };
    options: { [key: string]: any };
    data: TaskData;

    private static registry: { [name: string]: { fromMemory: (saved: SavedTask) => Task } } = {};

    constructor(taskName: string, target: { id?: string; name?: string; pos: RoomPosition }) {
        this.name = taskName;
        this._target = {
            ref: target.id || target.name || '',
            pos: target.pos ? { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName } : { x: 0, y: 0, roomName: '' },
        };
        this._parent = null;
        this.tick = Game.time;
        this.settings = { range: 1 };
        this.options = {};
        this.data = {};
    }

    get targetPos(): RoomPosition | undefined {
        if (this._target.pos) {
            return new RoomPosition(this._target.pos.x, this._target.pos.y, this._target.pos.roomName);
        }
        return undefined;
    }

    getTarget(): RoomObject | null {
        const obj = Game.getObjectById(this._target.ref as string);
        return obj as RoomObject | null;
    }

    fork(parentTask: Task): Task {
        // Set parent: when this task completes, the parent runs next.
        this._parent = parentTask.save();
        return this;
    }

    save(): SavedTask {
        return {
            name: this.name,
            _target: this._target,
            _parent: this._parent,
            tick: this.tick,
            settings: this.settings,
            options: this.options,
            data: this.data,
        };
    }

    abstract run(creep: Creep): number;

    static register(name: string, ctor: { fromMemory: (saved: SavedTask) => Task }): void {
        Task.registry[name] = ctor;
    }

    static load(creep: Creep): Task | null {
        const saved = creep.memory.task as SavedTask | undefined;
        if (!saved) return null;
        const entry = Task.registry[saved.name];
        if (entry) {
            return entry.fromMemory(saved);
        }
        return null;
    }
}

// =============================================================================
// Phase 1.5: Task Stuck Recovery
// =============================================================================
//
// Per-tick helper for role files: given the result code returned by
// `task.run(creep)` and the current age of the task, decide whether the
// role should clear `creep.memory.task` so the next `run()` re-assigns.
//
// Background: roles currently check only `result === OK || result === ERR_INVALID_TARGET`.
// Error codes that escape the task layer unmapped (ERR_NOT_FOUND, ERR_INVALID_ARGS,
// ERR_NO_BODYPART, ERR_RCL_NOT_ENOUGH) used to leave the creep looping on a broken
// task forever — observed as a 30-min dead zone in upgrader stalls.
//
// Escalation model: in-tick reactive → 15-min cron SRE → engineer. This helper
// is the in-tick reactive layer. The 50-tick timeout is the final safety net
// for any error code we didn't classify (transient codes that never resolve).

/**
 * Maximum ticks a task can remain active before it is force-cleared.
 * Safety net for error codes that aren't explicitly classified below.
 */
export const TASK_TIMEOUT = 50;

/**
 * Error codes that indicate the task is permanently broken and the role
 * should drop it from `creep.memory.task` immediately so the next tick
 * can re-assign a fresh task. Validated against the Screeps API and
 * Gemini review (3.5-flash, 2026-07-11).
 */
const PERMANENT_CLEAR_CODES: ReadonlySet<number> = new Set<number>([
    OK,                    // Task succeeded
    ERR_INVALID_TARGET,    // Target ref gone, path impossible, or task-layer-mapped depletion
    ERR_NOT_FOUND,         // Target doesn't exist
    ERR_INVALID_ARGS,      // Bad task parameters
    ERR_NO_BODYPART,       // Creep lost the required body part
    ERR_RCL_NOT_ENOUGH,    // Room controller level insufficient
    // NOTE: Gemini plan referenced ERR_GENTLEMAN (Safe Mode), but that constant
    // is NOT defined in @types/screeps (verified 2026-07-11 in DefinitelyTyped
    // master). Omitted from the clear list — if a Safe Mode code ever surfaces
    // unmapped, the 50-tick TASK_TIMEOUT safety net will clear it instead.
]);

/**
 * Decide whether a role should clear its current task this tick.
 *
 * @param result The return value of `task.run(creep)`.
 * @param age Number of ticks the task has been active (`Game.time - task.tick`).
 * @returns `true` if the role should set `creep.memory.task = null`.
 */
export function shouldClearTask(result: number, age: number): boolean {
    if (PERMANENT_CLEAR_CODES.has(result)) return true;
    if (age > TASK_TIMEOUT) return true;
    return false;
}
