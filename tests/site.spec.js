// @ts-check
/* What every browser and device must get right: the page loads with nothing missing,
   nothing runs off the side of the screen, every stage draws something and its cards
   fit, the scenes stay within a phone's WebGL budget, and the downloads resolve. */
const { test, expect } = require('@playwright/test');

const GL_COUNTER = () => {
  // @ts-ignore
  window.__gl = { created: 0, lost: 0, live: 0, peak: 0 };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type) {
    const r = orig.apply(this, arguments);
    // @ts-ignore
    const g = window.__gl;
    // @ts-ignore
    if (r && /webgl/.test(String(type)) && !this.__counted) {
      // @ts-ignore
      this.__counted = true; g.created++; g.live++; g.peak = Math.max(g.peak, g.live);
      this.addEventListener('webglcontextlost', () => { g.lost++; g.live--; });
    }
    return r;
  };
};

async function open(page) {
  const failed = [], errors = [];
  page.on('requestfailed', r => failed.push(r.url() + ' ' + ((r.failure() || {}).errorText || '')));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(GL_COUNTER);
  await page.goto('/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; return document.fonts ? document.fonts.ready : null; });
  await page.waitForTimeout(800);
  return { failed, errors };
}

/* scroll a stage so card i is the active one */
async function toCard(page, id, i, n) {
  await page.evaluate(([id, f]) => {
    const t = document.getElementById(id).querySelector('.stage__track');
    const top = t.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (t.offsetHeight - window.innerHeight) * f);
  }, [id, (i + 0.5) / n]);
  await page.waitForTimeout(450);
}

/* a flat frame compresses to almost nothing; anything drawn does not */
async function frameIsBlank(page, rect) {
  const vw = page.viewportSize().width, vh = page.viewportSize().height;
  const clip = { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: Math.min(rect.width, vw), height: Math.min(rect.height, vh) };
  if (clip.width < 10 || clip.height < 10) return false;
  const buf = await page.screenshot({ type: 'jpeg', quality: 40, clip });
  return buf.length < (clip.width * clip.height) / 120;
}

test('loads with every asset, no script errors, no broken images', async ({ page }) => {
  const { failed, errors } = await open(page);
  const g = await page.evaluate(() => ({
    broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
    fonts: document.fonts ? document.fonts.status : 'n/a',
    canvases: document.querySelectorAll('canvas').length,
    three: !!window.THREE, data: !!(window.PHOS && window.PHOS.MISSION && window.PHOS.MODELS)
  }));
  expect(failed, 'requests that failed').toEqual([]);
  expect(errors, 'script errors').toEqual([]);
  expect(g.broken, 'images that did not decode').toEqual([]);
  expect(g.three && g.data, 'three.js and the data loaded').toBe(true);
  expect(g.canvases).toBeGreaterThan(5);
});

