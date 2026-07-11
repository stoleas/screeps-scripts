'use strict';

// AutomationConsumer: reads Memory.automation entries written by external
// automation (via Screeps REST API), validates them against a whitelist,
// executes the requested action, and clears the queue.
//
// The external pipeline (whatever it is — EDA, n8n, a cron script, etc.)
// POSTs to the Screeps API to write Memory.automation entries. This module
// runs in-game and consumes them. The interface is intentionally generic
// so the external system can be swapped without changing in-game code.
//
// Whitelist of allowed actions:
// - safeMode:        activate safe mode in a room
// - setPriority:     adjust an overlord's spawn priority (future)
// - notify:          log a message to console (no-op action, just visibility)

const ALLOWED_ACTIONS = ['safeMode', 'setPriority', 'notify'];

export const AutomationConsumer = {
    consume(): void {
        if (!Memory.automation || Memory.automation.length === 0) return;

        for (const entry of Memory.automation) {
            // Validate against whitelist.
            if (!ALLOWED_ACTIONS.includes(entry.action)) {
                console.log(`[Automation] Rejected unknown action: ${entry.action}`);
                continue;
            }

            // Stale check: ignore entries older than 100 ticks.
            if (Game.time - entry.tick > 100) {
                console.log(`[Automation] Dropped stale entry: ${entry.action} (age ${Game.time - entry.tick})`);
                continue;
            }

            this.execute(entry);
        }

        // Clear the queue after processing.
        Memory.automation = [];
    },

    execute(entry: AutomationEntry): void {
        switch (entry.action) {
            case 'safeMode': {
                if (!entry.room) {
                    console.log('[Automation] safeMode: no room specified');
                    return;
                }
                const room = Game.rooms[entry.room];
                if (!room || !room.controller || !room.controller.my) {
                    console.log(`[Automation] safeMode: room ${entry.room} not visible or not owned`);
                    return;
                }
                const result = room.controller.activateSafeMode();
                console.log(`[Automation] safeMode in ${entry.room}: result ${result}`);
                break;
            }

            case 'setPriority': {
                // Future: adjust overlord priority dynamically.
                // For now, just log the request.
                console.log(`[Automation] setPriority: ${entry.data ? JSON.stringify(entry.data) : 'no data'} (not yet implemented)`);
                break;
            }

            case 'notify': {
                const msg = entry.data && entry.data.message ? entry.data.message : '(no message)';
                console.log(`[Automation] notify: ${msg}`);
                break;
            }

            default:
                // Already filtered by whitelist, but satisfy TS exhaustiveness.
                break;
        }
    },
};