/* OFFLINE-ART-20261020 · tutorial review, practice and delivery assist
 * candidates in the G2 style. Registers PB.ui.SCREENS.delivery_help /
 * delivery_practice / delivery_assist and puts their parts on PB.uiHelp.
 * Shared code is only called (ui-common.js, ui-kit.js, ui-style.js,
 * ui-screens-delivery.js, rooms2.js, delivery-scene2.js are not changed;
 * ui.screen.reels and ui.screen.settings stay as they are). Everything comes
 * from params: which maps have had their first run is sample data, not a save
 * file; the practice room is the art-only geometric fixture, drawn with the
 * existing room code and never edited here. Practice shows no hearts, clock,
 * coins or rewards. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const G = () => PB.uiCommon, K = () => G().kit, U = () => PB.uk, S = () => PB.sprites;
  const t = (key, vars) => PB.i18n.t(key, vars);
  const focus = (p, st) => (p.focus != null ? p.focus : st.focus | 0);
  const NOBOX = { x: 0, y: 0, w: 0, h: 0 };
  const text = (c, x, y, s, col, sz, room, align, key) => G().line(c, x, y, s, col || "t", { sz: sz || 10, align: align || "l" }, room, key || s);
  function frame(id, anim) {
    if (!S().has(id)) return null;
    const a = S().get(id), A = typeof anim === "string" && a.animations ? a.animations[anim] : null;
    return U().frame(id, A ? A.frames[0] : typeof anim === "number" ? anim : 0);
  }
  const put = (c, rows, x, y, w, h) => { if (rows) c.blit(rows, x + ((w - rows[0].length) >> 1), y + ((h - rows.length) >> 1)); };
  // nearest-neighbour fit into n×n (keeps the aspect)
  function shrink(rows, n) {
    const h = rows.length, w = rows[0].length, s = Math.max(h, w) / n, out = [];
    if (s <= 1) return rows;
    for (let y = 0; y < Math.round(h / s); y++) {
      let row = "";
      for (let x = 0; x < Math.round(w / s); x++) row += rows[Math.min(h - 1, Math.floor((y + 0.5) * s))][Math.min(w - 1, Math.floor((x + 0.5) * s))];
      out.push(row);
    }
    return out;
  }
  // Wrapped text, at most `max` lines (more is an overflow); a Chinese line that
  // needs two lines is split in the middle instead of leaving one character alone.
  function lines(c, s, sz, w) {
    const ls = U().wrap(c, s, sz, w);
    if (ls.length === 2 && !/\s/.test(s)) {
      const a = [...s], k = Math.ceil(a.length / 2), L = [a.slice(0, k).join(""), a.slice(k).join("")];
      if (L.every((q) => c.tw(q, sz) <= w)) return L;
    }
    return ls;
  }
  function para(c, x, y, s, sz, w, col, max, key, lh) {
    const ls = lines(c, s, sz, w);
    ls.slice(0, max).forEach((ln, i) => text(c, x, y + i * (lh || sz + 1), ln, col, sz, w, "l", key));
    if (ls.length > max) PB.i18n.report("overflow", key, NOBOX);
    return Math.min(ls.length, max);
  }
  function fauna(world) {
    const main = world === "diyu" ? "diyu_dog" : world === "jeju" ? "jeju_pony" : "dungeon_cat";
    const flyer = world === "diyu" ? "diyu_butterfly" : "dungeon_bat";
    return { id: world, theme: "theme." + world, hint_fauna: [{ id: main, asset: "fauna." + main, snack: true }, { id: flyer, asset: "fauna." + flyer }] };
  }
  // The six teaching rooms (one mechanism each) and the existing art shown as
  // their list icon.
  const ICON = {
    art_demo_03: ["mech.lantern_float", "mid"], art_demo_04: ["mech.bridge", "intact"],
    art_demo_08: ["mech.rune_float", "mid"], art_demo_09: ["fx.dig_bits", 0],
    art_demo_11: ["fx.jeju_gust", "blow"], art_demo_12: ["mech.jeju_seesaw", "launch"],
  };
  const short = (s) => String(s).split(" · ")[0];

  // A room's whole view scaled to cover w×h (aspect kept, centred; the 20 px
  // HUD band on top is skipped as in the reels thumbnail).
  function thumbnail(c, room, x, y, w, h) {
    if (!room || !PB.uiDelivery2) return;
    const view = PB.uiDelivery2.roomView({ room2: room, world: room.world }, 0, true).r, src = new (U().C)(view);
    const vh = view.h - 20, s = Math.min(view.w / w, vh / h), ox = Math.floor((view.w - w * s) / 2), oy = 20 + Math.floor((vh - h * s) / 2);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) c.raw(x + dx, y + dy, src.get(ox + Math.floor(dx * s), oy + Math.floor(dy * s)));
  }
  // The teaching room as in a run (existing room drawing), with the hint marks
  // on and the porter where the first hint is shown.
  function roomScene(r, p, tick) {
    const R = PB.rooms2, D = PB.droom2, room = p.room2, world = p.world || room.world || "diyu";
    const route = (p.route || room.hint_route || room.routes[0]).split(">");
    const v = R.variant(room, !!p.mirror, route.filter((x) => x !== "gate" && x !== "recipient"));
    const M = R.start(v, route[0], route[1]);
    const P = D.run(M, { snacks: p.snacks });
    const h0 = v.hints[0], at = p.player || (h0 && h0.show && h0.show.at);
    if (at) {
      P.s.player.x = at[0]; P.s.player.y = at[1];
      if (p.facing) P.facing = p.facing;
      P.cam = R.cameraStart(v, at[0] * 16, at[1] * 16, P.facing);
    }
    const sc = D.scene(M, fauna(world));
    D.draw(r, sc, P, { tick, view: "camera", overlays: { hints: p.hints !== false }, recipient: null });
    return { v, P, sc };
  }
  // Key bar as G2's keybar; returns the x span of each item (for highlights).
  function keyItems(c, items, cx, y) {
    const P = G().STYLE;
    let w = 0;
    items.forEach(([ks, lab], n) => {
      ks.forEach((key, i) => { w += K().keyW(c, key) + (i < ks.length - 1 ? 1 : 0); });
      w += 3 + c.tw(lab, 10) + (n < items.length - 1 ? 9 : 0);
    });
    const pw = w + 12, x = cx - Math.floor(pw / 2), spans = [];
    K().plate(c, x, y - 2, pw, 15);
    let xx = x + 6;
    for (const [ks, lab] of items) {
      const x0 = xx;
      ks.forEach((key, i) => { xx += K().keycap(c, xx, y, key) + (i < ks.length - 1 ? 1 : 0); });
      xx += 3; xx += G().line(c, xx, y + 1, lab, P.plateText, { sz: 10 }) + 9;
      spans.push([x0, xx - 9]);
    }
    return { x, w: pw, spans };
  }

  // ================================================================ delivery_help
  // The departure page (the confirmed reels screen, dimmed) with its key bar
  // carrying the new 「Tab 教学回顾」 entry, lit because it opened the panel.
  // The panel lists each map's two teaching rooms with the map's first-run
  // state; the selected one gets a picture, a short line and 练习一下 / 返回.
  // p.maps: [{ world, seen, rooms: [id, id] }]; p.rooms: { id: room snapshot };
  // p.focus: 0–5 (map × 2 + room); p.departure: params of ui.screen.reels.
  function entryBar(c, p, modal) {
    const items = [[["left", "right"], t("d2.select")], [["R"], t("d2.reroll", { n: (p.departure || {}).rerolls | 0 })], [["Tab"], t("dhelp.entry")], [["Enter"], t("d2.go")]];
    const bar = keyItems(c, items, 160, 164);
    if (modal) U().dim(c, 2, [bar.x, 160, bar.x + bar.w, 178]);
    const [a, b] = bar.spans[2];
    G().box(c, a - 3, 160, b - a + 6, 15, { r: 3, rings: ["z", "m"], fill: "y" });
    const kw = K().keycap(c, a, 164, "Tab");
    G().line(c, a + kw + 3, 165, t("dhelp.entry"), "t", { sz: 10 }, null, "dhelp.entry");
    K().cursor(c, ((a + b) >> 1), 157, "up");
  }
  function help(r, tick, p, st) {
    const c = new (U().C)(r), P = G().STYLE, maps = p.maps || [], f = focus(p, st);
    if (p.departure && PB.ui.SCREENS.reels) PB.ui.SCREENS.reels(r, tick, p.departure, {});
    // view "entry": just the departure page with the new entry in its key bar
    if (p.view === "entry") { entryBar(c, p, false); return; }
    U().dim(c, 2);
    entryBar(c, p, true);
    const X = 6, Y = 3, W = 308, H = 151;
    K().panel(c, X, Y, W, H); K().title(c, X, Y + 1, W, t("dhelp.title"));
    // list: map name + first-run tag, then its two rooms
    const LX = X + 7, LW = 100, flat = [];
    maps.forEach((m, i) => {
      const y0 = Y + 26 + i * 41, tag = t(m.seen ? "dhelp.seen" : "dhelp.unseen");
      text(c, LX + 1, y0, t("d2.map." + m.world), "t", 12, LW - c.tw(tag, 10) - 12, "l", "d2.map." + m.world);
      K().tag(c, LX + LW - c.tw(tag, 10) - 8, y0, tag, { alt: !!m.seen });
      (m.rooms || []).forEach((id, j) => {
        const k = flat.length, sel = k === f, ry = y0 + 14 + j * 13, col = P.btnText[sel ? "sel" : "n"];
        flat.push({ id, m });
        if (sel) { K().row(c, LX, ry, LW, 12, "", "sel"); K().cursor(c, LX - 2, ry + 6); }
        const ic = ICON[id] && frame(ICON[id][0], ICON[id][1]);
        if (ic) put(c, shrink(ic, 10), LX + 3, ry + 1, 10, 10);
        text(c, LX + 16, ry + 1, t("dhelp.mech." + id), col, 10, LW - 19, "l", "dhelp.mech." + id);
      });
    });
    const q = flat[Math.max(0, Math.min(flat.length - 1, f))];
    if (!q) return;
    // details of the selected room
    const DX = LX + LW + 12, DW = X + W - 8 - DX, id = q.id;
    c.vline(DX - 6, Y + 25, H - 31, "x");
    G().box(c, DX, Y + 25, 98, 50, { r: 2, rings: ["z"], fill: "x" });
    thumbnail(c, (p.rooms || {})[id], DX + 1, Y + 26, 96, 48);
    const tx = DX + 104, tw = DW - 104;
    text(c, tx, Y + 26, t("dhelp.mech." + id), "t", 12, tw, "l", "dhelp.mech." + id);
    // room name: the name, then its subtitle (after " · ") on its own line(s)
    const [rn, ...sub] = t("artdemo." + id + ".name").split(" · ");
    const n1 = para(c, tx, Y + 41, rn, 10, tw, "u", 1, "artdemo." + id + ".name", 11);
    if (sub.length) para(c, tx, Y + 41 + n1 * 11, sub.join(" · "), 10, tw, "w", 3 - n1, "artdemo." + id + ".name", 11);
    para(c, DX, Y + 80, t("dhelp.desc." + id), 10, DW, "t", 2, "dhelp.desc." + id, 11);
    const note = q.m.seen ? "dhelp.seen.note" : "dhelp.unseen.note";
    para(c, DX, Y + 104, t(note, { map: t("d2.map." + q.m.world) }), 10, DW, q.m.seen ? "u" : "k", 2, note, 11);
    const b1 = buttonW(c, t("dhelp.practice"), "Enter"), b2 = buttonW(c, t("dhelp.back"), "Esc");
    K().button(c, DX, Y + 129, b1, 17, t("dhelp.practice"), "sel", { key: "Enter", id: "dhelp.practice" });
    K().button(c, DX + b1 + 6, Y + 129, b2, 17, t("dhelp.back"), "n", { key: "Esc", id: "dhelp.back" });
  }
  const buttonW = (c, label, key) => c.tw(label, 12) + K().keyW(c, key) + 4 + 14;

  // ================================================================ delivery_practice
  // The teaching room on its own: a bright 练习 badge and the room in the top
  // band (no hearts, clock, coins or bag), the hint marks on, and the practice
  // keys: R reset, Tab back to the list, Esc back to the departure page.
  function practice(r, tick, p, st) {
    const c = new (U().C)(r), id = p.room2 && p.room2.id;
    if (p.room2) roomScene(r, p, tick);
    c.rect(0, 0, 320, 20, "z"); c.hline(0, 20, 320, "k");
    const lab = t("dhelp.practice.tag"), bw = c.tw(lab, 12) + 12;
    G().box(c, 4, 3, bw, 15, { r: 3, rings: ["z"], fill: "k" });
    c.hline(6, 4, bw - 4, "l");
    text(c, 10, 5, lab, "z", 12, bw - 10, "l", "dhelp.practice.tag");
    const note = t("dhelp.practice.note"), nw = c.tw(note, 10);
    text(c, 314, 6, note, "u", 10, 140, "r", "dhelp.practice.note");
    // mechanism · room; the mechanism alone when both do not fit
    const mech = t("dhelp.mech." + id), rn = short(t("artdemo." + id + ".name"));
    const room = 314 - nw - 10 - (4 + bw + 6), full = rn.toLowerCase() === mech.toLowerCase() ? mech : mech + " · " + rn;
    const name = c.tw(full, 10) <= room ? full : mech;
    text(c, 4 + bw + 6, 6, name, "t", 10, room, "l", "artdemo." + id + ".name");
    G().keybar(c, [[["R"], t("dhelp.reset")], [["Tab"], t("dhelp.list")], [["Esc"], t("dhelp.prep")]], 160, 164, "c");
  }

  // ================================================================ delivery_assist
  // A panel of its own (the confirmed settings page is not touched): 从容 50–100 %
  // in 10 % steps, 想题停钟 on / off, one more heart after two lost runs on / off;
  // the selected row is explained underneath.
  // p: relaxed (50–100), think (bool), heart (bool), focus (0–2), theme.
  const ROWS = [
    { key: "dhelp.assist.relaxed", type: "steps", icon: ["ui.delivery_icons", "clock"] },
    { key: "dhelp.assist.think", type: "toggle", icon: ["ui.run_icons", "think"], prop: "think" },
    { key: "dhelp.assist.heart", type: "toggle", icon: ["ui.delivery_icons", "heart"], prop: "heart" },
  ];
  const pct = (v) => Math.max(50, Math.min(100, Math.round((v == null ? 70 : v) / 10) * 10));
  function assist(r, tick, p, st) {
    const c = new (U().C)(r), P = G().STYLE, f = Math.max(0, Math.min(ROWS.length - 1, focus(p, st)));
    PB.uiStyle.wall(c, p.theme || "theme.dungeon", tick, st.env);
    const hw = K().heading(c, 8, 3, t("dhelp.assist.title"));
    text(c, 313, 8, t("dhelp.assist.hint"), "u", 10, 300 - hw - 20, "r", "dhelp.assist.hint");
    const X = 24, Y = 27, W = 272, RH = 18, H = ROWS.length * RH + 10;
    K().panel(c, X, Y, W, H);
    ROWS.forEach((row, i) => {
      const ry = Y + 5 + i * RH, sel = i === f, s = sel ? "sel" : "n", col = P.btnText[s], xr = X + W - 11;
      K().row(c, X + 5, ry, W - 10, RH - 1, "", s);
      if (sel) K().cursor(c, X + 3, ry + 8);
      const ic = frame(row.icon[0], row.icon[1]);
      if (ic) put(c, shrink(ic, 12), X + 10, ry + 2, 12, 12);
      let vw;
      if (row.type === "steps") {
        const v = pct(p.relaxed), val = v + "%";
        vw = c.tw(val, 10) + 65;
        text(c, xr, ry + 4, val, col, 10, c.tw(val, 10), "r", row.key + ".value");
        const sx = xr - c.tw(val, 10) - 59;
        K().slider(c, sx, ry + 3, 51, (v - 50) / 50);
        for (let k = 0; k <= 5; k++) c.px(sx + 3 + Math.round(44 * k / 5), ry + 13, sel ? "w" : "x");
      } else {
        const on = !!p[row.prop], val = t(on ? "on" : "off");
        vw = c.tw(val, 12) + 25;
        text(c, xr, ry + 2, val, col, 12, c.tw(val, 12), "r", row.key + ".value");
        K().toggle(c, xr - c.tw(val, 12) - 25, ry + 3, on);
      }
      text(c, X + 28, ry + 2, t(row.key), col, 12, W - 44 - vw, "l", row.key);
    });
    // what the selected one does
    const row = ROWS[f], dy = Y + H + 6, DH = 38;
    K().panel(c, X, dy, W, DH, true);
    const badge = row.prop === "think";
    para(c, X + 10, dy + 8, t(row.key + ".desc", { n: pct(p.relaxed) + "%" }), 10, W - 20 - (badge ? 22 : 0), "t", 2, row.key + ".desc", 12);
    if (badge) {
      G().box(c, X + W - 26, dy + 12, 14, 14, { r: 3, rings: ["z", "m"], fill: "y" });
      put(c, frame("ui.run_icons", "think"), X + W - 23, dy + 15, 8, 8);
    }
    G().keybar(c, [[["up", "down"], t("keys.select")], [["left", "right"], t("keys.adjust")], [["Esc"], t("keys.back")]], 160, 164, "c");
  }

  const ck = (fn) => function (r, tick, p, st) {
    G().takeIssues();
    try { fn(r, tick || 0, p || {}, st || {}); }
    finally { for (const it of G().takeIssues()) PB.i18n.report(it.kind, it.key, NOBOX); }
  };
  PB.ui = PB.ui || {}; PB.ui.SCREENS = PB.ui.SCREENS || {};
  Object.assign(PB.ui.SCREENS, { delivery_help: ck(help), delivery_practice: ck(practice), delivery_assist: ck(assist) });
  PB.uiHelp = { ICON, ROWS, frame, put, shrink, lines, para, thumbnail, roomScene, keyItems, entryBar, help, practice, assist, pct };
})(typeof window !== "undefined" ? window : globalThis);
