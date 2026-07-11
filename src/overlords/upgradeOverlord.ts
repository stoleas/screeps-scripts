'use strict';

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';
import { bodyFactory } from '../bodyFactory';
import { roleUpgrader } from '../role.upgrader';

export class UpgradeOverlord extends Overlord {
    constructor(colony: Colony) {
        super(colony, 'upgrade', Priority.NormalHigh);
    }

    init(hatchery: Hatchery): void {
        let count: number;
        if (this.colony.storage) {
            const energy = this.colony.storage.store[RESOURCE_ENERGY] || 0;
            // Overmind: upgradePowerNeeded = 1 + floor((assets.energy - 100000 buffer) / 10000)
            // The 100k buffer prevents starving spawn/defense/construction during energy crises.
            const excess = Math.max(energy - 100000, 0);
            count = 1 + Math.floor(excess / 10000);
            count = Math.min(count, 6); // cap at 6 for RCL2-7 (Overmind caps at 15 for RCL8)
        } else {
            // No storage: fixed 2 (RCL2-3 early game).
            count = 2;
        }
        this.requestCreep(hatchery, bodyFactory.PROFILES.upgrader, 'upgrader', count);
    }

    run(): void {
        const upgraders = this.creeps['upgrader'] || [];
        this.autoRun(upgraders, (creep) => roleUpgrader.taskHandler(creep));
    }
}