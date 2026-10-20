/* Delivery v2 rooms (docs/design/delivery-puzzle-rules.md): one room of one to
 * four screens in its region's theme, its puzzle state from rooms2.js (tile
 * model + float blocks), the hint animals, the follow camera and a small HUD.
 * Background, terrain, life and light reuse the approved renderers unchanged
 * (terrain.js, terrain-diyu.js, ambient.js, env.js, matter.js); ambient life
 * and wall lights are placed screen by screen, so every screen of a large
 * room looks like a level-mode room. Figures without approved art go through
 * delivery-scene.js (art candidates or letter placeholders).
 * Looks only (delivery-puzzle-rules.md 8): in a map with "top_edge": "sky" the
 * thin rock at the top of a room is drawn as sky (skyCells), and ladder heads
 * are capped like in level mode (workbench/js/app/ladder-tops.js, when loaded).
 *
 * scene(M, world, map)     cached pictures of one room (M = rooms2.start(...),
 *                          map = its slices.json entry, for top_edge)
 * skyCells(v, map)         cells drawn as sky (a Set of y * W + x)
 * run(M, o)                a play state: actions, undo, coins, snacks, camera
 * act / undo / feed / update(P, tick)
 * draw(r, sc, P, o)        o: {tick, view: "full"|"camera", overlays, recipient, stepText}
 * Shared by the workbench (browser, classic script) and the Node tools. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const S = () => PB.sprites, TM = () => PB.tilemodel, TR = () => PB.terrain, R2 = () => PB.rooms2, D1 = () => PB.droom;
  const HUD_H = 20, VW = 320, VH = 180, BUBBLE_TICKS = 240;

  const tr = (key, vars, fallback) => {
    const I = PB.i18n;
    if (I && I.has(key)) return I.t(key, vars);
    let s = fallback === undefined ? key : fallback;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    return s;
  };
  // The workbench can restrict drawing to approved art (like PB.droom.setArtFilter):
  // puzzle devices, float blocks, hint animals and snacks then use placeholders.
  let artFilter = () => true;
  function setArtFilter(fn) { artFilter = fn || (() => true); }
  const art = (id) => !!id && S().has(id) && artFilter(id);
  function placeholder(r, cx, by, w, h, fill, letter) {
    const x = cx - (w >> 1), y = by - h;
    r.rect(x, y, w, h, "z"); r.rect(x + 1, y + 1, w - 2, h - 2, fill);
    r.set(x + 1, y + 1, "z"); r.set(x + 2, y + 1, "z"); r.set(x + 1, y + 2, "z");
    if (letter && PB.text) PB.text.draw(r, letter, cx - (PB.text.measure(letter) >> 1), y + ((h - 12) >> 1) - 1, "z");
  }
  function roomName(v) { return tr("room2." + v.id + ".name", null, v.room.name || v.id); }
  function hintText(v, i) { const h = v.hints[i]; return tr("room2." + v.id + ".hint." + i, null, h ? h.text : ""); }

  // Ice is a level-mode material of matter.js: EMPTY for terrain.js and drawn on top, as in scene.js.
  const isOwn = (t) => !!PB.matter && PB.matter.isOwn(t);
  const VENT_ART = { frost_vent: "mech.frost_vent", heat_vent: "mech.heat_vent" };
  function toMat(t) {
    const T = TM().T, M = TR().MAT;
    return t === T.ROCK ? M.ROCK : t === T.CRACKED ? M.CRACKED : t === T.EARTH ? M.EARTH : t === T.SAND ? M.SAND : t === T.WATER ? M.WATER : M.EMPTY;
  }
  const lerp = (a, b, k) => Math.round(a + (b - a) * Math.max(0, Math.min(1, k)));
  function seesawCells(d) {
    const [a, b] = d.ends, span = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    if (!span) return [a];
    return Array.from({ length: span + 1 }, (_, n) => [lerp(a[0], b[0], n / span), lerp(a[1], b[1], n / span)]);
  }

  // ---------- top edge (delivery-puzzle-rules.md 8.1) ----------
  // Only in a map with "top_edge": "sky". Each column's run of solid cells from
  // row 0 down (rock, cracked, hard rock; ladders, crates, float blocks and doors
  // are not solid): 1-2 cells are sky, 3 or more stay, a cliff cut off by the
  // picture's top. Only the room's top counts (rows 10-11 of a two-screen room
  // stay). Read from the opening map; the cells stay bedrock in the puzzle.
  const SKY_SOLID = "#%R";
  function skyCells(v, map) {
    const out = new Set();
    if (!map || map.top_edge !== "sky") return out;
    for (let x = 0; x < v.W; x++) {
      let n = 0;
      while (n < 3 && n < v.H && SKY_SOLID.includes(v.map[n][x])) n++;
      if (n < 3) for (let y = 0; y < n; y++) out.add(y * v.W + x);
    }
    return out;
  }

  // ---------- scene cache ----------
  function scene(M, world, map) {
    const v = M.v, L = M.L, W = v.W, H = v.H, pw = W * 16, ph = H * 16, EMPTY = TR().MAT.EMPTY;
    const themeId = D1().themeId(world), theme = S().get(themeId).params;
    const floatCells = new Set(), sky = skyCells(v, map);
    for (const f of v.floats) for (let x = f.x; x < f.x + f.w; x++) floatCells.add(f.y * W + x);
    // Opening terrain without the float blocks (they are figures, drawn on top) and the sky cells.
    const mat0 = (x, y) => (x < 0 || y < 0 || x >= W || y >= H || floatCells.has(y * W + x) || sky.has(y * W + x) ? EMPTY : toMat(M.t0[y * W + x]));
    // Cells kept free of plants and critters: markers, doors, devices, exits,
    // crates, figures and their patrols, coins, the rows float blocks travel in, the sky.
    const occ = new Set(sky), add = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) occ.add(y * W + x); };
    for (let i = 0; i < W * H; i++) if (L.marker[i] !== TM().M.NONE) occ.add(i);
    for (const i of L.doors) occ.add(i);
    for (const i of M.deviceCells) occ.add(i);
    for (const i of M.exitSet) occ.add(i);
    for (const d of v.devices || []) {
      for (const c of [d.at, d.button].concat(d.pads || [], d.cells || [])) if (c) { add(c[0], c[1]); add(c[0], c[1] - 1); }
      if (d.stops) { const top = Math.min(...d.stops.map((s) => s[1])), bot = Math.max(...d.stops.map((s) => s[1])); for (let y = top - 1; y <= bot; y++) for (let k = 0; k < (d.width || 1); k++) add(d.stops[0][0] + k, y); }
      if (d.type === "seesaw") for (const [x, y] of seesawCells(d)) { add(x, y); add(x, y - 1); }
      if (d.type === "gust" || VENT_ART[d.type]) { const [x, y, w, h] = d.area; for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) add(x + dx, y + dy); }
    }
    for (let i = 0; i < W * H; i++) if (isOwn(M.t0[i])) { add(i % W, (i / W) | 0); add(i % W, ((i / W) | 0) - 1); }
    for (const c of M.s.crates) add(c.x, c.y);
    for (const sp of v.spawns) { const [z0, z1] = sp.zone || [sp.x, sp.x]; for (let x = Math.min(z0, sp.x) - 1; x <= Math.max(z1, sp.x) + 1; x++) add(x, sp.y); }
    for (const [x, y] of v.coins) add(x, y);
    for (const f of v.floats) {
      let a = f.x, b = f.x + f.w - 1;
      while (a > 0 && mat0(a - 1, f.y) === EMPTY) a--;
      while (b < W - 1 && mat0(b + 1, f.y) === EMPTY) b++;
      for (let x = a; x <= b; x++) { add(x, f.y); add(x, f.y - 1); }
    }
    add(M.s.player.x, M.s.player.y);
    const id = v.id + (v.mirror ? "~m" : "");
    const screens = [];
    for (let sy = 0; sy < v.rows; sy++) for (let sx = 0; sx < v.cols; sx++) {
      const x0 = sx * VW + (sx === 0 ? 16 : 0), x1 = (sx + 1) * VW - (sx === v.cols - 1 ? 16 : 0);
      const y0 = HUD_H + sy * 160 + (sy === 0 ? 16 : 0), y1 = HUD_H + (sy + 1) * 160 - (sy === v.rows - 1 ? 16 : 0);
      const bx = sx * R2().SW, by = sy * R2().SH;
      screens.push({ sx, sy, bx, by, ox: sx * VW, oy: HUD_H + sy * 160, area: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
        sub: { w: R2().SW, h: R2().SH, at: (x, y) => mat0(bx + x, by + y) }, occ: (x, y) => occ.has((by + y) * W + bx + x),
        seed: PB.ambient.seedOf(id + ":" + sx + "," + sy) });
    }
    // matter.js draws the level-mode devices (levers, bins...); the vents are drawn here with their feedback.
    const devSpec = Object.assign({}, M.spec, { devices: (M.spec.devices || []).map((d) => (VENT_ART[d.type] ? { type: "vent" } : d)) });
    return { M, v, L, world, themeId, theme, W, H, pw, ph, fr: new PB.Raster(pw, ph + HUD_H), bg: null, bgKey: null, ter: null, terKey: null, mat0, occ, sky, screens, devSpec };
  }
  function size(sc, view) { return view === "camera" ? [VW, VH] : [sc.pw, sc.ph + HUD_H]; }

  // Background: styles drawn against a horizon (diyu, sky, jeju, polar) repeat per row of
  // screens, as each screen would show it; the others tile seamlessly.
  const BANDED = new Set(["diyu", "sky", "jeju", "polar"]);
  function background(sc, tick) {
    const style = (sc.theme.background || {}).style, banded = BANDED.has(style), key = banded ? tick >> 5 : 0;
    if (sc.bg && sc.bgKey === key) return sc.bg;
    const bg = new PB.Raster(sc.pw, sc.ph + HUD_H);
    if (!banded) TR().drawBackground(bg, sc.theme, 0, 0, sc.pw, sc.ph + HUD_H, tick);
    else {
      const tmp = new PB.Raster(sc.pw, VH), row = sc.pw * 4;
      TR().drawBackground(tmp, sc.theme, 0, 0, sc.pw, VH, tick);
      for (let sy = 0; sy < sc.v.rows; sy++) { const from = sy ? HUD_H : 0; bg.data.set(tmp.data.subarray(from * row, VH * row), (sy * 160 + from) * row); }
    }
    sc.bg = bg; sc.bgKey = key;
    return bg;
  }
  // Current terrain as drawn (float blocks and sky cells removed) as a cell array.
  function cellsOf(sc, s) {
    const W = sc.W, n = W * sc.H, out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = toMat(s.terrain[i]);
    for (const f of s.floats) for (let x = f.x; x < f.x + f.w; x++) out[f.y * W + x] = TR().MAT.EMPTY;
    for (const i of sc.sky) out[i] = TR().MAT.EMPTY;
    return out;
  }
  function terrainLayer(sc, cells, tick, s) {
    let own = "";
    for (let i = 0; i < s.terrain.length; i++) if (isOwn(s.terrain[i])) own += i + ":" + s.terrain[i] + ",";
    const water = cells.includes(TR().MAT.WATER), key = cells.join("") + "|" + own + (water ? "|" + (tick >> 3) : "");
    if (sc.ter && sc.terKey === key) return sc.ter;
    const W = sc.W, H = sc.H, r = new PB.Raster(sc.pw, sc.ph + HUD_H);
    TR().drawTerrain(r, { w: W, h: H, at: (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? TR().MAT.EMPTY : cells[y * W + x]) }, sc.theme, 0, HUD_H, tick >> 3);
    if (own) PB.matter.drawMaterials(r, PB.matter.mapOf(sc.L, s), 0, HUD_H, tick >> 3);
    sc.ter = r; sc.terKey = key;
    return r;
  }
  function overlay(dst, src) {
    const d = new Uint32Array(dst.data.buffer), s = new Uint32Array(src.data.buffer);
    for (let i = 0; i < s.length; i++) if (s[i] >>> 24) d[i] = s[i];
  }
  // Background, light, ambient life and terrain of the whole room into sc.fr.
  function compose(sc, s, tick) {
    const fr = sc.fr, theme = sc.theme, W = sc.W, EMPTY = TR().MAT.EMPTY;
    fr.data.set(background(sc, tick).data);
    const cells = cellsOf(sc, s), at = (x, y) => (x < 0 || y < 0 || x >= W || y >= sc.H ? EMPTY : cells[y * W + x]);
    const own = (x, y) => x >= 0 && y >= 0 && x < W && y < sc.H && isOwn(s.terrain[y * W + x]);
    const free = (x, y) => at(x, y) === EMPTY && !own(x, y) && !TM().crateAt(s, x, y);
    const alive = (q) => (x, y) => { const gx = q.bx + x, gy = q.by + y; return free(gx, gy) && !own(gx, gy + 1) && (at(gx, gy + 1) !== EMPTY || at(gx, gy - 1) !== EMPTY); };
    const lights = [];
    for (const q of sc.screens) for (const layer of ["back", "front"]) PB.ambient.draw(fr, theme, q.sub, q.ox, q.oy, tick, layer, q.occ, q.area, alive(q), { mode: "sparse", seed: q.seed, out: lights, dry: true });
    if (PB.env) PB.env.draw(fr, theme, "back", { tick, area: { x: 0, y: HUD_H, w: sc.pw, h: sc.ph }, lights, weather: undefined, level: "full" });
    for (const q of sc.screens) PB.ambient.draw(fr, theme, q.sub, q.ox, q.oy, tick, "back", q.occ, q.area, alive(q), { mode: "sparse", seed: q.seed, out: null });
    overlay(fr, terrainLayer(sc, cells, tick, s));
    for (const q of sc.screens) PB.ambient.draw(fr, theme, q.sub, q.ox, q.oy, tick, "front", q.occ, q.area, alive(q), { mode: "sparse", seed: q.seed, out: null });
    return lights;
  }

  // ---------- play state ----------
  function facingOf(from) { if (!from || from === "gate") return 1; return R2().parseExit(from).edge === "right" ? -1 : 1; }
  function run(M, o) {
    const opt = o || {}, s = R2().clone(M.s);
    const P = { M, s, hist: [], anim: null, queued: null, facing: facingOf(M.from), coins: new Set(), snacks: opt.snacks === undefined ? 3 : opt.snacks,
      bubble: null, done: false, exit: false, lastTick: null, mem: {}, bump: null, fed: 0 };
    collect(P, s.player.x, s.player.y);
    P.cam = R2().cameraStart(M.v, s.player.x * 16, s.player.y * 16, P.facing);
    return P;
  }
  function collect(P, x, y) {
    for (const [cx, cy] of P.M.v.coins) if (cx === x && cy === y) P.coins.add(cx + "," + cy);
  }
  function snapshot(P) { return { s: R2().clone(P.s), coins: new Set(P.coins), snacks: P.snacks, facing: P.facing, done: P.done, exit: P.exit }; }
  function say(P, who, text, tick) { P.bubble = { who, text, t: tick }; }
  const SEG = { dig: 12, pour: 12, pole: 12, lever: 10, climb: 8 };
  // a: one of rooms2.ACTIONS. Returns the model result ({ok, kind, reason}).
  function act(P, a, tick) {
    if (P.anim && tick < P.anim.end) { P.queued = a; return { ok: false, reason: "busy" }; }
    const M = P.M, n = R2().clone(P.s), dir = /L$/.test(a) ? -1 : /R$/.test(a) ? 1 : 0;
    if (dir) P.facing = dir;
    const r = R2().act(M, n, a);
    if (!r.ok) { P.bump = { t: tick, dir }; return r; }
    if (R2().hurts(M, n, r)) { P.bump = { t: tick, dir }; say(P, "player", tr("dlg.r2.hurt", null, "太高了，跳下去会摔伤。"), tick); return { ok: false, reason: "hurt", drop: r.drop }; }
    P.hist.push(snapshot(P));
    const o = P.s, from = { x: o.player.x, y: o.player.y, crates: o.crates.map((c) => [c.x, c.y]), floats: o.floats.map((f) => f.x) };
    const drop = Math.max(0, r.drop || 0), lift = (r.events || []).includes("lift");
    let seg1 = SEG[r.kind] || 8;
    if (lift) seg1 = Math.max(seg1, 6 * Math.abs(n.player.y - o.player.y));
    let fall = drop;
    if (n.crates.length === o.crates.length) n.crates.forEach((c, i) => { fall = Math.max(fall, c.y - from.crates[i][1]); });
    P.anim = { t: tick, kind: r.kind, from, drop, seg1, end: tick + seg1 + fall * 4, lift,
      deviceEvents: (r.deviceEvents || []).map((e) => Object.assign({}, e)) };
    P.s = n;
    for (let y = n.player.y - drop; y <= n.player.y; y++) collect(P, n.player.x, y);
    const atExit = M.exitSet.has(n.player.y * M.v.W + n.player.x), goal = R2().atGoal(M, n);
    if ((atExit || goal) && !(P.exit || P.done)) say(P, "player", tr("dlg.r2.exit", null, "到出口了！"), tick);
    P.exit = atExit; P.done = P.done || goal;
    return r;
  }
  function undo(P) {
    const h = P.hist.pop();
    if (!h) return false;
    Object.assign(P, { s: h.s, coins: h.coins, snacks: h.snacks, facing: h.facing, done: h.done, exit: h.exit, anim: null, queued: null, bubble: null });
    return true;
  }
  // Jump to a state without animation (solution stepping).
  function setState(P, s) { P.s = R2().clone(s); P.anim = null; P.queued = null; P.done = R2().atGoal(P.M, P.s); P.exit = P.M.exitSet.has(P.s.player.y * P.M.v.W + P.s.player.x); }
  function busy(P, tick) { return !!(P.anim && tick < P.anim.end); }

  // ---------- tweening ----------
  function playerPx(P, tick) {
    const p = P.s.player, a = P.anim;
    if (!a || tick >= a.end) return [p.x * 16, p.y * 16, false];
    const k = tick - a.t, x1 = p.x * 16, ym = (p.y - a.drop) * 16;
    if (k < a.seg1) return [lerp(a.from.x * 16, x1, k / a.seg1), lerp(a.from.y * 16, ym, k / a.seg1), false];
    const y = Math.min(p.y * 16, ym + (k - a.seg1) * 4);
    return [x1, y, y < p.y * 16];
  }
  function cratePx(P, i, c, tick) {
    const a = P.anim;
    if (!a || tick >= a.end || !a.from.crates[i] || a.from.crates.length !== P.s.crates.length) return [c.x * 16, c.y * 16];
    const [x0, y0] = a.from.crates[i], k = tick - a.t;
    const x = lerp(x0 * 16, c.x * 16, k / a.seg1);
    if (c.y <= y0) return [x, lerp(y0 * 16, c.y * 16, k / a.seg1)];
    return [x, k < a.seg1 ? y0 * 16 : Math.min(c.y * 16, y0 * 16 + (k - a.seg1) * 4)];
  }
  function floatPx(P, i, f, tick) {
    const a = P.anim;
    if (!a || tick >= a.end || a.from.floats[i] === undefined || a.from.floats[i] === f.x) return [f.x * 16, false];
    return [lerp(a.from.floats[i] * 16, f.x * 16, (tick - a.t) / a.seg1), tick - a.t < a.seg1];
  }
  const POSE = { walk: "walk", step: "walk", push: "push", "float-push": "push", climb: "climb", lever: "idle", dig: "dig", pole: "dig", pour: "pour" };
  function poseOf(P, tick) {
    const a = P.anim;
    if (a && tick < a.end) { const [, , air] = playerPx(P, tick); return air ? "fall" : tick - a.t < a.seg1 ? POSE[a.kind] || "idle" : "idle"; }
    return P.done ? "win" : "idle";
  }

  // ---------- hint animals ----------
  function faunaOf(world) {
    const list = (world && world.hint_fauna) || [];
    return { main: list.find((f) => f.snack) || null, flyer: list.find((f) => !f.snack) || null };
  }
  // Polar oat cakes (item.snack_polar, ART-01c); until that asset exists, the default snack.
  function snackOf(world) {
    if (world && world.id === "polar") return S().has("item.snack_polar") ? { asset: "item.snack_polar", anim: "default" } : { asset: "item.snack", anim: "default" };
    return world && world.id === "jeju" ? { asset: "item.snack_jeju", anim: "default" }
      : { asset: "item.snack", anim: world && world.id === "diyu" ? "diyu" : "dungeon" };
  }
  const FLYER_ACTIONS = new Set(["walk", "climb"]);
  const isFlyerHint = (h) => !!h && !!h.show && FLYER_ACTIONS.has(h.show.action);
  function solidAt(P, x, y) {
    const M = P.M, s = P.s, T = TM().T, t = TM().terrainAt(M.L, s, x, y);
    return (t !== T.EMPTY && t !== T.WATER) || !!TM().crateAt(s, x, y) || !!R2().floatAt(s, x, y) || TM().liftDeck(M.L, s, x, y) >= 0 || TM().bridgeAt(M.L, s, x, y) >= 0
      || M.L.devices.some((d) => d.type === "seesaw" && d.ends.some(([ex, ey]) => ex === x && ey === y));
  }
  function standable(P, x, y) {
    const M = P.M, v = M.v, i = y * v.W + x;
    if (x < 1 || y < 1 || x >= v.W - 1 || y >= v.H - 1) return false;
    if (solidAt(P, x, y) || TM().terrainAt(M.L, P.s, x, y) === TM().T.WATER) return false;
    if (M.exitSet.has(i) || M.L.marker[i] === TM().M.LADDER || M.L.doors.includes(i)) return false;
    return solidAt(P, x, y + 1);
  }
  // Cell next to (tx, ty) where the main animal sits.
  function spotNear(P, tx, ty, avoid) {
    let best = null, bs = Infinity;
    const p = P.s.player;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -6; dx <= 6; dx++) {
      const x = tx + dx, y = ty + dy;
      if (!standable(P, x, y)) continue;
      let sc = dx * dx + 2 * dy * dy;
      if (x === p.x && y === p.y) sc += 40;
      if (avoid && x === avoid[0] && y === avoid[1]) sc += 3;
      if (dx === 0 && dy === 0) sc += 2;
      if (sc < bs) { bs = sc; best = [x, y]; }
    }
    return best;
  }
  // Where the hint animals are and what they show for the current state.
  function hintPlan(P) {
    const M = P.M, v = M.v, H = v.hints, i = R2().nextHint(M, P.s), p = P.s.player;
    const h = i < H.length ? H[i] : null;
    const mainIdx = (from, step) => { for (let k = from; k >= 0 && k < H.length; k += step) if (!isFlyerHint(H[k])) return k; return -1; };
    const flyIdx = (from, step) => { for (let k = from; k >= 0 && k < H.length; k += step) if (isFlyerHint(H[k])) return k; return -1; };
    let mi = h && !isFlyerHint(h) ? i : mainIdx(i, 1);
    if (mi < 0) mi = mainIdx(Math.min(i, H.length) - 1, -1);
    let mainCell;
    if (!h) {
      // All done (or no hints): wait next to the way out.
      const g = M.to === "recipient" ? (() => { const q = v.spawns.find((z) => z.feature === "recipient"); return [q.x, q.y]; })() : M.to ? R2().entryCell(v.W, v.H, M.to) : [p.x, p.y];
      mainCell = spotNear(P, g[0], g[1]);
    } else if (mi >= 0) { const hm = H[mi]; mainCell = spotNear(P, hm.target[0], hm.target[1], hm.show && hm.show.at); }
    else mainCell = spotNear(P, M.s.player.x, M.s.player.y);
    let fi = h && isFlyerHint(h) ? i : flyIdx(i, 1);
    if (fi < 0) fi = flyIdx(Math.min(i, H.length) - 1, -1);
    const flyCell = fi >= 0 && H.length ? H[fi].target : null;
    const near = !!(h && h.show && h.show.at && Math.max(Math.abs(p.x - h.show.at[0]), Math.abs(p.y - h.show.at[1])) <= 3);
    return { i, n: H.length, h, flyer: !!(h && isFlyerHint(h)), mainCell, flyCell, near, mainActive: !!(h && !isFlyerHint(h)) };
  }
  function flyerPerch(P, cell, kind, sky) {
    const [tx, ty] = cell, cx = tx * 16 + 8;
    if (kind === "bat") {
      for (let y = ty - 1; y >= Math.max(0, ty - 5); y--) if (solidAt(P, tx, y) && !(sky && sky.has(y * P.M.v.W + tx))) return { x: cx, y: (y + 1) * 16, anim: "hang" };
      return { x: cx, y: ty * 16 - 6, anim: "fly" };
    }
    return solidAt(P, tx, ty + 1) ? { x: cx, y: ty * 16 + 13, anim: "rest" } : { x: cx, y: ty * 16 + 8, anim: "fly" };
  }
  function stepToward(m, x, y, sp) {
    if (Math.abs(m.x - x) > 192 || Math.abs(m.y - y) > 128) { m.x = x; m.y = y; return false; }
    const dx = Math.sign(x - m.x) * Math.min(sp, Math.abs(x - m.x)), dy = Math.sign(y - m.y) * Math.min(sp, Math.abs(y - m.y));
    m.x += dx; m.y += dy; if (dx) m.face = dx;
    return !!(dx || dy);
  }
  // Advances the camera, the animals and a queued action to display tick `tick`.
  function update(P, tick) {
    const plan = hintPlan(P);
    if (P.lastTick === null || tick < P.lastTick || tick - P.lastTick > 120) {
      P.lastTick = tick;
      const [px, py] = playerPx(P, tick); P.cam = R2().cameraStart(P.M.v, px, py, P.facing);
      P.mem = {};
      if (plan.mainCell) P.mem.main = { x: plan.mainCell[0] * 16 + 8, y: plan.mainCell[1] * 16 + 16, face: 1, moving: false };
      if (plan.flyCell) P.mem.fly = { x: plan.flyCell[0] * 16 + 8, y: plan.flyCell[1] * 16, cell: plan.flyCell.join(","), since: -999 };
    }
    while (P.lastTick < tick) {
      const t = ++P.lastTick, [px, py, air] = playerPx(P, t);
      R2().cameraStep(P.M.v, P.cam, px, py, P.facing, !air);
      if (P.queued && !busy(P, t)) { const a = P.queued; P.queued = null; act(P, a, t); }
      if (plan.mainCell) {
        const tx = plan.mainCell[0] * 16 + 8, ty = plan.mainCell[1] * 16 + 16;
        const m = P.mem.main || (P.mem.main = { x: tx, y: ty, face: 1, moving: false });
        m.moving = stepToward(m, tx, ty, 2);
      }
      if (plan.flyCell && !P.mem.fly) P.mem.fly = { x: plan.flyCell[0] * 16 + 8, y: plan.flyCell[1] * 16, cell: null, since: -999 };
    }
    if (P.bubble && tick - P.bubble.t > BUBBLE_TICKS) P.bubble = null;
    return plan;
  }

  // Feed the nearer hint animal a snack (H in the workbench).
  function feed(P, tick, world) {
    const v = P.M.v, plan = hintPlan(P), fa = faunaOf(world), p = P.s.player;
    const d = (m) => (m ? Math.max(Math.abs(m.x - (p.x * 16 + 8)), Math.abs(m.y - (p.y * 16 + 16))) : Infinity);
    const dm = d(P.mem.main), df = fa.flyer && P.mem.fly ? d(P.mem.fly) : Infinity;
    if (fa.flyer && df < dm && df <= 64) { say(P, "flyer", tr("dlg.fauna." + fa.flyer.id + ".fed", null, fa.flyer.fed || ""), tick); return "flyer"; }
    if (!v.hints.length) { say(P, "main", tr("dlg.r2.no_hint", null, "这间没有要提示的，往出口走吧。"), tick); return "none"; }
    if (plan.i >= v.hints.length) { say(P, "main", tr("dlg.r2.done_hint", null, "都做完了：去出口吧。"), tick); return "done"; }
    if (P.snacks <= 0) { say(P, "player", tr("dlg.r2.no_snack", null, "零食吃完了。"), tick); return "empty"; }
    P.hist.push(snapshot(P));
    P.snacks -= 1; P.fed += 1;
    say(P, "main", hintText(v, plan.i), tick);
    P.bubble.snack = true;
    return "hint";
  }

  // ---------- figures ----------
  function animOf(sid, prefs) {
    if (!S().has(sid)) return undefined;
    const a = S().get(sid).animations || {};
    for (const k of prefs) if (a[k]) return k;
    return Object.keys(a)[0];
  }
  const tri = (t, period, amp) => { const p = ((t % period) + period) % period, h = period / 2; return Math.round((p < h ? p / h : 2 - p / h) * 2 * amp - amp); };
  function patrolX(sp, tick) {
    const [z0, z1] = sp.zone || [sp.x, sp.x], span = (z1 - z0) * 16;
    if (span <= 0) return [sp.x * 16, sp.dir === "left" ? -1 : 1];
    const pause = 40, period = 2 * span + 2 * pause, ph = ((tick >> 1) + sp.x * 37) % period;
    if (ph < span) return [z0 * 16 + ph, 1];
    if (ph < span + pause) return [z1 * 16, 1];
    if (ph < 2 * span + pause) return [z1 * 16 - (ph - span - pause), -1];
    return [z0 * 16, -1];
  }
  function monsterPx(sp, tick) { const [x, d] = patrolX(sp, tick); return [x, sp.y * 16, d]; }
  function drawArrow(r, x, y, dir) {
    if (!S().has("ui.delivery_icons")) return;
    const a = S().get("ui.delivery_icons"), f = a.frames[a.animations.arrow.frames[0]], n = f.length;
    f.forEach((row, yy) => [...row].forEach((c, xx) => {
      if (c === ".") return;
      let X = xx, Y = yy;
      if (dir === "L") X = n - 1 - xx; else if (dir === "U") { X = yy; Y = n - 1 - xx; } else if (dir === "D") { X = n - 1 - yy; Y = xx; }
      r.set(x + X, y + Y, c);
    }));
  }
  function dashRect(r, x, y, w, h, c, step) {
    const k = step || 3;
    for (let i = 0; i < w; i += k) { r.set(x + i, y, c); r.set(x + i, y + h - 1, c); }
    for (let i = 0; i < h; i += k) { r.set(x, y + i, c); r.set(x + w - 1, y + i, c); }
  }
  function frameRect(r, x, y, w, h, c) { r.hline(x, y, w, c); r.hline(x, y + h - 1, w, c); r.vline(x, y, h, c); r.vline(x + w - 1, y, h, c); }

  // The 16x20 seesaw frames anchor at the bottom centre of a cell. Their top
  // four rows may rise above the cell; the remaining 16 rows align to terrain.
  // Device feedback belongs to the accepted action, never to elapsed time.
  function drawPuzzleDevices(r, sc, P, ox, oy, tick, used) {
    const a = P.anim, events = a && tick >= a.t && tick < a.end ? a.deviceEvents || [] : [];
    (sc.v.devices || []).forEach((d, k) => {
      if (d.type === "seesaw") {
        const asset = "mech.jeju_seesaw", cells = seesawCells(d), last = cells.length - 1;
        const e = events.find((q) => q.type === "seesaw" && q.device === k);
        const approved = art(asset);
        if (!approved) used.push(asset);
        cells.forEach(([x, y], n) => {
          const side = n === 0 ? 0 : n === last ? 1 : -1;
          const anim = side >= 0 ? e ? side === e.side ? "down" : "launch" : "end"
            : n === Math.floor(last / 2) ? "pivot" : "mid";
          const flip = side >= 0 && d.ends[side][0] > d.ends[1 - side][0];
          const px = ox + x * 16 + 8, py = oy + y * 16 + 16;
          if (approved) S().draw(r, asset, anim, 0, px, py, flip);
          else placeholder(r, px, py, 16, 20, "y", "S");
        });
      } else if (d.type === "gust") {
        const asset = "fx.jeju_gust", [x, y, w, h] = d.area;
        const blow = events.some((q) => q.type === "gust" && q.device === k), approved = art(asset);
        if (!approved) used.push(asset);
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
          const px = ox + (x + dx) * 16 + 8, py = oy + (y + dy) * 16 + 16;
          if (approved) S().draw(r, asset, blow ? "blow" : "drift", tick, px, py, d.direction === "L");
          else placeholder(r, px, py, 16, 16, "b", "G");
        }
      } else if (VENT_ART[d.type]) {
        // Frost / heat vents (asset usage): idle; "active" while the action that fired them plays.
        const asset = VENT_ART[d.type], fired = events.some((q) => q.type === d.type && q.device === k), approved = art(asset);
        const px = ox + d.at[0] * 16 + 8, py = oy + d.at[1] * 16 + 16;
        if (!approved) used.push(asset);
        if (approved) S().draw(r, asset, fired ? "active" : "idle", tick, px, py);
        else placeholder(r, px, py, 16, 16, d.type === "frost_vent" ? "s" : "k", "V");
      }
    });
  }

  // Everything that sits on the terrain, at room offset (ox, oy).
  function drawFigures(r, sc, P, ox, oy, tick, o, plan) {
    const M = sc.M, v = sc.v, L = sc.L, s = P.s, TMM = TM().M, W = sc.W;
    const used = [];
    const sym = (i) => (L.symbol && L.symbol[i]) || 0;
    for (let i = 0; i < W * sc.H; i++) {
      const tx = i % W, ty = (i / W) | 0, px = ox + tx * 16 + 8, py = oy + ty * 16 + 16, crate = TM().crateAt(s, tx, ty);
      if (L.marker[i] === TMM.LADDER) S().draw(r, "mech.ladder", "default", 0, px, py);
      if (L.marker[i] === TMM.SOCKET && !crate) S().draw(r, "mech.socket", "idle", tick, px, py);
      if (L.marker[i] === TMM.PLATE) {
        const pressed = (s.player.x === tx && s.player.y === ty) || !!crate;
        S().draw(r, "mech.plate", pressed ? "down" : "up", 0, px, py);
        if (!pressed) S().draw(r, "mech.link_symbol", sym(i), 0, px, py - 7);
      }
    }
    if (PB.matter) PB.matter.drawDevices(r, sc.devSpec, L, s, ox, oy, tick);
    drawPuzzleDevices(r, sc, P, ox, oy, tick, used);
    for (const i of L.doors) {
      const px = ox + (i % W) * 16 + 8, py = oy + ((i / W) | 0) * 16 + 16;
      S().draw(r, "mech.door", TM().doorClosed(L, s, i) ? "closed" : "open", 0, px, py);
      S().draw(r, "mech.link_symbol", sym(i), 0, px, py - 12);
    }
    // Float blocks: rune stones (dungeon) or lotus lanterns (diyu), one sprite per cell.
    const fart = sc.world && sc.world.id === "diyu" ? "mech.lantern_float" : "mech.rune_float";
    s.floats.forEach((f, n) => {
      const [fx, moving] = floatPx(P, n, f, tick);
      for (let k = 0; k < f.w; k++) {
        const part = f.w === 1 ? "mid" : k === 0 ? "left" : k === f.w - 1 ? "right" : "mid";
        if (art(fart)) S().draw(r, fart, moving ? part + "_move" : part, tick, ox + fx + k * 16 + 8, oy + f.y * 16 + 16);
        else placeholder(r, ox + fx + k * 16 + 8, oy + f.y * 16 + 16, 16, 16, "C", k === 0 ? "F" : "");
      }
    });
    s.crates.forEach((c, n) => {
      const [cx, cy] = cratePx(P, n, c, tick), px = ox + cx + 8, py = oy + cy + 16;
      const float = !!PB.matter && PB.matter.floating(L, s, c);
      S().draw(r, c.kind === "iron" ? "obj.crate_iron" : "obj.crate_wood", "default", 0, px, py + (float ? 3 : 0));
      if (float) S().draw(r, "fx.ripple", "float", tick, px, py + 2);
    });
    const figure = (sp) => {
      const kind = sp.monster ? "monster" : sp.feature, id = sp.monster || sp.feature;
      let dx = 0, flip = sp.dir === "left", anim;
      if (kind === "monster") { const [x, d] = patrolX(sp, tick); dx = x - sp.x * 16; flip = d < 0; anim = animOf("monster." + id, ["walk", "hop", "float", "idle"]); }
      if (kind === "recipient") anim = P.done ? "win" : undefined;
      if (!D1().drawEntity(r, ox + dx, oy, kind, id, sp.x, sp.y, { tick, flip, recipient: o.recipient, anim })) used.push(kind === "recipient" ? "recipient:" + (o.recipient || "?") : id);
    };
    const back = (sp) => sp.feature === "gate" || sp.feature === "keeper";
    v.spawns.filter(back).forEach(figure);
    for (const [x, y] of v.coins) if (!P.coins.has(x + "," + y) && !D1().drawEntity(r, ox, oy, "coin", "coin", x, y, { tick })) used.push("coin");
    drawFauna(r, sc, P, ox, oy, tick, plan);
    const [ppx, ppy] = playerPx(P, tick), shake = P.bump && tick - P.bump.t < 6 ? ((tick - P.bump.t) & 1 ? 1 : -1) * (P.bump.dir || 1) : 0;
    S().draw(r, "char.portitor", poseOf(P, tick), tick, ox + ppx + 8 + shake, oy + ppy + 16, P.facing < 0);
    v.spawns.filter((sp) => !back(sp)).forEach(figure);
    return [...new Set(used)];
  }
  function drawFauna(r, sc, P, ox, oy, tick, plan) {
    const fa = faunaOf(sc.world), p = P.s.player;
    if (fa.flyer && plan.flyCell && S().has(fa.flyer.asset)) {
      const ok = art(fa.flyer.asset);
      const bat = fa.flyer.asset.endsWith("_bat"), perch = flyerPerch(P, plan.flyCell, bat ? "bat" : "butterfly", sc.sky);
      const m = P.mem.fly;
      const key = plan.flyCell.join(",");
      if (m && m.cell !== key) { m.cell = key; m.since = tick; }
      // Flies over when the cell changes or the player comes near, circles the target, then settles.
      const circling = (plan.flyer && plan.near) || (m && tick - m.since < 90);
      let x = perch.x, y = perch.y, anim = perch.anim;
      if (circling) { const a = tick / 9; x = plan.flyCell[0] * 16 + 8 + Math.round(Math.cos(a) * 10); y = plan.flyCell[1] * 16 - 2 + Math.round(Math.sin(a) * 4); anim = "fly"; }
      if (ok) S().draw(r, fa.flyer.asset, anim, tick, ox + x, oy + y, circling ? Math.sin(tick / 9) > 0 : false);
      else placeholder(r, ox + x, oy + y + 5, 10, 10, "B", "");
      if (m) { m.x = x; m.y = y; }
    }
    if (fa.main && P.mem.main && S().has(fa.main.asset)) {
      const m = P.mem.main, cat = fa.main.asset.endsWith("_cat");
      let anim = "sit", flip = m.face < 0;
      if (m.moving) anim = "walk";
      else if (plan.near && plan.mainActive) {
        anim = cat ? ((tick % 120) < 40 ? "meow" : "sit") : "wag";
        flip = cat ? p.x * 16 + 8 < m.x : plan.h.target[0] * 16 + 8 < m.x;
      } else if (plan.h && plan.h.target) flip = plan.h.target[0] * 16 + 8 < m.x;
      if (art(fa.main.asset)) S().draw(r, fa.main.asset, anim, tick, ox + m.x, oy + m.y, flip);
      else placeholder(r, ox + m.x, oy + m.y, 14, 14, "k", "A");
      if (plan.near && plan.mainActive && !P.bubble && S().has("ui.emote")) S().draw(r, "ui.emote", "quest", tick, ox + m.x, oy + m.y - 11);
    }
  }
  // Hint marks: arrow at the place to stand, pointing the way; dig/pour targets.
  function drawHintMarks(r, P, ox, oy, tick, plan, always) {
    const h = plan.h;
    if (!h || !h.show || !(plan.near || always)) return;
    const dir = (h.show.dir || "").slice(-1), [ax, ay] = h.show.at || h.target, bob = tri(tick, 40, 1) + 1;
    const cx = ox + ax * 16, cy = oy + ay * 16;
    const off = { R: [12 + bob, 0], L: [-12 - bob, 0], U: [0, -14 - bob], D: [0, 12 + bob] }[dir];
    if (off) drawArrow(r, cx + off[0], cy + off[1], dir);
    const act = h.show.action;
    if ((act === "dig" || act === "pour" || act === "pole") && h.target && S().has("ui.target")) S().draw(r, "ui.target", act === "pour" ? "pour" : "dig", 0, ox + h.target[0] * 16 + 8, oy + h.target[1] * 16 + 16);
  }
  function drawOverlays(r, sc, P, ox, oy, tick, ov, full) {
    const v = sc.v, M = sc.M;
    if (ov.screens && full) {
      for (let sx = 1; sx < v.cols; sx++) for (let y = 0; y < sc.ph; y += 4) r.set(ox + sx * VW, oy + y, "w");
      for (let sy = 1; sy < v.rows; sy++) for (let x = 0; x < sc.pw; x += 4) r.set(ox + x, oy + sy * 160, "w");
    }
    if (ov.areas) for (const [x0, y0, x1, y1] of v.areas) dashRect(r, ox + x0 * 16, oy + y0 * 16, (x1 - x0 + 1) * 16, (y1 - y0 + 1) * 16, "s");
    if (ov.patrol) for (const sp of v.spawns.filter((q) => q.monster)) {
      const [z0, z1] = sp.zone || [sp.x, sp.x];
      for (let x = z0 * 16 + 2; x <= z1 * 16 + 14; x += 2) r.set(ox + x, oy + sp.y * 16 + 15, "A");
    }
    if (ov.marks) {
      if (M.from && M.from !== "gate") { const [x, y] = R2().entryCell(v.W, v.H, M.from); frameRect(r, ox + x * 16, oy + y * 16, 16, 16, "m"); }
      if (M.goal) for (const i of M.goal) frameRect(r, ox + (i % v.W) * 16 + 1, oy + ((i / v.W) | 0) * 16 + 1, 14, 14, "l");
    }
    if (ov.route && ov.route.length > 1) D1().drawRoute(r, ox, oy, ov.route);
  }
  function offscreenMarks(r, sc, P, cam, tick) {
    for (const sp of sc.v.spawns.filter((q) => q.monster)) {
      const [x, y] = monsterPx(sp, tick), cx = x + 8 - cam.x, cy = y + 8 - cam.y;
      if (cx >= 0 && cx < VW && cy >= 0 && cy < VH - HUD_H) continue;
      const ex = Math.max(3, Math.min(VW - 4, cx)), ey = HUD_H + Math.max(3, Math.min(VH - HUD_H - 4, cy));
      const dx = cx < 0 ? -1 : cx >= VW ? 1 : 0, dy = cy < 0 ? -1 : cy >= VH - HUD_H ? 1 : 0;
      for (let k = 0; k < 3; k++) for (let j = -k; j <= k; j++) {
        if (dx) r.set(ex - dx * (2 - k), ey + j, "A"); else r.set(ex + j, ey - dy * (2 - k), "A");
      }
    }
  }
  function drawHud(r, w, sc, P, o, plan) {
    r.rect(0, 0, w, HUD_H, "z"); r.hline(0, HUD_H - 1, w, "y");
    const T = PB.text;
    let rx = w - 4;
    const put = (str, c) => { rx -= T.measure(str); T.draw(r, str, rx, 3, c); rx -= 8; };
    if (P.done) put(tr("r2.hud.cleared", null, "通过"), "m");
    if (plan.n) put(tr("r2.hud.hint", { i: Math.min(plan.i + 1, plan.n), n: plan.n }, "提示 {i}/{n}"), plan.i >= plan.n ? "m" : "u");
    put(o.stepText || tr("r2.hud.moves", { n: P.s.moves }, "{n} 步"), "u");
    if (sc.v.coins.length) { put(String(P.coins.size) + "/" + sc.v.coins.length, "l"); rx -= 2; r.rect(rx + 1, 6, 7, 7, "z"); r.rect(rx + 2, 7, 5, 5, "k"); rx -= 6; }
    if (faunaOf(sc.world).main) {
      const snack = snackOf(sc.world);
      put(tr("r2.hud.snack", { n: P.snacks }, "×{n}"), "c"); rx += 6; rx -= 17;
      if (art(snack.asset)) S().draw(r, snack.asset, snack.anim, 0, rx, 2); else r.rect(rx + 2, 6, 10, 8, "c");
      rx -= 6;
    }
    const name = roomName(sc.v).split(" · ")[0];
    PB.ui.label(r, name, 4, 3, Math.max(24, rx - 8), "u", "y", "room2." + sc.v.id + ".name");
  }
  // A snack has its own small bubble beside the speaker, below the text bubble.
  // Clamp it to the same window so a hint by a room edge keeps its icon visible.
  function drawSnackBubble(r, world, ax, ay, top) {
    const right = ax < r.w - 32, x = Math.max(2, Math.min(r.w - 22, right ? ax + 10 : ax - 30));
    const y = Math.max(top, Math.min(r.h - 22, ay + 3)), snack = snackOf(world);
    r.rect(x, y, 20, 20, "z"); r.rect(x + 1, y + 1, 18, 18, "y");
    const tail = right ? x - 2 : x + 20;
    r.rect(tail, y + 3, 2, 4, "z"); r.set(right ? x - 1 : x + 20, y + 4, "y");
    if (art(snack.asset)) S().draw(r, snack.asset, snack.anim, 0, x + 2, y + 2);
    else placeholder(r, x + 10, y + 18, 16, 16, "c", "S");
  }
  // Speech bubble of the player, an animal or the recipient, inside a 320x180 window around the speaker.
  function drawBubble(r, sc, P, ox, oy, tick) {
    const b = P.bubble;
    if (!b || !b.text || !PB.dialogue) return;
    let at;
    if (b.who === "main" && P.mem.main) at = [P.mem.main.x, P.mem.main.y - 10];
    else if (b.who === "flyer" && P.mem.fly) at = [P.mem.fly.x, P.mem.fly.y - 4];
    else { const [px, py] = playerPx(P, tick); at = [px + 8, py + 2]; }
    const ax = ox + at[0], ay = oy + at[1];
    const bubble = (target, x, y, top) => {
      PB.dialogue.bubble(target, { text: b.text, at: [x, y], style: "say", maxW: 180, maxLines: 4, top });
      if (b.snack) drawSnackBubble(target, sc.world, x, y, top);
    };
    if (r.w === VW && r.h === VH) { bubble(r, ax, ay, HUD_H + 2); return; }
    const bx = Math.max(0, Math.min(r.w - VW, ax - (VW >> 1))), by = Math.max(0, Math.min(r.h - VH, ay - (VH >> 1)));
    const tmp = new PB.Raster(VW, VH);
    bubble(tmp, ax - bx, ay - by, by === 0 ? HUD_H + 2 : 2);
    r.blit(tmp, bx, by);
  }

  // Draws the room. r must be size(sc, o.view). Returns {placeholders, plan}.
  function draw(r, sc, P, o) {
    const tick = o.tick || 0, ov = o.overlays || {}, plan = update(P, tick);
    const full = o.view !== "camera";
    compose(sc, P.s, tick);
    let ox, oy, cam = null;
    if (full) { r.data.set(sc.fr.data); ox = 0; oy = HUD_H; }
    else {
      cam = P.cam;
      for (let y = 0; y < VH - HUD_H; y++) {
        const src = ((cam.y + HUD_H + y) * sc.pw + cam.x) * 4;
        r.data.set(sc.fr.data.subarray(src, src + VW * 4), (HUD_H + y) * VW * 4);
      }
      ox = -cam.x; oy = HUD_H - cam.y;
    }
    if (PB.env) PB.env.draw(r, sc.theme, "light", { tick, area: { x: ox, y: oy, w: sc.pw, h: sc.ph }, lights: [], level: "full" });
    // Ladder heads with a landing beside them keep only their lowest 4 px, as in
    // level mode (delivery-puzzle-rules.md 8.2): the same rule, judged on the opening map.
    const figures = () => drawFigures(r, sc, P, ox, oy, tick, o, plan), LT = PB.ladderTops;
    const placeholders = LT && LT.scope ? LT.scope(sc.M.spec, sc.L, P.s, ox, oy, figures) : figures();
    if (PB.env) PB.env.draw(r, sc.theme, "front", { tick, area: full ? { x: 0, y: HUD_H, w: sc.pw, h: sc.ph } : { x: 0, y: HUD_H, w: VW, h: VH - HUD_H }, lights: [], weather: undefined, level: "full" });
    drawHintMarks(r, P, ox, oy, tick, plan, !!ov.hints);
    drawOverlays(r, sc, P, ox, oy, tick, ov, full);
    if (cam) offscreenMarks(r, sc, P, cam, tick);
    drawBubble(r, sc, P, ox, oy, tick);
    drawHud(r, r.w, sc, P, o, plan);
    return { placeholders, plan };
  }

  PB.droom2 = { setArtFilter, scene, skyCells, size, run, act, undo, setState, busy, update, feed, draw, hintPlan, faunaOf, roomName, hintText, playerPx, poseOf, monsterPx, HUD_H, VW, VH };
})(typeof window !== "undefined" ? window : globalThis);
