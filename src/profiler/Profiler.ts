'use strict';

// CPU profiler with method decorator and global enable/disable flag.
// Default: disabled. Enable from game console: global._profilingEnabled = true
// When disabled, decorated methods run with zero instrumentation overhead
// (one boolean check, branch-predicted, negligible cost).
// When enabled, auto-dumps to console.log every 100 ticks.

if (!(global as any)._profileData) {
    (global as any)._profileData = {};
}
if ((global as any)._profilingEnabled === undefined) {
    (global as any)._profilingEnabled = false;
}

const AUTO_DUMP_INTERVAL = 100;

// Method decorator: wraps a method with CPU tracking.
// Only active when (global as any)._profilingEnabled === true.
export function profile(target: any, key: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
        // Bypass all instrumentation when profiling is disabled (default).
        if (!(global as any)._profilingEnabled) {
            return originalMethod.apply(this, args);
        }

        const start = Game.cpu.getUsed();
        const result = originalMethod.apply(this, args);
        const duration = Game.cpu.getUsed() - start;

        const data = (global as any)._profileData;
        const name = target.constructor ? `${target.constructor.name}.${key}` : key;
        if (!data[name]) {
            data[name] = { totalCpu: 0, calls: 0 };
        }
        data[name].totalCpu += duration;
        data[name].calls++;

        return result;
    };

    return descriptor;
}

export const ProfilerOutput = {
    // Dump accumulated profile data to game console, sorted by total CPU.
    dump(): void {
        const data = (global as any)._profileData;
        const entries = Object.keys(data);
        if (entries.length === 0) {
            console.log('[Profiler] No profile data. Enable with: global._profilingEnabled = true');
            return;
        }

        console.log('--- CPU PROFILE METRICS ---');
        entries.sort((a: string, b: string) => data[b].totalCpu - data[a].totalCpu);
        for (const name of entries) {
            const avg = (data[name].totalCpu / data[name].calls).toFixed(3);
            console.log(`  ${name} | total: ${data[name].totalCpu.toFixed(2)} | calls: ${data[name].calls} | avg: ${avg}`);
        }
    },

    // Clear all accumulated data.
    clear(): void {
        (global as any)._profileData = {};
        console.log('[Profiler] Data cleared');
    },

    // Toggle profiling on/off from game console.
    enable(): void {
        (global as any)._profilingEnabled = true;
        console.log('[Profiler] Enabled — auto-dump every 100 ticks');
    },

    disable(): void {
        (global as any)._profilingEnabled = false;
        console.log('[Profiler] Disabled');
    },

    // Auto-dump: called from main.ts every tick. Only dumps when enabled
    // and on the interval boundary. Clears after dumping to reset counters.
    autoDump(): void {
        if (!(global as any)._profilingEnabled) return;
        if (Game.time % AUTO_DUMP_INTERVAL !== 0) return;

        const data = (global as any)._profileData;
        const entries = Object.keys(data);
        if (entries.length === 0) return;

        console.log(`--- CPU PROFILE (tick ${Game.time}) ---`);
        entries.sort((a: string, b: string) => data[b].totalCpu - data[a].totalCpu);
        for (const name of entries) {
            const avg = (data[name].totalCpu / data[name].calls).toFixed(3);
            console.log(`  ${name} | total: ${data[name].totalCpu.toFixed(2)} | calls: ${data[name].calls} | avg: ${avg}`);
        }

        // Clear after dump so each window is a fresh measurement.
        (global as any)._profileData = {};
    },
};