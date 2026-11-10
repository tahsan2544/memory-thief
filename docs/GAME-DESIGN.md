# MEMORY THIEF — GAME DESIGN v2 (FIGHTING REBUILD)

> **Status:** Canonical design. Replaces the memory-investigation/adventure design.
> **Tech stack unchanged:** Three.js + Vite, JavaScript, same project structure,
> same procedural city, same procedural audio, same test tooling.

---

**One line:** A third-person open-world fighting game where **every enemy you
defeat adds their power to you**, and every memory you steal brings you closer
to the strongest fighter in the world.

---

## 1. GAME IDENTITY

| Field | Value |
| --- | --- |
| Name | MEMORY THIEF |
| Genre | Third-person open-world action fighting game |
| Camera | Third-person over-shoulder, lock-on capable (existing camera retained) |
| World | One procedural living city, rebuilt as a ladder of gang **territories** |
| Core fantasy | **START WEAK → DEFEAT → STEAL → GROW → CLIMB THE RANKS → DETHRONE THE OVERLORD** |

The protagonist begins as an **ordinary fighter** — bare hands, no powers, no
weapons, no real technique. Eidolon City is dominated by a pyramid of armed
gangs, martial-arts schools, weapon specialists and supernatural fighters.
Every defeated enemy passes their **fighting style, signature attacks, weapon
skills, bodily abilities and memories** to the player. Victory is the only
progression. The final goal is the Overlord — the last fighter at the top of
the pyramid.

**Design pillars**

1. **Defeat means acquisition** — no two enemies grant the same thing.
2. **Readability before spectacle** — every attack (theirs and yours) has a
   telegraph, wind-up, and recovery the player can learn.
3. **Reachable ceiling** — 30+ ascending encounters, each teaching the tools
   needed for the next one.
4. **The city remembers you** — territories you clear stay cleared, and the
   world visibly reacts to your rank.

---

## 2. MAIN CHARACTER

**Name (player-chosen nickname in-game): "The Thief."** Build is procedurally
generated in the character rig the project already owns — ten articulated
meshes, knees/elbows/pelvis/head pivots — and gains combat states.

### Starting kit

| Stat | Start value (base) |
| --- | --- |
| Health | 100 |
| Stamina | 100 |
| Attack damage | 8 (unarmed jab) |
| Defence | 0% |
| Move speed | 5.2 m/s walk / 8.0 m/s sprint (existing controller values) |
| Dodge cooldown | 1.4 s |
| Styles known | **Basic Scrapper** (jab–jab–straight, block, dodge) |
| Weapons owned | **None** — fists only |
| Powers owned | None |

### Starting moveset

- **Light punch** — fast, short reach, chains into 3-hit string.
- **Heavy punch** — slower, higher damage, staggers lesser enemies.
- **Block (hold)** — reduces incoming damage, drains stamina on hit.
- **Counter** — block timed within 0.25 s of impact → brief stagger on the attacker.
- **Dodge** — roll/dash left, right, backward; forward is a dash (see §10).
- **Lock-on** — soft target in front, hard lock with `Q`/centre-click.

### Visual evolution (must be visible)

- Stolen styles change **idle and combat poses** (boxer guard vs karate open
  hand vs wrestler crouch).
- Equipped weapons appear **in hand** (their real ray/impact range matches reach).
- Rank milestones change **outfit accents** (torn shirt → taped fists → tag
  colours → ostentatious stole/gear from defeated elites).
- The memory-glove visual becomes the **Requital Hand** — it glows with the hue
  of the last power stolen, dimming as that power's charge cooldown expires.

---

## 3. POWER-STEALING SYSTEM — the Requital

The game's defining mechanic. When an enemy's health reaches zero they fall
into a **subdued state** (kneeling, dazed — not gore): a prompt shows
**`E — STEAL THE REQUITAL`** with the enemy's power card. Stealing takes a
short channel (1.2 s, wall-clock), interruptible by damage; skipping the
channel (walking away) performs a quick auto-steal without the memory detail.

