import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { bodyFactory } from '../src/bodyFactory';

function mockBody(parts: string[]): BodyPartDefinition[] {
    return parts.map(type => ({ type: type as BodyPartConstant, hits: 100, boost: undefined }));
}

test('infers miner from WORK-heavy no-CARRY body', () => {
    assert.strictEqual(bodyFactory.inferRole(mockBody([WORK, WORK, WORK, WORK, WORK, MOVE, MOVE])), 'miner');
});

test('infers hauler from CARRY-only body', () => {
    assert.strictEqual(bodyFactory.inferRole(mockBody([CARRY, CARRY, MOVE, MOVE])), 'hauler');
});

test('infers harvester from mixed WORK+CARRY body', () => {
    assert.strictEqual(bodyFactory.inferRole(mockBody([WORK, WORK, CARRY, MOVE, MOVE, MOVE])), 'harvester');
});

test('infers brawler from ATTACK+TOUGH body', () => {
    assert.strictEqual(bodyFactory.inferRole(mockBody([TOUGH, ATTACK, MOVE, MOVE])), 'brawler');
});

test('infers claimer from CLAIM body', () => {
    assert.strictEqual(bodyFactory.inferRole(mockBody([CLAIM, MOVE])), 'claimer');
});

test('returns unknown for empty body', () => {
    assert.strictEqual(bodyFactory.inferRole([]), 'unknown');
});