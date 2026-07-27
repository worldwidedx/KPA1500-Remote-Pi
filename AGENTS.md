# Codex project instructions

## Start here

Read `HANDOFF.md` before changing code. Use the repository skill at `.codex/skills/kpa1500-web-remote/SKILL.md` for protocol, security, packaging, Host Setup, remote-client, or hardware work.

## Product intent

Build a private, owner-operated Raspberry Pi remote for one Elecraft KPA1500. The Pi maintains the sole private amplifier connection. A local graphical Host Setup configures the station, while an authenticated HTTPS browser client provides remote controls. Preserve configurable remote ports and arbitrary DynDNS hostname or IP support.

Keep the product branding in both interfaces: `ELECRAFT KPA` uppercase green, `1500` white, and `by worldwidedx.com` lowercase white.

## Architecture invariants

- Host Setup: loopback HTTP only, `127.0.0.1:4525`.
- Remote client: HTTPS on a user-configurable listening port.
- Amplifier: one private TCP or Host PC USB connection from the server.
- TLS: persistent private CA plus hostname/IP leaf certificate; export only the public CA.
- Data: `/var/lib/kpa1500-web` when installed; local `data/` during development. Never commit either.
- Runtime: dependency-light Node.js 20+, no frontend build step.
- Packaging: ARM64 Debian package built by `packaging/build-deb.sh`.

## Safety

Never expose the raw amplifier command port, live credentials, station hostname/IP/MAC, password hashes, session tokens, or private keys. Never transmit RF or key an exciter in automated tests. Begin hardware checks with read-only commands. Ask before destructive reset, firmware, ATU-memory, or keying operations.

Downloaded Elecraft manuals are local reference material and must not be committed. Link to official sources instead.

## Required verification

Run relevant syntax checks plus:

```bash
node --test test/*.test.js
```

For installer changes also run:

```bash
bash packaging/build-deb.sh
dpkg-deb --info dist/kpa1500-web_<version>_arm64.deb
```

After installed-service changes, verify the loopback Host Setup endpoint, the HTTPS remote session endpoint, and—when hardware is available—the single established amplifier connection.

## Git workflow

The canonical repository is `https://github.com/worldwidedx/KPA1500-Remote-Pi`. Keep `main` releasable. Do not commit `data/`, `dist/`, downloaded manuals, certificates, or generated archives. Update `RELEASE_NOTES.md` and `HANDOFF.md` with material decisions and verified state before handing work to another computer.