### The eight acquisition channels

| # | Channel | What it gives | Storage |
| --- | --- | --- | --- |
| 1 | Fighting style | Full moveset module (§4) | Style library |
| 2 | Special attack | Signature move bound to style/weapon | Style extras |
| 3 | Magical ability | Projectile / elemental / area craft | Power slots |
| 4 | Weapon skill | Handling proficiency + weapon unlock | Weapon inventory |
| 5 | Defensive ability | Parry, guard-break shield, recovery | Power slots |
| 6 | Movement ability | Dodge variant, dash, wall-kick, leap | Power slots |
| 7 | Combat knowledge | Passive stat gain (damage/HP/defence/speed) | Permanents |
| 8 | **Memory** | Story intel + weaknesses of the next ranks | Memory archive |

### Unique profiles — never identical grants

Every enemy archetype defines a **power profile**:

| Enemy template | Profile granted |
| --- | --- |
| **Boxer** | Heavy punches, fast jab combo, liver-hook uppercut |
| **Karate fighter** | Precise kicks, strong counterstance, block-breaking straight |
| **Magic user** | Fire/ice/arcane bolt, ring nova (area), ward shield |
| **Sword fighter** | Sword combo string, parry-stance, helmsplitter finisher |
| **Speed fighter** | Double dash, flurry taps, improved dodge window |
| **Heavy fighter** | Overhead smash, sweep, charge tackle |

### Memory stealing

Stolen memories open the **Memory Archive** and reveal, per enemy:

- their **background** (who trained them, what they owe the gang),
- their **organization** and its master,
- the **weakness** of their group combat style,
- the **connection** to the next stronger gang (this powers the map — §11),
- **hidden world facts** that assemble the Overlord narrative in §14.

Memories chain the storyline: a group's last member yields the true name and
location of the next territory. First time a memory names a group, its map pin
appears (discovery mechanic §11).

---

## 4. FIGHTING SYSTEM

### Base combat rules

- Attacks cancel out of recovery when cancelled by dodge (dodge-cancel window
  0.18 s after hit-frame) — the spine of expressive combat.
- **Hit reactions**: quick flinch (light), stagger (heavy/guard-break),
  knockdown (finisher/crit) with get-up invulnerability 0.8 s.
- **Stagger meter** — sustained damage stuns; brutes resist via posture stat.
- Lock-on rotates both fighters toward each other with soft speeds.

### Combat verbs (keyboard)

| Input | Verb |
| --- | --- |
| `LMB` | Light attack (string cap 3–6, style-dependent) |
| `RMB` / `Shift+LMB` | Heavy attack / launch |
| `Hold RMB` while defending | Block |
| `RMB` timed during enemy wind-up | Parry/counter (style-gated) |
| `Space` (double-tap direction) | Dodge/dash |
| `Q` click | Lock-on cycle |
| `1`–`9` + wheel | Weapon hotbar (§5) |
| `F` | Style special / power slot |
| `V` | **Clear Vision** (§10) |

### Fighting styles (modular system)

Styles are **data-driven modules**: `{ move strings, speed, damage curve,
range, stamina cost, posture strength, animation set, special move,
unlock source }`. All 14 are implemented through the procedural animator with
distinct silhouette poses — no two styles share a guard stance or combo rhythm.

