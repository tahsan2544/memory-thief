/**
 * Warden diagnostic — why does the smoke suite's third extraction fail?
 *
 * Boots seed eidolon-77, teleports to src-archive-warden exactly like
 * scripts/smoke.mjs does (offset -2.2 / +1.0), then samples the world for
 * ~15 s: HP, death timer, fighters streaming in, boss state, near-source
 * and the live prompt. Then it injects one KeyE and watches the extraction
 * / memory count to see whether the press lands, is swallowed, or the
 * channel never starts.
 *
 *   node scripts/probe-warden.mjs
 *
 * Env overrides: PROBE_URL / PROBE_SEED / PROBE_QUALITY / PROBE_GRID
 * (port 6032 so it never collides with smoke's 6030 or combat's 6031).
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const PORT = 6032;
const BASE_URL = process.env.PROBE_URL ?? `http://127.0.0.1:${PORT}`;
const SEED = process.env.PROBE_SEED ?? 'eidolon-77';
const QUALITY = process.env.PROBE_QUALITY ?? 'low';
const GRID = process.env.PROBE_GRID ?? '12';
const OUT_DIR = join(root, 'probe-warden');

function findEdge() {
  const candidates = [
    process.env.EDGE_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge Dev/Application/msedge.exe',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) ?? null;
}

async function waitForServer(url, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      if (r.ok || r.status === 404) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const puppeteerMod = await import('puppeteer-core');
  const puppeteer = puppeteerMod.default;

  const executablePath = findEdge();
  if (!executablePath) {
    console.error('[warden] Could not find Microsoft Edge.');
    process.exit(2);
  }

  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  let server = null;
  const up = await waitForServer(BASE_URL, 2500);
  if (!up) {
    console.log('[warden] starting dev server…');
    server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
      cwd: root,
      shell: true,
      stdio: 'ignore',
      detached: false,
    });
    if (!(await waitForServer(BASE_URL, 60000))) {
      console.error('[warden] dev server did not come up.');
      server.kill();
      process.exit(2);
    }
  }

  const url =
    `${BASE_URL}/?seed=${encodeURIComponent(SEED)}` +
    `&quality=${QUALITY}&grid=${GRID}&rain=0&shadows=0&wet=0&cycle=0`;

  const errors = [];
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

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    const ev = (fn, ...args) => page.evaluate(fn, ...args);

    console.log(`[warden] loading ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__MT_READY__ === true', { timeout: 180000 });
    console.log('[warden] world ready');
    await sleep(2000);

    await page.click('#welcome-start');
    await sleep(1500);

    // --- exactly the smoke suite's approach --------------------------------
    const sources = await ev(() => window.__MT_SOURCES__());
    const warden = sources.find((s) => s.id === 'src-archive-warden');
    console.log(`[warden] source at ${warden.x.toFixed(1)}, ${warden.z.toFixed(1)} ` +
      `(radius ${warden.radius}, fragment ${warden.fragmentId})`);

    await ev((s) => window.__MT_TP__(s.x - 2.2, s.z + 1.0, Math.PI / 2), warden);

    // --- one-shot gate dump: why is (or isn't) the source "near"? ---------
    const gates = await ev((sid) => {
      const p = window.__MT_PLAYER__();
      const src = window.__MT_SOURCES__().find((s) => s.id === sid);
      const n = window.__MT_NEAR__();
      const d = Math.hypot(p.pos[0] - src.x, p.pos[2] - src.z);
      const dy = p.pos[1] - src.y;
      const el = (id) => {
        const e = document.getElementById(id);
        return !!e && !e.classList.contains('hidden');
      };
      return {
        mode: window.__MT_MODE__?.() ?? '?',
        welcome: window.__MT_WELCOME__ ? window.__MT_WELCOME__() : 'missing',
        overlay: window.__MT_OVERLAY_OPEN__ ? window.__MT_OVERLAY_OPEN__() : 'missing',
        journal: el('journal'),
        inspect: el('inspect'),
        recon: window.__MT_RECON__ ? window.__MT_RECON__().active : 'missing',
        extracting: window.__MT_EXTRACT__().active,
        playerY: p.pos[1],
        srcY: src.y,
        d: Math.round(d * 100) / 100,
        radius: src.radius,
        dy: Math.round(dy * 100) / 100,
        near: n.source,
        interactable: n.interactable,
      };
    }, 'src-archive-warden');
    console.log('[warden] gate dump: ' + JSON.stringify(gates, null, 1));

    // --- sample the world every 500 ms for 15 s ----------------------------
    console.log('[warden] sampling 15 s at the plaza…');
    const samples = [];
    for (let i = 0; i < 30; i++) {
      const s = await ev(() => {
        const c = window.__MT_COMBAT__();
        const f = window.__MT_FIGHTERS__();
        const b = window.__MT_BOSS__();
        const n = window.__MT_NEAR__();
        const p = window.__MT_PLAYER__();
        const prompt = document.getElementById('prompt');
        return {
          t: Math.round(performance.now() / 100) / 10,
          pos: [Math.round(p.pos[0] * 10) / 10, Math.round(p.pos[2] * 10) / 10],
          hp: c.hp,
          maxHp: c.maxHp,
          death: c.death,
          fighters: (f?.fighters ?? []).map((x) => ({
            g: x.group,
            d: Math.round(Math.hypot(x.x - p.pos[0], x.z - p.pos[2])),
            st: x.state,
            hp: x.hp,
          })),
          boss: b?.exists
            ? { hp: b.hp, state: b.state, d: Math.round(Math.hypot(b.x - p.pos[0], b.z - p.pos[2])) }
            : null,
          near: n.source,
          prompt:
            prompt && !prompt.classList.contains('hidden')
              ? (document.getElementById('prompt-label')?.textContent ?? '')
              : null,
          extracting: window.__MT_EXTRACT__?.().active ?? false,
        };
      });
      samples.push(s);
      if (i % 4 === 0) {
        console.log(
          `[warden] t=${s.t}s hp=${s.hp}/${s.maxHp} death=${s.death} pos=${s.pos} ` +
          `near=${s.near} fighters=${s.fighters.length} boss=${s.boss ? JSON.stringify(s.boss) : 'none'}`,
        );
      }
      await sleep(500);
    }

    // --- the press ---------------------------------------------------------
    const before = await ev(() => window.__MT_MEM__());
    console.log(`[warden] mem count before E: ${before.count} cooldown=${before.gloveCooldown.toFixed(2)}`);
    await ev(() => window.__MT_PRESS__('KeyE'));

    const after = [];
    for (let i = 0; i < 20; i++) {
      const s = await ev(() => {
        const c = window.__MT_COMBAT__();
        const m = window.__MT_MEM__();
        const x = window.__MT_EXTRACT__();
        const n = window.__MT_NEAR__();
        const prompt = document.getElementById('prompt');
        return {
          death: c.death,
          hp: c.hp,
          count: m.count,
          extracting: x.active,
          fx: x.fx,
          near: n.source,
          prompt:
            prompt && !prompt.classList.contains('hidden')
              ? (document.getElementById('prompt-label')?.textContent ?? '')
              : null,
        };
      });
      after.push(s);
      if (i % 4 === 0) {
        console.log(`[warden] +${(i * 0.5).toFixed(1)}s death=${s.death} hp=${s.hp} ` +
          `count=${s.count} extracting=${s.extracting} near=${s.near} prompt=${JSON.stringify(s.prompt)}`);
      }
      if (s.count >= before.count + 1) break;
      await sleep(500);
    }

    const final = after[after.length - 1];
    console.log('\n[warden] === SUMMARY ===');
    console.log(`mem count: ${before.count} → ${final.count} (need +1)`);
    console.log(`final: death=${final.death} hp=${final.hp} extracting=${final.extracting} near=${final.near}`);
    const killers = samples.filter((s) => s.death > 0 || s.hp < s.maxHp);
    console.log(`samples with damage/death: ${killers.length}/30`);
    if (killers.length) {
      const first = killers[0];
      console.log(`first damage at t=${first.t}s hp=${first.hp} death=${first.death}`);
      console.log(`  fighters: ${JSON.stringify(first.fighters)}`);
      console.log(`  boss: ${JSON.stringify(first.boss)}`);
    }
    const bossSeen = samples.find((s) => s.boss);
    console.log(`boss seen: ${bossSeen ? JSON.stringify(bossSeen.boss) : 'never'}`);
    const deaths = samples.filter((s) => s.death > 0).length;
    console.log(`samples while dead: ${deaths}/30`);

    // dump full trace
    console.log('\n[warden] === TRACE (every sample) ===');
    for (const s of samples) {
      console.log(JSON.stringify(s));
    }
    console.log('\n[warden] === POST-E TRACE ===');
    for (const s of after) console.log(JSON.stringify(s));

    if (errors.length) {
      console.log('\n[warden] console errors:');
      for (const e of errors) console.log(`  - ${e}`);
    } else {
      console.log('\n[warden] no console errors.');
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
}

main().catch((err) => {
  console.error('[warden] fatal:', err);
  process.exit(1);
});
