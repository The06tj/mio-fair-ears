// BS.1770 K-weighting. Filter equations follow the De Man parameterization.
// See docs/METHODOLOGY.md for sources, verification, and limitations.
export const dbToGain = db => 10 ** (db / 20);
export const gainToDb = gain => gain > 0 ? 20 * Math.log10(gain) : -Infinity;
const energyToLufs = energy => energy > 0 ? -0.691 + 10 * Math.log10(energy) : -Infinity;

export function kWeighting(sampleRate) {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('Invalid sample rate');
  const k = Math.tan(Math.PI * 1681.974450955533 / sampleRate);
  const q = 0.7071752369554196;
  const vh = 10 ** (3.999843853973347 / 20);
  const vb = vh ** 0.4996667741545416;
  const d = 1 + k / q + k * k;
  const h = Math.tan(Math.PI * 38.13547087602444 / sampleRate);
  const hq = 0.5003270373238773;
  const hd = 1 + h / hq + h * h;
  return [
    [(vh + vb * k / q + k * k) / d, 2 * (k * k - vh) / d, (vh - vb * k / q + k * k) / d, 2 * (k * k - 1) / d, (1 - k / q + k * k) / d],
    [1, -2, 1, 2 * (h * h - 1) / hd, (1 - h / hq + h * h) / hd],
  ];
}

function biquad(coeffs) {
  const [b0, b1, b2, a1, a2] = coeffs;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

export function gatedLoudness(blocks) {
  const absolute = blocks.filter(x => energyToLufs(x) > -70);
  if (!absolute.length) return -Infinity;
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  const threshold = energyToLufs(mean(absolute)) - 10;
  const gated = absolute.filter(x => energyToLufs(x) > threshold);
  return gated.length ? energyToLufs(mean(gated)) : -Infinity;
}

// Adjacent 100 ms energy bins produce exact 400 ms / 75%-overlap blocks.
export function measureShared(analysis, duration = analysis.duration) {
  const bins = Math.min(analysis.energies.length, Math.floor((duration * analysis.sampleRate + 1e-6) / analysis.hop));
  const blocks = [];
  for (let i = 0; i + 3 < bins; i++) {
    blocks.push((analysis.energies[i] + analysis.energies[i + 1] + analysis.energies[i + 2] + analysis.energies[i + 3]) / 4);
  }
  return gatedLoudness(blocks);
}

export function analyzePCM(channels, sampleRate) {
  if (!channels.length || channels.length > 2) throw new Error('Mono and stereo only');
  const n = channels[0].length;
  if (!n || channels.some(c => c.length !== n)) throw new Error('Invalid PCM');
  const filters = kWeighting(sampleRate);
  const hop = Math.round(sampleRate * 0.1);
  const bins = Math.floor(n / hop);
  const energies = new Float64Array(bins);
  const waveform = new Float32Array(640);
  let peak = 0;
  for (const channel of channels) {
    const shelf = biquad(filters[0]), highpass = biquad(filters[1]);
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const x = channel[i];
      if (!Number.isFinite(x)) throw new Error('Non-finite audio sample');
      const a = Math.abs(x);
      if (a > peak) peak = a;
      const w = Math.min(639, Math.floor(i * 640 / n));
      if (a > waveform[w]) waveform[w] = a;
      const y = highpass(shelf(x));
      energy += y * y;
      if ((i + 1) % hop === 0) {
        energies[Math.floor(i / hop)] += energy / hop;
        energy = 0;
      }
    }
  }
  const result = { energies, waveform, peak, sampleRate, hop, duration: n / sampleRate, channels: channels.length };
  return { ...result, lufs: measureShared(result) };
}

export function matchingPlan(analyses, enabled = true) {
  const duration = Math.min(...analyses.map(a => a.duration));
  const lufs = analyses.map(a => measureShared(a, duration));
  const available = lufs.every(Number.isFinite);
  const target = available ? Math.min(-18, ...lufs) : null;
  const adjustments = enabled && available ? lufs.map(l => Math.min(0, target - l)) : [0, 0];
  // Common sample-peak headroom preserves the level relationship in either mode.
  const highest = Math.max(...analyses.map((a, i) => gainToDb(a.peak) + adjustments[i]));
  const headroom = Math.min(0, -1 - highest);
  return { duration, lufs, available, matched: enabled && available, target, adjustments, headroom: Number.isFinite(headroom) ? headroom : 0 };
}
