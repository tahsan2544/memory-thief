# MEMORY THIEF — TECHNICAL & GAMEPLAY IMPLEMENTATION PLAN (v2)

> Companion to **docs/GAME-DESIGN.md** (the concept contract). This plan maps
> every new system onto the **existing codebase** — nothing is migrated to
> another engine or framework. Stack stays exactly as-is:
> **Three.js + Vite, vanilla ES modules, procedural everything, Puppeteer
> smoke suite.**

---

## 1. STACK PRESERVATION — what does NOT change

| Preserved verbatim | Why |
| --- | --- |
| `vite.config.js`, `package.json`, dev port 6030 | environment |
| `src/core/app.js` — renderer, HDR/bloom chain, cull, shadow cadence, fixed-lens shell | rendering |
| `src/core/input.js` — pointer-lock input + `setKey/injectPress/simulateMouse` test injection | input & testing |
| `src/core/rng.js`, `src/utils/geo.js` (`MeshBuilder`) | determinism & geometry |
| `src/world/layout.js` — seeded 100 m-cell street grid, districts, landmarks | the open world |
| `src/world/world.js` collider registration, buildings, props, details | solidity |
| `src/player/collision.js` (`Colliders`: `moveAxis`, `groundAt`, `hits`, spatial hash) | physics & hitqueries |
| `src/player/thirdPersonCamera.js` — fixed 58°, boom sweep, ground clamp | camera |
| `src/config/settings.js` + quality presets + software-GL auto-degrade | settings |
| `src/environment/*` — sky, day/night, rain, motes, contact shadows | atmosphere |
| `src/character/rivenVale.js` rig + replace-path `{group, parts, height, dispose}` | protagonist |
| `src/npc/bystander.js` figures, `figureTextures` fabric/face atlas | enemy bodies |
| `src/audio/memoryAudio.js` WebAudio buses (master/ambience/effects) | audio |
| `src/ui/*` snapshot→render split, `styles.css` tokens, a11y layer, touch layer | UI infrastructure |
| `scripts/smoke.mjs` harness style (`until()` polling, `__MT_*` hooks) | testing |

The existing **stealth system**, **procedural animator**, **procedural NPC
figures**, **WebAudio**, **map/minimap**, **upgrade-economy DOM-free pattern**
and **honest save/load** are all *reused*, re-skinned and re-purposed — the
fighting concept rides on proven systems.

**Lore/copy** (welcome card, HUD strings, memory titles) changes in later
phases — deliberately last, so every phase keeps the game buildable and the
smoke suite runnable.

---

## 2. MODULE MAP — existing → new role

| Existing module | New role in v2 |
| --- | --- |
| `character/animator.js` (`GESTURES`, `fireGesture`, additive one-shots) | **attack/defend animation engine** — combat states extend the GESTURES pattern |
| `player/controller.js` (`PlayerController.update`, `frozen` gate, `setChannel`) | **movement under combat**, channel-style poses reuse |
| `player/collision.js` (`units`, hashes, `PROP_COLLIDERS`) | melee reach checks, arena props, boss ground rings |
| `npc/agent.js` (`AGENT_TYPES`, wall-clock perception, state machine, `snapshot/relocate/forcePause`) | **enemy AI chassis** — new combat verbs on the same rig |
| `npc/npcAnim.js` (`clipFor(role, mode, ...)`) | enemy combat animation resolver (fight clips by weapon/style) |
| `world/cityLife.js` (`buildCityLife`, routes, zones, `emitFrom`, heartbeat) | **territory/encounter staging layer** — routes become arena rounds and group posts |
| `memories/fragments.js` + `memoryManager.js` (collect/gate/persist, `unlockAbility`) | **power & memory stealing** — the Requital generalizes the glove |
| `progression/upgrades.js` (derived motes, single-purchase) | **ability/economy shell** for unlocking power slots |
| `progression/saveManager.js` (`validateDoc`, refuse-with-reason) | save **v2** (`powers`, `cleared`, styles, weapons) |
| `ui/mapScreen.js` + `ui/miniMap.js` (shared `mapData()` snapshot) | territory pins, rank colors, leaders, cleared glyphs |
| `ui/memoryUI.js` (journal + channel ring) | **Memory archive** + steal channel ring |
| `stealth/stealthSystem.js` (pure state folds) | stealth mode re-scope |
| `core/app.js` info counters & harness | combat perf budgets |

---

## 3. NEW MODULES — target tree

