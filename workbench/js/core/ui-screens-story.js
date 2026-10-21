/* OFFLINE-ART-20261020 · UI-13a candidates: story mode screens in the G2 style.
 * Registers PB.ui.SCREENS.story_board / story_chapter / story_order /
 * story_letter / story_complete / lobby_story and puts their parts on
 * PB.uiStory. Shared kits are only called (ui-common.js / ui-kit.js /
 * ui-screens-result.js are not changed; ui.screen.lobby / lobby_generic stay
 * as they are). Everything comes from params: chapter / order / letter text of
 * the sample is in content/i18n-storyui (storyui.sample.*), real story data is supplied by the private game. Story mode has no hearts, no timer and no coins, and the
 * porter does not speak: none of them is drawn here. */
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
  const put = (c, rows, x, y, w, h, recolor) => { if (rows) c.blit(rows, x + ((w - rows[0].length) >> 1), y + ((h - rows.length) >> 1), false, recolor); };
  function bbox(rows) {
    let x0 = 1e9, y0 = 1e9;
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ".") { x0 = Math.min(x0, x); y0 = Math.min(y0, y); } });
    return [x0, y0];
  }
  // Wrapped text, at most `max` lines (more is an overflow). Chinese titles
  // that need two lines are split in the middle instead of leaving one
  // character alone on the second line.
  const colon = () => (/^zh/.test(PB.i18n.getLocale()) ? "：" : ": ");
  function lines(c, s, sz, w) {
    if (s.includes("\n")) return s.split("\n").flatMap((q) => lines(c, q, sz, w));
    const ls = U().wrap(c, s, sz, w);
    if (ls.length === 2 && !/\s/.test(s)) {
      const a = [...s], k = Math.ceil(a.length / 2), L = [a.slice(0, k).join(""), a.slice(k).join("")];
      if (L.every((q) => c.tw(q, sz) <= w)) return L;
    }
    return ls;
  }
  function para(c, x, y, s, sz, w, col, max, key, lh, align) {
    const ls = lines(c, s, sz, w);
    ls.slice(0, max).forEach((ln, i) => text(c, x, y + i * (lh || sz + 1), ln, col, sz, w, align || "l", key));
    if (ls.length > max) PB.i18n.report("overflow", key, NOBOX);
    return Math.min(ls.length, max);
  }
  // A hub scene state (scene.hub_post / hub_gallery, before / after) as the backdrop.
  function hub(c, p, dim) {
    const f = frame(p.bg || "scene.hub_post", p.state || "before");
    if (f) c.blit(f, 0, 0); else c.rect(0, 0, 320, 180, "y");
    if (dim) U().dim(c, dim);
  }
  function bar(c, title, right) {
    c.rect(0, 0, 320, 21, "z");
    K().heading(c, 6, 4, title);
    if (right) text(c, 313, 9, right, "u", 10, 300 - c.tw(title, 12) - 30, "r", "storyui.bar");
  }
  const chName = (ch) => t(ch.label) + " · " + t(ch.name);
  // 28×28 portrait; a locked one is the avatar in one flat colour.
  function portrait(c, x, y, who, locked) {
    if (!locked) { U().portrait(c, x, y, "avatar." + who); return; }
    G().box(c, x, y, 28, 28, { r: 3, rings: ["z"], fill: "w" });
    const av = frame("avatar." + who);
    if (av) c.blit(av, x + ((28 - av[0].length) >> 1), y + 28 - 2 - av.length, false, G().mono("v"));
  }
  function circle(c, cx, cy, r, col) {
    let x = r, y = 0, e = 1 - r;
    while (x >= y) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) c.px(cx + a, cy + b, col);
      y++; if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; }
    }
  }
  // Round postmark: a ring, the word, two cancel lines.
  function postmark(c, cx, cy, s, key) {
    circle(c, cx, cy, 13, "i"); circle(c, cx, cy, 11, "i");
    text(c, cx, cy - 5, s, "i", 10, 22, "c", key);
    for (const dy of [-3, 1]) for (let i = 0; i < 9; i++) if (i % 4 !== 3) c.px(cx + 15 + i, cy + dy + (i % 4 === 1 ? 1 : 0), "i");
  }
  // Order boxes: done = filled, now = gold ring, not open = faint ring.
  function orderBoxes(c, cx, y, n, done, now, locked) {
    const w = n * 7 + (n - 1) * 3;
    for (let i = 0; i < n; i++) {
      const x = cx - (w >> 1) + i * 10, d = i < done, cur = !locked && i === now;
      G().box(c, x, y, 7, 7, { r: 1, rings: [locked ? "v" : d ? "f" : cur ? "h" : "d"], fill: locked ? "u" : d ? "e" : cur ? "l" : "c" });
    }
  }
  const HAND = [".....mm.......", "..mm.mm.mm....", "..mm.mm.mm.mm.", "..mm.mm.mm.mm.", "..mm.mm.mm.mm.", "..mmmmmmmmmmm.",
    "m.mmmmmmmmmmm.", "mmmmmmmmmmmm..", ".mmmmmmmmmmm..", "..mmmmmmmmm...", "...mmmmmmmm...", "....mmmmmm...."];
  function handprint(c, x, y) {   // 14 × 12, a little paper showing through the ink
    c.blit(HAND, x, y);
    for (const [a, b] of [[5, 7], [8, 8], [4, 9], [10, 6], [7, 10]]) c.px(x + a, y + b, "c");
  }

  // ================================================================ story_board
  // Tickets (序章 + chapters) on the post-office counter: a coloured band with
  // the chapter, the recipient, the name; under the perforation one box per
  // order and the state (已读 postmark / on order n / opens after the last).
  const TICKET = { x: 11, y: 28, w: 70, h: 124, gap: 6, perf: 78 };
  function ticket(c, x, y, ch, sel) {
    const T = TICKET, locked = !!ch.locked, paper = locked ? "u" : "c", ink = locked ? "w" : "g";
    G().box(c, x, y, T.w, T.h, { r: 3, rings: sel ? ["t", "z"] : ["z"], fill: paper });
    const k = sel ? 2 : 1;
    c.rect(x + k, y + k, T.w - 2 * k, 12 - k, locked ? "w" : ch.color || "e");
    text(c, x + (T.w >> 1), y + 2, t(ch.label), locked ? "u" : "t", 10, T.w - 8, "c", ch.label);
    portrait(c, x + ((T.w - 28) >> 1), y + 16, ch.who, locked);
    para(c, x + (T.w >> 1), y + 48, t(ch.name), 12, T.w - 8, ink, 2, ch.name, 13, "c");
    const py = y + T.perf;
    for (let xx = x + 5; xx < x + T.w - 5; xx += 2) c.px(xx, py, locked ? "v" : "d");
    for (const sx of [x, x + T.w - 1]) { c.vline(sx, py - 2, 5, "z"); c.vline(sx + (sx === x ? 1 : -1), py - 1, 3, "z"); }
    orderBoxes(c, x + (T.w >> 1), py + 5, ch.orders, ch.done | 0, ch.done | 0, locked);
    const sy = py + 16;
    if (ch.read) postmark(c, x + (T.w >> 1) - 8, sy + 13, t("storyui.read"), "storyui.read");
    else if (locked) para(c, x + (T.w >> 1), sy, t("storyui.locked"), 10, T.w - 8, "w", 2, "storyui.locked", 11, "c");
    else para(c, x + (T.w >> 1), sy, t("storyui.on", { n: (ch.done | 0) + 1 }), 10, T.w - 8, "h", 2, "storyui.on", 11, "c");
  }
  function board(r, tick, p, st) {
    const c = new (U().C)(r), f = focus(p, st), T = TICKET;
    hub(c, p, 2);
    bar(c, t("storyui.board.title"), t("storyui.board.hint"));
    p.chapters.forEach((ch, i) => ticket(c, T.x + i * (T.w + T.gap), T.y, ch, i === f));
    K().cursor(c, T.x + f * (T.w + T.gap) + (T.w >> 1), T.y - 2, "down");
    G().keybar(c, [[["left", "right"], t("keys.select")], [["Enter"], t("storyui.open")], [["Esc"], t("keys.back")]], 160, 164, "c");
  }

  // ================================================================ story_chapter
  // One chapter: name, one line, the recipient, the orders (done / this one / not open).
  function chapter(r, tick, p, st) {
    const c = new (U().C)(r), ch = p.chapter, f = focus(p, st);
    hub(c, p, 2);
    bar(c, chName(ch), ch.map ? t(ch.map) : "");
    K().panel(c, 10, 26, 300, 46, true);
    U().portrait(c, 18, 35, "avatar." + ch.who);
    para(c, 54, 31, t(ch.line), 10, 248, "t", 3, ch.line, 12);
    p.orders.forEach((o, i) => {
      const y = 77 + i * 20, sel = i === f, locked = o.state === "locked", stt = locked ? "dis" : sel ? "sel" : "n";
      G().box(c, 18, y, 284, 18, G().STYLE.btn[stt]);
      const ink = G().STYLE.btnText[stt];
      text(c, 26, y + 3, String(i + 1), ink, 12, 12, "l", "storyui.order.n");
      const tag = t("storyui.order." + o.state), tw = c.tw(tag, 10) + 8, room = 296 - tw - 14 - 40;
      text(c, 40, y + 3, locked ? "？？？？" : t(o.name), ink, 12, room, "l", locked ? "storyui.order.locked" : o.name);   // a closed order does not show its name
      if (o.state === "now") K().tag(c, 296 - tw, y + 3, tag);
      else if (o.state === "done") { K().tag(c, 296 - tw, y + 3, tag, { alt: true }); U().glyph(c, CHECK, 296 - tw - 10, y + 6, "m"); }
      else text(c, 296, y + 4, tag, "w", 10, 60, "r", "storyui.order.locked");
      if (sel) K().cursor(c, 15, y + 9);
    });
    G().keybar(c, [[["up", "down"], t("keys.select")], [["Enter"], t("storyui.open")], [["Esc"], t("keys.back")]], 160, 164, "c");
  }
  const CHECK = ["......#", ".....##", "#...##.", "##.##..", ".###...", "..#...."];

  // ================================================================ story_order
  // Before one order: name, cargo, sender → recipient, the address, the rooms.
  function order(r, tick, p, st) {
    const c = new (U().C)(r), ch = p.chapter, f = focus(p, st);
    hub(c, p, 2);
    bar(c, t(ch.label) + " · " + t("storyui.order.n", { n: p.n }), t("storyui.order.easy"));   // no hearts, no timer: said once, up here
    const X = 16, Y = 24, W = 288, H = 134;
    K().panel(c, X, Y, W, H);
    text(c, 160, Y + 5, "「" + t(p.name) + "」", "t", 12, W - 20, "c", p.name);
    c.hline(X + 6, Y + 20, W - 12, "x");
    const lab = (x, y, key, w) => text(c, x, y, t(key), "u", 10, w || 60, "l", key);
    // cargo
    lab(X + 12, Y + 24, "storyui.order.cargo");
    K().well(c, X + 12, Y + 36, 28, 28, false);
    put(c, frame(p.look ? p.look[0] : "cargo." + p.cargo, p.look ? p.look[1] : 0), X + 12, Y + 36, 28, 28);
    para(c, X + 44, Y + 40, t(p.cargoName || "cargo." + p.cargo + ".name"), 10, 62, "t", 2, p.cargoName, 11);
    // sender → recipient
    const sx = X + 110, rx0 = X + 195;
    lab(sx, Y + 24, "storyui.order.from", 80); lab(rx0, Y + 24, "storyui.order.to", 80);
    U().portrait(c, sx, Y + 36, "avatar." + p.from); U().portrait(c, rx0, Y + 36, "avatar." + p.to);
    para(c, sx + 31, Y + 40, t("recipient." + p.from + ".name"), 10, 42, "t", 2, "recipient." + p.from + ".name", 11);
    para(c, rx0 + 31, Y + 40, t("recipient." + p.to + ".name"), 10, X + W - 8 - rx0 - 31, "t", 2, "recipient." + p.to + ".name", 11);
    U().glyph(c, U().ARROW.right7, sx + 75, Y + 47, "m");
    // the address, on a strip of envelope paper
    const aw = W - 24, al = t("storyui.order.address"), lw = c.tw(al, 10) + 4;
    G().box(c, X + 12, Y + 70, aw, 17, { r: 2, rings: ["z"], fill: "c" });
    text(c, X + 17, Y + 73, al, "f", 10, 40, "l", "storyui.order.address");
    text(c, X + 17 + lw, Y + 72, "“" + t(p.address) + "”", "g", 12, aw - 12 - lw, "l", p.address);
    // rooms to walk
    const rooms = p.rooms || [], rl = t("storyui.order.rooms", { n: rooms.length });
    text(c, X + 12, Y + 94, rl, "u", 10, 90, "l", "storyui.order.rooms");
    let rx = X + 12 + Math.min(90, c.tw(rl, 10)) + 6;
    rooms.forEach((q, i) => {   // q: room id, or [id, part] = which part of "渡门 · 符文监狱" to show
      const [id, part] = Array.isArray(q) ? q : [q, 0], full = t("artdemo." + id + ".name"), name = full.split(" · ")[part] || full, w = c.tw(name, 10) + 8;
      G().box(c, rx, Y + 93, w, 12, { r: 2, rings: ["z"], fill: i === rooms.length - 1 ? "x" : "w" });
      text(c, rx + 4, Y + 94, name, "t", 10, w - 6, "l", "artdemo." + id + ".name");
      rx += w; if (i < rooms.length - 1) { U().glyph(c, U().ARROW.right5, rx + 2, Y + 96, "u"); rx += 9; }
    });
    if (rx > X + W - 8) PB.i18n.report("overflow", "storyui.order.rooms", NOBOX);
    const bw = 76;
    [["d2.go", 0], ["keys.back", 1]].forEach(([key, i]) => K().button(c, 160 - bw - 4 + i * (bw + 8), Y + 111, bw, 18, t(key), f === i ? "sel" : "n", { id: key }));
    G().keybar(c, [[["left", "right"], t("keys.select")], [["Enter"], t("keys.confirm")]], 160, 164, "c");
  }

  // ================================================================ story_letter
  // The thank-you letter: paper, body, signature (name or the green handprint),
  // the enclosed thing; copies > 1 stacks identical letters behind.
  function letter(r, tick, p, st) {
    const c = new (U().C)(r), ch = p.chapter;
    hub(c, p, 2);
    bar(c, t("storyui.letter.title"), chName(ch));
    const X = 66, Y = 28, W = 188, H = 122;
    for (let i = (p.copies || 1) - 1; i > 0; i--) G().box(c, X + i * 5, Y + i * 3, W, H, { r: 2, rings: ["z"], fill: i % 2 ? "d" : "c" });
    G().box(c, X, Y, W, H, { r: 2, rings: ["z"], fill: "c" });
    for (let yy = Y + 26; yy <= Y + H - 40; yy += 14) c.hline(X + 10, yy, W - 20, "d");
    if ((p.copies || 1) > 1) {
      const s = t("storyui.letter.copies", { n: p.copies }), w = c.tw(s, 10) + 8;
      G().box(c, X + W - w + 6, Y - 6, w, 12, { r: 2, rings: ["z"], fill: "k" });
      text(c, X + W - w + 10, Y - 5, s, "z", 10, w - 6, "l", "storyui.letter.copies");
    }
    para(c, X + 12, Y + 13, t(p.body), 12, W - 24, "g", 4, p.body, 14);
    // signature, bottom right: a name, or the green handprint
    const by = Y + H - 33;
    text(c, X + W - 12, by, t("storyui.letter.sign"), "f", 10, 60, "r", "storyui.letter.sign");
    if (p.sign === "hand") handprint(c, X + W - 12 - 14, by + 13);
    else text(c, X + W - 12, by + 13, t(p.sign), "g", 12, 80, "r", p.sign);
    // enclosed, bottom left
    if (p.attach) {
      text(c, X + 12, by, t("storyui.letter.attach"), "f", 10, 60, "l", "storyui.letter.attach");
      G().box(c, X + 12, by + 11, 18, 18, { r: 2, rings: ["f"], fill: "d" });
      put(c, frame(p.attach[0], p.attach[1]), X + 13, by + 12, 16, 16);
      text(c, X + 34, by + 15, t(p.attachName), "g", 10, 90, "l", p.attachName);
    }
    G().keybar(c, [[["Enter"], t("storyui.letter.keep")]], 160, 164, "c");
  }

  // ================================================================ story_complete
  // A chapter read: the keepsake goes into the gallery (drawn on its spot in
  // the gallery behind), a hand joins (portrait + line), the next chapter opens.
  function complete(r, tick, p, st) {
    const c = new (U().C)(r), ch = p.chapter;
    hub(c, Object.assign({ bg: "scene.hub_gallery" }, p), 1);
    const ks = frame(p.keepsake[0], p.keepsake[1]);
    if (ks && p.spot) {
      const [ox, oy] = bbox(ks), x = p.spot[0] - ox, y = p.spot[1] - oy, s = (tick >> 3) % 3;
      c.blit(ks, x, y);
      U().sparkle(c, x + 15, y + 1 + s, "l", 1, "t"); U().sparkle(c, x - 1, y + 9 - s, "k", 1);
      const nw = c.tw(t("storyui.new"), 10) + 8; K().tag(c, x + 8 - (nw >> 1), y - 14, t("storyui.new"));
    }
    const X = 8, Y = 22, W = 200, H = 138, tx = X + 42, tw = W - 48;
    K().panel(c, X, Y, W, H); K().title(c, X, Y + 1, W, t("storyui.done.title", { ch: t(ch.label) }));
    text(c, X + (W >> 1), Y + 22, "「" + t(ch.name) + "」", "u", 10, W - 16, "c", ch.name);
    // 1 the keepsake → the gallery
    let y = Y + 36;
    K().well(c, X + 8, y, 28, 28, false); put(c, ks, X + 8, y, 28, 28);
    text(c, tx, y + 2, t("storyui.done.gallery"), "u", 10, tw, "l", "storyui.done.gallery");
    text(c, tx, y + 14, t(p.keepsakeName), "t", 12, tw, "l", p.keepsakeName);
    // 2 a hand joins: portrait + their line
    y += 34;
    U().portrait(c, X + 8, y, "avatar." + p.crew);
    text(c, tx, y, t("storyui.done.crew") + colon() + t(p.crewName), "m", 10, tw, "l", "storyui.done.crew");
    para(c, tx, y + 12, "“" + t(p.crewLine) + "”", 10, tw, "t", 2, p.crewLine, 11);
    // 3 the next chapter opens: its recipient
    y += 36;
    const nx = p.next;
    U().portrait(c, X + 8, y, "avatar." + nx.who);
    text(c, tx, y + 2, t("storyui.done.next"), "u", 10, tw, "l", "storyui.done.next");
    text(c, tx, y + 14, t("storyui.chname", { ch: t(nx.label), name: t(nx.name) }), "t", 10, tw, "l", nx.name);
    G().keybar(c, [[["Enter"], t("keys.confirm")]], 160, 164, "c");
  }

  // ================================================================ lobby_story
  // lobby_generic with one more entry (关卡 / 配送 / 剧情 / 设置 / 退出); the
  // five buttons are 19 px apart so they sit between the logo and the key bar.
  function lobby(r, tick, p, st) {
    PB.uiStyle.backdrop(r, p.theme || "theme.diyu", tick, st.env || "full", true);
    const c = new (U().C)(r), k = K(), f = focus(p, st), items = p.items;
    k.logo(c, 16, 10);
    k.coins(c, 313, 6, p.coins == null ? 1280 : p.coins);
    const w = Math.max(104, ...items.map((it) => c.tw(t(it.key), 12) + 24)), Y0 = 65, DY = 19;
    items.forEach((it, i) => {
      k.button(c, 22, Y0 + i * DY, w, 18, t(it.key), f === i ? "sel" : "n", { id: it.key });
      if (it.new) k.tag(c, 22 + w + 4, Y0 + i * DY + 3, t("storyui.new"));
    });
    k.cursor(c, 19, Y0 + 8 + f * DY);
    G().keybar(c, [[["up", "down"], t("keys.select")], [["Enter"], t("keys.confirm")]], 10, 163);
  }

  const ck = (fn) => function (r, tick, p, st) {
    G().takeIssues();
    try { fn(r, tick || 0, p || {}, st || {}); }
    finally { for (const it of G().takeIssues()) PB.i18n.report(it.kind, it.key, NOBOX); }
  };
  Object.assign(PB.ui.SCREENS, { story_board: ck(board), story_chapter: ck(chapter), story_order: ck(order), story_letter: ck(letter), story_complete: ck(complete), lobby_story: ck(lobby) });
  PB.uiStory = { TICKET, HAND, CHECK, text, frame, put, lines, para, hub, bar, portrait, postmark, orderBoxes, handprint, ticket, board, chapter, order, letter, complete, lobby };
})(typeof window !== "undefined" ? window : globalThis);
