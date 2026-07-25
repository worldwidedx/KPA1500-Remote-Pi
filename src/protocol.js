'use strict';

const SAFE_COMMAND = /^\^[A-Z][A-Z0-9]{0,2}[^;\r\n]{0,128};$/;

function normalizeCommand(command) {
  const value = String(command || '').trim().toUpperCase();
  if (!SAFE_COMMAND.test(value)) throw new Error('Invalid KPA1500 command');
  return value;
}

function commandKey(frame) {
  const match = /^\^(VM[235]|[A-Z]{1,3})/.exec(frame);
  return match ? match[1] : '';
}

function splitFrames(buffer) {
  const frames = [];
  let rest = buffer;
  for (;;) {
    const end = rest.indexOf(';');
    if (end < 0) break;
    const start = rest.indexOf('^');
    if (start < 0 || start > end) {
      rest = rest.slice(end + 1);
      continue;
    }
    frames.push(rest.slice(start, end + 1));
    rest = rest.slice(end + 1);
  }
  if (rest.length > 2048) rest = rest.slice(-256);
  return { frames, rest };
}

function payload(frame, mnemonic) {
  return frame.slice(mnemonic.length + 1, -1).trim();
}

function numberValue(value, scale = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n / scale : null;
}

function applyFrame(state, frame) {
  const key = commandKey(frame);
  const value = payload(frame, key);
  const next = { ...state, lastFrame: frame, lastSeen: new Date().toISOString() };
  switch (key) {
    case 'OS': next.mode = value === '1' ? 'OPER' : 'STBY'; break;
    case 'ON': next.power = value === '1' ? 'ON' : 'OFF'; break;
    case 'AN': next.antenna = numberValue(value); break;
    case 'BN': next.band = numberValue(value); break;
    case 'FR': next.frequencyHz = numberValue(value); break;
    case 'PWF': next.forwardWatts = numberValue(value); break;
    case 'PWR': next.reflectedWatts = numberValue(value); break;
    case 'PWI': next.inputWatts = numberValue(value); break;
    case 'SW': next.swr = numberValue(value, 10); break;
    case 'TM': next.temperatureC = numberValue(value); break;
    case 'FS': next.fanSpeed = numberValue(value); break;
    case 'FC': next.fanMinimum = numberValue(value); break;
    case 'AI': next.atuInline = value === '1'; break;
    case 'AT': if (value === '0') next.atuInline = false; break;
    case 'PC': next.currentA = numberValue(value); break;
    case 'VMH': next.voltageV = numberValue(value, 10); break;
    case 'FL': next.faultCode = value; break;
    case 'RV': next.firmware = value; break;
    case 'SN': next.serialNumber = value; break;
    case 'MA': next.macAddress = value.toUpperCase(); break;
    case 'WL': next.wakeOnLanEnabled = value === '1'; break;
    case 'WS': {
      const parts = value.split(/[ ,]/).filter(Boolean).map(Number);
      if (Number.isFinite(parts[0])) next.forwardWatts = parts[0];
      if (Number.isFinite(parts[1])) next.swr = parts[1] / 10;
      break;
    }
    case 'VI': {
      const parts = value.split(/[ ,]/).filter(Boolean).map(Number);
      if (Number.isFinite(parts[0])) next.voltageV = parts[0] / 10;
      if (Number.isFinite(parts[1])) next.currentA = parts[1] / 10;
      break;
    }
  }
  return next;
}

module.exports = { normalizeCommand, commandKey, splitFrames, applyFrame };
