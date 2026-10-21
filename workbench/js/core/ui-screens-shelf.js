/* OFFLINE-ART-20261020 · UI-12b candidates: the post-station shelf, the rest
 * stop, the go-home confirm, the events and the run result of one delivery run
 * (G2 style). Registers PB.ui.SCREENS.run_shelf / run_rest / run_quit /
 * run_event / run_result and adds their parts to PB.uiRun (Object.assign;
 * ui-screens-door.js is only called). Only params are drawn: the numbers of
 * the sample are written into params, no run rule is computed here.
 * New text lives in content/i18n-shelf (recipient names in content/i18n-wish). */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const G = () => PB.uiCommon, K = () => G().kit, U = () => PB.uk, S = () => PB.sprites, R = () => PB.uiRun;
  const t = (key, vars) => PB.i18n.t(key, vars);
  const focus = (p, st) => (p.focus != null ? p.focus : st.focus | 0);
  const text = (...a) => R().text(...a);
  const NOBOX = { x: 0, y: 0, w: 0, h: 0 };
  const mmss = (s) => Math.floor(s / 60) + ":" + String(Math.round(s) % 60).padStart(2, "0");

  // Wrapped 10px text; more lines than `max` is reported as an overflow.
  function para(c, x, y, s, w, col, max, key, lh) {
    const lines = U().wrap(c, s, 10, w);
    lines.slice(0, max || 99).forEach((ln, i) => text(c, x, y + i * (lh || 11), ln, col, 10, w, "l", key));
    if (max && lines.length > max) PB.i18n.report("overflow", key, NOBOX);
    return Math.min(lines.length, max || 99);
  }
  // The room snapshot (same model, scene and camera as the run page), dimmed.
  function backdrop(r, p, tick, o) {
    if (p.room2) R().roomScene(r, p, tick);
    if (o.hud && p.hud) R().hudBar(r, p, tick);
    const c = new (U().C)(r);
    U().dim(c, 2);
    if (o.bar) c.rect(0, 0, 320, 21, "z");
    return c;
  }

  // ================================================================ goods
  // A shelf good: { id, price, group: fixed|common|rare, kind: item|buff, stock, wish: recipient }.
  // flare / seal take the map's own look and name (地府: 引魂灯, 黄符).
  function goodOf(g, world) {
    const id = g.id;
    if (id === "snack" || id === "snack_jeju") {
      const sn = R().snackOf(world);
      return { art: R().frame(sn.id, sn.anim), name: t("d2.snack." + (world === "diyu" || world === "jeju" ? world : "dungeon")), desc: t("d2.snack.desc"), key: "d2.snack" };
    }
    const buffs = S().has("ui.buff_icons") ? S().get("ui.buff_icons").animations : {};
    if (g.kind === "buff" || (g.kind == null && buffs[id])) return { art: R().frame("ui.buff_icons", id), name: t(`buff.${id}.name`), desc: t(`buff.${id}.desc`), key: "buff." + id };
    const local = world === "diyu" && (id === "flare" || id === "seal") ? id + "_diyu" : id;
    return { art: R().frame("item." + local), name: t(`item.${local}.name`), desc: t(`item.${local}.desc`), key: "item." + local };
  }
  // 16×16 art centred in a box; goods without art get a grey frame + first letter.
  function art(c, x, y, w, h, gd, recolor) {
    if (gd.art) { R().put(c, gd.art, x, y, w, h, recolor); return; }
    const bx = x + ((w - 16) >> 1), by = y + ((h - 16) >> 1);
    G().box(c, bx, by, 16, 16, { r: 2, rings: ["w"], fill: "x" });
    text(c, bx + 8, by + 3, [...gd.name][0] || "?", "t", 10, 14, "c", gd.key + ".name");
  }
  const CELL = { w: 42, h: 46, gap: 4, group: 14 };
  // One shelf cell: icon well, price row (red when it can't be bought),
  // gold ring on rare goods, recipient face on a wish item, white when selected.
  function cell(c, x, y, g, o) {
    const gd = goodOf(g, o.world), sold = g.stock === 0, poor = !sold && g.price > o.coins, sel = !!o.sel, rare = g.group === "rare" || g.rare;
    const ring = rare ? "k" : sel ? "t" : sold || poor ? "x" : "u";
    G().box(c, x, y, CELL.w, CELL.h, { r: 3, rings: ["z", ring], fill: sel ? "t" : "y" });
    K().well(c, x + 9, y + 4, 24, 24, false);
    art(c, x + 9, y + 4, 24, 24, gd, sold ? G().mono("w") : null);
    if (poor) U().dim(c, 2, [x + 10, y + 5, x + 32, y + 27]);
    if (g.wish) R().face(c, x + 26, y + 19, g.wish);
    if (sold) text(c, x + 21, y + 32, t("shelf.sold"), sel ? "x" : "w", 10, CELL.w - 6, "c", "shelf.sold");
    else {
      const s = String(g.price), w = 9 + c.tw(s, 10), x0 = x + ((CELL.w - w) >> 1);
      U().coinIcon(c, x0, y + 34, false);
      text(c, x0 + 9, y + 32, s, poor ? "i" : sel ? "y" : "t", 10, CELL.w - 14, "l", "shelf.price");
    }
    return gd;
  }
  // Goods grouped 固定 | 常见 | 稀有 under small labels; returns the cells' x.
  function goodsRow(c, x, y, goods, o) {
    const at = [];
    let xx = x;
    for (const name of ["fixed", "common", "rare"]) {
      const list = goods.map((g, i) => [g, i]).filter(([g]) => (g.group || "common") === name);
      if (!list.length) continue;
      const gw = list.length * CELL.w + (list.length - 1) * CELL.gap;
      if (o.labels !== false) {
        const lw = text(c, xx + 1, y, t("shelf.group." + name), name === "rare" ? "k" : "u", 10, gw, "l", "shelf.group." + name);
        c.hline(xx + lw + 4, y + 5, Math.max(0, gw - lw - 4), name === "rare" ? "k" : "x");
      }
      list.forEach(([g, i], j) => {
        const cx = xx + j * (CELL.w + CELL.gap), cy = y + (o.labels === false ? 0 : 15);
        cell(c, cx, cy, g, { world: o.world, coins: o.coins, sel: i === o.sel });
        if (i === o.sel) K().cursor(c, cx + 21, cy - 2, "down");
        at[i] = cx;
      });
      xx += gw + CELL.group;
    }
    return at;
  }
  const goodsWidth = (goods) => {
    const n = ["fixed", "common", "rare"].map((g) => goods.filter((q) => (q.group || "common") === g).length).filter(Boolean);
    return n.reduce((a, k) => a + k * CELL.w + (k - 1) * CELL.gap, 0) + (n.length - 1) * CELL.group;
  };

  // ================================================================ top bar
  function plateIcon(c, xr, y, rows, s, key) {
    const iw = rows ? rows[0].length + 3 : 0, w = 5 + iw + c.tw(s, 10) + 5, x = xr - w;
    K().plate(c, x, y, w, 17);
    if (rows) R().put(c, rows, x + 5, y + 2, rows[0].length, 13);
    text(c, x + 5 + iw, y + 3, s, "t", 10, w, "l", key);
    return w;
  }
  function bagPlate(c, xr, y, bag, slots) {
    const w = 4 + slots * 12 + (slots - 1) * 2 + 4, x = xr - w;
    K().plate(c, x, y, w, 17);
    for (let i = 0; i < slots; i++) {
      const wx = x + 4 + i * 14;
      G().box(c, wx, y + 2, 12, 13, { r: 1, fill: "z" });
      if (bag[i]) R().put(c, R().shrink(R().frame("item." + bag[i]) || ["."], 11, 11), wx, y + 3, 12, 11);
    }
    return w;
  }
  // Heading on the left; coins, bag, cargo condition and hearts on the right.
  function statusBar(c, p, title) {
    K().heading(c, 6, 2, title);
    let xr = 314;
    xr -= K().coins(c, xr, 2, p.coins) + 3;
    if (p.bag) xr -= bagPlate(c, xr, 2, p.bag, p.slots || 3) + 3;
    if (p.cargo) xr -= plateIcon(c, xr, 2, R().shrink(R().frame("cargo." + p.cargo), 11, 11), `${p.left}/${p.max}`, "dlv.done.integrity") + 3;
    if (p.hearts != null) plateIcon(c, xr, 2, R().shrink(R().frame("ui.delivery_icons", "heart"), 9, 9), `${p.hearts}/${p.maxHearts}`, "hearts");
  }

  // ================================================================ buttons
  const SUB = { n: "u", sel: "x", dis: "w" };
  // Two-line button: label (12px) over a price / note line, optional key at the right.
  function bigButton(c, x, y, w, h, label, st, o) {
    o = o || {};
    G().box(c, x, y, w, h, G().STYLE.btn[st]);
    text(c, x + 5, y + 3, label, G().STYLE.btnText[st], 12, w - 9, "l", o.id);
    let xx = x + 5;
    const kw = o.key ? K().keyW(c, o.key) : 0;
    if (o.coin != null) { U().coinIcon(c, xx, y + 17, false); xx += 9; }
    if (o.sub != null) text(c, xx, y + 15, String(o.sub), SUB[st], 10, x + w - 6 - (kw ? kw + 3 : 0) - xx, "l", o.subId || o.id);
    if (o.key) K().keycap(c, x + w - 5 - kw, y + 14, o.key);
  }

  // ================================================================ run_shelf
  // p: room2 snapshot, world, coins, hearts / maxHearts, cargo + left / max, bag + slots,
  //    goods (6), restock (price), heal (price; 0 = free), mend (price), bank (coins kept),
  //    focus: 0–5 goods, 6 restock, 7 heal, 8 mend, 9 go home.
  function shelf(r, tick, p, st) {
    const c = backdrop(r, p, tick, { bar: true }), world = p.world || "diyu", goods = p.goods || [], f = focus(p, st);
    statusBar(c, p, t("dlv.shop.title"));
    K().panel(c, 6, 23, 308, 72);
    goodsRow(c, 6 + ((308 - goodsWidth(goods)) >> 1), 26, goods, { world, coins: p.coins, sel: f });
    K().panel(c, 6, 98, 170, 58, true);
    const B = ["restock", "heal", "mend", "quit"];
    if (f < goods.length) {
      const gd = goodOf(goods[f], world);
      art(c, 12, 102, 16, 16, gd);
      text(c, 32, 104, gd.name, "t", 12, 136, "l", gd.key + ".name");
      para(c, 13, 121, gd.desc, 156, "u", 3, gd.key + ".desc");
    } else {
      const b = B[f - goods.length] || "quit";
      text(c, 13, 104, t("shelf." + b), "t", 12, 156, "l", "shelf." + b);
      para(c, 13, 121, t("shelf." + b + ".desc"), 156, "u", 3, "shelf." + b + ".desc");
    }
    const full = p.hearts >= p.maxHearts, heal = p.heal || 0;
    const st4 = (i, ok) => (!ok ? "dis" : f === goods.length + i ? "sel" : "n");
    bigButton(c, 179, 98, 66, 27, t("shelf.restock"), st4(0, p.coins >= p.restock), { id: "shelf.restock", coin: true, sub: p.restock, key: "R" });
    bigButton(c, 248, 98, 66, 27, t("shelf.heal"), st4(1, !full && p.coins >= heal), heal ? { id: "shelf.heal", coin: true, sub: heal } : { id: "shelf.heal", sub: t("shelf.free"), subId: "shelf.free" });
    bigButton(c, 179, 129, 66, 27, t("shelf.mend"), st4(2, p.left < p.max && p.coins >= p.mend), { id: "shelf.mend", coin: true, sub: p.mend });
    bigButton(c, 248, 129, 66, 27, t("shelf.quit"), st4(3, true), { id: "shelf.quit", sub: t("shelf.bank", { n: p.bank }), subId: "shelf.bank", key: "Q" });
    G().keybar(c, [[["left", "right", "up", "down"], t("d2.select")], [["Enter"], t("d2.buy")], [["Esc"], t("d2.leave")]], 160, 164, "c");
  }

  // ================================================================ run_rest
  // p: room2, coins, hearts, cargo + left / max, snack (count), again (price),
  //    picked (index taken, or null), bank, focus 0–2 cards, 3 go home.
  // One choice row: icon well, label (12px) over a note (10px), optional tag at the right.
  function choice(c, x, y, w, h, icon, label, sub, st, o) {
    o = o || {};
    G().box(c, x, y, w, h, st === "sel" ? { r: 3, rings: ["z"], fill: "t", bottom: ["u", 1] } : G().STYLE.btn[st]);
    K().well(c, x + 3, y + 2, 24, 24, false);
    if (icon) R().put(c, icon, x + 3, y + 2, 24, 24, st === "dis" ? G().mono("w") : null);
    const tw = o.tag ? c.tw(o.tag, 10) + 8 : 0;
    text(c, x + 32, y + 2, label, G().STYLE.btnText[st], 12, w - 36 - tw, "l", o.id);
    text(c, x + 32, y + 15, sub, SUB[st], 10, w - 36 - tw, "l", o.subId || o.id);
    if (o.tag) K().tag(c, x + w - tw - 4, y + ((h - 12) >> 1), o.tag);
  }
  // The bench and the porter sitting on it, at twice the size, in a dark window.
  function benchScene(c, x, y, w, h, tick) {
    G().box(c, x, y, w, h, { r: 3, rings: ["z", "x"], fill: "z" });
    const ground = y + h - 12;
    c.rect(x + 2, ground, w - 4, 10, "y"); c.hline(x + 2, ground, w - 4, "x");
    // a roadside pavilion: dark roof with upturned eaves, two red pillars, a lantern
    c.rect(x + 18, y + 9, w - 36, 3, "z"); c.rect(x + 8, y + 12, w - 16, 4, "y"); c.hline(x + 5, y + 16, w - 10, "z");
    c.hline(x + 8, y + 12, w - 16, "x"); c.px(x + 5, y + 15, "z"); c.px(x + 4, y + 14, "z"); c.px(x + w - 6, y + 15, "z"); c.px(x + w - 5, y + 14, "z");
    for (const px of [x + 10, x + w - 13]) { c.rect(px, y + 17, 3, ground - y - 17, "i"); c.vline(px + 2, y + 17, ground - y - 17, "f"); }
    const lx = x + (w >> 1);
    c.vline(lx, y + 17, 5, "x"); c.rect(lx - 2, y + 22, 5, 6, "i"); c.hline(lx - 1, y + 22, 3, "k"); c.px(lx, y + 28, "k");
    const bench = R().scale2(R().frame("obj.bench_diyu")), sit = R().scale2(R().frame("char.portitor_delivery", "sit", (tick >> 5) % 2));
    const bx = x + ((w - 64) >> 1);
    if (bench) c.blit(bench, bx, ground - 30);
    if (sit) c.blit(sit, bx + 16, ground - 64 - 6);
  }
  function rest(r, tick, p, st) {
    const c = backdrop(r, p, tick, { bar: true }), world = p.world || "diyu", f = focus(p, st), picked = p.picked;
    statusBar(c, p, t("shelf.rest.title"));
    K().panel(c, 6, 24, 308, 112);
    benchScene(c, 14, 31, 92, 98, tick);
    const again = picked != null;
    text(c, 120, 30, again ? t("shelf.rest.again", { n: p.again }) : t("shelf.rest.free"), again ? "k" : "u", 10, 186, "l", again ? "shelf.rest.again" : "shelf.rest.free");
    const sn = R().snackOf(world), full = p.hearts >= p.maxHearts;
    const rows = [
      { icon: R().frame("ui.delivery_icons", "heart"), label: t("shelf.heal"), id: "shelf.heal", ok: !full,
        sub: full ? t("shelf.rest.full") : t("shelf.rest.heal_to", { a: p.hearts, b: p.hearts + 1 }), subId: full ? "shelf.rest.full" : "shelf.rest.heal_to" },
      { icon: R().frame("cargo." + p.cargo), label: t("shelf.mend"), id: "shelf.mend", ok: p.left < p.max,
        sub: t("shelf.rest.mend_to", { a: p.left, b: Math.min(p.max, p.left + 1) }), subId: "shelf.rest.mend_to" },
      { icon: R().frame(sn.id, sn.anim), label: t("shelf.rest.snack", { name: t("d2.snack." + (world === "diyu" || world === "jeju" ? world : "dungeon")), n: p.snack || 2 }), id: "shelf.rest.snack", ok: true,
        sub: t("shelf.rest.snack_note", { n: p.snack || 2 }), subId: "shelf.rest.snack_note" },
    ];
    rows.forEach((q, i) => {
      const taken = picked === i, stt = !q.ok || taken ? "dis" : f === i ? "sel" : "n", y = 43 + i * 30;
      choice(c, 120, y, 186, 28, q.icon, q.label, q.sub, stt, { id: q.id, subId: q.subId, tag: taken ? t("shelf.rest.picked") : null });
      if (f === i) K().cursor(c, 117, y + 14);
    });
    quitButton(c, 314, 140, p.bank, f === 3 ? "sel" : "n");
    G().keybar(c, [[["up", "down"], t("d2.select")], [["Enter"], t("keys.confirm")], [["Esc"], t("d2.leave")]], 160, 164, "c");
  }
  // One-line 「收工 · 带回 70」 button with its key, right-aligned at xr.
  function quitButton(c, xr, y, bank, st) {
    const a = t("shelf.quit"), b = t("shelf.bank", { n: bank }), kw = K().keyW(c, "Q");
    const w = 6 + c.tw(a, 12) + 6 + c.tw(b, 10) + 5 + kw + 5, x = xr - w;
    G().box(c, x, y, w, 18, G().STYLE.btn[st]);
    let xx = x + 6;
    xx += text(c, xx, y + 3, a, G().STYLE.btnText[st], 12, null, "l", "shelf.quit") + 6;
    text(c, xx, y + 4, b, SUB[st], 10, null, "l", "shelf.bank");
    K().keycap(c, x + w - 5 - kw, y + 3, "Q");
    return w;
  }

  // ================================================================ run_quit
  // p: room2, hud (as delivery_hud: coins, items ...), hand, keep, focus (0 go home, 1 not yet).
  function quit(r, tick, p, st) {
    const c = backdrop(r, p, tick, { hud: true }), f = p.focus != null ? p.focus : st.focus != null ? st.focus : 1;
    K().panel(c, 36, 30, 248, 124); K().title(c, 36, 31, 248, t("shelf.quit.title"));
    const l1 = t("shelf.quit.hand"), l2 = t("shelf.quit.keep"), n1 = String(p.hand), n2 = String(p.keep);
    const w = c.tw(l1, 10) + 4 + 9 + 3 + c.tw(n1, 12) + 10 + 9 + 10 + c.tw(l2, 10) + 4 + 9 + 3 + c.tw(n2, 12);
    let x = 160 - (w >> 1);
    x += text(c, x, 61, l1, "u", 10, null, "l", "shelf.quit.hand") + 4; U().coinIcon(c, x, 61, true); x += 12;
    x += text(c, x, 59, n1, "t", 12, null, "l", "shelf.quit.hand") + 10;
    U().glyph(c, U().ARROW.right7, x + 2, 61, "m"); x += 16;
    x += text(c, x, 61, l2, "u", 10, null, "l", "shelf.quit.keep") + 4; U().coinIcon(c, x, 61, true); x += 12;
    text(c, x, 59, n2, "m", 12, null, "l", "shelf.quit.keep");
    text(c, 160, 80, t("shelf.quit.rule"), "u", 10, 228, "c", "shelf.quit.rule");
    text(c, 160, 95, t("shelf.quit.no_tip"), "t", 10, 228, "c", "shelf.quit.no_tip");
    const wish = ((p.hud && p.hud.items) || []).find((id) => /^wish_/.test(id));
    if (wish) {
      const s = t("shelf.quit.wish", { name: t(`item.${wish}.name`) }), ww = 16 + 4 + c.tw(s, 10), wx = 160 - (ww >> 1);
      c.blit(R().frame("item." + wish), wx, 105);
      text(c, wx + 20, 108, s, "i", 10, 228 - 20, "l", "shelf.quit.wish");
    }
    K().button(c, 48, 128, 106, 20, t("shelf.quit.yes"), f === 0 ? "sel" : "n", { id: "shelf.quit.yes" });
    K().button(c, 166, 128, 106, 20, t("shelf.quit.no"), f === 1 ? "sel" : "n", { id: "shelf.quit.no" });
    G().keybar(c, [[["left", "right"], t("d2.select")], [["Enter"], t("keys.confirm")], [["Esc"], t("d2.back")]], 160, 164, "c");
  }

  // ================================================================ run_event
  // p: room2, hud, world, event (ghost_peddler | forgetful_soup | lantern_riddle |
  //    lost_parcel | haunted_crate), recipient, forget (item id), goods (peddler),
  //    guesses (3 wish item ids, riddle), guess (index), focus (0 first choice, 1 second).
  const EVENTS = ["ghost_peddler", "forgetful_soup", "lantern_riddle", "lost_parcel", "haunted_crate"];
  function picture(c, ev, x, y, w, h, tick) {
    G().box(c, x, y, w, h, { r: 3, rings: ["z", "x"], fill: "z" });
    c.rect(x + 2, y + h - 12, w - 4, 10, "y"); c.hline(x + 2, y + h - 12, w - 4, "x");
    const ground = y + h - 12, s2 = (id, anim, i) => R().scale2(R().frame(id, anim, i));
    const at = (rows, cx, by) => rows && c.blit(rows, cx - (rows[0].length >> 1), by - rows.length);
    if (ev === "forgetful_soup") { at(s2("obj.event_stall_diyu", "soup", (tick >> 3) % 3), x + 40, ground + 2); at(s2("char.meng_po", "idle", (tick >> 4) % 2), x + 86, ground); }
    else if (ev === "lantern_riddle") at(s2("obj.event_stall_diyu", "riddle", (tick >> 4) % 2), x + (w >> 1), ground + 2);
    else if (ev === "ghost_peddler") {
      at(s2("obj.event_stall_diyu", "idle", (tick >> 3) % 4), x + 40, ground + 2);
      c.line(x + 78, y + 10, x + 96, y + 10, "f"); c.vline(x + 88, y + 10, 6, "f");
      at(s2("item.flare_diyu"), x + 88, y + 50);
    } else if (ev === "lost_parcel") {
      const cx = x + (w >> 1), box = s2("obj.crate_wood");
      at(box, cx, ground + 1);
      c.vline(cx, ground - 31, 32, "f"); c.hline(cx - 16, ground - 16, 32, "f");
      G().box(c, cx + 6, ground - 26, 14, 10, { r: 1, rings: ["z"], fill: "t" }); c.hline(cx + 8, ground - 23, 9, "w"); c.hline(cx + 8, ground - 20, 6, "w");
    } else if (ev === "haunted_crate") {
      const cx = x + 44;
      at(s2("obj.crate_wood"), cx, ground + 1);
      for (const [dx, dy] of [[-21, -26], [-23, -14], [20, -28], [22, -16]]) c.hline(cx + dx, ground + dy, 3, "u");
      at(s2("monster.wandering_soul", "float", (tick >> 3) % 4), x + 84, ground - 22);
    }
  }
  function event(r, tick, p, st) {
    const c = backdrop(r, p, tick, { hud: true }), world = p.world || "diyu", ev = EVENTS.includes(p.event) ? p.event : "forgetful_soup";
    const f = focus(p, st), bag = (p.hud && p.hud.items) || [], E = (k) => `event.${ev}.${k}`;
    const snack = t("d2.snack." + (world === "diyu" || world === "jeju" ? world : "dungeon"));
    K().panel(c, 10, 23, 300, 137);
    picture(c, ev, 18, 31, 108, 76, tick);
    // the bag (what the soup would take away)
    text(c, 18, 114, t("dlv.shop.bag"), "u", 10, 26, "l", "dlv.shop.bag");
    const forget = ev === "forgetful_soup" ? p.forget : null;
    for (let i = 0; i < (p.hud && p.hud.slots || 3); i++) {
      const wx = 46 + i * 23, id = bag[i];
      G().box(c, wx, 110, 19, 19, { r: 2, rings: [id && id === forget ? "i" : "z"], fill: "z" });
      if (id) { R().put(c, R().frame("item." + id), wx + 1, 111, 17, 17); if (/^wish_/.test(id) && p.recipient) R().face(c, wx + 9, 119, p.recipient); }
    }
    if (forget) {
      text(c, 18, 133, t("event.forget") + "：" + t(`item.${forget}.name`), "i", 10, 108, "l", "event.forget");
      if (bag.some((id) => /^wish_/.test(id))) text(c, 18, 144, t("event.wish_safe"), "u", 10, 108, "l", "event.wish_safe");
    }
    // the text and the two choices
    const x = 134, w = 168;
    text(c, x, 29, t(E("name")), "t", 12, w, "l", E("name"));
    c.hline(x, 43, w, "x");
    let y = 47 + para(c, x, 47, t(E("text"), { snack }), w, "t", 4, E("text")) * 11 + 2;
    if (ev === "ghost_peddler") {
      const goods = p.goods || [];
      goodsRow(c, x, y + 3, goods, { world, coins: (p.hud && p.hud.coins) || 0, sel: p.pick != null ? p.pick : -1, labels: false });
      y += 3 + CELL.h + 4;
    }
    if (ev === "lantern_riddle") {
      (p.guesses || []).forEach((id, i) => {
        const wx = x + i * 30;
        K().well(c, wx, y + 3, 26, 26, i === p.guess);
        R().put(c, R().frame("item." + id), wx, y + 3, 26, 26, G().mono(i === p.guess ? "t" : "w"));
      });
      para(c, x + 94, y + 4, t("event.lantern_riddle.pick"), w - 94, "u", 2, "event.lantern_riddle.pick");
      y += 3 + 26 + 4;
    }
    const empty = ev === "forgetful_soup" && !forget;
    let bottom = y + 18;
    const vars = { item: forget ? t(`item.${forget}.name`) : "", snack };
    ["a", "b"].forEach((k, i) => {
      const bx = x + i * 86, dis = i === 0 && empty;
      K().button(c, bx, y, 82, 18, t(E(k)), dis ? "dis" : f === i ? "sel" : "n", { id: E(k) });
      const noteKey = dis ? E("empty") : E(k + "_note"), note = PB.i18n.has ? (PB.i18n.has(noteKey) ? t(noteKey, vars) : "") : t(noteKey, vars);
      if (note && note !== noteKey) bottom = Math.max(bottom, y + 21 + para(c, bx + 1, y + 21, note, 81, "u", 2, noteKey, 10) * 10);
    });
    if (bottom > 158) PB.i18n.report("overflow", E("layout"), NOBOX);
    G().keybar(c, [[["left", "right"], t("d2.select")], [["Enter"], t("keys.confirm")]], 160, 164, "c");
  }

  // ================================================================ run_result
  // p: room2 (home), end: delivered | quit | gave_up | failed, recipient, cargo, gift (wish item given),
  //    left / max, secs, par, timePct, likePct, base, tip, hand, wish (thanks coins), keep,
  //    score, rating, bond, stamps, think (想题停钟 was on), focus.
  function result(r, tick, p, st) {
    const c = backdrop(r, p, tick, { bar: true }), k = K(), u = U(), end = p.end || "delivered", done = end === "delivered";
    k.panel(c, 6, 5, 308, 149);
    k.title(c, 6, 5, 308, t({ delivered: "dlv.done.title", quit: "run.quit", gave_up: "run.gave_up", failed: "dlv.fail.title" }[end] || "dlv.done.title"));
    if (done && p.rating) {
      const tw = c.tw(String(p.rating), 10) + 8;
      k.tag(c, 302 - tw, 13, String(p.rating));
      if (p.score != null) text(c, 298 - tw, 14, String(p.score), "u", 10, 24, "r", "run.rating");
    }
    if (p.think) { G().box(c, 14, 11, 14, 14, { r: 3, rings: ["z", "m"], fill: "y" }); c.blit(R().frame("ui.run_icons", "think"), 17, 14); }
    // recipient card: portrait, name, the wish gift handed over, the cargo
    k.panel(c, 13, 32, 82, 114, true);
    u.portrait(c, 40, 37, "avatar." + p.recipient);
    text(c, 54, 68, t(`recipient.${p.recipient}.name`), "t", 10, 72, "c", `recipient.${p.recipient}.name`);
    if (p.gift) {
      text(c, 20, 84, t("run.gift"), "u", 10, 68, "l", "run.gift");
      c.blit(R().frame("item." + p.gift), 19, 95, false, done ? null : G().mono("w"));
      text(c, 38, 99, t(`item.${p.gift}.name`), done ? "t" : "w", 10, 52, "l", `item.${p.gift}.name`);
    }
    c.blit(u.frame("cargo." + p.cargo, 0), 19, 122);
    text(c, 38, 126, t(`cargo.${p.cargo}.name`), "t", 10, 52, "l", `cargo.${p.cargo}.name`);
    // rows
    const x = 104, mid = 186, right = 300, dash = "—";
    const row = (y, key, mid_, val, col, icon) => {
      text(c, x, y, t(key), "u", 10, 78, "l", key);
      if (mid_ != null) text(c, mid, y, String(mid_), "u", 10, right - (val === "" ? 0 : 34) - mid, "l", key);
      if (icon) c.blit(icon, 262, y - 2);
      text(c, right, y, String(val), col || "t", 10, 40, "r", key);
    };
    row(34, "dlv.done.integrity", null, `${p.left}/${p.max}`);
    row(46, "dlv.done.time", t("run.time", { t: mmss(p.secs), par: mmss(p.par) }), "");
    row(58, "run.time_pct", null, done ? p.timePct : dash, done ? "m" : "w");
    row(70, "run.like_pct", null, done ? p.likePct : dash, done ? "m" : "w", done ? R().shrink(u.frame("ui.delivery_icons", 0), 11, 11) : null);
    c.hline(x, 83, right - x, "x");
    row(87, "dlv.done.tip", done ? t("dlv.done.base", { n: p.base }) : null, done ? p.tip : dash, done ? "t" : "w");
    row(99, "run.hand", end === "quit" ? t("run.rule80") : end === "delivered" ? null : t("run.half"), p.hand);
    row(111, "run.wish", null, done && p.wish ? p.wish : dash, done && p.wish ? "t" : "w", done && p.gift ? R().shrink(R().frame("item." + p.gift), 11, 11) : null);
    c.hline(x, 124, right - x, "x");
    text(c, x, 128, t("run.keep"), "t", 12, 110, "l", "run.keep");
    u.coinIcon(c, 263, 129, true);
    text(c, right, 128, String(p.keep), "m", 12, 28, "r", "run.keep");
    if (p.bond != null) text(c, x, 142, t("run.note", { a: p.bond, b: p.stamps || 0 }), "u", 10, right - x, "l", "run.note");
    const labels = [t("dlv.done.again"), t("dlv.done.hub")], bw = Math.max(88, ...labels.map((s) => c.tw(s, 12) + 18));
    labels.forEach((s, i) => k.button(c, 160 - bw - 4 + i * (bw + 8), 158, bw, 18, s, focus(p, st) === i ? "sel" : "n", { id: i ? "dlv.done.hub" : "dlv.done.again" }));
  }

  const ck = (fn) => R().checked(fn);
  Object.assign(PB.ui.SCREENS, { run_shelf: ck(shelf), run_rest: ck(rest), run_quit: ck(quit), run_event: ck(event), run_result: ck(result) });
  PB.uiRun = Object.assign(PB.uiRun || {}, {
    CELL, EVENTS, goodOf, cell, goodsRow, goodsWidth, statusBar, plateIcon, bagPlate, bigButton, choice, benchScene, quitButton, picture, para, mmss,
    shelf, rest, quit, event, result,
  });
})(typeof window !== "undefined" ? window : globalThis);
