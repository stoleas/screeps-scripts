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
        this.requestCreep(hatchery, bodyFactory.PROFILES.upgrader, 'upgrader', 1);
    }

    run(): void {
        const upgraders = this.creeps['upgrader'] || [];
        for (const creep of upgraders) {
            roleUpgrader.run(creep);
        }
    }
}