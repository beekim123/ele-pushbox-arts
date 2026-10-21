/* OFFLINE-ART-20261020 · UI-13b candidates: the crew (optional heroes) in the
 * G2 style. Registers PB.ui.SCREENS.crew_room / crew_pick / crew_joined and
 * puts their parts on PB.uiCrew. Shared kits and the confirmed reels screen
 * are only called. Perks, costs and biographies are art-only demo copy; everything comes from params, text from content/i18n-crew
 * (perk names from content/i18n-shelf buff.*). The default porter has no
 * avatar yet: his idle frame stands in the portrait card. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const G = () => PB.uiCommon, K = () => G().kit, U = () => PB.uk, S = () => PB.sprites, Y = () => PB.uiStory;
  const t = (key, vars) => PB.i18n.t(key, vars);
  const focus = (p, st) => (p.focus != null ? p.focus : st.focus | 0);
  const NOBOX = { x: 0, y: 0, w: 0, h: 0 };
  const text = (...a) => Y().text(...a), para = (...a) => Y().para(...a), frame = (...a) => Y().frame(...a), put = (...a) => Y().put(...a);
  // Art-only crew preview list: perk = buff icon, cost = what is taken off.
  const CREW = {
    portitor: { look: "char.portitor", perk: null },
    old_miner: { look: "avatar.old_miner", perk: "night_vision" },
    bell_doll: { look: "avatar.hero_bell_doll", perk: "padding" },
    fox_mask: { look: "avatar.hero_fox_mask", perk: "running_shoes" },
    lamp_flower: { look: "avatar.hero_lamp_flower", perk: "compass" },
    little_haenyeo: { look: "avatar.hero_little_haenyeo", perk: "waterproof" },
  };
  const look = (id) => (CREW[id] || CREW.portitor).look;
  const perkIcon = (id) => { const b = (CREW[id] || {}).perk; return b && S().has("ui.buff_icons") ? frame("ui.buff_icons", b) : null; };
  function scale2(rows) { return rows.flatMap((r) => { const w = [...r].map((ch) => ch + ch).join(""); return [w, w]; }); }
  function lantern(c, x, y, lit, tick, sx) {
    const f = frame("deco.hero_lantern_tag", lit ? "lit" : "dim");
    if (f) c.blit(scale2(f), x, y);
    if (lit) U().sparkle(c, x + (sx == null ? 17 : sx), y + 3 + ((tick >> 3) % 2), "l", 1);
  }
  // Perk (+) and cost (−) rows: icon, label, text.
  function perkRows(c, x, y, id, w, gap) {
    const ic = perkIcon(id);
    G().box(c, x, y - 1, 12, 12, { r: 2, rings: ["z"], fill: "x" });
    if (ic) c.blit(shrink12(ic), x, y - 1); else text(c, x + 6, y, "+", "m", 10, 10, "c", "crew.perk");
    let lw = text(c, x + 16, y, t("crew.perk"), "m", 10, 40, "l", "crew.perk") + 5;
    text(c, x + 16 + lw, y, t("crew." + id + ".perk"), "t", 10, w - 16 - lw, "l", "crew." + id + ".perk");
    const y2 = y + (gap || 12);
    G().box(c, x, y2 - 1, 12, 12, { r: 2, rings: ["z"], fill: "x" }); U().coinIcon(c, x + 2, y2 + 1, false);
    lw = text(c, x + 16, y2, t("crew.cost"), "i", 10, 40, "l", "crew.cost") + 5;
    text(c, x + 16 + lw, y2, t("crew." + id + ".cost"), "u", 10, w - 16 - lw, "l", "crew." + id + ".cost");
  }
  // 16×16 buff icon into a 12×12 box: keep the middle 12×12 (the icons have a 2 px margin).
  function shrink12(rows) { return rows.slice(2, 14).map((r) => r.slice(2, 14)); }
  const colon = () => (/^zh/.test(PB.i18n.getLocale()) ? "：" : ": ");

  // ================================================================ crew_room
  // The lantern tags by the door (lit = moved in; dim = not yet, with the
  // short unlock condition), the selected one's portrait, line, perk and cost.
  const SLOT = { x: 7, y: 25, w: 48, h: 64, gap: 4 };
  function crewRoom(r, tick, p, st) {
    const c = new (U().C)(r), f = focus(p, st), list = p.crew;
    Y().hub(c, Object.assign({ bg: "scene.hub_crew" }, p), 2);
    Y().bar(c, t("crew.title"), t("crew.count", { n: list.filter((q) => q.unlocked).length, m: list.length }));
    list.forEach((q, i) => {
      const x = SLOT.x + i * (SLOT.w + SLOT.gap), y = SLOT.y, sel = i === f, on = !!q.unlocked;
      G().box(c, x, y, SLOT.w, SLOT.h, { r: 3, rings: sel ? ["t", "z"] : ["z"], fill: sel ? "x" : "y" });
      c.vline(x + 24, y + 2, 3, "d");
      lantern(c, x + 16, y + 5, on, tick);
      const n = para(c, x + 24, y + 28, t("crew." + q.id + ".name"), 10, SLOT.w - 4, on ? "t" : "w", 2, "crew." + q.id + ".name", 10, "c");
      if (!on) para(c, x + 24, y + 30 + n * 10, t("crew." + q.id + ".unlock.short"), 10, SLOT.w - 4, "k", 2, "crew." + q.id + ".unlock.short", 10, "c");
      if (q.home) text(c, x + 24, y + 51, t("crew.home.short"), "w", 10, SLOT.w - 4, "c", "crew.home.short");
    });
    K().cursor(c, SLOT.x + f * (SLOT.w + SLOT.gap) + 24, SLOT.y + SLOT.h + 5, "up");
    // details of the selected one
    const q = list[f] || list[0], id = q.id;
    K().panel(c, 8, 96, 304, 63, true);
    U().portrait(c, 15, 103, look(id));
    text(c, 50, 99, t("crew." + id + ".name"), q.unlocked ? "t" : "w", 12, 120, "l", "crew." + id + ".name");
    if (!q.unlocked) K().tag(c, 52 + c.tw(t("crew." + id + ".name"), 12) + 2, 99, t("crew.locked"), { alt: true });
    const sy = 113;
    if (q.unlocked) para(c, 50, sy, t("crew." + id + ".line"), 10, 254, "u", 2, "crew." + id + ".line", 11);
    else para(c, 50, sy, t("crew.unlock") + colon() + t("crew." + id + ".unlock"), 10, 254, "k", 2, "crew." + id + ".unlock", 11);
    perkRows(c, 50, 136, id, 254, 11);
    G().keybar(c, [[["left", "right"], t("keys.select")], [["Esc"], t("keys.back")]], 160, 166, "c");
  }

  // ================================================================ crew_pick
  // After the reels: today's order on top (map · cargo · recipient), the crew
  // who moved in as cards; the selected card's perk and cost underneath.
  function crewPick(r, tick, p, st) {
    const c = new (U().C)(r), f = focus(p, st), list = p.crew, o = p.order || {};
    Y().hub(c, Object.assign({ bg: "scene.hub_crew" }, p), 2);
    Y().bar(c, t("crew.pick.title"), t("crew.pick.hint"));
    // today's order
    K().panel(c, 10, 25, 300, 24, true);
    let x = 18 + text(c, 18, 31, t("crew.pick.today") + colon(), "u", 10, 90, "l", "crew.pick.today");
    const item = (rows, s, key) => {
      if (rows) { G().box(c, x, 30, 14, 14, { r: 2, rings: ["z"], fill: "x" }); put(c, rows, x + 1, 31, 12, 12); x += 17; }
      x += text(c, x, 31, s, "t", 10, 80, "l", key) + 6;
    };
    item(null, t("d2.map." + (o.world || "dungeon")), "d2.map." + (o.world || "dungeon"));
    text(c, x + 2, 31, "·", "u", 10, 10, "c", "crew.dot"); x += 6;
    const cg = frame("cargo." + o.cargo); item(cg ? shrink(cg, 12) : null, t("cargo." + o.cargo + ".name"), "cargo." + o.cargo + ".name");
    text(c, x + 2, 31, "·", "u", 10, 10, "c", "crew.dot"); x += 6;
    const av = frame("avatar." + o.recipient); item(av ? shrink(av.slice(2, 22).map((rr) => rr.slice(2, 22)), 12) : null, t("recipient." + o.recipient + ".name"), "recipient." + o.recipient + ".name");
    if (x > 306) PB.i18n.report("overflow", "crew.pick.today", NOBOX);
    // cards
    // at most 3 cards show; with more crew the row slides with the cursor
    // and small arrows mark the hidden ones.
    const VIS = 3, s0 = Math.max(0, Math.min(list.length - VIS, f - 1)), vis = list.slice(s0, s0 + VIS);
    const W = 86, GAP = 12, X0 = 160 - ((vis.length * W + (vis.length - 1) * GAP) >> 1), CY = 55, CH = 66;
    if (s0 > 0) more(c, X0 - 9, CY + 31, -1);
    if (s0 + VIS < list.length) more(c, X0 + vis.length * (W + GAP) - GAP + 6, CY + 31, 1);
    vis.forEach((q, j) => {
      const i = s0 + j, cx = X0 + j * (W + GAP), sel = i === f, off = !!q.home;
      G().box(c, cx, CY, W, CH, { r: 3, rings: sel ? ["t", "z"] : ["z"], fill: off ? "w" : sel ? "x" : "y" });
      U().portrait(c, cx + ((W - 28) >> 1), CY + 5, look(q.id));
      const nm = t("crew." + q.id + ".name"), nz = c.tw(nm, 12) <= W - 8 ? 12 : 10; // long names step down to 10 px
      text(c, cx + (W >> 1), CY + 35 + (12 - nz), nm, off ? "x" : "t", nz, W - 8, "c", "crew." + q.id + ".name");
      if (off) text(c, cx + (W >> 1), CY + 51, t("crew.home.short"), "x", 10, W - 8, "c", "crew.home.short");
      else {
        const ic = perkIcon(q.id), s = CREW[q.id] && CREW[q.id].perk ? t("buff." + CREW[q.id].perk + ".name") : t("crew.noperk"), w = c.tw(s, 10) + (ic ? 14 : 0);
        let xx = cx + ((W - w) >> 1);
        if (ic) { c.blit(shrink12(ic), xx, CY + 50); xx += 14; }
        text(c, xx, CY + 51, s, ic ? "m" : "u", 10, W - 8, "l", ic ? "buff." + CREW[q.id].perk + ".name" : "crew.noperk");
      }
      if (sel) { K().cursor(c, cx - 4, CY + 33); K().cursor(c, cx + W + 3, CY + 33, "left"); }
    });
    // the selected one's perk and cost (or why they stay home)
    const q = list[f] || list[0];
    K().panel(c, 10, 125, 300, 34, true);
    if (q.home) para(c, 160, 136, "“" + t("crew.home") + "”", 12, 280, "w", 1, "crew.home", 12, "c");
    else perkRows(c, 20, 131, q.id, 282, 12);
    G().keybar(c, [[["left", "right"], t("keys.select")], [["Enter"], t("crew.pick.send")], [["Esc"], t("keys.back")]], 160, 166, "c");
  }
  // 3×5 arrow (dir −1 = left, 1 = right) for cards out of view.
  function more(c, x, y, dir) {
    for (let k = 0; k < 3; k++) c.vline(dir < 0 ? x + k : x + 2 - k, y + 2 - k, 1 + 2 * k, "u");
  }
  function shrink(rows, n) {
    const h = rows.length, w = rows[0].length, s = Math.max(h, w) / n, out = [];
    for (let y = 0; y < Math.round(h / s); y++) {
      let row = "";
      for (let x = 0; x < Math.round(w / s); x++) row += rows[Math.min(h - 1, Math.floor((y + 0.5) * s))][Math.min(w - 1, Math.floor((x + 0.5) * s))];
      out.push(row);
    }
    return out;
  }

  // ================================================================ crew_joined
  // Someone moves in: the portrait at 2× with their lit lantern tag, the line,
  // the perk and the cost.
  function crewJoined(r, tick, p, st) {
    const c = new (U().C)(r), id = p.hero;
    Y().hub(c, Object.assign({ bg: "scene.hub_crew" }, p), 2);
    const X = 18, Yp = 28, W = 284, H = 124;
    K().panel(c, X, Yp, W, H); K().title(c, X, Yp + 1, W, t("crew.joined.title"));
    // portrait card 2×
    const px = X + 14, py = Yp + 30;
    G().box(c, px, py, 52, 52, { r: 3, rings: ["z", "k"], fill: "x" });
    c.rect(px + 2, py + 36, 48, 12, "y");
    const f = frame(look(id));
    if (f) { const big = scale2(f); c.blit(big, px + ((52 - big[0].length) >> 1), py + 52 - 2 - big.length); }
    lantern(c, px + 56, py - 2, true, tick, -3); // sparkle on the left: the title starts right after
    U().sparkle(c, px - 3, py + 8, "l", 1, "t"); U().sparkle(c, px + 50, py + 46, "k", 1);
    const tx = X + 90, tw = W - 100;
    const n = para(c, tx, Yp + 28, t("crew.joined.moved", { name: t("crew." + id + ".name") }), 12, tw, "t", 2, "crew.joined.moved", 13);
    para(c, tx, Yp + 30 + n * 13, t("crew." + id + ".line"), 10, tw, "u", 3, "crew." + id + ".line", 11);
    perkRows(c, X + 14, Yp + 94, id, W - 28, 13);
    G().keybar(c, [[["Enter"], t("keys.confirm")]], 160, 164, "c");
  }

  const ck = (fn) => function (r, tick, p, st) {
    G().takeIssues();
    try { fn(r, tick || 0, p || {}, st || {}); }
    finally { for (const it of G().takeIssues()) PB.i18n.report(it.kind, it.key, NOBOX); }
  };
  Object.assign(PB.ui.SCREENS, { crew_room: ck(crewRoom), crew_pick: ck(crewPick), crew_joined: ck(crewJoined) });
  PB.uiCrew = { CREW, SLOT, look, perkIcon, scale2, lantern, perkRows, more, shrink, shrink12, crewRoom, crewPick, crewJoined };
})(typeof window !== "undefined" ? window : globalThis);
