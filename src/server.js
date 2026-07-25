'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const dgram = require('node:dgram');
const { spawnSync } = require('node:child_process');
const { hashPassword, verifyPassword, token } = require('./auth');
const { Amplifier } = require('./amplifier');
const { probe } = require('./discover');
const { ensureCertificate, safeHostname } = require('./tls');

const root = path.resolve(__dirname, '..');
const dataDir = process.env.KPA1500_DATA_DIR || path.join(root, 'data');
const configPath = process.env.KPA1500_CONFIG || path.join(dataDir, 'config.json');
const usersPath = path.join(dataDir, 'users.json');
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const defaults = { hostAdmin: { host: '127.0.0.1', port: 4525 }, remote: { host: '0.0.0.0', port: 4526, hostname: 'kpa1500.local', sessionHours: 12 }, amplifier: { mode: 'demo', host: '192.168.1.150', port: 1500, serialDevice: '/dev/ttyUSB0', serialBaud: 38400, macAddress: '' }, polling: { fastMs: 500, slowMs: 5000 } };
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return structuredClone(fallback); } };
const writeJson = (file, value) => { const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); fs.renameSync(temp, file); };
const config = readJson(configPath, defaults);
config.hostAdmin ||= defaults.hostAdmin;
config.remote ||= { ...defaults.remote, ...(config.web || {}) };
config.amplifier ||= defaults.amplifier; config.polling ||= defaults.polling;
delete config.web; writeJson(configPath, config);
let users = readJson(usersPath, []);
const sessions = new Map(), attempts = new Map(), events = [];
const amp = new Amplifier({ ...config.amplifier, fastMs: config.polling.fastMs, slowMs: config.polling.slowMs });
let tls = ensureCertificate(dataDir, config.remote.hostname);

function log(kind, message) { events.unshift({ at: new Date().toISOString(), kind, message }); if (events.length > 200) events.length = 200; }
amp.on('command', value => log('tx', value)); amp.on('frame', value => log('rx', value));
amp.on('state', state => { if (state.macAddress && state.macAddress !== config.amplifier.macAddress) { config.amplifier.macAddress = state.macAddress; writeJson(configPath, config); log('config', `Captured amplifier MAC ${state.macAddress}`); } });
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=')).filter(v => v.length === 2));
function session(req) { const value = sessions.get(cookies(req).kpa_session); return value && value.expires > Date.now() ? value : null; }
function json(res, status, value, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)); }
function body(req, limit = 16384) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > limit) reject(new Error('Request too large')); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } }); req.on('error', reject); }); }
function requireAuth(req, res, csrf = false) { const value = session(req); if (!value) { json(res, 401, { error: 'Authentication required' }); return null; } if (csrf && req.headers['x-csrf-token'] !== value.csrf) { json(res, 403, { error: 'Invalid CSRF token' }); return null; } return value; }
const clientIp = req => req.socket.remoteAddress || 'unknown';
function failLogin(req) { const old = attempts.get(clientIp(req)) || { count: 0, until: 0 }; old.count++; old.until = Date.now() + Math.min(300000, old.count * old.count * 1000); attempts.set(clientIp(req), old); }
function setCookie(res, name, value, maxAge) { res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`); }
const controls = { operate: '^OS1;', standby: '^OS0;', powerOn: '^ON1;', powerOff: '^ON0;', tune: '^FT;', cancelTune: '^FE;', atuInline: '^AI1;', atuBypass: '^AI0;' };

async function remoteApi(req, res, pathname) {
  if (pathname === '/api/login' && req.method === 'POST') {
    const record = attempts.get(clientIp(req)); if (record && record.count >= 5 && record.until > Date.now()) return json(res, 429, { error: 'Too many attempts; try again later' });
    const data = await body(req), user = users.find(item => item.username === data.username);
    if (!user || !verifyPassword(String(data.password || ''), user.passwordHash)) { failLogin(req); return json(res, 401, { error: 'Invalid username or password' }); }
    attempts.delete(clientIp(req)); const id = token(), hours = config.remote.sessionHours;
    const value = { username: user.username, csrf: token(24), expires: Date.now() + hours * 3600000 }; sessions.set(id, value); setCookie(res, 'kpa_session', id, hours * 3600);
    log('security', `Remote login ${user.username}`); return json(res, 200, { username: value.username, csrf: value.csrf });
  }
  if (pathname === '/api/session' && req.method === 'GET') { const value = session(req); return json(res, 200, value ? { authenticated: true, username: value.username, csrf: value.csrf } : { authenticated: false }); }
  if (pathname === '/api/logout' && req.method === 'POST') { const value = requireAuth(req, res, true); if (!value) return; sessions.delete(cookies(req).kpa_session); setCookie(res, 'kpa_session', '', 0); return json(res, 200, { ok: true }); }
  const user = requireAuth(req, res, req.method !== 'GET'); if (!user) return;
  if (pathname === '/api/state' && req.method === 'GET') return json(res, 200, { ...amp.state, connectionMode: config.amplifier.mode });
  if (pathname === '/api/events' && req.method === 'GET') return json(res, 200, events.slice(0, 80));
  if (pathname === '/api/control' && req.method === 'POST') { const data = await body(req); let command = controls[data.action]; if (data.action === 'antenna' && Number.isInteger(data.value) && data.value >= 1 && data.value <= 32) command = `^AN${data.value};`; if (data.action === 'fanMinimum' && Number.isInteger(data.value) && data.value >= 0 && data.value <= 5) command = `^FC${data.value};`; if (!command) return json(res, 400, { error: 'Unsupported control' }); try { amp.send(command); return json(res, 202, { ok: true }); } catch (error) { return json(res, 503, { error: error.message }); } }
  if (pathname === '/api/wake' && req.method === 'POST') { const mac = String(config.amplifier.macAddress || '').replace(/[^0-9a-f]/gi, ''); if (mac.length !== 12) return json(res, 400, { error: 'Host Setup has not captured a valid amplifier MAC' }); const macBytes = Buffer.from(mac, 'hex'), packet = Buffer.concat([Buffer.alloc(6, 0xff), ...Array(16).fill(macBytes)]), parts = String(config.amplifier.host).split('.'), broadcast = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.255` : '255.255.255.255'; const socket = dgram.createSocket('udp4'); socket.bind(() => { socket.setBroadcast(true); socket.send(packet, 9, broadcast, () => socket.close()); }); log('control', `Wake requested by ${user.username}`); return json(res, 202, { ok: true }); }
  return json(res, 404, { error: 'Not found' });
}