```
src/
  combat/                 # player-side combat core (Phase 2+)
    config.js             # combat tuning constants (i-frames, wind-ups, cancel windows)
    styles.js             # 15 style definitions — pure data (Phase 1, done)
    combatSystem.js       # attack state machine, combo chains, hit model, block/parry
    dodge.js              # roll/dash movement overlay on PlayerController
    stats.js              # derived player stats (from powers/styles/weapons)
  weapons/
    weapons.js            # weapon catalogue + categories — pure data (Phase 1, done)
    weaponModels.js       # procedural in-hand geometry per category (Phase 8)
  enemies/
    groups.js             # 34-encounter roster — pure data (Phase 1, done)
    templates.js          # behaviour archetypes + stat tiers — pure data (Phase 1, done)
    ranking.js            # ladder helpers — pure functions (Phase 1, done)
    spawner.js            # territory activation engine (Phase 5)
    enemyFight.js         # enemy combat verbs on NpcAgent (Phase 4)
    boss_overlord.js      # final boss FSM (Phase 13)
  powers/
    powers.js             # power definitions + taxonomy — pure data (Phase 1, done)
    steal.js              # Requital channel + grant application (Phase 6)
  progression/
    saveManager.js        # extends to save v2 (Phase 9)
  ui/
    combatHud.js          # health/stamina/boss bar/lock-on (Phase 3)
    hotbar.js             # weapon hotbar (Phase 8)
    styleLibrary.js       # style list/switch (Phase 7)
    rankScreen.js         # ranking list (Phase 9)
    vision.js             # Clear Vision HUD markers (Phase 11)
docs/
  GAME-DESIGN.md          # canonical concept (this rebuild)
  TECH-PLAN.md            # this file
```

Data modules are **DOM-free and Three-free** (mirrors the project's
`progression/` discipline) so they can be validated with plain `node`.

---

## 4. DATA SCHEMAS (contracted now, consumed by later phases)

### StyleDef (`combat/styles.js`)
```js
{
  id, name, identity,
  rhythm,           // intended hits/sec
  comboLength,      // max light-string hits
  damageTier,       // 'low'|'med'|'high'|'very high'
  reach,            // metres
  postureDamage,    // stagger meter per hit
  staminaPerHit,
  special: { id, name, cost, kind: 'strike'|'guard'|'area'|'grab'|'ranged' },
  guardPose,        // animator pose id (distinct per style)
  clips,            // { jab, cross, hook, kick, heavy, special } → gesture ids
  taughtBy,         // group id
}
```

### WeaponDef (`weapons/weapons.js`)
```js
{ id, name, category, damage, attackSpeed, range, specials[],
  animationSet, unlock: { group | default }, model: 'baton'|'sabre'|... }
```

### EnemyGroupDef (`enemies/groups.js`)
```js
{
  id, rank, name, weapon, style,                       // weapon: ONE category only
  territory: { name, hint },                           // seat hint for layout placement
  members: { min, max, leader },
  identity,                                            // one-line combat identity
  behaviour: 'brawler'|'counter'|'skirmisher'|'sorcerer'|'brute'|'assassin'|'commander',
  grants: { style?, powers[], weapon?, special? },
  memoryLead,                                          // text; reveals the next pin
  difficulty,                                          // 1..5 stars
  encounter: 'group'|'legendary'|'boss',
}
```

### EnemyTemplate (`enemies/templates.js`) — behaviour stat overlays
```js
{
  id, arch, healthMul, damageMul, attackSpeedMul, moveSpeedMul,
  blockChance, dodgeChance, reactionMs, postureMul, aggro, detectionMul
}
```

### PowerDef (`powers/powers.js`) — the 8 acquisition channels
```js
{
  id, name, channel: 'style'|'special'|'magic'|'weapon'|'defense'|'movement'|'knowledge'|'memory',
  rarity: 'common'|'warrior'|'elite'|'legendary',
  source: groupId,
  effect: { ...per-kind data },                        // consumed by combat/stats systems
  hue,                                                 // Requital Hand tint
}
```

### Save v2 (`saveManager.js`, Phase 9)
```js
{ v: 2, savedAt, seed, grid, density, player{x,z,yaw},
  cleared: [groupId...],                               // territories defeated
  styles: [styleId...], activeStyle, powers: [powerId...], powersEquipped: [id...3],
  weapons: [weaponId...], hotbar: [weaponId|null x9],
  stats: { killsByGroup: {id:n}, stolen: n },
  memories: [...], discovery: [...], progression: {...} }
```
`v1` saves are refused with a reason ("save from the old design") — never
eaten; a11y (`mt.a11y.v1`) and audio (`mt.audio.v1`) keys survive.

