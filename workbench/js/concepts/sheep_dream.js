/* ART-04s 地图概念场景 · 数羊梦境（sheep_dream）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿、不用渐变和半透明。
 * 地标：被子起伏成的山丘（远近两层）、一排木栅栏、像月亮一样的床头灯。
 * 机关外观（只示意外观，不实现规则）：bounce 弹簧被垫、size_change 梦泡、lantern_reveal 灯光照到才实心的云。
 * 环境（4 fps）：被子山丘像呼吸一样起伏；床头灯轻轻摆，光锥照到的云格是实的，其余只剩虚线；每有一只羊越过栅栏，天上多一颗星。
 * 动物（8 fps）：轮流越栏的羊；闹钟虫（怪物，走走停停，一响全身震）；小绵羊（提示动物，跳到弹簧被垫上回头等）。
 * 比例尺：主角大小的人影 + 2 个木箱，站着不动；规则地面（拼布被、枕头堆）不随呼吸变形。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;
  const FLOOR = OY + 9 * 16;                      // 148: top of the quilt floor (rule ground, never moves)
  const PIL_W = 48, PIL_Y = OY + 7 * 16;          // pillow block x 0–47, top y 116
  const PAD_X = 176, BUB_X = 208;                 // bounce pad / size-change bubble tiles on the floor
  const CLOUD_X = 224, CLOUD_Y = OY + 5 * 16;     // lantern-reveal cloud: 4 tiles, x 224–287, top y 84
  const LAMP_X = 264, LAMP_Y = 28, LAMP_R = 10;   // moon-like bedside lamp hanging from the top edge
  const PLAIN_Y = 122;                            // far quilt plain; the sheep run with their feet on y 122
  const FENCE_X = 138;                            // fence palings x 138–160
  const SHEEP_GAP = 24, SHEEP_N = 10, CYCLE = 12 * SHEEP_GAP, SHEEP_X0 = 92, JUMP_X0 = 126, JUMP_X1 = 172;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null, REV = null;

  function tri(t, period, amp) {                  // 0 → amp → 0, integer
    const p = ((t % period) + period) % period, half = period / 2;
    return Math.round(((p < half ? p : period - p) * amp) / half);
  }
  const layer = () => new PB.Raster(W, H);
  function spr(r, rows, x, y, flip, map) {
    x = Math.floor(x); y = Math.floor(y);
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
  // Re-paint already drawn pixels through a palette map (light without blending).
  function remapPx(r, x, y, map) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const d = r.data, i = (y * W + x) * 4;
    if (!d[i + 3]) return;
    const c = REV.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]), m = c && map[c];
    if (m && m !== c) r.set(x, y, m);
  }
  function bands(r, stops, seam) {               // horizontal colour bands, ordered-dither seams
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
  const LAMB = {                                  // hint lamb, facing right, 13×10
    body: [
      "..tt.tt......",
      ".ttttttt.xx..",
      "ttttttttxxxx.",
      "ttttttttxtxxx",
      "uttttttttxxx.",
      ".uttttttu.x..",
      "..uuuuuu.....",
    ],
    bob: [
      "..tt.tt......",
      ".ttttttt.....",
      "ttttttttxxx..",
      "ttttttttxxxx.",
      "uttttttttxtxx",
      ".uttttttuxxx.",
      "..uuuuuu..x..",
    ],
    stand: ["..x.x..x.x...", "..x.x..x.x...", "..z.z..z.z..."],
    tuck: ["..xx...xx....", ".zz...zz....."],
  };
  const SHEEP = {                                 // background sheep (smaller, dimmer), facing right, 11×8
    body: [
      "..uuu......",
      ".uuuuuu....",
      "uuuuuuuuyy.",
      "uuuuuuuyyyy",
      "vuuuuuuyy..",
      ".vvvvvv....",
    ],
    legs: [["..y.y..y.y.", "..y.y..y.y."], [".y...yy...y", "y....y....."]],
    tuck: ["..yy...yy..", "..........."],
  };
  const BUG = (() => {                            // alarm-clock bug: round clock body, two bells, a winding key; 16×12
    const g = [];
    for (let j = 0; j < 12; j++) g.push(Array(16).fill("."));
    const put = (i, j, c) => { if (i >= 0 && i < 16 && j >= 0 && j < 12) g[j][i] = c; };
    for (let j = 0; j < 12; j++) for (let i = 0; i < 16; i++) {
      const d2 = (i - 7) * (i - 7) + (j - 7) * (j - 7);
      if (d2 <= 13) put(i, j, "c"); else if (d2 <= 20) put(i, j, "w"); else if (d2 <= 27) put(i, j, "z");
    }
    for (const [i, j] of [[7, 5], [7, 6], [8, 7], [9, 7]]) put(i, j, "z");                       // hands
    put(7, 4, "v"); put(4, 7, "v"); put(10, 7, "v"); put(7, 10, "v");                             // hour marks
    for (const bx of [2, 10]) { put(bx + 1, 0, "z"); put(bx + 2, 0, "z"); put(bx, 1, "z"); put(bx + 1, 1, "u"); put(bx + 2, 1, "t"); put(bx + 3, 1, "z"); put(bx, 2, "z"); put(bx + 1, 2, "v"); put(bx + 2, 2, "u"); put(bx + 3, 2, "z"); }
    put(7, 1, "z"); put(7, 2, "w"); put(8, 1, "z");                                               // hammer
    put(13, 6, "z"); put(14, 6, "v"); put(14, 5, "v"); put(14, 7, "v"); put(15, 5, "z"); put(15, 7, "z");  // winding key (back)
    return g.map((row) => row.join(""));
  })();
  const BUG_LEGS = [["..z..z...z..z...", ".z..z...z..z...."], ["...z..z...z..z..", "...z..z...z..z.."]];
  const STARS = [[22, 16], [52, 34], [84, 10], [112, 42], [146, 20], [178, 38], [206, 14], [36, 56], [164, 60], [98, 66]];

  // ---- quilt hills: bumps give the top line, patches ride on the surface so the cloth moves with it ----
  const FAR = [{ c: 14, w: 64, h: 26 }, { c: 104, w: 58, h: 20 }, { c: 186, w: 62, h: 30 }, { c: 284, w: 74, h: 34 }];
  const NEAR = [{ c: -10, w: 50, h: 36 }, { c: 64, w: 58, h: 42 }, { c: 248, w: 56, h: 46 }, { c: 332, w: 50, h: 34 }];
  function hillTop(bumps, base, x, grow, quart) {
    let top = base;
    for (const b of bumps) {
      const d = (x - b.c) / b.w;
      if (d <= -1 || d >= 1) continue;
      const s = quart ? 1 - d * d * d * d : 1 - d * d;
      top = Math.min(top, base - (b.h + grow) * s);
    }
    return Math.floor(top);
  }
  function drawHills(r, bumps, base, grow, quart, cols, edge, seed) {
    for (let x = 0; x < W; x++) {
      const top = hillTop(bumps, base, x, grow, quart);
      for (let y = top; y < base; y++) {
        const dy = y - top;
        if (dy === 0) { r.set(x, y, edge); continue; }
        const u = x + seed, px = Math.floor(u / 16), py = Math.floor((dy - 1) / 11);
        let c = cols[(px + py) & 1];
        if ((u % 16 === 0 || (dy - 1) % 11 === 10) && ((x + y) & 1)) c = cols[2];
        r.set(x, y, c);
      }
    }
  }

  function buildSky() {
    const r = layer();
    bands(r, [[0, "y"], [78, "B"]], 8);
    for (let k = 0; k < 18; k++) {               // faint far stars, always there
      const h = PB.h32(k, 3, 41), x = h % W, y = (h >> 9) % 70;
      if (Math.abs(x - LAMP_X) < 30 && y < 50) continue;
      r.set(x, y, "w");
    }
    return r;
  }
  function buildPlain() {                          // flat far quilt plain the sheep run on, plus the fence
    const r = layer();
    for (let y = PLAIN_Y; y < FLOOR; y++) for (let x = 0; x < W; x++) {
      const dy = y - PLAIN_Y, px = Math.floor((x + 5) / 14), py = Math.floor((dy - 1) / 8);
      let c = dy === 0 ? "w" : ((px + py) & 1 ? "B" : "x");
      if (dy > 0 && ((x + 5) % 14 === 0 || (dy - 1) % 8 === 7) && ((x + y) & 1)) c = "y";
      r.set(x, y, c);
    }
    for (let k = 0; k < 4; k++) {                 // palings with pointed tops
      const x = FENCE_X + k * 7;
      r.set(x, 107, "e"); r.set(x + 1, 107, "f");
      r.vline(x, 108, PLAIN_Y - 108 + 1, "e"); r.vline(x + 1, 108, PLAIN_Y - 108 + 1, "f");
    }
    for (const ry of [111, 117]) { r.hline(FENCE_X - 3, ry, 28, "e"); r.hline(FENCE_X - 3, ry + 1, 28, "f"); }
    return r;
  }
  const FABRIC = [["v", "u", "w"], ["D", "E", "C"], ["u", "t", "v"]];   // powder blue, pink, milk white: base, lit, shade
  function buildGround() {                         // rule ground: patchwork quilt floor + pillow block (static)
    const r = layer();
    for (let y = FLOOR; y < H; y++) for (let x = 0; x < W; x++) {
      const tx = x >> 4, ty = (y - FLOOR) >> 4, lx = x & 15, ly = (y - FLOOR) & 15, f = FABRIC[(tx + 2 * ty) % 3];
      let c = f[0];
      if (ly === 1 || lx === 1) c = f[1];
      else if (ly === 15 || lx === 15) c = f[2];
      if ((lx === 0 || ly === 0) && ((x + y) & 1)) c = "C";
      if ((lx === 1 || lx === 15) && (ly === 1 || ly === 15)) c = f[2];       // rounded, puffy patch corners
      else if (lx === ly && lx > 2 && lx < 14 && (lx & 1)) c = f[2];          // quilting stitch across the patch
      if (y === FLOOR) c = "c";
      if (y === H - 1) c = "C";
      r.set(x, y, c);
    }
    for (let p = 0; p < 2; p++) {                  // two pillows stacked: pinched corners, soft sagging middle
      const y0 = PIL_Y + p * 16;
      for (let x = 1; x < PIL_W - 1; x++) {
        const lx = x - 1, n = PIL_W - 3, sag = Math.round(2 * Math.sin((Math.PI * lx) / n));
        const end = Math.min(lx, n - lx), round = end === 0 ? 4 : end === 1 ? 2 : end === 2 ? 1 : 0;
        const top = y0 + sag + round, bot = y0 + 15 - Math.max(0, sag - 1) - round;
        for (let y = top; y <= bot; y++) {
          let c = "u";
          if (y === top) c = "t";
          else if (y === bot) c = "w";
          else if (y >= bot - 2 || end <= 1 || lx >= n - 3) c = "v";
          else if (y === top + 2 && lx > 5 && lx < 16) c = "t";
          r.set(x, y, c);
        }
      }
    }
    return r;
  }
  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    const props = layer();
    spr(props, CRATE, 16, PIL_Y - 16);
    spr(props, CRATE, 80, FLOOR - 16);
    spr(props, PORTER, 56, FLOOR - 16);
    L = { sky: buildSky(), plain: buildPlain(), ground: buildGround(), props };
    L.WARM1 = { y: "g", x: "f", B: "f", w: "e", C: "e", g: "f" };     // halo / beam: one warm step
    L.WARM2 = { g: "f", f: "e", e: "F" };                              // inner ring: another warm step
    L.BEAM = { y: "g", x: "B", B: "f" };                               // sparse dithered beam down to the cloud
  }

  // ---- ambient (4 fps) ----
  const sway = (a) => tri(a, 32, 6) - 3;                         // lamp swing, −3…3 px
  function drawStars(r, tick) {
    const lt = tick % CYCLE, a = tick >> 1, et = a << 1;
    for (let k = 0; k < SHEEP_N; k++) {
      const at = k * SHEEP_GAP + (JUMP_X1 - SHEEP_X0) / 2;         // the k-th sheep lands
      if ((et % CYCLE) < at || lt >= CYCLE - 4 && (a & 1)) continue;
      const [x, y] = STARS[k], fresh = (et % CYCLE) - at < 4;
      if (fresh) { r.set(x - 1, y, "u"); r.set(x + 1, y, "u"); r.set(x, y - 1, "u"); r.set(x, y + 1, "u"); r.set(x, y, "t"); }
      else r.set(x, y, (PB.h32(k, a >> 1, 5) & 7) ? "u" : "c");
    }
  }
  function drawLight(r, s) {                      // warm halo round the lamp and a dithered beam to the cloud
    const cx = LAMP_X + s, cy = LAMP_Y;
    for (let y = cy - 26; y <= cy + 26; y++) for (let x = cx - 26; x <= cx + 26; x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 <= LAMP_R * LAMP_R || d2 > 26 * 26) continue;
      const d = Math.sqrt(d2);
      if (d < 18 || bay(x, y) < ((26 - d) * 2) | 0) remapPx(r, x, y, L.WARM1);
      if (d < 13 || (d < 16 && bay(x, y) < ((16 - d) * 5) | 0)) remapPx(r, x, y, L.WARM2);
    }
    const y0 = LAMP_Y + LAMP_R + 1, y1 = CLOUD_Y - 1;
    for (let y = y0; y <= y1; y++) {
      const f = (y - y0) / (y1 - y0), mid = LAMP_X + s + 2 * s * f, hw = 4 + 18 * f;
      for (let x = Math.ceil(mid - hw); x <= Math.floor(mid + hw); x++) {
        const edge = Math.min(x - (mid - hw), mid + hw - x);
        if (bay(x, y) < (edge < 3 ? 2 : 4)) remapPx(r, x, y, L.BEAM);
      }
    }
  }
  function drawLamp(r, s) {
    const cx = LAMP_X + s, cy = LAMP_Y;
    line(r, LAMP_X, 0, cx, cy - LAMP_R - 1, "w");
    for (let y = -LAMP_R; y <= LAMP_R; y++) for (let x = -LAMP_R; x <= LAMP_R; x++) {
      const d2 = x * x + y * y;
      if (d2 > LAMP_R * LAMP_R + 3) continue;
      let c = "c";
      if (d2 > (LAMP_R - 1) * (LAMP_R - 1) + 2) c = "d";
      else if (x + y < -9 && d2 > 30) c = "t";
      r.set(cx + x, cy + y, c);
    }
    r.set(cx, cy + LAMP_R + 1, "w"); r.set(cx, cy + LAMP_R + 2, "d");       // pull chain
  }
  function cloudTop(x) {                           // bumpy top line of the cloud, 0…3 below its top
    const lx = (x & 15) - 7.5;
    return Math.round(3 - 3 * Math.sqrt(Math.max(0, 1 - (lx * lx) / 64)));
  }
  function drawCloud(r, s) {                       // lantern_reveal: lit tiles solid, the rest a dotted ghost
    const mid = LAMP_X + 3 * s;
    for (let i = 0; i < 4; i++) {
      const x0 = CLOUD_X + i * 16, lit = Math.abs(x0 + 8 - mid) <= 22;
      for (let x = x0; x < x0 + 16; x++) {
        const top = CLOUD_Y + cloudTop(x - CLOUD_X), bot = CLOUD_Y + 11;
        const end = x === CLOUD_X || x === CLOUD_X + 63;
        for (let y = top + (end ? 2 : 0); y <= bot; y++) {
          const rim = y === top + (end ? 2 : 0) || y === bot || end;
          if (lit) r.set(x, y, y === bot ? "v" : y <= top + 1 ? (y === top ? "t" : "c") : "u");
          else if (rim && ((x + y) & 1)) r.set(x, y, "v");
        }
      }
    }
  }
  function padState(tick) {                        // bounce pad squashes when the lamb lands, kicks when it leaves (4 fps)
    const lt = ((tick >> 1) << 1) % 96;
    if (lt >= 40 && lt < 44) return 4;
    if (lt >= 44 && lt < 46) return -2;
    if (lt >= 72 && lt < 76) return -3;
    return 0;
  }
  function drawPad(r, tick) {
    const sq = padState(tick), top = FLOOR - 15 + sq, x0 = PAD_X;
    r.hline(x0 + 1, FLOOR - 4, 14, "v"); r.rect(x0 + 1, FLOOR - 3, 14, 3, "w");
    for (let y = top + 6; y < FLOOR - 4; y++) {                       // zig-zag spring
      const k = (y - top - 6) % 4, off = k < 2 ? k : 4 - k;
      r.set(x0 + 4 + off * 2, y, "u"); r.set(x0 + 5 + off * 2, y, "v");
      r.set(x0 + 9 + off * 2, y, "u"); r.set(x0 + 10 + off * 2, y, "v");
    }
    for (let y = top; y < top + 6; y++) for (let x = x0; x < x0 + 16; x++) {
      const ly = y - top;
      if ((ly === 0 || ly === 5) && (x === x0 || x === x0 + 15)) continue;
      let c = ly === 0 ? "E" : ly >= 4 ? "C" : "D";
      if (ly === 2 && (x - x0) % 5 === 2) c = "c";
      r.set(x, y, c);
    }
  }
  const BUB_SIZES = [2, 2, 4, 6, 6, 6, 4, 2];
  function drawBubble(r, a) {                      // size_change: a dream bubble whose little square grows and shrinks
    const cx = BUB_X + 8, cy = FLOOR - 15;
    for (let x = BUB_X + 2; x < BUB_X + 14; x++) { r.set(x, FLOOR - 5, "t"); r.rect(x, FLOOR - 4, 1, 3, "u"); r.set(x, FLOOR - 1, "v"); }
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
      const d2 = x * x + y * y;
      if (d2 >= 37 && d2 <= 52) r.set(cx + x, cy + y, (x < 0 && y < 0) ? "t" : "u");
    }
    r.set(cx - 3, cy - 4, "t"); r.set(cx - 4, cy - 3, "t");
    const s = BUB_SIZES[a % BUB_SIZES.length], h = s >> 1;
    r.rect(cx - h, cy - h, s, s, "D");
    if (s > 2) r.hline(cx - h, cy - h, s, "E");
  }

  // ---- animals (8 fps) ----
  function drawSheep(r, tick) {
    const cyc = Math.floor(tick / CYCLE), lt = tick % CYCLE;
    for (let k = 0; k < SHEEP_N + 1; k++) {
      let t = lt - k * SHEEP_GAP;
      if (k === SHEEP_N) { if (cyc === 0) continue; t = lt + CYCLE - (SHEEP_N - 1) * SHEEP_GAP; }   // last sheep of the previous round
      if (t < 0) continue;
      const x = SHEEP_X0 + 2 * t;
      if (x > 226) continue;
      let lift = 0;
      if (x > JUMP_X0 && x < JUMP_X1) {
        const f = (x - JUMP_X0) / (JUMP_X1 - JUMP_X0);
        lift = Math.floor(17 * 4 * f * (1 - f));
      }
      const y = PLAIN_Y - 7 - lift;
      spr(r, SHEEP.body, x, y);
      if (lift > 2) spr(r, [SHEEP.tuck[0]], x, y + 5);
      else spr(r, SHEEP.legs[(t >> 1) & 1], x, y + 5);
    }
  }
  function hop(t, x0, x1, y0, y1, dur, hgt) {     // one parabolic hop, integer landing
    const f = Math.min(1, Math.max(0, t / dur));
    return [Math.floor(x0 + (x1 - x0) * f), Math.floor(y0 + (y1 - y0) * f - 4 * hgt * f * (1 - f)), f > 0 && f < 1];
  }
  function drawLamb(r, tick) {                     // hops to the bounce pad, looks back, hops home
    const lt = tick % 96, A = 110, MID = 142, B = PAD_X + 2, floorY = FLOOR - 10, padY = FLOOR - 15 - 10;
    let x = A, y = floorY, air = false, flip = false;
    if (lt >= 24 && lt < 32) [x, y, air] = hop(lt - 24, A, MID, floorY, floorY, 8, 9);
    else if (lt >= 32 && lt < 40) [x, y, air] = hop(lt - 32, MID, B, floorY, padY, 8, 12);
    else if (lt >= 40 && lt < 72) { x = B; y = padY + padState(tick); flip = lt >= 48; }
    else if (lt >= 72 && lt < 80) { [x, y, air] = hop(lt - 72, B, MID, padY + padState(tick), floorY, 8, 14); flip = true; }
    else if (lt >= 80 && lt < 88) { [x, y, air] = hop(lt - 80, MID, A, floorY, floorY, 8, 9); flip = true; }
    else if (lt >= 88) { flip = true; }
    const bob = !air && ((tick >> 2) & 1);
    spr(r, bob ? LAMB.bob : LAMB.body, x, y, flip);
    spr(r, air ? LAMB.tuck : LAMB.stand, x, y + 7, flip);
  }
  function drawBug(r, tick) {                      // walks toward the player, stops and rings, walks back
    const lt = tick % 136;
    let x = 296, flip = false, ring = false, walk = false;
    if (lt < 56) { x = 296 - lt; walk = true; }
    else if (lt < 70) { x = 240; ring = true; }
    else if (lt < 126) { x = 240 + (lt - 70); walk = true; flip = true; }
    else { x = 296; flip = true; }
    const jx = ring ? ((tick & 1) ? 1 : -1) : 0, y = FLOOR - 12;
    spr(r, BUG, x + jx, y - (ring && (tick & 2) ? 1 : 0), flip);
    spr(r, BUG_LEGS[walk ? (tick >> 1) & 1 : 0], x, y + 10, flip);
    if (ring) {                                   // ring marks beside both bells
      const p = tick & 1;
      r.set(x + jx + 1 - p, y - 1, "t"); r.set(x + jx - p, y + 1, "t");
      r.set(x + jx + 14 + p, y - 1, "t"); r.set(x + jx + 15 + p, y + 1, "t");
    }
  }

  window.PB_CONCEPT_SCENES["sheep_dream"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, s = sway(a), breath = tri(a, 24, 3), r = layer();
      r.data.set(L.sky.data);
      drawStars(r, tick);
      drawHills(r, FAR, PLAIN_Y, tri(a + 6, 24, 2), false, ["x", "x", "y"], "w", 3);
      drawLight(r, s);
      drawLamp(r, s);
      r.blit(L.plain, 0, 0);
      drawSheep(r, tick);
      drawHills(r, NEAR, FLOOR, breath, true, ["B", "x", "w"], "C", 0);
      r.blit(L.ground, 0, 0);
      drawCloud(r, s);
      drawPad(r, tick);
      drawBubble(r, a);
      r.blit(L.props, 0, 0);
      drawBug(r, tick);
      drawLamb(r, tick);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);