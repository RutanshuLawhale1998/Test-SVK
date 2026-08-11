import { ART, SHELL } from './art.js';

/* ============================ helpers ============================ */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
/* h:mm:ss once past the hour — some of the shelf tapes are full jukeboxes */
const mmss = s => {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const r = Math.floor(s % 60);
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
};

let toastT;
function toast(msg){
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2400);
}
function status(msg, kind){
  const el = $('#status');
  el.textContent = msg;
  el.classList.toggle('err', kind === 'err');
  el.classList.toggle('warn', kind === 'warn');
}

/* ============================ station clock ============================
   The corner keeps IST regardless of where you are reading this from. */
const istClock = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
});
function paintClock(){
  $('#clock').textContent = istClock.format(new Date()).toLowerCase() + ' ist';
}
paintClock();
setInterval(paintClock, 10000);

/* ============================ listener count ============================ */
async function pollStation(){
  try {
    const r = await fetch('/api/station');
    const s = await r.json();
    $('#listeners').textContent = s.listeners;
    $('#srcMode').textContent = s.mode === 'live'
      ? 'built live from YouTube'
      : 'from the shelf · hand-checked';
  } catch {
    $('#listeners').textContent = '—';
    $('#srcMode').textContent = 'station offline';
  }
}
pollStation();
setInterval(pollStation, 60000);

/* ============================ rotations ============================ */
let ROTS = [], reel = [], idx = 0, current = null;
const rec = $('#rec');

async function loadRotations(){
  try {
    const r = await fetch('/api/rotations');
    ROTS = await r.json();
  } catch {
    $('#rotCount').textContent = 'station offline';
    status('Cannot reach the station. Is the server running?', 'err');
    return;
  }
  renderRotations();
  $('#rotCount').textContent = `${ROTS.length} tapes on the shelf`;
}

function renderRotations(){
  $('#rots').innerHTML = ROTS.map((r, i) => `
    <button class="rot ${current === i ? 'on' : ''}" data-rot="${i}" type="button">
      <span class="sleeve"><svg viewBox="0 0 300 300" aria-hidden="true">${ART[r.art] || ''}</svg></span>
      <span class="rmeta">
        <h3>${r.title}</h3>
        <span class="rdev">${r.dev}</span>
        <span class="rblurb">${r.blurb}</span>
        <span class="rfoot">
          <span>${r.hours}</span>
          <span>${r.trackCount} tracks</span>
          <span class="eq"><i></i><i></i><i></i><i></i></span>
        </span>
      </span>
    </button>`).join('');
}

$('#rots').addEventListener('click', e => {
  const b = e.target.closest('[data-rot]');
  if (b) loadRotation(+b.dataset.rot);
});

