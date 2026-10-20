/* ART-04r 地图概念场景 · 织毯工坊（carpet_loom）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 地标：三层楼高的立式织机和成排经线、茜红的染缸、挂着晾的地毯（羊毛团作环境动画）。
 * 机关外观（只示意，不实现规则）：成卷地毯大件（carry_bulky）、压板 + 经线门（plate_door）、鼓（drum_beat）。
 * 环境（4 fps）：鼓点一响，经线一组组上下开合，梭子在织口来回飞；晾着的地毯轻晃；羊毛团从高处滚下来散开；
 *   染缸冒淡淡热气；高窗斜光只照背景，光里有少量浮尘。
 * 动物（8 fps）：蛀虫蛾（怪物，啃地毯边）、阿哈尔捷金小马（提示动物，金色皮毛一闪一闪）。
 * 比例尺：主角大小的人影 + 1 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4
  const FLOOR = OY + 9 * 16;                      // 148: top of the plank floor
  const DECK = OY + 6 * 16;                       // 100: top of the gallery on the right
  const DECK_X = 264;                             // gallery spans x 264–319
  const LX0 = 104, LX1 = 263;                     // loom posts: x 104–111 and 256–263
  const WX0 = 112, NTH = 72, GROUP = 8;           // warp threads at x = 112 + 2k, 9 groups of 8
  const FELL = 90;                                // top of the woven part
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null, REV = null;

  const mod = (a, n) => ((a % n) + n) % n;
  function tri(t, period, amp) {                  // integer triangle wave in [-amp, amp]
    const p = mod(t, period), half = period >> 1;
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
  const codeAt = (r, x, y) => {
    const i = (y * W + x) * 4, d = r.data;
    return d[i + 3] ? REV.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) : null;
  };
  function remapPx(r, x, y, map) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const c = codeAt(r, x, y), m = c && map[c];
    if (m && m !== c) r.set(x, y, m);
  }

  // ---- sprites (palette codes; "." = transparent) ----
  const PORTER = [                                // protagonist-sized figure, facing right
    "................",
    ".....zzzzz......",
    "....zllkkkz.....",
    "...zlkkkkkkz....",
    ".zzkkkkkkkkkzz..",
    "zbkkkkkkkkkkkbz.",
    ".zzzEEEEEEEEzz..",
    "...zEEEEEzEEz...",
    "...zFEEEEEEFz...",
    "....zhiiiiiz....",
    "...zhiiiiiiiz...",
    "..zEhiiiiiiiEz..",
    "..zzhhiiiiihzz..",
    "....zxxzzxxz....",
    "....zxxzzxxz....",
    "...zffzzzzffz...",
  ];
  const CRATE = (() => {                          // wooden box: lit top/left, shaded bottom/right, diagonal brace
    const rows = [];
    for (let j = 0; j < 16; j++) {
      let s = "";
      for (let i = 0; i < 16; i++) {
        const k = i + j;
        if (i === 0 || j === 0 || i === 15 || j === 15) s += "z";
        else if (i === 14 || j === 14) s += "f";
        else if (i === 1 || j === 1) s += "d";
        else if (i === 2 || j === 2 || i === 13 || j === 13) s += "e";
        else if (k === 15) s += "d";
        else if (k === 16) s += "e";
        else s += j === 8 ? "e" : "b";
      }
      rows.push(s);
    }
    return rows;
  })();
  const PLATE = [                                 // pressure plate, circle symbol (pairs with the warp door)
    ".zzzzzzzzzzzzzz.",
    "zuuuuuusuuuuuuuz",
    "zvvvvvsvsvvvvvvz",
    "zwwwwwwswwwwwwwz",
    "zzzzzzzzzzzzzzzz",
  ];
  const DRUM = [                                  // barrel drum, skin on top, laced shell between two hoops
    "..zzzzzzzzzz..",
    ".zccccccccccEz",
    ".zEEEEEEEEEEFz",
    "zfffffffffffgz",
    "zbFbbbFbbbFbez",
    "zbbFbFbFbFbbez",
    "zbbbFbbbFbbbez",
    "zbbFbFbFbFbbez",
    "zbFbbbFbbbFbez",
    "zfffffffffffgz",
    ".zeeeeeeeeeez.",
    "..zzzzzzzzzz..",
  ];
  const MOTH = [                                  // clothes moth facing left: wings up / swept back / down (8 fps)
    ["z............", ".z...zzzzz...", "..z.zcccFFz..", "...zcFcFFFFz.", "...zcccFFeFz.", ".zzzzFFFFez..",
      "zgfgzzzzzz...", "zfffgfgfgz...", ".zz.z.z.z....", "............."],
    ["z............", ".z...........", "..z..........", "...zzzzzzzzz.", ".zzzcccFFFFFz", "zgfzcFcFFeFez",
      "zfffzzzzzzzz.", "zfffgfgfgz...", ".zz.z.z.z....", "............."],
    ["z............", ".z...........", "..z..........", "...z.........", ".zzz.........", "zgfzzzzzzz...",
      "zfffgfgfgfz..", ".zzzcccFFz...", "...zcFFez....", "....zzzz....."],
  ];
  const FOAL = [                                  // Akhal-Teke foal facing left (tail drawn separately)
    ".....zz.................",
    "....zdFz................",
    "...zddddz...............",
    "..zddddddz..............",
    ".zddzddddez.............",
    "zdddddddddez............",
    "zcdddddzddez............",
    ".zzzzzzzdddez...........",
    "........zddddezzzzzzzz..",
    "........zdddddddddddddz.",
    ".........zdddddddddddddz",
    ".........zcdddddddddddFz",
    ".........zFdddddddddddFz",
    "..........zFFdddddddFFz.",
    "..........zdzFzzzzzFzdz.",
    "..........zdzFz...zFzdz.",
    "..........zdzFz...zFzdz.",
    "..........zdzFz...zFzdz.",
    "..........zFzez...zezFz.",
    "..........zezfz...zfzez.",
    "..........zzzzz...zzzzz.",
  ];
  const FOAL_TAIL = [["zf", "zfz", "zef", ".zf", ".ze"], ["zf", "zfz", ".zfz", "..zf", "..ze"]];

  // ---- static layers ----
  function buildBack() {                          // wall, high windows, loom frame, woven carpet, rail, wool chute
    const r = layer();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = hash(x, y, 3);
      r.set(x, y, h % 89 === 0 ? "z" : h % 113 === 0 ? "f" : "g");
    }
    for (let x = 0; x < W; x++) { r.set(x, 2, "f"); r.set(x, 3, "z"); }          // ceiling beam
    for (const wx of [18, 38]) {                  // two lancet windows, dawn sky kept dim: slate over warm brown
      for (let y = 6; y <= 42; y++) for (let x = wx - 1; x <= wx + 12; x++) {
        const dx = Math.min(x - (wx - 1), wx + 12 - x), arch = y < 11 ? 11 - y : 0;
        if (dx < arch - 1) continue;
        const edge = dx === 0 || dx < arch || y === 42;
        let c = edge ? "f" : y > 30 || (y > 24 && bay(x, y) < (y - 24) * 2) ? "e" : "w";
        if (!edge && (x === wx + 5 || x === wx + 6 || y === 24)) c = "f";        // mullion and transom
        r.set(x, y, c);
      }
      r.hline(wx - 2, 43, 16, "e"); r.hline(wx - 2, 44, 16, "f");               // sill
    }
    for (let x = 0; x < 94; x++) { r.set(x, 45, "e"); r.set(x, 46, "f"); }        // drying rail and brackets
    for (const bx of [2, 88]) for (let j = 0; j < 4; j++) r.hline(bx, 47 + j, 4 - j, "f");
    for (const px of [LX0, LX1 - 7]) for (let y = 0; y < FLOOR; y++) for (let i = 0; i < 8; i++) {   // loom posts
      let c = i === 0 ? "e" : i === 7 ? "g" : "f";
      if ((y === 30 || y === 86 || y === 136) && i > 1 && i < 6) c = "z";       // pegs
      r.set(px + i, y, c);
    }
    for (let x = LX0; x <= LX1; x++) {            // warp beam with wound warp, cloth beam, base rail
      r.set(x, 10, "e"); for (let y = 11; y < 16; y++) r.set(x, y, (x + y) % 5 === 0 ? "F" : "f"); r.set(x, 16, "g");
      r.set(x, 126, "e"); for (let y = 127; y < 133; y++) r.set(x, y, y < 129 ? "h" : "f"); r.set(x, 133, "g");
      for (let y = 134; y < FLOOR; y++) r.set(x, y, y >= 139 && y <= 141 ? (y === 139 ? "e" : "f") : (x - LX0) % 20 < 3 && y > 141 ? "f" : y < 136 ? "z" : "y");
    }
    for (let y = FELL; y < 126; y++) for (let x = WX0; x < WX0 + 2 * NTH; x++) r.set(x, y, rug(x - WX0, y - FELL));
    for (let x = 270; x < 302; x++) {             // wool chute from the basket down to the gallery
      const top = 74 - (x - 278) * 2;
      if (x < 278) continue;
      r.set(x, top, "e"); r.set(x, top + 1, "f"); r.set(x, top + 2, "f"); r.set(x, top + 3, "g");
    }
    for (let y = 26; y < DECK; y++) { r.set(314, y, "e"); r.set(315, y, "f"); r.set(316, y, "g"); }
    for (let x = 296; x < W; x++) { r.set(x, 26, "e"); r.set(x, 27, "f"); }
    for (let y = 14; y < 26; y++) for (let x = 300; x < 318; x++) {             // basket of wool balls
      const edge = x === 300 || x === 317 || y === 25;
      r.set(x, y, edge ? "f" : (x + y * 2) % 4 === 0 ? "f" : "e");
    }
    for (const [bx, by] of [[302, 10], [308, 9], [313, 11]]) ball(r, bx, by, 0);
    for (let x = 266; x < 292; x++) {             // heap of loose wool on the gallery
      const hgt = 9 - Math.abs(x - 278) / 2 + (hash(x, 1, 7) % 3) | 0;
      for (let y = DECK - hgt; y < DECK; y++) r.set(x, y, hash(x, y, 8) % 5 === 0 ? "f" : y === DECK - hgt ? "F" : "e");
    }
    return r;
  }
  function rug(i, j) {                            // Turkmen-style woven carpet: madder field, ivory border, guls
    if (j < 2 || j > 33 || i < 2 || i > 141) return "f";
    if (j === 2 || j === 33 || i === 2 || i === 141) return "g";
    if (j === 3 || j === 32 || i === 3 || i === 140) return (i + j) % 2 ? "F" : "f";
    const cx = 18 + 36 * Math.round((i - 18) / 36), cy = 18, dx = Math.abs(i - cx), dy = Math.abs(j - cy);
    if (dx <= 10 && dy <= 8 && dx + dy <= 13) {
      if (dx === 10 || dy === 8 || dx + dy === 13) return "g";
      if (dx + dy <= 2) return "F";
      if (dx === 0 || dy === 0) return "g";
      if (dx + dy === 7 && (dx & 1)) return "F";
      return ((i < cx) !== (j < cy)) ? "f" : "a";
    }
    const mx = Math.abs(i - (cx + 18)) % 36, md = Math.min(mx, 36 - mx) + Math.abs(j - cy);
    if (md === 4) return "F";
    return "h";
  }
  function ball(r, x, y, rot) {                   // 6×6 wool ball, the yarn line turns with rot
    const rows = [".eeee.", "eFeeee", "eeeeef", "eeeeef", "feeeff", ".ffff."];
    spr(r, rows, x, y);
    const k = rot & 3;
    if (k === 0) { r.set(x + 1, y + 2, "f"); r.set(x + 2, y + 3, "f"); r.set(x + 3, y + 4, "f"); }
    else if (k === 1) { r.set(x + 1, y + 3, "f"); r.set(x + 2, y + 3, "f"); r.set(x + 3, y + 3, "f"); r.set(x + 4, y + 3, "f"); }
    else if (k === 2) { r.set(x + 4, y + 1, "f"); r.set(x + 3, y + 2, "f"); r.set(x + 2, y + 3, "f"); }
    else { r.set(x + 3, y + 1, "f"); r.set(x + 3, y + 2, "f"); r.set(x + 3, y + 3, "f"); r.set(x + 3, y + 4, "f"); }
  }
  function buildFront() {                         // plank floor, gallery, dye vat (terrain and landmark props)
    const r = layer();
    for (let x = 0; x < W; x++) {
      const seamA = hash(x >> 5, 1, 21) % 32, seamB = hash((x + 13) >> 5, 2, 21) % 32;
      for (let y = FLOOR; y < H; y++) {
        let c;
        if (y === FLOOR) c = "F";
        else if (y === 164) c = "f";
        else if (y < 164) c = (x & 31) === seamA ? "f" : hash(x, y, 22) % 23 === 0 ? "F" : "e";
        else c = ((x + 13) & 31) === seamB ? "g" : hash(x, y, 23) % 19 === 0 ? "e" : "f";
        if (y === H - 1) c = "g";
        r.set(x, y, c);
      }
    }
    for (let x = 96; x < 112; x++) { r.set(x, FLOOR, "z"); r.set(x, FLOOR + 1, "g"); }   // slot under the plate
    for (let i = 0; i < 14; i++) {                // loose wool fibres on the floor
      const fx = hash(i, 3, 24) % W, fy = FLOOR + 1 + (hash(i, 4, 24) % 2);
      if (fx >= 92 && fx < 116) continue;
      r.set(fx, fy, "F"); r.set(fx + 1, fy + 1, "F"); r.set(fx + 2, fy, "F");
    }
    for (let x = DECK_X; x < W; x++) {            // gallery deck on a post and brace
      r.set(x, DECK, "F");
      for (let y = DECK + 1; y < DECK + 6; y++) r.set(x, y, (x - DECK_X) % 18 === 17 ? "f" : hash(x, y, 25) % 17 === 0 ? "F" : "e");
      r.set(x, DECK + 6, "f"); r.set(x, DECK + 7, "g");
    }
    for (let y = DECK + 8; y < FLOOR; y++) { r.set(268, y, "e"); r.set(269, y, "f"); r.set(270, y, "f"); r.set(271, y, "g"); }
    for (let k = 0; k < 16; k++) { r.set(272 + k, 124 - k, "f"); r.set(272 + k, 125 - k, "g"); }
    for (let k = 0; k < 22; k++) {                // stirring paddle leaning into the vat
      const x = 12 + ((k * 10) / 22 | 0), y = 89 + k;
      r.set(x, y, "e"); r.set(x + 1, y, "f");
    }
    for (let y = 108; y < FLOOR; y++) for (let x = 2; x <= 56; x++) {   // dye vat: rim seen from a little above, lit left
      const dx = x - VAT_CX, rim = (dx * dx) / 625 + ((y - 112) * (y - 112)) / 13 <= 1, dye = inDye(x, y);
      if (y < 115 && !rim) continue;
      let c;
      if (dye) c = "h";
      else if (y < 115) c = y < 112 ? (dx < 0 ? "d" : "F") : y === 114 ? "e" : dx < 0 ? "F" : "e";
      else {
        const t = (y - 115) / 32, hw = 22 + Math.round(3 * (1 - (2 * t - 1) * (2 * t - 1)));
        if (Math.abs(dx) > hw) continue;
        const u = (dx + hw) / (2 * hw);
        if (y === 115) c = "f";
        else if (y >= FLOOR - 2) c = "g";
        else if (y === 122 || y === 123 || y === 138) c = u < 0.2 ? "e" : "f";
        else c = u < 0.12 ? "F" : u < 0.55 ? "e" : u < 0.86 ? "f" : "g";
        if (y > 115 && y < 130 && hash(x, 9, 26) % 9 === 0 && y - 116 < hash(x, 10, 26) % 12) c = "h";
      }
      r.set(x, y, c);
    }
    return r;
  }
  const VAT_CX = 29;
  function inDye(x, y) { const dx = x - VAT_CX, dy = y - 111.5; return y >= 110 && y <= 113 && (dx * dx) / 400 + (dy * dy) / 4 <= 1; }
  function buildProps() {                         // scale figure, crate, rolled carpet (bulky load)
    const r = layer();
    spr(r, PORTER, 64, FLOOR - 16);
    spr(r, CRATE, 80, FLOOR - 16);
    const x0 = 160, y0 = FLOOR - 16;
    for (let j = 2; j < 16; j++) for (let i = 0; i < 26; i++) {
      let c;
      if (j === 2 || j === 15) c = "z";
      else if (i === 0) c = j > 3 && j < 14 && j % 2 ? "c" : "z";                // fringe
      else if (i === 1) c = "z";
      else {
        c = j === 3 ? "a" : j < 6 ? (i % 2 ? "a" : "h") : j < 11 ? "h" : j < 13 ? "f" : "g";
        if (i === 3 || i === 4 || i === 21 || i === 22) c = j < 6 ? "c" : j < 12 ? "F" : "f";
        if ((i === 9 || i === 16) && j > 2) c = j === 3 ? "e" : "g";             // cord ties
        if (i > 5 && i < 20 && i !== 9 && i !== 16 && (i + j * 3) % 7 === 0 && j > 4 && j < 12) c = "f";
      }
      r.set(x0 + i, y0 + j, c);
    }
    for (let j = 2; j < 16; j++) for (let i = 24; i < 32; i++) {                 // spiral end of the roll
      const dx = (i - 27.5) / 4.5, dy = (j - 8.5) / 6.8, d = dx * dx + dy * dy;
      if (d > 1) continue;
      let c = d > 0.72 ? "z" : d > 0.5 ? "h" : d > 0.32 ? "F" : d > 0.16 ? "h" : d > 0.05 ? "c" : "g";
      r.set(x0 + i, y0 + j, c);
    }
    for (const [i, j] of [[22, 3], [23, 3], [23, 4], [25, 3], [26, 2], [26, 3], [21, 4]]) r.set(x0 + i, y0 + j, j === 2 ? "g" : "z");  // chewed holes
    return r;
  }
  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    L = { back: buildBack(), front: buildFront(), props: buildProps() };
    L.LITE = Object.assign({}, PB.LIGHT, { h: "a", a: "b", i: "i" });             // beams: one step brighter, madder stays off the hero red
  }

  // ---- ambient (4 fps) ----
  const CYCLE = 16;                               // one drum beat per 4 s: warp flips, then the shuttle crosses
  function lifts(a) {
    const n = Math.floor(a / CYCLE), f = mod(a, CYCLE), out = [];
    for (let g = 0; g < NTH / GROUP; g++) {
      const up = (g + n) % 2 === 0;
      out.push(f === 0 ? 4 : up ? 8 : 0);
    }
    return out;
  }
  function drawWarp(r, a) {
    const lf = lifts(a), n = Math.floor(a / CYCLE), f = mod(a, CYCLE);
    for (let k = 0; k < NTH; k++) {
      const x = WX0 + 2 * k, g = k >> 3, end = FELL - 3 - lf[g];
      for (let y = 17; y <= end; y++) r.set(x, y, lf[g] > 4 ? "w" : "x");
      if (lf[g]) for (let y = end + 3; y < FELL; y++) r.set(x + 1, y, "y");       // back layer seen through the shed
    }
    for (let g = 0; g < NTH / GROUP; g++) {       // heddle bar at the foot of each group
      const x0 = WX0 + 16 * g, y = FELL - 2 - lf[g];
      for (let x = x0; x < x0 + 15; x++) { r.set(x, y, "e"); r.set(x, y + 1, "f"); }
    }
    const span = 2 * NTH - 16, ltr = n % 2 === 0;
    const p = f < 2 ? 0 : f > 13 ? 11 : f - 2, sx = ltr ? WX0 + Math.round((p * span) / 11) : WX0 + span - Math.round((p * span) / 11);
    const tail = ltr ? WX0 : sx + 16, head = ltr ? sx : WX0 + 2 * NTH;
    for (let x = tail; x < head; x++) r.set(x, FELL - 1, "F");                    // weft laid behind the shuttle
    spr(r, ["..eeFFFFFFFFee..", ".eFddddddddFFe.", "fFFddFFFFFFddFFf", "..ffffffffffff.."], sx, FELL - 7);
    for (let k = 0; k < NTH; k++) {               // warp of the lowered groups passes in front of the shuttle
      const g = k >> 3; if (lf[g]) continue;
      for (let y = FELL - 7; y < FELL - 3; y++) r.set(WX0 + 2 * k, y, "x");
    }
  }
  function drawHanging(r, a) {                    // two carpets drying on the rail, swinging gently
    const rugs = [
      { x: 6, w: 32, h: 46, amp: tri(a, 28, 2), field: "h", border: "e", motif: "a" },
      { x: 50, w: 36, h: 40, amp: tri(a + 9, 34, 2), field: "e", border: "h", motif: "f" },
    ];
    for (const g of rugs) for (let j = 0; j < g.h + 3; j++) {
      const y = 47 + j, dx = Math.round((g.amp * j) / g.h);
      for (let i = 0; i < g.w; i++) {
        let c;
        if (j >= g.h) { if (i % 2 === 0 && i > 0 && i < g.w - 1) c = j === g.h + 2 ? "e" : "F"; else continue; }   // fringe
        else if (j < 2) c = j === 0 ? "f" : "g";                                  // fold over the rail
        else if (i < 2 || i >= g.w - 2 || j < 4 || j >= g.h - 2) c = g.border;
        else if (i === 2 || i === g.w - 3 || j === 4 || j === g.h - 3) c = "f";
        else {
          const cx = g.w >> 1, cy = 4 + ((g.h - 4) >> 1), ddx = Math.abs(i - cx), ddy = Math.abs(j - cy) % 14;
          const m = ddx + Math.min(ddy, 14 - ddy);
          c = m === 6 ? "g" : m < 6 && m > 3 ? g.motif : m <= 1 ? g.border : g.field;
        }
        if (i === g.w - 1 && j < g.h) c = "f";
        r.set(g.x + i + dx, y, c);
      }
    }
  }
  function drawWool(r, a) {                       // wool balls roll off the basket, down the chute, burst into the heap
    for (const off of [0, 11]) {
      const f = mod(a + off, 22);
      if (f < 2) { ball(r, 300 - f * 2, 22 + f * 2, f); continue; }
      if (f < 10) { const k = f - 2; ball(r, 296 - k * 3, 24 + k * 6, f); continue; }
      if (f < 13) { ball(r, 272 - (f - 10), [80, 88, 86][f - 10], f); continue; }
      if (f < 17) {
        const k = f - 12, c = k < 3 ? "F" : "e";
        for (const [vx, vy] of [[-3, -1], [-1, -2], [2, -2], [3, 0], [0, -1]]) {
          const x = 275 + vx * k, y = 90 + vy * k + ((k * k) >> 1);
          r.set(x, y, c); if (k < 3) r.set(x + 1, y, c);
        }
      }
    }
  }
  function drawSteam(r, a) {                      // faint warm air above the dye vat
    for (let i = 0; i < 7; i++) {
      const per = 26 + ((i * 5) % 9), age = mod(a + i * 7, per);
      if (age > per - 4) continue;
      const x = 10 + i * 6 + tri(age + i * 3, 12, 2) + ((age / 5) | 0), y = 112 - age * 2;
      const keep = 15 - ((age * 14) / per | 0);
      for (const [ox, oy] of [[0, 0], [1, -1], [0, -2]]) if (bay(x + ox, y + oy) < keep) r.set(x + ox, y + oy, age < 6 ? "w" : "x");
    }
  }
  const BEAMS = [[25, 95, 30], [120, 180, 30], [205, 275, 50], [295, 350, 50]];   // [u0, u1, xStart], u = 10y − 3x
  function beamAt(x, y) {
    const u = 10 * y - 3 * x;
    for (const [u0, u1, xs] of BEAMS) {
      if (x < xs || u < u0 || u > u1) continue;
      const fade = 16 - (((x - xs) * 16) / 230 | 0);
      const edge = u - u0 < 12 || u1 - u < 12 ? 8 : 16;
      return bay(x, y) < Math.min(fade, edge);
    }
    return false;
  }
  function drawBeams(r) {
    for (let y = 4; y < 128; y++) for (let x = 30; x < 264; x++) if (!(x > 35 && x < 52 && y < 44) && beamAt(x, y)) remapPx(r, x, y, L.LITE);
  }
  function drawDust(r, a) {
    for (let i = 0; i < 12; i++) {
      if (mod(a + i * 3, 7) > 4) continue;
      const x = 50 + ((hash(i, 1, 31) % 170) | 0) + tri(a + i * 7, 60, 5), y0 = 10 + (hash(i, 2, 31) % 70);
      const y = y0 + ((3 * x) / 10 | 0) - 15 + tri(a + i * 11, 44, 3);
      if (y > 3 && y < 128 && beamAt(x, y)) r.set(x, y, "F");
    }
  }
  function drawDye(r, a) {                        // ripples on the madder dye
    for (let y = 110; y <= 113; y++) for (let x = 8; x <= 50; x++) {
      if (!inDye(x, y)) continue;
      if ((y === 111 && mod(x + a, 9) < 2) || (y === 112 && mod(x - a, 11) < 2)) r.set(x, y, "a");
    }
  }
  function drawPlateDoor(r, a) {                  // plate down ↔ warp door lifted (appearance loop only)
    const f = mod(a, 24), o = f < 10 ? 0 : f === 10 || f === 22 ? 1 : f === 23 ? 0 : 2;
    spr(r, PLATE, 96, FLOOR - 5 + (o ? 2 : 0));
    const by = [FLOOR - 3, FLOOR - 13, FLOOR - 23][o];
    for (let y = 118; y < FLOOR; y++) { r.set(128, y, "z"); r.set(129, y, "e"); r.set(142, y, "f"); r.set(143, y, "z"); }
    for (let x = 128; x < 144; x++) for (let y = 116; y < 122; y++) {
      const edge = y === 116 || y === 121 || x === 128 || x === 143;
      r.set(x, y, edge ? "z" : y === 120 ? "f" : "e");
    }
    for (const [i, j] of [[7, 0], [6, 1], [8, 1], [7, 2]]) r.set(128 + i, 117 + j, "s");
    for (let x = 131; x <= 139; x += 2) for (let y = 122; y < by; y++) r.set(x, y, y % 4 === 0 ? "F" : "c");
    for (let x = 130; x < 142; x++) { r.set(x, by, "z"); r.set(x, by + 1, x === 130 ? "z" : "w"); r.set(x, by + 2, "z"); }
    r.set(141, by + 1, "z");
  }
  function line(r, x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) r.set(x0 + Math.round(((x1 - x0) * k) / n), y0 + Math.round(((y1 - y0) * k) / n), c);
  }
  function drawDrum(r, a) {                       // the mallet strikes once per cycle (the same beat that flips the warp)
    const f = mod(a, CYCLE), hit = f === 0;
    for (let y = 127; y < FLOOR; y++) { r.set(222, y, "z"); r.set(223, y, "f"); r.set(224, y, "z"); }   // mallet post
    r.set(222, 126, "z"); r.set(223, 126, "z"); r.set(224, 126, "z");
    spr(r, DRUM, 208, FLOOR - 12);
    const hx = hit ? 210 : 212, hy = hit ? 131 : f > 12 ? 118 : 120;
    line(r, 222, 129, hx + 4, hy + 2, "z"); line(r, 222, 128, hx + 4, hy + 1, "f");
    for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) r.set(hx + i, hy + j, i === 0 || j === 0 || i === 4 || j === 3 ? "z" : j === 1 ? "d" : "F");
    if (hit) {
      r.hline(210, FLOOR - 11, 10, "t");
      for (const [x, y] of [[207, 133], [206, 132], [221, 134], [222, 133]]) r.set(x, y, "c");
    }
  }

  // ---- animals (8 fps) ----
  function drawMoth(r, tick) {                    // hovers at the end of the carpet roll, lands and nibbles
    const p = mod(tick, 40);
    if (p < 16) {
      const fr = [1, 1, 2, 1][(tick >> 1) & 3];
      spr(r, MOTH[fr], 180, FLOOR - 24 + (tick & 2 ? 1 : 0));
    } else {
      const k = p - 16, x = 182 + tri(k, 24, 7), y = FLOOR - 36 + tri(k + 6, 12, 3);
      spr(r, MOTH[[0, 1, 2, 1][tick & 3]], x, y);
    }
  }
  function drawFoal(r, tick) {                    // golden coat: a glint runs along the body every couple of seconds
    const x0 = 287, y0 = DECK - 21, sweep = mod(tick, 24) * 2 - 10, ear = mod(tick, 36) < 2;
    for (let j = 0; j < FOAL.length; j++) {
      const row = FOAL[j], ox = ear && j === 0 ? 1 : 0;          // ear flick: the tip tilts back a pixel
      for (let i = 0; i < row.length; i++) {
        let c = row[i];
        if (c === ".") continue;
        if (c === "d") {
          const s = i + j - sweep;
          if (s === 0 || s === 1) c = "c";
          else if (s === 2) c = (j & 1) ? "c" : "d";
        }
        r.set(x0 + i + ox, y0 + j, c);
      }
    }
    if (mod(tick, 24) === 8) r.set(x0 + 15, y0 + 10, "l");                     // sparkle
    spr(r, FOAL_TAIL[(tick >> 2) & 1], x0 + 23, y0 + 9);
  }

  window.PB_CONCEPT_SCENES["carpet_loom"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      r.data.set(L.back.data);
      drawWarp(r, a);
      drawHanging(r, a);
      drawWool(r, a);
      drawSteam(r, a);
      drawBeams(r);
      drawDust(r, a);
      r.blit(L.front, 0, 0);
      drawDye(r, a);
      drawPlateDoor(r, a);
      drawDrum(r, a);
      r.blit(L.props, 0, 0);
      drawMoth(r, tick);
      drawFoal(r, tick);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
