---
name: kpa1500-web-remote
description: Build, extend, package, test, or troubleshoot the worldwidedx.com Raspberry Pi web application that monitors and controls an Elecraft KPA1500 over Host PC USB serial or its TCP command server. Use for KPA1500 protocol parsing, polling, controls, private-CA HTTPS, local Host Setup, remote authentication, configurable ports, Wake-on-LAN, Debian packaging, and browser UX.
---

# KPA1500 Web Remote

## Load project context

Read the repository-root `AGENTS.md` and `HANDOFF.md` before changing code. Read `references/implemented-commands.md` before changing KPA1500 command parsing or polling. Read `references/remote-modes.md` before changing connection topology, credentials, ports, or remote hosting.

Use Elecraft's current official KPA1500 programming reference as the final authority for commands not covered by the bundled concise reference. Do not commit downloaded manuals or extracted full text.

## Preserve the architecture

- Keep Host Setup on loopback HTTP at `127.0.0.1:4525`.
- Keep the remote client on authenticated HTTPS at a user-configurable port.
- Keep amplifier access server-side and private. Never expose its raw TCP command port.
- Maintain one connection from the Pi to the amplifier; the KPA1500 accepts a single TCP command client.
- Keep a persistent private CA per Pi. Reissue hostname/IP leaf certificates without replacing the CA.
- Store runtime configuration, password hashes, private keys, certificates, and packages outside Git.
- Support TCP, Host PC USB serial, and demo mode.

## Implement protocol changes safely

- Look up the exact GET, SET, and RESPONSE forms. Never infer SET syntax from GET syntax.
- Preserve the terminating semicolon and bounded command validation.
- Serialize access to the amplifier connection and tolerate partial/combined frames.
- Poll fast telemetry separately from slow identity/configuration values.
- Treat documented firmware variations and response inconsistencies explicitly.
- Confirm controls from an amplifier response or follow-up query rather than the button click alone.

## Preserve security boundaries

- Restrict all `/host-api/*` configuration endpoints to the loopback-only Host Setup listener.
- Require login before remote state or controls.
- Retain scrypt password hashing, Secure/HttpOnly/SameSite cookies, CSRF checks, throttling, and session expiry.
- Never log passwords, password hashes, cookies, tokens, private keys, or live station configuration.
- Export only the public CA certificate. Never expose `kpa1500-ca.key` or `server.key`.
- Require explicit confirmation before destructive amplifier configuration, reset, keying, or ATU-memory operations.

## Verify changes

Run:

```bash
node --check src/server.js
node --check public/app.js
node --check public/host.js
node --test test/*.test.js
bash packaging/build-deb.sh
```

Use demo mode for routine UI/API testing. Begin hardware tests with read-only identity/status commands. Never key an exciter or transmit RF during automated testing. Verify both local Host Setup and the HTTPS remote listener after service changes.

## Package and release

- Bump `package.json` for every installer build intended for distribution.
- Build with `bash packaging/build-deb.sh`; do not commit `dist/`.
- Upgrade locally with `sudo apt-get install -y ./dist/<package>.deb` only when requested or needed for live verification.
- Preserve `/var/lib/kpa1500-web` during upgrades.
- Update `HANDOFF.md` when architecture, verified hardware behavior, installation, or next work changes materially.
