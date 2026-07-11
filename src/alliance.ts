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
// Two mechanisms: static list (allies array) and dynamic sign-based discovery.

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

// Combined check: is a username an ally via static list OR has the
// username signed a visible controller with the keyword?
export function isFriend(username: string, visibleRooms?: Room[]): boolean {
    if (isAlly(username)) return true;
    if (visibleRooms) {
        for (const room of visibleRooms) {
            const signedBy = isAllyBySign(room);
            if (signedBy === username) return true;
        }
    }
    return false;
}