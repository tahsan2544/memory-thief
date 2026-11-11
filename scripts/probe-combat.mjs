/**
 * Combat probe — MEMORY THIEF v2 (docs/TECH-PLAN.md Phase 15).
 *
 * Proves the power-stealing loop end to end through the REAL input paths:
 * BEGIN → stream the rank-1 gang → lock-on → strike → heavy → dodge →
 * guard → subdue the whole group → hold E for the Requital → ledger +
 * loadout update → damage → defeat → get-up → save/load round trip.
 *
 *   npm run probe:combat
 *
 * Env overrides:
 *   PROBE_URL     http://127.0.0.1:6031   (6030 is the smoke suite's port)
 *   PROBE_OUT     <folder>                (default: probe/)
 *   PROBE_SEED    eidolon-77
 *   PROBE_QUALITY low
 *   PROBE_GRID    12
 *
 * Rules of the road (learned the hard way): never edit a source file while
 * this or the smoke suite is running — Vite HMR full-reloads the page and
 * invalidates the run mid-hook.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const BASE_URL = process.env.PROBE_URL ?? 'http://127.0.0.1:6031';
const OUT_DIR = resolve(root, process.env.PROBE_OUT ?? 'probe');
const SEED = process.env.PROBE_SEED ?? 'eidolon-77';
const QUALITY = process.env.PROBE_QUALITY ?? 'low';
const GRID = process.env.PROBE_GRID ?? '12';

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const GROUP_ID = 'street-pickpockets'; // rank 1 — the first Requital

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Screenshots are evidence, never checks — SwiftShader can be slow. */
async function shot(page, warnings, file) {
  try {
    await page.screenshot({ path: join(OUT_DIR, file), type: 'png' });
    console.log(`[probe] captured ${file}`);
  } catch (err) {
    warnings.push(`screenshot failed: ${file} — ${err.message}`);
    console.log(`[probe] warn  screenshot failed: ${file} — ${err.message}`);
  }
}

function findEdge() {
  for (const p of EDGE_PATHS) if (existsSync(p)) return p;
  return null;
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(400);
  }
  return false;
}

