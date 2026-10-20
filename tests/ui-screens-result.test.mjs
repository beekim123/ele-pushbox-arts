import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { loadCore, ROOT } from "../tools/lib/load-core.mjs";
import { loadTextTables } from "../tools/lib/i18n.mjs";

const PB = loadCore(["raster", "font-data", "font-small", "font-delivery", "font-extra", "font-ui", "font-rooms2", "sprites", "i18n", "tilemodel", "terrain", "terrain-diyu", "terrain-jeju", "ambient", "env", "matter", "scene", "dialogue", "ui", "ui-delivery", "ui-kit", "ui-skins", "ui-style", "ui-common", "rooms", "mapgen", "rooms2", "mapgen2", "delivery-scene", "delivery-scene2"], { authoringModel: false });
const chapterLobby = PB.ui.SCREENS.lobby;
loadCore(["ui-screens-result"], { authoringModel: false });
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "workbench/data/bundle.js"), "utf8"), { window: ctx });
for (const a of ctx.PB_BUNDLE.assets) PB.sprites.register(a);
PB.i18n.setTables(loadTextTables(ROOT).tables);
const asset = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, `art/source/screen/ui.screen.${id}.json`), "utf8"));
const draw = (a, st) => {
  PB.uiCommon.takeIssues();
  const r = new PB.Raster(320, 180);
  assert.deepEqual(PB.ui.render(r, a, 0, { locale: "en", env: "off", focus: 0, ...st }), []);
  assert.deepEqual(PB.uiCommon.takeIssues(), []);
  return r;
};

test("UI-10c: both result backgrounds use validated v2 rooms and the v2 renderer", () => {
  const old = PB.droom2.draw, rooms = [];
  PB.droom2.draw = function (...args) { rooms.push(args[1]); return old.apply(this, args); };
  try {
    for (const id of ["settlement", "settlement_fail"]) {
      const a = asset(id);
      assert.equal(a.params.room.format, "pushbox.room/2");
      assert.deepEqual(PB.rooms2.validate(a.params.room), []);
      for (const locale of ["zh-Hans", "en"]) draw(a, { locale });
    }
    assert.equal(rooms.length, 4);
  } finally { PB.droom2.draw = old; }
});

test("UI-10c: both result actions select independently and both failure reasons fit", () => {
  for (const id of ["settlement", "settlement_fail"]) {
    const a = asset(id), first = draw(a), second = draw(a, { focus: 1 });
    assert.notDeepEqual(first.data, second.data);
    a.params.focus = 0;
    assert.deepEqual(draw(a, { focus: 1 }).data, first.data);
  }
  const a = asset("settlement_fail");
  a.params.reason = "cargo";
  for (const locale of ["zh-Hans", "en"]) draw(a, { locale });
});

test("UI-10c: result screens preserve the supplied payout and keep amounts", () => {
  const old = PB.uk.C.prototype.text, labels = [];
  PB.uk.C.prototype.text = function (x, y, text, ...rest) { labels.push(text); return old.call(this, x, y, text, ...rest); };
  try {
    const a = asset("settlement"); Object.assign(a.params, { tip: 47, picked: 19, total: 66 });
    draw(a);
    for (const n of ["47", "19", "66"]) assert.ok(labels.includes(n), n);
    labels.length = 0;
    const b = asset("settlement_fail"); Object.assign(b.params, { picked: 40, kept: 20 });
    draw(b);
    assert.ok(labels.includes("20"));
    assert.ok(labels.some(s => s.includes("40") && s.includes("20")));
  } finally { PB.uk.C.prototype.text = old; }
});

test("UI-10c: generic lobby keeps four menu actions, coins and a fixed diyu backdrop without replacing chapter skins", () => {
  assert.equal(PB.ui.SCREENS.lobby, chapterLobby);
  const a = asset("lobby_generic"), old = PB.uiStyle.backdrop, themes = [];
  assert.deepEqual(a.params.items.map(it => it.key), ["result.lobby.level", "result.lobby.delivery", "menu.settings", "menu.quit"]);
  PB.uiStyle.backdrop = function (...args) { themes.push(args[1]); return old.apply(this, args); };
  try {
    for (const locale of ["zh-Hans", "en"]) for (let focus = 0; focus < 4; focus++) draw(a, { locale, focus, theme: "theme.jeju" });
    assert.deepEqual(themes, Array(8).fill("theme.diyu"));
    const first = draw(a); a.params.coins = 4321;
    assert.notDeepEqual(draw(a).data, first.data);
  } finally { PB.uiStyle.backdrop = old; }
});
