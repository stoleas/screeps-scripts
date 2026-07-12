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
global.ERR_NOT_DONE = -4;  // Custom Overmind constant
global.BODYPART_COST = { work: 100, carry: 50, move: 50, attack: 80, ranged_attack: 150, heal: 250, tough: 10, claim: 600 };
global.MAX_CREEP_SIZE = 50;

// Minimal _ for lodash functions used in bodyFactory
global._ = {
    sum: (arr, fn) => arr.reduce((acc, x) => acc + fn(x), 0),
};