/**
 * Map & discovery probe — MEMORY THIEF v2 (docs/TECH-PLAN.md Phase 10).
 *
 * Fast signal for the territory-discovery rules without running the full
 * smoke suite: the ladder hides behind discovery, the next target and the
 * Overlord beacon are always shown, crossing a border charts that
 * territory, and the counts read-out reports CHARTED.
 *
 *   node scripts/probe-map.mjs
 *
 * Env overrides (same as probe-combat):
 *   PROBE_URL     http://127.0.0.1:6031
 *   PROBE_OUT     <folder>                (default: probe-map/)
 *   PROBE_SEED    eidolon-77
 *
 * Rules of the road: never edit a source file while this or the smoke
 * suite is running — Vite HMR full-reloads the page and invalidates the
 * run mid-hook.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const BASE_URL = process.env.PROBE_URL ?? 'http://127.0.0.1:6031';
const OUT_DIR = resolve(root, process.env.PROBE_OUT ?? 'probe-map');
const SEED = process.env.PROBE_SEED ?? 'eidolon-77';

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  const url =
    `${BASE_URL}/?seed=${encodeURIComponent(SEED)}` +
    '&quality=low&grid=12&rain=0&shadows=0&wet=0&cycle=0';

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

    /* ---------------- 1. into play ---------------- */
    const welcomeUp = await ev(() => window.__MT_WELCOME__());
    check('welcome greets the player before play', welcomeUp === true, String(welcomeUp));
    await page.click('#welcome-start');
    const began = await until(
      () => ev(() => (window.__MT_WELCOME__ ? window.__MT_WELCOME__() : 'missing')),
      (v) => v === false,
      20000,
    );
    check('BEGIN starts the walk', began === false, String(began));

    /* ---------------- 2. the map opens ---------------- */
    await ev(() => window.__MT_PRESS__('KeyM'));
    let mp = await until(() => ev(() => window.__MT_MAP__()), (x) => x?.open === true, 15000);
    check('M opens the city map', mp?.open === true, JSON.stringify(mp?.canvas ?? null));

    /* ---------------- 3. discovery gating ---------------- */
    const terrPins = (mp?.pins ?? []).filter((x) => x.kind === 'territory');
    check(
      'the ladder hides behind discovery (2..33 pins shown)',
      terrPins.length >= 2 && terrPins.length < 34,
      `${terrPins.length} of 34 shown`,
    );
    const nextPins = terrPins.filter((x) => x.next === true);
    check('exactly one next target is flagged', nextPins.length === 1,
      nextPins.map((x) => x.label).join(', ') || 'none');
    const bossPins = terrPins.filter((x) => x.boss === true);
    check('the Overlord beacon is always shown', bossPins.length === 1, `${bossPins.length} boss pins`);
    check('counts read-out reports CHARTED', /CHARTED/.test(mp?.counts ?? ''), mp?.counts ?? '(none)');

    const disc0 = await ev(() => window.__MT_DISCOVERY__());
    check('the discovery record starts short of the full ladder',
      Array.isArray(disc0?.territories) && disc0.territories.length < 34,
      `${disc0?.territories?.length ?? -1}/34 charted`);

    /* ---------------- 4. border entry charts one territory ---------------- */
    const anchors = await ev(() => window.__MT_GROUPS__());
    check('the ladder exposes all 34 anchors', anchors.length === 34, `${anchors.length} anchors`);
    const target = anchors.find(
      (a) => a.rank !== 1 && a.rank !== 34 && !(disc0.territories ?? []).includes(a.id),
    );
    check('an uncharted mid-ladder territory exists to walk into', !!target, target?.id ?? 'none');

    if (target) {
      await ev(() => window.__MT_PRESS__('KeyM')); // close the map before the walk
      await until(() => ev(() => window.__MT_MAP__()), (x) => x?.open === false, 10000);
      await ev((p) => window.__MT_TP__(p.x, p.z, 0), target);
      const charted = await until(
        () => ev((id) => window.__MT_DISCOVERY__().territories.includes(id), target.id),
        (v) => v === true,
        8000,
        300,
      );
      check('crossing the border charts that territory', charted === true, target.id);

      await ev(() => window.__MT_PRESS__('KeyM'));
      mp = await until(() => ev(() => window.__MT_MAP__()), (x) => x?.open === true, 15000);
      const pin = (mp?.pins ?? []).find((x) => x.id === `grp:${target.id}`);
      check('the charted territory now pins on the map', !!pin, pin?.label ?? 'missing');
      check('its pin carries the rank numeral',
        !!pin && Number.isInteger(pin?.rank) && pin.rank === target.rank,
        pin ? `rank ${pin?.rank} vs ${target.rank}` : 'no pin');
      await ev(() => window.__MT_PRESS__('KeyM'));
      await until(() => ev(() => window.__MT_MAP__()), (x) => x?.open === false, 10000);
    }

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
