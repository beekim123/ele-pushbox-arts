/* ART-04o 地图概念场景 · 千层书库（endless_library）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 地标：看不到顶的书架墙（往上隐进灰褐）、一排绿罩台灯（夹层下的阅览桌）、吸纸卷往上走的传书管。
 * 机关外观：ladder（带滑轮的书梯）、paper（纸扎箱）、conveyor（把书送进传书管的传送带）。
 * 环境（4 fps）：散页成群绕一圈落回书架、纸卷嗖地上管、台灯光圈里灰尘慢飘、传送带走动。
 * 动物（8 fps）：书虫（怪物，从被钻塌的巨书里探头）、书库猫（提示动物，趴在夹层书柜上甩尾）。
 * 比例尺：主角人影 + 木箱 + 纸扎箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180;
  const FLOOR = 148;                               // top of the carpet (16 px grid rows start at y = 4)
  const TUBE_X = 16;                               // pneumatic book tube x 16–31
  const CONV_X0 = 40, CONV_X1 = 104, CONV_Y = 68;  // conveyor belt x 40–103, belt top y 68, runs left
  const PILE_X0 = 56, PILE_X1 = 104, PILE_Y = 116; // three giant books x 56–103, y 116–147
  const HERO_X = 112, CRATE_X = 128, PAPER_X = 144;
  const LAD_X = 192;                               // rolling ladder x 192–207, y 76–147
  const MZ_X = 208, MZ_Y = 84;                     // gallery x 208–319, slab y 84–91
  const CASE_X = 272, CASE_Y = 68;                 // short bookcase on the gallery, the cat lies on top
  const DESK_Y = 128, LAMPS = [236, 268, 300], LAMP_Y = 112;
  const BOARDS = [7, 27, 47, 67, 87, 107, 127];   // background shelf boards (2 px)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null, REV = null;

  function tri(t, period, amp) {                  // integer triangle wave in [-amp, amp]
    const p = ((t % period) + period) % period, half = period >> 1;
    return Math.floor(((p < half ? p : period - p) * 4 * amp) / period) - amp;
  }
  const hash = (x, y, s) => PB.h32(x, y, s);
  const layer = () => new PB.Raster(W, H);
  function spr(r, rows, x, y, flip, map) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j], w = row.length;
      for (let i = 0; i < w; i++) {
        let c = row[flip ? w - 1 - i : i];
        if (c === ".") continue;
        if (map && map[c]) c = map[c];
        r.set(x + i, y + j, c);
      }
    }
  }
  function codeAt(r, x, y) {
    const i = (y * W + x) * 4, d = r.data;
    return d[i + 3] ? REV.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) : null;
  }
  // Re-paint already drawn pixels through a palette map (light / shadow without blending).
  function remap(r, x0, y0, x1, y1, map, test) {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(W, x1 | 0); y1 = Math.min(H, y1 | 0);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (test && !test(x, y)) continue;
      const c = codeAt(r, x, y), m = c && map[c];
      if (m && m !== c) r.set(x, y, m);
    }
  }

  // ---- sprites (palette codes; "." = transparent) ----
  const PORTER = [                                 // the protagonist, idle frame 0 (char.portitor), facing right
    "..f.............",
    ".zzz............",
    ".ili....zz......",
    ".ili...zkdz.....",
    ".zkz..zkkddz....",
    ".zfzzzkkdddFz...",
    ".zeezddddddddFz.",
    ".zfffzzyyylylz..",
    ".zekeiiiiiiih...",
    ".zffhzzCBBBBz...",
    ".zekezzCBBBBz...",
    ".zfffzzCBBBBz...",
    ".zzzzzzgggggg...",
    ".......yy.yy....",
    ".......yy.yy....",
    "......zzz.zzz...",
  ];
  const CRATE = [                                  // wooden crate (obj.crate_wood)
    "zzzzzzzzzzzzzzzz",
    "zddddddddddddddz",
    "zdeeeeeeeeeeeefz",
    "zdebbbbbbbbbddfz",
    "zdebbbbbbbbddbfz",
    "zdebbbbbbbddbbfz",
    "zdeeeeeeeddeeefz",
    "zdebbbbbddbbbbfz",
    "zdebbbbddbbbbbfz",
    "zdebbbddbbbbbbfz",
    "zdeeeddeeeeeeefz",
    "zdebddbbbbbbbbfz",
    "zdeddbbbbbbbbbfz",
    "zdeeeeeeeeeeeefz",
    "zffffffffffffffz",
    "zzzzzzzzzzzzzzzz",
  ];
  const PAPER_BOX = [                              // paper box (mechanism paper): bamboo ribs, paper panels, two loose flaps
    "..zzz......zzz..",
    "..zcFz....zFcz..",
    "zzzzzzzzzzzzzzzz",
    "zFFFFFFFFFFFFFFz",
    "zFcccFccccFcccdz",
    "zFcccFccccFcccdz",
    "zFcccFccccFcccdz",
    "zFcccFccccFcccdz",
    "zFFFFFFFFFFFFFdz",
    "zFcccFccccFcccdz",
    "zFcccFccccFcccdz",
    "zFcccFccccFcccdz",
    "zFcccFccccFcccdz",
    "zFddddddddddddFz",
    "zFFFFFFFFFFFFFFz",
    "zzzzzzzzzzzzzzzz",
  ];
  const CAT = [                                    // library cat lying on the bookcase, facing left (tail separate)
    ".zz..zz.........",
    ".zvzzvz.........",
    "zuuuuuuzzzzzzz..",
    "zumuumuuwuuwuuz.",
    "zuuuuuuuwuuwuuvz",
    "zuuDDuuuuuuuuuvz",
    ".zuuuuzuuuuuuvvz",
    ".zuuzuuzzzzzzzz.",
    "..zz.zz.........",
  ];
  const CAT_TAIL = [                               // three swing poses, hanging over the bookcase edge
    ["zu..", "zu..", ".zu.", ".zu.", ".zu.", "..zu", "..zu", "..zu", "...z"],
    ["zu..", "zu..", "zu..", "zu..", "zu..", "zu..", "zu..", "zu..", ".z.."],
    ["zu..", "zu..", "zu..", "uz..", "uz..", "z...", "u...", "u...", "z..."],
  ];
  const WORM = [                                   // bookworm crawling out of its hole to the left (tail end sits in the hole)
    ["........zzz.", ".......zFFFz", ".......zFzFz", ".......zFFFz", "........zzz."],
    ["...zzz......", "..zFFFzzzzz.", "..zFzFEcEcEz", "..zFFFcEcEcz", "...zzzzzzzz."],
    [".zzz........", "zFFFzzzzzzz.", "zFzFEcEcEcEz", "zFFFcEcEcEcz", ".zzzzzzzzzz."],
    ["zzz.........", "FFFzzzzzzzz.", "zFzEcEcEcEcz", "FFFzcEcEcEcz", "zzz.zzzzzzz."],
  ];
  const PAGE = [["d...d", ".F.F.", "..e.."], [".....", "dFeFd"], ["..e..", ".F.F.", "d...d"]];   // a loose page flapping like a small bird
  // ---- static layers ----
  const BOOKS = "ppppoogggffffhBex";             // background spines: ink green, deep red-brown, leather, a few others
  const HAZE1 = { z: "g", y: "g", x: "g", p: "g", B: "g", o: "f", n: "f", h: "f", a: "f", e: "f", F: "e", d: "e", c: "F", w: "f", v: "e" };
  const HAZE2 = { z: "x", y: "x", g: "x", p: "x", B: "x", o: "f", n: "f", h: "f", a: "f", e: "f", F: "f", d: "f", c: "e", v: "w" };
  function buildWall() {
    const r = layer();
    r.rect(0, 0, W, FLOOR, "g");
    for (let s = 0; s < BOARDS.length; s++) {     // books standing on each board (the board below is BOARDS[s] + 20)
      const top = BOARDS[s] + 2, bottom = s + 1 < BOARDS.length ? BOARDS[s + 1] - 1 : FLOOR - 1;
      let x = 0, k = 0;
      while (x < W) {
        const h = hash(k, s, 3), bw = 2 + (h % 3), bh = Math.min(bottom - top + 1, 10 + ((h >> 4) % 8));
        if (((h >> 8) % 23) === 0) { x += 3; k++; continue; }            // a gap on the shelf
        if (((h >> 12) % 17) === 0) {                                     // a short stack of books lying flat
          for (let j = 0; j < 3; j++) r.rect(x, bottom - 2 - j * 3, 9 - j, 2, BOOKS[(h >> (14 + j * 3)) % BOOKS.length]);
          x += 11; k++; continue;
        }
        const c = BOOKS[(h >> 16) % BOOKS.length];
        r.rect(x, bottom - bh + 1, bw, bh, c);
        r.vline(x + bw - 1, bottom - bh + 1, bh, PB.DIM[c]);              // shadow side (light from the left)
        if (bh > 12 && bw > 2 && (h >> 24) % 3 === 0) { r.hline(x, bottom - bh + 3, bw - 1, "f"); r.hline(x, bottom - 3, bw - 1, "f"); }
        x += bw + (((h >> 20) % 9) === 0 ? 1 : 0); k++;
      }
      r.hline(0, BOARDS[s], W, "f"); r.hline(0, BOARDS[s] + 1, W, "f"); r.hline(0, BOARDS[s] + 2, W, "z");
    }
    for (let x = 0; x < W; x += 60) { r.rect(x, 0, 3, FLOOR, "f"); r.vline(x + 3, 0, FLOOR, "z"); }
    for (const gy of [10, 40]) {                  // galleries of the storeys above, fading into the haze
      r.rect(0, gy, W, 3, "f"); r.hline(0, gy + 3, W, "z");
      r.hline(0, gy - 7, W, "f");
      for (let x = 2; x < W; x += 5) r.rect(x, gy - 6, 2, 6, "f");
    }
    // Distance haze: two steps of lower contrast upwards (dithered seams), the top shelves turn grey-brown.
    for (let y = 0; y < 100; y++) for (let x = 0; x < W; x++) {
      const lvl = Math.min(2, ((100 - y) * 16 / 24 + bay(x, y)) >> 4);
      if (!lvl) continue;
      const c = codeAt(r, x, y);
      let m = (lvl === 1 ? HAZE1 : HAZE2)[c];
      if (m === "x" && ((x + y) & 1)) m = "g";                          // dark parts: slate and brown mixed = grey-brown
      if (m && m !== c) r.set(x, y, m);
    }
    // Late-afternoon shaft from a high window on the left: one palette step lighter, dithered out downwards.
    for (let y = 0; y < 100; y++) {
      const xl = 120 + (y >> 1), lim = y < 36 ? 16 : 16 - (((y - 36) * 16 / 64) | 0);
      remap(r, xl, y, xl + 20, y + 1, PB.LIGHT, (x) => bay(x, y) < lim && !(x === xl && bay(x, y) & 1));
    }
    // Under the gallery it is darker; the reading desk stands there.
    const under = (x, y) => x >= MZ_X && y >= MZ_Y + 8 && y < FLOOR;
    r.rect(216, DESK_Y, 96, 1, "e"); r.rect(216, DESK_Y + 1, 96, 2, "f"); r.rect(218, DESK_Y + 3, 92, 2, "g");
    for (const lx of [219, 306]) { r.rect(lx, DESK_Y + 5, 2, FLOOR - DESK_Y - 5, "g"); r.vline(lx, DESK_Y + 5, FLOOR - DESK_Y - 5, "f"); }
    r.rect(244, DESK_Y - 2, 8, 2, "c"); r.hline(248, DESK_Y - 2, 1, "F");             // an open book
    r.rect(280, DESK_Y - 3, 9, 3, "h"); r.rect(281, DESK_Y - 6, 7, 3, "o"); r.hline(281, DESK_Y - 4, 7, "p");
    remap(r, MZ_X, MZ_Y + 8, W, FLOOR, PB.DIM, under);
    for (const cx of LAMPS) {                     // warm light circles of the lamps, brighter cone on the desk
      const cy = LAMP_Y + 7;
      remap(r, cx - 18, cy - 18, cx + 19, FLOOR, PB.LIGHT, (x, y) => {
        const d = (x - cx) * (x - cx) + (y - cy) * (y - cy) * 2;
        return d <= 120 || (d <= 300 && bay(x, y) < ((300 - d) * 16 / 180 | 0));
      });
      remap(r, cx - 12, LAMP_Y + 6, cx + 13, DESK_Y + 1, PB.LIGHT, (x, y) => Math.abs(x - cx) <= 3 + ((y - LAMP_Y - 6) * 9 / (DESK_Y - LAMP_Y - 6) | 0));
    }
    return r;
  }
  function drawLamp(r, cx) {                      // green banker's lamp on the desk
    const y = LAMP_Y;
    r.hline(cx - 2, y, 5, "o"); r.hline(cx - 3, y + 1, 7, "n"); r.hline(cx - 4, y + 2, 9, "n"); r.hline(cx - 4, y + 3, 9, "o");
    r.set(cx - 2, y + 1, "m"); r.set(cx - 3, y + 2, "m"); r.set(cx - 2, y + 2, "m");
    r.hline(cx - 2, y + 4, 5, "l"); r.set(cx - 2, y + 4, "k"); r.set(cx + 2, y + 4, "k");
    r.vline(cx, y + 5, DESK_Y - y - 7, "e"); r.vline(cx + 1, y + 5, DESK_Y - y - 7, "f");
    r.hline(cx - 3, DESK_Y - 2, 7, "e"); r.hline(cx - 4, DESK_Y - 1, 9, "f"); r.set(cx - 3, DESK_Y - 2, "F");
  }
  function book(r, x0, x1, y0, y1, cover, lit, dark, band) {   // a giant book lying flat, spine to the viewer
    r.rect(x0, y0, x1 - x0, y1 - y0, cover);
    r.hline(x0, y0, x1 - x0, lit); r.hline(x0, y1 - 1, x1 - x0, dark);
    r.vline(x0, y0 + 1, y1 - y0 - 2, dark); r.vline(x1 - 1, y0 + 1, y1 - y0 - 2, dark);
    for (const bx of [x0 + 3, x0 + 6, x1 - 7, x1 - 4]) r.vline(bx, y0 + 2, y1 - y0 - 4, band);
  }
  function buildFront() {
    const r = layer();
    // Floor: deep red carpet runner over dark floorboards.
    r.hline(0, FLOOR, W, "a"); r.hline(0, FLOOR + 1, W, "g");
    for (let x = 0; x < W; x++) {
      r.set(x, FLOOR + 2, x % 4 < 2 ? "e" : "g");
      for (let y = FLOOR + 3; y < FLOOR + 7; y++) {
        const dx = Math.abs((x % 8) - 4), dy = Math.abs(y - (FLOOR + 4) - 0.5);
        r.set(x, y, dx + dy * 2 === 3 ? "g" : "h");
      }
      r.set(x, FLOOR + 7, x % 4 < 2 ? "e" : "g"); r.set(x, FLOOR + 8, "g");
      for (let y = FLOOR + 9; y < H; y++) {
        const row = (y - FLOOR - 9) / 6 | 0, seam = (y - FLOOR - 9) % 6 === 5, off = (x + row * 13) % 26 === 0;
        r.set(x, y, seam || off ? "z" : y > 168 ? "g" : (hash(x >> 2, row, 7) % 5 ? "f" : "g"));
      }
    }
    // Giant books (terrain). The top one has been bored through by the worm and has caved in on the right.
    book(r, PILE_X0, PILE_X1, 138, 148, "o", "n", "p", "b");
    book(r, PILE_X0 + 1, PILE_X1 - 1, 126, 138, "e", "F", "f", "d");
    for (const [hx, hy] of [[70, 131], [90, 132]]) { r.rect(hx - 1, hy, 3, 2, "z"); r.hline(hx - 1, hy - 1, 3, "f"); r.set(hx - 2, hy + 1, "f"); r.set(hx + 2, hy, "f"); }
    for (let x = PILE_X0 + 2; x < PILE_X1 - 2; x++) {          // top book shows its page edges between red covers
      const sag = x >= 84 && x < 101 ? Math.max(0, 3 - Math.abs(x - 92) / 3 | 0) : 0;
      const y0 = PILE_Y + sag;
      r.set(x, y0, sag ? "a" : "D"); r.set(x, y0 + 1, "h");
      for (let y = y0 + 2; y < 124; y++) r.set(x, y, sag && (hash(x, y, 5) % 3 === 0) ? "e" : ((y + (x >> 3)) & 1) ? "d" : "F");
      r.set(x, 124, "h"); r.set(x, 125, "g");
    }
    r.vline(PILE_X0 + 2, PILE_Y, 10, "g"); r.vline(PILE_X1 - 3, PILE_Y, 10, "g");
    r.set(86, PILE_Y + 1, "c"); r.set(95, PILE_Y + 2, "c"); r.set(99, PILE_Y + 1, "F");  // torn page bits on the dent
    // Gallery on the right with a brass rail for the ladder, corbels and a railing.
    r.hline(MZ_X, MZ_Y, W - MZ_X, "F"); r.rect(MZ_X, MZ_Y + 1, W - MZ_X, 5, "e"); r.hline(MZ_X, MZ_Y + 6, W - MZ_X, "f"); r.hline(MZ_X, MZ_Y + 7, W - MZ_X, "g");
    for (let x = MZ_X; x < W; x++) if ((x - MZ_X) % 26 === 25) r.vline(x, MZ_Y + 1, 5, "f"); else if (hash(x, 1, 9) % 7 === 0) r.set(x, MZ_Y + 3, "F");
    r.hline(LAD_X - 4, MZ_Y + 2, W - LAD_X + 4, "d"); r.hline(LAD_X - 4, MZ_Y + 3, W - LAD_X + 4, "b");
    for (const cx of [MZ_X + 2, W - 6]) for (let j = 0; j < 6; j++) r.hline(cx + (cx > 300 ? j >> 1 : 0), MZ_Y + 8 + j, 4 - (j >> 1), j ? "f" : "e");
    r.hline(224, MZ_Y - 8, W - 224, "F"); r.hline(224, MZ_Y - 7, W - 224, "e");
    for (let x = 226; x < W; x += 6) { r.vline(x, MZ_Y - 6, 6, "e"); r.vline(x + 1, MZ_Y - 6, 6, "f"); }
    // Short bookcase on the gallery (the cat's shelf).
    r.rect(CASE_X, CASE_Y, 32, 16, "f"); r.hline(CASE_X, CASE_Y, 32, "F"); r.hline(CASE_X, CASE_Y + 1, 32, "e");
    for (const [y0, hh] of [[CASE_Y + 2, 5], [CASE_Y + 9, 6]]) {
      let x = CASE_X + 2, k = 0;
      while (x < CASE_X + 30) {
        const h = hash(k, y0, 21), bw = 2 + (h % 2), c = "nhobea"[(h >> 3) % 6], bh = hh - ((h >> 6) % 2);
        r.rect(x, y0 + hh - bh, Math.min(bw, CASE_X + 30 - x), bh, c); x += bw; k++;
      }
      r.hline(CASE_X + 1, y0 + hh, 30, "e");
    }
    r.vline(CASE_X, CASE_Y + 1, 15, "e"); r.vline(CASE_X + 31, CASE_Y + 1, 15, "g");
    // Rolling ladder (mechanism ladder): wheels at the foot, hooks over the brass rail.
    for (let y = MZ_Y - 8; y < FLOOR; y++) {
      const j = (y - (MZ_Y - 8)) % 4;
      r.set(LAD_X + 2, y, "z"); r.set(LAD_X + 3, y, "f"); r.set(LAD_X + 12, y, "f"); r.set(LAD_X + 13, y, "z");
      if (j === 1) r.hline(LAD_X + 4, y, 8, "d"); else if (j === 2) r.hline(LAD_X + 4, y, 8, "e");
    }
    for (const hx of [LAD_X + 2, LAD_X + 12]) { r.rect(hx, MZ_Y + 1, 2, 2, "x"); r.set(hx + 1, MZ_Y + 1, "w"); r.rect(hx, FLOOR - 3, 3, 3, "x"); r.set(hx + 1, FLOOR - 2, "w"); }
    // Tube: brass rims, rings, an intake funnel facing the conveyor and a foot on the floor.
    r.vline(TUBE_X, 0, FLOOR, "F"); r.vline(TUBE_X + 1, 0, FLOOR, "e"); r.vline(TUBE_X + 14, 0, FLOOR, "f"); r.vline(TUBE_X + 15, 0, FLOOR, "g");
    for (const ry of [14, 44, 102, 128]) { r.hline(TUBE_X - 1, ry, 18, "F"); r.hline(TUBE_X - 1, ry + 1, 18, "e"); r.hline(TUBE_X - 1, ry + 2, 18, "f"); }
    for (let x = TUBE_X + 14; x < CONV_X0; x++) {
      const h = 3 + ((x - TUBE_X - 14) >> 1), cy = CONV_Y + 2;
      r.set(x, cy - h, "F"); r.vline(x, cy - h + 1, 2 * h - 2, x === CONV_X0 - 1 ? "g" : "e"); r.set(x, cy + h - 1, "f");
    }
    r.rect(TUBE_X + 2, CONV_Y - 2, 12, 10, "y");                      // the opening inside the tube
    r.rect(TUBE_X - 2, FLOOR - 8, 20, 8, "e"); r.hline(TUBE_X - 2, FLOOR - 8, 20, "F"); r.hline(TUBE_X - 2, FLOOR - 1, 20, "f");
    // Conveyor legs stand on the giant books.
    for (const lx of [62, 80]) { r.rect(lx, CONV_Y + 8, 2, PILE_Y - CONV_Y - 8, "x"); r.vline(lx, CONV_Y + 8, PILE_Y - CONV_Y - 8, "w"); }
    return r;
  }
  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    const back = buildWall();
    back.rect(TUBE_X + 2, 0, 12, FLOOR, "y");                           // tube glass, dark with a cold glint
    back.vline(TUBE_X + 3, 0, FLOOR, "x"); back.vline(TUBE_X + 4, 0, FLOOR, "x");
    for (let y = 0; y < FLOOR; y += 9) back.set(TUBE_X + 11, y + (y % 4), "x");
    for (const cx of LAMPS) drawLamp(back, cx);
    const props = layer();
    spr(props, PORTER, HERO_X, FLOOR - 16);
    spr(props, CRATE, CRATE_X, FLOOR - 16);
    spr(props, PAPER_BOX, PAPER_X, FLOOR - 16);
    const motes = [];
    LAMPS.forEach((cx, i) => { for (let k = 0; k < 4; k++) { const h = hash(i, k, 31); motes.push({ cx, x: (h % 23) - 11, y: (h >> 5) % 24, p: (h >> 10) % 40 }); } });
    const pages = [];
    for (let i = 0; i < 9; i++) { const h = hash(i, 2, 41); pages.push({ rx: 229 + i * 4 + (i & 1), d: i * 1.5, ox: (h % 15) - 7, oy: ((h >> 4) % 11) - 5, f: (h >> 9) % 3 }); }
    L = { back, front: buildFront(), props, motes, pages };
  }

  // ---- ambient (4 fps) ----
  const PATH = [[244, 45], [232, 30], [204, 18], [162, 13], [120, 19], [94, 33], [98, 51], [128, 60], [172, 58], [210, 50], [234, 46], [244, 45]];
  function pathAt(s) {                             // Catmull-Rom through PATH, s in [0, 1]
    const n = PATH.length - 1, f = Math.min(n - 1e-6, Math.max(0, s * n)), i = f | 0, t = f - i;
    const p0 = PATH[Math.max(0, i - 1)], p1 = PATH[i], p2 = PATH[i + 1], p3 = PATH[Math.min(n, i + 2)];
    const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
    return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
  }
  const FLOCK = 76, TAKEOFF = 18, FLIGHT = 46;     // a flock cycle: rest on the shelf, fly one loop, land again
  function drawPages(r, a) {
    const c = a % FLOCK, start = pathAt(0);
    for (const p of L.pages) {
      const s = (c - TAKEOFF - p.d) / FLIGHT;
      if (s <= 0 || s >= 1) { r.hline(p.rx, BOARDS[2] - 1, 3, "d"); r.set(p.rx + 1, BOARDS[2] - 1, "F"); continue; }
      const [px, py] = pathAt(s), env = Math.min(1, s * 5, (1 - s) * 5);
      const x = Math.round(px + (p.rx - start[0]) * (1 - env) + p.ox * env + tri(a + p.f * 3, 6, 1)) - 1;
      const y = Math.round(py + (BOARDS[2] - 2 - start[1]) * (1 - env) + p.oy * env);
      spr(r, PAGE[(a + p.f) % 3], x, y);
    }
  }
  function drawRolls(r, a) {                       // paper rolls whoosh up the tube
    const k = a % 12;
    if (k > 6) return;
    const y = FLOOR - 12 - k * 24, x = TUBE_X + 4;
    for (let j = 4; j < 16; j++) { r.set(x + 2, y + j, j < 10 ? "w" : "x"); r.set(x + 5, y + j + 2, j < 10 ? "w" : "x"); }
    spr(r, [".cccccc.", "ccccccdF", ".dddddd."], x, y);
  }
  function drawMotes(r, a) {                       // dust drifting slowly in the lamp light
    for (const m of L.motes) {
      const y = LAMP_Y - 4 + ((m.y + ((a + m.p) >> 2)) % 26), x = m.cx + m.x + tri(a + m.p, 40, 2);
      const d = (x - m.cx) * (x - m.cx) + (y - LAMP_Y - 7) * (y - LAMP_Y - 7) * 2;
      if (d < 260 && y < DESK_Y - 3 && (Math.abs(x - m.cx) > 4 || y > LAMP_Y + 4 || y < LAMP_Y - 1)) r.set(x, y, "F");
    }
  }
  function drawConveyor(r, a) {                    // belt runs left into the tube's funnel
    for (let x = CONV_X0; x < CONV_X1; x++) {
      r.set(x, CONV_Y, (x + a) % 4 === 0 ? "x" : "w"); r.set(x, CONV_Y + 1, "x");
      for (let y = CONV_Y + 2; y < CONV_Y + 6; y++) r.set(x, y, "f");
      r.set(x, CONV_Y + 6, (x - a) % 4 === 0 ? "x" : "y"); r.set(x, CONV_Y + 7, "g");
    }
    r.set(CONV_X0, CONV_Y, "."); r.set(CONV_X1 - 1, CONV_Y + 7, "g");
    for (let cx = CONV_X0 + 4; cx < CONV_X1; cx += 16) {        // rollers turn (two spoke poses)
      r.rect(cx - 1, CONV_Y + 2, 4, 4, "x"); r.set(cx - 1, CONV_Y + 2, "f"); r.set(cx + 2, CONV_Y + 5, "f");
      if (a & 1) r.hline(cx - 1, CONV_Y + 3 + (a & 2 ? 1 : 0), 4, "w"); else r.vline(cx + (a & 2 ? 1 : 0), CONV_Y + 2, 4, "w");
    }
    for (let k = 0; k < 4; k++) {                               // chevrons on the side plate drift left
      const cx = CONV_X0 + 2 + ((k * 16 + 12 - (a % 16) + 64) % 64);
      if (cx < CONV_X0 + 2 || cx > CONV_X1 - 4) continue;
      r.set(cx, CONV_Y + 3, "e"); r.set(cx + 1, CONV_Y + 2, "e"); r.set(cx + 1, CONV_Y + 4, "e");
    }
    for (let k = 0; k < 2; k++) {                               // two books ride the belt into the funnel
      const bx = CONV_X1 - 8 - ((a + k * 32) % 64);
      if (bx < CONV_X0 - 2) continue;
      r.rect(bx, CONV_Y - 3, 6, 3, k ? "o" : "h"); r.hline(bx, CONV_Y - 3, 6, k ? "n" : "a"); r.vline(bx + 5, CONV_Y - 2, 2, "c");
    }
  }

  // ---- animals (8 fps) ----
  const HOLES = [[70, 131], [90, 132]];
  function drawWorm(r, tick) {
    const p = tick % 48, [hx, hy] = HOLES[(tick / 48 | 0) % 2];
    if (p >= 6 && p < 34) {
      const f = p < 10 || p >= 30 ? 0 : p < 14 || p >= 26 ? 1 : [2, 3][((p - 14) >> 2) % 2];
      spr(r, WORM[f], hx - 10, hy - 2);
    } else if (p >= 34) {                                       // crumbs of paper trickle from the fresh hole
      for (let k = 0; k < 2; k++) { const y = hy + 2 + ((p - 34 + k * 5) >> 1); if (y < 137) r.set(hx - 1 + k * 2, y, k ? "c" : "F"); }
    }
  }
  function drawCat(r, tick) {
    const x = CASE_X + 14, y = CASE_Y - 9, blink = tick % 40 < 2, twitch = tick % 56 >= 20 && tick % 56 < 23;
    spr(r, CAT_TAIL[[0, 1, 2, 1][(tick >> 2) % 4]], x + 14, y + 4);
    spr(r, CAT, x, y, false, blink ? { m: "w" } : null);
    if (twitch) { r.set(x + 1, y, "."); r.set(x + 2, y, "."); r.set(x + 1, y + 1, "z"); r.set(x + 2, y + 1, "z"); }
  }

  window.PB_CONCEPT_SCENES.endless_library = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      r.data.set(L.back.data);
      drawMotes(r, a);
      drawPages(r, a);
      drawRolls(r, a);
      r.blit(L.front, 0, 0);
      drawConveyor(r, a);
      drawWorm(r, tick);
      drawCat(r, tick);
      r.blit(L.props, 0, 0);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
