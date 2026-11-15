import { freshEvent, validateEvent, EventError } from './event-model.mjs';
export const EVENT_KEY = 'study-break-night';

export async function loadEvent(store) {
  const entry = await store.getWithMetadata(EVENT_KEY, { type: 'json', consistency: 'strong' });
  return entry ? validateEvent(entry.data) : freshEvent();
}

// Every mutation is compared with the version read. Conflicts reload and re-check
// the 150-cup rule, so simultaneous phones cannot both claim the final cup.
export async function updateEvent(store, transform) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const entry = await store.getWithMetadata(EVENT_KEY, { type: 'json', consistency: 'strong' });
    const before = entry ? validateEvent(entry.data) : freshEvent();
    const after = transform(before);
    if (after === before) return before;
    validateEvent(after);
    const { modified } = await store.setJSON(EVENT_KEY, after, entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
    if (modified) return after;
    await new Promise(resolve => setTimeout(resolve, Math.min(25 * (attempt + 1), 180)));
  }
  throw new EventError('Another check-in is updating the counter. Nothing was confirmed; tap Retry to check this same action again.', 409);
}
