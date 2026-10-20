/* ART-04o 地图概念场景 · 彩板蜂巢（beehive）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 缩小到蜜蜂大小、在蜂箱里看：地标是一面墙的六角蜂巢格、彩绘前板（从里面看）和入口的亮光、蜂王的大格。
 * 机关外观：tar（流下来的蜂蜜积成的黏池）、gas_rise（从地板缝飘进来往上走的轻烟）、bin（顶上倒扣的收集斗和刻度灯）。
 * 环境（4 fps）：蜂蜜从满格边缓缓流下拉出细丝、扇风带起的蜡屑一阵阵飘、轻烟上浮、黏池慢慢鼓泡。
 * 动物（8 fps）：大胡蜂（怪物，在蜜格上空盘旋找机会抢蜜）、卡尼鄂拉工蜂（提示动物，在右上一格跳摇摆舞）；
 * 入口边一排工蜂扇翅膀（背景里的小个子，只是环境）。
 * 比例尺：主角人影 + 1 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180;
  const FLOOR = 148;                               // top of the hive floor board (16 px grid rows start at y = 4)
  const BOARD_W = 24;                              // painted front board on the left, x 0–23
  const DOOR_Y = 137;                              // the hive entrance: a bright slot through the board, y 137–147
  const HERO_X = 80, CRATE_X = 96;
  const POOL_X0 = 128, POOL_X1 = 192;              // honey pool (mechanism tar) x 128–191
  const MID_X0 = 112, MID_X1 = 208, MID_Y = 100;   // comb ledge over the pool
  const HI_X0 = 256, HI_Y = 68;                    // high comb ledge on the right (the dancing bee's cell)
  const BIN_X = 208, BIN_Y = 6;                    // collection bin hanging upside down from the top bar, x 208–239
  const VENT_X = 216;                              // floor vent the light smoke comes from, x 216–231
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
  function remap(r, x0, y0, x1, y1, map, test) {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(W, x1 | 0); y1 = Math.min(H, y1 | 0);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (test && !test(x, y)) continue;
      const c = codeAt(r, x, y), m = c && map[c];
      if (m && m !== c) r.set(x, y, m);
    }
  }
  // Pointy-top hexagons 12 px wide on a staggered 12 × 9 grid: which cell a pixel is in, and whether it is on a wall.
  function hex(x, y, ox, oy) {
    const jy = Math.floor((y - oy) / 9);
    let d1 = 1e9, d2 = 1e9, ci = 0, cj = 0, cdx = 0, cdy = 0;
    for (let j = jy; j <= jy + 1; j++) {
      const off = j & 1 ? 6 : 0, ix = Math.floor((x - ox - off) / 12);
      for (let i = ix; i <= ix + 1; i++) {
        const dx = x + 0.5 - (ox + off + 12 * i), dy = y + 0.5 - (oy + 9 * j);
        const d = Math.max(Math.abs(dx), Math.abs(dy) + Math.abs(dx) / 2);
        if (d < d1) { d2 = d1; d1 = d; ci = i; cj = j; cdx = dx; cdy = dy; } else if (d < d2) d2 = d;
      }
    }
    return { i: ci, j: cj, wall: d2 - d1 < 1.6, dx: cdx, dy: cdy };
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
  const HORNET = [                                 // giant hornet, facing left; two wing poses
    [
      "........uu.uu.....",
      ".......uvvuvvu....",
      "..zzz...uuuuu.....",
      ".zjjjz.zzzzz......",
      "zjzjjjzgfffgzzzz..",
      "zjjjjjzggggzbbgbbz",
      ".zfjfzzggggzbbgbbz",
      "..zfz..zzzzzgbbgz.",
      "......z.z.z.zzzz..",
    ],
    [
      "..................",
      "..................",
      "..zzz.............",
      ".zjjjz.zzzzzuuuu..",
      "zjzjjjzgfffuvvvvu.",
      "zjjjjjzggggzuuuubz",
      ".zfjfzzggggzbbgbbz",
      "..zfz..zzzzzgbbgz.",
      ".......z.z.z.zzz..",
    ],
  ];
  const BEE = [                                    // Carniolan worker (hint animal): grey-brown with grey bands, facing right
    [
      "....tu.tu...",
      "...uttutt...",
      ".zzzzzzzzz..",
      "zvxvxzxxxzz.",
      "zvxvxzxxxzxz",
      ".zzzzzzzzzzz",
      "...z.z.z.z..",
    ],
    [
      "............",
      "..uuu.uuu...",
      ".zzttzzttz..",
      "zvxvxzxxxzz.",
      "zvxvxzxxxzxz",
      ".zzzzzzzzzzz",
      "..z.z.z.z...",
    ],
  ];
  const FANNER = [                                 // small background workers at the entrance, fanning (no dark outline)
    ["...uv.....", "...vu.....", ".gg.gggg..", "gffgfefeg.", "gfggefefeg", ".gggggggg.", "..g.g.g..."],
    ["..........", "..wvvw....", ".ggwgggg..", "gffgfefeg.", "gfggefefeg", ".gggggggg.", "...g.g.g.."],
  ];
  const PUFF = [                                   // light smoke (gas_rise), two billow shapes
    ["..uu...", ".uuuvu.", "uuvuuvv", "vuuvvvw", ".vwwvw."],
    ["...uu..", ".uuvuu.", "uvuuuvu", "wvvuvvw", "..wwv.."],
  ];
  // ---- static layers ----
  function buildBack() {
    const r = layer();
    for (let y = 0; y < FLOOR; y++) for (let x = BOARD_W; x < W; x++) {   // the comb wall behind everything
      const c = hex(x, y, 0, 3), t = hash(c.i, c.j, 5) % 9;
      let col;
      if (c.wall) col = "g";
      else if (t < 4) col = c.dx < -1 && c.dx > -4 && c.dy < -1 && c.dy > -4 ? "e" : "f";              // honey
      else if (t < 7) col = c.dy < -3.5 ? "e" : "f";                                                   // capped
      else col = c.dy < -2 ? "z" : "g";                                                                // empty
      r.set(x, y, col);
    }
    r.rect(0, 0, W, 4, "f"); r.hline(0, 4, W, "g"); r.hline(0, 1, W, "e");                            // top bar of the frame
    // Painted front board seen from inside: worn red-and-green folk painting on the boards.
    r.rect(0, 5, BOARD_W, DOOR_Y - 5, "f");
    for (let y = 5; y < DOOR_Y; y++) for (let x = 0; x < BOARD_W; x++) if (hash(x >> 1, y >> 3, 51) % 9 === 0) r.set(x, y, "g");
    r.vline(BOARD_W - 1, 5, DOOR_Y - 5, "e"); r.vline(BOARD_W - 2, 5, DOOR_Y - 5, "F"); r.vline(7, 5, DOOR_Y - 5, "g"); r.vline(15, 5, DOOR_Y - 5, "g");
    for (const by of [9, 124]) for (let x = 0; x < BOARD_W - 2; x++) { r.set(x, by, "g"); r.set(x, by + 1, ((x >> 2) & 1) ? "o" : "h"); r.set(x, by + 2, ((x >> 2) & 1) ? "o" : "h"); r.set(x, by + 3, "g"); }
    const tulip = (cx, cy) => {
      r.vline(cx, cy + 6, 22, "o");
      for (let k = 0; k < 6; k++) { r.set(cx - 2 - k, cy + 16 - k, "o"); r.set(cx - 1 - k, cy + 16 - k, "n"); r.set(cx + 2 + k, cy + 20 - k, "o"); r.set(cx + 1 + k, cy + 20 - k, "n"); }
      r.rect(cx - 4, cy, 9, 6, "h"); r.set(cx - 4, cy, "f"); r.set(cx, cy, "f"); r.set(cx + 4, cy, "f");
      r.rect(cx - 3, cy + 1, 2, 4, "a"); r.rect(cx + 1, cy + 1, 2, 4, "a"); r.hline(cx - 3, cy + 6, 7, "h");
    };
    tulip(10, 26); tulip(11, 74);
    for (let k = 0; k < 4; k++) { r.rect(5 + (k & 1) * 10, 58 + k * 3, 2, 2, "h"); r.rect(6 + (k & 1) * 8, 108 + k * 3, 2, 2, "o"); }
    // The entrance: summer noon outside, seen through a slot under the board.
    r.rect(0, DOOR_Y, BOARD_W, FLOOR - DOOR_Y, "c"); r.hline(0, DOOR_Y, BOARD_W, "z"); r.hline(0, DOOR_Y + 1, BOARD_W, "d");
    r.rect(0, DOOR_Y + 3, BOARD_W, 2, "t");
    for (let x = 0; x < BOARD_W; x++) { const g = 1 + (hash(x, 3, 61) % 3); r.vline(x, FLOOR - g, g, x % 3 ? "m" : "n"); }
    // Warm light spreads from the entrance; far corners stay darker.
    const lit = (x, y, rad, edge) => { const d = Math.hypot(x - 10, (y - 142) * 1.3); return d < rad || (d < rad + edge && bay(x, y) < ((rad + edge - d) * 16 / edge | 0)); };
    remap(r, BOARD_W, 40, 200, FLOOR, PB.LIGHT, (x, y) => lit(x, y, 58, 50));
    return r;
  }
  function comb(r, x0, x1, y0, y1, oy) {           // a comb ledge (terrain): capped wax and honey cells, pale wax top
    for (let x = x0; x < x1; x++) {
      const bottom = y1 - (hash(x >> 2, y1, 71) % 3);
      for (let y = y0; y < bottom; y++) {
        const c = hex(x, y, 6, oy), t = hash(c.i, c.j, 73) % 5;
        let col = c.wall ? "e" : t < 2 ? (c.dx < -1 && c.dx > -4 && c.dy < 0 && c.dy > -4 ? "k" : "b") : c.dy < -3.5 ? "c" : "d";
        if (y === y0) col = "c"; else if (y === y0 + 1 && col !== "e") col = "d";
        if (y === bottom - 1) col = "f";
        r.set(x, y, col);
      }
    }
    r.vline(x0, y0 + 1, y1 - y0 - 3, "F"); r.vline(x1 - 1, y0 + 1, y1 - y0 - 3, "f");
  }
  function buildFront() {
    const r = layer();
    // Hive floor board with a basin of spilled honey and a smoke vent.
    r.hline(0, FLOOR, W, "F"); r.rect(0, FLOOR + 1, W, 3, "e");
    for (let y = FLOOR + 4; y < H; y++) for (let x = 0; x < W; x++) {
      const seam = (x + ((y - FLOOR) / 8 | 0) * 29) % 58 === 0 || (y - FLOOR) % 8 === 3;
      r.set(x, y, seam ? "g" : hash(x >> 3, y, 81) % 6 === 0 ? "g" : y > 166 ? "g" : "f");
    }
    for (let x = 0; x < W; x += 1) if (hash(x, 9, 83) % 11 === 0) r.set(x, FLOOR, "d");
    r.rect(POOL_X0 - 1, FLOOR, POOL_X1 - POOL_X0 + 2, 18, "f"); r.hline(POOL_X0 - 2, FLOOR, 1, "d"); r.hline(POOL_X1 + 1, FLOOR, 1, "d");
    r.rect(VENT_X, FLOOR, 16, 4, "z");
    for (let x = VENT_X + 1; x < VENT_X + 16; x += 3) { r.vline(x, FLOOR, 4, "x"); r.set(x, FLOOR, "w"); }
    // Comb ledges and the queen cell hanging under the high one.
    comb(r, MID_X0, MID_X1, MID_Y, MID_Y + 17, MID_Y + 4);
    comb(r, HI_X0, W, HI_Y, HI_Y + 17, HI_Y + 4);
    const QX = 292;
    for (let y = 0; y < 24; y++) {
      const half = y < 2 ? 3 : y < 18 ? 5 - (y > 12 ? 1 : 0) : 4 - ((y - 18) >> 1);
      for (let x = -half; x < half; x++) {
        const edge = x === -half || x === half - 1 || y === 23;
        r.set(QX + x, HI_Y + 15 + y, edge ? "f" : (hash(x + 9, y, 91) % 4 === 0 ? "e" : (x < -1 ? "d" : "F")));
      }
    }
    // Collection bin hung upside down from the top bar (smoke collects in it), with its gauge and lamp.
    r.vline(BIN_X + 5, 5, 2, "x"); r.vline(BIN_X + 26, 5, 2, "x");
    for (let x = BIN_X; x < BIN_X + 32; x++) { r.set(x, BIN_Y, "z"); r.set(x, BIN_Y + 1, "v"); r.set(x, BIN_Y + 2, "z"); }
    for (const wx of [BIN_X, BIN_X + 29]) for (let y = BIN_Y; y < BIN_Y + 24; y++) { r.set(wx, y, "z"); r.set(wx + 1, y, "v"); r.set(wx + 2, y, "z"); }
    r.set(BIN_X + 1, BIN_Y + 1, "u"); r.set(BIN_X + 30, BIN_Y + 1, "u");
    const GX = BIN_X + 34, GY = BIN_Y + 2;
    r.hline(GX, GY, 6, "z"); r.hline(GX, GY + 14, 6, "z");
    for (let y = GY + 1; y < GY + 14; y++) { r.set(GX, y, "z"); r.set(GX + 1, y, "x"); r.set(GX + 2, y, y > GY + 7 ? "u" : "y"); r.set(GX + 3, y, y > GY + 7 ? "v" : "y"); r.set(GX + 4, y, "x"); r.set(GX + 5, y, "z"); }
    spr(r, [".zwwz.", "..zz.."], GX, GY + 15);
    return r;
  }
  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    const back = buildBack();
    remap(back, BIN_X + 3, BIN_Y + 3, BIN_X + 29, BIN_Y + 24, PB.DIM);           // inside of the bin is in shade
    spr(back, ["..uuu..uu...", ".uvvuuuvvu..", "uvvwvvvvwvu.", ".vwwvvwwvv.."], BIN_X + 9, BIN_Y + 3);   // smoke collected so far
    const props = layer();
    spr(props, PORTER, HERO_X, FLOOR - 16);
    spr(props, CRATE, CRATE_X, FLOOR - 16);
    L = { back, front: buildFront(), props };
  }

  // ---- ambient (4 fps) ----
  const THREADS = [[138, 0], [157, 17], [181, 31]];  // honey threads under the comb ledge: x, phase
  function drawThreads(r, a) {
    const top = MID_Y + 14, reach = FLOOR + 2 - top;
    for (const [x, ph] of THREADS) {
      const t = (a + ph) % 52;
      if (t < reach) {                               // a heavy drop slowly pulls a thread down
        r.vline(x, top, t, "b");
        r.rect(x, top + t, 2, 2, "b"); r.set(x + 1, top + t + 1, "e"); r.set(x, top + t, "k");
      } else if (t < reach + 8) {                    // the thread reaches the pool and thins out
        for (let y = top; y < FLOOR + 2; y++) if (y < top + 6 || (y + t) % 3) r.set(x, y, y < top + 6 ? "b" : "e");
      } else {                                       // it snaps: a short stub stays under the cell
        r.vline(x, top, Math.max(1, 52 - t) >> 1, "b");
      }
    }
  }
  function drawPool(r, a) {                          // thick honey: slow bulges and a lazy bubble
    for (let x = POOL_X0; x < POOL_X1; x++) {
      const bulge = tri(x * 2 + a, 48, 2) > 0 ? 1 : 0, sy = FLOOR + 2 - bulge;
      r.set(x, sy, (x + (a >> 1)) % 13 === 0 ? "k" : "d");
      for (let y = sy + 1; y < FLOOR + 17; y++) r.set(x, y, y < FLOOR + 5 ? "b" : y < FLOOR + 11 ? "e" : "a");
    }
    const bt = a % 28, bx = POOL_X0 + 14 + ((a / 28 | 0) * 23) % 36;
    if (bt < 12) { const by = FLOOR + 14 - bt; r.set(bx, by, "d"); r.set(bx + 1, by, "d"); }
    else if (bt < 16) { r.set(bx - 1, FLOOR + 1, "d"); r.set(bx + 2, FLOOR + 1, "d"); r.hline(bx, FLOOR, 2, "k"); }
    for (const [x, ph] of THREADS) { const t = (a + ph) % 52; if (t >= 34 && t < 40) { r.set(x - 1, FLOOR + 1, "k"); r.set(x + 1, FLOOR + 1, "k"); } }
  }
  function drawPuffs(r, a) {                         // light smoke seeps up from the vent into the bin
    for (let k = 0; k < 5; k++) {
      const y = FLOOR - 3 - ((a * 2 + k * 24) % 120);
      if (y < BIN_Y + 20) continue;
      spr(r, PUFF[(k + (a >> 2)) & 1], VENT_X + 4 + tri(a + k * 7, 20, 3), y, k & 1);
    }
  }
  function drawFlakes(r, a) {                        // wax flakes blown along by the fanning workers, in gusts
    for (let g = 0; g < 2; g++) {
      const t = (a + g * 22) % 44;
      if (t > 34) continue;
      for (let k = 0; k < 6; k++) {
        const h = hash(k, g, 101), x = 36 + t * 3 + (h % 9), y = 104 + ((h >> 5) % 40) + tri(t * 2 + k * 5, 12, 2) - (t >> 3);
        r.set(x, y, k % 3 ? "F" : "d");
      }
    }
  }

  // ---- animals (8 fps) ----
  function drawFanners(r, tick) {
    for (let k = 0; k < 4; k++) spr(r, FANNER[(tick + k) & 1], BOARD_W + 3 + k * 12, FLOOR - 7, false);
  }
  function drawHornet(r, tick) {                     // hovers over the honey ledge, darts back and forth, dips to the cells
    const t = tick % 96, x = 150 + tri(tick, 96, 30), dip = t > 40 && t < 56 ? 8 - Math.abs(t - 48) : 0;
    const y = 60 + tri(tick, 12, 2) + dip, right = t >= 48;
    spr(r, HORNET[tick & 1], x, y, right);
  }
  function drawBee(r, tick) {                        // waggle dance on the high ledge: waggle run, turn, walk back
    const t = tick % 32, by = HI_Y - 7;
    let x, y = by, f = 1, flip = false;
    if (t < 12) { x = 274 + (t >> 1); y = by - (t & 1); f = t & 1; }
    else if (t < 16) { x = 280; flip = true; f = 1; }
    else if (t < 28) { x = 280 - ((t - 16) >> 1); flip = true; }
    else { x = 274; }
    spr(r, BEE[f], x, y, flip);
  }

  window.PB_CONCEPT_SCENES.beehive = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      r.data.set(L.back.data);
      drawFanners(r, tick);
      drawFlakes(r, a);
      drawPuffs(r, a);
      r.blit(L.front, 0, 0);
      drawThreads(r, a);
      drawPool(r, a);
      drawHornet(r, tick);
      drawBee(r, tick);
      r.blit(L.props, 0, 0);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
