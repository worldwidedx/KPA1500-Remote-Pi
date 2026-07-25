# KPA1500 Web Remote

A dependency-light Raspberry Pi host and responsive browser remote for the Elecraft KPA1500. The local-only Host Setup app configures one amplifier, one owner account, a DynDNS hostname, and an HTTPS port. The separate remote client provides authenticated controls, telemetry, Wake-on-LAN, and a hardware-free demo mode.

## Run

```bash
cd /home/tuckpi/kpa1500-web
node --test test/*.test.js
node src/server.js
```

Open the **KPA1500 Host Setup** desktop application, which is restricted to `http://127.0.0.1:4525`. Configure the DynDNS hostname and remote credentials there. Remote users connect only through the generated HTTPS URL.

Configuration and password hashes are stored with mode `0600` under `data/`. Passwords use salted scrypt hashes. Browser control uses authenticated HttpOnly sessions and CSRF tokens.

For access across the internet, put the service behind an HTTPS reverse proxy or use a VPN such as WireGuard/Tailscale. Do not forward an unencrypted control port directly from the public internet.

## Hardware notes

- Ethernet uses the KPA1500 TCP command server, default port 1500.
- USB uses the rear Host PC connector and a device such as `/dev/ttyUSB0`. The service account must have serial-port permission (normally membership in `dialout`).
- Ethernet power-on requires the amplifier's **Net Wake on LAN** menu option plus its MAC address in Host settings.
- Automated tests never key the exciter or transmit RF.

Official Elecraft source documents and extracted text are under `docs/` for traceability.

The protocol implementation is based on Elecraft's official [KPA1500 manuals and programming reference](https://elecraft.com/pages/kpa1500-1500-watt-linear-amplifier-manuals). Downloaded vendor documents are intentionally excluded from this source repository.

## Install package

Build the ARM64 Debian package with `bash packaging/build-deb.sh`. Install the resulting file on Raspberry Pi OS with:

```bash
sudo apt install ./kpa1500-web_0.5.0_arm64.deb
```

The package starts a system service, installs a **KPA1500 Web Remote** application-menu launcher, and opens the graphical first-run account and Host Setup workflow. Station configuration and password data live in `/var/lib/kpa1500-web` and are never included in the package.

Private HTTPS uses a persistent per-Pi certificate authority. Host Setup provides its public CA certificate, SHA-256 fingerprint, QR verification, and one-time trust instructions for common client operating systems. Renewing a hostname certificate does not change the trusted CA.
