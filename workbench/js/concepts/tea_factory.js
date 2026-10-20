/* ART-04s 地图概念场景 · 山雾茶厂（tea_factory）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿、不用渐变和半透明（雾用有序抖动）。
 * 主色：茶青（规则层：地面、楼板、传送带、收集斗）、锈红铁皮（厂房墙）、铜褐（萎凋的茶叶）；光是一片灰白，从窗外来。
 * 地标：顶楼长长的萎凋槽（槽下两台大风扇）、底层窗前转着的老揉捻机、窗外梯级茶园（带几棵遮阴树）。
 * 环境（4 fps）：风扇一直转；槽里的茶叶一阵一阵被吹得翻起来（翻出浅色叶背）；山雾从四扇窗飘进来又退出去，窗外雾带慢慢飘；
 *   揉捻机的揉桶绕圈慢转、手轮和顶上皮带跟着转。
 * 机关外观（只示意，不实现规则）：conveyor 顶楼传送带（茶叶送到楼板边掉进下一层）、bin 底层收集斗、pressure 黄铜压板。
 * 动物（8 fps）：茶园水蛭（怪物，一伸一缩朝人爬过来）；斯里兰卡蓝鹊（提示动物，停在收集斗边上，翘尾、低头）。
 * 比例尺：主角大小的人影 + 2 个木箱，站着不动；雾和暗部只处理背景，不盖到前景。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;
  const FLOOR = OY + 9 * 16;                      // 148: ground floor (rule ground)
  const UP_Y = OY + 5 * 16, UP_X1 = 176;          // upper floor slab x 0–175, y 84–99 (rule platform)
  const CONV_X0 = 128, BELT_Y = UP_Y - 8;         // conveyor on the upper floor x 128–175, belt top y 76
  const BIN_X = 176, BIN_Y = FLOOR - 24;          // collection bin x 176–207, y 124–147
  const PLATE_X = 80;                             // pressure plate x 80–95
  const ROOF = 12;
  const WINS = [[12, 16, 40, 22], [76, 16, 40, 22], [140, 16, 28, 22], [208, 16, 96, 92]];
  const TR_X0 = 4, TR_X1 = 124, LEAF_Y = 40, BOX_Y = 46, BOX_Y1 = 57;   // withering trough
  const FANS = [[32, 71], [94, 71]], FAN_R = 12;
  const RX = 264;                                 // rolling machine centre line
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null;

  const layer = () => new PB.Raster(W, H);
  function spr(r, rows, x, y, flip) {
    x = Math.floor(x); y = Math.floor(y);
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j], w = row.length;
      for (let i = 0; i < w; i++) {
        const c = row[flip ? w - 1 - i : i];
        if (c !== ".") r.set(x + i, y + j, c);
      }
    }
  }
  function line(r, x0, y0, x1, y1, c) {          // integer Bresenham
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      r.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  const inWin = (x, y, w) => x >= w[0] && y >= w[1] && x < w[0] + w[2] && y < w[1] + w[3];

  // ---- sprites (palette codes; "." = transparent) ----
  const PORTER = [                                // protagonist-sized figure, facing right
    "................",
    "......zzzz......",
    ".....zlkkkz.....",
    "....zlkkkkkz....",
    "..zzzkkkkkkzzz..",
    ".zkkkkkkkkkkkkz.",
    "..zzzzzzzzzzzz..",
    "...zEEEEEEEEz...",
    "...zEEEzEEzEz...",
    "...zFEEEEEEEz...",
    "....zhiiiiiz....",
    "...zhiiiiiiiz...",
    "..zEhiiiiiiiEz..",
    "...zzxxxxxxzz...",
    "....zxxzzxxz....",
    "...zffz..zffz...",
  ];
  const CRATE = (() => {                          // wooden box: lit top/left, shaded bottom/right, diagonal brace
    const rows = [];
    for (let j = 0; j < 16; j++) {
      let s = "";
      for (let i = 0; i < 16; i++) {
        if (i === 0 || j === 0 || i === 15 || j === 15) s += "z";
        else if (i === 14 || j === 14) s += "f";
        else if (i === 1 || j === 1) s += "d";
        else if (i === 2 || j === 2 || i === 13 || j === 13) s += "e";
        else if (i + j === 15) s += "d";
        else if (i + j === 16) s += "e";
        else s += j === 8 ? "e" : "b";
      }
      rows.push(s);
    }
    return rows;
  })();
  const MAGPIE = [                                // Sri Lanka blue magpie, facing left: perched / tail up / dipping
    ["....hh..............", "...haah.............", "..hazaah............", "iiiaaaaahq..........", "...hhaaqrrq.........",
      "....qrhhhhrrq.......", ".....qrhaahhrrqq....", "......qqhhhqrrrrqq..", ".......qqqq...qqrrtt", "........i.i.....qqtt"],
    ["....hh..............", "...haah.............", "..hazaah............", "iiiaaaaahq........tt", "...hhaaqrrq.....qqrt",
      "....qrhhhhrrq.qqrrq.", ".....qrhaahhrrrrqq..", "......qqhhhqrrqq....", ".......qqqq.........", "........i.i........."],
    ["....................", "....hh..............", "...haah.............", "..hazaah............", ".iiaaaaahq..........",
      "...hhaaqrrq.........", "....qrhhhhrrqq......", ".....qrhaahhrrrqqq..", "......qqqqqqq..qqrtt", "........i.i.....qqtt"],
  ];
  const LEECH = [                                 // tea-garden leech, facing left: stretched / pulling in / arched / reaching ("M" = back, spots ripple)
    { x: 0, rows: [".zzzzzzzzzzzzzzzz.", "zMMMMMMMMMMMMMMMMz", "zooooooooooooooooz", ".zzzzzzzzzzzzzzzz."] },
    { x: 0, rows: [".....zzzzzz.....", "...zzMMMMMMzz...", "..zoozzzzzzooz..", ".zoz........zoz.", "zoz..........zoz", "zz............zz"] },
    { x: 0, rows: ["..zzzzzzz..", ".zMMMMMMMz.", "zoozzzzzooz", "zoz.....zoz", "zoz.....zoz", "zoz.....zoz", "zz.......zz"] },
    { x: -4, rows: ["........zzzzz....", "...zzzzzMMMMzz...", ".zzMMMMMzzzzooz..", "zoozzzzz.....zoz.", "zz............zz."] },
  ];

  // ---- static background: roof, corrugated rust-red iron, windows on the misty terraces ----
  function outsideAt(x, y) {                      // the hillside seen through every window (one landscape)
    const yF = 42 + Math.round(4 * Math.sin(x / 23) + 2 * Math.sin(x / 9 + 1));
    const yM = 56 + Math.round(6 * Math.sin(x / 37 + 2) + 2 * Math.sin(x / 13));
    for (const tx of [221, 252, 289]) {           // tall thin shade trees on the estate
      const tt = yM - 16;
      if (x === tx && y >= tt && y < yM + 18) return "p";
      if (y >= tt - 4 && y < tt + 2 && Math.abs(x - tx) <= 4 - Math.abs(y - (tt - 1)) && ((x + y) & 1)) return "o";
    }
    if (y < yF) return "u";
    if (y < yM) return y - yF > 4 && bay(x, y) < 6 ? "w" : "v";
    const d = y - yM, row = Math.floor(d / 5), k = d % 5, bush = (x + row * 3) % 6;
    if (k === 0) return bush < 4 ? "m" : "n";
    if (k <= 2) return bush === 5 ? "o" : "n";
    return k === 3 ? "o" : "p";
  }
  function wallAt(x, y) {
    const rib = x % 8, band = Math.floor((y - ROOF) / 44), s = (y - ROOF) % 44;
    let c = rib === 0 ? "e" : rib === 5 ? "g" : "f";
    if (s === 0) c = "g"; else if (s === 1) c = rib === 5 ? "g" : "e";
    const h = PB.h32(x >> 1, band, 7);
    if (rib !== 5 && s > 1 && (h & 7) === 0 && s < 3 + ((h >> 5) % 26)) c = rib === 0 ? "b" : "a";   // rust runs
    return c;
  }
  function roofAt(x, y) {
    if (y >= 10) return y === 10 ? "z" : "g";
    const p = x % 48;
    if (Math.abs(p - 24) === Math.floor(y * 2.4) || y === 4) return "z";
    return "g";
  }
  function buildBack() {
    const r = layer();
    for (let y = 0; y < FLOOR; y++) for (let x = 0; x < W; x++) r.set(x, y, y < ROOF ? roofAt(x, y) : wallAt(x, y));
    L.glass = new Uint8Array(W * H);
    for (const w of WINS) {
      const [x0, y0, ww, hh] = w;
      for (let y = y0 - 1; y <= y0 + hh + 2; y++) for (let x = x0 - 1; x <= x0 + ww; x++) {
        const i = x - x0, j = y - y0;
        if (j >= hh) { if (j <= hh + 1 && i >= -1 && i <= ww) r.set(x, y, j === hh ? "n" : "p"); else if (j === hh + 2) r.set(x, y, "g"); continue; }
        if (i < 0 || j < 0 || i === ww) { r.set(x, y, "p"); continue; }
        if (i < 2 || j < 2 || i >= ww - 2) { r.set(x, y, i === 1 || j === 1 ? "n" : "o"); continue; }
        if ((i - 2) % 12 === 11 || (j - 2) % 11 === 10) { r.set(x, y, "o"); continue; }
        r.set(x, y, outsideAt(x, y)); L.glass[y * W + x] = 1;
      }
    }
    for (let x = 176; x < W; x++) { r.set(x, 12, "x"); r.set(x, 13, "z"); }    // line shaft for the old machine
    for (const hx of [196, 300]) { r.set(hx, 11, "z"); r.set(hx + 1, 11, "z"); }
    for (let y = UP_Y + 16; y < FLOOR; y++) for (let x = 0; x < UP_X1; x++) {    // ground floor under the slab
      let c = r.get(x, y);
      if ((x >= 58 && x <= 61) || (x >= 118 && x <= 121)) c = x === 58 || x === 118 ? "x" : x === 61 || x === 121 ? "z" : "y";
      r.set(x, y, c);
    }
    for (const [sx, sy] of [[134, 132], [150, 132], [142, 118]]) sack(r, sx, sy);
    r.remap(0, UP_Y + 16, UP_X1 - 8, FLOOR - UP_Y - 16, PB.DIM);             // under the slab: one step darker
    for (let y = UP_Y + 16; y < FLOOR; y++) for (let x = UP_X1 - 8; x < UP_X1; x++) if (bay(x, y) < (UP_X1 - x) * 2) r.remap(x, y, 1, 1, PB.DIM);
    drawTroughStatic(r);
    drawRollerStatic(r);
    return r;
  }
  function sack(r, x, y) {                        // burlap tea sack, 16×14
    for (let j = 0; j < 14; j++) for (let i = 0; i < 16; i++) {
      const e = Math.min(i, 15 - i) + (j < 3 ? 3 - j : 0);
      if (e < 1 || (j === 0 && (i < 5 || i > 10))) continue;
      let c = "F";
      if (e === 1 || j === 13) c = "f"; else if (i > 11 || j > 10) c = "e"; else if ((i + j) % 4 === 0) c = "e";
      r.set(x + i, y + j, c);
    }
  }
  function drawTroughStatic(r) {                  // long withering trough on legs, fan housings under it
    for (let y = BOX_Y; y <= BOX_Y1; y++) for (let x = TR_X0; x < TR_X1; x++) {
      const j = y - BOX_Y, i = x - TR_X0;
      let c = "x";
      if (i === 0 || x === TR_X1 - 1 || j === BOX_Y1 - BOX_Y) c = "z";
      else if (j === 0) c = "w";
      else if (j === 1) c = "v";
      else if (i % 20 === 10) c = "y";
      else if (j === 5 && i % 20 === 4) c = "w";
      r.set(x, y, c);
    }
    for (const lx of [TR_X0 + 1, 62, TR_X1 - 3]) for (let y = BOX_Y1 + 1; y < UP_Y; y++) { r.set(lx, y, "y"); r.set(lx + 1, y, "z"); }
    for (const [cx, cy] of FANS) {
      for (let y = cy - FAN_R - 1; y <= cy + FAN_R + 1; y++) for (let x = cx - FAN_R - 1; x <= cx + FAN_R + 1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= FAN_R + 0.5) r.set(x, y, d > FAN_R - 0.5 ? "z" : d > FAN_R - 2 ? (x - cx + y - cy < 0 ? "w" : "y") : "z");
      }
      for (let y = BOX_Y1 + 1; y < cy - FAN_R + 2; y++) for (let x = cx - 5; x <= cx + 5; x++) r.set(x, y, x === cx - 5 || x === cx + 5 ? "z" : "y");
      for (let x = cx - 8; x <= cx + 8; x++) r.set(x, UP_Y - 1, "z");             // foot of the stand
    }
    L.leafTop = new Int16Array(W); L.leafCol = [];
    for (let x = TR_X0 + 1; x < TR_X1 - 1; x++) {
      L.leafTop[x] = LEAF_Y + 1 + Math.round(1.2 * Math.sin(x / 4.3) + 0.8 * Math.sin(x / 1.7)) + (PB.h32(x, 1, 3) & 1);
      for (let y = LEAF_Y - 2; y <= BOX_Y + 1; y++) {
        const h = PB.h32(x >> 1, y, 11) % 7, deep = y - L.leafTop[x];
        L.leafCol[(y - LEAF_Y + 2) * W + x] = deep < 1 ? (h < 3 ? "F" : "b") : deep < 3 ? (h < 2 ? "F" : h < 5 ? "e" : "b") : (h < 4 ? "e" : "f");
      }
    }
  }
  function drawRollerStatic(r0) {                 // overhead frame and round table of the old rolling machine
    const r = { set: (x, y, c) => { r0.set(x, y, c); L.glass[y * W + x] = 0; } };   // machine parts hide the view, so no window mist on them
    for (let y = 86; y <= 127; y++) for (const cx of [RX - 27, RX + 24]) for (let x = cx; x < cx + 4; x++) {
      r.set(x, y, x === cx ? "z" : x === cx + 1 ? "x" : x === cx + 3 ? "z" : "y");
    }
    for (let y = 85; y <= 89; y++) for (let x = RX - 31; x <= RX + 31; x++) r.set(x, y, y === 85 || y === 89 || Math.abs(x - RX) === 31 ? "z" : y === 86 ? "x" : "y");
    for (let y = 126; y < FLOOR; y++) {
      const j = y - 126, half = j < 3 ? 34 : 30 - (j > 16 ? j - 16 : 0);
      for (let x = RX - half; x <= RX + half; x++) {
        let c;
        if (j === 0) c = Math.abs(x - RX) === half ? "z" : "d";
        else if (j === 1) c = Math.abs(x - RX) === half ? "z" : "F";
        else if (j === 2) c = "z";
        else c = Math.abs(x - RX) >= half - 1 ? "z" : x < RX - half + 4 ? "x" : (j % 6 === 4 ? "z" : "y");
        r.set(x, y, c);
      }
    }
  }

  // ---- static foreground (rule layer): ground floor, upper floor slab, conveyor frame, bin, plate, figure, boxes ----
  function buildFore() {
    const r = layer();
    for (let y = FLOOR; y < H; y++) for (let x = 0; x < W; x++) {
      const j = y - FLOOR;
      let c = j === 0 ? "n" : j === 1 ? "o" : (x % 16 === 15 || j === 17) ? "p" : "o";
      if (j > 2 && (PB.h32(x, y, 21) % 61) === 0) c = PB.h32(x, y, 22) & 1 ? "e" : "F";   // stray tea leaves
      r.set(x, y, c);
    }
    for (let y = UP_Y; y < UP_Y + 16; y++) for (let x = 0; x < UP_X1; x++) {
      const j = y - UP_Y;
      let c = j === 0 ? "n" : j <= 2 ? "o" : j === 3 ? "z" : j >= 13 ? (j === 13 ? "n" : j === 14 ? "o" : "z") : (x % 16 === 7 || x % 16 === 8) ? (x % 16 === 7 ? "o" : "z") : "p";
      if (j === 1 && x % 16 === 4) c = "n";
      if (x === UP_X1 - 1) c = j === 0 ? "n" : "z";
      r.set(x, y, c);
    }
    for (let x = CONV_X0 + 1; x < UP_X1 - 1; x++) {                            // conveyor frame on the upper floor
      r.set(x, BELT_Y, "z");
      for (let y = BELT_Y + 2; y < UP_Y; y++) r.set(x, y, y === BELT_Y + 2 ? "n" : y === UP_Y - 1 ? "p" : (y === BELT_Y + 4 && x % 8 === 4) ? "p" : "o");
    }
    for (let j = 0; j < 24; j++) {                                             // collection bin
      const inset = j >> 3, y = BIN_Y + j;
      for (let x = BIN_X + inset; x <= BIN_X + 31 - inset; x++) {
        let c = "o";
        if (x === BIN_X + inset || x === BIN_X + 31 - inset || j === 0 || j === 23) c = "z";
        else if (j === 1 || j === 2) c = j === 1 ? "m" : "n";
        else if (j === 9 || j === 17) c = "p";
        else if (x === BIN_X + inset + 1) c = "n";
        r.set(x, y, c);
      }
    }
    for (let x = BIN_X + 4; x < BIN_X + 28; x++) {                             // leaves heaped in the bin
      const t = BIN_Y - 1 - Math.round(2.5 * Math.sin(((x - BIN_X - 4) * Math.PI) / 24)) - (PB.h32(x, 2, 9) & 1);
      for (let y = t; y < BIN_Y; y++) r.set(x, y, y === t ? "F" : PB.h32(x, y, 10) % 3 ? "e" : "f");
    }
    for (let y = FLOOR - 6; y < FLOOR; y++) for (let x = PLATE_X; x < PLATE_X + 16; x++) {   // brass pressure plate
      const j = y - (FLOOR - 6);
      let c = x === PLATE_X || x === PLATE_X + 15 || j === 0 ? "z" : j === 1 ? "d" : j === 2 ? "F" : j === 3 ? "z" : (x % 5 === 2 ? "p" : "o");
      if (j === 0 && (x === PLATE_X || x === PLATE_X + 15)) c = ".";
      r.set(x, y, c);
    }
    spr(r, CRATE, 52, FLOOR - 16);
    spr(r, CRATE, 212, FLOOR - 16);
    spr(r, PORTER, 32, FLOOR - 16);
    return r;
  }

  function build() {
    PB = window.PB;
    L = { fogA: -1, fog: [], occ: new Int32Array(W * H) };
    L.back = buildBack();
    L.fore = buildFore();
    L.fan = FANS.map(([cx, cy]) => {
      const px = [];
      for (let y = cy - FAN_R + 2; y <= cy + FAN_R - 2; y++) for (let x = cx - FAN_R + 2; x <= cx + FAN_R - 2; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= FAN_R - 2) px.push([x, y, d, Math.atan2(y - cy, x - cx)]);
      }
      return px;
    });
  }

  // ---- environment (4 fps) ----
  function drawFans(r, a) {                       // four blades, 22.5° a frame
    const ph = (a * Math.PI) / 8, Q = Math.PI / 2;
    for (const px of L.fan) for (const [x, y, d, ang] of px) {
      let c = "z";
      if (d <= 2.2) c = d <= 1 ? "u" : "v";
      else {
        const t = (((ang - ph) % Q) + Q) % Q;
        if (t < 0.62) c = t < 0.16 ? "u" : "w";
        else if (d > FAN_R - 3.2 && ((x + y) & 1)) c = "y";
      }
      r.set(x, y, c);
    }
  }
  function drawLeaves(r, a) {                     // the leaf bed; a gust rolls along it from the fan end every 6 s
    const g = a % 24, wave = g < 16 ? TR_X0 + g * 8 : -99;
    const FLIP = { F: "d", b: "d", e: "F", f: "e" };
    for (let x = TR_X0 + 1; x < TR_X1 - 1; x++) {
      const top = L.leafTop[x], dd = Math.abs(x - wave), lift = dd < 3 ? 2 : dd < 7 ? 1 : 0;
      for (let y = top; y <= BOX_Y; y++) {
        let c = L.leafCol[(y - LEAF_Y + 2) * W + x];
        if (lift && y < top + 3) c = FLIP[c] || c;
        r.set(x, y - lift, c);
      }
    }
    if (wave > 0) for (let i = 0; i < 4; i++) {
      const fx = wave - 4 + i * 3;
      if (fx > TR_X0 && fx < TR_X1 - 1) r.set(fx, L.leafTop[fx] - 4 - ((a + i * 2) % 4), i & 1 ? "d" : "F");
    }
  }
  function drawRoller(r0, a) {                    // the jacket gyrates under the frame; hand wheel and belt drive turn
    const r = { set: (x, y, c) => { r0.set(x, y, c); if (x >= 0 && y >= 0 && x < W && y < H) L.occ[y * W + x] = a + 1; } };
    const ph = (a * Math.PI) / 8, dx = Math.round(7 * Math.cos(ph)), jx = RX - 14 + dx;
    for (let y = 100; y <= 125; y++) for (let x = jx; x < jx + 28; x++) {
      const i = x - jx, j = y - 100, ex = (i - 13.5) / 14, rim = Math.round(3 * Math.sqrt(Math.max(0, 1 - ex * ex)));
      if (j < 3 - rim) continue;                                               // elliptical top rim
      let c = "w";
      if (i === 0 || i === 27) c = "z";
      else if (j <= 3 - rim + 1) c = j === 3 - rim ? "z" : "v";
      else if (j === 24 || j === 25) c = j === 25 ? "z" : "f";
      else if (j === 9 || j === 17) c = i < 6 ? "d" : i > 21 ? "e" : "F";        // brass hoops
      else if (i <= 2) c = i === 1 ? "u" : "v";
      else if (i <= 5) c = "v";
      else if (i >= 22) c = i >= 25 ? "y" : "x";
      r.set(x, y, c);
    }
    for (let x = jx + 8; x < jx + 20; x++) for (let y = 95; y <= 98; y++) r.set(x, y, y === 95 || x === jx + 8 || x === jx + 19 ? "z" : y === 96 ? "v" : "x");
    line(r, RX, 90, jx + 13, 94, "w"); line(r, RX + 1, 90, jx + 14, 94, "z");
    const s = (a >> 1) % 4, ang = (s * Math.PI) / 6;                          // hand wheel on the table front
    for (let k = 0; k < 3; k++) {
      const t = ang + (k * 2 * Math.PI) / 3;
      line(r, RX, 138, RX + Math.round(4 * Math.cos(t)), 138 + Math.round(4 * Math.sin(t)), "F");
    }
    for (let n = 0; n < 16; n++) { const t = (n * Math.PI) / 8; r.set(RX + Math.round(5 * Math.cos(t)), 138 + Math.round(5 * Math.sin(t)), "F"); }
    r.set(RX, 138, "d");
    for (let y = 14; y < 82; y++) {                                            // flat belt up to the line shaft
      r.set(RX - 4, y, (y + a * 2) % 6 < 2 ? "x" : "z");
      r.set(RX + 4, y, (y - a * 2 + 600) % 6 < 2 ? "x" : "z");
    }
    for (let n = 0; n < 12; n++) { const t = (n * Math.PI) / 6; r.set(RX + Math.round(4 * Math.cos(t)), 82 + Math.round(3 * Math.sin(t)), "z"); }
    const t2 = ph * 2; r.set(RX + Math.round(2 * Math.cos(t2)), 82 + Math.round(2 * Math.sin(t2)), "x"); r.set(RX, 82, "w");
  }
  // Fog: drifting bands over the view outside, plus soft banks that slide out of each window into the room and back.
  const BANKS = [                                 // from x → to x (out in the room), centre y, half sizes, phase (env frames)
    [32, 68, 30, 20, 7, 0], [96, 62, 31, 20, 7, 14], [154, 183, 30, 16, 7, 27],
    [256, 192, 58, 30, 10, 6], [218, 186, 101, 16, 8, 30],
  ];
  function fogFor(a) {
    if (L.fogA === a) return L.fog;
    const out = [], v = new Float32Array(W * H);
    for (const [x0, x1, cy, rx, ry, ph] of BANKS) {
      const k = 0.5 - 0.5 * Math.cos(((a + ph) * Math.PI) / 24), cx = x0 + (x1 - x0) * k;   // 0 in the window → 1 out in the room → 0
      for (let y = Math.max(ROOF, cy - ry - 2); y <= cy + ry + 2 && y < FLOOR; y++) for (let x = Math.max(0, Math.floor(cx - rx - 3)); x <= cx + rx + 3 && x < W; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        const wav = 0.22 * Math.sin(x * 0.17 + a * 0.35 + ph) * Math.cos(y * 0.45 + ph) + 0.08 * Math.sin(x * 0.5 + y * 0.9);
        const d = 1 - dx * dx - dy * dy + wav;
        if (d > 0) v[y * W + x] = Math.max(v[y * W + x], 11 * Math.min(1, d * 1.6) * (0.55 + 0.45 * k));
      }
    }
    for (let y = ROOF; y < FLOOR; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let f = v[i];
      if (L.glass[i] && L.occ[i] !== a + 1) {
        const band = 0.8 * Math.max(0, 1 - Math.abs(y - 47) / 6) + 0.8 * Math.max(0, 1 - Math.abs(y - 76) / 8) + 0.12;
        f = Math.max(f + 2, band * (8 + 8 * Math.sin((x - a * 1.5) / 13 + Math.sin(y / 7))));
        if (f > bay(x, y)) out.push(i, f > bay(x, y) + 9 ? "t" : "u");
      } else if (f > bay(x, y)) out.push(i, f > bay(x, y) + 7 ? "u" : "v");
    }
    L.fogA = a; L.fog = out;
    return out;
  }
  function drawFog(r, a) {
    const f = fogFor(a);
    for (let i = 0; i < f.length; i += 2) r.set(f[i] % W, (f[i] / W) | 0, f[i + 1]);
  }

  // ---- mechanisms (4 fps) ----
  function drawConveyor(r, a) {                   // belt cleats and leaf clumps run right; leaves drop into the bin
    for (let x = CONV_X0 + 1; x < UP_X1 - 1; x++) r.set(x, BELT_Y + 1, (x - a * 2) % 6 === 0 ? "x" : "y");
    for (let i = 0; i < 4; i++) {
      const x = CONV_X0 + 4 + ((i * 12 + a * 2) % 44);
      if (x < UP_X1 - 5) { r.set(x, BELT_Y - 1, "e"); r.set(x + 1, BELT_Y - 1, "F"); r.set(x + 2, BELT_Y - 1, "e"); r.set(x + 1, BELT_Y - 2, i & 1 ? "d" : "F"); }
    }
    for (const cx of [CONV_X0 + 3, UP_X1 - 4]) {
      for (let y = BELT_Y; y <= BELT_Y + 6; y++) for (let x = cx - 3; x <= cx + 3; x++) {
        const d = Math.hypot(x - cx, y - (BELT_Y + 3));
        if (d <= 3.4) r.set(x, y, d > 2.4 ? "z" : "x");
      }
      const t = (a * Math.PI) / 4;
      r.set(cx + Math.round(2 * Math.cos(t)), BELT_Y + 3 + Math.round(2 * Math.sin(t)), "w"); r.set(cx, BELT_Y + 3, "v");
    }
    for (let i = 0; i < 4; i++) {                                            // 2×2 leaves tumbling off the end into the bin
      const t = (a + i * 6) % 24, y = BELT_Y + 1 + ((t * t) / 12 | 0), x = UP_X1 + (i & 1) + (t >> 3) * 2, s = (t >> 1) & 1;
      if (y < BIN_Y - 3) { r.set(x, y, s ? "F" : "d"); r.set(x + 1, y, s ? "d" : "F"); r.set(x + s, y + 1, "e"); }
    }
  }

  // ---- animals (8 fps) ----
  function drawLeech(r, tick) {                   // inches toward the figure, then back
    const t = tick % 192, cyc = 8, steps = 11;
    let n, left, f;
    if (t < steps * cyc) { n = Math.floor(t / cyc); f = (t % cyc) >> 1; left = true; }
    else if (t < steps * cyc + 8) { n = steps; f = 0; left = true; }
    else if (t < 2 * steps * cyc + 8) { const u = t - steps * cyc - 8; n = Math.floor(u / cyc); f = (u % cyc) >> 1; left = false; }
    else { n = steps; f = 0; left = false; }
    const fr = LEECH[f], h = fr.rows.length, wdt = fr.rows[0].length;
    let x;
    if (left) x = 160 - n * 5 + fr.x;
    else { const head = 105 + n * 5; x = head + 18 - wdt - fr.x; }
    for (let j = 0; j < h; j++) for (let i = 0; i < wdt; i++) {               // spots ripple head-ward every tick (8 fps)
      const si = left ? i : wdt - 1 - i, c = fr.rows[j][si];
      if (c !== ".") r.set(x + i, FLOOR - h + j, c === "M" ? ((si + tick) % 4 === 0 ? "m" : "o") : c);
    }
  }
  function drawMagpie(r, tick) {                  // perched on the bin rim: tail flicks, dips its head, sometimes hops
    const t = tick % 64;
    let f = 0, dy = 0;
    if (t >= 8 && t < 12) f = 1;
    else if (t >= 24 && t < 32) f = 2;
    else if (t >= 44 && t < 48) dy = t < 46 ? -2 : -1;
    else if (t >= 52 && t < 56) f = 1;
    spr(r, MAGPIE[f], BIN_X + 10, BIN_Y - 10 + dy);
  }

  window.PB_CONCEPT_SCENES["tea_factory"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      r.data.set(L.back.data);
      drawFans(r, a);
      drawLeaves(r, a);
      drawRoller(r, a);
      drawFog(r, a);
      r.blit(L.fore, 0, 0);
      drawConveyor(r, a);
      drawLeech(r, tick);
      drawMagpie(r, tick);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
