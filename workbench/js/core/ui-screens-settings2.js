/* UI-11a · the settings screen with the 「大厅皮肤」 row (user's decision 2026-10-17,
 * docs/design/ui-style.md §2): left/right picks one of the six chapter lobby skins or
 * the standard lobby (G2); the sample shows the default, S2.
 * Same drawing as settings in ui-screens-level.js, which stays untouched (it feeds the
 * confirmation hashes of eight screens); this file only replaces PB.ui.SCREENS.settings
 * and only ui.screen.settings lists it in its renderer.
 * Up to eight rows draw exactly as before. Nine rows fit above the key bar by tightening
 * the row pitch from 16 to 14 px (12px text sits 2 px higher, icons, cursor, arrows and
 * controls 1 px higher). The lobby skin row joins the language group. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  if (!PB.ui || !PB.ui.SCREENS || !PB.uiCommon) return;
  const U = () => PB.uk, I = () => PB.i18n;
  const G = PB.uiCommon, P = G.STYLE, K = G.kit;
  const T = (key, vars) => G.t(key, vars);
  const fd = (a, b) => Math.floor(a / b);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const focusOf = (p, st, n) => clamp((p.focus != null ? p.focus : st.focus) | 0, 0, Math.max(0, n - 1));
  const KEY = { select: () => T("keys.select"), back: () => T("keys.back") };
  const fit = (c, text, sz, room) => U().clip(c, String(text || ""), sz, Math.max(0, room));
  const text = (c, x, y, s, col, sz, room, align, id) => G.line(c, x, y, s, col, { sz: sz || 12, align: align || "l" }, room, id);
  const keys = (c, items) => G.keybar(c, items, 160, 164, "c");
  function heading(c, x, y, s, room) { K.heading(c, x, y, fit(c, s, 12, room - 14)); }
  function pageStart(sel, count, visible) { return clamp(sel - fd(visible, 2), 0, Math.max(0, count - visible)); }

  const SETTINGS_ICONS = {
    "settings.language"(c, x, y, col) {
      for (const [a, b] of [[2, 0], [3, 0], [4, 0], [1, 1], [5, 1], [0, 2], [6, 2], [0, 3], [6, 3], [0, 4], [6, 4], [1, 5], [5, 5], [2, 6], [3, 6], [4, 6]]) c.px(x + a, y + b, col);
      c.vline(x + 3, y + 1, 5, col); c.hline(x + 1, y + 3, 5, col);
    },
    // A small hall: filled roof, two walls, a door.
    "settings.lobby_skin"(c, x, y, col) {
      c.px(x + 3, y, col); c.hline(x + 2, y + 1, 3, col); c.hline(x + 1, y + 2, 5, col); c.hline(x, y + 3, 7, col);
      c.vline(x + 1, y + 4, 3, col); c.vline(x + 5, y + 4, 3, col); c.vline(x + 3, y + 5, 2, col);
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
    const sel = focusOf(p, st, items.length), visible = Math.min(9, items.length), start = pageStart(sel, items.length, visible);
    const need = items.map((item) => c.tw(T(item.key), 12) + (item.type === "slider" ? 65 + c.tw(settingValue(item), 10) : item.type === "toggle" ? 25 + c.tw(settingValue(item), 12) : c.tw(settingValue(item), 12) + 22) + 44);
    const rh = visible > 8 ? 14 : 16, dt = rh === 16 ? 2 : 0, ds = rh === 16 ? 0 : 1;
    const w = Math.min(300, Math.max(224, ...need)), x = 160 - fd(w, 2), y = 24, h = visible * rh + 10;
    // Group ends get a dotted rule: the lobby skin row (else language), sfx, grid.
    const ends = ["settings.sfx", "settings.grid", items.some((item) => item.key === "settings.lobby_skin") ? "settings.lobby_skin" : "settings.language"];
    K.panel(c, x, y, w, h);
    items.slice(start, start + visible).forEach((item, j) => {
      const i = start + j, ry = y + 5 + j * rh, selected = i === sel, state = item.disabled ? "dis" : selected ? "sel" : "n", col = P.btnText[state];
      K.row(c, x + 5, ry, w - 10, rh - 1, "", state);
      if (selected) K.cursor(c, x + 3, ry + 7 - ds);
      (SETTINGS_ICONS[item.key] || SETTINGS_ICONS["settings.scale"])(c, x + 11, ry + 4 - ds, selected ? col : P.sub);
      const value = settingValue(item), xr = x + w - 11;
      const vw = item.type === "slider" ? 65 + c.tw(value, 10) : item.type === "toggle" ? 25 + c.tw(value, 12) : Math.min(fd(w, 2), c.tw(value, 12) + 22);
      text(c, x + 24, ry + dt, fit(c, T(item.key), 12, w - 38 - vw), col, 12, w - 38 - vw, "l", item.key);
      if (item.type === "slider") {
        text(c, xr, ry + 4 - ds, value, col, 10, c.tw(value, 10), "r", item.key + ".value");
        K.slider(c, xr - c.tw(value, 10) - 59, ry + 3 - ds, 51, clamp(Number(item.value) / 10 || 0, 0, 1));
      } else if (item.type === "toggle") {
        text(c, xr, ry + dt, value, col, 12, c.tw(value, 12), "r", item.key + ".value");
        K.toggle(c, xr - c.tw(value, 12) - 25, ry + 2 - ds, !!item.value);
      } else if (item.key === "settings.tutorial") {
        const label = fit(c, value, 10, vw - 8);
        K.tag(c, xr - c.tw(label, 10) - 8, ry + 2 - ds, label, { alt: !selected });
      } else {
        const room = vw - 20;
        text(c, xr - 10, ry + dt, fit(c, value, 12, room), col, 12, room, "r", item.key + ".value");
        u.glyph(c, u.ARROW.left5, xr - vw + 1, ry + 5 - ds, selected ? col : P.dis);
        u.glyph(c, u.ARROW.right5, xr - 4, ry + 5 - ds, selected ? col : P.dis);
      }
      if (ends.includes(item.key) && !selected && i + 1 !== sel) c.hline(x + 11, ry + rh - 1, w - 22, "x");
    });
    keys(c, [[["up", "down"], KEY.select()], [["left", "right"], T("keys.adjust")], [["Esc"], KEY.back()]]);
  }

  PB.ui.SCREENS.settings = settings;
})(typeof window !== "undefined" ? window : globalThis);
