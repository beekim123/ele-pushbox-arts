/* ART-04s 地图概念场景 · 颠倒画廊（impossible_hall）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿、不用渐变和半透明。
 * 主色：石膏灰白 + 蓝色阴面；铬黄只用在门框和扶手（1px 线）。
 * 地标：四面互为上下的楼梯环、楼梯环顶上倒挂的天花板门、画框里的小房间（兼作 portal 外观）。
 * 环境（4 fps）：背景房间每 8 秒换一次"下"的方向——按 22.5° 一档、最近邻取整转过 90°；
 *   楼梯上的小摆件随后逐像素滑到新的地面；画框里的小房间每 0.75 秒转 15°。
 * 机关外观（只示意，不实现规则）：portal 画框、rotating_wall 带枢轴的石膏墙 + 虚线弧、fall 平台缺口（活板垂下、碎屑落下）。
 * 动物（8 fps）：画框怪（怪物，会走的空画框）；纸鹤（提示动物，飞到下一扇要进的门——画框——上方停一会儿）。
 * 比例尺：主角大小的人影 + 2 个木箱，站着不动；前景地面、平台、机关不跟背景转。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;
  const FLOOR = OY + 9 * 16;                      // 148: plaster floor (rule ground, never turns)
  const PLAT_X = 224, PLAT_Y = OY + 6 * 16;       // platform x 224–319, y 100–115
  const GAP_X = 256;                              // fall gap x 256–271
  const RW_X = 176, RW_Y = OY + 7 * 16;           // rotating wall x 176–191, y 116–147
  const FR_X = 16, FR_Y = OY + 7 * 16;            // portal frame x 16–47, y 116–147
  const PX = 160, PY = 74;                        // the background room turns about this screen point
  const RING = 60, INNER = 36, TEX = 180;         // stair ring outer / inner half size; texture half size
  const PERIOD = 32;                              // env frames between two changes of "down"
  const DOWN = [[0, 1], [1, 0], [0, -1], [-1, 0]];// screen-down in room coordinates after k quarter turns
  let PB = null, L = null;

  const layer = () => new PB.Raster(W, H);
  function spr(r, rows, x, y, flip, maxY) {
    x = Math.floor(x); y = Math.floor(y);
    for (let j = 0; j < rows.length; j++) {
      if (maxY != null && y + j >= maxY) break;
      const row = rows[j], w = row.length;
      for (let i = 0; i < w; i++) {
        const c = row[flip ? w - 1 - i : i];
        if (c !== ".") r.set(x + i, y + j, c);
      }
    }
  }

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
  const TRINKETS = [                              // 6×6 things on the stairs, always drawn upright
    [".qqqq.", "qsrrrq", "qrrrrq", "qrrrrq", "qqrrqq", ".qqqq."],   // blue ball
    ["xxxxxx", "xttttx", "xuuuvx", "xuuuvx", "xvvvvx", "xxxxxx"],   // plaster cube
    ["..xx..", ".xtux.", ".xuux.", ".xxxx.", "xtuuvx", "xxxxxx"],   // plaster bust
    ["..xx..", ".xtux.", ".xuvx.", "xtuuvx", "xuuvvx", "xxxxxx"],   // plaster cone
    [".qqqq.", "..qr..", ".qrrq.", "qrsrrq", "qrrrrq", ".qqqq."],   // blue vase
  ];
  const TRINKET_START = [[-36, -10], [-27, -4], [-14, -14], [6, -8], [26, -2]];
  const FRAME_BODY = [                            // walking empty picture frame (monster), facing right
    ".zzzzzzzzzzzzzz.",
    "zCCCCCCCCCCCCCCz",
    "zCBttBBBBBBttBBz",
    "zCBtzBBBBBBtzBgz",
    "zCBBBBBBBBBBBBgz",
    "zCBzzzzzzzzzzBgz",
    "zCBz........zBgz",
    "zCBz........zBgz",
    "zCBz........zBgz",
    "zCBz........zBgz",
    "zCBz........zBgz",
    "zCBz........zBgz",
    "zCBzzzzzzzzzzBgz",
    "zBBBBBBBBBBBBBgz",
    ".zzzzzzzzzzzzzz.",
  ];
  const FRAME_LEGS = [
    ["...zz.....zz....", "...zg.....zg....", "..zzz.....zzz..."],
    ["....zz...zz.....", "....gz...gz.....", "...zzz..zzz....."],
  ];
  const CRANE = [                                 // paper crane, facing left: wings up / level / down
    ["........x.....", ".......xtx....", "......xttx....", "xx...xtttx...x", "xtx.xttttux.xt", ".xtxttttttuxtx", "..xttttuuvvttx", "...xvvvvvvxxx.", "....xxxxxx....", "..............", ".............."],
    ["..............", "..............", "..............", "xx...........x", "xtx.........xt", ".xtxxxxxxxxxtx", "..xttttttuvttx", "...xvvvvvvxxx.", "....xxxxxx....", "..............", ".............."],
    ["..............", "..............", "..............", "xx...........x", "xtx.........xt", ".xtxx.....xxtx", "..xttttuuvvttx", "...xvttuvvxxx.", "....xttuvx....", ".....xtvx.....", "......xx......"],
  ];

  // ---- the turning room: a Penrose-like ring of four stair flights, each "up" for its own gravity ----
  // canon(): which flight a room point belongs to (0 bottom, 1 right, 2 top, 3 left) and its coordinates
  // (u along the flight, v outward from the centre) as if that flight were the bottom one.
  function canon(px, py) {
    if (-py < px && px <= py) return [0, px, py];
    if (-px < -py && -py <= px) return [1, -py, px];
    if (py < -px && -px <= -py) return [2, -px, -py];
    if (px < py && py <= -px) return [3, py, -px];
    return [0, 0, 0];
  }
  const stepTop = (u) => RING - 4 - 4 * Math.floor((u + 60) / 20);   // tread line: 56, 52, … 36
  const railV = (u) => Math.round(47 - (u + 50) / 5);
  const rot = (j, x, y) => (j === 0 ? [x, y] : j === 1 ? [-y, x] : j === 2 ? [-x, -y] : [y, -x]);
  const wallAt = (px) => (Math.abs(px) % 32 === 16 ? "w" : "v");    // panel seams run "up" in room space
  function doorPx(x, y) {                         // wall door (frame k) on a little ledge, room-left copy
    if (y >= 15 && y <= 17 && x >= -127 && x <= -105) return y === 15 ? "u" : y === 16 ? "v" : "x";
    if (x < -123 || x > -109 || y < -10 || y > 14) return null;
    const dx = x + 123, dy = y + 10;
    if (dx === 0 || dx === 14 || dy === 0) return "k";
    if (dx === 1 || dx === 13 || dy === 1) return "y";
    const inPanel = dx >= 4 && dx <= 10 && ((dy >= 4 && dy <= 11) || (dy >= 14 && dy <= 21));
    if (inPanel && (dx === 4 || dx === 10 || dy === 4 || dy === 11 || dy === 14 || dy === 21)) return "w";
    if (dx === 11 && dy === 13) return "u";
    return "x";
  }
  function picPx(px, py, x0, y0, w, h) {          // small plaster-framed painting hung on the wall
    const dx = px - x0, dy = py - y0;
    if (dx < 0 || dy < 0 || dx >= w || dy >= h) return null;
    if (dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1) return "x";
    if (dx === 1 || dy === 1) return "u";
    if (dx === w - 2 || dy === h - 2) return "v";
    const hill = h - 4 - Math.floor(Math.abs(dx - (w >> 1)) / 2);
    return dy >= hill ? "q" : "y";
  }
  function ceilingDoor(u, v) {                    // door standing on the top flight: hangs from the "ceiling"
    if (u === -17 || u === -4 || v === 24) return "k";
    if (u === -16 || u === -5 || v === 25) return "y";
    if (u >= -14 && u <= -7 && v >= 28 && v <= 44 && (u === -14 || u === -7 || v === 28 || v === 44)) return "w";
    if (u === -6 && v === 36) return "u";
    return "x";
  }
  function texAt(px, py) {
    const m = Math.max(Math.abs(px), Math.abs(py));
    if (m > RING) {                               // outer wall with four doors and two paintings
      for (let j = 0; j < 4; j++) { const p = rot(j, px, py), d = doorPx(p[0], p[1]); if (d) return d; }
      const pic = picPx(px, py, 80, -40, 18, 14) || picPx(px, py, -100, -52, 14, 18);
      return pic || wallAt(px);
    }
    const c = canon(px, py), sd = c[0], u = c[1], v = c[2];
    if (v === RING) return "x";                   // outer edge of the ring
    if (v >= INNER) {
      const top = stepTop(u);
      if (v >= top) {                             // step: tread / riser (blue shadow) / body
        if (v <= top + 1) return v === top ? "t" : "u";
        if (u >= -40 && (u + 60) % 20 === 0 && v < stepTop(u - 2)) return "u";
        return v === RING - 1 ? "x" : "w";
      }
    }
    if (sd === 2 && u >= -17 && u <= -4 && v >= 24 && v <= 47) return ceilingDoor(u, v);
    if (u >= -54 && u <= 46) {                    // chrome-yellow handrail on plaster posts
      const rv = railV(u);
      if (v === rv) return "k";
      if ((u + 60) % 20 === 10 && v > rv && v < stepTop(u)) return "w";
    }
    return wallAt(px);
  }
  function solidAt(px, py) {                      // where the little things cannot go
    if (Math.max(Math.abs(px), Math.abs(py)) >= RING) return true;
    const c = canon(px, py);
    return c[2] >= INNER && c[2] >= stepTop(c[1]);
  }

  // ---- little things sliding to the new floor (env frames, pixel by pixel, packed like stacked boxes) ----
  function freeAt(s, i, x, y) {
    for (let j = 0; j < s.length; j++) if (j !== i && Math.abs(s[j][0] - x) < 6 && Math.abs(s[j][1] - y) < 6) return false;
    for (let yy = y; yy < y + 6; yy++) for (let xx = x; xx < x + 6; xx++) if (L.solid(xx, yy)) return false;
    return true;
  }
  function slide(st, g, frames) {
    const gx = DOWN[g][0], gy = DOWN[g][1], s = st.map((p) => p.slice());
    const order = s.map((_, i) => i).sort((i, j) => (s[j][0] * gx + s[j][1] * gy) - (s[i][0] * gx + s[i][1] * gy));
    for (let f = 1; f <= frames; f++) {
      const sp = Math.min(6, 2 * f);
      for (const i of order) for (let n = 0; n < sp; n++) {
        const nx = s[i][0] + gx, ny = s[i][1] + gy;
        if (!freeAt(s, i, nx, ny)) break;
        s[i][0] = nx; s[i][1] = ny;
      }
    }
    return s;
  }
  function snapshot(k) {                          // state at the start of quarter turn k (memoised, loops detected)
    const S = L.snaps;
    if (L.loopAt >= 0 && k >= S.length) k = L.loopAt + ((k - L.loopAt) % (S.length - L.loopAt));
    while (k >= S.length) {
      const n = S.length, next = n === 0 ? slide(TRINKET_START, 0, 64) : slide(S[n - 1], (n - 1) & 3, PERIOD);
      const key = (n & 3) + ":" + next.join(";");
      if (L.seen.has(key)) {
        L.loopAt = L.seen.get(key);
        k = L.loopAt + ((k - L.loopAt) % (n - L.loopAt));
        break;
      }
      L.seen.set(key, n); S.push(next);
    }
    return S[k];
  }

  function build() {
    PB = window.PB;
    L = { snaps: [], seen: new Map(), loopAt: -1, bg: [] };
    const N = 2 * TEX, T = new Array(N * N), SOL = new Uint8Array(128 * 128);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) T[y * N + x] = texAt(x - TEX, y - TEX);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) SOL[y * 128 + x] = solidAt(x - 64, y - 64) ? 1 : 0;
    L.tex = (x, y) => (x >= -TEX && y >= -TEX && x < TEX && y < TEX ? T[(y + TEX) * N + x + TEX] : texAt(x, y));
    L.solid = (x, y) => (x >= -64 && y >= -64 && x < 64 && y < 64 ? SOL[(y + 64) * 128 + x + 64] === 1 : true);
    L.fore = buildFore();
  }
  function trig(A) {                              // exact for quarter turns, nearest-neighbour steps between
    if (A % 4 === 0) { const q = (A >> 2) & 3; return [[1, 0], [0, 1], [-1, 0], [0, -1]][q]; }
    const th = (A * Math.PI) / 8;
    return [Math.cos(th), Math.sin(th)];
  }
  function bgFor(A) {                             // background room at A × 22.5°, cached
    if (L.bg[A]) return L.bg[A];
    const r = layer(), cs = trig(A), c = cs[0], s = cs[1];
    for (let sy = 0; sy < FLOOR; sy++) for (let sx = 0; sx < W; sx++) {
      const dx = sx - PX, dy = sy - PY;
      r.set(sx, sy, L.tex(Math.round(c * dx + s * dy), Math.round(-s * dx + c * dy)));
    }
    return (L.bg[A] = r);
  }
  function drawTrinkets(r, k, q, A) {
    const st = slide(snapshot(k), k & 3, q), cs = trig(A), c = cs[0], s = cs[1];
    for (let i = 0; i < st.length; i++) {
      const lx = st[i][0] + 2.5, ly = st[i][1] + 2.5;
      const sx = Math.round(c * lx - s * ly + PX - 2.5), sy = Math.round(s * lx + c * ly + PY - 2.5);
      spr(r, TRINKETS[i], sx, sy, false, FLOOR);
    }
  }

  // ---- static foreground: plaster floor, platform with the fall gap, rotating wall, portal frame, figure, boxes ----
  function buildFore() {
    const r = layer();
    for (let y = FLOOR; y < H; y++) for (let x = 0; x < W; x++) {
      const row = y - FLOOR;
      let c = "u";
      if (row === 0) c = "t";
      else if (row === 16) c = "v";
      else if (((row < 16 ? x : x + 8) % 16) === 15) c = "v";
      r.set(x, y, c);
    }
    for (let y = PLAT_Y; y < PLAT_Y + 16; y++) for (let x = PLAT_X; x < W; x++) {
      if (x >= GAP_X && x < GAP_X + 16) continue;
      const row = y - PLAT_Y;
      let c = row === 0 ? "t" : row === 15 ? "z" : row === 14 ? "v" : "u";
      if (row > 0 && row < 14 && x % 16 === 15) c = "v";
      if (x === PLAT_X || x === GAP_X - 1 || x === GAP_X + 16) c = row === 0 ? "u" : "z";
      r.set(x, y, c);
    }
    for (let y = RW_Y; y < FLOOR; y++) for (let x = RW_X; x < RW_X + 16; x++) {   // rotating wall slab
      const i = x - RW_X, j = y - RW_Y;
      let c = i === 0 || i === 15 || j === 0 ? "z" : i === 1 || j === 1 ? "t" : i === 14 ? "w" : j === 31 ? "v" : "u";
      if (c === "u" && (j === 10 || j === 21)) c = "v";
      r.set(x, y, c);
    }
    const cx = RW_X + 8, cy = RW_Y + 16;           // pivot cap
    for (let y = cy - 3; y < cy + 3; y++) for (let x = cx - 3; x < cx + 3; x++) {
      const ox = x - cx + 0.5, oy = y - cy + 0.5, d = ox * ox + oy * oy;
      if (d <= 9) r.set(x, y, d > 4.5 ? "x" : ox + oy < 0 ? "t" : "v");
    }
    for (let y = FR_Y; y < FR_Y + 32; y++) for (let x = FR_X; x < FR_X + 32; x++) {   // portal: plaster picture frame
      const i = x - FR_X, j = y - FR_Y, e = Math.min(i, j, 31 - i, 31 - j);
      if (e >= 4) continue;
      let c;
      if (e === 0 || e === 3) c = "z";
      else if (e === 1) c = i <= j && i + j < 31 ? "t" : j < i && i + j < 31 ? "t" : "v";
      else c = "u";
      if (e === 1 && (31 - i === 1 || 31 - j === 1)) c = "v";
      r.set(x, y, c);
    }
    for (const [x, y] of [[FR_X + 1, FR_Y + 1], [FR_X + 29, FR_Y + 1], [FR_X + 1, FR_Y + 29], [FR_X + 29, FR_Y + 29]]) {
      r.rect(x, y, 2, 2, "t");                     // corner rosettes
    }
    spr(r, CRATE, 84, FLOOR - 16);
    spr(r, CRATE, 296, PLAT_Y - 16);
    spr(r, PORTER, 60, FLOOR - 16);
    return r;
  }
  function drawArcs(r, a) {                       // rotating_wall: dotted quarter arcs round the pivot, one dot running
    const cx = RW_X + 7.5, cy = RW_Y + 15.5, R = 21, run = a % 10;
    for (let n = 0; n <= 9; n++) {
      const t = (n * Math.PI) / 18, sx = Math.round(cx + R * Math.sin(t)), sy = Math.round(cy - R * Math.cos(t));
      const bx = Math.round(cx - R * Math.sin(t)), by = Math.round(cy + R * Math.cos(t));
      r.set(sx, sy, "t"); r.set(bx, by, "t");
      if (n === run) {                            // the running dot: a small plus
        r.set(sx + 1, sy, "t"); r.set(sx - 1, sy, "t"); r.set(sx, sy + 1, "t"); r.set(sx, sy - 1, "t");
        r.set(bx + 1, by, "t"); r.set(bx - 1, by, "t"); r.set(bx, by + 1, "t"); r.set(bx, by - 1, "t");
      }
    }
  }
  function drawFall(r, a) {                       // fall: trapdoor flaps hanging in the gap, crumbs dropping out
    const sw = [0, 1, 2, 1][a & 3];
    for (let j = 0; j < 9; j++) {
      const o = Math.floor((j * sw) / 8);
      r.set(GAP_X + o, PLAT_Y + 1 + j, "u"); r.set(GAP_X + 1 + o, PLAT_Y + 1 + j, "x");
      r.set(GAP_X + 15 - o, PLAT_Y + 1 + j, "u"); r.set(GAP_X + 14 - o, PLAT_Y + 1 + j, "x");
    }
    r.set(GAP_X - 1, PLAT_Y + 1, "x"); r.set(GAP_X + 16, PLAT_Y + 1, "x");    // hinge pins
    for (let i = 0; i < 3; i++) {
      const t = (a + 5 * i) % 12, y = PLAT_Y + 16 + ((t * t) >> 2);
      if (y < FLOOR) r.set(GAP_X + 4 + 4 * i, y, i === 1 ? "x" : "w");
    }
  }
  function drawPortalRoom(r, a) {                 // the little room inside the frame, turning 15° every 3 env frames
    const th = ((Math.floor(a / 3) % 24) * Math.PI) / 12, c = Math.cos(th), s = Math.sin(th);
    const cx = FR_X + 15.5, cy = FR_Y + 15.5;
    for (let y = FR_Y + 4; y < FR_Y + 28; y++) for (let x = FR_X + 4; x < FR_X + 28; x++) {
      const dx = x - cx, dy = y - cy, qx = Math.floor(c * dx + s * dy + 8.5), qy = Math.floor(-s * dx + c * dy + 8.5);
      let col = "y";
      if (qx >= 0 && qy >= 0 && qx <= 16 && qy <= 16) {
        if (qx === 0 || qy === 0 || qx === 16 || qy === 16) col = "z";
        else if (qy >= 13) col = qy === 13 ? "t" : "u";
        else if (qx >= 3 && qx <= 7 && qy >= 6) col = qx === 3 || qx === 7 || qy === 6 ? "k" : "x";
        else if (qx >= 10 && qx <= 13 && qy >= 3 && qy <= 7) col = qx === 10 || qx === 13 || qy === 3 || qy === 7 ? "x" : "r";
        else col = qy <= 1 ? "w" : "v";
      }
      r.set(x, y, col);
    }
  }
  function drawFrameMonster(r, tick) {            // walks under the platform, pauses at each end
    const t = tick % 200;
    let x, walk = true, left;
    if (t < 88) { x = 292 - t; left = true; }
    else if (t < 100) { x = 204; walk = false; left = ((t >> 2) & 1) === 0; }
    else if (t < 188) { x = 204 + (t - 100); left = false; }
    else { x = 292; walk = false; left = ((t >> 2) & 1) === 1; }
    const f = walk ? (tick >> 1) & 1 : 0, y = FLOOR - 18 - (walk && f ? 1 : 0);
    spr(r, FRAME_BODY, x, y, left);
    spr(r, FRAME_LEGS[f], x, FLOOR - 3, left);
  }
  function drawCrane(r, tick) {                   // flies in, hovers above the portal frame, flies off
    const t = tick % 128, wing = [0, 1, 2, 1][tick & 3];
    let x, y;
    if (t < 56) { x = 332 - Math.round((t * 298) / 56); y = 14 + Math.round((t * 86) / 56); }
    else if (t < 96) { x = 34; y = 100 + ((t >> 2) & 1); }
    else { const u = t - 96; x = 34 - Math.round((u * 60) / 32); y = 100 - Math.round((u * 116) / 32); }
    spr(r, CRANE[wing], x, y);
  }

  window.PB_CONCEPT_SCENES["impossible_hall"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, k = Math.floor(a / PERIOD), q = a % PERIOD;
      const A = (4 * k + (q >= PERIOD - 3 ? q - (PERIOD - 4) : 0)) & 15, r = layer();
      r.data.set(bgFor(A).data);
      drawTrinkets(r, k, q, A);
      drawArcs(r, a);
      drawFall(r, a);
      r.blit(L.fore, 0, 0);
      drawPortalRoom(r, a);
      drawFrameMonster(r, tick);
      drawCrane(r, tick);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
