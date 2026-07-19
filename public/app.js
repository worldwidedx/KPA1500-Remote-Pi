'use strict';

let csrf = '';
let needsSetup = false;
const $ = id => document.getElementById(id);
const show = (id, visible) => $(id).hidden = !visible;
async function request(url, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) };
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2400); }
function value(id, text) { $(id).textContent = text ?? '—'; }
function render(s) {
  value('power', s.power); value('mode', s.mode); value('band', s.band ? `${s.band} m` : '—'); value('frequency', s.frequencyHz ? `${(s.frequencyHz / 1e6).toFixed(5)} MHz` : '—');
  $('operate-button').classList.toggle('active-oper', s.mode === 'OPER');
  $('standby-button').classList.toggle('active-standby', s.mode === 'STBY');
  value('antenna', s.antenna ? `ANT ${s.antenna}` : '—'); value('fault', !s.faultCode || s.faultCode === '000' ? 'NONE' : s.faultCode);
  value('watts', Math.round(s.forwardWatts || 0)); value('forward', `${s.forwardWatts || 0} W`); value('reflected', `${s.reflectedWatts || 0} W`); value('input', `${s.inputWatts || 0} W`); value('swr', Number(s.swr || 1).toFixed(2));
  value('temperature', `${s.temperatureC ?? '—'} °C`); value('fan', `${s.fanRpm ?? '—'} RPM`); value('voltage', `${s.voltageV ?? '—'} V`); value('current', `${s.currentA ?? '—'} A`); value('firmware', `Firmware ${s.firmware || '—'}`);
  $('power-bar').style.width = `${Math.min(100, (s.forwardWatts || 0) / 15)}%`;
  $('connection').textContent = s.connected ? `${s.connectionMode.toUpperCase()} ONLINE` : 'OFFLINE'; $('connection').classList.toggle('online', s.connected);
  value('updated', s.lastSeen ? `Updated ${new Date(s.lastSeen).toLocaleTimeString()}` : 'Waiting for telemetry');
  if (s.antenna) $('antenna-select').value = s.antenna;
}
async function refreshState() { try { render(await request('/api/state')); } catch (e) { if (/Authentication/.test(e.message)) location.reload(); } }
async function refreshEvents() {
  try { const rows = await request('/api/events'); $('events').replaceChildren(...rows.map(row => { const li = document.createElement('li'); const time = document.createElement('time'); time.textContent = new Date(row.at).toLocaleTimeString(); li.append(time, `[${row.kind}] ${row.message}`); return li; })); } catch {}
}
async function boot() {
  const state = await request('/api/session'); csrf = state.csrf || ''; needsSetup = state.needsSetup;
  if (!state.authenticated) { show('auth', true); show('app', false); $('auth-title').textContent = needsSetup ? 'Create administrator' : 'Remote sign in'; $('auth-copy').textContent = needsSetup ? 'Set the first account for this KPA1500 host.' : 'Control and monitor your amplifier securely.'; $('password').autocomplete = needsSetup ? 'new-password' : 'current-password'; return; }
  show('auth', false); show('app', true); await refreshState(); await refreshEvents(); setInterval(refreshState, 700); setInterval(refreshEvents, 5000);
}
$('auth-form').addEventListener('submit', async event => {
  event.preventDefault(); $('auth-error').textContent = '';
  try {
    const payload = JSON.stringify({ username: $('username').value, password: $('password').value });
    if (needsSetup) {
      try { await request('/api/setup', { method: 'POST', body: payload }); }
      catch (error) { if (!/already completed/i.test(error.message)) throw error; }
      needsSetup = false;
    }
    const login = await request('/api/login', { method: 'POST', body: payload });
    csrf = login.csrf; await boot();
  } catch (e) { $('auth-error').textContent = e.message; }
});
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => { try { await request('/api/control', { method: 'POST', body: JSON.stringify({ action: button.dataset.action }) }); toast(`${button.textContent} command sent`); } catch (e) { toast(e.message); } }));
for (let i = 1; i <= 32; i++) { const option = document.createElement('option'); option.value = i; option.textContent = `ANT ${i}`; $('antenna-select').append(option); }
$('antenna-select').addEventListener('change', async event => { try { await request('/api/control', { method: 'POST', body: JSON.stringify({ action: 'antenna', value: Number(event.target.value) }) }); } catch (e) { toast(e.message); } });
$('wake').addEventListener('click', async () => { try { await request('/api/wake', { method: 'POST' }); toast('Wake packet sent'); } catch (e) { toast(e.message); } });
$('logout').addEventListener('click', async () => { await request('/api/logout', { method: 'POST' }); location.reload(); });
$('compact').addEventListener('click', () => { $('app').classList.toggle('compact'); $('compact').textContent = $('app').classList.contains('compact') ? 'Full view' : 'Compact'; });
$('refresh-log').addEventListener('click', refreshEvents);
boot().catch(e => { $('auth-error').textContent = e.message; });
