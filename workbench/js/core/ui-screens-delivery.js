/* UI-10b: seven delivery candidates in the shared G2 style.
 * room2 is an explicit pushbox.room/2 snapshot in each candidate's params.
 * This file only registers delivery screens; it does not replace the live HUD
 * or any level-mode screen. All new text lives in i18n-delivery2. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const G = () => PB.uiCommon, K = () => G().kit, U = () => PB.uk;
  const t = (key, vars) => PB.i18n.t(key, vars);
  const text = (c, x, y, s, col, sz, room, align) => G().line(c, x, y, s, col || "t", { sz: sz || 10, align: align || "l" }, room, s);
  const frame = (id, anim) => U().frame(id, anim ? PB.sprites.get(id).animations[anim].frames[0] : 0);
  const focus = (p, st) => p.focus == null ? st.focus | 0 : p.focus;
  const region = (p) => p.world || (p.theme || "theme.dungeon").slice(6);
  function fauna(world) {
    const main = world === "diyu" ? "diyu_dog" : world === "jeju" ? "jeju_pony" : "dungeon_cat";
    const flyer = world === "diyu" ? "diyu_butterfly" : "dungeon_bat";
    return { id: world, theme: "theme." + world, hint_fauna: [
      { id: main, asset: "fauna." + main, snack: true }, { id: flyer, asset: "fauna." + flyer },
    ] };
  }
  function snack(p) {
    const world = region(p);
    return { id: world === "jeju" ? "item.snack_jeju" : "item.snack", anim: world === "jeju" ? "default" : world === "diyu" ? "diyu" : "dungeon", name: t("d2.snack." + (world === "diyu" || world === "jeju" ? world : "dungeon")) };
  }
  function fit(c, rows, x, y, w, h) {
    const scale = Math.min(w / rows[0].length, h / rows.length, 1);
    const dw = Math.max(1, Math.floor(rows[0].length * scale)), dh = Math.max(1, Math.floor(rows.length * scale));
    x += (w - dw) >> 1; y += (h - dh) >> 1;
    for (let dy = 0; dy < dh; dy++) for (let dx = 0; dx < dw; dx++) {
      const col = rows[Math.floor(dy / scale)][Math.floor(dx / scale)];
      if (col !== ".") c.px(x + dx, y + dy, col);
    }
  }
  function paragraph(c, x, y, s, width, col, sz) {
    const lines = U().wrap(c, s, sz || 10, width);
    lines.forEach((ln, i) => text(c, x, y + i * 12, ln, col, sz || 10, width));
    return lines.length * 12;
  }
  function roomView(p, tick, full) {
    const R = PB.rooms2, D = PB.droom2, room = p.room2;
    const route = (room.hint_route || room.routes[0]).split(">");
    const v = R.variant(room, false, route.filter((x) => x !== "gate" && x !== "recipient"));
    const M = R.start(v, route[0], route[1]), world = fauna(region(p));
    const P = D.run(M, { snacks: p.hud && p.hud.snacks });
    if (p.nearHint && v.hints[0] && v.hints[0].show.at) {
      const at = v.hints[0].show.at;
      P.s.player.x = at[0]; P.s.player.y = at[1];
      P.cam = R.cameraStart(v, at[0] * 16, at[1] * 16, P.facing);
    }
    const sc = D.scene(M, world), view = full ? "full" : "camera";
    const size = D.size(sc, view), r = new PB.Raster(size[0], size[1]);
    D.draw(r, sc, P, { tick, view, overlays: { hints: !!p.nearHint }, recipient: p.recipient });
    return { r, sc, P };
  }
  function background(c, p, tick, dim) {
    const scene = roomView(p, tick, false);
    c.r.blit(scene.r, 0, 0);
    if (dim) U().dim(c, dim);
    return scene;
  }
  function thumbnail(c, room, x, y, w, h) {
    const view = roomView({ room2: room, world: room.world }, 0, true).r, src = new (U().C)(view);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const sx = Math.floor(dx * view.w / w), sy = 20 + Math.floor(dy * (view.h - 20) / h);
      c.raw(x + dx, y + dy, src.get(sx, sy));
    }
  }
  function reelStrip(c, x, y, w, h, pictures, gap, selected) {
    const mask = K().well(c, x, y, w, h, selected), sub = U().C.make(w, h, ".");
    pictures.forEach((rows, i) => {
      const oy = ((h - rows.length) >> 1) + (i - 1) * gap;
      sub.blit(rows, (w - rows[0].length) >> 1, oy);
      if (i !== 1) U().dim(sub, 2, [0, Math.max(0, oy), w, Math.min(h, oy + rows.length)]);
    });
    for (const q of mask) {
      const a = U().KX(q), b = U().KY(q), col = sub.get(a - x, b - y);
      if (col && col !== ".") c.px(a, b, col);
    }
  }
  function around(list, current) {
    const n = list.length, i = Math.max(0, list.indexOf(current));
    return [list[(i + n - 1) % n], list[i], list[(i + 1) % n]];
  }
  function reels(r, tick, p, st) {
    const c = new (U().C)(r);
    background(c, p, tick, 2); c.rect(0, 0, 320, 21, "z");
    K().heading(c, 6, 4, t("dlv.reels.title"));
    text(c, 313, 9, t("d2.reel.order"), "u", 10, 180, "r");
    const map = p.map || "dungeon_2", mapRows = (id) => {
      const thumb = U().C.make(60, 30, "z"); thumbnail(thumb, p.mapRooms[id], 0, 0, 60, 30);
      return Array.from({ length: 30 }, (_, y) => Array.from({ length: 60 }, (_, x) => thumb.get(x, y)).join(""));
    };
    const cols = [
      [t("d2.map"), t(map === "diyu_1" ? "d2.map.diyu" : "d2.map.dungeon"), around(p.mapList, map).map(mapRows), 33],
      [t("dlv.reels.recipient"), t("recipient." + p.recipient + ".name"), around(p.recipientList, p.recipient).map((id) => frame("avatar." + id)), 29],
      [t("dlv.reels.cargo"), t("cargo." + p.cargo + ".name"), around(p.cargoList, p.cargo).map((id) => frame("cargo." + id)), 23],
    ];
    cols.forEach(([label, name, pictures, gap], i) => {
      const x = 14 + i * 103, selected = focus(p, st) === i;
      K().panel(c, x, 27, 86, 90, true);
      text(c, x + 43, 33, label, "u", 10, 78, "c");
      reelStrip(c, x + 6, 46, 74, 49, pictures, gap, selected);
      text(c, x + 43, 100, name, "t", 12, 78, "c");
      if (selected) { K().cursor(c, x - 3, 72); K().cursor(c, x + 88, 72, "left"); }
      if (i < 2) K().cursor(c, x + 95, 72);
    });
    K().panel(c, 10, 121, 300, 36, true);
    text(c, 18, 126, t("cargo." + p.cargo + ".name") + " · " + t("cargo." + p.cargo + ".rule"), "t", 10, 284);
    const rule = t("recipient." + p.recipient + ".name") + " · " + t("recipient." + p.recipient + ".rule");
    const tip = p.liked ? t("d2.tip") : "", tw = tip ? c.tw(tip, 10) + 18 : 0;
    text(c, 18, 140, rule, "u", 10, 284 - tw);
    if (tip) K().tag(c, 302 - tw, 139, tip);
    G().keybar(c, [[["left", "right"], t("d2.select")], [["R"], t("d2.reroll", { n: p.rerolls })], [["Enter"], t("d2.go")]], 160, 164, "c");
  }
  function minimap(c, x, y, w, h, map) {
    K().plate(c, x, y, w, h);
    if (!map || !map.rooms || !map.rooms.length) return;
    const unit = Math.max(1, Math.min(4, Math.floor((w - 12) / map.cols), Math.floor((h - 4) / map.rows)));
    const ox = x + 3, oy = y + ((h - map.rows * unit) >> 1);
    const current = map.rooms.find((q) => q.index === map.cur), home = map.rooms.find((q) => q.role === "home");
    for (const q of map.rooms) {
      const rx = ox + q.x * unit, ry = oy + q.y * unit, rw = (q.cols || 1) * unit, rh = (q.rows || 1) * unit;
      c.rect(rx, ry, rw, rh, q.index === map.cur ? "m" : q.seen ? "u" : "x");
      c.rect(rx + 1, ry + 1, Math.max(1, rw - 2), Math.max(1, rh - 2), q.index === map.cur ? "y" : q.seen ? "w" : "y");
      if (q.role === "station") { c.hline(rx, ry + (rh >> 1), rw, "m"); c.vline(rx + (rw >> 1), ry, rh, "m"); }
      if (q.role === "home") { c.px(rx + (rw >> 1), ry, "l"); c.px(rx + (rw >> 1), ry + 1, "l"); }
    }
    if (current && home) {
      const dx = home.x - current.x, dy = home.y - current.y;
      K().cursor(c, x + w - 5, y + (h >> 1), Math.abs(dx) >= Math.abs(dy) ? dx < 0 ? "left" : "right" : dy < 0 ? "up" : "down");
    }
  }
  function hud(c, p) {
    const h = p.hud || {}, y = 1;
    c.rect(0, 0, 320, 20, "z");
    let x = 2;
    const plate = (w, draw) => { K().plate(c, x, y, w, 18); draw(x + 3); x += w + 1; };
    plate(32, (xx) => { for (let i = 0; i < (h.maxHearts || 3); i++) fit(c, frame("ui.delivery_icons", i < h.hearts ? "heart" : "heart_empty"), xx + i * 9, 5, 9, 10); });
    plate(39, (xx) => {
      fit(c, frame("cargo." + (h.cargo || "vase")), xx, 4, 12, 12);
      for (let i = 0; i < (h.max || 3); i++) c.rect(xx + 14 + i * 4, 6, 3, 7, i < h.left ? "l" : "x");
      if (h.rule) fit(c, frame("ui.delivery_icons", h.rule), xx + 26, 5, 8, 10);
    });
    plate(26, (xx) => { U().coinIcon(c, xx, 6, true); text(c, xx + 10, 6, String(h.coins || 0), "t", 10, 13); });
    plate(24, (xx) => { fit(c, frame("item.sandbag"), xx, 4, 11, 12); text(c, xx + 12, 6, String(h.sand || 0), "t", 10, 7); });
    const sn = snack(p);
    plate(24, (xx) => { fit(c, frame(sn.id, sn.anim), xx, 4, 11, 12); text(c, xx + 12, 6, String(h.snacks || 0), "t", 10, 7); });
    plate(42, (xx) => {
      for (let i = 0; i < (h.slots || 3); i++) {
        K().well(c, xx + i * 12, 4, 12, 12, false);
        if ((h.items || [])[i]) fit(c, frame("item." + h.items[i]), xx + i * 12 + 1, 5, 10, 10);
      }
    });
    plate(34, (xx) => { const secs = h.secs || 0; text(c, xx + 1, 6, Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0"), "u", 10, 27); });
    minimap(c, x, 1, 318 - x, 18, h.minimap);
  }
  function deliveryHud(r, tick, p) {
    const c = new (U().C)(r); background(c, p, tick, 0); hud(c, p);
  }
  function shop(r, tick, p, st) {
    const c = new (U().C)(r), sn = snack(p);
    background(c, p, tick, 2); c.rect(0, 0, 320, 21, "z");
    K().heading(c, 6, 4, t("dlv.shop.title")); K().coins(c, 314, 4, p.coins);
    K().panel(c, 92, 28, 222, 128);
    const goods = p.goods, selected = Math.min(goods.length - 1, Math.max(0, focus(p, st)));
    goods.forEach((g, i) => {
      const yy = 32 + i * 21, state = g.stock === 0 || g.price > p.coins ? "dis" : selected === i ? "sel" : "n", col = G().STYLE.btnText[state];
      if (state === "sel") G().box(c, 97, yy, 212, 20, G().STYLE.rowSel);
      const isSnack = g.id === "snack" || g.id === "snack_jeju";
      fit(c, frame(isSnack ? sn.id : "item." + g.id, isSnack ? sn.anim : undefined), 100, yy + 2, 16, 16);
      text(c, 120, yy + 4, isSnack ? sn.name : t("item." + g.id + ".name"), col, 12, 133);
      text(c, 271, yy + 5, "×" + g.stock, col, 10, 18, "r");
      text(c, 301, yy + 5, String(g.price), col, 10, 24, "r");
      if (selected === i) K().cursor(c, 89, yy + 10);
    });
    c.hline(100, 119, 204, "x"); text(c, 100, 130, t("dlv.shop.bag"), "u", 10, 34);
    for (let i = 0; i < p.slots; i++) {
      K().well(c, 142 + i * 18, 125, 17, 19, false);
      if ((p.bag || [])[i]) fit(c, frame("item." + p.bag[i]), 143 + i * 18, 127, 15, 15);
    }
    fit(c, frame("item.sandbag"), 211, 126, 16, 16); text(c, 230, 130, "×" + p.sand, "t", 10, 35);
    K().panel(c, 6, 31, 80, 56, true);
    paragraph(c, 13, 38, t("d2.snack.desc"), 66, "t", 10);
    paragraph(c, 13, 63, t("d2.snack.stock"), 66, "u", 10);
    c.blit(frame("char.turtle_keeper"), 24, 94);
    fit(c, frame(sn.id, sn.anim), 58, 113, 16, 16);
    G().keybar(c, [[["up", "down"], t("d2.select")], [["Enter"], t("d2.buy")], [["Esc"], t("d2.leave")]], 160, 164, "c");
  }
  function pause(r, tick, p, st) {
    const c = new (U().C)(r); background(c, p, tick, 0); hud(c, p); U().dim(c, 2);
    K().panel(c, 72, 30, 176, 122); K().title(c, 72, 32, 176, t("d2.pause"));
    p.items.forEach((key, i) => K().row(c, 81, 58 + i * 17, 158, 17, t(key), i === focus(p, st) ? "sel" : "n"));
    G().keybar(c, [[["up", "down"], t("d2.select")], [["Enter"], t("keys.confirm")], [["Esc"], t("d2.back")]], 160, 164, "c");
  }
  function confirm(r, tick, p, st) {
    const c = new (U().C)(r); background(c, p, tick, 0); hud(c, p); U().dim(c, 2);
    K().panel(c, 36, 45, 248, 92); K().title(c, 36, 46, 248, t("dlv.confirm.title"));
    paragraph(c, 48, 73, t("dlv.confirm.text"), 224, "u", 10);
    K().button(c, 48, 109, 106, 20, t("dlv.confirm.yes"), focus(p, st) === 0 ? "sel" : "n");
    K().button(c, 166, 109, 106, 20, t("dlv.confirm.no"), focus(p, st) === 1 ? "sel" : "n");
    G().keybar(c, [[["left", "right"], t("d2.select")], [["Enter"], t("keys.confirm")], [["Esc"], t("d2.back")]], 160, 164, "c");
  }
  function hintAnimal(r, tick, p) {
    const c = new (U().C)(r), { P } = background(c, p, tick, 0); hud(c, p);
    const at = P.mem.main || { x: 70, y: 96 }, ax = Math.round(at.x - P.cam.x), ay = Math.round(20 + at.y - P.cam.y);
    const phrase = t(p.hintKey || "d2.hint"), width = Math.min(244, Math.max(100, c.tw(phrase, 12) + 16));
    const x = Math.max(4, Math.min(316 - width, ax - (width >> 1))), y = Math.max(24, ay - 43);
    K().say(c, x, y, width, 25, Math.max(x + 6, Math.min(x + width - 6, ax)), phrase);
    const sn = snack(p), sx = Math.max(4, Math.min(294, ax + 12));
    K().panel(c, sx, Math.max(50, ay - 12), 21, 21, true); fit(c, frame(sn.id, sn.anim), sx + 3, Math.max(50, ay - 12) + 3, 15, 15);
    K().panel(c, 6, 139, 308, 37, true);
    text(c, 160, 143, t("d2.hint.near"), "u", 10, 292, "c");
    if (p.fedFlyer) text(c, 160, 158, t("d2.feed"), "t", 12, 292, "c");
  }
  function mark(c, x, y, kind) {
    x = Math.max(2, Math.min(317, x)); y = Math.max(22, Math.min(177, y));
    if (kind === "exit") { K().cursor(c, x, y); return; }
    c.rect(x - 2, y - 2, 5, 5, "z");
    if (kind === "player") { c.rect(x - 1, y - 1, 3, 3, "m"); c.px(x, y - 2, "t"); }
    else if (kind === "monster") { c.hline(x - 1, y, 3, "i"); c.vline(x, y - 1, 3, "i"); }
    else { c.rect(x - 1, y - 1, 3, 3, "l"); c.px(x, y, "y"); }
  }
  function observe(r, tick, p) {
    const c = new (U().C)(r), { r: src, sc, P } = roomView(p, tick, true), v = sc.v;
    c.rect(0, 0, 320, 180, "z");
    const w = sc.pw >> 1, h = sc.ph >> 1, ox = (320 - w) >> 1, oy = 20 + ((160 - h) >> 1), from = new (U().C)(src);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c.raw(ox + x, oy + y, from.get(x * 2, y * 2 + 20));
    const pos = (x, y) => [ox + x * 8 + 4, oy + y * 8 + 4];
    mark(c, ...pos(P.s.player.x, P.s.player.y), "player");
    for (const exit of v.exits) {
      const cells = PB.rooms2.exitCells(v.W, v.H, exit), at = cells[Math.floor(cells.length / 2)];
      if (at) mark(c, ...pos(at[0], at[1]), "exit");
    }
    for (const sp of v.spawns.filter((sp) => sp.monster)) {
      const at = PB.droom2.monsterPx(sp, tick); mark(c, ox + ((at[0] + 8) >> 1), oy + ((at[1] + 8) >> 1), "monster");
    }
    for (const at of [P.mem.main, P.mem.fly]) if (at) mark(c, ox + (Math.round(at.x) >> 1), oy + (Math.round(at.y) >> 1), "animal");
    K().plate(c, 2, 1, 316, 18);
    text(c, 9, 5, t("d2.observe"), "t", 12, 66);
    let xx = 91;
    for (const [kind, key] of [["player", "d2.player"], ["exit", "d2.exit"], ["monster", "d2.monster"], ["animal", "d2.animal"]]) {
      const color = { player: "m", exit: "m", monster: "i", animal: "l" }[kind];
      c.rect(xx, 7, 4, 4, color); text(c, xx + 7, 5, t(key), "u", 10, 43); xx += 55;
    }
    G().keybar(c, [[["Tab"], t("d2.back")]], 314, 164, "r");
  }
  Object.assign(PB.ui.SCREENS, { reels, shop, delivery_hud: deliveryHud, delivery_pause: pause, confirm, hint_animal: hintAnimal, observe });
  PB.uiDelivery2 = { snack, minimap, roomView };
})(typeof window !== "undefined" ? window : globalThis);
