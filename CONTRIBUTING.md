# Contributing

Thanks for helping make listening a little clearer.

For a bug report, include the browser/OS, steps to reproduce, expected behavior and actual behavior. Mention the file format, duration and channel count when relevant. Use a synthetic reproduction or a file you are allowed to share. Do not attach private audio or unreviewed session exports.

For code changes:

1. Keep audio processing local. Do not add tracking or a backend upload path.
2. Update both English and Chinese interface strings.
3. Run `node --test tests/*.test.js` and `node scripts/build.mjs`.
4. For audio engine changes, run `/tests/browser.html` and check the real listening flow.
5. For DSP changes, compare against independent reference values and document the scope of validation.

The app intentionally uses browser APIs and small ES modules. Discuss large dependencies or changes to the listening method before implementing them.
