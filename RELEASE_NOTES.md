# Release Notes

## 0.6.1 - 2026-08-09

This release focuses on layout usability and band selection.

- Added a band selector in the remote panel that sends the verified Elecraft band tap macros through the server.
- Tightened compact mode so the browser can shrink to a much narrower mobile-style width.
- Reduced the RF output emphasis and compressed the control groups in compact mode.
- Kept the ATU, PF1/PF2, frequency, band-label, fan, and HTTPS trust changes from 0.6.0.

## 0.6.0 - 2026-07-27

This release tightens protocol fidelity and fills out the remote panel.

- Fixed ATU inline/bypass control to use the verified `^AMI;` and `^AMB;` macros.
- Added PF1 and PF2 buttons to the remote dashboard using the front-panel hold macros.
- Corrected frequency telemetry display so `^FR` is treated as kHz and shown in MHz with the proper scale.
- Corrected band rendering so Elecraft band numbers show as human-readable band labels.
- Added fan speed severity colors: 3 is yellow, 4 is orange, and 5 is red.
- Kept the private HTTPS remote workflow, WOL capture, and host/client architecture unchanged.

Previous release:

- 0.5.0 introduced ATU controls, fan minimum control, private CA HTTPS trust workflow, and the initial browser remote panel.