| Style | Identity | Rhythm (hits/s) | Damage | Range | Signature | Taught by |
| --- | --- | --- | --- | --- | --- | --- |
| Basic Scrapper | wild but honest fists | 2.2 | low | short | Desperation shove | start |
| **Boxing** | jab economy, head movement | 3.0 | med | short | Liver-hook chain liver→uppercut | Iron Fists |
| **Karate** | precise kicks, counter stance | 2.0 | med | med | Counter-punch sidekick | Shadow Kickers |
| **Kung Fu** | flowing chains, low sweeps | 2.6 | med | med | Crane-wing parry riposte | Crane Temple Society |
| **Taekwondo** | vertical kicks, gap closer | 2.2 | med | long (kick reach) | Scissor aerial | Twin Talons |
| **Kickboxing** | punch–kick hybrids | 2.8 | high | med | Spin-back elbow→high kick | Market Reapers |
| **Muay Thai** | clinch, elbows, knees | 1.8 | high | short | Plumb clinch knee burst | Knees of Northgate |
| **Wrestling** | grabs, takedowns, ground-punch | 1.2 | very high | contact | Vault slam (AOE when thrown into crowd) | Verdant Bearstyle |
| **Street fighting** | dirty tricks, sand, rescues | 2.4 | med | short | Bottle jab (breaks guard) | Alley Fighters |
| **Sword fighting** | long reach, edged arcs | 1.9 | high | long | Helmsplitter finisher | Blade Runners |
| **Staff fighting** | spinning control, sweeps | 2.1 | med | very long | Storm Star (full-arc spin) | Iron Staff |
| **Knife fighting** | fast, short, bleed stacks | 3.4 | low+bleed | contact | Twist the Wound | Venom Crew |
| **Magical combat** | ranged, elemental, area | 1.3 | med | ranged | Bolt / Nova / Ward triad | Flame Order |
| **Heavy combat** | slow, stagger machines | 0.9 | very high | med | Quake Smash (ground impact) | Heavy Crushers |
| **Speed combat** | blur steps, flurry | 4.0 | med | short | Afterimage flurry cross | Ghostline Couriers |

Style switching is allowed outside combat (and through a 1.2 s "reforge"
animation when locked-on mid-fight, costing stamina).

**Anti-uniformity contract (acceptance criteria):** any two styles must differ
in >= 3 of {combo length, hit cadence, reach, posture damage, default
animation pose set, special move class}.

---

## 5. WEAPON SYSTEM

### Weapon categories and data

Each weapon instance: `{ id, category, damage, attackSpeed, range, specials[],
animationSet, unlock, upgrade? }`. Weapons are **_fictional-finalized_ to the
city** — no real-world brands. Categories:

`FISTS` (free) · `BATON` · `KNIFE` · `SWORD` · `STAFF` · `HAMMER` · `AXE` ·
`CHAIN` · `GAUNTLET` (weighted combat gauntlets) · `FOCUS`
(magic foci: shackle-charms, ember-prisms)

Illustrative catalogue (final counts set in phase 8):

| Weapon | Cat | DMG | SPD | Range | Special |
| --- | --- | --- | --- | --- | --- |
| Wrapped fists | FISTS | 8 | 3.0 | 1.3 m | — |
| Composite baton | BATON | 14 | 2.4 | 1.7 m | Guard-break jab |
| Willow knife | KNIFE | 10 | 3.4 | 1.2 m | Bleed |
| Blade Runner sabre | SWORD | 22 | 1.9 | 2.6 m | Parry stance |
| Iron Staff | STAFF | 16 | 2.1 | 3.2 m | Storm Star spin |
| Crusher maul | HAMMER | 38 | 0.9 | 2.2 m | Ground shockwave |
| Glassline hatchet | AXE | 27 | 1.4 | 2.0 m | Armor shred |
| Salvage chain | CHAIN | 15 | 2.2 | 3.8 m | Snare pull |
| Ember prism | FOCUS | 12+ranged | 1.3 | 18 m | Bolt / Nova / Ward |

### Weapon hotbar (centre-bottom)

- **Up to 9 slots**, selection via `1`–`9` and **mouse wheel**; wheel wraps.
- Each slot: weapon **icon** (procedurally drawn from its silhouette), damage
  glyph, key number, and **selection highlight** with a smooth grow/shrink
  ease on change. Empty slots show a dim outline.
