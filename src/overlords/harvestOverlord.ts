'use strict';

import { Overlord } from '../overlord';
import { Colony } from '../colony';
import { Priority } from '../priorities';
import { Hatchery } from '../hatchery';
import { bodyFactory } from '../bodyFactory';
import { roleMiner } from '../role.miner';
import { roleHarvester } from '../role.harvester';

// HarvestOverlord: 1 static miner per source + emergency harvester fallback.
// At RCL2 (550 energy): miner = [W,W,W,W,W,M,M], drops to container, haulers
// transport. If not enough miners alive yet, fall back to mobile harvesters
// so the colony doesn't starve during bootstrap.

export class HarvestOverlord extends Overlord {
    constructor(colony: Colony) {
        super(colony, 'harvest', Priority.Critical);
    }

    init(hatchery: Hatchery): void {
        const sourceCount = this.colony.sources.length;
        const miners = this.creeps['miner'] || [];
        const harvesters = this.creeps['harvester'] || [];

        // Request 1 miner per source.
        const minersNeeded = sourceCount - miners.length;
        for (let i = 0; i < minersNeeded; i++) {
            this.requestCreep(hatchery, bodyFactory.PROFILES.miner, 'miner', sourceCount);
        }

        // Emergency fallback: if we have fewer miners than sources AND
        // fewer than 2 total harvesters, request mobile harvesters to
        // keep the economy running during bootstrap.
        if (miners.length < sourceCount && harvesters.length < 2) {
            this.requestCreep(hatchery, bodyFactory.PROFILES.harvesterStarter, 'harvester', 2);
        }
    }

    run(): void {
        const miners = this.creeps['miner'] || [];
        for (const creep of miners) {
            roleMiner.run(creep);
        }

        // Run any remaining mobile harvesters (bootstrap fallback).
        const harvesters = this.creeps['harvester'] || [];
        for (const creep of harvesters) {
            roleHarvester.run(creep);
        }
    }
}