/**
 * नुक्कड़ कॉफ़ी · Nukad Coffee — station server
 * ---------------------------------------------------------------
 * A corner coffee shop that runs as a radio station. The tape recorder
 * on the front page plays audio only; the reel behind each rotation is
 * assembled here so the visitor never pastes a link.
 *
 *   GET /api/station                  -> clock, listener count, mode
 *   GET /api/rotations                -> rotation metadata (no network)
 *   GET /api/rotations/:id/tracks     -> the reel, live or curated
 *
 * Track sourcing, in order of preference:
 *   1. YOUTUBE_API_KEY present -> search.list per artist, interleaved
 *   2. no key, quota spent, or a search that comes back empty
 *      -> the hand-checked reel in data/rotations.json
 *
 * Every curated id was verified embeddable, so the tape always plays.
 */

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------------- minimal .env loader (no dependency) ----------------
   Runs before anything reads process.env, and never overrides a value
   already set in the real environment. */
try {
  const raw = await fs.readFile(path.join(__dirname, '.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env — fine, the curated reels cover it */ }

const PORT = process.env.PORT || 3000;

/* An unedited copy of .env.example leaves the placeholder in place; treat it
   as "no key" rather than sending it to YouTube and failing every search. */
const RAW_KEY = (process.env.YOUTUBE_API_KEY || '').trim();
const API_KEY = /^(your_key_here)?$/i.test(RAW_KEY) ? '' : RAW_KEY;

/* --curated works on every shell; MOCK=1 does not on Windows */
const forceCurated = process.argv.includes('--curated') || process.env.CURATED === '1';
const useLive = Boolean(API_KEY) && !forceCurated;

/* tracks pulled per artist when searching live */
const PER_ARTIST = 2;

/* ---------------- rotations ---------------- */
const rotations = JSON.parse(
  await fs.readFile(path.join(__dirname, 'data', 'rotations.json'), 'utf8')
);

/* ---------------- cache: keeps quota use low ---------------- */
const CACHE_TTL = 1000 * 60 * 60 * 6;          // 6 hours
const cache = new Map();                        // key -> {at, value}

function cacheGet(k) {
  const hit = cache.get(k);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) { cache.delete(k); return null; }
  return hit.value;
}
const cacheSet = (k, v) => cache.set(k, { at: Date.now(), value: v });

/* ---------------- YouTube search ---------------- */
async function searchYouTube(query, max = PER_ARTIST) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoCategoryId', '10');        // Music
  url.searchParams.set('videoEmbeddable', 'true');      // must play in an iframe
  url.searchParams.set('maxResults', String(max));
  url.searchParams.set('key', API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`YouTube ${res.status}`), { status: res.status, body });
  }
  const json = await res.json();
  return (json.items || [])
    .filter(it => it?.id?.videoId && it.snippet)   // channel/playlist rows carry no videoId
    .map(it => ({
      videoId: it.id.videoId,
      title: it.snippet.title,
      channel: it.snippet.channelTitle,
      thumb: it.snippet.thumbnails?.medium?.url || ''
    }));
}

/* ---------------- listener count ----------------
   A station with a plausible pulse: quiet mid-afternoon, busy after dark.
   Derived from the clock rather than random, so every visitor in the same
   minute is told the same number. */
const istParts = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
});
function listeners(at = new Date()) {
  const [hh, mm] = istParts.format(at).split(':').map(Number);
  const h = hh + mm / 60;
  /* two humps: the morning cup and the long evening sitting */
  const morning = 90 * Math.exp(-Math.pow((h - 8.5) / 2.2, 2));
  const evening = 260 * Math.exp(-Math.pow((h - 21.5) / 3.4, 2));
  const base = 40 + morning + evening;
  /* a stable per-minute wobble so the number moves without flickering */
  const t = Math.floor(at.getTime() / 60000);
  const wobble = Math.sin(t * 1.37) * 9 + Math.sin(t * 0.41) * 5;
  return Math.max(7, Math.round(base + wobble));
}

/* ---------------- routes ---------------- */
app.get('/api/station', (_req, res) => {
  const now = new Date();
  res.json({
    ok: true,
    now: now.toISOString(),
    listeners: listeners(now),
    mode: useLive ? 'live' : 'curated',
    keyPresent: Boolean(API_KEY),
    cached: cache.size,
    rotations: rotations.length
  });
});

app.get('/api/rotations', (_req, res) => {
  res.json(rotations.map(r => ({
    id: r.id, title: r.title, dev: r.dev, blurb: r.blurb, hours: r.hours,
    art: r.art, artists: r.artists,
    trackCount: useLive ? r.artists.length * PER_ARTIST : r.curated.length
  })));
});

app.get('/api/rotations/:id/tracks', async (req, res) => {
  const rot = rotations.find(r => r.id === req.params.id);
  if (!rot) return res.status(404).json({ error: 'No such rotation' });

  const cacheKey = 'tracks:' + rot.id;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  /* the hand-checked reel — also the fallback for every live failure */
  const curated = () => ({
    id: rot.id,
    title: rot.title,
    source: 'curated',
    tracks: rot.curated.map(t => ({ ...t, thumb: '' }))
  });

  if (!useLive) {
    const payload = curated();
    cacheSet(cacheKey, payload);
    return res.json(payload);
  }

  try {
    const perArtist = await Promise.all(
      rot.artists.map(async artist => {
        const k = 'q:' + artist + '|' + rot.seed;
        const hit = cacheGet(k);
        if (hit) return hit.map(t => ({ ...t, artist }));
        const found = await searchYouTube(`${artist} ${rot.seed} official audio`);
        cacheSet(k, found);
        return found.map(t => ({ ...t, artist }));
      })
    );

    /* interleave so the reel doesn't play one artist five times in a row */
    const tracks = [];
    for (let round = 0; round < PER_ARTIST; round++) {
      for (const list of perArtist) if (list[round]) tracks.push(list[round]);
    }
    if (!tracks.length) throw new Error('no embeddable results');

    const payload = { id: rot.id, title: rot.title, source: 'live', tracks };
    cacheSet(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    /* quota gone or YouTube unreachable — the tape still plays */
    const payload = {
      ...curated(),
      notice: err.status === 403
        ? 'YouTube quota spent for today — playing the shelf copy.'
        : 'Could not reach YouTube — playing the shelf copy.'
    };
    cacheSet(cacheKey, payload);
    res.json(payload);
  }
});

app.listen(PORT, () => {
  const mode = useLive ? 'LIVE (YouTube Data API)'
    : API_KEY ? 'CURATED (forced by --curated)'
    : 'CURATED (no API key — hand-checked reels)';
  console.log(`\n  नुक्कड़ कॉफ़ी · Nukad Coffee`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  tracks: ${mode}\n`);
});
