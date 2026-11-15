import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMIT, KEY, emptyState, totals, reduce, validateState, readState, saveState, toCSV } from '../public/core.mjs';
const arrival = (id, cup = true) => ({ type: 'arrive', id: `id-${id}`, cup, at: '2026-11-11T11:00:00.000Z' });

test('150 cups are a hard limit, while arrivals without cups can continue', () => {
  let state = emptyState();
  for (let i = 0; i < LIMIT; i++) state = reduce(state, arrival(i));
  assert.deepEqual(totals(state), { arrived: 150, cups: 150, remaining: 0 });
  assert.throws(() => reduce(state, arrival('151')), /All 150 cups/);
  state = reduce(state, arrival('walkin', false));
  assert.deepEqual(totals(state), { arrived: 151, cups: 150, remaining: 0 });
});
test('undo returns exactly the cup associated with the latest arrival', () => {
  let state = reduce(emptyState(), arrival(1));
  state = reduce(state, arrival(2, false));
  assert.throws(() => reduce(state, { type: 'undo', id: 'id-1' }), /latest check-in changed/);
  state = reduce(state, { type: 'undo', id: 'id-2' });
  assert.equal(totals(state).cups, 1);
  state = reduce(state, { type: 'undo', id: 'id-1' });
  assert.deepEqual(totals(state), { arrived: 0, cups: 0, remaining: 150 });
});
test('duplicate operations do not add a second arrival', () => {
  const state = reduce(emptyState(), arrival('same'));
  assert.throws(() => reduce(state, arrival('same')), /already saved/);
  assert.equal(state.entries.length, 1);
});
test('bad backups, duplicate IDs, wrong types and impossible cup totals are rejected', () => {
  for (const value of [null, {}, { ...emptyState(), version: 2 }, { ...emptyState(), revision: -1 }, { ...emptyState(), entries: [{ id: 'x', at: 'bad date', cup: true }] }, { ...emptyState(), entries: [{ id: 'x', at: '2026-11-11', cup: 'true' }] }]) {
    assert.throws(() => validateState(value));
  }
  const duplicate = reduce(emptyState(), arrival(1));
  duplicate.entries.push(duplicate.entries[0]);
  assert.throws(() => validateState(duplicate), /duplicates/);
  const over = emptyState();
  over.entries = Array.from({ length: 151 }, (_, i) => ({ id: `x${i}`, cup: true, at: '2026-11-11' }));
  assert.throws(() => validateState(over), /150-cup limit/);
});
test('JSON backup round-trips exact totals and safe CSV records', () => {
  const state = reduce(reduce(emptyState(), arrival(1)), arrival(2, false));
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
  const csv = toCSV(state);
  assert.equal(csv.split('\r\n').length, 3);
  assert.match(csv, /1,2026-11-11T11:00:00.000Z,yes,id-1/);
  assert.match(csv, /2,2026-11-11T11:00:00.000Z,no,id-2/);
});
test('unavailable storage fails; damaged saved data is never silently reset', () => {
  assert.deepEqual(readState({ getItem: () => null }), emptyState());
  assert.throws(() => readState({ getItem: () => '{broken' }));
  assert.throws(() => saveState({ setItem: () => { throw new Error('disk full'); } }, emptyState()), /disk full/);
  assert.throws(() => saveState({ setItem: () => {}, getItem: () => null }, emptyState()), /could not save/);
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const state = reduce(emptyState(), arrival(1));
  saveState(storage, state);
  assert.deepEqual(readState(storage), state);
  assert.ok(memory.has(KEY));
});
