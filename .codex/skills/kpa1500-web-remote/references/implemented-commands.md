# Implemented KPA1500 command reference

Use Elecraft's current programming reference for complete formats, valid ranges, firmware notes, and any command not listed here. Every command and response is ASCII and terminated by `;`.

| Command | Current use |
| --- | --- |
| `^I;` | Identify a responding KPA1500 during a connection probe. |
| `^RV;` | Read firmware version. |
| `^SN;` | Read serial number. |
| `^MA;` | Read Ethernet MAC address for Wake-on-LAN. Example response payload uses colon-separated octets. |
| `^WL;` | Read whether Wake-on-LAN is enabled. `0` is disabled and `1` is enabled. |
| `^ON;`, `^ON0;`, `^ON1;` | Read, turn off, or turn on main power supplies. Ethernet power-on normally uses Wake-on-LAN. |
| `^OS;`, `^OS0;`, `^OS1;` | Read or set STBY/OPER. `0` is STBY and `1` is OPER. Drive button highlighting from the response. |
| `^AN;`, `^ANn;` | Read or select antenna. Firmware 3.x supports extended antenna numbers; validate against the current manual. |
| `^BN;` | Read band number. Map it through Elecraft's band table before rendering a band label. |
| `^FR;` | Read frequency in kHz. Convert to Hz for display formatting. |
| `^WS;` | Read forward power and SWR combined telemetry. |
| `^PWF;` | Read forward RF output power in watts. |
| `^PWR;` | Read reflected RF power in watts. |
| `^PWI;` | Read RF input power in watts. |
| `^SW;` | Read SWR, represented in tenths by current parsing. |
| `^TM;` | Read temperature. |
| `^VI;` | Read PA voltage and current combined telemetry. |
| `^PC;` | Read PA current. |
| `^VMH;` | Read nominal 50-volt supply monitor. |
| `^FS;` | Read fan speed. |
| `^FC;`, `^FC0;`…`^FC5;` | Read or set minimum fan speed from automatic/off (0) through maximum (5). Actual `^FS` may be higher due to temperature. |
| `^AM;`, `^AM...` | Read ATU mode for the current band/antenna. Accept `^AI` and `^AT` response variants from mixed firmware behavior. |
| `^AI;`, `^AI0;`, `^AI1;` | Read or set the ATU bypass relays: `0` bypass and `1` inline. |
| `^AMI;`, `^AMB;` | Front-panel ATU inline and bypass button-press macros used by this project for remote control. |
| `^BPH18;`, `^BPH01;` | Simulate the PF1 and PF2 front-panel button holds. |
| `^FL;` | Read fault code. |
| `^FT;` | Start ATU tune. |
| `^FE;` | Cancel full-search tune. |

The server polls `^WS`, `^PWR`, `^PWI`, `^TM`, `^VI`, `^FS`, `^FL`, and `^OS` quickly. It polls power, antenna, band, frequency, ATU mode, identity, MAC, and Wake-on-LAN more slowly.

Official source: https://elecraft.com/pages/kpa1500-1500-watt-linear-amplifier-manuals
