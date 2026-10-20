/* Lobby skins S1–S6 (docs/design/ui-style.md §2): a port of draw() in
 * tools/ui-proposals/s1_crystal.py … s6_hull.py. One layout, six skins; each
 * skin draws only the UI layer over the chapter's backdrop. Text arrives in
 * `t` (from content/i18n via ui-style.js), never as literals here:
 *   t = { title, titleEn, tag, curTag, cur, items: [{label, icon, detail}], sel, coins, keySelect, keyConfirm, theme }
 * Coordinates are the proposals'; containers grow with longer text. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const U = () => PB.uk;

  // Shared helpers of the six skins.
  const keysW = (c, t, extra) => 11 + 1 + 11 + 3 + c.tw(t.keySelect, 10) + 8 + c.tw("Enter", 10) + (extra || 7) + 3 + c.tw(t.keyConfirm, 10);
  function menuW(c, t, base, pad) {
    const u = U(), need = Math.max(...t.items.map((it) => c.tw(it.label, 12) + (it.detail ? c.tw(it.detail, 10) + 8 : 0))) + pad;
    return Math.max(base, need);
  }

  // ================================================================ S1 晶石琉璃
  function s1keycap(c, x, y, label, arrow) { return U().keycap(c, x, y, label, arrow); }
  function S1(c, t) {
    const u = U(), { fd, cham, paint, diamond, fancy, shard, hshard, sparkle, plate, panel, emblem } = u;
    shard(c, 96, 6, 15, 7);
    shard(c, 106, 15, 9, 5, "t", "D", "C", "B");
    shard(c, 6, 40, 7, 3, "t", "s", "r", "q");
    sparkle(c, 112, 9, "t", 1);
    fancy(c, 13, 9, t.title, "t", { outline: "s", outline2: "z", shadow: "q", sz: 12, scale: 2, sdir: [1, 2], diag: false, spacing: 2 });
    c.hline(13, 37, 6, "r"); diamond(c, 21, 37, 1, "s");
    fancy(c, 26, 34, t.titleEn, "s", { outline: "z", sz: 10, spacing: 1 });
    let tw = 26; for (const ch of t.titleEn) tw += c.tw(ch, 10) + 1;
    diamond(c, tw + 2, 37, 1, "s"); c.hline(tw + 5, 37, 6, "r");
    fancy(c, 13, 44, t.tag, "u", { outline: "z", sz: 10 });
    const cw = 20 + c.tw(t.curTag, 10) + c.tw(t.cur, 12) + 10;
    plate(c, 20, 60, cw, 16, 3);
    const gx = 22, gy = 68;
    diamond(c, gx, gy, 12, "z"); diamond(c, gx, gy, 11, "q");
    for (let j = -11; j <= 11; j++) { const k = 11 - Math.abs(j); c.px(gx - k, gy + j, j <= 0 ? "s" : "r"); c.px(gx + k, gy + j, j <= 0 ? "r" : "q"); }
    diamond(c, gx, gy, 9, "y");
    emblem(c, t.theme, gx - 8, gy - 8);
    c.px(gx, gy - 11, "t");
    c.text(40, 64, t.curTag, "v", { sz: 10 });
    c.text(40 + c.tw(t.curTag, 10) + 4, 63, t.cur, "t", { sz: 12 });
    const n = t.items.length, px = 12, py = 82, pw = menuW(c, t, 136, 44), ph = 12 + n * 15;
    panel(c, px, py, pw, ph, 6);
    t.items.forEach((it, i) => {
      const ry = py + 6 + i * 15;
      if (i === t.sel) {
        paint(c, cham(px + 6, ry, pw - 12, 14, 3), "r");
        paint(c, cham(px + 7, ry + 1, pw - 14, 12, 2), "q");
        c.hline(px + 9, ry + 1, pw - 18, "s");
        c.hline(px + 9, ry + 12, pw - 18, "y");
        for (let k = 0; k < 6; k++) c.px(px + pw - 26 + k, k < 5 ? ry + 11 - k * 2 : ry + 2, "r");
        u.menuIcon(c, it.icon, px + 14, ry + 1);
        c.text(px + 30, ry + 1, it.label, "t", { sz: 12 });
        if (it.detail) c.text(px + pw - 12, ry + 2, it.detail, "l", { sz: 10, align: "r" });
        hshard(c, px - 6, ry + 1, 12, 11);
        sparkle(c, px - 7, ry - 1, "t", 1);
      } else {
        u.menuIcon(c, it.icon, px + 14, ry + 1);
        c.text(px + 30, ry + 1, it.label, "u", { sz: 12 });
      }
      if (i > 0 && i < n - 1) for (let xx = px + 14; xx < px + pw - 14; xx += 3) c.px(xx, ry + 14, "x");
    });
    const cx = px + pw - 7, cy = py + ph - 23;
    shard(c, cx, cy, 16, 7);
    shard(c, cx + 8, cy + 8, 11, 5, "t", "D", "C", "B");
    shard(c, cx - 7, cy + 12, 9, 5);
    const cw2 = 16 + c.tw(t.coins, 10) + 8;
    plate(c, 314 - cw2, 6, cw2, 14, 3);
    u.coinIcon(c, 314 - cw2 + 4, 8, true);
    c.text(314 - 5, 8, t.coins, "t", { sz: 10, align: "r" });
    const y = 163, hw = keysW(c, t) + 10;
    plate(c, 10, y - 2, hw, 15, 3);
    let x = 15;
    x += s1keycap(c, x, y, null, "up") + 1;
    x += s1keycap(c, x, y, null, "down") + 3;
    c.text(x, y + 1, t.keySelect, "u", { sz: 10 }); x += c.tw(t.keySelect, 10) + 8;
    x += s1keycap(c, x, y, "Enter") + 3;
    c.text(x, y + 1, t.keyConfirm, "u", { sz: 10 });
  }

  // ================================================================ S2 漂浮符文
  const RUNES = () => ["\n..#..\n.#.#.\n#.#.#\n..#..\n..#..", "\n#...#\n.#.#.\n..#..\n.#.#.\n#...#", "\n##...\n#.#..\n##...\n#.#..\n#..#.",
    "\n#.#..\n##...\n#.#..\n#..#.\n#...#", "\n.###.\n#...#\n..#..\n#...#\n.###.", "\n#####\n..#..\n.#.#.\n#...#\n#...#"].map((s) => U().rows(s));
  let runes = null;
  const STONE = { t: "v", top: "w", face: "x", lit: "w", shade: "y", under: "y", drip: "z" };
  function slab(c, x, y, w, face, o) {
    const u = U(), { H, K, KX, KY, fd, grow, minus, union, paint } = u;
    o = Object.assign({ top: 2, jag: 4, seed: 0, shadow: true, moss: false, glow: null, tails: null, P: STONE }, o || {});
    const P = o.P, M = new Map(), hgt = o.top + face;
    for (let j = 0; j < hgt; j++) {
      let lo = H(x, y + j, o.seed) % 3 === 0 ? 1 : 0, ro = H(x + w, y + j, o.seed) % 3 === 0 ? 1 : 0;
      const tap = Math.max(0, j - (hgt - 3));
      if (j === 0) lo = ro = 1;
      for (let i = lo + tap; i < w - ro - tap; i++) {
        let col;
        if (j < o.top) col = j === 0 && [2, 3, 4, 5, 6].includes(i % 11) ? P.t : P.top;
        else if (j === o.top) col = P.shade;
        else { col = P.face; if (i === lo + tap) col = P.lit; else if (i >= w - ro - tap - 2) col = P.shade; }
        M.set(K(x + i, y + j), col);
      }
    }
    const tails = o.tails != null ? o.tails : [[0.3, o.jag], [0.7, Math.max(1, o.jag - 1)]];
    for (const [tt, d] of tails) {
      const cx = x + Math.trunc(tt * w) + (H(x, y, o.seed + Math.trunc(tt * 10)) % 5) - 2;
      for (let j = 0; j < d; j++) {
        const hw = Math.max(0, fd((d - j) * 3, d));
        for (let i = cx - hw - 1; i < cx + hw + 2; i++) M.set(K(i, y + hgt + j), j < d - 1 ? P.under : P.drip);
      }
    }
    const Ks = new Set(M.keys());
    if (o.shadow) u.dropShadow(c, grow(Ks, 1), 3, 6, 8);
    const O = minus(grow(Ks, 1, false), Ks);
    if (o.glow) paint(c, minus(minus(grow(union(Ks, O), 1, false), Ks), O), o.glow);
    paint(c, O, "z");
    for (const [k, col] of M) c.px(KX(k), KY(k), col);
    if (o.moss) {
      const mx = x + 4 + (H(y, x, o.seed) % Math.max(1, fd(w, 3)));
      for (let k = 0; k < 6 + (o.seed % 4); k++) { c.px(mx + k, y, k % 2 ? "n" : "m"); if (k % 3 === 1) c.px(mx + k, y - 1, "m"); }
    }
    return [y + o.top + 1, Ks];
  }
  function rune(c, i, x, y, col, glow) {
    const u = U(); runes = runes || RUNES();
    const g = runes[i % runes.length];
    if (glow) {
      const P = new Set();
      g.forEach((r, b) => { for (let a = 0; a < r.length; a++) if (r[a] === "#") P.add(u.K(x + a, y + b)); });
      for (const k of P) { const a = u.KX(k), b = u.KY(k); for (const [dx, dy] of u.N4) if (!P.has(u.K(a + dx, b + dy))) c.px(a + dx, b + dy, glow); }
    }
    u.glyph(c, g, x, y, col);
  }
  function s2keycap(c, x, y, label, arrow) {
    const u = U(), w = arrow ? 11 : c.tw(label, 10) + 7;
    const [fy] = slab(c, x, y, w, 8, { top: 2, jag: 0, seed: x, shadow: false, tails: [] });
    if (arrow) u.glyph(c, u.ARROW[arrow + "5"], x + 3, fy + 2, "u");
    else c.text(x + u.fd(w, 2) - 1, fy - 1, label, "u", { sz: 10, align: "c" });
    return w;
  }
  function S2(c, t) {
    const u = U(), { fancy, diamond } = u, core = "l", body = "k", halo = "j";
    const tx = 10, ty = 4, tw = Math.max(114, c.tw(t.title, 12) * 2 + 2 * ([...t.title].length - 1) + 30);
    let [fy] = slab(c, tx, ty, tw, 34, { top: 3, jag: 6, seed: 3, moss: true, tails: [[0.22, 5], [0.5, 7], [0.8, 4]] });
    [tx + 5, tx + tw - 11].forEach((rx, i) => { rune(c, i + 2, rx, fy + 3, body, "f"); rune(c, i + 4, rx, fy + 25, "w"); });
    fancy(c, tx + u.fd(tw, 2) - 1, fy + 3, t.title, body, { top: core, outline: "f", sz: 12, scale: 2, align: "c", diag: false, spacing: 2 });
    fancy(c, tx + u.fd(tw, 2) - 1, fy + 26, t.titleEn, "v", { outline: null, sz: 10, align: "c", spacing: 1 });
    slab(c, 130, 12, 8, 3, { top: 1, jag: 2, seed: 5, shadow: false, tails: [[0.5, 2]] });
    slab(c, 136, 31, 5, 2, { top: 1, jag: 1, seed: 6, shadow: false, tails: [[0.5, 1]] });
    for (const [x, y] of [[128, 6], [142, 24], [6, 44], [122, 44]]) c.px(x, y, core);
    fancy(c, 13, 53, t.tag, "u", { outline: "z", sz: 10 });
    const cw = 22 + c.tw(t.curTag, 10) + 4 + c.tw(t.cur, 12) + 8;
    [fy] = slab(c, 10, 67, cw, 11, { top: 2, jag: 3, seed: 8 });
    u.emblem(c, t.theme, 13, fy - 3);
    c.text(32, fy + 2, t.curTag, "v", { sz: 10 });
    c.text(32 + c.tw(t.curTag, 10) + 4, fy + 1, t.cur, "t", { sz: 12 });
    const wide = menuW(c, t, 110, 36);
    t.items.forEach((it, i) => {
      const sel = i === t.sel, y = 88 + i * 19 - (sel ? 2 : 0), x = sel ? 20 : 12, w = sel ? wide + 10 : wide;
      const [fy2] = slab(c, x, y, w, 11, { top: 2, jag: sel ? 4 : 3, seed: 20 + i, moss: i === 2, glow: sel ? halo : null });
      if (sel) {
        u.menuIcon(c, it.icon, x + 4, fy2);
        fancy(c, x + 19, fy2, it.label, core, { outline: null, sz: 12 });
        rune(c, 0, x + w - 10, fy2 + 3, body, "f");
        if (it.detail) c.text(x + w - 14, fy2 + 1, it.detail, "k", { sz: 10, align: "r" });
        c.circle(x - 9, fy2 + 5, 7, "j", [2, 1]);
        diamond(c, x - 9, fy2 + 5, 4, "z"); diamond(c, x - 9, fy2 + 5, 3, "j"); diamond(c, x - 9, fy2 + 5, 2, "k"); c.px(x - 10, fy2 + 4, "l");
        for (const [mx, my] of [[x + 26, y - 5], [x + 52, y - 7], [x + 84, y - 4], [x + 104, y - 8], [x + 10, y - 9]]) c.px(mx, my, core);
        c.px(x + 53, y - 8, "t");
      } else {
        u.menuIcon(c, it.icon, x + 4, fy2);
        c.text(x + 19, fy2, it.label, "u", { sz: 12 });
        rune(c, i + 1, x + w - 10, fy2 + 3, "w");
      }
    });
    const cw2 = 16 + c.tw(t.coins, 10) + 8;
    [fy] = slab(c, 312 - cw2, 5, cw2, 10, { top: 2, jag: 3, seed: 40 });
    u.coinIcon(c, 312 - cw2 + 4, fy, true);
    c.text(312 - 6, fy, t.coins, "t", { sz: 10, align: "r" });
    let x = 12; const y = 165;
    x += s2keycap(c, x, y, null, "up") + 2;
    x += s2keycap(c, x, y, null, "down") + 3;
    fancy(c, x, y + 2, t.keySelect, "t", { outline: "z", sz: 10 }); x += c.tw(t.keySelect, 10) + 9;
    x += s2keycap(c, x, y, "Enter") + 3;
    fancy(c, x, y + 2, t.keyConfirm, "t", { outline: "z", sz: 10 });
  }

  // ================================================================ S3 祥云玉简
  let HUI = null, XY = null;
  function s3init() {
    const u = U();
    HUI = HUI || u.rows("\n#####\n#...#\n#.#.#\n#...#\n#####");
    XY = XY || u.rows(`
.....oooo.........
...oollllo..oooo..
..olkkkkkloollllo.
.olkjjjjkkllkkkklo
.okjkkkkjkkkjjjjko
.okjkjjkjkkjkkkjko
.okjkkjjkkkjkjjjko
..okjkkkkjkkkkkoo.
...oooooooooooo...`);
  }
  function cloudMotif(c, x, y, flip, recolor) { s3init(); c.blit(XY, x, y, flip, Object.assign({ o: "z" }, recolor || {})); }
  function jadePanel(c, x, y, w, h, body, hui) {
    const u = U(); s3init(); body = body || "o";
    const M = u.roundM(x, y, w, h, 3);
    u.dropShadow(c, M, 2, 3, 9);
    u.paint(c, M, "z");
    u.bevel(c, u.roundM(x + 1, y + 1, w - 2, h - 2, 2), "l", "j", "k");
    u.paint(c, u.roundM(x + 2, y + 2, w - 4, h - 4, 1), "f");
    u.paint(c, u.rectM(x + 3, y + 3, w - 6, h - 6), body);
    c.hline(x + 3, y + 3, w - 6, "n");
    c.hline(x + 3, y + h - 4, w - 6, "p");
    for (let k = 0; k < 5; k++) c.px(x + 8 + k, y + 8 - k, "n");
    for (let k = 0; k < 3; k++) c.px(x + 12 + k, y + 8 - k, "n");
    if (hui !== false) {
      const ix = x + 5, iy = y + 5, iw = w - 10, ih = h - 10;
      for (let xx = ix + 6; xx < ix + iw - 6; xx++) if (xx % 2 === 0) { c.px(xx, iy, "k"); c.px(xx, iy + ih - 1, "j"); }
      for (let yy = iy + 6; yy < iy + ih - 6; yy++) if (yy % 2 === 0) { c.px(ix, yy, "k"); c.px(ix + iw - 1, yy, "j"); }
      for (const [cx, cy] of [[ix, iy], [ix + iw - 5, iy], [ix, iy + ih - 5], [ix + iw - 5, iy + ih - 5]]) u.glyph(c, HUI, cx, cy, "k");
    }
    return [x + 3, y + 3, w - 6, h - 6];
  }
  function jadeChip(c, x, y, w, h) {
    const u = U(); h = h || 14;
    const M = u.roundM(x, y, w, h, 3);
    u.dropShadow(c, M, 1, 2, 8);
    u.paint(c, M, "z");
    u.bevel(c, u.roundM(x + 1, y + 1, w - 2, h - 2, 2), "l", "j", "k");
    u.paint(c, u.roundM(x + 2, y + 2, w - 4, h - 4, 1), "o");
    c.hline(x + 3, y + 2, w - 6, "n");
  }
  function tassel(c, x, y, L) {
    const u = U(); L = L || 12;
    c.vline(x, y, 4, "h"); c.vline(x + 1, y, 4, "g");
    u.diamond(c, x, y + 7, 4, "z"); u.diamond(c, x, y + 7, 3, "h"); u.diamond(c, x, y + 7, 2, "i");
    c.px(x - 1, y + 6, "D"); c.px(x, y + 7, "h"); c.px(x, y + 5, "D");
    c.rect(x - 2, y + 12, 5, 2, "k"); c.hline(x - 2, y + 12, 5, "l"); c.frame(x - 3, y + 11, 7, 4, "z");
    for (let i = -2; i <= 2; i++) {
      const ln = L - Math.abs(i) * 2 + u.pm(i, 2);
      c.vline(x + i, y + 15, ln, u.pm(i, 2) === 0 ? "i" : "h");
      c.px(x + i, y + 15 + ln, "z");
    }
    c.vline(x - 3, y + 15, L - 4, "z"); c.vline(x + 3, y + 15, L - 4, "z");
  }
  function plaque(c, x, y, w, h) {
    const u = U(), M = u.rectM(x, y, w, h);
    for (const [px, py] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) M.delete(u.K(px, py));
    u.dropShadow(c, M, 2, 3, 9);
    u.paint(c, M, "z");
    u.paint(c, u.rectM(x + 1, y + 1, w - 2, h - 2), "h"); c.hline(x + 1, y + 1, w - 2, "i"); c.vline(x + 1, y + 1, h - 2, "i"); c.hline(x + 2, y + h - 2, w - 3, "g");
    c.rect(x + 3, y + 3, w - 6, h - 6, "z");
    c.rect(x + 4, y + 4, w - 8, h - 8, "g");
    c.hline(x + 4, y + 4, w - 8, "B");
    for (const [sx, sy] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + h - 3], [x + w - 3, y + h - 3]]) c.px(sx, sy, "l");
  }
  function s3keycap(c, x, y, label, arrow) {
    const u = U(), w = arrow ? 11 : c.tw(label, 10) + 7;
    u.paint(c, u.roundM(x, y, w, 11, 2), "z");
    u.paint(c, u.roundM(x + 1, y + 1, w - 2, 9, 1), "n");
    c.hline(x + 2, y + 1, w - 4, "m"); c.hline(x + 2, y + 9, w - 4, "o");
    if (arrow) u.glyph(c, u.ARROW[arrow + "5"], x + 3, y + 4, "l");
    else c.text(x + u.fd(w, 2), y + 1, label, "l", { sz: 10, align: "c" });
    return w;
  }
  function S3(c, t) {
    const u = U(), { fancy, fd } = u;
    const px = 12, py = 6, pw = Math.max(104, c.tw(t.title, 12) * 2 + 3 * ([...t.title].length - 1) + 24), ph = 34;
    plaque(c, px, py, pw, ph);
    fancy(c, px + fd(pw, 2), py + 7, t.title, "k", { top: "l", bottom: "j", outline: "z", sz: 12, scale: 2, align: "c", diag: false, spacing: 3 });
    cloudMotif(c, px + pw - 12, py - 5);
    cloudMotif(c, px - 7, py + ph - 6, true);
    fancy(c, px + fd(pw, 2), py + ph + 2, "· " + t.titleEn + " ·", "l", { outline: "z", sz: 10, align: "c", spacing: 1 });
    fancy(c, 13, 51, t.tag, "c", { outline: "z", sz: 10 });
    const cw = 24 + c.tw(t.curTag, 10) + 4 + c.tw(t.cur, 12) + 8;
    jadeChip(c, 12, 65, cw, 15);
    c.disc(19, 72, 9, "z"); c.disc(19, 72, 8, "k"); c.disc(19, 72, 7, "f");
    u.emblem(c, t.theme, 11, 64);
    c.text(32, 68, t.curTag, "m", { sz: 10 });
    c.text(32 + c.tw(t.curTag, 10) + 4, 67, t.cur, "t", { sz: 12 });
    const n = t.items.length, mx = 12, my = 86, mw = menuW(c, t, 132, 46), mh = 14 + n * 14;
    jadePanel(c, mx, my, mw, mh);
    t.items.forEach((it, i) => {
      const ry = my + 7 + i * 14;
      if (i === t.sel) {
        c.rect(mx + 8, ry, mw - 16, 13, "z");
        c.rect(mx + 9, ry + 1, mw - 18, 11, "n"); c.hline(mx + 9, ry + 1, mw - 18, "m"); c.hline(mx + 9, ry + 11, mw - 18, "o");
        for (const ex of [mx + 9, mx + mw - 12]) { c.rect(ex, ry + 1, 3, 11, "k"); c.vline(ex, ry + 1, 11, "l"); c.vline(ex + 2, ry + 1, 11, "j"); }
        u.menuIcon(c, it.icon, mx + 15, ry + 1);
        fancy(c, mx + 30, ry + 1, it.label, "t", { outline: null, sz: 12 });
        if (it.detail) fancy(c, mx + mw - 15, ry + 2, it.detail, "l", { outline: null, sz: 10, align: "r" });
        for (let k = 0; k < 5; k++) c.vline(mx + 1 + k, ry + 2 + k, 9 - 2 * k, k ? "k" : "l");
        for (let k = 0; k < 5; k++) { c.px(mx + k, ry + 1 + k, "z"); c.px(mx + k, ry + 11 - k, "z"); }
        c.vline(mx, ry + 1, 11, "z"); c.px(mx + 6, ry + 6, "z"); c.px(mx + 5, ry + 6, "j");
      } else {
        u.menuIcon(c, it.icon, mx + 15, ry + 1);
        c.text(mx + 30, ry + 1, it.label, "c", { sz: 12 });
      }
    });
    tassel(c, mx + mw - 7, my + mh - 1, 9);
    const cw2 = 16 + c.tw(t.coins, 10) + 8;
    jadeChip(c, 314 - cw2, 6, cw2, 14);
    u.coinIcon(c, 314 - cw2 + 4, 8, true);
    c.text(314 - 6, 8, t.coins, "t", { sz: 10, align: "r" });
    cloudMotif(c, 314 - cw2 - 13, 13, true);
    const y = 165, hw = keysW(c, t) + 10;
    jadeChip(c, 9, y - 2, hw, 15);
    let x = 13;
    x += s3keycap(c, x, y, null, "up") + 1;
    x += s3keycap(c, x, y, null, "down") + 3;
    c.text(x, y + 1, t.keySelect, "c", { sz: 10 }); x += c.tw(t.keySelect, 10) + 8;
    x += s3keycap(c, x, y, "Enter") + 3;
    c.text(x, y + 1, t.keyConfirm, "c", { sz: 10 });
  }

  // ================================================================ S4 梦泡糖霜
  function bubblePanel(c, x, y, w, h, r, body, shade, sheen) {
    const u = U(); r = r || 6; body = body || "t"; shade = shade || "u";
    const M = u.roundM(x, y, w, h, r), G = u.grow(M, 1);
    u.dropShadow(c, G, 2, 3, 9);
    u.paint(c, G, "z");
    u.paint(c, M, "B");
    const I = u.roundM(x + 1, y + 1, w - 2, h - 2, r - 1);
    u.paint(c, I, body);
    for (const k of I) {
      const a = u.KX(k), b = u.KY(k);
      if (!I.has(u.K(a, b + 3)) && u.BAYER[b % 4][a % 4] < 10) c.px(a, b, shade);
      if (!I.has(u.K(a, b + 2))) c.px(a, b, shade);
    }
    if (sheen !== false) {
      for (let k = 0; k < Math.min(u.fd(w, 3), 26); k++) c.px(x + r + 2 + k, y + 2, k < 12 ? "s" : "D");
      for (let k = 0; k < Math.min(u.fd(h, 3), 10); k++) c.px(x + 2, y + r + 2 + k, "s");
      c.px(x + 3, y + 3, "t"); c.rect(x + r - 1, y + 3, 2, 1, "t");
    }
    return I;
  }
  function pill(c, x, y, w, h, body, hi, lo, edge, outer) {
    const u = U(); edge = edge || "B"; outer = outer === undefined ? "z" : outer;
    const M = u.roundM(x, y, w, h, u.fd(h, 2));
    if (outer) u.paint(c, u.grow(M, 1), outer);
    u.paint(c, M, edge);
    const I = u.roundM(x + 1, y + 1, w - 2, h - 2, u.fd(h - 2, 2));
    u.paint(c, I, body);
    for (const k of I) {
      const a = u.KX(k), b = u.KY(k);
      if (!I.has(u.K(a, b - 1))) c.px(a, b, hi); else if (!I.has(u.K(a, b + 1))) c.px(a, b, lo);
    }
    return I;
  }
  function bubble(c, cx, cy, r, sheen) {
    sheen = sheen || "s";
    c.circle(cx, cy, r, "u");
    if (r >= 4) for (const [a, b] of [[cx - r + 1, cy - 1], [cx - r + 1, cy], [cx - 1, cy - r + 1], [cx, cy - r + 1]]) c.px(a, b, sheen);
    const h = U().fd(r, 2);
    c.px(cx - h, cy - h, "t");
    if (r >= 5) c.px(cx - h + 1, cy - h, "t");
    c.px(cx + h, cy + h + (r > 4 ? 1 : 0), "D");
  }
  function star(c, x, y, col, edge) {
    const u = U(); col = col || "l"; edge = edge || "z";
    const R = u.rows("\n..#..\n..#..\n#####\n.###.\n.#.#."), P = new Set();
    R.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "#") P.add(u.K(x + i, y + j)); });
    for (const k of P) { const a = u.KX(k), b = u.KY(k); for (const [dx, dy] of u.N8) if (!P.has(u.K(a + dx, b + dy))) c.px(a + dx, b + dy, edge); }
    for (const k of P) c.px(u.KX(k), u.KY(k), col);
  }
  function s4keycap(c, x, y, label, arrow) {
    const u = U(), w = arrow ? 11 : c.tw(label, 10) + 8;
    pill(c, x, y, w, 11, "D", "E", "C", "B", null);
    if (arrow) u.glyph(c, u.ARROW[arrow + "5"], x + 3, y + 4, "t");
    else c.text(x + u.fd(w, 2), y + 1, label, "t", { sz: 10, align: "c" });
    return w;
  }
  function S4(c, t) {
    const u = U(), { fancy } = u;
    bubble(c, 128, 16, 9);
    c.rect(124, 13, 8, 7, "e"); c.frame(124, 13, 8, 7, "f"); c.line(125, 18, 130, 14, "d"); c.hline(125, 14, 6, "d");
    bubble(c, 128, 16, 9);
    bubble(c, 140, 36, 5);
    c.blit(u.rows("\n.##.##.\n#######\n#######\n.#####.\n..###..\n...#..."), 137, 33, false, { "#": "i" });
    bubble(c, 140, 36, 5);
    bubble(c, 6, 46, 3);
    star(c, 116, 34, "l");
    fancy(c, 12, 8, t.title, "t", { outline: "B", outline2: "z", shadow: "C", sz: 12, scale: 2, sdir: [0, 2], diag: true, spacing: 2 });
    pill(c, 14, 36, c.tw(t.titleEn, 10) + 14 + 7, 11, "C", "D", "B");
    fancy(c, 21, 36, t.titleEn, "t", { outline: null, sz: 10, spacing: 1 });
    fancy(c, 13, 51, t.tag, "t", { outline: "B", outline2: "z", sz: 10 });
    const cw = 26 + c.tw(t.curTag, 10) + 4 + c.tw(t.cur, 12) + 10;
    pill(c, 12, 66, cw, 15, "t", "t", "u");
    c.disc(21, 73, 9, "z"); c.disc(21, 73, 8, "B"); c.disc(21, 73, 7, "E");
    u.emblem(c, t.theme, 13, 65);
    c.text(34, 69, t.curTag, "C", { sz: 10 });
    c.text(34 + c.tw(t.curTag, 10) + 4, 68, t.cur, "B", { sz: 12 });
    const n = t.items.length, mx = 12, my = 88, mw = menuW(c, t, 132, 46), mh = 8 + n * 15;
    bubblePanel(c, mx, my, mw, mh, 7);
    t.items.forEach((it, i) => {
      const ry = my + 6 + i * 15;
      if (i === t.sel) {
        pill(c, mx + 6, ry - 1, mw - 12, 15, "C", "D", "B", "B", null);
        c.px(mx + 12, ry + 1, "t"); c.px(mx + 13, ry + 1, "t");
        u.menuIcon(c, it.icon, mx + 14, ry + 1);
        fancy(c, mx + 30, ry + 1, it.label, "t", { outline: null, sz: 12 });
        if (it.detail) fancy(c, mx + mw - 14, ry + 2, it.detail, "l", { outline: null, sz: 10, align: "r" });
        star(c, mx - 4, ry + 3, "l");
      } else {
        u.menuIcon(c, it.icon, mx + 14, ry + 1);
        c.text(mx + 30, ry + 1, it.label, "B", { sz: 12 });
      }
    });
    const cw2 = 16 + c.tw(t.coins, 10) + 10;
    pill(c, 314 - cw2, 6, cw2, 13, "t", "t", "u");
    u.coinIcon(c, 314 - cw2 + 4, 8, true);
    c.text(314 - 7, 7, t.coins, "B", { sz: 10, align: "r" });
    const y = 165, hw = keysW(c, t, 8) + 12;
    pill(c, 9, y - 2, hw, 15, "t", "t", "u");
    let x = 14;
    x += s4keycap(c, x, y, null, "up") + 1;
    x += s4keycap(c, x, y, null, "down") + 3;
    c.text(x, y + 1, t.keySelect, "B", { sz: 10 }); x += c.tw(t.keySelect, 10) + 8;
    x += s4keycap(c, x, y, "Enter") + 3;
    c.text(x, y + 1, t.keyConfirm, "B", { sz: 10 });
  }

  // ================================================================ S5 藤木萤光
  function moss(c, x, y, w, seed) {
    const H = U().H;
    for (let xx = x; xx < x + w; xx++) {
      c.px(xx, y, H(xx, y, seed) < 620 ? "m" : "n");
      c.px(xx, y + 1, "n");
      if (H(xx, y, seed + 1) < 480) c.px(xx, y + 2, H(xx, y, seed + 5) < 550 ? "o" : "n");
      if (H(xx, y, seed + 2) < 110 && xx !== x && xx !== x + w - 1) c.px(xx, y + 3, "o");
      if (H(xx, y, seed + 3) < 300) c.px(xx, y - 1, "m");
      else if (H(xx, y, seed + 4) < 110) c.px(xx, y - 1, "n");
      if (H(xx, y, seed + 6) < 60) { c.px(xx, y - 2, "m"); c.px(xx, y - 1, "m"); }
    }
  }
  function board(c, x, y, w, h, o) {
    const u = U();
    o = Object.assign({ seed: 0, body: "f", mossy: true, shadow: true, grain: true, nails: true }, o || {});
    const M = u.roundM(x, y, w, h, 2);
    if (o.shadow) u.dropShadow(c, M, 2, 3, 9);
    u.paint(c, M, "z");
    const B = u.bevel(c, u.roundM(x + 1, y + 1, w - 2, h - 2, 1), "e", "g", "f");
    u.paint(c, B, o.body);
    if (o.grain) for (const k of B) { const a = u.KX(k), b = u.KY(k); if (u.H(u.fd(a, 5) + b * 7, b, o.seed) < 60 && B.has(u.K(a, b - 1)) && B.has(u.K(a, b + 1))) c.px(a, b, "g"); }
    if (o.nails) for (const nx of [x + 3, x + w - 4]) { c.px(nx, y + u.fd(h, 2), "v"); c.px(nx, y + u.fd(h, 2) + 1, "g"); }
    if (o.mossy) moss(c, x + 2, y, w - 4, o.seed);
    return B;
  }
  function leafHw(h, t) { return h * (t < 0.35 ? Math.sin(Math.PI / 2 * t / 0.35) : 1 - (t - 0.35) / 0.65); }
  function leaf(c, x, y, L, h, flip, hi, lo, vein, edge) {
    const u = U(); L = L || 8; h = h == null ? 2 : h; hi = hi || "m"; lo = lo || "n"; vein = vein || "o"; edge = edge || "z";
    const M = new Map();
    for (let i = 0; i < L; i++) {
      const t = i / Math.max(1, L - 1), hw = Math.trunc(u.pyRound(leafHw(h, t))), xx = flip ? x - i : x + i;
      for (let j = -hw; j <= hw; j++) M.set(u.K(xx, y + j), j === 0 && i >= 1 && i <= L - 3 ? vein : j < 0 ? hi : lo);
    }
    for (const k of M.keys()) { const p = u.KX(k), q = u.KY(k); for (const [dx, dy] of u.N8) if (!M.has(u.K(p + dx, q + dy))) c.px(p + dx, q + dy, edge); }
    for (const [k, col] of M) c.px(u.KX(k), u.KY(k), col);
  }
  function leafCursor(c, x, y, L, h, rise) {
    const u = U(); L = L || 11; h = h || 3; rise = rise == null ? 2 : rise;
    const M = new Map();
    for (let i = 0; i < L; i++) {
      const t = i / (L - 1), hw = Math.trunc(u.pyRound(leafHw(h, t))), yc = y - Math.trunc(u.pyRound(rise * t * t));
      for (let j = -hw; j <= hw; j++) M.set(u.K(x + i, yc + j), j === 0 && i >= 1 && i <= L - 3 ? "o" : j < 0 ? "m" : "n");
    }
    for (const [px, py] of [[x - 1, y + 1], [x - 2, y + 2], [x - 3, y + 2]]) M.set(u.K(px, py), "n");
    for (const k of M.keys()) { const p = u.KX(k), q = u.KY(k); for (const [dx, dy] of u.N8) if (!M.has(u.K(p + dx, q + dy))) c.px(p + dx, q + dy, "z"); }
    for (const [k, col] of M) c.px(u.KX(k), u.KY(k), col);
  }
  function vine(c, x, y0, y1, amp, ph, leaves) {
    const u = U(), pts = [];
    for (let y = y0; y < y1; y++) pts.push([x + Math.trunc(u.pyRound(amp * Math.sin((y - y0) * 0.33 + ph))), y]);
    const S = new Set(); for (const [a, b] of pts) { S.add(u.K(a, b)); S.add(u.K(a + 1, b)); }
    for (const k of S) { const a = u.KX(k), b = u.KY(k); for (const [dx, dy] of u.N4) if (!S.has(u.K(a + dx, b + dy))) c.px(a + dx, b + dy, "z"); }
    for (const [a, b] of pts) { c.px(a, b, "n"); c.px(a + 1, b, "o"); }
    for (let i = 0; i < pts.length; i += 5) c.px(pts[i][0], pts[i][1], "m");
    for (const [ly, side] of leaves || []) {
      const [a, b] = pts[ly - y0];
      if (side > 0) leaf(c, a + 2, b + 1, 6, 2); else leaf(c, a - 1, b + 1, 6, 2, true);
    }
    const [a, b] = pts[pts.length - 1]; c.px(a, b + 1, "m");
  }
  function firefly(c, x, y, big) {
    const u = U();
    c.px(x, y, "l");
    for (const [dx, dy] of u.N4) c.px(x + dx, y + dy, big ? "k" : "m");
    if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) c.px(x + dx, y + dy, "m");
  }
  let MUSH = null, MUSH_S = null;
  function mushrooms(c, x, y) {
    const u = U();
    MUSH = MUSH || u.rows("\n...zzzz...\n.zzitiizz.\nzitiiiitiz\nziiiitiiiz\nzhhhhhhhhz\n.zzzcczzz.\n...zcdz...\n...zcdz...");
    MUSH_S = MUSH_S || u.rows("\n..zzz..\n.zitiz.\nziiiiiz\nzhhhhhz\n.zzczz.\n..zcz..");
    c.blit(MUSH, x, y - MUSH.length);
    c.blit(MUSH_S, x + 9, y - MUSH_S.length + 1);
    c.px(x + 1, y - 9, "l");
  }
  function grassTitle(c, x, y, s, spacing, seed) {
    const u = U(); spacing = spacing == null ? 2 : spacing; seed = seed == null ? 4 : seed;
    let P = new Set(), cx = 0;
    for (const ch of s) { const t = u.textset(ch, 12, 2); for (const k of t.P) P.add(u.K(u.KX(k) + cx, u.KY(k))); cx += t.w + spacing; }
    P = u.shiftSet(P, x, y);
    const O = new Set(); for (const k of P) for (const [dx, dy] of u.N8) { const q = u.K(u.KX(k) + dx, u.KY(k) + dy); if (!P.has(q)) O.add(q); }
    const PO = u.union(P, O), O2 = new Set();
    for (const k of PO) for (const [dx, dy] of u.N4) { const q = u.K(u.KX(k) + dx, u.KY(k) + dy); if (!PO.has(q)) O2.add(q); }
    for (const k of u.union(P, O, O2)) { const qx = u.KX(k) + 1, qy = u.KY(k) + 2, q = u.K(qx, qy); if (!P.has(q) && !O.has(q) && !O2.has(q)) c.px(qx, qy, "p"); }
    u.paint(c, O2, "z"); u.paint(c, O, "g");
    const top = new Map();
    for (const k of P) { const a = u.KX(k), b = u.KY(k); top.set(a, Math.min(top.has(a) ? top.get(a) : 999, b)); }
    for (const k of P) {
      const a = u.KX(k), b = u.KY(k);
      let col = "c";
      if (top.get(a) === b) col = "m"; else if (!P.has(u.K(a, b + 1))) col = "d";
      c.px(a, b, col);
    }
    for (const [a, b] of top) if (u.H(a, b, seed) < 300 && O.has(u.K(a, b - 1))) c.px(a, b - 1, "m");
    return [cx - spacing, top];
  }
  function s5keycap(c, x, y, label, arrow) {
    const u = U(), w = arrow ? 11 : c.tw(label, 10) + 7;
    u.paint(c, u.roundM(x, y, w, 11, 2), "z");
    u.paint(c, u.roundM(x + 1, y + 1, w - 2, 9, 1), "F");
    c.hline(x + 2, y + 1, w - 4, "d"); c.hline(x + 2, y + 9, w - 4, "e");
    if (arrow) u.glyph(c, u.ARROW[arrow + "5"], x + 3, y + 4, "g");
    else c.text(x + u.fd(w, 2), y + 1, label, "g", { sz: 10, align: "c" });
    return w;
  }
  function logSlice(c, cx, cy, r) {
    r = r || 9;
    c.disc(cx, cy, r, "z"); c.disc(cx, cy, r - 1, "f"); c.disc(cx, cy, r - 2, "F");
    c.circle(cx, cy, r - 4, "d"); c.circle(cx, cy, r - 6, "e");
  }
  function S5(c, t) {
    const u = U(), { fancy, H, fd } = u;
    vine(c, 104, 0, 40, 1.6, 0.0, [[9, 1], [19, -1], [30, 1]]);
    vine(c, 118, 0, 22, 1.2, 1.7, [[8, -1], [16, 1]]);
    grassTitle(c, 13, 9, t.title);
    const tx = 32;
    let wEn = -1; for (const ch of t.titleEn) wEn += c.tw(ch, 10) + 1;
    leaf(c, tx - 3, 38, 6, 2, true);
    fancy(c, tx, 34, t.titleEn, "m", { outline: "z", sz: 10, spacing: 1 });
    leaf(c, tx + wEn + 3, 38, 6, 2);
    fancy(c, 13, 46, t.tag, "c", { outline: "z", sz: 10 });
    const cw = 24 + c.tw(t.curTag, 10) + 4 + c.tw(t.cur, 12) + 8;
    board(c, 14, 64, cw, 15, { seed: 8, nails: false });
    logSlice(c, 20, 71, 10);
    u.emblem(c, t.theme, 12, 63);
    c.text(34, 68, t.curTag, "m", { sz: 10 });
    c.text(34 + c.tw(t.curTag, 10) + 4, 67, t.cur, "t", { sz: 12 });
    const n = t.items.length, mx = 12, my = 86, mw = menuW(c, t, 134, 46), mh = 10 + n * 15;
    board(c, mx, my, mw, mh, { seed: 12, grain: false, nails: false });
    for (let i = 0; i < n; i++) {
      const py = my + 4 + i * 15;
      if (i) c.hline(mx + 2, py - 1, mw - 4, "g");
      for (const yy of [py + 1, py + 12]) for (let xx = mx + 3; xx < mx + mw - 3; xx++) if (H(fd(xx, 6), yy, 30 + i) < 160) c.px(xx, yy, "g");
      for (const nx of [mx + 4, mx + mw - 5]) { c.px(nx, py + 6, "v"); c.px(nx, py + 7, "g"); }
    }
    t.items.forEach((it, i) => {
      const ry = my + 5 + i * 15;
      if (i === t.sel) {
        const S = u.roundM(mx + 8, ry - 1, mw - 16, 14, 3);
        u.paint(c, u.grow(S, 1), "z"); u.paint(c, S, "n");
        for (const k of S) { const a = u.KX(k), b = u.KY(k); if (!S.has(u.K(a, b - 1))) c.px(a, b, "m"); else if (!S.has(u.K(a, b + 1))) c.px(a, b, "o"); }
        u.menuIcon(c, it.icon, mx + 13, ry);
        fancy(c, mx + 28, ry, it.label, "t", { outline: null, sz: 12 });
        if (it.detail) fancy(c, mx + mw - 12, ry + 1, it.detail, "l", { outline: null, sz: 10, align: "r" });
        leafCursor(c, mx - 7, ry + 6);
        firefly(c, mx - 3, ry - 4, true);
      } else {
        u.menuIcon(c, it.icon, mx + 13, ry);
        c.text(mx + 28, ry, it.label, "c", { sz: 12 });
      }
    });
    mushrooms(c, mx + mw - 14, my + mh + 2);
    const cw2 = 16 + c.tw(t.coins, 10) + 8;
    board(c, 314 - cw2, 6, cw2, 14, { seed: 40, grain: false, nails: false });
    u.coinIcon(c, 314 - cw2 + 4, 9, true);
    c.text(314 - 6, 9, t.coins, "t", { sz: 10, align: "r" });
    leaf(c, 314 - cw2 - 1, 12, 6, 2, true);
    const y = 165, hw = keysW(c, t) + 10;
    board(c, 9, y - 2, hw, 15, { seed: 50, nails: false });
    let x = 13;
    x += s5keycap(c, x, y, null, "up") + 1;
    x += s5keycap(c, x, y, null, "down") + 3;
    c.text(x, y + 1, t.keySelect, "c", { sz: 10 }); x += c.tw(t.keySelect, 10) + 8;
    x += s5keycap(c, x, y, "Enter") + 3;
    c.text(x, y + 1, t.keyConfirm, "c", { sz: 10 });
    for (const [fx, fy, big] of [[128, 52, true], [96, 64, false], [150, 112, false], [6, 116, false], [140, 30, false]]) firefly(c, fx, fy, big);
  }

  // ================================================================ S6 星港舱板
  const hazard = (a, b) => (U().pm(U().fd(a + b, 3), 2) === 0 ? "k" : "z");
  function rivet(c, x, y) { c.px(x, y, "u"); c.px(x + 1, y + 1, "x"); }
  function hull(c, x, y, w, h, o) {
    const u = U();
    o = Object.assign({ k: 3, body: "y", stripe: 0, rivets: true, shadow: true, thick: false }, o || {});
    const k = o.k, M = u.cham(x, y, w, h, k);
    if (o.shadow) u.dropShadow(c, M, 2, 3, 9);
    u.paint(c, M, "z");
    let B = u.bevel(c, u.cham(x + 1, y + 1, w - 2, h - 2, k - 1), "v", "x", "w");
    if (o.thick) { B = u.bevel(c, B, "w", "x", "w"); const I = u.shrink(B, 1); u.paint(c, u.minus(B, I), "z"); B = I; }
    u.paint(c, B, o.body);
    if (o.stripe) {
      for (const kk of M) {
        const a = u.KX(kk), b = u.KY(kk);
        if (b >= y + 1 && b < y + 1 + o.stripe && !B.has(kk) && M.has(u.K(a - 1, b)) && M.has(u.K(a + 1, b))) c.px(a, b, hazard(a, b));
      }
      if (o.thick) c.hline(x + k, y + 1 + o.stripe, w - 2 * k, "z");
    }
    if (o.rivets) { const of = o.thick ? 3 : 2; for (const [rx, ry] of [[x + of + k - 1, y + h - of - 1], [x + w - of - k, y + h - of - 1]]) rivet(c, rx, ry); }
    return B;
  }
  function ledField(c, s, spacing) {
    const u = U(); let P = new Set(), cx = 0;
    for (const ch of s) { const t = u.textset(ch, 12, 1); for (const k of t.P) P.add(u.K(u.KX(k) + cx, u.KY(k))); cx += t.w + spacing; }
    let b0 = Infinity, b1 = -Infinity; for (const k of P) { const b = u.KY(k); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    return { P, W: cx - spacing, b0, b1 };
  }
  function ledTitle(c, x, y, s, spacing, on, off, padx, pady) {
    const u = U(); spacing = spacing == null ? 1 : spacing; on = on || ["l", "k", "j"]; off = off || "y"; padx = padx == null ? 2 : padx; pady = pady == null ? 1 : pady;
    const { P, W, b0, b1 } = ledField(c, s, spacing), cols = W + 2 * padx, rws = b1 - b0 + 1 + 2 * pady;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rws; j++) {
      const a = i - padx, b = j - pady + b0, X = x + 2 * i, Y = y + 2 * j;
      if (P.has(u.K(a, b))) { c.px(X, Y, on[0]); c.px(X + 1, Y, on[1]); c.px(X, Y + 1, on[1]); c.px(X + 1, Y + 1, on[2]); }
      else c.px(X, Y, off);
    }
    return [2 * cols, 2 * rws];
  }
  let ROCKET = null;
  function porthole(c, cx, cy, r) {
    r = r || 9;
    c.disc(cx, cy, r + 1, "z"); c.disc(cx, cy, r, "w");
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (c.get(x, y) === "w" && x - cx + (y - cy) < -r * 0.7) c.px(x, y, "v");
    c.disc(cx, cy, r - 3, "z"); c.disc(cx, cy, r - 4, "y");
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 4 * k + Math.PI / 8, P = U().pyRound;
      c.px(cx + Math.trunc(P((r - 1.5) * Math.cos(a))), cy + Math.trunc(P((r - 1.5) * Math.sin(a))), "u");
    }
  }
  function miniPlanet(c, cx, cy, r) {
    r = r || 5;
    const rad = -18 * Math.PI / 180, ca = Math.cos(rad), sa = Math.sin(rad);
    const ring = (front) => {
      for (let y = cy - 6; y < cy + 7; y++) for (let x = cx - 12; x < cx + 13; x++) {
        const uu = (x - cx) * ca + (y - cy) * sa, v = -(x - cx) * sa + (y - cy) * ca, e = (uu / 10.5) ** 2 + (v / 3.0) ** 2;
        if (e > 0.55 && e <= 1.0 && (v > 0) === front) c.px(x, y, e > 0.78 ? "k" : "j");
      }
    };
    ring(false);
    c.disc(cx, cy, r + 1, "z"); c.disc(cx, cy, r, "C");
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (c.get(x, y) !== "C") continue;
      const q = x - cx + (y - cy);
      if (q > 3) c.px(x, y, "B"); else if (q < -5) c.px(x, y, "D"); else if (U().pm(y - cy + 1, 4) === 0) c.px(x, y, "B");
    }
    c.px(cx - 2, cy - 3, "t");
    ring(true);
  }
  function beacon(c, x, y) {
    c.rect(x - 1, y - 2, 8, 3, "z"); c.hline(x, y - 1, 6, "w"); c.px(x, y - 1, "v");
    c.rect(x + 1, y - 5, 4, 4, "z"); c.rect(x + 2, y - 4, 2, 2, "A"); c.px(x + 2, y - 4, "D");
    for (const [dx, dy] of [[-1, -4], [6, -4], [2, -7], [3, -7]]) c.px(x + dx, y + dy, "h");
  }
  function s6keycap(c, x, y, label, arrow) {
    const u = U(), w = arrow ? 11 : c.tw(label, 10) + 7;
    u.paint(c, u.cham(x, y, w, 11, 2), "z");
    u.paint(c, u.cham(x + 1, y + 1, w - 2, 9, 1), "x");
    c.hline(x + 2, y + 1, w - 4, "w"); c.hline(x + 2, y + 9, w - 4, "y");
    if (arrow) u.glyph(c, u.ARROW[arrow + "5"], x + 3, y + 4, "s");
    else c.text(x + u.fd(w, 2), y + 1, label, "s", { sz: 10, align: "c" });
    return w;
  }
  function selBar(c, x, y, w, h) {
    const u = U(); h = h || 14;
    const S = u.cham(x, y, w, h, 3);
    u.paint(c, u.grow(S, 1), "z");
    u.paint(c, S, "B");
    for (const k of S) { const a = u.KX(k), b = u.KY(k); if (!S.has(u.K(a, b - 1))) c.px(a, b, "C"); else if (!S.has(u.K(a, b + 1))) c.px(a, b, "g"); }
    for (const k of S) { const a = u.KX(k), b = u.KY(k); if (a < x + 4 || a >= x + w - 4) c.px(a, b, hazard(a, b)); }
    return S;
  }
  function S6(c, t) {
    const u = U(), { fancy, sparkle } = u;
    ROCKET = ROCKET || u.rows("\n...zzz.......\n..zhiizzzzz..\nzzzuuuuuuttz.\njkzuuqsquutiz\nzzzvvvvvvuuz.\n..zhiizzzzz..\n...zzz.......");
    const bx = 10, by = 5, f = ledField(c, t.title, 2), fw = 2 * (f.W + 4), fh = 2 * (f.b1 - f.b0 + 1 + 2);
    hull(c, bx, by, fw + 6, fh + 6, { k: 3, body: "z", rivets: false });
    ledTitle(c, bx + 3, by + 3, t.title, 2);
    miniPlanet(c, bx + fw + 22, by + 14);
    for (const [sx, sy] of [[bx + fw + 10, by + 2], [bx + fw + 34, by + 26], [136, 44]]) sparkle(c, sx, sy, "u", 1, "t");
    fancy(c, 14, 39, t.titleEn, "s", { outline: "z", sz: 10, spacing: 1 });
    let wEn = -1; for (const ch of t.titleEn) wEn += c.tw(ch, 10) + 1;
    for (let k = 0; k < 3; k++) c.rect(14 + wEn + 4 + k * 4, 43, 2, 2, k < 2 ? "r" : "x");
    fancy(c, 13, 50, t.tag, "u", { outline: "z", sz: 10 });
    const cw = 24 + c.tw(t.curTag, 10) + 4 + c.tw(t.cur, 12) + 8;
    hull(c, 14, 64, cw, 15, { k: 3, rivets: false });
    porthole(c, 20, 71, 10);
    u.emblem(c, t.theme, 12, 63);
    c.text(34, 68, t.curTag, "s", { sz: 10 });
    c.text(34 + c.tw(t.curTag, 10) + 4, 67, t.cur, "t", { sz: 12 });
    const n = t.items.length, mx = 12, my = 87, mw = menuW(c, t, 134, 46), mh = 12 + n * 14;
    hull(c, mx, my, mw, mh, { k: 5, body: "y", stripe: 3, thick: true });
    beacon(c, mx + mw - 20, my);
    t.items.forEach((it, i) => {
      const ry = my + 9 + i * 14;
      if (i === t.sel) {
        selBar(c, mx + 6, ry - 1, mw - 12, 14);
        u.menuIcon(c, it.icon, mx + 12, ry);
        fancy(c, mx + 27, ry, it.label, "t", { outline: null, sz: 12 });
        if (it.detail) fancy(c, mx + mw - 12, ry + 1, it.detail, "l", { outline: null, sz: 10, align: "r" });
        c.blit(ROCKET, mx - 9, ry);
      } else {
        u.menuIcon(c, it.icon, mx + 12, ry);
        c.text(mx + 27, ry, it.label, "u", { sz: 12 });
      }
      if (i > 0 && i < n - 1) for (let xx = mx + 12; xx < mx + mw - 12; xx += 4) c.px(xx, ry + 13, "x");
    });
    const cw2 = 16 + c.tw(t.coins, 10) + 8;
    hull(c, 314 - cw2, 6, cw2, 14, { k: 3, rivets: false });
    u.coinIcon(c, 314 - cw2 + 4, 8, true);
    c.text(314 - 6, 8, t.coins, "t", { sz: 10, align: "r" });
    const y = 165, hw = keysW(c, t) + 10;
    hull(c, 9, y - 2, hw + 8, 15, { k: 3, rivets: false });
    for (let b = y; b < y + 11; b++) for (let a = 9 + hw - 2; a < 9 + hw + 5; a++) c.px(a, b, hazard(a, b));
    let x = 13;
    x += s6keycap(c, x, y, null, "up") + 1;
    x += s6keycap(c, x, y, null, "down") + 3;
    c.text(x, y + 1, t.keySelect, "u", { sz: 10 }); x += c.tw(t.keySelect, 10) + 8;
    x += s6keycap(c, x, y, "Enter") + 3;
    c.text(x, y + 1, t.keyConfirm, "u", { sz: 10 });
  }

  // Chapter -> skin (ui-style.md §2). S5 and S6 are lobby-only.
  const BY_THEME = { dungeon: "S2", ruins: "S3", cave: "S1", forest: "S5", sky: "S4", cosmos: "S6" };
  PB.uiSkins = { S1, S2, S3, S4, S5, S6, BY_THEME, parts: { slab, rune, jadePanel, bubblePanel, star, pill } };
})(typeof window !== "undefined" ? window : globalThis);
