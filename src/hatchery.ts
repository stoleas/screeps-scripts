'use strict';

// Spawn-request queue adapted from Overmind's Hatchery.

import { Colony } from './colony';
import { CreepSetup } from './creepSetup';
import { Overlord } from './overlord';
import { Priority } from './priorities';
import { bodyFactory } from './bodyFactory';
import { EventEmitter } from './events/EventEmitter';

interface SpawnRequest {
    overlord: Overlord;
    setup: CreepSetup;
    role: string;
    priority: Priority;
}

export class Hatchery {
    colony: Colony;
    requests: SpawnRequest[] = [];

    constructor(colony: Colony) {
        this.colony = colony;
    }

    request(req: SpawnRequest): void {
        this.requests.push(req);
    }

    run(): void {
        this.requests.sort((a, b) => a.priority - b.priority);

        for (let i = 0; i < this.colony.spawns.length; i++) {
            const spawn = this.colony.spawns[i];
            if (spawn.spawning) continue;

            for (let j = 0; j < this.requests.length; j++) {
                const req = this.requests[j];
                const body = bodyFactory.forRole(spawn.room.energyCapacityAvailable, req.role);
                if (body.length === 0) continue;

                const name = req.role + Game.time + String.fromCharCode(65 + i);
                const result = spawn.spawnCreep(body, name, {
                    memory: {
                        role: req.role,
                        colony: this.colony.name,
                        overlord: req.overlord.ref,
                    },
                });
                if (result === OK) {
                    console.log(`[Hatchery] Spawning ${name} for ${req.overlord.name}`);
                    EventEmitter.emit('CREEP_BIRTH', {
                        creepName: name,
                        role: req.role,
                        colony: this.colony.name,
                        bodyParts: body,
                        ttl: 1500,  // CREEP_LIFE_TIME
                    });
                    this.requests.splice(j, 1);
                    break;
                }
            }
        }
    }
}