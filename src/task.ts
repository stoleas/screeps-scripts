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

    // isValidTask: return true if the creep can continue this task
    // (e.g., has energy for repair/build). Override in subclasses.
    isValidTask(_creep: Creep): boolean {
        return true;
    }

    // isValidTarget: return true if the target is still valid for this task
    // (e.g., structure still damaged). Override in subclasses.
    isValidTarget(): boolean {
        return !!this.getTarget();
    }

    // isValid: composite check used by Zerg.isIdle to determine if a creep
    // needs a new task assignment. Returns true when the task is still actionable.
    isValid(creep: Creep): boolean {
        return this.isValidTask(creep) && this.isValidTarget();
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