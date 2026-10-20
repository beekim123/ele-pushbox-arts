/* UX-03 · Onboarding effects (docs/design/onboarding.md §2–4, §7, appendix 2).
 * The six new assets, version 1, waiting for the user's approval, drawn with the
 * G2 kit (PB.uiCommon: the same keycaps as the workbench G2 screens):
 *   ui.keyhint      key hint bar: small plate + G2 keycaps; normal, held modifier,
 *                   flashing arrow, fade out, keys only (no room for the plate)
 *   ui.action_icon  pickaxe / sandbag / bomb, left / right mouse badges, "can't" cross
 *   ui.goal_glow    empty socket breathing, light dot flying to the goal lamp, lamp flash
 *   ui.cause_link   1 px white outline of things flashing together, plate-to-door light
 *   ui.hud_glow     undo and hint (bulb) icons lighting up
 *   ui.key_cmd      ⌘ keycap (no font file has a ⌘ glyph, UX-02 delivery)
 * PB.onbFx: drawing calls used by the workbench onboarding layer
 * (workbench/js/app/onboarding-layer.js). PB.ui.SCREENS.onb_*: one sheet per asset
 * with every state, for the asset and review pages (asset params.screen).
 * Changes nothing in ui-common.js, ui.keycap, ui.panel, the bubbles or the HUD. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const G = () => PB.uiCommon, U = () => PB.uk, S = () => PB.sprites;
  const fd = (a, b) => Math.floor(a / b);
  const canvasOf = (r) => new (U().C)(r);
  function px(r, x, y, col) { if (x >= 0 && y >= 0 && x < r.w && y < r.h) r.set(x, y, col); }
  function blit(r, rows, x, y, recolor) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== ".") px(r, x + i, y + j, recolor || row[i]); });
  }
  // Pixels just outside the opaque pixels of rows (4-neighbours): outlines and rings.
  function outlineOf(rows) {
    const h = rows.length, w = rows[0].length, out = [];
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== ".";
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) out.push([x, y]);
    return out;
  }
  // Core rows plus a 1 px outline all round (8-neighbours).
  function outlined(core, col) {
    const h = core.length, w = core[0].length, out = [];
    const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? core[y][x] : ".");
    for (let y = -1; y <= h; y++) {
      let s = "";
      for (let x = -1; x <= w; x++) {
        if (at(x, y) !== ".") { s += at(x, y); continue; }
        let n = false;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (at(x + i, y + j) !== ".") n = true;
        s += n ? col : ".";
      }
      out.push(s);
    }
    return out;
  }
  // Ordered-dither "transparency": pixel art has no alpha, so a fading layer drops pixels.
  const dithered = (x, y, level) => U().BAYER[y & 3][x & 3] < level * 16;
  function faded(r, alpha, box, draw) {
    if (alpha >= 1) return draw(r);
    if (alpha <= 0) return null;
    const tmp = new PB.Raster(r.w, r.h), res = draw(tmp);
    const x0 = Math.max(0, box.x), y0 = Math.max(0, box.y), x1 = Math.min(r.w, box.x + box.w), y1 = Math.min(r.h, box.y + box.h);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = tmp.get(x, y); if (v !== "." && dithered(x, y, alpha)) r.set(x, y, v); }
    return res;
  }

  // ================================================================ ui.action_icon
  const CORE = {
    dig: ["..ttt..", ".tuuut.", "u..e..u", "...e...", "...e...", "...e...", "...e..."],
    pour: ["..ded..", "...e...", ".ddddd.", "dcccccd", "dccccdd", "dcccddd", ".ddddd."],
    bomb: [".....l.", "....ek.", ".wwwe..", "wwwwuw.", "wwwwww.", "wwwwww.", ".wwww.."],
    mouse_l: ["mm.uu", "mm.uu", ".....", "uuuuu", "uuuuu", "uuuuu", ".uuu."],
    mouse_r: ["uu.mm", "uu.mm", ".....", "uuuuu", "uuuuu", "uuuuu", ".uuu."],
    no: ["i...i", ".i.i.", "..i..", ".i.i.", "i...i"],
  };
  const ICON = {};
  for (const [k, v] of Object.entries(CORE)) ICON[k] = outlined(v, "z");
  const iconSize = (k) => ({ w: ICON[k][0].length, h: ICON[k].length });
  function icon(r, kind, x, y, recolor) { blit(r, ICON[kind], x, y, recolor); return iconSize(kind); }
  // Waiting for a direction (alternative keys X / C / B): the icon over the head
  // bobs 1 px, the directions that work flash beside it (0.4 s on, 0.4 s off).
  // cx = head centre, by = bottom of the icon; o.dirs ("l", "r", "d"), o.shake, o.no.
  const WAIT_DIRS = { dig: ["l", "r", "d"], pour: ["l", "r"], bomb: ["l", "r", "d"] };
  function waiting(r, kind, cx, by, t, o) {
    o = o || {};
    const s = iconSize(kind), bob = Math.floor(t * 2) % 2, shake = o.shake ? (Math.floor(t * 20) % 2 ? 1 : -1) : 0;
    const x = cx - fd(s.w, 2) + shake, y = by - s.h - bob;
    icon(r, kind, x, y);
    const c = canvasOf(r), u = U(), lit = t % 0.8 < 0.4;
    if (lit) for (const d of o.dirs || WAIT_DIRS[kind]) {
      if (d === "l") { u.glyph(c, u.ARROW.left5, x - 5, y + 2, "z"); u.glyph(c, u.ARROW.left5, x - 4, y + 2, "m"); }
      if (d === "r") { u.glyph(c, u.ARROW.right5, x + s.w + 2, y + 2, "z"); u.glyph(c, u.ARROW.right5, x + s.w + 1, y + 2, "m"); }
      if (d === "d") { u.glyph(c, u.ARROW.down5, x + 2, y + s.h + 2, "z"); u.glyph(c, u.ARROW.down5, x + 2, y + s.h + 1, "m"); }
    }
    if (o.no) icon(r, "no", x + s.w - 2, y - 3);
    return { x, y, w: s.w, h: s.h };
  }
  // Mouse hover on a neighbouring cell (x, y = cell top-left): what a click really
  // does, drawn on the cell's top-right corner: action icon + mouse button badge.
  function hover(r, kind, x, y, button) {
    const s = iconSize(kind);
    icon(r, kind, x + 16 - s.w + 2, y - 3);
    if (button) icon(r, button, x + 16 - s.w - 5, y);
  }

  // ================================================================ keys: ui.keyhint, ui.key_cmd
  const CMD = [".#...#.", "#.#.#.#", ".#####.", "..#.#..", ".#####.", "#.#.#.#", ".#...#."];
  const SEP = { plus: ["..#..", "..#..", "#####", "..#..", "..#.."], slash: ["..#", "..#", ".#.", ".#.", ".#.", "#..", "#.."], then: ["#..", ".#.", "..#", ".#.", "#.."] };
  const KEY_DIM = { r: 1, rings: ["z"], fill: "y" }, KEY_DOWN = { r: 1, rings: ["z"], fill: "x" };
  function keyW(c, k) { return k === "cmd" ? 11 : G().kit.keyW(c, k); }
  function keyLabel(c, x, y, k, w, col) {
    const u = U();
    if (k === "cmd") u.glyph(c, CMD, x + 2, y + 2, col);
    else if (k === "up" || k === "down") u.glyph(c, u.ARROW[k + "5"], x + 3, y + 3, col);
    else if (k === "left" || k === "right") u.glyph(c, u.ARROW[k + "5"], x + 4, y + 2, col);
    else G().line(c, x + fd(w, 2), y + 1, k, col, { sz: 10, align: "c" });
  }
  function ringOnly(c, M, col) { const u = U(), In = u.shrink(M, 1); for (const q of M) if (!In.has(q)) c.px(u.KX(q), u.KY(q), col); }
  // One keycap, 11 px tall. st: "n" normal (the G2 keycap), "held" (pressed 1 px
  // down, mint ring round it), "dim" (the dark half of a flash).
  function key(c, x, y, k, st) {
    const P = G().STYLE, w = keyW(c, k);
    if (st === "held") {
      ringOnly(c, G().maskOf(x - 1, y, w + 2, 13, 2), "m");
      G().box(c, x, y + 1, w, 11, KEY_DOWN);
      keyLabel(c, x, y + 1, k, w, P.keyText);
    } else if (st === "dim") {
      G().box(c, x, y, w, 11, KEY_DIM);
      keyLabel(c, x, y, k, w, "w");
    } else if (k === "cmd") {
      G().box(c, x, y, w, 11, P.key);
      keyLabel(c, x, y, k, w, P.keyText);
    } else G().kit.keycap(c, x, y, k);
    return w;
  }
  // Items of a hint: {key, held, flash} | {sep: plus|slash|then} | {icon}.
  const itemW = (c, it) => (it.key ? keyW(c, it.key) : it.sep ? SEP[it.sep][0].length : iconSize(it.icon).w);
  function itemsW(c, items) { let w = 0; items.forEach((it, i) => { w += itemW(c, it) + (i ? 2 : 0); }); return w; }
  // Draws the items with their key row at y (11 px); t = seconds, for the flash.
  function drawItems(c, items, x, y, t) {
    const lit = (t || 0) % 0.8 < 0.4, u = U();
    for (const it of items) {
      const w = itemW(c, it);
      if (it.key) key(c, x, y, it.key, it.held ? "held" : it.flash && !lit ? "dim" : "n");
      else if (it.sep) u.glyph(c, SEP[it.sep], x, y + (it.sep === "slash" ? 2 : 3), "u");
      else blit(c.r, ICON[it.icon], x, y + 6 - fd(iconSize(it.icon).h, 2));
      x += w + 2;
    }
  }
  const hintSize = (r, items, plate) => ({ w: itemsW(canvasOf(r), items) + (plate === false ? 2 : 8), h: plate === false ? 13 : 18 });
  // The hint bar at (x, y) top-left; o.plate false = keys only; o.t = seconds.
  function keyhint(r, x, y, items, o) {
    o = o || {};
    const c = canvasOf(r), sz = hintSize(r, items, o.plate);
    if (o.plate === false) drawItems(c, items, x + 1, y + 1, o.t);
    else { G().kit.plate(c, x, y, sz.w, sz.h); drawItems(c, items, x + 4, y + 3, o.t); }
    return sz;
  }
  // Action × device → what the hint shows (§7, one table for the workbench).
  // device: mac | pc | mouse; method: hold | alt.
  const DIRS = { l: ["left"], r: ["right"], u: ["up"], d: ["down"], lr: ["left", "right"], ud: ["up", "down"] };
  const MOD = { dig: { mac: "Shift", pc: "Shift" }, pour: { mac: "cmd", pc: "Ctrl" }, bomb: { mac: "B", pc: "B" } };
  const ALT = { dig: "X", pour: "C", bomb: "B" };
  const MOUSE = { dig: ["dig", "mouse_l"], pour: ["pour", "mouse_r"], bomb: ["bomb", "mouse_l"] };
  const KEYS = { undo: "Z", restart: "R", hint: "H", observe: "Tab", pause: "Esc", up: "up", down: "down", left: "left", right: "right" };
  function hintItems(act, dir, device, method) {
    const ds = DIRS[dir] || DIRS.lr, out = [];
    if (act === "move" || act === "climb") { ds.forEach((k) => out.push({ key: k })); return out; }
    if (device === "mouse" && MOUSE[act]) return MOUSE[act].map((k) => ({ icon: k }));
    if (method === "alt") out.push({ key: ALT[act] }, { sep: "then" });
    else out.push({ key: MOD[act][device === "mac" ? "mac" : "pc"], held: true }, { sep: "plus" });
    ds.forEach((k, i) => { if (i) out.push({ sep: "slash" }); out.push({ key: k, flash: true }); });
    return out;
  }
  // ================================================================ sprites under the effects
  // A sprite frame placed like PB.sprites.draw (anchor on x, y): rows + top-left.
  function spriteAt(id, anim, tick, x, y) {
    const a = S().get(id), f = typeof anim === "number" ? anim : S().frameAt(a, anim, tick || 0);
    return { rows: a.frames[f], x: x - a.anchor[0], y: y - a.anchor[1], w: a.size[0], h: a.size[1] };
  }
  // Recoloured copy of a sprite (lamp flash, lit icons): z (outline) stays.
  function remapped(r, b, map) {
    b.rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const k = row[i]; if (k !== ".") px(r, b.x + i, b.y + j, k === "z" ? "z" : typeof map === "string" ? map : map[k] || k); } });
  }
  // 1 px outline just outside a sprite's pixels (things that flash together).
  function outline(r, b, col, level) {
    for (const [i, j] of outlineOf(b.rows)) if (level == null || level >= 1 || dithered(b.x + i, b.y + j, level)) px(r, b.x + i, b.y + j, col);
  }

  // ================================================================ ui.goal_glow
  // Empty socket breathing (1.6 s a breath): mint light rising out of the slot,
  // densest at the bottom. level 0..1 (breath); x, y = the socket's anchor.
  const breath = (t, period) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / (period || 1.6));
  function socketGlow(r, x, y, level, tick) {
    const b = spriteAt("mech.socket", "idle", tick, x, y), lv = 0.3 + 0.7 * level;
    for (let j = 5; j <= 13; j++) for (let i = 3; i <= 12; i++) {
      if (b.rows[j][i] !== ".") continue;
      if (dithered(b.x + i, b.y + j, lv * (j - 4) / 9)) px(r, b.x + i, b.y + j, "m");
    }
    // Rim: the slot's two inner corners catch the light.
    for (const [i, j] of [[2, 10], [13, 10]]) if (level > 0.5) px(r, b.x + i, b.y + j, "m");
  }
  // Light dot: 2×2 white core with a mint edge, a three-step mint tail behind it.
  const DOT = [".mm.", "mttm", "mttm", ".mm."];
  const easeOut = (u) => 1 - (1 - u) * (1 - u);
  // Point on the flight from (x0, y0) to (x1, y1) at u (0..1), arcing upwards.
  function flightAt(x0, y0, x1, y1, u) {
    const e = easeOut(Math.max(0, Math.min(1, u)));
    return { x: Math.round(x0 + (x1 - x0) * e), y: Math.round(y0 + (y1 - y0) * e - Math.sin(Math.PI * e) * 14) };
  }
  // u = 0..1 over the 0.5 s flight; the dot's centre lands on (x1, y1).
  function lightDot(r, x0, y0, x1, y1, u) {
    for (let k = 3; k >= 1; k--) {
      const p = flightAt(x0, y0, x1, y1, u - k * 0.07);
      if (u - k * 0.07 > 0) { px(r, p.x, p.y, "m"); if (k === 1) { px(r, p.x + 1, p.y, "m"); px(r, p.x, p.y + 1, "m"); } }
    }
    const p = flightAt(x0, y0, x1, y1, u);
    blit(r, DOT, p.x - 2, p.y - 2);
    return p;
  }
  // HUD goal lamp i of n (scene.js drawHud: icons, an 8 px gap, then the lamps).
  const lampX = (i, n) => 256 - 10 * (n - i);
  // The lamp flashing white for 0.15 s when the dot arrives (it is already lit under it).
  function lampFlash(r, i, n) { remapped(r, spriteAt("ui.goal_lamp", 1, 0, lampX(i, n), 5), "t"); }

  // ================================================================ ui.cause_link
  // Things that belong together flash twice (0.25 s on, 0.25 s off) with a 1 px
  // white outline: socket + goal lamp (M01), plate + door symbols (M05).
  const flashOn = (t) => t >= 0 && t < 1 && t % 0.5 < 0.25;
  function flashSprite(r, id, anim, tick, x, y) { outline(r, spriteAt(id, anim, tick, x, y), "t"); }
  // Plate-to-door light: 1 px mint dashes running from the plate to the door,
  // fading out over 0.6 s (u = 0..1). Dashes 2 on, 2 off, moving towards the door.
  function causeLine(r, x0, y0, x1, y1, u) {
    if (u >= 1) return;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), shift = Math.floor(u * 12), lv = 1 - u;
    for (let k = 0; k <= n; k++) {
      if ((k - shift + 64) % 4 >= 2) continue;
      const x = Math.round(x0 + ((x1 - x0) * k) / (n || 1)), y = Math.round(y0 + ((y1 - y0) * k) / (n || 1));
      if (lv >= 1 || dithered(x, y, lv)) { px(r, x, y, "m"); }
    }
    // Both ends get a small mint stud, so the line reads as "from here to there".
    for (const [x, y] of [[x0, y0], [x1, y1]]) if (dithered(x, y, lv * 1.5)) { px(r, x - 1, y, "m"); px(r, x + 1, y, "m"); px(r, x, y - 1, "m"); px(r, x, y + 1, "m"); }
  }

  // ================================================================ ui.hud_glow
  // HUD icons (scene.js drawHud): 12×12 at y 4, x = 264 undo, 277 restart, 290 hint, 303 pause.
  const HUD_X = { undo: 264, restart: 277, hint: 290, pause: 303 };
  // level 0..1: a 1 px mint rounded ring in the 1 px gaps round the 12×12 icon
  // (dithered while it fades in and out); the icon one step lighter (PB.uk.LIGHT)
  // while level > 0.5. dy moves the HUD row (sample sheets).
  function hudGlow(r, name, level, dy) {
    if (level <= 0) return;
    dy = dy || 0;
    const x = HUD_X[name], y = 4 + dy, c = canvasOf(r), u = U();
    const M = G().maskOf(x - 1, y - 1, 14, 14, 2), In = u.shrink(M, 1);
    for (const q of M) if (!In.has(q)) { const a = u.KX(q), b = u.KY(q); if (level >= 0.75 || dithered(a, b, level + 0.25)) c.px(a, b, "m"); }
    if (level > 0.5) {
      const ic = S().get("ui.icons");
      remapped(r, spriteAt("ui.icons", ic.animations[name].frames[0], 0, x, y), u.LIGHT);
    }
  }
  // Two pulses in 1.2 s (generic "stuck" reminder): level over time t (s).
  const twoPulses = (t) => (t < 0 || t >= 1.2 ? 0 : Math.pow(Math.sin((Math.PI * t) / 0.6), 2));

  // ================================================================ thoughts (the approved think bubble)
  // dialogue.md §2 / ui.screen.dialogue (APR-0007): G2 think bubble, 10 px text in
  // u, 12 px rows, at most 150 px wide, two round puffs for a tail. The text comes
  // from content/i18n-onboarding; {key_*} / {act_*} / {alt_*} become G2 keycaps.
  const PLACE_KEY = { key_undo: "Z", key_restart: "R", key_hint: "H", key_observe: "Tab", key_pause: "Esc", key_up: "up", key_down: "down", key_left: "left", key_right: "right" };
  const DIR_OF = { left: "l", right: "r", down: "d" };
  function placeholder(name, o) {
    if (PLACE_KEY[name]) return [{ key: PLACE_KEY[name] }];
    let m = /^act_(dig|pour|bomb)(?:_(left|right|down))?$/.exec(name);
    if (m) return hintItems(m[1], m[2] ? DIR_OF[m[2]] : "lr", o.device, o.method).map((it) => (it.key ? { key: it.key } : it));
    m = /^alt_(dig|pour|bomb)$/.exec(name);
    return m ? [{ key: ALT[m[1]] }] : null;
  }
  // Units: one CJK character, a word, spaces (same split as PB.i18n.wrap) or a key group.
  const UNIT = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]|[^\s\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]+|\s+/g;
  const NO_START = "，。：；、！？）」』”…,.:;!?)";
  function units(text, o) {
    const out = [], re = /\{(\w+)\}/g;
    let last = 0, m;
    const words = (s) => { for (const u of s.match(UNIT) || []) out.push({ s: u }); };
    while ((m = re.exec(text))) {
      words(text.slice(last, m.index));
      const items = placeholder(m[1], o || {});
      if (items) out.push({ items }); else words(m[0]);
      last = re.lastIndex;
    }
    words(text.slice(last));
    return out;
  }
  const unitW = (c, u) => (u.items ? itemsW(c, u.items) + 2 : c.tw(u.s, 10));
  // Rows of units, each row at most maxW - 12 px of text.
  function layoutThought(c, text, o) {
    o = o || {};
    const room = (o.maxW || 150) - 12, rows = [[]];
    let w = 0;
    for (const u of units(text, o)) {
      const sp = !u.items && /^\s+$/.test(u.s), uw = unitW(c, u), row = rows[rows.length - 1];
      if (sp && !row.length) continue;
      if (!row.length || w + uw <= room || sp) { row.push(u); w += uw; continue; }
      if (!u.items && NO_START.includes(u.s[0]) && row.length > 1 && !row[row.length - 1].items) {
        const prev = row.pop(); rows.push([prev, u]); w = unitW(c, prev) + uw; continue;
      }
      while (row.length && !row[row.length - 1].items && /^\s+$/.test(row[row.length - 1].s)) row.pop();
      rows.push([u]); w = uw;
    }
    for (const row of rows) while (row.length && !row[row.length - 1].items && /^\s+$/.test(row[row.length - 1].s)) row.pop();
    const widths = rows.map((row) => row.reduce((a, u) => a + unitW(c, u), 0));
    const count = rows.reduce((a, row) => a + row.reduce((b, u) => b + (u.items ? 1 : [...u.s].length), 0), 0);
    return { rows, w: Math.max(28, Math.max(...widths) + 12), h: 10 + rows.length * 12, count };
  }
  // The bubble at (x, y) top-left, its tail towards tx; o.below = the bubble sits
  // under the speaker and the tail points up (mirrored).
  // o.reveal = characters shown so far (typewriter, 30 a second); a key group is one.
  function thought(r, lay, x, y, tx, o) {
    o = o || {};
    const c = canvasOf(r), s = G().STYLE.think, rc = s.rings.length, L = G();
    tx = Math.max(x + 8, Math.min(x + lay.w - 8, tx));
    L.layered(c, L.maskOf(x + rc, y + rc, lay.w - 2 * rc, lay.h - 2 * rc, s.r), s.rings, s.fill);
    if (o.below) { L.layered(c, L.discMask(tx - 2, y - 3, 2), s.rings, s.fill); L.layered(c, L.discMask(tx + 2, y - 8, 1), s.rings, s.fill); }
    else { L.layered(c, L.discMask(tx - 2, y + lay.h + 2, 2), s.rings, s.fill); L.layered(c, L.discMask(tx + 2, y + lay.h + 7, 1), s.rings, s.fill); }
    let left = o.reveal == null ? Infinity : o.reveal;
    lay.rows.forEach((row, i) => {
      let xx = x + 6, run = "", runX = xx;
      const yy = y + 6 + i * 12;
      const flush = () => { if (run) L.line(c, runX, yy, run, s.text, { sz: 10 }, null, "onb.think"); run = ""; };
      for (const u of row) {
        if (left <= 0) break;
        if (u.items) { flush(); drawItems(c, u.items, xx + 1, yy - 1, 0); xx += unitW(c, u); runX = xx; left -= 1; continue; }
        const chars = [...u.s], shown = chars.slice(0, Math.max(0, Math.min(chars.length, left))).join("");
        if (!run) runX = xx;
        run += shown; xx += c.tw(u.s, 10); left -= chars.length;
      }
      flush();
    });
    return { x, y, w: lay.w, h: lay.h };
  }
  // Where a thought about the hero goes: above the head (hx, top), or under the
  // feet (bottom) when the HUD is in the way. Returns { x, y, tx, below }.
  function thoughtPlace(lay, hx, top, bottom) {
    const x = Math.max(2, Math.min(318 - lay.w, hx - fd(lay.w, 2)));
    let y = top - lay.h - 11, below = false;
    if (y < 22) { y = bottom + 11; below = true; }
    return { x, y, tx: hx, below };
  }

  // ================================================================ sample sheets (asset and review pages)
  // One 320×180 sheet per asset, every state side by side; tick animates the
  // states that move (flash, breathing, flight, pulses). params.screen = onb_*.
  function back(r) { r.rect(0, 0, r.w, r.h, "x"); }
  function hudStrip(r, dy, lamps, lit) {
    r.rect(0, dy, 320, 20, "z"); r.hline(0, dy + 19, 320, "y");
    const ic = S().get("ui.icons");
    for (const name of ["pause", "hint", "restart", "undo"]) S().draw(r, "ui.icons", ic.animations[name].frames[0], 0, HUD_X[name], 4 + dy);
    for (let i = 0; i < lamps; i++) S().draw(r, "ui.goal_lamp", lit && lit[i] ? 1 : 0, 0, lampX(i, lamps), 5 + dy);
  }
  // Pixel zoom of a region (tiny assets are hard to judge at 1×).
  function zoom(r, src, sx, sy, w, h, dx, dy, s) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = src.get(sx + i, sy + j); if (k !== ".") r.rect(dx + i * s, dy + j * s, s, s, k); }
  }
  function cellBox(r, x, y) { G().box(canvasOf(r), x, y, 16, 16, { r: 0, rings: ["y"], fill: "w" }); }
  function hero(r, x, feet, tick) { S().draw(r, "char.portitor", "idle", tick, x, feet); const a = S().get("char.portitor"); return feet - a.anchor[1]; }

  function sheetKeyhint(r, tick) {
    const t = tick / 60, put = (items, x, y, o) => keyhint(r, x, y, items, o).w + 8;
    back(r);
    const dig = hintItems("dig", "r", "pc", "hold");
    let x = 6;
    x += put(hintItems("move", "lr"), x, 6); x += put(hintItems("climb", "u"), x, 6); put(hintItems("move", "lr"), x, 8, { plate: false });
    x = 6; x += put(dig, x, 30, { t: 0.1 }); x += put(dig, x, 30, { t: 0.5 }); put(dig, x, 30, { t });
    x = 6; x += put(hintItems("pour", "lr", "mac", "hold"), x, 54, { t: 0.1 }); put(hintItems("pour", "lr", "pc", "hold"), x, 54, { t: 0.1 });
    x = 6; x += put(hintItems("dig", "lr", "pc", "alt"), x, 78, { t: 0.1 }); x += put(hintItems("pour", "lr", "pc", "alt"), x, 78, { t: 0.1 }); put(hintItems("bomb", "d", "pc", "alt"), x, 78, { t: 0.1 });
    x = 6; x += put(hintItems("dig", "r", "mouse"), x, 102); put(hintItems("pour", "r", "mouse"), x, 102);
    x = 6;
    for (const a of [0.75, 0.5, 0.25]) { const sz = hintSize(r, dig), at = x; faded(r, a, { x: at, y: 126, w: sz.w, h: sz.h }, (q) => keyhint(q, at, 126, dig, { t: 0.1 })); x += sz.w + 8; }
    x = 6; x += put(dig, x, 154, { plate: false, t: 0.1 }) + 2; put(hintItems("pour", "lr", "mac", "hold"), x, 154, { plate: false, t: 0.1 });
  }

  function sheetKeyCmd(r, tick) {
    const t = tick / 60, c = canvasOf(r);
    back(r);
    const tmp = new PB.Raster(40, 16), q = canvasOf(tmp);
    key(q, 2, 2, "cmd", "n"); zoom(r, tmp, 2, 2, 11, 11, 10, 10, 6);
    tmp.data.fill(0); key(q, 2, 1, "cmd", "held"); zoom(r, tmp, 1, 1, 13, 14, 90, 6, 6);
    tmp.data.fill(0); key(q, 2, 2, "cmd", "dim"); zoom(r, tmp, 2, 2, 11, 11, 182, 10, 6);
    let x = 10;
    for (const st of ["n", "held", "dim"]) { key(c, x, 100, "cmd", st); x += 20; }
    keyhint(r, 80, 98, hintItems("pour", "l", "mac", "hold"), { t: 0.1 });
    keyhint(r, 150, 98, hintItems("pour", "lr", "mac", "hold"), { t });
    keyhint(r, 10, 130, hintItems("pour", "lr", "mac", "hold"), { plate: false, t: 0.1 });
  }

  function sheetActionIcon(r, tick) {
    const t = tick / 60, kinds = ["dig", "pour", "bomb", "mouse_l", "mouse_r", "no"];
    back(r);
    const tmp = new PB.Raster(16, 16);
    let x = 8;
    for (const k of kinds) {
      tmp.data.fill(0); const s = icon(tmp, k, 0, 0);
      zoom(r, tmp, 0, 0, s.w, s.h, x, 6, 4); icon(r, k, x + 4 * s.w + 3, 6 + 4 * s.h - s.h);
      x += 4 * s.w + s.w + 9;
    }
    // Waiting for a direction (X / C / B): bobbing icon, flashing directions;
    // a wrong direction shakes it and shows the cross.
    const feet = 150, heads = [[30, "dig", 0.1, {}], [80, "dig", 0.5, {}], [130, "pour", t, {}], [180, "bomb", t, {}], [230, "dig", 0.1, { shake: true, no: true }]];
    for (const [hx, k, tt, o] of heads) { const top = hero(r, hx, feet, tick); waiting(r, k, hx, top - 2, tt, o); }
    // Mouse hover on a neighbouring cell: what a click does.
    const cy = 134;
    cellBox(r, 262, cy); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if ((i + j) % 3 === 0) px(r, 262 + i, cy + j, "e");
    hover(r, "dig", 262, cy, "mouse_l");
    cellBox(r, 290, cy); hover(r, "pour", 290, cy, "mouse_r");
  }

  function sheetGoalGlow(r, tick) {
    const t = tick / 60;
    back(r); hudStrip(r, 0, 1, [t % 2.4 > 0.5]);
    // Breathing: low, middle, high, steady (environment effects off), live.
    [0, 0.5, 1, 0.7, breath(t)].forEach((lv, k) => { const x = 10 + k * 24; cellBox(r, x, 30); S().draw(r, "mech.socket", "idle", tick, x + 8, 46); socketGlow(r, x + 8, 46, lv, tick); });
    // Flight from the socket to the lamp (0.5 s, ease-out), frozen samples and live.
    const x0 = 40, y0 = 150, x1 = lampX(0, 1) + 4, y1 = 9;
    cellBox(r, x0 - 8, y0 - 8); S().draw(r, "mech.socket_lit", "lit", tick, x0, y0 + 8);
    for (const u of [0.2, 0.45, 0.7]) lightDot(r, x0, y0, x1, y1, u);
    const loop = t % 2.4;
    if (loop < 0.5) lightDot(r, x0, y0, x1, y1, loop / 0.5);
    else if (loop < 0.65) lampFlash(r, 0, 1);
    // Lamp states at 4×: off, on, flash.
    const tmp = new PB.Raster(12, 12);
    [0, 1, 2].forEach((st, k) => {
      tmp.data.fill(0);
      if (st < 2) S().draw(tmp, "ui.goal_lamp", st, 0, 0, 0); else remapped(tmp, spriteAt("ui.goal_lamp", 1, 0, 0, 0), "t");
      zoom(r, tmp, 0, 0, 9, 9, 150 + k * 42, 32, 4);
    });
  }

  function sheetCauseLink(r, tick) {
    const t = tick / 60, on = flashOn((t % 2) - 0.0) || tick === 0;
    back(r); hudStrip(r, 0, 1, [false]);
    // M01: socket + goal lamp flash together.
    cellBox(r, 30, 40); S().draw(r, "mech.socket", "idle", tick, 38, 56);
    if (on) { flashSprite(r, "mech.socket", "idle", tick, 38, 56); outline(r, spriteAt("ui.goal_lamp", 0, 0, lampX(0, 1), 5), "t"); }
    // M05: plate + door, their link symbols flash together; then the light runs.
    const plate = [80, 150], door = [200, 150];
    cellBox(r, plate[0] - 8, plate[1] - 16); cellBox(r, door[0] - 8, door[1] - 16);
    S().draw(r, "mech.plate", "up", 0, plate[0], plate[1]); S().draw(r, "mech.link_symbol", 0, 0, plate[0], plate[1] - 7);
    S().draw(r, "mech.door", "closed", 0, door[0], door[1]); S().draw(r, "mech.link_symbol", 0, 0, door[0], door[1] - 12);
    if (on) for (const [id, a, x, y] of [["mech.link_symbol", 0, plate[0], plate[1] - 7], ["mech.link_symbol", 0, door[0], door[1] - 12], ["mech.plate", "up", plate[0], plate[1]]]) flashSprite(r, id, a, 0, x, y);
    const u = tick === 0 ? 0 : (t % 1.6) / 0.6;
    causeLine(r, plate[0], plate[1] - 4, door[0], door[1] - 8, u);
    causeLine(r, plate[0], plate[1] - 34, door[0], door[1] - 38, 0.5);
  }

  function sheetHudGlow(r, tick) {
    const t = tick / 60;
    back(r);
    hudStrip(r, 0, 2, [true, false]); hudGlow(r, "undo", 1, 0); hudGlow(r, "hint", 1, 0);
    hudStrip(r, 28, 2, [true, false]); hudGlow(r, "undo", 0.5, 28); hudGlow(r, "hint", 0.5, 28);
    hudStrip(r, 56, 2, [true, false]); const p = twoPulses(t % 2.4); hudGlow(r, "undo", p, 56); hudGlow(r, "hint", p, 56);
    hudStrip(r, 84, 2, [true, false]); hudGlow(r, "undo", 0.6 + 0.4 * breath(t, 1.2), 84);
    zoom(r, r, 258, 0, 50, 20, 10, 110, 3);
  }

  const SHEETS = { onb_keyhint: sheetKeyhint, onb_action_icon: sheetActionIcon, onb_goal_glow: sheetGoalGlow, onb_cause_link: sheetCauseLink, onb_hud_glow: sheetHudGlow, onb_key_cmd: sheetKeyCmd };
  function registerSheets() { if (PB.ui && PB.ui.SCREENS) for (const [k, f] of Object.entries(SHEETS)) PB.ui.SCREENS[k] = (r, tick) => f(r, tick || 0); }
  registerSheets();

  PB.onbFx = {
    // keys
    hintItems, hintSize, keyhint, key, keyW, faded, ALT, KEYS,
    // icons
    icon, iconSize, waiting, hover, WAIT_DIRS,
    // goal, cause, HUD
    spriteAt, outline, socketGlow, breath, lightDot, lampX, lampFlash, flashOn, flashSprite, causeLine, hudGlow, twoPulses, HUD_X,
    // thoughts
    layoutThought, thought, thoughtPlace, units,
    SHEETS, registerSheets,
  };
})(typeof window !== "undefined" ? window : globalThis);
