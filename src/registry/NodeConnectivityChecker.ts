'use strict';

import { EventEmitter } from '../events/EventEmitter';

// NodeConnectivityChecker: verifies creeps have access to node types
// required by their role. Diagnostic-only — logs and emits events,
// does NOT mutate creep assignments.
//
// Node types per role:
//   miner/harvester → FIND_SOURCES_ACTIVE
//   upgrader → room.controller (owned)
//   builder → FIND_MY_CONSTRUCTION_SITES
//   hauler → storage || containers

export const NodeConnectivityChecker = {
    check(): void {
        const ownedRooms = Object.values(Game.rooms).filter(
            r => r.controller && r.controller.my,
        );

        for (const room of ownedRooms) {
            const creepsInRoom = Object.values(Game.creeps).filter(
                c => c.memory.colony === room.name,
            );

            // Critical: zero miners/harvesters.
            const hasHarvester = creepsInRoom.some(
                c => c.memory.role === 'harvester' || c.memory.role === 'miner',
            );
            if (!hasHarvester && creepsInRoom.length > 0) {
                const msg = `No miners or harvesters in ${room.name} — economy will stall`;
                console.log(`[Connectivity] CRITICAL: ${msg}`);
                EventEmitter.emit('ALERT', {
                    type: 'CONNECTIVITY_GAP',
                    room: room.name,
                    severity: 'critical',
                    message: msg,
                });
            }

            // Per-creep checks.
            for (const creep of creepsInRoom) {
                const role = creep.memory.role || 'unknown';
                let gap: string | null = null;

                switch (role) {
                    case 'miner':
                    case 'harvester': {
                        const sources = creep.room.find(FIND_SOURCES_ACTIVE);
                        if (sources.length === 0) gap = 'no active sources in room';
                        break;
                    }
                    case 'upgrader': {
                        if (!creep.room.controller || !creep.room.controller.my) {
                            gap = 'no owned controller in room';
                        }
                        break;
                    }
                    case 'hauler': {
                        const hasStorage = !!creep.room.storage;
                        const hasContainers = creep.room.find(FIND_STRUCTURES, {
                            filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER,
                        }).length > 0;
                        if (!hasStorage && !hasContainers) gap = 'no storage or containers for hauling';
                        break;
                    }
                }

                if (gap) {
                    console.log(`[Connectivity] ${creep.name} (${role}): ${gap} in ${creep.room.name}`);
                    EventEmitter.emit('CONNECTIVITY_GAP', {
                        role,
                        creepName: creep.name,
                        nodeType: role === 'miner' || role === 'harvester' ? 'source'
                               : role === 'upgrader' ? 'controller'
                               : 'storage/container',
                        roomName: creep.room.name,
                        reason: gap,
                    });
                }
            }
        }
    },
};