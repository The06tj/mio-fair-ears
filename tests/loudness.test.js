import test from 'node:test';
import assert from 'node:assert/strict';
import { kWeighting, analyzePCM, measureShared, matchingPlan, gatedLoudness } from '../src/loudness.js';
const rate = 48000;
const sine = (amplitude = 1, duration = 2, frequency = 997, sampleRate = rate) => Float32Array.from({ length: Math.round(duration * sampleRate) }, (_, i) => amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate));
const near = (a, b, tolerance = 0.02) => assert.ok(Math.abs(a - b) < tolerance, `${a} vs ${b}`);

test('48 kHz coefficients reproduce ITU-R BS.1770 tables', () => {
  const expected = [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585], [1, -2, 1, -1.99004745483398, 0.99007225036621]];
  kWeighting(rate).forEach((coeffs, i) => coeffs.forEach((value, j) => near(value, expected[i][j], 1e-10)));
});
test('ITU 997 Hz mono reference reads -3.01 LKFS at full scale', () => near(analyzePCM([sine()], rate).lufs, -3.01));
test('a 6 dB gain change creates a 6 dB loudness change', () => {
  const a = analyzePCM([sine(0.1)], rate), b = analyzePCM([sine(0.1 * 10 ** (6 / 20))], rate);
  near(b.lufs - a.lufs, 6, 0.00001);
  const plan = matchingPlan([a, b]);
  near(plan.adjustments[1], -6, 0.00001);
  near(plan.lufs[0] + plan.adjustments[0], plan.lufs[1] + plan.adjustments[1], 1e-10);
  assert.ok(plan.adjustments.every(x => x <= 0));
});
test('stereo energy sums and mono playback upmix is accounted for', () => {
  const channel = sine(0.1);
  const mono = analyzePCM([channel], rate), dualMono = analyzePCM([channel, channel], rate);
  near(dualMono.lufs - mono.lufs, 10 * Math.log10(2), 1e-10);
});
test('silence, sub-gate signals and short signals have no loudness reading', () => {
  for (const signal of [new Float32Array(rate), sine(1e-6), sine(0.1, 0.3)]) {
    assert.equal(analyzePCM([signal], rate).lufs, -Infinity);
  }
  const plan = matchingPlan([analyzePCM([new Float32Array(rate)], rate), analyzePCM([sine(0.1)], rate)]);
  assert.equal(plan.available, false); assert.equal(plan.matched, false); assert.deepEqual(plan.adjustments, [0, 0]);
});
test('absolute and relative gates exclude low-energy blocks', () => {
  const energy = lufs => 10 ** ((lufs + 0.691) / 10);
  near(gatedLoudness([energy(-20), energy(-20), energy(-50), energy(-90)]), -20, 1e-10);
});
test('long tails do not affect shared-duration matching', () => {
  const short = sine(0.1, 1), long = sine(0.7, 3); long.set(short);
  const a = analyzePCM([short], rate), b = analyzePCM([long], rate);
  const plan = matchingPlan([a, b]);
  near(plan.duration, 1, 1e-10); near(plan.lufs[0], plan.lufs[1], 1e-10);
  assert.ok(b.lufs > measureShared(b, 1) + 10);
});
test('unmatched playback keeps the relative level and uses common sample-peak attenuation', () => {
  const a = analyzePCM([sine(1.5)], rate), b = analyzePCM([sine(0.1)], rate);
  const plan = matchingPlan([a, b], false);
  assert.deepEqual(plan.adjustments, [0, 0]); assert.ok(plan.headroom < -4.5);
  near(20 * Math.log10(a.peak) + plan.headroom, -1, 1e-10);
});
test('invalid PCM is rejected', () => {
  assert.throws(() => analyzePCM([Float32Array.of(NaN)], rate));
  assert.throws(() => analyzePCM([sine(), sine(), sine()], rate));
  assert.throws(() => analyzePCM([], rate));
});
test('997 Hz reference remains close at 44.1, 48 and 96 kHz', () => {
  for (const sr of [44100, 48000, 96000]) near(analyzePCM([sine(0.1, 2, 997, sr)], sr).lufs, -23.01, 0.05);
});
