'use strict';

import { Mem } from './memory';
import { Colony, ColonyStage } from './colony';
import { ALLIANCE, getFlagAllies, autoFlagAllies } from './alliance';
import { comms } from './comms';
import { terminalNetwork } from './terminal';
import { PRODUCTION } from './production';
import { Hatchery } from './hatchery';
import { HarvestOverlord } from './overlords/harvestOverlord';
import { UpgradeOverlord } from './overlords/upgradeOverlord';
import { BuildOverlord } from './overlords/buildOverlord';
import { HaulerOverlord } from './overlords/haulOverlord';
import { BootstrapOverlord } from './overlords/bootstrapOverlord';
import { Overlord } from './overlord';
import { roomPlanner } from './roomPlanner';
import { SporeCrawler } from './hiveClusters/sporeCrawler';
import { LogisticsNetwork } from './logistics/LogisticsNetwork';
import { LinkNetwork } from './logistics/LinkNetwork';
import { visualizer } from './visualizer';
import { CombatOverlord } from './overlords/combatOverlord';
import { CombatIntel } from './intel/CombatIntel';
import { ProfilerOutput } from './profiler/Profiler';
import { StatsCollector } from './stats/StatsCollector';
import { ObserverOverlord } from './observer/ObserverOverlord';
import { AlertEmitter } from './alerts/AlertEmitter';
import { AutomationConsumer } from './automation/AutomationConsumer';

export const loop = (): void => {
    // Memory management: init, CPU bucket gate, garbage collection.
    Mem.load();
    if (!Mem.shouldRun()) return;
    Mem.clean();

    // Consume automation directives from Memory.automation (written by
    // external pipeline via Screeps REST API). Runs early so actions like
    // safeMode take effect before this tick's defense logic runs.
    AutomationConsumer.consume();

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

        // Link network: greedy matching for link-to-link energy transfers (RCL6+).
        // Separate from LogisticsNetwork — links are instant and CPU-cheap.
        const links = colony.room.find<StructureLink>(FIND_MY_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_LINK,
        });
        if (links.length >= 2) {
            const linkNetwork = new LinkNetwork(colony);
            linkNetwork.refresh();
            linkNetwork.run();
        }

        // Build overlords for this colony.
        // Bootstrap check: if colony has zero creeps or zero harvesters/miners,
        // enter emergency bootstrap mode — suppress normal overlords.
        colony.bootstrapping = BootstrapOverlord.needsBootstrap(colony);

        const overlords: Overlord[] = [];
        if (colony.bootstrapping) {
            // Emergency mode: only BootstrapOverlord runs.
            overlords.push(new BootstrapOverlord(colony));
        } else {
            overlords.push(new HarvestOverlord(colony));
            overlords.push(new HaulerOverlord(colony, logistics));
            overlords.push(new CombatOverlord(colony));  // defensive
            overlords.push(new ObserverOverlord(colony));  // RCL8 room scanning (no-op without Observer)
            // Upgrade and build overlords are non-essential when CPU is low.
            if (!PRODUCTION.isCpuWarning()) {
                overlords.push(new UpgradeOverlord(colony));
                overlords.push(new BuildOverlord(colony));
            }
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

        // Safe mode auto-activation: detect hostile attack on critical structures.
        // Skip at Larva stage (RCL 1-3) — too early to waste safe mode.
        if (colony.stage !== ColonyStage.Larva) {
            handleSafeMode(colony);
        }
    }

    // Auto-place ally:<username>@<roomName> flags in owned rooms and rooms
    // where allies have creeps/structures. Throttled to every 100 ticks.
    autoFlagAllies(
        colonies.map(c => c.room),
        Object.values(Game.rooms)
    );

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

    // Detect anomalies (defense breaches, CPU spikes) and write to
    // Memory.alerts. External connector polls this for alert dispatch.
    AlertEmitter.check();

    // Collect metrics for external Grafana pipeline. Runs every 10 ticks.
    StatsCollector.collect();
};

// Safe mode auto-activation: trigger when hostile creeps with attack/work
// parts are within range 2 of a Spawn, Storage, or Tower AND that structure
// is taking damage (hits < hitsMax). Redesigned per Gemini feedback —
// dangerScore>5 is too volatile (scouts/edge-traversers cause false positives).
// Adapted from Overmind's Overseer.handleSafeMode.
function handleSafeMode(colony: Colony): void {
    const controller = colony.controller;
    if (!controller) return;
    // Already in safe mode or none available.
    if (controller.safeMode) return;
    if (controller.safeModeAvailable <= 0) return;

    const room = colony.room;

    // Find hostiles with attack or work parts.
    const hostiles = room.find(FIND_HOSTILE_CREEPS, {
        filter: (c: Creep) => {
            return c.body.some(p => p.type === ATTACK || p.type === WORK);
        },
    });
    if (hostiles.length === 0) return;

    // Check if any hostile is within range 2 of a critical structure
    // that is currently taking damage.
    const criticalStructures = room.find(FIND_MY_STRUCTURES, {
        filter: (s: Structure) =>
            (s.structureType === STRUCTURE_SPAWN ||
             s.structureType === STRUCTURE_STORAGE ||
             s.structureType === STRUCTURE_TOWER) &&
            s.hits < s.hitsMax,
    });

    for (const hostile of hostiles) {
        for (const struct of criticalStructures) {
            if (hostile.pos.inRangeTo(struct.pos, 2)) {
                const result = controller.activateSafeMode();
                if (result === OK) {
                    console.log(`[SafeMode] Activated in ${room.name} — ${hostiles.length} hostile(s), ${struct.structureType} under attack`);
                }
                return;
            }
        }
    }
}