- **Acquisition toast**: when a weapon unlocks, its icon **flickers in** with
  a vertical sweep and the HUD announces `NEW WEAPON — BLADE RUNNER SABRE`.
- Art is original (no Minecraft assets); visual identity matches the game's
  neon-on-dark HUD language.
- Weapons equip on select with a 0.35 s swap pose (cancelled by attacking).

---

## 6. ENEMY SYSTEM

### Enemy configuration schema (single source of truth)

```js
{
  id, name,                       // "Venom Crew Cutter"
  group,                          // → EnemyGroup
  rank,                           // world power rank
  template, behaviourAi,          // see behaviour archetypes below
  health, damage, attackSpeed,    // numbers scaled by tier
  moveSpeed, attackRange, detectionRange,
  weapon: CATEGORIES.*,           // MUST match group weapon rule
  style,                          // combat style id (§4)
  specials: ['bleed','smoke'] ,   // ability tags
  defencePct, posture,            // defence & anti-stagger
  difficulty,                     // 1..5 stars, shown on map
  reward: { powers:[], weapon?, memory: MemoryRef }
}
```

Configuration rules — **all 30+ templates** use this schema; every field is data.

### Behaviour archetypes (distinct AI, not difficulty clones)

| Archetype | Combat logic |
| --- | --- |
| **Brawler** | Rush in, light-string abuse, retreats when stamina low |
| **Counter-guard** | Holds block, punishes, opens only on your recovery |
| **Skirmisher** | Hit-and-run arcs, dodge-heavy, baits heavies |
| **Sorcerer** | Keeps 8–14 m, channels spells, teleports on approach |
| **Brute** | Slow, posture-heavy, AOE smashes, ignores light stagger |
| **Assassin** | Attempts stealth approach, blinks behind, poisons |
| **Commander** | Buffs allies (+speed/+defence), orders focused attacks |
| **Specialist (group-web)** | Each group adds one unique behavior hook |

### Shared AI verbs (all enemies)

Detect → approach to attack range → attack with **their** style → block/dodge
(where appropriate) → hit reactions → tempered stun window ⇒ revenge window →
coordinate (flanking call within 18 m of group member) → retreat/reposition if
cornered or posture broken → use specials when metered.

### Group weapon restriction (hard rule)

> **Every group fights with EXACTLY ONE weapon category.** Ranks, HP, damage
> and abilities vary within the group; weapon category never varies. The
> category is part of the group's identity, and stealing the group power
> yields its weapon family techniques.

---

## 7. WORLD POWER RANKING — 34 encounters

Full roster. **30+ groups, distinct combat identities, no rank reskins.**

