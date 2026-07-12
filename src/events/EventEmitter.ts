'use strict';

// EventEmitter: central event FIFO manager.
// All game-state events flow through this module into Memory.events.
// The external Dolt connector polls Memory.events, inserts into Dolt,
// and clears by ID range (race-condition-safe).
//
// FIFO is capped at 500 entries (~100KB max). When full, oldest
// entries are dropped. The cap is a safety valve for when the
// connector is unreachable — Dolt holds the full history.

const MAX_EVENTS = 500;

export interface GameEvent {
    id: number;       // sequential ID for race-condition-safe clearing
    type: string;     // INTRUSION, ROOM_SNAPSHOT, CREEP_BIRTH, CREEP_DEATH,
                      // COMBAT, ECONOMIC, ALERT, AUTOMATION, FLAG_CREATED,
                      // FLAG_REMOVED, CONNECTIVITY_GAP, DISCOVERY, GLOBAL_SNAPSHOT
    tick: number;
    data: { [key: string]: any };
}

export const EventEmitter = {
    // Sequential ID counter — stored in Memory so it survives global resets.
    // This ensures the connector can safely clear by ID range.
    nextId(): number {
        if (!(Memory as any)._eventSeq) (Memory as any)._eventSeq = 0;
        return ++(Memory as any)._eventSeq;
    },

    emit(type: string, data: { [key: string]: any }): void {
        if (!(Memory as any).events) (Memory as any).events = [];

        const event: GameEvent = {
            id: this.nextId(),
            type,
            tick: Game.time,
            data,
        };

        (Memory as any).events.push(event);

        // FIFO trim — drop oldest if over cap.
        if ((Memory as any).events.length > MAX_EVENTS) {
            (Memory as any).events = (Memory as any).events.slice(-MAX_EVENTS);
        }
    },

    // Called by the external connector (via REST API) to clear
    // events up to a specific ID. This is race-condition-safe:
    // events with id > maxId are preserved.
    clearTo(maxId: number): number {
        if (!(Memory as any).events) return 0;
        const before = (Memory as any).events.length;
        (Memory as any).events = (Memory as any).events.filter((e: GameEvent) => e.id > maxId);
        return before - (Memory as any).events.length;
    },

    // Get all events (for the connector to read).
    getAll(): GameEvent[] {
        return ((Memory as any).events || []) as GameEvent[];
    },
};