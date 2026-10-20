/* ART-04n 地图概念场景 · 盐晶矿城（salt_mine）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180 侧视，只用 ENDESGA 32，整数像素，不抗锯齿、不混色。
 * 地下无昼夜：灰白和浅粉的盐岩层、深褐木支架；矿工油灯的琥珀光照亮盐壁，被盐晶折成一圈圈细小的彩光。
 * 地标：盐晶吊灯、深褐木头搭的井字支架、地下盐水湖（不画盐雕桌椅）。
 * 机关外观（不实现规则）：夹着盐粒的夯土块（dig）、空的大件拖橇（carry_bulky）、压板和木框里的铁门（plate_door）。
 * 环境（4 fps，tick >> 1）：盐水从岩缝渗出，在湖边和水痕上结出一朵朵盐花；油灯摇晃，盐壁上的彩光圈跟着游动；偶尔落下盐粒。
 * 动物（8 fps）：盐傀儡（怪物，一块会走的盐坨，慢吞吞来回挡路）、矿坑小马（提示动物，拉着空车停下甩鬃毛）。
 * 比例尺：主角大小的人影 + 1 个木箱，站着不动。不画收件人、货物、界面和文字。
 * 只读使用 workbench/js/core/raster.js 的 PB.Raster / PB.h32 / PB.RGB / PB.CODES。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4 (20 × 11 tiles)
  const FLOOR = OY + 9 * 16;                      // 148: top of the hall floor
  const LEDGE_Y = OY + 7 * 16, LEDGE_X = 6 * 16;  // upper track ledge: x < 96, top y = 116
  const DIG_X = 6 * 16;                           // two diggable blocks against the ledge (x 96–111, y 116–147)
  const LAKE_Y = 126, GROTTO_X = 228;             // brine lake surface inside the grotto on the right
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null, REV = null;

  const hash = (x, y, s) => PB.h32(x, y, s);
  const layer = () => new PB.Raster(W, H);
  function tri(t, period, amp) {                  // integer triangle wave in [-amp, amp]
    const p = ((t % period) + period) % period, half = period >> 1;
    return Math.floor(((p < half ? p : period - p) * 4 * amp) / period) - amp;
  }
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
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
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
  function line(r, x0, y0, x1, y1, pick) {        // Bresenham; pick(k) gives the colour of the k-th pixel
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, k = 0;
    for (;;) {
      r.set(x0, y0, typeof pick === "function" ? pick(k++) : pick);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // Light a disc of background pixels one step along a ramp; wide Bayer-dithered rim, never a blend.
  function glow(r, cx, cy, rad, map, ry) {
    const k = ry || 1;
    remap(r, cx - rad - 1, cy - rad * k - 1, cx + rad + 2, cy + rad * k + 2, map, (x, y) => {
      const dx = x - cx, dy = (y - cy) / k, d = dx * dx + dy * dy;
      return d < rad * rad * (0.42 + bay(x, y) / 26);
    });
  }

  // ---- palette roles ----
  // Lamp light on the dark salt wall (background only): grey strata lift one or two steps towards w,
  // the dusky pink strata towards warm brown f / e. Both stay below v, the mid-tone of the salt-rock
  // terrain, so the lit wall never outshines the floor; the colour comes from the small halo dots.
  const LAMP = { z: "y", y: "x", x: "w", g: "f", B: "f", p: "o" };   // amber lamp light on the dark salt wall
  const LAMP_IN = { y: "x", x: "w", f: "e" };
  const DEEP = { y: "z", x: "y", w: "x", g: "z", f: "g", B: "g", C: "B", F: "f", v: "w" };   // grotto depth / wet rock

  // ---- sprites (palette codes; "." = transparent) ----
  const pad = (rows, w) => rows.map((s) => (s + ".".repeat(w)).slice(0, w));
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
  const DOOR = (() => {                           // iron door 16×32: vertical bars, two riveted straps
    const rows = [];
    for (let j = 0; j < 32; j++) {
      let s = "";
      for (let i = 0; i < 16; i++) {
        if (i === 0 || j === 0 || i === 15 || j === 31) s += "z";
        else if (j === 1) s += "v";
        else if (i === 14 || j === 30) s += "x";
        else if (j === 8 || j === 23) s += (i % 3 === 2) ? "u" : "v";
        else if (j === 9 || j === 24) s += "x";
        else if (i === 1) s += "v";
        else s += (i - 2) % 3 === 0 ? "v" : (i - 2) % 3 === 1 ? "w" : "x";
      }
      rows.push(s);
    }
    return rows;
  })();
  const PLATE = [                                 // pressure plate with the pink triangle of its door
    ".zzzzzzzzzzzzzz.",
    "zvvvvvvvvvvvvvvz",
    "zwwwwwwDwwwwwwxz",
    "zwwwwwDDDwwwwwxz",
    "zzzzzzzzzzzzzzzz",
  ];
  const PLAQUE = ["zzzzzzz", "zxxDxxz", "zxDDDxz", "zDDDDDz", "zzzzzzz"];
  const LAMP_SPR = [                              // miner's oil lamp on a hook
    "...x...",
    "..xwx..",
    ".xwvwx.",
    ".xbjbx.",
    ".xjkjx.",
    ".xbjbx.",
    ".xwwwx.",
    "..xxx..",
  ];
  const PONY = pad([                              // pit pony, facing right: chestnut coat, flaxen mane, collar
    ".................zz...",
    "................zez...",
    "..............zzcezz..",
    ".............zccceeez.",
    "............zcccezeeez",
    "...........zcccxeeeeFz",
    "...zzzzzzzzcccxeeeeFFz",
    "..zeeeeeeeeccxxeeezzz.",
    ".zeeeeeeeeeeexeeeez...",
    ".zeeeeeeeeeeeeeeefz...",
    ".zeeeeeeeeeeeeeeffz...",
    "..zfeeeeeeeeeeeffz....",
    "..zfezzffzzzzefzfz....",
    "..zfz.zfz...zfz.zfz...",
    "..zfz.zfz...zfz.zfz...",
    "..zgz.zgz...zgz.zgz...",
  ], 22);
  const PONY_TAIL = [                             // flaxen tail, three swish poses (drawn left of the rump)
    [[1, 7, "z"], [0, 8, "z"], [0, 9, "c"], [1, 8, "c"], [0, 10, "c"], [0, 11, "d"], [1, 12, "d"], [-1, 9, "z"], [-1, 10, "z"], [-1, 11, "z"], [0, 12, "z"], [1, 13, "z"]],
    [[1, 7, "z"], [0, 7, "z"], [-1, 8, "z"], [0, 8, "c"], [-1, 9, "c"], [-2, 9, "z"], [-2, 10, "c"], [-3, 10, "z"], [-2, 11, "d"], [-3, 11, "z"], [-1, 10, "z"], [-1, 11, "z"], [-2, 12, "z"]],
    [[1, 7, "z"], [0, 8, "z"], [1, 8, "c"], [1, 9, "c"], [0, 9, "z"], [1, 10, "d"], [0, 10, "z"], [2, 11, "d"], [1, 11, "z"], [2, 12, "z"], [3, 11, "z"]],
  ];
  // mane poses while the pony shakes its head: strands thrown up or back
  const MANE_SHAKE = [
    [[12, 4, "c"], [11, 5, "c"], [10, 6, "c"], [11, 3, "z"], [10, 4, "z"], [9, 5, "z"], [9, 6, "z"], [12, 3, "z"], [13, 2, "z"], [14, 1, "z"], [14, 2, "c"], [13, 3, "c"]],
    [[14, 1, "z"], [13, 1, "z"], [12, 2, "z"], [11, 3, "z"], [12, 3, "c"], [13, 2, "c"], [11, 4, "c"], [10, 4, "z"], [10, 5, "c"], [9, 5, "z"], [9, 6, "c"], [8, 6, "z"]],
  ];
  const CART = pad([                              // empty iron mine tub, two of its wheels seen
    "zzzzzzzzzzzzzzzzzzzz",
    "zvvvvvvvvvvvvvvvvvvz",
    "zyyyyyyyyyyyyyyyyyyz",
    ".zwwwwwwwwwwwwwwwxz.",
    ".zwvwwwwwwwwwwwvwxz.",
    ".zwwwwwwwwwwwwwwwxz.",
    "..zwwwwwwwwwwwwwxz..",
    "..zxxxxxxxxxxxxxxz..",
    "..zzzzzzzzzzzzzzzz..",
    "...zxxz......zxxz...",
    "..zxvvxz....zxvvxz..",
    "..zxvxxz....zxvxxz..",
    "...zxxz......zxxz...",
  ], 20);
  const GOLEM = pad([                             // salt golem: a squat, faceted lump of rock salt, facing left
    "........zz.zz...",
    ".......zuvzuvz..",
    ".....zzzvwzvwzz.",
    "....zuuuuuuvvwz.",
    "...zuuEuuuuvvvwz",
    "..zuuEuuuuuvvvwz",
    "..zuuuuuuuvvvwwz",
    ".zuzkzzuzkzvvwwz",
    ".zuzzzuuzzzvvwwz",
    ".zuuuuuuuuvvvwwz",
    "zvuuuuuuuvvvvwwz",
    "zvvuEEuuvvvvwwxz",
    "zvvvuuvvvvvwwwxz",
    ".zvvvvvvvvwwwxz.",
    "..zzzzzzzzzzzz..",
  ], 16);
  const GOLEM_LEGS = [["...zwwz..zwwz...", "...zzzz..zzzz..."], ["....zwwzzwwz....", "....zzzzzzzz...."], ["..zwwz....zwwz..", "..zzzz....zzzz.."]];
  const SLEDGE = pad([                            // empty sledge for bulky loads: slatted deck on an upturned runner
    "zz............................",
    "zez...........................",
    ".zez..........................",
    "..zzzzzzzzzzzzzzzzzzzzzzzzzzz.",
    "..zdddddddddddddddddddddddddez",
    "..zbbebbbbebbbbebbbbebbbbebbfz",
    "..zzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    "...zez.......zez.......zez.zez",
    "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    "zeffffffffffffffffffffffffffez",
    ".zzzzzzzzzzzzzzzzzzzzzzzzzzzz.",
  ], 30);

  // ---- static layers ----
  const ceilY = (x) => 11 + Math.round(3 * Math.sin(x / 23) + 2 * Math.sin(x / 9 + 2));
  function wallCode(x, y) {                       // dark rock-salt strata: grey bands and dusky pink bands, low contrast
    const sy = y + 3 * Math.sin(x / 37) + 2 * Math.sin(x / 15 + y / 50);
    const band = Math.floor(sy / 4), kind = hash(band, 0, 51) % 8;
    let c = kind < 4 ? "y" : kind < 6 ? "x" : "g";
    if (hash(x >> 1, y, 5) % 23 === 0) c = c === "y" ? "x" : "y";            // salt crystal flecks
    return c;
  }
  function grottoTop(x) {                         // arched opening of the lake grotto (x ≥ GROTTO_X)
    const t = Math.min(1, (x - GROTTO_X) / 40);
    return Math.round(70 + 30 * (1 - Math.sqrt(1 - (1 - t) * (1 - t))) + 2 * Math.sin(x / 7));
  }
  const SEEP = { x: 292, y: 86 };                 // crack outlet on the grotto's back wall
  const seepX = (y) => SEEP.x + ((y - SEEP.y) > 14 ? -1 : 0) + ((y - SEEP.y) > 28 ? 1 : 0);

  function buildBack() {
    const r = layer();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) r.set(x, y, wallCode(x, y));
    // the lake grotto: darker inside, a lighter lip around the arch
    for (let x = GROTTO_X; x < W; x++) {
      const top = grottoTop(x);
      for (let y = top; y < H; y++) { const c = codeAt(r, x, y); r.set(x, y, DEEP[c] || c); }
      r.set(x, top - 1, "w"); r.set(x, top - 2, hash(x, 1, 9) % 3 ? "x" : "w");
    }
    for (let y = grottoTop(GROTTO_X); y < LAKE_Y; y++) { r.set(GROTTO_X, y, "w"); r.set(GROTTO_X + 1, y, "x"); }
    // brine lake: still dark teal water, a dull surface line, salt crust on the shores
    for (let y = LAKE_Y; y < H; y++) for (let x = GROTTO_X + 4; x < W; x++) {
      const k = y - LAKE_Y;
      let c = k === 0 ? "w" : k < 3 ? "p" : (hash(x >> 3, y, 13) % 9 === 0 ? "o" : k > 10 ? "z" : "p");
      if (k > 0 && k < 12 && hash(x >> 2, y >> 1, 14) % 17 === 0) c = "x";
      r.set(x, y, c);
    }
    for (let k = 0; k < 8; k++) {                 // sloping salt crust on the near shore of the lake
      r.hline(GROTTO_X, LAKE_Y - 3 + k, 4 + k, k === 0 ? "v" : k < 3 ? "w" : "x");
      r.set(GROTTO_X + 3 + k, LAKE_Y - 3 + k, "v");
    }
    // the seeping crack and its dark wet streak down to the lake
    for (let y = SEEP.y - 12; y < SEEP.y; y++) r.set(SEEP.x + ((y >> 2) & 1) - 1, y, "z");
    for (let y = SEEP.y; y < LAKE_Y; y++) {
      const x = seepX(y);
      for (let dx = -1; dx <= 1; dx++) { const c = codeAt(r, x + dx, y); r.set(x + dx, y, DEEP[c] || c); }
    }
    r.hline(SEEP.x - 2, SEEP.y - 1, 5, "y"); r.set(SEEP.x - 1, SEEP.y, "z"); r.set(SEEP.x, SEEP.y, "z");
    // static candle light of the chandelier on the wall around it
    glow(r, 176, 34, 34, LAMP, 0.75);
    glow(r, 176, 30, 13, LAMP_IN, 0.75);
    drawChandelier(r);
    return r;
  }
  function drawChandelier(r) {                    // salt-crystal chandelier: chain, three rings of crystal drops, candles
    const cx = 176;
    for (let y = ceilY(cx) + 1; y < 20; y++) r.set(cx, y, (y & 1) ? "w" : "v");
    r.hline(cx - 1, 20, 3, "v"); r.hline(cx - 2, 21, 5, "w");
    for (let y = 22; y < 47; y++) r.set(cx, y, y % 3 === 0 ? "v" : "w");       // stem of threaded crystals
    const ring = (ty, rx, len, candles) => {       // a ring seen slightly from below; drops hang from its front half
      for (let i = -rx; i <= rx; i++) {
        const dy = Math.round(2 * Math.sqrt(Math.max(0, 1 - (i * i) / (rx * rx))));
        r.set(cx + i, ty - dy, "w");               // back of the ring
        r.set(cx + i, ty + dy, "v");               // front of the ring
        if ((i + rx) % 2 === 0 && Math.abs(i) < rx) {
          const n = len - Math.round((Math.abs(i) * (len - 2)) / rx);
          for (let k = 1; k <= n; k++) r.set(cx + i, ty + dy + k, k === n || !(k & 1) ? "v" : "w");
        }
      }
      for (const i of candles) {                   // wax stubs on the ring, small amber flames
        const dy = Math.round(2 * Math.sqrt(Math.max(0, 1 - (i * i) / (rx * rx))));
        r.set(cx + i, ty - dy - 1, "F"); r.set(cx + i, ty - dy - 2, "F"); r.set(cx + i, ty - dy - 3, "j");
      }
    };
    line(r, cx, 23, cx - 7, 26, "w"); line(r, cx, 23, cx + 7, 26, "w");
    line(r, cx, 30, cx - 15, 34, "w"); line(r, cx, 30, cx + 15, 34, "w");
    line(r, cx, 40, cx - 10, 43, "w"); line(r, cx, 40, cx + 10, 43, "w");
    ring(26, 7, 4, [-7, 7]); ring(34, 15, 7, [-15, -8, 8, 15]); ring(43, 10, 6, [-10, 10]);
    for (let k = 0; k < 6; k++) r.set(cx, 47 + k, k & 1 && k !== 5 ? "w" : "v");   // the long middle drop
    r.set(cx - 1, 51, "w"); r.set(cx + 1, 51, "w");
  }

  function buildMid() {                           // timber behind the play plane: the 井 frame and the door frame
    const r = layer();
    const beam = (x, y, w, h) => {                // dark brown timber, lit on the top/left edge
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        const top = yy === y, left = xx === x, right = xx === x + w - 1, bot = yy === y + h - 1;
        const c = top || left ? "e" : right || bot ? "g" : hash(w > h ? xx >> 2 : xx, w > h ? yy : yy >> 2, 3) % 6 === 0 ? "g" : "f";
        r.set(xx, yy, c);
      }
    };
    // 井字支架 over the track ledge: two posts, two crossing caps with protruding ends
    const P1 = 12, P2 = 74, B1 = 40, B2 = 52;
    beam(P1, ceilY(P1) - 2, 4, LEDGE_Y - ceilY(P1) + 2);
    beam(P2, ceilY(P2) - 2, 4, LEDGE_Y - ceilY(P2) + 2);
    beam(3, B1, 84, 4); beam(3, B2, 84, 4);
    for (const [x, y] of [[3, B1], [86, B1], [3, B2], [86, B2]]) { r.set(x, y + 1, "F"); r.set(x, y + 2, "e"); }
    for (const x of [P1, P2]) { r.set(x + 1, B1 - 1, "g"); r.set(x + 2, B2 + 4, "g"); }   // pegs
    // timber door frame around the iron door (x 208–223), with a header board for the symbol plaque
    beam(204, 104, 4, FLOOR - 104); beam(224, 104, 4, FLOOR - 104);
    beam(199, 103, 34, 4);
    beam(208, 107, 16, 9);
    spr(r, PLAQUE, 212, 109);
    return r;
  }

  // Terrain rock salt: stepped strata of uneven thickness, grey-white with a few pale pink layers and the odd
  // joint; each layer lit along its top and shaded along its bottom; a few cubic crystal faces.
  const STRATA = [
    { base: "v", lite: "u", shade: "w" }, { base: "v", lite: "u", shade: "w" }, { base: "E", lite: "E", shade: "F" },
    { base: "v", lite: "u", shade: "w" }, { base: "w", lite: "v", shade: "x" }, { base: "E", lite: "E", shade: "F" },
    { base: "v", lite: "u", shade: "w" },
  ];
  const DARK = 4;
  let BANDS = null;                               // sy → [band, row in band, band height], built on first use
  function makeBands() {
    const out = []; let b = 0, y = -12;
    while (y < H + 12) { const hgt = 4 + hash(b, 9, 73) % 6; for (let i = 0; i < hgt; i++) out.push([b, i, hgt]); y += hgt; b++; }
    return out;
  }
  function saltRock(r, x, y, top) {
    const k = y - top;
    if (k === 0) { r.set(x, y, hash(x, y, 2) % 6 ? "u" : "v"); return; }
    const seg = Math.floor((x + 3) / 9), sy = y + (hash(seg, 0, 70) % 3) - 1;
    if (!BANDS) BANDS = makeBands();
    const [band, f, hgt] = BANDS[sy + 12];
    let s = STRATA[hash(band, 3, 63) % STRATA.length];
    if (k > 20 && s.base !== "E") s = STRATA[DARK];                              // deeper rock is darker grey
    let c = f === 0 ? s.lite : f === hgt - 1 ? s.shade : s.base;
    const jo = hash(band, 5, 71) % 29, jw = (x + jo) % 29;
    if (jw === 0 && hash((x + jo) / 29 | 0, band, 72) % 4 === 0 && f < hgt - 1) c = s.shade;   // the odd joint
    const gx = Math.floor(x / 11), gy = Math.floor(y / 8), h = hash(gx, gy, 64);
    if (h % 4 === 0) {                                                        // a cubic halite crystal face
      const sz = 3 + (h >>> 4) % 2, x0 = gx * 11 + 1 + (h >>> 6) % 6, y0 = gy * 8 + 1 + (h >>> 9) % 3;
      const i = x - x0, j = y - y0;
      if (i >= 0 && j >= 0 && i < sz && j < sz) c = i === 0 || j === 0 ? s.lite : i === sz - 1 || j === sz - 1 ? s.shade : s.base;
    }
    if (k === 1 && (c === s.shade || c === "x")) c = s.base;
    r.set(x, y, c);
  }
  function packedEarth(r, x0, y0) {               // diggable 夯土 with lumps of pink rock salt in it
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const x = x0 + i, y = y0 + j, h = hash(x >> 2, y >> 1, 21);
      let c = h % 7 === 0 ? "f" : h % 11 === 0 ? "F" : "e";
      if (j === 8 + (hash(x >> 2, y0, 22) % 3) - 1 && hash(x >> 1, y0, 25) % 3) c = "f";   // one rough tamping seam
      if (hash(x, y, 23) % 31 === 0) c = "v";                                   // pebbles
      if (hash(x >> 1, y >> 1, 24) % 23 === 0) c = "E";                          // salt lumps
      if (j === 0) c = "F"; else if (j === 15 || i === 15) c = "g"; else if (i === 0 && c === "e") c = "F";
      r.set(x, y, c);
    }
  }
  function buildGround() {
    const r = layer();
    for (let x = 0; x < W; x++) {                 // ceiling with small salt drips
      const cy = ceilY(x);
      for (let y = 0; y <= cy; y++) saltRock(r, x, y, -1);
      r.set(x, cy, "w");
      const h = hash(x, 0, 31) % 19;
      if (h < 3) for (let k = 1; k <= 2 + h; k++) r.set(x, cy + k, k === 2 + h ? "u" : "v");
    }
    for (let y = LEDGE_Y; y < FLOOR; y++) for (let x = 0; x < LEDGE_X; x++) saltRock(r, x, y, LEDGE_Y);
    for (let y = LEDGE_Y + 1; y < FLOOR; y++) r.set(LEDGE_X - 1, y, "w");
    for (let y = FLOOR; y < H; y++) for (let x = 0; x < W; x++) saltRock(r, x, y, FLOOR);
    // rails on the ledge: sleepers, one rail, a wooden buffer stop at the end of the track
    for (let x = 0; x < LEDGE_X - 8; x++) { r.set(x, LEDGE_Y - 2, "v"); r.set(x, LEDGE_Y - 1, x % 6 < 3 ? "f" : "x"); }
    for (let y = LEDGE_Y - 8; y < LEDGE_Y; y++) r.hline(LEDGE_X - 10, y, 6, y === LEDGE_Y - 8 ? "e" : y > LEDGE_Y - 3 ? "g" : "f");
    r.vline(LEDGE_X - 10, LEDGE_Y - 7, 7, "e");
    packedEarth(r, DIG_X, LEDGE_Y); packedEarth(r, DIG_X, LEDGE_Y + 16);
    for (const [x, y] of [[113, 147], [114, 146], [117, 147], [92, 115]]) r.set(x, y, "f");   // a few dug crumbs
    return r;
  }

  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    const props = layer();
    spr(props, SLEDGE, 129, FLOOR - 11);
    spr(props, PORTER, 112, FLOOR - 16);
    spr(props, CRATE, 160, FLOOR - 16);
    spr(props, PLATE, 176, FLOOR - 5);
    spr(props, DOOR, 208, FLOOR - 32);
    L = { back: buildBack(), mid: buildMid(), ground: buildGround(), props };
  }

  // ---- ambient (4 fps) ----
  const LAMPS = [{ px: 48, py: 56, len: 8, ph: 0 }, { px: 262, py: ceilY(262) + 1, len: 30, ph: 7 }];
  function lampPos(l, a) {                        // a pendulum: the lamp swings a few pixels around its hook
    const s = Math.sin(((a + l.ph) * 2 * Math.PI) / 18);
    return { x: l.px + Math.round(s * (l.len > 12 ? 4 : 2)), y: l.py + l.len - (Math.abs(s) > 0.8 ? 1 : 0) };
  }
  // Rainbow halo: dotted rings of tiny spectral lights on the salt wall, warm inside, cool outside.
  // They ride on the lamp's light, so when the lamp swings the rings slide (twice as far) and turn.
  const HALO = [{ R: 11, step: 3, spec: ["j", "b", "a"] }, { R: 17, step: 3, spec: ["i", "j", "b", "n", "r", "C"] }, { R: 23, step: 4, spec: ["h", "a", "n", "q", "B"] }];
  const LIT = { x: 1, w: 1, f: 1, e: 1 };
  function drawLampLight(r, a) {
    for (const l of LAMPS) {
      const p = lampPos(l, a), cy = p.y + 4, off = (p.x - l.px) * 2;
      glow(r, p.x, cy, 30, LAMP, 0.85);
      glow(r, p.x, cy, 14, LAMP_IN, 0.85);
      HALO.forEach((h, ring) => {
        const n = Math.round((2 * Math.PI * h.R) / h.step), rot = (a + l.ph) * 0.03 * (ring & 1 ? -1 : 1) + off * 0.06;
        for (let i = 0; i < n; i++) {
          if (hash(i, ring, l.ph) % 7 === 0) continue;                           // a few gaps, never a hard circle
          const ang = (i / n) * 2 * Math.PI + rot;
          const x = p.x + off + Math.round(Math.cos(ang) * h.R), y = cy + Math.round(Math.sin(ang) * h.R * 0.8);
          if (LIT[codeAt(r, x, y)]) r.set(x, y, h.spec[Math.floor((i * h.spec.length * 2) / n) % h.spec.length]);   // colours in arcs
        }
      });
    }
  }
  function drawLamps(r, a) {
    for (const l of LAMPS) {
      const p = lampPos(l, a);
      line(r, l.px, l.py, p.x, p.y - 1, (k) => (k & 1 ? "x" : "w"));
      spr(r, LAMP_SPR, p.x - 3, p.y);
    }
  }
  // brine drops creeping down the wet streak; each one that reaches the lake rings the surface
  function drawSeep(r, a) {
    for (let k = 0; k < 2; k++) {
      const t = (a + k * 30) % 60, y = SEEP.y + Math.floor(t * (LAKE_Y - SEEP.y) / 48);
      if (t < 48) { r.set(seepX(y), y, "v"); r.set(seepX(y), y - 1, "w"); }
      else if (t < 52) { const w = t - 48; r.set(seepX(LAKE_Y) - 1 - w, LAKE_Y, "v"); r.set(seepX(LAKE_Y) + 1 + w, LAKE_Y, "v"); }
    }
  }
  // Salt flowers grow one by one along the lake edge and the wet streak, then crumble back into brine.
  const FLOWERS = [
    [SEEP.x - 3, SEEP.y + 1, 0], [SEEP.x + 2, SEEP.y + 3, 37], [SEEP.x - 2, SEEP.y + 17, 14], [SEEP.x + 2, SEEP.y + 29, 61],
    [GROTTO_X + 12, LAKE_Y - 1, 22], [246, LAKE_Y - 1, 49], [262, LAKE_Y - 1, 5], [278, LAKE_Y - 1, 70],
    [304, LAKE_Y - 1, 31], [314, LAKE_Y - 1, 83],
  ];
  const BLOOM = [                                 // growth stages of one salt flower (offsets from its root)
    [],
    [[0, 0, "w"]],
    [[0, 0, "v"], [-1, 0, "w"], [1, 0, "w"], [0, -1, "w"]],
    [[0, 0, "v"], [-1, 0, "v"], [1, 0, "w"], [0, -1, "v"], [-2, 0, "w"], [2, 0, "x"], [0, -2, "w"], [-1, -1, "w"], [1, -1, "x"]],
    [[0, 0, "v"], [-1, 0, "v"], [1, 0, "v"], [0, -1, "v"], [-2, 0, "w"], [2, 0, "w"], [0, -2, "v"], [-1, -1, "v"], [1, -1, "w"],
      [-3, 0, "x"], [3, 0, "x"], [-2, -1, "w"], [2, -1, "x"], [-1, -2, "w"], [1, -2, "w"], [0, -3, "w"]],
  ];
  function drawFlowers(r, a) {
    for (const [x, y, ph] of FLOWERS) {
      const t = (a + ph) % 96;
      const st = t < 14 ? 0 : t < 26 ? 1 : t < 40 ? 2 : t < 58 ? 3 : t < 88 ? 4 : t < 92 ? 2 : 0;
      for (const [dx, dy, c] of BLOOM[st]) r.set(x + dx, y + dy, c);
    }
  }
  function drawGrains(r, a) {                     // now and then a few salt grains trickle from the ceiling
    const SITES = [150, 236, 120, 300], ev = (a / 22) | 0, f = a % 22, x0 = SITES[ev % SITES.length];
    const bottom = x0 >= GROTTO_X + 4 ? LAKE_Y : FLOOR;
    for (let g = 0; g < 4; g++) {
      const t = f - g * 2;
      if (t < 0) continue;
      const y = ceilY(x0) + 2 + t * 3 + ((t * t) >> 2);
      if (y >= bottom - 1) continue;
      r.set(x0 + (g === 1 ? 1 : g === 3 ? -1 : 0), y, g & 1 ? "w" : "v");
    }
  }

  // ---- animals (8 fps) ----
  function drawPony(r, tick) {                    // stands with the empty cart; every few seconds shakes its mane
    const x = 50, y = LEDGE_Y - 16, p = tick % 40, shaking = p >= 28;
    spr(r, CART, 22, LEDGE_Y - 14);
    r.hline(42, y + 7, 9, "f"); r.hline(42, y + 9, 4, "f");                    // traces to the cart
    const swish = shaking ? 0 : [0, 0, 1, 1, 2, 2, 1, 1][(tick >> 1) & 7];
    spr(r, PONY, x, y);
    for (const [px, py, c] of PONY_TAIL[swish]) r.set(x + px, y + py, c);
    if (shaking) {
      const k = (tick >> 1) & 1;
      for (const [px, py, c] of MANE_SHAKE[k]) r.set(x + px, y + py, c);
      if (k) { r.set(x + 21, y + 4, "z"); r.set(x + 21, y + 5, "z"); }
    }
    if (tick % 56 === 3) r.set(x + 17, y + 4, "e");                           // blink
  }
  function drawGolem(r, tick) {                   // shuffles left and right in front of the lake, very slowly
    const span = 34, p = (tick >> 2) % (span * 2 + 16);
    let x, flip;
    if (p < span) { x = 298 - p; flip = false; }
    else if (p < span + 8) { x = 298 - span; flip = false; }
    else if (p < span * 2 + 8) { x = 298 - span + (p - span - 8); flip = true; }
    else { x = 298; flip = true; }
    const still = (p >= span && p < span + 8) || p >= span * 2 + 8;
    const step = still ? 0 : 1 + ((tick >> 2) & 1), bob = step === 1 ? 1 : 0;
    spr(r, GOLEM, x, FLOOR - 16 + bob, flip);
    spr(r, GOLEM_LEGS[step], x, FLOOR - 3, flip);
  }

  window.PB_CONCEPT_SCENES["salt_mine"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      r.data.set(L.back.data);
      drawLampLight(r, a);
      drawSeep(r, a);
      drawFlowers(r, a);
      r.blit(L.mid, 0, 0);
      drawLamps(r, a);
      drawGrains(r, a);
      r.blit(L.ground, 0, 0);
      drawGolem(r, tick);
      drawPony(r, tick);
      r.blit(L.props, 0, 0);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
