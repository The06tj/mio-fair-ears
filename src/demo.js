// An original, deterministic 12-second synth sketch. No samples or downloads.
export function createDemo(context) {
  const rate = context.sampleRate, duration = 12;
  const buffers = [context.createBuffer(2, rate * duration, rate), context.createBuffer(2, rate * duration, rate)];
  const notes = [220, 261.6256, 329.6276, 391.9954, 329.6276, 261.6256, 293.6648, 246.9417];
  let seed = 73421;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 * 2 - 1; };
  const a = [buffers[0].getChannelData(0), buffers[0].getChannelData(1)];
  const b = [buffers[1].getChannelData(0), buffers[1].getChannelData(1)];
  for (let i = 0; i < rate * duration; i++) {
    const t = i / rate, step = Math.floor(t / 0.375), local = t % 0.375, beat = t % 0.75;
    const f = notes[step % notes.length];
    const env = (1 - Math.exp(-local * 180)) * Math.exp(-local * 9);
    const fade = Math.min(1, t * 50, (duration - t) * 10);
    const kick = Math.sin(2 * Math.PI * (49 * beat + 48 * (1 - Math.exp(-beat * 28)) / 28)) * Math.exp(-beat * 14) * 0.22;
    const hat = random() * Math.exp(-local * 90) * 0.035;
    for (let c = 0; c < 2; c++) {
      const phase = 2 * Math.PI * f * t;
      const pluck = Math.sin(phase) * 0.15 + Math.sin(phase * 2 + c * 0.16) * 0.048;
      const airy = Math.sin(phase * 4 + c * 0.3) * 0.035 * env;
      const pad = Math.sin(2 * Math.PI * (110 + c * 0.25) * t) * 0.025;
      a[c][i] = (pluck * env + kick + hat + pad) * fade;
      b[c][i] = ((pluck * env + kick + hat + pad) * 1.15 + airy) * fade;
    }
  }
  return buffers;
}
