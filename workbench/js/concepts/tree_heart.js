/* ART-04p 地图概念场景 · 巨树树心（tree_heart）
 * 只看大致效果的概念场景，不是游戏资产：一屏 320×180，只用 ENDESGA 32，整数像素，不抗锯齿。
 * 地标：一圈圈年轮墙、往上通的导管、伸到地下水里的根。
 * 机关外观：吸水藤梯（vine）、连通器（communicating，阀门关着，两边液面不平）、轻烟上浮（gas_rise，顶上收集斗）。
 * 环境（4 fps）：翠绿树液一股股沿导管往上涌，涌到的节点亮一下；年轮墙隔一阵吱嘎一声往外撑开再收回，抖落木屑；
 *   光只从左边树皮的裂缝和右上的虫洞透进来，只照亮背景。
 * 动物（8 fps）：天牛幼虫（怪物，在年轮里钻洞，钻过的地方松成碎屑）、红松鼠（提示动物，抱着松果坐在树洞口）。
 * 比例尺：主角大小的人影 + 2 个木箱，站着不动。不画收件人、货物、界面和文字。 */
(function (window) {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180, OY = 4;                 // 16 px grid, rows start at y = 4 (20 × 11 tiles)
  const FLOOR = OY + 9 * 16;                      // 148: top of the floor (one tile thick)
  const ROOTS = FLOOR + 16;                       // 164: under the floor the roots hang into the ground water
  const LEDGE_Y = OY + 5 * 16;                    // 84: left ledge, reached by the vine ladder
  const VINE_X = 4 * 16;                          // vine ladder column x 64–79, rows 4–8
  const BLOCK_X = 15 * 16, BLOCK_Y = OY + 6 * 16; // right ring shelf: x ≥ 240, top y = 100
  const HOLE_X = 298;                             // tree hole in the right bark wall
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
  // ---- background: the ring wall (static, three "stretch" variants for the creak) ----
  const PITH_X = 158, PITH_Y = 214;               // the rings' centre lies below the floor: arcs vault over the room
  const RAYS = [-2.62, -2.27, -1.93, -1.6, -1.22, -0.86, -0.5];   // radial checks (angles) across the rings
  function ringList() {
    const out = [];
    for (let r = 40, k = 0; r < 460; k++) { const w = 7 + (hash(k, 3, 71) % 6); out.push({ r0: r, w, kind: hash(k, 5, 72) % 5 }); r += w; }
    return out;
  }
  function buildRings(rings, grow) {
    const r = layer();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - PITH_X) * 0.8, dy = y - PITH_Y, ang = Math.atan2(dy, dx);
      const rr = Math.sqrt(dx * dx + dy * dy) + Math.sin(ang * 9 + 0.7) * 1.4 + Math.sin(ang * 23 + 2.1) * 0.7 - grow;
      let k = 0;
      while (k < rings.length - 1 && rings[k + 1].r0 <= rr) k++;
      const g = rings[k], dep = Math.floor(rr - g.r0), dark = g.kind !== 0 && g.kind !== 2;
      let c = dark ? "g" : "f";                                      // kept dark and low in contrast: lighting lifts it
      if (dep <= 0) c = dark ? "z" : "g";                            // latewood line
      else if (dep === 1 && g.kind === 0) c = "h";                   // ochre-red streak (turns ochre where lit)
      else if (dep === 2 && g.kind === 2 && bay(x, y) < 8) c = "e";  // faint ivory streak, broken by dither
      else if (!dark && RAYS.some((t) => Math.abs(Math.sin(ang - t)) * rr < 0.6) && hash(k, Math.floor(rr / 3), 74) % 3) c = "g";
      r.set(x, y, c);
    }
    return r;
  }
  // Light from the bark cracks (left) only falls on the background: one step brighter, Bayer-dithered edges.
  const SHAFTS = [{ x: 12, y: 25, len: 190, half: 4 }, { x: 13, y: 52, len: 130, half: 3 }];
  function buildShaftMask() {
    const m = new Uint8Array(W * H), ux = 0.8, uy = 0.6;
    for (const s of SHAFTS) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x - s.x, py = y - s.y, t = px * ux + py * uy, u = -px * uy + py * ux;
      if (t < 0 || t > s.len || Math.abs(u) > s.half) continue;
      const edge = Math.min(16, Math.floor((s.half - Math.abs(u) + 1) * 5)), fade = Math.floor(15 - (t * 17) / s.len);
      if (bay(x, y) < Math.min(edge, fade)) m[y * W + x] = 1;
    }
    return m;
  }
  // ---- conduits: vessels running up through the tree, sap pulses rise inside ----
  const CONDUITS = [{ x: 88, w: 7, step: 23, ph: 0 }, { x: 162, w: 6, step: 19, ph: 23 }, { x: 228, w: 7, step: 21, ph: 11 }];
  function buildConduits() {
    const r = layer();
    for (const c of CONDUITS) {
      for (let y = 0; y < H; y++) {
        r.set(c.x, y, "z"); r.set(c.x + c.w - 1, y, "z");
        for (let x = c.x + 1; x < c.x + c.w - 1; x++) r.set(x, y, x === c.x + 1 ? "o" : "p");
      }
      for (let y = H - 4 - (c.ph % 7); y > 0; y -= c.step) {          // perforated joints between the vessel cells
        for (let x = c.x - 1; x <= c.x + c.w; x++) r.set(x, y, x < c.x || x >= c.x + c.w ? "g" : "o");
      }
    }
    return r;
  }
  const jointsOf = (c) => { const out = []; for (let y = H - 4 - (c.ph % 7); y > 0; y -= c.step) out.push(y); return out; };
  // Pulse heads climb with a surge: 4 px per frame on average, faster and slower in turns (always upwards).
  function pulseHeads(c, a) {
    const out = [], span = 236;
    for (let k = 0; k < 3; k++) {
      const t = a + c.ph + k * 19;
      const pos = Math.floor(4 * t + 3 * Math.sin((2 * Math.PI * t) / 6));
      out.push(H + 12 - (((pos % span) + span) % span));
    }
    return out;
  }

  // ---- terrain ----
  function barkTex(r, x, y, seed) {               // dark bark with vertical fissures; ridges catch a little light
    const jog = hash(0, y >> 3, seed) % 3, f = hash(x + jog, 0, seed) % 6;
    let c = f === 0 ? "z" : f === 1 ? "f" : "g";
    if (c === "g" && hash(x, y, seed + 1) % 19 === 0) c = "f";
    r.set(x, y, c);
  }
  function woodTex(r, x, y, x0, y0, x1, y1, seed) {   // sapwood: lit top, shaded bottom, wandering grain
    let c = "e";
    const wave = Math.round(1.3 * Math.sin((x + seed * 7) / 11) + 0.8 * Math.sin((x + seed) / 5));
    const g = (y - y0 + wave + 60) % 5;
    if (g === 0 && hash(x >> 2, y, seed) % 5 !== 0) c = "f";
    else if (g === 2 && hash(x >> 3, y, seed + 1) % 4 === 0) c = "F";
    if (y === y0) c = "d";
    else if (y === y0 + 1) c = "F";
    else if (y === y1 - 1) c = "g";
    else if (y === y1 - 2) c = "f";
    else if (x === x0 && y < y1 - 2) c = "F";
    else if (x === x1 - 1) c = "f";
    r.set(x, y, c);
  }
  const leftBarkEdge = (y) => 10 + (hash(0, y >> 2, 81) % 4) + (y > 60 && y < 80 ? 2 : 0);
  const tunnelY = (x) => 123 + Math.round(2 * Math.sin((x - 250) / 8));
  const TUN_X0 = 252, TUN_X1 = 300;
  function buildTerrain() {
    const r = layer();
    // left bark wall
    for (let y = 0; y < FLOOR; y++) for (let x = 0; x < leftBarkEdge(y); x++) barkTex(r, x, y, 82);
    // ceiling branch (top right) and right bark wall with the tree hole
    for (let x = 200; x < W; x++) { const b = 10 + (hash(x >> 3, 1, 83) % 3); for (let y = 0; y < b; y++) barkTex(r, x, y, 84); }
    for (let y = 8; y < BLOCK_Y; y++) { const e = 294 + (hash(1, y >> 2, 85) % 3); for (let x = e; x < W; x++) barkTex(r, x, y, 84); }
    // floor, left ledge, right shelf (sapwood)
    for (let y = FLOOR; y < ROOTS; y++) for (let x = 0; x < W; x++) woodTex(r, x, y, 0, FLOOR, W, ROOTS, 3);
    for (let y = LEDGE_Y; y < LEDGE_Y + 16; y++) for (let x = 8; x < VINE_X; x++) woodTex(r, x, y, 8, LEDGE_Y, VINE_X, LEDGE_Y + 16, 5);
    for (let y = BLOCK_Y; y < FLOOR; y++) for (let x = BLOCK_X; x < W; x++) woodTex(r, x, y, BLOCK_X, BLOCK_Y, W + 1, FLOOR + 1, 9);
    // tree hole: a dark oval opening in the bark, its sill on the shelf
    for (let y = BLOCK_Y - 26; y < BLOCK_Y; y++) for (let x = HOLE_X - 9; x < W; x++) {
      const dx = (x - HOLE_X) / 9, dy = (y - (BLOCK_Y - 10)) / 16, d = dx * dx + dy * dy;
      if (d <= 0.62) r.set(x, y, "z"); else if (d <= 1) r.set(x, y, d <= 0.8 ? "g" : "f");
    }
    // beetle-larva tunnel inside the shelf; the part it has bored through is loose (crumbs and cracks)
    for (let x = TUN_X0; x <= TUN_X1; x++) {
      const yc = tunnelY(x);
      for (let y = yc - 4; y <= yc + 3; y++) {
        const edge = y === yc - 4 || y === yc + 3;
        r.set(x, y, edge ? (hash(x, y, 86) % 3 ? "e" : "f") : y >= yc + 1 ? "g" : "z");
      }
      if (x > 266 && hash(x, 0, 87) % 3 === 0) r.set(x, yc + 2, hash(x, 1, 87) % 2 ? "F" : "e");   // frass on the floor
      if (x > 266 && hash(x, 2, 87) % 7 === 0) {                                                      // loosened wood
        const up = hash(x, 3, 87) % 2, len = 2 + (hash(x, 4, 87) % 3);
        for (let k = 1; k <= len; k++) r.set(x + (k >> 1), up ? yc - 4 - k : yc + 3 + k, "f");
      }
    }
    // bark cracks and worm holes letting light in
    for (const s of SHAFTS) for (let k = -3; k <= 3; k++) {
      const x = s.x - 3 + (k & 1), c = Math.abs(k) <= 1 ? "l" : "k";
      r.set(x, s.y + k, c); r.set(x - 1, s.y + k, Math.abs(k) <= 2 ? "b" : "f");
    }
    for (const [hx, hy] of [[222, 4], [262, 5], [306, 30]]) {
      r.set(hx, hy, "k"); r.set(hx + 1, hy, "d"); r.set(hx, hy + 1, "d"); r.set(hx + 1, hy + 1, "b");
      r.set(hx - 1, hy, "g"); r.set(hx + 2, hy, "g"); r.set(hx, hy - 1, "z"); r.set(hx + 1, hy + 2, "z");
    }
    return r;
  }
  // Under the floor: a dark root mat, then the ground water the roots drink from.
  const WATER_Y = ROOTS + 4;
  function buildRootZone() {
    const r = layer();
    for (let y = ROOTS; y < H; y++) for (let x = 0; x < W; x++) {
      let c;
      if (y < WATER_Y) c = hash(x, y, 91) % 6 === 0 ? "f" : "z";
      else if (y === WATER_Y) c = hash(x >> 1, 0, 98) % 5 === 0 ? "w" : "x";
      else c = hash(x >> 2, y, 91) % 9 === 0 ? "q" : "y";
      r.set(x, y, c);
    }
    const roots = [];
    for (let x = 16; x < W - 6; x += 17 + (hash(x, 0, 92) % 11)) if (Math.abs(x - VINE_X - 6) > 8) roots.push(x);
    roots.push(VINE_X + 6);
    return { r, roots };
  }
  function drawRoots(r, roots) {                  // roots taper down into the water; the vine's root is the thickest
    for (const x0 of roots) {
      const big = x0 === VINE_X + 6, len = big ? H - ROOTS : 9 + (hash(x0, 1, 93) % 7);
      let x = x0;
      for (let k = 0; k < len; k++) {
        const y = ROOTS + k, wet = y > WATER_Y;
        if (y >= H) break;
        if (k > 1 && hash(x0, k, 94) % 3 === 0) x += hash(x0, k, 95) % 2 ? 1 : -1;
        const wide = big ? 3 : k < len / 2 ? 2 : 1;
        for (let i = 0; i < wide; i++) r.set(x + i, y, i === 0 ? (wet ? "f" : "e") : wet ? "g" : "f");
        if (big) r.set(x, y, wet ? "e" : "F");
        if (k > 3 && hash(x0, k, 96) % 4 === 0) {
          const right = hash(x0, k, 97) % 2 === 1, sx = right ? x + wide : x - 1;
          r.set(sx, y + 1, "f"); r.set(sx + (right ? 1 : -1), y + 2, "g");
        }
      }
    }
  }

  // ---- mechanisms (looks only) ----
  function drawVine(r, a) {                       // vine ladder: two twining stems, leafy rungs, root bulb at the floor
    const top = LEDGE_Y - 16, x0 = VINE_X;
    for (let y = top + 4; y < FLOOR; y++) {
      const wl = Math.round(Math.sin(y / 6)), wr = Math.round(Math.sin(y / 6 + 2.4));
      r.set(x0 + 2 + wl, y, "n"); r.set(x0 + 3 + wl, y, "o");
      r.set(x0 + 12 + wr, y, "n"); r.set(x0 + 13 + wr, y, "o");
    }
    for (let y = top + 8, k = 0; y < FLOOR - 2; y += 8, k++) {      // rungs
      for (let x = x0 + 3; x <= x0 + 12; x++) r.set(x, y, (x + k) % 3 === 0 ? "m" : "n");
      for (let x = x0 + 4; x <= x0 + 11; x++) r.set(x, y + 1, "o");
      const sway = tri(a + k * 3, 12, 1), left = k % 2 === 0, lx = left ? x0 - 1 + sway : x0 + 14 + sway;
      const leaf = left ? ["mm..", "nmmn", ".oo."] : ["..mm", "nmmn", ".oo."];
      spr(r, leaf, lx - (left ? 1 : 0), y - 3);
    }
    spr(r, ["..mn.", ".n..n", "n....", ".n.m.", "..n.."], x0 + 10 + tri(a, 16, 1), top);   // tendril curl at the top
    for (let y = FLOOR - 6; y < FLOOR; y++) for (let x = x0 + 2; x <= x0 + 13; x++) {          // root bulb
      const d = Math.abs(x - (x0 + 7.5)) / 6 + (FLOOR - y) / 7;
      if (d < 1.1) r.set(x, y, x < x0 + 6 ? "F" : y > FLOOR - 3 ? "f" : "e");
    }
  }
  const VES_L = 178, VES_R = 210, VES_TOP = BLOCK_Y + 2, VES_BOT = FLOOR;   // communicating vessel, tiles 11–13
  const LEVEL_L = 110, LEVEL_R = 126, CH_Y0 = 136, CH_Y1 = 143;
  function buildVessel(r) {
    const arm = (x0) => {
      for (let y = VES_TOP; y < VES_BOT; y++) for (let x = x0 - 1; x <= x0 + 12; x++) {
        const o = x === x0 - 1 || x === x0 + 12 || y === VES_BOT - 1;
        const wall = x <= x0 + 1 || x >= x0 + 10;
        if (o) r.set(x, y, "z"); else if (wall) r.set(x, y, x === x0 ? "v" : x === x0 + 11 ? "x" : "w"); else r.set(x, y, "z");
      }
      for (let x = x0 - 2; x <= x0 + 13; x++) { r.set(x, VES_TOP - 2, "z"); r.set(x, VES_TOP - 1, x < x0 + 6 ? "u" : "v"); r.set(x, VES_TOP, "w"); }
      for (let y = VES_TOP + 8; y < VES_BOT - 6; y += 6) r.set(x0 + 1, y, "u");          // level marks
    };
    arm(VES_L); arm(VES_R);
    for (let y = CH_Y0 - 3; y <= CH_Y1 + 3; y++) for (let x = VES_L + 10; x <= VES_R + 1; x++) {   // bottom channel
      const c = y === CH_Y0 - 3 || y === CH_Y1 + 3 ? "z" : y < CH_Y0 ? (y === CH_Y0 - 2 ? "v" : "w") : y > CH_Y1 ? "x" : "z";
      r.set(x, y, c);
    }
    for (let y = CH_Y0; y <= CH_Y1; y++) {        // inner walls of the arms stay open into the channel
      for (const x of [VES_L + 10, VES_L + 11, VES_R, VES_R + 1]) r.set(x, y, "z");
    }
  }
  function waterCol(r, x0, x1, top, bot, a, seed) {
    for (let y = top; y <= bot; y++) for (let x = x0; x <= x1; x++) {
      let c = y === top ? "s" : y <= top + 2 ? "r" : "q";
      if (y === top && (x + (a >> 1) + seed) % 5 === 0) c = "t";
      r.set(x, y, c);
    }
  }
  function drawVesselWater(r, a) {
    waterCol(r, VES_L + 2, VES_L + 9, LEVEL_L, CH_Y1, a, 0);
    waterCol(r, VES_R + 2, VES_R + 9, LEVEL_R, CH_Y1, a, 2);
    waterCol(r, VES_L + 10, 193, CH_Y0, CH_Y1, a, 1);
    waterCol(r, 206, VES_R + 1, CH_Y0, CH_Y1, a, 3);
    for (let y = CH_Y0; y <= CH_Y1; y++) r.set(VES_L + 10, y, y === CH_Y0 ? "r" : "q");
    // valve: a small barred gate in the channel, hand wheel on top
    for (let y = CH_Y0 - 5; y <= CH_Y1 + 3; y++) for (let x = 194; x <= 205; x++) {
      const o = x === 194 || x === 205 || y === CH_Y0 - 5 || y === CH_Y1 + 3;
      r.set(x, y, o ? "z" : x === 195 || y === CH_Y0 - 4 ? "u" : (x - 195) % 3 === 0 ? "v" : x === 204 ? "x" : "w");
    }
    spr(r, [".zzzz.", "zvuuvz", "zu.zuz", "zvzzvz", ".zvvz.", "..zz.."], 197, CH_Y0 - 11);
  }
  const BIN_X = 239, BIN_Y = 12;                  // collection bin hanging from the branch, mouth facing down
  function buildBin(r) {
    for (let y = BIN_Y; y < BIN_Y + 13; y++) for (let x = BIN_X; x < BIN_X + 18; x++) {
      const o = x === BIN_X || x === BIN_X + 17 || y === BIN_Y + 12;
      r.set(x, y, o ? "z" : y === BIN_Y ? "u" : x === BIN_X + 1 ? "u" : x === BIN_X + 16 ? "x" : "v");
    }
    for (let k = 0; k < 7; k++) {                 // funnel narrowing towards the mouth
      const y = BIN_Y + 13 + k, x0 = BIN_X + 1 + k, x1 = BIN_X + 16 - k;
      if (x1 - x0 < 5) break;
      for (let x = x0; x <= x1; x++) r.set(x, y, x === x0 || x === x1 ? "z" : x === x0 + 1 ? "v" : "w");
    }
    for (let k = 0; k < 3; k++) for (let y = BIN_Y + 3; y < BIN_Y + 9; y++) for (let x = BIN_X + 3 + k * 4; x < BIN_X + 6 + k * 4; x++) {
      const o = y === BIN_Y + 3 || y === BIN_Y + 8 || x === BIN_X + 3 + k * 4 || x === BIN_X + 5 + k * 4;
      r.set(x, y, o ? "x" : k === 0 ? "s" : "y");                                       // gauge: one cell filled
    }
  }
  const VENT_X = 248;
  const SMOKE = new Uint8Array(W * H);
  function drawSmoke(r, a) {                      // light smoke rises from the vent into the bin and thins out near it
    const top = BIN_Y + 19, bot = BLOCK_Y - 2, life = 24, x0 = VENT_X - 10, x1 = VENT_X + 10;
    SMOKE.fill(0, top * W, (bot + 3) * W);
    for (let i = 0; i < 12; i++) {                // overlapping puffs, merged into one soft column below
      const p = (a + i * 2) % life, y = bot - Math.floor((p * (bot - top)) / life);
      const x = VENT_X + Math.round(2.6 * Math.sin((a + i * 2) / 4 + p / 6) * Math.min(1, p / 6));
      const rad = p < 4 ? 1 : p < 10 ? 2 : p < 17 ? 3 : 4;
      for (let yy = -rad; yy <= rad; yy++) for (let xx = -rad; xx <= rad; xx++) {
        if (xx * xx + yy * yy > rad * rad + 1 || y + yy <= top || y + yy > bot + 2) continue;
        SMOKE[(y + yy) * W + x + xx] = 1;
      }
    }
    const on = (x, y) => y > top && y <= bot + 2 && SMOKE[y * W + x] === 1;
    for (let y = top + 1; y <= bot + 2; y++) for (let x = x0; x <= x1; x++) {
      if (!on(x, y)) continue;
      const fade = y - top < 10 ? 4 + (y - top) : 16;                // thins out under the funnel
      if (bay(x, y + a * 2) >= fade) continue;
      const c = !on(x, y - 1) || !on(x - 1, y) ? "u" : !on(x, y + 1) || !on(x + 1, y) ? "w" : "v";
      r.set(x, y, c);
    }
    r.set(VENT_X - 1, BLOCK_Y, "z"); r.set(VENT_X, BLOCK_Y, "z"); r.set(VENT_X + 1, BLOCK_Y, "g");
  }

  // ---- animals (8 fps) ----
  // Longhorn larva in its tunnel: cream segments, broad first segment, small dark head with mandibles.
  // Crawls to the boring face (head left), chews, then backs up the tunnel; 4-frame squeeze wave while moving.
  const LARVA_LEN = 14;
  function larvaState(tick) {
    const t = tick % 136;
    if (t < 48) return { hx: 280 - (t >> 1), f: (t >> 1) & 3, chew: false };
    if (t < 80) return { hx: 256, f: 0, chew: true, c: t - 48 };
    if (t < 128) return { hx: 256 + ((t - 80) >> 1), f: 3 - (((t - 80) >> 1) & 3), chew: false };
    return { hx: 280, f: 0, chew: false };
  }
  function drawLarva(r, tick) {
    const s = larvaState(tick), wave = 4 + s.f * 3;
    for (let i = 0; i < LARVA_LEN; i++) {
      const x = s.hx + i, yc = tunnelY(x);
      let y0, y1;
      if (i < 3) { y0 = yc - 2; y1 = yc + 1; } else if (i < 6) { y0 = yc - 3; y1 = yc + 2; } else if (i < 12) { y0 = yc - 2; y1 = yc + 2; } else { y0 = yc - 1; y1 = yc + 1; }
      if (!s.chew && Math.abs(i - wave) <= 1 && i >= 6) { y0++; }               // the squeeze travels along the body
      for (let y = y0; y <= y1; y++) {
        let c;
        if (i < 3) c = i === 0 ? (y === yc - 1 || y === yc + 1 ? "g" : "f") : y === y0 ? "e" : "f";
        else if (y === y0) c = i < 6 ? "d" : "c";
        else if (y === y1) c = "F";
        else if (i >= 6 && (i - 6) % 2 === 1) c = "E";                             // segment rings
        else c = i < 6 && y === y0 + 1 ? "d" : "c";
        r.set(x, y, c);
      }
    }
    const yc = tunnelY(s.hx), open = s.chew ? (s.c >> 1) & 1 : (s.f & 1);            // mandibles
    r.set(s.hx - 1, yc - 1 - open, "z"); r.set(s.hx - 1, yc + open, "z");
    if (s.chew) for (let k = 0; k < 3; k++) {                                         // chewed crumbs drop to the tunnel floor
      const p = (s.c + k * 5) % 10;
      r.set(s.hx - 2 - (k & 1), Math.min(tunnelY(s.hx) + 2, yc - 2 + p), k === 1 ? "F" : "d");
    }
  }
  const SQ_TAIL = [                              // bushy tail curling up behind the back
    "..........zzzz..",
    ".........zbbaaz.",
    "........zbbbaaaz",
    "........zbbaaaaz",
    "........zbaaaaaz",
    ".........zbaaaaz",
    ".........zbaaaaz",
    "..........zbaaaz",
    "..........zbaaaz",
    ".........zbaaaz.",
    "........zbaaaaz.",
    ".......zbaaaaz..",
    ".......zzzzzz...",
  ];
  const SQ_BODY = [
    "................", "................", "................", "................", "................",
    "................", "................", "................", "................",
    "...zccaaz.......",
    "...zcccaaz......",
    "...zcccaaaaaz...",
    "...zccaaaaaaz...",
    "....zcaaaaaz....",
    "...zbaaazbaz....",
    "..zzzzzzzzzz....",
  ];
  const SQ_HEAD = [                               // drawn from row 2: ear tufts, eye, cream cheek
    "..z.z...",
    ".zazaz..",
    ".zaaaaz.",
    "zaaaaaaz",
    "zazbaaaz",
    "zcaaaaz.",
    ".zccaz..",
  ];
  const SQ_EAR = ".zaz.z..";
  const SQ_CONE = [".zz.", "zegz", "zgez", "zegz", ".zz."];
  function drawSquirrel(r, tick) {                // nibbles the cone, flicks its tail, twitches an ear
    const x = HOLE_X - 18, y = BLOCK_Y - 16, t = tick % 40;
    const nib = (t >= 6 && t < 8) || (t >= 10 && t < 12) || (t >= 14 && t < 16) ? 1 : 0;
    const flick = t >= 24 && t < 28 ? 1 : 0, ear = t >= 34 && t < 36;
    spr(r, SQ_TAIL, x + flick, y - flick);
    spr(r, SQ_BODY, x, y);
    spr(r, SQ_HEAD, x, y + 2 + nib);
    if (ear) spr(r, [SQ_EAR], x, y + 2 + nib);
    spr(r, SQ_CONE, x, y + 9 - nib);
    r.set(x + 3, y + 10 - nib, "a"); r.set(x + 3, y + 12 - nib, "a");                    // paws round the cone
  }

  // ---- ambient (4 fps) ----
  let LIT = null;                                 // one step brighter along the wood ramp (background lighting only)
  const LIGHT = () => LIT || (LIT = Object.assign({}, PB.LIGHT, { z: "g", h: "a", a: "b" }));
  function creakGrow(a) { const p = a % 44; return p < 2 ? 1 : p < 4 ? 2 : p < 5 ? 1 : 0; }
  function drawDust(r, a) {                       // sawdust shaken loose by the creak
    const p = a % 44;
    if (p > 16) return;
    for (const [x0, d] of [[118, 0], [134, 3], [151, 1], [196, 2], [143, 5]]) {
      const y = 4 + (p - d) * 4;
      if (p >= d && y < FLOOR - 2) { r.set(x0 + ((p >> 2) & 1), y, d & 1 ? "e" : "F"); }
    }
  }
  function halo(r, cx, cy, rad) {                 // sap glow on the ring wall around a lit joint (background only)
    const map = LIGHT();
    remap(r, cx - rad, cy - rad, cx + rad + 1, cy + rad + 1, map, (x, y) => {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      return d <= rad * rad && bay(x, y) < 16 - Math.floor((d * 14) / (rad * rad));
    });
  }
  function drawSap(r, bgOnly, a) {                // bgOnly: pass 1 lights the wall, pass 2 draws the sap itself
    for (const c of CONDUITS) {
      const heads = pulseHeads(c, a), cx = c.x + (c.w >> 1);
      for (const y of jointsOf(c)) {
        const lit = heads.some((h) => h >= y - 3 && h <= y + 1);
        if (!lit) continue;
        if (bgOnly) { halo(r, cx, y, 9); continue; }
        for (let x = c.x - 1; x <= c.x + c.w; x++) r.set(x, y, x < c.x || x >= c.x + c.w ? "n" : "m");
        r.set(cx, y, "l");
      }
      if (bgOnly) continue;
      for (const h of heads) for (let k = 0; k < 11; k++) {
        const y = h + k;
        if (y < 0 || y >= H) continue;
        for (let x = c.x + 1; x < c.x + c.w - 1; x++) {
          let col = k < 2 ? "m" : k < 6 ? "n" : "o";
          if (k === 0 && x === cx) col = "l";
          if (codeAt(r, x, y) === "o" && col === "o") continue;
          r.set(x, y, col);
        }
      }
    }
  }
  function drawGroundWater(r, a) {                // slow glints drifting in the water under the floor
    for (let i = 0; i < 9; i++) {
      const y = ROOTS + 4 + ((i * 5) % 12), x = (hash(i, 0, 97) % W + a * (i % 2 ? 1 : -1) + W * 8) % W;
      r.set(x, y, "q"); r.set(x + 1, y, i % 3 ? "q" : "r");
    }
  }

  function build() {
    PB = window.PB;
    REV = new Map(PB.CODES.map((k) => [(PB.RGB[k][0] << 16) | (PB.RGB[k][1] << 8) | PB.RGB[k][2], k]));
    const rings = ringList();
    const zone = buildRootZone();
    const terrain = buildTerrain();
    buildVessel(terrain);
    buildBin(terrain);
    const props = layer();
    spr(props, CRATE, 136, FLOOR - 16);
    spr(props, CRATE, 28, LEDGE_Y - 16);
    spr(props, PORTER, 106, FLOOR - 16);
    L = { rings: [0, 1, 2].map((g) => buildRings(rings, g)), shaft: buildShaftMask(), conduits: buildConduits(), zone, terrain, props };
  }

  window.PB_CONCEPT_SCENES["tree_heart"] = {
    draw(ctx, tick) {
      if (!L) build();
      tick = Math.max(0, tick | 0);
      const a = tick >> 1, r = layer();
      r.data.set(L.rings[creakGrow(a)].data);
      const map = LIGHT();
      for (let i = 0; i < W * H; i++) if (L.shaft[i]) { const x = i % W, y = (i / W) | 0, c = codeAt(r, x, y); if (map[c]) r.set(x, y, map[c]); }
      drawSap(r, true, a);
      drawDust(r, a);
      r.blit(L.zone.r, 0, 0);
      drawGroundWater(r, a);
      r.blit(L.conduits, 0, 0);
      drawSap(r, false, a);
      drawRoots(r, L.zone.roots);
      drawSmoke(r, a);
      r.blit(L.terrain, 0, 0);
      drawVesselWater(r, a);
      drawVine(r, a);
      drawLarva(r, tick);
      drawSquirrel(r, tick);
      r.blit(L.props, 0, 0);
      const img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
