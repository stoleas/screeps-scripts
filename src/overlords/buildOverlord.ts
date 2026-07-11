'use strict';

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';
import { bodyFactory } from '../bodyFactory';
import { roleBuilder, BuilderConfig } from '../role.builder';

// RCL-scaled barrier hits caps (from Overmind's WorkerOverlord.settings).
// Prevents workers from getting stuck repairing walls/ramparts infinitely.
function barrierHitsCap(rcl: number): number {
    if (rcl <= 2) return 3000;
    if (rcl === 3) return 10000;
    if (rcl === 4) return 50000;
    return 100000; // RCL5+
}

// Don't fortify barriers unless colony has > this much energy in storage.
// Overmind uses 500k; we lower to 100k for RCL2-3 scale.
const FORTIFY_DUTY_THRESHOLD = 100000;

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
        const config: BuilderConfig = {
            barrierHitsCap: barrierHitsCap(this.colony.level),
            fortifyDutyThreshold: FORTIFY_DUTY_THRESHOLD,
            colony: this.colony,
        };
        this.autoRun(builders, (creep) => roleBuilder.taskHandler(creep, config));
    }
}