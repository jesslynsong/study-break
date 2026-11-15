import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { addInterest, applyOrganiserAction, publicSummary, organiserSummary, EventError } from './event-model.mjs';
import { loadEvent, updateEvent } from './event-store.mjs';

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, max-age=0', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers });
function authorised(request, secret) {
  const expected = typeof secret === 'string' && secret.length >= 24
    ? createHash('sha256').update(secret).digest()
    : secret && typeof secret.sha256 === 'string' && /^[a-f0-9]{64}$/.test(secret.sha256)
      ? Buffer.from(secret.sha256, 'hex') : null;
  if (!expected) throw new EventError('Organiser access is not configured yet. Ask the site owner to finish publishing setup.', 503);
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  return timingSafeEqual(createHash('sha256').update(header.slice(7)).digest(), expected);
}
async function bodyOf(request) {
  const text = await request.text();
  if (text.length > 4000000) throw new EventError('This request is too large.', 413);
  try {
    return request.headers.get('Content-Type')?.includes('application/x-www-form-urlencoded')
      ? Object.fromEntries(new URLSearchParams(text)) : JSON.parse(text);
  } catch { throw new EventError('The request could not be read.'); }
}
function csvCell(value) {
  let text = String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function createHandler({ getStore, getSecret, clock = () => new Date().toISOString() }) {
  return async request => {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/.netlify\/functions\/event/, '/api');
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin && request.method !== 'GET') throw new EventError('Use the form on the event website.', 403);
      if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
      const store = getStore();
      if (path === '/api/status' && request.method === 'GET') {
        return json(publicSummary(await loadEvent(store), clock()));
      }
      if (path === '/api/interest' && request.method === 'POST') {
        const input = await bodyOf(request);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new EventError('Please use the event interest form.');
        // The native HTML fallback also works without JavaScript generating a reference.
        if (!input.id && request.headers.get('Content-Type')?.includes('application/x-www-form-urlencoded')) input.id = randomUUID();
        const state = await updateEvent(store, before => addInterest(before, input, clock()));
        const saved = state.interests.find(item => item.id === input.id);
        if (!request.headers.get('Accept')?.includes('application/json')) {
          return new Response(null, { status: 303, headers: { Location: '/thanks.html', 'Cache-Control': 'no-store' } });
        }
        return json({ saved: true, id: saved.id });
      }
      if (!path.startsWith('/api/admin')) return json({ error: 'Not found.' }, 404);
      if (!authorised(request, getSecret())) return json({ error: 'That organiser code is not correct.' }, 401);
      if (path === '/api/admin' && request.method === 'GET') {
        return json(organiserSummary(await loadEvent(store), clock()));
      }
      if (path === '/api/admin' && request.method === 'POST') {
        const input = await bodyOf(request);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new EventError('Invalid organiser action.');
        const state = await updateEvent(store, before => applyOrganiserAction(before, input, clock()));
        return json({ ...organiserSummary(state, clock()), confirmedOperation: input.operationId });
      }
      if (path === '/api/admin/export' && request.method === 'GET') {
        const state = await loadEvent(store);
        return new Response(JSON.stringify(state, null, 2), { headers: { ...headers, 'Content-Disposition': 'attachment; filename="study-break-backup.json"' } });
      }
      if (path === '/api/admin/interests.csv' && request.method === 'GET') {
        const state = await loadEvent(store);
        const csv = '\uFEFFname,submitted_at_utc,reference\r\n' + state.interests.map(item => [item.name, item.at, item.id].map(csvCell).join(',')).join('\r\n');
        return new Response(csv, { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="study-break-interest.csv"' } });
      }
      return json({ error: 'Not found.' }, 404);
    } catch (error) {
      const status = error instanceof EventError ? error.status : 503;
      return json({ error: error instanceof EventError ? error.message : 'The shared counter is unavailable. No action has been confirmed. Please try again when connected.' }, status);
    }
  };
}
