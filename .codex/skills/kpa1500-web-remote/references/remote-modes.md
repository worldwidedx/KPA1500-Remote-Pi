# Remote topology

The project intentionally separates two user experiences:

- **Host Setup:** local graphical administration served only at `http://127.0.0.1:4525` on the Pi.
- **Remote client:** authenticated amplifier controls served over HTTPS on a user-configurable port.

The Pi connects privately to one KPA1500 by Ethernet TCP or Host PC USB. Remote browsers never connect directly to the amplifier. Multiple browser sessions share the Pi's single amplifier connection.

Host Setup configures the amplifier address/port or serial device, DynDNS hostname or IP, remote HTTPS port, one owner username/password, certificate trust material, and Wake-on-LAN MAC. The private amplifier port must not be forwarded.

Private HTTPS uses a per-installation CA. Host Setup provides only its public certificate, fingerprint, QR, and trust instructions. Changing hostname/IP renews the leaf certificate while retaining the CA. Remote users may see a warning until they trust the public CA on their device.

The legacy Elecraft Remote model uses Local Connect, Host Remote, and Connect Remote modes with a default host port of 4526. This project maps the Pi service to Host Remote and the browser to Connect Remote while using standard HTTPS rather than a raw custom client protocol.
