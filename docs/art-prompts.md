# Art prompts — characters, scenes, moments

Working document for producing the v1 assets with Midjourney and Lovart. Everything here
is a starting point; the face that wins the first round becomes the reference for the rest.

## Style

One look for the whole roster. Generate a **style anchor** first, pick the best frame, and
pass it as `--sref` (Midjourney) or as the style reference image (Lovart) on every later prompt.

```
semi-realistic 2.5D illustration, otome game key art, clean linework with soft painterly shading, cinematic rim light, natural skin texture, detailed eyes, muted palette with one warm accent, film grain, no text --ar 3:4 --stylize 250 --v 7
```

Parameters, in one place:

| Purpose | Flag |
|---|---|
| Portrait / moment | `--ar 3:4` |
| Scene backdrop | `--ar 16:9` |
| Character sheet | `--ar 16:9` or `--ar 3:2` |
| Style lock | `--sref <anchor image url>` |
| Same face across images | `--oref <hero portrait url> --ow 200` on V7 (`--cref` + `--cw 100` on V6) |
| Always | `--no text, watermark, logo, signature` |

Rules of thumb: pick the face at step 1 and never regenerate it, only reference it. Run
the face through reverse image search once; if it lands on a real person, throw it out.

## Characters

### Elliot — primary. Sound engineer, 31, works nights.
Register: book boyfriend on the soft edge of sharp. Tired eyes that notice everything.

```
portrait of a 31 year old man, dark tousled hair falling over his forehead, light stubble, deep-set tired eyes with warmth in them, straight nose, slight asymmetry in a half smile, black t-shirt under an open dark overshirt, studio headphones around his neck, one silver ring, sitting in a dim recording studio lit by a single desk lamp, looking just past the camera, semi-realistic 2.5D illustration, otome game key art --ar 3:4 --sref <anchor> --v 7
```

### Theo — explore. Chef, 28.
Register: golden retriever. Open face, easy grin, says things with his hands.

```
portrait of a 28 year old man, warm tan skin, tousled light brown hair pushed back, wide easy grin with a dimple, bright eyes, strong forearms, white chef's jacket with sleeves rolled to the elbow, dark apron, a dish towel over one shoulder, leaning on a steel kitchen pass after service, warm tungsten light, looking straight at the camera mid-laugh, semi-realistic 2.5D illustration, otome game key art --ar 3:4 --sref <anchor> --v 7
```

### Jun — explore. Architect, 34.
Register: sharp edge. Restraint, precision, one look that says more than he will.

```
portrait of a 34 year old man, sharp jawline, neat black hair with a clean side part, pale cool skin, narrow calm eyes behind thin steel-rimmed glasses, black turtleneck under a slate wool coat, a rolled drawing in one hand, standing on a concrete construction site at dusk, cool blue hour light with one warm work lamp, looking slightly down at the camera, semi-realistic 2.5D illustration, otome game key art --ar 3:4 --sref <anchor> --v 7
```

## Character sheets (for consistency, not for the app)

Run once per character after the hero portrait is chosen. The sheet is what the LoRA or
the reference workflow feeds on.

```
character reference sheet of the same man, full body turnaround: front view, three-quarter view, side profile, back view, standing relaxed, plus a row of head studies: neutral, half smile, looking away, eyes closed, plain white background, consistent outfit, flat even lighting, semi-realistic 2.5D illustration --ar 16:9 --oref <hero> --ow 200 --sref <anchor> --v 7
```

## Scenes

Two images per scene: a **backdrop** with no one in it (the scene card) and a **portrait in
scene** (him, there). Titles and settings match `apps/api/src/content/seed.ts`.

### Elliot — The studio, after hours
```
empty recording studio past two in the morning, mixing desk with faders glowing faintly, a single warm desk lamp, a worn leather couch, rain streaking a dark window, cables coiled on the floor, cinematic, quiet, semi-realistic 2.5D illustration --ar 16:9 --sref <anchor> --v 7
```
```
the same man looking up from a mixing desk as a door opens, headphones pushed down around his neck, warm lamp light on one side of his face, the rest of the studio dark, rain on the window behind him, his expression the beginning of a smile, semi-realistic 2.5D illustration --ar 3:4 --oref <hero> --ow 200 --sref <anchor> --v 7
```

### Elliot — Your kitchen, Sunday
```
small bright kitchen on a slow sunday late morning, sunlight through a window over the sink, two coffee mugs on the counter, a radio, plants on the sill, lived-in and warm, no people, semi-realistic 2.5D illustration --ar 16:9 --sref <anchor> --v 7
```
```
the same man leaning against a kitchen counter in a grey t-shirt holding out a mug of coffee, sunday morning light, unhurried, watching the viewer with dry amusement, semi-realistic 2.5D illustration --ar 3:4 --oref <hero> --ow 200 --sref <anchor> --v 7
```

### Theo — The bistro, after close
```
small neighbourhood bistro kitchen after closing, chairs stacked on tables in the dining room beyond, one burner still lit, steel pass with a single plated dish, warm low light, steam, no people, semi-realistic 2.5D illustration --ar 16:9 --sref <anchor> --v 7
```

### Jun — The site, at dusk
```
half-built house at dusk, bare concrete and fresh timber framing, a drawing pinned to a post with its corners lifting in the wind, one work lamp, blue hour sky, no people, semi-realistic 2.5D illustration --ar 16:9 --sref <anchor> --v 7
```

## Moments (collectibles)

Same shape as portrait-in-scene, one per moment in the seed. Pattern:

```
the same man, <moment beat>, <light>, <what his face is doing>, semi-realistic 2.5D illustration --ar 3:4 --oref <hero> --ow 200 --sref <anchor> --v 7
```

Elliot's five, as beats:
- First coffee: handing over a black coffee across a café table, morning light, not quite hiding that he remembered.
- Late shift: walking home under streetlights with his hands in his jacket, looking back over his shoulder.
- Studio, 2am: leaning back in the studio chair with his eyes closed, one hand still on the fader, a mix finally right.
- Sunday: on a couch in the afternoon with a book face-down on his chest, looking over at the viewer.
- The one you asked for: a phone-selfie framing, slightly too close, deadpan, one eyebrow up.

## Delivery

| Asset | Size | Format |
|---|---|---|
| Portrait, moment, portrait-in-scene | 3:4, at least 1200×1600 | JPG, under 600 KB |
| Backdrop | 16:9, at least 1920×1080 | JPG, under 800 KB |

Name files `elliot-portrait-01.jpg`, `elliot-scene-studio-backdrop.jpg`,
`elliot-moment-first-coffee.jpg`, and so on. Hand them over as files; wiring them into
the seed and hosting is engineering's job.
