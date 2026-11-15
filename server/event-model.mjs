import { emptyState, validateState, totals, reduce } from '../public/core.mjs';
import { createHash } from 'node:crypto';

export class EventError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{7,79}$/;
export function checkId(id) {
  if (typeof id !== 'string' || !idPattern.test(id)) throw new EventError('Invalid request reference. Refresh the page and try again.');
  return id;
}
export function freshEvent() {
  return { version: 2, arrivals: emptyState(), interests: [], earlierInterest: 0, earlierInterestConfirmed: false, phase: 'before', updatedAt: null, operations: [] };
}
export function validateEvent(raw) {
  if (!raw || raw.version !== 2 || !['before', 'open', 'closed'].includes(raw.phase) ||
      !Array.isArray(raw.interests) || raw.interests.length > 5000 ||
      !Number.isSafeInteger(raw.earlierInterest) || raw.earlierInterest < 0 || raw.earlierInterest > 5000 || typeof raw.earlierInterestConfirmed !== 'boolean' ||
      !Array.isArray(raw.operations) || raw.operations.length > 30000 ||
      (raw.updatedAt !== null && !Number.isFinite(Date.parse(raw.updatedAt)))) throw new EventError('Shared event data needs organiser attention. Counting has been paused.', 503);
  validateState(raw.arrivals);
  const ids = new Set();
  for (const item of raw.interests) {
    checkId(item.id);
    if (ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 60 || !Number.isFinite(Date.parse(item.at))) throw new EventError('Shared interest data could not be read safely.', 503);
    ids.add(item.id);
  }
  for (const item of raw.operations) {
    checkId(item.id);
    if (typeof item.signature !== 'string') throw new EventError('Shared request history could not be read safely.', 503);
  }
  return raw;
}
export function publicSummary(state, now = new Date().toISOString()) {
  const count = totals(state.arrivals);
  return { phase: state.phase, remaining: count.remaining, limit: 150, updatedAt: state.updatedAt, checkedAt: now };
}
export function organiserSummary(state, now = new Date().toISOString()) {
  return { ...publicSummary(state, now), ...totals(state.arrivals), interested: state.earlierInterest + state.interests.length,
    earlierInterest: state.earlierInterest, earlierInterestConfirmed: state.earlierInterestConfirmed, newInterest: state.interests.length, recent: state.arrivals.entries.slice(-10).reverse(),
    interestNames: state.interests.slice(-20).reverse() };
}
export function addInterest(before, input, now) {
  const id = checkId(input.id);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 60 || /[\u0000-\u001f]/.test(name)) throw new EventError('Please enter a name or nickname, up to 60 characters.');
  if (input['bot-field']) throw new EventError('Your response was not accepted. Please contact an organiser.');
  const existing = before.interests.find(item => item.id === id);
  if (existing) {
    if (existing.name !== name) throw new EventError('This reference has already been used. Refresh before submitting a different response.', 409);
    return before; // Safe retry after a lost acknowledgement.
  }
  if (before.phase === 'closed') throw new EventError('Interest collection has closed. Check the event page for updates.', 409);
  if (before.interests.length >= 5000) throw new EventError('Online interest collection is full. You can still ask an organiser about walking in.', 409);
  const state = structuredClone(before);
  state.interests.push({ id, name, at: now });
  state.updatedAt = now;
  return validateEvent(state);
}
export function applyOrganiserAction(before, input, now) {
  const operationId = checkId(input.operationId);
  if (!['arrive', 'undo', 'phase', 'baseline', 'import-arrivals'].includes(input.type)) throw new EventError('Unknown organiser action.');
  const signature = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const previous = before.operations.find(item => item.id === operationId);
  if (previous) {
    if (previous.signature !== signature) throw new EventError('This operation reference was already used for a different action.', 409);
    return before;
  }
  if (before.operations.length >= 30000) throw new EventError('Event action history is full. Contact the organiser before continuing.', 409);
  const state = structuredClone(before);
  if (input.type === 'arrive') {
    if (state.phase !== 'open') throw new EventError('Check-in is paused. Open check-in in event controls before counting arrivals.', 409);
    if (typeof input.cup !== 'boolean') throw new EventError('Choose a check-in with or without a cup.');
    try { state.arrivals = reduce(state.arrivals, { type: 'arrive', id: operationId, cup: input.cup, at: now }); }
    catch (error) { throw new EventError(error.message, 409); }
  } else if (input.type === 'undo') {
    try { state.arrivals = reduce(state.arrivals, { type: 'undo', id: input.targetId }); }
    catch (error) { throw new EventError(error.message, 409); }
  } else if (input.type === 'phase') {
    if (!['before', 'open', 'closed'].includes(input.value)) throw new EventError('Choose a valid event state.');
    state.phase = input.value;
  } else if (input.type === 'baseline') {
    if (!Number.isSafeInteger(input.value) || input.value < 0 || input.value > 5000) throw new EventError('Enter an earlier interest count between 0 and 5000.');
    state.earlierInterest = input.value;
    state.earlierInterestConfirmed = true;
  } else if (input.type === 'import-arrivals') {
    if (state.arrivals.entries.length) throw new EventError('The shared counter already has arrivals. Import was cancelled to prevent double-counting.', 409);
    try { state.arrivals = validateState(input.backup); }
    catch (error) { throw new EventError(error.message); }
  }
  // Store the digest of large imports, not a second copy of all private records.
  state.operations.push({ id: operationId, signature });
  state.updatedAt = now;
  return validateEvent(state);
}
