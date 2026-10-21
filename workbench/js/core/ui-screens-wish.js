/* OFFLINE-ART-20261020 · UI-12c candidates: the wish slip on the stopped reels,
 * the lucky slip (上上签) and handing over the wish gift (G2 style).
 * Registers PB.ui.SCREENS.run_wish_card / run_lucky / run_wish_give and adds
 * their parts to PB.uiRun. The confirmed reels screen is called first and only
 * drawn over (ui-screens-delivery.js is not changed); door / shelf kits are
 * only called. Everything comes from params. New text: content/i18n-wish. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const G = () => PB.uiCommon, K = () => G().kit, U = () => PB.uk, R = () => PB.uiRun;
  const t = (key, vars) => PB.i18n.t(key, vars);
  const text = (...a) => R().text(...a);
  const NOBOX = { x: 0, y: 0, w: 0, h: 0 };
  const itemOf = (p) => p.item || "wish_palm_fan";

  // ================================================================ slips
  // The small wish slip hung at (hx, hy): red band, the wish item as a
  // one-colour silhouette until it has been delivered once, then in colour.
  function wishSlip(c, hx, hy, o) {
    const w = 20, h = 24, x = hx - (w >> 1), y = hy + 4, gold = !!o.gold;
    c.vline(hx, hy, 4, "i");
    G().box(c, x, y, w, h, { r: 1, rings: ["z"], fill: gold ? "k" : "c" });
    if (gold) { c.vline(x + 1, y + 4, h - 6, "l"); c.hline(x + 2, y + h - 2, w - 4, "j"); }
    c.rect(x + 1, y + 1, w - 2, 3, "h"); c.px(hx, y + 2, gold ? "l" : "k");
    const ic = R().frame("item." + o.item);
    if (ic) R().put(c, ic, x + 2, y + 5, 16, 16, o.known ? null : G().mono("x"));
    c.vline(hx, y + h, 2, "i"); c.px(hx - 1, y + h + 2, "i"); c.px(hx + 1, y + h + 2, "i");
  }
  // The big gold 上上签: gold paper, red band and seal, the wish item in colour.
  function luckySlip(c, x, y, item, tick) {
    const w = 34, h = 58, hx = x + (w >> 1);
    c.line(hx - 8, y - 6, hx, y, "i"); c.line(hx + 8, y - 6, hx, y, "i");
    G().box(c, x, y, w, h, { r: 2, rings: ["z", "j"], fill: "k" });
    c.vline(x + 3, y + 8, h - 12, "l"); c.hline(x + 3, y + h - 4, w - 6, "j");
    c.rect(x + 2, y + 2, w - 4, 4, "h"); c.hline(x + 2, y + 6, w - 4, "a");
    G().box(c, x + 5, y + 11, 24, 24, { r: 2, rings: ["j"], fill: "l" });
    R().put(c, R().frame("item." + item), x + 5, y + 11, 24, 24);
    G().box(c, x + 11, y + 40, 12, 12, { r: 1, rings: ["h"], fill: "i" });
    c.hline(x + 14, y + 44, 6, "c"); c.vline(x + 17, y + 42, 8, "c"); c.hline(x + 14, y + 48, 6, "c");
    const s = (tick >> 3) % 4;
    U().sparkle(c, x + w + 2, y + 8 + s, "l", 1, "t"); U().sparkle(c, x - 3, y + 30 - s, "l", 1, "t");
  }
  // Coloured tag (fill / ink of the caller): 双喜临门 gold, 念念不忘 red-pink.
  function tagC(c, xr, y, s, fill, ink, key) {
    const w = c.tw(s, 10) + 8, x = xr - w;
    G().box(c, x, y, w, 12, { r: 2, rings: ["z"], fill });
    text(c, x + 4, y + 1, s, ink, 10, w - 6, "l", key);
    return w;
  }

  // ================================================================ reels + slip
  // The recipient card of the reels screen is at x 117, y 27, 86 × 90; the
  // slip hangs from its right edge, the info panel underneath gets a third row.
  const CARD = { x: 117, y: 27, w: 86, h: 90 }, SLIP = { x: 203, y: 86 };
  function infoRows(c, p, row3) {
    K().panel(c, 10, 119, 300, 41, true);
    text(c, 18, 122, t(`cargo.${p.cargo}.name`) + " · " + t(`cargo.${p.cargo}.rule`), "t", 10, 284, "l", `cargo.${p.cargo}.rule`);
    const tip = p.liked ? t("d2.tip") : "", tw = tip ? c.tw(tip, 10) + 8 : 0;
    text(c, 18, 134, t(`recipient.${p.recipient}.name`) + " · " + t(`recipient.${p.recipient}.rule`), "u", 10, 284 - (tw ? tw + 6 : 0), "l", `recipient.${p.recipient}.rule`);
    if (tip) K().tag(c, 302 - tw, 133, tip);
    row3(c, 146);
  }
  function wishRow(c, y, p) {
    const rid = p.recipient, item = itemOf(p), known = !!p.known;
    c.blit(R().frame("ui.run_icons", "wish"), 18, y + 1);
    let x = 29;
    x += text(c, x, y, t("wish.slip") + (/^zh/.test(PB.i18n.getLocale()) ? "：" : ": "), "k", 10, 60, "l", "wish.slip");
    const s = known ? t(`item.${item}.name`) : t(`wish.${rid}.hint`), key = known ? `item.${item}.name` : `wish.${rid}.hint`;
    const tag = p.first && !known ? t("wish.first") : "", tw = tag ? c.tw(tag, 10) + 8 : 0;
    text(c, x, y, s, "t", 10, 302 - x - (tw ? tw + 6 : 0), "l", key);
    if (tag) K().tag(c, 302 - tw, y - 1, tag, { alt: true });
  }
  // p: everything ui.screen.reels takes (map / recipient / cargo lists, room2 ...)
  //    + item (wish item), known (delivered once: colour + name), first (first draw).
  function wishCard(r, tick, p, st) {
    PB.ui.SCREENS.reels(r, tick, p, st);
    const c = new (U().C)(r);
    wishSlip(c, SLIP.x, SLIP.y, { item: itemOf(p), known: !!p.known });
    infoRows(c, p, (cc, y) => wishRow(cc, y, p));
  }

  // ================================================================ run_lucky
  // p: as run_wish_card + reason ("remembered" adds 念念不忘), double (缘分 also hit),
  //    combo: { recipient, cargo }, slots.
  // The confirmed screen drawn without its key bar: the modal brings its own.
  function bare(fn) { const g = G(), kb = g.keybar; g.keybar = () => 0; try { fn(); } finally { g.keybar = kb; } }
  function lucky(r, tick, p, st) {
    bare(() => PB.ui.SCREENS.reels(r, tick, p, st));
    const c = new (U().C)(r), item = itemOf(p), rid = p.recipient;
    wishSlip(c, SLIP.x, SLIP.y, { item, known: true, gold: true });
    U().dim(c, 2);
    const X = 24, Y = 26, W = 272, H = 132;
    K().panel(c, X, Y, W, H); K().title(c, X, Y + 1, W, t("wish.lucky"));
    luckySlip(c, 37, 54, item, tick);
    U().portrait(c, 86, 54, "avatar." + rid);
    text(c, 100, 86, t(`recipient.${rid}.name`), "t", 10, 60, "c", `recipient.${rid}.name`);
    // the gift flying from the portrait into bag slot 1
    const bx = 232, by = 100, ax = 116, ay = 64, ex = bx + 9, ey = by + 2;
    for (let i = 1; i < 14; i++) {
      const k = i / 14, qx = Math.round(ax + (ex - ax) * k), qy = Math.round(ay + (ey - ay) * k - 20 * 4 * k * (1 - k));
      if (i % 2) c.px(qx, qy, i > 9 ? "l" : "k");
    }
    const fx = Math.round(ax + (ex - ax) * 0.5) - 8, fy = Math.round(ay + (ey - ay) * 0.5 - 20) - 6;
    c.blit(R().frame("item." + item), fx, fy); U().sparkle(c, fx + 18, fy + 2, "l", 1, "t"); U().sparkle(c, fx - 2, fy + 13, "k", 1);
    text(c, bx - 4, by + 5, t("dlv.shop.bag"), "u", 10, 30, "r", "dlv.shop.bag");
    for (let i = 0; i < (p.slots || 3); i++) {
      G().box(c, bx + i * 20, by, 18, 18, { r: 2, rings: [i === 0 ? "m" : "z"], fill: "z" });
      if (i === 0) R().put(c, R().frame("item." + item), bx + 1, by + 1, 16, 16);
    }
    // marks: 双喜临门 / 念念不忘, the combo
    let ty = 52;
    if (p.double) { tagC(c, 288, ty, t("wish.double"), "k", "z", "wish.double"); ty += 15; }
    if (p.reason === "remembered") { tagC(c, 288, ty, t("wish.remembered"), "D", "z", "wish.remembered"); ty += 15; }
    if (p.combo) {
      const cy = Math.max(ty + 2, 80), cargo = R().shrink(R().frame("cargo." + p.combo.cargo), 12, 12);
      let x = 288 - 12 - 3 - 7 - 3 - 12;
      R().face(c, x, cy, p.combo.recipient); x += 15;
      text(c, x, cy + 1, "×", "u", 10, 8, "l", "wish.combo"); x += 10;
      R().put(c, cargo, x, cy, 12, 12);
      text(c, 288 - 12 - 3 - 7 - 3 - 12 - 4, cy + 1, t("wish.combo"), "u", 10, 60, "r", "wish.combo");
    }
    text(c, 160, 124, t("wish.lucky.give", { name: t(`recipient.${rid}.name`), item: t(`item.${item}.name`) }), "t", 12, W - 16, "c", "wish.lucky.give");
    text(c, 160, 140, p.double ? t("wish.double.note") : t("wish.lucky.bag"), p.double ? "k" : "u", 10, W - 16, "c", p.double ? "wish.double.note" : "wish.lucky.bag");
    G().keybar(c, [[["Enter"], t("d2.go")]], 160, 164, "c");
  }

  // ================================================================ run_wish_give
  // A speech bubble in the G2 say style with the speaker's name chip and up to
  // three 12px lines; the tail points down at tx.
  function bubble(c, x, y, w, s, tx, name, key) {
    const lines = U().wrap(c, s, 12, w - 14), n = Math.min(3, lines.length), h = 9 + n * 13 + 3, S = G().STYLE.say, rc = S.rings.length;
    G().layered(c, G().sayMask(x + rc, y + rc, w - 2 * rc, h - 2 * rc, S.r, tx, 4, tx > x + w / 2), S.rings, S.fill);
    lines.slice(0, 3).forEach((ln, i) => text(c, x + 7, y + 6 + i * 13, ln, "t", 12, w - 14, "l", key));
    if (lines.length > 3) PB.i18n.report("overflow", key, NOBOX);
    if (name) K().tag(c, x + 6, y - 7, name);
    U().glyph(c, U().ARROW.down5, x + w - 11, y + h - 8, "m");
    return h;
  }
  function featureAt(room, feature) {
    const key = Object.keys(room.legend || {}).find((k) => room.legend[k].feature === feature);
    for (let y = 0; key && y < room.map.length; y++) { const x = room.map[y].indexOf(key); if (x >= 0) return [x, y]; }
    return null;
  }
  // Rewards plate: thank-you coins, bond, the first-time gift unlocked into the
  // map's stations, the 双喜 stamp.
  function rewards(c, x, y, p) {
    const rows = 2 + (p.first && p.thanks ? 1 : 0) + (p.double ? 1 : 0), h = 8 + rows * 16 + (p.first && p.thanks ? 11 : 0);
    K().panel(c, x, y, 126, h, true);
    let yy = y + 5;
    const label = (key) => text(c, x + 7, yy + 2, t(key), "u", 10, 34, "l", key);
    label("wish.give.coins"); U().coinIcon(c, x + 44, yy + 2, true); text(c, x + 57, yy, "+" + p.coins, "k", 12, 50, "l", "wish.give.coins"); yy += 16;
    label("wish.give.bond"); c.blit(R().shrink(R().frame("ui.delivery_icons", "heart"), 9, 9), x + 44, yy + 2); text(c, x + 57, yy, "+" + p.bond, "t", 12, 50, "l", "wish.give.bond"); yy += 16;
    if (p.first && p.thanks) {
      label("wish.give.gift");
      const gd = R().goodOf({ id: p.thanks, kind: p.thanksKind }, p.world || "diyu");
      if (gd.art) { G().box(c, x + 42, yy - 1, 14, 14, { r: 2, fill: "z" }); R().put(c, R().shrink(gd.art, 12, 12), x + 42, yy - 1, 14, 14); }
      else { G().box(c, x + 42, yy - 1, 14, 14, { r: 2, rings: ["w"], fill: "x" }); text(c, x + 49, yy + 1, [...gd.name][0] || "?", "t", 10, 12, "c", gd.key + ".name"); }  // no art yet: grey frame + first letter, as on the shelf
      text(c, x + 59, yy + 2, gd.name, "t", 10, 62, "l", gd.key + ".name"); yy += 14;
      text(c, x + 7, yy, t("wish.give.unlock", { world: t("d2.map." + (p.world || "diyu")) }), "m", 10, 112, "l", "wish.give.unlock"); yy += 13;
    }
    if (p.double) { label("wish.give.stamp"); c.blit(R().frame("ui.run_icons", "stamp"), x + 45, yy + 3); text(c, x + 57, yy + 2, t("wish.give.double"), "k", 10, 62, "l", "wish.give.double"); }
  }
  // p: room2 (the home), hud, player, recipient, item, coins (thank-you), bond,
  //    first (first delivery of this wish: thanks + story), thanks (item / buff id),
  //    double, page (0 = the line; 1–4 = the story, one sentence a page).
  function give(r, tick, p, st) {
    const scene = R().roomScene(r, p, tick);
    if (p.hud) R().hudBar(r, p, tick);
    const c = new (U().C)(r), rid = p.recipient, item = itemOf(p), page = p.page | 0;
    const home = featureAt(p.room2, "recipient") || [16, 4], hx = home[0] * 16 + 8 - scene.cam.x, hy = R().HUD_H + home[1] * 16 - scene.cam.y;
    const px = p.player[0] * 16 + 8 - scene.cam.x;
    // the wish gift handed over, between the porter and the recipient
    const gx = ((px + hx) >> 1) - 8, gy = hy - 22;
    c.blit(R().frame("item." + item), gx, gy); U().sparkle(c, gx + 18, gy + 3, "l", 1, "t"); U().sparkle(c, gx - 3, gy + 12, "k", 1);
    rewards(c, 8, 26, p);
    if (page === 0) {
      const w = 176, x = Math.max(132, Math.min(312 - w, hx - 120)), s = t(`wish.${rid}.line`);
      const n = Math.min(3, U().wrap(c, s, 12, w - 14).length), h = 9 + n * 13 + 3;
      bubble(c, x, Math.max(30, hy - 30 - h), w, s, Math.min(x + w - 10, hx), t(`recipient.${rid}.name`), `wish.${rid}.line`);
    } else {
      const key = `wish.${rid}.story.${page}`, total = p.pages || 4;
      K().panel(c, 8, 120, 304, 40, true);
      K().tag(c, 14, 114, t("wish.give.story"));
      const lines = U().wrap(c, t(key), 12, 268);
      lines.slice(0, 2).forEach((ln, i) => text(c, 16, 127 + i * 14, ln, "t", 12, 268, "l", key));
      if (lines.length > 2) PB.i18n.report("overflow", key, NOBOX);
      text(c, 304, 147, page + "/" + total, "u", 10, 24, "r", "wish.page");
      U().glyph(c, U().ARROW.down5, 299, 129, "m");
    }
    G().keybar(c, [[["Enter"], t("wish.next")]], 160, 164, "c");
  }

  const ck = (fn) => R().checked(fn);
  Object.assign(PB.ui.SCREENS, { run_wish_card: ck(wishCard), run_lucky: ck(lucky), run_wish_give: ck(give) });
  PB.uiRun = Object.assign(PB.uiRun || {}, { CARD, SLIP, bare, wishSlip, luckySlip, tagC, infoRows, wishRow, bubble, featureAt, rewards, wishCard, lucky, give });
})(typeof window !== "undefined" ? window : globalThis);
