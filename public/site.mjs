import './dashboard.mjs';
import { requestJSON } from './api.mjs';
const $ = id => document.getElementById(id);
function route() {
  const door = location.hash === '#door';
  document.body.dataset.page = door ? 'door' : 'home';
  $('home').hidden = door; $('door').hidden = !door;
  document.title = door ? 'Organiser desk · Study Break' : 'Study Break · A little pause before finals';
  window.dispatchEvent(new CustomEvent('dashboard-visibility', { detail: door }));
}
window.addEventListener('hashchange', route);
fetch('./event.json', { cache: 'no-cache' }).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(config => {
  for (const [key, id] of Object.entries({ dateLabel: 'event-date', timeLabel: 'event-time', venueLabel: 'event-venue', audienceLabel: 'event-audience' })) {
    if (typeof config[key] === 'string' && config[key].length < 250) $(id).textContent = config[key];
  }
}).catch(() => {});
let checking = false;
async function updateTeaBanner() {
  if (checking || document.hidden) return;
  checking = true; $('tea-refresh').disabled = true;
  try {
    const data = await requestJSON('/api/status');
    if (!['before', 'open', 'closed'].includes(data.phase) || !Number.isInteger(data.remaining) || data.remaining < 0 || data.remaining > 150) throw new Error();
    const state = data.phase === 'closed' ? 'closed' : data.phase === 'before' ? 'before' : data.remaining === 0 ? 'sold-out' : 'available';
    $('tea-banner').className = `tea-banner ${state}`;
    $('tea-title').textContent = ({ closed: 'That’s a wrap · check-in has closed', before: 'Bubble tea counter opens at the event', 'sold-out': 'Bubble tea is sold out · you can still hang out', available: `Bubble tea available · ${data.remaining} cups left` })[state];
    const checked = new Date(data.checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    $('tea-detail').textContent = state === 'available' || state === 'sold-out' ? `Last checked ${checked}. Stock can change. Interest never reserves a cup.` : 'Check the confirmed event details before travelling. Interest never reserves a cup.';
  } catch {
    $('tea-banner').className = 'tea-banner unknown';
    $('tea-title').textContent = 'We can’t confirm bubble tea stock right now';
    $('tea-detail').textContent = 'Ask a volunteer at the foyer. The last known count may have changed.';
  } finally { checking = false; $('tea-refresh').disabled = false; }
}
$('tea-refresh').addEventListener('click', updateTeaBanner);
window.addEventListener('event-updated', updateTeaBanner);
window.addEventListener('online', updateTeaBanner);
window.addEventListener('offline', updateTeaBanner);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateTeaBanner(); });
setInterval(() => { if (navigator.onLine) updateTeaBanner(); }, 15000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
route(); updateTeaBanner();
