// Screeps globals mock for Node.js test environment.
// Screeps constants are just strings — see @types/screeps.
global.WORK = 'work';
global.CARRY = 'carry';
global.MOVE = 'move';
global.ATTACK = 'attack';
global.RANGED_ATTACK = 'ranged_attack';
global.HEAL = 'heal';
global.TOUGH = 'tough';
global.CLAIM = 'claim';
global.RESOURCE_ENERGY = 'energy';
global.OK = 0;
global.ERR_INVALID_TARGET = -7;
global.ERR_NOT_IN_RANGE = -9;
global.ERR_NO_PATH = -2;
// Phase 1.5: add error-code mocks required by src/task.ts (PERMANENT_CLEAR_CODES + transient negatives).
// Values verified against @types/screeps in the project (2026-07-11).
global.ERR_NOT_FOUND = -5;
global.ERR_INVALID_ARGS = -10;
global.ERR_NO_BODYPART = -12;
global.ERR_RCL_NOT_ENOUGH = -14;
global.ERR_FULL = -8;
global.ERR_NOT_ENOUGH_RESOURCES = -6;
global.ERR_TIRED = -11;
// Custom Overmind constant (task still in progress). Numeric value is -4,
// the same slot Screeps uses for ERR_BUSY; we expose the canonical Screeps
// name separately below so task.test.ts can use the standard constant.
global.ERR_NOT_DONE_OVERMIND = -4;
global.ERR_BUSY = -4;
global.BODYPART_COST = { work: 100, carry: 50, move: 50, attack: 80, ranged_attack: 150, heal: 250, tough: 10, claim: 600 };
global.MAX_CREEP_SIZE = 50;

// Minimal _ for lodash functions used in bodyFactory
global._ = {
    sum: (arr, fn) => arr.reduce((acc, x) => acc + fn(x), 0),
};