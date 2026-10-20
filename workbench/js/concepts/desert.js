/* ART-04j（opus）地图概念场景：沙漠集市 `desert`。只看大致效果，不是正式资产，不进游戏。
 * 接口（WB-05）：PB_CONCEPT_SCENES.desert.draw(ctx, tick)；ctx 是 320×180 画布，tick 每秒 +8（每 125 毫秒调用一次）。
 * 像素都经 PB.Raster 写入：只用 ENDESGA 32、整数像素、不抗锯齿。环境 4 fps（f = tick >> 1），动物 8 fps（tick）。
 * 分层（远 → 近）：
 *   1 天空：靛 → 紫 → 玫红，Bayer 抖动过渡；新月、闪烁的星
 *   2 远城剪影：平顶房、洋葱圆顶、宣礼塔，零星暖窗；远处一道沙梁
 *   3 远处沙暴：每 40 秒卷起一阵（约 12 秒），把远景遮淡后散去
 *   4 中景沙丘（橙金）：迎风坡受光带风纹，背风坡暗；丘顶被风吹出一条条沙线
 *   5 集市拱门（尖拱、城垛、两座小塔、花砖）、条纹帐篷（檐边随风抖）、地毯摊（流苏摆）、灯串
 *   6 铜灯一明一暗：只把背景沿调色板提亮一级，边缘 Bayer 抖动
 *   7 空中流线、贴地沙线
 *   8 地面与左平台（砂岩砖，风堆的小沙堆）；流沙坑：表面向中心凹、纹路往中间走，坑里漏斗形漩涡缓缓打旋，一只箱子半陷
 *   9 比例尺：主角 char.portitor、木箱 obj.crate_wood（不动）；沙漠蝎子（怪物）、骆驼（提示动物）
 * 不画收件人、货物、界面和文字。
 */
