import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { shouldClearTask, TASK_TIMEOUT } from '../src/task';

// =============================================================================
// Phase 1.5 Task 7: cover shouldClearTask error classification
//
// PERMANENT_CLEAR_CODES (6): OK, ERR_INVALID_TARGET, ERR_NOT_FOUND,
//   ERR_INVALID_ARGS, ERR_NO_BODYPART, ERR_RCL_NOT_ENOUGH. Anything in this
//   set must be cleared on the same tick it's observed, regardless of age.
// Transient codes (4) — must NOT be cleared at age=0 (they should retry).
// Timeout safety net (3) — bound at TASK_TIMEOUT, strictly greater-than.
// TASK_TIMEOUT constant (1) — exported value sanity check.
// =============================================================================

// ---- Permanent clear codes (6) ----

test('shouldClearTask clears on OK (task succeeded)', () => {
    assert.strictEqual(shouldClearTask(OK, 0), true);
});

test('shouldClearTask clears on ERR_INVALID_TARGET', () => {
    assert.strictEqual(shouldClearTask(ERR_INVALID_TARGET, 0), true);
});

test('shouldClearTask clears on ERR_NOT_FOUND', () => {
    assert.strictEqual(shouldClearTask(ERR_NOT_FOUND, 0), true);
});

test('shouldClearTask clears on ERR_INVALID_ARGS', () => {
    assert.strictEqual(shouldClearTask(ERR_INVALID_ARGS, 0), true);
});

test('shouldClearTask clears on ERR_NO_BODYPART', () => {
    assert.strictEqual(shouldClearTask(ERR_NO_BODYPART, 0), true);
});

test('shouldClearTask clears on ERR_RCL_NOT_ENOUGH', () => {
    assert.strictEqual(shouldClearTask(ERR_RCL_NOT_ENOUGH, 0), true);
});

// ---- Transient codes — should NOT clear at age=0 (4) ----

test('shouldClearTask does NOT clear ERR_NOT_IN_RANGE at age 0 (transient, retry)', () => {
    assert.strictEqual(shouldClearTask(ERR_NOT_IN_RANGE, 0), false);
});

test('shouldClearTask does NOT clear ERR_BUSY at age 0 (transient, retry)', () => {
    assert.strictEqual(shouldClearTask(ERR_BUSY, 0), false);
});

test('shouldClearTask does NOT clear ERR_TIRED at age 0 (transient, retry)', () => {
    assert.strictEqual(shouldClearTask(ERR_TIRED, 0), false);
});

test('shouldClearTask does NOT clear ERR_FULL at age 0 (transient, retry)', () => {
    assert.strictEqual(shouldClearTask(ERR_FULL, 0), false);
});

// ---- Timeout safety net (3) — uses an unclassified error code (e.g. ERR_NOT_ENOUGH_RESOURCES) ----

test('shouldClearTask does NOT clear an unclassified error at age 0 (fresh task)', () => {
    // ERR_NOT_ENOUGH_RESOURCES is NOT in PERMANENT_CLEAR_CODES — only timeout
    // (or its own future reclassification) should ever clear it.
    assert.strictEqual(shouldClearTask(ERR_NOT_ENOUGH_RESOURCES, 0), false);
});

test('shouldClearTask does NOT clear an unclassified error at the boundary (age = TASK_TIMEOUT)', () => {
    // Boundary is strict: the implementation uses `age > TASK_TIMEOUT`, not `>=`.
    assert.strictEqual(shouldClearTask(ERR_NOT_ENOUGH_RESOURCES, TASK_TIMEOUT), false);
});

test('shouldClearTask clears an unclassified error one tick past the boundary (age = TASK_TIMEOUT + 1)', () => {
    assert.strictEqual(shouldClearTask(ERR_NOT_ENOUGH_RESOURCES, TASK_TIMEOUT + 1), true);
});

// ---- TASK_TIMEOUT constant (1) ----

test('TASK_TIMEOUT equals 50 (configured safety-net window)', () => {
    assert.strictEqual(TASK_TIMEOUT, 50);
});
