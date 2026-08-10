# KPA1500 Remote PI handoff

## Resume prompt

Use the repository skill at `.codex/skills/kpa1500-web-remote/SKILL.md`. Read `AGENTS.md` and this file completely, inspect the current Git status, run the tests, and continue from the verified state below without replacing the architecture or exposing live station data.

## Current release

- Source version: `0.7.0` in `package.json`.
- Raspberry Pi package: `kpa1500-web_0.7.0_arm64.deb` (generated locally; intentionally ignored by Git).
- License: MIT.
- Canonical repository: `https://github.com/worldwidedx/KPA1500-Remote-Pi`.
- Runtime: Node.js 20+ with standard-library server code; OpenSSL and `qrencode` are packaging dependencies.

## Implemented architecture

- `src/server.js` runs two listeners:
  - Local Host Setup HTTP on `127.0.0.1:4525`.
  - Remote authenticated HTTPS on a configurable port (default 4526).
- `src/amplifier.js` supports Ethernet TCP, Host PC USB serial, reconnection, polling, and demo mode.
- `src/protocol.js` validates commands, splits frames, and maps current telemetry/status responses.
- `src/tls.js` creates a long-lived private CA and CA-signed hostname/IP server certificate.
- `public/host.html` and `host.js` provide graphical station, credentials, port, certificate, fingerprint/QR, and trust setup.
- `public/index.html` and `app.js` provide the remote amplifier dashboard and controls.
- The installed system service runs as `kpa1500-web`; mutable data lives under `/var/lib/kpa1500-web`.

## Verified behavior

- A real KPA1500 running firmware 03.06 has been identified and controlled over its configured private TCP port.
- The Pi maintains the KPA1500's single accepted TCP command-client connection.
- OPER/STBY state follows amplifier responses.
- ATU inline/bypass controls use `^AMI;` and `^AMB;` on the control path, while the parser accepts `^AM`, `^AT`, and `^AI` response forms so mixed firmware behavior still renders correctly.
- The band readout is now a dropdown that sends the verified front-panel band tap macros via `^BPT07;` through `^BPT12;` instead of only displaying the current band.
- Frequency telemetry from `^FR` is reported by the amplifier in kHz; the UI converts it to Hz for display and renders `^BN` using the Elecraft band-number-to-band table instead of treating the band number as meters.
- PF1 and PF2 are exposed in the remote dashboard and send the documented `^BPH18;` and `^BPH01;` front-panel button-press macros.
- Fan display and minimum-speed control use documented levels 0 through 5 (`^FS` and `^FC`) rather than incorrectly labeling the value as RPM, and the fan speed readout colors warn at 3, 4, and 5.
- Compact view now targets a mobile-sized layout with reduced meter prominence so the remote panel can share screen space with another app.
- The remote Health section now includes live banner text, fault detail, fault clear, current ATU setting, stored ATU settings, SWR bypass, bypass power limit, overdrive reason, and attenuator reason from the official programming reference.
- The remote client now has an Amp Config view for safe amplifier settings on the current band: ATU HiSWR retune, ATU memory depth, ATU retune/bypass/stop/no-match thresholds, ALC threshold, band-change standby, attenuator release, fan dwell, and current-band antenna defaults.
- Network and transport settings remain Host Setup only; the web client still does not expose `^CP`, `^BRP`, `^BRX`, `^DH`, `^IP`, `^GW`, or `^NM`.
- MAC capture and LAN Wake-on-LAN work; amplifier Wake-on-LAN was reported enabled during testing.
- Local Host Setup and separate HTTPS remote access work.
- Remote username/password, configurable HTTPS port, arbitrary DynDNS hostname, and private-CA trust workflow work.
- Debian install/upgrade preserves `/var/lib/kpa1500-web`.
- Nine automated tests passed at the 0.7.0 release.

Exact station addresses, username, MAC, certificates, and password data are deliberately omitted. Discover them only from authorized local runtime configuration when hardware testing is requested.

## Security model

- Private single-owner deployment, not a public multi-tenant service.
- One remote owner credential hashed with scrypt.
- Secure/HttpOnly/SameSite cookies, CSRF checks, throttling, and session expiry.
- Per-Pi private CA. Host Setup exports only the public CA and its SHA-256 fingerprint/QR.
- Remote clients trust the public CA once to remove browser warnings.
- The amplifier command port stays private; only the chosen HTTPS port is forwarded.

## Build and install

```bash
node --test test/*.test.js
bash packaging/build-deb.sh
sudo apt-get install -y ./dist/kpa1500-web_<version>_arm64.deb
sudo systemctl restart kpa1500-web.service
```

Launch local Host Setup from the desktop shortcut or browse on the Pi to `http://127.0.0.1:4525`.

## Known next-stage work

- Expand KPA1500 feature parity beyond the current dashboard and primary controls using the current official programming reference.
- Add parser fixtures for more real firmware responses and correct any unit/band presentation issues found during hardware verification.
- Add broader API/auth integration tests and browser-level UI tests.
- Consider multi-site client profiles only in a later major version; version 1 remains one Pi controlling one amplifier.
- Improve release automation and attach generated `.deb` artifacts to tagged GitHub releases rather than committing them.