(function () {
  "use strict";
  const W = 320, H = 180, GY = 148;                                // 地面顶边：格子 oy = 4，第 9 行
  const LEDGE = { x1: 47, top: 116 };                              // 左平台：第 0–2 列，高 2 格
  const PIT = { x0: 176, x1: 223, cx: 200, top: 150, bot: 171 };   // 流沙坑：第 11–13 列
  const HORIZON = 126;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  const mod = (a, n) => ((a % n) + n) % n;
  const hash = (x, y, s) => window.PB.h32(x, y, s);
  function tri(t, period, amp) {                                   // 整数三角波（同 core/ambient.js）
    const p = mod(t, period), half = period >> 1, v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  function disc(R, cx, cy, r, c) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) R.set(cx + x, cy + y, c);
  }
  function onion(cx, base, r, put) {                               // 洋葱圆顶：画在 base 之上，最宽半径 r，顶上尖
    const hgt = Math.round(r * 1.8);
    for (let i = 0; i < hgt; i++) {
      const t = i / hgt, k = t < 0.35 ? 0.8 + t * 0.57 : Math.pow((1 - t) / 0.65, 0.8);
      const hw = Math.round(r * Math.min(1, k));
      for (let x = cx - hw; x <= cx + hw; x++) put(x, base - 1 - i);
    }
    for (let j = 1; j <= 3; j++) put(cx, base - hgt - j);
  }

  // ---------- 1 天空 ----------
  const SKY = [[0, "y"], [28, "x"], [54, "B"], [82, "C"], [110, "a"]];   // 每段起始行；交界前 10 行抖动
  const MOON = { x: 236, y: 18 }, STARS = [];
  function skyAt(x, y) {
    let i = 0;
    while (i + 1 < SKY.length && y >= SKY[i + 1][0]) i++;
    const nx = SKY[i + 1];
    return nx && y >= nx[0] - 10 && bay(x, y) < ((y - nx[0] + 10) * 16) / 10 ? nx[1] : SKY[i][1];
  }
  function sky(R) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) R.set(x, y, skyAt(x, y));
    disc(R, MOON.x, MOON.y, 5, "w");
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      const X = MOON.x + x, Y = MOON.y + y;
      if ((x - 2) * (x - 2) + (y + 2) * (y + 2) <= 22) R.set(X, Y, skyAt(X, Y));   // 挖出新月
      else if (R.get(X, Y) === "w" && x * x + y * y >= 13) R.set(X, Y, "v");       // 外沿亮一级
    }
    for (let i = 0; i < 18; i++) {
      const x = hash(i, 1, 11) % W, y = 2 + (hash(i, 2, 11) % 44);
      if (Math.abs(x - MOON.x) > 9 || Math.abs(y - MOON.y) > 9) STARS.push({ x, y, c: i % 3 ? "w" : "v", ph: hash(i, 3, 11) % 16 });
    }
  }

  // ---------- 2 远城剪影 + 远处沙梁 ----------
  const CITY = "g";
  function minaret(R, cx, top) {
    R.rect(cx - 2, top + 11, 5, HORIZON - top - 11, CITY);        // 塔身
    R.rect(cx - 3, top + 9, 7, 2, CITY);                            // 阳台
    R.rect(cx - 1, top + 3, 3, 6, CITY);                            // 上段
    R.rect(cx - 2, top + 2, 5, 1, CITY);
    R.rect(cx - 1, top + 1, 3, 1, CITY);                            // 尖帽
    R.set(cx, top, CITY);
    R.vline(cx, top - 3, 3, CITY);
  }
  function city(R) {
    const put = (x, y) => R.set(x, y, CITY);
    for (const [x, y, w] of [[0, 112, 18], [52, 113, 22], [72, 109, 12], [94, 111, 16], [118, 110, 14], [130, 113, 20], [150, 107, 12],
      [160, 111, 18], [176, 106, 14], [188, 110, 10], [214, 105, 18], [230, 109, 14], [244, 112, 20], [262, 108, 16], [282, 111, 20], [300, 109, 20]])
      R.rect(x, y, w, HORIZON - y, CITY);
    for (const [cx, base, r] of [[84, 108, 9], [204, 106, 13], [160, 108, 6], [250, 110, 7]]) {
      R.rect(cx - r + 1, base, 2 * r - 1, HORIZON - base, CITY);
      onion(cx, base, r, put);
    }
    for (const [cx, top] of [[108, 78], [182, 64], [230, 74], [20, 80]]) minaret(R, cx, top);
    for (const [x, y] of [[56, 117], [62, 119], [77, 114], [100, 116], [121, 115], [134, 118], [153, 112], [165, 116], [179, 111], [197, 113],
      [204, 113], [211, 113], [217, 110], [233, 114], [247, 117], [266, 113], [287, 116], [305, 114], [108, 91], [182, 77], [230, 87], [20, 93]])
      R.set(x, y, "a");                                             // 零星暖窗
  }
  function farRidge(R) {
    for (let x = 0; x < W; x++) {
      const top = 119 + tri(x * 2 + 40, 220, 4) + tri(x * 3, 130, 2);
      for (let y = top; y < H; y++) R.set(x, y, y === top || (y < top + 3 && bay(x, y) < 5) ? "a" : "f");
    }
  }

  // ---------- 4 中景沙丘：左坡迎风受光（橙金，带风纹），右坡背风偏暗；丘顶是一道尖脊 ----------
  // [丘顶 x, 丘顶 y, 迎风坡宽, 背风坡宽, 高]
  const DUNES = [[22, 110, 70, 46, 40], [98, 119, 64, 40, 32], [170, 106, 84, 56, 44], [238, 112, 62, 42, 38], [318, 108, 70, 40, 42]];
  const CRESTS = [[22, 110], [98, 119], [170, 106]];               // 会吹出沙线的丘顶（看得见的那几个）
  function duneTop(x) {
    let best = null;
    for (const [cx, cy, lw, ls, hh] of DUNES) {
      const lee = x > cx, t = lee ? (x - cx) / ls : (cx - x) / lw;
      if (t >= 1) continue;
      const s = lee ? 1 - Math.pow(1 - t, 1.7) : t * t * (3 - 2 * t);   // 迎风坡平缓的 S 形；背风坡脊下陡、坡脚缓
      const y = Math.round(cy + hh * s);
      if (!best || y < best.y) best = { y, lee };
    }
    return best;
  }
  function dunes(R) {
    for (let x = 0; x < W; x++) {
      const d = duneTop(x);
      if (!d) continue;
      for (let y = d.y; y <= GY + 1; y++) {
        const k = y - d.y;
        let c;
        if (d.lee) c = k === 0 ? "b" : k < 3 && bay(x, y) < 8 - k * 3 ? "b" : "a";
        else c = k === 0 ? "d" : k === 1 && bay(x, y) < 6 ? "d" : mod(k - ((x >> 2) & 3), 6) === 3 && mod(x + k, 7) < 4 ? "j" : "b";   // 风纹
        R.set(x, y, c);
      }
    }
  }

  // ---------- 5 集市拱门 ----------
  function archHole(x, y) {                                         // 尖拱门洞（两段圆弧，拱顶 y≈64）
    if (x < 56 || x > 119 || y < 64 || y >= GY) return false;
    if (y >= 100) return true;
    const s = Math.sqrt(1296 - (100 - y) * (100 - y));
    return x >= 92 - s && x <= 83 + s;
  }
  function archBody(x, y) {
    if (y >= GY || y < 0) return false;
    if (x >= 40 && x <= 135 && y >= 50) return !archHole(x, y);
    if ((x >= 35 && x <= 45) || (x >= 130 && x <= 140)) return y >= 42;   // 两座小塔
    if (x >= 40 && x <= 135 && y >= 45) return mod(x - 46, 8) < 5;        // 城垛
    return false;
  }
  function arch(R) {
    for (let y = 30; y < GY; y++) for (let x = 30; x < 146; x++) {
      if (!archBody(x, y)) continue;
      let c = "f";
      if (!archBody(x - 1, y) && !archHole(x - 1, y)) c = "e";        // 左侧受光
      if (!archBody(x, y - 1) && !archHole(x, y - 1)) c = "e";        // 顶边受光
      if (!archBody(x + 1, y) && !archHole(x + 1, y)) c = "g";        // 右侧背光
      if (archHole(x + 1, y) || archHole(x + 2, y)) c = "g";           // 门洞左内侧
      if (archHole(x - 1, y) || archHole(x - 2, y)) c = "e";           // 门洞右内侧
      if (archHole(x, y + 1) || archHole(x, y + 2)) c = "g";           // 拱腹
      R.set(x, y, c);
    }
    for (let y = 52; y <= 55; y++) for (let x = 47; x <= 128; x++)    // 门楣花砖（冷色、低对比）
      R.set(x, y, mod(x + y, 4) === 0 || mod(x - y, 4) === 0 ? "B" : "x");
    for (let y = 58; y < GY; y++) { R.set(50, y, "g"); R.set(125, y, "g"); }  // 门框
    for (let x = 50; x <= 125; x++) R.set(x, 58, "g");
    for (const cx of [62, 113]) { R.set(cx, 64, "e"); R.set(cx - 1, 65, "e"); R.set(cx + 1, 65, "e"); R.set(cx, 66, "e"); R.set(cx, 65, "g"); }
    for (const cx of [40, 135]) onion(cx, 42, 5, (x, y) => R.set(x, y, x < cx ? "e" : x > cx ? "g" : "f"));
    R.hline(50, 89, 4, "g"); R.hline(122, 89, 4, "g");               // 壁灯托架
  }

  // ---------- 5 条纹帐篷、地毯摊、灯串 ----------
  const TENT = { px: 278, py: 66, x0: 240, x1: 316, eave: 96, door: 292 };
  const STRIPE = ["h", "b", "x"];                                   // 红、金、靛
  const roofY = (x) => { const t = Math.abs(x - TENT.px) / 38; return t > 1 ? 999 : TENT.py + Math.round(30 * Math.sqrt(t)); };
  const roofStripe = (x, y) => STRIPE[mod(Math.floor(((x - TENT.px) * 6) / (y - TENT.py + 6)), 3)];
  function tent(R) {
    const DIM = window.PB.DIM;
    for (let x = TENT.x0; x <= TENT.x1; x++) for (let y = roofY(x); y < TENT.eave; y++) {
      const c = roofStripe(x, y);
      R.set(x, y, x > TENT.px + 1 ? DIM[c] : c);                    // 右半边背光
    }
    for (let x = 244; x <= 312; x++) for (let y = TENT.eave + 4; y < GY; y++) R.set(x, y, DIM[STRIPE[mod((x - 244) >> 3, 3)]]);
    for (let y = TENT.eave + 6; y < GY; y++) {                        // 门帘掀开，露出暗的内里
      const hw = Math.min(9, (y - TENT.eave - 6) >> 1);
      for (let x = TENT.door - hw; x <= TENT.door + hw; x++) R.set(x, y, y > GY - 4 ? "y" : "z");
      R.set(TENT.door - hw - 1, y, "f"); R.set(TENT.door + hw + 1, y, "f");
    }
    R.set(TENT.door - 10, 119, "b"); R.set(TENT.door + 10, 119, "b");  // 门帘绑带
    R.vline(244, TENT.eave, GY - TENT.eave, "f"); R.vline(312, TENT.eave, GY - TENT.eave, "f");
    R.vline(TENT.px, TENT.py - 8, 5, "f"); disc(R, TENT.px, TENT.py - 2, 1, "e"); R.set(TENT.px - 1, TENT.py - 3, "b");  // 顶尖铜饰
  }
  function carpet(R, x0, y0, w, h, base, border, motif) {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dd = Math.abs(x - cx) + Math.abs(y - cy) * 0.6;
      let c = base;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) c = border;
      else if (x === 1 || y === 1 || x === w - 2 || y === h - 2) c = base;
      else if (dd < 3) c = motif;
      else if (dd < 4) c = border;
      else if (mod(x + y, 4) === 0 && mod(x - y, 4) === 0) c = border;
      R.set(x0 + x, y0 + y, c);
    }
  }
  const CARPETS = [[213, 99, 12, 27, "h", "b", "x"], [227, 99, 12, 21, "x", "h", "b"]];
  function stall(R) {
    R.vline(210, 94, GY - 94, "f"); R.set(210, 93, "e");             // 木桩
    R.hline(210, 97, 32, "g");                                       // 横杆接到帐篷左檐
    for (const c of CARPETS) carpet(R, ...c);
  }
  const CORD = { x0: 141, y0: 52, x1: 276, y1: 63, sag: 20 };
  const cordY = (x) => { const t = (x - CORD.x0) / (CORD.x1 - CORD.x0); return Math.round(CORD.y0 + (CORD.y1 - CORD.y0) * t + 4 * CORD.sag * t * (1 - t)); };
  const LAMPS = [];
  function cordAndChains(R) {
    let py = cordY(CORD.x0);
    for (let x = CORD.x0; x <= CORD.x1; x++) {
      const y = cordY(x);
      for (let yy = Math.min(y, py); yy <= Math.max(y, py); yy++) R.set(x, yy, "g");
      py = y;
    }
    const add = (x, top, y, big) => { R.vline(x, top, y - top, "g"); LAMPS.push({ x, y, big }); };
    add(88, 65, 76, true); add(70, 72, 84); add(106, 72, 84);       // 门洞里三盏，挂在拱腹上
    add(53, 90, 94); add(122, 90, 94);                               // 门框两侧壁灯
    for (const x of [162, 188, 214, 240, 262]) { const y = cordY(x); add(x, y + 1, y + 4); }   // 灯串
    add(TENT.door, TENT.eave + 4, TENT.eave + 9);                    // 帐篷里
  }

  // ---------- 8 地面与左平台：砂岩砖，顶面 1 像素受光边 + 2 行沙壳 ----------
  function solid(x, y) {
    if (x < 0 || x >= W || y >= H) return true;
    if (y >= GY) return !(x >= PIT.x0 && x <= PIT.x1 && y <= PIT.bot);
    return x <= LEDGE.x1 && y >= LEDGE.top;
  }
  function terrain(R) {
    for (let y = LEDGE.top; y < H; y++) for (let x = 0; x < W; x++) {
      if (!solid(x, y)) continue;
      const inPit = x >= PIT.x0 && x <= PIT.x1;                     // 坑底埋在流沙下，不受光
      let c;
      if (!solid(x, y - 1)) c = inPit ? "f" : "d";
      else if (!inPit && (!solid(x, y - 2) || !solid(x, y - 3))) c = "b";
      else if (!solid(x + 1, y)) c = "f";                            // 朝右的侧面背光
      else if (!solid(x - 1, y)) c = "b";                            // 朝左的侧面受光
      else {
        const row = (y - 4) >> 3, bx = mod(x + (row & 1) * 8 + (row % 3) * 3, 16), by = (y - 4) & 7, hh = hash(x, y, 5) % 23;
        c = by === 7 || bx === 15 ? "f" : by === 0 || bx === 0 ? "b" : hh === 0 ? "F" : hh === 1 ? "a" : "e";
      }
      R.set(x, y, c);
    }
    for (const [x0, x1, h, base] of MOUNDS) for (let x = x0; x <= x1; x++) {   // 风堆在砖面上的小沙堆
      const top = base - Math.round(h * Math.sin((Math.PI * (x - x0)) / (x1 - x0)));
      if (top >= base) continue;
      for (let y = top; y <= base; y++) R.set(x, y, y === top || (y === top + 1 && bay(x, y) < 6) ? "d" : "b");
    }
  }
  const MOUNDS = [[2, 34, 4, LEDGE.top], [120, 137, 3, GY], [225, 247, 4, GY], [303, 319, 3, GY]];

  // ---------- 动态（环境 4 fps） ----------
  function stars(F, f) {
    for (const s of STARS) {
      const p = mod(f + s.ph, 16), cur = F.get(s.x, s.y);
      if (p < 13 && (cur === "y" || cur === "x")) F.set(s.x, s.y, p === 0 ? "u" : s.c);
    }
  }
  const STORM = { period: 160, start: 20, rise: 12, hold: 20, fade: 16 };   // 帧（4 fps）：40 秒一次，每次约 12 秒
  function storm(F, f) {                                            // 3 远处沙暴：卷起 → 停一会儿 → 散去，只遮远景
    const q = mod(f, STORM.period) - STORM.start, { rise, hold, fade } = STORM;
    if (q < 0 || q >= rise + hold + fade) return;
    const amt = q < rise ? (q * 16) / rise : q < rise + hold ? 16 : ((rise + hold + fade - q) * 16) / fade, up = Math.min(60, q * 5);
    for (let x = 0; x < W; x++) {
      const top = HORIZON - up + tri(x * 3 + f * 4, 96, 5) + tri(x * 5 - f * 3, 58, 3);
      for (let y = Math.max(0, top); y < HORIZON + 4; y++)
        if (bay(x, y) < (Math.min(16, y - top + 3) * amt * 3) / 64) F.set(x, y, y - top < 3 ? "F" : "e");
    }
  }
  const PLUME_OFF = [0, -1, 2];
  function plumes(F, f) {                                           // 4 丘顶吹沙：每个丘顶 3 条，阵风时伸长
    CRESTS.forEach(([cx, cy], k) => {
      const len = 26 + tri(f * 2 + k * 11, 28, 8);
      for (let s = 0; s < 3; s++) {
        const drop = 70 + s * 40, L = len - s * 5;
        for (let i = 1; i <= L; i++) {
          if (mod(i - f * 3 + s * 3, 9) > 5) continue;              // 一段段往下风走
          const x = cx + i, y = cy + PLUME_OFF[s] + Math.floor((i * i) / drop);
          if (bay(x, y) >= 16 - Math.floor((i * 14) / L)) continue;  // 越远越稀
          F.set(x, y, i < L / 3 ? "c" : i < (2 * L) / 3 ? "d" : "F");
        }
      }
    });
  }
  function streaks(F, f) {                                          // 7 空中流线
    for (let k = 0; k < 5; k++) {
      const run = f * (6 + (k % 3) * 2) + k * 131, span = W + 60, lap = Math.floor(run / span);
      const x = mod(run, span) - 30, y = 90 + (hash(k, lap, 41) % 50), len = 8 + (hash(k, lap, 43) % 9);
      for (let i = 0; i < len; i++) if (i <= len / 2 || !(i & 1)) F.set(x - i, y + (i >= len - 2 ? 1 : 0), i < 2 ? "d" : "F");
    }
  }
  function drifts(F, f) {                                           // 7 贴地沙线
    for (let k = 0; k < 3; k++) {
      const x = mod(f * 4 + k * 113, W + 40) - 20, len = 10 + k * 4;
      for (let i = 0; i < len; i++) {
        const X = x - i;
        if (mod(i + k, 3) === 2 || (X >= PIT.x0 - 1 && X <= PIT.x1 + 1)) continue;
        F.set(X, GY - 1 - (mod(i + f, 7) === 3 ? 1 : 0), i < 2 ? "d" : "F");
      }
    }
  }
  function valance(F, f) {                                          // 帐篷檐边花边随风抖
    const DIM = window.PB.DIM;
    for (let x = TENT.x0 - 1; x <= TENT.x1 + 1; x++) {
      const s = mod(x - TENT.x0 + (f & 1), 6), bot = TENT.eave + 4 + (s >= 1 && s <= 4 ? 1 : 0) + (s === 2 || s === 3 ? 1 : 0);
      const c = STRIPE[mod(Math.floor((x - TENT.x0 + 1) / 6), 3)];
      for (let y = TENT.eave; y <= bot; y++) F.set(x, y, x > TENT.px + 1 ? DIM[c] : c);
    }
  }
  function fringes(F, f) {                                          // 地毯流苏随风摆
    for (const [x0, y0, w, h] of CARPETS) for (let i = 1; i < w; i += 2) {
      F.set(x0 + i, y0 + h, "F");
      F.set(x0 + i + (mod(f + (i >> 2), 4) < 2 ? 1 : 0), y0 + h + 1, "F");
    }
  }

  // ---------- 6 铜灯：一明一暗；亮光只落在背景上（沿调色板提亮一级，边缘 Bayer 抖动，重叠不叠加） ----------
  const LAMP_S = ["..f..", ".fef.", "fbWbf", "eWLWe", "fbWbf", ".fef.", "..e.."];
  const LAMP_B = ["...f...", "..fef..", ".fbebf.", "fbWbWbf", "eWLWLWe", "fbWbWbf", ".fbebf.", "..fef..", "...e...", "...f..."];
  let mask = null;
  function lampState(i, f) {                                        // 2 亮、1 弱、0 暗：每盏灯错开节奏，偶尔闪一下
    if (mod(f + i * 5, 14) >= 11) return 0;
    return hash(i, f, 63) % 7 === 0 ? 1 : 2;
  }
  function lamps(F, f) {
    const LIGHT = window.PB.LIGHT, st = LAMPS.map((l, i) => lampState(i, f));
    mask.fill(0);
    LAMPS.forEach((l, i) => {
      if (!st[i]) return;                                           // 暗着的灯不发光
      const r = (st[i] === 2 ? 8 : 6) + (l.big ? 2 : 0), cx = l.x, cy = l.y + (l.big ? 5 : 3), r2 = r * r, in2 = (r - 3) * (r - 3);
      for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 <= in2 || (d2 <= r2 && bay(x, y) < ((r2 - d2) * 16) / (r2 - in2))) mask[y * W + x] = 1;
      }
    });
    for (let i = 0; i < W * H; i++) if (mask[i]) {
      const x = i % W, y = (i / W) | 0, c = F.get(x, y);
      if (LIGHT[c]) F.set(x, y, LIGHT[c]);
    }
    LAMPS.forEach((l, i) => {
      const rows = l.big ? LAMP_B : LAMP_S, s = st[i], win = s === 2 ? "k" : s === 1 ? "j" : "a", core = s === 2 ? "l" : s === 1 ? "k" : "j";
      const x0 = l.x - (rows[0].length >> 1);
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch !== ".") F.set(x0 + rx, l.y + ry, ch === "W" ? win : ch === "L" ? core : ch);
        }
      });
    });
  }

  // ---------- 8 流沙坑：表面中间凹、纹路往中心走；坑里漏斗形漩涡缓缓打旋 ----------
  const surfaceY = (x) => { const u = (x - PIT.cx) / 24; return PIT.top + Math.round(2 * (1 - u * u)); };
  function quicksand(F, f) {
    const { x0, x1, cx, top, bot } = PIT;
    for (let x = x0; x <= x1; x++) {
      const sy = surfaceY(x);
      for (let y = sy; y <= bot; y++) {
        const dep = y - top, hw = 23 - dep * 0.95, dx = x - cx + 0.5;
        let c = hash(x, y, 9) % 11 === 0 ? "e" : "F";
        if (hw > 1 && Math.abs(dx) <= hw) {                        // 漏斗：三条旋臂绕中轴转，越往下越窄、越暗
          const s = dx / hw, ph = (Math.asin(Math.max(-1, Math.min(1, s))) * 3) / Math.PI + dep * 0.2 - f * 0.125;
          const fr = ph - Math.floor(ph), back = Math.abs(s) > 0.8;
          c = fr < 0.32 ? (dep > 12 ? "g" : "f") : fr < 0.44 ? "d" : dep > 14 ? "f" : "e";
          if (back) c = c === "d" ? "e" : c === "e" ? "F" : "e";     // 转到边上，变淡
          if (hw < 4) c = bay(x, y) < 8 ? "g" : "f";                // 漏斗口最深处
        }
        if (y === sy) c = mod((x < cx ? x : 2 * cx - x) - f, 6) < 2 ? "c" : "d";
        else if (y === sy + 1 && c === "F") c = "d";
        F.set(x, y, c);
      }
      F.set(x, bot + 1, "f");                                       // 坑底一道暗边
    }
    for (let y = top + 1; y <= bot; y++) { F.set(x0, y, "e"); F.set(x1, y, "e"); }   // 坑壁
    for (let k = 0; k < 4; k++) {                                   // 沙粒沿表面滑向中心
      const p = mod(f + k * 5, 15), x = k & 1 ? x1 - p : x0 + p;
      F.set(x, surfaceY(x) - 1, "d");
    }
    for (const x of [190, 191, 208, 209]) F.set(x, surfaceY(x) - 1, "d");   // 箱子两边堆起的沙
  }

  // ---------- 9 比例尺和动物 ----------
  function sprite(F, id, anim, x, y, flip) {
    const S = window.PB.sprites;
    if (!S || !S.has || !S.has(id)) return false;
    S.draw(F, id, anim, 0, x, y, !!flip);
    return true;
  }
  function crate(F, x, y) {
    if (sprite(F, "obj.crate_wood", "default", x, y)) return;
    F.rect(x - 8, y - 16, 16, 16, "z"); F.rect(x - 7, y - 15, 14, 14, "d");
    for (let i = 2; i < 14; i++) F.set(x - 8 + i, y - 1 - i, "e");
  }
  function figure(F, x, y) {                                        // 备用人影（精灵库不在时）
    F.rect(x - 4, y - 14, 8, 14, "z"); F.rect(x - 3, y - 13, 6, 3, "k"); F.rect(x - 2, y - 10, 4, 3, "E");
    F.rect(x - 3, y - 7, 6, 4, "i"); F.rect(x - 2, y - 3, 4, 2, "h");
  }
  function makeSprite(w, h, outline, paint) {                       // 先填身体，再自动描 1 像素外轮廓，最后叠细节
    const g = Array.from({ length: h }, () => new Array(w).fill(".")), det = [];
    paint((x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; }, (x, y, c) => det.push([x, y, c]), g);
    const o = g.map((r) => r.slice());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (g[y][x] !== ".") continue;
      if ((x > 0 && g[y][x - 1] !== ".") || (x < w - 1 && g[y][x + 1] !== ".") || (y > 0 && g[y - 1][x] !== ".") || (y < h - 1 && g[y + 1][x] !== ".")) o[y][x] = outline;
    }
    for (const [x, y, c] of det) if (x >= 0 && y >= 0 && x < w && y < h) o[y][x] = c;
    return o.map((r) => r.join(""));
  }
  function ellipse(put, cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) put(x, y, c);
  }
  function seg(put, x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) put(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }
  // 沙漠蝎子（怪物）：朝右画，4 帧 = 爬 2 帧（脚位交替）+ 停下举尾 2 帧
  const SCORP = [];
  const SCORP_ROWS = [                                              // 朝右；f 身体、e 受光、g 腹面、i 毒针；"." 透明（描边自动加）
    ["", "", ".........eee", "........ef.ff", ".......ef...ff", ".......ef....fi", ".......ef.....i", "........ff............ff",
      ".........ff.........fff", ".........efefefe...ff..ff", "........ffffffffff.f", "........fffffffffff", ".........gggggggggg"],
    ["", ".........." + "eee", ".........ef.ff", "........ef...ff", "........ef....fi", ".......ef......i", ".......ef.............ff",
      "........ff...........f", ".........ff.........ff.ff", ".........efefefe...ff", "........ffffffffff.f", "........fffffffffff", ".........gggggggggg"],
    ["", ".........." + "eee", ".........ef.fff", "........ef....fi", "........ef.....i", ".......ef", ".......ef.............ff",
      "........ff...........f", ".........ff.........ff.ff", ".........efefefe...ff", "........ffffffffff.f", "........fffffffffff", ".........gggggggggg"]];
  const SCORP_LEGS = [".........f..f..f..f", "........f..f..f..f"];
  function scorpionFrames() {
    const frame = (body, legs) => {
      const rows = body.concat(legs ? [SCORP_LEGS[1], SCORP_LEGS[0]] : SCORP_LEGS, [""]);
      return makeSprite(26, rows.length, "z", (put) => rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== ".") put(x, y, r[x]); }));
    };
    SCORP.push(frame(SCORP_ROWS[0], 0), frame(SCORP_ROWS[0], 1), frame(SCORP_ROWS[1], 0), frame(SCORP_ROWS[2], 0));
  }
  function scorpion(F, tick) {                                      // 在拱门和流沙坑之间来回爬，到头停下举尾巴、毒针点两下
    const span = 20, pause = 12, p = tick % (2 * (span + pause));
    let x, right = true, moving = true;
    if (p < span) x = p;
    else if (p < span + pause) { x = span; moving = false; }
    else if (p < 2 * span + pause) { x = 2 * span + pause - p; right = false; }
    else { x = 0; right = false; moving = false; }
    const rows = SCORP[moving ? tick & 1 : 2 + ((tick >> 1) & 1)];
    F.blitRows(rows, 130 + x, GY - rows.length, !right);
  }
  // 骆驼（提示动物）：朝左站在帐篷前；嚼东西（下颌 3 帧）、甩尾巴、偶尔眨眼
  const CAMEL = {};
  function camelFrame(jaw, tail, blink) {
    const key = jaw + "," + tail + "," + blink;
    if (CAMEL[key]) return CAMEL[key];
    return (CAMEL[key] = makeSprite(35, 28, "g", (put0, det0, g) => {
      const put = (x, y, c) => put0(x + 1, y, c), det = (x, y, c) => det0(x + 1, y, c);
      for (const [x, c] of [[9, "F"], [12, "e"], [21, "e"], [24, "F"]]) {
        for (let y = 18; y <= 25; y++) { put(x, y, c); put(x + 1, y, c); }
        for (let i = -1; i <= 1; i++) put(x + i + (i < 0 ? 0 : 0), 26, "f");
      }
      ellipse(put, 17.5, 14.5, 8.6, 4.3, "F");                       // 身体
      ellipse(put, 18.5, 10.5, 5.3, 4.4, "F");                       // 驼峰
      ellipse(put, 11.5, 15, 3.2, 3.6, "F");                         // 胸
      for (const [x, y] of [[11, 12], [9, 13], [7, 12], [6, 10], [5, 8], [5, 7]]) ellipse(put, x, y, 1.6, 1.6, "F");   // 脖子
      ellipse(put, 4.5, 5.8, 3.4, 2, "F");                           // 头
      put(7, 3, "F");                                                // 耳
      for (let x = 1; x <= 3; x++) put(x, 7, "F");                   // 上唇
      for (let x = 1; x <= 3; x++) put(x + (jaw === 2 ? -1 : 0), jaw ? 9 : 8, "F");   // 下颌：嚼
      const end = [[28, 19], [30, 18], [31, 16]][tail];
      seg(put, 27, 12, end[0], end[1] - 1, "e"); put(end[0], end[1], "f");          // 尾巴 + 尾梢
      for (let y = 1; y < 27; y++) for (let x = 0; x < 35; x++) {    // 上沿亮一级，肚子下沿暗一级
        if (g[y][x] !== "F") continue;
        if (g[y - 1][x] === ".") g[y][x] = "d";
        else if (y < 18 && g[y + 1][x] === ".") g[y][x] = "e";
      }
      det(5, 5, blink ? "e" : "z"); det(1, 6, "f"); det(3, 6, "h"); det(4, 7, "h");  // 眼、鼻孔、红笼头
    }));
  }
  function camel(F, tick) {
    const jaw = [0, 0, 1, 1, 2, 2, 1, 1][tick % 8], tp = tick % 48, tail = tp < 32 ? 0 : [1, 2, 1, 0][(tp >> 1) & 3];
    const rows = camelFrame(jaw, tail, tick % 40 < 2 ? 1 : 0);
    F.blitRows(rows, 250, GY - rows.length, false);
  }

  // ---------- 合成 ----------
  let L = null, F = null, img = null, imgCtx = null;
  function layer(paint) { const R = new window.PB.Raster(W, H); paint(R); return R; }
  function build() {
    scorpionFrames();
    return {
      far: layer((R) => { sky(R); city(R); farRidge(R); }),
      dunes: layer(dunes),
      town: layer((R) => { arch(R); tent(R); stall(R); cordAndChains(R); }),
      ground: layer(terrain),
    };
  }
  function draw(ctx, tick) {
    const PB = window.PB;
    if (!PB || !PB.Raster) return;
    if (!L) { L = build(); F = new PB.Raster(W, H); mask = new Uint8Array(W * H); }
    tick = Math.max(0, Math.floor(tick || 0));
    const f = tick >> 1;
    F.data.set(L.far.data);
    stars(F, f); storm(F, f);
    F.blit(L.dunes, 0, 0); plumes(F, f);
    F.blit(L.town, 0, 0); valance(F, f); fringes(F, f);
    lamps(F, f);
    streaks(F, f); drifts(F, f);
    F.blit(L.ground, 0, 0);
    crate(F, PIT.cx, 158); quicksand(F, f);                         // 先画箱子，再让流沙盖住下半截
    crate(F, 88, GY);
    if (!sprite(F, "char.portitor", "idle", 72, GY, false)) figure(F, 72, GY);
    scorpion(F, tick); camel(F, tick);
    if (imgCtx !== ctx) { img = ctx.createImageData(W, H); imgCtx = ctx; }
    img.data.set(F.data);
    ctx.putImageData(img, 0, 0);
  }

  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
  window.PB_CONCEPT_SCENES.desert = { draw };
})();