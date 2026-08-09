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

test('parses programmable function button presses', () => {
  let state = applyFrame({}, '^BPH18;');
  assert.equal(state.lastFrame, '^BPH18;');
  state = applyFrame(state, '^BPH01;');
  assert.equal(state.lastFrame, '^BPH01;');
});
