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

    // Secret keyword for controller-sign-based friend discovery.
    // Both players sign their controllers with this string. When you scout
    // a room, you read controller.sign.text — if it matches, the signer's
    // username (controller.sign.username) is a friend.
    // This lets scripts discover allies dynamically without editing this file.
    // Both players must agree on the keyword and keep it secret.
    signKeyword: 'ZERG_ALLIANCE',

    // Flag prefix for in-game ally discovery.
    // Place a flag named "ally:zh0ul" in any room and the script will
    // recognize "zh0ul" as an ally. Flags are owner-visible only, so
    // each player places their own flags — but it's an easy in-game
    // way to manage friends without editing code.
    // Matches Overmind's name:id naming convention (lowercase).
    flagPrefix: 'ally:',

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

// --- Ally detection -------------------------------------------------
// Three mechanisms: static list, controller signs, and in-game flags.

// Check if a username is an ally via the static allies list.
export function isAlly(username: string): boolean {
    return ALLIANCE.allies.includes(username);
}

// Check if a room's controller sign matches the alliance keyword.
// If it does, the signer's username is an ally. This lets you discover
// new allies dynamically — they just sign their controller with the
// secret keyword and you'll recognize them without editing code.
export function isAllyBySign(room: Room): string | null {
    if (!room.controller) return null;
    const sign = room.controller.sign;
    if (!sign) return null;
    if (sign.text === ALLIANCE.signKeyword) {
        return sign.username;
    }
    return null;
}

// Scan Game.flags for names like "Ally:zh0ul" and return the set of
// ally usernames discovered. Flags are owner-visible only — each
// player places their own flags in-game to manage their friend list.
// Call this once per tick and cache the result.
let _flagAlliesCache: { tick: number; allies: Set<string> } = { tick: -1, allies: new Set() };

export function getFlagAllies(): Set<string> {
    if (_flagAlliesCache.tick === Game.time) {
        return _flagAlliesCache.allies;
    }
    const allies = new Set<string>();
    const prefix = ALLIANCE.flagPrefix;
    for (const flagName in Game.flags) {
        if (flagName.startsWith(prefix)) {
            const username = flagName.slice(prefix.length);
            if (username) allies.add(username);
        }
    }
    _flagAlliesCache = { tick: Game.time, allies };
    return allies;
}

// Check if a username is an ally via in-game flags.
export function isAllyByFlag(username: string): boolean {
    return getFlagAllies().has(username);
}

// Combined check: is a username an ally via any mechanism?
// - Static allies list
// - Controller sign (if visibleRooms provided)
// - In-game flags (Ally:username)
export function isFriend(username: string, visibleRooms?: Room[]): boolean {
    if (isAlly(username)) return true;
    if (isAllyByFlag(username)) return true;
    if (visibleRooms) {
        for (const room of visibleRooms) {
            const signedBy = isAllyBySign(room);
            if (signedBy === username) return true;
        }
    }
    return false;
}