| # | Group | Weapon cat | Combat identity | Territory | Members | Leader | Granted powers (top 1–2) | Memory lead |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Street Pickpockets | FISTS | crude slaps, crowd flanks | Old Quarter fringes | 6–8 | "Fingers" Mattea | Jab combo, crowd misdirect | their fear of the Brickyards gym |
| 2 | Alley Fighters | BATON | street fighting | Alley warrens | 5–7 | Brick Kell | Bottle jab (guards break), gritty grit | tells of the Brickyards |
| 3 | Iron Fists | FISTS | boxing | The Brickyards | 4–5 | Marlow "The Bell" | Jab–hook chain, guard bob | names Shadow Kickers' temple |
| 4 | Shadow Kickers | FISTS | karate kicks & counters | Temple of the Open Palm | 5–6 | Master Iho | Sidekick counter, ward stance | flags the Blade Runners' territory |
| 5 | Blade Runners | SWORD | rooftop sabre fencing | Glassline rooftops | 4 | Valea of Cobalt | Sabre string, parry stance | exposes Venom crew map |
| 6 | Venom Crew | KNIFE | canal assassins | Floodworks | 5–6 | Rill the Ninefold | Twist the Wound, bleed | reveals the Iron Staff pump-house |
| 7 | Iron Staff | STAFF | pump-house monks | Floodworks pumphouse | 4–5 | Elder Tolv | Storm Star, sweeping control | marks the Heavy Crushers' scrapyard |
| 8 | Heavy Crushers | HAMMER | demolition brutes | The Scrapyard | 3–4 | Mother Girder | Quake smash, posture shield | whispers of the Silent Guards |
| 9 | Silent Guards | BATON | stealth patrol | Underarchive perimeter | 6–8 | Warden Cole (silent) | Cover loop, body cocoon | uncovers the Flame Order shrine |
| 10 | Flame Order | FOCUS | fire magic cult | Ember shrine, Verdant Ward | 4–5 | Ashpriest Drovey | Ember bolt, ring nova | reveals the pyramid diagram scratched on shrine stone |
| 11 | Chainbreakers | CHAIN | flood-gate chain work | Bridge Warrens | 5–7 | Ors the Brakeman | Snare pull, bridge swing | names Crane Temple |
| 12 | Crane Temple Society | FISTS | kung fu flowing chains | Rooftop dojo | 5–6 | Abess Liang Fong | Crane parry-riposte, low sweep | points to Twin Talons |
| 13 | Twin Talons | FISTS | taekwondo aerials | Verdant stair courts | 4–6 | The Talon sisters | Scissor aerial, gap-closing kicks | flags the Northgate gym |
| 14 | Knees of Northgate | FISTS | muay thai clinch | Northgate Tower | 4–5 | Rokkai the Clinch | Plumb clinch knees, elbow burst | reveals the Gilded Axes site |
| 15 | Gilded Axes | AXE | glass-cutting heavies | Glassline construction | 4 | Frae Gilded | Armor shred, cleave arcs | names the Market Reapers |
| 16 | Market Reapers | BATON | kickboxing enforcers | Night Market stalls | 5–7 | The Harrows | Spin-back elbows, reaping legs | flag the Ropesisters |
| 17 | Ropesisters | CHAIN | speed & snare | Underpit gallows | 3 | Lissa, First Rope | Instant snare, hit-and-pull | exposes Ghostline couriers |
| 18 | Ghostline Couriers | KNIFE | afterimage assassins | Transit tunnels | 3–4 | Vesper Ninth | Afterimage flurry, vanish step | names the Pale Staff Choir |
| 19 | Pale Staff Choir | STAFF | hybrid magic/monks | Chapel spine | 4–5 | Cantor Ilve | Aura bolt, banner sweep | marks the Smelter Hammers |
| 20 | Smelter Hammers | HAMMER | foundry brutes | Foundries | 3–4 | Ossen Fahrenheit | Molten slam, heat haze | points to the elite tier: the Bearstyle |
| 21 | Verdant Bearstyle | FISTS | wrestling ground game | Park arena | 4 | Mother Bear | Vault slam, choking grip | predicts Glassline Fencers |
| 22 | Glassline Fencers Guild | SWORD | precision fencing | Guild hall | 4–5 | Duelist Sera | Riposte-lunge, perfect parry | hints at the Undershine |
| 23 | The Undershine | FOCUS | corruption/ice magic | Archive depths | 3–4 | Rheem, Cold Spark | Bolt chains, rime ward | points to the Ashknives |
| 24 | Ashknives | KNIFE | poison/speed elite | Chimney rows | 3–4 | Smokefather Ilse | Smoke vanish, poison flurry | names the Molded Ones |
| 25 | The Molded Ones | GAUNTLET | armored fist brutes | The Revered Steel | 3 | Saint Gonze | Anvil jab, brace slam | marks the Rodbearers |
| 26 | Skyward Rodbearers | STAFF | vertical leaps, staff | Tower cranes | 3 | Sigil Rodbearer | Leap slam, skyfall sweep | flags the Hollow Crown Guard |
| 27 | Hollow Crown Guard | SWORD | bodyguard swordwork | Overlord's gate | 5–6 | Captain Vell | Counter-lunge, paired-cover drill | — first direct hint: the Overlord's name |
| 28 | Echoes in Grey | FOCUS | mind-echo, **mirrors your stolen moves** | Echo halls | 4 | The Grey Kindred | — copies 2 of your latest powers | reveals Overlord's own past |
| 29 | The Seven Sirens | CHAIN | coordinated group combos | Bell paths | 7 | The Sirens (shared mind) | Group snare weave, cross-pull | hand-delivers the Overlord's arena location |
| 30 | Kael the Unmoved | AXE | single legend, counter-heavy | West ring | 1 | Kael | Unbroken counter (revenge stance) | names Sister Metera |
| 31 | Sister Metera, Flame Justicar | FOCUS | boss caster | Memorial spire | 1 | — | Nova chorus, serpent flame | reveals the Warden Crucible |
| 32 | Warden Crucible | HAMMER | prison titan | The Core gallows | 1 | — | Chain cage, ground ripples (wide slam) | reveals Grandmaster Yuen |
| 33 | Grandmaster Yuen | FISTS | — **mirrors every style you know** | The Summit ring | 1 | — | — adopts your strongest 3 | admits the Overlord's identity |
| 34 | **THE OVERLORD** | GAUNTLET+FOCUS | see §9 | Overlord's thesis arena | 1 | — | — boss phases | — final truth (§14) |

