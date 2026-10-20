/* UI-10a · shared G2 dark blue rounded components.
 * Promoted from ui-generic.js without changing the UI-09 proposal.
 * PB.uiCommon.kit accepts the original G2 component signatures; colours are
 * ENDESGA32 codes. Text is supplied by callers through PB.i18n / common tables.
 * Nothing here registers screens, so later packages can share the same kit. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const U = () => PB.uk, S = () => PB.sprites, I = () => PB.i18n;
  const W = 320, H = 180, fd = (a, b) => Math.floor(a / b);
  const ARROWS = ["up", "down", "left", "right"];
  const t = (key, vars) => I().t(key, vars);
  const coinsText = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  // ================================================================ text checks
  // Every string goes through line(): it reports text wider than its room, text
  // past the screen edge and characters the fonts do not have.
  let issues = [];
  function report(kind, key, detail) { if (issues.length < 200) issues.push({ kind, key, detail }); }
  function fontOf(sz) { return sz === 10 ? PB.FONT_SMALL : PB.FONT; }
  function line(c, x, y, s, col, o, room, key) {
    o = Object.assign({ sz: 12 }, o || {});
    const w = c.tw(s, o.sz, o.scale), F = fontOf(o.sz);
    if (room != null && w > room) report("overflow", key || s, w + " > " + room);
    const x0 = o.align === "c" ? x - fd(w, 2) : o.align === "r" ? x - w : x;
    if (c.w === W && (x0 < 0 || x0 + w > W)) report("offscreen", key || s, x0 + ".." + (x0 + w));
    if (F && F.glyphs) for (const ch of s) if (!/\s/.test(ch) && !F.glyphs[ch]) report("glyph", key || s, ch);
    c.text(x, y, s, col, o);
    return w;
  }

  // ================================================================ shapes
  const MONO = {};
  function mono(col) {
    if (!MONO[col]) { const m = {}; for (const k of PB.CODES) m[k] = col; MONO[col] = m; }
    return MONO[col];
  }
  function icon(sid, name) { return U().frame(sid, S().get(sid).animations[name].frames[0]); }
  function maskOf(x, y, w, h, r) { const u = U(); return r > 0 ? u.roundM(x, y, w, h, r) : u.rectM(x, y, w, h); }
  function ring(c, M, col) {
    const u = U(), In = u.shrink(M, 1);
    for (const k of M) if (!In.has(k)) c.px(u.KX(k), u.KY(k), col);
    return In;
  }
  // The n rows of M nearest its top (dir -1) or bottom (dir 1) edge, per column.
  function band(c, M, col, n, dir) {
    const u = U();
    for (const k of M) { const a = u.KX(k), b = u.KY(k); for (let i = 1; i <= n; i++) if (!M.has(u.K(a, b + dir * i))) { c.px(a, b, col); break; } }
  }
  // A box: rings from the outside in, fill, top / bottom bands. Returns the fill mask.
  // s = { r, rings: [colour], fill, top: [colour, n], bottom: [colour, n] }
  function box(c, x, y, w, h, s) {
    let In = maskOf(x, y, w, h, s.r || 0);
    for (const col of s.rings || []) In = ring(c, In, col);
    if (s.fill) U().paint(c, In, s.fill);
    if (s.top) band(c, In, s.top[0], s.top[1], -1);
    if (s.bottom) band(c, In, s.bottom[0], s.bottom[1], 1);
    return In;
  }
  const ringsOf = (s) => (s.rings || []).length;
  const faceOf = (s, y, h) => { const rc = ringsOf(s); return { top: y + rc, h: h - 2 * rc - ((s.bottom && s.bottom[1]) || 0) }; };
  // Rings grown around a fill mask (bubbles, dots, triangles).
  function layered(c, F, rings, fill) {
    const u = U(), n = rings.length;
    for (let i = 0; i < n; i++) for (const k of u.grow(F, n - i, false)) c.px(u.KX(k), u.KY(k), rings[i]);
    u.paint(c, F, fill);
  }
  function triMask(x, y, n, dir) {
    const u = U(), M = new Set();
    // Tip at (x, y); i = distance from the tip, the base (i = n) is 2n + 1 long.
    for (let i = 0; i <= n; i++) for (let j = -i; j <= i; j++) {
      if (dir === "left") M.add(u.K(x + i, y + j)); else if (dir === "up") M.add(u.K(x + j, y + i));
      else if (dir === "down") M.add(u.K(x + j, y - i)); else M.add(u.K(x - i, y + j));
    }
    return M;
  }
  function discMask(cx, cy, r) {
    const u = U(), M = new Set();
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r * 0.8) M.add(u.K(cx + i, cy + j));
    return M;
  }
  // Speech bubble fill: rounded box plus a tail under it, its straight edge at tx.
  function sayMask(x, y, w, h, r, tx, len, flip) {
    const u = U(), F = maskOf(x, y, w, h, r);
    for (let i = 0; i < len; i++) for (let a = 0; a < len - i; a++) F.add(u.K(tx + (flip ? -a : a), y + h + i));
    return F;
  }
  // Title with a scale-2 headline, a drop under it and an outline (lobby logo).
  function bigText(c, x, y, s, fill, line1, drop) {
    line(c, x, y + 2, s, drop, { sz: 12, scale: 2, outline: drop });
    line(c, x, y, s, fill, { sz: 12, scale: 2, outline: line1 });
  }

  // ================================================================ the style: G2 深蓝圆角
  // P is the token table (which colour, radius and line goes where); K draws the
  // components from it. ENDESGA32 codes, see raster.js.
  const P = {
    id: "G2", name: "深蓝圆角",
    line: "深蓝圆角面板，外圈一道深色边、里面一道浅色细边，选中时反成白底深字，薄荷绿只做小点缀：安静、不抢画面。",
    fits: "适合：亮图（深色面板最显眼）和暗图（浅色细边把面板和背景分开）；夜里玩眼睛舒服，和现在的界面最接近，改起来最省事。",
    notFits: "不适合：想要明快、热闹的感觉；在石牢、地府这类深蓝深紫的地图上，面板主要靠浅色细边分开。",
    short: "深蓝面板 · 浅色细边 · 反白选中 · 亮色点缀",
    colors: [["y", "面板底色"], ["z", "外描边"], ["u", "浅色细边、次要字"], ["x", "按钮、按键、分隔线"], ["w", "按钮高光、不能按"], ["t", "正文字、选中底"], ["m", "点缀：光标、开关开、标记"]],
    ink: "t", sub: "u", dis: "w",
    panel: { r: 4, rings: ["z", "u"], fill: "y" },
    small: { r: 3, rings: ["z", "u"], fill: "y" },
    plate: { r: 3, rings: ["z", "u"], fill: "y" }, plateText: "t", plateSub: "u",
    btn: { n: { r: 3, rings: ["z"], fill: "x", top: ["w", 1] }, sel: { r: 3, rings: ["z"], fill: "t", bottom: ["u", 1] }, dis: { r: 3, rings: ["z", "x"], fill: "y" } },
    btnText: { n: "t", sel: "y", dis: "w" },
    icons: { n: null, sel: mono("y"), dis: mono("w") },
    rowSel: { r: 3, fill: "t" },
    key: { r: 1, rings: ["z"], fill: "x", top: ["w", 1] }, keyText: "t",
    cursor: { fill: "m", line: "z" },
    say: { r: 3, rings: ["z", "u"], fill: "y", text: "t" }, think: { r: 4, rings: ["z", "u"], fill: "y", text: "u" },
    slider: { line: "z", track: "x", fill: "m", knob: "t" },
    toggle: { line: "z", on: "m", off: "x", knob: "t" },
    tag: { r: 2, fill: "m", text: "y" }, tagAlt: { r: 2, rings: ["u"], fill: "y", text: "t" },
    well: { r: 2, rings: ["z"], fill: "z" }, wellSel: { r: 2, rings: ["m"], fill: "z" },
    rowH: 15, rowGap: 0, padX: 8, padB: 6, titleOver: 0, titleH: 24,
  };

  const K = {
    keyW: (c, label) => (ARROWS.includes(label) ? 11 : c.tw(label, 10) + 7),
    keycap(c, x, y, label) {
      const w = K.keyW(c, label), u = U(), col = P.keyText;
      box(c, x, y, w, 11, P.key);
      if (label === "up" || label === "down") u.glyph(c, u.ARROW[label + "5"], x + 3, y + 3, col);
      else if (label === "left" || label === "right") u.glyph(c, u.ARROW[label + "5"], x + 4, y + 2, col);
      else line(c, x + fd(w, 2), y + 1, label, col, { sz: 10, align: "c" });
      return w;
    },
    panel: (c, x, y, w, h, small) => box(c, x, y, w, h, small ? P.small : P.panel),
    plate: (c, x, y, w, h) => box(c, x, y, w, h, P.plate),
    // "— 暂停 —": centred title with two mint dashes, a dark rule under it.
    title(c, x, y, w, text) {
      const tw = line(c, x + fd(w, 2), y + 6, text, "t", { sz: 12, align: "c" }, w - 40, "title");
      const l = x + fd(w, 2) - fd(tw, 2) - 6, r = x + fd(w, 2) + tw - fd(tw, 2) + 5;
      c.hline(l - 7, y + 11, 7, "m"); c.hline(r + 1, y + 11, 7, "m");
      c.hline(x + 6, y + 20, w - 12, "x");
    },
    logo(c, x, y) {
      bigText(c, x, y, t("game.title"), "t", "z", "y");
      line(c, x + 2, y + 28, "PORTITOR", "m", { sz: 10, spacing: 2, outline: "z" });
      line(c, x, y + 43, t("game.tagline"), "t", { sz: 10, outline: "z" });
    },
    // Icon + label (+ keycap at the right end) inside a box face.
    content(c, x, y, w, face, label, st, o) {
      o = o || {};
      const ic = o.icon ? icon(o.icon[0], o.icon[1]) : null, iw = ic ? ic[0].length + 4 : 0;
      const kw = o.key ? K.keyW(c, o.key) + 4 : 0, pad = o.pad == null ? 6 : o.pad, lw = c.tw(label, 12);
      const room = w - 2 * pad - iw - kw;
      let xx = o.align === "l" ? x + pad : x + pad + Math.max(0, fd(room - lw, 2));
      if (ic) { c.blit(ic, xx, face.top + fd(face.h - ic.length, 2), false, P.icons[st]); xx += iw; }
      line(c, xx, face.top + fd(face.h - 11, 2), label, P.btnText[st], { sz: 12 }, room, o.id || label);
      if (o.key) K.keycap(c, x + w - pad - kw + 4, face.top + fd(face.h - 11, 2), o.key);
    },
    // st: "n" normal, "sel" selected, "dis" can't press.
    button(c, x, y, w, h, label, st, o) {
      const s = P.btn[st];
      box(c, x, y, w, h, s);
      K.content(c, x, y, w, faceOf(s, y, h), label, st, o);
    },
    iconButton(c, x, y, w, h, ic, st) {
      const s = P.btn[st], f = faceOf(s, y, h);
      box(c, x, y, w, h, s);
      c.blit(ic, x + fd(w - ic[0].length, 2), f.top + fd(f.h - ic.length, 2), false, P.icons[st]);
    },
    // Menu row: plain text on the panel; the selected row is a white bar.
    row(c, x, y, w, h, label, st, o) {
      o = Object.assign({ align: "l" }, o || {});
      const s = st === "sel" ? P.rowSel : { r: 0 };
      if (st === "sel") box(c, x, y, w, h, s);
      K.content(c, x, y, w, faceOf(s, y, h), label, st, o);
    },
    cursor: (c, x, y, dir) => layered(c, triMask(x, y, 3, dir || "right"), [P.cursor.line], P.cursor.fill),
    slider(c, x, y, w, v) {
      const s = P.slider, fx = x + 3 + Math.round((w - 7) * v);
      box(c, x, y + 2, w, 5, { r: 2, rings: [s.line], fill: s.track });
      c.rect(x + 1, y + 3, fx - x - 1, 3, s.fill);
      box(c, fx - 3, y, 7, 9, { r: 2, rings: [s.line], fill: s.knob });
    },
    toggle(c, x, y, on) {
      const s = P.toggle;
      box(c, x, y, 19, 11, { r: 5, rings: [s.line], fill: on ? s.on : s.off });
      box(c, on ? x + 9 : x + 1, y + 1, 9, 9, { r: 4, fill: s.knob });
    },
    // o.alt: the quiet tag (当前); o.icon: rows drawn before the text.
    tag(c, x, y, text, o) {
      o = o || {};
      const s = o.alt ? P.tagAlt : P.tag, ic = o.icon || null, iw = ic ? ic[0].length + 1 : 0, w = c.tw(text, 10) + 8 + iw;
      box(c, x, y, w, 12, s);
      let xx = x + 4;
      if (ic) { c.blit(ic, xx - 1, y + fd(12 - ic.length, 2)); xx += iw; }
      line(c, xx, y + 1, text, s.text, { sz: 10 });
      return w;
    },
    say(c, x, y, w, h, tx, text) {
      const s = P.say, rc = s.rings.length;
      layered(c, sayMask(x + rc, y + rc, w - 2 * rc, h - 2 * rc, s.r, tx, 4, tx > x + w / 2), s.rings, s.fill);
      line(c, x + fd(w, 2), y + fd(h - 11, 2), text, s.text, { sz: 12, align: "c" }, w - 2 * rc - 6, "say");
    },
    think(c, x, y, w, h, tx, text) {
      const s = P.think, rc = s.rings.length;
      layered(c, maskOf(x + rc, y + rc, w - 2 * rc, h - 2 * rc, s.r), s.rings, s.fill);
      layered(c, discMask(tx + 2, y + h + 2, 2), s.rings, s.fill);
      layered(c, discMask(tx - 2, y + h + 7, 1), s.rings, s.fill);
      line(c, x + fd(w, 2), y + fd(h - 11, 2), text, s.text, { sz: 12, align: "c" }, w - 2 * rc - 6, "think");
    },
    coins(c, xr, y, n) {
      const s = coinsText(n), w = 6 + 9 + 4 + c.tw(s, 12) + 6, x = xr - w, f = faceOf(P.plate, y, 17);
      K.plate(c, x, y, w, 17);
      U().coinIcon(c, x + 6, f.top + fd(f.h - 9, 2), true);
      line(c, x + 19, f.top + fd(f.h - 11, 2), s, P.plateText, { sz: 12 });
      return w;
    },
    heading(c, x, y, text) {
      const w = c.tw(text, 12) + 14, f = faceOf(P.plate, y, 17);
      K.plate(c, x, y, w, 17);
      line(c, x + 7, f.top + fd(f.h - 11, 2), text, P.plateText, { sz: 12 });
      return w;
    },
    // Reel window: the scrolling strip of a reel (inside a small panel).
    well: (c, x, y, w, h, sel) => box(c, x, y, w, h, sel ? P.wellSel : P.well),
  };

  // ================================================================ sample screens
  // Bottom key hints: keycaps + labels on a plate.
  function keybar(c, items, x, y, align) {
    let w = 0;
    items.forEach(([ks, lab], n) => {
      ks.forEach((key, i) => { w += K.keyW(c, key) + (i < ks.length - 1 ? 1 : 0); });
      w += 3 + c.tw(lab, 10) + (n < items.length - 1 ? 9 : 0);
    });
    const pw = w + 12;
    if (align === "c") x -= fd(pw, 2); else if (align === "r") x -= pw;
    K.plate(c, x, y - 2, pw, 15);
    let xx = x + 6;
    for (const [ks, lab] of items) {
      ks.forEach((key, i) => { xx += K.keycap(c, xx, y, key) + (i < ks.length - 1 ? 1 : 0); });
      xx += 3; xx += line(c, xx, y + 1, lab, P.plateText, { sz: 10 }) + 9;
    }
    return pw;
  }

  PB.uiCommon = {
    STYLE: P, kit: K, t, line, keybar, icon, box, mono, maskOf,
    layered, triMask, discMask, sayMask, ringsOf, faceOf,
    takeIssues() { const out = issues; issues = []; return out; },
  };
})(typeof window !== "undefined" ? window : globalThis);
