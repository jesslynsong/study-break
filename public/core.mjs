export const LIMIT = 150;
export const KEY = 'study-break-night:live:v1';
export const LOCK = 'study-break-night:writer:v1';

export function emptyState() {
  return { version: 1, event: 'Study Break Night', entries: [], revision: 0 };
}

export function validateState(value) {
  if (!value || value.version !== 1 || typeof value.event !== 'string' || !value.event.trim() ||
      value.event.length > 100 || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !Array.isArray(value.entries) || value.entries.length > 20000) throw new Error('This is not a valid event backup. Nothing was changed.');
  const ids = new Set();
  for (const entry of value.entries) {
    if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(entry.id) || ids.has(entry.id) ||
        typeof entry.cup !== 'boolean' || typeof entry.at !== 'string' || !Number.isFinite(Date.parse(entry.at))) {
      throw new Error('The event records are invalid or contain duplicates. Nothing was changed.');
    }
    ids.add(entry.id);
  }
  if (totals(value).cups > LIMIT) throw new Error('This backup exceeds the 150-cup limit. Nothing was changed.');
  // Return only known fields. Never accept executable markup or arbitrary backup properties.
  return { version: 1, event: value.event.trim(), revision: value.revision,
    entries: value.entries.map(({ id, cup, at }) => ({ id, cup, at })) };
}

export function totals(state) {
  const cups = state.entries.reduce((count, entry) => count + Number(entry.cup), 0);
  return { arrived: state.entries.length, cups, remaining: LIMIT - cups };
}

export function reduce(state, action) {
  const next = validateState(state);
  if (action.type === 'arrive') {
    if (next.entries.length >= 20000) throw new Error('Record limit reached. Export a backup before continuing.');
    if (action.cup && totals(next).remaining === 0) throw new Error('All 150 cups are claimed. You can still check in without a cup.');
    if (next.entries.some(entry => entry.id === action.id)) throw new Error('This check-in was already saved.');
    next.entries.push({ id: action.id, at: action.at, cup: action.cup });
  } else if (action.type === 'undo') {
    const latest = next.entries.at(-1);
    if (!latest || latest.id !== action.id) throw new Error('The latest check-in changed. Review the counter and try again.');
    next.entries.pop();
  } else {
    throw new Error('Unknown counter action.');
  }
  next.revision += 1;
  return validateState(next);
}

export function readState(storage) {
  const raw = storage.getItem(KEY);
  return raw === null ? emptyState() : validateState(JSON.parse(raw));
}

export function saveState(storage, state) {
  const clean = validateState(state);
  const raw = JSON.stringify(clean);
  storage.setItem(KEY, raw);
  if (storage.getItem(KEY) !== raw) throw new Error('The phone could not save this change. Do not hand out a cup yet.');
  return clean;
}

export function toCSV(state) {
  // No personal details are collected. Event names are excluded to avoid spreadsheet formulas.
  return '\uFEFFsequence,checked_in_at_utc,cup_issued,record_id\r\n' +
    state.entries.map((entry, index) => `${index + 1},${new Date(entry.at).toISOString()},${entry.cup ? 'yes' : 'no'},${entry.id}`).join('\r\n');
}
