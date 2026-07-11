'use strict';

// MMO-specific constants and CPU management.
// The official world differs from private servers in three ways:
//   1. Tick rate: 2.5-5s/tick (vs 10+/sec on private). Code must be
//      event-driven on Game.time, never wall-clock time.
//   2. CPU cap: 20 on free tier / shard 3; scales with GCL on paid.
//      Must halt non-essential work when bucket is low.
//   3. NPC Invaders: spawn automatically in neutral rooms when
//      harvesting thresholds are met. Defensive towers must be
//      active before safe mode expires.

export const PRODUCTION = {
    // Shard name (Game.shard.name at runtime — lazily accessed).
    get shardName(): string {
        return Game.shard.name;
    },

    // True if running on the official MMO world (shard0-3).
    get isMMO(): boolean {
        return Game.shard.name.startsWith('shard');
    },

    // CPU management thresholds.
    // Mem.shouldRun() already gates at bucket < 500 (hard floor — skip tick).
    // Here we add a "warning" tier: run critical-only when bucket < 2000.
    isCpuCritical: (): boolean => Game.cpu.bucket < 500,
    isCpuWarning: (): boolean => Game.cpu.bucket < 2000,

    // 20-CPU cap on free tier / shard 3.
    isLowCpuShard: (): boolean => Game.shard.name === 'shard3' || Game.cpu.limit <= 20,

    // NPC Invader detection — if true, scan for invaders in neutral rooms
    // before harvesting remotely.
    enableNpcInvaderCheck: true,

    // Safe mode duration: 20,000 ticks after first spawn.
    // Ensure defenses are up before this expires.
    safeModeDuration: 20000,
};

// CPU gate: run critical-only logic when bucket is low, full logic otherwise.
// critical() always runs. standard() only runs when bucket is healthy.
export function runWithCpuGate(
    critical: () => void,
    standard: () => void,
): void {
    critical();
    if (!PRODUCTION.isCpuWarning()) {
        standard();
    } else {
        console.log(`[CPU WARN] Bucket low (${Game.cpu.bucket}). Running critical-only.`);
    }
}