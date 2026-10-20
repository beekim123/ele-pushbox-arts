/* ART-04r 地图概念场景 · 巨人宴桌（supra_table）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 地标：铺亚麻桌布的巨人长桌、一大串葡萄、立在地上的陶罐（远处的葡萄架和长桌作分层背景）。
 * 机关外观（只示意，不实现规则）：架在核桃上的勺子跷跷板（seesaw）、能推着滚的葡萄球（push_monster，按“葡萄是滚球”推断）、
 *   罐里葡萄汁托起的木塞（float_sink）。
 * 环境（4 fps）：葡萄叶影在远处桌布上晃动流过；陶罐里葡萄汁发酵冒泡、木塞跟着起伏；远处巨人的手偶尔伸下来拿走一串葡萄。
 * 动物（8 fps）：葡萄蜂（怪物，围着葡萄转）、高加索牧羊犬幼崽（提示动物，趴在桌下摇尾巴）。
 * 比例尺：主角大小的人影 + 1 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4
  const TOP = OY + 7 * 16;                        // 116: the tabletop the hero walks on (platform)
  const FLOOR = OY + 10 * 16;                     // 164: floor under the table (ground)
  const TABLE_X1 = 255;                           // the table ends at x 255
  const HEM = 136;                                // bottom of the tablecloth drape
  const BAND0 = 76, BAND1 = 115;                  // far tablecloth band (background)
  const JAR_X = 258, JAR_RIM = 100;               // clay jar standing on the floor, mouth at tabletop height
  const BUNCH_X = 160;                            // big bunch of grapes, x 160–207
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
  function disc(r, cx, cy, rad, fn) {             // fill a pixel disc, colour chosen per pixel
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) { const c = fn(dx, dy); if (c) r.set(x, y, c); }
    }
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
  const WASP = [                                  // grape wasp facing right, wings up / down (8 fps)
    ["....uu.uu...", "...uvuuvu...", "....zzzz..z.", ".zzkzkzzzzz.", "zkzkzkzgzkkz", ".zzkzkzzzzz.", "....z.z.z..."],
    ["............", "............", "...uvvuvvz.z", ".zzkzuzuzzz.", "zkzkzkzgzkkz", ".zzkzkzzzzz.", "....z.z.z..."],
  ];
  const PUP = [                                   // Caucasian shepherd puppy lying down, facing left (tail drawn separately)
    "....zz...zz.....................",
    "...zez..zez.....................",
    "..zFFFzzFFFz....................",
    ".zFdddddddFFz...................",
    ".zdzdddddzdFz.......zzzzzzzzz...",
    "zFFFFdddddddFzzzzzzzFdddddddFz..",
    "zfggFdddddddFFzddddddddddddddFz.",
    "zggfFddddddFFzdddddddddddddddeFz",
    ".zzfFdddddFFzddddddddddddddddeFz",
    "...zFFddddFzdddddddddddddddddeez",
    "..zFdFFdFFzFFddddddddddddddFeeez",
    ".zFddFddFFzeFFFddddddddddFFFeez.",
    ".zzzzzzzzzzzeeeFFFFFFFFFFeeeez..",
    "...........zzzzzzzzzzzzzzzzzz...",
  ];
  const PUP_TAIL = [                              // bushy tail: up, level, over the back (8 fps wag)
    ["..zz", ".zdz", "zdFz", "zFz.", "zz.."],
    ["....", "....", "zzzz", "zdFz", "zzz."],
    ["zz..", "zdz.", "zFdz", ".zFz", "..zz"],
  ];

  // ---- static layers ----
  function grapeLeaf(r, cx, cy, s, c, edge) {     // five-lobed vine leaf, s = half size
    for (let y = -s; y <= s; y++) for (let x = -s; x <= s; x++) {
      const ang = Math.atan2(y, x), lobes = 0.8 + 0.2 * Math.abs(Math.cos(2.5 * (ang + 1.57)));
      const d = Math.sqrt(x * x + y * y) / s;
      if (d <= lobes && !(y > s * 0.5 && Math.abs(x) < 1)) r.set(cx + x, cy + y, edge && d > lobes - 0.22 ? edge : c);
    }
  }
  function grape(r, cx, cy, rad, pal) {           // one grape: lit upper-left, dark rim, bloom dot
    const [lit, mid, dark, rim, spec] = pal;
    disc(r, cx, cy, rad, (dx, dy) => {
      const d2 = dx * dx + dy * dy;
      if (d2 > (rad - 0.8) * (rad - 0.8)) return rim;
      if ((dx + rad * 0.35) ** 2 + (dy + rad * 0.35) ** 2 < (rad * 0.42) ** 2) return lit;
      if ((dx + rad * 0.25) ** 2 + (dy + rad * 0.25) ** 2 > (rad * 0.85) ** 2) return dark;
      return mid;
    });
    if (spec && rad >= 3) r.set(Math.round(cx - rad * 0.45), Math.round(cy - rad * 0.45), spec);
  }
  function buildBack() {                          // hall wall, vine pergola, far tablecloth, under-table shade
    const r = layer();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = hash(x, y, 3), plank = (x + ((y >> 5) & 1) * 9) % 18 === 0;
      r.set(x, y, plank ? "z" : h % 61 === 0 ? "x" : "y");
    }
    for (let x = 0; x < W; x++) { r.set(x, 4, "g"); r.set(x, 5, "f"); r.set(x, 6, "g"); r.set(x, 7, "z"); }   // pergola beam
    for (const px of [6, 104, 204, 302]) for (let y = 8; y < BAND0; y++) { r.set(px, y, "g"); r.set(px + 1, y, "f"); r.set(px + 2, y, "g"); }
    for (let x = 0; x < W; x++) {                 // twisting vine along the beam
      const y = 9 + tri(x, 22, 2);
      r.set(x, y, "g"); if (x % 11 === 3) r.set(x, y + 1, "g");
    }
    for (let i = 0; i < 26; i++) {                // dark leaves hanging from the pergola
      const lx = (i * 13 + (hash(i, 1, 4) % 9)) % W, ly = 12 + (hash(i, 2, 4) % 14), s = 5 + (hash(i, 3, 4) % 3);
      grapeLeaf(r, lx, ly, s, i & 1 ? "p" : "o", "p");
    }
    for (const [gx, gy] of [[40, 22], [132, 26], [236, 20], [286, 28]]) {       // dim grape clusters among the leaves
      for (let k = 0; k < 9; k++) grape(r, gx + [0, 4, 8, 2, 6, 4, 1, 7, 4][k], gy + [0, 0, 0, 4, 4, 8, 8, 8, 12][k], 2.4, ["B", "B", "g", "z", null]);
      r.set(gx + 4, gy - 3, "g"); r.set(gx + 4, gy - 2, "g");
    }
    for (let y = BAND0; y <= BAND1; y++) for (let x = 0; x < W; x++) {         // far tablecloth, cool and dim
      r.set(x, y, y < BAND0 + 2 ? "x" : y > BAND1 - 3 ? "x" : y === 82 || y === 86 ? "x" : y === 84 && x % 6 < 3 ? "B" : "w");
    }
    for (let x = 0; x < W; x++) for (let y = BAND0 - 4; y < BAND0; y++) if (bay(x, y) < (y - BAND0 + 5) * 2) r.set(x, y, "x");
    for (const [bx, by] of [[22, 88], [96, 92]]) {                              // khachapuri boats on the far table
      for (let i = 0; i < 34; i++) {
        const t = i / 33, hgt = Math.round(Math.sin(t * Math.PI) * 6) + (i < 3 || i > 30 ? 2 : 0);
        for (let j = 0; j < hgt + 3; j++) r.set(bx + i, by + 4 - j + (i < 3 || i > 30 ? -2 : 0), j === hgt + 2 ? "e" : j > hgt - 1 ? "F" : "e");
        if (i > 8 && i < 26) { r.set(bx + i, by - 1, i % 5 === 0 ? "d" : "F"); }
      }
      r.set(bx + 17, by - 2, "k");
    }
    for (let x = 196; x < 252; x++) { r.set(x, 104, "v"); r.set(x, 105, "x"); }  // platter rim under the giant's grapes
    for (let i = 0; i < 14; i++) grape(r, 206 + (i % 5) * 7 + ((i / 5) | 0) * 3, 99 - ((i / 5) | 0) * 5, 3, ["C", "B", "B", "g", null]);
    for (let x = 0; x <= TABLE_X1; x++) for (let y = HEM; y < FLOOR; y++) r.set(x, y, y < HEM + 4 ? "z" : "y");
    for (let x = TABLE_X1 + 1; x < W; x++) for (let y = BAND1 + 1; y < FLOOR; y++) {      // far side of the hall behind the jar
      r.set(x, y, y < BAND1 + 18 ? ((x + y) % 7 === 0 ? "w" : "x") : "y");
    }
    return r;
  }
  function buildFront() {                         // tablecloth drape, table legs, floor, clay jar
    const r = layer();
    for (let x = 0; x < W; x++) for (let y = FLOOR; y < H; y++) {
      const seam = (x + ((y >> 3) & 1) * 13) % 26 === 0;
      r.set(x, y, y === FLOOR ? "F" : y === H - 1 ? "g" : seam ? "f" : hash(x, y, 5) % 19 === 0 ? "f" : "e");
    }
    for (const lx of [14, 226]) for (let y = HEM; y < FLOOR; y++) {          // turned table legs below the drape
      const bulge = y > 146 && y < 156 ? 2 : y > 142 && y < 160 ? 1 : 0;
      for (let i = -bulge; i < 12 + bulge; i++) r.set(lx + i, y, i <= 0 ? "e" : i > 9 ? "g" : i === 1 ? "F" : "f");
      if (y === 146 || y === 156) for (let i = -2; i < 14; i++) r.set(lx + i, y, "z");
    }
    for (let x = 0; x <= TABLE_X1; x++) {         // linen tablecloth hanging over the table edge
      const fold = (x % 24), corner = x > TABLE_X1 - 6 ? x - (TABLE_X1 - 6) : 0;
      for (let y = TOP; y <= HEM + (corner >> 1); y++) {
        let c = y === TOP ? "c" : fold === 0 ? "F" : fold === 1 || fold === 23 ? "E" : "c";
        if (y === TOP + 1) c = "E";
        if (y >= 124 && y <= 130) {               // embroidered band: grape diamonds and leaf sprigs
          const u = x % 12, v = y - 127, dd = Math.abs(u - 6) + Math.abs(v);
          c = y === 124 || y === 130 ? "B" : dd <= 1 ? "C" : dd <= 3 ? "B" : (u === 0 || u === 1) && Math.abs(v) <= 1 ? "n" : c;
        }
        if (y > 131 && y <= HEM + (corner >> 1)) c = y === HEM + (corner >> 1) ? "F" : fold === 0 ? "F" : "E";
        if (x === TABLE_X1) c = y === TOP ? "E" : "F";
        r.set(x, y, c);
      }
      if (x % 2 === 0 && x < TABLE_X1 - 6) { r.set(x, HEM + 1, "E"); r.set(x, HEM + 2, x % 4 ? "F" : "E"); }   // fringe
    }
    const cx = JAR_X + 30;
    for (let y = JAR_RIM + 4; y < FLOOR; y++) {   // big clay jar: wide mouth at tabletop height, round belly, narrow foot
      const t = (y - JAR_RIM - 4) / (FLOOR - JAR_RIM - 4);
      const hw = Math.round(t < 0.4 ? 21 + Math.sin((t / 0.4) * Math.PI / 2) * 8 : 29 - ((t - 0.4) / 0.6) ** 1.6 * 15);
      for (let x = cx - hw; x <= cx + hw; x++) {
        const u = (x - cx) / hw;
        let c = x === cx - hw || x === cx + hw ? "z" : u < -0.62 ? "F" : u < 0.3 ? "e" : u < 0.78 ? "f" : "g";
        if (u > -0.5 && u < -0.38 && t > 0.12 && t < 0.7) c = "d";               // highlight streak
        if ((y === JAR_RIM + 12 || y === JAR_RIM + 15 + ((x >> 2) & 1)) && Math.abs(u) < 0.97) c = u < -0.62 ? "e" : "g";   // incised bands
        if (y === FLOOR - 1) c = "z";
        r.set(x, y, c);
      }
    }
    return r;
  }
  function buildProps() {                         // scale figure, crate, walnut fulcrum, big bunch, loose grape ball
    const r = layer();
    spr(r, PORTER, 8, TOP - 16);
    spr(r, CRATE, 24, TOP - 16);
    disc(r, 81.5, TOP - 6.5, 6.5, (dx, dy) => {   // walnut under the spoon
      const d2 = dx * dx + dy * dy;
      if (d2 > 36) return "z";
      if (Math.abs(dx) < 0.6) return "f";
      return (Math.round(dx * 2 + dy * 3) & 3) === 0 ? "e" : dx + dy < -3 ? "d" : "F";
    });
    grapeLeaf(r, BUNCH_X + 24, TOP - 5, 12, "n", "o");                         // leaf the bunch lies on
    const G = [[8, 30, 7], [21, 31, 8], [35, 31, 7], [14, 20, 7], [28, 20, 8], [41, 22, 6], [20, 9, 7], [34, 10, 6]];
    for (const [gx, gy, gr] of G) grape(r, BUNCH_X + gx, TOP - 40 + gy, gr, ["C", "B", "g", "z", "D"]);
    for (let j = 0; j < 7; j++) { r.set(BUNCH_X + 27 + (j >> 1), TOP - 40 - j, "f"); r.set(BUNCH_X + 28 + (j >> 1), TOP - 40 - j, "e"); }   // stem
    grape(r, 135.5, TOP - 8.5, 8, ["C", "B", "g", "z", "D"]);                  // loose grape ball (pushable)
    for (let i = -6; i <= 6; i++) r.set(136 + i, TOP, "E");                    // its contact shadow on the cloth top line
    return r;
  }
  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    L = { back: buildBack(), front: buildFront(), props: buildProps() };
    L.LEAFMASK = [];                              // leaf-shadow stamps for the far tablecloth
    const m = layer();
    for (let i = 0; i < 9; i++) {
      const s = 6 + (hash(i, 1, 6) % 4);
      grapeLeaf(m, 12 + i * 34, 12, s, "z", null);
    }
    for (let i = 0; i < 9; i++) {
      const pts = [];
      for (let y = 0; y < 26; y++) for (let x = i * 34 - 6; x < i * 34 + 30; x++) if (x >= 0 && x < W && m.get(x, y) === "z") pts.push([x - (12 + i * 34), y - 12]);
      L.LEAFMASK.push(pts);
    }
  }

  // ---- ambient (4 fps) ----
  function drawLeafShadows(r, a) {                // leaf shadows drift and sway across the far tablecloth
    L.LEAFMASK.forEach((pts, i) => {
      const cx = mod(i * 40 + 6 + ((a * 2) >> 2) + tri(a + i * 5, 28, 4), W + 40) - 20, cy = BAND0 + 10 + ((i * 7) % 22) + tri(a + i * 3, 36, 1);
      for (const [dx, dy] of pts) {
        const x = cx + dx, y = cy + dy;
        if (y < BAND0 + 2 || y > BAND1 || x < 0 || x >= W) continue;
        remapPx(r, x, y, L.SHADE);
      }
    });
  }
  function drawHand(r, a) {                       // now and then the giant reaches down and takes a bunch from the platter
    const f = mod(a, 88);
    if (f > 30) return;
    const reach = f < 10 ? f : f < 16 ? 10 : Math.max(0, 10 - (f - 16) * 0.75), y = Math.round(-46 + reach * 11.6), x = 214, grip = f >= 12;
    for (let yy = 0; yy < y; yy++) {                                          // sleeve of the giant's coat, slanting in from the upper right
      const up = y - yy, sx = x - 2 + ((up / 5) | 0);
      for (let i = 0; i < 26; i++) {
        const crease = up >= 5 && up < 19 && (i === 5 + ((up - 5) >> 1) || i === 20 - ((up - 5) >> 2));   // cloth bunched above the cuff
        r.set(sx + i, yy, i === 0 || i === 25 ? "z" : up < 4 ? (up === 1 ? "g" : "B") : crease ? "y" : i < 4 ? "w" : i > 20 ? "y" : "x");
      }
    }
    for (let j = 0; j < 14; j++) for (let i = 0; i < 22; i++) {               // back of the hand
      const yy = y + j; if (yy < 0 || (j > 11 && (i === 0 || i === 21))) continue;   // rounded knuckle corners
      r.set(x + i, yy, i === 0 || i === 21 ? "f" : j > 10 ? "f" : i < 5 ? "F" : "e");
    }
    for (let k = 0; k < 4; k++) {                 // four fingers, open on the way down, curled round the stem on the way up
      const fx = x + 1 + k * 5 + (grip ? Math.round(1.5 - Math.abs(k - 1.5)) * (k < 2 ? 1 : -1) : 0), len = grip ? 7 : 12 - Math.abs(k - 1.5) * 2;
      for (let j = 0; j < len; j++) for (let i = 0; i < 4; i++) {
        const yy = y + 14 + j; if (yy < 0 || (i === 3 && j > 1)) continue;
        r.set(fx + i, yy, i === 2 || j === len - 1 ? "f" : i === 0 && j < len - 2 ? "F" : "e");
      }
    }
    for (let j = 0; j < 9; j++) { const yy = y + 3 + j; if (yy >= 0) { r.set(x - 1 - (j >> 2), yy, "e"); r.set(x - 2 - (j >> 2), yy, "f"); } }   // thumb
    if (grip && f > 12) for (let i = 0; i < 6; i++) grape(r, x + 7 + (i % 3) * 4, y + 23 + ((i / 3) | 0) * 4, 2.3, ["C", "B", "B", "g", null]);
  }
  function drawJar(r, a) {                        // fermenting juice in the mouth: bubbles rise and pop, the cork bobs on it
    const cx = JAR_X + 30, cy = JAR_RIM + 3;
    const inEll = (x, y, rx, ry) => ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry) <= 1;
    for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 23; x <= cx + 23; x++) {
      if (!inEll(x, y, 22.5, 5.2)) continue;
      let c;
      if (!inEll(x, y, 18.5, 3.2)) c = y < cy ? (x < cx - 8 ? "d" : "F") : x < cx ? "F" : "e";   // rim
      else if (y < cy - 1) c = "g";                                             // inner back wall in shade
      else c = (x + y * 2 + a) % 11 === 0 ? "C" : "B";                          // grape juice surface
      if (!inEll(x, y, 21.5, 4.4) && inEll(x, y, 22.5, 5.2)) c = "z";
      r.set(x, y, c);
    }
    for (let i = 0; i < 7; i++) {                 // bubbles swell and pop at the surface
      const per = 7 + (i % 4), age = mod(a + i * 5, per), bx = cx - 15 + ((i * 9) % 31), by = cy + (i % 3) - 1;
      if (Math.abs(bx - (cx + 4)) < 9 || age > 3) continue;
      if (age < 2) r.set(bx, by, "D");
      else if (age === 2) { r.set(bx, by - 1, "D"); r.set(bx - 1, by, "C"); r.set(bx + 1, by, "C"); }
      else { r.set(bx - 1, by - 1, "C"); r.set(bx + 1, by - 1, "C"); }
    }
    const bob = [0, 0, 1, 1, 1, 0, 0, -1][a & 7], kx = cx - 4, ky = cy - 5 + bob;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 6; j++) {                 // cork float
      if ((i === 0 || i === 15) && j === 0) continue;
      const edge = i === 0 || i === 15 || j === 5 || j === 0;
      r.set(kx + i, ky + j, edge ? (j === 0 ? "f" : "z") : j === 1 ? "d" : (i * 3 + j * 5) % 7 === 0 ? "e" : j > 3 ? "e" : "F");
    }
    for (let x = kx; x < kx + 16; x++) if (inEll(x, ky + 6, 18.5, 3.2)) r.set(x, ky + 6, "C");   // ripple ring at the waterline
    for (let y = cy; y <= cy + 5; y++) for (let x = cx - 23; x <= cx + 23; x++) {               // front lip over the cork
      if (inEll(x, y, 22.5, 5.2) && !inEll(x, y, 18.5, 3.2) && y > cy) r.set(x, y, !inEll(x, y, 21.5, 4.4) ? "z" : x < cx - 12 ? "F" : "e");
    }
  }
  function drawSpoon(r, a) {                      // the spoon rests on the walnut and tips from side to side
    const f = mod(a, 32), tilt = f < 14 ? 1 : f === 14 || f === 30 ? 0 : f < 30 ? -1 : 1;
    const px = 81.5, py = TOP - 14.5, sl = tilt > 0 ? 0.3 : tilt < 0 ? -0.22 : 0.04, fill = new Map();
    for (let d = -40; d <= 40; d += 0.5) {
      const cx = px + d, cy = py + d * sl;
      const hw = d < -17 ? Math.max(1, Math.sqrt(Math.max(0, 1 - ((d + 29) / 12) ** 2)) * 5.5) : d < -11 ? 1 : d < 34 ? 1.3 : 1.8;
      for (let o = -hw; o <= hw; o += 0.5) {
        const x = Math.round(cx - o * sl * 0.2), y = Math.round(cy + o), key = y * W + x;
        const c = d < -17 ? (o < -hw * 0.45 ? "u" : o > hw * 0.5 ? "w" : "v") : o < -0.4 ? "u" : "v";
        if (!fill.has(key) || c === "u") fill.set(key, c);
      }
    }
    for (const key of fill.keys()) {
      const x = key % W, y = (key / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!fill.has((y + dy) * W + x + dx)) r.set(x + dx, y + dy, "z");
    }
    for (const [key, c] of fill) r.set(key % W, (key / W) | 0, c);
  }

  // ---- animals (8 fps) ----
  function waspPos(tick) {
    const t = mod(tick, 48) / 48 * Math.PI * 2;
    return [Math.round(BUNCH_X + 22 + Math.cos(t) * 32), Math.round(TOP - 30 + Math.sin(t) * 14), Math.sin(t) < 0, Math.cos(t + 0.01) > Math.cos(t) ? 1 : 0];
  }
  function drawWasp(r, tick, behind) {            // circles the bunch, passing behind it on the far side
    const [x, y, back] = waspPos(tick), t = mod(tick, 48) / 48 * Math.PI * 2, goingLeft = Math.sin(t) > 0;
    if (back !== behind) return;
    spr(r, WASP[tick & 1], x - 6, y - 4, goingLeft);
  }
  function drawPup(r, tick) {                     // Caucasian shepherd puppy lying under the table, tail wagging
    const x0 = 146, y0 = FLOOR - 20, M = new Set(), key = (x, y) => y * 64 + x;
    const tailAng = [-1.9, -1.3, -0.7, -1.3][tick & 3];                       // wag
    for (let k = 0; k < 4; k++) disc(r, x0 + 37 + Math.cos(tailAng) * k * 2.2, y0 + 10 + Math.sin(tailAng) * k * 2.2, 2.6 - k * 0.3, () => "z");
    for (let k = 0; k < 4; k++) disc(r, x0 + 37 + Math.cos(tailAng) * k * 2.2, y0 + 10 + Math.sin(tailAng) * k * 2.2, 1.8 - k * 0.3, () => (k > 1 ? "d" : "F"));
    for (const [cx, cy, rx, ry] of [[24, 13, 11, 6.5], [15, 12, 7, 6.5], [33, 15, 5, 4.5]]) {   // body, chest, haunch: one fluffy loaf
      for (let y = Math.floor(cy - ry); y <= Math.min(18, cy + ry); y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) M.add(key(x, y));
      }
    }
    for (const k of M) {                          // outline, then fur: lit back, darker belly, a few tufts
      const x = k % 64, y = (k / 64) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!M.has(key(x + dx, y + dy))) r.set(x0 + x + dx, y0 + y + dy, "z");
    }
    for (const k of M) {
      const x = k % 64, y = (k / 64) | 0;
      let top = y; while (M.has(key(x, top - 1))) top--;
      const edgeR = !M.has(key(x + 1, y)) || !M.has(key(x, y + 1));
      r.set(x0 + x, y0 + y, y - top < 2 ? "d" : y - top === 2 && (x * 7) % 5 === 0 ? "d" : edgeR || y > 15 ? "e" : "F");
    }
    for (const [px, w] of [[2, 9], [12, 8]]) for (let i = 0; i < w; i++) {    // front paws stretched out
      r.set(x0 + px + i, y0 + 16, "z"); r.set(x0 + px + i, y0 + 17, i === 0 ? "z" : i < 3 ? "d" : "F"); r.set(x0 + px + i, y0 + 18, i === 0 ? "z" : "e"); r.set(x0 + px + i, y0 + 19, "z");
    }
    disc(r, x0 + 9, y0 + 8, 7.5, () => "z");                                  // head
    disc(r, x0 + 9, y0 + 8, 6.6, (dx, dy) => (dx + 2) ** 2 + (dy + 2.5) ** 2 < 12 ? "d" : dy > 3.5 || dx + dy > 6 ? "e" : "F");
    for (const [ex, ey, c] of [[12, 3, "f"], [13, 3, "e"], [14, 3, "e"], [12, 4, "f"], [13, 4, "e"], [14, 4, "e"], [15, 4, "z"], [12, 5, "f"],
      [13, 5, "e"], [14, 5, "f"], [15, 5, "z"], [13, 6, "f"], [14, 6, "z"]]) r.set(x0 + ex, y0 + ey, c);                 // small drooping ear
    for (let y = 9; y <= 13; y++) for (let x = 0; x <= 6 - (y > 12 ? 1 : 0); x++) r.set(x0 + x, y0 + y, x === 0 || y === 13 ? "z" : y === 9 && x > 3 ? "e" : "f");   // dark muzzle
    r.set(x0, y0 + 9, "z"); r.set(x0 + 1, y0 + 9, "z"); r.set(x0 + 1, y0 + 10, "z");                                      // nose
    const blink = mod(tick, 40) >= 38;
    r.set(x0 + 5, y0 + 6, blink ? "e" : "z"); r.set(x0 + 6, y0 + 6, blink ? "e" : "z"); r.set(x0 + 5, y0 + 5, "f"); r.set(x0 + 6, y0 + 5, "f");   // eye in the dark mask
  }

  window.PB_CONCEPT_SCENES["supra_table"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      if (!L.SHADE) L.SHADE = Object.assign({}, PB.DIM, { u: "v", v: "w", w: "x", x: "y" });
      r.data.set(L.back.data);
      drawLeafShadows(r, a);
      drawHand(r, a);
      r.blit(L.front, 0, 0);
      drawJar(r, a);
      drawWasp(r, tick, true);
      r.blit(L.props, 0, 0);
      drawSpoon(r, a);
      drawWasp(r, tick, false);
      drawPup(r, tick);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
