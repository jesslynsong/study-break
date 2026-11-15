import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createHandler } from '../server/handler.mjs';
import { freshEvent, applyOrganiserAction, addInterest, organiserSummary } from '../server/event-model.mjs';
import { EVENT_KEY, updateEvent } from '../server/event-store.mjs';
const NOW = '2026-11-13T11:00:00.000Z';
const SECRET = 'test-only-organiser-key-32-characters';
function memoryStore(initial = null) {
  let value = initial && structuredClone(initial);
  let revision = initial ? 1 : 0;
  return {
    async getWithMetadata() { return value ? { data: structuredClone(value), etag: `"${revision}"` } : null; },
    async setJSON(key, next, options) {
      assert.equal(key, EVENT_KEY);
      if ((options.onlyIfNew && value) || (options.onlyIfMatch && options.onlyIfMatch !== `"${revision}"`)) return { modified: false };
      value = structuredClone(next); revision++; return { modified: true, etag: `"${revision}"` };
    }
  };
}
function setup(initial = null) {
  const store = memoryStore(initial);
  return createHandler({ getStore: () => store, getSecret: () => SECRET, clock: () => NOW });
}
function req(path, body, auth = false) {
  return new Request(`https://event.example/api/${path}`, { method: body ? 'POST' : 'GET', headers: {
    Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json', Origin: 'https://event.example' } : {}),
    ...(auth ? { Authorization: `Bearer ${SECRET}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const action = (type, id, rest = {}) => ({ type, operationId: `operation-${id}`, ...rest });

test('organiser totals and nicknames are protected; public status exposes stock only', async () => {
  const handle = setup();
  assert.equal((await handle(req('admin'))).status, 401);
  assert.equal((await handle(req('admin/export'))).status, 401);
  assert.equal((await handle(req('admin/interests.csv'))).status, 401);
  const publicData = await (await handle(req('status'))).json();
  assert.equal(publicData.remaining, 150);
  assert.equal(publicData.phase, 'before');
  assert.equal('arrived' in publicData, false);
  assert.equal('interestNames' in publicData, false);
});
test('shared interest is idempotent and affects neither arrivals nor cups', async () => {
  const handle = setup();
  const input = { id: 'interest-person-1', name: 'A friend', 'bot-field': '' };
  assert.equal((await handle(req('interest', input))).status, 200);
  assert.equal((await handle(req('interest', input))).status, 200);
  assert.equal((await handle(req('interest', { ...input, name: 'Someone else' }))).status, 409);
  const count = await (await handle(req('admin', undefined, true))).json();
  assert.equal(count.interested, 1); assert.equal(count.arrived, 0); assert.equal(count.remaining, 150);
});
test('check-in opens explicitly and repeated network retries do not issue another cup', async () => {
  const handle = setup();
  const arrival = action('arrive', 'one', { cup: true });
  assert.equal((await handle(req('admin', arrival, true))).status, 409);
  await handle(req('admin', action('phase', 'open', { value: 'open' }), true));
  const saved = await (await handle(req('admin', arrival, true))).json();
  const retry = await (await handle(req('admin', arrival, true))).json();
  assert.equal(saved.arrived, 1); assert.equal(retry.arrived, 1); assert.equal(retry.cups, 1);
  assert.equal(saved.confirmedOperation, arrival.operationId);
});
test('simultaneous phones cannot both claim cup 150', async () => {
  let state = freshEvent();
  state = applyOrganiserAction(state, action('phase', 'open', { value: 'open' }), NOW);
  for (let i = 0; i < 149; i++) state = applyOrganiserAction(state, action('arrive', i, { cup: true }), NOW);
  const store = memoryStore(state);
  const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => updateEvent(store, before => applyOrganiserAction(before, action('arrive', `last-${i}`, { cup: true }), NOW))));
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(results.filter(item => item.status === 'rejected').length, 5);
  const final = (await store.getWithMetadata()).data;
  assert.equal(organiserSummary(final).cups, 150);
  const next = await updateEvent(store, before => applyOrganiserAction(before, action('arrive', 'no-cup', { cup: false }), NOW));
  assert.equal(organiserSummary(next).arrived, 151);
  assert.equal(organiserSummary(next).cups, 150);
});
test('undo is safe to retry, and a stale undo cannot remove someone else', async () => {
  let state = freshEvent();
  state = applyOrganiserAction(state, action('phase', 'open', { value: 'open' }), NOW);
  state = applyOrganiserAction(state, action('arrive', 'one', { cup: true }), NOW);
  state = applyOrganiserAction(state, action('arrive', 'two', { cup: false }), NOW);
  assert.throws(() => applyOrganiserAction(state, action('undo', 'bad', { targetId: 'operation-one' }), NOW), /latest check-in changed/);
  const undo = action('undo', 'undo-two', { targetId: 'operation-two' });
  state = applyOrganiserAction(state, undo, NOW);
  state = applyOrganiserAction(state, undo, NOW);
  assert.equal(organiserSummary(state).arrived, 1);
  assert.equal(organiserSummary(state).cups, 1);
});
test('earlier interest baseline stays distinct from new responses', () => {
  let state = addInterest(freshEvent(), { id: 'interest-new-person', name: 'A friend' }, NOW);
  state = applyOrganiserAction(state, action('baseline', 'earlier', { value: 20 }), NOW);
  assert.equal(organiserSummary(state).interested, 21);
  assert.equal(organiserSummary(state).earlierInterest, 20);
  assert.equal(organiserSummary(state).newInterest, 1);
  assert.equal(organiserSummary(state).earlierInterestConfirmed, true);
});
test('importing an older door backup cannot overwrite existing shared arrivals', () => {
  let state = freshEvent();
  const backup = { version: 1, event: 'Study Break Night', revision: 1, entries: [{ id: 'legacy-person', cup: true, at: NOW }] };
  state = applyOrganiserAction(state, action('import-arrivals', 'import', { backup }), NOW);
  assert.equal(organiserSummary(state).cups, 1);
  assert.throws(() => applyOrganiserAction(state, action('import-arrivals', 'import-again', { backup }), NOW), /already has arrivals/);
});
test('unavailable storage, missing access setup and foreign-origin writes fail honestly', async () => {
  const unavailable = createHandler({ getStore: () => { throw new Error('storage down'); }, getSecret: () => SECRET });
  assert.equal((await unavailable(req('status'))).status, 503);
  const noSecret = createHandler({ getStore: () => memoryStore(), getSecret: () => '' });
  assert.equal((await noSecret(req('admin'))).status, 503);
  const crossOrigin = new Request('https://event.example/api/interest', { method: 'POST', headers: { Origin: 'https://elsewhere.example' }, body: '{}' });
  assert.equal((await setup()(crossOrigin)).status, 403);
});
test('private CSV export escapes spreadsheet formulas', async () => {
  const state = addInterest(freshEvent(), { id: 'interest-formula', name: '=SUM(A1)' }, NOW);
  const response = await setup(state)(req('admin/interests.csv', undefined, true));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /'=SUM\(A1\)/);
});
test('native interest form works without JavaScript and redirects only after saving', async () => {
  const handle = setup();
  const response = await handle(new Request('https://event.example/api/interest', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html' }, body: 'name=Native+guest&bot-field=&id='
  }));
  assert.equal(response.status, 303); assert.equal(response.headers.get('Location'), '/thanks.html');
  assert.equal((await (await handle(req('admin', undefined, true))).json()).interested, 1);
});
test('server-only code verifier accepts the owner code and rejects other codes', async () => {
  const handle = createHandler({ getStore: () => memoryStore(), getSecret: () => ({ sha256: createHash('sha256').update(SECRET).digest('hex') }) });
  assert.equal((await handle(req('admin'))).status, 401);
  assert.equal((await handle(req('admin', undefined, true))).status, 200);
  const wrong = new Request('https://event.example/api/admin', { headers: { Authorization: 'Bearer definitely-the-wrong-code' } });
  assert.equal((await handle(wrong)).status, 401);
});
