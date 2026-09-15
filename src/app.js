import { ListeningEngine } from './engine.js';
import { matchingPlan } from './loudness.js';
import { createDemo } from './demo.js';
import { shuffledOrder, summarizeVotes, makeReport } from './session.js';
import { messages } from './i18n.js';

const $ = id => document.getElementById(id);
const engine = new ListeningEngine();
let language = navigator.language.startsWith('zh') ? 'zh' : 'en';
try { const saved = localStorage.getItem('mio-fair-ears-language'); if (saved in messages) language = saved; } catch { /* storage is optional */ }
const t = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), messages[language][key] || key);
const state = { tracks: [null, null], loading: [false, false], plan: null, mode: 'open', order: [0, 1], active: 0, votes: [], round: 1, rounds: 5, heard: [0, 0], demo: false, session: null };
const ready = () => state.tracks.every(Boolean) && !state.loading.some(Boolean);
const time = seconds => { const safe = Math.max(0, seconds || 0); return `${Math.floor(safe / 60)}:${(safe % 60).toFixed(1).padStart(4, '0')}`; };
const signed = n => Math.abs(n) < 0.05 ? '0.0' : (n > 0 ? '+' : '−') + Math.abs(n).toFixed(1);
function showError(key) { $('error').textContent = key ? t(key) : ''; $('error').hidden = !key; }
function aria(id, label) { $(id).setAttribute('aria-label', label); }

function applyLanguage() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-placeholder]').forEach(el => { el.placeholder = t(el.dataset.placeholder); });
  for (const lang of ['en', 'zh']) $(`lang-${lang}`).setAttribute('aria-pressed', String(language === lang));
  for (const [id, key] of [['restart','restart'],['seek','seek'],['volume','volume'],['about-close','close']]) aria(id, t(key));
  for (let i = 0; i < 2; i++) { aria(`remove-${i}`, `${t('remove')} ${'AB'[i]}`); aria(`wave-${i}`, `${t('wave')} ${'AB'[i]}`); aria(`file-${i}`, `${t('drop')} ${'AB'[i]}`); }
  $('about-content').replaceChildren(...messages[language].about.map(([title, copy]) => {
    const section = document.createElement('section');
    const heading = document.createElement('h3'), p = document.createElement('p');
    heading.textContent = title; p.textContent = copy; section.append(heading, p); return section;
  }));
  render();
}

function drawWave(slot) {
  const canvas = $(`wave-${slot}`);
  if (state.mode === 'blind' || !state.tracks[slot]) return;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = bounds.width * ratio; canvas.height = bounds.height * ratio;
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
  const wave = state.tracks[slot].analysis.waveform;
  const peak = Math.max(...wave, 0.001);
  ctx.fillStyle = slot ? '#c4b5e9' : '#d8ed90';
  const bars = Math.floor(bounds.width / 3);
  for (let i = 0; i < bars; i++) {
    const height = Math.max(1, wave[Math.floor(i * wave.length / bars)] / peak * bounds.height * 0.85);
    ctx.globalAlpha = 0.55 + 0.4 * (height / bounds.height);
    ctx.fillRect(i * 3, (bounds.height - height) / 2, 1.8, height);
  }
}

