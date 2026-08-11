# Art prompts

Image-generation prompts for the three pieces of artwork this site can use, in
the style of the Deluxe Saloon backdrop that inspired the design.

The site ships with hand-drawn SVG for all three, so **none of this is required
to run**. These prompts exist so the SVG can be swapped for painted raster art
without guessing at the house style.

---

## The reference style

Taken from the actual backdrop on deluxesalon.in
(`/assets/saloon-backdrop-*.jpg`, 1920×1088), not from a description of it:

| | |
|---|---|
| **Medium** | Painterly gouache / matte painting. Soft edges, visible brushwork, canvas grain. **Not** flat vector — which is what our SVG is. |
| **Light** | Hard low sun raking from one side, long warm shadows on dusty tarmac, cool sky in high contrast against warm walls. |
| **Palette** | Saturated but sun-faded: vermillion and scarlet, cream, terracotta pink, turquoise, banana green, ochre. |
| **Era** | 1970s small-town India. Corrugated tin awning, tube light, shelves of dusty glass bottles, vintage roadster bicycle, hand-cart. |
| **Camera** | Eye-level, wide cinematic, deep focus. Subject building fills two-thirds of frame. |
| **Mood** | Nostalgic, unhurried, lived-in. |
| **Text** | None in the image. The reference lays its lettering over the picture in HTML. |

Keep that last row. Models render Devanagari and Latin lettering badly, and the
signboard reading नुक्कड़ कॉफ़ी is real markup layered on top — see
`.scene` in `public/index.html`.

---

## 1 · Hero backdrop

Replaces the inline `<svg class="scene">` in `public/index.html`.

```
Painterly gouache matte-painting illustration of a small Indian street-corner
coffee stall at golden hour, 1970s small-town India. A vermillion-red plastered
kiosk with a corrugated tin awning occupies the right two-thirds of the frame,
its shutter rolled up to reveal a dim interior lit by a single warm tube light.
On the wooden counter: a battered brass coffee urn with a spigot, a tower of
stacked glass tumblers, a glass jar of biscuits, and a scratched 1970s
radio-cassette recorder with its reels turning. Wooden shelves behind hold rows
of dusty glass bottles. Three friends linger: two seated on a low teak bench at
right, mid-conversation, one gesturing with a small glass of filter coffee; a
third stands at the counter with his back half-turned. All in cream and
off-white kurtas and lungis, one in a faded blue shirt. A black vintage roadster
bicycle leans against a terracotta-pink boundary wall at left. A stray
ginger-yellow dog sleeps on the warm pavement. Background: sun-bleached pink
haveli walls, a white temple dome, banana plants with broad ragged leaves, a
distant palm, tangled overhead electrical wires with two birds perched.

Hard low sunlight raking in from the left, long warm shadows stretching across
dusty tarmac, cool turquoise sky in high contrast against the saturated red
walls. Sun-faded dusty palette: vermillion and scarlet, cream, terracotta pink,
turquoise, banana green, ochre. Soft painted edges, visible brushwork, subtle
canvas grain. Eye-level camera, wide cinematic composition, deep focus,
unhurried nostalgic mood.

--ar 16:9 --style raw
```

**Exclude:** `text, lettering, signage copy, watermark, logo, signature, flat
vector art, clean line art, 3D render, glossy modern surfaces, neon, cars,
crowds, distorted hands, extra limbs, blurry faces`

### Night variant — recommended

The site is dark-themed, so the daytime version fights the UI. It also suits
"open all hours" and the Nukkad Raatein rotation better. Replace the lighting
paragraph with:

> Night. The stall is lit only by three bare bulbs strung under the awning and
> one sodium street lamp at left casting a cold amber cone onto wet tarmac. Deep
> indigo and plum sky with a thin crescent moon and scattered stars; warm pools
> of lamplight against cool darkness; the shop interior glows amber.

Everything else stays.

### Mobile crop

Generate a second pass at `--ar 3:4` rather than cropping the wide one — the
reference ships a separate `saloon-backdrop-mobile.jpg` for exactly this reason.
Recompose so the stall fills the frame and the bicycle drops out.

---

## 2 · Recorder skin

Replaces the case, grille and key faces of `<svg id="rec">`. Specified flat-on
so it composites cleanly under the parts that move.