/* ============================ the tape ============================ */
async function loadRotation(i){
  const r = ROTS[i];
  if (!r) return;
  current = i;
  reel = []; idx = 0;
  renderRotations();

  /* cassette drops in */
  $('#shell').setAttribute('fill', SHELL[r.art] || '#8c2f16');
  $('#cLabel').textContent = r.title.length > 24 ? r.title.slice(0, 23) + '…' : r.title;
  $('#cSide').textContent = 'SIDE A · ' + r.hours.toUpperCase();
  rec.classList.remove('loaded', 'playing');
  void rec.offsetWidth;                       // restart the animation
  rec.classList.add('loading');
  setTimeout(() => { rec.classList.remove('loading'); rec.classList.add('loaded'); }, 1350);

  $('#deckSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#npTitle').textContent = r.title;
  $('#npSub').textContent = 'Threading the tape…';
  $('#vTape').textContent = r.title;
  $('#tracklist').innerHTML = '<li class="idle">Winding…</li>';
  status('');

  try {
    const res = await fetch(`/api/rotations/${r.id}/tracks`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');

    reel = data.tracks || [];
    if (!reel.length) throw new Error('That tape came back empty');
    renderReel();
    $('#srcMode').textContent = data.source === 'live'
      ? (data.cached ? 'live · from cache' : 'built live from YouTube')
      : 'from the shelf · hand-checked';
    if (data.notice) status(data.notice, 'warn');
    cue(0, true);
  } catch (err) {
    $('#npSub').textContent = 'The tape jammed';
    $('#tracklist').innerHTML = '<li class="idle">Nothing loaded.</li>';
    status(String(err.message || err), 'err');
  }
}

function renderReel(){
  $('#tracklist').innerHTML = reel.map((t, i) => `
    <li data-trk="${i}" class="${i === idx ? 'on' : ''}">
      <span class="n">${String(i + 1).padStart(2, '0')}</span>
      <span class="t">${t.title}</span>
      <span class="who">${t.artist || t.channel || ''}</span>
    </li>`).join('');
}

$('#tracklist').addEventListener('click', e => {
  const li = e.target.closest('[data-trk]');
  if (li) cue(+li.dataset.trk, true);
});

/* ============================ the player ============================
   A real, correctly sized IFrame player parked off-screen: audio reaches
   the speakers, video never reaches the eyes. */
let player = null, ready = false, pending = null;

const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(tag);

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('yt', {
    height: '180', width: '320',
    playerVars: { autoplay: 0, playsinline: 1, controls: 0, disablekb: 1, rel: 0, modestbranding: 1 },
    events: {
      onReady: () => {
        ready = true;
        player.setVolume(+$('#vol').value);
        if (pending !== null){ const p = pending; pending = null; cue(p.i, p.auto); }
      },
      onStateChange: e => {
        if (e.data === YT.PlayerState.PLAYING){ setPlaying(true); paintDuration(); }
        if (e.data === YT.PlayerState.PAUSED)  setPlaying(false);
        if (e.data === YT.PlayerState.ENDED)   next();
      },
      onError: () => {
        status('That track refused to play — skipping it.', 'warn');
        setTimeout(next, 600);
      }
    }
  });
};

function cue(i, autoplay){
  if (!reel.length) return;
  idx = (i + reel.length) % reel.length;
  const t = reel[idx];

  $('#npTitle').textContent = t.title;
  $('#npSub').textContent = [t.artist || t.channel, ROTS[current]?.title].filter(Boolean).join(' · ');
  renderReel();
  seekTo(0, true);

  if (!ready || !player){ pending = { i: idx, auto: autoplay }; $('#npSub').textContent = 'Warming up the head…'; return; }
  autoplay ? player.loadVideoById(t.videoId) : player.cueVideoById(t.videoId);
  setMediaSession(t);
}
const next = () => cue(idx + 1, true);
const prev = () => cue(idx - 1, true);

function isPlaying(){
  return ready && player && player.getPlayerState &&
    player.getPlayerState() === YT.PlayerState.PLAYING;
}

function setPlaying(on){
  rec.classList.toggle('playing', on);
  $('#bPlay').textContent = on ? '❚❚ Pause' : '▶ Play';
  $$('#keys .key').forEach(k => k.classList.toggle('on',
    k.dataset.key === (on ? 'play' : 'pause') && (on || reel.length > 0)));
  if (on) startMeter(); else stopMeter();
}

function togglePlay(){
  if (!reel.length){ toast('Load a rotation first'); return; }
  if (!ready || !player){ toast('The recorder is still warming up'); return; }
  isPlaying() ? player.pauseVideo() : player.playVideo();
}

function eject(){
  if (ready && player && player.stopVideo){ try { player.stopVideo(); } catch {} }
  setPlaying(false);
  rec.classList.remove('loaded', 'loading', 'playing');
  reel = []; current = null; idx = 0;
  renderRotations();
  $('#npTitle').textContent = 'Nothing on the tape';
  $('#npSub').textContent = 'Pick a rotation below and it loads itself';
  $('#tracklist').innerHTML = '<li class="idle">Nothing loaded. The recorder is warm, though.</li>';
  $('#vTape').textContent = '—';
  $('#cLabel').textContent = '—';
  $('#counter').textContent = '000';
  $('#hubL').setAttribute('r', 24); $('#hubR').setAttribute('r', 12);
  seekTo(0, true);
  status('Audio only — the corner has no screens.');
}

