#!/usr/bin/env node
// Rebuild the public review sheets from sanitized candidate sources, never
// from the original offline screenshots (which used private room geometry).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadCore, listJson } from './lib/load-core.mjs';
import { loadTextTables } from './lib/i18n.mjs';
import { encodePng } from './lib/png.mjs';

const receipt = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/review/OFFLINE-ART-20261020/receipt.json')));
const html = fs.readFileSync(path.join(ROOT, 'workbench/index.html'), 'utf8');
const modules = [...html.matchAll(/src="js\/core\/([^"\n]+)\.js"/g)].map(m => m[1]);
const PB = loadCore(modules, { authoringModel: false });
const assets = listJson('art/source').map(f => JSON.parse(fs.readFileSync(path.join(ROOT, f))));
for (const a of assets) PB.sprites.register(a);
PB.i18n.setTables(loadTextTables(ROOT).tables);

const groups = {
  'UI-12a': ['run_door', 'run_door_skull', 'run_map'],
  'UI-12b': ['run_shelf', 'run_rest', 'run_quit', 'run_event', 'run_result'],
  'UI-12c': ['run_wish_card', 'run_lucky', 'run_wish_give'],
  'UI-13a': ['story_board', 'story_chapter', 'story_order', 'story_letter', 'story_complete', 'lobby_story'],
  'UI-13b': ['crew_room', 'crew_pick', 'crew_joined'],
  'UI-tutorial-assist': ['delivery_help', 'delivery_practice', 'delivery_assist'],
};
const variants = {
  run_door: [{ world: 'dungeon' }, { world: 'jeju' }],
  run_door_skull: [{ world: 'dungeon' }, { world: 'jeju' }],
  run_map: [1, 4, 6, 9, 12].map(cur => ({ chain: { cur } })),
  run_shelf: [0, 1, 3, 4, 5, 6, 7, 8, 9].map(focus => ({ focus })),
  run_rest: [0, 2, 3].map(focus => ({ focus })),
  run_quit: [{ focus: 1 }],
  run_event: ['ghost_peddler', 'forgetful_soup', 'lantern_riddle', 'lost_parcel', 'haunted_crate'].map(event => ({ event })),
  run_result: ['quit', 'gave_up', 'failed'].map(end => ({ end })),
  run_wish_card: [{ known: true }, { first: false }],
  run_lucky: [{ focus: 0 }, { focus: 2 }],
  run_wish_give: [1, 2, 3, 4].map(page => ({ page })),
  story_board: [1, 2, 3].map(focus => ({ focus })),
  story_chapter: [1, 2, 3].map(focus => ({ focus })),
  story_order: [{ focus: 1 }],
  story_letter: [{ copies: 1 }, { sign: 'hand' }],
  story_complete: [],
  lobby_story: [1, 2, 3, 4].map(focus => ({ focus })),
  crew_room: [0, 1, 2, 3, 4, 5].map(focus => ({ focus })),
  crew_pick: [0, 1, 2, 3, 4, 5].map(focus => ({ focus })),
  crew_joined: [],
  delivery_help: [1, 2, 3, 4, 5].map(focus => ({ focus })).concat([{ view: 'entry' }]),
  delivery_practice: [{ world: 'dungeon' }, { world: 'jeju' }],
  delivery_assist: [{ focus: 1 }, { focus: 2 }, { relaxed: 50 }, { relaxed: 100 }],
};
const output = path.join(ROOT, 'art/review/OFFLINE-ART-20261020');
const report = { format: 'portitor.offline-art-review/1', approval: 'none', renders: [], issues: [] };
for (const [group, screens] of Object.entries(groups)) {
  const dir = path.join(output, group);
  fs.mkdirSync(dir, { recursive: true });
  const samples = new PB.Raster(640, screens.length * 180);
  const rows = [];
  for (const [row, screen] of screens.entries()) {
    const a = assets.find(a => a.id === 'ui.screen.' + screen);
    if (!a || !receipt.assets.some(x => x.id === a.id)) throw Error('Missing candidate: ' + screen);
    for (const [n, patch] of [{}, ...variants[screen]].entries()) {
      const pair = new PB.Raster(640, 180);
      for (const [col, locale] of ['zh-Hans', 'en'].entries()) {
        const copy = structuredClone(a);
        Object.assign(copy.params, patch);
        if (patch.world) { copy.params.room2.world = patch.world; copy.params.theme = 'theme.' + patch.world; }
        const r = new PB.Raster(320, 180);
        const issues = PB.ui.render(r, copy, 0, { locale, focus: 0, env: 'full' });
        report.renders.push({ id: a.id, version: a.version, hash: a.content_hash, variant: n, patch, locale });
        report.issues.push(...issues.map(issue => ({ screen, variant: n, locale, ...issue })));
        pair.blit(r, col * 320, 0);
      }
      if (n === 0) samples.blit(pair, 0, row * 180);
      rows.push(pair);
    }
  }
  fs.writeFileSync(path.join(dir, 'samples.png'), encodePng(samples.w, samples.h, samples.data));
  for (let start = 0; start < rows.length; start += 6) {
    const chunk = rows.slice(start, start + 6), sheet = new PB.Raster(640, chunk.length * 180);
    chunk.forEach((r, n) => sheet.blit(r, 0, n * 180));
    fs.writeFileSync(path.join(dir, `variants-${String(start / 6 + 1).padStart(2, '0')}.png`), encodePng(sheet.w, sheet.h, sheet.data));
  }
}
fs.writeFileSync(path.join(output, 'render-report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(`offline review: ${report.renders.length} renders; ${report.issues.length} layout issues`);
if (report.issues.length) { console.error(JSON.stringify(report.issues, null, 1)); process.exitCode = 1; }
