/* OFFLINE-ART-20261020 · UI-12a candidates: door signs, the transfer-slip tip
 * and the chain minimap of one delivery run (G2 style).
 * Registers PB.ui.SCREENS.run_door / run_door_skull / run_map and the overlay
 * kit PB.uiRun (doorSign, rerollTip, chain, safeTag ...) for the run page.
 * Everything is drawn from params: p.room2 is an explicit pushbox.room/2
 * snapshot copied whole into the asset; without it only the overlays are drawn,
 * at the pixel positions given by the caller. Confirmed screens are only
 * called, never changed. New text lives in content/i18n-door. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const G = () => PB.uiCommon, K = () => G().kit, U = () => PB.uk, S = () => PB.sprites;
  const t = (key, vars) => PB.i18n.t(key, vars);
  const HUD_H = 20;

  // ================================================================ helpers
  function text(c, x, y, s, col, sz, room, align, key) {
    return G().line(c, x, y, s, col || "t", { sz: sz || 10, align: align || "l" }, room, key || s);
  }
  const has = (id) => S().has(id);
  function frame(id, anim, i) {
    if (!has(id)) return null;
    const a = S().get(id), A = typeof anim === "string" && a.animations ? a.animations[anim] : null;
    return U().frame(id, A ? A.frames[(i || 0) % A.frames.length] : typeof anim === "number" ? anim : 0);
  }
  function crop(rows) {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ".") { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
    return x1 < 0 ? ["."] : rows.slice(y0, y1 + 1).map((row) => row.slice(x0, x1 + 1));
  }
  // Scaled-down copy keeping the most common colour of each block (reads better
  // than point sampling at 1/2 or 1/3); the dark outline loses ties.
  function shrink(rows, w, h) {
    if (!rows) return null;
    rows = crop(rows);
    const sh = rows.length, sw = rows[0].length, s = Math.max(sw / w, sh / h, 1);
    const dw = Math.max(1, Math.round(sw / s)), dh = Math.max(1, Math.round(sh / s)), out = [];
    for (let y = 0; y < dh; y++) {
      let line = "";
      for (let x = 0; x < dw; x++) {
        const x0 = Math.floor(x * s), x1 = Math.max(x0 + 1, Math.floor((x + 1) * s)), y0 = Math.floor(y * s), y1 = Math.max(y0 + 1, Math.floor((y + 1) * s));
        const n = {}; let opaque = 0, best = ".", bn = 0, all = 0;
        for (let j = y0; j < y1 && j < sh; j++) for (let i = x0; i < x1 && i < sw; i++) {
          all++; const ch = rows[j][i]; if (ch === ".") continue; opaque++;
          n[ch] = (n[ch] || 0) + (ch === "z" ? 0.6 : 1);
          if (n[ch] > bn) { bn = n[ch]; best = ch; }
        }
        line += opaque * 2 >= all ? best : ".";
      }
      out.push(line);
    }
    return out;
  }
  const scale2 = (rows) => rows && rows.flatMap((row) => { const r2 = [...row].map((ch) => ch + ch).join(""); return [r2, r2]; });
  // Centred in the box (no scaling).
  function put(c, rows, x, y, w, h, recolor) {
    if (rows) c.blit(rows, x + ((w - rows[0].length) >> 1), y + ((h - rows.length) >> 1), false, recolor);
  }
  function snackOf(world) {
    return world === "jeju" ? { id: "item.snack_jeju", anim: "default" } : { id: "item.snack", anim: world === "diyu" ? "diyu" : "dungeon" };
  }
  // Text drawn by PB.uiCommon.line() reports to its own list; hand it on to
  // PB.i18n so the build's layout check sees overflow and missing glyphs here.
  function checked(fn) {
    return function (r, tick, p, st) {
      G().takeIssues();
      try { fn(r, tick || 0, p || {}, st || {}); }
      finally { for (const it of G().takeIssues()) PB.i18n.report(it.kind, it.key, { x: 0, y: 0, w: 0, h: 0 }); }
    };
  }

  // ================================================================ room snapshot + HUD
  // The room as the run page shows it (same model, scene and camera), with the
  // player placed where the sample needs him (p.player = [x, y] in cells).
  function fauna(world) {
    const main = world === "diyu" ? "diyu_dog" : world === "jeju" ? "jeju_pony" : "dungeon_cat";
    const flyer = world === "diyu" ? "diyu_butterfly" : "dungeon_bat";
    return { id: world, theme: "theme." + world, hint_fauna: [{ id: main, asset: "fauna." + main, snack: true }, { id: flyer, asset: "fauna." + flyer }] };
  }
  function roomScene(r, p, tick) {
    const R = PB.rooms2, D = PB.droom2, room = p.room2, world = p.world || room.world || "diyu";
    const route = (p.route || room.hint_route || room.routes[0]).split(">");
    const open = p.open || route.filter((x) => x !== "gate" && x !== "recipient");
    const v = R.variant(room, !!p.mirror, open);
    const M = R.start(v, route[0], route[1]);
    const P = D.run(M, { snacks: p.hud && p.hud.snacks });
    for (const [x, y] of p.collected || []) P.coins.add(x + "," + y);
    if (p.player) {
      P.s.player.x = p.player[0]; P.s.player.y = p.player[1];
      if (p.facing) P.facing = p.facing;
      P.cam = R.cameraStart(v, p.player[0] * 16, p.player[1] * 16, P.facing);
    }
    const sc = D.scene(M, fauna(world));
    D.draw(r, sc, P, { tick, view: "camera", overlays: {}, recipient: p.recipient });
    return { v, P, sc, cam: P.cam, world };
  }
  // The confirmed delivery HUD (hearts, cargo, coins, sand, snacks, bag, time),
  // drawn by PB.ui.SCREENS.delivery_hud without a minimap; only its 20 rows are kept.
  function hudBar(r, p, tick) {
    const tmp = new PB.Raster(320, 180), q = Object.assign({}, p, { hud: Object.assign({}, p.hud, { minimap: undefined }) });
    PB.ui.SCREENS.delivery_hud(tmp, tick, q, {});
    r.data.set(tmp.data.subarray(0, 320 * HUD_H * 4), 0);
  }
  const MINIMAP = { x: 230, y: 1, w: 88, h: 18 };   // the empty minimap plate of that HUD

  // Pixel anchor (bottom centre) of the sign of an exit: hung over the opening
  // on left / right exits, beside it on top / bottom exits.
  function exitAnchor(scene, exit) {
    const R = PB.rooms2, cells = R.exitCells(scene.v.W, scene.v.H, exit), edge = R.parseExit(exit).edge;
    const xs = cells.map((q) => q[0]), ys = cells.map((q) => q[1]), cam = scene.cam;
    if (edge === "left" || edge === "right") return { x: xs[0] * 16 + 8 - cam.x, y: HUD_H + Math.min(...ys) * 16 - cam.y, edge, cells };
    return { x: (Math.min(...xs) - 1) * 16 + 8 - cam.x, y: HUD_H + (Math.max(...ys) + 1) * 16 - cam.y, edge, cells };
  }
  const cellDist = (cells, x, y) => Math.min(...cells.map((q) => Math.max(Math.abs(q[0] - x), Math.abs(q[1] - y))));

  // ================================================================ door sign
  // Fixed spots of every 16×32 sign (art/contracts/offline-art-layout.json):
  // room icon 8×8 at (4,7); reward icon 8×8 at (4,22) in a 10×10 ring at (3,21);
  // rows 20–31 are the small plate, row 19 its rope.
  const SIGN = { diyu: "obj.door_lantern_diyu", dungeon: "obj.door_sign_dungeon", jeju: "obj.door_sign_jeju" };
  const SPOT = { room: [4, 7], reward: [4, 22], ring: [3, 21], plateRow: 20, skull: [9, 2] };
  const ringOf = (reward) => (reward === "stamp" ? "r" : "k");
  const signOf = (world) => (has(SIGN[world]) ? SIGN[world] : SIGN.diyu);
  // Small recipient portrait: the avatar shrunk to 10×10 in a dark 12×12 box.
  function face(c, x, y, recipient) {
    const av = frame("avatar." + recipient);
    if (!av) return;
    G().box(c, x, y, 12, 12, { r: 2, rings: ["z"], fill: "x" });
    put(c, shrink(av.slice(2, 22).map((row) => row.slice(2, 22)), 10, 10), x + 1, y + 1, 10, 10);
  }
  function rewardArt(o, big) {
    if (o.reward === "wish" && o.item) return big ? frame("item." + o.item) : shrink(frame("item." + o.item), 8, 8);
    if (big && o.reward === "item" && o.item) return frame("item." + o.item);
    if (big && o.reward === "buff" && o.buff) return frame("ui.buff_icons", o.buff);
    if (big && o.reward === "snack") { const sn = snackOf(o.world); return frame(sn.id, sn.anim); }
    const ic = frame("ui.run_icons", o.reward);
    return big ? scale2(ic) : ic;
  }
  function amountOf(o) {
    if (o.amount == null) return o.reward === "snack" ? "2" : "";
    return (o.reward === "item" || o.reward === "stamp" || o.reward === "buff") ? "×" + o.amount : String(o.amount);
  }
  // Wooden plate in the sign's own colours: dark outline with cut corners,
  // light wood, shaded right / bottom edge, two rope holes.
  function wood(c, x, y, w, h, holes) {
    c.hline(x + 1, y, w - 2, "z"); c.hline(x + 1, y + h - 1, w - 2, "z"); c.vline(x, y + 1, h - 2, "z"); c.vline(x + w - 1, y + 1, h - 2, "z");
    c.rect(x + 1, y + 1, w - 2, h - 2, "d");
    c.vline(x + 1, y + 2, h - 4, "e"); c.vline(x + w - 2, y + 1, h - 3, "f"); c.hline(x + 1, y + h - 2, w - 2, "f");
    for (let i = x + 3; i < x + w - 3; i += 3) c.px(i, y + 1, "e");
    for (const hx of holes || []) c.px(hx, y + 1, "g");
  }
  // o: { world, room: blockade|develop|event, reward: coins|item|buff|snack|stamp|wish,
  //      amount, item, buff, recipient (wish), skull, near, detail: {coins, monsters},
  //      anim: idle|lit|reroll, frame, tick, edge: left|right }
  // (x, y) is the sign's anchor: bottom centre, the top edge of the opening.
  function doorSign(c, x, y, o) {
    o = o || {};
    const sid = signOf(o.world || "diyu"), a = S().get(sid);
    const anim = o.anim || (o.near ? "lit" : "idle");
    const fi = o.frame != null ? a.animations[anim].frames[o.frame % a.animations[anim].frames.length] : S().frameAt(a, anim, o.tick || 0);
    const rows = a.frames[fi], ox = x - 8, oy = y - 32, spinning = anim === "reroll" && fi !== a.animations.idle.frames[0];
    c.blit(o.near ? rows.slice(0, SPOT.plateRow) : rows, ox, oy);
    if (!spinning) {
      put(c, frame("ui.run_icons", o.room || "develop"), ox + SPOT.room[0], oy + SPOT.room[1], 8, 8);
      if (o.skull) c.outline_blit(frame("ui.run_icons", "skull"), ox + SPOT.skull[0], oy + SPOT.skull[1], "z");
    }
    let bottom = oy + 32;
    if (!o.near) {
      c.frame(ox + SPOT.ring[0], oy + SPOT.ring[1], 10, 10, ringOf(o.reward));
      if (!spinning) put(c, rewardArt(o, false), ox + SPOT.reward[0], oy + SPOT.reward[1], 8, 8);
      if (o.reward === "wish" && o.recipient && !spinning) face(c, o.edge === "left" ? ox + 12 : ox - 8, oy + 21, o.recipient);
    } else bottom = bigPlate(c, x, oy + SPOT.plateRow - 1, o, spinning);
    if (o.detail) detailRow(c, x, bottom + 2, o.detail, o.edge);
    return bottom;
  }
  // The plate at twice the size, with the amount: hung from the lantern by two
  // ropes, kept on screen (pulled inwards next to a screen edge).
  function bigPlate(c, cx, top, o, spinning) {
    const num = amountOf(o), nw = num ? c.tw(num, 10) + 3 : 0, wish = o.reward === "wish" && o.recipient;
    const w = 3 + 18 + nw + (wish ? 14 : 0) + 3, h = 24;
    const x = Math.max(2, Math.min(318 - w, cx - (w >> 1))), y = top + 3;
    c.line(cx - 1, top, x + 4, y, "f"); c.line(cx, top, x + w - 5, y, "f");
    wood(c, x, y, w, h, [x + 4, x + w - 5]);
    c.frame(x + 3, y + 3, 18, 18, ringOf(o.reward));
    c.rect(x + 4, y + 4, 16, 16, "c");
    if (!spinning) put(c, rewardArt(o, true), x + 4, y + 4, 16, 16);
    if (num) text(c, x + 22, y + 7, num, "z", 10, nw + 2, "l", "door.amount");
    if (wish && !spinning) face(c, x + 23 + nw, y + 6, o.recipient);
    return y + h;
  }
  // door_detail (vermilion ink): "coins · monsters" in numbers and small icons only.
  function detailRow(c, cx, y, d, edge) {
    const a = String(d.coins || 0), b = String(d.monsters || 0);
    const w = 4 + 7 + 2 + c.tw(a, 10) + 4 + 8 + 1 + c.tw(b, 10) + 4, h = 13;
    const x = Math.max(2, Math.min(318 - w, cx - (w >> 1)));
    G().box(c, x, y, w, h, { r: 3, rings: ["z"], fill: "y" });
    let xx = x + 3;
    U().coinIcon(c, xx, y + 3, false); xx += 9;
    xx += text(c, xx, y + 1, a, "l", 10, 20, "l", "door.detail") + 3;
    c.px(xx - 2, y + 6, "u");
    c.blit(frame("ui.run_icons", "blockade"), xx, y + 2); xx += 9;
    text(c, xx, y + 1, b, "i", 10, 20, "l", "door.detail");
  }

  // ================================================================ transfer-slip tip
  // A small bubble beside the sign: slip icon + the bag key that holds it + 「重抽」.
  // (tx, ty) is the point the tail touches; o.side "left" puts the bubble left of it.
  function rerollTip(c, tx, ty, o) {
    o = o || {};
    const u = U(), label = t("door.reroll"), key = String(o.key || 1), kw = K().keyW(c, key), lw = c.tw(label, 12);
    const w = 4 + 16 + 3 + kw + 4 + lw + 6, h = 22, left = o.side !== "right";
    const x = left ? tx - 5 - w : tx + 5, y = Math.max(HUD_H + 2, ty - (h >> 1));
    const F = G().maskOf(x + 2, y + 2, w - 4, h - 4, 3), my = Math.min(y + h - 6, Math.max(y + 5, ty));
    for (let i = 0; i < 4; i++) for (let j = -(3 - i); j <= 3 - i; j++) F.add(u.K(left ? x + w - 2 + i : x + 1 - i, my + j));
    G().layered(c, F, ["z", "u"], "y");
    c.blit(frame("item.transfer_slip"), x + 4, y + 3);
    let xx = x + 4 + 16 + 3;
    xx += K().keycap(c, xx, y + 6, key) + 4;
    text(c, xx, y + 5, label, "t", 12, lw, "l", "door.reroll");
    return { x, y, w, h };
  }

  // ================================================================ chain minimap
  // 12 rooms in a line inside the minimap plate. o: { cur, n, forks: [4,7,9],
  // picks: { 4: "up" | "down" }, marks: { 6: "station", 10: "rest", 12: "home" } }.
  // Passed rooms light, the current one is mint, rooms ahead are dark; a fork
  // ahead is two dark dots, a fork passed shows the door taken and a grey stub
  // towards the one not taken.
  const CHAIN = { n: 12, forks: [4, 7, 9], marks: { 6: "station", 10: "rest", 12: "home" } };
  function node(c, x, y, state, mark) {
    const ring = state === "cur" ? "m" : state === "seen" ? "u" : "x", fill = state === "cur" ? "t" : state === "seen" ? "w" : "y";
    c.rect(x, y, 5, 5, ring); c.rect(x + 1, y + 1, 3, 3, fill);
    // Station / rest / home marks are known from the start: full colour even ahead.
    if (mark === "station") { c.hline(x + 1, y + 2, 3, "k"); c.vline(x + 2, y + 1, 3, "k"); }
    if (mark === "rest") { c.hline(x + 1, y + 1, 3, "b"); c.px(x + 1, y + 2, "b"); c.px(x + 3, y + 2, "b"); c.px(x + 1, y + 3, "e"); c.px(x + 3, y + 3, "e"); }
    if (mark === "home") { c.px(x + 2, y + 1, "l"); c.hline(x + 1, y + 2, 3, "l"); c.px(x + 1, y + 3, "k"); c.px(x + 3, y + 3, "k"); c.px(x + 2, y + 3, state === "cur" ? "t" : fill); }
  }
  function chain(c, x, y, w, h, o) {
    o = Object.assign({}, CHAIN, o || {});
    const n = o.n, cur = o.cur || 1, total = n * 5 + (n - 1) * 2;
    const x0 = x + ((w - total) >> 1), ym = y + ((h - 1) >> 1), picks = o.picks || {};
    const stateOf = (i) => (i < cur ? "seen" : i === cur ? "cur" : "ahead");
    for (let i = 1; i < n; i++) c.rect(x0 + (i - 1) * 7 + 5, ym, 2, 1, i < cur ? "u" : "x");
    for (let i = 1; i <= n; i++) {
      const nx = x0 + (i - 1) * 7, fork = o.forks.includes(i), pick = picks[i];
      if (fork && (i > cur || !pick)) {   // a fork still ahead: two dark dots
        c.rect(nx + 1, ym - 4, 3, 3, "x"); c.rect(nx + 1, ym + 2, 3, 3, "x");
        c.rect(nx, ym, 5, 1, i <= cur ? "u" : "x");
        continue;
      }
      if (fork) {   // the door taken, and a grey stub towards the other one
        const up = pick === "up", ny = up ? ym - 5 : ym + 1;
        c.rect(nx, ym, 5, 1, "u");
        node(c, nx, ny, stateOf(i), o.marks[i]);
        const sy = up ? ym + 1 : ym - 3;
        c.rect(nx + 2, sy, 1, 3, "w");
        continue;
      }
      node(c, nx, ym - 2, stateOf(i), o.marks[i]);
    }
  }
  // "No monsters here": the small plate under the left end of the HUD while
  // the player is inside a puzzle area (run 7.3).
  function safeTag(c, x, y) {
    G().box(c, x, y, 14, 14, { r: 3, rings: ["z", "m"], fill: "y" });
    put(c, frame("ui.run_icons", "safe"), x + 3, y + 3, 8, 8);
  }

  // ================================================================ screens
  // p: room2 (+ world, route, open, mirror, player, facing), hud (as delivery_hud),
  //    chain, safe, doors: [{ exit | x, y, ...doorSign options }], reroll: { door, key }
  function runScreen(r, tick, p) {
    const c = new (U().C)(r);
    const scene = p.room2 ? roomScene(r, p, tick) : null, world = p.world || (scene && scene.world) || "diyu";
    if (p.hud) hudBar(r, p, tick);
    if (p.chain) chain(c, MINIMAP.x + 2, MINIMAP.y + 2, MINIMAP.w - 4, MINIMAP.h - 4, p.chain);
    if (p.safe) safeTag(c, 3, HUD_H + 3);
    const signs = (p.doors || []).map((d) => {
      const at = d.exit && scene ? exitAnchor(scene, d.exit) : { x: d.x, y: d.y, edge: d.edge };
      const near = d.near != null ? d.near : !!(scene && at.cells && cellDist(at.cells, scene.P.s.player.x, scene.P.s.player.y) <= 3);
      return Object.assign({ world, tick }, d, { x: at.x, y: at.y, edge: at.edge || d.edge, near, cells: at.cells });
    });
    for (const s of signs) doorSign(c, s.x, s.y, s);
    if (p.reroll) {
      const s = signs.find((q) => q.exit === p.reroll.door) || signs[0];
      const bag = (p.hud && p.hud.items) || [], slot = p.reroll.key || bag.indexOf("transfer_slip") + 1;
      if (s && slot > 0) rerollTip(c, s.edge === "left" ? s.x + 9 : s.x - 9, s.y - 22, { key: slot, side: s.edge === "left" ? "right" : "left" });
    }
  }

  const run = checked(runScreen);
  Object.assign(PB.ui.SCREENS, { run_door: run, run_door_skull: run, run_map: run });
  PB.uiRun = Object.assign(PB.uiRun || {}, {
    HUD_H, MINIMAP, SIGN, SPOT, CHAIN,
    text, frame, crop, shrink, scale2, put, snackOf, checked, fauna, roomScene, hudBar, exitAnchor, cellDist,
    face, wood, doorSign, bigPlate, detailRow, rerollTip, chain, node, safeTag, runScreen,
  });
})(typeof window !== "undefined" ? window : globalThis);
