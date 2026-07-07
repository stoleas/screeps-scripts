'use strict';

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';
import { bodyFactory } from '../bodyFactory';
import { roleHarvester } from '../role.harvester';

export class HarvestOverlord extends Overlord {
    constructor(colony: Colony) {
        super(colony, 'harvest', Priority.Critical);
    }

    init(hatchery: Hatchery): void {
        const count = Math.max(2, this.colony.sources.length * 2);
        this.requestCreep(hatchery, bodyFactory.PROFILES.harvester, 'harvester', count);
    }

    run(): void {
        const harvesters = this.creeps['harvester'] || [];
        for (const creep of harvesters) {
            roleHarvester.run(creep);
        }
    }
}