/* ============================ transport ============================ */
$('#bPlay').onclick = togglePlay;
$('#bNext').onclick = () => reel.length ? next() : toast('Load a rotation first');
$('#bPrev').onclick = () => reel.length ? prev() : toast('Load a rotation first');
$('#bStop').onclick = eject;

/* the piano keys on the recorder itself do the same jobs */
$('#keys').addEventListener('click', e => {
  const k = e.target.closest('.key');
  if (!k) return;
  k.classList.add('down');
  setTimeout(() => k.classList.remove('down'), 110);
  switch (k.dataset.key){
    case 'play':  if (!isPlaying()) togglePlay(); break;
    case 'pause': if (isPlaying())  togglePlay(); break;
    case 'next':  reel.length ? next() : toast('Load a rotation first'); break;
    case 'prev':  reel.length ? prev() : toast('Load a rotation first'); break;
    case 'stop':
    case 'eject': eject(); break;
  }
});

document.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea,button,select')) return;
  if (e.code === 'Space'){ e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight' && e.shiftKey){ e.preventDefault(); next(); }
  if (e.code === 'ArrowLeft'  && e.shiftKey){ e.preventDefault(); prev(); }
});

/* ============================ seek ============================ */
const seek = $('#seek');
let dragging = false;

function paintDuration(){
  if (!ready || !player || !player.getDuration) return;
  $('#tDur').textContent = mmss(player.getDuration());
}
function seekTo(frac, silent){
  frac = clamp(frac, 0, 1);
  $('#seekFill').style.width = (frac * 100) + '%';
  $('#seekHead').style.left = (frac * 100) + '%';
  seek.setAttribute('aria-valuenow', Math.round(frac * 100));
  if (silent) { $('#tCur').textContent = mmss(0); return; }
  if (ready && player && player.getDuration){
    const d = player.getDuration();
    if (d > 0){ player.seekTo(d * frac, true); $('#tCur').textContent = mmss(d * frac); }
  }
}
const fracFromEvent = e => {
  const r = seek.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  return clamp(x / r.width, 0, 1);
};
seek.addEventListener('pointerdown', e => { dragging = true; seek.setPointerCapture(e.pointerId); seekTo(fracFromEvent(e)); });
seek.addEventListener('pointermove', e => { if (dragging) seekTo(fracFromEvent(e)); });
seek.addEventListener('pointerup',   e => { dragging = false; try { seek.releasePointerCapture(e.pointerId); } catch {} });
seek.addEventListener('keydown', e => {
  if (!ready || !player || !player.getDuration) return;
  const d = player.getDuration(); if (!d) return;
  const cur = player.getCurrentTime();
  if (e.key === 'ArrowRight'){ e.preventDefault(); seekTo((cur + 5) / d); }
  if (e.key === 'ArrowLeft'){ e.preventDefault(); seekTo((cur - 5) / d); }
});

/* ============================ meters ============================
   The reels, counter, VU needle and speaker cone all read from the
   player's real clock, so the machine moves with the music. */
let meter = null;

