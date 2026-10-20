/* ART-04h 概念场景：熊猫竹林（bamboo）。只看大致效果：不是正式资产，不是关卡，没有规则。
 * 一屏 320×180；只用 ENDESGA 32（像素都经 PB.Raster 写入，色码不对会直接报错）；整数像素，不抗锯齿。
 * 环境 4 fps：f = tick >> 1；动物 8 fps：直接用 tick。地形第一次调用时画好缓存，之后每帧只叠会动的东西。
 * 后→前：雾绿底色 → 远竹 → 雾带 → 中竹 → 低雾 → 近竹 → 溪水 → 地形（石路、石拱桥、石阶、弯竹、主角、箱子）
 *        → 竹叶青、熊猫 → 雨丝、竹叶滴水。竹子随一阵阵风一齐弯下，再弹回来。 */
window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
(function () {
  "use strict";
  const W = 320, H = 180;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  const hash = (x, y, s) => window.PB.h32(x, y, s);
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    return Math.floor(((p < half ? p : period - p) * 4 * amp) / period) - amp;
  }
  const raster = () => new window.PB.Raster(W, H);
  function vgrad(r, x0, x1, stops) {
    for (let i = 0; i + 1 < stops.length; i++) {
      const [ya, ca] = stops[i], [yb, cb] = stops[i + 1];
      for (let y = ya; y < yb; y++) {
        const t = Math.floor(((y - ya) * 17) / (yb - ya));
        for (let x = x0; x < x1; x++) r.set(x, y, bay(x, y) < t ? cb : ca);
      }
    }
  }
  function remap(r, x, y, map) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const c = r.get(x, y);
    if (map[c]) r.set(x, y, map[c]);
  }
  function grid(w, h) { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill(".")); return g; }
  function gset(g, x, y, c) { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; }
  function outlined(g, c) {
    const h = g.length, w = g[0].length, o = g.map((row) => row.slice());
    const full = (x, y) => x >= 0 && y >= 0 && x < w && y < h && g[y][x] !== ".";
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if (g[y][x] === "." && (full(x - 1, y) || full(x + 1, y) || full(x, y - 1) || full(x, y + 1))) o[y][x] = c;
    return o.map((row) => row.join(""));
  }
  function stamp(g, rows, ox, oy) { rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== ".") gset(g, ox + x, oy + y, row[x]); }); }

  const GROUND = 144, STEP1 = 128, STEP2 = 112, PLAT = 96, WATER = 164;
  const BANK0 = 100, BANK1 = 184; // 溪水在两岸之间，水面 y164；上面架一座石拱桥
  const groundAt = (x) => (x < BANK0 ? GROUND : x < BANK1 ? WATER : x < 216 ? STEP1 : x < 248 ? STEP2 : PLAT);
  // 一阵风：多数时候静止；起风时竹子一齐弯下，再弹回（带一点回弹）。数值 = 近竹竹梢的水平位移
  const GUST = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 6, 8, 9, 10, 10, 9, 7, 4, 0, -3, -2, 0, 0, 0];

  // ---------- 竹子（每帧画，随风弯） ----------
  // layer 0 远（细、淡）、1 中（暗剪影）、2 近（亮绿、有高光和竹节）
  const STALKS = [];
  for (let i = 0; i < 27; i++) STALKS.push({ x: 2 + i * 12 + (hash(i, 0, 3) % 8), w: 2, layer: 0, seed: i, base: H });
  for (let i = 0; i < 14; i++) STALKS.push({ x: 6 + i * 23 + (hash(i, 1, 3) % 12), w: 3, layer: 1, seed: 40 + i, base: H });
  [20, 118, 152, 236, 280, 313].forEach((x, i) => STALKS.push({ x, w: 5, layer: 2, seed: 80 + i, base: groundAt(x + 2) }));
  const SCOL = [["o", "o"], ["o", "p", "p"], ["m", "n", "n", "o", "o"]];
  const LCOL = [["o", "o"], ["p", "o"], ["n", "m"]];
  function swayAt(s, A, y) {
    const k = [1, 2, 3][s.layer], span = s.base + 40, d = s.base - y;
    return Math.round((A * k * d * d) / (2 * span * span));
  }
  function leaves(r, x0, y, s) {
    const LC = LCOL[s.layer], n = 2 + (hash(s.seed, y, 11) % 3);
    for (let i = 0; i < n; i++) {
      const dir = hash(s.seed, y + i, 13) & 1 ? 1 : -1, len = 4 + (hash(s.seed, y + i, 17) % 4) + s.layer, sl = 1 + (i & 1);
      const sx = dir > 0 ? x0 + s.w : x0 - 1;
      for (let t = 0; t < len; t++) {
        const lx = sx + dir * t, ly = y + i + Math.floor((t * sl) / 3);
        r.set(lx, ly, t < len - 1 ? LC[0] : LC[1]);
        if (s.layer === 2 && t > 0 && t < len - 2) r.set(lx, ly + 1, LC[0]);
      }
    }
  }
  function stalk(r, s, A) {
    const cols = SCOL[s.layer], gap = [22, 18, 15][s.layer], ph = hash(s.seed, 7, 3) % gap, leafTop = [150, 118, 96][s.layer];
    for (let y = 0; y < s.base; y++) {
      const x0 = s.x + swayAt(s, A, y), node = (s.base - y + ph) % gap;
      for (let j = 0; j < s.w; j++) {
        let c = cols[j];
        if (node === 0) c = s.layer === 0 ? "p" : "o";
        else if (node === 1 && s.layer === 2) c = j < 2 ? "m" : "n";
        r.set(x0 + j, y, c);
      }
      if (node === 0 && y < leafTop && hash(s.seed, y, 9) % 3 !== 0) leaves(r, x0, y, s);
    }
  }
  // 雾：把底下的颜色沿调色板提亮一级，Bayer 抖动出薄厚
  const FOG = { p: "o", o: "n", n: "m", x: "w", w: "v", y: "x", z: "y" };
  function fogBand(r, y0, y1, off, strength) {
    const hgt = y1 - y0;
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      const v = 16 - Math.abs(((y - y0) * 32) / hgt - 16);
      for (let x = 0; x < W; x++) {
        const m = tri(x - off, 150, 8) + 8;
        if (bay(x, y) < (v * m * strength) / 256) remap(r, x, y, FOG);
      }
    }
  }

  // ---------- 底色和地形（不动） ----------
  function buildBack() {
    const r = raster();
    vgrad(r, 0, W, [[0, "o"], [44, "n"], [H, "n"]]);
    for (let y = 96; y < 150; y++) for (let x = 0; x < W; x++) if (bay(x, y) < 2 - Math.abs(y - 123) / 14) r.set(x, y, "m");
    // 对岸长苔的土坡：只从拱洞里露出来
    for (let y = 156; y < H; y++) for (let x = BANK0; x < BANK1; x++) r.set(x, y, y === 156 || (y < 159 && bay(x, y) < 8) ? "n" : "o");
    return r;
  }
  // 深绿的土：最上面几行是苔藓，偶尔有小石子
  function earthPx(r, x, y, top) {
    const d = y - top;
    let c = "p";
    if (d < 3 && bay(x, y) < 12 - d * 4) c = "o";
    else if (hash(x >> 1, y, 41) % 41 === 0) c = "x";
    else if (bay(x, y) === 0 && hash(x >> 3, y >> 3, 43) % 3 === 0) c = "o";
    r.set(x, y, c);
  }
  // 青灰石板路：4px 厚，石缝里长苔；湿石板顶面一道亮边
  const SEG = new Array(W).fill(0), JOINT = new Array(W).fill(false);
  for (let x = 0, i = 0; x < W; i++) { const len = 12 + (hash(i, 0, 47) % 9); for (let k = 0; k < len && x < W; k++, x++) { SEG[x] = i; JOINT[x] = k === len - 1; } }
  function pathPx(r, x, y) {
    const d = y - GROUND, moss = hash(SEG[x], x >> 2, 49) % 4 === 0;
    if (d > 4) return earthPx(r, x, y, GROUND + 5);
    if (JOINT[x]) return r.set(x, y, d === 0 ? "n" : "x");
    r.set(x, y, d === 0 ? (moss ? "m" : "u") : d === 1 ? (moss ? "n" : "v") : d < 4 ? (hash(SEG[x], d, 53) % 3 === 0 ? "w" : "v") : "x");
  }
  // 长青苔的石阶：一级一块大石板（高 16px），一块块嵌在土坡里；台面湿亮、苔藓往下爬
  function slabPx(r, x, y, top, x0, cut) {
    const d = y - top, seam = cut.includes(x), m = hash(x >> 2, top, 57) % 5;
    let c = (d < 9 ? bay(x, y) < 13 : bay(x, y) < 4) ? "v" : "w";
    if (seam || x === x0 + 1) c = seam ? "x" : "u";
    if (d === 0) c = m < 2 ? "m" : "u";
    else if (d === 1) c = m < 3 ? "n" : "v";
    else if (d < 2 + ((hash(x, top, 59) % 7) - 1) && !seam) c = d < 4 ? "n" : "o";
    else if (d === 14) c = "w";
    else if (d === 15) c = "x";
    if (x === x0) c = d === 0 ? "m" : d < 15 ? "x" : "y";
    r.set(x, y, c);
  }
  // 石拱桥：中间拱起，半椭圆的拱洞，拱圈一块块楔形石，上面一道矮石栏
  const BX = 142, deckY = (x) => 137 + Math.round((7 * (x - BX) * (x - BX)) / (46 * 46));
  const archE = (x, y, ax, ay) => ((x + 0.5 - BX) / ax) ** 2 + ((y + 0.5 - WATER) / ay) ** 2;
  function bridge(r) {
    for (let x = 96; x <= 188; x++) {
      const top = deckY(x);
      for (let y = top; y < WATER; y++) {
        const e = archE(x, y, 24, 18);
        if (e < 1) {
          if (e > 0.86 && y < WATER - 5) r.set(x, y, e > 0.94 ? "y" : "x"); // 拱洞里沿的阴影
          continue;
        }
        let c;
        if (archE(x, y, 29, 23) < 1) {
          const th = Math.atan2((WATER - y - 0.5) / 18, (x + 0.5 - BX) / 24), k = (th / Math.PI) * 13, fr = k - Math.floor(k);
          c = fr < 0.13 ? "x" : Math.floor(k) === 6 ? "u" : e < 1.1 ? "w" : "v";
        } else {
          const d = y - top, row = Math.floor(d / 5), ry = d % 5, sh = (row & 1) * 5 + 3, rx = (x + sh) % 10;
          c = ry === 4 || rx === 9 ? "x" : hash(Math.floor((x + sh) / 10), row, 51) % 3 === 0 ? "v" : "w";
          if (ry === 0 && c !== "x") c = c === "v" ? "u" : "v";
          if (c !== "x" && hash(x >> 2, row, 55) % 6 === 0 && bay(x, y) < 9) c = "n";
        }
        if (y === top) c = "u";
        else if (y < top + 3 && hash(x >> 1, 1, 63) % 3 === 0) c = y === top + 1 ? "m" : "n";
        r.set(x, y, c);
      }
    }
    // 矮石栏：顶面亮、下面暗；望柱每 14px 一根，柱头圆
    for (let x = 98; x <= 186; x++) {
      const top = deckY(x);
      r.set(x, top - 4, "u"); r.set(x, top - 3, "v"); r.set(x, top - 2, "v"); r.set(x, top - 1, "w");
    }
    for (let px = 98; px <= 186; px += 14) {
      const top = deckY(px + 1);
      for (let y = top - 7; y < top; y++) { r.set(px, y, "u"); r.set(px + 1, y, "v"); r.set(px + 2, y, "w"); }
      r.set(px + 1, top - 8, "u");
      if (hash(px, 0, 65) % 2) r.set(px + 2, top - 6, "n");
    }
  }
  // 弯竹（vine 的样子）：根在右边平台上，拱过来，梢头搭在第一级石阶上，像一条能爬的路
  const BENT = [[306, 96], [304, 80], [298, 64], [288, 52], [274, 45], [258, 42], [242, 45], [228, 54], [216, 68], [207, 84], [201, 102], [197, 118], [195, 127]];
  function bentBamboo(r) {
    let n = 0;
    for (let i = 0; i + 1 < BENT.length; i++) {
      const [ax, ay] = BENT[i], [bx, by] = BENT[i + 1], steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      const flat = Math.abs(bx - ax) > Math.abs(by - ay);
      for (let k = 0; k < steps; k++, n++) {
        const x = Math.round(ax + ((bx - ax) * k) / steps), y = Math.round(ay + ((by - ay) * k) / steps);
        const node = n % 13, cols = node === 0 ? ["o", "o", "o", "o"] : node === 1 ? ["m", "m", "n", "n"] : ["m", "n", "n", "o"];
        for (let j = 0; j < 4; j++) flat ? r.set(x, y - 1 + j, cols[j]) : r.set(x - 1 + j, y, cols[j]);
        if (node === 0 && n > 20 && hash(n, 0, 61) % 2 === 0) leaves(r, x - 2, y + 1, { layer: 2, w: 4, seed: 300 + n });
      }
    }
    for (const [dx, dy] of [[0, 0], [-3, 2], [3, 1]]) leaves(r, 193 + dx, 120 + dy, { layer: 2, w: 3, seed: 400 + dx });
  }
  const STEPS = [[184, 216, STEP1, [201]], [216, 248, STEP2, [233]], [248, W, PLAT, [271, 297]]];
  function buildFront() {
    const r = raster();
    for (let x = 0; x < BANK0; x++) for (let y = GROUND; y < H; y++) pathPx(r, x, y);
    for (const [x0, x1, top, cut] of STEPS) for (let x = x0; x < x1; x++) {
      for (let y = top; y < top + 16; y++) slabPx(r, x, y, top, x0, cut);
      for (let y = top + 16; y < H; y++) earthPx(r, x, y, top + 16);
    }
    // 土里嵌着的圆石头和竹根，免得土层一大片死黑
    for (const [cx, cy, rx, ry] of [[14, 161, 7, 4], [52, 171, 9, 5], [84, 156, 5, 3], [30, 176, 6, 3], [200, 163, 8, 5], [233, 150, 6, 4], [263, 133, 9, 5], [301, 158, 7, 4], [277, 171, 5, 3], [250, 176, 8, 4], [312, 124, 5, 3]])
      for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
        const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (e <= 1) r.set(x, y, e > 0.62 ? "x" : y < cy && x <= cx ? "v" : "w");
      }
    for (const [x0, y0, len] of [[8, 149, 9], [40, 149, 6], [70, 149, 11], [194, 144, 8], [226, 128, 12], [258, 112, 9], [287, 112, 14], [309, 112, 7]])
      for (let k = 0, x = x0; k < len; k++) { r.set(x, y0 + k, "o"); if (hash(x0, k, 67) % 3 === 0) x += hash(x0, k, 69) & 1 ? 1 : -1; }
    bridge(r);
    bentBamboo(r);
    const S = window.PB.sprites;
    S.draw(r, "char.portitor", "idle", 0, 40, GROUND, false);
    S.draw(r, "obj.crate_wood", "default", 0, 64, GROUND, false);
    S.draw(r, "obj.crate_wood", "default", 0, 64, GROUND - 16, false);
    return r;
  }

  // ---------- 动物 ----------
  // 竹叶青（怪物）：缠在近处的竹子上，头垂下来吐信子；翠绿身子、黄白侧线、红尾尖、黄眼
  function buildSnake(tongue, sway) {
    const g = grid(16, 32), P = (x, y, c) => gset(g, x, y, c);
    for (let k = 0; k < 3; k++) for (let t = 0; t < 9; t++) {
      const x = 4 + t, y = 6 + k * 5 - Math.floor(t / 3);
      P(x, y, "m"); P(x, y + 1, t % 3 === 1 ? "l" : "n");
    }
    P(13, 2, "m"); P(13, 1, "n"); P(14, 0, "i"); P(13, 0, "i");
    const body = [[4, 18], [3, 19], [2, 20], [2, 21], [3, 22], [4, 23], [4, 24], [3 + sway, 25]];
    for (const [x, y] of body) { P(x, y, "m"); P(x + 1, y, "n"); P(x - 1, y, "l"); }
    const hx = 1 + sway;
    [[0, "mmmn"], [-1, "mkmmn"], [0, "mmmn"], [1, "mn"]].forEach(([dx, row], i) => { for (let k = 0; k < row.length; k++) P(hx + dx + k, 26 + i, row[k]); });
    const out = outlined(g, "z").map((row) => row.split(""));
    if (tongue) { out[30][hx + 1] = "i"; if (tongue === 2) { out[31][hx] = "i"; out[31][hx + 2] = "i"; } }
    return out.map((row) => row.join(""));
  }
  // 熊猫（提示动物；按 look「只有熊猫是黑白」画成黑白的熊猫崽）：正面坐着，一只胳膊抱住身边的竹子，
  // 嘴里叼着一截竹叶在啃。只写左半边和中线，右半边镜像出来，保证左右对称
  const PANDA_HALF = [
    ".zz....", "zzzzzzz", "zzttttt", "ztttttt", "zttzztt", "ztzzztt", "ztzzttt", "zttttzz",
    ".zttttt", "..zzzzz", "zzzzzzt", "zzzzztt", "zzzzttt", "zzzzttt", "zzzzztt", ".zzzz..",
  ];
  const PANDA = PANDA_HALF.map((h) => h + h.slice(0, 6).split("").reverse().join(""));
  function buildPanda(frame) {
    const g = grid(19, 18), dy = frame === 1 ? 1 : 0;
    PANDA.forEach((row, y) => { for (let x = 0; x < 13; x++) if (row[x] !== ".") gset(g, x + 1, y + 2 + (y < 9 ? dy : 0), row[x]); });
    // 抱竹子的胳膊：从身子右边伸出去，绕到竹子前面
    for (const [x, y] of [[13, 12], [14, 12], [15, 12], [16, 12], [13, 13], [14, 13], [15, 13], [16, 13], [17, 13], [16, 14], [17, 14]]) gset(g, x, y, "z");
    // 嘴里的竹叶：啃的时候一点点变短
    const leaf = frame === 2 ? [[5, 10], [4, 10]] : [[5, 10], [4, 10], [3, 11], [2, 11], [1, 12], [3, 10], [2, 10]];
    leaf.forEach(([x, y], i) => gset(g, x, y + dy, i < 2 ? "n" : "m"));
    return g.map((row) => row.join(""));
  }

  // ---------- 会动的环境 ----------
  // 溪水：拱桥的倒影跟真拱合成一个圆；水纹让倒影边缘一抖一抖，水面上有雨点的小圈
  function stream(r, f) {
    for (let y = WATER; y < H; y++) for (let x = BANK0; x < BANK1; x++) {
      const d = y - WATER, ox = d < 2 ? 0 : ((((d >> 1) + f) & 1) ? 1 : -1) * (1 + (d > 9 ? 1 : 0));
      const my = WATER - 1 - d, mx = x + ox;
      const refl = archE(mx, my, 24, 18) < 1, dash = (((x + d * 13 + (d & 1 ? f * 2 : -f * 2)) % 17) + 17) % 17 < 3 + (d & 1);
      let c = refl ? (dash ? "n" : "o") : dash ? "w" : "x";
      if (d === 0) c = (((x - f * 2) % 9) + 9) % 9 < 5 ? "v" : "o";
      else if (d > 12) c = refl ? (dash ? "o" : "p") : dash ? "x" : "y";
      r.set(x, y, c);
    }
    for (let i = 0; i < 6; i++) {
      const h = hash(i, f >> 2, 17), x = BANK0 + 6 + (h % 72), y = WATER + 1 + ((h >>> 8) % 4), st = (f + i) & 3;
      if (st === 0) r.set(x, y, "u");
      else if (st === 1) { r.set(x - 1, y, "u"); r.set(x + 1, y, "u"); }
      else if (st === 2) { r.set(x - 2, y, "v"); r.set(x + 2, y, "v"); }
    }
  }
  const WET = { p: "o", o: "n", n: "m", m: "u", x: "w", w: "v", v: "u", u: "t", y: "x", z: "y", g: "f", f: "e", e: "F", F: "d", d: "c", c: "t", t: "u", b: "d", h: "i", i: "D", k: "l", l: "t", a: "b", q: "r", r: "u", D: "E", E: "c" };
  function rain(r, f) {
    for (let i = 0; i < 90; i++) {
      const h = hash(i, 0, 5), sp = 10 + ((h >>> 8) % 4), yy = ((h >>> 12) % 200) + f * sp;
      const y = (yy % 200) - 10, x = ((h % W) + Math.floor(yy / 3)) % W, near = i % 3 === 0;
      for (let k = 0; k < (near ? 4 : 3); k++) {
        const px = x + (k >> 1), py = y + k;
        remap(r, px, py, WET);
        if (near && k < 2) remap(r, px, py, WET);
      }
    }
  }
  const DRIPS = [[15, 70], [29, 88], [112, 76], [126, 64], [160, 92], [230, 74], [243, 60], [289, 66]];
  const dripFloor = (x) => (x >= 96 && x <= 188 ? deckY(x) - 4 : groundAt(x));
  function drips(r, f) {
    DRIPS.forEach(([x, y0], i) => {
      const P = 9 + (hash(i, 0, 21) % 6), p = (f + hash(i, 1, 21)) % P, g = dripFloor(x);
      if (p < 2) { r.set(x, y0 + 1, "u"); return; }
      const y = y0 + 1 + (p - 1) * (p - 1) * 4;
      if (y < g - 1) { r.set(x, y, "u"); r.set(x, y - 1, "v"); }
      else if (y < g + 24) { r.set(x - 1, g - 2, "u"); r.set(x + 1, g - 2, "u"); r.set(x - 2, g - 1, "v"); r.set(x + 2, g - 1, "v"); }
    });
  }

  let C = null, IMG = null, IMGCTX = null;
  function draw(ctx, tick) {
    if (!C) {
      C = { back: buildBack(), front: buildFront(), r: raster(),
        snake: [0, 1, 2].map((t) => [0, 1].map((sw) => buildSnake(t, sw))), panda: [0, 1, 2].map(buildPanda) };
    }
    const r = C.r, f = tick >> 1, A = GUST[f % GUST.length];
    r.data.set(C.back.data);
    for (const s of STALKS) if (s.layer === 0) stalk(r, s, A);
    fogBand(r, 50, 92, f, 9);
    for (const s of STALKS) if (s.layer === 1) stalk(r, s, A);
    fogBand(r, 108, 150, -f - 60, 8);
    for (const s of STALKS) if (s.layer === 2) stalk(r, s, A);
    stream(r, f);
    r.blit(C.front, 0, 0);
    // 竹叶青：缠在 x=152 的近竹上，跟着竹子一起弯
    const sn = STALKS.find((s) => s.layer === 2 && s.x === 152), sx = sn.x + swayAt(sn, A, 92) - 5;
    const tp = tick % 16, tongue = tp === 9 || tp === 11 ? 1 : tp === 10 ? 2 : 0;
    r.blitRows(C.snake[tongue][(tick >> 3) & 1], sx, 80, false);
    // 熊猫：坐在平台上，抱着 x=280 的近竹，啃竹叶
    r.blitRows(C.panda[[0, 0, 1, 2, 1, 2, 1, 0][tick % 8]], 267, PLAT - 18, false);
    rain(r, f);
    drips(r, f);
    if (IMGCTX !== ctx) { IMG = ctx.createImageData(W, H); IMGCTX = ctx; }
    IMG.data.set(r.data);
    ctx.putImageData(IMG, 0, 0);
  }
  window.PB_CONCEPT_SCENES.bamboo = { draw };
})();