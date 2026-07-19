'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function safeHostname(value) {
  const hostname = String(value || '').trim().toLowerCase();
  if (!hostname) return 'kpa1500.local';
  if (net.isIP(hostname)) return hostname;
  if (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(hostname)) throw new Error('Enter a valid DynDNS hostname or IP address');
  return hostname;
}

function runOpenSSL(args, description) {
  const result = spawnSync('openssl', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${description}: ${result.stderr.trim()}`);
}

function ensureCertificate(dataDir, hostname, forceLeaf = false) {
  hostname = safeHostname(hostname);
  const tlsDir = path.join(dataDir, 'tls');
  const caKeyPath = path.join(tlsDir, 'kpa1500-ca.key');
  const caCertPath = path.join(tlsDir, 'kpa1500-ca.crt');
  const keyPath = path.join(tlsDir, 'server.key');
  const certPath = path.join(tlsDir, 'server.crt');
  const csrPath = path.join(tlsDir, 'server.csr');
  const extPath = path.join(tlsDir, 'server.ext');
  const metaPath = path.join(tlsDir, 'certificate.json');
  fs.mkdirSync(tlsDir, { recursive: true, mode: 0o700 });

  if (!fs.existsSync(caKeyPath) || !fs.existsSync(caCertPath)) {
    runOpenSSL(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-sha256', '-nodes', '-days', '3650', '-subj', '/CN=KPA1500 Web Remote Private CA', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-addext', 'subjectKeyIdentifier=hash', '-keyout', caKeyPath, '-out', caCertPath], 'Unable to generate private CA');
    fs.chmodSync(caKeyPath, 0o600); fs.chmodSync(caCertPath, 0o644);
  }

  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
  if (forceLeaf || meta.hostname !== hostname || meta.type !== 'private-ca' || !fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    const san = net.isIP(hostname) ? `IP:${hostname}` : `DNS:${hostname}`;
    fs.writeFileSync(extPath, `basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${san}\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n`, { mode: 0o600 });
    runOpenSSL(['req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-sha256', '-nodes', '-subj', `/CN=${hostname}`, '-keyout', keyPath, '-out', csrPath], 'Unable to generate server key');
    runOpenSSL(['x509', '-req', '-in', csrPath, '-CA', caCertPath, '-CAkey', caKeyPath, '-CAcreateserial', '-days', '825', '-sha256', '-extfile', extPath, '-out', certPath], 'Unable to sign server certificate');
    fs.chmodSync(keyPath, 0o600); fs.chmodSync(certPath, 0o644);
    fs.rmSync(csrPath, { force: true }); fs.rmSync(extPath, { force: true });
    fs.writeFileSync(metaPath, JSON.stringify({ type: 'private-ca', hostname, issuedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  }

  const cert = fs.readFileSync(certPath), caCert = fs.readFileSync(caCertPath);
  const serverX509 = new crypto.X509Certificate(cert), caX509 = new crypto.X509Certificate(caCert);
  return { key: fs.readFileSync(keyPath), cert, caCert, keyPath, certPath, caCertPath, hostname, fingerprint: caX509.fingerprint256, serverFingerprint: serverX509.fingerprint256, validTo: serverX509.validTo, caValidTo: caX509.validTo };
}

module.exports = { ensureCertificate, safeHostname };
