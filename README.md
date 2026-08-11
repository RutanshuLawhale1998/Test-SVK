# नुक्कड़ कॉफ़ी · Nukad Coffee

A corner coffee shop that runs like a radio station. One page, one old tape
recorder, six rotations. **Audio only** — the corner has no screens.

---

## Run it

Node is **not** installed system-wide on this machine, so a portable runtime
lives in `../../nodeenv`. The launcher wires it up for you:

```powershell
.\run.ps1                 # http://localhost:3000
.\run.ps1 -Curated        # force the shelf copies
.\run.ps1 -Port 4000
```

If you do have Node on your PATH, the ordinary scripts work:

```bash
npm install
npm start                 # http://localhost:3000
npm run curated           # ignore any key, play the shelf copies
npm run dev               # restart on file change
```

### A YouTube key is optional

Out of the box every rotation plays from `data/rotations.json` — 26
hand-checked video ids, each one verified embeddable, so the tape always
plays. Add a key only if you want the reels searched fresh:

```bash
cp .env.example .env      # then put your key in it
```

1. <https://console.cloud.google.com> → create a project
2. **APIs & Services → Library** → enable **YouTube Data API v3**
3. **Credentials → Create credentials → API key**

Free quota is 10,000 units/day and a search costs 100, so a cold load of all
six rotations costs ~2,800. Results cache for six hours. If the quota does run
out the server quietly falls back to the shelf copies and says so in the
status line — the music never stops.

---

## How it works

```
browser                         server                        YouTube
  │  GET /api/station             │
  │ ─────────────────────────────►│  clock · listener count · mode
  │  GET /api/rotations           │
  │ ─────────────────────────────►│  (reads data/rotations.json)
  │
  │  press a rotation             │
  │  GET /api/rotations/:id/tracks│
  │ ─────────────────────────────►│  key? search.list per artist ──►│
  │                               │ ◄──────────────────────────────┤
  │                               │  interleave · cache 6h
  │                               │  no key / quota / empty
  │                               │     └─► curated reel from disk
  │ ◄─────────────────────────────┤  ordered reel + source
  │
  │  IFrame Player plays each id off-screen, advances on ENDED
```

### Audio only

Playback uses the official YouTube IFrame Player, which is how embedding is
licensed to work — nothing is proxied, downloaded or re-hosted. The player is
a real, correctly sized iframe parked off-screen (`#ytHost`, `left:-9999px`),
so the audio reaches the speakers and the video never reaches the eyes.
`display:none` would have been simpler and does not reliably play.

The reels, tape counter, VU needle and speaker cone all read the player's real
clock, so the machine moves with the music. A cross-origin iframe exposes no
waveform, so the needle dances plausibly rather than truthfully.

---

## Editing the station

Everything visitor-facing is in `data/rotations.json`. No code changes needed:

```json
{
  "id": "my-rotation",
  "title": "My Rotation",
  "dev": "मेरा टेप",
  "blurb": "One line for the shelf card.",
  "hours": "9 pm – 1 am",
  "art": 3,
  "artists": ["Artist One", "Artist Two"],
  "seed": "genre keywords, appended to every live search",
  "curated": [
    { "videoId": "…", "title": "…", "channel": "…", "artist": "…" }
  ]
}
```

`art` picks one of the six SVG sleeves in `public/art.js`, which also sets the
cassette shell colour so the tape in the deck matches its sleeve.

All the artwork is hand-drawn SVG — no images anywhere. If you would rather have
painted raster art, `docs/ART-PROMPTS.md` holds ready-to-use generation prompts
for the hero backdrop, the recorder skin and the six cassette sleeves, worked out
from the reference style the design is based on.

Before adding a `videoId`, check it is embeddable — no API key needed:

```bash
curl -s "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=VIDEOID&format=json"
```

200 with a title means it will play. 401 or 404 means it will not.

---

## Install as app

`manifest.webmanifest` plus `sw.js` make the page installable: full screen, no
address bar, and it opens without a signal. The service worker caches the
shell only — `/api/` responses always go to the network, because a cached reel
is a stale tape. The **Install as app** button appears only when the browser
fires `beforeinstallprompt`, so it is never a dead button.

`navigator.mediaSession` is wired up too, so the track shows on the lock
screen and the hardware keys work.

## Project structure

```
nukad-coffee/
├── server.js                  Express · station API · YouTube search · 6h cache
├── data/rotations.json        The six rotations (edit freely)
├── public/
│   ├── index.html             The whole site — one scrolling page
│   ├── styles.css             Design system, deck animation, hero animation
│   ├── app.js                 Clock, rotations, player, seek, meters, PWA
│   ├── art.js                 Six SVG sleeves + cassette shell colours
│   ├── manifest.webmanifest   Install metadata
│   ├── sw.js                  Offline shell
│   └── icon-192.png · icon-512.png
├── docs/ART-PROMPTS.md        Prompts for painted hero / recorder / sleeve art
├── run.ps1                    Launcher for the portable Node runtime
├── .env.example
└── package.json
```

## API

| Route | Returns |
|---|---|
| `GET /api/station` | `{now, listeners, mode: "live"\|"curated", keyPresent, cached, rotations}` |
| `GET /api/rotations` | Rotation metadata. No network calls. |
| `GET /api/rotations/:id/tracks` | `{tracks:[{videoId,title,channel,artist}], source, cached?, notice?}` |

`source` is `live` or `curated`. A live failure is **not** an error status —
it returns the curated reel with a `notice`, and the front end shows the
notice in the status line.

## Notes

The listener count is derived from the clock, not from real sessions: two
humps, the morning cup and the long evening sitting, plus a per-minute wobble.
Everyone reading in the same minute sees the same number. It is set dressing
and the code says so.

Spotify and Apple Music are linked out to rather than embedded, because
in-page playback on those platforms needs OAuth and a paid account.
