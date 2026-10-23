// WB-08: real-browser pixel/scheduling regressions and measured performance gates.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '..');
let server, browser;
(async () => {
  let url = require('url').pathToFileURL(path.join(ROOT, 'workbench/index.html')).href;
  if (process.env.WB_HTTP === '1') {
    server = require('http').createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split(/[?#]/)[0]), file = path.resolve(ROOT, '.' + rel);
      if (rel === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.wav': 'audio/wav' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = 'http://127.0.0.1:' + server.address().port + '/workbench/index.html';
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--renderer-process-limit=1', '--num-raster-threads=1'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.wbLongTasks = [];
    new PerformanceObserver(list => { window.wbLongTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration }))); }).observe({ type: 'longtask', buffered: true });
  });
  await page.goto(url + '#delivery-art');
  await page.waitForFunction(() => window.PBAssets && document.querySelector('#delivery-art-root .mode-resource-card'));
  if (process.env.WB_PERF_ONLY !== '1') {
    // Catches drawing thumbnails synchronously, wrong sheet crop, changed first frame, and procedural pixels.
    const pngData = Object.fromEntries((await page.evaluate(() => PBStore.assets().map(a => a.id))).map(id => [id, "data:image/png;base64," + fs.readFileSync(path.join(ROOT, "art/export/preview", id + ".png")).toString("base64")]));
    const pixels = await page.evaluate(async pngData => {
      const groups = new Map();
      for (const a of PBStore.assets()) { if (!groups.has(a.category)) groups.set(a.category, []); if (groups.get(a.category).length < 2) groups.get(a.category).push(a); }
      const results = [];
      for (const [category, assets] of groups) for (const [index, a] of [...assets, ...(assets.length === 1 ? assets : [])].entries()) {
        const w = a.kind === 'sprite' ? a.size[0] : 320, h = a.kind === 'sprite' ? a.size[1] : 180;
        const thumb = PBAssets.thumb(a, index > 0 && assets.length === 1 ? 320 : 128, 80), img = thumb.querySelector('img');
        if (!img) { results.push({ id: a.id, category, png: false }); continue; }
        if (assets.length === 1 && index === 1) { thumb.style.width = '320px'; thumb.style.height = '180px'; }
        img.loading = 'eager'; await img.decode();
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const first = Object.values(a.animations || {})[0]?.frames[0] || 0;
        // file:// image canvases are intentionally origin-tainted. Load the exact
        // same committed PNG bytes as data URL for readable pixel verification.
        const readable = new Image(); readable.src = pngData[a.id]; await readable.decode();
        c.getContext('2d').drawImage(readable, first * w, 0, w, h, 0, 0, w, h);
        document.body.append(thumb);
        const bounds = thumb.getBoundingClientRect(), imageBounds = img.getBoundingClientRect();
        const geometry = getComputedStyle(thumb).overflow === 'hidden' && getComputedStyle(img).imageRendering === 'pixelated' && Math.abs(imageBounds.height - bounds.height) < 0.1 && Math.abs(imageBounds.top - bounds.top) < 0.1 && Math.abs(imageBounds.width - bounds.width * (a.kind === 'sprite' ? a.frames.length : 1)) < 0.1 && Math.abs(imageBounds.left - bounds.left + first * bounds.width) < 0.1;
        thumb.remove();
        const r = new PB.Raster(w, h);
        if (a.kind === 'sprite') r.blitRows(a.frames[first], 0, 0, false);
        else if (category === 'theme') PB.scene.renderLevel(r, PB.scene.SHOWCASE, null, { tick: 0, theme: a.id, hud: false });
        else if (category === 'material') PB.matter.swatches(r);
        else PB.ui.render(r, a, 0, { focus: 0, specs: Object.fromEntries(PBStore.levels().map(l => [l.id, l])), levelSpec: PBStore.level('M05'), ruleSpec: PBStore.level('M03') });
        const got = c.getContext('2d').getImageData(0, 0, w, h).data;
        results.push({ id: a.id, category, png: true, equal: got.every((v, i) => v === r.data[i]), geometry, size: [thumb.style.width, thumb.style.height] });
      }
      return results;
    }, pngData);
    assert.ok(pixels.every(p => p.png), 'all list thumbnails use PNG images');
    assert.ok(pixels.every(p => p.geometry), "PNG crop matches former thumbnail geometry");
    assert.ok(pixels.every(p => p.equal), 'PNG first-frame/procedural pixels equal former canvas: ' + JSON.stringify(pixels.filter(p => !p.equal)));
    console.log('pixel samples ' + JSON.stringify(pixels));
    // Catches oversized whole-scene sprites being clipped inside actual asset cards.
    // The former canvas is mounted in the same grid with its original inline size,
    // so inherited max-width/max-height constraints remain the independent reference.
    await page.goto(url + '#assets');
    await page.waitForFunction(() => [...document.querySelectorAll('#asset-cards .card .id')].some(n => n.textContent.startsWith('scene.hub_post ')));
    const cardGeometry = await page.evaluate(() => {
      const card = [...document.querySelectorAll('#asset-cards .card')].find(n => n.querySelector('.id').textContent.startsWith('scene.hub_post '));
      const former = card.cloneNode(true), oldCanvas = document.createElement('canvas');
      oldCanvas.width = 320; oldCanvas.height = 180;
      oldCanvas.style.width = '320px'; oldCanvas.style.height = '180px';
      former.querySelector('.thumb').replaceChildren(oldCanvas); card.parentElement.append(former);
      const current = card.querySelector('.thumb .asset-png-thumb').getBoundingClientRect();
      const previous = oldCanvas.getBoundingClientRect(), frame = card.querySelector('.thumb').getBoundingClientRect();
      const result = { current: [current.width, current.height], previous: [previous.width, previous.height],
        contained: current.top >= frame.top - 0.5 && current.bottom <= frame.bottom + 0.5 };
      former.remove(); return result;
    });
    assert.ok(cardGeometry.contained && cardGeometry.current.every((n, i) => Math.abs(n - cardGeometry.previous[i]) < 0.5),
      'whole-scene PNG retains former canvas dimensions inside real asset card: ' + JSON.stringify(cardGeometry));
    const draft = await page.evaluate(() => {
      const a = PBStore.assets().find(a => a.kind === 'sprite'), frames = structuredClone(a.frames);
      frames[0][0] = 'A' + frames[0][0].slice(1); PBStore.setDraft(a.id, frames);
      const t = PBAssets.thumb(PBStore.effective(a.id), 128, 80), r = new PB.Raster(...a.size);
      r.blitRows(frames[Object.values(a.animations)[0].frames[0]], 0, 0, false);
      const equal = t.getContext('2d').getImageData(0, 0, ...a.size).data.every((v, i) => v === r.data[i]);
      PBStore.discardDraft(a.id); return equal;
    });
    assert.ok(draft, 'local sprite drafts retain real canvas pixels');
    const fallback = await page.evaluate(() => {
      const a = PBStore.assets().find(a => a.kind === 'sprite'), previous = console.warn; let warnings = 0;
      console.warn = () => warnings++;
      const nodes = [PBAssets.thumb(a, 128, 80), PBAssets.thumb(a, 128, 80)];
      for (const node of nodes) node.querySelector('img').dispatchEvent(new Event('error'));
      console.warn = previous;
      const first = Object.values(a.animations)[0].frames[0], r = new PB.Raster(...a.size); r.blitRows(a.frames[first], 0, 0, false);
      return { warnings, equal: nodes.every(node => node.querySelector('canvas').getContext('2d').getImageData(0, 0, ...a.size).data.every((v, i) => v === r.data[i])) };
    });
    assert.equal(fallback.warnings, 1, 'failed PNG warns once per asset'); assert.ok(fallback.equal, 'failed PNG falls back to former canvas pixels');
    // Catches rebuilding cards and synchronous search filtering in all three list consumers.
    for (const [hash, cards, search, query] of [
      ['delivery-art', '#delivery-art-root [data-resource-id]', '#delivery-art-root input[type=search]', 'ui.screen.run_door'],
      ['assets', '#asset-cards .card', '#asset-search', 'ui.screen.run_door'],
      ['review', '#review-results .review-card', '#review-search', 'ui.screen.run_door'],
    ]) {
      await page.goto(url + '#' + hash);
      if (hash === 'review') await page.locator('#review-status').selectOption('all');
      await page.evaluate(selector => { window.wbCards = [...document.querySelectorAll(selector)]; }, cards);
      await page.locator(search).fill(query);
      assert.ok(await page.evaluate(() => wbCards.every(c => !c.hidden)), hash + ' waits for debounce');
      await page.waitForTimeout(190);
      const result = await page.evaluate(selector => ({ same: wbCards.every((c, i) => document.querySelectorAll(selector)[i] === c), shown: [...document.querySelectorAll(selector)].filter(c => !c.hidden).length }), cards);
      assert.ok(result.same, hash + ' preserves card node identity'); assert.equal(result.shown, 2, hash + ' filters visible results');
      await page.locator(search).fill(''); await page.waitForTimeout(190);
      if (hash === 'delivery-art') {
        await page.getByRole('button', { name: '清除筛选', exact: true }).click();
        assert.ok(await page.evaluate(selector => wbCards.every((c, i) => document.querySelectorAll(selector)[i] === c), cards), 'clear filter preserves cards');
      }
    }
    // Catches redrawing unchanged sprites, uncapped procedural stages, stale time, and hidden playback.
    const stages = await page.evaluate(async () => {
      const host = document.createElement('div'); document.body.prepend(host);
      let n = 0, last = 0;
      const a = PBStore.assets().find(a => a.kind === 'sprite' && Object.values(a.animations || {}).some(n => n.fps === 8)), anim = Object.keys(a.animations).find(n => a.animations[n].fps === 8);
      const s = PBStage.create(host, { width: a.size[0], height: a.size[1], animated: true, frameKey: tick => PB.sprites.frameAt(a, anim, tick), draw: (r, tick) => { n++; last = tick; r.blitRows(a.frames[PB.sprites.frameAt(a, anim, tick)], 0, 0, false); } });
      await new Promise(r => setTimeout(r, 600)); const calls = n, automaticTick = s.tick();
      s.setTick(37); const direct = new PB.Raster(...a.size); direct.blitRows(a.frames[PB.sprites.frameAt(a, anim, 37)], 0, 0, false);
      const equal = s.canvas.getContext('2d').getImageData(0, 0, ...a.size).data.every((v, i) => v === direct.data[i]);
      s.setVisible(false); const stopped = n; await new Promise(r => setTimeout(r, 200)); const hidden = n === stopped;
      s.destroy(); host.remove();
      return { calls, automaticTick, last, equal, hidden };
    });
    assert.ok(stages.automaticTick > 0 && stages.calls >= 2 && stages.calls <= 7, 'sprite automatically advances and unchanged frames do not repaint: ' + JSON.stringify(stages));
    assert.ok(stages.equal && stages.hidden, 'same-tick sprite pixels and hidden stop');
    const procedural = await page.evaluate(async () => {
      const host = document.createElement('div'); document.body.prepend(host);
      const a = PBStore.asset('ui.screen.lobby'); let n = 0;
      const s = PBStage.create(host, { width: 320, height: 180, animated: true, draw: (r, tick) => { n++; PB.ui.render(r, a, tick, { focus: 0 }); } });
      await new Promise(r => setTimeout(r, 650)); const calls = n;
      s.setTick(43); const r = new PB.Raster(320, 180); PB.ui.render(r, a, 43, { focus: 0 });
      const equal = s.canvas.getContext('2d').getImageData(0, 0, 320, 180).data.every((v, i) => v === r.data[i]);
      let second = 0; const h2 = document.createElement('div'); document.body.prepend(h2);
      const s2 = PBStage.create(h2, { width: 1, height: 1, animated: true, draw: () => second++ });
      const stopped = n; await new Promise(r => setTimeout(r, 250)); const exclusive = n === stopped && second > 1;
      h2.style.marginTop = '10000px'; await new Promise(r => setTimeout(r, 100)); const off = second;
      await new Promise(r => setTimeout(r, 250)); const intersection = second === off;
      s.destroy(); s2.destroy(); host.remove(); h2.remove(); return { calls, equal, exclusive, intersection };
    });
    assert.ok(procedural.calls <= 7, 'procedural default <=8fps: ' + procedural.calls);
    assert.ok(procedural.equal && procedural.exclusive && procedural.intersection, 'procedural same-tick pixels, single owner, intersection stop: ' + JSON.stringify(procedural));
    const adaptive = await page.evaluate(async () => {
      const host = document.createElement('div'); document.body.prepend(host);
      const results = [];
      for (const [duration, expected, keyed] of [[45, 4, false], [125, 2, false], [45, 4, true]]) {
        let count = 0;
        const stage = PBStage.create(host, { width: 1, height: 1, animated: true, frameKey: keyed ? tick => tick : null, draw: () => {
          count++; const start = performance.now(); while (performance.now() - start < duration) { /* real measured draw cost */ }
        } });
        const premature = host.textContent.includes('性能模式');
        await new Promise(resolve => setTimeout(resolve, 1200));
        const mode = host.textContent.includes('性能模式 · ' + expected + ' fps'), calls = count;
        const descriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange')); const stopped = count;
        await new Promise(resolve => setTimeout(resolve, 200)); const hidden = count === stopped;
        if (descriptor) Object.defineProperty(document, 'hidden', descriptor); else delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
        stage.destroy(); results.push({ duration, expected, keyed, calls, premature, mode, hidden });
      }
      host.remove(); return results;
    });
    assert.ok(adaptive.every(x => !x.premature && x.mode && x.hidden && x.calls <= 8), 'consecutive-cost downgrade and document visibility stop: ' + JSON.stringify(adaptive));
    assert.deepEqual(errors, []); console.log('WB-08 browser regressions passed');
  }
  if (process.env.WB_REGRESSION_ONLY === '1') return;
  const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const results = []; let navigation = 0;
  async function measure(hash, limit, heavy = false) {
    // A fresh document measures cold list construction and cannot retain an
    // earlier selected inspector or entries from an unrelated route.
    await page.goto(url + '?wb-perf=' + (++navigation) + '#' + hash); await page.waitForTimeout(450);
    if (hash === 'review') { await page.locator('#review-status').selectOption('all'); await page.waitForTimeout(200); }
    const openBlock = await page.evaluate(() => Math.max(0, ...wbLongTasks.map(t => t.duration)));
    if (hash.startsWith('assets/')) { await page.locator('#asset-inspector .stage-frame').scrollIntoViewIfNeeded(); await page.waitForTimeout(1200); }
    const before = await metrics(); await page.waitForTimeout(3000); const after = await metrics();
    const cpu = (after.TaskDuration - before.TaskDuration) / (after.Timestamp - before.Timestamp) * 100;
    const row = { hash, openBlockMs: +openBlock.toFixed(2), cpuPercent: +cpu.toFixed(2), limit, heavy }; results.push(row); console.log(JSON.stringify(row));
    if (!heavy) { assert.ok(cpu < limit, hash + ' idle CPU <' + limit + '%'); if (limit === 5) assert.ok(openBlock < 200, hash + ' list open longest task <200ms'); }
  }
  for (const hash of ['delivery-art', 'delivery-art/theme.diyu', 'delivery-art/screens', 'assets', 'review']) await measure(hash, 5);
  for (const [hash, input] of [['delivery-art', '#delivery-art-root input[type=search]'], ['assets', '#asset-search'], ['review', '#review-search']]) {
    await page.goto(url + '#' + hash); await page.waitForTimeout(200); await page.evaluate(() => { window.wbLongTasks = []; });
    for (const text of ['u', 'ui', 'ui.screen', '']) { await page.locator(input).fill(text); await page.waitForTimeout(180); }
    if (hash === 'delivery-art') for (const status of ['approved', 'draft', 'all']) await page.locator('#delivery-art-root').getByLabel('确认状态', { exact: true }).selectOption(status);
    if (hash === 'assets') for (const name of ['已确认', '草稿', '全部状态']) await page.locator('#asset-status').getByRole('button', { name, exact: true }).click();
    if (hash === 'review') for (const status of ['approved', 'review', 'all']) await page.locator('#review-status').selectOption(status);
    await page.waitForTimeout(200);
    const block = await page.evaluate(() => Math.max(0, ...wbLongTasks.map(t => t.duration)));
    console.log(JSON.stringify({ hash, searchFilterBlockMs: block })); assert.ok(block < 100, hash + ' search/filter longest task <100ms');
  }
  await measure('assets/char.portitor', 10);
  for (const id of ['ui.screen.reels', 'ui.screen.settlement', 'ui.screen.levels']) await measure('assets/' + id, 30, true);
  assert.deepEqual(errors, []); console.log('WB-08 performance gates passed ' + (process.env.WB_HTTP === '1' ? 'HTTP' : 'file'));
})().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); });