function render() {
  const loaded = ready(), blind = state.mode === 'blind';
  document.body.classList.toggle('is-blind', blind);
  $('mode-badge').textContent = t(blind ? 'blind' : state.mode === 'results' ? 'revealed' : 'sighted');
  for (let i = 0; i < 2; i++) {
    const track = state.tracks[i];
    $(`drop-${i}`).hidden = !!track;
    $(`loaded-${i}`).hidden = !track;
    $(`remove-${i}`).hidden = !track || blind || state.loading[i];
    $(`choose-${i}`).disabled = state.loading[i] || blind;
    $(`file-${i}`).disabled = state.loading[i] || blind;
    $(`listen-${i}`).disabled = !loaded;
    $(`listen-${i}`).setAttribute('aria-pressed', String(state.active === i));
    $(`tag-${i}`).textContent = t(blind ? 'hiddenTag' : i ? 'versionB' : 'versionA');
    $(`format-${i}`).textContent = t(state.loading[i] ? 'loading' : blind ? 'mutedMeta' : 'formats');
    $(`wave-${i}`).hidden = blind;
    $(`blind-wave-${i}`).hidden = !blind;
    if (track) {
      $(`name-${i}`).textContent = blind ? t('hiddenName') : track.name;
      $(`meta-${i}`).textContent = blind ? t('hiddenMeta') : `${time(track.analysis.duration)} · ${t(track.originalChannels === 1 ? 'mono' : 'stereo')} · ${track.analysis.sampleRate / 1000} kHz`;
      drawWave(i);
    } else { $(`name-${i}`).textContent = ''; $(`meta-${i}`).textContent = ''; }
    $(`gain-${i}`).textContent = loaded && !blind ? signed(state.plan.adjustments[i]) : '—';
  }
  for (const id of ['play','restart','seek','loop']) $(id).disabled = !loaded;
  $('loop-start').disabled = $('loop-end').disabled = !loaded || !$('loop').checked || blind;
  $('loop').disabled = !loaded || blind;
  $('match').disabled = blind || state.loading.some(Boolean) || (loaded && !state.plan.available);
  $('demo').disabled = blind || state.loading.some(Boolean);
  $('rounds').disabled = blind;
  $('start-blind').disabled = !loaded;
  $('blind-setup').hidden = blind;
  $('blind-active').hidden = !blind;
  $('results').hidden = state.mode !== 'results';
  $('match-detail').textContent = blind ? t('hiddenGains') : !loaded ? t('ready') : !state.plan.available ? t('noLoudness') : state.plan.matched ? t('matching', { target: state.plan.target.toFixed(1), duration: time(state.plan.duration) }) : t('matchOff');
  if (loaded) {
    $('seek').max = state.plan.duration;
    $('duration').textContent = time(state.plan.duration);
  } else { $('duration').textContent = '0:00.0'; $('seek').value = '0'; }
  const notices = [];
  if (!blind) {
    if (state.demo) notices.push(t('demoNote'));
    if (loaded && Math.abs(state.tracks[0].analysis.duration - state.tracks[1].analysis.duration) > 0.05) notices.push(t('shared', { duration: time(state.plan.duration) }));
    if (loaded && state.tracks.some(track => track.analysis.peak >= 1)) notices.push(t('clipped'));
  }
  $('notice').textContent = notices.join(' '); $('notice').hidden = !notices.length;
  if (blind) {
    $('round-number').textContent = String(state.round).padStart(2, '0');
    $('round-total').textContent = t('roundOf', { total: state.rounds });
    $('round-progress').replaceChildren(...Array.from({ length: state.rounds }, (_, i) => { const bar = document.createElement('span'); bar.className = i < state.round - 1 ? 'done' : i === state.round - 1 ? 'current' : ''; return bar; }));
    updateVotes();
  }
  if (state.mode === 'results') renderResults();
  updateTransport();
}