test('nothing runs off the side of the screen', async ({ page }) => {
  await open(page);
  const bad = await page.evaluate(async () => {
    const vw = document.documentElement.clientWidth, out = [];
    if (document.documentElement.scrollWidth > vw) out.push('page scrolls sideways by ' + (document.documentElement.scrollWidth - vw) + 'px');
    const sections = [...document.querySelectorAll('header, section, footer')];
    for (const s of sections) {
      s.scrollIntoView(); await new Promise(r => setTimeout(r, 120));
      for (const el of s.querySelectorAll('*')) {
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const r = el.getBoundingClientRect(); if (!r.width) continue;
        /* decoration that the section clips on purpose is fine */
        let clipped = false; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') { clipped = true; break; } }
        if (clipped) continue;
        if (r.right > vw + 1 || r.left < -1) out.push((s.id || s.getAttribute('data-rail') || s.tagName) + ' > ' + el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
        if (out.length > 10) return out;
      }
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test('every stage draws, and its cards fit the screen', async ({ page }) => {
  await open(page);
  const stages = await page.evaluate(() => [...document.querySelectorAll('.stage')].map(s => ({ id: s.id, n: s.querySelectorAll('.stage__card').length })));
  expect(stages.length).toBeGreaterThan(8);
  const problems = [];
  for (const st of stages) {
    for (let i = 0; i < st.n; i++) {
      await toCard(page, st.id, i, st.n);
      const r = await page.evaluate(([id, i]) => {
        const s = document.getElementById(id), vw = document.documentElement.clientWidth, vh = innerHeight, out = [];
        const card = s.querySelectorAll('.stage__card')[i];
        const cr = card.getBoundingClientRect();
        if (cr.right > vw + 1 || cr.left < -1) out.push('card ' + i + ' off the side ' + Math.round(cr.left) + '..' + Math.round(cr.right));
        if (cr.height > vh * 1.15) out.push('card ' + i + ' is ' + Math.round(cr.height) + 'px tall on a ' + vh + 'px screen');
        for (const el of card.querySelectorAll('*')) if (!el.children.length && el.textContent.trim() && el.scrollWidth > el.clientWidth + 3 && getComputedStyle(el).display !== 'none') out.push('card ' + i + ' text spills: "' + el.textContent.trim().slice(0, 30) + '"');
        const hud = s.querySelector('.journey__hud');
        if (hud && getComputedStyle(hud).display !== 'none') { const h = hud.getBoundingClientRect(); if (h.width && (h.right > vw + 1 || h.bottom > vh + 1 || h.left < -1)) out.push('card ' + i + ' readout outside the screen'); }
        const viz = s.querySelector('.stage__viz');
        const c = viz ? [...viz.querySelectorAll('canvas')].find(c => !c.hidden && c.getBoundingClientRect().width > 0) : null;
        return { out, canvas: c ? Object.assign({ cls: c.className }, c.getBoundingClientRect().toJSON()) : null };
      }, [st.id, i]);
      problems.push(...r.out.map(x => st.id + ': ' + x));
      /* the frame should show something on the first, middle and last card */
      if (r.canvas && /act3d|descent__3d/.test(r.canvas.cls) && (i === 0 || i === st.n - 1 || i === Math.floor(st.n / 2))) {
        if (await frameIsBlank(page, r.canvas)) problems.push(st.id + ': card ' + i + ' the scene is blank');
      }
    }
  }
  expect(problems).toEqual([]);
});

test('WebGL contexts stay within a phone budget while scrolling the page', async ({ page }) => {
  await open(page);
  const has3d = await page.evaluate(() => document.querySelectorAll('canvas.act3d').length);
  test.skip(!has3d, 'no WebGL in this browser: the 2D fallback is in use');
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize().height;
  for (let y = 0; y < H; y += vh * 0.8) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(120); }
  await page.waitForTimeout(2200);
  const g = await page.evaluate(() => window.__gl);
  expect(g.peak, 'contexts alive at once').toBeLessThanOrEqual(6);
  expect(g.live, 'contexts alive after scrolling through').toBeLessThanOrEqual(4);
  /* and the scene at the end of the page still draws after all that */
  const last = await page.evaluate(() => { const c = [...document.querySelectorAll('canvas.act3d')].pop(); c.scrollIntoView(); return c.getBoundingClientRect().toJSON(); });
  await page.waitForTimeout(900);
  expect(await frameIsBlank(page, last)).toBe(false);
});

test('without WebGL the acts still draw in 2D', async ({ page, browserName }) => {
  await open(page);
  const has3d = await page.evaluate(() => document.querySelectorAll('canvas.act3d').length);
  test.skip(has3d > 0, 'WebGL is on here; the fallback is covered by the no-webgl project');
  for (const id of ['act1', 'act2', 'descent']) {
    await toCard(page, id, 1, 4);
    const rect = await page.evaluate(id => { const c = [...document.querySelectorAll('#' + id + ' canvas')].find(c => !c.hidden); return c && c.getBoundingClientRect().toJSON(); }, id);
    expect(rect, id + ' has a canvas').toBeTruthy();
    expect(await frameIsBlank(page, rect), id + ' draws in 2D').toBe(false);
  }
});

test('the collapsible sheets open, and the model downloads resolve', async ({ page, request }) => {
  await open(page);
  const toggles = page.locator('.fspecs__toggle');
  expect(await toggles.count()).toBeGreaterThan(6);
  const first = toggles.first();
  await first.scrollIntoViewIfNeeded();
  await first.click();
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  await expect(first.locator('xpath=..').locator('.fspecs__body')).toBeVisible();
  const hrefs = await page.evaluate(() => [...document.querySelectorAll('a.fdl')].map(a => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(4);
  for (const h of hrefs) { const r = await request.head('/' + h); expect(r.status(), h).toBe(200); }
});
