'use strict';

let csrf = '';
let needsSetup = false;
let viewMode = 'operate';
const $ = id => document.getElementById(id);
const show = (id, visible) => $(id).hidden = !visible;
const bandLabels = { 0: '160 m', 1: '80 m', 2: '60 m', 3: '40 m', 4: '30 m', 5: '20 m', 6: '17 m', 7: '15 m', 8: '12 m', 9: '10 m', 10: '6 m' };
const bandButtons = ['07', '15', '23', '06', '14', '22', '05', '13', '21', '04', '12'];
const capacitorRelays = [
  { bit: '80', value: 1360, label: '1360 pF', relay: 'K16' },
  { bit: '40', value: 680, label: '680 pF', relay: 'K15' },
  { bit: '20', value: 330, label: '330 pF', relay: 'K14' },
  { bit: '10', value: 180, label: '180 pF', relay: 'K13' },
  { bit: '08', value: 82, label: '82 pF', relay: 'K12' },
  { bit: '04', value: 39, label: '39 pF', relay: 'K11' },
  { bit: '02', value: 22, label: '22 pF', relay: 'K10' },
  { bit: '01', value: 8.2, label: '8.2 pF', relay: 'K9' }
];
const inductorRelays = [
  { bit: '40', value: 4400, label: '4400 nH', relay: 'K7' },
  { bit: '20', value: 2100, label: '2100 nH', relay: 'K6' },
  { bit: '10', value: 1000, label: '1000 nH', relay: 'K5' },
  { bit: '08', value: 480, label: '480 nH', relay: 'K4' },
  { bit: '04', value: 230, label: '230 nH', relay: 'K3' },
  { bit: '02', value: 110, label: '110 nH', relay: 'K2' },
  { bit: '01', value: 50, label: '50 nH', relay: 'K1' }
];
const formatBand = value => Number.isFinite(Number(value)) ? (bandLabels[Number(value)] || `${value} m`) : '—';
const hexPad = value => String(value).toUpperCase().padStart(2, '0');
async function request(url, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) };
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2400); }
function value(id, text) { $(id).textContent = text ?? '—'; }
function populateBandSelect() {
  const select = $('band-select');
  if (select.options.length) return;
  for (let i = 0; i <= 10; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = bandLabels[i] || `${i} m`;
    select.append(option);
  }
}
function setFanSeverity(level) {
  const fan = $('fan');
  fan.classList.remove('fan-warn', 'fan-hot', 'fan-critical');
  if (level === 3) fan.classList.add('fan-warn');
  else if (level === 4) fan.classList.add('fan-hot');
  else if (level >= 5) fan.classList.add('fan-critical');
}
function formatLimit(value) {
  if (!value) return '—';
  if (typeof value === 'object') {
    const swr = Number.isFinite(value.swr) ? value.swr.toFixed(1) : '—';
    const watts = Number.isFinite(value.watts) ? `${value.watts} W` : '—';
    return `${swr}:1 / ${watts}`;
  }
  return String(value);
}
function currentRoutingBand(s) {
  return Number.isInteger(s.antennaEnableBand) ? s.antennaEnableBand : Number.isInteger(s.band) ? s.band : 5;
}
function maskValue(mask) {
  const raw = String(mask || '').trim().toUpperCase();
  return /^[0-9A-F]{1,2}$/.test(raw) ? raw : '00';
}
function maskHas(mask, bit) {
  return (parseInt(maskValue(mask), 16) & parseInt(bit, 16)) !== 0;
}
function relayTotal(mask, relays) {
  return relays.reduce((sum, relay) => sum + (maskHas(mask, relay.bit) ? relay.value : 0), 0);
}
function formatRelayTotal(total, units) {
  if (!Number.isFinite(total)) return `0 ${units}`;
  const text = Number.isInteger(total) ? String(total) : total.toFixed(1);
  return `${text} ${units}`;
}
function setRelayGrid(gridId, mask, relays, units, totalId) {
  const grid = $(gridId);
  const normalized = maskValue(mask);
  for (const item of grid.querySelectorAll('.relay-item')) {
    const bit = item.dataset.bit;
    const input = item.querySelector('input');
    if (document.activeElement === input) continue;
    input.checked = maskHas(normalized, bit);
  }
  value(totalId, formatRelayTotal(relayTotal(normalized, relays), units));
}
function setView(mode) {
  viewMode = mode;
  $('operate-view').hidden = mode !== 'operate';
  $('config-view').hidden = mode !== 'config';
  $('view-operate').classList.toggle('active', mode === 'operate');
  $('view-config').classList.toggle('active', mode === 'config');
}
function syncInput(id, value) {
  const el = $(id);
  if (!el || document.activeElement === el) return;
  if (el.type === 'checkbox') el.checked = !!value;
  else el.value = value ?? '';
}
function buildRoutingControls() {
  const select = $('cfg-antenna-preferred');
  if (!select.options.length) {
    const options = ['0 — Last used', ...Array.from({ length: 32 }, (_, index) => `${index + 1}`)];
    for (const [index, label] of options.entries()) {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = index === 0 ? label : `ANT ${index}`;
      select.append(option);
    }
  }
  const matrix = $('cfg-antenna-matrix');
  if (!matrix.children.length) {
    for (let antenna = 1; antenna <= 32; antenna++) {
      const row = document.createElement('div');
      row.className = 'routing-row';
      const label = document.createElement('div');
      label.className = 'routing-label';
      label.textContent = `ANT ${antenna}`;
      const cell = document.createElement('select');
      cell.dataset.antenna = antenna;
      for (const [value, text] of [['D', 'Disabled'], ['1', 'ANT 1'], ['2', 'ANT 2']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        cell.append(option);
      }
      cell.addEventListener('change', async event => {
        const band = currentRoutingBand(window.__kpaState || {});
        try {
          await updateConfig('antennaEnableCell', { band, antenna, connector: event.target.value }, `ANT ${antenna} routing updated`);
        } catch {}
      });
      row.append(label, cell);
      matrix.append(row);
    }
  }
  const overview = $('band-overview');
  if (!overview.children.length) {
    for (let band = 10; band >= 0; band--) {
      const row = document.createElement('div');
      row.className = 'overview-row';
      row.dataset.band = band;
      row.innerHTML = `<div class="overview-band">${bandLabels[band] || `${band} m`}</div><div class="overview-cell" data-role="preferred">—</div><div class="overview-cell" data-role="enable">—</div>`;
      overview.append(row);
    }
  }
  const buildRelayItems = (gridId, relays, units) => {
    const grid = $(gridId);
    if (grid.children.length) return;
    for (const relay of relays) {
      const item = document.createElement('div');
      item.className = 'relay-item';
      item.dataset.bit = relay.bit;
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.addEventListener('change', () => scheduleRelayWrite(gridId));
      const title = document.createElement('span');
      title.textContent = relay.label;
      label.append(checkbox, title);
      const sub = document.createElement('small');
      sub.textContent = relay.relay;
      item.append(label, sub);
      grid.append(item);
    }
    value(gridId === 'atu-capacitor-grid' ? 'atu-cap-total' : 'atu-ind-total', `0 ${units}`);
  };
  buildRelayItems('atu-capacitor-grid', capacitorRelays, 'pF');
  buildRelayItems('atu-inductor-grid', inductorRelays, 'nH');
}
function scheduleRelayWrite(gridId) {
  window.__relayTimers ||= {};
  clearTimeout(window.__relayTimers[gridId]);
  window.__relayTimers[gridId] = setTimeout(() => {
    const isCap = gridId === 'atu-capacitor-grid';
    const relays = isCap ? capacitorRelays : inductorRelays;
    const grid = $(gridId);
    const mask = relays.reduce((acc, relay) => acc | (grid.querySelector(`[data-bit="${relay.bit}"] input`).checked ? parseInt(relay.bit, 16) : 0), 0);
    const hex = hexPad(mask);
    updateConfig(isCap ? 'atuCapacitors' : 'atuInductors', hex, isCap ? 'Capacitor relays updated' : 'Inductor relays updated');
  }, 250);
}
function syncConfigControls(s) {
  value('config-band', `Current band ${formatBand(s.band)}`);
  syncInput('cfg-atu-retune', s.atuHiSwrRetune);
  syncInput('cfg-atu-bins', s.atuSettingsPerBin);
  syncInput('cfg-atu-retune-threshold', s.atuRetuneThreshold);
  syncInput('cfg-swr-bypass', s.swrBypassThreshold);
  syncInput('cfg-swr-stop', s.swrStopThreshold);
  syncInput('cfg-swr-nomatch', s.swrNoMatchThreshold);
  syncInput('cfg-alc', s.alcThreshold);
  syncInput('cfg-band-change', s.bandChangeStandby ? '1' : '0');
  syncInput('cfg-atten-release', s.attenuatorReleaseMs);
  syncInput('cfg-fan-dwell', s.fanDwellSeconds);
  value('config-band-routing', `Band ${formatBand(currentRoutingBand(s))}`);
  syncInput('cfg-antenna-preferred', Number.isFinite(s.antennaPreferred) ? String(s.antennaPreferred) : '');
  const table = Array.isArray(s.antennaEnableTable) ? s.antennaEnableTable : [];
  for (const input of $('cfg-antenna-matrix').querySelectorAll('select[data-antenna]')) {
    const antenna = Number(input.dataset.antenna);
    if (document.activeElement === input) continue;
    input.value = table[antenna - 1] || 'D';
  }
  const preferredAll = Array.isArray(s.antennaPreferredAllBands) ? s.antennaPreferredAllBands : [];
  const enableAll = Array.isArray(s.antennaEnableAllBands) ? s.antennaEnableAllBands : [];
  for (const row of $('band-overview').querySelectorAll('.overview-row')) {
    const band = Number(row.dataset.band);
    const preferred = preferredAll[band];
    const enable = enableAll[band];
    row.querySelector('[data-role="preferred"]').textContent = Number.isFinite(preferred) ? (preferred === 0 ? 'Last used' : `ANT ${preferred}`) : '—';
    row.querySelector('[data-role="enable"]').textContent = enable === '0' ? 'Both disabled' : enable === '1' ? 'ANT 1 enabled' : enable === '2' ? 'ANT 2 enabled' : '—';
  }
  setRelayGrid('atu-capacitor-grid', s.atuCapacitorsMask, capacitorRelays, 'pF', 'atu-cap-total');
  setRelayGrid('atu-inductor-grid', s.atuInductorsMask, inductorRelays, 'nH', 'atu-ind-total');
}
function render(s) {
  window.__kpaState = s;
  value('power', s.power); value('mode', s.mode); value('frequency', s.frequencyHz ? `${(s.frequencyHz / 1e6).toFixed(6)} MHz` : '—');
  value('banner', s.bannerText || '—');
  $('operate-button').classList.toggle('active-oper', s.mode === 'OPER');
  $('standby-button').classList.toggle('active-standby', s.mode === 'STBY');
  $('atu-inline-button').classList.toggle('active-oper', s.atuInline === true);
  $('atu-bypass-button').classList.toggle('active-standby', s.atuInline === false);
  value('antenna', s.antenna ? `ANT ${s.antenna}` : '—'); value('fault', !s.faultCode || s.faultCode === '000' ? 'NONE' : s.faultCode);
  value('fault-health', !s.faultCode || s.faultCode === '000' ? 'NONE' : s.faultCode); value('fault-details', s.faultDetails || '—');
  value('watts', Math.round(s.forwardWatts || 0)); value('forward', `${s.forwardWatts || 0} W`); value('reflected', `${s.reflectedWatts || 0} W`); value('input', `${s.inputWatts || 0} W`); value('swr', Number(s.swr || 1).toFixed(2));
  value('temperature', `${s.temperatureC ?? '—'} °C`); value('fan', `${s.fanSpeed ?? '—'} / 5`); setFanSeverity(Number(s.fanSpeed)); value('fan-minimum', `Minimum ${s.fanMinimum ?? '—'}`); value('voltage', `${s.voltageV ?? '—'} V`); value('current', `${s.currentA ?? '—'} A`); value('firmware', `Firmware ${s.firmware || '—'}`);
  value('current-atu', s.currentAtuSetting || '—'); value('stored-atu', s.storedAtuSettings || '—'); value('swr-bypass', Number.isFinite(s.swrBypass) ? `${Number(s.swrBypass).toFixed(1)}:1` : '—'); value('power-limit-bypass', formatLimit(s.powerLimitBypass)); value('overdrive-reason', s.overdriveReason || '—'); value('attenuator-reason', s.lastAttenuatorReason || '—');
  syncConfigControls(s);
  $('power-bar').style.width = `${Math.min(100, (s.forwardWatts || 0) / 15)}%`;
  $('connection').textContent = s.connected ? `${s.connectionMode.toUpperCase()} ONLINE` : 'OFFLINE'; $('connection').classList.toggle('online', s.connected);
  value('updated', s.lastSeen ? `Updated ${new Date(s.lastSeen).toLocaleTimeString()}` : 'Waiting for telemetry');
  if (s.antenna) $('antenna-select').value = s.antenna;
  if (Number.isInteger(s.band) && document.activeElement !== $('band-select')) $('band-select').value = s.band;
  if (Number.isInteger(s.fanMinimum) && document.activeElement !== $('fan-minimum-slider')) { $('fan-minimum-slider').value = s.fanMinimum; updateFanSliderLabel(s.fanMinimum); }
}
async function refreshState() { try { render(await request('/api/state')); } catch (e) { if (/Authentication/.test(e.message)) location.reload(); } }
async function refreshEvents() {
  try { const rows = await request('/api/events'); $('events').replaceChildren(...rows.map(row => { const li = document.createElement('li'); const time = document.createElement('time'); time.textContent = new Date(row.at).toLocaleTimeString(); li.append(time, `[${row.kind}] ${row.message}`); return li; })); } catch {}
}
async function updateConfig(setting, value, label) {
  try {
    await request('/api/config', { method: 'POST', body: JSON.stringify({ setting, value }) });
    toast(label || 'Configuration updated');
    await refreshState();
  } catch (e) { toast(e.message); }
}
async function boot() {
  const state = await request('/api/session'); csrf = state.csrf || ''; needsSetup = state.needsSetup;
  if (!state.authenticated) { show('auth', true); show('app', false); $('auth-title').textContent = needsSetup ? 'Create administrator' : 'Remote sign in'; $('auth-copy').textContent = needsSetup ? 'Set the first account for this KPA1500 host.' : 'Control and monitor your amplifier securely.'; $('password').autocomplete = needsSetup ? 'new-password' : 'current-password'; return; }
  show('auth', false); show('app', true); setView(viewMode); buildRoutingControls(); await refreshState(); await refreshEvents(); setInterval(refreshState, 700); setInterval(refreshEvents, 5000);
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
document.querySelectorAll('[data-action-pf]').forEach(button => button.addEventListener('click', async () => { try { await request('/api/control', { method: 'POST', body: JSON.stringify({ action: button.dataset.actionPf }) }); toast(`${button.textContent} command sent`); } catch (e) { toast(e.message); } }));
$('view-operate').addEventListener('click', () => setView('operate'));
$('view-config').addEventListener('click', () => setView('config'));
populateBandSelect();
for (let i = 1; i <= 32; i++) { const option = document.createElement('option'); option.value = i; option.textContent = `ANT ${i}`; $('antenna-select').append(option); }
$('band-select').addEventListener('change', async event => { try { await request('/api/control', { method: 'POST', body: JSON.stringify({ action: 'band', value: Number(event.target.value) }) }); } catch (e) { toast(e.message); } });
$('antenna-select').addEventListener('change', async event => { try { await request('/api/control', { method: 'POST', body: JSON.stringify({ action: 'antenna', value: Number(event.target.value) }) }); } catch (e) { toast(e.message); } });
function updateFanSliderLabel(value) { const labels = ['0 — Automatic / off', '1 — Minimum', '2', '3', '4', '5 — Maximum']; $('fan-slider-value').textContent = labels[Number(value)] || value; }
$('fan-minimum-slider').addEventListener('input', event => updateFanSliderLabel(event.target.value));
$('fan-minimum-slider').addEventListener('change', async event => { try { await request('/api/control', { method: 'POST', body: JSON.stringify({ action: 'fanMinimum', value: Number(event.target.value) }) }); toast(`Minimum fan speed set to ${event.target.value}`); } catch (e) { toast(e.message); } });
$('cfg-atu-retune').addEventListener('change', event => updateConfig('atuHiSwrRetune', event.target.checked ? 1 : 0, `ATU HiSWR retune ${event.target.checked ? 'enabled' : 'disabled'}`));
$('cfg-atu-bins').addEventListener('change', event => updateConfig('atuSettingsPerBin', Number(event.target.value), 'ATU settings per bin updated'));
$('cfg-atu-retune-threshold').addEventListener('change', event => updateConfig('atuRetuneThreshold', Number(event.target.value), 'ATU retune threshold updated'));
$('cfg-swr-bypass').addEventListener('change', event => updateConfig('swrBypassThreshold', Number(event.target.value), 'SWR bypass threshold updated'));
$('cfg-swr-stop').addEventListener('change', event => updateConfig('swrStopThreshold', Number(event.target.value), 'SWR stop threshold updated'));
$('cfg-swr-nomatch').addEventListener('change', event => updateConfig('swrNoMatchThreshold', Number(event.target.value), 'SWR no-match threshold updated'));
$('cfg-alc').addEventListener('change', event => updateConfig('alcThreshold', Number(event.target.value), 'ALC threshold updated'));
$('cfg-band-change').addEventListener('change', event => updateConfig('bandChangeStandby', Number(event.target.value), `Band change standby ${Number(event.target.value) ? 'enabled' : 'disabled'}`));
$('cfg-atten-release').addEventListener('change', event => updateConfig('attenuatorReleaseMs', Number(event.target.value), 'Attenuator release updated'));
$('cfg-fan-dwell').addEventListener('change', event => updateConfig('fanDwellSeconds', Number(event.target.value), 'Fan dwell updated'));
$('cfg-antenna-preferred').addEventListener('change', event => {
  const band = currentRoutingBand(window.__kpaState || {});
  updateConfig('antennaPreferredBand', { band, antenna: Number(event.target.value) }, 'Antenna preferred updated');
});
$('wake').addEventListener('click', async () => { try { await request('/api/wake', { method: 'POST' }); toast('Wake packet sent'); } catch (e) { toast(e.message); } });
$('logout').addEventListener('click', async () => { await request('/api/logout', { method: 'POST' }); location.reload(); });
$('compact').addEventListener('click', () => { $('app').classList.toggle('compact'); $('compact').textContent = $('app').classList.contains('compact') ? 'Full view' : 'Compact'; });
$('refresh-log').addEventListener('click', refreshEvents);
boot().catch(e => { $('auth-error').textContent = e.message; });
