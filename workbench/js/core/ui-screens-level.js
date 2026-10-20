/* UI-10a · the eight level screens in the shared G2 style.
 * Keep the scene and HUD entry points from ui-style.js: in particular its
 * setFlat seam still applies to every background and thumbnail drawn here. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const U = () => PB.uk, S = () => PB.sprites, I = () => PB.i18n;
  const G = PB.uiCommon, P = G.STYLE, K = G.kit;
  // delivery_pause dispatches through pause too; its UI-10c artwork stays as is.
  const deliveryPause = PB.ui.SCREENS.pause;
  const T = (key, vars) => G.t(key, vars), W = 320, H = 180;
  const fd = (a, b) => Math.floor(a / b);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const focusOf = (p, st, n) => clamp((p.focus != null ? p.focus : st.focus) | 0, 0, Math.max(0, n - 1));
  const themeKey = (id) => id.slice(6);
  const chapterLabel = (n) => T(n <= 5 ? "chapter.n" : "chapter.extra", { n });
  const themeName = (id) => T("theme." + themeKey(id));
  const levelText = (id, field, fallback) => I().has(`level.${id}.${field}`) ? T(`level.${id}.${field}`) : fallback;
  const KEY = { select: () => T("keys.select"), confirm: () => T("keys.confirm"), back: () => T("keys.back"), play: () => T("keys.play") };
  const fit = (c, text, sz, room) => U().clip(c, String(text || ""), sz, Math.max(0, room));
  const text = (c, x, y, s, col, sz, room, align, id) => G.line(c, x, y, s, col, { sz: sz || 12, align: align || "l" }, room, id);
  const keys = (c, items) => G.keybar(c, items, 160, 164, "c");

  function hudFor(c, spec, options) {
    const TM = PB.tilemodel, q = TM.parse(spec), goals = TM.goals(q.level, q.state);
    U().levelHud(c, spec.id, levelText(spec.id, "title", spec.title || spec.id), Object.assign({ lamps: goals.map(() => false) }, options || {}));
  }
  function levelImage(spec, env) {
    const c = U().C.make(W, H, "z");
    PB.uiStyle.levelScene(c, spec, 0, env);
    return c;
  }
  function chapterImage(theme, env) {
    const c = U().C.make(W, H, "z");
    PB.uiStyle.backdrop(c.r, theme, 0, env, true);
    return c;
  }
  // A cropped scene inside the shared G2 well, without the old window border.
  function picture(c, x, y, w, h, src, sx, sy, selected) {
    const u = U(), inside = K.well(c, x, y, w, h, selected);
    if (!src) return;
    for (const k of inside) {
      const a = u.KX(k), b = u.KY(k), col = src.get(sx + a - x, sy + b - y);
      if (col && col !== ".") c.px(a, b, col);
    }
  }
  function heading(c, x, y, s, room) { K.heading(c, x, y, fit(c, s, 12, room - 14)); }
  function linesIn(c, s, width, count, sz) {
    const u = U(), rows = u.wrap(c, String(s || ""), sz || 10, width);
    if (rows.length > count) return rows.slice(0, count - 1).concat(fit(c, rows.slice(count - 1).join(" "), sz || 10, width));
    return rows;
  }
  function pageStart(sel, count, visible) { return clamp(sel - fd(visible, 2), 0, Math.max(0, count - visible)); }

  // ---------------------------------------------------------------- chapters
  function chapterCard(c, x, y, w, h, chapter, big, env) {
    const u = U(), tm = S().get(chapter.theme).params, tw = w - 12, th = big ? 52 : 34;
    K.panel(c, x, y, w, h, !big);
    picture(c, x + 6, y + 6, tw, th, chapterImage(chapter.theme, env), 232 - fd(tw, 2), 156 - th + (big ? 2 : 1), big);
    if (chapter.locked) {
      u.dim(c, 2, [x + 6, y + 6, x + 6 + tw, y + 6 + th]);
      const lx = x + fd(w - 18, 2), ly = y + 6 + fd(th - 18, 2);
      K.plate(c, lx, ly, 18, 18);
      c.blit(u.frame("ui.icons", 5), lx + 3, ly + 3, false, G.mono(P.dis));
    }
    const progress = T("progress", { a: chapter.done, b: chapter.total });
    if (big) {
      K.plate(c, x + 1, y + 1, 24, 22);
      u.emblem(c, themeKey(chapter.theme), x + 5, y + 4);
      if (!chapter.locked) {
        const by = y + 6 + th + 6, room = w - 18;
        u.pips(c, x + 10, by + 2, chapter.done, chapter.total, 2);
        text(c, x + w - 9, by + 11, fit(c, progress, 10, room), P.sub, 10, room, "r", "chapter.progress");
      }
    } else {
      const label = chapter.locked ? chapterLabel(tm.chapter) : progress;
      const shown = fit(c, label, 10, w - 12), col = chapter.locked ? P.dis : P.sub;
      // The two distant cards deliberately extend beyond the screen edges.
      if (x < 0 || x + w > W) c.text(x + fd(w, 2), y + 6 + th + 4, shown, col, { sz: 10, align: "c" });
      else text(c, x + fd(w, 2), y + 6 + th + 4, shown, col, 10, w - 12, "c", "chapter.progress");
    }
  }
  function chapters(r, tick, p, st) {
    const u = U(), c = new u.C(r), list = p.chapters || [], sel = focusOf(p, st, list.length), current = list[sel];
    PB.uiStyle.wall(c, "theme.dungeon", tick, st.env);
    heading(c, 8, 3, T("chapters.title"), 304);
    if (!current) return;
    const tm = S().get(current.theme).params;
    const slot = (i, x, y, w, h, dim, area) => {
      if (!list[i]) return;
      chapterCard(c, x, y, w, h, list[i], false, st.env);
      u.dim(c, dim, area);
    };
    slot(sel + 2, 300, 44, 56, 54, 2, [298, 40, 320, 104]);
    slot(sel - 2, -36, 44, 56, 54, 2, [0, 40, 22, 104]);
    slot(sel - 1, 18, 36, 72, 66, 1, [14, 32, 96, 108]);
    slot(sel + 1, 230, 36, 72, 66, 1, [226, 32, 304, 108]);
    chapterCard(c, 98, 24, 124, 86, current, true, st.env);
    const name = chapterLabel(tm.chapter) + " · " + themeName(current.theme);
    text(c, 160, 114, fit(c, name, 12, 304), P.ink, 12, 304, "c", "chapter.name");
    const gap = Math.min(10, fd(260, Math.max(1, list.length - 1))), x0 = 160 - fd((list.length - 1) * gap, 2);
    list.forEach((chapter, i) => G.layered(c, G.discMask(x0 + i * gap, 133, i === sel ? 2 : 1), ["z"], i === sel ? P.cursor.fill : chapter.locked ? "x" : P.sub));
    u.glyph(c, u.ARROW.left5, x0 - 14, 131, P.cursor.fill);
    u.glyph(c, u.ARROW.right5, x0 + (list.length - 1) * gap + 12, 131, P.cursor.fill);
    const body = !current.locked ? T(`chapter.${tm.chapter}.blurb`) : tm.chapter <= 5 ? T("chapters.unlock", { chapter: chapterLabel(tm.chapter - 1), n: current.need }) : T("chapters.later");
    const rows = linesIn(c, body, 268, 2, 10), by = rows.length < 2 ? 140 : 138, bh = rows.length < 2 ? 17 : 22;
    K.plate(c, 20, by, 280, bh);
    rows.forEach((s, i) => text(c, 160, by + 3 + i * 10, s, P.sub, 10, 268, "c", "chapter.blurb"));
    keys(c, [[["left", "right"], KEY.select()], [["Enter"], KEY.play()], [["Esc"], KEY.back()]]);
  }

  // ---------------------------------------------------------------- levels
  function levels(r, tick, p, st) {
    const u = U(), c = new u.C(r), theme = p.theme || "theme.dungeon", tm = S().get(theme).params;
    const list = p.levels || [], sel = focusOf(p, st, list.length), visible = Math.min(7, list.length), start = pageStart(sel, list.length, visible);
    PB.uiStyle.wall(c, theme, tick, st.env);
    const cleared = T("levels.cleared", { a: p.done, b: list.length }), cw = Math.min(140, c.tw(cleared, 10) + 28);
    heading(c, 8, 3, T("levels.title", { chapter: chapterLabel(tm.chapter), theme: themeName(theme) }), 300 - cw);
    K.plate(c, 312 - cw, 4, cw, 15);
    c.blit(u.frame("ui.icons", 6), 316 - cw, 5);
    text(c, 307, 7, fit(c, cleared, 10, cw - 23), P.sub, 10, cw - 23, "r", "levels.cleared");
    const x = 10, y = 26, pw = 152, rh = 16, ph = Math.max(122, visible * rh + 10), dx = 168, dw = 144;
    K.panel(c, x, y, pw, ph);
    K.panel(c, dx, y, dw, ph);
    list.slice(start, start + visible).forEach((level, j) => {
      const i = start + j, ry = y + 5 + j * rh, selected = i === sel, state = selected ? "sel" : "n", col = P.btnText[state];
      const status = level.next ? "next" : level.state === "cleared" ? "ok" : level.state === "skipped" ? "skip" : "open";
      K.row(c, x + 5, ry, pw - 10, rh - 1, "", state);
      if (selected) K.cursor(c, x + 3, ry + 7);
      const idw = c.tw(level.id, 10), lx = x + 12 + idw + 5, rx = x + pw - 10;
      const tag = T("levels.next"), tagw = c.tw(tag, 10) + 8;
      const room = (status === "next" ? rx - tagw - 3 : status === "open" ? rx : rx - 14) - lx;
      text(c, x + 12, ry + 4, level.id, selected ? col : P.sub, 10, idw, "l", "level.id");
      text(c, lx, ry + 2, fit(c, levelText(level.id, "title", level.id), 12, room), col, 12, room, "l", "level.title");
      if (status === "ok" || status === "skip") c.blit(u.frame("ui.icons", status === "ok" ? 6 : 7), rx - 12, ry + 2, false, selected ? G.mono(col) : null);
      else if (status === "next") K.tag(c, rx - tagw, ry + 2, tag);
      if (j < visible - 1 && !selected && i + 1 !== sel) c.hline(x + 12, ry + rh - 1, pw - 24, "x");
    });
    const level = list[sel];
    if (level) {
      const spec = st.specs && st.specs[level.id], ty = y + 60;
      if (spec) picture(c, dx + 8, y + 8, dw - 16, 46, levelImage(spec, st.env), 90, 84);
      const idw = c.tw(level.id, 10);
      text(c, dx + 9, ty + 2, level.id, P.cursor.fill, 10, idw, "l", "level.id");
      text(c, dx + 14 + idw, ty, fit(c, levelText(level.id, "title", level.id), 12, dw - idw - 23), P.ink, 12, dw - idw - 23, "l", "level.title");
      c.hline(dx + 8, ty + 15, dw - 16, "x");
      linesIn(c, levelText(level.id, "discovery", spec && spec.discovery || ""), dw - 18, 3, 10).forEach((s, i) => text(c, dx + 9, ty + 20 + i * 12, s, P.sub, 10, dw - 18, "l", "level.discovery"));
    }
    keys(c, [[["up", "down"], KEY.select()], [["Enter"], KEY.play()], [["Esc"], KEY.back()]]);
  }

  // ---------------------------------------------------------------- settings
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
  };
  function settingValue(item) {
    if (item.type === "slider") return String(item.value);
    if (item.type === "toggle") return T(item.value ? "on" : "off");
    if (item.valueKey === "@language") return I().getLocale() === "en" ? "English" : I().getLocale() === "qps" ? "Pseudo" : "简体中文";
    return item.valueKey ? T(item.valueKey) : String(item.value == null ? "" : item.value);
  }
  function settings(r, tick, p, st) {
    const u = U(), c = new u.C(r), items = (p.items || []).filter((item) => item.key !== "settings.ui_style");
    PB.uiStyle.wall(c, "theme.dungeon", tick, st.env);
    heading(c, 8, 3, T("settings.title"), 304);
    const sel = focusOf(p, st, items.length), visible = Math.min(8, items.length), start = pageStart(sel, items.length, visible);
    const need = items.map((item) => c.tw(T(item.key), 12) + (item.type === "slider" ? 65 + c.tw(settingValue(item), 10) : item.type === "toggle" ? 25 + c.tw(settingValue(item), 12) : c.tw(settingValue(item), 12) + 22) + 44);
    const w = Math.min(300, Math.max(224, ...need)), x = 160 - fd(w, 2), y = 24, rh = 16, h = visible * rh + 10;
    K.panel(c, x, y, w, h);
    items.slice(start, start + visible).forEach((item, j) => {
      const i = start + j, ry = y + 5 + j * rh, selected = i === sel, state = item.disabled ? "dis" : selected ? "sel" : "n", col = P.btnText[state];
      K.row(c, x + 5, ry, w - 10, rh - 1, "", state);
      if (selected) K.cursor(c, x + 3, ry + 7);
      (SETTINGS_ICONS[item.key] || SETTINGS_ICONS["settings.scale"])(c, x + 11, ry + 4, selected ? col : P.sub);
      const value = settingValue(item), xr = x + w - 11;
      const vw = item.type === "slider" ? 65 + c.tw(value, 10) : item.type === "toggle" ? 25 + c.tw(value, 12) : Math.min(fd(w, 2), c.tw(value, 12) + 22);
      text(c, x + 24, ry + 2, fit(c, T(item.key), 12, w - 38 - vw), col, 12, w - 38 - vw, "l", item.key);
      if (item.type === "slider") {
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

  // ---------------------------------------------------------------- pause
  const MENU_ICON = {
    "pause.resume": ["ui.menu_icons", "continue"], "pause.hint": ["ui.icons", "hint"], "pause.restart": ["ui.icons", "restart"], "pause.skip": ["ui.icons", "skip"],
    "pause.levels": ["ui.menu_icons", "chapters"], "pause.settings": ["ui.menu_icons", "settings"], "pause.menu": ["ui.menu_icons", "quit"], "dlv.pause.restart_room": ["ui.icons", "restart"],
  };
  const MENU_KEY = { "pause.resume": "Esc", "pause.hint": "H", "pause.restart": "R" };
  function pause(r, tick, p, st) {
    if (p.room) return deliveryPause(r, tick, p, st);
    const u = U(), c = new u.C(r), delivery = !!p.room;
    if (delivery) { PB.uiStyle.roomScene(c, p, tick, st.env); PB.uiStyle.hudDelivery(c, p.hud); }
    else { PB.uiStyle.levelScene(c, st.levelSpec, tick, st.env); hudFor(c, st.levelSpec); }
    u.dim(c, 1);
    const items = (p.items || []).map((value, i) => {
      const item = typeof value === "string" ? { key: value } : value;
      return { id: item.key, label: T(item.key), icon: MENU_ICON[item.key], cap: delivery ? i === 0 ? "Esc" : null : MENU_KEY[item.key], disabled: !!item.disabled };
    });
    const sel = focusOf(p, st, items.length), y = delivery ? 34 : 24, rh = P.rowH;
    const visible = Math.min(items.length, fd(159 - y - P.titleH - P.padB, rh)), start = pageStart(sel, items.length, visible);
    const need = items.map((item) => 2 * P.padX + 12 + (item.icon || item.id === "dlv.pause.give_up" ? 16 : 0) + c.tw(item.label, 12) + (item.cap ? K.keyW(c, item.cap) + 4 : 0));
    const w = Math.min(304, Math.max(delivery ? 136 : 132, c.tw(T("pause.title"), 12) + 40, ...need)), x = 160 - fd(w, 2), h = P.titleH + visible * rh + P.padB;
    K.panel(c, x, y, w, h);
    K.title(c, x, y, w, fit(c, T("pause.title"), 12, w - 40));
    items.slice(start, start + visible).forEach((item, j) => {
      const selected = start + j === sel, state = item.disabled ? "dis" : selected ? "sel" : "n", ry = y + P.titleH + j * rh;
      const room = w - 2 * P.padX - 12 - (item.icon || item.id === "dlv.pause.give_up" ? 16 : 0) - (item.cap ? K.keyW(c, item.cap) + 4 : 0);
      if (item.id === "dlv.pause.give_up") {
        K.row(c, x + P.padX, ry, w - 2 * P.padX, rh, "", state);
        const col = P.btnText[state];
        for (let k = 0; k < 7; k++) { c.px(x + P.padX + 7 + k, ry + 4 + k, col); c.px(x + P.padX + 7 + k, ry + 10 - k, col); }
        text(c, x + P.padX + 22, ry + 2, fit(c, item.label, 12, room), col, 12, room, "l", item.id);
      } else K.row(c, x + P.padX, ry, w - 2 * P.padX, rh, fit(c, item.label, 12, room), state, { icon: item.icon, key: item.cap, id: item.id });
      if (selected) K.cursor(c, x + P.padX - 2, ry + fd(rh - 1, 2));
      if (["pause.skip", "dlv.pause.give_up"].includes(item.id) && !selected && start + j + 1 !== sel) c.hline(x + P.padX + 6, ry + rh - 1, w - 2 * P.padX - 12, "x");
    });
    keys(c, [[["up", "down"], KEY.select()], [["Enter"], KEY.confirm()], [["Esc"], KEY.back()]]);
  }

  // ---------------------------------------------------------------- bubbles
  function bubbleLayout(c, s, desiredWidth, maxWidth, maxLines) {
    const u = U();
    let width = desiredWidth, rows = u.wrap(c, s, 10, width - 12);
    while (rows.length > maxLines && width < maxWidth) { width = Math.min(width + 12, maxWidth); rows = u.wrap(c, s, 10, width - 12); }
    rows = linesIn(c, s, width - 12, maxLines, 10);
    return { rows, w: Math.max(desiredWidth, ...rows.map((row) => c.tw(row, 10) + 12)), h: 10 + rows.length * 12 };
  }
  function bubble(c, x, y, layout, targetX, thought, name) {
    const style = thought ? P.think : P.say, rc = style.rings.length, tx = clamp(targetX, x + 8, x + layout.w - 8);
    if (thought) {
      G.layered(c, G.maskOf(x + rc, y + rc, layout.w - 2 * rc, layout.h - 2 * rc, style.r), style.rings, style.fill);
      G.layered(c, G.discMask(tx - 2, y + layout.h + 2, 2), style.rings, style.fill);
      G.layered(c, G.discMask(tx + 2, y + layout.h + 7, 1), style.rings, style.fill);
    } else G.layered(c, G.sayMask(x + rc, y + rc, layout.w - 2 * rc, layout.h - 2 * rc, style.r, tx, 4, tx > x + layout.w / 2), style.rings, style.fill);
    layout.rows.forEach((s, i) => text(c, x + 6, y + 6 + i * 12, s, style.text, 10, layout.w - 12, "l", thought ? "dialogue.think" : "bubble.say"));
    if (name) K.tag(c, x + 5, y - 9, fit(c, name, 10, layout.w - 18));
  }
  function hint(r, tick, p, st) {
    const u = U(), c = new u.C(r), spec = st.levelSpec, level = clamp(p.level || ((st.focus | 0) + 1), 1, 3);
    const at = PB.uiStyle.levelScene(c, spec, tick, st.env);
    hudFor(c, spec);
    const labels = level < 3 ? [T("hint.more")] : [T("hint.demo"), T("hint.rewind")];
    const backLabel = KEY.back(), kw = K.keyW(c, "Esc") + 3 + c.tw(backLabel, 10) + 12, right = 309 - kw - 5;
    const widths = labels.map((label) => c.tw(label, 12) + 14 + (level < 3 ? K.keyW(c, "H") + 4 : 0));
    const total = widths.reduce((sum, width) => sum + width, 0) + (labels.length - 1) * 5;
    const expanded = total > right - 58, stacked = expanded && total > 304;
    const buttonRows = labels.map((label) => stacked ? u.wrap(c, label, 12, 292 - (level < 3 ? K.keyW(c, "H") + 4 : 0)) : [label]);
    const heights = buttonRows.map((rows) => Math.max(17, rows.length * 12 + 4));
    const footerH = !expanded ? 18 : !stacked ? 34 : 20 + heights.reduce((sum, height) => sum + height, 0) + (labels.length - 1) * 3;
    const footerY = 178 - footerH, controlsY = expanded ? footerY + 4 : 164;
    const s = levelText(spec.id, "hint." + level, (spec.hints || [])[level - 1] || ""), layout = bubbleLayout(c, s, 100, 224, 6);
    const tx = 104 + at.dx, ty = 97 + at.dy, x = clamp(tx - 50, 4, W - layout.w - 4), y = clamp(ty - layout.h - 9, 34, Math.max(34, footerY - 11 - layout.h));
    bubble(c, x, y, layout, tx, false, T("hint.title", { n: level }));
    K.plate(c, 4, footerY, 312, footerH);
    c.blit(u.frame("ui.icons", 2), 9, controlsY - 1);
    u.pips(c, 24, controlsY + 3, level, 3, 2);
    G.keybar(c, [[["Esc"], backLabel]], 309, controlsY, "r");
    let bx = expanded ? 160 - fd(total, 2) : right - total, by = expanded ? footerY + 18 : 162;
    labels.forEach((label, i) => {
      const state = i === 0 ? "sel" : "n", options = { key: level < 3 ? "H" : null, id: level < 3 ? "hint.more" : i ? "hint.rewind" : "hint.demo" };
      if (stacked) {
        const bw = 304, bh = heights[i], room = bw - 12 - (level < 3 ? K.keyW(c, "H") + 4 : 0), rows = buttonRows[i];
        K.button(c, 8, by, bw, bh, "", state, options);
        rows.forEach((row, j) => text(c, 14 + fd(room, 2), by + fd(bh - rows.length * 12 + 1, 2) + j * 12, row, P.btnText[state], 12, room, "c", options.id));
        by += bh + 3;
      } else {
        K.button(c, bx, by, widths[i], 14, label, state, options);
        bx += widths[i] + 5;
      }
    });
  }

  // ---------------------------------------------------------------- rule card
  function rulecard(r, tick, p, st) {
    const u = U(), c = new u.C(r), spec = st.ruleSpec || st.levelSpec;
    PB.uiStyle.levelScene(c, spec, tick, st.env);
    hudFor(c, spec, { rule: 1, sand: spec.bag ? spec.bag.sand | 0 : 0 });
    u.dim(c, 1);
    const title = T("rule.title", { name: T("rule.earth.name") }), body = T("rule.earth.text");
    let w = Math.min(280, Math.max(192, c.tw(title, 12) + 40)), rows = u.wrap(c, body, 10, w - 92);
    while (rows.length > 4 && w < 280) { w = Math.min(w + 12, 280); rows = u.wrap(c, body, 10, w - 92); }
    rows = linesIn(c, body, w - 92, 5, 10);
    const h = Math.max(116, 30 + rows.length * 12 + 36), x = 160 - fd(w, 2), y = Math.min(34, 158 - h);
    K.panel(c, x, y, w, h);
    K.title(c, x, y, w, fit(c, title, 12, w - 40));
    c.blit(u.frame("ui.class_icon", 1), x + 9, y + 7);
    picture(c, x + 12, y + 30, 56, 44, levelImage(spec, st.env), 106, 84);
    rows.forEach((s, i) => text(c, x + 80, y + 31 + i * 12, s, P.sub, 10, w - 92, "l", "rule.earth.text"));
    const label = T("rule.close"), bw = Math.min(w - 24, c.tw(label, 12) + K.keyW(c, "Esc") + 24), bx = x + fd(w - bw, 2), by = y + h - 25;
    K.button(c, bx, by, bw, 17, fit(c, label, 12, bw - K.keyW(c, "Esc") - 16), "sel", { key: "Esc", id: "rule.close" });
    K.cursor(c, bx - 3, by + 8);
  }

  // ---------------------------------------------------------------- dialogue
  function dialogue(r, tick, p, st) {
    const u = U(), c = new u.C(r), spec = st.levelSpec, at = PB.uiStyle.levelScene(c, spec, tick, st.env);
    hudFor(c, spec);
    const dx = at.dx, dy = at.dy;
    c.blit(u.frame("char.miner", 0), 146 + dx, 100 + dy, true);
    c.blit(u.frame("ui.emote", 0), 150 + dx, 87 + dy);
    const npc = bubbleLayout(c, T("dlg.sample.npc"), 152, 180, 7), nx = clamp(128 + dx, 124, 316 - npc.w), ny = clamp(40 + dy, 34, 140 - npc.h);
    bubble(c, nx, ny, npc, 156 + dx, false, T("dlg.sample.npc.name"));
    u.glyph(c, u.ARROW.down5, nx + npc.w - 11, ny + npc.h - 7, P.cursor.fill);
    const self = bubbleLayout(c, T("dlg.sample.self"), 102, 114, 7), sx = clamp(10 + dx, 4, 120 - self.w), sy = clamp(52 + dy, 34, 140 - self.h);
    bubble(c, sx, sy, self, 92 + dx, true);
    const note = T("dlg.sample.note"), rows = linesIn(c, note, 280, 2, 10), w = Math.max(80, ...rows.map((s) => c.tw(s, 10) + 28)), x = 160 - fd(w, 2), y = 150, h = rows.length * 10 + 8;
    K.plate(c, x, y, w, h);
    c.blit(u.frame("ui.emote", 0), x + 4, y + fd(h - 12, 2));
    rows.forEach((s, i) => {
      const parts = i === 0 && s.match(/^(.*?[：:]\s?)(.*)$/);
      if (parts) {
        const width = text(c, x + 20, y + 4 + i * 10, parts[1], P.cursor.fill, 10, w - 28, "l", "dialogue.note");
        text(c, x + 20 + width, y + 4 + i * 10, parts[2], P.ink, 10, w - 28 - width, "l", "dialogue.note");
      } else text(c, x + 20, y + 4 + i * 10, s, P.ink, 10, w - 28, "l", "dialogue.note");
    });
  }

  // ---------------------------------------------------------------- completion
  function complete(r, tick, p, st) {
    const u = U(), c = new u.C(r), spec = st.levelSpec, TM = PB.tilemodel, solved = TM.parse(spec);
    for (const action of spec.solution) TM.act(solved.level, solved.state, action);
    PB.uiStyle.levelScene(c, spec, tick, st.env, solved, { pose: "win" });
    const at = PB.uiStyle.levelScene(u.C.make(W, H, "z"), spec, 0, st.env);
    hudFor(c, spec, { lamps: TM.goals(solved.level, solved.state).map((goal) => goal.lit) });
    u.sparkle(c, 168 + at.dx, 112 + at.dy, P.ink, 1);
    u.sparkle(c, 178 + at.dx, 118 + at.dy, P.cursor.fill, 1);
    u.dim(c, 1, [0, 20, W, H]);
    const labels = [T("complete.next"), T("complete.levels")], title = T("complete.title"), moves = T("complete.moves", { n: spec.solution.length });
    const need = Math.max(52, ...labels.map((s) => c.tw(s, 12) + 14)), w = Math.min(304, Math.max(160, need * 2 + 32, c.tw(title, 12) + 40, c.tw(moves, 12) + 24));
    const x = 160 - fd(w, 2), y = 26, h = 76, bw = fd(w - 32, 2), sel = focusOf(p, st, 2);
    K.panel(c, x, y, w, h);
    K.title(c, x, y, w, fit(c, title, 12, w - 40));
    text(c, 160, y + 36, fit(c, moves, 12, w - 20), P.sub, 12, w - 20, "c", "complete.moves");
    labels.forEach((label, i) => {
      const bx = i ? x + w - 12 - bw : x + 12, by = y + 53;
      K.button(c, bx, by, bw, 17, fit(c, label, 12, bw - 12), i === sel ? "sel" : "n", { id: i ? "complete.levels" : "complete.next" });
      if (i === sel) K.cursor(c, bx - 3, by + 8);
    });
    keys(c, [[["left", "right"], KEY.select()], [["Enter"], KEY.confirm()]]);
  }

  Object.assign(PB.ui.SCREENS, { chapters, levels, settings, pause, hint, rulecard, dialogue, complete });
})(typeof window !== "undefined" ? window : globalThis);