---

## 5. PHASE PLAN — 15 phases, each independently shippable

> Rule for every phase: **inspect first · small diffs · keep the game
> runnable · extend smoke · report files changed + how to test.**

### Phase 1 — Concept rebuild & architecture foundation ✅ (*this phase*)
- `docs/GAME-DESIGN.md`, `docs/TECH-PLAN.md` (this doc).
- Data foundation modules: `combat/styles.js` (15 styles),
  `weapons/weapons.js` (catalogue), `enemies/groups.js` (34-encounter roster),
  `enemies/templates.js` (behaviour archetypes), `enemies/ranking.js`
  (ladder), `powers/powers.js` (channelstaxonomy + defs).
- README gets a rebuild-status banner; no runtime behaviour changes.
- **Validate:** `node` import check of all data modules + integrity checks
  (ids unique, weapon categories valid, group↔style↔power references
  resolve), plus the existing dev boot unchanged.

### Phase 2 — Basic combat (player)
- `combat/config.js`, `combat/combatSystem.js`; combat gestures extend
  `animator.GESTURES` (jab/cross/hook/heavy poses); hit model =
  range+arc check at hit-frame; light/heavy/block/parry/lock-on; training
  helper: `SpawnControls`-style debug punches vs one dummy agent.
- **Hook:** `__MT_COMBAT__` reports FSM state, last hit, combo position.
- **Validate:** new `scripts/probe-combat.mjs` (attack hits agent, stagger,
  parry window numbers).

### Phase 3 — Player health, damage, dodge
- `combat/stats.js` + `combat/dodge.js`; i-frames, stamina costs/cooldowns;
  damage both directions (player can be hit); combatHud bars; out-of-combat
  regen; death → checkpoint respawn (territory edge).
- **Utilize:** HUD snapshot pattern; `__MT_PLAYER__` gains `hp/stamina`.

### Phase 4 — First enemy AI (combat verbs)
- `enemies/enemyFight.js` layers combat states onto `NpcAgent`
  (approach/wind-up/attack/block/dodge/stagger/subdued); `AGENT_TYPES`
  replaced by group-driven fighter configs from `templates.js`; enemies hit
  the player back; wind-up animations + sounds via `memoryAudio` cues.
- **Validate:** probe asserts an enemy lands hits, is staggered, enters
  subdued state.

### Phase 5 — Groups, territories & weapon restriction
- `enemies/spawner.js`: seat groups via deterministic layout anchors
  (extend `layout.js` query set, not its structure), territory rings
  (cityLife zones pattern), 3-nearest-territories activation, ≤8 active
  fighters; group defeat state; **assertion: every spawned group's members
  share exactly one weapon category** (data + runtime check).
- **Hook:** `__MT_GROUPS__` snapshot (rank, members, weapon, cleared).

### Phase 6 — Power & memory stealing (Requital)
- `powers/steal.js`: subdued prompt (`E`), channel ring reusing
  `memoryUI.startExtract` pattern; grants applied (style/powers/weapon);
  memory entries into the archive (generalized `MemoryManager` — same
  collect/cooldown API, new per-enemy data); memory-lead reveals next pin.
- **Hooks:** `__MT_STEAL__` (channel progress, grants pending/applied).

### Phase 7 — Fighting styles
- Style data wired into combatSystem; per-style animator pose sets (guard
  poses distinct — anti-uniformity contract verified by probe);
  styleLibrary UI; style switching in/around combat.

### Phase 8 — Weapons & hotbar
- `weaponModels.js` (MeshBuilder geometry per category, in hand,
  collider-honest ranges); `ui/hotbar.js` (9 slots, wheel + 1–9, selection
  ease, empty slots, acquire toast); enemy-held weapons appear on enemies
  (matches their group category).

### Phase 9 — Ranking & progression
- `ranking.js` consumed: HUD rank chip, next-target logic, cleared
  territories in save **v2**; difficulty-gated rank jumps per design §15.

### Phase 10 — Map & territory markers
- minimap + mapScreen consume territory snapshot: rank-coloured pins, leader
  crowns, cleared glyphs, next-target arrows, crimson boss beacons; discovery
  by border/entry/memory/Clear-Vision rules.