async function main() {
  const puppeteerMod = await import('puppeteer-core').catch(() => null);
  if (!puppeteerMod) {
    console.error('[probe] puppeteer-core is not installed — run `npm install` first.');
    process.exit(2);
  }
  const puppeteer = puppeteerMod.default;

  const executablePath = findEdge();
  if (!executablePath) {
    console.error('[probe] Could not find Microsoft Edge.');
    process.exit(2);
  }

  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  // --- dev server (its own port so it never collides with `npm run smoke`) --
  let server = null;
  const up = await waitForServer(BASE_URL, 2500);
  if (!up) {
    console.log('[probe] starting dev server…');
    server = spawn('npx', ['vite', '--port', '6031', '--strictPort'], {
      cwd: root,
      shell: true,
      stdio: 'ignore',
      detached: false,
    });
    if (!(await waitForServer(BASE_URL, 60000))) {
      console.error('[probe] dev server did not come up.');
      server.kill();
      process.exit(2);
    }
  }

  // low quality + no rain/shadows: SwiftShader is the bottleneck, and this
  // probe cares about logic, not pixels
  const url =
    `${BASE_URL}/?seed=${encodeURIComponent(SEED)}` +
    `&quality=${QUALITY}&grid=${GRID}&rain=0&shadows=0&wet=0&cycle=0`;

  const errors = [];
  const warnings = [];
  const results = [];

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    protocolTimeout: 600000,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
      '--mute-audio',
      '--window-size=1600,900',
    ],
    defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 },
  });

  let exitCode = 0;
  try {
    const page = await browser.newPage();

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') errors.push(text);
      else if (type === 'warning') warnings.push(text);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));
    page.on('requestfailed', (req) => {
      const f = req.failure();
      if (f && !/ERR_ABORTED/.test(f.errorText)) {
        errors.push(`requestfailed: ${req.url()} — ${f.errorText}`);
      }
    });

    const ev = (fn, ...args) => page.evaluate(fn, ...args);
    const check = (name, ok, detail = '') => {
      results.push({ name, ok });
      const line = `${name}${detail ? ` — ${detail}` : ''}`;
      if (ok) console.log(`[probe]   ok   ${line}`);
      else {
        errors.push(`probe: ${line}`);
        console.log(`[probe]   FAIL ${line}`);
      }
    };
    async function until(fn, pred, timeoutMs = 20000, intervalMs = 300) {
      const t0 = Date.now();
      let last = null;
      while (Date.now() - t0 < timeoutMs) {
        try {
          last = await fn();
        } catch {
          last = null;
        }
        if (pred(last)) return last;
        await sleep(intervalMs);
      }
      return last;
    }

    console.log(`[probe] loading ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__MT_READY__ === true', { timeout: 180000 });
    console.log('[probe] world ready');
    await sleep(2500);

    /* ---------------- 1. the title card ---------------- */
    console.log('[probe] welcome checks…');
    const welcomeUp = await ev(() => window.__MT_WELCOME__());
    check('welcome greets the player before play', welcomeUp === true, String(welcomeUp));
    await page.click('#welcome-start');
    const began = await until(
      () => ev(() => (window.__MT_WELCOME__ ? window.__MT_WELCOME__() : 'missing')),
      (v) => v === false,
      20000,
    );
    check('BEGIN starts the walk', began === false, String(began));

    const hudUp = await until(
      () =>
        ev(() => {
          const c = document.getElementById('combat');
          return !!c && !c.classList.contains('hidden');
        }),
      (v) => v === true,
      15000,
    );
    check('combat HUD comes up in play mode', hudUp === true, String(hudUp));

    /* ---------------- 2. the 34-rung ladder ---------------- */
    console.log('[probe] ladder checks…');
    const groups = await ev(() => window.__MT_GROUPS__());
    check('34 territory anchors are seated', groups?.length === 34, `len=${groups?.length}`);
    const ranks = (groups ?? []).map((g) => g.rank).sort((a, b) => a - b);
    check(
      'ranks run 1–34 exactly once each',
      ranks.length === 34 && ranks.every((r, i) => r === i + 1),
      ranks.join(','),
    );
    const g1 = (groups ?? []).find((g) => g.id === GROUP_ID);
    check('rank-1 anchor exists', !!g1, JSON.stringify(g1 ?? null));

    /* ---------------- 3. teleport to rank 1, stream the gang ------------- */
    console.log('[probe] streaming checks…');
    await ev((a) => window.__MT_TP__(a.x, a.z, 0), g1);
    const streamed = await until(
      () =>
        ev(
          () =>
            window
              .__MT_FIGHTERS__()
              .fighters.filter((f) => f.group === 'street-pickpockets').length,
        ),
      (n) => n > 0,
      25000,
      400,
    );
    check('the rank-1 gang streams in', streamed > 0, `n=${streamed}`);
    check('stream budget respected (≤ 8 live fighters)', streamed <= 8, `n=${streamed}`);

    /* ---------------- 4. HUD read-out ---------------- */
    console.log('[probe] HUD checks…');
    const hud = await ev(() => {
      const slots = [...document.querySelectorAll('.hot-slot')];
      return {
        up: !!document.getElementById('combat') &&
          !document.getElementById('combat').classList.contains('hidden'),
        hpW: document.getElementById('combat-hp')?.style.width ?? '',
        rank: document.getElementById('combat-rank')?.textContent ?? '',
        owned: slots.filter((s) => s.classList.contains('owned')).length,
        active: slots.filter((s) => s.classList.contains('active')).length,
        hotbarUp: !!document.getElementById('hotbar') &&
          !document.getElementById('hotbar').classList.contains('hidden'),
      };
    });
    check(
      'vitals bar is painted',
      hud.up && hud.hpW !== '' && /\d/.test(hud.hpW),
      `up=${hud.up} width=${hud.hpW}`,
    );
    check('rank chip reads RANK 0 · NOBODY', hud.rank.startsWith('RANK 0 ·'), hud.rank);
    check(
      'hotbar shows the starting weapon (1 owned · 1 active)',
      hud.hotbarUp && hud.owned === 1 && hud.active === 1,
      JSON.stringify(hud),
    );
    await shot(page, warnings, 'probe-01-hud.png');

    /* helpers ---------------------------------------------------------- */
    // A defeat teleports you home — stand back on the rank-1 anchor first.
    async function ensureAtFight() {
      await until(() => ev(() => window.__MT_COMBAT__().death), (d) => d <= 0, 20000, 250);
      const dist = await ev((a) => {
        const p = window.__MT_PLAYER__().pos;
        return Math.hypot(p[0] - a.x, p[2] - a.z);
      }, g1);
      if (dist > 14) await ev((a) => window.__MT_TP__(a.x, a.z, 0), g1);
    }

    /* ---------------- 5. lock-on ---------------- */
    console.log('[probe] lock-on checks…');
    let locked = null;
    for (let i = 0; i < 14 && !locked; i++) {
      await ensureAtFight();
      const c = await ev(() => window.__MT_COMBAT__());
      if (c.lockOn) {
        locked = c.lockOn;
        break;
      }
      await ev(() => window.__MT_PRESS__('KeyQ'));
      await sleep(700);
    }
    check('Q locks onto a nearby fighter', !!locked, String(locked));

    /* ---------------- 6. light strikes land ---------------- */
    console.log('[probe] strike checks…');
    let dmg = 0;
    for (let i = 0; i < 16 && dmg <= 0; i++) {
      await ensureAtFight();
      const c = await ev(() => window.__MT_COMBAT__());
      if (!c.lockOn) await ev(() => window.__MT_PRESS__('KeyQ'));
      await ev(() => window.__MT_PRESS_MOUSE__(0));
      await sleep(600);
      dmg = (await ev(() => window.__MT_COMBAT__())).lastDamage;
    }
    check('light strikes land real damage', dmg > 0, `lastDamage=${dmg}`);
    await shot(page, warnings, 'probe-02-combat.png');

    /* ---------------- 7. heavy attack ---------------- */
    console.log('[probe] heavy checks…');
    let heavy = false;
    for (let i = 0; i < 8 && !heavy; i++) {
      await ensureAtFight();
      await ev(() => window.__MT_PRESS__('KeyF'));
      const v = await until(
        () =>
          ev(() => {
            const c = window.__MT_COMBAT__();
            return c.action === 'attack' && c.kind === 'heavy';
          }),
        (ok) => ok === true,
        3000,
        200,
      );
      heavy = v === true;
    }
    check('F throws a heavy attack', heavy, String(heavy));

    /* ---------------- 8. dodge ---------------- */
    console.log('[probe] dodge checks…');
    let dodged = false;
    for (let i = 0; i < 6 && !dodged; i++) {
      await ensureAtFight();
      await ev(() => window.__MT_PRESS__('KeyC'));
      const v = await until(
        () =>
          ev(() => {
            const c = window.__MT_COMBAT__();
            return c.action === 'dodge' || c.iframes > 0 || c.dodgeCd > 0;
          }),
        (ok) => ok === true,
        2500,
        150,
      );
      dodged = v === true;
    }
    check('C dodge rolls with i-frames', dodged, String(dodged));

    /* ---------------- 9. guard ---------------- */
    console.log('[probe] guard checks…');
    // The guard is honest: it only holds while the FSM is idle with stamina
    // to spend — a stagger from an enemy swing or an empty bar correctly
    // refuses it, so wait for a clean window (and retry if one closes).
    let guarded = false;
    for (let i = 0; i < 5 && !guarded; i++) {
      await ensureAtFight();
      await until(
        () =>
          ev(() => {
            const c = window.__MT_COMBAT__();
            return c.action === 'idle' && c.stamina > 10 && c.death <= 0;
          }),
        (ok) => ok === true,
        9000,
        250,
      );
      await ev(() => window.__MT_MOUSE__(2, true));
      guarded =
        (await until(
          () => ev(() => window.__MT_COMBAT__().blocking),
          (ok) => ok === true,
          3500,
          200,
        )) === true;
      await ev(() => window.__MT_MOUSE__(2, false));
      if (!guarded) await sleep(700);
    }
    check('RMB holds a guard', guarded, String(guarded));

    /* ---------------- 10. subdue → the Requital prompt ---------------- */
    console.log('[probe] subdue checks…');
    await ensureAtFight();
    const sub = await ev((id) => window.__MT_SUBDUE__(id), GROUP_ID);
    check('the whole gang goes down', sub >= 1, `subdued=${sub}`);

    let body = null;
    for (let i = 0; i < 6 && !body; i++) {
      body = await ev(() => {
        const l = window
          .__MT_FIGHTERS__()
          .fighters.filter((f) => f.group === 'street-pickpockets' && f.stealable);
        return l.length ? { x: l[0].x, z: l[0].z, n: l.length } : null;
      });
      if (!body) {
        // a straggler may still be standing — put it down again
        await ev((id) => window.__MT_SUBDUE__(id), GROUP_ID);
        await sleep(700);
      }
    }
    check('subdued bodies are stealable', !!body, JSON.stringify(body));
    if (body) await ev((b) => window.__MT_TP__(b.x, b.z, 0), body);

    const prompt = await until(
      () => ev(() => window.__MT_STEAL__()),
      (s) => s?.promptShown && /^STEAL|^REQUIRING/.test(s.prompt ?? ''),
      25000,
      350,
    );
    check(
      'the Requital offers the steal',
      !!prompt && /^STEAL/.test(prompt.prompt ?? ''),
      JSON.stringify(prompt),
    );

    /* ---------------- 11. hold E — the Requital channel ---------------- */
    // Timing notes: the sim clamps dt to 0.1 s/frame (app.js), so the 1.5 s
    // channel needs ≥15 frames — at SwiftShader's ~0.5–2 fps that is 15–30
    // wall seconds, and a screenshot stall sits in the middle. E is also
    // re-asserted every poll: a focus blip clears the held-key set, which
    // the game honestly reads as "released" and cancels the channel for.
    console.log('[probe] Requital checks…');
    let ring = null;
    const ringDeadline = Date.now() + 30000;
    while (Date.now() < ringDeadline) {
      await ev(() => window.__MT_KEY__('KeyE', true));
      ring = await ev(() => window.__MT_STEAL__());
      if (ring?.uiShown && ring.progress > 0) break;
      await sleep(300);
    }
    check(
      'holding E fills the Requital ring',
      !!ring && ring.uiShown && ring.progress > 0,
      JSON.stringify(ring),
    );
    if (ring) await shot(page, warnings, 'probe-03-steal.png');

    let steals = 0;
    const stealDeadline = Date.now() + 90000;
    while (Date.now() < stealDeadline) {
      await ev(() => window.__MT_KEY__('KeyE', true));
      steals = (await ev(() => window.__MT_COMBAT__().state.steals)) ?? 0;
      if (steals >= 1) break;
      await sleep(400);
    }
    await ev(() => window.__MT_KEY__('KeyE', false));
    check('the channel completes — the memory is stolen', steals >= 1, `steals=${steals}`);

    const ringAway = await until(
      () => ev(() => document.getElementById('steal')?.classList.contains('hidden') ?? true),
      (v) => v === true,
      30000,
      400,
    );
    check('the ring tucks itself away', ringAway === true, String(ringAway));

    /* ---------------- 12. ledger + loadout + territory ---------------- */
    console.log('[probe] ledger checks…');
    const after = await ev(() => window.__MT_COMBAT__().state);
    check(
      'rank-1 enters the defeated ledger',
      after.defeated.includes(GROUP_ID) && after.rank >= 1,
      `rank=${after.rank} ledger=${JSON.stringify(after.defeated)}`,
    );
    check(
      'the stolen power lands in the loadout',
      after.powers.includes('crowd-misdirect'),
      JSON.stringify(after.powers),
    );
    check(
      'knowledge deepened (hp +10 · atk +1)',
      after.knowledge.hp === 10 && after.knowledge.atk === 1,
      JSON.stringify(after.knowledge),
    );
    const gAfter = await ev(
      (id) => window.__MT_GROUPS__().find((g) => g.id === id),
      GROUP_ID,
    );
    check('the territory ring goes gold (defeated)', gAfter?.defeated === true, JSON.stringify(gAfter));
    const rankNow = await ev(() => document.getElementById('combat-rank')?.textContent ?? '');
    check('rank chip climbs to RANK 1 · GLOVED', rankNow.startsWith('RANK 1 ·'), rankNow);
    await shot(page, warnings, 'probe-04-stolen.png');

    /* ---------------- 13. damage → defeat → get-up ---------------- */
    console.log('[probe] defeat checks…');
    let drained = false;
    for (let i = 0; i < 4 && !drained; i++) {
      await until(() => ev(() => window.__MT_COMBAT__().death), (d) => d <= 0, 15000, 250);
      const before = await ev(() => window.__MT_COMBAT__().hp);
      await ev(() => window.__MT_HURT__(30));
      await sleep(500);
      const now = await ev(() => window.__MT_COMBAT__());
      drained = now.hp < before || now.death > 0;
      if (!drained) await sleep(600);
    }
    check('a hit drains real HP', drained, String(drained));

    // Hermetic get-up: put every fighter on the map down first, so the
    // revive's "full vitals" reading can't be chipped by a bystander in the
    // ~250 ms SwiftShader frame gap (the player has no HP regen, so one
    // stray hit would keep hp < maxHp for the rest of the wait).
    const allDown = await ev(() => window.__MT_SUBDUE__());
    await sleep(500);

    await ev(() => window.__MT_HURT__(999999));
    const down = await until(
      () => ev(() => window.__MT_COMBAT__().death),
      (d) => d > 0,
      5000,
      120,
    );
    check('lethal damage puts you down', (down ?? 0) > 0, `death=${down}`);
    const up = await until(
      () =>
        ev(() => {
          const c = window.__MT_COMBAT__();
          return { death: c.death, hp: c.hp, maxHp: c.maxHp };
        }),
      (s) => !!s && s.death <= 0 && s.hp >= s.maxHp,
      // deathT=1.6 needs ≥16 sim frames; at ~0.5–2 fps under SwiftShader
      // that can take far longer than 25 wall seconds — budget 60.
      60000,
      250,
    );
    check(
      'you get back up at full vitals',
      !!up && up.death <= 0 && up.hp >= up.maxHp,
      `fighters held down=${allDown} · ${JSON.stringify(up)}`,
    );

    /* ---------------- 14. save → load, the ledger survives ---------------- */
    console.log('[probe] save/load checks…');
    const saved = await ev(() => window.__MT_SAVE__('save'));
    check('checkpoint writes', saved?.ok !== false, JSON.stringify(saved));
    const gen0 = await ev(() => window.__MT_GEN__());
    await ev(() => window.__MT_SAVE__('load'));
    const gone = await until(
      () => ev(() => document.getElementById('loading')?.classList.contains('gone') ?? true),
      (v) => v === true,
      120000,
      500,
    );
    check('load rebuilds the world', gone === true, String(gone));
    const gen1 = await ev(() => window.__MT_GEN__());
    check('load bumps the world generation', gen1 > gen0, `${gen0} → ${gen1}`);
    const afterLoad = await ev(() => window.__MT_COMBAT__().state);
    check(
      'the stolen ledger survives the round trip',
      afterLoad.defeated.includes(GROUP_ID) &&
        afterLoad.powers.includes('crowd-misdirect') &&
        afterLoad.knowledge.hp === 10,
      JSON.stringify({
        defeated: afterLoad.defeated,
        powers: afterLoad.powers,
        knowledge: afterLoad.knowledge,
      }),
    );

    /* ---------------- verdict ---------------- */
    if (warnings.length) {
      console.log('\n[probe] warnings:');
      for (const w of [...new Set(warnings)].slice(0, 40)) console.log('  -', w);
    }
    const passed = results.filter((r) => r.ok).length;
    console.log(`\n[probe] ${passed}/${results.length} checks passed`);
    if (errors.length) {
      exitCode = 1;
      console.error('[probe] ERRORS:');
      for (const e of [...new Set(errors)].slice(0, 40)) console.error('  -', e);
    } else {
      console.log('[probe] no console/page errors.');
    }
    console.log(`[probe] screenshots in ${OUT_DIR}`);
  } catch (err) {
    exitCode = 1;
    console.error('[probe] failed:', err.message);
    if (errors.length) {
      console.error('[probe] collected errors:');
      for (const e of [...new Set(errors)].slice(0, 40)) console.error('  -', e);
    }
  } finally {
    await browser.close().catch(() => {});
    if (server) server.kill();
  }

  process.exit(exitCode);
}

main();
