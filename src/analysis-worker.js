import { analyzePCM } from './loudness.js';
self.onmessage = ({ data }) => {
  try {
    const result = analyzePCM(data.channels, data.sampleRate);
    self.postMessage({ result }, [result.energies.buffer, result.waveform.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
