'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCommand, splitFrames, applyFrame } = require('../src/protocol');

test('validates bounded KPA commands', () => {
  assert.equal(normalizeCommand(' ^os1; '), '^OS1;');
  assert.equal(normalizeCommand(' ^bpt22; '), '^BPT22;');
  assert.throws(() => normalizeCommand('^OS1;\n^ON0;'));
  assert.throws(() => normalizeCommand('OS1;'));
});
test('splits partial and combined frames', () => {
  assert.deepEqual(splitFrames('noise^OS1;^WS123,014;^T'), { frames: ['^OS1;', '^WS123,014;'], rest: '^T' });
});
test('maps telemetry frames', () => {
  let state = {};
  state = applyFrame(state, '^OS1;'); state = applyFrame(state, '^PWF1042;'); state = applyFrame(state, '^SW014;'); state = applyFrame(state, '^BN05;'); state = applyFrame(state, '^FR14240;');
  assert.equal(state.mode, 'OPER'); assert.equal(state.forwardWatts, 1042); assert.equal(state.swr, 1.4); assert.equal(state.bandLabel, '20 m'); assert.equal(state.frequencyHz, 14240000);
});
test('captures MAC address and Wake-on-LAN state', () => {
  let state = applyFrame({}, '^MA54:10:EC:14:75:22;');
  state = applyFrame(state, '^WL1;');
  assert.equal(state.macAddress, '54:10:EC:14:75:22'); assert.equal(state.wakeOnLanEnabled, true);
});
test('maps ATU inline and bypass responses including documented AT0 variant', () => {
  let state = applyFrame({}, '^AMI;'); assert.equal(state.atuInline, true);
  state = applyFrame(state, '^AMB;'); assert.equal(state.atuInline, false);
  state = applyFrame({ atuInline: false }, '^AT1;'); assert.equal(state.atuInline, true);
  state = applyFrame(state, '^AT0;'); assert.equal(state.atuInline, false);
  state = applyFrame({ atuInline: false }, '^AI1;'); assert.equal(state.atuInline, true);
  state = applyFrame({ atuInline: true }, '^AI0;'); assert.equal(state.atuInline, false);
});
test('maps current and minimum fan speed levels', () => {
  let state = applyFrame({}, '^FS4;'); state = applyFrame(state, '^FC2;');
  assert.equal(state.fanSpeed, 4); assert.equal(state.fanMinimum, 2);
});

test('captures ATU diagnostics and fault detail frames', () => {
  let state = applyFrame({}, '^BTKPA1500\\nWhidbey;');
  state = applyFrame(state, '^DA18086 AN1 Side ANT 340 nH (L06) 0 pf (C00) SWR Bypass 3.0;');
  state = applyFrame(state, '^DF14000-14019\\nAN1 Side TX 480 nH (L08) 180 pF (C10) SWR Bypass 1.8;');
  state = applyFrame(state, '^SB032;');
  state = applyFrame(state, '^TB032 1565W;');
  state = applyFrame(state, '^OC60;');
  state = applyFrame(state, '^AD PA CURRENT;');
  state = applyFrame(state, '^SF0020 FAULT "PA Current" 26-08-09T12:34:56 otherInfo val 1;');
  assert.equal(state.bannerText, 'KPA1500\nWhidbey');
  assert.equal(state.currentAtuSetting, '18086 AN1 Side ANT 340 nH (L06) 0 pf (C00) SWR Bypass 3.0');
  assert.match(state.storedAtuSettings, /^14000-14019\nAN1 Side TX 480 nH/);
  assert.equal(state.swrBypass, 3.2);
  assert.deepEqual(state.powerLimitBypass, { swr: 3.2, watts: 1565 });
  assert.equal(state.overdriveReason, '60');
  assert.equal(state.lastAttenuatorReason, 'PA CURRENT');
  assert.match(state.faultDetails, /^0020 FAULT/);
});

test('captures amplifier configuration frames', () => {
  let state = applyFrame({}, '^AB08;');
  state = applyFrame(state, '^HS1;');
  state = applyFrame(state, '^STA018;');
  state = applyFrame(state, '^STB012;');
  state = applyFrame(state, '^STS011;');
  state = applyFrame(state, '^STN030;');
  state = applyFrame(state, '^AL075;');
  state = applyFrame(state, '^AE0503D;');
  state = applyFrame(state, '^AE05ALL12DDDDD1111122222DDDDD1111122222;');
  state = applyFrame(state, '^AEAB01201201201;');
  state = applyFrame(state, '^AP0502;');
  state = applyFrame(state, '^APAB01201201201;');
  state = applyFrame(state, '^AR2000;');
  state = applyFrame(state, '^BC1;');
  state = applyFrame(state, '^DW010;');
  assert.equal(state.atuSettingsPerBin, 8);
  assert.equal(state.atuHiSwrRetune, true);
  assert.equal(state.atuRetuneThreshold, 1.8);
  assert.equal(state.swrBypassThreshold, 1.2);
  assert.equal(state.swrStopThreshold, 1.1);
  assert.equal(state.swrNoMatchThreshold, 3);
  assert.equal(state.alcThreshold, 75);
  assert.equal(state.antennaEnableBand, 5);
  assert.equal(state.antennaEnableTable[2], 'D');
  assert.equal(state.antennaEnableTable[0], '1');
  assert.equal(state.antennaEnableTable[4], 'D');
  assert.equal(state.antennaEnableTable[8], '1');
  assert.deepEqual(state.antennaEnableAllBands, ['0', '1', '2', '0', '1', '2', '0', '1', '2', '0', '1']);
  assert.equal(state.antennaPreferredBand, 5);
  assert.equal(state.antennaPreferred, 2);
  assert.deepEqual(state.antennaPreferredAllBands, [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1]);
  assert.equal(state.attenuatorReleaseMs, 2000);
  assert.equal(state.bandChangeStandby, true);
  assert.equal(state.fanDwellSeconds, 10);
});

test('captures manual ATU relay masks', () => {
  let state = applyFrame({}, '^CRC1;');
  state = applyFrame(state, '^LR61;');
  assert.equal(state.atuCapacitorsMask, 'C1');
  assert.equal(state.atuInductorsMask, '61');
});

test('parses programmable function button presses', () => {
  let state = applyFrame({}, '^BPH18;');
  assert.equal(state.lastFrame, '^BPH18;');
  state = applyFrame(state, '^BPH01;');
  assert.equal(state.lastFrame, '^BPH01;');
});
