# Release Notes

## 0.7.0 - 2026-08-10

This release expands the browser remote into a more complete operating and configuration surface while keeping the host network settings private to Host Setup.

- Added a dedicated Operate/Config split in the remote client so the dashboard stays usable while the configuration surface grows.
- Expanded the remote Health section with live banner text, fault detail and clear, current ATU state, stored ATU settings, SWR bypass, bypass power limit, overdrive reason, and attenuator reason.
- Added an Amp Config view for safe current-band amplifier settings including ATU HiSWR retune, ATU memory depth, ATU retune/bypass/stop/no-match thresholds, ALC threshold, band-change standby, attenuator release, fan dwell, and current-band antenna defaults.
- Added current-band ATU relay controls with operator-friendly pF and nH labeling.
- Tightened the compact view so the browser can still be used on a mobile-sized screen without losing the important controls.

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
