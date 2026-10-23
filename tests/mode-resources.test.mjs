import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {ROOT, listJson} from '../tools/lib/load-core.mjs';

const assets = listJson('art/source').map(f => JSON.parse(fs.readFileSync(path.join(ROOT, f))));
const audio = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio/export/manifest.json'))).entries;
const receipt = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/review/OFFLINE-ART-20261020/receipt.json')));
const load = () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'workbench/js/app/mode-catalog.js'), 'utf8'), {window});
  return window.PBModeCatalog;
};
const ids = rows => Array.from(rows, a => a.id);

test('both mode catalogs cover every existing art entry without changing source objects', () => {
  const C = load(), before = JSON.stringify(assets);
  const level = C.assets('level', 'all', assets), delivery = C.assets('delivery', 'all', assets);
  assert.ok(level.length > 0 && delivery.length > 0);
  assert.equal(new Set(ids(level).concat(ids(delivery))).size, assets.length);
  for (const mode of ['level', 'delivery']) {
    const rows = C.assets(mode, 'all', assets);
    assert.equal(new Set(ids(rows)).size, rows.length, mode);
  }
  assert.equal(JSON.stringify(assets), before, 'navigation must not mutate frozen sources');
  assert.ok(ids(level).includes('char.portitor'));
  assert.ok(ids(delivery).includes('char.portitor'));
  assert.ok(!ids(level).includes('ui.screen.run_door'));
  assert.ok(!ids(delivery).includes('ui.screen.levels'));
});

test('level themes and delivery maps have distinct resource groups and preserve shared assets', () => {
  const C = load();
  assert.deepEqual(ids(C.sections('level', assets)).filter(x => x.startsWith('theme.')),
    ['theme.dungeon', 'theme.ruins', 'theme.cave', 'theme.forest', 'theme.sky', 'theme.cosmos']);
  assert.deepEqual(ids(C.sections('delivery', assets)).filter(x => x.startsWith('theme.')),
    ['theme.dungeon', 'theme.diyu', 'theme.jeju', 'theme.polar', 'theme.candy']);
  const diyu = ids(C.assets('delivery', 'theme.diyu', assets));
  assert.ok(diyu.includes('char.yama') && diyu.includes('obj.door_lantern_diyu'));
  assert.ok(diyu.includes('obj.crate_wood'));
  assert.ok(!diyu.includes('char.haenyeo'));
  assert.ok(!diyu.includes('mech.rune_float'), 'stone-prison float art is not a diyu-specific asset');
  assert.ok(!ids(C.assets('delivery', 'theme.diyu', assets, {shared:false})).includes('obj.crate_wood'));
  assert.ok(!ids(C.assets('level', 'theme.cave', assets)).includes('theme.diyu'));
});

test('all 82 new candidates remain discoverable including draft concepts, screens and whole hub scenes', () => {
  const C = load(), delivery = new Set(ids(C.assets('delivery', 'all', assets)));
  for (const a of receipt.assets) assert.ok(delivery.has(a.id), a.id);
  const hub = ids(C.assets('delivery', 'hub', assets));
  for (const id of ['scene.hub_post', 'scene.hub_crew', 'scene.hub_gallery', 'ui.screen.story_board'])
    assert.ok(hub.includes(id), id);
  const crew = ids(C.assets('delivery', 'characters', assets));
  assert.ok(crew.includes('char.hero_concept_fox_mask'));
  const screens = ids(C.assets('delivery', 'screens', assets));
  assert.ok(screens.includes('ui.screen.run_result') && screens.includes('ui.screen.delivery_help'));
  assert.ok(!screens.includes('ui.screen.levels'));
});

test('each mode includes the declared dependencies of its shared screens and themes', () => {
  const C = load();
  for (const mode of ['level','delivery']) {
    const rows = C.assets(mode, 'all', assets), found = new Set(ids(rows));
    for (const a of rows) for (const dependency of a.depends || [])
      assert.ok(found.has(dependency), `${mode}: ${a.id} requires ${dependency}`);
  }
});

test('mode audio lists cover all 32 public effects, keep shared sounds and do not revive shelved music', () => {
  const C = load(), level = C.sounds('level', audio), delivery = C.sounds('delivery', audio);
  assert.ok(level.every(e => e.kind === 'sfx') && delivery.every(e => e.kind === 'sfx'));
  assert.ok(ids(level).includes('push') && ids(delivery).includes('push'));
  assert.ok(!ids(level).includes('delivery_arrive'));
  assert.ok(!ids(delivery).includes('level_clear'));
  assert.equal(new Set(ids(level).concat(ids(delivery))).size, 32);
});

test('mode routes reject missing sections without hiding the resource overview', () => {
  const C = load();
  assert.deepEqual(ids(C.assets('level', 'not-a-section', assets)), ids(C.assets('level', 'all', assets)));
  assert.deepEqual(Array.from(C.assets('unknown-mode', 'all', assets)), []);
});

test('six visible entries keep separate internal tool routes', () => {
  const C=load(), document={documentElement:{}};
  const window={PBModeCatalog:C,PBStore:{assets:()=>assets}};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'workbench/js/app/nav.js'),'utf8'),{window,document,localStorage:{getItem:()=>null}});
  assert.deepEqual(Array.from(window.PBNav.MENU,m=>m.label),['总览','资源库','场景与界面','确认','地图概念','声音']);
  for(const view of ['assets','edit','export','ui-proposals','audio'])assert.ok(window.PBNav.pages().some(p=>p.view===view),view);
});
