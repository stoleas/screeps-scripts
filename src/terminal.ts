'use strict';

// Automated resource sharing via market terminals.
// Listens for ally's energy deficits (from comms) and ships resources.
// Also supports coordinated defense (ship energy to rooms under siege).
//
// Terminal cooldown: 10 ticks per send. Only one send per terminal per
// cooldown, so we prioritize: siege defense > energy deficit.
// We run on the comms interval to sync with ally status refreshes.

import { ALLIANCE } from './alliance';
import { comms } from './comms';

export const terminalNetwork = {
    run(): void {
        // Only run every N ticks to save CPU (synced with comms interval).
        if (Game.time % ALLIANCE.commsRefreshInterval !== 0) return;

        const allyStatus = comms.readAllyStatus();
        if (!allyStatus) return;

        // Find our rooms with terminals that have spare energy.
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;
            const terminal = room.terminal;
            if (!terminal) continue;

            // Keep a reserve; only ship surplus.
            const ourEnergy = terminal.store[RESOURCE_ENERGY] || 0;
            if (ourEnergy < ALLIANCE.lowEnergyThreshold * 2) continue;

            const surplus = ourEnergy - ALLIANCE.lowEnergyThreshold;

            // Priority 1: Ship to ally room under siege (boost energy for towers).
            if (allyStatus.defenseRequests.length > 0) {
                const siege = allyStatus.defenseRequests
                    .sort((a, b) => b.threatLevel - a.threatLevel)[0];
                const sendAmount = Math.min(50000, surplus);
                if (sendAmount > 100) {
                    const result = terminal.send(RESOURCE_ENERGY, sendAmount, siege.roomName, 'ally support');
                    if (result === OK) {
                        console.log(`[Terminal] Emergency ${sendAmount} energy to ${siege.roomName} (under siege)`);
                        continue; // terminal is on cooldown
                    }
                }
            }

            // Priority 2: Ship to ally room with largest energy deficit.
            if (allyStatus.energyDeficits.length > 0) {
                const deficit = allyStatus.energyDeficits
                    .sort((a, b) => a.energy - b.energy)[0];
                const sendAmount = Math.min(
                    deficit.needed,
                    surplus,
                    100000,  // cap per transfer
                );
                if (sendAmount > 100) {
                    const result = terminal.send(RESOURCE_ENERGY, sendAmount, deficit.roomName, 'ally support');
                    if (result === OK) {
                        console.log(`[Terminal] Sent ${sendAmount} energy to ${deficit.roomName}`);
                    }
                }
            }
        }
    },
};