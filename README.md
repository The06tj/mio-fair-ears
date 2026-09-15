# Mio Fair Ears

**Listen without the labels.**

A small listening room for comparing two audio files: match their loudness, switch at the same playback position, and run a few blind preference rounds before revealing their names.

**[Open Mio Fair Ears](https://the06tj.github.io/mio-fair-ears/)** · [中文说明](README.zh-CN.md) · [How the audio works](docs/METHODOLOGY.md)

No account. No audio uploads. No runtime dependencies. MIT licensed.

## Try it

1. Open the app and choose **Try a demo pair**, or drop one audio file into each slot.
2. Press play. Switch with **1 / 2** or the A / B buttons. Both versions keep playing on the same audio clock.
3. Leave **Match loudness** on to reduce level bias. Optionally set a loop section in seconds.
4. Start blind listening. Each round hides the names, waveforms and gain readouts, and randomly reassigns A / B.
5. Listen to both, choose your preference (or no preference), then see the results. Export the settings, votes and notes as JSON.

The built-in demo is an original, locally synthesized musical sketch. It does not download samples or play automatically.

## Features

- Shared-clock playback and 12 ms constant-sum A / B switching.
- K-weighted, gated integrated LUFS matching over the shared duration.
- Attenuation-only matching; no compressor, limiter or EQ in playback.
- Manual section looping, seeking, restart and a common volume control.
- 3, 5 or 8 randomized preference rounds; early reveal retains completed votes.
- English / 中文, keyboard controls, responsive layout and reduced-motion support.
- Local JSON export with original file identities, per-round assignments, votes and notes.

## What it measures

This is a **preference listening tool**. It does not prove that two files are distinguishable, declare an objectively better mix, or calculate statistical significance. It is not an ABX identification test or a certified meter.

Use different versions of the **same, already aligned passage**. Mio Fair Ears does not align recordings, compensate for codec delay or trim leading silence. Different durations use the shorter common window. Selecting a loop does not change the loudness measurement window.

The [methodology](docs/METHODOLOGY.md) describes matching, mono handling, fade behavior and limitations.

## Local development

Node.js 22 or newer is enough. There is nothing to install.

```sh
git clone https://github.com/The06tj/mio-fair-ears.git
cd mio-fair-ears
node scripts/serve.mjs
```

Open `http://127.0.0.1:4173`. You can also serve the repository with another static HTTP server. Use HTTP/HTTPS rather than opening `index.html` with `file://`, because ES modules and workers need a web origin.

```sh
# Core DSP, scheduling and result-mapping checks
node --test tests/*.test.js

# Optional clean static bundle
node scripts/build.mjs
node scripts/serve.mjs --dist
```

After starting the source server, open `/tests/browser.html` to run five real `OfflineAudioContext` output checks without playing sound through speakers. See [VALIDATION.md](docs/VALIDATION.md) for the recorded checks and independent meter comparison.

## Privacy and limits

Audio is decoded and analyzed in the current browser tab. There are no analytics, external fonts, API calls or file uploads. A restrictive Content Security Policy disables application network connections. The website host still receives ordinary requests for the app’s public static files.

Only language preference is stored in `localStorage`. Audio and votes disappear on refresh. An exported report includes **filenames and your notes**, so review it before sharing.

- Mono or stereo; mono is duplicated into stereo before measurement and playback.
- 0.4 seconds–5 minutes; up to 80 MB per file. Decoded audio uses more memory than compressed files.
- WAV is the most predictable starting format. MP3, FLAC, M4A, AIFF and other formats depend on the browser’s decoder.
- Browsers resample files to the audio context’s sample rate (48 kHz is requested). Displayed rates describe decoded playback, not necessarily the source header.
- Common sample-peak headroom does not guarantee true-peak safety or repair clipping already in a file.

## Contributing

Small, reproducible improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Please preserve local audio processing and use synthetic or appropriately licensed test material.

## Acknowledgments

The loudness implementation is based on [ITU-R BS.1770](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I) and the De Man filter parameterization documented by [pyloudnorm](https://github.com/csteinmetz1/pyloudnorm). Independent validation uses pyloudnorm; it is not shipped with the app.

Source code and the original synthetic demo are provided under the [MIT License](LICENSE).
