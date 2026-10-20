/* ART-04p 地图概念场景 · 水母光宫（jellyfish）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿，不用半透明。
 * 地标：乳白的伞盖穹顶（外面是深海黑）、穹顶内壁的电紫神经网、穹顶正中珊瑚橙的心；左边垂下一束长触手。
 * 透明感只用调色板做：果冻地面和平台把身后的颜色整体提亮一两档（看得见后面的神经网），再加轮廓、高光、气泡和抖动。
 * 机关外观：电源（power：神经节电池放一次脉冲，沿地里的导线跑上门边的灯，灯亮后一直亮着＝锁存，门升起）、
 *   弹跳蘑菇（bounce：跟着伞盖一起压扁、回弹）、黑暗（darkness：门后的暗室只看得见灯光圈里的东西）。
 * 环境（4 fps）：伞盖每 4 秒快收慢放一次，整个空间跟着鼓起、收紧；每次收缩，电紫光从心沿神经网跑向四周；
 *   触手慢慢摆，外面的海雪往下飘。灯光只提亮背景层。
 * 动物（8 fps）：寄生小虾（怪物，在空中乱窜）、小丑鱼（提示动物，躲在触手后面探头）。
 * 比例尺：主角大小的人影 + 2 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4
  const FLOOR = OY + 9 * 16;                      // 148: top of the jelly floor
  const MOUND_X0 = 7 * 16, MOUND_X1 = 11 * 16, MOUND_Y = OY + 6 * 16;   // jelly mound x 112–175, top y = 100
  const SHELF_X = 14 * 16, SHELF_Y = OY + 3 * 16; // overhang x ≥ 224, y 52–67; pillar x 224–239 down to the door
  const DOOR_X = 14 * 16, DOOR_Y = FLOOR - 32;    // door x 224–239, y 116–147
  const ROOM_X = 15 * 16, ROOM_Y = SHELF_Y + 16;  // dark room: x ≥ 240, y ≥ 68
  const LAMP_X = 288, LAMP_Y = 124;               // the only light inside the dark room
  const SRC_X = 2 * 16, MUSH_X = 6 * 16;          // power cell x 32–47, bounce mushroom x 96–111
  const WIRE_Y = FLOOR + 4, WIRE_X0 = SRC_X + 8, WIRE_X1 = DOOR_X - 3, LIGHT_Y = DOOR_Y - 6;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  let PB = null, L = null, REV = null;            // L: static layers, built once; REV: rgb → palette code

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
  // Re-paint already drawn pixels through a palette map (light without blending).
  function remap(r, x0, y0, x1, y1, map, test) {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); x1 = Math.min(W, x1 | 0); y1 = Math.min(H, y1 | 0);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (test && !test(x, y)) continue;
      const c = codeAt(r, x, y), m = c && map[c];
      if (m && m !== c) r.set(x, y, m);
    }
  }
  function glow(r, cx, cy, rad, map) {            // round light, Bayer-dithered towards its rim (background only)
    remap(r, cx - rad, cy - rad, cx + rad + 1, cy + rad + 1, map, (x, y) => {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      return d <= rad * rad && bay(x, y) < 16 - Math.floor((d * 15) / (rad * rad));
    });
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

  // ---- the bell: dome geometry per contraction step k = 0 (relaxed) … 4 (squeezed) ----
  const DX = 160, DY = 158;                       // centre of the bell, just under the floor
  const BELL = [1, 3, 4, 4, 3, 3, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0];   // one beat = 16 frames (4 s): quick squeeze, slow release
  const BEAT = BELL.length, PULSE = 12, SPEED = 22;   // the nerve pulse runs 22 px per frame, 12 frames from heart to floor
  function dome(k) {
    const rxo = 196 - 3 * k, ryo = 150 - 2 * k, t = 9 + (k >> 1);
    return { rxo, ryo, t, rxi: rxo - t, ryi: ryo - t };
  }
  function innerY(d, x) { const u = (x - DX) / d.rxi; return u * u >= 1 ? H : Math.round(DY - d.ryi * Math.sqrt(1 - u * u)); }
  // Nerve net on the far inner wall of the bell: eight wavy main nerves fan out from the heart, cross-links
  // drift from one nerve over to its neighbour (closing irregular cells) and short twigs end in a ganglion.
  // A point on the wall is (m, th): m = sideways factor (-1 … 1), th = angle down from the apex.
  const NERVES = [-0.96, -0.72, -0.45, -0.16, 0.16, 0.45, 0.72, 0.96];
  function nerveNet(d) {
    const ax = d.rxi - 3, ay = d.ryi - 3, paths = [];
    const mainM = (i, th) => NERVES[i] + 0.05 * Math.sin(th * 6.3 + i * 1.7) + 0.025 * Math.sin(th * 13 + i * 2.9);
    const trace = (mOf, th0, th1, delay, kind) => {
      const pts = []; let last = -1;
      for (let s = 0; s <= 1400; s++) {
        const th = th0 + ((th1 - th0) * s) / 1400, m = mOf(th);
        const x = Math.round(DX + ax * m * Math.sin(th)), y = Math.round(DY - ay * Math.cos(th));
        if (y >= FLOOR) break;
        const key = y * 1000 + x + 100;
        if (key !== last) { pts.push([x, y, th]); last = key; }
      }
      paths.push({ pts, delay, kind });
      return pts;
    };
    const mains = NERVES.map((_, i) => trace((th) => mainM(i, th), 0.05, Math.PI / 2, 0, 0));
    const indexAt = (pts, th) => { let b = 0; for (let n = 0; n < pts.length; n++) if (Math.abs(pts[n][2] - th) < Math.abs(pts[b][2] - th)) b = n; return b; };
    const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
    for (let i = 0; i < NERVES.length; i++) for (let j = 0; j < 2; j++) {
      const to = i + (j === 0 ? 1 : -1);
      if (to < 0 || to >= NERVES.length || (j === 1 && hash(i, 7, 61) % 2)) continue;
      const th0 = 0.3 + j * 0.42 + (hash(i, j, 62) % 18) / 100, span = 0.22 + (hash(i, j, 63) % 10) / 100;
      trace((th) => mainM(i, th) + (mainM(to, th) - mainM(i, th)) * ease((th - th0) / span), th0, th0 + span, indexAt(mains[i], th0), 1);
    }
    for (let i = 0; i < NERVES.length; i++) {
      const th0 = 0.55 + (hash(i, 9, 64) % 40) / 100, dir = i < 4 ? -1 : 1;
      const pts = trace((th) => mainM(i, th) + dir * 0.1 * ((th - th0) / 0.16), th0, th0 + 0.16, indexAt(mains[i], th0), 2);
      paths[paths.length - 1].tip = pts[pts.length - 1];
    }
    return { paths };
  }
  function buildDome(k) {
    const d = dome(k), r = layer();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - DX, dy = y - DY, dist = Math.sqrt(dx * dx + dy * dy);
      const so = Math.sqrt((dx / d.rxo) * (dx / d.rxo) + (dy / d.ryo) * (dy / d.ryo));
      const depth = so > 0 ? dist / so - dist : 999;   // px inside the bell's outer skin, measured along the ray
      let c;
      if (depth < 0) c = depth > -2.5 && bay(x, y) < 5 ? "y" : hash(x >> 1, y >> 1, 11) % 29 === 0 ? "y" : "z";   // deep sea
      else if (depth < 1) c = "w";                                                    // outer skin
      else if (depth < d.t - 1) {                                                     // milky jelly, thicker inside
        c = bay(x, y) < 2 + Math.floor((depth * 9) / d.t) ? "w" : "x";
        if (hash(x, y, 12) % 53 === 0) c = "v";
      } else if (depth < d.t) c = "v";                                                // inner rim
      else c = depth - d.t < 7 && bay(x, y) < 8 - Math.floor(depth - d.t) ? "x" : "y";   // the hollow inside the bell
      r.set(x, y, c);
    }
    const net = nerveNet(d);
    for (const p of net.paths) for (const [x, y] of p.pts) r.set(x, y, "B");
    for (const p of net.paths) if (p.kind) {                                           // ganglia where nerves fork / end
      const q = p.kind === 2 ? p.tip : p.pts[0];
      if (!q) continue;
      r.set(q[0], q[1], "C"); r.set(q[0] + 1, q[1], "B"); r.set(q[0], q[1] + 1, "B"); r.set(q[0] - 1, q[1], "B");
    }
    return { r, d, net };
  }

  // ---- the coral-orange heart hanging from the apex ----
  function drawHeart(r, top, beat) {
    const lobes = [[DX, top + 9, 9 + beat, 6 + beat], [DX - 13, top + 10, 7, 5 + beat], [DX + 13, top + 10, 7, 5 + beat]];
    const lobeOf = (x, y) => {
      for (const l of lobes) { const u = (x - l[0] + 0.5) / (l[2] + 0.5), v = (y - l[1]) / (l[3] + 0.5); if (u * u + v * v <= 1) return [l, u, v]; }
      return null;
    };
    for (let y = top - 4; y < top + 4; y++) { r.set(DX - 1, y, "x"); r.set(DX, y, "w"); }   // stalk up to the apex
    for (let y = top; y < top + 19; y++) for (let x = DX - 22; x <= DX + 22; x++) {
      const h = lobeOf(x, y);
      if (!h) continue;
      const edge = !lobeOf(x, y - 1) || !lobeOf(x, y + 1) || !lobeOf(x - 1, y) || !lobeOf(x + 1, y);
      const [, u, v] = h, rr = Math.sqrt(u * u + v * v);
      let c = edge ? (v < 0 ? "a" : "h") : v < -0.5 ? "k" : v < 0.3 ? "j" : "b";
      if (!edge && rr > 0.42 && rr < 0.7 && v > -0.15) c = "D";                    // horseshoe-shaped gonads
      if (!edge && rr <= 0.42 && v > -0.15) c = beat ? "k" : "b";
      if (beat && !edge) c = c === "b" ? "j" : c === "j" ? "k" : c;
      r.set(x, y, c);
    }
  }

  // ---- jelly terrain: see-through material = palette steps over whatever lies behind ----
  const T1 = { z: "x", y: "w", x: "w", w: "v", v: "u", u: "u", t: "t", B: "C", C: "D", D: "E", g: "B", h: "a", a: "b", b: "d", j: "k", k: "l", l: "t" };
  const T2 = { z: "w", y: "v", x: "v", w: "u", v: "u", u: "t", t: "t", B: "C", C: "D", D: "E", g: "B", h: "a", a: "b", b: "d", j: "k", k: "l", l: "t" };
  // mask: 1 = one step lighter, 2 = two steps (rims), 3 = see-through (left as it is). Rims light up, the middle
  // lets the hollow show through in an ordered dither, a specular streak sits under the top edge.
  function jelly(t, mask, x0, y0, x1, y1, e, seed) {
    const cr = e.round || 0;
    const inside = (x, y) => {
      if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
      const dl = e.left ? x - x0 : 99, dr = e.right ? x1 - 1 - x : 99, dt = e.top ? y - y0 : 99, db = e.bottom ? y1 - 1 - y : 99;
      const out = (p, q) => p < cr && q < cr && (cr - 0.5 - p) * (cr - 0.5 - p) + (cr - 0.5 - q) * (cr - 0.5 - q) > cr * cr;
      return !(out(dl, dt) || out(dr, dt) || out(dl, db) || out(dr, db));
    };
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      if (!inside(x, y)) continue;
      const dl = e.left ? x - x0 : 99, dr = e.right ? x1 - 1 - x : 99, dt = e.top ? y - y0 : 99, db = e.bottom ? y1 - 1 - y : 99;
      const dE = Math.min(dl, dr, dt, db);
      let m = dE < 2 ? 2 : dE < 6 ? (bay(x, y) < 16 - (dE - 1) * 3 ? 2 : 1) : bay(x, y) < 4 ? 3 : 1;
      if (y > H - 10 && bay(x, y) < (y - (H - 10)) * 2) m = 3;
      mask[y * W + x] = m;
      const up = !inside(x, y - 1), lf = !inside(x - 1, y), rt = !inside(x + 1, y), dn = !inside(x, y + 1);
      if (up && e.top) t.set(x, y, hash(x, 0, seed) % 13 === 0 ? "t" : "u");
      else if (lf && e.left) t.set(x, y, "v");
      else if (rt && e.right) t.set(x, y, "w");
      else if (dn && e.bottom) t.set(x, y, "x");
    }
    if (e.top) for (let sx = x0 + 4; sx < x1 - 12; sx += 96) {                        // specular streaks
      const len = Math.min(9, ((x1 - x0) >> 2) | 0);
      for (let k = 0; k < len; k++) if (sx + k >= 0 && sx + k < W) t.set(sx + k, y0 + 2, k < 2 ? "t" : "u");
      t.set(sx + len + 2, y0 + 2, "u"); t.set(sx + 1, y0 + 3, "u");
    }
    const n = Math.floor(((x1 - x0) * (y1 - y0)) / 300);                               // bubbles caught in the jelly
    for (let i = 0; i < n; i++) {
      const bx = x0 + 5 + (hash(i, 1, seed) % Math.max(1, x1 - x0 - 10)), by = y0 + 6 + (hash(i, 2, seed) % Math.max(1, y1 - y0 - 10));
      if (bx < 1 || bx >= W - 1 || by >= H - 1 || !inside(bx, by)) continue;
      if (hash(i, 3, seed) % 3) { t.set(bx, by - 1, "u"); t.set(bx - 1, by, "u"); t.set(bx + 1, by, "v"); t.set(bx, by + 1, "v"); }
      else t.set(bx, by, "v");
    }
  }
  function buildTerrain() {
    const t = layer(), mask = new Uint8Array(W * H);
    jelly(t, mask, -1, FLOOR, W + 1, H + 1, { top: true }, 31);
    jelly(t, mask, MOUND_X0, MOUND_Y, MOUND_X1, FLOOR + 1, { top: true, left: true, right: true, round: 5 }, 32);
    jelly(t, mask, SHELF_X, SHELF_Y + 15, ROOM_X, DOOR_Y, { left: true, right: true }, 34);
    jelly(t, mask, SHELF_X, SHELF_Y, W + 1, SHELF_Y + 16, { top: true, left: true, bottom: true, round: 4 }, 33);
    // nerve cable laid in the floor from the power cell to the door lamp
    for (let x = WIRE_X0; x <= WIRE_X1 + 1; x++) { t.set(x, WIRE_Y - 1, "x"); t.set(x, WIRE_Y, "B"); t.set(x, WIRE_Y + 1, "B"); t.set(x, WIRE_Y + 2, "x"); }
    for (let y = LIGHT_Y + 3; y <= WIRE_Y + 2; y++) { t.set(WIRE_X1 - 1, y, "x"); t.set(WIRE_X1, y, "B"); t.set(WIRE_X1 + 1, y, "B"); t.set(WIRE_X1 + 2, y, "x"); }
    for (let y = FLOOR - 1; y < WIRE_Y; y++) { t.set(WIRE_X0 - 1, y, "x"); t.set(WIRE_X0, y, "B"); t.set(WIRE_X0 + 1, y, "B"); t.set(WIRE_X0 + 2, y, "x"); }
    const idx = []; for (let i = 0; i < W * H; i++) if (mask[i]) idx.push(i);
    return { t, mask, idx: Int32Array.from(idx) };
  }
  // The cable path, in order, for the pulse: along the floor, then up the door post to the lamp.
  function wirePath() {
    const p = [];
    for (let x = WIRE_X0; x <= WIRE_X1; x++) p.push([x, WIRE_Y]);
    for (let y = WIRE_Y - 1; y >= LIGHT_Y + 3; y--) p.push([WIRE_X1, y]);
    return p;
  }

  // ---- power (one cycle = 64 frames): charge, fire, pulse along the cable, lamp latches on, door lifts ----
  const PCYCLE = 64;
  function drawPower(r, a) {
    const p = a % PCYCLE, charge = p < 8 ? p >> 1 : p < 10 ? 4 : -1, cx = SRC_X + 8, cy = FLOOR - 13;
    // cup
    for (let y = FLOOR - 8; y < FLOOR; y++) for (let x = SRC_X + 1; x < SRC_X + 15; x++) {
      const edge = x === SRC_X + 1 || x === SRC_X + 14 || y === FLOOR - 1;
      r.set(x, y, y === FLOOR - 8 ? "u" : edge ? "w" : x < SRC_X + 4 ? "v" : "w");
    }
    // ganglion bulb
    for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 > 26 || y >= FLOOR - 8) continue;
      let c = d2 > 18 ? (x + y < cx + cy ? "C" : "B") : "B";
      const core = charge < 0 ? 0 : charge + 1;
      if (d2 <= core * core) c = d2 <= 1 && charge >= 2 ? "t" : charge >= 3 ? "D" : "C";
      if (charge < 0 && d2 <= 4) c = "g";
      r.set(x, y, c);
    }
    r.set(cx - 2, cy - 3, "D");
    // pulse along the cable
    const path = L.wire;
    if (p >= 8 && p < 16) {
      const head = Math.min(path.length, Math.floor(((p - 7) * path.length) / 8));
      for (let i = Math.max(0, head - 20); i < head; i++) {
        const [x, y] = path[i], dd = head - 1 - i, c = dd < 2 ? "t" : dd < 10 ? "D" : "C";
        r.set(x, y, c); if (path[i][1] === WIRE_Y) r.set(x, y + 1, dd < 2 ? "D" : "C"); else r.set(x + 1, y, dd < 2 ? "D" : "C");
      }
    }
    // latch lamp beside the door: once the pulse arrives it stays lit until the cycle restarts
    const lit = p >= 15;
    const lx = WIRE_X1 - 2, ly = LIGHT_Y - 3;
    spr(r, [".zzzz.", "zxyyxz", "zyyyyz", "zyyyyz", "zxyyxz", ".zzzz.", "..zz.."], lx, ly, false,
      lit ? { x: "C", y: "D" } : { x: "x", y: "y" });
    if (lit) { r.set(lx + 2, ly + 2, "t"); r.set(lx + 3, ly + 2, "t"); r.set(lx + 2, ly + 3, "t"); r.set(lx + 3, ly + 3, "E"); }
    for (let x = lx + 6; x < DOOR_X; x++) r.set(x, ly + 3, "x");                    // bracket into the pillar
    // door: frame and bars; the bars slide up into the pillar once the lamp is lit
    const lift = p < 15 ? 0 : Math.min(28, (p - 14) * 7);
    for (let y = DOOR_Y; y < FLOOR; y++) for (const x of [DOOR_X, DOOR_X + 1, DOOR_X + 14, DOOR_X + 15]) {
      r.set(x, y, x === DOOR_X || x === DOOR_X + 15 ? "z" : "x");
    }
    for (let x = DOOR_X; x < DOOR_X + 16; x++) { r.set(x, DOOR_Y, "z"); r.set(x, DOOR_Y + 1, "x"); r.set(x, DOOR_Y + 2, "w"); }
    for (const bx of [DOOR_X + 3, DOOR_X + 7, DOOR_X + 11]) for (let y = DOOR_Y + 3; y < FLOOR; y++) {
      const yy = y + lift;                         // bar texture position
      if (yy >= FLOOR) break;
      const tip = yy >= FLOOR - 2;
      r.set(bx, y, tip ? "w" : "u"); r.set(bx + 1, y, tip ? (yy === FLOOR - 1 ? "x" : "w") : "v");
      if (yy === FLOOR - 1) r.set(bx, y, "x");
    }
    for (const by of [DOOR_Y + 10, DOOR_Y + 21]) {
      const y = by - lift;
      if (y > DOOR_Y + 2) for (let x = DOOR_X + 2; x < DOOR_X + 14; x++) r.set(x, y, "w");
    }
  }

  // ---- bounce mushroom: squashes with the bell's beat and springs back ----
  const SQUASH = [1, 2, 2, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  function drawMushroom(r, ba) {
    const s = SQUASH[ba], cx = MUSH_X + 8, stalkTop = FLOOR - 7 + Math.max(0, s), rx = 7 + Math.max(0, s), ry = 5 - s;
    for (let y = stalkTop; y < FLOOR; y++) { r.set(cx - 2, y, "u"); r.set(cx - 1, y, "u"); r.set(cx, y, "v"); r.set(cx + 1, y, "w"); }
    for (let y = stalkTop - ry; y <= stalkTop; y++) for (let x = cx - rx - 1; x <= cx + rx; x++) {
      const u = (x + 0.5 - cx) / (rx + 0.5), v = (y - stalkTop) / (ry + 0.5);
      if (u * u + v * v > 1) continue;
      let c = y === stalkTop ? "B" : v < -0.55 && u < 0.1 ? "D" : "C";
      if (y === stalkTop - 1 && Math.abs(u) > 0.75) c = "B";
      r.set(x, y, c);
    }
    for (const [sx, sy] of [[-3, -3], [2, -2], [4, -4]]) if (stalkTop + sy > stalkTop - ry) r.set(cx + sx, stalkTop + sy, "u");
  }

  // ---- the dark room's lamp ----
  function drawLamp(r) {
    for (let y = LAMP_Y + 4; y < FLOOR; y++) { r.set(LAMP_X - 1, y, "v"); r.set(LAMP_X, y, "w"); }
    r.set(LAMP_X - 3, FLOOR - 1, "w"); r.set(LAMP_X - 2, FLOOR - 1, "v"); r.set(LAMP_X + 1, FLOOR - 1, "w"); r.set(LAMP_X + 2, FLOOR - 2, "w");
    spr(r, ["..vvv..", ".vuuuv.", "vuttuuv", "vuttuuw", "vuuuuuw", ".vuuuw.", "..www.."], LAMP_X - 3, LAMP_Y - 3);
  }
  function darkRoom(r, rad) {                      // outside the lamp's circle the room is pitch black
    for (let y = ROOM_Y; y < H; y++) for (let x = ROOM_X; x < W; x++) {
      const d = Math.sqrt((x - LAMP_X) * (x - LAMP_X) + (y - LAMP_Y) * (y - LAMP_Y));
      if (d < rad - 4) continue;
      if (d < rad && bay(x, y) < Math.floor(((rad - d) * 16) / 4)) continue;
      r.set(x, y, "z");
    }
  }

  // ---- tentacles (front, left) and the clownfish hiding behind them ----
  const TENT = [{ x: 5, ph: 0, w: 5 }, { x: 13, ph: 2.1, w: 4 }, { x: 21, ph: 4.0, w: 5 }];
  function drawTentacles(r, a, d) {               // long beaded tentacles hanging from the bell wall, waves running down
    for (const t of TENT) {
      const top = innerY(d, t.x) - 3, bot = FLOOR - 2 - (t.x % 3), len = bot - top;
      for (let y = top; y <= bot; y++) {
        const q = y - top, f = q / len, sw = Math.min(1, q / 26);
        const cx = t.x + Math.round(sw * (3.2 * Math.sin(q / 14 - a * 0.5 + t.ph) + 1.2 * Math.sin(q / 6 - a * 0.8 + t.ph * 2)));
        const bead = (q + Math.round(t.ph * 3)) % 6 < 2 && q > 3;
        let w = Math.max(2, Math.round(t.w * (1 - f * 0.6)));
        let x0 = cx - (w >> 1);
        if (bead) { x0 -= 1; w += 2; }
        for (let k = 0; k < w; k++) {
          let c = k === 0 ? "u" : k === w - 1 ? "x" : "v";
          if (!bead && k > 0 && k < w - 1 && w > 3 && k === w - 2) c = "w";
          r.set(x0 + k, y, c);
        }
        if (bead && (q >> 1) % 3 === 0) r.set(x0 + (w >> 1), y, "C");              // stinging cells glint purple
      }
      r.set(t.x - 1 + Math.round(1.5 * Math.sin(a * 0.5 + t.ph)), bot + 1, "w");
    }
  }
  const FISH = (() => {                            // clownfish facing right: orange, three white bands, black-edged fins
    const out = [];
    for (let f = 0; f < 2; f++) {
      const rows = [];
      for (let y = 0; y < 9; y++) {
        let s = "";
        for (let x = 0; x < 15; x++) {
          const u = (x - 8.6) / 5.9, v = (y - 4) / 3.4, body = u * u + v * v <= 1;
          const tail = x <= 2 && Math.abs(y - 4 - (x === 0 ? f * 2 - 1 : 0) * (x === 0 ? 1 : 0)) <= 3 - x;
          const fin = (y === 0 && x >= 7 && x <= 10) || (y === 8 && x >= 8 && x <= 9);
          if (!body && !tail && !fin) { s += "."; continue; }
          if (fin) { s += x === 7 || x === 9 && y === 8 ? "z" : "j"; continue; }
          if (tail) { s += x === 0 || Math.abs(y - 4) === 3 - x ? "z" : "j"; continue; }
          const e = ((x - 8.6) / 5.2) ** 2 + ((y - 4) / 2.6) ** 2 > 1;
          if (e) { s += "z"; continue; }
          if (x === 12 && y === 3) { s += "z"; continue; }                      // eye
          if (x === 4 || x === 8 || x === 11) { s += "t"; continue; }          // white bands
          s += y <= 2 ? "k" : y >= 6 ? "b" : "j";
        }
        rows.push(s);
      }
      out.push(rows);
    }
    return out;
  })();
  function drawFish(r, tick) {
    const p = tick % 64, out = p < 24 ? 0 : p < 34 ? p - 24 : p < 50 ? 10 : p < 60 ? 59 - p : 0;
    const bob = p >= 34 && p < 50 ? ((p >> 2) & 1) : 0;
    spr(r, FISH[(tick >> 1) & 1], 2 + out, FLOOR - 36 + bob);
  }

  // ---- parasitic shrimp: darts about in short bursts, then hovers twitching ----
  const SHRIMP = [                               // facing right: curled tail, arched back, big dark eye, antennae
    // 0–2: swimming (legs paddle, antennae wave); 3: darting (antennae swept back)
    [
      "...........h..",
      "......hhhh..h.",
      "....hiDDDih..h",
      "..hiiiiiiiizz.",
      ".hiDihiihiizzi",
      "hiih.h.h.hiii.",
      "hDh..h.h.h....",
      ".hhh..........",
    ],
    [
      "............h.",
      "......hhhh..h.",
      "....hiDDDih.h.",
      "..hiiiiiiiizz.",
      ".hiDihiihiizzi",
      "hiih..h.h.iii.",
      "hDh..h.h.h....",
      "hhh...........",
    ],
    [
      "...........h..",
      "......hhhh.h..",
      "....hiDDDih...",
      "..hiiiiiiiizz.",
      ".hiDihiihiizzi",
      ".iih.h.h.hiii.",
      "hDhh.h.h.h....",
      "hh............",
    ],
    [
      "....hhhhhh....",
      "...h......hh..",
      "....hiDDDih..h",
      "..hiiiiiiiizz.",
      ".hiDihiihiizzi",
      "hiih.h.h.hiii.",
      "hDh.h.h.h.....",
      ".hhh..........",
    ],
  ];
  function shrimpAt(tick) {
    const seg = Math.floor(tick / 10), p = tick % 10;
    const pt = (s) => [MOUND_X1 + 4 + (hash(s, 1, 41) % 30), 72 + (hash(s, 2, 41) % 60)];
    const [x0, y0] = pt(seg), [x1, y1] = pt(seg + 1), f = p >= 3 ? 1 : [0.45, 0.8, 0.95][p];
    return {
      x: Math.round(x0 + (x1 - x0) * f) + (p >= 3 ? (hash(tick, 3, 41) % 3) - 1 : 0),
      y: Math.round(y0 + (y1 - y0) * f) + (p >= 3 ? (tick >> 1) & 1 : 0),
      flip: x1 < x0, dart: p < 3,
    };
  }
  function drawShrimp(r, tick) {
    const s = shrimpAt(tick), f = s.dart ? (tick & 1 ? 3 : 2) : [0, 1, 2, 1][tick & 3];
    spr(r, SHRIMP[f], s.x, s.y, s.flip);
  }

  function drawSnow(r, a) {                        // marine snow drifting down outside the bell
    for (let i = 0; i < 22; i++) {
      const x = (hash(i, 1, 51) % W + Math.round(2 * Math.sin((a + i * 5) / 9))) % W, y = (hash(i, 2, 51) % H + a + (i % 3) * (a >> 1)) % H;
      if (codeAt(r, x, y) === "z") r.set(x, y, i % 4 ? "x" : "w");
    }
  }

  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    const domes = [0, 1, 2, 3, 4].map(buildDome);
    const terrain = buildTerrain();
    const props = layer();
    spr(props, PORTER, 4 * 16, FLOOR - 16);
    spr(props, CRATE, 8 * 16, MOUND_Y - 16);
    spr(props, CRATE, 16 * 16, FLOOR - 16);
    const LIT = Object.assign({}, PB.LIGHT, { z: "y" });
    L = { domes, terrain, props, wire: wirePath(), LIT };
  }

  window.PB_CONCEPT_SCENES["jellyfish"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, ba = a % BEAT, k = BELL[ba], D = L.domes[k], r = layer(), lit = L.LIT;
      r.data.set(D.r.data);
      drawSnow(r, a);
      // background lighting: the heart, the running nerve pulses, the power cell's flash, the dark room's lamp
      const top = DY - D.d.ryi + 3, beat = ba < 3 ? 1 : 0;
      glow(r, DX, top + 9, beat ? 26 : 19, lit);
      const heads = [], front = (ba + 1) * SPEED;   // the pulse front, in px travelled from the heart
      if (ba < PULSE) for (const p of D.net.paths) {
        const len = p.pts.length, head = Math.min(len, front - p.delay);
        if (head <= 0) continue;
        heads.push([p, head]);
        if (head < len && p.kind === 0) { const q = p.pts[head - 1]; glow(r, q[0], q[1], 6, lit); }
      }
      const flash = (a % PCYCLE) >= 8 && (a % PCYCLE) < 10;
      if (flash) glow(r, SRC_X + 8, FLOOR - 13, 16, lit);
      const rad = 30 + (k >> 1);
      remap(r, LAMP_X - rad, LAMP_Y - rad, LAMP_X + rad + 1, Math.min(FLOOR, LAMP_Y + rad + 1), lit,
        (x, y) => x >= ROOM_X && y >= ROOM_Y && (x - LAMP_X) * (x - LAMP_X) + (y - LAMP_Y) * (y - LAMP_Y) < (rad - 6) * (rad - 6));
      // the nerve pulses themselves: white-hot head, electric purple trail
      for (const [p, head] of heads) {
        for (let i = Math.max(0, head - 26); i < Math.min(head, p.pts.length); i++) {
          const [x, y] = p.pts[i], dd = head - 1 - i;
          r.set(x, y, dd < 2 ? "t" : dd < 12 ? "C" : (dd & 1) ? "C" : "B");
        }
      }
      drawHeart(r, top, beat);
      // jelly: tint whatever is behind it, then its rims and bubbles
      const T = L.terrain, idx = T.idx;
      for (let n = 0; n < idx.length; n++) {
        const i = idx[n], m = T.mask[i];
        if (!m) continue;
        const x = i % W, y = (i / W) | 0, c = codeAt(r, x, y), to = (m === 2 ? T2 : T1)[c];
        if (to) r.set(x, y, to);
      }
      r.blit(T.t, 0, 0);
      drawPower(r, a);
      drawMushroom(r, ba);
      drawLamp(r);
      r.blit(L.props, 0, 0);
      drawShrimp(r, tick);
      drawFish(r, tick);
      drawTentacles(r, a, D.d);
      darkRoom(r, rad);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
