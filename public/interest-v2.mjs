import { requestJSON } from './api.mjs';
const form = document.getElementById('interest-form');
const button = document.getElementById('interest-submit');
const notice = document.getElementById('interest-status');
const input = document.getElementById('interest-name');
const idField = document.getElementById('interest-id');
const receiptKey = 'study-break-night:interest-sent:v1';
const draftKey = 'study-break-night:interest-draft:v2';
let sending = false;
let sent = false;
function message(text, kind = '') { notice.textContent = text; notice.className = `interest-status ${kind}`; }
function finish(already = false) {
  sent = true; input.disabled = true; button.disabled = true;
  button.textContent = already ? 'Interest already submitted ✓' : 'Interest submitted ✓';
  message(already ? 'This browser already sent an interest response. Please submit once per person; your cup is not reserved.' : 'Thanks! Your interest is saved with the organisers. Your cup is not reserved. Check this page for the confirmed date.', 'success');
}
let draft;
try {
  if (localStorage.getItem(receiptKey)) finish(true);
  draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
} catch { /* Blocked storage does not prevent a server submission. */ }
idField.value = draft?.id || crypto.randomUUID();
if (!sent && draft?.name) { input.value = draft.name; message('An earlier response was not confirmed. Retry here to safely check the same response.'); }
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || sent || !form.reportValidity()) return;
  const name = input.value.trim();
  if (!name) { input.setCustomValidity('Please enter a name or nickname.'); input.reportValidity(); return; }
  if (!navigator.onLine) { message('You’re offline. Connect to send your interest. No response has been queued.', 'error'); return; }
  if (draft && draft.name !== name) { message('Please retry your earlier name first so we can confirm it without creating a duplicate.', 'error'); return; }
  draft = { id: idField.value, name, 'bot-field': new FormData(form).get('bot-field') || '' };
  try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch {}
  sending = true; button.disabled = true; button.textContent = 'Sending your interest…'; message('Sending to the organisers…');
  try {
    const result = await requestJSON('/api/interest', { method: 'POST', body: draft });
    if (result.saved !== true || result.id !== draft.id) throw new Error('Your response was not confirmed. Please try again.');
    try { localStorage.setItem(receiptKey, draft.id); sessionStorage.removeItem(draftKey); } catch {}
    finish();
  } catch (error) {
    message(error.status >= 400 && error.status < 500 ? error.message : 'We couldn’t confirm your response. It may have arrived. Retry with the same name to confirm it without adding a second response.', 'error');
    if (error.status >= 400 && error.status < 500 && error.status !== 409) { draft = null; try { sessionStorage.removeItem(draftKey); } catch {} }
    button.disabled = false; button.textContent = 'Retry my interest response';
  } finally { sending = false; }
});
input.addEventListener('input', () => input.setCustomValidity(''));
