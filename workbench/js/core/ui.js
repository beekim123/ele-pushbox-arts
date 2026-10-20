/* Game UI screens at 320x180, written for any language:
 * - every string comes from content/i18n via PB.i18n.t (no literals here);
 * - containers size themselves from measured text, within min / max bounds;
 * - text that still does not fit is wrapped or ellipsized and reported, so the
 *   workbench can outline it and tests can fail on it;
 * - cards and rows carry icons, emblems and numbers instead of words.
 * These are layout references; Godot builds them with Control containers. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const S = () => PB.sprites, TX = () => PB.text, I = () => PB.i18n;
  const W = 320, H = 180, LINE = 13;
  const T = (k, v) => I().t(k, v);

  // ---------- primitives ----------
  function text2x(r, str, x, y, color, shadow) {
    const tmp = new PB.Raster(PB.text.measure(str) + 2, 16);
    PB.text.draw(tmp, str, 0, 0, color);
    for (let yy = 0; yy < tmp.h; yy++) for (let xx = 0; xx < tmp.w; xx++) {
      const c = tmp.get(xx, yy); if (c === ".") continue;
      if (shadow) r.rect(x + xx * 2 + 1, y + yy * 2 + 2, 2, 2, shadow);
      r.rect(x + xx * 2, y + yy * 2, 2, 2, c);
    }
    return tmp.w * 2;
  }
  function panel(r, x, y, w, h, frame) { S().ninepatch(r, "ui.panel", frame, x, y, w, h); }
  function sprite(r, id, name, x, y) { const a = S().get(id); S().draw(r, id, a.animations[name].frames[0], 0, x, y); }
  function key(r, name, x, y) { sprite(r, "ui.keycap", name, x, y); return 13; }
  function wideKey(r, label, x, y) {
    const w = TX().measure(label) + 8;
    r.rect(x + 1, y, w - 2, 13, "z"); r.rect(x, y + 1, w, 11, "z");
    r.rect(x + 1, y + 1, w - 2, 10, "u"); r.hline(x + 1, y + 11, w - 2, "v");
    TX().draw(r, label, x + 4, y - 1, "y");
    return w;
  }
  // One line, never wider than maxW (ellipsized and reported otherwise).
  function label(r, str, x, y, maxW, color, shadow, id) {
    const e = I().ellipsize(str, maxW);
    if (e.cut) I().report("ellipsis", id || str, { x, y, w: maxW, h: LINE });
    TX().draw(r, e.text, x, y, color, shadow);
    return TX().measure(e.text);
  }
  function centered(r, str, cx, y, maxW, color, shadow, id) {
    const e = I().ellipsize(str, maxW);
    if (e.cut) I().report("ellipsis", id || str, { x: cx - (maxW >> 1), y, w: maxW, h: LINE });
    TX().draw(r, e.text, cx - (TX().measure(e.text) >> 1), y, color, shadow);
  }
  // Wrapped paragraph, at most maxLines (last line ellipsized and reported if longer).
  function para(r, str, x, y, w, maxLines, color, id) {
    let lines = I().wrap(str, w);
    if (lines.length > maxLines) {
      I().report("clip", id || str, { x, y, w, h: maxLines * LINE });
      const rest = lines.slice(maxLines - 1).join(" ");
      lines = lines.slice(0, maxLines - 1).concat([I().ellipsize(rest, w).text]);
    }
    lines.forEach((l, i) => TX().draw(r, l, x, y + i * LINE, color));
    return lines.length;
  }
  // Key hint bar: [keys] label ... ; labels are dropped (keys kept) when out of room.
  function keyBar(r, groups, x, y, maxX) {
    const widthOf = (g) => g.keys.reduce((s, k) => s + (k.wide ? TX().measure(k.wide) + 8 : 13) + 1, 0) + 3 + TX().measure(T(g.label)) + 10;
    const full = groups.reduce((s, g) => s + widthOf(g), 0) <= maxX - x;
    if (!full) I().report("dropped", "keybar", { x, y, w: maxX - x, h: 13 });
    for (const g of groups) {
      for (const k of g.keys) x += (k.wide ? wideKey(r, k.wide, x, y) : key(r, k, x, y)) + 1;
      if (full) x += 3 + TX().draw(r, T(g.label), x, y - 1, "v");
      x += 10;
    }
  }
  function menuWidth(labels, extra, minW, maxW) {
    return Math.max(minW, Math.min(maxW, Math.max(...labels.map((s) => TX().measure(s))) + extra));
  }
  function dim(r) { r.remap(0, 0, W, H, PB.DIM); r.remap(0, 0, W, H, PB.DIM); }
  function themeId(st, p) { return (st && st.theme) || (p && p.theme) || "theme.dungeon"; }
  function chapterLabel(n) { return n <= 5 ? T("chapter.n", { n }) : T("chapter.extra"); }
  function themeName(id) { return T("theme." + id.slice(6)); }

  // Themed backdrop: background, a floor (plus optional extra solid tiles), ambient life.
  let envLevel = "full";
  function backdrop(r, theme, tick, extraSolid, occupied) {
    const Tm = S().get(theme).params, M = PB.terrain.MAT, oy = 12;
    const map = { w: 21, h: 11, at: (x, y) => (x < 0 || x >= 21 || y < 0 ? M.EMPTY : y >= 9 ? M.ROCK : extraSolid && extraSolid(x, y) ? M.ROCK : M.EMPTY) };
    PB.terrain.drawBackground(r, Tm, 0, 0, W, H, tick);
    const area = { x: 0, y: 0, w: W, h: 150 }, lights = [], amb = { mode: "one", seed: PB.ambient.seedOf(theme), out: lights };
    const envCtx = { tick, area: { x: 0, y: 20, w: W, h: 136 }, lights, level: envLevel };
    for (const layer of ["back", "front"]) PB.ambient.draw(r, Tm, map, 0, oy, tick, layer, occupied, area, null, Object.assign({}, amb, { dry: true }));
    PB.env.draw(r, Tm, "back", envCtx);
    amb.out = null;
    PB.ambient.draw(r, Tm, map, 0, oy, tick, "back", occupied, area, null, amb);
    PB.terrain.drawTerrain(r, map, Tm, 0, oy, tick >> 3);
    PB.ambient.draw(r, Tm, map, 0, oy, tick, "front", occupied, area, null, amb);
    PB.env.draw(r, Tm, "light", envCtx);
    PB.env.draw(r, Tm, "front", envCtx);
    return Tm;
  }
  function bottomBar(r) { r.rect(0, H - 19, W, 19, "z"); r.hline(0, H - 19, W, "y"); }

  // ---------- screens ----------
  function lobby(r, tick, p, st) {
    const th = themeId(st, p);
    const ledge = (x, y) => (x === 18 || x === 19) && (y === 7 || y === 8);
    const busy = (x, y) => (y === 8 && x >= 12 && x <= 15) || (y === 7 && x === 15) || (y === 6 && (x === 18 || x === 19));
    const Tm = backdrop(r, th, tick, ledge, busy);
    S().draw(r, "obj.crate_wood", "default", 0, 14 * 16 + 8, 156);
    S().draw(r, "obj.crate_wood", "default", 0, 15 * 16 + 8, 156);
    S().draw(r, "obj.crate_wood", "default", 0, 15 * 16 + 8, 140);
    S().draw(r, "char.portitor", "push", tick, 13 * 16 + 8, 156);
    S().draw(r, "mech.exit_flag", "idle", tick, 18 * 16 + 12, 124);
    // Logo: crate emblem + title (2x when it fits in 200 px, else 1x) + tagline.
    S().draw(r, "obj.crate_wood", "default", 0, 24, 30);
    const title = T("game.title");
    if (TX().measure(title) * 2 <= 200) text2x(r, title, 38, 6, "l", "z");
    else label(r, title, 38, 12, 200, "l", "z", "game.title");
    para(r, T("game.tagline"), 16, 36, 200, 2, "c", "game.tagline");
    label(r, T("lobby.current", { chapter: chapterLabel(Tm.chapter), theme: themeName(th) }), 16, 64, 200, "k", "z", "lobby.current");
    // Menu sized to the longest label.
    const items = p.items.map((it) => Object.assign({}, it, { text: T(it.key) }));
    const w = menuWidth(items.map((i) => i.text + (i.detail ? "  " + i.detail : "")), 34, 96, 180);
    const sel = st.focus | 0, x = 14, y0 = 82, h = 8 + items.length * 16;
    panel(r, x, y0, w, h, 0);
    items.forEach((it, i) => {
      const y = y0 + 4 + i * 16;
      if (i === sel) panel(r, x + 3, y - 1, w - 6, 16, 1);
      sprite(r, "ui.menu_icons", it.icon, x + 7, y + 1);
      const detailW = it.detail ? TX().measure(it.detail) + 6 : 0;
      label(r, it.text, x + 22, y, w - 30 - detailW, i === sel ? "l" : "u", null, it.key);
      if (it.detail) TX().draw(r, it.detail, x + w - 8 - TX().measure(it.detail), y, "v");
    });
    bottomBar(r);
    keyBar(r, [{ keys: ["up", "down"], label: "keys.select" }, { keys: [{ wide: "Enter" }], label: "keys.confirm" }], 8, H - 16, W - 8);
  }

  // Chapter select: a carousel. The focused map is a large card in the middle,
  // neighbours shrink and darken towards the edges, a page indicator and arrows
  // sit below. Works for any number of maps (no wrap-around; the ends stay empty).
  const SLOT = [
    { dx: 0, w: 116, h: 96, dim: 0 },
    { dx: 94, w: 64, h: 74, dim: 1 },
    { dx: 140, w: 40, h: 54, dim: 2 },
  ];
  function slotAt(d) {
    const a = Math.min(2, Math.abs(d)), i = Math.floor(a), f = a - i, A = SLOT[i], B = SLOT[Math.min(2, i + 1)];
    const lerp = (u, v) => Math.round(u + (v - u) * f);
    return { cx: 160 + Math.sign(d) * lerp(A.dx, B.dx), w: lerp(A.w, B.w), h: lerp(A.h, B.h), center: a < 0.5, dim: a < 1.5 ? 0 : 1 };
  }
  function focusOf(st, n) {
    if (!st.animate) return st.focus | 0;
    // Workbench demo: hold, then slide to the next map; bounce at the ends.
    const period = 240, k = Math.floor(st.tick / period), t = st.tick % period, steps = Math.max(1, 2 * (n - 1));
    const idx = (j) => { const m = j % steps; return m < n ? m : steps - m; };
    const a = idx(k), b = idx(k + 1);
    if (t < 180) return a;
    const u = (t - 180) / 60, e = u * u * (3 - 2 * u);
    return a + (b - a) * e;
  }
  function mapThumb(ch, w, h, tick, withHero) {
    const tmp = new PB.Raster(w, h), Tm = S().get(ch.theme).params, M = PB.terrain.MAT;
    const cols = Math.ceil(w / 16) + 1, floorRow = Math.floor((h - 12) / 16), oy = h - 12 - floorRow * 16;
    const map = { w: cols, h: floorRow + 2, at: (tx, ty) => (tx >= 0 && tx < cols && ty >= floorRow ? M.ROCK : M.EMPTY) };
    const busy = withHero ? (tx, ty) => ty === floorRow - 1 && (tx === 1 || tx === 2) : null;
    const area = { x: 0, y: 0, w, h: h - 14 };
    const amb = { mode: "one", seed: PB.ambient.seedOf(ch.theme) };
    PB.terrain.drawBackground(tmp, Tm, 0, 0, w, h, tick);
    PB.ambient.draw(tmp, Tm, map, 0, oy, tick, "back", busy, area, null, amb);
    PB.terrain.drawTerrain(tmp, map, Tm, 0, oy, tick >> 3);
    PB.ambient.draw(tmp, Tm, map, 0, oy, tick, "front", busy, area, null, amb);
    if (withHero) { S().draw(tmp, "char.portitor", "idle", tick, 24, oy + floorRow * 16); S().draw(tmp, "obj.crate_wood", "default", 0, 40, oy + floorRow * 16); }
    return tmp;
  }

  function chapters(r, tick, p, st) {
    const n = p.chapters.length, focus = focusOf(Object.assign({ tick }, st), n), sel = Math.round(focus), cur = p.chapters[sel];
    backdrop(r, cur.theme, tick);
    dim(r);
    label(r, T("chapters.title"), 10, 4, 200, "l", "z", "chapters.title");
    const cy = 66;
    const order = p.chapters.map((ch, i) => ({ ch, i, d: i - focus })).filter((o) => Math.abs(o.d) <= 2.4).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    for (const { ch, i, d } of order) {
      const g = slotAt(d), x = g.cx - (g.w >> 1), y = cy - (g.h >> 1), Tm = S().get(ch.theme).params, center = g.center;
      const card = new PB.Raster(g.w, g.h);
      S().ninepatch(card, "ui.panel", center ? 1 : 0, 0, 0, g.w, g.h);
      const inner = { x: 4, y: 4, w: g.w - 8, h: g.h - (center ? 28 : 18) };
      card.blit(mapThumb(ch, inner.w, inner.h, tick + i * 97, center), inner.x, inner.y);
      card.rect(inner.x - 1, inner.y - 1, inner.w + 2, 1, "z"); card.rect(inner.x - 1, inner.y + inner.h, inner.w + 2, 1, "z");
      const num = Tm.chapter <= 5 ? String(Tm.chapter) : "+";
      if (center) {
        S().draw(card, "ui.theme_emblem", S().get("ui.theme_emblem").animations[ch.theme.slice(6)].frames[0], 0, inner.x + 3, inner.y + 3);
        text2x(card, num, 8, g.h - 25, ch.locked ? "w" : "l", "z");
        if (ch.locked) S().draw(card, "ui.icons", S().get("ui.icons").animations.lock.frames[0], 0, g.w - 20, g.h - 20);
        else { const pr = T("progress", { a: ch.done, b: ch.total }); TX().draw(card, pr, g.w - 8 - TX().measure(pr), g.h - 21, "k"); }
      } else {
        if (ch.locked) S().draw(card, "ui.icons", S().get("ui.icons").animations.lock.frames[0], 0, (g.w >> 1) - 6, g.h - 15);
        else TX().draw(card, num, (g.w >> 1) - (TX().measure(num) >> 1), g.h - 16, "u");
      }
      if (ch.locked && center) card.remap(inner.x, inner.y, inner.w, inner.h, PB.DIM);
      for (let k = 0; k < g.dim; k++) card.remap(0, 0, g.w, g.h, PB.DIM);
      r.blit(card, x, y);
    }
    // Name of the focused map under the big card.
    const Tc = S().get(cur.theme).params;
    centered(r, chapterLabel(Tc.chapter) + " · " + themeName(cur.theme), 160, cy + 50, 300, "l", "z", "chapter.name");
    // Page indicator with arrows: one mark per map, the current one is a long bar.
    const iy = cy + 68;
    if (n <= 16) {
      const widths = p.chapters.map((c, i) => (i === sel ? 14 : 6)), total = widths.reduce((a, b) => a + b, 0) + (n - 1) * 4;
      let x = 160 - (total >> 1);
      p.chapters.forEach((c, i) => {
        if (i === sel) r.rect(x, iy + 2, widths[i], 3, "l");
        else { r.rect(x, iy + 2, 6, 3, "z"); r.rect(x + 1, iy + 3, 4, 1, c.locked ? "x" : "v"); }
        x += widths[i] + 4;
      });
      key(r, "left", 160 - (total >> 1) - 20, iy - 3); key(r, "right", 160 + (total >> 1) + 7, iy - 3);
    } else {
      const s = T("progress", { a: sel + 1, b: n }); TX().draw(r, s, 160 - (TX().measure(s) >> 1), iy - 2, "u");
      key(r, "left", 130, iy - 3); key(r, "right", 177, iy - 3);
    }
    const body = !cur.locked ? T(`chapter.${Tc.chapter}.blurb`) : Tc.chapter <= 5 ? T("chapters.unlock", { chapter: chapterLabel(Tc.chapter - 1), n: cur.need }) : T("chapters.later");
    panel(r, 6, 148, W - 12, 30, 0);
    para(r, body, 12, 149, W - 24, 2, cur.locked ? "v" : "u", "chapter.blurb");
  }

  function levelText(id, field, fallback) { const k = `level.${id}.${field}`; return I().has(k) ? T(k) : fallback; }

  function levels(r, tick, p, st) {
    const th = themeId(st, p), Tm = backdrop(r, th, tick);
    dim(r);
    const cleared = T("levels.cleared", { a: p.done, b: p.levels.length });
    const cw = TX().measure(cleared);
    label(r, T("levels.title", { chapter: chapterLabel(Tm.chapter), theme: themeName(th) }), 10, 4, W - 30 - cw, "l", "z", "levels.title");
    TX().draw(r, cleared, W - 10 - cw, 4, "k", "z");
    const sel = st.focus | 0, listW = 176;
    p.levels.forEach((lv, i) => {
      const x = 8, y = 22 + i * 17, w = listW;
      panel(r, x, y, w, 15, i === sel ? 1 : 0);
      TX().draw(r, lv.id, x + 6, y, i === sel ? "l" : "k");
      const right = lv.state === "cleared" || lv.state === "skipped" || lv.next ? 16 : 0;
      label(r, levelText(lv.id, "title", lv.id), x + 34, y, w - 40 - right, i === sel ? "l" : "u", null, `level.${lv.id}.title`);
      if (lv.state === "cleared") sprite(r, "ui.icons", "check", x + w - 15, y + 1);
      else if (lv.state === "skipped") sprite(r, "ui.icons", "skip", x + w - 15, y + 1);
      else if (lv.next) sprite(r, "ui.menu_icons", "continue", x + w - 15, y + 1);
    });
    const lv = p.levels[sel], spec = st.specs && st.specs[lv.id];
    const px = 190, py = 22, pw = W - px - 8, ph = 136;
    panel(r, px, py, pw, ph, 0);
    if (spec) {
      const rows = spec.map, cell = Math.max(2, Math.min(6, Math.floor(Math.min((pw - 10) / rows[0].length, 54 / rows.length))));
      const mw = rows[0].length * cell, mh = rows.length * cell, mx = px + ((pw - mw) >> 1), my = py + 6;
      const COL = { "#": "w", "%": "F", e: "e", s: "c", "~": "r", "|": "v", H: "f", o: "k", b: "b", X: "l", _: "s", P: "i", h: "i", B: "b", I: "u", ".": "y" };
      rows.forEach((row, ty) => [...row].forEach((ch, tx) => r.rect(mx + tx * cell, my + ty * cell, cell, cell, COL[ch] || "y")));
      const lines = Math.floor((ph - (mh + 10) - 4) / LINE);
      para(r, levelText(lv.id, "discovery", spec.discovery || ""), px + 5, my + mh + 4, pw - 10, lines, "u", `level.${lv.id}.discovery`);
    }
    bottomBar(r);
    keyBar(r, [{ keys: ["up", "down"], label: "keys.select" }, { keys: [{ wide: "Enter" }], label: "keys.play" }, { keys: [{ wide: "Esc" }], label: "keys.back" }], 8, H - 16, W - 8);
  }

  function inLevel(r, tick, spec, extra) { return PB.scene.renderLevel(r, spec, null, Object.assign({ tick }, extra || {})); }
  // Screen point just above a tile-positioned character's head.
  function headOf(o, x, y) { return [o.ox + x * 16 + 8, o.oy + y * 16 + 2]; }

  function pause(r, tick, p, st) {
    inLevel(r, tick, st.levelSpec);
    dim(r);
    const labels = p.items.map((k) => T(k));
    const sel = st.focus | 0, w = menuWidth(labels.concat([T("pause.title")]), 36, 120, 220), h = 22 + labels.length * 15, x = (W - w) >> 1, y = (H - h) >> 1;
    panel(r, x, y, w, h, 2);
    centered(r, T("pause.title"), W >> 1, y + 3, w - 12, "l", "g", "pause.title");
    labels.forEach((s, i) => {
      const iy = y + 19 + i * 15;
      if (i === sel) { panel(r, x + 5, iy - 1, w - 10, 15, 1); r.rect(x + 10, iy + 5, 2, 4, "k"); }
      label(r, s, x + 17, iy, w - 26, i === sel ? "l" : "c", null, p.items[i]);
    });
  }

  function button(r, str, x, y, focused, id, maxW) {
    const w = Math.min(maxW || 140, TX().measure(str) + 14);
    panel(r, x, y, w, 15, focused ? 1 : 0);
    label(r, str, x + 7, y, w - 14, focused ? "l" : "u", null, id);
    return w;
  }

  // Hints are spoken by the hero in a dialogue bubble (docs/design/dialogue.md);
  // only the key bar and the level-3 buttons stay in a slim panel at the bottom.
  function hint(r, tick, p, st) {
    const o = inLevel(r, tick, st.levelSpec);
    const spec = st.levelSpec, level = Math.min(3, (st.focus | 0) + 1);
    const hero = PB.tilemodel.parse(spec).state.player;
    const text = levelText(spec.id, "hint." + level, spec.hints[level - 1] || "");
    PB.dialogue.bubble(r, { text, at: headOf(o, hero.x, hero.y), style: "say", maxW: 168, name: T("hint.title", { n: level }), id: `level.${spec.id}.hint.${level}` });
    const x = 6, w = W - 12, h = 21, y = H - h - 3;
    panel(r, x, y, w, h, 0);
    sprite(r, "ui.icons", "hint", x + 6, y + 4);
    if (level < 3) {
      const more = T("hint.more");
      key(r, "H", x + 22, y + 3); label(r, more, x + 38, y + 3, w - 50, "v", null, "hint.more");
    } else {
      const a = T("hint.rewind"), b = T("hint.demo");
      const room = w - 30, dw = Math.min(room >> 1, TX().measure(b) + 14), bw = Math.min(room - dw - 4, TX().measure(a) + 14);
      button(r, a, x + w - 4 - bw, y + 3, false, "hint.rewind", bw);
      button(r, b, x + w - 8 - bw - dw, y + 3, true, "hint.demo", dw);
    }
  }

  // Review sheet for the dialogue system: an NPC offering a delivery ("!"),
  // the hero thinking aloud, and a system note.
  function dialogue(r, tick, p, st) {
    const spec = st.levelSpec, o = inLevel(r, tick, spec);
    const hero = PB.tilemodel.parse(spec).state.player, npc = [hero.x + 4, hero.y];
    S().draw(r, "char.miner", "idle", tick, o.ox + npc[0] * 16 + 8, o.oy + npc[1] * 16 + 16, true);
    const [nx, ny] = headOf(o, npc[0], npc[1]);
    PB.dialogue.emote(r, "quest", nx, ny - 1, tick);
    PB.dialogue.bubble(r, { text: T("dlg.sample.npc"), at: [nx, ny - 13], style: "say", maxW: 150, name: T("dlg.sample.npc.name"), id: "dlg.sample.npc" });
    PB.dialogue.bubble(r, { text: T("dlg.sample.self"), at: headOf(o, hero.x, hero.y), style: "think", maxW: 120, place: "below", id: "dlg.sample.self" });
    PB.dialogue.bubble(r, { text: T("dlg.sample.note"), at: [W >> 1, H - 2], style: "sign", maxW: 220, id: "dlg.sample.note" });
  }


  function complete(r, tick, p, st) {
    const spec = st.levelSpec;
    const TM = PB.tilemodel, parsed = TM.parse(spec);
    for (const a of spec.solution) TM.act(parsed.level, parsed.state, a);
    PB.scene.renderLevel(r, spec, parsed, { tick, pose: "win" });
    const title = T("complete.title"), moves = T("complete.moves", { n: spec.solution.length });
    const w = menuWidth([moves], 24, 140, 240), h = 54, x = (W - w) >> 1, y = 34;
    panel(r, x, y, w, h, 2);
    if (TX().measure(title) * 2 <= w - 16) text2x(r, title, x + ((w - TX().measure(title) * 2) >> 1), y + 4, "l", "g");
    else centered(r, title, W >> 1, y + 10, w - 16, "l", "g", "complete.title");
    centered(r, moves, W >> 1, y + 36, w - 16, "c", null, "complete.moves");
    const a = T("complete.next"), b = T("complete.levels");
    const aw = Math.min(140, TX().measure(a) + 14), bw = Math.min(140, TX().measure(b) + 14), gap = 6, total = aw + gap + bw;
    button(r, a, (W - total) >> 1, y + h + 4, true, "complete.next");
    button(r, b, ((W - total) >> 1) + aw + gap, y + h + 4, false, "complete.levels");
  }

  function settings(r, tick, p, st) {
    backdrop(r, themeId(st, p), tick);
    dim(r);
    const sel = st.focus | 0, w = 280, x = (W - w) >> 1, y = 14, h = 22 + p.items.length * 17;
    panel(r, x, y, w, h, 0);
    label(r, T("settings.title"), x + 8, y + 3, w - 16, "l", null, "settings.title");
    const valueW = 86;
    p.items.forEach((it, i) => {
      const iy = y + 21 + i * 17;
      if (i === sel) panel(r, x + 4, iy - 2, w - 8, 16, 1);
      label(r, T(it.key), x + 12, iy, w - 24 - valueW, i === sel ? "l" : "u", null, it.key);
      const vx = x + w - 12 - valueW;
      if (it.type === "slider") {
        for (let k = 0; k < 10; k++) r.rect(vx + 16 + k * 7, iy + 4, 5, 6, k < it.value ? (i === sel ? "k" : "d") : "x");
      } else if (it.type === "toggle") {
        const s = T(it.value ? "on" : "off"), tw = Math.min(valueW, TX().measure(s) + 12);
        panel(r, vx + valueW - tw, iy - 1, tw, 13, it.value ? 1 : 0);
        label(r, s, vx + valueW - tw + 6, iy - 1, tw - 12, it.value ? "l" : "v", null, it.value ? "on" : "off");
      } else {
        const s = it.valueKey === "@language" ? (I().getLocale() === "en" ? "English" : I().getLocale() === "qps" ? "Pseudo" : "简体中文") : T(it.valueKey);
        const e = I().ellipsize(s, valueW);
        if (e.cut) I().report("ellipsis", it.valueKey, { x: vx, y: iy, w: valueW, h: LINE });
        TX().draw(r, e.text, vx + valueW - TX().measure(e.text), iy, "c");
      }
    });
  }

  function rulecard(r, tick, p, st) {
    const spec = st.ruleSpec || st.levelSpec;
    inLevel(r, tick, spec);
    dim(r);
    const w = 236, h = 104, x = (W - w) >> 1, y = 36;
    panel(r, x, y, w, h, 0);
    label(r, T("rule.title", { name: T("rule.earth.name") }), x + 8, y + 3, w - 16, "l", null, "rule.title");
    const Tm = S().get(PB.scene.themeFor(spec)).params;
    const ill = new PB.Raster(56, 32);
    PB.terrain.drawBackground(ill, Tm, 0, 0, 56, 32, tick);
    const dug = Math.floor(tick / 60) % 2 === 1;
    PB.terrain.drawTerrain(ill, { w: 4, h: 2, at: (tx, ty) => (ty === 1 ? 1 : ty === 0 && tx === 2 && !dug ? 3 : 0) }, Tm, -4, 0, 0);
    S().draw(ill, "char.portitor", dug ? "idle" : "dig", tick, 20, 16);
    r.blit(ill, x + 8, y + 22);
    r.rect(x + 7, y + 21, 58, 1, "z"); r.rect(x + 7, y + 54, 58, 1, "z");
    if (dug) S().draw(r, "item.sandbag", 0, 0, x + 28, y + 58);
    para(r, T("rule.earth.text"), x + 72, y + 22, w - 80, 5, "u", "rule.earth.text");
    const s = T("rule.close"), bw = Math.min(120, TX().measure(s) + 14);
    button(r, s, x + w - 8 - bw, y + h - 19, true, "rule.close");
    wideKey(r, "Esc", x + w - 14 - bw - TX().measure("Esc") - 8, y + h - 18);
  }

  const SCREENS = { lobby, chapters, levels, pause, hint, complete, settings, rulecard, dialogue };
  // st.locale switches the language for this render; st.showIssues outlines overflow.
  function render(r, asset, tick, st) {
    st = st || {};
    const prev = I().getLocale();
    if (st.locale) I().setLocale(st.locale);
    envLevel = st.env || "full";
    I().takeIssues();
    try { SCREENS[asset.params.screen](r, tick, asset.params, st); }
    finally { if (st.locale) I().setLocale(prev); }
    const issues = I().takeIssues();
    if (st.showIssues) for (const it of issues) {
      const q = it.rect; r.hline(q.x, q.y, q.w, "A"); r.hline(q.x, q.y + q.h, q.w, "A"); r.vline(q.x, q.y, q.h, "A"); r.vline(q.x + q.w, q.y, q.h + 1, "A");
    }
    return issues;
  }
  PB.ui = { render, SCREENS, text2x, label, para };
})(typeof window !== "undefined" ? window : globalThis);
