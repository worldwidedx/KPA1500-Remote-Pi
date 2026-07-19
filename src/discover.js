'use strict';

const net = require('node:net');
const os = require('node:os');

function localSubnets() {
  const found = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const item of entries || []) {
      if (item.family === 'IPv4' && !item.internal && item.netmask === '255.255.255.0') {
        found.push(item.address.split('.').slice(0, 3).join('.'));
      }
    }
  }
  return [...new Set(found)];
}

function probe(host, port = 1500, timeout = 500) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    let response = '';
    const done = match => { socket.destroy(); resolve(match); };
    socket.setTimeout(timeout);
    socket.once('connect', () => { socket.write('^I;^RV;^SN;^MA;^WL;'); setTimeout(() => done({ host, port, response }), 500); });
    socket.on('data', data => { response += data.toString('ascii'); });
    socket.once('timeout', () => done(response ? { host, port, response } : null));
    socket.once('error', () => done(null));
  });
}

async function discover(port = 1500, prefixes = localSubnets()) {
  const targets = prefixes.flatMap(prefix => Array.from({ length: 254 }, (_, index) => `${prefix}.${index + 1}`));
  const matches = [];
  for (let offset = 0; offset < targets.length; offset += 32) {
    const results = await Promise.all(targets.slice(offset, offset + 32).map(host => probe(host, port)));
    matches.push(...results.filter(Boolean));
  }
  return matches;
}

if (require.main === module) {
  const port = Number(process.argv[2] || 1500);
  const host = process.argv[3];
  const run = host ? probe(host, port, 2000).then(match => match ? [match] : []) : discover(port);
  run.then(matches => { console.log(JSON.stringify({ targets: host || localSubnets(), port, matches }, null, 2)); process.exit(matches.length ? 0 : 2); });
}

module.exports = { localSubnets, probe, discover };
