/* Delivery-mode room pictures (docs/design/delivery-maps.md §5): a room
 * placement drawn in its region's theme, plus its entities (coins, monsters,
 * gate, recipient, station keeper), and a small tile overview for the map
 * preview. Terrain, life and light reuse the approved level renderer
 * (scene.js) unchanged. Entities that have no art yet are drawn as clearly
 * marked placeholders: a letter in a box, never mistaken for final art.
 * Shared by the workbench (browser, classic script) and the Node tools. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const S = () => PB.sprites;
  const W = 320, H = 180, HUD_H = 20;

  // Region theme for delivery rooms: the approved theme with the ambient life
  // that looks like a local monster switched off (worlds.json ambient_exclude).
  // Registered at runtime under "<theme>~delivery"; nothing is written to art/.
  function themeId(world) {
    const base = (world && world.theme) || "theme.dungeon", id = base + "~delivery";
    if (!S().has(id) && S().has(base)) {
      const a = S().get(base), drop = new Set((world && world.ambient_exclude) || []);
      S().register(Object.assign({}, a, { id, params: Object.assign({}, a.params, { ambient: (a.params.ambient || []).filter((x) => !drop.has(x.id)) }) }));
    }
    return S().has(id) ? id : base;
  }

  // Lab level spec of a placement for the level renderer, with the player at [x, y].
  function roomSpec(v, player) {
    const rows = v.rows.map((r) => [...r]);
    const [px, py] = player;
    rows[py][px] = rows[py][px] === "H" ? "h" : "P";
    return { format: "pushbox.levelspec/1", id: v.id + (v.mirror ? "~m" : ""), chapter: v.world || "dungeon", map: rows.map((r) => r.join("")), bag: { sand: 0, bomb: 0 }, links: v.links };
  }
  // Where to show the player when nothing else says so: the gate, or the first open exit.
  function defaultPlayer(v) {
    const gate = v.spawns.find((s) => s.feature === "gate");
    if (gate) return [gate.x, gate.y];
    for (const e of PB.rooms.EDGES) if (v.exits[e]) return PB.rooms.innerEntry(e, v.exits[e]);
    return [1, 7];
  }

  // Sprite id each entity uses once its art exists; until then a placeholder.
  // The workbench can restrict drawing to approved art (setArtFilter); the
  // step-4 candidates are then shown as placeholders again.
  const ART = { coin: "item.coin", gate: "mech.ferry_gate", keeper: "char.turtle_keeper" };
  let artFilter = () => true;
  function setArtFilter(fn) { artFilter = fn || (() => true); }
  const usable = (id) => !!id && S().has(id) && artFilter(id);
  const MONSTER_ART = (id) => "monster." + id;
  const RECIPIENT_ART = { old_miner: "char.miner" };
  const PLACEHOLDER = { monster: ["A", "t"], gate: ["C", "t"], recipient: ["m", "z"], keeper: ["j", "z"], coin: ["l", "z"] };
  const LETTER = { rat_swarm: "R", skeleton_guard: "S", gate: "G", recipient: "D", keeper: "K", coin: "$" };

  function placeholder(r, kind, id, cx, by) {
    const [fill, ink] = PLACEHOLDER[kind] || ["v", "z"];
    if (kind === "coin") { r.rect(cx - 3, by - 9, 6, 6, "z"); r.rect(cx - 2, by - 8, 4, 4, fill); return; }
    const x = cx - 7, y = by - 14;
    r.rect(x, y, 14, 14, "z"); r.rect(x + 1, y + 1, 12, 12, fill);
    // Diagonal hatch on the corner marks it as a placeholder.
    r.set(x + 1, y + 1, "z"); r.set(x + 2, y + 1, "z"); r.set(x + 1, y + 2, "z");
    const ch = LETTER[id] || LETTER[kind] || "?";
    PB.text.draw(r, ch, cx - (PB.text.measure(ch) >> 1), y, ink);
  }
  function artFor(kind, id, recipient) {
    if (kind === "coin") return ART.coin;
    if (kind === "monster") return MONSTER_ART(id);
    if (kind === "recipient") return RECIPIENT_ART[recipient] || "char." + recipient;
    return ART[kind];
  }
  // Draws one entity standing on tile (tx, ty); returns true if final art was used.
  function drawEntity(r, ox, oy, kind, id, tx, ty, o) {
    const cx = ox + tx * 16 + 8, by = oy + ty * 16 + 16;
    const sid = artFor(kind, id, o && o.recipient);
    if (usable(sid)) {
      const a = S().get(sid), anim = (o && o.anim) || (a.animations && (a.animations.idle ? "idle" : Object.keys(a.animations)[0]));
      S().draw(r, sid, anim, (o && o.tick) || 0, cx, by, !!(o && o.flip));
      return true;
    }
    placeholder(r, kind, id, cx, by);
    return false;
  }

  // v: a placement (PB.rooms.variant). opts: {world, tick, player, facing,
  // recipient, route: [[x, y], ...], hud: false, env}.
  function render(r, v, opts) {
    const o = opts || {};
    const pl = o.player || defaultPlayer(v), spec = roomSpec(v, pl);
    // The level renderer draws the room without the player; background figures
    // (gate, keeper) go behind the player, pickups and bodies in front of them.
    const parsed = PB.tilemodel.parse(spec);
    parsed.state.player = { x: -20, y: -20 };
    const at = PB.scene.renderLevel(r, spec, parsed, { theme: themeId(o.world), tick: o.tick || 0, hud: false, env: o.env, pose: "idle" });
    const ox = at.ox, oy = at.oy;
    const used = { placeholders: [] };
    const figure = (s) => {
      const kind = s.monster ? "monster" : s.feature, id = s.monster || s.feature;
      if (!drawEntity(r, ox, oy, kind, id, s.x, s.y, Object.assign({}, o, { flip: s.dir === "left" }))) used.placeholders.push(kind === "recipient" ? "recipient:" + (o.recipient || "?") : id);
    };
    const back = (s) => s.feature === "gate" || s.feature === "keeper";
    v.spawns.filter(back).forEach(figure);
    S().draw(r, "char.portitor", "idle", o.tick || 0, ox + pl[0] * 16 + 8, oy + pl[1] * 16 + 16, o.facing === "left");
    for (const [x, y] of v.coins) if (!drawEntity(r, ox, oy, "coin", "coin", x, y, o)) used.placeholders.push("coin");
    v.spawns.filter((s) => !back(s)).forEach(figure);
    if (o.route) drawRoute(r, ox, oy, o.route);
    if (o.hud !== false) { r.rect(0, 0, W, HUD_H, "z"); r.hline(0, HUD_H - 1, W, "y"); }
    used.placeholders = [...new Set(used.placeholders)];
    return Object.assign({ ox, oy }, used);
  }

  // Dotted line through tile centres (a route from the check report).
  function drawRoute(r, ox, oy, cells) {
    for (let i = 1; i < cells.length; i++) {
      const [x0, y0] = cells[i - 1], [x1, y1] = cells[i];
      const ax = ox + x0 * 16 + 8, ay = oy + y0 * 16 + 9, bx = ox + x1 * 16 + 8, by = oy + y1 * 16 + 9;
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) || 1;
      for (let k = 0; k <= n; k += 3) r.set(Math.round(ax + ((bx - ax) * k) / n), Math.round(ay + ((by - ay) * k) / n), "l");
    }
    const [lx, ly] = cells[cells.length - 1];
    r.rect(ox + lx * 16 + 6, oy + ly * 16 + 7, 4, 4, "l");
  }
  // Player positions along an action list, replayed in the tile model.
  function routeCells(spec, actions) {
    const res = PB.tilemodel.replay(spec, actions || []);
    return res.steps.map((s) => [s.state.player.x, s.state.player.y]);
  }

  // Tile overview of a placement: s pixels per tile.
  const MINI = { "#": "x", e: "e", s: "c", ".": "y", H: "f", B: "b", I: "v", _: "s", "|": "u" };
  function mini(r, v, x0, y0, s) {
    v.rows.forEach((row, ty) => [...row].forEach((ch, tx) => r.rect(x0 + tx * s, y0 + ty * s, s, s, MINI[ch] || "y")));
    const dot = (tx, ty, c) => r.rect(x0 + tx * s + (s >> 2), y0 + ty * s + (s >> 2), Math.max(1, s >> 1), Math.max(1, s >> 1), c);
    for (const [x, y] of v.coins) dot(x, y, "l");
    for (const sp of v.spawns) r.rect(x0 + sp.x * s, y0 + sp.y * s, s, s, sp.monster ? "A" : sp.feature === "gate" ? "C" : sp.feature === "recipient" ? "m" : "j");
  }

  // ---------- live rooms (realtime.js) ----------
  // Monster placeholder colour by state: walk, chase, flee, stunned, trapped.
  const STATE_FILL = { walk: "A", chase: "i", flee: "C", stunned: "v", trapped: "l" };
  // Pixel position of a body that moved at tick a.t from a.from (tween over len ticks).
  function tween(b, tick, len) {
    if (!b.anim || !len) return [b.x * 16, b.y * 16];
    const k = Math.max(0, Math.min(len, tick - b.anim.t));
    return [Math.round((b.anim.from.x * 16 * (len - k) + b.x * 16 * k) / len), Math.round((b.anim.from.y * 16 * (len - k) + b.y * 16 * k) / len)];
  }
  const POSE = { walk: "walk", step: "walk", push: "push", climb: "climb", dig: "dig", pour: "pour", interact: "idle", use: "idle" };

  // Draws the run's current room. opts: {world, tick (display), hud: true, minimap: true}.
  function renderLive(r, run, opts) {
    const o = opts || {}, rm = run.room, p = rm.player, P = run.P, T = PB.tilemodel;
    const state = { level: rm.L, state: { terrain: rm.terrain, crates: rm.crates.map((c) => ({ x: c.x, y: c.y, kind: c.kind })), player: { x: -20, y: -20 },
      bag: { sand: run.sand, bomb: 0 }, open: rm.doors, dev: [], held: [], warped: [], moves: 0 } };
    const spec = roomSpec(rm.v, defaultPlayer(rm.v));
    const at = PB.scene.renderLevel(r, spec, state, { theme: themeId(o.world), tick: o.tick || run.tick, hud: false, env: o.env });
    const ox = at.ox, oy = at.oy, tick = run.tick;
    // Ladders put down with a rope ladder.
    const rope = usable("mech.rope_ladder") ? "mech.rope_ladder" : "mech.ladder";
    for (const i of rm.climb) if (rm.L.marker[i] !== T.M.LADDER) S().draw(r, rope, "default", 0, ox + (i % rm.W) * 16 + 8, oy + ((i / rm.W) | 0) * 16 + 16);
    // Background figures, then pickups, then bodies.
    if (rm.gate) drawEntity(r, ox, oy, "gate", "gate", rm.gate.x, rm.gate.y, { tick });
    if (rm.keeper) drawEntity(r, ox, oy, "keeper", "keeper", rm.keeper.x, rm.keeper.y, { tick });
    for (const q of rm.pickups) {
      if (q.kind === "sand") S().draw(r, "item.sandbag", 0, 0, ox + q.x * 16, oy + q.y * 16);
      else drawEntity(r, ox, oy, "coin", "coin", q.x, q.y, { tick });
    }
    if (rm.recipient) drawEntity(r, ox, oy, "recipient", "recipient", rm.recipient.x, rm.recipient.y, { tick, recipient: rm.recipient.id, flip: rm.recipient.dir < 0, anim: run.done && run.done.ok ? "win" : rm.recipient.move === "wander" ? "walk" : undefined });
    for (const m of rm.monsters) {
      if (m.ko) {
        // A puff of smoke where it went down, for a third of a second.
        if (usable("fx.monster_poof") && m.koT != null && tick - m.koT < 20) S().draw(r, "fx.monster_poof", "default", tick - m.koT, ox + m.x * 16 + 8, oy + m.y * 16 + 16);
        continue;
      }
      const [px, py] = tween(m, tick, 6), fall = m.fallT ? Math.round((m.fallT * 16) / P.fall) : 0;
      const sid = "monster." + m.id;
      if (usable(sid)) { const anims = S().get(sid).animations; S().draw(r, sid, anims[m.state] ? m.state : "walk", tick, ox + px + 8, oy + py + 16 + fall, m.dir < 0); }
      else {
        const cx = ox + px + 8, by = oy + py + 16 + fall;
        placeholder(r, "monster", m.id, cx, by);
        r.rect(cx - 6, by - 13, 12, 2, STATE_FILL[m.state] || "A");
        if (m.state === "trapped") PB.text.draw(r, "!", cx + 6, by - 24, "l", "z");
        if (m.state === "stunned") PB.text.draw(r, "*", cx + 6, by - 24, "u", "z");
      }
    }
    if (p) {
      const [px, py] = tween(p, tick, P.moveAnim);
      const air = !PB.rt.pred.ladder(rm, p.x, p.y) && !PB.rt.pred.holdsPlayer(rm, p.x, p.y + 1);
      const fall = air ? Math.round((p.fallT * 16) / P.fall) : 0;
      const busy = p.anim && tick - p.anim.t < (P.act[p.pose] || P.act.walk);
      const pose = run.done && run.done.ok ? "win" : air ? "fall" : busy ? POSE[p.pose] || "idle" : "idle";
      if (!(run.iframes > 0 && ((run.iframes >> 2) & 1))) S().draw(r, "char.portitor", pose, tick, ox + px + 8, oy + py + 16 + fall, p.face < 0);
    }
    if (o.hud !== false) {
      const h = hudState(run, o);
      if (PB.dui && hudArt(h).every(usable)) PB.dui.hud(r, h); else drawRunHud(r, run, o);
    }
    return { ox, oy };
  }
  // The run as the HUD shows it (ui-delivery.js).
  const RULE = { vase: "fragile", ice_cream: "melt" };
  function hudState(run, o) {
    const c = run.ctx.cargo, map = run.map && o.minimap !== false ? run.map : null;
    return { hearts: run.hearts, maxHearts: run.maxHearts, cargo: c ? c.id : null, left: PB.rt.integrity(run), max: run.P.integrity, rule: c ? RULE[c.id] || null : null,
      hot: !!(run.room && run.room.hot && c && (c.params || {}).melt_secs_per_point), coins: run.coins, sand: run.sand, items: run.items.slice(), slots: run.P.slots,
      secs: Math.floor(run.clock / run.P.hz),
      minimap: map ? { cols: map.cols, rows: map.rows, cur: run.roomIndex, rooms: map.rooms.map((rm) => ({ index: rm.index, x: rm.x, y: rm.y, role: rm.role, seen: !!(run.visited && run.visited.has(rm.index)) })) } : null };
  }
  function hudArt(h) { return ["ui.delivery_icons", "item.coin", "item.sandbag", "item.first_aid", "item.rope_ladder"].concat(h.cargo ? ["cargo." + h.cargo] : []); }

  // Placeholder HUD (the approved-art HUD comes with the step-4 candidates):
  // hearts, cargo and its integrity, coins, sand, item slots, time, minimap.
  const HEART = [".zz.zz.", "ziizhiz", "ziiiiiz", ".ziiiz.", "..ziz..", "...z..."];
  function heart(r, x, y, full) { HEART.forEach((row, yy) => [...row].forEach((c, xx) => { if (c === ".") return; r.set(x + xx, y + yy, full ? c : c === "z" ? "z" : "x"); })); }
  function drawRunHud(r, run, o) {
    r.rect(0, 0, W, HUD_H, "z"); r.hline(0, HUD_H - 1, W, "y");
    let x = 4;
    for (let i = 0; i < run.maxHearts; i++) { heart(r, x, 7, i < run.hearts); x += 8; }
    x += 4;
    const cargo = run.ctx.cargo, left = PB.rt.integrity(run);
    if (cargo) {
      const ch = { letter: "L", vase: "V", ice_cream: "I" }[cargo.id] || "?";
      r.rect(x, 3, 13, 13, "z"); r.rect(x + 1, 4, 11, 11, "c"); PB.text.draw(r, ch, x + 3, 2, "g"); x += 15;
      for (let i = 0; i < run.P.integrity; i++) { r.rect(x, 7, 3, 6, i < left ? "m" : "x"); x += 4; }
      if (run.room && run.room.hot && (cargo.params || {}).melt_secs_per_point) { r.rect(x + 1, 6, 4, 8, "j"); x += 6; }
    }
    x += 6;
    r.rect(x, 6, 7, 7, "z"); r.rect(x + 1, 7, 5, 5, "k"); x += 9;
    x += PB.text.draw(r, String(run.coins), x, 3, "l") + 6;
    S().draw(r, "item.sandbag", 0, 0, x - 2, 1); x += 13;
    x += PB.text.draw(r, String(run.sand), x, 3, "c") + 6;
    for (let i = 0; i < run.P.slots; i++) {
      r.rect(x, 4, 12, 12, "y"); r.rect(x + 1, 5, 10, 10, "z");
      const it = run.items[i];
      if (it) PB.text.draw(r, { first_aid: "+", rope_ladder: "H" }[it] || "?", x + 3, 2, it === "first_aid" ? "i" : "d");
      x += 14;
    }
    const secs = Math.floor(run.clock / run.P.hz), clock = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
    let rx = W - 4;
    if (run.map && o.minimap !== false) {
      const cw = 6, chh = 4, mw = run.map.cols * (cw + 1), mh = run.map.rows * (chh + 1);
      rx -= mw;
      for (const room of run.map.rooms) {
        const seen = run.visited && run.visited.has(room.index), cur = room.index === run.roomIndex;
        if (!seen && !cur && room.role !== "home") continue;
        r.rect(rx + room.x * (cw + 1), 2 + room.y * (chh + 1), cw, chh, cur ? "l" : room.role === "home" ? "m" : room.role === "station" ? "j" : "w");
      }
      rx -= 6;
      void mh;
    }
    rx -= PB.text.measure(clock);
    PB.text.draw(r, clock, rx, 3, "u");
  }

  PB.droom = { themeId, roomSpec, defaultPlayer, render, renderLive, drawRunHud, hudState, drawEntity, drawRoute, routeCells, mini, placeholder, setArtFilter, W, H, HUD_H };
})(typeof window !== "undefined" ? window : globalThis);
