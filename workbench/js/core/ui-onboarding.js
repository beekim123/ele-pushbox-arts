/* UX-05 · the seven onboarding screens, version 1 (waiting for the user's approval).
 * Each one copies the layout of its approved APR-0007 screen and adds only the
 * block from docs/design/onboarding.md (§2 HUD keys, §5 rule card and clear,
 * §6 lobby, controls page and its two entries). The approved screens are drawn
 * by ui-kit.js (level HUD), ui-style.js (lobby) and ui-screens-level.js; they
 * are not changed. Text: content/i18n-onboarding (plus the old tables).
 * Screens with several versions (Mac / PC, the three rule cards) show them in
 * turn, 3 s each; p.variant or st.variant picks one. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const U = () => PB.uk, I = () => PB.i18n, FX = () => PB.onbFx, TM = () => PB.tilemodel;
  const G = PB.uiCommon, P = G.STYLE, K = G.kit;
  const T = (key, vars) => G.t(key, vars), W = 320, H = 180;
  const fd = (a, b) => Math.floor(a / b);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const focusOf = (p, st, n) => clamp((p.focus != null ? p.focus : st.focus) | 0, 0, Math.max(0, n - 1));
  const levelText = (id, field, fallback) => I().has(`level.${id}.${field}`) ? T(`level.${id}.${field}`) : fallback;
  const KEY = { select: () => T("keys.select"), confirm: () => T("keys.confirm"), back: () => T("keys.back") };
  const fit = (c, s, sz, room) => U().clip(c, String(s || ""), sz, Math.max(0, room));
  const text = (c, x, y, s, col, sz, room, align, id) => G.line(c, x, y, s, col, { sz: sz || 12, align: align || "l" }, room, id);
  const keys = (c, items) => G.keybar(c, items, 160, 164, "c");
  // Reports text that does not fit without drawing it (rows past the last slot).
  const reportOnly = (s, sz, key) => G.line(U().C.make(1, 1, "z"), 0, 0, s, "t", { sz }, 0, key);

  const SWAP = 180; // ticks per version (60 a second)
  function variantOf(list, p, st, tick) {
    const v = p.variant != null ? p.variant : st.variant;
    return list.includes(v) ? v : list[fd(tick | 0, SWAP) % list.length];
  }
  const specOf = (st, id, fallback) => (id && st.specs && st.specs[id]) || fallback;
  // The level after its first `steps` solution moves.
  function replay(spec, steps) {
    const q = TM().parse(spec);
    for (const a of spec.solution.slice(0, steps)) TM().act(q.level, q.state, a);
    return q;
  }
  function sceneImage(spec, env, parsed) {
    const c = U().C.make(W, H, "z"), at = PB.uiStyle.levelScene(c, spec, 0, env, parsed);
    return { c, o: at.o };
  }
  // Same as ui-screens-level.js: a cropped scene inside the G2 well.
  function picture(c, x, y, w, h, src, sx, sy, selected) {
    const u = U(), inside = K.well(c, x, y, w, h, selected);
    if (!src) return;
    for (const k of inside) {
      const a = u.KX(k), b = u.KY(k), col = src.get(sx + a - x, sy + b - y);
      if (col && col !== ".") c.px(a, b, col);
    }
  }
  // The approved level HUD, as in ui-screens-level.js.
  function hudFor(c, spec, options) {
    const q = TM().parse(spec), goals = TM().goals(q.level, q.state);
    U().levelHud(c, spec.id, levelText(spec.id, "title", spec.title || spec.id), Object.assign({ lamps: goals.map(() => false) }, options || {}));
  }
  function heading(c, x, y, s, room) { K.heading(c, x, y, fit(c, s, 12, room - 14)); }
  function linesIn(c, s, width, count, sz) {
    const u = U(), rows = u.wrap(c, String(s || ""), sz || 10, width);
    if (rows.length > count) return rows.slice(0, count - 1).concat(fit(c, rows.slice(count - 1).join(" "), sz || 10, width));
    return rows;
  }
  function pageStart(sel, count, visible) { return clamp(sel - fd(visible, 2), 0, Math.max(0, count - visible)); }
  // A row of keycaps (onbFx items) with its top-left at x, y; returns the width.
  const itemsW = (c, items) => FX().hintSize(c.r, items, false).w - 2;
  const drawKeys = (c, x, y, items) => FX().keyhint(c.r, x - 1, y - 1, items, { plate: false, t: 0 }).w - 2;

  // ================================================================ hud_keys
  // The approved level HUD (ui-kit.js levelHud) with a small keycap after the
  // undo, restart and hint icons (§2: Z, R, H, key text "u"; always shown).
  const HUD_ICONS = [[0, "undo"], [1, "restart"], [2, "hint"], [4, null]];
  function hudCap(c, x, y, k) {
    const w = K.keyW(c, k);
    G.box(c, x, y, w, 11, P.key);
    G.line(c, x + fd(w, 2), y + 1, k, "u", { sz: 10, align: "c" }, w - 4, "hud.key." + k);
    return w;
  }
  function hudKeysBar(c, lid, name, o) {
    const u = U();
    o = Object.assign({ lamps: [false], rule: null, sand: null }, o || {});
    c.rect(0, 0, W, 20, "z");
    let gw = 6 + o.lamps.length * 11 + 6 + 2 + (o.sand != null ? 30 : 0);
    for (const [, act] of HUD_ICONS) gw += act ? 12 + 1 + K.keyW(c, FX().KEYS[act]) + 3 : 15;
    const x0 = 318 - gw, lw = c.tw(lid, 10), extra = o.rule ? 12 : 0;
    const w = 7 + lw + 5 + c.tw(name, 12) + 7 + extra;
    u.plate(c, 2, 1, w, 18, 3);
    c.text(8, 6, lid, "l", { sz: 10 });
    let xx = 8 + lw + 5;
    text(c, xx, 4, name, "t", 12, x0 - 4 - (7 + lw + 5 + 7 + extra) - 2, "l", "hud.name"); xx += c.tw(name, 12) + 4;
    if (o.rule != null) { c.rect(xx, 6, 9, 9, "z"); c.blit(u.frame("ui.class_icon", o.rule), xx + 1, 7); }
    u.plate(c, x0, 1, gw, 18, 3);
    xx = x0 + 5;
    if (o.sand != null) {
      let bag = u.frame("item.sandbag", 0);
      if (!o.sand) bag = bag.map((r) => [...r].map((v) => u.dk(v)));
      c.blit(bag, xx - 2, 2);
      c.text(xx + 13, 6, "×" + o.sand, o.sand ? "u" : "w", { sz: 10 }); xx += 30;
    }
    for (const on of o.lamps) { c.blit(u.frame("ui.goal_lamp", on ? 1 : 0), xx, 6); if (on) c.px(xx - 1, 5, "t"); xx += 11; }
    c.vline(xx + 1, 5, 11, "x"); xx += 6;
    for (const [i, act] of HUD_ICONS) {
      c.blit(u.frame("ui.icons", i), xx, 4);
      if (act) { xx += 13; xx += hudCap(c, xx, 5, FX().KEYS[act]) + 3; } else xx += 15;
    }
    return x0;
  }
  function hudOf(c, spec, o) {
    const q = TM().parse(spec), goals = TM().goals(q.level, q.state);
    return hudKeysBar(c, spec.id, levelText(spec.id, "title", spec.title || spec.id), Object.assign({ lamps: goals.map(() => false) }, o || {}));
  }
  function hudKeys(r, tick, p, st) {
    const c = new (U().C)(r), spec = specOf(st, p.level, st.levelSpec);
    PB.uiStyle.levelScene(c, spec, tick, st.env);
    hudOf(c, spec, spec.bag && spec.bag.sand != null ? { sand: spec.bag.sand | 0 } : {});
  }

  // ================================================================ rulecard_how
  // The approved rule card (ui-screens-level.js rulecard) with one more row
  // under the picture: how to do it, keys drawn by device (§5, §7).
  const CARDS = {
    dig: { name: "rule.earth.name", body: "rule.earth.text", icon: ["ui.class_icon", 1], rule: 1, steps: 0, how: "onb.card.dig.how" },
    pour: { level: "M04", name: "extra.rule.pour.name", body: "onb.card.pour.text", icon: ["ui.class_icon", 2], rule: 2, steps: 3, crop: [60, 36], how: "onb.card.pour.how" },
    plate: { level: "M05", name: "extra.rule.plate_door.name", body: "onb.card.plate.text", icon: ["mech.link_symbol", 0], rule: null, steps: 3, crop: [86, 40], how: null },
  };
  const CARD_VARIANTS = ["dig", "pour", "pour_pc", "plate"];
  // The how text as rows of units; the hold method's modifier is drawn held
  // (§5: the sentence never says "hold", the keycap does).
  function howLayout(c, key, device, room) {
    const lay = FX().layoutThought(c, T(key), { maxW: room + 12, device, method: "hold" });
    for (const row of lay.rows) for (const u of row) if (u.items && u.items.some((it) => it.sep === "plus")) u.items = u.items.map((it, i) => (i ? it : { key: it.key, held: true }));
    return lay;
  }
  function drawHow(c, x, y, lay, col, room, key) {
    lay.rows.forEach((row, i) => {
      let xx = x, run = "", runX = x;
      const yy = y + i * 13;
      const flush = () => { if (run) text(c, runX, yy + 1, run, col, 10, room - (runX - x), "l", key); run = ""; };
      for (const u of row) {
        if (u.items) { flush(); xx += drawKeys(c, xx + 1, yy, u.items) + 2; runX = xx; continue; }
        if (!run) runX = xx;
        run += u.s; xx += c.tw(u.s, 10);
      }
      flush();
    });
    return lay.rows.length * 13;
  }
  function rulecardHow(r, tick, p, st) {
    const u = U(), c = new u.C(r), v = variantOf(CARD_VARIANTS, p, st, tick), card = CARDS[v === "pour_pc" ? "pour" : v];
    const device = v === "pour_pc" ? "pc" : "mac", spec = specOf(st, card.level, st.ruleSpec || st.levelSpec);
    const shown = card.steps ? replay(spec, card.steps) : null;
    PB.uiStyle.levelScene(c, spec, tick, st.env, card.level === "M05" ? shown : null);
    hudFor(c, spec, card.rule != null ? { rule: card.rule, sand: spec.bag ? spec.bag.sand | 0 : 0 } : {});
    u.dim(c, 1);
    const title = T("rule.title", { name: T(card.name) }), body = T(card.body);
    let w = Math.min(280, Math.max(192, c.tw(title, 12) + 40)), rows = u.wrap(c, body, 10, w - 92);
    while (rows.length > 4 && w < 280) { w = Math.min(w + 12, 280); rows = u.wrap(c, body, 10, w - 92); }
    // the how row: one line if the card can widen to fit it (up to 304)
    let how = card.how ? howLayout(c, card.how, device, w - 24) : null;
    while (how && how.rows.length > 1 && w < 304) { w = Math.min(w + 12, 304); how = howLayout(c, card.how, device, w - 24); }
    rows = linesIn(c, body, w - 92, 5, 10);
    const top = Math.max(74, 31 + rows.length * 12);
    const h = how ? top + 6 + how.rows.length * 13 + 6 + 25 : Math.max(116, 30 + rows.length * 12 + 36), x = 160 - fd(w, 2), y = Math.min(34, 158 - h);
    K.panel(c, x, y, w, h);
    K.title(c, x, y, w, fit(c, title, 12, w - 40));
    c.blit(u.frame(card.icon[0], card.icon[1]), x + 9, y + 7);
    if (card.crop) {
      const img = sceneImage(spec, st.env, shown);
      picture(c, x + 12, y + 30, 56, 44, img.c, img.o.ox + card.crop[0], img.o.oy + card.crop[1]);
    } else picture(c, x + 12, y + 30, 56, 44, sceneImage(spec, st.env).c, 106, 84);
    rows.forEach((s, i) => text(c, x + 80, y + 31 + i * 12, s, P.sub, 10, w - 92, "l", card.body));
    if (how) {
      c.hline(x + 12, y + top + 2, w - 24, "x");
      drawHow(c, x + 12, y + top + 6, how, P.ink, w - 24, card.how);
    }
    const label = T("rule.close"), bw = Math.min(w - 24, c.tw(label, 12) + K.keyW(c, "Esc") + 24), bx = x + fd(w - bw, 2), by = y + h - 25;
    K.button(c, bx, by, bw, 17, fit(c, label, 12, bw - K.keyW(c, "Esc") - 16), "sel", { key: "Esc", id: "rule.close" });
    K.cursor(c, bx - 3, by + 8);
  }

  // ================================================================ clear_found
  // The approved completion screen plus "You found" and the level's discovery
  // line (§5) between the moves and the buttons.
  function clearFound(r, tick, p, st) {
    const u = U(), c = new u.C(r), spec = specOf(st, p.level, st.levelSpec), Tm = TM(), solved = Tm.parse(spec);
    for (const action of spec.solution) Tm.act(solved.level, solved.state, action);
    PB.uiStyle.levelScene(c, spec, tick, st.env, solved, { pose: "win" });
    const at = PB.uiStyle.levelScene(u.C.make(W, H, "z"), spec, 0, st.env);
    hudFor(c, spec, { lamps: Tm.goals(solved.level, solved.state).map((goal) => goal.lit) });
    u.sparkle(c, 168 + at.dx, 112 + at.dy, P.ink, 1);
    u.sparkle(c, 178 + at.dx, 118 + at.dy, P.cursor.fill, 1);
    u.dim(c, 1, [0, 20, W, H]);
    const labels = [T("complete.next"), T("complete.levels")], title = T("complete.title"), moves = T("complete.moves", { n: spec.solution.length });
    const found = T("onb.clear.found"), line = levelText(spec.id, "discovery", spec.discovery || "");
    const need = Math.max(52, ...labels.map((s) => c.tw(s, 12) + 14));
    let w = Math.min(304, Math.max(160, need * 2 + 32, c.tw(title, 12) + 40, c.tw(moves, 12) + 24, c.tw(found, 10) + 24));
    while (u.wrap(c, line, 10, w - 24).length > 2 && w < 304) w = Math.min(304, w + 16);
    const rows = linesIn(c, line, w - 24, 3, 10);
    const x = 160 - fd(w, 2), y = 26, fy = y + 53, h = 76 + 18 + rows.length * 12 + 4, bw = fd(w - 32, 2), sel = focusOf(p, st, 2);
    K.panel(c, x, y, w, h);
    K.title(c, x, y, w, fit(c, title, 12, w - 40));
    text(c, 160, y + 36, fit(c, moves, 12, w - 20), P.sub, 12, w - 20, "c", "complete.moves");
    c.hline(x + 12, fy, w - 24, "x");
    text(c, 160, fy + 4, found, P.cursor.fill, 10, w - 24, "c", "onb.clear.found");
    rows.forEach((s, i) => text(c, 160, fy + 17 + i * 12, s, P.ink, 10, w - 24, "c", "level." + spec.id + ".discovery"));
    labels.forEach((label, i) => {
      const bx = i ? x + w - 12 - bw : x + 12, by = y + h - 23;
      K.button(c, bx, by, bw, 17, fit(c, label, 12, bw - 12), i === sel ? "sel" : "n", { id: i ? "complete.levels" : "complete.next" });
      if (i === sel) K.cursor(c, bx - 3, by + 8);
    });
    keys(c, [[["left", "right"], KEY.select()], [["Enter"], KEY.confirm()]]);
  }

  // ================================================================ hub_start
  // The approved lobby (ui-style.js) for a new save: the first item says
  // "Start" (§6) instead of "Continue"; the rest comes from the params.
  function hubStart(r, tick, p, st) {
    return PB.ui.SCREENS.lobby(r, tick, p, st);
  }

  // ================================================================ controls
  // One action per row (§6) with the keys of the §7 table (onbFx.hintItems):
  // dig and pour show the hold method (modifier drawn held) and, after a
  // divider, the alternative key; then the single keys, beside them the notes.
  const DEVICES = ["mac", "pc"];
  const DIG_DIRS = ["left", "right", "down"], POUR_DIRS = ["left", "right"];
  const SINGLE = [["onb.ctl.undo", "undo"], ["onb.ctl.restart", "restart"], ["onb.ctl.observe", "observe"], ["onb.ctl.hint", "hint"], ["onb.ctl.pause", "pause"]];
  function dirItems(ks) { const out = []; ks.forEach((k, i) => { if (i) out.push({ sep: "slash" }); out.push({ key: k }); }); return out; }
  const pressItems = (act, ks, device, method) => FX().hintItems(act, "l", device, method).slice(0, 2).concat(dirItems(ks));
  function controlsRows(device, o) {
    o = o || {};
    const fx = FX(), rows = [
      { key: "onb.ctl.move", groups: [fx.hintItems("move", "lr")] },
      { key: "onb.ctl.climb", groups: [fx.hintItems("climb", "ud")] },
      { key: "onb.ctl.dig", groups: [pressItems("dig", DIG_DIRS, device, "hold"), pressItems("dig", DIG_DIRS, device, "alt")] },
      { key: "onb.ctl.pour", groups: [pressItems("pour", POUR_DIRS, device, "hold"), pressItems("pour", POUR_DIRS, device, "alt")] },
    ];
    if (o.bomb) rows.push({ key: "onb.ctl.bomb", groups: [pressItems("bomb", DIG_DIRS, device, "hold")] });
    for (const [key, act] of SINGLE) rows.push({ key, single: true, groups: [[{ key: fx.KEYS[act] }]] });
    return rows;
  }
  const controlsNotes = (device) => ["onb.ctl.alt", "onb.ctl.mouse"].concat(device === "mac" ? ["onb.ctl.trackpad"] : []);
  function controls(r, tick, p, st) {
    const u = U(), c = new u.C(r), device = variantOf(DEVICES, p, st, tick);
    PB.uiStyle.wall(c, "theme.dungeon", tick, st.env);
    heading(c, 8, 3, T("onb.menu.controls"), 304);
    const rows = controlsRows(device, { bomb: !!p.bomb }), top = rows.filter((q) => !q.single), low = rows.filter((q) => q.single);
    const notes = controlsNotes(device), more = top.length > 4, rt = 13, rl = more ? 12 : 13;
    const x = 8, w = 304, y = more ? 22 : 24, lx = x + 10, right = x + w - 10;
    const h = 5 + top.length * rt + 5 + low.length * rl + 4;
    K.panel(c, x, y, w, h);
    const lab = Math.max(...rows.map((q) => c.tw(T(q.key), 12))), kx = lx + lab + 10;
    const holdW = Math.max(...top.map((q) => itemsW(c, q.groups[0]))), ax = kx + holdW + 13;
    top.forEach((q, i) => {
      const ry = y + 5 + i * rt;
      text(c, lx, ry, T(q.key), P.ink, 12, kx - lx - 6, "l", q.key);
      drawKeys(c, kx, ry, q.groups[0]);
      if (q.groups[1]) { c.vline(ax - 7, ry + 1, 10, "x"); drawKeys(c, ax, ry, q.groups[1]); }
    });
    const dy = y + 5 + top.length * rt + 1, ly = dy + 4;
    c.hline(lx, dy, right - lx, "x");
    const sx = kx, capW = Math.max(...low.map((q) => itemsW(c, q.groups[0]))), nx = sx + capW + 14;
    low.forEach((q, i) => {
      const ry = ly + i * rl;
      text(c, lx, ry, T(q.key), P.ink, 12, sx - lx - 6, "l", q.key);
      drawKeys(c, sx, ry, q.groups[0]);
    });
    c.vline(nx - 8, ly + 1, low.length * rl - 3, "x");
    let slot = 0;
    for (const key of notes) for (const s of u.wrap(c, T(key), 10, right - nx)) {
      if (slot < low.length) text(c, nx, ly + slot * rl + 1, s, P.sub, 10, right - nx, "l", key); else reportOnly(s, 10, key);
      slot++;
    }
    keys(c, [[["Esc"], KEY.back()]]);
  }

  // ================================================================ pause_help
  // The approved pause menu with "Controls" above "Settings" (§6). Eight rows
  // need the panel to start higher (it covers the dimmed HUD a little).
  const KEYBOARD_ICON = [
    "............",
    "............",
    "zzzzzzzzzzzz",
    "zuuuuuuuuuuz",
    "zu.u.u.u.uuz",
    "zuuuuuuuuuuz",
    "zuu.u.u.u.uz",
    "zuuuuuuuuuuz",
    "zuu......uuz",
    "zuuuuuuuuuuz",
    "zzzzzzzzzzzz",
    "............",
  ];
  const MENU_ICON = {
    "pause.resume": ["ui.menu_icons", "continue"], "pause.hint": ["ui.icons", "hint"], "pause.restart": ["ui.icons", "restart"], "pause.skip": ["ui.icons", "skip"],
    "pause.levels": ["ui.menu_icons", "chapters"], "pause.settings": ["ui.menu_icons", "settings"], "pause.menu": ["ui.menu_icons", "quit"],
  };
  const MENU_KEY = { "pause.resume": "Esc", "pause.hint": "H", "pause.restart": "R" };
  function pauseHelp(r, tick, p, st) {
    const u = U(), c = new u.C(r), spec = st.levelSpec;
    PB.uiStyle.levelScene(c, spec, tick, st.env);
    hudFor(c, spec);
    u.dim(c, 1);
    const items = (p.items || []).map((value) => {
      const item = typeof value === "string" ? { key: value } : value;
      return { id: item.key, label: T(item.key), icon: MENU_ICON[item.key], own: item.key === "onb.menu.controls", cap: MENU_KEY[item.key], disabled: !!item.disabled };
    });
    const rh = P.rowH, y = Math.min(24, 159 - P.titleH - items.length * rh - P.padB);
    const sel = focusOf(p, st, items.length), visible = Math.min(items.length, fd(159 - y - P.titleH - P.padB, rh)), start = pageStart(sel, items.length, visible);
    const need = items.map((item) => 2 * P.padX + 12 + (item.icon || item.own ? 16 : 0) + c.tw(item.label, 12) + (item.cap ? K.keyW(c, item.cap) + 4 : 0));
    const w = Math.min(304, Math.max(132, c.tw(T("pause.title"), 12) + 40, ...need)), x = 160 - fd(w, 2), h = P.titleH + visible * rh + P.padB;
    K.panel(c, x, y, w, h);
    K.title(c, x, y, w, fit(c, T("pause.title"), 12, w - 40));
    items.slice(start, start + visible).forEach((item, j) => {
      const selected = start + j === sel, state = item.disabled ? "dis" : selected ? "sel" : "n", ry = y + P.titleH + j * rh;
      const room = w - 2 * P.padX - 12 - (item.icon || item.own ? 16 : 0) - (item.cap ? K.keyW(c, item.cap) + 4 : 0);
      if (item.own) {
        K.row(c, x + P.padX, ry, w - 2 * P.padX, rh, "", state);
        const face = G.faceOf(state === "sel" ? P.rowSel : { r: 0 }, ry, rh), xx = x + P.padX + 6;
        c.blit(KEYBOARD_ICON, xx, face.top + fd(face.h - 12, 2), false, P.icons[state]);
        text(c, xx + 16, face.top + fd(face.h - 11, 2), fit(c, item.label, 12, room), P.btnText[state], 12, room, "l", item.id);
      } else K.row(c, x + P.padX, ry, w - 2 * P.padX, rh, fit(c, item.label, 12, room), state, { icon: item.icon, key: item.cap, id: item.id });
      if (selected) K.cursor(c, x + P.padX - 2, ry + fd(rh - 1, 2));
      if (item.id === "pause.skip" && !selected && start + j + 1 !== sel) c.hline(x + P.padX + 6, ry + rh - 1, w - 2 * P.padX - 12, "x");
    });
    keys(c, [[["up", "down"], KEY.select()], [["Enter"], KEY.confirm()], [["Esc"], KEY.back()]]);
  }

  // ================================================================ settings_help
  // The approved settings screen with one more row, "Controls" (§6), that opens
  // the controls page: keyboard icon, an arrow instead of a value. Nine rows
  // scroll like the approved list; a small arrow shows rows above.
  const SETTINGS_ICONS = {
    "settings.language"(c, x, y, col) {
      for (const [a, b] of [[2, 0], [3, 0], [4, 0], [1, 1], [5, 1], [0, 2], [6, 2], [0, 3], [6, 3], [0, 4], [6, 4], [1, 5], [5, 5], [2, 6], [3, 6], [4, 6]]) c.px(x + a, y + b, col);
      c.vline(x + 3, y + 1, 5, col); c.hline(x + 1, y + 3, 5, col);
    },
    "settings.music"(c, x, y, col) { c.vline(x + 4, y, 6, col); c.hline(x + 4, y, 3, col); c.px(x + 6, y + 1, col); c.rect(x + 2, y + 5, 3, 2, col); },
    "settings.sfx"(c, x, y, col) { c.rect(x, y + 2, 2, 3, col); c.vline(x + 2, y + 1, 5, col); c.vline(x + 3, y, 7, col); c.px(x + 5, y + 2, col); c.px(x + 5, y + 4, col); c.vline(x + 6, y + 1, 5, col); },
    "settings.scale"(c, x, y, col) { c.frame(x, y, 7, 7, col); c.rect(x + 2, y + 2, 3, 3, col); },
    "settings.env"(c, x, y, col) { for (const [a, b] of [[3, 0], [3, 6], [0, 3], [6, 3], [1, 1], [5, 5], [5, 1], [1, 5]]) c.px(x + a, y + b, col); c.rect(x + 2, y + 2, 3, 3, col); },
    "settings.grid"(c, x, y, col) { for (const k of [0, 3, 6]) { c.hline(x, y + k, 7, col); c.vline(x + k, y, 7, col); } },
    "settings.unlock"(c, x, y, col) { c.rect(x, y + 3, 7, 4, col); c.vline(x + 1, y, 3, col); c.hline(x + 1, y, 4, col); c.vline(x + 4, y, 2, col); c.px(x + 3, y + 4, col === "y" ? "t" : "y"); c.px(x + 3, y + 5, col === "y" ? "t" : "y"); },
    "settings.tutorial"(c, x, y, col) { for (const [a, b] of [[2, 0], [3, 0], [4, 0], [5, 1], [6, 2], [6, 3], [6, 4], [5, 5], [4, 6], [3, 6], [2, 6], [1, 5], [0, 4], [0, 3], [1, 1], [0, 1], [1, 2]]) c.px(x + a, y + b, col); c.rect(x + 3, y + 2, 1, 3, col); c.px(x + 4, y + 3, col); },
    // new: a small keyboard
    "onb.menu.controls"(c, x, y, col) {
      ["#######", "#.#.#.#", "#######", "##...##", "#######"].forEach((row, b) => [...row].forEach((ch, a) => { if (ch === "#") c.px(x + a, y + 1 + b, col); }));
    },
  };
  function settingValue(item) {
    if (item.type === "link") return "";
    if (item.type === "slider") return String(item.value);
    if (item.type === "toggle") return T(item.value ? "on" : "off");
    if (item.valueKey === "@language") return I().getLocale() === "en" ? "English" : I().getLocale() === "qps" ? "Pseudo" : "简体中文";
    return item.valueKey ? T(item.valueKey) : String(item.value == null ? "" : item.value);
  }
  function settingsHelp(r, tick, p, st) {
    const u = U(), c = new u.C(r), items = (p.items || []).filter((item) => item.key !== "settings.ui_style");
    PB.uiStyle.wall(c, "theme.dungeon", tick, st.env);
    heading(c, 8, 3, T("settings.title"), 304);
    const sel = focusOf(p, st, items.length), visible = Math.min(8, items.length), start = pageStart(sel, items.length, visible);
    const need = items.map((item) => c.tw(T(item.key), 12) + (item.type === "link" ? 14 : item.type === "slider" ? 65 + c.tw(settingValue(item), 10) : item.type === "toggle" ? 25 + c.tw(settingValue(item), 12) : c.tw(settingValue(item), 12) + 22) + 44);
    const w = Math.min(300, Math.max(224, ...need)), x = 160 - fd(w, 2), y = 24, rh = 16, h = visible * rh + 10;
    K.panel(c, x, y, w, h);
    if (start > 0) u.glyph(c, u.ARROW.up5, x + fd(w, 2) - 2, y - 4, P.sub);
    items.slice(start, start + visible).forEach((item, j) => {
      const i = start + j, ry = y + 5 + j * rh, selected = i === sel, state = item.disabled ? "dis" : selected ? "sel" : "n", col = P.btnText[state];
      K.row(c, x + 5, ry, w - 10, rh - 1, "", state);
      if (selected) K.cursor(c, x + 3, ry + 7);
      (SETTINGS_ICONS[item.key] || SETTINGS_ICONS["settings.scale"])(c, x + 11, ry + 4, selected ? col : P.sub);
      const value = settingValue(item), xr = x + w - 11;
      const vw = item.type === "link" ? 14 : item.type === "slider" ? 65 + c.tw(value, 10) : item.type === "toggle" ? 25 + c.tw(value, 12) : Math.min(fd(w, 2), c.tw(value, 12) + 22);
      text(c, x + 24, ry + 2, fit(c, T(item.key), 12, w - 38 - vw), col, 12, w - 38 - vw, "l", item.key);
      if (item.type === "link") {
        u.glyph(c, u.ARROW.right5, xr - 4, ry + 5, selected ? col : P.sub);
      } else if (item.type === "slider") {
        text(c, xr, ry + 4, value, col, 10, c.tw(value, 10), "r", item.key + ".value");
        K.slider(c, xr - c.tw(value, 10) - 59, ry + 3, 51, clamp(Number(item.value) / 10 || 0, 0, 1));
      } else if (item.type === "toggle") {
        text(c, xr, ry + 2, value, col, 12, c.tw(value, 12), "r", item.key + ".value");
        K.toggle(c, xr - c.tw(value, 12) - 25, ry + 2, !!item.value);
      } else if (item.key === "settings.tutorial") {
        const label = fit(c, value, 10, vw - 8);
        K.tag(c, xr - c.tw(label, 10) - 8, ry + 2, label, { alt: !selected });
      } else {
        const room = vw - 20;
        text(c, xr - 10, ry + 2, fit(c, value, 12, room), col, 12, room, "r", item.key + ".value");
        u.glyph(c, u.ARROW.left5, xr - vw + 1, ry + 5, selected ? col : P.dis);
        u.glyph(c, u.ARROW.right5, xr - 4, ry + 5, selected ? col : P.dis);
      }
      if (["settings.language", "settings.sfx", "settings.grid"].includes(item.key) && !selected && i + 1 !== sel) c.hline(x + 11, ry + rh - 1, w - 22, "x");
    });
    keys(c, [[["up", "down"], KEY.select()], [["left", "right"], T("keys.adjust")], [["Esc"], KEY.back()]]);
  }

  Object.assign(PB.ui.SCREENS, {
    onb_hud_keys: hudKeys, onb_rulecard_how: rulecardHow, onb_clear_found: clearFound, onb_hub_start: hubStart,
    onb_controls: controls, onb_pause_help: pauseHelp, onb_settings_help: settingsHelp,
  });
  // For the workbench test and the game port: which versions a screen cycles
  // through, and the controls page rows (action -> keycaps) per device.
  PB.onbScreens = { SWAP, VARIANTS: { onb_controls: DEVICES, onb_rulecard_how: CARD_VARIANTS }, variantOf, controlsRows, controlsNotes, CARDS, hudKeysBar };
})(typeof window !== "undefined" ? window : globalThis);
