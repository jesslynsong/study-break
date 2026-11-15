import { emptyState, totals, reduce, validateState, KEY } from './core.mjs';
import { requestJSON } from './api.mjs';
const $ = id => document.getElementById(id);
const codeKey = 'study-break-night:organiser-code:v2';
const pendingKey = 'study-break-night:pending-action:v2';
let mode = 'practice';
let practice = emptyState();
let live = null;
let code = '';
let busy = false;
let connected = false;
let lastRefresh = 0;
let refreshing = false;
let lastTap = -Infinity;
let pending = null;
let legacy = null;
try { code = sessionStorage.getItem(codeKey) || ''; pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null'); } catch {}
try { const raw = localStorage.getItem(KEY); if (raw) { const old = validateState(JSON.parse(raw)); if (old.entries.length) legacy = old; } } catch {}
const time = value => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
const active = () => mode === 'practice' ? { ...totals(practice), recent: practice.entries.slice(-10).reverse(), interested: null, phase: 'open' } : live;
function status(text, failed = false) { $('status').textContent = text; $('status').classList.toggle('failed', failed); }
function rememberPending() { try { if (pending) sessionStorage.setItem(pendingKey, JSON.stringify(pending)); else sessionStorage.removeItem(pendingKey); } catch {} }
function render() {
  const isLive = mode === 'live';
  const data = active();
  const show = !isLive || Boolean(code && live);
  const fresh = !isLive || (connected && navigator.onLine && Date.now() - lastRefresh < 35000);
  const writable = !busy && !pending && fresh && data?.phase === 'open';
  $('admin-login').hidden = !isLive || Boolean(code && live);
  $('counter').hidden = !show; $('records').hidden = !show;
  $('organiser-tools').hidden = !isLive || !show;
  $('practice-note').hidden = isLive;
  $('practice-tab').classList.toggle('active', !isLive); $('practice-tab').setAttribute('aria-pressed', String(!isLive));
  $('live-tab').classList.toggle('active', isLive); $('live-tab').setAttribute('aria-pressed', String(isLive));
  $('practice-tab').disabled = busy; $('live-tab').disabled = busy;
  $('mode-label').textContent = isLive ? 'Live dashboard · shared online' : 'Practice counter';
  $('connection').textContent = !isLive ? 'Practice · this page only' : fresh ? `Synced ${time(lastRefresh)}` : 'Connection needed · counting paused';
  $('interest-count').textContent = isLive && data && !data.earlierInterestConfirmed ? `${data.newInterest}+` : data?.interested ?? '—';
  $('arrived-count').textContent = data?.arrived ?? '—'; $('remaining-count').textContent = data?.remaining ?? '—'; $('issued-count').textContent = data?.cups ?? '—';
  $('cup-progress').value = data?.cups || 0; $('progress-text').textContent = `${data?.cups || 0} of 150 given`;
  $('interest-breakdown').hidden = !isLive || !data;
  $('interest-breakdown').textContent = data ? data.earlierInterestConfirmed ? `${data.earlierInterest} earlier responses + ${data.newInterest} new responses. This is an estimate, not confirmed attendance.` : `${data.newInterest || 0} new responses. The older Netlify form is not included yet. Enter its genuine count (or confirm 0) under Earlier interest responses.` : '';
  $('event-phase').hidden = !isLive;
  $('event-phase').textContent = ({ before: 'Check-in is paused. The public banner says the cup counter is not open.', open: 'Check-in is open. The public banner reflects the shared cup balance.', closed: 'Event closed. The public banner shows check-in has ended.' })[data?.phase] || '';
  $('add-cup').disabled = !writable || !data || data.remaining === 0;
  $('add-person').disabled = !writable || !data;
  $('undo').disabled = busy || Boolean(pending) || !fresh || !data?.recent?.length;
  $('sold-out').hidden = !data || data.remaining !== 0;
  $('clear-practice').hidden = isLive;
  $('sign-out').hidden = !isLive; $('sign-out').disabled = busy;
  $('refresh-dashboard').hidden = !isLive; $('refresh-dashboard').disabled = busy;
  $('retry-action').hidden = !isLive || !pending; $('retry-action').disabled = busy || !navigator.onLine;
  for (const id of ['phase-open', 'phase-before', 'phase-closed', 'save-baseline', 'export-backup', 'export-csv', 'restore-file', 'import-device']) $(id).disabled = busy || Boolean(pending) || !fresh;
  if (isLive && data && document.activeElement !== $('earlier-interest')) $('earlier-interest').value = data.earlierInterest;
  $('legacy-note').hidden = !legacy;
  $('import-device').hidden = !legacy;
  if (legacy) $('legacy-note').textContent = `Previous records found on this browser: ${legacy.entries.length} arrivals and ${totals(legacy).cups} cups. Import only if these were real event records. They have not been merged automatically.`;
  const records = data?.recent || [];
  $('empty-log').hidden = records.length > 0;
  $('arrival-log').replaceChildren(...records.map((entry, index) => {
    const li = document.createElement('li'); const detail = document.createElement('div'); const label = document.createElement('strong');
    label.textContent = `Person ${data.arrived - index}`; const when = document.createElement('time'); when.dateTime = entry.at; when.textContent = time(entry.at); detail.append(label, when);
    const badge = document.createElement('span'); badge.className = `cup-badge${entry.cup ? '' : ' no-cup'}`; badge.textContent = entry.cup ? '1 cup given' : 'No cup'; li.append(detail, badge); return li;
  }));
  $('interest-log').replaceChildren(...(live?.interestNames || []).map(item => { const li = document.createElement('li'); const name = document.createElement('strong'); name.textContent = item.name; const when = document.createElement('time'); when.textContent = time(item.at); li.append(name, when); return li; }));
}
async function refresh() {
  if (refreshing || busy || mode !== 'live' || !code || document.hidden) return;
  refreshing = true;
  try {
    const first = !live;
    live = await requestJSON('/api/admin', { code }); connected = true; lastRefresh = Date.now(); $('login-status').textContent = '';
    if (first) status('Live dashboard connected. Check the event state before welcoming arrivals.');
    if (pending) status('An earlier action has not been confirmed on this tab. Use the safe retry button before counting another person.', true);
  } catch (error) {
    connected = false;
    $('login-status').textContent = error.message;
    if (error.status === 401) { code = ''; live = null; try { sessionStorage.removeItem(codeKey); } catch {} }
    status(error.message, true);
  } finally { refreshing = false; render(); }
}
function confirmChange(title, message, label) {
  const dialog = $('confirm-dialog');
  if (dialog.open) return Promise.resolve(false);
  $('confirm-title').textContent = title; $('confirm-message').textContent = message; $('confirm-yes').textContent = label;
  dialog.returnValue = ''; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
async function sendPending() {
  if (!pending || busy || !code || mode !== 'live') return;
  busy = true; render();
  const action = pending;
  try {
    const result = await requestJSON('/api/admin', { method: 'POST', code, body: action });
    if (result.confirmedOperation !== action.operationId) throw new Error('The action was not confirmed. Retry the same action.');
    live = result; connected = true; lastRefresh = Date.now(); pending = null; rememberPending();
    status(action.type === 'arrive' ? `Saved online · 1 arrival${action.cup ? ' and 1 cup confirmed. You can hand over the cup.' : ' confirmed without a cup.'}` : 'Saved online · the shared event has been updated.');
    window.dispatchEvent(new Event('event-updated'));
  } catch (error) {
    connected = false;
    if (error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429) { pending = null; rememberPending(); }
    status(pending ? `${error.message} Do not hand out a cup until this action is confirmed. Use the safe retry button.` : error.message, true);
  } finally { busy = false; render(); if (!pending && !connected) refresh(); }
}
async function change(type, rest = {}) {
  if (busy || (mode === 'live' && pending)) return;
  if (mode === 'practice') {
    try {
      practice = reduce(practice, type === 'arrive' ? { type, id: crypto.randomUUID(), at: new Date().toISOString(), cup: rest.cup } : { type, id: rest.targetId });
      render(); status('Practice saved. The shared event and public banner have not changed.');
    } catch (error) { status(error.message, true); }
    return;
  }
  if (!code || !live || !connected || !navigator.onLine) { status('Reconnect and refresh before changing the live counter.', true); return; }
  pending = { type, operationId: crypto.randomUUID(), ...rest }; rememberPending(); await sendPending();
}
async function arrive(cup) { const now = performance.now(); if (now - lastTap < 750) return; lastTap = now; await change('arrive', { cup }); }
$('add-cup').addEventListener('click', () => arrive(true)); $('add-person').addEventListener('click', () => arrive(false));
$('retry-action').addEventListener('click', sendPending);
$('practice-tab').addEventListener('click', () => { mode = 'practice'; render(); status('Practice is separate from your live event.'); });
$('live-tab').addEventListener('click', () => { mode = 'live'; render(); refresh(); });
$('admin-login').addEventListener('submit', async event => {
  event.preventDefault(); code = $('admin-code').value.trim(); $('admin-code').value = ''; $('login-submit').disabled = true; $('login-status').textContent = 'Opening the live dashboard…';
  try { sessionStorage.setItem(codeKey, code); } catch {}
  await refresh(); $('login-submit').disabled = false;
});
$('sign-out').addEventListener('click', () => { code = ''; live = null; connected = false; try { sessionStorage.removeItem(codeKey); } catch {} render(); });
$('refresh-dashboard').addEventListener('click', refresh);
$('clear-practice').addEventListener('click', () => { practice = emptyState(); render(); status('Practice reset.'); });
$('undo').addEventListener('click', async () => {
  const entry = active()?.recent?.[0]; if (!entry) return;
  const selectedMode = mode;
  if (await confirmChange('Undo the latest check-in?', `This removes the latest arrival at ${time(entry.at)}.${entry.cup ? ' Only continue if that cup was not handed out or has been physically returned. One cup will return to the available stock.' : ' The cup balance will stay the same.'}`, 'Undo check-in')) {
    if (selectedMode === mode) await change('undo', { targetId: entry.id });
  }
});
for (const [id, value] of [['phase-open', 'open'], ['phase-before', 'before'], ['phase-closed', 'closed']]) $(id).addEventListener('click', async () => {
  if (await confirmChange('Update the event state?', ({ open: 'Open live check-in and show the current cup balance on the public event page?', before: 'Pause live check-in and show that the cup counter is not open on the public page?', closed: 'Close live check-in and interest collection, and show that the event has ended?' })[value], 'Update event')) await change('phase', { value });
});
$('save-baseline').addEventListener('click', async () => {
  if (!$('earlier-interest').reportValidity()) return;
  const value = Number($('earlier-interest').value);
  if (await confirmChange('Set earlier interest count?', `Use ${value} as the subtotal from the older Netlify form. This replaces the earlier subtotal; new dashboard responses are still added separately.`, 'Save subtotal')) await change('baseline', { value });
});
function download(content, filename, type) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
async function exportData(path, extension) {
  try {
    const response = await fetch(path, { cache: 'no-store', headers: { Authorization: `Bearer ${code}` } });
    if (!response.ok) throw new Error('The export could not be downloaded. Reconnect and try again.');
    const content = await response.text();
    download(content, `study-break-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`, extension === 'csv' ? 'text/csv;charset=utf-8' : 'application/json');
    status('Private download started. Check the file is saved before closing this tab.');
  } catch (error) { status(error.message, true); }
}
$('export-backup').addEventListener('click', () => exportData('/api/admin/export', 'json'));
$('export-csv').addEventListener('click', () => exportData('/api/admin/interests.csv', 'csv'));
async function importBackup(backup) {
  try {
    const clean = validateState(backup); const count = totals(clean);
    if (await confirmChange('Import older arrival records?', `Import ${count.arrived} arrivals and ${count.cups} cup claims into the shared event. Only continue if these are real event records. The shared counter must be empty. Stop using the old counter afterwards.`, 'Import arrivals')) await change('import-arrivals', { backup: clean });
  } catch (error) { status(error.message, true); }
}
$('import-device').addEventListener('click', () => legacy && importBackup(legacy));
$('restore-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  try { if (file.size > 3000000) throw new Error('This older backup is too large.'); await importBackup(JSON.parse(await file.text())); } catch (error) { status(error.message, true); }
});
window.addEventListener('dashboard-visibility', event => { if (event.detail) refresh(); });
window.addEventListener('online', refresh); window.addEventListener('offline', () => { connected = false; render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => { render(); if (location.hash === '#door') refresh(); }, 15000);
render();