async function hostApi(req, res, pathname) {
  if (pathname === '/host-api/status' && req.method === 'GET') return json(res, 200, { amplifier: { ...amp.state, connectionMode: config.amplifier.mode }, remote: { hostname: config.remote.hostname, port: config.remote.port, url: `https://${config.remote.hostname}:${config.remote.port}`, username: users[0]?.username || '', fingerprint: tls.fingerprint, validTo: tls.validTo, caValidTo: tls.caValidTo }, hostAdmin: config.hostAdmin });
  if (pathname === '/host-api/config' && req.method === 'GET') return json(res, 200, { amplifier: config.amplifier, remote: { ...config.remote, fingerprint: tls.fingerprint, validTo: tls.validTo, caValidTo: tls.caValidTo }, username: users[0]?.username || '' });
  if (pathname === '/host-api/ca.crt' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="kpa1500-private-ca.crt"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); return res.end(tls.caCert); }
  if (pathname === '/host-api/fingerprint.svg' && req.method === 'GET') { const qr = spawnSync('qrencode', ['-t', 'SVG', '-o', '-', `KPA1500 PRIVATE CA SHA256 ${tls.fingerprint}`], { encoding: 'buffer', maxBuffer: 1024 * 1024 }); if (qr.status !== 0) return json(res, 503, { error: 'QR generator is not installed' }); res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); return res.end(qr.stdout); }
  if (pathname === '/host-api/probe' && req.method === 'POST') { const data = await body(req), host = String(data.host || '').trim(), port = Number(data.port); if (!/^[A-Za-z0-9_.:-]{1,253}$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) return json(res, 400, { error: 'Enter a valid amplifier host and port' }); if (host === config.amplifier.host && port === config.amplifier.port && amp.state.connected) return json(res, 200, { ok: true, firmware: amp.state.firmware, serialNumber: amp.state.serialNumber, macAddress: amp.state.macAddress || config.amplifier.macAddress, wakeOnLanEnabled: amp.state.wakeOnLanEnabled }); const result = await probe(host, port, 2500); if (!result || !/\^(RV|SN|MA)/.test(result.response)) return json(res, 502, { error: 'No KPA1500 identified at that address' }); const fields = Object.fromEntries([...result.response.matchAll(/\^([A-Z]{2})([^;]*);/g)].map(m => [m[1], m[2]])); return json(res, 200, { ok: true, firmware: fields.RV, serialNumber: fields.SN, macAddress: fields.MA, wakeOnLanEnabled: fields.WL === '1' }); }
  if (pathname === '/host-api/config' && req.method === 'PUT') {
    const data = await body(req), remotePort = Number(data.remotePort), amplifierPort = Number(data.amplifierPort), serialBaud = Number(data.serialBaud), mode = String(data.mode || ''), hostname = safeHostname(data.hostname);
    if (![remotePort, amplifierPort].every(p => Number.isInteger(p) && p >= 1 && p <= 65535)) return json(res, 400, { error: 'Ports must be between 1 and 65535' }); if (!['demo', 'tcp', 'serial'].includes(mode)) return json(res, 400, { error: 'Invalid amplifier connection mode' }); if (!Number.isInteger(serialBaud) || serialBaud < 1200 || serialBaud > 1000000) return json(res, 400, { error: 'Invalid serial baud rate' });
    const username = String(data.username || '').trim(); if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) return json(res, 400, { error: 'Remote username must be 3-32 safe characters' });
    if (!users.length || data.password) { try { users = [{ username, passwordHash: hashPassword(String(data.password || '')) }]; } catch (error) { return json(res, 400, { error: error.message }); } } else users[0].username = username;
    const tlsChanged = config.remote.hostname !== hostname; const portChanged = config.remote.port !== remotePort;
    Object.assign(config.remote, { hostname, port: remotePort }); Object.assign(config.amplifier, { mode, host: String(data.amplifierHost || '').trim(), port: amplifierPort, serialDevice: String(data.serialDevice || '').trim(), serialBaud, macAddress: String(data.macAddress || '').trim() }); writeJson(usersPath, users); writeJson(configPath, config);
    amp.reconfigure({ ...config.amplifier, fastMs: config.polling.fastMs, slowMs: config.polling.slowMs }); if (tlsChanged) tls = ensureCertificate(dataDir, hostname, true);
    json(res, 200, { ok: true, url: `https://${hostname}:${remotePort}`, fingerprint: tls.fingerprint }); if (tlsChanged || portChanged) setTimeout(restartRemoteServer, 300); return;
  }
  if (pathname === '/host-api/certificate' && req.method === 'POST') { tls = ensureCertificate(dataDir, config.remote.hostname, true); json(res, 200, { ok: true, fingerprint: tls.fingerprint, validTo: tls.validTo, caValidTo: tls.caValidTo }); setTimeout(restartRemoteServer, 300); return; }
  return json(res, 404, { error: 'Not found' });
}

