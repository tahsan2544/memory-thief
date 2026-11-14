<div align="center">

# 🕵️‍♂️⚔️ MEMORY THIEF

> ### A third-person open-world **power-stealing fighting game**
> Defeat the crews of Eidolon City, **steal their fighting styles, powers and
> memories**, climb the **34-encounter world ranking**, and challenge
> **THE OVERLORD**.

[![🌐 Live](https://img.shields.io/badge/%F0%9F%8C%90%20Live-Play%20now-2563eb?style=flat-square&logo=vercel&logoColor=white)](https://memorythief.vercel.app)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Smoke](https://img.shields.io/badge/Smoke%20checks-303%2F303-brightgreen?style=flat-square)](#-testing)
[![Probes](https://img.shields.io/badge/Probes-13%2B55%20checks-blue?style=flat-square)](#-testing)
[![Assets](https://img.shields.io/badge/Assets-100%25%20procedural-orange?style=flat-square)](#-art--audio--honesty)

*One game · one command · one URL. Every building, texture, prop, landmark,
character, sound and effect is generated at load time — no downloaded assets,
no paid services, no external APIs.*

📖 **Docs:** [Game design](docs/GAME-DESIGN.md) ·
[Technical plan & phase status](docs/TECH-PLAN.md)

</div>

---

## 📖 Table of contents

- [🎮 About](#-about)
- [✨ Features](#-features)
- [🚀 Quick start](#-quick-start)
- [🎯 Controls](#-controls)
- [⚔️ Combat](#%EF%B8%8F-combat)
- [🤲 The Requital — stealing](#-the-requital--stealing)
- [📈 The ladder — 34 encounters](#-the-ladder--34-encounters)
- [👑 The Overlord](#-the-overlord)
- [🧠 The memory glove](#-the-memory-glove)
- [🏙️ Living city & stealth](#-living-city--stealth)
- [🧭 HUD, map & overlays](#-hud-map--overlays)
- [🎨 Visuals, audio & performance](#-visuals-audio--performance)
- [🏗️ Architecture](#%EF%B8%8F-architecture)
- [🗂️ Project layout](#%EF%B8%8F-project-layout)
- [🧪 Testing](#-testing)
- [⚙️ Settings & URL overrides](#%EF%B9%90-settings--url-overrides)
- [🚢 Deployment](#-deployment)
- [👀 What you should see](#-what-you-should-see)
- [⚠️ Known limitations](#%EF%B8%8F-known-limitations)

---

## 🎮 About

**MEMORY THIEF** is a procedural, single-world open city built with
**Three.js + Vite** — one game, one world, not a collection of demos.

You play **Riven Vale**, a third-person fighter walking a living city of
patrolling crews behind a readable stealth system. Win a fight and the
**Requital** takes everything: the gang's **fighting style**, their **power**,
and the **memory** they carry. Styles change how you move and strike, powers
land in a hotbar of 44 abilities, and memories feed a journal that *weighs*
what it recorded — six unreliable accounts of the same buried night, two of
which cannot both be true.

Every victory counts on the **34-rung world ladder** — four acts, from the
Street Pickpockets at rank 1 to **THE OVERLORD** at rank 34. Beat his three
phases, survive his sealed arena, and the city asks for your verdict:
**KEEP** the power, or **RELEASE** it back.

## ✨ Features

- 🥊 **Real-time third-person combat** — light strikes, heavies, a style
  special, dodge-rolls with i-frames, guard/parry with a posture bar, lock-on,
  and a per-weapon hotbar (`1`–`9`). Enemies fight from a proper FSM
  (idle → chase → attack → recover → subdue), not on rails.
- 🤲 **The Requital** — hold `E` over a subdued gang and rip out their
  **style + power + memory** in one channel. Every one of the 34 encounters
  carries a unique power; no two crew fights play the same.
- 📈 **A 34-rung world ladder** — authored encounters grouped into four
  acts, a rank chip that climbs as you clear them, knowledge that permanently
  caps your HP/attack/defence, and a map that hides the ladder until you
  walk into each territory.
- 👑 **THE OVERLORD** — a three-phase boss (THE WALL → THE COLLECTOR →
  REQUIITAL OF ALL) with 19 000 HP, deep posture, an arena that seals while
  he stands, and a final Requital that opens a **KEEP / RELEASE** verdict
  which lands in your save.
- 🧠 **Six unreliable memories** — extract fragments from people and
  objects, each with its own colour signature and animation; two accounts of
  the same night contradict each other, and the journal lets you tag which
  one you believe.
- 👻 **World-changing reconstructions** — replay a memory at its recording
  site and the city is permanently different afterwards: a door unbars, a
  marker burns. Replaying the archive seal awakens **Resonance Sight** (`V`).
- 🏙️ **Fully procedural city** — seeded layout, buildings, facades, props,
  neon signage and wet-street materials generated in code; the same seed
  always rebuilds the same city.
- 🕶️ **Readable stealth** — HIDDEN / SUSPICIOUS / DETECTED / SEARCHING, always
  with a plain-language reason; cover, restricted zones, guard alerts and
  disturbances that respect line of sight.
- 📊 **Progression screens** — `K` the ladder (34 rungs + acts + story beat
  per rank), `T` your climb (rank, knowledge caps, 44 powers, verdict),
  `I` equipment (glove upgrades bought with derived motes), `J` journal.
- 🗝️ **A hidden place worth finding** — reconstruct the right memory and the
  sealed service annex on the canal bank opens; what was cached inside can be
  read, and the street plan quietly makes room for it.
- 🕛 **Day/night & weather by the clock** — a seeded hourly schedule drives
  sky, lamps, fog and rain; the same seed always rains on the same hours.
- 💾 **Honest save/load** — one checkpoint (`mt.save.v1`) carries position,
  memories, ledger, knowledge, upgrades and the verdict; broken or foreign
  checkpoints are refused *with a reason* instead of being eaten.

## 🚀 Quick start

```bash
npm install
npm run dev        # 👉 http://localhost:6030
```

When the city is ready, the welcome title card greets you — floating over the
**live city**, with the running clock and the world stamp under the buttons
(`22:00 · NIGHT · EIDOLON-77 · 12×12`). **BEGIN THE WALK** starts the game
(that click also unlocks the sound). Then click the canvas once
to capture the mouse; `Esc` releases it.

Production build / preview:

```bash
npm run build      # → dist/  (what ships — byte-identical to the live site)
npm run preview    # http://localhost:4173
```

## 🎯 Controls

### 🕹️ Play mode (default)

| Input | Action |
| --- | --- |
| Click canvas | Capture mouse (pointer lock) |
| Mouse | Orbit camera (character turns to face movement) |
| `W A S D` | Move (camera-relative) |
| `Shift` | Sprint |
| `Ctrl` | Crouch / sneak (hold) — slower, lower profile |
| `Space` | Jump |
| Mouse wheel | Camera distance (2.2–9 m) |
| `LMB` | Light strike |
| `F` | Heavy attack |
| `G` | Style special (per equipped style) |
| `RMB` (hold) | Guard — block; tap at the hit to parry |
| `C` | Dodge roll (i-frames) |
| `Q` | Lock-on / release lock |
| `1`–`9` | Hotbar weapon swap |
| `E` | Interact · extract memory · close card |
| Hold `E` (1.5 s) | **Requital** — steal the subdued gang's style/power/memory |
| `V` | Resonance Sight (once unlocked) |
| `J` | Memory journal (`↑ ↓` select · `Enter` reconstruct · `1` `2` weigh) |
| `K` | The ladder — all 34 rungs, acts and story beats |
| `T` | Your climb — rank, knowledge caps, powers, verdict |
| `I` | Equipment & inventory — glove stats, upgrades, mote balance |
| `M` | City map — districts, landmarks, territory pins, ladder |
| `Tab` | Toggle the **mini-map** (top-right: streets around you, live position) |
| `R` | Respawn at the district spawn |
| `H` | Toggle HUD |
| `F5` | Toggle inspection camera (dev) |
| `N` | New random seed (rebuilds the world) |
| `P` / `Esc` | Pause menu (save / load / settings / new game) · close the open surface |

### 🔭 Inspection camera (`F5` or `?dev=1`)

| Input | Action |
| --- | --- |
| `W A S D` + `Q` / `E` | Fly (or `Ctrl` / `Space`) |
| `Shift` | Boost (4.2×) |
| Mouse wheel | Adjust flight speed |
| `R` | Reset camera to overview |
| `0` | Overview viewpoint |
| `1`–`5` | Tower · Market · Station · Garden · Underarchive landmarks |
| `6` | Street-level viewpoint (standing on a road) |

## ⚔️ Combat

- **Vitals** — HP, stamina and posture on the combat HUD; your equipped
  style and weapon sit beside the rank chip (`RANK n · TITLE`).
- **Strings** — `LMB` chains light strikes; `F` spends stamina on a heavy
  that crushes guard; `G` fires the equipped style's special on its own
  cooldown.
- **Defence** — holding `RMB` guards (chip damage on the block); releasing
  into an incoming hit **parries** and staggers the attacker. `C` dodge-rolls
  with i-frames — stamina is the real limit.
- **Lock-on** (`Q`) keeps the camera and your facing on the threat; fighters
  circle, feint and recover around you.
- **Subdue** — break a fighter's posture and they go down. Downed fighters
  are *stealable*; a whole subdued gang clears the territory.
- **Defeat** — hit 0 HP and you go down for 1.6 s, then rise at full vitals
  at your district spawn. The city never soft-locks; the ladder never lies.

Enemies are real actors: a shared `Fighter` FSM with per-group weapon
restrictions (one weapon category per crew — knives, pipes, banners, …),
group-level AI budgets, and streaming activation (≤ 8 live fighters, groups
activate within 46 m and despawn beyond 70 m).

## 🤲 The Requital — stealing

1. **Subdue** the gang (posture breaks, bodies on the ground).
2. **Hold `E`** inside reach (3.2 m) — the Requital ring fills over 1.5 s.
   Release early or walk away and it cancels.
3. On completion the crew's **style** equips, their **power** lands in your
   loadout, their **memory** enters the journal, and the story card opens
   with the five-facet choreography of the fight you just won — plus the raw
   *memory lead* pointing at the next rung.

Stolen powers mount on the hotbar; stolen knowledge deepens your permanent
caps (`hp +10 · atk +1 …`). Nothing in the ladder can be farmed twice —
each territory yields once.

## 📈 The ladder — 34 encounters

- **34 authored encounters** in rank order, each a distinct crew with its
  own name, title, district, territory, difficulty, weapon category and
  unique power. `check:data` asserts the shape (15 styles · 10 weapons ·
  44 powers · 34 encounters).
- **Four acts** — *The Unschooled* (1–9), *The Ladder* (10–20),
  *The Elites* (21–29), *The Finale* (30–34) — each with its own story beat,
  shown per rung on the `K` ladder screen.
- **Discovery gates the map** — territories stay dark until you walk across
  their border; the map flags exactly **one** next target and always shows
  the Overlord's beacon.
- **Rank titles** climb from `NOBODY` to `OVERLORD-ESTEEMED`; the `T` screen
  reads out your rank, knowledge ceilings, powers collected (x/44) and the
  verdict, if you've earned one.

## 👑 The Overlord

Rank 34, anchor in the Underarchive, ~19 000 HP across three phases:

| Phase | HP | Title |
| --- | --- | --- |
| 1 | 100–66 % | **THE WALL** — posture, pressure, slow inevitability |
| 2 | 66–33 % | **THE COLLECTOR** — he starts using what he stole |
| 3 | 33–0 % | **REQUIITAL OF ALL** — everything, at once |

While he stands, the **arena seals** — a soft radial wall around his ring
(armed only once you step inside; the rest of the city stays reachable).
Subdue him, hold `E` for the last Requital, and the verdict screen opens:
**KEEP** the power or **RELEASE** it back into the city. The choice is
written into the checkpoint and shown on the `T` screen.

## 🧠 The memory glove

The v1 investigation layer is still in the city, now feeding the same story:

- **Six unreliable memories** — extract fragments from people and objects
  (1.3 s channel; moving cancels; the glove recharges between readings).
  Each has a colour signature, an effect and a *reliability rating*.
- **Contradictions** — two accounts of the same night cannot both hold; the
  journal shows the discrepancy and lets you tag which one you believe.
- **Reconstructions** — replay a fragment at its recording site: violet
  ghosts play the event, the fog closes in, and afterwards the world is
  changed (the canal-bank annex unbars, a clue marker burns).
- **Resonance Sight** — unlocked by replaying the archive seal; `V` paints
  echo markers across the city and rank markers over nearby crews, with a
  cooldown the upgrades can shorten.

## 🏙️ Living city & stealth

- Twelve agents — guards, civilians, vendors and a mark — walk validated
  street rounds with pause points on a fixed 10 Hz wall-clock heartbeat.
- Awareness reads `HIDDEN / SUSPICIOUS / DETECTED / SEARCHING` with a
  plain-language **reason**; cover breaks line of sight, restricted zones
  name themselves, and disturbances travel to the next patrol.
- Extractions are noisy in the open and silent behind cover — the glove's
  light is not subtle.

## 🧭 HUD, map & overlays

- **Combat HUD** — vitals, posture, rank chip, hotbar, lock-on reticle, and
  the Overlord's phase bar whenever he stands.
- **`M` city map** — districts, landmarks, readings, territory pins with
  rank numerals, the one next target, the Overlord beacon, your live dot.
- **`Tab` mini-map** — north-up live window, sprint zoom, off-screen edge
  arrows, district label.
- **`K` ladder / `T` climb** — the two Phase-14 progression screens.
- **`J` journal / `I` gear / `P` pause** — journal with contradictions and
  reconstruction controls, the upgrade shop, and save/load/settings/new-game.
- **`H` hides the HUD**, `F5` flips to the inspection camera.

## 🎨 Visuals, audio & performance

- **Draw-call discipline** — geometry accumulates into per-chunk buckets
  keyed by material and merges; props are instanced; chunks are
  distance-culled on top of frustum culling. Medium preset ≈ 410 meshes /
  ~725 k triangles / ~370–550 draw calls in the smoke scenes.
- **Textures painted at startup** (facades, roads, water, signage) and
  shared; bloom is the single selective post pass.
- **Quality presets** — Low (no shadows, no rain, 0.75 pixel ratio) ·
  Medium (4 Hz shadow cadence) · High (6 Hz, fuller light budget, 460 motes).
  Software-GL is detected at boot and auto-degrades.
- **Procedural WebAudio** — footsteps, cues, extraction/reconstruction
  signatures and an ambient bed, all synthesised; volume buses persist.
- **Day/night & weather** — seeded hourly schedule drives sky, stars, lamps,
  fog and rain; `?cycle=0` freezes it for tests.

## 🏗️ Architecture

- **One continuous grid** — `grid × grid` cells of 100 m with 16 m roads
  centred on cell boundaries. Districts are rectangular *regions* of that
  grid, so all five are connected by the same streets; the Underarchive
  entrance is a single overridden cell and the Floodworks canal replaces one
  road corridor.
- 🎲 **Deterministic** — a seeded RNG (`src/core/rng.js`) drives layout,
  facades, props and landmarks; the same seed always produces the same city.
- 📞 **Draw-call discipline** — per-chunk merged buckets, instanced props,
  distance + frustum culling (see above).
- 🖼️ **Textures** painted into canvases at startup and shared; facades are a
  4×4 module grid whose bottom row is a street-level shopfront band.
- 🏙️ **Buildings** stack podium / shaft / crown tiers with a cornice at
  every setback; every piece joins the per-chunk buckets, so the richer
  silhouette costs **zero extra draw calls**.
- 🧱 **Collision without a physics engine** — boxes/circles collected into a
  spatial hash; the player is an XZ circle moved per-axis with bisection, so
  it slides along walls and climbs curbs but never penetrates geometry. The
  third-person camera ray-sweeps the same hash to shorten its boom.
- 🥊 **Combat has one owner** — `combat/combatSystem.js` runs the player FSM
  (vitals, strings, guard/parry, dodge, lock-on, subdue) against
  `enemies/fighter.js` actors streamed by `enemies/spawner.js`; the Overlord
  subclasses the same `Fighter`, so the boss inherits every rule the street
  taught you.
- 🤲 **Powers & styles are data** — `powers/` (44 abilities), `styles/`
  (15 kits differing on multiple axes) and the authored encounter ladder
  live in data tables validated by `scripts/check-data.mjs`.
- 🧠 **Memory state has one owner** — `MemoryManager` (collect /
  reconstruct / deductions / ability / persistence). All memory timers are
  wall clock, so channels and replays last the same real seconds at 60 fps
  and at the fraction-of-a-fps a headless software renderer manages.
- 🚪 **The hidden annex is seed-robust** — the world builder probes the raw
  collider list for a flat canal-bank face and falls back to a freestanding
  alcove if the city argues.

## 🗂️ Project layout

```
index.html            UI shell: loading, welcome, HUD, settings, prompts,
                      journal, extraction ring, map, gear, ladder (K),
                      climb (T), pause, verdict
src/
  main.js             bootstrap, mode manager, frame chain, arena seal,
                      test hooks (__MT_*)
  styles.css
  config/             palette, districts, quality/defaults/URL overrides
  core/               app shell (renderer/loop/culling), seeded RNG, input,
                      fly camera
  utils/geo.js        MeshBuilder — merged vertex-coloured geometry
  world/              layout, textures, materials, buildings, props,
                      landmarks, colliders, memory sites, city life
  environment/        sky + env map, lighting, rain, day/night + weather
  character/          Riven Vale model + procedural animator
  npc/                bystander rigs + NPC agent (perception + behaviour)
  stealth/            awareness states + reasons
  player/             collision, movement, third-person camera
  interaction/        interactable objects
  combat/             combatSystem (player FSM), cues, HUD glue
  enemies/            fighter.js (shared FSM), spawner.js (streaming),
                      boss_overlord.js (3-phase boss)
  styles/             fighting-style kits (15)
  powers/             44 stolen abilities + the Requital channel
  memories/           fragment catalogue, memory manager, reconstruction
  progression/        ladder data, rank/knowledge, story acts, save shape
  audio/              procedural WebAudio cues
  ui/                 loading + welcome, HUD, settings, prompt card,
                      journal, stealth HUD, city map, mini-map,
                      rank screen (K), progress screen (T), verdict
scripts/smoke.mjs     headless end-to-end suite (303 checks; exit code
                      reflects failures — gates every change)
scripts/probe-map.mjs map/discovery probe (13 checks)
scripts/probe-combat.mjs combat/steal/ladder/boss probe (55 checks)
scripts/check-data.mjs data-shape gate (styles · weapons · powers · ladder)
scripts/probe-warden.mjs warden-plaza diagnostic (position/near-source trace)
```

## 🧪 Testing

Three headless suites + a data gate, all on headless Edge + Puppeteer.
The smoke suite starts the dev server, **plays the game** and asserts
**303 checks** in eight groups — the exit code reflects failures, so it
gates every change:

| 🔍 Group | Checks | What it proves |
| --- | --- | --- |
| 🛈 Welcome | 6 | the title screen greets you before play (with the live city clock), the movement gate holds behind it, hotkeys are swallowed, BEGIN starts the walk, it never comes back |
| 🎮 Gameplay | 30 | walking, sprinting, jumping, collision (walls, barriers, camera boom), prompts, read-out cards, mode toggles |
| 🧠 Memory | 60 | extraction + cooldown/cancel paths (incl. all six fragment recordings and the contradiction pair), journal, reconstruction playback/cancellation, the hidden door, replay gating, Resonance Sight unlock/use/cooldown, clue markers |
| 🏙️ City life | 26 | population & archetypes, hide spots, restricted zones, patrol movement, SUSPICIOUS→DETECTED escalation with reasons, investigate→search→return cycle, cover breaking line of sight, extraction noise |
| 📈 Progression | 102 | city map & pins, discovery-gated ladder (34/34), mini-map contract, extraction noise, upgrade shop (4 installs), **`K` ladder screen (34 rungs · 4 acts · Overlord row)**, **`T` climb screen (rank · caps · 44 powers · verdict)**, pause/settings/save-load/new-game round-trips, checkpoint refusal (corrupt/outdated/future) |
| ✅ Quality | 45 | low/medium/high presets, draw-call & GPU-resource leak budgets, same-seed rebuild determinism, volume buses, reduce-FX, fixed-lens camera, software-GL detection + auto-degrade |
| 🕛 Day/night | 14 | the clock boots frozen at 22:00 and holds, HUD clock text, dawn/noon/dusk/night sky + star/moon/sun response, lamps sleeping by day, the schedule's rain/fog windows by hour, weather seeded by the city |
| 🛡️ Robustness | 20 | blur/tab-hide releasing keys, wall-clock pace at any frame rate, figure culling, teleport basis, menu-key leak guards, keyboard a11y, seed round-trip, yaw-0 checkpoint |

```bash
npm run smoke        # 303 checks, ~15 min under software GL; writes smoke/ screenshots
```

Focused probes (faster iteration, no screenshots):

```bash
npm run probe:map    # 13 checks — map, pins, discovery gating, border charting
npm run probe:combat # 55 checks — streaming, lock-on, strikes, subdue,
                     #   Requital, story card, ledger, defeat/respawn,
                     #   save round-trip, boss phases + arena seal + verdict
node scripts/probe-warden.mjs  # diagnostic: warden plaza position/near trace
```

Data gate (no browser — instant):

```bash
npm run check:data   # 15 styles · 10 weapons · 44 powers · 34 encounters
```

The suite can also be pointed straight at production (the deployed bytes are
the local build):

```powershell
# PowerShell
$env:SMOKE_URL="https://memorythief.vercel.app"; $env:SMOKE_OUT="smoke-live"; npm run smoke
```

```bash
SMOKE_URL=https://memorythief.vercel.app SMOKE_OUT=smoke-live npm run smoke
```

## ⚙️ Settings & URL overrides

- ▶️ **Live (no rebuild):** fog distance, rain, shadows, wet streets,
  day/night cycle (freezing the clock freezes the weather), quality
  preset, render scale, mouse sensitivity, camera distance, invert-Y,
  procedural sound cues.
- 🔁 **Rebuild:** seed, world scale (8 / 12 / 16 blocks), district density.
- ♿ **Accessibility** (own storage key, survives a new game): interface
  scale, reduce flicker & flash, high-contrast cards, reduce visual effects.

URL overrides are supported for testing and screenshots:

```
http://localhost:6030/?seed=eidolon-77&grid=12&quality=high&density=1.1&fog=800&rain=1&shadows=1&wet=1&sens=1.0&dist=4.6&invert=0&audio=1&time=18.5&cycle=0
```

- `?dev=1` starts in the inspection camera instead of play mode.
- `?time=18.5` starts the clock at 18:30; `?cycle=0` freezes it (weather
  holds too) — the smoke suite pins `?cycle=0`, so every time-driven check
  is exact.

## 🚢 Deployment

The game is a pure static site: `npm run build` writes `dist/`, and that
exact bundle is what ships. Production is deployed from the **GitHub repo**
(`tahsan2544/memory-thief`, branch `main`) through Vercel's git integration;
`framework: null` + `npm run build` → `dist/` is what gets served, so what
is live is byte-for-byte what was tested locally.

> ### 🌐 The one live URL: **[memorythief.vercel.app](https://memorythief.vercel.app)**

- Project `memory-thief`, personal scope, `framework: null`.
- After every production deploy the two legacy-host **alias redirects are
  re-applied** with `assign_alias({ ..., redirect: "memorythief.vercel.app" })`
  (bare hostname — the API prepends `https://` itself; 307, path + query
  preserved).

**Why only one URL.** `memory-thief.vercel.app` itself was never available
(it belongs to another account). The two older hosts no longer serve the
game:

- `memory-thief-omega.vercel.app` → **alias-level 307 redirect** to the live
  URL (`…/?seed=eidolon-77&quality=medium` lands on the same path+query).
- `memory-thief-tahsan2544-projects.vercel.app` → the auto-generated
  deployment URL sits behind **SSO protection**
  (`ssoProtection: all_except_custom_domains`), so visitors get Vercel's
  login wall — never a second copy of the game. Protection must stay on.

**Why redirects live at the alias layer, not in `vercel.json`.** Redirect
rules in a `vercel.json` uploaded through Vercel's file API are **validated
at build but never applied** to such deployments. Verified directly: a
deployment carrying an unconditional canary redirect returned `200/404`
instead of `308`, while the alias-level redirect worked on the same
deployment. There is no API to delete a project domain or to PATCH its
redirect, so removing the legacy domains entirely is a one-click dashboard
action (Project → Domains → Remove). If a git remote is ever connected,
`vercel.json` redirects *would* apply; the tested config is preserved for
that future:

```json
{
  "redirects": [
    { "source": "/:path*", "destination": "https://memorythief.vercel.app/:path*", "permanent": true,
      "has": [{ "type": "host", "value": "memory-thief-omega.vercel.app" }] },
    { "source": "/:path*", "destination": "https://memorythief.vercel.app/:path*", "permanent": true,
      "has": [{ "type": "host", "value": "memory-thief-tahsan2544-projects.vercel.app" }] }
  ]
}
```

## 👀 What you should see

A night city in the rain, seen over Riven Vale's shoulder: amber-windowed
Old Quarter, cold blue Glassline towers, teal Floodworks with a canal and a
flooded station pit, green Verdant Ward, and a sealed red-hazed Underarchive
square in the middle. Wet asphalt picks up the district colours; fog falls
off into the distance rather than hiding the skyline.

Crews hold their territories — a ring on the ground, a rank over their heads.
Walk close and lock on: lights chain into heavies, guards answer with parries,
posture bars crack, and a downed gang waits for the hold-E Requital. Clear a
territory and the ring goes gold, the rank chip climbs, and the story card
opens on what you just took.

People also stand at the landmarks — an attendant at the station board, a
trader at the market charter, a warden at the archive notices, a clerk at the
tower directory. Walk close and the glove offers to read them; a valve, a
directory or a plaque offers the same. A successful reading opens the
journal on the recovered fragment. Replay it at its site and violet ghosts
play the recorded event around you while the fog closes in — then the city
is subtly different: a door unbars on the canal bank, a marker burns over a
clue.

The streets *live*: guards patrol with their hands clasped, civilians walk
with shopping, vendors stand their market corner, and the Palisade courier
crosses the city on an errand. Sprint past a guard and the HUD chip climbs
from `HIDDEN` to `SUSPICIOUS` with the reason "A guard is watching you";
keep it up and it flips to `DETECTED — Caught sprinting`. Duck behind a
crate cluster and the chip reads `HIDDEN — Behind cover — no line of sight`
while the guard searches the spot you vanished from.

Two of the six memories fix the same event at 23:40 and cannot both hold.
Once the journal holds both, it shows the discrepancy and lets you tag which
account you believe (`1` / `2`) — the glove keeps the fragment either way.

## ⚠️ Known limitations

- 🥊 **One weapon category per crew, authored by hand** — the ladder's
  variety comes from the 34 authored encounters, not from procedural move
  generation; beyond rank 34 there is no endless mode.
- 📚 **The standalone `L` style-library screen was not built** — styles are
  visible and swappable through the Requital, hotbar and `T` climb screen;
  there is no separate catalogue browser.
- 🎭 **Actor cap is a flat `MAX_FIGHTERS = 8`** (not the plan's
  quality-weighted budget) — streamed within a 46 m activation ring and
  despawned beyond 70 m; this keeps software-GL frame times honest.
- 🚪 **No interiors** — the hidden service annex is the first enterable
  space; every other door is visual and buildings are solid blocks.
- The city edge is sealed by an **invisible boundary wall** (the world just
  ends beyond the outer road); everything *inside* the city uses visible
  blockers.
- Collision volumes are simplified (boxes/circles per building, prop and
  parapet) — no per-stair-step or per-railing geometry.
- The inspection camera (`F5`) is still a development tool; it clips
  through geometry by design.
- Point lights are large district/landmark accents plus the glove light and
  the annex cache light, not per-street-lamp lights.
- Rain is a fixed volume around the camera; when the day/night schedule
  brings a front, its *intensity* follows the clock, but there is still no
  lightning and no wind variation.
- Quality presets cap pixel ratio, shadow map size, prop density and
  visible light count; "Low" disables shadows and rain entirely.
- **NPCs walk through each other and through the player** — they avoid the
  world's static geometry but have no agent-agent or agent-player collision.
- **No canal-bridge routing** — routes are validated to stay on their own
  bank, so nobody crosses the Floodworks canal.
- **The population is deliberately small** (12 agents, 6 hide spots, 2
  restricted zones) — sized to keep the behaviour readable.
- **Line of sight is sampled at chest height in 2D** — a guard above a pit
  "sees" across it; hiding spots and walls model their blocking as radius
  volumes rather than per-fragment occlusion.
- **No schedules** — city-life agents repeat their round indefinitely; they
  are non-interactive walkers by design (crew fighters are the combatants).
- **Landmark figures still idle** — the four memory-source people and the
  fragment-less night clerk stand at their posts (they are extraction
  sources first, patrollers second).
- **Reconstructions play at the recording site only** — you must walk back
  to the source to replay (the journal tells you how far you are).
- Memory state persists in `localStorage`; if storage is unavailable
  (private mode), the game keeps working but forgets between reloads.
- Headless smoke tests render with SwiftShader (0.4–1.4 real FPS at street
  level, depending on preset and render scale), so gameplay checks poll for
  progress instead of waiting fixed times — low FPS in `smoke/` runs is the
  software renderer, not the game.
- **All performance work was measured only under SwiftShader** (software
  GL, headless Edge). The draw-call / triangle / light-count deltas between
  presets are real and reproducible, but **no real-GPU frame rate was
  measured** — do not read the probe's FPS column as hardware performance.
- **Shadow maps refresh on a cadence, not every frame** (Medium 4 Hz ·
  High 6 Hz), so a fast-moving character's shadow can lag the mesh by up to
  ~250 ms. Low turns shadows off entirely.
- **The dynamic light budget picks the nearest N accent lights twice per
  second** — a light can pop on/off at the selection boundary.
- **Bloom is the only post-processing** — no SSAO, no motion blur, no
  screen-space reflections. Wet-street "reflections" are a scrolling normal
  map; combat VFX are geometry/overlays only.
- **Procedural audio only** — every sound is synthesised at runtime; there
  are no recorded samples. Browsers without WebAudio run the game silently
  by design.
- **Touch controls cover movement, look, interact, jump and sprint only.**
  Menus, the journal and the map remain keyboard+mouse — a touch device can
  play the game but cannot easily navigate every screen, and it was not
  tested on physical touch hardware.
- **Ambient motes are gated** by the graphics preset (Low removes motes)
  and by *reduce visual effects*. The camera has no motion effects of its
  own: no sprint FOV kick, no look-ahead swing.

---

<div align="center">

**Built with 💜 by [@tahsan2544](https://github.com/tahsan2544)**

*Three.js · Vite · WebAudio — every byte generated in code.*

[![Live](https://img.shields.io/badge/%F0%9F%8C%90%20Play%20MEMORY%20THIEF-2563eb?style=for-the-badge&logo=vercel&logoColor=white)](https://memorythief.vercel.app)

</div>
