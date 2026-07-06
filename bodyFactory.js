'use strict';

// bodyFactory.js
// Dynamic body-part scaler for RCL1 → RCL2 transition.
//
// Replaces the hardcoded STARTER_BODY = [WORK, CARRY, MOVE] (200 energy)
// with a tiered profile per role that scales up as room.energyCapacityAvailable
// rises through the RCL2 extension unlocks (300, 400, 550, 800).
//
// Usage from main.js:
//   var body = bodyFactory.forRole(spawn.room.energyCapacityAvailable, wantedRole);
//   if (body.length === 0) continue;  // not enough energy for even tier1
//   spawn.spawnCreep(body, name, { memory: { role: wantedRole } });
//
// Design notes:
//  - Each role has its own tier table because the WORK/CARRY ratio that
//    maximizes harvester throughput is not the same as the ratio that
//    maximizes controller-upgrade throughput. A harvester with 2 WORK
//    parts harvests 4 energy/tick; the same 2 WORK parts on an upgrader
//    upgrade 2 energy/tick, but the upgrader also needs to *carry* that
//    energy from a source, so the CARRY/MOVE ratio matters more.
//  - Tiers are walked in cost-descending order; the first one that fits
//    in the available energy budget is returned. If even tier1 doesn't
//    fit (e.g. room has 150 energy and is still building extensions),
//    the function returns [] and the spawn manager skips this tick.
//  - Body parts cap at 50 per creep (Screeps hard limit). All profiles
//    below are far under that ceiling for early-game scaling.
//  - Body costs: WORK=100, CARRY=50, MOVE=50. ATTACK/RANGED/HEAL/CLAIM
//    are out of scope for RCL1→RCL2 but the cost table is here for the
//    day someone adds a military role.
//
// MOVE-ratio rationale (rebalanced 2026-07-06):
//  A creep moves at 1 tile/tick only when MOVE >= (non-MOVE) parts.
//  The previous tier tables were under-MOVEd (e.g. harvester tier4 had
//  6 fat parts but only 2 MOVE → moved at ~0.5 tiles/tick). This
//  rebalance makes every tier2+ body 1:1 fat:MOVE so they walk at full
//  speed. The energy cost roughly doubles per tier, which is fine because
//  the RCL2 extension set tops out at 800 energy, exactly matching the
//  new harvester tier4. Tier1 stays at the 200-energy RCL1 floor
//  ([WORK, CARRY, MOVE], under-MOVEd) because anything cheaper doesn't
//  fit the 1-MOVE-per-creep minimum.

var bodyFactory = {

    /**
     * Body part cost table. Standard Screeps values.
     *
     * IMPORTANT: the keys here MUST match the runtime values of the
     * WORK / CARRY / MOVE / etc. constants that Screeps provides. In
     * modern Screeps these are lowercase strings ('work', 'carry',
     * 'move', ...). The previous table used uppercase string keys
     * ('WORK', 'CARRY', 'MOVE', ...) which would always miss at
     * runtime and report cost = 0 in the spawn log.
     *
     * @const
     */
    COSTS: {
        move: 50,
        work: 100,
        carry: 50,
        attack: 80,
        ranged_attack: 150,
        heal: 250,
        tough: 10,
        claim: 600
    },

    /**
     * Calculate the total energy cost of a body part array.
     * @param {string[]} body - body part array, e.g. [WORK, CARRY, MOVE]
     * @returns {number} total cost
     */
    costOf: function (body) {
        var total = 0;
        for (var i = 0; i < body.length; i++) {
            total += this.COSTS[body[i]] || 0;
        }
        return total;
    },

    /**
     * Tiered body profiles per role, ordered cheapest-to-most-expensive.
     * The scaler picks the most-expensive tier whose cost <= available energy.
     *
     * Harvester bottleneck: WORK parts (more = more energy/tick).
     * Upgrader bottleneck:  WORK parts (controller upgrade is gated on WORK count).
     * Builder bottleneck:   mixed; CARRY matters for source runs.
     *
     * All tier2+ bodies are 1:1 fat:MOVE so the creep walks at 1 tile/tick.
     * Tier1 stays at the 200-energy RCL1 floor ([WORK, CARRY, MOVE],
     * under-MOVEd) because any fewer parts would not have a MOVE at all.
     *
     * @const
     */
    PROFILES: {
        harvester: [
            { name: 'tier1', body: [WORK, CARRY, MOVE] },                                   // 200 (RCL1 floor; under-MOVEd 2:1)
            { name: 'tier2', body: [WORK, WORK, CARRY, MOVE, MOVE, MOVE] },                 // 400 (1st extension: 2W+1C+3M)
            { name: 'tier3', body: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] },     // 500 (mid RCL2: 2W+2C+4M)
            { name: 'tier4', body: [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE] } // 750 (full RCL2: 3W+3C+6M)
        ],
        upgrader: [
            { name: 'tier1', body: [WORK, CARRY, MOVE] },                                   // 200
            { name: 'tier2', body: [WORK, WORK, CARRY, MOVE, MOVE, MOVE] },                 // 400
            { name: 'tier3', body: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] }     // 500
        ],
        builder: [
            { name: 'tier1', body: [WORK, CARRY, MOVE] },                                   // 200
            { name: 'tier2', body: [WORK, CARRY, CARRY, MOVE, MOVE, MOVE] },                // 350 (1W+2C+3M)
            { name: 'tier3', body: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] }     // 500
        ],
        // RCL4 placeholder: hauler picks up from containers and delivers to
        // spawn/extensions/storage. CARRY-heavy, balanced MOVE. Empty for
        // now because there is no Storage at RCL1-3 to haul *to*; populated
        // when RCL4 Storage is built.
        hauler: [
            // { name: 'tier1', body: [CARRY, CARRY, MOVE, MOVE] },  // 200 (2C+2M)
            // { name: 'tier2', body: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] } // 400 (4C+4M)
        ]
    },

    /**
     * Pick the most-expensive body profile for a role that fits in the
     * available energy budget. Returns [] if even tier1 is unaffordable.
     *
     * @param {number} energy - typically spawn.room.energyCapacityAvailable
     * @param {string} role - 'harvester' | 'upgrader' | 'builder'
     * @returns {string[]} body parts array, or [] if unaffordable
     */
    forRole: function (energy, role) {
        var profiles = this.PROFILES[role];
        if (!profiles) {
            // Unknown role: return the cheapest possible body so the spawn
            // manager still has *something* to work with. This shouldn't
            // happen in practice — the spawn manager only calls this with
            // roles it knows about.
            return [WORK, CARRY, MOVE];
        }
        // Walk profiles from most-expensive to cheapest; first one that
        // fits in the energy budget wins. Returning [] on total miss lets
        // the caller skip this tick without queueing a broken spawn.
        var chosen = null;
        for (var i = 0; i < profiles.length; i++) {
            var profile = profiles[i];
            if (this.costOf(profile.body) <= energy) {
                chosen = profile;  // keep walking — later (more expensive) profiles override
            }
        }
        return chosen ? chosen.body : [];
    }
};

module.exports = bodyFactory;
