'use strict';

// Shared alliance configuration — both players import this into their main loops.
// Keep this file in sync between both codebases via the shared GitHub repo.

export const ALLIANCE = {
    // In-game usernames of allied players. Towers, defenders, and combat
    // logic MUST filter targets against this list before attacking.
    allies: [
        'stoleas',    // our MMO username
        'zh0ul',      // zh0ul's MMO username
    ],

    // Rooms where both players have transit permissions or shared operations.
    // Used by scouting/defense logic to allow allied creeps to pass through.
    sharedRooms: [
        // 'W1N1', 'W1N2',  // fill in once rooms are chosen
    ],

    // Resource thresholds for automated assistance.
    lowEnergyThreshold: 50000,     // trigger automated energy request
    underSiegeThreshold: 0.3,      // towers below 30% → request defense help

    // Communication segment IDs (RawMemory segments 0-99).
    // We write to SEGMENT_OUR and mark it public; zh0ul reads it via
    // setActiveForeignSegment. We read zh0ul's segment via SEGMENT_ALLY.
    SEGMENT_OUR: 90,            // our outbound segment (public)
    SEGMENT_ALLY: 90,           // ally's segment we read (zh0ul publishes to 90)

    // Update cadence — how often to refresh ally data (in ticks).
    // On private server (fast ticks): every 10 ticks.
    // On MMO (slow ticks, 2.5-5s/tick): every 5 ticks is enough.
    commsRefreshInterval: 10,
};

// Convenience: check if a username is an ally.
export function isAlly(username: string): boolean {
    return ALLIANCE.allies.includes(username);
}