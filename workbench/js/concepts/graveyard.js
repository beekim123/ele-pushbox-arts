/* ART-04k 地图概念场景 · 墓园鬼镇（graveyard）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 地标：歪斜的墓碑和十字铁栅栏、尖顶的小教堂、南瓜灯、枯树上的乌鸦。满月深夜，冷蓝灰的雾，童话式可爱，不血腥。
 * 机关外观：黑暗（darkness，只有南瓜灯照到的地方看得清）、冷气下沉（gas_sink，雾积在低洼的坑里）。
 * 环境（4 fps）：贴地浓雾慢慢流动、往坑里沉；南瓜灯的光一跳一跳；满月偶尔被云遮住；蝙蝠飞过月亮。
 * 动物（8 fps）：僵尸（怪物，慢吞吞地走）、乌鸦（提示动物，歪头叫）。
 * 比例尺：主角大小的人影 + 1 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4 (20 × 11 tiles)
  const FLOOR = OY + 9 * 16;                      // 148: graveyard ground
  const LEDGE_X1 = 3 * 16, LEDGE_Y = OY + 7 * 16; // stone ledge on the left: x < 48, top y = 116
  const PIT_X0 = 9 * 16, PIT_X1 = 12 * 16, PIT_Y = OY + 10 * 16;  // sunken pit where cold fog pools: x 144–191, floor y = 164
  const MOON = { x: 86, y: 38, r: 15 };
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
  const ZOMBIE = [                                // cute shuffling zombie, arms forward, facing left (legs drawn separately)
    "................",
    "......zzzzz.....",
    ".....znnnnnz....",
    "....znmnnnnnz...",
    "....zttnttnnz...",
    "....ztzntznnz...",
    "....znnnnnnnz...",
    ".....znzzznz....",
    ".zzzzzBBBBBz....",
    "zmnnnnBBBBBBz...",
    ".zzzzzBBCBBBz...",
    ".....zBBBBBBz...",
    ".....zBxBBxBz...",
  ];
  const ZOMBIE_LEGS = [
    [".....zxxzzxxz...", ".....zxxzzxxz...", ".....zzzzzzzz..."],
    [".....zxxzzxxz...", "....zxxz..zxxz..", "....zzz....zzz.."],
  ];
  const CROW = {                                  // crow perched on a branch, facing left; w = moonlit rim, t = eye
    idle: ["...zzz....", "..zywyz...", ".zyytyz...", "zxxyyyyz..", ".zzyyyyyz.", "..zyyxyyyz", "..zyyxxyyz", "...zyyyyzz", "....zxzx.."],
    tilt: ["..zzz.....", ".zwyyz....", ".zytyyz...", "..xzyyyz..", ".zzyyyyyz.", "..zyyxyyyz", "..zyyxxyyz", "...zyyyyzz", "....zxzx.."],
    caw:  ["...zzz....", "x.zywyz...", "zxzytyz...", ".z.yyyyz..", "zxzyyyyyz.", "..zyyxyyyz", "..zyyxxyyz", "...zyyyyzz", "....zxzx.."],
  };
  const BAT = [["z.....z", "zz.z.zz", ".zzzzz.", "...z..."], ["...z...", ".zzzzz.", "zz...zz", "z.....z"]];
  const PUMPKIN = [                               // jack-o'-lantern; "#" = glowing carved face
    ".....no.....",
    "..zzzoozzz..",
    ".zjjbjjbjjz.",
    "zjj#jjjj#jjz",
    "zj##jbbj##jz",
    "zjjjj##jjjbz",
    "zj#jjjjjj#jz",
    "zbj######jbz",
    ".zbjj#j#jbz.",
    "..zzzzzzzzz.",
  ];
  const LANTERNS = [{ x: 56, y: FLOOR, seed: 0 }, { x: 206, y: FLOOR, seed: 5 }];
  const FLICKER = [2, 2, 1, 2, 0, 2, 1, 1, 2, 2, 0, 1];
  const lanternLevel = (l, a) => FLICKER[(a + l.seed) % FLICKER.length];
  const lightR = (l, a) => 24 + 2 * lanternLevel(l, a);

  // ---- static layers ----
  const CLOUDS = [
    { parts: [[6, 7, 3], [13, 6, 4], [21, 5, 5], [30, 6, 4], [38, 7, 3], [45, 8, 2]], w: 50, h: 10, x: 130, y: 32 },
    { parts: [[5, 6, 3], [12, 5, 4], [20, 6, 3], [27, 7, 2]], w: 32, h: 9, x: 0, y: 12 },
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
  const inMoon = (x, y) => (x - MOON.x) * (x - MOON.x) + (y - MOON.y) * (y - MOON.y) <= MOON.r * MOON.r;
  function buildSky() {
    const r = layer();
    bands(r, [[0, "z"], [40, "y"], [94, "B"]], 2);
    for (let y = MOON.y - MOON.r; y <= MOON.y + MOON.r; y++) for (let x = MOON.x - MOON.r; x <= MOON.x + MOON.r; x++) {
      if (!inMoon(x, y)) continue;
      const dx = x - MOON.x, dy = y - MOON.y;
      let c = "u";
      if (dx + dy < -MOON.r * 0.9 && (dx * dx + dy * dy) > (MOON.r - 3) * (MOON.r - 3)) c = "t";
      const m1 = (dx - 4) * (dx - 4) + (dy + 2) * (dy + 2) < 16, m2 = (dx + 5) * (dx + 5) + (dy - 5) * (dy - 5) < 9, m3 = (dx - 3) * (dx - 3) + (dy - 8) * (dy - 8) < 5;
      if (m1 || m2 || m3) c = "v";
      r.set(x, y, c);
    }
    return r;
  }
  const hill = (x) => 106 + Math.round(5 * Math.sin(x / 47 + 1) + 3 * Math.sin(x / 17));
  const CH = { x: 236, base: 126 };               // chapel on the hill (right)
  function buildFar() {
    const r = layer();
    for (let x = 0; x < W; x++) { const y0 = hill(x); for (let y = y0; y < FLOOR + 2; y++) r.set(x, y, y === y0 ? "x" : "y"); }
    const S = "z", E = "x";                         // silhouettes: black body, moonlit left edge
    const cx = CH.x, b = CH.base;
    r.rect(cx, b - 30, 44, 30, S); r.vline(cx, b - 30, 30, E);                     // nave
    for (let k = 0; k < 12; k++) { r.hline(cx - 2 + k, b - 31 - k, 48 - 2 * k, S); r.set(cx - 2 + k, b - 31 - k, E); } // steep roof
    r.rect(cx + 30, b - 62, 12, 62, S); r.vline(cx + 30, b - 62, 62, E);            // bell tower
    for (let k = 0; k < 22; k++) { const hw = Math.max(0, 6 - ((k * 6 / 22) | 0)); r.hline(cx + 36 - hw, b - 63 - k, hw * 2 + (hw ? 0 : 1), S); r.set(cx + 36 - hw, b - 63 - k, E); } // spire
    r.vline(cx + 36, b - 92, 7, E); r.hline(cx + 34, b - 90, 5, E);                // cross on the spire
    for (const wx of [cx + 6, cx + 16]) { r.rect(wx, b - 22, 5, 10, "y"); r.set(wx + 2, b - 23, "y"); r.vline(wx + 2, b - 21, 9, S); r.set(wx + 1, b - 20, "B"); r.set(wx + 3, b - 17, "B"); }
    r.rect(cx + 33, b - 50, 6, 8, "y"); r.set(cx + 35, b - 51, "y"); r.set(cx + 34, b - 48, "B"); r.set(cx + 36, b - 46, "B");
    r.rect(cx + 33, b - 14, 7, 14, "y"); r.set(cx + 34, b - 15, "y"); r.set(cx + 38, b - 15, "y"); r.hline(cx + 35, b - 16, 3, "y");
    return r;
  }
  function line(r, x0, y0, x1, y1, c, c2) {       // 1 px branch, optional lit pixel above
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) { const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n); r.set(x, y, c); if (c2) r.set(x, y - 1, c2); }
  }
  const PERCH = { x: 96, y: 61 };                 // crow's branch tip, just below the moon
  function tombstone(r, x, base, w, h, tilt, cross) {
    for (let j = 0; j < h; j++) {
      const y = base - 1 - j, shift = tilt ? Math.round((tilt * j) / 6) : 0, top = h - 1 - j;
      let x0 = x + shift, x1 = x + shift + w - 1;
      if (top < 3) { const cut = [3, 1, 0][top]; x0 += cut; x1 -= cut; }      // rounded top
      for (let xx = x0; xx <= x1; xx++) {
        let c = xx === x0 || top === 0 ? "w" : xx === x1 ? "y" : "x";
        if (j < 2 && (xx + j) % 3 !== 0) c = j === 0 ? "o" : "p";                // moss at the foot
        r.set(xx, y, c);
      }
      if (cross) {                                // engraved cross
        const mx = x + shift + (w >> 1);
        if (top >= 3 && top <= 10) r.set(mx, y, "y");
        if (top === 5) { r.set(mx - 1, y, "y"); r.set(mx + 1, y, "y"); }
      }
    }
  }
  function buildMid() {
    const r = layer();
    for (let x = 2; x < W; x += 6) {              // iron fence, cross finials every fourth picket
      const k = ((x - 2) / 6) | 0;
      r.vline(x, 124, FLOOR - 124, "x");
      if (k % 4 === 0) { r.vline(x, 118, 6, "x"); r.hline(x - 1, 120, 3, "x"); r.set(x, 118, "w"); }
      else r.set(x, 123, "w");
    }
    for (const y of [127, 142]) { r.hline(0, y, W, "x"); for (let x = 0; x < W; x += 3) r.set(x, y, "w"); }
    // dead tree (moonlit on the left)
    const tx = 106;
    for (let y = 72; y < FLOOR; y++) { const w = y > 138 ? 6 : y > 110 ? 4 : 3, x0 = tx - (w >> 1) + (y < 100 ? ((100 - y) / 14 | 0) * -1 : 0); r.hline(x0, y, w, "z"); r.set(x0, y, "x"); }
    r.set(tx - 4, FLOOR - 1, "z"); r.set(tx + 3, FLOOR - 1, "z"); r.set(tx - 5, FLOOR - 1, "z");
    line(r, tx, 96, tx + 22, 82, "z", "x"); line(r, tx + 22, 82, tx + 32, 74, "z"); line(r, tx + 14, 87, tx + 18, 78, "z");
    line(r, tx - 2, 88, tx - 8, 72, "z", "x"); line(r, tx - 8, 72, PERCH.x + 2, PERCH.y + 1, "z", "x"); line(r, PERCH.x + 2, PERCH.y + 1, PERCH.x - 4, PERCH.y, "z");
    line(r, tx - 4, 78, tx - 14, 70, "z"); line(r, tx + 1, 74, tx + 4, 64, "z");
    // tombstones and a celtic cross, crooked
    tombstone(r, 4, LEDGE_Y, 10, 13, 1, true);
    tombstone(r, 66, FLOOR, 11, 15, 1, true);
    tombstone(r, 130, FLOOR, 10, 13, -1, false);
    tombstone(r, 236, FLOOR, 12, 16, 0, true);
    tombstone(r, 290, FLOOR, 10, 12, 1, false);
    const cx = 186;                               // stone cross with a ring
    r.rect(cx, FLOOR - 22, 4, 22, "x"); r.vline(cx, FLOOR - 22, 22, "w"); r.rect(cx - 5, FLOOR - 17, 14, 4, "x"); r.hline(cx - 5, FLOOR - 17, 14, "w");
    for (const [dx, dy] of [[-3, -20], [-4, -19], [6, -20], [7, -19], [-4, -12], [-3, -11], [7, -12], [6, -11]]) r.set(cx + dx, FLOOR + dy, "x");
    for (let x = cx - 2; x < cx + 6; x++) r.set(x, FLOOR - 1, "o");
    return r;
  }

  function stone(r, x, y, top) {                  // cold blue-grey stone blocks with dark joints
    const d = y - top, row = d >> 2, bx = (x + (row & 1) * 5) % 10;
    let c = (d & 3) === 3 || bx === 0 ? "x" : "w";
    if (c === "w" && ((d & 3) === 0 || bx === 1) && hash((x + (row & 1) * 5) / 10 | 0, row, 51) % 3 === 0) c = "v";
    if (c === "w" && hash(x, y, 52) % 23 === 0) c = "x";
    r.set(x, y, c);
  }
  function solid(x, y) {
    if (y >= PIT_Y) return true;
    if (y >= FLOOR) return x < PIT_X0 || x >= PIT_X1;
    return y >= LEDGE_Y && x < LEDGE_X1;
  }
  const surfaceTop = (x) => x < LEDGE_X1 ? LEDGE_Y : x >= PIT_X0 && x < PIT_X1 ? PIT_Y : FLOOR;
  function buildGround() {
    const r = layer();
    for (let x = 0; x < W; x++) {
      const top = surfaceTop(x);
      for (let y = top; y < H; y++) {
        if (!solid(x, y)) continue;
        const k = y - top;
        if (k === 0) r.set(x, y, "n");                                     // dark green moss on top
        else if (k < 3 && (k === 1 || hash(x, y, 53) % 3)) r.set(x, y, "o");
        else stone(r, x, y, top);
      }
      if (hash(x, 9, 54) % 7 === 0) r.set(x, top - 1, "o");             // moss tufts
    }
    for (let y = LEDGE_Y + 3; y < FLOOR; y++) r.set(LEDGE_X1 - 1, y, "x");
    for (let y = FLOOR + 3; y < PIT_Y; y++) { r.set(PIT_X0 - 1, y, "x"); r.set(PIT_X1, y, "v"); }
    for (const x of [PIT_X0 - 1, PIT_X0 + 7, PIT_X1 + 2, LEDGE_X1 - 1]) for (let k = 0; k < 3 + (x & 3); k++) r.set(x, surfaceTop(x) + 2 + k, "o");  // hanging moss
    const props = layer();
    spr(props, CRATE, 112, FLOOR - 16);
    spr(props, PORTER, 80, FLOOR - 16);
    return { ground: r, props };
  }

  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    const g = buildGround();
    L = { sky: buildSky(), far: buildFar(), mid: buildMid(), ground: g.ground, props: g.props, clouds: CLOUDS.map(cloudRows) };
    L.LIGHT = Object.assign({}, PB.LIGHT, { B: "C" });
    L.WARM = { z: "g", y: "g", x: "f", w: "F", v: "d", u: "c", B: "f", o: "f", p: "g", n: "e" };   // orange pumpkin glow close to the lantern
    L.DIM = PB.DIM;
    L.stars = [];
    for (let i = 0; i < 16; i++) { const h = hash(i, 3, 61); const x = h % W, y = 4 + ((h >> 9) % 60); if (!inMoon(x, y) && Math.abs(x - MOON.x) + Math.abs(y - MOON.y) > MOON.r + 6) L.stars.push({ x, y, h }); }
  }

  // ---- ambient (4 fps) ----
  const cloudX = (c, a) => ((c.x + c.w + 20 + a * 2) % (W + c.w + 40)) - c.w - 20;
  function moonCovered(a) {
    const c = CLOUDS[0], x = cloudX(c, a);
    return x < MOON.x + 4 && x + c.w > MOON.x - 4;
  }
  function drawSkyLife(r, a, tick) {
    for (const s of L.stars) r.set(s.x, s.y, ((a + s.h) % 11) < 2 ? "x" : (s.h & 1 ? "w" : "x"));
    const covered = moonCovered(a), halo = covered ? 2 : 6;
    remap(r, MOON.x - MOON.r - halo, MOON.y - MOON.r - halo, MOON.x + MOON.r + halo + 1, MOON.y + MOON.r + halo + 1, L.LIGHT, (x, y) => {
      if (inMoon(x, y)) return false;
      const d = Math.sqrt((x - MOON.x) * (x - MOON.x) + (y - MOON.y) * (y - MOON.y)) - MOON.r;
      return d < halo * (0.35 + bay(x, y) / 24);
    });
    if (covered) remap(r, MOON.x - MOON.r, MOON.y - MOON.r, MOON.x + MOON.r + 1, MOON.y + MOON.r + 1, { t: "u", u: "v", v: "w" }, inMoon);
    for (let k = 0; k < 2; k++) {                 // bats crossing the moon (8 fps)
      const u = (tick + k * 67) % 136, x = -10 + u * 3, y = MOON.y - 6 + k * 12 + tri(u * 4, 26, 3);
      if (x < W + 10) spr(r, BAT[((tick >> 1) + k) & 1], x - 3, y - 2);
    }
    CLOUDS.forEach((c, i) => {                    // dark clouds, lit through where they pass the moon
      const x0 = cloudX(c, a), rows = L.clouds[i];
      for (let j = 0; j < rows.length; j++) for (let q = 0; q < rows[j].length; q++) {
        const ch = rows[j][q]; if (ch === ".") continue;
        const x = x0 + q, y = c.y + j, m = inMoon(x, y);
        r.set(x, y, m ? { t: "u", u: "v", v: "w" }[ch] : { t: "w", u: "x", v: "y" }[ch]);
      }
    });
  }
  const PITC = (PIT_X0 + PIT_X1) >> 1;
  function fogDensity(x, y, a, y0, y1) {          // 0–16: thicker near the ground, slow lumps drifting toward the pit
    if (y < y0 || y >= y1) return 0;
    const t = x < PITC ? x - (a >> 1) : x + (a >> 1);
    const lump = tri(t, 112, 3) + tri(t + 37, 72, 2);
    return Math.max(0, Math.min(15, (((y - y0) * 17) / (y1 - y0) | 0) + lump));
  }
  function drawFog(r, a, y0, y1, onlyEmpty) {
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
      if (onlyEmpty && solid(x, y)) continue;
      const d = fogDensity(x, y, a, y0, y1);
      if (d > 2 && bay(x, y) < d - 2) r.set(x, y, d > 12 ? "v" : "w");
    }
  }
  function drawPitGas(r, a) {                     // cold gas pooled in the pit: rolling surface, slow streaks, wisps sinking over the rims
    for (let x = PIT_X0; x < PIT_X1; x++) {
      const sy = FLOOR + 2 + tri(x * 2 + a * 3, 32, 1) + tri(x + a, 44, 1);
      for (let y = sy - 3; y < PIT_Y; y++) {
        const dens = Math.min(16, (y - sy + 3) * 3 + 3 + tri(x - a, 22, 2));
        if (bay(x - (a >> 1), y) >= dens) continue;
        const streak = ((x + y * 4 - (a >> 1)) % 23 + 23) % 23 < 3;
        r.set(x, y, dens < 12 ? "w" : streak ? "u" : "v");
      }
    }
    for (let k = 0; k < 6; k++) {
      const side = k & 1, age = (a + k * 5) % 16, x = side ? PIT_X1 + 6 - (age >> 1) : PIT_X0 - 6 + (age >> 1), y = FLOOR - 6 + age;
      if (y < FLOOR + 4) { r.set(x, y, "v"); r.set(x + (side ? 1 : -1), y, "w"); if (age & 1) r.set(x, y - 1, "w"); }
    }
  }
  function lanternLights(r, a) {                  // warm pumpkin light: brighten the background one step
    for (const l of LANTERNS) {
      const R = lightR(l, a), cx = l.x, cy = l.y - 6;
      const dist = (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      remap(r, cx - R - 1, cy - R - 1, cx + R + 2, Math.min(H, cy + R + 2), L.LIGHT, (x, y) => {
        const d = dist(x, y);
        return d >= R * 0.42 && d < R * (0.82 + bay(x, y) / 90);
      });
      remap(r, cx - R, cy - R, cx + R + 1, Math.min(H, cy + R + 1), L.WARM, (x, y) => dist(x, y) < R * (0.36 + bay(x, y) / 60));
    }
  }
  function darkness(r, a) {                       // outside the lantern light the ground area sinks into the dark
    remap(r, 0, 96, W, H, L.DIM, (x, y) => {
      for (const l of LANTERNS) {
        const R = lightR(l, a) + 12, dx = x - l.x, dy = y - (l.y - 6);
        if (dx * dx + dy * dy < R * R * (0.86 + bay(x, y) / 110)) return false;
      }
      return y >= 104 || bay(x, y) < (y - 96) * 2;
    });
  }
  function drawLanterns(r, a) {
    for (const l of LANTERNS) {
      const lv = lanternLevel(l, a);
      spr(r, PUMPKIN, l.x - 6, l.y - 10, false, { "#": lv === 2 ? "l" : lv === 1 ? "k" : "j" });
    }
  }

  // ---- animals (8 fps) ----
  function drawCrow(r, tick) {
    const p = tick % 48;
    const pose = p >= 20 && p < 32 ? "tilt" : p >= 32 && p < 44 && ((p - 32) % 6) < 3 ? "caw" : "idle";
    spr(r, CROW[pose], PERCH.x - 5, PERCH.y - 9);
  }
  function drawZombie(r, tick) {                  // shuffles slowly toward the player, turns back at the pit
    const span = 64, p = (tick >> 1) % (2 * span), x0 = 288;
    const x = p < span ? x0 - p : x0 - 2 * span + p, flip = p >= span;
    const step = (tick >> 2) & 1, bob = step;
    const y = FLOOR - 16;
    spr(r, ZOMBIE, x, y + bob, flip);
    spr(r, ZOMBIE_LEGS[step], x, y + 13, flip);
  }

  window.PB_CONCEPT_SCENES["graveyard"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      r.data.set(L.sky.data);
      drawSkyLife(r, a, tick);
      r.blit(L.far, 0, 0);
      r.blit(L.mid, 0, 0);
      drawFog(r, a, 112, FLOOR + 2, true);
      lanternLights(r, a);
      r.blit(L.ground, 0, 0);
      drawPitGas(r, a);
      drawFog(r, a + 7, FLOOR - 10, FLOOR + 2, false);
      darkness(r, a);
      drawLanterns(r, a);
      drawCrow(r, tick);
      drawZombie(r, tick);
      r.blit(L.props, 0, 0);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