Counts: 34 encounters ≥ required 30. The unarmed schools (ranks 1, 3, 4, 12,
13, 14, 21, 33) deliberately share the FISTS category — the one-weapon-per-
group rule bans mixing categories *within* a group, not the reuse of one
category across groups.

Every encounter introduces **new attack patterns or defenses** — e.g. rank 2
adds guard-breaking, rank 4 adds counters, 5 adds reach weapons, 10 adds
projectiles, 18 adds blink approach, 22 adds perfect parry (forces you to use
feints), 27 introduces **double-cover cover drill**, 33 forces style mirror
play — new mastery, not padding stats.

---

## 8. ENEMY GROUP SYSTEM

Each territory holds one group with:

- **Territory name + border ring** on the map (discovered variants highlighted),
- distinct **colours/glyphs** on members (appliqué stripes by rank),
- **1 leader** (distinct silhouette + nameplate), 2–8 regular members,
- a **rank** and **difficulty stars (1–5)**,
- a **group reward** (cleared when the leader is defeated; lesser members drop
  lesser invite powers and weapon materials).

### Spawning discipline (performance)

- Only the **3 nearest territories** hold active actors; members are seeded
  dormant; activation by distance gates with hysteresis around the player.
- Actor cap **≤ 8 active fighters at once**, weighted by quality presets.
- Defeating a territory group **clears it permanently** in the save.

---

## 9. FINAL BOSS — THE OVERLORD

An **enormous** final fighter — heavy, muscular-to-fat mass archetype, ~3.2 m
rig scale, with **recovery windows** that are the player's true damage phases.

