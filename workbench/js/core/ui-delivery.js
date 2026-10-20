/* Delivery-mode screens and the in-run HUD (docs/design/delivery-slice.md §2,
 * §8–§11): the reel stand, the station shelf, the settlement (delivered and
 * failed) and the HUD over a room. Layout references at 320x180 in the style of
 * ui.js, registered into PB.ui.SCREENS; ui.js itself is untouched (it feeds the
 * content hash of the approved screens, AGENTS.md 2a). Text comes from
 * content/i18n-delivery through PB.i18n.t; glyphs the frozen fonts lack come
 * from font-delivery.js. The live map preview draws its HUD with PB.dui.hud.
 * Godot builds these with Control containers, like the other screens. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const S = () => PB.sprites, TX = () => PB.text, I = () => PB.i18n;
  const W = 320, H = 180, LINE = 13, HUD_H = 20;
  const T = (k, v) => I().t(k, v);

  // ---------- primitives (the same look as ui.js, whose helpers are private) ----------
  function panel(r, x, y, w, h, frame) { S().ninepatch(r, "ui.panel", frame, x, y, w, h); }
  // Draws a frame with its top-left corner at (x, y), whatever the sprite's anchor.
  function icon(r, id, anim, x, y) { const a = S().get(id); S().draw(r, id, a.animations[anim] ? a.animations[anim].frames[0] : 0, 0, x + a.anchor[0], y + a.anchor[1]); }
  function key(r, name, x, y) { icon(r, "ui.keycap", name, x, y); return 13; }
  function wideKey(r, s, x, y) {
    const w = TX().measure(s) + 8;
    r.rect(x + 1, y, w - 2, 13, "z"); r.rect(x, y + 1, w, 11, "z");
    r.rect(x + 1, y + 1, w - 2, 10, "u"); r.hline(x + 1, y + 11, w - 2, "v");
    TX().draw(r, s, x + 4, y - 1, "y");
    return w;
  }
  const label = (...a) => PB.ui.label(...a), para = (...a) => PB.ui.para(...a);
  function centered(r, str, cx, y, maxW, color, shadow, id) {
    const e = I().ellipsize(str, maxW);
    if (e.cut) I().report("ellipsis", id || str, { x: cx - (maxW >> 1), y, w: maxW, h: LINE });
    TX().draw(r, e.text, cx - (TX().measure(e.text) >> 1), y, color, shadow);
  }
  function title2x(r, str, x, y, maxW, color, shadow, id) {
    if (TX().measure(str) * 2 <= maxW) return PB.ui.text2x(r, str, x, y, color, shadow);
    return label(r, str, x, y + 6, maxW, color, shadow, id);
  }
  function title2xCentered(r, str, cx, y, maxW, color, shadow, id) {
    const w = TX().measure(str) * 2;
    if (w <= maxW) return PB.ui.text2x(r, str, cx - (w >> 1), y, color, shadow);
    centered(r, str, cx, y + 6, maxW, color, shadow, id);
    return 0;
  }
  // Key hint bar: groups {keys, label, vars}; labels are dropped (keys kept) when out of room.
  function keyBar(r, groups, x, y, maxX) {
    const keysW = (g) => g.keys.reduce((s, k) => s + (k.wide ? TX().measure(k.wide) + 8 : 13) + 1, 0);
    const full = groups.reduce((s, g) => s + keysW(g) + 3 + TX().measure(T(g.label, g.vars)) + 10, 0) <= maxX - x;
    if (!full) I().report("dropped", "keybar", { x, y, w: maxX - x, h: 13 });
    for (const g of groups) {
      for (const k of g.keys) x += (k.wide ? wideKey(r, k.wide, x, y) : key(r, k, x, y)) + 1;
      if (full) x += 3 + TX().draw(r, T(g.label, g.vars), x, y - 1, "v");
      x += 10;
    }
  }
  function button(r, str, x, y, focused, id, maxW) {
    const w = Math.min(maxW || 140, TX().measure(str) + 14);
    panel(r, x, y, w, 15, focused ? 1 : 0);
    label(r, str, x + 7, y, w - 14, focused ? "l" : "u", null, id);
    return w;
  }
  function buttons(r, a, b, cy) {
    const sa = T(a), sb = T(b);
    const aw = Math.min(140, TX().measure(sa) + 14), bw = Math.min(140, TX().measure(sb) + 14), total = aw + 6 + bw, x = (W - total) >> 1;
    button(r, sa, x, cy, true, a);
    button(r, sb, x + aw + 6, cy, false, b);
  }
  function dim(r) { r.remap(0, 0, W, H, PB.DIM); r.remap(0, 0, W, H, PB.DIM); }
  function bottomBar(r) { r.rect(0, H - 19, W, 19, "z"); r.hline(0, H - 19, W, "y"); }

  // The region's theme as the delivery mode uses it: approved theme, minus the
  // ambient life that looks like a local monster (worlds.json ambient_exclude).
  function regionTheme(base, exclude) {
    const id = base + "~delivery";
    if (!S().has(id)) {
      const a = S().get(base), drop = new Set(exclude || []);
      S().register(Object.assign({}, a, { id, params: Object.assign({}, a.params, { ambient: (a.params.ambient || []).filter((x) => !drop.has(x.id)) }) }));
    }
    return id;
  }
  // Themed backdrop behind a menu: the same picture as ui.js's menus (background,
  // a floor, ambient life, light), in the region's delivery theme.
  function backdrop(r, p, tick, st) {
    const theme = regionTheme(p.theme || "theme.dungeon", p.exclude), level = (st && st.env) || "full";
    const Tm = S().get(theme).params, M = PB.terrain.MAT, oy = 12;
    const map = { w: 21, h: 11, at: (x, y) => (x < 0 || x >= 21 || y < 0 ? M.EMPTY : y >= 9 ? M.ROCK : M.EMPTY) };
    PB.terrain.drawBackground(r, Tm, 0, 0, W, H, tick);
    const area = { x: 0, y: 0, w: W, h: 150 }, lights = [], amb = { mode: "one", seed: PB.ambient.seedOf(theme), out: lights };
    const envCtx = { tick, area: { x: 0, y: 20, w: W, h: 136 }, lights, level };
    for (const layer of ["back", "front"]) PB.ambient.draw(r, Tm, map, 0, oy, tick, layer, null, area, null, Object.assign({}, amb, { dry: true }));
    PB.env.draw(r, Tm, "back", envCtx);
    amb.out = null;
    PB.ambient.draw(r, Tm, map, 0, oy, tick, "back", null, area, null, amb);
    PB.terrain.drawTerrain(r, map, Tm, 0, oy, tick >> 3);
    PB.ambient.draw(r, Tm, map, 0, oy, tick, "front", null, area, null, amb);
    PB.env.draw(r, Tm, "light", envCtx);
    PB.env.draw(r, Tm, "front", envCtx);
  }

  const nameOf = (kind, id) => T(kind + "." + id + ".name");

  // ---------- HUD ----------
  // h: {hearts, maxHearts, cargo, left, max, rule (fragile|melt|null), hot, coins,
  //     sand, items: [id], slots, secs, minimap: {cols, rows, rooms: [{x, y, role, seen}], cur}}
  const ITEM_ICON = { first_aid: "item.first_aid", rope_ladder: "item.rope_ladder" };
  function hud(r, h) {
    r.rect(0, 0, W, HUD_H, "z");
    r.hline(0, HUD_H - 1, W, "y");
    let x = 1;
    for (let i = 0; i < h.maxHearts; i++) { icon(r, "ui.delivery_icons", i < h.hearts ? "heart" : "heart_empty", x, 2); x += 10; }
    x += 4;
    if (h.cargo) {
      icon(r, "cargo." + h.cargo, h.left < h.max && h.cargo === "vase" ? "cracked" : h.rule === "melt" && h.hot ? "melting" : "default", x, 2); x += 16;
      for (let i = 0; i < h.max; i++) { icon(r, "ui.delivery_icons", i < h.left ? "pip" : "pip_empty", x - 4, 2); x += 7; }
      if (h.rule) { icon(r, "ui.delivery_icons", h.rule, x - 2, 2); x += 13; }
      if (h.hot) { icon(r, "ui.delivery_icons", "hot", x - 2, 2); x += 13; }
    }
    x += 6;
    icon(r, "item.coin", "default", x - 3, 2); x += 11;
    x += TX().draw(r, String(h.coins), x, 3, "l", "g") + 7;
    icon(r, "item.sandbag", "full", x - 2, 2); x += 13;
    x += TX().draw(r, "×" + h.sand, x, 3, "c", "g") + 7;
    for (let i = 0; i < h.slots; i++) {
      icon(r, "ui.delivery_icons", "slot", x, 2);
      const it = h.items[i];
      if (it) icon(r, ITEM_ICON[it], "default", x, 2);
      x += 16;
    }
    // Right side: minimap, then the clock.
    let rx = W - 3;
    const mm = h.minimap;
    if (mm) {
      const cw = 6, ch = 4, mw = mm.cols * (cw + 1) - 1;
      rx -= mw;
      for (const room of mm.rooms) {
        const cur = room.index === mm.cur;
        if (!room.seen && !cur && room.role !== "home") continue;
        r.rect(rx + room.x * (cw + 1), 2 + room.y * (ch + 1), cw, ch, cur ? "l" : room.role === "home" ? "m" : room.role === "station" ? "j" : "w");
      }
      rx -= 5;
    }
    const secs = h.secs | 0, clock = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
    rx -= TX().measure(clock);
    TX().draw(r, clock, rx, 3, "u", "y");
    icon(r, "ui.delivery_icons", "clock", rx - 15, 2);
  }

  // ---------- screens ----------
  // Reel stand: the lucky cat's raised paw is the lever; two reels (cargo,
  // recipient) show the result, the rules of both and the "likes" bonus.
  function reels(r, tick, p, st) {
    backdrop(r, p, tick, st);
    dim(r);
    title2x(r, T("dlv.reels.title"), 10, 3, 200, "l", "z", "dlv.reels.title");
    // The stand: a little wooden counter under the cat.
    r.rect(14, 112, 60, 3, "z"); r.rect(15, 113, 58, 6, "e"); r.rect(15, 113, 58, 1, "d"); r.rect(17, 119, 4, 9, "f"); r.rect(67, 119, 4, 9, "f");
    S().draw(r, "char.lucky_cat", p.cat || "idle", tick, 44, 112);
    // Reel cabinet.
    const x0 = 80, y0 = 34, w0 = 232, h0 = 76;
    panel(r, x0, y0, w0, h0, 2);
    const cols = [{ kind: "cargo", list: p.cargoList, sel: p.cargo, cx: x0 + 58 }, { kind: "recipient", list: p.recipientList, sel: p.recipient, cx: x0 + w0 - 58 }];
    for (const c of cols) {
      centered(r, T(c.kind === "cargo" ? "dlv.reels.cargo" : "dlv.reels.recipient"), c.cx, y0 + 2, 100, "c", "g", "dlv.reels." + c.kind);
      // Window: the chosen cell in full, slivers of its neighbours above and below.
      const wx = c.cx - 17, wy = y0 + 18, ww = 34, wh = 40;
      r.rect(wx - 1, wy - 1, ww + 2, wh + 2, "z"); r.rect(wx, wy, ww, wh, "y");
      const i = c.list.indexOf(c.sel), n = c.list.length;
      const cell = (id, cy) => {
        const tmp = new PB.Raster(24, 24);
        tmp.rect(0, 0, 24, 24, "u"); tmp.rect(0, 23, 24, 1, "v"); tmp.rect(0, 0, 24, 1, "t");
        if (c.kind === "cargo") icon(tmp, "cargo." + id, "default", 4, 4); else icon(tmp, "avatar." + id, "default", 0, 0);
        return tmp;
      };
      const put = (tmp, dy, clipTop, clipH, dark) => {
        for (let yy = 0; yy < clipH; yy++) for (let xx = 0; xx < 24; xx++) { const col = tmp.get(xx, clipTop + yy); if (col !== ".") r.set(wx + 5 + xx, wy + dy + yy, dark ? PB.DIM[col] || col : col); }
      };
      put(cell(c.list[(i - 1 + n) % n]), 0, 16, 8, true);
      put(cell(c.list[i]), 8, 0, 24, false);
      put(cell(c.list[(i + 1) % n]), 32, 0, 8, true);
      r.rect(wx - 4, wy + 18, 2, 4, "l"); r.rect(wx + ww + 2, wy + 18, 2, 4, "l");
      centered(r, nameOf(c.kind, c.sel), c.cx, y0 + 60, 104, "l", "z", c.kind + "." + c.sel + ".name");
    }
    // The bonus between the reels when the recipient likes the cargo.
    if (p.liked) { icon(r, "ui.delivery_icons", "heart", x0 + (w0 >> 1) - 8, y0 + 22); centered(r, "×1.5", x0 + (w0 >> 1), y0 + 38, 40, "k", "g", "like"); }
    // Rules of both, and the bonus, in words.
    const ix = 6, iy = 116, iw = W - 12, lines = [nameOf("cargo", p.cargo) + " · " + T("cargo." + p.cargo + ".rule"), nameOf("recipient", p.recipient) + " · " + T("recipient." + p.recipient + ".rule")];
    if (p.liked) lines.push(T("dlv.reels.likes", { name: nameOf("recipient", p.recipient), cargo: nameOf("cargo", p.cargo) }));
    panel(r, ix, iy, iw, 8 + lines.length * LINE, 0);
    lines.forEach((s, k) => label(r, s, ix + 7, iy + 3 + k * LINE, iw - 14, k === 2 ? "k" : "u", null, "dlv.reels.rule." + k));
    bottomBar(r);
    keyBar(r, [{ keys: ["left", "right"], label: "dlv.keys.reel" }, { keys: ["R"], label: "dlv.reels.reroll", vars: { n: p.rerolls } }, { keys: [{ wide: "Enter" }], label: "dlv.keys.go" }], 8, H - 16, W - 8);
  }

  // Station shelf: the old turtle keeper (heals once per station when you talk
  // to him), three goods with price and stock, your coins and your bag.
  function shop(r, tick, p, st) {
    backdrop(r, p, tick, st);
    dim(r);
    const kx = 46, ky = 140;
    S().draw(r, "char.turtle_keeper", "talk", tick, kx, ky);
    PB.dialogue.bubble(r, { text: T("dlv.shop.greet"), at: [kx + 10, ky - 30], style: "say", maxW: 96, name: nameOf("npc", "turtle_keeper"), id: "dlv.shop.greet" });
    const px = 98, py = 6, pw = W - px - 6, ph = 150;
    panel(r, px, py, pw, ph, 0);
    const coins = String(p.coins), cw = TX().measure(coins);
    TX().draw(r, coins, px + pw - 8 - cw, py + 3, "l", "g");
    icon(r, "item.coin", "default", px + pw - 24 - cw, py + 2);
    label(r, T("dlv.shop.title"), px + 8, py + 3, pw - 44 - cw, "l", null, "dlv.shop.title");
    const sel = p.focus | 0;
    // One row per good: icon, name, then stock, coin and price on the right.
    p.goods.forEach((g, i) => {
      const y = py + 20 + i * 22, w = pw - 10, x = px + 5, out = g.stock <= 0;
      panel(r, x, y, w, 20, i === sel ? 1 : 0);
      icon(r, "item." + g.id, g.id === "sandbag" ? "full" : "default", x + 3, y + 2);
      if (out) r.remap(x + 3, y + 2, 16, 16, PB.DIM);
      const price = String(g.price), prw = TX().measure(price), stock = out ? T("dlv.shop.sold_out") : T("dlv.shop.left", { n: g.stock }), stw = TX().measure(stock);
      TX().draw(r, price, x + w - 6 - prw, y + 3, out ? "w" : "k", "g");
      icon(r, "item.coin", "default", x + w - 21 - prw, y + 2);
      TX().draw(r, stock, x + w - 26 - prw - stw, y + 3, out ? "w" : "v");
      label(r, nameOf("item", g.id), x + 22, y + 3, w - 56 - prw - stw, out ? "w" : i === sel ? "l" : "u", null, "item." + g.id + ".name");
    });
    const g = p.goods[sel];
    para(r, T("item." + g.id + ".desc"), px + 8, py + 90, pw - 16, 2, "c", "item." + g.id + ".desc");
    // The bag: item slots and sand.
    const by = py + ph - 20;
    r.hline(px + 6, by - 2, pw - 12, "x");
    const bagW = label(r, T("dlv.shop.bag"), px + 8, by + 1, 60, "v", null, "dlv.shop.bag");
    let x = px + 14 + bagW;
    for (let i = 0; i < p.slots; i++) { icon(r, "ui.delivery_icons", "slot", x, by); if (p.bag[i]) icon(r, ITEM_ICON[p.bag[i]], "default", x, by); x += 17; }
    icon(r, "item.sandbag", "full", x + 4, by);
    TX().draw(r, "×" + p.sand, x + 20, by + 1, "c");
    bottomBar(r);
    keyBar(r, [{ keys: ["up", "down"], label: "keys.select" }, { keys: [{ wide: "Enter" }], label: "dlv.keys.buy" }, { keys: [{ wide: "Esc" }], label: "dlv.keys.leave" }], 8, H - 16, W - 8);
  }

  function pips(r, x, y, left, max) { for (let i = 0; i < max; i++) icon(r, "ui.delivery_icons", i < left ? "pip" : "pip_empty", x - 5 + i * 8, y - 5); }
  // Rating medal: the letter in 2x on a round plate.
  function medal(r, cx, cy, letter) {
    const fill = { S: "k", A: "u", B: "e", C: "w" }[letter] || "w", rim = { S: "b", A: "v", B: "f", C: "x" }[letter] || "x";
    for (let yy = -11; yy <= 11; yy++) for (let xx = -11; xx <= 11; xx++) {
      const d = xx * xx + yy * yy;
      if (d <= 121) r.set(cx + xx, cy + yy, d > 100 ? "z" : d > 72 ? rim : fill);
    }
    const w = TX().measure(letter) * 2;
    PB.ui.text2x(r, letter, cx - (w >> 1), cy - 12, letter === "S" ? "t" : "z", null);
  }

  // Delivered: the recipient thanks you, then the tip is worked out row by row.
  function settlement(r, tick, p, st) {
    backdrop(r, p, tick, st);
    dim(r);
    const x = 26, y = 22, w = W - 52, h = 124;
    panel(r, x, y, w, h, 2);
    title2xCentered(r, T("dlv.done.title"), W >> 1, y + 3, w - 70, "l", "g", "dlv.done.title");
    medal(r, x + w - 22, y + 18, p.rating);
    // Recipient with a thank-you bubble.
    icon(r, "avatar." + p.recipient, "default", x + 10, y + 42);
    centered(r, nameOf("recipient", p.recipient), x + 22, y + 68, 56, "c", null, "recipient." + p.recipient + ".name");
    PB.dialogue.bubble(r, { text: T("recipient." + p.recipient + ".thanks"), at: [x + 30, y + 40], style: "say", maxW: 96, id: "recipient." + p.recipient + ".thanks" });
    // Rows: name · value · factor.
    const lx = x + 60, vx = x + 128, fx = x + w - 10, row = (k, i) => y + 34 + i * 14;
    const rowLabel = (k, i) => label(r, T(k), lx, row(k, i), vx - lx - 4, "v", null, k);
    const factor = (s, i, color) => TX().draw(r, s, fx - TX().measure(s), row(null, i), color || "k");
    rowLabel("dlv.done.integrity", 0); pips(r, vx + 6, row(null, 0) + 7, p.integrity, p.max); factor("×" + (p.integrity / p.max).toFixed(2), 0);
    rowLabel("dlv.done.time", 1); label(r, T("dlv.done.time_value", { t: p.secs.toFixed(1), par: p.par.toFixed(1) }), vx, row(null, 1), fx - vx - 34, "c", null, "dlv.done.time_value"); factor("×" + (p.timePct / 100).toFixed(2), 1);
    rowLabel("dlv.done.like", 2); if (p.likePct > 100) icon(r, "ui.delivery_icons", "heart", vx - 2, row(null, 2) - 1); factor(p.likePct > 100 ? "×" + (p.likePct / 100).toFixed(1) : "—", 2, p.likePct > 100 ? "k" : "w");
    rowLabel("dlv.done.tip", 3); TX().draw(r, T("dlv.done.base", { n: p.pay }), vx, row(null, 3), "w"); factor(String(p.tip), 3, "l");
    rowLabel("dlv.done.picked", 4); factor(String(p.picked), 4, "l");
    r.hline(lx, row(null, 5) - 1, fx - lx, "f");
    label(r, T("dlv.done.total"), lx, row(null, 5) + 1, vx - lx - 4, "l", null, "dlv.done.total");
    const tot = String(p.total), tw = TX().measure(tot) * 2;
    PB.ui.text2x(r, tot, fx - tw, row(null, 5) - 4, "l", "g");
    icon(r, "item.coin", "default", fx - tw - 16, row(null, 5) + 1);
    buttons(r, "dlv.done.again", "dlv.done.hub", y + h + 6);
  }

  // Failed: no tip, the picked-up coins come home halved.
  function settlementFail(r, tick, p, st) {
    backdrop(r, p, tick, st);
    dim(r);
    const x = 40, y = 34, w = W - 80, h = 92;
    panel(r, x, y, w, h, 2);
    title2xCentered(r, T("dlv.fail.title"), W >> 1, y + 4, w - 16, "D", "g", "dlv.fail.title");
    const av = new PB.Raster(24, 24);
    icon(av, "avatar." + p.recipient, "default", 0, 0);
    av.remap(0, 0, 24, 24, PB.DIM);
    r.blit(av, x + 12, y + 38);
    icon(r, "cargo." + p.cargo, p.reason === "cargo" && p.cargo === "vase" ? "cracked" : "default", x + 40, y + 46);
    para(r, T(p.reason === "cargo" ? "dlv.fail.cargo" : "dlv.fail.hearts"), x + 64, y + 36, w - 72, 1, "u", "dlv.fail.reason");
    para(r, T("dlv.fail.keep", { a: p.picked, b: p.kept }), x + 64, y + 52, w - 72, 2, "c", "dlv.fail.keep");
    buttons(r, "dlv.done.again", "dlv.done.hub", y + h + 6);
  }

  // The HUD over a room: entities from the params, then PB.dui.hud on top.
  function deliveryHud(r, tick, p, st) {
    const theme = regionTheme(p.theme || "theme.dungeon", p.exclude);
    const at = PB.scene.renderLevel(r, { format: "pushbox.levelspec/1", id: "delivery.hud", chapter: "dungeon", map: p.room, bag: { sand: 0, bomb: 0 } }, null, { theme, tick, hud: false, env: (st && st.env) || "full", facing: p.facing });
    for (const e of p.entities || []) S().draw(r, e.sprite, e.anim, tick, at.ox + e.x * 16 + 8, at.oy + e.y * 16 + 16, !!e.flip);
    hud(r, p.hud);
  }

  Object.assign(PB.ui.SCREENS, { reels, shop, settlement, settlement_fail: settlementFail, delivery_hud: deliveryHud });
  PB.dui = { hud, regionTheme, HUD_H };
})(typeof window !== "undefined" ? window : globalThis);
