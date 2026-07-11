'use strict';

import { Colony } from '../colony';

// LinkNetwork: separate class for link-to-link energy transfers.
// NOT integrated into LogisticsNetwork — links are instant, CPU-cheap, and
// static. LogisticsNetwork is for dynamic, path-calculated creep hauling.
//
// Adapted from Overmind's logistics/LinkNetwork.ts.
// Gemini correction: keep LinkNetwork entirely separate from LogisticsNetwork.

// Links transmit when at this energy level (near full).
const LINKS_TRANSMIT_AT = LINK_CAPACITY - 100;

export class LinkNetwork {
    colony: Colony;
    receive: StructureLink[] = [];
    transmit: StructureLink[] = [];

    constructor(colony: Colony) {
        this.colony = colony;
    }

    refresh(): void {
        this.receive = [];
        this.transmit = [];

        const links = this.colony.room.find<StructureLink>(FIND_MY_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_LINK,
        });

        for (const link of links) {
            const energy = link.store[RESOURCE_ENERGY] || 0;
            if (energy >= LINKS_TRANSMIT_AT) {
                this.transmit.push(link);
            } else if (energy < LINK_CAPACITY * 0.5) {
                this.receive.push(link);
            }
        }
    }

    // Run the link network: greedy match each receive link to the closest
    // transmit link, transfer energy. Remaining transmit links send to
    // the storage link (command center link) if one exists.
    run(): void {
        if (this.transmit.length === 0 || this.receive.length === 0) return;

        // Greedy matching: for each receive link, find the closest transmit link.
        const usedTransmit = new Set<string>();
        for (const recv of this.receive) {
            // Find closest unused transmit link.
            let best: StructureLink | null = null;
            let bestDist = Infinity;
            for (const trans of this.transmit) {
                if (usedTransmit.has(trans.id)) continue;
                const dist = recv.pos.getRangeTo(trans.pos);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = trans;
                }
            }
            if (!best) continue;

            const amount = Math.min(
                best.store[RESOURCE_ENERGY] || 0,
                LINK_CAPACITY - (recv.store[RESOURCE_ENERGY] || 0),
            );
            if (amount > 0) {
                best.transferEnergy(recv, amount);
                usedTransmit.add(best.id);
            }
        }

        // Remaining transmit links send to the storage link (command center).
        // The storage link is the one adjacent to storage (if any).
        const storageLink = this.findStorageLink();
        if (storageLink) {
            for (const trans of this.transmit) {
                if (usedTransmit.has(trans.id)) continue;
                if (trans === storageLink) continue;
                const amount = trans.store[RESOURCE_ENERGY] || 0;
                if (amount > 0) {
                    trans.transferEnergy(storageLink, amount);
                }
            }
        }
    }

    // Find the link adjacent to storage (the command center link).
    private findStorageLink(): StructureLink | null {
        if (!this.colony.storage) return null;
        const links = this.colony.room.find<StructureLink>(FIND_MY_STRUCTURES, {
            filter: (s: Structure) => s.structureType === STRUCTURE_LINK,
        });
        for (const link of links) {
            if (link.pos.isNearTo(this.colony.storage.pos)) {
                return link;
            }
        }
        return null;
    }
}