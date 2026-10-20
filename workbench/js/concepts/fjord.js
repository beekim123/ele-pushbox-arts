/* ART-04k 地图概念场景 · 峡湾巨魔谷（fjord）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 地标：陡峭的绿色山壁和瀑布、草顶木屋、维京长船、符文石。夏天的午夜太阳，没有雪。
 * 机关外观：阳光石化（sun_petrify，阳光照到洞口的巨魔就变成灰石头）、冰面滑行（ice_slide，一段冰川蓝冰面）。
 * 环境（4 fps）：瀑布落下、水面泛金光、午夜太阳缓缓移动（光柱跟着移动）、海鸥飞过。
 * 动物（8 fps）：巨魔（怪物，在山洞口探头，被阳光照到就僵住变灰）、渡鸦（提示动物，在符文石上踱步）。
 * 比例尺：主角大小的人影 + 1 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4 (20 × 11 tiles)
  const FLOOR = OY + 9 * 16;                      // 148: rocky shore
  const CLIFF_X1 = 3 * 16, CLIFF_Y = OY + 3 * 16; // left cliff wall: x < 48, top y = 52
  const CAVE = { x0: 16, x1: 48, y0: OY + 7 * 16 };  // troll cave in the cliff foot: x 16–47, y 116–147
  const PLAT_X = 15 * 16, PLAT_Y = OY + 7 * 16;   // raised rock on the right: x ≥ 240, top y = 116
  const ICE_X0 = 7 * 16, ICE_X1 = 10 * 16;        // glacier-ice strip on the shore: x 112–159
  const HZ = 98;                                  // far horizon of the fjord
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

  const TROLL = [                                 // cute moss-haired troll with a big nose, facing right; "*" eye, "#" pupil
    "........mn..........",
    ".......nmo..........",
    ".....oonnnoo........",
    "...oonnmnnnnoo......",
    "..onnnnnnnnmnnoz....",
    "..onmnnnnnnnnnnoz...",
    ".zooonnnnoonnooooz..",
    ".zFFoooFFooFFoFFFz..",
    "zeFFFFFFFFFFFeeFFz..",
    "zeFzFFFFFFFF*#FFdFz.",
    "zeeFFFFFFFFFFFFdddFz",
    ".zeFFFFFFFFFFFzFddFz",
    ".zeFFFFFFFFFFzeFFFFz",
    ".zeFFFFFFFFFFzeeeFez",
    ".zeeFFFFFFFFFFzzeez.",
    ".zeefzzffffffzzzz...",
    ".zeeeFcFFFFFFFz.....",
    "..zeeeFFFFFFFz......",
    "..zeeFFFFFFFFFz.....",
    ".zeeFFFFFFFFFFFz....",
    "zeeFFFFFdddFFzFFz...",
    "zeeFFFFFFddFFzFFz...",
    "zeeFFFFFFFFFFzFFz...",
    ".zeFFFFFFFFFzFFFFz..",
    ".zeeFFFFFFFFzFFFFz..",
    "..zeeeeeeeeezzzz....",
    "...zeeez.zeeez......",
    "..zeeeez.zeeeez.....",
    "..zzzzzz.zzzzzz.....",
  ];
  const TROLL_X = 26, TROLL_CX = TROLL_X + 10;
  const RAVEN = {                                 // raven facing right; legs drawn separately (2 walking frames)
    idle: ["......zz..", ".....zzzz.", ".....zwzzy", "....zzzzyy", "...zzzzzz.", "..zzzxxzz.", ".zzzxxxzz.", "zzzzzzzz.."],
    croak: ["......zz..", ".....zzzz.", ".....zwzyy", "....zzzz..", "...zzzzzyy", "..zzzxxzz.", ".zzzxxxzz.", "zzzzzzzz.."],
    legs: [["....z.z...", "...zz.zz.."], [".....zz...", "....zzz..."]],
  };
  const GULL = [["t.....t", ".t...t.", "..tut.."], [".......", "ttt.ttt", "...u..."], [".......", "..tut..", "tt...tt"]];

  const codeAt = (r, x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    const i = (y * W + x) * 4, d = r.data;
    return d[i + 3] ? REV.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) : null;
  };
  function line(r, x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) r.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }

  // ---- static layers ----
  const xL = (y) => 90 + ((y * y * 38) / (HZ * HZ) | 0) + tri(y * 5, 46, 2) + (hash(y >> 2, 1, 71) % 3) - 1;   // inner edge of the left fjord wall
  const xR = (y) => 234 - ((y * y * 34) / (HZ * HZ) | 0) - tri(y * 3 + 9, 38, 2) - (hash(y >> 2, 2, 72) % 3) + 1;
  function buildSky() {
    const r = layer();
    bands(r, [[0, "q"], [22, "w"], [44, "v"], [62, "u"], [76, "c"], [90, "d"]], 2);
    return r;
  }
  function buildFar() {                           // hazy ridges at the end of the fjord
    const r = layer();
    for (let x = 96; x < 238; x++) {
      const yb = 84 + tri(x * 3, 128, 4) + tri(x + 17, 46, 2), yf = 91 + tri(x * 2 + 40, 92, 3) + tri(x + 5, 30, 1);
      for (let y = yb; y < HZ; y++) r.set(x, y, y < yf ? (y === yb ? "u" : "v") : y === yf ? "v" : "w");
    }
    return r;
  }
  function vnoise(x, y, cw, ch, seed) {          // smooth value noise 0–255 (bilinear between hashed grid points)
    const gx = Math.floor(x / cw), gy = Math.floor(y / ch), fx = (x - gx * cw) / cw, fy = (y - gy * ch) / ch;
    const h = (i, j) => hash(gx + i, gy + j, seed) & 255, a = h(0, 0) + (h(1, 0) - h(0, 0)) * fx, b = h(0, 1) + (h(1, 1) - h(0, 1)) * fx;
    return a + (b - a) * fy;
  }
  function wallPix(r, x, y, d, side) {            // d = distance from the inner, sunlit edge
    const sx = x + tri(y, 60, 2), rk = (q) => vnoise(q, y, 6, 30, 73 + side) > 196;
    let c = "n";
    if (rk(sx)) c = rk(sx + (side ? -1 : 1)) ? "w" : "v";                                             // bare rock bands, lit toward the fjord
    else { const v = vnoise(x, y, 5, 7, 75 + side); if (v < 70) c = "o"; else if (v > 236 && (y & 1)) c = "m"; }
    if (y > 44 && vnoise(x, y, 5, 4, 77) / 16 < ((y - 44) * 16) / 46) c = { n: "o", o: "p", m: "n", w: "x", v: "w", x: "y" }[c] || c;   // shaded foot, ragged edge
    if (d < 2) c = d < 1 ? "m" : c === "o" || c === "p" ? "n" : "m";
    r.set(x, y, c);
  }
  function spruce(r, x, y) { r.set(x, y - 4, "p"); r.hline(x - 1, y - 3, 3, "p"); r.hline(x - 1, y - 2, 3, "p"); r.hline(x - 2, y - 1, 5, "p"); r.set(x, y, "p"); }
  const WF = { x: 247, y0: 16 };                  // waterfall on the right wall
  function buildWalls() {
    const r = layer();
    for (let y = 0; y < HZ; y++) {
      const l = xL(y), rr = xR(y);
      for (let x = 0; x < l; x++) wallPix(r, x, y, l - 1 - x, 0);
      for (let x = rr; x < W; x++) wallPix(r, x, y, x - rr, 1);
    }
    for (let i = 0; i < 24; i++) {
      const h = hash(i, 7, 76), side = i & 1, y = 82 + (h % 14);
      spruce(r, side ? xR(y) + 4 + ((h >> 8) % 34) : xL(y) - 5 - ((h >> 8) % 36), y);
    }
    for (let y = WF.y0 - 7; y < WF.y0 + 1; y++) for (let x = WF.x - 2; x < WF.x + 8; x++) {   // cleft the stream pours from
      const e = Math.abs(x - WF.x - 2.5) - (y - WF.y0 + 7) * 0.6;
      if (e < 0) r.set(x, y, e > -1 ? "x" : "p");
    }
    return r;
  }
  const BOAT = { x: 150, wl: 125 };
  const DRAGON = ["...zzz..", "..zFkFz.", ".zFFFFFz", "zFFzzFFz", "zz...zFz", ".....zFz", ".....zFz"];
  const CURL = [".zzz.", "zFFFz", "zFzFz", ".zzFz", "...zF"];
  function buildBoat() {                          // Viking longship facing left: striped sail, shields, dragon prow
    const r = layer(), X = BOAT.x, Y = BOAT.wl, mx = X + 28;
    line(r, mx, Y - 36, X + 3, Y - 13, "g"); line(r, mx, Y - 36, X + 53, Y - 15, "g");   // rigging
    for (let x = X + 17; x < X + 40; x++) {       // sail with a slight belly
      const i = x - X - 17, belly = i > 4 && i < 18 ? 1 : 0;
      for (let y = Y - 32; y < Y - 14 + belly; y++) r.set(x, y, ((i / 3) | 0) & 1 ? "c" : "h");
      r.set(x, Y - 14 + belly, "g");
    }
    r.vline(mx, Y - 37, 32, "f"); r.hline(X + 15, Y - 33, 27, "f"); r.set(X + 15, Y - 32, "f"); r.set(X + 41, Y - 32, "f");
    for (let i = 0; i < 56; i++) {
      const lt = i < 14 ? ((14 - i) * (14 - i)) / 22 : 0, rt = i > 42 ? ((i - 42) * (i - 42)) / 16 : 0;
      const top = Y - 5 - Math.round(lt + rt), bot = Y - Math.max(0, Math.round(lt + rt) - 3);
      for (let y = top; y <= bot; y++) {
        const k = y - top;
        r.set(X + i, y, k === 0 || i === 0 || i === 55 ? "z" : k === 1 ? "F" : y === bot ? "g" : k & 1 ? "e" : "f");
      }
    }
    spr(r, DRAGON, X - 5, Y - 21);
    spr(r, CURL, X + 52, Y - 22);
    for (let s = 0; s < 6; s++) {                 // shields over the gunwale
      const sx = X + 14 + s * 5, rim = s & 1 ? "c" : "a", boss = s & 1 ? "a" : "k";
      spr(r, [".##.", "#@@#", "#@@#", ".##."], sx, Y - 8, false, { "#": rim, "@": boss });
    }
    for (const i of [16, 26, 36, 46]) line(r, X + i, Y - 2, X + i - 5, Y + 3, "f");               // oars dipping in
    return r;
  }
  const REFL = { n: "o", m: "n", o: "p", p: "p", w: "x", x: "y", v: "w", u: "v", t: "u", c: "v", h: "g", e: "f", F: "f", f: "g", g: "y", a: "f", k: "f", z: "y" };
  function buildWater(far, walls, boat) {        // deep blue water with squashed, broken reflections
    const r = layer();
    for (let y = HZ; y < FLOOR; y++) {
      const k = y - HZ, ym = HZ - 1 - ((k * 3) >> 1);
      for (let x = 0; x < W; x++) {
        let c = "q";
        if (ym >= 0) { const s = codeAt(walls, x, ym) || codeAt(far, x, ym); if (s) c = REFL[s] || "p"; }
        const bs = k > 0 && (y - BOAT.wl) > 0 && (y - BOAT.wl) < 12 ? codeAt(boat, x, BOAT.wl - ((y - BOAT.wl) * 3 >> 1)) : null;
        if (bs && (y & 1 || y - BOAT.wl < 3)) c = REFL[bs] || "y";
        r.set(x, y, c);
      }
    }
    return r;
  }
  function cells(cw, ch, seed) {                 // jittered grid: id of the nearest point for every pixel
    const id = new Int32Array(W * H), gw = Math.ceil(W / cw) + 2, gh = Math.ceil(H / ch) + 2, px = [], py = [];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const h = hash(i, j, seed); px.push((i - 1) * cw + (h % cw)); py.push((j - 1) * ch + ((h >> 8) % ch)); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ci = ((x / cw) | 0) + 1, cj = ((y / ch) | 0) + 1;
      let best = 1e9, bi = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const k = (cj + dj) * gw + ci + di, dx = x - px[k], dy = (y - py[k]) * 1.4, dd = dx * dx + dy * dy;
        if (dd < best) { best = dd; bi = k; }
      }
      id[y * W + x] = bi;
    }
    return id;
  }
  let ROCK = null;
  function rock(r, x, y, k) {                     // grey boulders: lit upper-left rims, dark joints, a few darker stones
    const i = y * W + x, c0 = ROCK[i], dark = hash(c0, 0, 93) % 5 === 0;
    const dn = y < H - 1 ? ROCK[i + W] : c0, rt = x < W - 1 ? ROCK[i + 1] : c0, up = y > 0 ? ROCK[i - W] : c0, lf = x > 0 ? ROCK[i - 1] : c0;
    let c = dark ? "x" : "w";
    if (dn !== c0 || rt !== c0) c = dark ? "y" : "x";
    else if (up !== c0 || lf !== c0) c = k < 9 && hash(c0, 1, 94) % 3 === 0 ? "o" : dark ? "w" : "v";
    else if (hash(x, y, 95) % 37 === 0) c = dark ? "w" : "x";
    r.set(x, y, c);
  }
  const caveTop = (x) => CAVE.y0 - 2 + (((CAVE.x1 - 1 - x) * (CAVE.x1 - 1 - x)) / 70 | 0);   // arched roof, lowest at the back
  const inCave = (x, y) => x >= CAVE.x0 && x < CAVE.x1 && y >= caveTop(x) && y < FLOOR;
  function solid(x, y) {
    if (y >= FLOOR) return true;
    if (x < CLIFF_X1 && y >= CLIFF_Y) return !inCave(x, y);
    return x >= PLAT_X && y >= PLAT_Y;
  }
  function buildCabin(r) {                        // turf-roofed log cabin, gable end facing us
    const x0 = 266, w = 32, base = PLAT_Y, wt = base - 15, ax = x0 + (w >> 1), ay = wt - 15;
    for (let y = ay; y < wt; y++) { const hw = (((y - ay) * 20) / 15) | 0; for (let x = ax - hw; x <= ax + hw; x++) r.set(x, y, ((x - ax + 64) >> 1) & 1 ? "f" : "e"); }
    for (let y = wt; y < base; y++) for (let x = x0; x < x0 + w; x++) { const k = (y - wt) % 3; r.set(x, y, k === 0 ? "e" : k === 1 ? "f" : "g"); }
    for (let y = wt; y < base; y += 3) for (const lx of [x0 - 2, x0 + w]) { r.hline(lx, y, 2, "F"); r.hline(lx, y + 1, 2, "e"); r.hline(lx, y + 2, 2, "g"); }
    const dx = x0 + 12;
    r.rect(dx, base - 12, 8, 12, "g"); r.rect(dx + 1, base - 11, 6, 11, "f"); r.vline(dx + 3, base - 11, 11, "g"); r.set(dx + 5, base - 6, "k");
    r.hline(dx - 1, base - 13, 10, "F");
    r.rect(x0 + 3, base - 11, 6, 5, "F"); r.rect(x0 + 4, base - 10, 4, 3, "x"); r.set(x0 + 4, base - 10, "v");
    r.rect(x0 + 23, base - 11, 6, 5, "F"); r.rect(x0 + 24, base - 10, 4, 3, "x"); r.set(x0 + 24, base - 10, "v");
    for (let x = x0 - 6; x < x0 + w + 6; x++) {
      const yt = ay - 2 + (((Math.abs(x - ax) * 15) / 22) | 0);
      for (let k = 0; k < 7; k++) r.set(x, yt + k, k === 0 ? (hash(x, 1, 95) % 6 === 0 ? (hash(x, 4, 98) & 1 ? "D" : "l") : "m") : k < 2 && hash(x, k, 99) % 3 === 0 ? "m" : k < 4 ? "n" : k === 4 ? "o" : k === 5 ? "p" : "g");
      if (hash(x, 2, 96) % 3 === 0) r.set(x, yt - 1, hash(x, 3, 97) & 1 ? "m" : "n");
      if (x < x0 - 3 || x > x0 + w + 2) for (let k = 7; k < 7 + (hash(x, 5, 99) % 3); k++) r.set(x, yt + k, k & 1 ? "o" : "n");   // grass hanging over the eaves
    }
    r.set(ax - 1, ay - 4, "f"); r.set(ax + 1, ay - 4, "f"); r.set(ax - 2, ay - 5, "f"); r.set(ax + 2, ay - 5, "f");   // crossed gable boards
  }
  const RUNE = { x: 16, w: 16, base: CLIFF_Y, h: 24 };
  function buildRune(r) {                         // rune stone: grey slab, red serpent band, sunlit right edge
    const { x: x0, w, base, h } = RUNE, top = base - h;
    for (let y = top; y < base; y++) {
      const k = y - top, ins = k < 3 ? [3, 1, 0][k] : 0;
      for (let x = x0 + ins; x < x0 + w - ins; x++) {
        const L1 = x === x0 + ins, R1 = x === x0 + w - ins - 1;
        r.set(x, y, L1 || (k === 0 && x < x0 + w - 5) ? "x" : R1 || k === 0 ? "u" : x >= x0 + w - 3 ? "u" : x <= x0 + 3 ? "w" : "v");
      }
    }
    const bx0 = x0 + 3, bx1 = x0 + w - 4, by = top + 5;
    for (let y = by; y < base - 2; y++) { r.set(bx0, y, "a"); r.set(bx1, y, y < base - 6 ? "a" : "v"); }
    for (let x = bx0; x <= bx1; x++) r.set(x, by - (x > bx0 && x < bx1 ? 1 : 0), "a");
    for (let y = by + 1; y < base - 3; y += 3) { r.set(bx0 + 1, y, "h"); r.set(bx1 - 1, y + 1, "h"); }
    r.set(bx1 - 1, base - 6, "a"); r.set(bx1 - 2, base - 5, "a"); r.set(bx1 - 2, base - 6, "h");         // serpent head
    const cx = x0 + (w >> 1);
    r.vline(cx, by + 4, 9, "a"); r.hline(cx - 2, by + 7, 5, "a");                                     // cross
  }
  function buildGround() {
    const g = layer(), front = layer(), props = layer();
    for (let x = 0; x < W; x++) {
      let open = -1;
      for (let y = 0; y < H; y++) {
        if (!solid(x, y)) {
          open = y;
          if (inCave(x, y)) g.set(x, y, x > CAVE.x1 - 5 && bay(x, y) < (x - CAVE.x1 + 5) * 4 ? "y" : y > FLOOR - 3 && bay(x, y) < 6 ? "y" : "z");
          continue;
        }
        const k = y - open - 1, cave = open >= 0 && inCave(x, open);
        if (cave) { if (k === 0) g.set(x, y, "x"); else rock(g, x, y, k); if (k < 3) g.set(x, y, k === 0 ? "x" : bay(x, y) < 8 ? "y" : "x"); continue; }
        if (y >= FLOOR && x >= ICE_X0 && x < ICE_X1 && k < 6) {        // glacier ice inset in the shore
          const s = (x + y * 2) % 9;
          g.set(x, y, k === 0 ? "t" : k === 5 ? "q" : k === 4 ? "r" : s === 0 ? "t" : s === 1 || s === 5 ? "s" : "u");
          continue;
        }
        if (k === 0) g.set(x, y, "m");
        else if (k < 3) g.set(x, y, k === 2 && bay(x, y) < 6 ? "o" : "n");
        else if (k === 3 && hash(x, y, 99) % 3 === 0) g.set(x, y, "o");
        else rock(g, x, y, k);
        if (k === 0 && hash(x, 9, 100) % 4 === 0) g.set(x, y - 1, hash(x, 8, 101) % 5 === 0 ? (x & 1 ? "l" : "D") : "n");
      }
    }
    for (let y = CLIFF_Y + 3; y < caveTop(CAVE.x1 - 1); y++) { g.set(CLIFF_X1 - 1, y, bay(CLIFF_X1 - 1, y) < 6 ? "u" : "v"); if (bay(CLIFF_X1 - 2, y) < 5) g.set(CLIFF_X1 - 2, y, "v"); }
    for (let y = PLAT_Y + 3; y < FLOOR; y++) { g.set(PLAT_X, y, bay(PLAT_X, y) < 6 ? "u" : "v"); if (bay(PLAT_X + 1, y) < 5) g.set(PLAT_X + 1, y, "v"); }
    for (const [x, n] of [[CLIFF_X1 - 1, 7], [CLIFF_X1 - 3, 4], [PLAT_X, 5], [PLAT_X + 3, 3]]) for (let k = 0; k < n; k++) g.set(x, topOf(x) + 2 + k, k & 1 ? "o" : "n");
    for (let x = CAVE.x1 - 8; x < CAVE.x1; x++) { const t = caveTop(x); front.set(x, t, "x"); if (x > CAVE.x1 - 4) front.set(x, t + 1, "x"); }
    front.vline(CAVE.x1 - 4, caveTop(CAVE.x1 - 4) + 1, 3, "x"); front.set(CAVE.x1 - 4, caveTop(CAVE.x1 - 4) + 4, "y");
    front.vline(CAVE.x1 - 1, caveTop(CAVE.x1 - 1), 4, "n"); front.set(CAVE.x1 - 2, caveTop(CAVE.x1 - 1) + 1, "o");
    buildCabin(g); buildRune(g);
    spr(props, PORTER, 80, FLOOR - 16);
    spr(props, CRATE, 208, FLOOR - 16);
    return { g, front, props };
  }
  const topOf = (x) => (x < CLIFF_X1 ? CLIFF_Y : x >= PLAT_X ? PLAT_Y : FLOOR);

  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    ROCK = cells(11, 8, 90);
    const far = buildFar(), walls = buildWalls(), boat = buildBoat(), gr = buildGround();
    gr.g.blit(gr.front, 0, 0);
    L = { sky: buildSky(), far, walls, boat, water: buildWater(far, walls, boat), ground: gr.g, props: gr.props };
    L.LIGHT = PB.LIGHT;
    L.BEAM = { z: "x", y: "w", x: "v", w: "v", v: "u", u: "c", c: "t", p: "n", o: "n", n: "m", q: "r", g: "f", f: "e", e: "F", F: "d", d: "c",
      h: "i", i: "D", a: "b", b: "d", j: "k", k: "l", B: "C", C: "D", D: "E", E: "c", A: "D", s: "t" };   // warm, about two steps brighter
    L.STONE = { F: "v", e: "w", f: "x", d: "u", o: "x", n: "w", m: "v", z: "y", c: "u", "*": "u", "#": "y" };   // sunlit grey stone
    L.sky0 = new Uint8Array(W * H);               // 1 where only the sky shows (the light beam skips those)
    for (let i = 0; i < W * H; i++) L.sky0[i] = far.data[i * 4 + 3] || walls.data[i * 4 + 3] || gr.g.data[i * 4 + 3] || i >= HZ * W ? 0 : 1;
  }

  // ---- ambient (4 fps) ----
  const SUN_R = 8;
  function sunPos(a) { const x = 164 + tri(a + 40, 128, 28), d = x - 164; return { x, y: 72 + (((d * d) / 240) | 0) }; }
  function drawSun(r, s) {
    const R = SUN_R;
    remap(r, s.x - R - 12, s.y - R - 12, s.x + R + 13, s.y + R + 13, L.LIGHT, (x, y) => {
      const d = Math.sqrt((x - s.x) * (x - s.x) + (y - s.y) * (y - s.y)) - R;
      return d >= 0 && d < 12 * (0.25 + bay(x, y) / 24);
    });
    for (let y = s.y - R; y <= s.y + R; y++) for (let x = s.x - R; x <= s.x + R; x++) {
      const dd = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
      if (dd > R * R + 2) continue;
      r.set(x, y, dd < 18 ? "t" : dd > (R - 1) * (R - 1) + 1 ? "k" : "l");
    }
  }
  function drawWaterfall(r, a) {
    for (let y = WF.y0; y < HZ + 1; y++) {
      const w = 5 + (((y - WF.y0) * 3) / (HZ - WF.y0) | 0);
      for (let i = 0; i < w; i++) {
        const s = ((y - a * 4 + i * 7 + (i & 1) * 3) % 13 + 13) % 13;
        r.set(WF.x + i - ((w - 5) >> 1), y, i === 0 || i === w - 1 ? "v" : s < 3 ? "t" : s < 9 ? "u" : "v");
      }
    }
    for (let y = HZ - 9; y < HZ + 7; y++) for (let x = WF.x - 11; x < WF.x + 17; x++) {   // spray where it meets the water
      const dx = x - WF.x - 2, dy = y - HZ, d = (dx * dx) / 5 + dy * dy * 1.6;
      const dens = 15 - d / 5 + tri(x * 3 + a * 5, 22, 3) + tri(y + a * 2, 10, 1);
      if (dens > 0 && bay(x + a, y) < dens) r.set(x, y, dens > 11 ? "t" : "u");
    }
  }
  function drawWaterLife(r, a, s) {
    for (let y = HZ + 1; y < FLOOR - 1; y++) {    // ripples drift and twinkle; longer toward the shore
      const k = y - HZ, cw = 9 + (k >> 2);
      if (hash(y, 0, 81) % 3 === 0) continue;
      const drift = ((a * (2 + (k >> 4))) >> 2) * (y & 1 ? 1 : -1);
      for (let ci = -2; ci * cw < W + cw; ci++) {
        const h = hash(ci, y, 82);
        if (h % 3) continue;
        if (((a >> 1) + (h >> 12)) % 5 === 0) continue;
        const len = 1 + ((h >> 4) % (2 + (k >> 4))), x0 = ci * cw + ((h >> 8) % cw) + (((drift % cw) + cw) % cw);
        for (let x = x0; x < x0 + len; x++) {
          const c = codeAt(r, x, y);
          if (c === "q") r.set(x, y, (h >> 16) % 3 ? "x" : "r");
          else if (c === "p" || c === "o" || c === "y") r.set(x, y, "q");
        }
      }
    }
    for (let y = HZ; y < FLOOR - 2; y++) {        // golden glitter under the midnight sun
      const k = y - HZ, hw = 2 + (((k * 12) / 50) | 0);
      if (k > 3 && (k & 1)) continue;
      for (let x = s.x - hw; x <= s.x + hw; x += 2) {
        const h = hash(x - s.x, y, 83 + (a % 12)), p = 16 - ((Math.abs(x - s.x) * 16) / (hw + 1) | 0);
        if ((h & 15) >= p - (k >> 3)) continue;
        const c = k < 4 ? (h & 32 ? "t" : "l") : k < 18 ? (h & 32 ? "l" : "k") : h & 32 ? "k" : "d";
        r.set(x, y, c); if (h & 64) r.set(x + 1, y, c);
      }
    }
    for (let x = CLIFF_X1; x < PLAT_X; x++) {     // lapping foam along the shore
      const h = hash(x >> 1, 0, 84), up = tri(a + (x >> 3) * 3, 12, 1) > 0 ? 1 : 0;
      if (h % 3 === 0) r.set(x, FLOOR - 1 - up, h & 8 ? "u" : "v");
    }
  }
  function drawBoat(r, a) { r.blit(L.boat, 0, tri(a, 16, 1) > 0 ? 1 : 0); }
  function drawGulls(r, a) {
    for (let k = 0; k < 2; k++) {
      const span = W + 40, u = (a * (k ? 2 : 3) + k * 170) % span, x = W + 20 - u, y = (k ? 46 : 30) + tri(a + k * 9, 48, 4);
      const ph = (a + k * 5) % 12, f = ph < 4 ? [0, 1, 2, 1][ph] : 1;
      spr(r, GULL[f], x - 3, y - 1);
    }
  }
  function beamAt(s, y) { const t = y - s.y; return { cx: s.x - ((t * 5) >> 1), hw: 6 + (((t * 30) / 100) | 0) }; }
  function sunBeam(r, s) {                        // low sunlight raking down toward the cave: one step brighter, soft dithered edges
    for (let y = s.y + SUN_R + 2; y < H; y++) {
      const b = beamAt(s, y);
      for (let x = Math.max(0, b.cx - b.hw); x <= Math.min(W - 1, b.cx + b.hw); x++) {
        const e = b.hw - Math.abs(x - b.cx), sky = L.sky0[y * W + x];
        let dens = Math.min(16, e * 2);
        if (sky) dens = Math.min(dens, 5);
        if (bay(x, y) >= dens) continue;
        const c = codeAt(r, x, y), m = c && L.BEAM[c];
        if (m && m !== c) r.set(x, y, m);
      }
    }
  }

  // ---- animals (8 fps) ----
  function trollLit(s) { const b = beamAt(s, 134); return Math.abs(TROLL_CX - b.cx) < b.hw - 4; }
  function drawTroll(r, tick, lit) {              // peeks out of the cave; caught by the sun it freezes into grey stone
    if (lit) { spr(r, TROLL, TROLL_X + 1, FLOOR - TROLL.length, false, L.STONE); return; }
    const p = tick % 48, dx = p < 8 ? 0 : p < 11 ? p - 7 : p < 32 ? 3 : p < 35 ? 34 - p : 0;
    const blink = tick % 23 === 0 || tick % 37 === 5;
    spr(r, TROLL, TROLL_X + dx, FLOOR - TROLL.length, false, blink ? { "*": "e", "#": "f" } : { "*": "t", "#": "z" });
  }
  function drawRaven(r, tick) {                   // paces on the rune stone, stops to croak
    const p = tick % 64, rx = RUNE.x + 1, top = RUNE.base - RUNE.h;
    let x, flip, step = 0, body = RAVEN.idle;
    if (p < 12) { x = rx + (p >> 1); flip = false; step = (p >> 1) & 1; }
    else if (p < 32) { x = rx + 6; flip = false; if ((p >= 16 && p < 19) || (p >= 24 && p < 27)) body = RAVEN.croak; }
    else if (p < 44) { x = rx + 6 - ((p - 32) >> 1); flip = true; step = ((p - 32) >> 1) & 1; }
    else { x = rx; flip = true; }
    spr(r, body, x, top - 10, flip);
    spr(r, RAVEN.legs[step], x, top - 2, flip);
  }

  window.PB_CONCEPT_SCENES["fjord"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer(), s = sunPos(a);
      r.data.set(L.sky.data);
      drawSun(r, s);
      r.blit(L.far, 0, 0);
      r.blit(L.walls, 0, 0);
      drawWaterfall(r, a);
      r.blit(L.water, 0, 0);
      drawWaterLife(r, a, s);
      drawBoat(r, a);
      drawGulls(r, a);
      r.blit(L.ground, 0, 0);
      sunBeam(r, s);
      drawTroll(r, tick, trollLit(s));
      drawRaven(r, tick);
      r.blit(L.props, 0, 0);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
