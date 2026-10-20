// UI-10b: rendering contracts for the seven independent G2 delivery screens.
// Reads repository inputs; every output is an in-memory raster.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { loadCore, ROOT } from "../tools/lib/load-core.mjs";
import { loadTextTables } from "../tools/lib/i18n.mjs";
const PB = loadCore(["raster", "font-data", "font-small", "font-delivery", "font-extra", "font-ui", "font-rooms2", "sprites", "i18n", "tilemodel", "terrain", "terrain-diyu", "terrain-jeju", "ambient", "env", "matter", "scene", "dialogue", "ui", "ui-delivery", "ui-kit", "ui-skins", "ui-style", "ui-common", "ui-screens-level", "rooms", "mapgen", "rooms2", "mapgen2", "delivery-scene", "delivery-scene2", "font-delivery2", "ui-screens-delivery"], { authoringModel: false });
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "workbench/data/bundle.js"), "utf8"), { window: win });
for (const a of win.PB_BUNDLE.assets) PB.sprites.register(a);
PB.i18n.setTables(loadTextTables(ROOT).tables);
const ids = ["reels", "shop", "delivery_hud", "delivery_pause", "confirm", "hint_animal", "observe"];
const asset = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, `art/source/screen/ui.screen.${id}.json`), "utf8"));
function draw(a, locale = "zh-Hans") {
  const r = new PB.Raster(320, 180), labels = [], old = PB.uk.C.prototype.text;
  PB.uk.C.prototype.text = function (x, y, s, ...rest) { labels.push(s); return old.call(this, x, y, s, ...rest); };
  PB.uiCommon.takeIssues();
  let issues;
  try { issues = PB.ui.render(r, a, 0, { locale, focus: 0, env: "full" }); }
  finally { PB.uk.C.prototype.text = old; }
  issues.push(...PB.uiCommon.takeIssues());
  return { r, labels, issues };
}
test("all seven delivery candidates draw v2 rooms and fit both shipped locales", () => {
  for (const id of ids) for (const locale of ["zh-Hans", "en"]) {
    const a = asset(id);
    assert.equal(a.params.room2.format, "pushbox.room/2", id);
    assert.equal(a.params.screen, id, "delivery pause must not override level pause");
    const { r, issues } = draw(a, locale);
    assert.deepEqual(issues, [], id + "/" + locale);
    for (let i = 3; i < r.data.length; i += 4) assert.equal(r.data[i], 255, id + " has an undrawn pixel");
  }
});
test("three reels follow map, recipient, cargo order and show remaining rerolls, including zero", () => {
  const a = asset("reels"), ordered = ["Map", "Recipient", "Cargo"];
  for (const n of [1, 0]) {
    a.params.rerolls = n;
    const { labels } = draw(a, "en");
    assert.ok(labels.includes(`Reroll ${n} left`));
    const indexes = ordered.map((s) => labels.indexOf(s));
    assert.ok(indexes[0] >= 0 && indexes[0] < indexes[1] && indexes[1] < indexes[2]);
    assert.ok(labels.includes("Old Miner") && labels.includes("Letter"));
  }
});
test("station snacks keep their price and stock while their package follows the region", () => {
  const a = asset("shop"), g = a.params.goods.find((g) => g.id === "snack");
  assert.deepEqual(g, { id: "snack", price: 10, stock: 3 });
  for (const [world, id, anim, label] of [["dungeon", "item.snack", "dungeon", "Fish crackers"], ["diyu", "item.snack", "diyu", "Osmanthus cake"], ["jeju", "item.snack_jeju", "default", "Millet cake"]]) {
    a.params.world = world;
    const { labels, issues } = draw(a, "en"), s = PB.uiDelivery2.snack(a.params);
    assert.equal(s.id, id); assert.equal(s.anim, anim);
    assert.ok(labels.includes(label)); assert.ok(labels.includes("×3") && labels.includes("10"));
    assert.deepEqual(issues, [], world);
  }
});
test("minimap shows a two-by-two current room, visited rooms, a station and recipient direction", () => {
  const c = new PB.uk.C(new PB.Raster(80, 20));
  const map = { cols: 5, rows: 2, cur: 1, rooms: [
    { index: 0, x: 0, y: 1, seen: true },
    { index: 1, x: 1, y: 0, cols: 2, rows: 2, seen: true },
    { index: 2, x: 3, y: 1, role: "station", seen: true },
    { index: 3, x: 4, y: 0, role: "home", seen: false },
  ] };
  PB.uiDelivery2.minimap(c, 0, 0, 80, 20, map);
  assert.equal(c.get(7, 6), "m"); assert.equal(c.get(14, 13), "m", "current room spans two screens in both directions");
  assert.equal(c.get(3, 10), "u", "visited room remains visible");
  assert.equal(c.get(15, 12), "m", "station has a cross");
  assert.equal(c.get(21, 6), "l", "recipient is marked even before visiting");
  assert.equal(c.get(75, 10), "m", "arrow points toward the recipient");
});
test("hint and observation candidates keep their navigation and feeding instructions", () => {
  const hint = draw(asset("hint_animal"), "en");
  assert.ok(hint.labels.includes("Dig a bag of sand first."));
  assert.ok(hint.labels.includes("Feed snacks to a cat, dog or pony."));
  const a = asset("observe"), result = draw(a, "en"), c = new PB.uk.C(result.r);
  assert.ok(result.labels.includes("Tab") && result.labels.includes("Back"));
  for (const label of ["You", "Exit", "Foe", "Hint"]) assert.ok(result.labels.includes(label));
  const scene = PB.uiDelivery2.roomView(a.params, 0, true);
  assert.equal(scene.r.w, 640); assert.equal(scene.r.h - 20, 320);
  const { player } = scene.P.s;
  assert.equal(c.get(player.x * 8 + 4, 20 + player.y * 8 + 4), "m", "player marker uses exactly half-size coordinates");
});
