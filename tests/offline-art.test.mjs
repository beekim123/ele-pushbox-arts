import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, listJson } from '../tools/lib/load-core.mjs';

const sources = () => listJson('art/source').map(f => JSON.parse(fs.readFileSync(path.join(ROOT, f))));
const incoming = () => sources().filter(a => a.id.startsWith('ui.screen.') &&
  a.renderer?.some(p => /ui-screens-(door|shelf|wish|story|crew|dhelp)\.js$/.test(p)));
function visit(v, fn) {
  if (!v || typeof v !== 'object') return;
  fn(v);
  for (const x of Object.values(v)) visit(x, fn);
}

test('offline UI is self-contained and only embeds art demonstration rooms', () => {
  const assets = incoming();
  assert.equal(assets.length, 23);
  let rooms = 0;
  for (const a of assets) {
    for (const p of a.renderer) assert.ok(fs.existsSync(path.join(ROOT, p)), `${a.id}: ${p}`);
    assert.ok(!a.renderer.some(p => p.includes('i18n-rooms2/')), a.id);
    visit(a.params, v => {
      if (v.format !== 'pushbox.room/2') return;
      rooms++;
      assert.match(v.id, /^art_demo_/, `${a.id} embeds a real room`);
      assert.equal(v.preview_only, true);
      for (const key of ['hints', 'solutions', 'hint_route', 'needs', 'requires', 'devices', 'links'])
        assert.equal(v[key], undefined, `${a.id}: private/gameplay field ${key}`);
    });
  }
  assert.equal(rooms, 25);
});

test('all 82 delivery entries remain unapproved; the 59 sprite sources and PNGs retain their original bytes', () => {
  const receipt = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/review/OFFLINE-ART-20261020/receipt.json')));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/export/manifest.json')));
  const hash = f => createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
  assert.equal(receipt.assets.length, 82);
  assert.equal(new Set(receipt.assets.map(a => a.id)).size, 82);
  assert.equal(receipt.assets.filter(a => a.stage === 'draft').length, 6);
  assert.equal(receipt.assets.filter(a => a.stage === 'review').length, 76);
  let sprites = 0;
  for (const a of receipt.assets) {
    const src = JSON.parse(fs.readFileSync(path.join(ROOT, a.source)));
    const entry = manifest.assets.find(x => x.id === a.id);
    assert.equal(src.stage, a.stage, a.id);
    assert.equal(entry.current_is_approved, false, a.id);
    assert.equal(entry.approved, null, a.id);
    if (src.kind === 'sprite') {
      sprites++;
      assert.equal(hash(a.source), a.incoming_source_sha256, a.id);
      assert.equal(hash(entry.current.preview), a.incoming_preview_sha256, a.id);
    }
  }
  assert.equal(sprites, 59);
});

test('review sheets cover every new UI and alternate state in both shipped locales', () => {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/review/OFFLINE-ART-20261020/render-report.json')));
  assert.equal(report.renders.length, 196);
  assert.deepEqual(report.issues, []);
  for (const a of incoming()) {
    for (const locale of ['zh-Hans', 'en']) {
      const rendered = report.renders.find(r => r.id === a.id && r.locale === locale && r.variant === 0);
      assert.ok(rendered, a.id);
      assert.equal(rendered.hash, a.content_hash, a.id);
      assert.equal(rendered.version, a.version, a.id);
    }
  }
});

test('new narrative and crew fixtures explicitly contain demo copy, not private story/design paragraphs', () => {
  for (const locale of ['zh-Hans', 'en']) {
    let checked = 0;
    for (const group of ['wish', 'crew']) {
      const table = JSON.parse(fs.readFileSync(path.join(ROOT, `content/i18n-${group}/${locale}.json`)));
      for (const [key, value] of Object.entries(table)) {
        if (/^wish\.[^.]+\.(hint|line|story\.\d+)$/.test(key) ||
          /^recipient\.[^.]+\.rule$/.test(key) ||
          /^crew\.[^.]+\.(line|perk|cost|unlock(\.short)?)$/.test(key)) {
          assert.match(value, locale === 'en' ? /Preview/ : /演示/, `${locale}/${key}`);
          checked++;
        }
      }
    }
    assert.equal(checked, 111);
  }
});
