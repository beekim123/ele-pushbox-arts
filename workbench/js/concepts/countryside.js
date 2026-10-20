/* ART-04k 地图概念场景 · 乡村小路（countryside）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 地标：一望无际的麦田、木篱笆和农舍、干草垛、稻草人（不画风车）。机关外观：雨后的泥地（mud）。
 * 环境（4 fps）：麦浪随阵风一阵阵滚过、云影掠过田野、农舍炊烟、蝴蝶在虞美人间飞。
 * 动物（8 fps）：大白鹅（怪物，伸长脖子追人）、看门狗（提示动物，摇尾巴）。
 * 比例尺：主角大小的人影 + 2 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4 (20 × 11 tiles)
  const FLOOR = OY + 9 * 16;                      // 148: top of the dirt road
  const BANK_X = 14 * 16, BANK_Y = OY + 7 * 16;   // grass bank on the right: x ≥ 224, top y = 116
  const MUD_X0 = 8 * 16, MUD_X1 = 11 * 16;        // mud tiles on the road: x 128–175
  const HZ = 100;                                 // horizon of the wheat field
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null, REV = null;            // L: static layers, built once; REV: rgb → palette code

  function tri(t, period, amp) {
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
  // Re-paint already drawn pixels through a palette map (light / shadow without blending).
  function remap(r, x0, y0, x1, y1, map, test) {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(W, x1 | 0); y1 = Math.min(H, y1 | 0);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (test && !test(x, y)) continue;
      const i = (y * W + x) * 4, d = r.data;
      if (!d[i + 3]) continue;
      const c = REV.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]), m = c && map[c];
      if (m && m !== c) r.set(x, y, m);
    }
  }
  // Vertical colour bands with a short ordered-dither seam between neighbours.
  function bands(r, stops, seam) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = stops[0][1];
      for (let i = 1; i < stops.length; i++) {
        const sy = stops[i][0];
        if (y >= sy + seam) { c = stops[i][1]; continue; }
        if (y >= sy - seam && bay(x, y) < (((y - sy + seam) * 16) / (2 * seam + 1) | 0)) c = stops[i][1];
        break;
      }
      r.set(x, y, c);
    }
  }

  // ---- sprites (palette codes; "." = transparent) ----
  const PORTER = [                                // protagonist-sized figure, facing right
    "................",
    "......zzzz......",
    ".....zllkkz.....",
    "....zlkkkkkz....",
    "..zzkkkkkkkkzz..",
    ".zbkkkkkkkkkkbz.",
    "..zzEEEEEEEEzz..",
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
  const GOOSE_UP = [                              // big white goose, neck up (walk), facing left
    "................",
    "...zzz..........",
    "..ztttz.........",
    ".zztzttz........",
    "zjjttttz........",
    ".zbzzttz........",
    "....zttz........",
    "....zttz........",
    "....zttz....zz..",
    "...zttttzzzzutz.",
    "...zttttttttuuz.",
    "...zttuuuuuuuvz.",
    "...zuuvvvvvvvz..",
    "....zzvvvvvzz...",
  ];
  const GOOSE_LEGS = [["......zjz.zjz...", ".....zjjz.zjjz.."], ["......zjzzjz....", ".....zjjzjjz...."]];
  // Chasing pose: the same goose with its neck stretched forward (head 3 px ahead of the body).
  const NECK_SHIFT = [0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3];
  const GOOSE_HONK = GOOSE_UP.map((row, j) => ".".repeat(NECK_SHIFT[j]) + row + ".".repeat(3 - NECK_SHIFT[j]));
  const DOG = [                                   // sitting farm dog, facing left (tail drawn separately)
    "................",
    "...zzzz.........",
    "..zFFFFz........",
    ".zFFzFFfz.......",
    "zzFFFFFffz......",
    "zcFFFFFffz......",
    ".zccFFFFz.......",
    "..zzcFFFz.......",
    "...zrrFFFz......",
    "...zcFFFFFz.....",
    "...zcFFFFFFz....",
    "...zcFFFFFFFz...",
    "...zcFzFFeFFz...",
    "...zcFzFeeFFz...",
    "...zcFzFeFFFz...",
    "...zzzzzzzzzz...",
  ];
  const DOG_TAIL = [                              // three wag poses, drawn under the body
    [[12, 10, "z"], [13, 9, "z"], [13, 10, "F"], [14, 8, "z"], [14, 9, "F"], [15, 7, "z"], [15, 8, "F"], [14, 10, "z"], [15, 9, "z"]],
    [[12, 10, "z"], [12, 9, "z"], [13, 10, "F"], [13, 9, "F"], [13, 8, "F"], [13, 7, "z"], [14, 8, "z"], [14, 9, "z"], [14, 10, "z"], [12, 8, "z"]],
    [[12, 11, "z"], [13, 11, "F"], [14, 11, "F"], [15, 10, "F"], [13, 10, "z"], [14, 10, "z"], [15, 9, "z"], [13, 12, "z"], [14, 12, "z"], [15, 11, "z"]],
  ];
  const FLY = [["cc.cc", "cczcc", ".c.c."], [".c.c.", "..z..", "..z.."]];
  // ---- static layers ----
  const CLOUDS = [
    { parts: [[10, 14, 7], [22, 9, 9], [36, 8, 10], [50, 12, 8], [60, 16, 5]], w: 68, h: 22, x: 18, y: 6 },
    { parts: [[8, 10, 6], [19, 7, 7], [30, 9, 6], [38, 11, 4]], w: 44, h: 16, x: 196, y: 24 },
  ];
  function cloudRows(c) {
    const inside = (x, y) => y < c.h - 1 && c.parts.some(([cx, cy, rr]) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rr * rr);
    const rows = [];
    for (let y = 0; y < c.h; y++) {
      let s = "";
      for (let x = 0; x < c.w; x++) s += !inside(x, y) ? "." : !inside(x - 1, y - 2) ? "t" : !inside(x, y + 2) ? "v" : "u";
      rows.push(s);
    }
    return rows;
  }
  const ridge = (x) => 82 + Math.round(4 * Math.sin(x / 41) + 2 * Math.sin(x / 15 + 1));
  const slope = (x) => 91 + Math.round(4 * Math.sin(x / 57 + 2) + 2 * Math.sin(x / 23));
  const HOUSE = { x: 238, y: 101, chimX: 250, chimY: 70 };

  function buildFar() {
    const r = layer();
    for (let x = 0; x < W; x++) {                 // hazy blue far ridge, sunlit green grass slopes in front
      const y1 = ridge(x), y2 = slope(x), up = slope(x - 1) > y2;
      for (let y = y1; y < y2; y++) r.set(x, y, y === y1 ? "u" : "v");
      for (let y = y2; y < HZ + 2; y++) {
        const k = y - y2;
        r.set(x, y, k === 0 || (k === 1 && up) ? "m" : k < 4 && bay(x, y) < (up ? 9 : 4) ? "m" : "n");
      }
    }
    const tree = (cx, by, rad) => {               // round orchard tree, lit from the upper left
      r.rect(cx - 1, by - 4, 2, 5, "f");
      for (let y = -rad; y <= rad; y++) for (let x = -rad - 1; x <= rad + 1; x++) {
        if (x * x * 0.8 + y * y > rad * rad + 1) continue;
        const lit = x + y < -rad * 0.6, shade = x + y > rad * 0.7;
        r.set(cx + x, by - 4 - rad + y, lit ? "n" : shade ? "p" : hash(cx + x, y, 3) % 5 ? "o" : "n");
      }
    };
    tree(206, slope(206) + 2, 6); tree(298, slope(298) + 1, 7); tree(14, slope(14) + 2, 5);
    // farmhouse: cream walls, red tiled roof, chimney (smoke is animated)
    const hx = HOUSE.x, hy = HOUSE.y;
    r.rect(hx + 4, hy - 14, 26, 14, "F"); r.rect(hx + 24, hy - 14, 10, 14, "e");
    for (let k = 0; k < 10; k++) {                // gable end in shade
      r.hline(hx + 24 + (k >> 1), hy - 15 - k, Math.max(0, 10 - k), "e");
    }
    for (let k = 0; k < 11; k++) {                // roof slope, tile rows
      const y = hy - 15 - k + 1, x0 = hx + 2 + (k >> 1), x1 = hx + 24 + (k >> 1);
      r.hline(x0, y - 1, x1 - x0, k === 0 ? "f" : k % 3 === 0 ? "h" : "a");
    }
    r.rect(HOUSE.chimX - 1, HOUSE.chimY, 4, 9, "f"); r.vline(HOUSE.chimX - 1, HOUSE.chimY, 9, "e");
    r.rect(hx + 8, hy - 10, 4, 4, "x"); r.set(hx + 9, hy - 9, "w");
    r.rect(hx + 18, hy - 10, 4, 4, "x"); r.set(hx + 19, hy - 9, "w");
    r.rect(hx + 13, hy - 8, 4, 8, "f");
    return r;
  }

  const ROWS = [100, 102, 104, 107, 110, 114, 118, 123, 129, 136, 144];   // wheat rows, wider towards the viewer
  function buildField() {
    const r = layer();
    for (let y = HZ; y < FLOOR; y++) {
      let b = 0; while (b + 1 < ROWS.length && ROWS[b + 1] <= y) b++;
      const k = y - ROWS[b], last = b + 1 < ROWS.length ? ROWS[b + 1] - 1 === y : false, near = y >= 123;
      for (let x = 0; x < W; x++) {
        let c = near ? "b" : "d";
        if (k === 0) {                                                                     // sunlit tops of each row
          const h = hash(x >> 1, b, 3);
          c = h % 3 ? (near ? "d" : h % 7 === 0 && b > 1 ? "k" : "c") : (near ? "b" : "d");
        }
        else if (last) c = y < 106 ? "F" : near ? "e" : "b";                               // shadow between rows
        else if (y >= 107 && hash(x, b, 5) % 3 === 0 && k > 1) c = near ? "e" : "F";      // stalk ticks
        if (y > 102 && y < 122 && hash(x, y, 8) % 89 === 0) c = "i";                       // far poppies
        r.set(x, y, c);
      }
    }
    // scarecrow in the wheat (hat, burlap head, patched shirt on a cross pole)
    const cx = 150;
    r.rect(cx, 92, 2, 36, "f"); r.vline(cx, 92, 36, "e");
    r.rect(cx - 16, 97, 33, 2, "f");
    r.rect(cx - 15, 95, 31, 5, "w"); r.hline(cx - 15, 99, 31, "x");
    r.rect(cx - 5, 95, 11, 18, "w"); r.rect(cx + 3, 95, 3, 18, "x"); r.rect(cx - 3, 101, 3, 3, "B");
    for (const [x, y] of [[-17, 95], [-18, 96], [-17, 97], [-18, 98], [16, 95], [17, 96], [16, 97], [17, 98]]) r.set(cx + x, y, (x + y) & 1 ? "c" : "d");
    for (const [x, y] of [[-4, 113], [-2, 114], [0, 113], [2, 114], [4, 113]]) r.set(cx + x, y, "d");
    r.rect(cx - 4, 86, 9, 9, "d"); r.rect(cx + 3, 86, 2, 9, "F");
    r.set(cx - 2, 89, "f"); r.set(cx + 2, 89, "f");
    for (let x = -2; x <= 2; x++) r.set(cx + x, 92, x & 1 ? "F" : "f");
    r.hline(cx - 7, 85, 15, "e"); r.hline(cx - 6, 84, 13, "b");
    r.rect(cx - 4, 79, 9, 5, "b"); r.rect(cx + 3, 79, 2, 5, "e"); r.hline(cx - 4, 83, 9, "h");
    return r;
  }

  function buildNear() {
    const r = layer();
    // haystack: straw dome on the left
    const hx = 28, rx = 24, ry = 32;
    for (let y = FLOOR - ry; y < FLOOR; y++) for (let x = hx - rx - 1; x <= hx + rx + 1; x++) {
      const dx = (x - hx) / rx, dy = (FLOOR - y) / ry, d = dx * dx + dy * dy;
      if (d > 1) continue;
      const light = -dx * 0.55 + dy * 0.85;
      let c = "d";
      if (d > 0.78 && light > 0.55) c = "c";
      else if (dx > 0.45 || dy < 0.12) c = dx > 0.75 || dy < 0.06 ? "e" : "F";
      if (c !== "c" && (x * 2 + y) % 7 === 0 && hash(x >> 2, y >> 3, 6) % 3) c = c === "d" ? "b" : "e";
      else if (c === "d" && (x * 2 + y) % 11 === 3 && light > 0.2) c = "c";
      r.set(x, y, c);
    }
    for (const [x, y] of [[20, 115], [24, 114], [31, 115], [36, 116]]) { r.set(x, y, "d"); r.set(x + 1, y - 1, "c"); }
    // wooden fence along the grass bank
    for (let x = BANK_X + 4; x < W; x += 13) {
      r.rect(x, BANK_Y - 13, 2, 13, "f"); r.vline(x, BANK_Y - 13, 13, "e"); r.set(x + 1, BANK_Y - 14, "f");
    }
    for (const y of [BANK_Y - 10, BANK_Y - 5]) { r.hline(BANK_X + 2, y, W - BANK_X - 2, "e"); r.hline(BANK_X + 2, y + 1, W - BANK_X - 2, "f"); }
    return r;
  }

  function earth(r, x, y, top) {                  // packed earth with blocks and a few pebbles
    const h = hash(x >> 2, (y - top) >> 1, 21);
    let c = (h % 7 === 0) ? "f" : (h % 11 === 0) ? "F" : "e";
    if (y - top > 16 && hash(x >> 3, y >> 2, 23) % 3 === 0) c = c === "F" ? "e" : "f";
    if (hash(x, y, 22) % 61 === 0) c = "v";
    r.set(x, y, c);
  }
  function buildGround() {
    const r = layer();
    for (let y = FLOOR; y < H; y++) for (let x = 0; x < BANK_X; x++) {
      const k = y - FLOOR;                        // dirt road: lit edge, dusty band, then earth
      if (k === 0) r.set(x, y, "d");
      else if (k < 4) r.set(x, y, hash(x, y, 9) % 9 === 0 ? "e" : "F");
      else earth(r, x, y, FLOOR);
    }
    for (let y = BANK_Y; y < H; y++) for (let x = BANK_X; x < W; x++) {
      const k = y - BANK_Y;                       // grass bank
      if (k === 0) r.set(x, y, "m");
      else if (k < 3) r.set(x, y, k === 1 || hash(x, y, 4) % 3 ? "n" : "o");
      else earth(r, x, y, BANK_Y);
    }
    r.vline(BANK_X, BANK_Y + 3, H - BANK_Y - 3, "F");
    for (let x = BANK_X; x < W; x++) {            // grass blades and poppies on the bank
      const h = hash(x, 1, 31) % 9;
      if (h < 3) r.set(x, BANK_Y - 1, h === 0 ? "m" : "n");
      if (h === 0 && hash(x, 2, 31) % 3 === 0) r.set(x, BANK_Y - 2, "n");
    }
    for (const x of [229, 268, 283, 311]) { r.set(x, BANK_Y - 1, "n"); r.set(x, BANK_Y - 2, "n"); r.set(x, BANK_Y - 3, "i"); r.set(x + 1, BANK_Y - 3, "h"); r.set(x, BANK_Y - 4, "i"); }
    for (let x = 0; x < BANK_X; x++) {            // grass tufts on the road edge
      const h = hash(x, 3, 33) % 13;
      if (h < 2 && (x < MUD_X0 - 3 || x > MUD_X1 + 2)) r.set(x, FLOOR - 1, "n");
    }
    for (const [x, y] of [[121, 149], [124, 150], [118, 151], [180, 149], [184, 150], [178, 151], [131, 147], [171, 147]]) r.set(x, y, "f");
    // mud: a soft, wet dip in the road (glossy top, darker puddles)
    for (let x = MUD_X0 - 2; x < MUD_X1 + 2; x++) {
      const edge = Math.min(x - (MUD_X0 - 2), MUD_X1 + 1 - x);
      const top = FLOOR + Math.min(2, edge), depth = 7 + (hash(x >> 2, 0, 41) % 2);
      for (let y = FLOOR; y < top; y++) r.set(x, y, "F");
      for (let y = top; y < FLOOR + depth; y++) {
        const k = y - top;
        let c = hash(x >> 1, y, 42) % 5 === 0 ? "g" : "f";
        if (k === 0) c = hash(x >> 2, 1, 43) % 3 === 0 ? "v" : hash(x, 1, 45) % 4 ? "e" : "f";   // wet shine
        else if (k === 1 && edge > 6 && hash(x >> 3, 2, 44) % 2 === 0) c = "x";                   // puddle
        else if (k === 2 && edge > 6 && hash(x >> 3, 2, 44) % 2 === 0) c = "g";
        r.set(x, y, c);
      }
      for (let y = FLOOR + depth; y < FLOOR + depth + 2; y++) r.set(x, y, hash(x, y, 46) % 2 ? "f" : "e");
    }
    return r;
  }

  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    const sky = layer();
    bands(sky, [[0, "r"], [64, "u"], [77, "c"]], 2);
    const props = layer();
    spr(props, CRATE, 96, FLOOR - 16);
    spr(props, CRATE, 240, BANK_Y - 16);
    spr(props, PORTER, 64, FLOOR - 16);
    const stalks = [];
    for (let x = 0; x < BANK_X + 2; x += 2) {
      const h = hash(x, 7, 11);
      stalks.push({ x: x + (h & 1), h: 9 + ((h >> 3) % 9), poppy: (h >> 9) % 17 === 0 });
    }
    L = { sky, far: buildFar(), field: buildField(), near: buildNear(), ground: buildGround(), props, stalks, clouds: CLOUDS.map(cloudRows) };
    const D = PB.DIM;
    L.SHADE = Object.assign({}, D, { c: "d", d: "F", F: "e" });       // cloud shadow: one step darker, stays warm
    L.GUST = { d: "c", F: "d", b: "d", e: "F", f: "e" };              // wheat bent by a gust shows its lit side
  }

  // ---- ambient (4 fps) ----
  const cloudX = (c, a) => ((c.x + c.w + 20 + (a >> 1)) % (W + c.w + 40)) - c.w - 20;
  function gustCentres(a) {                       // two gusts travelling left → right
    const span = W + 160, out = [];
    for (let k = 0; k < 2; k++) out.push(((a * 8 + k * 240) % span) - 80);
    return out;
  }
  function gustAt(x, cs) {
    let g = 0;
    for (const c of cs) { const d = x - c; if (d > -10 && d < 4) return 2; if (d > -34 && d < 12) g = 1; }
    return g;
  }
  function drawClouds(r, a) {
    CLOUDS.forEach((c, i) => spr(r, L.clouds[i], cloudX(c, a), c.y));
  }
  function drawSmoke(r, a) {                      // puffs rise from the chimney and lean with the wind
    for (let k = 0; k < 9; k++) {
      const age = (a + k * 5) % 45, y = HOUSE.chimY - 2 - age, x = HOUSE.chimX + ((age * age) / 70 | 0) + tri(age + k * 5, 12, 1);
      const rad = age < 8 ? 1 : age < 24 ? 2 : 3, c = age < 20 ? "u" : "v";
      if (age > 36 && (age + k) & 1) continue;    // thin out at the top
      for (let yy = -rad; yy <= rad; yy++) for (let xx = -rad; xx <= rad; xx++) {
        if (xx * xx + yy * yy > rad * rad) continue;
        if (age > 26 && bay(x + xx, y + yy) < 8) continue;
        r.set(x + xx, y + yy, yy < 0 && xx < 0 ? "u" : c);
      }
    }
  }
  function drawGustOnField(r, cs) {               // a brighter band rolls across the far and middle field
    for (const c of cs) {
      remap(r, c - 50, HZ, c + 30, 128, L.GUST, (x, y) => {
        const k = y - HZ, cx = c - (k * 0.5 | 0), hw = 3 + (k * 0.45 | 0);
        const d = Math.abs(x - cx);
        return d < hw * (0.4 + bay(x, y) / 24);
      });
    }
  }
  function drawStalks(r, cs, a) {                 // the near wheat, every stalk bends under a passing gust
    for (const s of L.stalks) {
      const g = gustAt(s.x, cs), sway = tri(a + (s.x >> 3), 16, 1) > 0 ? 1 : 0, lean = g + (g ? 0 : sway & (s.x >> 1));
      const top = FLOOR - 1 - s.h;
      for (let k = 0; k <= s.h; k++) {
        const y = FLOOR - 1 - k, x = s.x + ((lean * k) / s.h | 0);
        const head = k > s.h - 4;
        let c = head ? ((x & 1) ? "b" : "d") : k < 4 ? "f" : "e";
        if (g && head) c = L.GUST[c] || c;
        r.set(x, y, c);
        if (head) r.set(x + 1, y, g ? "d" : "b");
      }
      r.set(s.x + lean, top - 1, g ? "c" : "d");  // awn
      if (s.poppy) { r.set(s.x - 1 + lean, top + 2, "i"); r.set(s.x + lean, top + 2, "i"); r.set(s.x - 1 + lean, top + 3, "h"); }
    }
  }
  function drawCloudShadows(r, a) {
    CLOUDS.forEach((c) => {
      const sx = cloudX(c, a) + (c.w >> 1) + 40, sy = 124, rx = c.w * 0.7, ry = 10 + (c.h >> 1);
      remap(r, sx - rx - 1, sy - ry, sx + rx + 1, FLOOR, L.SHADE, (x, y) => {
        const dx = (x - sx) / rx, dy = (y - sy) / ry;
        return dx * dx + dy * dy < 0.8 + bay(x, y) / 80;
      });
    });
  }
  function drawButterflies(r, tick) {
    const list = [{ cx: 92, cy: 117, ax: 20, ay: 5, p: 0 }, { cx: 200, cy: 109, ax: 14, ay: 4, p: 37 }];
    for (const b of list) {
      const x = b.cx + tri(tick + b.p, 112, b.ax) + tri(tick * 3 + b.p, 46, 2), y = b.cy + tri(tick + b.p * 2, 40, b.ay);
      spr(r, FLY[((tick + b.p) >> 1) & 1], x - 2, y - 1, false, b.p ? { c: "u" } : null);
    }
  }
  function drawMudBubbles(r, a) {
    for (const [x, p] of [[136, 0], [151, 13], [165, 27]]) {
      const k = (a + p) % 36, y = FLOOR + 3;
      if (k < 4) r.set(x, y, "f");
      else if (k < 8) { r.set(x - 1, y, "e"); r.set(x + 1, y, "e"); r.set(x, y - 1, "e"); r.set(x, y, "f"); }
      else if (k === 8) { r.set(x - 2, y, "e"); r.set(x + 2, y, "e"); r.set(x, y - 2, "e"); }
    }
  }

  // ---- animals (8 fps) ----
  function drawDog(r, tick) {
    const x = 288, y = BANK_Y - 16, wag = [0, 1, 2, 1][tick & 3];
    for (const [px, py, c] of DOG_TAIL[wag]) r.set(x + px, y + py, c);
    spr(r, DOG, x, y);
    if (tick % 40 === 7) { r.set(x + 4, y + 3, "F"); r.hline(x + 3, y + 3, 3, "z"); }  // blink
  }
  function drawGoose(r, tick) {                   // walks two steps toward the player, stretches its neck and honks, walks back
    const p = tick % 64, x0 = 206, y = FLOOR - 14;
    let x, flip = false;
    if (p < 24) x = x0 - p;
    else if (p < 40) x = x0 - 24;
    else { x = x0 - 24 + (p - 40); flip = true; }
    if (p >= 24 && p < 40) {                      // honk: neck forward, beak opens every other beat
      spr(r, GOOSE_HONK, x - 3, y);
      spr(r, GOOSE_LEGS[0], x, y + 12);
      if (tick & 2) { r.set(x - 3, y + 3, "j"); r.set(x - 2, y + 3, "j"); r.set(x - 3, y + 4, "z"); r.set(x - 2, y + 4, "z"); r.set(x - 2, y + 5, "j"); }
    } else {
      spr(r, GOOSE_UP, x, y, flip);
      spr(r, GOOSE_LEGS[(tick >> 1) & 1], x, y + 12, flip);
    }
  }

  window.PB_CONCEPT_SCENES["countryside"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer(), cs = gustCentres(a);
      r.data.set(L.sky.data);
      drawClouds(r, a);
      r.blit(L.far, 0, 0);
      drawSmoke(r, a);
      r.blit(L.field, 0, 0);
      drawGustOnField(r, cs);
      drawStalks(r, cs, a);
      r.blit(L.near, 0, 0);
      drawCloudShadows(r, a);
      drawButterflies(r, tick);
      r.blit(L.ground, 0, 0);
      drawMudBubbles(r, a);
      drawDog(r, tick);
      drawGoose(r, tick);
      r.blit(L.props, 0, 0);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
