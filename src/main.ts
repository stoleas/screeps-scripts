'use strict';

import { Mem } from './memory';
import { Colony } from './colony';
import { ALLIANCE, getFlagAllies } from './alliance';
import { comms } from './comms';
import { terminalNetwork } from './terminal';
import { PRODUCTION } from './production';
import { Hatchery } from './hatchery';
import { HarvestOverlord } from './overlords/harvestOverlord';
import { UpgradeOverlord } from './overlords/upgradeOverlord';
import { BuildOverlord } from './overlords/buildOverlord';
import { HaulerOverlord } from './overlords/haulOverlord';
import { Overlord } from './overlord';
import { roomPlanner } from './roomPlanner';
import { SporeCrawler } from './hiveClusters/sporeCrawler';
import { LogisticsNetwork } from './logistics/LogisticsNetwork';
import { visualizer } from './visualizer';
import { CombatOverlord } from './overlords/combatOverlord';
import { CombatIntel } from './intel/CombatIntel';
import { ProfilerOutput } from './profiler/Profiler';
import { StatsCollector } from './stats/StatsCollector';
import { ObserverOverlord } from './observer/ObserverOverlord';

export const loop = (): void => {
    // Memory management: init, CPU bucket gate, garbage collection.
    Mem.load();
    if (!Mem.shouldRun()) return;
    Mem.clean();

    // Scan in-game flags for ally:username entries. This populates the
    // per-tick cache used by tower IFF and comms, and logs when the set changes.
    getFlagAllies();

    // Alliance: activate our outbound segment and request zh0ul's foreign
    // segment on interval. Data arrives next tick in RawMemory.segments
    // and RawMemory.foreignSegment respectively.
    if (Game.time % ALLIANCE.commsRefreshInterval === 0) {
        // Activate our segment so we can write to it.
        RawMemory.setActiveSegments([ALLIANCE.SEGMENT_OUR]);
        // Request zh0ul's public segment for reading.
        RawMemory.setActiveForeignSegment('zh0ul', ALLIANCE.SEGMENT_ALLY);
        // Publish our status (writes to segment, marks public).
        comms.publishOurStatus();
    }

    // Comms log throttle: only log ally status every N ticks to avoid console spam.
    // Private server ticks are ~3-4s, so 100 ticks ≈ 5-6 minutes.
    // MMO ticks are 2.5-5s, so 100 ticks ≈ 4-8 minutes.
    const COMMS_LOG_INTERVAL = 100;

    // Read ally's status from foreign segment (available if requested last tick).
    const allyStatus = comms.readAllyStatus();
    if (allyStatus) {
        // Only log ally status on the comms interval to avoid console spam.
        // Without this gate, the log fires every tick (~4s on private server),
        // producing hundreds of identical lines per hour.
        const shouldLog = Game.time % COMMS_LOG_INTERVAL === 0;

        if (allyStatus.defenseRequests.length > 0) {
            if (shouldLog) {
                console.log(`[Comms] Ally ${allyStatus.player} requests defense:`,
                    allyStatus.defenseRequests.map(r => r.roomName).join(', '));
            }
        }
        if (allyStatus.energyDeficits.length > 0 && shouldLog) {
            // Filter: only log deficits where energy is actually below threshold
            // AND the deficit is meaningful (energy < needed). Skip zero-energy
            // rooms that spam the console with no actionable info.
            const meaningful = allyStatus.energyDeficits.filter(d => d.energy < ALLIANCE.lowEnergyThreshold);
            if (meaningful.length > 0) {
                console.log(`[Comms] Ally ${allyStatus.player} energy deficits:`,
                    meaningful.map(d => `${d.roomName} (${d.energy}/${ALLIANCE.lowEnergyThreshold})`).join(', '));
            }
        }
    }

    // Terminal network: ship energy to allies under siege or in deficit.
    terminalNetwork.run();

    // Scan visible rooms for intel (cheap — only rooms we already see).
    CombatIntel.scanVisibleRooms();

    // Build colony objects (one per owned room) and tag creeps.
    const colonies: Colony[] = [];
    for (const spawnName in Game.spawns) {
        const room = Game.spawns[spawnName].room;
        if (!_.find(colonies, (c: Colony) => c.name === room.name)) {
            colonies.push(new Colony(room));
        }
    }

    // Tag creeps with their colony (room name) for Colony.creeps filtering.
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (!creep.memory.colony && creep.room.controller && creep.room.controller.my) {
            creep.memory.colony = creep.room.name;
        }
    }

    // Per-colony: plan containers, run SporeCrawler (towers), build LogisticsNetwork,
    // build overlords, spawn via hatchery, run overlord logic, render visualizer.
    // CPU gate: harvest+spawn always run; build+upgrade+room-planning only when bucket healthy.
    for (const colony of colonies) {
        // Room planning: place structures from bunker layout.
        // Skipped when CPU bucket is low (non-essential).
        if (!PRODUCTION.isCpuWarning()) {
            roomPlanner.plan(colony.room);
        }

        // SporeCrawler: tower defense with IFF (replaces flat towerDefense module).
        const primaryTower = colony.room.find<StructureTower>(FIND_MY_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_TOWER,
        })[0];
        if (primaryTower) {
            const sporeCrawler = new SporeCrawler(colony, primaryTower);
            sporeCrawler.refresh();
            sporeCrawler.run();
        }

        // Logistics network: register provide/request nodes for hauler routing.
        const logistics = new LogisticsNetwork(colony);
        logistics.refresh();

        // Build overlords for this colony.
        const overlords: Overlord[] = [
            new HarvestOverlord(colony),
            new HaulerOverlord(colony, logistics),
            new CombatOverlord(colony),  // defensive
            new ObserverOverlord(colony),  // RCL8 room scanning (no-op without Observer)
        ];
        // Upgrade and build overlords are non-essential when CPU is low.
        if (!PRODUCTION.isCpuWarning()) {
            overlords.push(new UpgradeOverlord(colony));
            overlords.push(new BuildOverlord(colony));
        }

        // Refresh creep assignments, request spawns, then run.
        const hatchery = new Hatchery(colony);
        for (const overlord of overlords) {
            overlord.refresh();
            overlord.init(hatchery);
        }
        hatchery.run();

        for (const overlord of overlords) {
            overlord.run();
        }

        // Show what's currently being spawned above each spawn.
        for (const spawn of colony.spawns) {
            if (spawn.spawning) {
                const spawningCreep = Game.creeps[spawn.spawning.name];
                spawn.room.visual.text(`🛠️ ${spawningCreep.memory.role}`, spawn.pos.x + 1, spawn.pos.y, {
                    align: 'left',
                    opacity: 0.8
                });
            }
        }

        // RoomVisual dashboard (client-side rendering, near-zero server CPU).
        visualizer.run(colony.room);
    }

    // Offensive combat: scan for attack:<roomName> flags and spawn
    // remote CombatOverlords for each. Uses the first colony as the
    // spawning base (brawlers spawn there and march to the target).
    if (colonies.length > 0) {
        const spawnColony = colonies[0];
        const offensiveOverlords: CombatOverlord[] = [];
        for (const flagName in Game.flags) {
            if (!flagName.startsWith('attack:')) continue;
            const targetRoom = flagName.slice('attack:'.length);
            // Only create if we have vision of the target room (CombatPlanner
            // needs room data to evaluate). If no vision, CombatOverlord.init
            // will skip (targetRoom returns null).
            const offensiveOverlord = new CombatOverlord(spawnColony, targetRoom);
            offensiveOverlords.push(offensiveOverlord);
        }
        if (offensiveOverlords.length > 0) {
            const hatchery = new Hatchery(spawnColony);
            for (const overlord of offensiveOverlords) {
                overlord.refresh();
                overlord.init(hatchery);
            }
            hatchery.run();
            for (const overlord of offensiveOverlords) {
                overlord.run();
            }
        }
    }

    // Profiler: auto-dump every 100 ticks when enabled (no-op when disabled).
    ProfilerOutput.autoDump();

    // Collect metrics for external Grafana pipeline. Runs every 10 ticks.
    StatsCollector.collect();
};