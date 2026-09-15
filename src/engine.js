import { dbToGain } from './loudness.js';

export class ListeningEngine {
  constructor() {
    this.context = null;
    this.buffers = [];
    this.sources = [];
    this.gains = [];
    this.adjustments = [0, 0];
    this.headroom = 0;
    this.active = 0;
    this.volume = 0.5;
    this.playing = false;
    this.position = 0;
    this.duration = 0;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.generation = 0;
  }
  ensureContext() {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: 48000 });
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }
  async decode(bytes) { return this.ensureContext().decodeAudioData(bytes); }
  configure(buffers, plan) {
    this.pause();
    this.buffers = buffers;
    this.duration = plan.duration;
    this.position = 0;
    this.loopStart = 0;
    this.loopEnd = this.duration;
    this.adjustments = plan.adjustments;
    this.headroom = plan.headroom;
  }
  getPosition() {
    if (!this.playing) return this.position;
    const elapsed = Math.max(0, this.context.currentTime - this.startedAt);
    let pos = this.startOffset + elapsed;
    if (this.loop && pos >= this.loopEnd) {
      pos = this.loopStart + (pos - this.loopEnd) % (this.loopEnd - this.loopStart);
    }
    return Math.min(this.duration, pos);
  }
  async play() {
    if (this.playing || this.buffers.length !== 2) return;
    const generation = ++this.generation;
    const context = this.ensureContext();
    await context.resume();
    if (this.playing || generation !== this.generation || this.buffers.length !== 2) return;
    if (this.position >= (this.loop ? this.loopEnd : this.duration) - 0.005) this.position = this.loop ? this.loopStart : 0;
    if (this.loop && this.position < this.loopStart) this.position = this.loopStart;
    const when = context.currentTime + 0.025;
    this.startedAt = when;
    this.startOffset = this.position;
    this.sources = this.buffers.map((buffer, i) => {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = this.loop;
      source.loopStart = this.loopStart;
      source.loopEnd = this.loopEnd;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(this.targetGain(i), when + 0.012);
      source.connect(gain).connect(this.master);
      this.gains[i] = gain;
      source.start(when, this.position);
      if (!this.loop) source.stop(when + this.duration - this.position);
      return source;
    });
    this.playing = true;
  }
  pause() {
    this.generation++;
    if (!this.playing) return;
    this.position = this.getPosition();
    const now = this.context.currentTime;
    this.gains.forEach(g => this.ramp(g.gain, 0, now));
    this.sources.forEach(source => {
      try { source.stop(now + 0.016); } catch { /* already ended */ }
      source.onended = () => source.disconnect();
    });
    const oldGains = this.gains;
    setTimeout(() => oldGains.forEach(g => g.disconnect()), 50);
    this.sources = [];
    this.gains = [];
    this.playing = false;
  }
  tick() {
    if (this.playing && this.context.state !== 'running') this.pause();
    if (this.playing && !this.loop && this.getPosition() >= this.duration) {
      this.pause();
      this.position = this.duration;
    }
  }
  async seek(position) {
    const resume = this.playing;
    this.pause();
    this.position = Math.max(this.loop ? this.loopStart : 0, Math.min(this.loop ? this.loopEnd : this.duration, position));
    if (resume) await this.play();
  }
  async setLoop(enabled, start, end) {
    const resume = this.playing;
    this.pause();
    this.loop = enabled;
    this.loopStart = Math.max(0, start);
    this.loopEnd = Math.min(this.duration, end);
    if (enabled && (this.position < start || this.position >= end)) this.position = start;
    if (resume) await this.play();
  }
  ramp(param, value, now) {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { const held = param.value; param.cancelScheduledValues(now); param.setValueAtTime(held, now); }
    // Constant-sum crossfade avoids a gain bump on correlated material.
    param.linearRampToValueAtTime(value, now + 0.012);
  }
  targetGain(i) { return i === this.active ? dbToGain(this.adjustments[i] + this.headroom) : 0; }
  select(index) {
    this.active = index;
    if (this.playing) this.gains.forEach((g, i) => this.ramp(g.gain, this.targetGain(i), this.context.currentTime));
  }
  setMatching(plan) {
    this.adjustments = plan.adjustments;
    this.headroom = plan.headroom;
    this.select(this.active);
  }
  setVolume(value) {
    this.volume = value;
    if (this.context) this.ramp(this.master.gain, value, this.context.currentTime);
  }
}