const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
function staticFile(res, pathname, hostMode = false) { const relative = pathname === '/' ? (hostMode ? 'host.html' : 'index.html') : pathname.slice(1), file = path.resolve(root, 'public', relative); if (!file.startsWith(path.resolve(root, 'public') + path.sep)) return json(res, 403, { error: 'Forbidden' }); fs.readFile(file, (error, data) => { if (error) return json(res, 404, { error: 'Not found' }); res.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'", 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); res.end(data); }); }
const remoteHandler = (req, res) => { const pathname = new URL(req.url, 'https://localhost').pathname; Promise.resolve(pathname.startsWith('/api/') ? remoteApi(req, res, pathname) : staticFile(res, pathname, false)).catch(error => json(res, 500, { error: error.message })); };
const hostHandler = (req, res) => { const pathname = new URL(req.url, 'http://localhost').pathname; Promise.resolve(pathname.startsWith('/host-api/') ? hostApi(req, res, pathname) : staticFile(res, pathname, true)).catch(error => json(res, 500, { error: error.message })); };
let remoteServer = https.createServer({ key: tls.key, cert: tls.cert }, remoteHandler);
const hostServer = http.createServer(hostHandler);
function restartRemoteServer() { const old = remoteServer; remoteServer = https.createServer({ key: tls.key, cert: tls.cert }, remoteHandler); old.close(() => remoteServer.listen(config.remote.port, config.remote.host)); }
amp.start(); hostServer.listen(config.hostAdmin.port, config.hostAdmin.host, () => console.log(`KPA1500 Host Setup listening on http://${config.hostAdmin.host}:${config.hostAdmin.port}`)); remoteServer.listen(config.remote.port, config.remote.host, () => console.log(`KPA1500 Remote Client listening on https://${config.remote.host}:${config.remote.port}`));
function shutdown() { amp.stop(); hostServer.close(); remoteServer.close(() => process.exit(0)); } process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
module.exports = { hostServer, remoteServer, amp };
