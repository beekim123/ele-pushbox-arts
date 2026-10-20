// Text tables (tools/lib/i18n.mjs): content/i18n plus content/i18n-<name>, and glyph coverage.
// Uses temporary directories only.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadTextTables, missingGlyphs } from "../tools/lib/i18n.mjs";
import { loadCore, ROOT } from "../tools/lib/load-core.mjs";

function root(tables) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pb-i18n-"));
  for (const [rel, data] of Object.entries(tables)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), JSON.stringify(data));
  }
  return dir;
}
const BASE = { "content/i18n/zh-Hans.json": { "a.b": "甲" }, "content/i18n/en.json": { "a.b": "A" } };

test("the repository's text tables merge without clashes and every glyph exists", () => {
  const { tables, source } = loadTextTables(ROOT);
  assert.equal(source["dlv.reels.title"], "content/i18n-delivery/zh-Hans.json");
  assert.equal(source["pause.title"], "content/i18n/zh-Hans.json");
  assert.equal(source["d2.feed"], "content/i18n-delivery2/zh-Hans.json");
  const PB = loadCore(["raster", "font-data", "font-small", "font-delivery", "font-extra", "font-ui", "font-rooms2", "font-delivery2", "font-onboarding", "font-ui11", "sprites"]);
  assert.deepEqual(missingGlyphs(PB, tables), []);
});

test("an extra table merges per locale; a repeated key or a missing translation is an error", () => {
  const ok = loadTextTables(root({ ...BASE, "content/i18n-x/zh-Hans.json": { "x.y": "乙" }, "content/i18n-x/en.json": { "x.y": "B" } }));
  assert.equal(ok.tables.en["x.y"], "B");
  assert.equal(ok.source["x.y"], "content/i18n-x/zh-Hans.json");
  // Problems are reported (the content check turns them into errors), never thrown: a bad table must not stop the art build.
  const dup = loadTextTables(root({ ...BASE, "content/i18n-x/zh-Hans.json": { "a.b": "乙" }, "content/i18n-x/en.json": { "a.b": "B" } }));
  assert.equal(dup.tables["zh-Hans"]["a.b"], "甲", "the first table keeps its key");
  assert.match(dup.problems[0].msg, /一个键只能在一张表里/);
  const gap = loadTextTables(root({ ...BASE, "content/i18n-x/zh-Hans.json": { "x.y": "乙" } }));
  assert.equal(gap.tables["zh-Hans"]["x.y"], "乙");
  assert.match(gap.problems[0].msg, /缺少 x\.y/);
});

test("a character no font has is reported (it would draw as ?)", () => {
  const PB = loadCore(["raster", "font-data", "font-small", "sprites"]);
  const miss = missingGlyphs(PB, { "zh-Hans": { "k.title": "龘" } });
  assert.equal(miss.length, 1);
  assert.equal(miss[0].chars, "龘");
});
