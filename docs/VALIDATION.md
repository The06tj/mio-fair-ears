# Validation — v0.1.0

Recorded 2026-09-15 (UTC), on macOS. This records the scope of the checks, not broadcast-meter certification.

## Core checks

`node --test tests/*.test.js`: **16 passed** on Node.js 24.19.0.

The checks cover the published 48 kHz K-weighting coefficients, 997 Hz reference level, gain linearity, stereo energy summation, gating, silence, malformed PCM, shared-duration matching, sample-peak headroom, synchronized source scheduling, cancellation during audio activation, loop/seek synchronization, randomized assignment and report mapping.

## Independent loudness comparison

Six deterministic, stereo, four-second PCM fixtures were compared against **pyloudnorm 0.2.0 with DeMan filters**. The fixtures combine multiple sine waves and seeded noise; half add silence and a quiet section to exercise gating. Rates: 44.1, 48 and 96 kHz.

Maximum absolute difference: **less than 0.000001 LU** (acceptance threshold 0.01 LU). See [reference-results.json](reference-results.json) for every value. These fixtures are narrower than the full EBU / ITU compliance test suite.

## Real Web Audio output

`/tests/browser.html` rendered audio through the actual playback engine with Chromium's `OfflineAudioContext`, without speaker output. **5 checks passed**:

1. Identical correlated versions remain at the same output level through a switch.
2. A file with twice the amplitude matches after −6.0206 dB compensation.
3. Both versions respect the same nonzero source offset.
4. Both versions loop the same region without drift.
5. Non-loop playback produces silence after the shared end time.

The maximum sample error in the first four checks was below `3e-9` for these controlled fixtures.

## Browser interaction checks

The Chrome desktop and Codex in-app Chromium flows were exercised with the demo and generated WAV fixtures. File selection was tested in the in-app browser because the Chrome automation extension's file-upload permission was unavailable.

Verified behavior includes loading and measuring the original demo, importing 44.1 kHz mono/stereo WAVs, mono-to-stereo playback preparation, using the shorter duration, gain compensation, starting at a user-entered loop boundary, synchronized switching, identity hiding, locked settings, requiring both sides before voting, per-round progress, automatic reveal after three rounds, abstention, early reveal, language switching and JSON export. Corrupt-file errors and silent-file matching unavailability were also checked. At 390 CSS pixels, document scroll width and viewport width both measured 390 pixels (no horizontal overflow).

Safari and Firefox have not been exercised in this release. Decoder support and memory limits vary by browser. The tests do not measure hardware output latency, true peaks, audibility, listener attention or subjective loudness equivalence.