function updateTransport() {
  $('play-symbol').textContent = engine.playing ? 'Ⅱ' : '▶';
  aria('play', t(engine.playing ? 'pause' : 'play'));
  const position = engine.getPosition();
  $('elapsed').textContent = time(position);
    if (!seeking) $('seek').value = position;
  $('seek').setAttribute('aria-valuetext', `${time(position)} / ${time(engine.duration)}`);
}
function updateVotes() {
  const canVote = state.heard.every(seconds => seconds >= 0.5);
  for (const id of ['vote-0','vote-1','vote-tie']) $(id).disabled = !canVote;
  $('vote-instruction').textContent = t(canVote ? 'voteReady' : 'hearBoth');
}
function resetSession() {
  engine.pause(); state.mode = 'open'; state.order = [0, 1]; state.active = 0; state.votes = []; state.session = null; state.heard = [0, 0];
  $('notes').value = ''; $('result-bars').replaceChildren();
  engine.select(0);
}
function configurePair() {
  if (!ready()) { state.plan = null; engine.pause(); engine.buffers = []; engine.position = 0; engine.duration = 0; return; }
  state.plan = matchingPlan(state.tracks.map(track => track.analysis), $('match').checked);
  if (!state.plan.available) $('match').checked = false;
  engine.configure(state.tracks.map(track => track.buffer), state.plan);
  engine.loop = $('loop').checked;
  $('loop-start').value = '0'; $('loop-end').value = state.plan.duration.toFixed(1);
  $('loop-start').max = $('loop-end').max = state.plan.duration;
}
function measure(buffer) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./analysis-worker.js', import.meta.url), { type: 'module' });
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('loadError')); }, 90000);
    worker.onmessage = ({ data }) => { clearTimeout(timeout); worker.terminate(); data.error ? reject(new Error('loadError')) : resolve(data.result); };
    worker.onerror = () => { clearTimeout(timeout); worker.terminate(); reject(new Error('loadError')); };
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => new Float32Array(buffer.getChannelData(channel)));
    worker.postMessage({ channels, sampleRate: buffer.sampleRate }, channels.map(c => c.buffer));
  });
}
function stereoBuffer(buffer) {
  if (buffer.numberOfChannels === 2) return buffer;
  const stereo = engine.ensureContext().createBuffer(2, buffer.length, buffer.sampleRate);
  for (let c = 0; c < 2; c++) stereo.copyToChannel(buffer.getChannelData(0), c);
  return stereo;
}
async function loadFile(slot, file) {
  if (!file || state.mode === 'blind' || state.loading[slot]) return;
  showError(null);
  if (file.size > 80 * 1024 * 1024) { showError('fileTooLarge'); return; }
  resetSession(); state.loading[slot] = true; state.demo = false; render();
  try {
    let decoded;
    try { decoded = await engine.decode(await file.arrayBuffer()); } catch { throw new Error('decodeError'); }
    if (decoded.numberOfChannels < 1 || decoded.numberOfChannels > 2) throw new Error('channelLimit');
    if (decoded.duration < 0.4 || decoded.duration > 300) throw new Error('durationLimit');
    const originalChannels = decoded.numberOfChannels;
    const buffer = stereoBuffer(decoded);
    decoded = null;
    const analysis = await measure(buffer);
    state.tracks[slot] = { name: file.name, originalChannels, buffer, analysis };
  } catch (error) { showError(error.message in messages.en ? error.message : 'loadError'); }
  finally { state.loading[slot] = false; $(`file-${slot}`).value = ''; configurePair(); render(); }
}
async function loadDemo() {
  if (state.mode === 'blind' || state.loading.some(Boolean)) return;
  resetSession(); showError(null); state.loading = [true, true]; render();
  try {
    const context = engine.ensureContext();
    const buffers = createDemo(context);
    const analyses = await Promise.all(buffers.map(measure));
    state.tracks = buffers.map((buffer, i) => ({ name: i ? 'Mio Sketch — Air.wav' : 'Mio Sketch — Warm.wav', originalChannels: 2, buffer, analysis: analyses[i] }));
    state.demo = true;
  } catch { showError('loadError'); }
  finally { state.loading = [false, false]; configurePair(); render(); }
}
function select(slot) {
  if (!ready()) return;
  state.active = slot; engine.select(state.mode === 'blind' ? state.order[slot] : slot);
  for (let i = 0; i < 2; i++) $(`listen-${i}`).setAttribute('aria-pressed', String(slot === i));
}
async function togglePlay() {
  if (!ready()) return;
  showError(null);
  try {
    if (engine.playing) engine.pause();
    else {
      if (state.mode !== 'blind' && await updateLoop() === false) return;
      await engine.play();
    }
  } catch { showError('audioError'); }
  updateTransport();
}
function startRound() {
  engine.pause(); engine.position = engine.loop ? engine.loopStart : 0;
  state.order = shuffledOrder(); state.active = 0; state.heard = [0, 0]; engine.select(state.order[0]); render();
}
async function startBlind() {
  if (!ready() || state.mode === 'blind') return;
  if (await updateLoop() === false) return;
  resetSession(); showError(null); state.mode = 'blind'; state.rounds = Number($('rounds').value); state.round = 1;
  state.session = { plan: structuredClone(state.plan), loop: { enabled: engine.loop, startSeconds: engine.loopStart, endSeconds: engine.loopEnd }, startedAt: new Date().toISOString() };
  startRound();
  $('play').focus({ preventScroll: true });
}
function vote(choice) {
  if (state.mode !== 'blind' || state.heard.some(seconds => seconds < 0.5)) return;
    state.votes.push({ round: state.round, order: [...state.order], choice, secondsListened: state.heard.map(s => Number(s.toFixed(2))), masterVolume: engine.volume, recordedAt: new Date().toISOString() });
  if (state.round >= state.rounds) reveal();
  else { state.round++; startRound(); $('play').focus({ preventScroll: true }); }
}
function reveal() {
  if (state.mode !== 'blind') return;
  engine.pause(); state.session.endingVolume = engine.volume; state.mode = 'results'; state.active = 0; state.order = [0, 1]; engine.select(0); render();
  $('results').focus({ preventScroll: true }); $('results').scrollIntoView({ block:'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
function renderResults() {
  const result = summarizeVotes(state.votes);
  $('rounds-complete').textContent = language === 'en' && state.votes.length === 1 ? '1 ROUND RECORDED' : t('complete', { n: state.votes.length });
  $('result-bars').replaceChildren(...state.tracks.map((track, i) => {
    const row = document.createElement('div'); row.className = 'result-item';
    const label = document.createElement('div'); label.className = 'result-label';
    const name = document.createElement('span'), count = document.createElement('strong');
    name.textContent = track.name; count.textContent = language === 'en' && result.files[i] === 1 ? '1 vote' : t('votes', { n: result.files[i] }); label.append(name, count);
    const bar = document.createElement('div'); bar.className = 'result-track';
    const fill = document.createElement('div'); fill.className = 'result-fill'; fill.style.width = `${result.files[i] / Math.max(1, state.votes.length) * 100}%`; bar.append(fill);
    row.append(label, bar); return row;
  }));
  $('ties').textContent = state.votes.length ? t('ties', { n: result.ties }) : t('noVotes');
}
function exportResults() {
  if (state.mode !== 'results' || !state.session) return;
  const report = makeReport({ tracks: state.tracks, plan: state.session.plan, votes: state.votes, rounds: state.rounds, loop: state.session.loop, notes: $('notes').value, volume: state.session.endingVolume });
  const blob = new Blob([JSON.stringify(report, null, 2) + '\n'], { type:'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `mio-fair-ears-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function updateLoop() {
  if (!ready() || state.mode === 'blind') return;
  const enabled = $('loop').checked;
  const start = Number($('loop-start').value), enteredEnd = Number($('loop-end').value);
  const end = Math.min(enteredEnd, engine.duration);
  if (enabled && (!$('loop-start').value || !$('loop-end').value || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > engine.duration || enteredEnd > engine.duration + 0.05 || end - start < 0.4 - 1e-6)) {
    showError('loopError'); $('loop').checked = engine.loop; $('loop-start').value = engine.loopStart.toFixed(1); $('loop-end').value = engine.loopEnd.toFixed(1); render(); return false;
  }
  showError(null);
  try { await engine.setLoop(enabled, enabled ? start : 0, enabled ? end : engine.duration); } catch { showError('audioError'); }
  render();
}

for (let i = 0; i < 2; i++) {
  $(`choose-${i}`).addEventListener('click', () => $(`file-${i}`).click());
  $(`file-${i}`).addEventListener('change', event => loadFile(i, event.target.files[0]));
  $(`listen-${i}`).addEventListener('click', () => select(i));
  $(`remove-${i}`).addEventListener('click', () => { if (state.mode === 'blind') return; resetSession(); state.tracks[i] = null; state.demo = false; configurePair(); showError(null); render(); });
  const deck = $(`deck-${i}`);
  deck.addEventListener('dragover', event => { event.preventDefault(); if (state.mode !== 'blind' && !state.loading[i]) deck.classList.add('is-dragover'); });
  deck.addEventListener('dragleave', () => deck.classList.remove('is-dragover'));
  deck.addEventListener('drop', event => { event.preventDefault(); deck.classList.remove('is-dragover'); if (state.mode === 'blind') return; if (event.dataTransfer.files.length !== 1) { showError('oneFile'); return; } loadFile(i, event.dataTransfer.files[0]); });
}
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());
$('demo').addEventListener('click', loadDemo);
$('play').addEventListener('click', togglePlay);
$('restart').addEventListener('click', () => engine.seek(engine.loop ? engine.loopStart : 0).catch(() => showError('audioError')));
let seeking = false;
$('seek').addEventListener('pointerdown', () => { seeking = true; });
window.addEventListener('pointerup', () => { seeking = false; });
$('seek').addEventListener('input', event => engine.seek(Number(event.target.value)).catch(() => showError('audioError')));
$('volume').addEventListener('input', event => engine.setVolume(Number(event.target.value) / 100));
$('match').addEventListener('change', () => { if (!ready() || state.mode === 'blind') return; state.plan = matchingPlan(state.tracks.map(track => track.analysis), $('match').checked); engine.setMatching(state.plan); render(); });
for (const id of ['loop','loop-start','loop-end']) $(id).addEventListener('change', updateLoop);
$('start-blind').addEventListener('click', startBlind);
$('vote-0').addEventListener('click', () => vote(0)); $('vote-1').addEventListener('click', () => vote(1)); $('vote-tie').addEventListener('click', () => vote(null));
$('end-blind').addEventListener('click', reveal);
$('again').addEventListener('click', startBlind);
$('export').addEventListener('click', exportResults);
for (const id of ['about-open','method-open']) $(id).addEventListener('click', () => $('about').showModal());
for (const id of ['about-close','about-done']) $(id).addEventListener('click', () => $('about').close());
for (const lang of ['en','zh']) $(`lang-${lang}`).addEventListener('click', () => { language = lang; try { localStorage.setItem('mio-fair-ears-language', lang); } catch { /* optional */ } showError(null); applyLanguage(); });
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || $('about').open || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON') { event.preventDefault(); togglePlay(); }
  else if (event.code === 'Digit1' || event.code === 'Numpad1') { event.preventDefault(); select(0); }
  else if (event.code === 'Digit2' || event.code === 'Numpad2') { event.preventDefault(); select(1); }
  else if (ready() && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) { event.preventDefault(); engine.seek(engine.getPosition() + (event.code === 'ArrowLeft' ? -5 : 5)).catch(() => showError('audioError')); }
});
let lastFrame = performance.now();
function animate(now) {
  engine.tick();
  if (state.mode === 'blind' && engine.playing && engine.volume > 0 && engine.context.currentTime > engine.startedAt && document.visibilityState === 'visible') {
    state.heard[state.active] += Math.min(0.1, (now - lastFrame) / 1000); updateVotes();
  }
  lastFrame = now; updateTransport(); requestAnimationFrame(animate);
}
new ResizeObserver(() => { drawWave(0); drawWave(1); }).observe($('deck-0'));
window.addEventListener('pagehide', () => engine.pause());
applyLanguage();
if (!window.AudioContext) { $('demo').disabled = true; showError('noAudioAPI'); }
requestAnimationFrame(animate);
