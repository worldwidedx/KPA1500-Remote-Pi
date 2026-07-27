'use strict';

const net = require('node:net');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { normalizeCommand, splitFrames, applyFrame } = require('./protocol');

const initialState = () => ({
  connected: false, power: 'ON', mode: 'STBY', antenna: 1, band: 20,
  frequencyHz: 14200000, forwardWatts: 0, reflectedWatts: 0, inputWatts: 0,
  swr: 1, temperatureC: 28, fanSpeed: 0, fanMinimum: 0, atuInline: false, voltageV: 50, currentA: 0,
  faultCode: '000', firmware: '', serialNumber: '', lastSeen: null
});

class Amplifier extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.state = initialState();
    this.transport = null;
    this.buffer = '';
    this.reconnectTimer = null;
    this.pollTimers = [];
  }

  start() {
    if (this.config.mode === 'demo') return this.startDemo();
    this.connect();
  }

  stop() {
    clearTimeout(this.reconnectTimer);
    this.pollTimers.forEach(clearInterval);
    this.pollTimers = [];
    this.transport?.removeAllListeners?.();
    this.transport?.destroy?.();
    this.transport = null;
    this.setState({ connected: false });
  }

  reconfigure(config) {
    this.stop();
    this.config = config;
    this.buffer = '';
    this.start();
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }

  startDemo() {
    this.setState({ connected: true, firmware: 'DEMO 3.03', serialNumber: 'SIMULATOR' });
    let phase = 0;
    this.pollTimers.push(setInterval(() => {
      phase += 0.18;
      const transmitting = this.state.mode === 'OPER' && this.state.power === 'ON';
      const watts = transmitting ? Math.max(0, Math.round(780 + Math.sin(phase) * 260)) : 0;
      this.setState({
        forwardWatts: watts, reflectedWatts: Math.round(watts * 0.018), inputWatts: watts ? Math.round(watts / 14) : 0,
        swr: watts ? 1.15 + Math.sin(phase / 2) * .05 : 1,
        temperatureC: transmitting ? 42 + Math.round(Math.sin(phase / 3) * 3) : 29,
        fanSpeed: transmitting ? 3 : this.state.fanMinimum,
        currentA: watts ? Math.round(watts / 50 * 10) / 10 : 0,
        lastSeen: new Date().toISOString()
      });
    }, 500));
  }

  connect() {
    if (this.config.mode === 'tcp') {
      const socket = net.createConnection({ host: this.config.host, port: this.config.port || 1500 });
      this.attach(socket);
      socket.setKeepAlive(true, 5000);
      return;
    }
    if (this.config.mode === 'serial') {
      const device = this.config.serialDevice;
      const baud = String(this.config.serialBaud || 38400);
      const setup = spawnSync('stty', ['-F', device, baud, 'raw', '-echo'], { encoding: 'utf8' });
      if (setup.status !== 0) return this.connectionFailed(new Error(setup.stderr || 'Unable to configure serial device'));
      const fd = fs.openSync(device, 'r+');
      const reader = fs.createReadStream(null, { fd, autoClose: false });
      const writer = fs.createWriteStream(null, { fd, autoClose: true });
      reader.on('data', data => this.receive(data));
      reader.on('error', error => this.connectionFailed(error));
      this.transport = writer;
      setTimeout(() => this.connected(), 100);
      return;
    }
    this.connectionFailed(new Error(`Unknown amplifier mode: ${this.config.mode}`));
  }

  attach(transport) {
    this.transport = transport;
    transport.on('connect', () => this.connected());
    transport.on('open', () => this.connected());
    transport.on('data', data => this.receive(data));
    transport.on('error', error => this.connectionFailed(error));
    transport.on('close', () => this.connectionFailed(new Error('Connection closed')));
  }

  connected() {
    if (this.state.connected) return;
    this.setState({ connected: true, error: null });
    this.pollTimers.push(setInterval(() => this.queryFast(), this.config.fastMs || 500));
    this.pollTimers.push(setInterval(() => this.querySlow(), this.config.slowMs || 5000));
    this.querySlow();
  }

  connectionFailed(error) {
    if (!this.state.connected && this.reconnectTimer) return;
    this.setState({ connected: false, error: error.message });
    this.pollTimers.forEach(clearInterval);
    this.pollTimers = [];
    this.transport?.destroy?.();
    this.transport = null;
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect(); }, 3000);
  }

  receive(data) {
    const result = splitFrames(this.buffer + data.toString('ascii'));
    this.buffer = result.rest;
    for (const frame of result.frames) {
      this.state = applyFrame(this.state, frame);
      this.emit('frame', frame);
      this.emit('state', this.state);
    }
  }

  send(command) {
    const clean = normalizeCommand(command);
    if (this.config.mode === 'demo') return this.demoCommand(clean);
    if (!this.state.connected || !this.transport) throw new Error('Amplifier is not connected');
    this.transport.write(clean, 'ascii');
    this.emit('command', clean);
    return clean;
  }

  demoCommand(command) {
    if (command.startsWith('^OS')) this.setState({ mode: command.includes('1') ? 'OPER' : 'STBY' });
    else if (command.startsWith('^ON')) this.setState({ power: command.includes('1') ? 'ON' : 'OFF' });
    else if (command.startsWith('^AN')) this.setState({ antenna: Number(command.slice(3, -1)) || this.state.antenna });
    else if (command.startsWith('^AM') || command.startsWith('^AT') || command.startsWith('^AI')) this.setState({ atuInline: !command.includes('B') && !command.includes('0') });
    else if (command.startsWith('^FC')) this.setState({ fanMinimum: Number(command.slice(3, -1)), fanSpeed: Math.max(this.state.fanSpeed || 0, Number(command.slice(3, -1))) });
    else if (command === '^FT;') this.setState({ mode: 'OPER', swr: 1.08 });
    this.emit('command', command);
    return command;
  }

  queryFast() { for (const command of ['^WS;', '^PWR;', '^PWI;', '^TM;', '^VI;', '^FS;', '^FL;', '^OS;']) this.safeSend(command); }
  querySlow() { for (const command of ['^ON;', '^AN;', '^BN;', '^FR;', '^RV;', '^SN;', '^MA;', '^WL;', '^AM;', '^FC;']) this.safeSend(command); }
  safeSend(command) { try { this.send(command); } catch {} }
}

module.exports = { Amplifier, initialState };