```
Painterly gouache illustration of a battered 1970s Indian portable
radio-cassette recorder, a "two-in-one", photographed straight on, perfectly
flat orthographic front view, no perspective, no rotation, centred in frame.

Dark walnut-brown moulded plastic case with a cream-and-brass trim strip, a
chrome carry handle folded flat along the top edge, and a scuffed brushed-metal
faceplate. Left third: a rectangular speaker grille of small perforated holes
behind dark cloth. Centre: an empty rectangular cassette bay with a scratched,
slightly yellowed clear plastic window and dark shadowed interior — the bay is
EMPTY, no cassette inside. Right: two empty recessed instrument bezels, dark
glass, no needles or numbers printed. Bottom edge: a row of six cream ivory
piano-key transport buttons, blank with no icons on them. Bottom right: a single
knurled brown volume knob.

Surface tells its age: sun-faded plastic, fine scratches, a chipped corner,
dust in the seams, a faint ring stain, one small peeling sticker with no
readable text. Even soft frontal studio light, gentle top-down falloff, no hard
specular highlights, no cast shadow. Isolated on a flat neutral charcoal
background. Muted palette: walnut brown, cream, ochre, brass, oxidised chrome.
Visible brushwork and canvas grain, warm nostalgic tone.

--ar 16:10 --style raw
```

**Exclude:** `text, lettering, brand name, model number, printed icons, cassette
in the bay, needles, digits, perspective, tilt, angled view, glossy new plastic,
3D render, vector art, hands, reflections of a room`

> **Why the bay and bezels must come back empty.** The reels, VU needle, tape
> counter and key glyphs are live SVG driven by the player's clock — see
> `startMeter()` in `public/app.js`. If the painting bakes them in they double
> up and the baked ones never move. Leave the recesses dark and we layer the
> moving parts over the top.

---

## 3 · Cassette skins

Replaces the six sleeves in `public/art.js`. One template, one swap per
rotation. Square, because they render at 82px (62px on mobile).

```
Painterly gouache album-sleeve illustration for a cassette tape, 1970s Indian
print aesthetic. [SCENE]

Sun-faded screen-printed look with slight ink misregistration, visible paper
grain and soft foxing at the edges, limited four-colour palette. Flat graphic
composition that reads clearly at thumbnail size — one bold central subject,
generous negative space, no fine detail. No text anywhere.

--ar 1:1 --style raw
```

Substitute `[SCENE]`, keyed to the `art` number in `data/rotations.json`:

| `art` | Rotation | `[SCENE]` |
|---|---|---|
| 1 | Nukkad Raatein | A shuttered street corner under one sodium lamp after midnight, deep indigo and plum, a single amber pool of light on empty tarmac, one stray dog. |
| 2 | Cutting Chai Classics | A cutting-chai glass and a brass kettle on cream paper, encircled by concentric radio-dial rings in brick red, warm ivory ground. |
| 3 | Barish aur Bakwaas | Monsoon rain slanting across a red-and-white striped awning, two steaming glasses on a wet ledge, deep teal-blue ground. |
| 4 | Sunday Sust | An empty wooden stool with a folded newspaper draped over it, long diagonal afternoon light, olive-green and mustard ground. |
| 5 | Retro Rewind | A cassette tape floating on a magenta perspective grid, chrome and gold spindles, dusk-pink horizon, late-80s Indipop feel. |
| 6 | Gali ka Groove | A half-lowered corrugated metal shutter with a single large speaker cone below it, ochre and oxblood, hard shadow, stacked chairs in silhouette. |

### The shells, not the sleeves

For the cassette that drops into the deck (`#shell`), append to the template:

> Flat orthographic front view of a cassette tape shell, blank white paper label
> with no text, two empty spindle holes, dark exposed tape window, isolated on
> neutral background, no perspective.

Run once per shell colour, matching `SHELL` in `public/art.js`: deep brown,
brick red, teal, olive, plum, oxblood. The label must stay blank — the tape
title is live SVG text (`#cLabel`).

---

## Tool syntax

`--ar` and `--style raw` are Midjourney. For **DALL·E, Imagen or Flux**: drop
the flags, state the ratio in words ("wide 16:9 composition"), and fold the
exclusion list into the prompt as *"without any text, lettering or watermark…"* —
those models take no separate negative field.

## Where the files go

```
public/art/
├── hero-wide.jpg          2400×1350 or larger, quality ~82
├── hero-portrait.jpg      1200×1600
├── recorder.png           transparent background, ~1440 wide
├── sleeve-1.jpg … 6.jpg   800×800
└── shell-1.png … 6.png    transparent
```

Nothing reads that folder yet. Wiring it up means: swapping the inline
`<svg class="scene">` for a `<picture>` with both hero sources, keeping the
signboard as text layered over it, and changing `ART` in `public/art.js` from
SVG strings to image paths. Keep the SVG as the fallback so the site still
works before the images exist, and so `sw.js` has something to cache offline.