| | |
| --- | --- |
| Style | Heavy combat + absorbed magic (a "final gallery" of the game's own systems) |
| Stagger resistance | Very high posture — only stance-breaks after parry-punishes of his recovery |
| Ends with | Setting the city's memory balance right (§14) |

### Three phases (arena-wide, readable)

- **Phase 1 — "The Wall."** Heavy punches, grabs, wide-area sweeps.
  Learnable rhythm, generous recovery. Boss bar fills as you break posture.
- **Phase 2 — "The Collector."** The Overlord begins **using powers you have
  stolen during the game** (your own kit reflected back). Attack combos
  lengthen, adds short charge dashes.
- **Phase 3 — "The Requital of all."** Arena-wide ground impacts, radial nova,
  chain snare across the stage, mixed weapon projections. Fully telegraphed
  with charging ring markers and sound cues; **recovery windows** marked by a
  heavy exhale VFX where he drops guard.

Every attack: **wind-up lead-in ≥ 0.5 s, distinct sound silhouette, and a
ground ring color** (red = strike, amber = AOE, violet = memory/magic).

---

## 10. PLAYER ABILITIES

### Stealth mode (kept system, re-scoped)

- `C` toggles a **low-profile crouch**: enemies' detection range drops 45–60%,
  closing in behind triggers the **spine-break opener** (one bonus hit; never
  an instant kill). Stealth uses the existing cover/zones structure.
- Meter depletes while sprinting; recharges standing still.

### Clear Vision (`V`)

Highlight pass revealing nearby enemies **through walls**, showing:

- enemy location markers with **rank numeral + difficulty colour**,
- group **boundary rings** (territory glow),
- leaders with a **crown icon**, bosses with an **unique aura**,
- elite (★4+) enemies flash red vs ordinary solid-blue vs boss crimson.

Duration 16 s / cooldown 45 s at unlock (upgradable exactly like the existing
sight to 20 s / 31 s).

### Dodge system

- **Left / right / back roll** (1.1 m, 0.6 s, brief i-frame window **first
  0.18 s**), forward **dash** 2.2 m.
- Dodge cost: 22 stamina, cooldown 1.4 s (style modifiers apply — Speed
  combat lowers both).
- Dodge-cancel window (§4) ties offense and defense into one loop.

### Modular power slots (unlockable)

Movement (double dash, wall-kick), defense (energy shield, auto-parry),
offense (finishers), detection (better Clear Vision) — each is a data entry
under the same Power schema as §3; hooking follows the power-slot UI in §13.

---

## 11. MAP & ENEMY-LOCATION SYSTEM

- **Minimap (top-right radar)** retains the existing radar tech — extended:
  - group territory pins **once discovered** (memory reveal, Clear Vision, or
    entering), colour = difficulty tier (blue→green→amber→red→crimson),
  - leader crown badge on the pin,
  - defeated territories — greyed with check glyph; undiscovered — nothing,
  - hostiles within the window as small chevrons.
- **Full-screen map (`M`)** keeps territory discovery semantics and gains:
  - group name, rank numeral, weapon glyph on discover,
  - progression target arrows to the **next rank** (compute from ranking §7),
  - boss pins (crimson beacon).
- **Discovery mechanics:** walking into the border ring reveals a pin;
  a stolen memory can reveal out-of-reach pins; Clear Vision reveals
  on-screen, unpinned enemies but not permanently the territory.

---

## 12. HEALTH & COMBAT STATISTICS

Player stats: **Health, Stamina, Attack, Defence %, Move speed, Dodge
cooldown, Style (active), Weapon (equipped), Powers (equipped up to 3 slots),
Rank.** Enemy stats: exactly the §6 schema. Values are all data-tunable.

**Balance rule:** growth is serial, never inflationary — a newly stolen style
raises power but end-rank enemies have their posture/detection scaled to the
expected player rank, so late games remain fights, not foregone conclusions.

Health model: player damage absorbed by defence% (multiplicative pre-stamina),
stamina bar gates per-verb; no regen **in-fight** beyond the style's
recovery stance; out-of-combat regen 4 HPS after 8 s calm.

---

## 13. USER INTERFACE — specification

### Main HUD

- **TOP LEFT** — name, current rank (numeral + title e.g. `RANK 07 · GLOVED`),
  active territory.
- **TOP CENTRE** — **lock-on target health bar** (or **BOSS BAR** when boss),
  rank name and group glyph; target's name below in small type.
- **TOP RIGHT** — radar (existing tech, extended per §11).
- **LEFT/BOTTOM-LEFT** — health + stamina bars (readable, styled to game),
  power slots (up to 3) with cooldown sweeps.
- **BOTTOM CENTRE** — **weapon hotbar** (§5).
- **BOTTOM RIGHT** — style chip (active style + swap hint), dodge/stealth
  cooldown ticks.
- **MIDDLE** — steal prompt when target is subdued; steal channel ring;
  damage numbers; hit/parry/counter pop-up callouts.

### Full interfaces

| Surface | Key | Contents |
| --- | --- | --- |
| Inventory & powers | `I` | owned weapons (→ hotbar listing), power list, stat sheet |
| Style library | `L` | all learned styles, per-style move lists, switch control |
| Ranking list | `K` | the 34-encounter ladder, cleared checkmarks, next target |
| Memory archive | `J` | reuses the journal surface — new data: memories per §3 |
| World map | `M` | per §11 |
| Settings | `P` → Settings | preserves existing settings + accessibility |
| Progression/status | `T` | rank, stats acquired, powers count, invites |

All new UI uses the game's established visual language (existing CSS tokens),
and is keyboard-navigable + touch-scale aware like current panels.

---

## 14. STORYLINE

### Premise

Eidolon City has a pyramid. Its top is the **Overlord**, who killed every
grandmaster that gathered under him and took their powers; his rule is
enforced by ranking gangs, each owing the one above it. Nobody at the bottom
remembers this end of the chain — memory of your own power is the first thing
his regime takes.

The protagonist is nobody — until a rogue **Requital Hand** (the game's glove)
attaches itself to them in a gutter brawl and begins doing the forbidden
thing: transferring defeated fighters' prowess *and* memories into the bearer.

### Act structure

- **ACT I — The Unschooled (Ranks 1–9).** Gain standing through the
  pickpocket→axe/heavy tier. Learn the noun of the game: steal, grow, proceed.
  The Second act begins when the Flame Order's memory reveals the pyramid
  diagram scratched on shrine stone.
- **ACT II — The Ladder (Ranks 10–20).** Factions with doctrines; the player
  learns ranged/counter tools; memories assemble the chain of who commands
  whom, culminating in **a ranking list** — the ladder is *itself* maintained
  by a ranking scribe (minor antagonist realised in rank 19–20).
- **ACT III — The Elites (Ranks 21–29).** The Overlord's city lieutenants;
  echoing grey mind-mages mirror your stolen kit to warn you how it ends:
  *to accumulate is to be collected* — the Overlord was himself once a Thief.
- **FINALE — Legends & the Overlord (30+).** Kael can't be bribed, the
  Justicar warns you "you'll be counted anyway," Crucible guards the *arena
  where past thieves died*, Yuen mirrors your full kit as your final exam —
  then the summit: the Overlord's three phases and the ending (§14b).

### 14b Ending

Defeat the Overlord; in the last channel he begs you to take everything. The
player chooses: **KEEP** the pyramid (become the new rank-zero power) or
**RELEASE** — the Requital Hand previews: every stolen power unspools back
into the city as an empty-handed ghost. Either ends the main story; the city
persists for free-fight experimentation.

### Storytelling rules (checked)

- every group has a reason (surface occupation + subplot in their memory),
- every leader has a personality (one-liner + behaviour tint),
- leaders carry individual memories; regular members carry group memory,
- defeating a group **unlocks** the next story beat — never just a stat dump,
- the world *says* your rank: territory gangs step aside, lower ranks refuse
  to attack you once you are 6+ ranks above.

---

## 15. BALANCE, DIFFICULTY & POWER CURVE

- Player damage/HP baseline ×1 → ×~9 by rank 33, but enemy HP scales too;
  *the real long-run change is skill coverage* (styles/abilities), not numbers.
- Rank jumps of ≥ 2 are gated by content — later tiers require a specific
  stolen tool (e.g. an anti-armor style against the Foundries tier).
- Fail states are non-punishing: respawn at territory edge, group HP resets.

---

*This document is the contract the implementation plan (TECH-PLAN.md) maps
against; any change to gameplay must update here first.*
