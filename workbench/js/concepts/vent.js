/* ART-04q 地图概念场景 · 深海热泉（vent）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 地标：一排冒黑烟的烟囱岩、成丛的红色管虫、白色的盲虾群、沉在烟囱旁的旧潜水钟。
 * 机关外观：particles（沉下来的矿砂被热流推进收集斗）、underwater（人影冒出的小气泡、潜水钟舷窗里的水线）、
 *           bin（铁收集斗）。只示意外观，不实现规则。
 * 环境（4 fps）：烟囱不停喷出翻滚的黑烟柱，烟边的水按整数像素轻微错动；海雪一直慢慢往下飘；管虫一缩一伸；
 *           盲虾抖动；烟囱口的暗橙余热和安康鱼的冷白灯光只照亮背景。
 * 动物（8 fps）：安康鱼（怪物，头顶的小灯一晃一晃）、铠甲蟹（提示动物，举着毛茸茸的钳子挥，站在收集斗旁）。
 * 比例尺：主角大小的人影 + 2 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4
  const FLOOR = OY + 9 * 16;                      // 148: sea floor
  const LEDGE = { x1: 64, y0: 100, y1: 116 };     // basalt shelf on the left
  const STEP = { x0: 288, y0: 116 };              // raised rock step on the right
  const BIN = { x0: 240, y0: 116 };               // collecting hopper, 32 × 32
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null, REV = null;

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
  function remap(r, x0, y0, x1, y1, map, level) {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(W, x1 | 0); y1 = Math.min(H, y1 | 0);
    const d = r.data;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (level && bay(x, y) >= level(x, y)) continue;
      const i = (y * W + x) * 4;
      if (!d[i + 3]) continue;
      const c = REV.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]), m = c && map[c];
      if (m && m !== c) r.set(x, y, m);
    }
  }
  // A round glow: full inside 55 % of the radius, Bayer-dithered edge (palette steps only, no blending).
  function glow(r, cx, cy, rad, map) {
    remap(r, cx - rad, cy - rad, cx + rad + 1, cy + rad + 1, map, (x, y) => {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / rad;
      return d < 0.55 ? 16 : d < 1 ? Math.floor((16 * (1 - d)) / 0.45) : 0;
    });
  }
  // Heat shimmer: rows near a plume slide by one whole pixel, the pattern climbs with time.
  function shimmer(r, x0, x1, y0, y1, a) {
    x0 = Math.max(0, x0); x1 = Math.min(W, x1);
    const d = r.data, row = new Uint8ClampedArray((x1 - x0) * 4);
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      const off = [0, 1, 0, -1][((y >> 1) + a) & 3];
      if (!off) continue;
      const base = y * W * 4;
      row.set(d.subarray(base + x0 * 4, base + x1 * 4));
      for (let x = x0; x < x1; x++) {
        const si = (Math.min(x1 - 1, Math.max(x0, x + off)) - x0) * 4, di = base + x * 4;
        d[di] = row[si]; d[di + 1] = row[si + 1]; d[di + 2] = row[si + 2]; d[di + 3] = row[si + 3];
      }
    }
  }
  const inE = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  function inT(x, y, ax, ay, bx, by, cx, cy) {
    const s1 = (x - bx) * (ay - by) - (ax - bx) * (y - by), s2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy), s3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
    return !((s1 < 0 || s2 < 0 || s3 < 0) && (s1 > 0 || s2 > 0 || s3 > 0));
  }
  function shape(w, h, paint) {
    const rows = [];
    for (let y = 0; y < h; y++) { let s = ""; for (let x = 0; x < w; x++) s += paint(x + 0.5, y + 0.5, x, y) || "."; rows.push(s); }
    return rows;
  }
  function outline(rows, c) {
    const h = rows.length, w = rows[0].length, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? "." : rows[y][x]);
    return rows.map((row, y) => row.split("").map((ch, x) => (ch !== "." ? ch :
      (at(x - 1, y) !== "." || at(x + 1, y) !== "." || at(x, y - 1) !== "." || at(x, y + 1) !== ".") ? c : ".")).join(""));
  }

  // ---- sprites ----
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
  const CRATE = (() => {
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
  // Anglerfish facing left; the lure is drawn separately so it can sway. open: jaw dropped.
  function angler(open, fin) {
    return shape(30, 19, (x, y, ix, iy) => {
      const body = inE(x, y, 16, 10, 9.5, 6.6), head = inE(x, y, 9.5, 10.5, 6.5, 6.2);
      const jaw = inE(x, y, 8, 13.6 + open, 6.6, 2.6), tail = inT(x, y, 24, 10, 29.6, 3.4, 29.6, 16.6);
      const dorsal = inT(x, y, 15, 4.4, 21, 4.4, 19, 1.2), pec = inE(x, y, 17, 15.4 + fin, 2.6, 1.5);
      const mouth = x < 10.5 && y > 10.2 && y < 12.4 + open && (head || jaw);
      if (ix === 11 && iy === 7) return "u";                                                 // small pale eye
      if (mouth) return (iy === 10 || iy === Math.floor(12.4 + open) - 0) && ix % 2 === 1 && ix < 10 ? "t" : "z";
      if (pec) return fin ? "w" : "x";
      if (body || head || jaw) return iy <= 4 || (head && iy <= 5 && ix < 12) ? "w" : iy >= 15 ? "y" : (ix + iy * 3) % 11 === 0 ? "y" : "x";
      if (tail) return iy % 3 === 0 ? "x" : "y";
      if (dorsal) return "y";
      return null;
    });
  }
  const ANGLER = [angler(0, 0), angler(0, 1), angler(1, 0), angler(1, 1)];
  // Yeti-like armoured crab with hairy claws. pose 0: both claws up, 1: both mid, 2: left up / right down.
  function crab(pose) {
    const lUp = pose !== 1, rUp = pose === 0;
    return outline(shape(22, 15, (x, y, ix, iy) => {
      const shell = inE(x, y, 11, 10, 5.4, 3.2);
      const lc = inE(x, y, 4.2, lUp ? 3.4 : 7.2, 2.6, 2.2), rc = inE(x, y, 17.8, rUp ? 3.4 : 7.2, 2.6, 2.2);
      const la = Math.abs(x - (lUp ? 6.4 : 6.0)) < 0.8 && y > (lUp ? 4.5 : 8.2) && y < 9.5;
      const ra = Math.abs(x - (rUp ? 15.6 : 16.0)) < 0.8 && y > (rUp ? 4.5 : 8.2) && y < 9.5;
      const legs = iy >= 11 && iy <= 13 && (ix === 6 - (iy - 11) || ix === 8 - (iy - 11) || ix === 14 + (iy - 11) || ix === 16 + (iy - 11));
      if (ix === 9 && iy === 8) return "z";
      if (ix === 13 && iy === 8) return "z";
      if (lc || rc) return (hash(ix, iy, 71) % 3 === 0) ? "t" : (ix + iy) % 2 ? "c" : "u";     // fuzzy claws
      if (shell) return iy <= 8 ? "u" : "v";
      if (la || ra) return "v";
      if (legs) return "v";
      return null;
    }), "x");
  }
  function bell() {                               // old diving bell, 30 × 26; the porthole glass is drawn each frame
    const cx = 14.5;
    return shape(30, 26, (x, y, ix, iy) => {
      if (iy <= 3) {                                                                        // lifting eye
        if (iy === 0) return ix >= 13 && ix <= 16 ? "w" : null;
        if (iy < 3) return ix === 12 || ix === 17 ? "x" : null;
        return ix >= 11 && ix <= 18 ? "x" : null;
      }
      const half = iy <= 11 ? 13 * Math.sqrt(Math.max(0, 1 - ((11.5 - y) / 8.2) ** 2)) : iy <= 22 ? 13 + (iy - 12) * 0.12 : 15;
      if (Math.abs(x - cx) > half) return null;
      const pd = Math.sqrt((x - cx) ** 2 + (y - 17.5) ** 2);
      if (pd < 3.4) return "y";
      if (pd < 4.8) return x + y < 30.5 ? "d" : x + y > 34.5 ? "f" : "F";                  // brass porthole rim
      if (iy >= 23) return iy === 23 ? "v" : iy === 24 ? "w" : "x";                        // heavy foot ring
      if (iy === 12) return ix % 4 === 1 ? "v" : "y";                                       // seam and rivets
      const u = (x - (cx - half)) / (2 * half);
      let c = u < 0.2 ? "v" : u < 0.55 ? "w" : u < 0.85 ? "x" : "y";
      const rust = hash(ix >> 1, iy >> 1, 70) % 7;
      if (rust === 0) c = "f";
      else if (rust === 1 && iy > 12 && ix % 3 === 0) c = "a";
      return c;
    });
  }
  function hopper() {                             // bin: riveted iron hopper on legs, 32 × 32
    return shape(32, 32, (x, y, ix, iy) => {
      if (iy <= 2) return iy === 0 ? "u" : iy === 1 ? (ix % 6 === 2 ? "x" : "v") : "w";
      const inset = Math.floor(((iy - 3) * 7) / 18);
      if (iy <= 21 && ix >= inset && ix <= 31 - inset) {
        if (ix <= inset + 1) return "v";
        if (ix >= 30 - inset) return "y";
        if (iy === 10) return ix % 5 === 2 ? "x" : "v";                                      // riveted band
        return hash(ix, iy, 72) % 13 === 0 ? "f" : "w";
      }
      if (iy >= 22 && iy <= 25 && ix >= 12 && ix <= 19) return iy === 25 ? "y" : ix <= 13 ? "w" : "x";   // spout
      if ((ix === 3 || ix === 4 || ix === 27 || ix === 28) && iy >= 12) return iy === 31 ? "y" : ix === 3 || ix === 27 ? "w" : "x";
      if (iy === 31 && (ix === 2 || ix === 5 || ix === 26 || ix === 29)) return "y";
      return null;
    });
  }

  // ---- layout ----
  const VENTS = [                                 // the chimney row; w0/w1: half width at the foot / at the mouth
    { cx: 121, top: 72, w0: 11, w1: 5, life: 46, rise: 1.6, lean: 0, rmax: 10, seed: 1, flanges: [[98, 1, 4]] },
    { cx: 163, top: 40, w0: 14, w1: 6, life: 34, rise: 1.7, lean: 0, rmax: 12, seed: 2, flanges: [[68, -1, 5], [106, 1, 4]] },
    { cx: 205, top: 88, w0: 10, w1: 5, life: 28, rise: 1.0, lean: 0.75, rmax: 8, seed: 3, flanges: [[118, -1, 3]] },
  ];
  const FAR = [[18, 80, 4], [46, 94, 3], [234, 104, 3], [266, 90, 5], [304, 100, 4]];   // distant chimneys: x, top, half width
  const WARM = { z: "g", y: "g", g: "f", x: "w" };          // dark orange heat at the mouths (background only)
  const COLD = { z: "y", y: "x", g: "x", x: "w", w: "v" };   // the angler's cold lamp (background only)
  const ventAxis = (v, y) => v.cx + Math.round(1.5 * Math.sin((y - v.top) / 13 + v.seed));
  function ventHalf(v, y) {
    const t = (y - v.top) / (FLOOR - v.top);
    return Math.round(v.w1 + (v.w0 - v.w1) * Math.pow(t, 0.7)) + (hash((y - v.top) >> 2, v.seed, 61) % 3) - 1;
  }
  function basalt(x, y, top) {                    // dark basalt and silt in soft, wavy layers
    const dy = y - top;
    if (dy === 0) return hash(x, y, 55) % 4 ? "x" : "w";
    if (dy === 1) return hash(x, y, 56) % 3 ? "y" : "x";
    const sy = dy + tri(x + top, 70, 2) + tri(x * 3 + 11, 38, 1), band = Math.floor(sy / 7), k = sy - band * 7;
    if (k === 0 && hash(x >> 2, band, 57) % 5) return "z";
    if (k === 1 && hash(x >> 3, band, 58) % 3 === 0) return "x";
    const h = hash(x, y, 60) % 53;
    return h === 0 ? "w" : h < 4 ? "x" : h < 7 ? "z" : "y";
  }

  // ---- static layers ----
  function buildBack() {
    const r = layer();
    r.rect(0, 0, W, H, "z");                                  // the eternal night of the deep sea
    for (let x = 0; x < W; x++) {                             // far ridge, only a dither darker than night
      const top = 128 + tri(x + 30, 96, 4) + (hash(x >> 3, 0, 53) % 3);
      for (let y = top; y < FLOOR + 4; y++) if (bay(x, y) < (y > top + 3 ? 9 : 4)) r.set(x, y, "y");
    }
    FAR.forEach(([fx, ftop, fh], i) => {                       // far chimneys
      for (let y = ftop; y < 132; y++) {
        const h = fh + Math.floor((y - ftop) / 9) + (hash((y - ftop) >> 2, i, 54) % 2);
        for (let x = fx - h; x <= fx + h; x++) if (bay(x, y) < 10) r.set(x, y, "y");
      }
      r.hline(fx - fh + 2, ftop, 2 * fh - 3, "g");
    });
    return r;
  }
  function chimney(r, v) {
    for (let y = v.top; y < FLOOR; y++) {
      const ax = ventAxis(v, y), h = ventHalf(v, y), dt = y - v.top;
      for (let x = ax - h; x <= ax + h; x++) {
        const u = (x - (ax - h)) / (2 * h);
        let c = u < 0.16 ? "w" : u > 0.66 ? "y" : "x";
        const s = hash(x, y >> 2, 62 + v.seed) % 9;                                         // mineral streaks
        if (s === 0) c = c === "w" ? "x" : "y";
        else if (s === 1 && c === "x") c = "w";
        if (dt < 40 && u < 0.66 && hash(x >> 1, y >> 1, 63 + v.seed) % 61 === 0) c = hash(x, y, 64) & 1 ? "k" : "b";   // sulphide specks
        const crust = 3 + (hash(x, v.seed, 65) % 4);                                       // sulphur crust under the lip
        if (dt <= 1) c = Math.abs(x - ax) >= h - 1 ? "l" : "a";
        else if (dt < crust) c = (x + y) % 3 === 0 ? "l" : u > 0.66 ? "b" : "k";
        r.set(x, y, c);
      }
    }
    for (const [fy, side, len] of v.flanges) {                // flanges: little shelves of mineral
      for (let j = 0; j < 3; j++) {
        const ax = ventAxis(v, fy + j), h = ventHalf(v, fy + j);
        for (let i = 1; i <= len - j; i++) {
          const x = side < 0 ? ax - h - i : ax + h + i;
          r.set(x, fy + j, j === 0 ? (hash(x, fy, 66) % 3 ? "w" : "k") : j === 2 ? "y" : "x");
        }
      }
    }
    for (let k = 0; k < 2; k++) {                             // glowing heat cracks below the mouth
      let ox = (hash(k, v.seed, 67) % (2 * v.w1 - 3)) - v.w1 + 2;
      const len = 8 + (hash(k, v.seed, 68) % 10);
      for (let j = 0; j < len; j++) {
        const y = v.top + 4 + j, lim = ventHalf(v, y) - 2;
        if (j % 3 === 2) ox += (hash(j, k + v.seed, 69) % 3) - 1;
        ox = Math.max(-lim, Math.min(lim, ox));
        r.set(ventAxis(v, y) + ox, y, j < 2 ? "j" : "a");
      }
    }
  }
  function buildGround() {
    const r = layer();
    VENTS.forEach((v) => chimney(r, v));
    for (let y = FLOOR; y < H; y++) for (let x = 0; x < W; x++) r.set(x, y, basalt(x, y, FLOOR));
    for (const v of VENTS) for (let x = v.cx - v.w0 - 8; x <= v.cx + v.w0 + 8; x++) {       // sulphur and rust at the feet
      const d = Math.abs(x - v.cx) - v.w0;
      for (let y = FLOOR; y < FLOOR + 3; y++) {
        const h = hash(x, y, 90 + v.seed) % 8;
        if (d < 3 - (y - FLOOR) * 2 && h < 2) r.set(x, y, h === 0 ? "k" : "b");
      }
    }
    for (let x = 0; x < LEDGE.x1; x++) {                      // basalt shelf on the left
      const top = LEDGE.y0 + Math.max(0, x - 60);
      const bot = x < 44 ? LEDGE.y1 - 1 - (hash(x >> 2, 0, 66) % 2) : LEDGE.y1 - 1 - Math.round(((x - 44) * (x - 44)) / 48);
      for (let y = top; y <= bot; y++) r.set(x, y, y === bot ? "y" : basalt(x, y, LEDGE.y0));
    }
    for (let y = STEP.y0; y < FLOOR; y++) for (let x = STEP.x0; x < W; x++) r.set(x, y, x === STEP.x0 && y > STEP.y0 + 1 ? "w" : basalt(x, y, STEP.y0));
    for (let x = 64; x < 100; x++) {                          // silt drifted against the bell
      const top = FLOOR - Math.max(0, 3 - Math.floor(Math.abs(x - 82) / 6));
      for (let y = top; y < FLOOR; y++) r.set(x, y, y === top ? "w" : "x");
    }
    spr(r, L.BELL, 68, 122);
    spr(r, L.HOPPER, BIN.x0, BIN.y0);
    for (let j = 1; j <= 3; j++) {                            // ore already collected, heaped over the rim
      const hw = [0, 12, 9, 5][j];
      for (let x = BIN.x0 + 16 - hw; x < BIN.x0 + 16 + hw; x++) {
        const h = hash(x, j, 73) % 6;
        r.set(x, BIN.y0 - j, h < 2 ? "k" : h < 4 ? "b" : h < 5 ? "F" : "l");
      }
    }
    return r;
  }
  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    L = { BELL: bell(), HOPPER: hopper(), CRAB: [crab(0), crab(1), crab(2)] };
    L.back = buildBack();
    L.ground = buildGround();
    const props = layer();
    spr(props, CRATE, 48, FLOOR - 16);
    spr(props, CRATE, 48, LEDGE.y0 - 16);
    spr(props, PORTER, 32, FLOOR - 16);
    L.props = props;
  }

  // ---- ambient (4 fps) ----
  function farPlumes(r, a) {                      // the distant smokers smoke too: dithered columns creeping upwards
    FAR.forEach(([fx, ftop, fh], i) => {
      for (let d = 1; d < 64 && ftop - d >= 0; d++) {
        const y = ftop - d, half = fh - 1 + (d >> 3) + tri(d + a + i * 5, 16, 1), cx = fx + (d >> 4), dens = 8 - (d >> 3);
        for (let x = cx - half; x <= cx + half; x++) if (bay(x, y + a) < dens) r.set(x, y, "y");
      }
    });
  }
  function plume(r, v, a) {                       // black smoke: puffs leave the mouth, swell, roll and thin out
    const P = 3, T = a + v.seed * 2, newest = Math.floor(T / P);
    for (let n = newest - Math.ceil(v.life / P); n <= newest; n++) {     // oldest first; newer puffs roll over older ones
      const age = T - n * P;
      if (age < 0 || age >= v.life) continue;
      const rad = Math.min(v.rmax, 3 + Math.floor(age * 0.5));
      const sway = Math.round((tri(a + v.seed * 13, 64, 3) * age) / v.life);
      const px = ventAxis(v, v.top) + Math.round(v.lean * age) + (n & 1 ? 2 : -2) + tri(age + n * 5, 18, 1) + sway;
      const py = v.top - 2 - Math.floor(age * v.rise);
      const fade = age > v.life * 0.6 ? Math.floor((16 * (v.life - age)) / (v.life * 0.4)) : 16;
      const body = age < 3 ? "f" : age < v.life * 0.5 ? "g" : "y", spin = age * 0.5 + n * 2.1;
      for (let y = py - rad; y <= py + rad; y++) for (let x = px - rad; x <= px + rad; x++) {
        const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
        if (d2 > rad * rad + rad * 0.6 || bay(x, y) >= fade) continue;
        let c = body;
        const edge = d2 > (rad - 1.2) * (rad - 1.2);
        if (edge && dx + dy < -rad * 0.7 && n % 3) c = body === "f" ? (age < 2 ? "a" : "g") : "x";      // lit billow edge
        else if (edge && dx + dy > rad * 0.5) c = "z";
        else if (rad > 3) {
          const d = Math.sqrt(d2), ang = Math.atan2(dy, dx), da = Math.abs((((ang - spin) % 6.283) + 9.425) % 6.283 - 3.1416);
          if (Math.abs(d - rad * 0.55) < 0.8 && da < 0.8) c = body === "f" ? "g" : "z";          // a curl turning inside
        }
        r.set(x, y, c);
      }
    }
  }
  function grains(r, a) {                         // particles: ore sinks, the hot flow sweeps it right into the bin
    for (let i = 0; i < 10; i++) {
      const T = a + i * 5, t = T % 48, cyc = Math.floor(T / 48), x0 = 199 + (hash(i, cyc, 65) % 14);
      let x, y;
      if (t < 24) { x = x0 + tri(t + i * 3, 12, 1); y = t * 3 + (hash(i, cyc, 66) % 3); }
      else { const s = (t - 24) / 24; x = x0 + Math.round(44 * (1 - (1 - s) * (1 - s))); y = 72 + Math.round(42 * s * s); }
      r.set(x, y, i % 3 ? "k" : "b");
      if (t >= 24) r.set(x - 1, y - (t > 36 ? 1 : 0), "F");                               // a short trail: swept sideways
      else if (t > 0) r.set(x, y - 1, "F");
    }
  }
  function snow(r, a, k0, k1) {                   // marine snow drifting down
    for (let k = k0; k < k1; k++) {
      const slow = 2 + (k % 3), y = ((hash(k, 1, 52) % 196) + Math.floor(a / slow)) % 196 - 8;
      const x = (hash(k, 0, 51) % W) + tri(a + k * 13, 40 + (k % 5) * 8, 1);
      r.set(x, y, k % 9 === 0 ? "u" : k % 3 === 0 ? "v" : "w");
      if (k % 7 === 0) r.set(x + 1, y, "w");
    }
  }
  function mouths(r, a) {                         // dark orange heat flickering in the mouths
    for (const v of VENTS) for (let y = v.top; y <= v.top + 1; y++) {
      const ax = ventAxis(v, y), h = ventHalf(v, y);
      for (let x = ax - h + 2; x <= ax + h - 2; x++) {
        const q = hash(x, a + y, 75 + v.seed) % 5;
        r.set(x, y, y === v.top ? (q === 0 ? "k" : q < 3 ? "j" : "a") : q === 0 ? "j" : "a");
      }
    }
  }
  const WORMS = [
    [4, 100, 10], [7, 100, 14], [11, 100, 8], [14, 100, 16], [18, 100, 12], [21, 100, 9], [25, 100, 13], [28, 100, 7],
    [135, FLOOR, 9], [138, FLOOR, 14], [142, FLOOR, 11], [145, FLOOR, 7], [180, FLOOR, 12], [184, FLOOR, 8], [187, FLOOR, 15],
  ];
  const CROWN = [[], [".hh."], [".ii.", "hiih", ".hh."], ["..i.", ".ii.", "iAih", "hiih", ".hh."]];
  function worms(r, a) {                          // tube worms: blood-red plumes pull in together, then unfurl again
    WORMS.forEach(([x0, base, h], i) => {
      const top = base - h, bend = (hash(i, 1, 76) % 5) - 2, xt = x0 + Math.round(bend * 0.6);
      for (let y = top; y < base; y++) {
        const q = (base - y) / h, x = x0 + Math.round(bend * q * q * 0.6), ring = (y - top) % 3 === 2;
        r.set(x, y, ring ? "v" : "u"); r.set(x + 1, y, ring ? "w" : "v");
      }
      const p = (a + (hash(i, 0, 74) % 4) + (i < 8 ? 0 : 9)) % 24;
      const e = p < 12 ? 3 : p === 12 ? 2 : p === 13 ? 1 : p < 18 ? 0 : p === 18 ? 1 : p === 19 ? 2 : 3;
      const rows = CROWN[e], sw = e === 3 ? tri(a + i * 3, 8, 1) : 0;
      rows.forEach((row, j) => {
        for (let k = 0; k < 4; k++) if (row[k] !== ".") r.set(xt - 1 + k + (j < 2 ? sw : 0), top - rows.length + 1 + j, row[k]);
      });
      if (!e) r.set(xt, top, "h");
    });
  }
  const SHRIMP = ["uut", "v.."];
  function shrimp(r, a) {                         // blind white shrimp crowding the warm flanks of the big chimney
    const v = VENTS[1];
    for (let i = 0; i < 12; i++) {
      const left = i < 6, y0 = left ? 76 + i * 4 : 100 + (i - 6) * 4, ax = ventAxis(v, y0), h = ventHalf(v, y0);
      const moving = hash(i, a, 69) % 3 === 0;
      const dx = moving ? (hash(i, a, 67) % 3) - 1 : 0, dy = moving ? (hash(i, a, 68) % 3) - 1 : 0;
      const x = left ? ax - h + 1 + (i % 2) * 3 + dx : ax + h - 3 - (i % 2) * 3 + dx;
      spr(r, SHRIMP, x, y0 + dy, !left);
    }
  }
  function porthole(r, a) {                       // underwater: the water line inside the old bell rocks a little
    const cx = 82.5, cy = 139.5, wl = 140 + tri(a, 14, 1);
    for (let y = 136; y <= 143; y++) for (let x = 79; x <= 86; x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 >= 3.4 * 3.4) continue;
      r.set(x, y, y < wl ? (x === 80 && y === 137 ? "t" : "y") : y === wl ? "r" : "q");
    }
  }
  function bubbles(r, a) {                        // underwater: now and then a few small bubbles leave the figure
    const t0 = a % 22;
    for (let k = 0; k < 3; k++) {
      const t = t0 - [0, 3, 7][k];
      if (t < 0 || t > 12) continue;
      const x = 40 + (k === 1 ? 1 : 0) + tri(t + k * 2, 6, 1), y = 130 - Math.floor(t * 1.4);
      if (y < 118) continue;
      if (t > 5 && k !== 2) { r.set(x, y, "t"); r.set(x + 1, y, "u"); r.set(x, y + 1, "u"); r.set(x + 1, y + 1, "v"); }
      else r.set(x, y, "t");
    }
  }

  // ---- animals (8 fps) ----
  function anglerAt(tick) {
    const x = 62 + tri(tick, 200, 3), y = 42 + tri(tick + 30, 72, 2), sw = tri(tick, 16, 2);
    return { x, y, bx: x + 3 + sw, by: y - 5 + (Math.abs(sw) >> 1) };
  }
  function drawAngler(r, tick, f) {               // hangs in the dark; its lamp bobs and swings on the stalk
    const open = tick % 40 >= 26 && tick % 40 < 34 ? 1 : 0, fin = (tick >> 2) & 1;
    spr(r, ANGLER[open * 2 + fin], f.x, f.y);
    const x0 = f.x + 11, y0 = f.y + 4, cx = f.x + 9, cy = f.y - 6;
    for (let k = 0; k <= 14; k++) {
      const t = k / 14, u = 1 - t;
      r.set(Math.round(u * u * x0 + 2 * u * t * cx + t * t * f.bx), Math.round(u * u * y0 + 2 * u * t * cy + t * t * f.by), "w");
    }
    r.set(f.bx - 1, f.by, "u"); r.set(f.bx + 1, f.by, "u"); r.set(f.bx, f.by - 1, "u"); r.set(f.bx, f.by + 1, "u");
    r.set(f.bx, f.by, "t");
  }
  const CRAB_SEQ = [0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1];
  function drawCrab(r, tick) {                    // waves its furry claws beside the bin
    spr(r, L.CRAB[CRAB_SEQ[tick % 32]], 274, FLOOR - 15);
  }

  window.PB_CONCEPT_SCENES["vent"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer(), fish = anglerAt(tick);
      r.data.set(L.back.data);
      farPlumes(r, a);
      for (const v of VENTS) glow(r, ventAxis(v, v.top), v.top - 1, 15 + tri(a + v.seed * 7, 14, 1), WARM);
      glow(r, fish.bx, fish.by, 14, COLD);
      snow(r, a, 0, 24);
      for (const v of VENTS) plume(r, v, a);
      for (const v of VENTS) {
        const ax = ventAxis(v, v.top);
        shimmer(r, ax - 10, ax + 11 + Math.round(v.lean * 14), v.top - 22, v.top - 1, a + v.seed);
      }
      grains(r, a);
      r.blit(L.ground, 0, 0);
      mouths(r, a);
      worms(r, a);
      shrimp(r, a);
      porthole(r, a);
      snow(r, a, 24, 36);
      drawAngler(r, tick, fish);
      drawCrab(r, tick);
      bubbles(r, a);
      r.blit(L.props, 0, 0);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