function startMeter(){
  if (meter) return;
  meter = setInterval(() => {
    if (!ready || !player || !player.getCurrentTime) return;
    const cur = player.getCurrentTime() || 0;
    const dur = player.getDuration() || 0;

    $('#tCur').textContent = mmss(cur);
    if (dur > 0){
      $('#tDur').textContent = mmss(dur);
      if (!dragging){
        const f = clamp(cur / dur, 0, 1);
        $('#seekFill').style.width = (f * 100) + '%';
        $('#seekHead').style.left = (f * 100) + '%';
        seek.setAttribute('aria-valuenow', Math.round(f * 100));
      }
      /* tape physically winds from the left hub onto the right */
      const p = clamp(cur / dur, 0, 1);
      $('#hubL').setAttribute('r', (24 - 12 * p).toFixed(1));
      $('#hubR').setAttribute('r', (12 + 12 * p).toFixed(1));
    }

    $('#counter').textContent = String(Math.floor(cur) % 1000).padStart(3, '0');

    /* no audio-analyser on a cross-origin iframe, so the needle and cone
       are driven as a plausible dance rather than a real waveform */
    const bounce = Math.abs(Math.sin(cur * 3.1)) * .6 + Math.abs(Math.sin(cur * 7.7)) * .4;
    $('#vuL').style.transform = `rotate(${(-38 + bounce * 74).toFixed(1)}deg)`;
    const cone = $('#cone');
    cone.setAttribute('r', (32 + bounce * 5).toFixed(1));
    cone.setAttribute('fill-opacity', (.08 + bounce * .16).toFixed(3));
  }, 250);
}
function stopMeter(){
  if (!meter) return;
  clearInterval(meter); meter = null;
  $('#vuL').style.transform = 'rotate(-38deg)';
  $('#cone').setAttribute('fill-opacity', '.1');
}

/* ============================ volume ============================ */
const vol = $('#vol');
function applyVolume(v){
  v = clamp(Math.round(v), 0, 100);
  vol.value = v;
  $('#volV').textContent = v;
  /* knob sweeps from -140° to +140°. Set the SVG transform attribute rather
     than the CSS property: rotate() without a centre pivots on the element's
     own origin, which is already the knob centre. A CSS transform-origin here
     would resolve against the viewBox and fling the pointer off the dial. */
  $('#volMark').setAttribute('transform', `rotate(${(-140 + (v / 100) * 280).toFixed(1)})`);
  if (ready && player && player.setVolume) player.setVolume(v);
  try { localStorage.setItem('nukad:vol', String(v)); } catch {}
}
vol.addEventListener('input', () => applyVolume(+vol.value));

/* drag the knob on the machine itself */
const knob = $('#volKnob');
let knobFrom = null;
knob.addEventListener('pointerdown', e => {
  knobFrom = { y: e.clientY, v: +vol.value };
  knob.setPointerCapture(e.pointerId);
});
knob.addEventListener('pointermove', e => {
  if (!knobFrom) return;
  applyVolume(knobFrom.v + (knobFrom.y - e.clientY) * 0.7);
});
knob.addEventListener('pointerup', e => {
  knobFrom = null;
  try { knob.releasePointerCapture(e.pointerId); } catch {}
});

/* ============================ OS media controls ============================ */
function setMediaSession(t){
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: t.artist || t.channel || '',
    album: 'Nukad Coffee · ' + (ROTS[current]?.title || '')
  });
  navigator.mediaSession.setActionHandler('play', () => togglePlay());
  navigator.mediaSession.setActionHandler('pause', () => togglePlay());
  navigator.mediaSession.setActionHandler('nexttrack', () => next());
  navigator.mediaSession.setActionHandler('previoustrack', () => prev());
}

/* ============================ install as app ============================ */
let installEvent = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
  $('#installWrap').hidden = false;
});
$('#installBtn').onclick = async () => {
  if (!installEvent) return;
  installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  $('#installWrap').hidden = true;
  if (outcome === 'accepted') toast('Installed · the corner is on your home screen');
};
window.addEventListener('appinstalled', () => { $('#installWrap').hidden = true; });

if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline shell is optional */ });
  });
}

/* ============================ boot ============================ */
try {
  const saved = localStorage.getItem('nukad:vol');
  applyVolume(saved === null ? 80 : +saved);
} catch { applyVolume(80); }

loadRotations();
