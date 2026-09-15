# Audio methodology — v0.1

## Playback

Two `AudioBufferSourceNode`s start at the same scheduled audio-context time and content offset. They keep running together. Selection changes their gains through a 12 ms linear, constant-sum fade. This avoids the level bump an equal-power fade would introduce for identical, correlated signals; unrelated or phase-inverted material can still dip during the brief transition.

Playback and measurement use the shared duration, starting at zero. Different recordings are not automatically aligned. Decoder padding, silence, phase, processing latency and different edits can all affect comparisons. Both source nodes receive the same loop boundaries. Loop boundaries are hard wraps; choose quiet boundaries to reduce clicks.

The requested decode/playback rate is 48 kHz. Browsers may resample source material. The meter computes coefficients from the actual decoded rate. Mono input is copied into identical left and right channels before analysis and playback, so its measured channel configuration matches what is played.

## Matching

The meter implements K-weighting, 400 ms energy blocks at 100 ms steps, an absolute −70 LUFS gate and a relative gate 10 LU below the absolute-gated mean. Incomplete end blocks are excluded. Channel energy is summed for stereo. Filter coefficients use the De Man parameterization and reproduce the published 48 kHz coefficient tables.

The shared-duration LUFS values are `L_A` and `L_B`. The target and adjustments are:

```text
target = min(-18, L_A, L_B)
gain_A_dB = target - L_A
gain_B_dB = target - L_B
```

Neither file is boosted. If either file has no valid gated reading, matching is unavailable. The loop selection does not change the measurement window; this avoids comparing levels measured over different sections without explicitly saying so.

In either mode, a common gain reduction keeps the larger adjusted **sample peak** at or below −1 dBFS before the master-volume control. No true-peak estimation or limiting is implemented. It cannot undo existing clipping, predict every intersample overshoot, or control downstream hardware volume.

The matching gain is constant during playback; the K-weighting filters are used only for measurement. They do not EQ the sound you hear. Loudness is an estimate of perception and depends on the material and listener.

## Blind preference rounds

Each round independently randomizes the assignment of the original files to visible A/B labels using `crypto.getRandomValues`. Independent randomization can repeat an order. Original names, waveforms, durations per file and gains are hidden; both cards show identical identity placeholders. File changes, loop settings and matching are locked until reveal.

Each side must play for at least 0.5 seconds with nonzero master volume while the tab is visible before voting is enabled. This is a UI guard, not evidence that someone listened attentively. Master volume can be adjusted for comfort; each vote records the master setting at vote time.

Choices are A, B or no preference. A choice is resolved through that round's assignment. Early reveal includes only completed rounds. Results and exports are generated locally. The report freezes matching and loop settings from session start and volume at reveal; subsequent open-listening changes do not rewrite them.

These are descriptive preference counts from one person, not an ABX identification task, an audibility study, a quality ranking or a significance test. No p-values or accuracy scores are presented.

## References

- [ITU-R BS.1770-5, Annex 1](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I): loudness algorithm and coefficient tables.
- [pyloudnorm](https://github.com/csteinmetz1/pyloudnorm): De Man filter parameterization and independent reference meter. Not a runtime dependency.
- [Web Audio API specification](https://webaudio.github.io/web-audio-api/): scheduled buffer sources, looping and gain automation.

See [VALIDATION.md](VALIDATION.md) for the tested scope. Passing these checks is not certification against the complete broadcast-meter compliance suite.
