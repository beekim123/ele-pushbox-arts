/* ART-04q 地图概念场景 · 穴居土院（matmata）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 侧视剖面：地面上只有平坦的赭土，往下是一个圆形大坑院；两侧土墙剖开，露出一层层挖进去的房间和粮仓。
 * 地标：圆形大坑院、土墙里的房间与粮仓、石灰白的拱形门框、成排的橄榄油陶罐。
 * 机关外观：pour（从天井边往下倒沙，坑底堆成两级沙台阶，通到墙里的粮仓）、ladder（木梯）、
 *           fall（上层房间地面的缺口，下面是暗室）。只示意外观，不实现规则。
 * 环境（4 fps）：天井顶光在坑底投下的亮圆随太阳慢慢移动；天井边的细土不时落下一缕；绳上的织毯轻轻晃。
 * 动物（8 fps）：沙蜥（怪物，在土墙洞口探头又缩回）、耳廓狐（提示动物，大耳朵转向梯子）。
 * 比例尺：主角大小的人影 + 2 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4
  const SURF = OY + 16;                           // 20: the desert surface
  const FLOOR = OY + 9 * 16;                      // 148: courtyard floor
  const PX0 = 80, PX1 = 240;                      // the pit (courtyard) between the two cut walls
  const BASE = 140;                               // foot of the back wall; far floor strip 140–147
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null, REV = null;            // L: static layers, built once; REV: rgb → palette code

  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    return Math.floor(((p < half ? p : period - p) * 4 * amp) / period) - amp;
  }
  const hash = (x, y, s) => PB.h32(x, y, s);
  const layer = () => new PB.Raster(W, H);
  function spr(r, rows, x, y, flip, map, clipX) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j], w = row.length;
      for (let i = 0; i < w; i++) {
        let c = row[flip ? w - 1 - i : i];
        if (c === "." || (clipX != null && x + i < clipX)) continue;
        if (map && map[c]) c = map[c];
        r.set(x + i, y + j, c);
      }
    }
  }
  // Re-paint already drawn pixels through a palette map (light without blending).
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
  // Vertical colour bands with a short ordered-dither seam between neighbours.
  function bands(r, stops, seam) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = stops[0][1];
      for (let i = 1; i < stops.length; i++) {
        const sy = stops[i][0];
        if (y >= sy + seam) { c = stops[i][1]; continue; }
        if (y >= sy - seam && bay(x, y) < Math.floor(((y - sy + seam) * 16) / (2 * seam + 1))) c = stops[i][1];
        break;
      }
      r.set(x, y, c);
    }
  }
  // Small sprites are painted from shapes, then outlined, so they stay tidy at 16 px.
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
  // Fennec fox, sitting, facing left. tilt moves both ear tips (the ears swivel before the head turns).
  function fox(tilt, tail) {
    return outline(shape(20, 17, (x, y, ix, iy) => {
      if (ix === 4 && iy === 8) return "z";                                                 // eye
      if (ix === 0 && iy === 9) return "z";                                                 // nose
      const ear1 = inT(x, y, 2.2, 7.2, 5.0, 6.4, 1.0 + tilt, 0.3), ear2 = inT(x, y, 5.0, 6.6, 8.2, 7.4, 8.8 + tilt, 0.5);
      const in1 = inT(x, y, 2.9, 6.8, 4.4, 6.4, 1.8 + tilt, 2.0), in2 = inT(x, y, 5.8, 6.8, 7.6, 7.2, 8.4 + tilt, 2.2);
      const head = inE(x, y, 5.4, 8.6, 2.9, 2.3), snout = inT(x, y, 3.4, 7.8, 3.4, 10.6, 0.2, 9.7);
      const body = inE(x, y, 9.8, 12.9, 3.4, 3.3), legs = (x > 5.4 && x < 7.4 && y > 11) || (x > 11 && x < 13.2 && y > 14);
      const tl = inE(x, y, 14.6 + (tail ? 0.3 : 0), 14.7 - (tail ? 0.7 : 0), 3.8, 1.6);
      if (in1 || in2) return "D";
      if (ear1 || ear2) return "d";
      if (head || snout) return y < 7.6 ? "d" : "c";
      if (legs && y < 16.2) return y > 15 ? "F" : "c";
      if (body) return x < 8.4 ? "c" : y > 15 ? "F" : "d";
      if (tl) return x > 17.2 ? "g" : y < 14.2 ? "d" : "F";
      return null;
    }), "z");
  }
  const FOX = [fox(0, 0), fox(0, 1), fox(1.6, 0)];
  // Sand lizard poking its head out of a hole, facing right. Frame 1 flicks its tongue.
  function lizard(tongue) {
    return outline(shape(17, 9, (x, y, ix, iy) => {
      if (ix === 8 && iy === 3) return "l";                                                 // yellow eye
      if (ix === 9 && iy === 3) return "z";
      if (tongue && iy === 5 && ix >= 13 && ix <= 14) return "A";
      if (tongue && ix === 15 && (iy === 4 || iy === 6)) return "A";
      const head = inE(x, y, 8.3, 4.4, 3.6, 2.4), snout = inE(x, y, 11.0, 4.9, 2.2, 1.4), neck = x < 6.5 && y > 2.6 && y < 7.2;
      const claw = (ix === 8 || ix === 10) && iy === 7;
      if (claw) return "w";
      if (!(head || snout || neck)) return null;
      if (iy === 6 || (iy === 5 && ix > 9)) return "u";                                     // pale throat
      if (iy <= 2 && (ix & 1)) return "w";                                                  // crest bumps
      return (ix + iy) % 4 === 0 ? "w" : "v";
    }), "z");
  }
  const LIZARD = [lizard(false), lizard(true)];
  const JAR = [                                   // olive-oil jar, dark glaze (background)
    "...ggg...",
    "...pop...",
    "..onnop..",
    ".onnnoop.",
    "onnnnooop",
    "onnnoooop",
    "onnnoooop",
    "onnoooopp",
    ".onoooop.",
    ".ooooopp.",
    "..ooopp..",
    "..oppp...",
    "..gggg...",
  ];

  // ---- the cut: rooms dug into the two side walls ----
  const ROOMS = [
    { x0: 30, x1: 80, top: 54, bottom: 68, rise: 5 },       // granary, upper left
    { x0: 38, x1: 80, top: 101, bottom: 116, rise: 5 },     // granary the sand steps lead to
    { x0: 240, x1: 306, top: 68, bottom: 100, rise: 9 },    // upper room, right
    { x0: 264, x1: 304, top: 124, bottom: 148, rise: 2 },   // dark cellar under it
  ];
  const GAP = { x0: 272, x1: 288, y0: 100, y1: 124 };      // fall: a hole in the upper room's floor
  const HOLE = { x: 77, y: 90 };                           // the lizard's hole in the left wall
  function roomAt(x, y) {
    for (let i = 0; i < ROOMS.length; i++) {
      const m = ROOMS[i];
      if (x < m.x0 || x >= m.x1 || y >= m.bottom) continue;
      const u = (x - (m.x0 + m.x1 - 1) / 2) / ((m.x1 - m.x0) / 2);
      if (y >= m.top + Math.round(m.rise * u * u)) return i + 1;
    }
    if (y >= GAP.y0 && y < GAP.y1 + 2) {                    // broken, ragged edges
      const j = y < GAP.y0 + 2 ? -1 : y >= GAP.y1 - 1 ? 1 : hash(y, 0, 2) % 3 === 0 ? 1 : 0;
      if (x >= GAP.x0 + j && x < GAP.x1 - j + (hash(y, 1, 2) % 3 === 0 ? 1 : 0)) return 5;
    }
    if (x < PX0 && (x - HOLE.x) ** 2 + (y - HOLE.y) ** 2 <= 11) return 6;
    return 0;
  }
  function solid(x, y) {
    if (y < SURF) return false;
    if (x >= PX0 && x < PX1) return y >= FLOOR;
    return !roomAt(x, y);
  }
  // Ochre earth: soft, gently waving strata with grit and the odd pebble (no bricks).
  function earth(x, y) {
    const sy = y + tri(x + 40, 150, 2) + tri(x + 7, 46, 1), band = Math.floor(sy / 9), k = sy - band * 9;
    const kind = hash(band, 0, 4) % 3;
    if (k === 0) return hash(x >> 2, band, 3) % 6 ? "e" : "f";
    if (k === 1 && hash(x >> 3, band, 9) % 3 === 0) return "d";
    const h = hash(x, y, 7) % 113;
    if (h === 0) return "v";
    if (h < 10) return "e";
    if (kind === 2 && hash(x, y, 10) % 5 === 0) return "e";
    return "F";
  }
  function roomColour(x, y, room) {
    if (room === 6) return (x - HOLE.x) ** 2 + (y - HOLE.y) ** 2 <= 4 ? "z" : "g";
    let d = 9;
    for (let k = 1; k <= 3 && d === 9; k++) if (solid(x - k, y) || solid(x + k, y) || solid(x, y - k) || solid(x, y + k)) d = k;
    const mouth = (room <= 2 && x >= PX0 - 6) || (room === 3 && x < PX1 + 6);   // whitewash catches light at the opening
    if (d === 1) return mouth ? "u" : "x";
    if (d === 2) return mouth ? "v" : bay(x, y) < 8 ? "x" : "y";
    return bay(x, y) < 4 ? "y" : "g";                          // the rooms stay dark
  }
  function inArch(x, y, x0, base, w, h, g) {
    const rad = w / 2 + g, cx = x0 + w / 2 - 0.5, cy = base - h + w / 2;
    if (y >= base || x < x0 - g || x > x0 + w - 1 + g) return false;
    if (y >= cy) return true;
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
  }
  function door(r, x0, base, w, h) {                        // lime-white arch frame, dark room behind
    for (let y = base - h - 3; y < base; y++) for (let x = x0 - 2; x < x0 + w + 2; x++) {
      if (inArch(x, y, x0, base, w, h, 0)) {
        const deep = x > x0 + 1 && x < x0 + w - 2 && y > base - h + (w >> 1);
        r.set(x, y, deep && bay(x, y) < 9 ? "z" : "g");
      } else if (inArch(x, y, x0, base, w, h, 2)) r.set(x, y, x >= x0 + (w >> 1) ? "w" : "v");
    }
  }
  function sandAt(x, y) {
    const h = hash(x, y, 31) % 16;
    return h < 2 ? "k" : h < 7 ? "c" : h < 15 ? "d" : "F";
  }
  // pour: two sand steps against the left wall; the upper one is level with the granary floor (y 116).
  function pileTop(x) {
    if (x < PX0 || x > 111) return 999;
    let t = x < 96 ? 116 : 132;
    if (x <= 89) t -= [2, 3, 3, 3, 2, 2, 1, 1, 0, 0][x - PX0];       // little cone where the stream lands
    if (x >= 93 && x <= 95) t += x - 92;
    if (x >= 109) t += x - 108;
    return t;
  }

  // ---- static layers ----
  function buildBack() {
    const r = layer();
    bands(r, [[0, "u"], [12, "c"]], 2);                     // bleached noon sky over a flat horizon
    for (const [x0, w] of [[20, 7], [287, 6]]) {            // far away, the rims of other pit houses
      r.hline(x0, 19, w, "e"); r.set(x0 - 1, 19, "F"); r.set(x0 + w, 19, "F");
    }
    // back wall of the round pit, in shade; it bends away (darker) towards both cut walls
    for (let y = SURF; y < BASE; y++) for (let x = PX0; x < PX1; x++) {
      const sy = y + tri(x + 17, 120, 2), band = Math.floor(sy / 8);
      let c = sy - band * 8 === 0 && hash(x >> 2, band, 21) % 5 ? "f" : hash(x, y, 20) % 7 === 0 ? "f" : "e";
      if (hash(x, y, 22) % 29 === 0) c = "F";
      else if (hash(x, y, 23) % 37 === 0) c = "f";
      const edge = Math.min(x - PX0, PX1 - 1 - x);
      if (edge < 18 && bay(x, y) >= Math.floor((edge * 16) / 18)) c = c === "F" ? "e" : "f";
      if (y === SURF) c = "d";                              // far rim in the sun
      else if (y < SURF + 4) c = y === SURF + 1 ? "g" : "f"; // shadow under the lip
      r.set(x, y, c);
    }
    for (let y = BASE; y < FLOOR; y++) for (let x = PX0; x < PX1; x++) {     // far floor strip
      let c = y === BASE ? "f" : hash(x, y, 24) % 7 ? "F" : "e";
      const edge = Math.min(x - PX0, PX1 - 1 - x);
      if (edge < 16 && bay(x, y) >= Math.floor((edge * 16) / 16)) c = "e";
      r.set(x, y, c);
    }
    door(r, 100, 96, 12, 18); door(r, 206, 96, 12, 18); door(r, 190, BASE, 18, 26);
    for (const [x, y] of [[103, 102], [107, 108], [103, 114], [107, 120], [209, 102], [213, 108], [209, 114]]) {
      r.hline(x, y, 3, "g"); r.hline(x, y - 1, 3, "f");    // footholds up to the upper doors
    }
    for (let y = 114; y < 136; y++) for (let x = 144; x < 190; x++) {        // a long niche for the jars
      const fr = y < 116 || x < 146 || x >= 188;
      r.set(x, y, fr ? (x >= 167 ? "w" : "v") : y === 135 ? "f" : bay(x, y) < 6 ? "f" : "g");
    }
    for (let k = 0; k < 4; k++) spr(r, JAR, 147 + k * 10, 122);
    return r;
  }
  function buildGround() {
    const r = layer();
    for (let y = SURF; y < H; y++) for (let x = 0; x < W; x++) {
      if (!solid(x, y)) {
        const room = roomAt(x, y);
        if (room && (x < PX0 || x >= PX1)) r.set(x, y, roomColour(x, y, room));
        continue;
      }
      let c = earth(x, y);
      if (!solid(x, y - 1)) c = roomAt(x, y - 1) ? "e" : "d";              // lit top edge, dim inside rooms
      else if (y + 1 < H && !solid(x, y + 1)) c = "f";                       // underside shadow
      else if (!solid(x - 1, y) || !solid(x + 1, y)) c = c === "d" ? "F" : "e";
      r.set(x, y, c);
    }
    for (let x = 54; x < PX0 + 2; x++) {                    // the sand heap at the rim that is being poured in
      const top = SURF - Math.round(5 * Math.sin((Math.PI * Math.min(x - 52, 28)) / 30));
      for (let y = top; y < SURF + (x >= PX0 ? 2 : 0); y++) r.set(x, y, y === top ? "c" : sandAt(x, y));
    }
    for (let x = PX0; x <= 111; x++) {                      // the two sand steps
      const top = pileTop(x);
      for (let y = top; y < FLOOR; y++) r.set(x, y, y === top ? (hash(x, 0, 32) % 4 ? "c" : "k") : sandAt(x, y));
    }
    for (let x = 276; x < 286; x++) {                       // crumbs that fell through the hole
      const top = 147 - [0, 1, 1, 2, 2, 2, 1, 1, 0, 0][x - 276];
      for (let y = top; y < FLOOR; y++) r.set(x, y, hash(x, y, 33) % 3 ? "e" : "F");
    }
    return r;
  }
  function ladder(r, x0, y0, y1) {                          // two rails, a rung every 6 px
    for (let y = y0 - 3; y < y1; y++) { r.set(x0, y, "d"); r.set(x0 + 1, y, "e"); r.set(x0 + 12, y, "d"); r.set(x0 + 13, y, "e"); }
    for (let y = y0 + 2; y < y1 - 1; y += 6) { r.hline(x0 + 2, y, 10, "b"); r.hline(x0 + 2, y + 1, 10, "f"); }
  }
  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    const props = layer();
    ladder(props, 225, 100, FLOOR);
    spr(props, CRATE, 128, FLOOR - 16);
    spr(props, CRATE, 256, 84);
    spr(props, PORTER, 112, FLOOR - 16);
    L = { back: buildBack(), ground: buildGround(), props };
  }

  // ---- ambient (4 fps) ----
  const RUG = (() => {                            // kilim folded over the rope, 18 × 24
    const rows = [];
    for (let j = 0; j < 24; j++) {
      let s = "";
      for (let i = 0; i < 18; i++) {
        let c = "h";
        const dx = Math.abs(i - 8.5), dy = Math.abs(j - 12);
        if (j < 2) c = j === 0 ? "f" : "a";
        else if (j === 22) c = "f";
        else if (j === 23) c = i % 2 ? "c" : ".";
        else if (i === 0 || i === 17) c = "f";
        else if (j === 4 || j === 20) c = "a";
        else if ((j === 2 || j === 21) && i % 2) c = "c";
        else if (j >= 7 && j <= 17 && Math.abs(dx + dy - 5) < 0.6) c = "c";
        else if (j >= 7 && j <= 17 && dx + dy < 2.6) c = "e";
        s += c;
      }
      rows.push(s);
    }
    return rows;
  })();
  const ropeY = (x) => { const u = (x - PX0) / (PX1 - 1 - PX0); return Math.round(43 - 4 * u + 36 * u * (1 - u)); };
  function drawRug(r, a) {                        // the rope sags across the pit, the rug sways a little
    for (let x = PX0; x < PX1; x++) r.set(x, ropeY(x), "F");
    r.rect(PX0, 42, 2, 2, "g"); r.rect(PX1 - 2, 38, 2, 2, "g");
    const s = tri(a, 20, 2), top = ropeY(171) - 1;
    for (let j = 0; j < RUG.length; j++) {
      const sh = Math.round((s * j) / 23), row = RUG[j];
      for (let i = 0; i < row.length; i++) if (row[i] !== ".") r.set(162 + i + sh, top + j, row[i]);
    }
  }
  function drawTrickle(r, a) {                    // now and then a wisp of fine earth slips off the rim
    const cyc = 38, n = Math.floor(a / cyc), f = a % cyc;
    if (f >= 16) return;
    const x0 = n & 1 ? 214 : 118;
    if (f < 10) r.set(x0, SURF + 2, "F");
    for (let k = 0; k < 7; k++) {
      const t = f - k;
      if (t < 0) continue;
      const y = SURF + 3 + Math.floor(t * t * 0.9) + t * 2;
      if (y < BASE) r.set(x0 + (hash(k, n, 41) % 3) - 1 + (t > 6 ? k & 1 : 0), y, k % 3 ? "d" : "F");
    }
  }
  const poolX = (a) => 160 + tri(a, 200, 40);     // the sun moves: the bright circle drifts across the pit floor
  function light(r, cx) {                         // light only on the background: one palette step, Bayer edges
    const level = (x, y) => {
      const dx = Math.abs(x - cx);
      let lv = dx <= 9 ? 7 : dx <= 17 ? Math.floor((7 * (17 - dx)) / 8) : 0;       // the shaft from the skylight
      if (y > 100 && lv) lv += Math.floor((y - 100) / 8);
      const d = ((x - cx) / 30) ** 2 + ((y - 147) / 14) ** 2;                        // the bright circle at the bottom
      if (y >= 128) lv = Math.max(lv, d < 0.55 ? 16 : d < 1.15 ? Math.floor((16 * (1.15 - d)) / 0.6) : 0);
      return lv;
    };
    remap(r, cx - 31, SURF + 2, cx + 32, FLOOR, L.LIT, level);
  }
  function drawMotes(r, a, cx) {
    for (let k = 0; k < 5; k++) r.set(cx - 12 + ((k * 7) % 25) + tri(a + k * 11, 36, 2), 32 + ((k * 23 + (a >> 1)) % 100), "d");
  }
  function drawPour(r, a) {                       // pour: the sand stream from the rim down to the steps
    for (let y = SURF; y < 114; y++) {
      const x0 = y < 32 ? 80 : 81, w = y < 70 ? 3 : 2;
      for (let i = 0; i < w; i++) {
        const h = hash(x0 + i, y - a * 6, 34);
        if (h % 8 < 5) r.set(x0 + i, y, h % 7 === 0 ? "k" : h % 3 ? "d" : "c");
      }
    }
    for (let k = 0; k < 6; k++) {                 // grains bouncing where the stream lands
      const p = (a + k * 2) % 6, h = hash(k, Math.floor((a + k * 2) / 6), 35);
      const x = 81 + (h % 9) - 3, y = 112 - [0, 2, 3, 3, 2, 1][p] - ((h >> 4) & 1);
      if (x >= PX0) r.set(x, y, h % 3 ? "c" : "d");
    }
  }
  function drawCrumbs(r, a) {                     // fall: bits of earth drop through the hole into the cellar
    const cyc = 28, n = Math.floor(a / cyc), f = a % cyc;
    if (f >= 12) return;
    for (let k = 0; k < 3; k++) {
      const t = f - k * 3;
      if (t < 0) continue;
      const y = GAP.y0 + 1 + t * t + t;
      if (y <= 146) r.set(GAP.x0 + 2 + k * 5 + (hash(k, n, 42) % 3), y, k & 1 ? "e" : "F");
    }
  }

  // ---- animals (8 fps) ----
  function drawLizard(r, tick) {                  // peeks out of its hole, looks round, flicks its tongue, ducks back
    const p = tick % 56, out = p < 14 ? 0 : p < 16 ? 4 : p < 36 ? 9 : p < 38 ? 4 : 0;
    if (!out) { if (p > 5 && p < 14 && (p & 4)) r.set(HOLE.x, HOLE.y - 1, "l"); return; }
    const bob = out === 9 && (p >> 2) & 1 ? 1 : 0, lick = out === 9 && (p === 22 || p === 23 || p === 29 || p === 30) ? 1 : 0;
    spr(r, LIZARD[lick], 66 + out, HOLE.y - 5 + bob, false, null, 74);
  }
  function drawFox(r, tick) {                     // the ears swivel first, then the head turns to the ladder
    const p = tick % 64, x = 196, y = FLOOR - 17, tail = (tick >> 3) & 1;
    if (p < 28) spr(r, FOX[tail], x, y, false);
    else if (p < 31) spr(r, FOX[2], x, y, false);
    else if (p < 56) spr(r, FOX[(p >> 3) & 1], x, y + (p >= 40 && p < 44 ? 1 : 0), true);
    else if (p < 59) spr(r, FOX[2], x, y, true);
    else spr(r, FOX[0], x, y, false);
  }

  window.PB_CONCEPT_SCENES["matmata"] = {
    draw(ctx, tick) {
      if (!L) { build(); L.LIT = Object.assign({}, PB.LIGHT, { c: "c", m: "m", u: "u" }); }
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer(), cx = poolX(a);
      r.data.set(L.back.data);
      drawRug(r, a);
      drawTrickle(r, a);
      light(r, cx);
      drawMotes(r, a, cx);
      r.blit(L.ground, 0, 0);
      drawPour(r, a);
      drawCrumbs(r, a);
      drawLizard(r, tick);
      drawFox(r, tick);
      r.blit(L.props, 0, 0);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
