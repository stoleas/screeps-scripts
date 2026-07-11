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
        // 3 upgraders: 6 e/t into controller (3×2W each).
        // With static miners saturating 20 e/t source income, 3 upgraders
        // consume 6 e/t → 45,000/6 = 7,500 ticks ≈ 5.2h to RCL3 (~3x speedup).
        this.requestCreep(hatchery, bodyFactory.PROFILES.upgrader, 'upgrader', 3);
    }

    run(): void {
        const upgraders = this.creeps['upgrader'] || [];
        for (const creep of upgraders) {
            roleUpgrader.run(creep);
        }
    }
}