### Phase 11 — Stealth & Clear Vision
- Stealth re-scope (detection modifiers, spine-break opener) using
  `stealthSystem`; `ui/vision.js` markers over enemies (rank numerals,
  leader crowns, boss aura) reusing the existing sight-glow approach;
  power slots UI.

### Phase 12 — Story & missions wiring
- Memory choreography (background → organization → weakness → next lead →
  hidden world facts), act gates, the echo/mirror encounters (28, 33 data),
  non-repetitive beat types (duel, siege, trap, ambush, mirror).

### Phase 13 — THE OVERLORD
- `boss_overlord.js`: 3-phase FSM, telegraph rings (red/amber/violet),
  ≥0.5 s wind-ups, recovery windows, posture-break damage phases, boss bar,
  arena lock-in, ending flow (KEEP/RELEASE).

### Phase 14 — Complete HUD & polish
- Lock-on bars, damage numbers, hit/parry popups, style chip, rank screen
  (`K`), progression screen (`T`), welcome/settings copy re-title to v2
  concept, icon pass.

### Phase 15 — Optimization, testing, polish
- Perf pass (spawn budget, cull radii, instancing), full smoke rebuild of
  group coverage + balance tuning, a11y verification, final README refresh
  (the current README describes v1 concept — it is rewritten here, last).

---

## 6. TESTING STRATEGY

- **Keep** the smoke harness pattern: no fixed sleeps — `until()` polling of
  `__MT_*` snapshots; screenshots best-effort.
- **New hooks** (declared in `src/main.js`, namespacing stays `__MT_*`):
  `__MT_COMBAT__` (FSM state, last hit), `__MT_DODGE__` (i-frame window,
  cooldown), `__MT_ENEMY__` (per-agent combat state, wind-up progress),
  `__MT_GROUPS__` (territory/member/weapon/cleared), `__MT_STEAL__`
  (channel, pending grants), `__MT_STYLES__`, `__MT_HOTBAR__`, `__MT_RANK__`
  (player rank, next target), `__MT_MAP_PINS__`, `__MT_VISION__`,
  `__MT_BOSS__` (phase, posture, attack id).
- **Sanity tooling:** `scripts/probe-combat.mjs`, `scripts/probe-enemies.mjs`
  (later phases) + a data-integrity runner (`node scripts/check-data.mjs`)
  for the Phase 1 modules.
- **Determinism:** enemy groups seat themselves from the seeded layout RNG,
  so probes can teleport (`__MT_TP__` pattern) to a known territory.

## 7. PERFORMANCE RULES (early, not afterthought)

- ≤ 8 active fighters (quality-weighted), 3-territory activation radius,
  dormant nodes otherwise — figures reuse the crowd instancing/cull patterns
  (`FIGURE_CULL`, cityLife rig cull).
- Combat VFX = geometry/overlays only (no new fullscreen passes; bloom stays
  the single selective pass).
- No per-frame allocations in the hit model (reused vectors), matching the
  codebase's zero-GC heartbeat discipline.
- Boss inherits actor cap — the Overlord fight keeps the arena crowd ≤ 3.

## 8. RISKS & MITIGATIONS

| Risk | Mitigation |
| --- | --- |
| Old concept content (glove lore, fragments, annex) interleaves with new | Phases port them in order; nothing lore-breaking changes until Phase 14 copy pass |
| Enemy AI complexity on NpcAgent | `enemyFight.js` owns combat modes; perception/alert cascade stays untouched |
| Save-shape change | v2 with refuse-with-reason validation, like v1's `validateDoc` |
| Performance on software GL | actor caps + existing preset scaling; combat probes run on Low, fine on GPU |
| Smoke suite scope drift | every phase extends smoke before merging; old checks adjusted only when the phase legitimately changes that system |

---

## 9. CURRENT STATUS

- [x] Phase 1 — design + architecture foundation (this phase)
- [ ] Phase 2 — basic combat
- [ ] Phase 3 — health/damage/dodge
- [ ] Phase 4 — first enemy AI
- [ ] Phase 5 — groups & weapon restriction
- [ ] Phase 6 — power/memory stealing
- [ ] Phase 7 — fighting styles wired
- [ ] Phase 8 — weapons & hotbar
- [ ] Phase 9 — ranking & progression
- [ ] Phase 10 — map markers
- [ ] Phase 11 — stealth & clear vision
- [ ] Phase 12 — story & missions
- [ ] Phase 13 — Overlord boss
- [ ] Phase 14 — complete HUD & polish
- [ ] Phase 15 — optimize & test
