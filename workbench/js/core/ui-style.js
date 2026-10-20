/* Screens in the 2026-10-16 interface style (docs/design/ui-style.md): the
 * lobby with a skin per chapter (ui-skins.js) and the fixed screens in
 * S1 晶石琉璃 · 素版, ported from tools/ui-proposals/fixed/screens_a/b/c.py.
 * The proposals painted stand-in backdrops; here every backdrop is the real
 * approved scene (theme backdrop, level render, delivery room). Text comes from
 * content/i18n* through PB.i18n.t. Registered over the older entries of
 * PB.ui.SCREENS; ui.js and ui-delivery.js stay untouched. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const U = () => PB.uk, S = () => PB.sprites, I = () => PB.i18n;
  const T = (k, v) => I().t(k, v);
  const W = 320, H = 180;

  // ---------------------------------------------------------------- backdrops
  // Test seam: with flat on, every backdrop is plain 'z' so the UI layer can be compared with the proposal code.
  let flat = false;
  // The lobby / menu backdrop of ui.js (background, floor, ambient life, light), optionally with the lobby props.
  function backdrop(r, theme, tick, env, props) {
    const Tm = S().get(theme).params, M = PB.terrain.MAT, oy = 12;
    if (flat) { r.rect(0, 0, W, H, "z"); return Tm; }
    const ledge = props ? (x, y) => (x === 18 || x === 19) && (y === 7 || y === 8) : null;
    const busy = props ? (x, y) => (y === 8 && x >= 12 && x <= 15) || (y === 7 && x === 15) || (y === 6 && (x === 18 || x === 19)) : null;
    const map = { w: 21, h: 11, at: (x, y) => (x < 0 || x >= 21 || y < 0 ? M.EMPTY : y >= 9 ? M.ROCK : ledge && ledge(x, y) ? M.ROCK : M.EMPTY) };
    PB.terrain.drawBackground(r, Tm, 0, 0, W, H, tick);
    const area = { x: 0, y: 0, w: W, h: 150 }, lights = [], amb = { mode: "one", seed: PB.ambient.seedOf(theme), out: lights };
    const envCtx = { tick, area: { x: 0, y: 20, w: W, h: 136 }, lights, level: env || "full" };
    for (const layer of ["back", "front"]) PB.ambient.draw(r, Tm, map, 0, oy, tick, layer, busy, area, null, Object.assign({}, amb, { dry: true }));
    PB.env.draw(r, Tm, "back", envCtx);
    amb.out = null;
    PB.ambient.draw(r, Tm, map, 0, oy, tick, "back", busy, area, null, amb);
    PB.terrain.drawTerrain(r, map, Tm, 0, oy, tick >> 3);
    PB.ambient.draw(r, Tm, map, 0, oy, tick, "front", busy, area, null, amb);
    PB.env.draw(r, Tm, "light", envCtx);
    PB.env.draw(r, Tm, "front", envCtx);
    if (props) {
      S().draw(r, "obj.crate_wood", "default", 0, 14 * 16 + 8, 156);
      S().draw(r, "obj.crate_wood", "default", 0, 15 * 16 + 8, 156);
      S().draw(r, "obj.crate_wood", "default", 0, 15 * 16 + 8, 140);
      S().draw(r, "char.portitor", "push", tick, 13 * 16 + 8, 156);
      S().draw(r, "mech.exit_flag", "idle", tick, 18 * 16 + 12, 124);
    }
    return Tm;
  }
  const cache = new Map();
  function sceneOf(theme, env, props) {
    const k = theme + "|" + env + "|" + props;
    if (flat) return U().C.make(W, H, "z");
    if (!cache.has(k)) { const r = new PB.Raster(W, H); backdrop(r, theme, 0, env, props); cache.set(k, new (U().C)(r)); }
    return cache.get(k);
  }
  // screens_a.backdrop(): dimmed lobby wall, warm leftovers folded into the wall tone.
  function wall(c, theme, tick, env) {
    backdrop(c.r, theme, tick, env, false);
    U().dim(c, 2);
    for (let y = 0; y < c.h; y++) {
      let last = "z";
      for (let x = 0; x < c.w; x++) { const v = c.get(x, y); if (!"tuvwxyz".includes(v)) c.raw(x, y, last); else last = v; }
    }
  }
  function levelScene(c, spec, tick, env, parsed, extra) {
    if (flat) {
      const q = parsed || PB.tilemodel.parse(spec), L = q.level, o = { ox: (W - L.w * 16) >> 1, oy: 20 + ((H - 20 - L.h * 16) >> 1) };
      c.rect(0, 0, W, H, "z");
      return { o, dx: o.ox + q.state.player.x * 16 - 96, dy: o.oy + q.state.player.y * 16 - 100, player: q.state.player };
    }
    const o = PB.scene.renderLevel(c.r, spec, parsed || null, Object.assign({ tick, hud: false, env: env || "full" }, extra || {}));
    c.rect(0, 0, W, 20, "z");
    const p = (parsed || PB.tilemodel.parse(spec)).state.player;
    // Offset of this scene from the M05 reference the proposals were laid out on (hero tile at 96, 100).
    return { o, dx: o.ox + p.x * 16 - 96, dy: o.oy + p.y * 16 - 100, player: p };
  }
  function levelImage(spec, env) { const c = U().C.make(W, H, "z"); if (flat) return c; PB.scene.renderLevel(c.r, spec, null, { tick: 0, hud: false, env: env || "full" }); return c; }
  function roomScene(c, p, tick, env) {
    if (flat) { c.rect(0, 0, W, H, "z"); return; }
    const theme = PB.dui.regionTheme(p.theme || "theme.dungeon", p.exclude), R = p.room;
    const at = PB.scene.renderLevel(c.r, { format: "pushbox.levelspec/1", id: "delivery.room", chapter: "dungeon", map: R.map, bag: { sand: 0, bomb: 0 } }, null, { theme, tick, hud: false, env: env || "full", facing: R.facing });
    for (const e of R.entities || []) S().draw(c.r, e.sprite, e.anim, tick, at.ox + e.x * 16 + 8, at.oy + e.y * 16 + 16, !!e.flip);
    c.rect(0, 0, W, 20, "z");
  }

  // ---------------------------------------------------------------- shared bits
  const chapterN = (n) => T("chapter.n", { n });
  const chapterLabel = (n) => (n <= 5 ? T("chapter.n", { n }) : T("chapter.extra"));
  const themeKey = (id) => id.slice(6);
  const themeName = (id) => T("theme." + themeKey(id));
  const levelText = (id, field, fallback) => { const k = `level.${id}.${field}`; return I().has(k) ? T(k) : fallback; };
  const iconFrame = (sid, name) => S().get(sid).animations[name].frames[0];
  const ico = (c, sid, name) => (x, y) => c.blit(U().frame(sid, iconFrame(sid, name)), x, y);
  const coinsText = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const clock = (secs) => Math.floor(secs / 60) + ":" + String(Math.floor(secs % 60)).padStart(2, "0");
  const focusOf = (p, st) => (p.focus != null ? p.focus : st.focus | 0);
  function xIcon(c, x, y) {
    for (let k = 0; k < 8; k++) {
      c.px(x + 2 + k, y + 2 + k, "i"); c.px(x + 2 + k, y + 9 - k, "i");
      c.px(x + 3 + k, y + 2 + k, "h"); c.px(x + 3 + k, y + 9 - k, "h");
    }
  }
  const KEY = { select: () => T("keys.select"), confirm: () => T("keys.confirm"), back: () => T("keys.back"), play: () => T("keys.play") };
  function hudFor(c, spec, o) {
    const g = PB.tilemodel.goals(PB.tilemodel.parse(spec).level, PB.tilemodel.parse(spec).state);
    return U().levelHud(c, spec.id, levelText(spec.id, "title", spec.title || spec.id), Object.assign({ lamps: g.map(() => false) }, o || {}));
  }

  // ================================================================ lobby (6 skins)
  function lobby(r, tick, p, st) {
    const th = (st && st.theme) || p.theme || "theme.dungeon", Tm = backdrop(r, th, tick, st.env, true);
    const c = new (U().C)(r), key = themeKey(th);
    const skin = (p.skins && p.skins[key]) || PB.uiSkins.BY_THEME[key] || "S1";
    PB.uiSkins[skin](c, {
      theme: key, title: T("game.title"), titleEn: T("ui.title_alt"), tag: T("game.tagline"), curTag: T("lobby.current_tag"),
      cur: chapterN(Tm.chapter) + " · " + themeName(th),
      items: p.items.map((it) => ({ label: T(it.key), icon: iconFrame("ui.menu_icons", it.icon), detail: it.detail })),
      sel: st.focus | 0, coins: coinsText(p.coins != null ? p.coins : 1280), keySelect: KEY.select(), keyConfirm: KEY.confirm(),
    });
  }

  // ================================================================ A · chapters
  function emblemBadge(c, cx, cy, key, r) {
    const u = U(); r = r || 11;
    u.diamond(c, cx, cy, r + 1, "z"); u.diamond(c, cx, cy, r, "q");
    for (let j = -r; j <= r; j++) { const k = r - Math.abs(j); c.px(cx - k, cy + j, j <= 0 ? "s" : "r"); c.px(cx + k, cy + j, j <= 0 ? "r" : "q"); }
    u.diamond(c, cx, cy, r - 2, "y");
    u.emblem(c, key, cx - 8, cy - 8);
  }
  function lockBadge(c, cx, cy) {
    const u = U();
    u.diamond(c, cx, cy, 10, "z"); u.diamond(c, cx, cy, 9, "x"); u.diamond(c, cx, cy, 8, "y");
    c.blit(u.frame("ui.icons", 5), cx - 6, cy - 6);
  }
  function chapterCard(c, x, y, w, h, ch, big, env) {
    const u = U(), k = big ? 5 : 4, Tm = S().get(ch.theme).params;
    u.panel(c, x, y, w, h, k, { gems: big, facets: big });
    const tw = w - 12, th = big ? 52 : 34, src = sceneOf(ch.theme, env, true);
    u.window(c, x + 6, y + 6, src, 232 - u.fd(tw, 2), 156 - th + (big ? 2 : 1), tw, th);
    if (ch.locked) { u.dim(c, 2, [x + 6, y + 6, x + 6 + tw, y + 6 + th]); lockBadge(c, x + u.fd(w, 2), y + 6 + u.fd(th, 2)); }
    const prog = T("progress", { a: ch.done, b: ch.total });
    if (big) {
      emblemBadge(c, x + 8, y + 8, themeKey(ch.theme));
      const by = y + 6 + th + 6;
      if (!ch.locked) { u.pips(c, x + 10, by + 2, ch.done, ch.total, 2); c.text(x + w - 9, by + 1, prog, "l", { sz: 10, align: "r" }); }
    } else {
      const by = y + 6 + th + 4;
      if (!ch.locked) c.text(x + u.fd(w, 2), by, prog, "u", { sz: 10, align: "c" });
      else c.text(x + u.fd(w, 2), by, chapterLabel(Tm.chapter), "w", { sz: 10, align: "c" });
    }
  }
  function chapters(r, tick, p, st) {
    const u = U(), c = new u.C(r), L = p.chapters, f = focusOf(p, st), cur = L[f], Tc = S().get(cur.theme).params;
    wall(c, "theme.dungeon", tick, st.env);
    u.header(c, 8, 5, T("chapters.title"));
    const slot = (i, x, y, w, h, n, box) => { if (L[i]) { chapterCard(c, x, y, w, h, L[i], false, st.env); u.dim(c, n, box); } };
    slot(f + 2, 300, 44, 56, 54, 2, [298, 40, 320, 104]);
    slot(f - 2, -36, 44, 56, 54, 2, [0, 40, 22, 104]);
    slot(f - 1, 18, 36, 72, 66, 1, [14, 32, 96, 108]);
    slot(f + 1, 230, 36, 72, 66, 1, [226, 32, 304, 108]);
    chapterCard(c, 98, 24, 124, 86, cur, true, st.env);
    const name = chapterLabel(Tc.chapter) + " · " + themeName(cur.theme);
    c.text(161, 115, name, "z", { sz: 12, align: "c" });
    c.text(160, 114, name, "t", { sz: 12, align: "c" });
    const n = L.length, gap = 10, x0 = 160 - u.fd((n - 1) * gap, 2);
    for (let j = 0; j < n; j++) {
      const cx = x0 + j * gap;
      if (j === f) { u.diamond(c, cx, 133, 3, "z"); u.diamond(c, cx, 133, 2, "s"); c.px(cx, 132, "t"); }
      else { u.diamond(c, cx, 133, 2, "z"); u.diamond(c, cx, 133, 1, L[j].locked ? "x" : "w"); }
    }
    u.glyph(c, u.ARROW.left5, x0 - 14, 131, "s"); u.glyph(c, u.ARROW.right5, x0 + (n - 1) * gap + 12, 131, "s");
    const body = !cur.locked ? T(`chapter.${Tc.chapter}.blurb`) : Tc.chapter <= 5 ? T("chapters.unlock", { chapter: chapterLabel(Tc.chapter - 1), n: cur.need }) : T("chapters.later");
    const bl = u.wrap(c, body, 10, 268);
    if (bl.length < 2) { u.plate(c, 20, 140, 280, 16, 3); c.text(160, 143, body, "u", { sz: 10, align: "c" }); }
    else { u.plate(c, 20, 138, 280, 22, 3); bl.slice(0, 2).forEach((ln, i) => c.text(160, 140 + i * 9, i === 1 && bl.length > 2 ? u.clip(c, bl.slice(1).join(" "), 10, 268) : ln, "u", { sz: 10, align: "c" })); }
    u.keybar(c, [[["left", "right"], KEY.select()], [["Enter"], KEY.play()], [["Esc"], KEY.back()]]);
  }

  // ================================================================ A · levels
  function levels(r, tick, p, st) {
    const u = U(), c = new u.C(r), th = p.theme || "theme.dungeon", Tm = S().get(th).params;
    wall(c, th, tick, st.env);
    u.header(c, 8, 5, T("levels.title", { chapter: chapterLabel(Tm.chapter), theme: themeName(th) }), 12, (x, y) => u.emblem(c, themeKey(th), x, y), false);
    const cleared = T("levels.cleared", { a: p.done, b: p.levels.length }), w = 14 + c.tw(cleared, 10) + 8;
    u.plate(c, 312 - w, 4, w, 14, 3);
    c.blit(u.frame("ui.icons", 6), 312 - w + 4, 5);
    c.text(312 - 5, 6, cleared, "u", { sz: 10, align: "r" });
    const x = 10, y = 26, pw = 152, rh = 16, ph = p.levels.length * rh + 10, sel = focusOf(p, st);
    u.panel(c, x, y, pw, ph, 6);
    p.levels.forEach((lv, i) => {
      const ry = y + 5 + i * rh, isSel = i === sel, stt = lv.next ? "next" : lv.state === "cleared" ? "ok" : lv.state === "skipped" ? "skip" : "open";
      if (isSel) u.selRow(c, x + 5, ry, pw - 10, rh - 1, true, x - 6);
      c.text(x + 12, ry + 4, lv.id, isSel ? "l" : stt === "ok" ? "v" : "u", { sz: 10 });
      const rx = x + pw - 10, room = (stt === "next" ? rx - c.tw(T("levels.next"), 10) - 8 : stt === "open" ? rx : rx - 14) - (x + 34);
      c.text(x + 34, ry + 2, u.clip(c, levelText(lv.id, "title", lv.id), 12, room), isSel ? "t" : "u", { sz: 12 });
      if (stt === "ok") c.blit(u.frame("ui.icons", 6), rx - 12, ry + 2);
      else if (stt === "skip") c.blit(u.frame("ui.icons", 7), rx - 12, ry + 2, false, { t: "v", u: "w" });
      else if (stt === "next") u.tag(c, rx - c.tw(T("levels.next"), 10) - 6, ry + 2, T("levels.next"));
      if (i < p.levels.length - 1 && !isSel && i + 1 !== sel) u.hairline(c, x + 12, ry + rh - 1, pw - 24);
    });
    const lv = p.levels[sel], spec = st.specs && st.specs[lv.id], dx = 168, dw = 144;
    u.panel(c, dx, y, dw, ph, 6);
    if (spec) u.window(c, dx + 8, y + 8, levelImage(spec, st.env), 90, 84, dw - 16, 46);
    const ty = y + 8 + 46 + 6;
    c.text(dx + 9, ty + 2, lv.id, "l", { sz: 10 });
    c.text(dx + 9 + c.tw(lv.id, 10) + 5, ty, levelText(lv.id, "title", lv.id), "t", { sz: 12 });
    u.divider(c, dx + 8, ty + 15, dw - 16, "q", null);
    u.para(c, dx + 9, ty + 20, levelText(lv.id, "discovery", (spec && spec.discovery) || ""), "u", 10, dw - 18, 12, "l", null, 3);
    u.keybar(c, [[["up", "down"], KEY.select()], [["Enter"], KEY.play()], [["Esc"], KEY.back()]]);
  }

  // ================================================================ A · settings
  const IC = {
    style(c, x, y, col) { U().diamond(c, x + 3, y + 3, 3, col); c.px(x + 2, y + 2, col !== "z" ? "z" : "t"); c.px(x + 3, y + 3, "y"); },
    globe(c, x, y, col) {
      for (const [a, b] of [[2, 0], [3, 0], [4, 0], [1, 1], [5, 1], [0, 2], [6, 2], [0, 3], [6, 3], [0, 4], [6, 4], [1, 5], [5, 5], [2, 6], [3, 6], [4, 6]]) c.px(x + a, y + b, col);
      c.vline(x + 3, y + 1, 5, col); c.hline(x + 1, y + 3, 5, col);
    },
    note(c, x, y, col) { c.vline(x + 4, y, 6, col); c.hline(x + 4, y, 3, col); c.px(x + 6, y + 1, col); c.rect(x + 2, y + 5, 3, 2, col); },
    speaker(c, x, y, col) {
      c.rect(x, y + 2, 2, 3, col); c.vline(x + 2, y + 1, 5, col); c.vline(x + 3, y, 7, col);
      c.px(x + 5, y + 2, col); c.px(x + 5, y + 4, col);
      c.px(x + 6, y + 1, col); c.px(x + 6, y + 5, col); c.vline(x + 6, y + 2, 3, col);
    },
    scale(c, x, y, col) { c.frame(x, y, 7, 7, col); c.rect(x + 2, y + 2, 3, 3, col); },
    env(c, x, y, col) {
      c.px(x + 3, y, col); c.px(x + 3, y + 6, col); c.px(x, y + 3, col); c.px(x + 6, y + 3, col);
      c.rect(x + 2, y + 2, 3, 3, col); c.px(x + 1, y + 1, col); c.px(x + 5, y + 5, col); c.px(x + 5, y + 1, col); c.px(x + 1, y + 5, col);
    },
    grid(c, x, y, col) { for (const k of [0, 3, 6]) { c.hline(x, y + k, 7, col); c.vline(x + k, y, 7, col); } },
    unlock(c, x, y, col) {
      c.rect(x, y + 3, 7, 4, col); c.vline(x + 1, y, 3, col); c.hline(x + 1, y, 4, col); c.vline(x + 4, y, 2, col);
      c.px(x + 3, y + 4, "z"); c.px(x + 3, y + 5, "z");
    },
    replay(c, x, y, col) {
      for (const [a, b] of [[2, 0], [3, 0], [4, 0], [5, 1], [6, 2], [6, 3], [6, 4], [5, 5], [4, 6], [3, 6], [2, 6], [1, 5], [0, 4], [0, 3]]) c.px(x + a, y + b, col);
      c.px(x + 1, y + 1, col); c.px(x, y + 1, col); c.px(x + 1, y + 2, col); c.px(x + 2, y + 3, col);
      c.rect(x + 3, y + 2, 1, 3, col); c.px(x + 4, y + 3, col);
    },
  };
  const SET_ICON = { "settings.language": "globe", "settings.ui_style": "style", "settings.music": "note", "settings.sfx": "speaker", "settings.scale": "scale",
    "settings.env": "env", "settings.grid": "grid", "settings.unlock": "unlock", "settings.tutorial": "replay" };
  const SET_SEP = new Set(["settings.ui_style", "settings.sfx", "settings.grid"]);
  const STYLE_THEME = ["theme.cave", "theme.dungeon", "theme.ruins", "theme.sky"];
  function miniStyle(c, x, y, k, sel, env) {
    const u = U(), P = PB.uiSkins.parts;
    u.window(c, x, y, sceneOf(STYLE_THEME[k], env, true), 196, 118, 44, 28, 2, sel ? ["s", "q", "r"] : ["w", "y", "x"]);
    c.clip = [x, y, x + 44, y + 28];
    const mark = T(`ui_style.s${k + 1}.mark`);
    if (k === 0) { u.panel(c, x + 6, y + 5, 34, 19, 4, { gems: true, facets: false }); u.hshard(c, x + 1, y + 9, 8, 9); c.text(x + 18, y + 9, mark, "t", { sz: 10 }); }
    else if (k === 1) { P.slab(c, x + 5, y + 7, 34, 9, { top: 2, jag: 3, seed: 2, glow: null }); P.rune(c, 1, x + 9, y + 11, "k"); c.text(x + 19, y + 9, mark, "u", { sz: 10 }); }
    else if (k === 2) { P.jadePanel(c, x + 5, y + 4, 34, 20, "o", false); c.text(x + 17, y + 9, mark, "l", { sz: 10 }); }
    else { P.bubblePanel(c, x + 5, y + 4, 34, 20, 6); P.star(c, x + 6, y + 9); c.text(x + 18, y + 9, mark, "B", { sz: 10 }); }
    c.clip = null;
  }
  function settings(r, tick, p, st) {
    const u = U(), c = new u.C(r);
    wall(c, "theme.dungeon", tick, st.env);
    u.header(c, 8, 5, T("settings.title"));
    const items = p.items.slice(), styleAt = 1;
    if (p.uiStyleRow !== false && !items.some((it) => it.key === "settings.ui_style")) items.splice(styleAt, 0, { key: "settings.ui_style", type: "value", valueKey: "ui_style.s1" });
    const sel = focusOf(p, st), x = 10, y = 24, pw = 190, rh = 14, ph = items.length * rh + 10;
    u.panel(c, x, y, pw, ph, 6);
    items.forEach((it, i) => {
      const ry = y + 5 + i * rh, isSel = i === sel;
      if (isSel) u.selRow(c, x + 5, ry, pw - 10, rh - 1, true, x - 6);
      IC[SET_ICON[it.key] || "scale"](c, x + 11, ry + 3, isSel ? "s" : "v");
      c.text(x + 24, ry + 1, T(it.key), isSel ? "t" : "u", { sz: 12 });
      const xr = x + pw - 11;
      if (it.type === "slider") { c.text(xr, ry + 3, String(it.value), "u", { sz: 10, align: "r" }); u.slider(c, xr - 10 - 49, ry + 3, it.value); }
      else if (it.type === "toggle") { const s = T(it.value ? "on" : "off"); c.text(xr, ry + 1, s, "v", { sz: 12, align: "r" }); u.toggle(c, xr - Math.max(12, c.tw(s, 12)) - 18, ry + 2, !!it.value); }
      else if (it.key === "settings.tutorial") { const s = T(it.valueKey), w = c.tw(s, 10) + 8; u.tag(c, xr - w + 2, ry + 1, s, "x", "w", "u"); }
      else {
        const s = it.valueKey === "@language" ? (I().getLocale() === "en" ? "English" : I().getLocale() === "qps" ? "Pseudo" : "简体中文") : T(it.valueKey);
        u.valueSel(c, xr, ry + 1, s, isSel);
      }
      if (SET_SEP.has(it.key)) u.hairline(c, x + 11, ry + rh - 1, pw - 22);
    });
    const dx = 206, dw = 108;
    u.panel(c, dx, y, dw, ph, 6, { facets: false });
    for (let k = 0; k < 4; k++) {
      const sx = dx + 8 + (k % 2) * 48, sy = y + 8 + u.fd(k, 2) * 44;
      miniStyle(c, sx, sy, k, k === 0, st.env);
      c.text(sx + 22, sy + 31, T(`ui_style.s${k + 1}`), k === 0 ? "t" : "v", { sz: 10, align: "c" });
    }
    u.divider(c, dx + 8, y + 96, dw - 16, "q", null);
    const n1 = T("settings.ui_style.note1"), n2 = T("settings.ui_style.note2");
    const fits = c.tw(n1, 10) <= dw - 18 && c.tw(n2, 10) <= dw - 18;
    u.para(c, dx + 9, y + 102, n1 + " " + n2, "u", 10, dw - 18, fits ? 12 : 11, "l", fits ? [n1, n2] : null, 3);
    u.keybar(c, [[["up", "down"], KEY.select()], [["left", "right"], T("keys.adjust")], [["Esc"], KEY.back()]]);
  }

  // ================================================================ B · in-level
  const MENU_ICON = {
    "pause.resume": ["ui.menu_icons", "continue"], "pause.hint": ["ui.icons", "hint"], "pause.restart": ["ui.icons", "restart"], "pause.skip": ["ui.icons", "skip"],
    "pause.levels": ["ui.menu_icons", "chapters"], "pause.settings": ["ui.menu_icons", "settings"], "pause.menu": ["ui.menu_icons", "quit"],
    "dlv.pause.restart_room": ["ui.icons", "restart"],
  };
  const MENU_KEY = { "pause.resume": "Esc", "pause.hint": "H", "pause.restart": "R" };
  const MENU_SEP = new Set(["pause.skip", "dlv.pause.give_up"]);
  function menuPanel(c, x, y, w, title, items, sel, rh) {
    const u = U(); rh = rh || 15;
    const h = 7 + 14 + 5 + items.length * rh + 5;
    u.panel(c, x, y, w, h, 6);
    u.panelTitle(c, x, y + 7, w, title);
    const ry0 = y + 7 + 14 + 5;
    items.forEach((it, i) => {
      const ry = ry0 + i * rh;
      if (i === sel) u.selRow(c, x + 6, ry, w - 12, rh - 1, true, x - 6);
      if (it.icon) it.icon(x + 13, ry + 1);
      c.text(x + 29, ry + 1, it.label, i === sel ? "t" : "u", { sz: 12 });
      if (it.key) u.keycap(c, x + w - 10 - (c.tw(it.key, 10) + 7), ry + 1, it.key);
      if (it.sep) u.hairline(c, x + 13, ry + rh - 1, w - 26);
    });
    return h;
  }
  function menuItems(c, keys, withKeys) {
    return keys.map((k) => ({
      label: T(k), key: withKeys ? MENU_KEY[k] : null, sep: MENU_SEP.has(k),
      icon: k === "dlv.pause.give_up" ? (x, y) => xIcon(c, x - 1, y) : MENU_ICON[k] ? ico(c, ...MENU_ICON[k]) : null,
    }));
  }
  function menuWidth(c, items, base) { return Math.max(base, ...items.map((it) => 29 + c.tw(it.label, 12) + (it.key ? c.tw(it.key, 10) + 7 + 14 : 10))); }
  function pause(r, tick, p, st) {
    const u = U(), c = new u.C(r), delivery = !!p.room;
    if (delivery) { roomScene(c, p, tick, st.env); hudDelivery(c, p.hud); u.dim(c, 1); }
    else { levelScene(c, st.levelSpec, tick, st.env); hudFor(c, st.levelSpec); u.dim(c, 1); }
    const items = menuItems(c, p.items, !delivery);
    if (delivery && items[0]) items[0].key = "Esc";
    const w = menuWidth(c, items, delivery ? 136 : 128);
    menuPanel(c, 160 - u.fd(w, 2), delivery ? 34 : 24, w, T("pause.title"), items, st.focus | 0);
    u.keybar(c, [[["up", "down"], KEY.select()], [["Enter"], KEY.confirm()], [["Esc"], KEY.back()]]);
  }
  function hint(r, tick, p, st) {
    const u = U(), c = new u.C(r), spec = st.levelSpec, level = Math.min(3, p.level || (st.focus | 0) + 1);
    const L = levelScene(c, spec, tick, st.env); hudFor(c, spec);
    const hs = levelText(spec.id, "hint." + level, spec.hints[level - 1] || "");
    let lines = u.wrap(c, hs, 10, 90);
    for (let bw = 100; lines.length > 2 && bw <= 160; bw += 10) lines = u.wrap(c, hs, 10, bw);
    const w = Math.max(...lines.map((s) => c.tw(s, 10))) + 12, h = 9 + lines.length * 12;
    const tx = 104 + L.dx, ty = 97 + L.dy, x = tx - 50, y = ty - 37 - (lines.length - 2) * 12;
    u.sayBubble(c, x, y, w, h, [tx, ty]);
    lines.forEach((ln, i) => c.text(x + 6, y + 6 + i * 12, ln, "t", { sz: 10 }));
    u.nameChip(c, x + 5, y - 7, T("hint.title", { n: level }));
    u.plate(c, 4, 160, 312, 18, 3);
    c.blit(u.frame("ui.icons", 2), 9, 163);
    u.pips(c, 24, 167, level, 3, 2);
    let bx = 316 - 8;
    const [, kw] = u.keybar(c, [[["Esc"], KEY.back()]], bx, 164, "r", false);
    bx -= kw + 2;
    if (level < 3) {
      const s = T("hint.more"), w1 = c.tw(s, 12) + 18 + 14;
      u.button(c, bx - w1, 162, w1, s, { sel: true, h: 14, key: "H" });
    } else {
      const a = T("hint.rewind"), w2 = c.tw(a, 12) + 18;
      u.button(c, bx - w2, 162, w2, a, { sel: false, h: 14 });
      bx -= w2 + 5;
      const b = T("hint.demo"), w1 = c.tw(b, 12) + 18;
      u.button(c, bx - w1, 162, w1, b, { sel: true, h: 14 });
    }
  }
  function rulecard(r, tick, p, st) {
    const u = U(), c = new u.C(r), spec = st.ruleSpec || st.levelSpec;
    levelScene(c, spec, tick, st.env); hudFor(c, spec, { rule: 1, sand: spec.bag ? spec.bag.sand | 0 : 0 }); u.dim(c, 1);
    const x = 64, y = 34, w = 192, h = 116;
    u.panel(c, x, y, w, h, 6);
    u.panelTitle(c, x, y + 7, w, T("rule.title", { name: T("rule.earth.name") }), 12, (xx, yy) => { c.rect(xx - 1, yy - 1, 9, 9, "z"); c.blit(u.frame("ui.class_icon", 1), xx, yy); });
    u.window(c, x + 12, y + 30, levelImage(spec, st.env), 106, 84, 56, 44);
    u.para(c, x + 80, y + 30, T("rule.earth.text"), "u", 10, 100, 12);
    const s = T("rule.close"), bw = c.tw(s, 12) + c.tw("Esc", 10) + 7 + 3 + 20;
    u.button(c, x + u.fd(w - bw, 2), y + h - 24, bw, s, { sel: true, key: "Esc" });
  }
  function noteParts(s) {
    const m = s.match(/^(.*?[：:]\s?)(.*)$/);
    return m ? [[m[1], "l"], [m[2], "t"]] : [[s, "t"]];
  }
  function dialogue(r, tick, p, st) {
    const u = U(), c = new u.C(r), spec = st.levelSpec;
    const L = levelScene(c, spec, tick, st.env); hudFor(c, spec);
    const dx = L.dx, dy = L.dy;
    c.blit(u.frame("char.miner", 0), 146 + dx, 100 + dy, true);
    c.blit(u.frame("ui.emote", 0), 150 + dx, 87 + dy);
    const Ln = u.wrap(c, T("dlg.sample.npc"), 10, 140);
    const x = 128 + dx, y = 40 + dy, w = 152, h = 10 + Ln.length * 12;
    u.sayBubble(c, x, y, w, h, [156 + dx, 84 + dy]);
    Ln.forEach((ln, i) => c.text(x + 6, y + 6 + i * 12, ln, "t", { sz: 10 }));
    u.nameChip(c, x + 5, y - 7, T("dlg.sample.npc.name"));
    u.glyph(c, u.ARROW.down5, x + w - 11, y + h - 6, "s");
    const L2 = u.wrap(c, T("dlg.sample.self"), 10, 90), tx = 10 + dx, ty = 52 + dy, tw = 102, th = 10 + L2.length * 12;
    u.thinkBubble(c, tx, ty, tw, th, [[92 + dx, ty + th + 4, 2], [98 + dx, ty + th + 9, 1]]);
    L2.forEach((ln, i) => c.text(tx + 6, ty + 5 + i * 12, ln, "u", { sz: 10 }));
    const parts = noteParts(T("dlg.sample.note")), tw2 = parts.reduce((s, [t]) => s + c.tw(t, 10), 0) + 5 + 12 + 6;
    u.toast(c, 160 - u.fd(tw2, 2), 150, tw2, parts, (xx, yy) => c.blit(u.frame("ui.emote", 0), xx - 2, yy));
  }
  function complete(r, tick, p, st) {
    const u = U(), c = new u.C(r), spec = st.levelSpec, TM = PB.tilemodel, parsed = TM.parse(spec);
    for (const a of spec.solution) TM.act(parsed.level, parsed.state, a);
    const L = levelScene(c, spec, tick, st.env, parsed, { pose: "win" }), open = levelScene(U().C.make(W, H, "z"), spec, 0, st.env);
    L.dx = open.dx; L.dy = open.dy;
    hudFor(c, spec, { lamps: TM.goals(parsed.level, parsed.state).map((g) => g.lit) });
    u.sparkle(c, 168 + L.dx, 112 + L.dy, "t", 1); u.sparkle(c, 178 + L.dx, 118 + L.dy, "s", 1);
    u.dim(c, 1, [0, 20, 320, 180]);
    const a = T("complete.next"), b = T("complete.levels"), bw = Math.max(52, c.tw(a, 12) + 14, c.tw(b, 12) + 14);
    const w = Math.max(128, 2 * bw + 24), x = 160 - u.fd(w, 2), y = 26, h = 74;
    u.panel(c, x, y, w, h, 6);
    u.bigTitle(c, 160, y + 8, T("complete.title"), { align: "c", maxW: w - 16 });
    c.text(160, y + 36, T("complete.moves", { n: spec.solution.length }), "u", { sz: 12, align: "c" });
    u.button(c, x + 10, y + 53, bw, a, { sel: true });
    u.button(c, x + w - 10 - bw, y + 53, bw, b);
    u.keybar(c, [[["left", "right"], KEY.select()], [["Enter"], KEY.confirm()]]);
  }

  // ================================================================ C · delivery
  // screens_c / kit.delivery_hud: hearts, cargo + integrity + rule, coins + sand, bag slots, clock, minimap.
  function hudDelivery(c, h) {
    const u = U(), DI = (n) => u.frame("ui.delivery_icons", iconFrame("ui.delivery_icons", n));
    c.rect(0, 0, 320, 20, "z");
    let x = 2, w = 6 + h.maxHearts * 11;
    u.plate(c, x, 1, w, 18, 3);
    for (let i = 0; i < h.maxHearts; i++) c.blit(DI(i < h.hearts ? "heart" : "heart_empty"), x + 1 + i * 11, 3);
    x += w + 2;
    if (h.cargo) {
      w = 4 + 14 + 2 + h.max * 7 + 3 + 13 + 3;
      u.plate(c, x, 1, w, 18, 3);
      c.blit(u.frame("cargo." + h.cargo, 0), x + 1, 3);
      const px = x + 19;
      for (let i = 0; i < h.max; i++) {
        const on = i < h.left;
        c.rect(px + i * 7, 7, 6, 6, "z");
        c.rect(px + i * 7 + 1, 8, 4, 4, on ? "l" : "y");
        if (on) { c.hline(px + i * 7 + 1, 8, 4, "t"); c.hline(px + i * 7 + 1, 11, 4, "k"); }
      }
      if (h.rule) c.blit(DI(h.rule), x + w - 17, 2);
      x += w + 2;
    }
    const coins = String(h.coins), sand = "×" + h.sand;
    w = 4 + 9 + 2 + c.tw(coins, 10) + 6 + 13 + 1 + c.tw(sand, 10) + 4;
    u.plate(c, x, 1, w, 18, 3);
    u.coinIcon(c, x + 4, 5, true);
    c.text(x + 15, 6, coins, "t", { sz: 10 });
    const sx = x + 15 + c.tw(coins, 10) + 4;
    c.blit(u.frame("item.sandbag", 0), sx - 2, 2);
    c.text(sx + 13, 6, sand, "t", { sz: 10 });
    x += w + 2;
    for (let i = 0; i < h.slots; i++) { u.slot(c, x + i * 18, 1, 18); if (h.items[i]) c.blit(u.frame("item." + h.items[i], 0), x + i * 18 + 1, 2); }
    const ck = clock(h.secs || 0);
    w = 4 + 13 + 2 + c.tw(ck, 10) + 5;
    const xr = 318 - 34;
    u.plate(c, xr - w - 2, 1, w, 18, 3);
    c.blit(DI("clock"), xr - w - 2 + 1, 2);
    c.text(xr - 7, 6, ck, "t", { sz: 10, align: "r" });
    u.minimap(c, 318 - 32, 1, h.minimap);
  }
  function hubBg(c, tick, env) { backdrop(c.r, "theme.dungeon", tick, env, false); U().dim(c, 2); }
  function reel(c, x, y, w, h, items, sel) {
    const u = U(), M = u.cham(x - 2, y - 2, w + 4, h + 4, 3);
    u.dropShadow(c, M, 2, 3, 9); u.paint(c, M, "z");
    u.bevel(c, u.cham(x - 1, y - 1, w + 2, h + 2, 2), sel ? "s" : "w", sel ? "q" : "y", sel ? "r" : "x");
    const In = u.cham(x, y, w, h, 1);
    u.paint(c, In, "y");
    const cy = y + u.fd(h, 2);
    c.rect(x, cy - 13, w, 26, "x"); c.hline(x, cy - 13, w, "w"); c.hline(x, cy + 12, w, "y");
    const sub = u.C.make(w, h, "y");
    items.forEach(([sid, fr], k) => {
      const f = u.frame(sid, fr), fw = f[0].length, fh = f.length, off = (k - 1) * (fh > 16 ? fh + 8 : 24);
      sub.blit(f, u.fd(w, 2) - u.fd(fw, 2), u.fd(h, 2) - u.fd(fh, 2) + off);
      if (k !== 1) u.dim(sub, 2, [0, Math.max(0, u.fd(h, 2) - u.fd(fh, 2) + off), w, Math.min(h, u.fd(h, 2) + u.fd(fh, 2) + off + 1)]);
    });
    for (const kk of In) { const a = u.KX(kk), b = u.KY(kk), v = sub.get(a - x, b - y); if (v !== "y") c.px(a, b, v); }
    c.px(x + 2, cy - 11, "t"); c.px(x + 3, cy - 11, "s");
    if (sel) {
      u.hshard(c, x - 12, cy - 5, 10, 11);
      const Sx = u.C.make(10, 13, "."); u.hshard(Sx, 0, 1, 10, 11);
      const rws = []; for (let j = 0; j < 13; j++) { let s = ""; for (let i = 0; i < 10; i++) s += Sx.get(i, j); rws.push([...s].reverse().join("")); }
      c.blit(rws, x + w + 2, cy - 6);
    }
  }
  function reels(r, tick, p, st) {
    const u = U(), c = new u.C(r);
    hubBg(c, tick, st.env);
    u.bigTitle(c, 14, 7, T("dlv.reels.title"));
    u.plate(c, 6, 118, 50, 8, 2);
    c.blit(u.frame("char.lucky_cat", 0), 14, 87);
    const x = 64, y = 36, w = 248, h = 80;
    u.panel(c, x, y, w, h, 6);
    const lx = x + 52, rx = x + w - 52;
    c.text(lx, y + 6, T("dlv.reels.cargo"), "v", { sz: 10, align: "c" });
    c.text(rx, y + 6, T("dlv.reels.recipient"), "v", { sz: 10, align: "c" });
    const around = (list, cur) => { const i = list.indexOf(cur), n = list.length; return [list[(i + 1) % n], cur, list[(i - 1 + n) % n]]; };
    reel(c, lx - 18, y + 18, 36, 44, around(p.cargoList, p.cargo).map((id) => ["cargo." + id, 0]), true);
    reel(c, rx - 18, y + 18, 36, 44, around(p.recipientList, p.recipient).map((id) => ["avatar." + id, 0]), false);
    const cargo = T(`cargo.${p.cargo}.name`), recip = T(`recipient.${p.recipient}.name`);
    c.text(lx, y + 65, cargo, "t", { sz: 12, align: "c" });
    c.text(rx, y + 65, recip, "t", { sz: 12, align: "c" });
    const mx = x + u.fd(w, 2), heart = u.frame("ui.delivery_icons", 0);
    if (p.liked) { c.blit(heart, mx - 8, y + 26); c.text(mx, y + 42, "×1.5", "l", { sz: 10, align: "c" }); }
    for (let k = 0; k < 3; k++) { c.px(mx - 30 + k * 4, y + 40, "w"); c.px(mx + 22 + k * 4, y + 40, "w"); }
    const ix = 12, iy = 121, iw = 300;
    u.panel(c, ix, iy, iw, 38, 4, { gems: false, facets: false });
    u.rich(c, ix + 9, iy + 4, [[cargo, "t"], [" · " + T(`cargo.${p.cargo}.rule`), "u"]]);
    u.rich(c, ix + 9, iy + 15, [[recip, "t"], [" · " + T(`recipient.${p.recipient}.rule`), "u"]]);
    if (p.liked) { c.blit(heart, ix + 6, iy + 23); c.text(ix + 18, iy + 26, T("dlv.reels.likes", { name: recip, cargo }), "l", { sz: 10 }); }
    u.keybar(c, [[["left", "right"], T("dlv.keys.reel")], [["R"], T("dlv.reels.reroll", { n: p.rerolls })], [["Enter"], T("dlv.keys.go")]]);
  }
  function roomDim(c, p, tick, env, n, withHud) { roomScene(c, p, tick, env); if (withHud) hudDelivery(c, p.hud); U().dim(c, n); }
  const SOLD = () => U().rows("\n.zzzzz.\nzxwwwxz\nzwxxxyz\nzwxxxyz\nzwxxxyz\nzxyyyyz\n.zzzzz.");
  function shop(r, tick, p, st) {
    const u = U(), c = new u.C(r);
    roomDim(c, p, tick, st.env, 2, false);
    c.blit(u.frame("char.turtle_keeper", 0), 22, 122);
    const lines = u.wrap(c, T("dlv.shop.greet"), 10, 80), bh = 6 + lines.length * 12;
    u.sayBubble(c, 6, 112 - bh, 92, bh, [40, 118]);
    lines.forEach((ln, i) => c.text(12, 118 - bh + i * 12, ln, "t", { sz: 10 }));
    u.nameChip(c, 11, 105 - bh, T("npc.turtle_keeper.name"));
    const x = 106, y = 6, w = 208, h = 150;
    u.panel(c, x, y, w, h, 6);
    c.text(x + 10, y + 7, T("dlv.shop.title"), "t", { sz: 12 });
    u.coinChip(c, x + w - 8, y + 6, String(p.coins));
    u.divider(c, x + 8, y + 24, w - 16, "q", null);
    const sel = p.focus | 0;
    p.goods.forEach((g, i) => {
      const ry = y + 29 + i * 21, stt = g.stock === 0 ? "out" : g.price > p.coins ? "poor" : "ok", pr = String(g.price);
      if (i === sel) u.selRow(c, x + 6, ry, w - 12, 20, true, x - 7);
      const f = u.frame("item." + g.id, 0);
      if (stt === "out") { const rc = {}; for (const k of PB.CODES) rc[k] = u.dk(u.dk(k)); c.blit(f, x + 12, ry + 2, false, rc); } else c.blit(f, x + 12, ry + 2);
      c.text(x + 32, ry + 4, T(`item.${g.id}.name`), i === sel ? "t" : stt === "out" ? "w" : "u", { sz: 12 });
      c.text(x + w - 56, ry + 6, g.stock === 0 ? T("dlv.shop.sold_out") : T("dlv.shop.left", { n: g.stock }), stt === "out" ? "w" : "v", { sz: 10, align: "r" });
      c.text(x + w - 12, ry + 6, pr, { ok: "l", poor: "i", out: "w" }[stt], { sz: 10, align: "r" });
      if (stt === "out") c.blit(SOLD(), x + w - 12 - c.tw(pr, 10) - 9, ry + 6); else u.coinIcon(c, x + w - 12 - c.tw(pr, 10) - 9, ry + 6);
      if (i === 1) u.hairline(c, x + 12, ry + 20, w - 24);
    });
    u.divider(c, x + 8, y + 95, w - 16, "q", null);
    u.para(c, x + 11, y + 101, T(`item.${p.goods[sel].id}.desc`), "u", 10, w - 22, 12);
    const by = y + h - 30;
    c.text(x + 11, by + 5, T("dlv.shop.bag"), "v", { sz: 10 });
    for (let k = 0; k < p.slots; k++) u.slot(c, x + 36 + k * 19, by, 18);
    (p.bag || []).forEach((id, k) => c.blit(u.frame("item." + id, 0), x + 37 + k * 19, by + 1));
    const sx = x + 36 + p.slots * 19 + 11;
    c.blit(u.frame("item.sandbag", 0), sx, by + 1);
    c.text(sx + 16, by + 5, "×" + p.sand, "t", { sz: 10 });
    u.keybar(c, [[["up", "down"], KEY.select()], [["Enter"], T("dlv.keys.buy")], [["Esc"], T("dlv.keys.leave")]], 106, 163);
  }
  function deliveryHud(r, tick, p, st) {
    const c = new (U().C)(r);
    roomScene(c, Object.assign({}, p, { room: { map: p.room, entities: p.entities, facing: p.facing } }), tick, st.env);
    hudDelivery(c, p.hud);
  }
  function settlement(r, tick, p, st) {
    const u = U(), c = new u.C(r);
    roomDim(c, p, tick, st.env, 2, false);
    u.bigTitle(c, 160, 6, T("dlv.done.title"), { align: "c" });
    c.text(282, 14, T("dlv.done.rating"), "v", { sz: 10, align: "r" });
    u.ratingBadge(c, 296, 18, p.rating);
    u.card(c, 8, 62, 82, 74, 4);
    const th = T(`recipient.${p.recipient}.thanks`), tl = u.wrap(c, th, 10, 80).slice(0, 2), bw0 = 90, bh0 = 6 + tl.length * 12;
    u.sayBubble(c, 4, 56 - bh0, bw0, bh0, [49, 64]);
    tl.forEach((s, i) => c.text(9, 61 - bh0 + i * 12, s, "t", { sz: 10 }));
    u.portrait(c, 35, 68, "avatar." + p.recipient);
    c.text(49, 100, T(`recipient.${p.recipient}.name`), "t", { sz: 12, align: "c" });
    c.blit(u.frame("cargo." + p.cargo, 0), 22, 115); c.text(40, 118, T(`cargo.${p.cargo}.name`), "u", { sz: 10 });
    const x = 98, y = 36, w = 214, h = 120;
    u.panel(c, x, y, w, h, 6);
    const L = x + 12, M = x + 74, R = x + w - 12, ry = [y + 7, y + 22, y + 37];
    c.text(L, ry[0], T("dlv.done.integrity"), "u", { sz: 12 });
    for (let k = 0; k < p.max; k++) {
      const on = k < p.integrity;
      c.rect(M + k * 9, ry[0] + 2, 8, 8, "z"); c.rect(M + k * 9 + 1, ry[0] + 3, 6, 6, on ? "l" : "y");
      if (on) { c.hline(M + k * 9 + 1, ry[0] + 3, 6, "t"); c.hline(M + k * 9 + 1, ry[0] + 8, 6, "k"); }
    }
    c.text(M + p.max * 9 + 4, ry[0] + 2, p.integrity + "/" + p.max, "v", { sz: 10 });
    c.text(R, ry[0], "×" + (p.integrity / p.max).toFixed(2), "l", { sz: 12, align: "r" });
    c.text(L, ry[1], T("dlv.done.time"), "u", { sz: 12 });
    c.text(M, ry[1], T("dlv.done.time_value", { t: p.secs.toFixed(1), par: p.par.toFixed(1) }), "t", { sz: 12 });
    c.text(R, ry[1], "×" + (p.timePct / 100).toFixed(2), "l", { sz: 12, align: "r" });
    c.text(L, ry[2], T("dlv.done.like"), "u", { sz: 12 });
    c.blit(u.frame("ui.delivery_icons", 0), M - 2, ry[2] - 2);
    c.text(R, ry[2], "×" + p.likePct / 100, "l", { sz: 12, align: "r" });
    u.divider(c, x + 8, y + 53, w - 16, "q", null);
    c.text(L, y + 58, T("dlv.done.tip"), "u", { sz: 12 });
    const base = T("dlv.done.base", { n: p.pay });
    c.text(M, y + 60, base, "v", { sz: 10 });
    u.glyph(c, u.ARROW.right5, M + c.tw(base, 10) + 5, y + 61, "w");
    c.text(R, y + 58, String(p.tip), "t", { sz: 12, align: "r" });
    c.text(L, y + 73, T("dlv.done.picked"), "u", { sz: 12 });
    c.text(R, y + 73, String(p.picked), "t", { sz: 12, align: "r" });
    c.hline(x + 10, y + 89, w - 20, "q"); c.hline(x + 10, y + 91, w - 20, "q");
    c.text(L, y + 99, T("dlv.done.total"), "t", { sz: 12 });
    const tw = u.fancy(c, R, y + 95, String(p.total), "l", { outline: "z", sz: 12, scale: 2, align: "r", bottom: "k", diag: false });
    u.coinIcon(c, R - tw - 13, y + 99, true);
    const a = T("dlv.done.again"), b = T("dlv.done.hub"), bw = Math.max(72, c.tw(a, 12) + 16, c.tw(b, 12) + 16);
    u.button(c, 160 - bw - 6, 162, bw, a, { sel: true });
    u.button(c, 166, 162, bw, b);
  }
  function settlementFail(r, tick, p, st) {
    const u = U(), c = new u.C(r);
    roomDim(c, p, tick, st.env, 2, false);
    u.bigTitle(c, 160, 14, T("dlv.fail.title"), { align: "c", outline: "C", shadow: "B" });
    const x = 40, y = 52, w = 240, h = 78;
    u.panel(c, x, y, w, h, 6);
    u.portrait(c, x + 12, y + 14, "avatar." + p.recipient);
    c.blit(u.frame("cargo." + p.cargo, p.cargo === "vase" ? 1 : 0), x + 44, y + 26);
    const tx = x + 70, why = T(p.reason === "cargo" ? "dlv.fail.cargo" : "dlv.fail.hearts");
    c.text(tx, y + 14, why, "t", { sz: 12 });
    if (p.reason !== "cargo") { const hx = tx + c.tw(why, 12) + 4; for (let k = 0; k < 3; k++) c.blit(u.frame("ui.delivery_icons", 1), hx + k * 10, y + 12); }
    const keep = T("dlv.fail.keep", { a: p.picked, b: "" }).replace(/\s*$/, "");
    u.rich(c, tx, y + 34, [[keep, "u"]], 10);
    u.coinIcon(c, tx, y + 50, true);
    u.fancy(c, tx + 12, y + 47, String(p.kept), "l", { outline: "z", sz: 12, bottom: "k" });
    const a = T("dlv.done.again"), b = T("dlv.done.hub"), bw = Math.max(72, c.tw(a, 12) + 16, c.tw(b, 12) + 16);
    u.button(c, 160 - bw - 6, 142, bw, a, { sel: true });
    u.button(c, 166, 142, bw, b);
  }
  function confirm(r, tick, p, st) {
    const u = U(), c = new u.C(r);
    roomDim(c, p, tick, st.env, 1, true);
    const msg = T("dlv.confirm.text"), w = Math.max(180, c.tw(msg, 10) + 24, c.tw(T("dlv.confirm.title"), 12) + 50), x = 160 - U().fd(w, 2), y = 52, h = 76;
    u.panel(c, x, y, w, h, 6);
    u.panelTitle(c, x, y + 8, w, T("dlv.confirm.title"), 12, (xx, yy) => xIcon(c, xx - 2, yy - 3));
    c.text(160, y + 30, msg, "u", { sz: 10, align: "c" });
    const a = T("dlv.confirm.yes"), b = T("dlv.confirm.no"), bw = Math.max(64, c.tw(a, 12) + 16, c.tw(b, 12) + 16), sel = p.focus != null ? p.focus : 1;
    u.button(c, 160 - bw - 6, y + h - 26, bw, a, { sel: sel === 0 });
    u.button(c, 166, y + h - 26, bw, b, { sel: sel === 1 });
    u.keybar(c, [[["left", "right"], KEY.select()], [["Enter"], KEY.confirm()], [["Esc"], KEY.back()]]);
  }

  Object.assign(PB.ui.SCREENS, { lobby, chapters, levels, settings, pause, hint, rulecard, dialogue, complete,
    reels, shop, delivery_hud: deliveryHud, settlement, settlement_fail: settlementFail, confirm });
  // The live map preview draws its HUD through PB.dui.hud: switch it to the new HUD.
  if (PB.dui) PB.dui.hud = (r, h) => hudDelivery(new (U().C)(r), h);
  PB.uiStyle = { backdrop, wall, hudDelivery, levelScene, roomScene, setFlat(v) { flat = !!v; cache.clear(); } };
})(typeof window !== "undefined" ? window : globalThis);
