'use strict';

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';
import { bodyFactory } from '../bodyFactory';
import { roleBuilder } from '../role.builder';

export class BuildOverlord extends Overlord {
    constructor(colony: Colony) {
        super(colony, 'build', Priority.Normal);
    }

    init(hatchery: Hatchery): void {
        // Only request builders if there are construction sites
        const sites = this.colony.room.find(FIND_MY_CONSTRUCTION_SITES);
        const count = sites.length > 0 ? 1 : 0;
        this.requestCreep(hatchery, bodyFactory.PROFILES.builder, 'builder', count);
    }

    run(): void {
        const builders = this.creeps['builder'] || [];
        for (const creep of builders) {
            roleBuilder.run(creep);
        }
    }
}