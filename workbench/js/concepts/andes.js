/* 地图概念场景 · 安第斯绳桥（ART-04g）。只看大致效果：不是正式美术资产，也不是能玩的关卡。
 * 画面：高原清晨，云海在脚下，远处雪峰从云里冒出来；两边是翠绿梯田和灰石墙，中间深谷上挂一座金黄的草绳桥。
 * 地标：深谷草绳桥、层层梯田、茅草顶的石砌小屋、远处雪峰。
 * 环境（4 fps）：谷里的云海两层往右流；绳桥轻轻上下晃；风一阵阵吹过梯田上的草叶；远处两只秃鹰盘旋。
 * 机关只画外观：承重绳桥（load_bridge，放箱子的地方桥面压得更低）、驮货的大羊驼（pack_animal，披红橙紫毯子、挂空驮筐，不动）。
 * 动物（8 fps）：秃鹰（怪物，俯冲抓货）在峡谷上空绕圈，转到低处收翅往下扑；羊驼（提示动物）在梯田上嚼草、甩耳朵。
 * 比例尺：主角 1 个 + 木箱 1 个（压在桥上，随桥晃 1 像素），主角不动。不画收件人、货物、界面和文字。
 * 接口见 docs/packages/ART-04g.md：PB_CONCEPT_SCENES.andes.draw(ctx, tick)，ctx 是 320×180 画布，tick 每秒 +8。
 * 所有像素经 PB.Raster 写入（只收 ENDESGA 32 的调色板代码），整数像素、不抗锯齿。 */
(function () {
  "use strict";
  const scenes = (window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {});
  const W = 320, H = 180;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  const mod = (a, n) => ((a % n) + n) % n;
  function tri(t, period, amp) {
    const p = mod(t, period), half = period >> 1, v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  const pad = (a) => { const w = Math.max(...a.map((s) => s.length)); return a.map((s) => s.padEnd(w, ".")); };

  // ---- 几何 ----
  const GL = 104, BOX_X = 152;                // 桥头（左右台地）顶 y 104；桥上木箱的位置
  const LEFT = [[60, 34], [82, 72], [104, 116], [128, 124], [150, 132]];   // 左边梯田：顶 y、右端 x（越往下越伸进峡谷）
  const RIGHT = [[104, 224], [128, 216], [150, 208]];                     // 右边台地：顶 y、左端 x
  const PEAKS = [[64, 22, 1.25], [178, 36, 1.1], [288, 18, 1.35]];         // 雪峰：x、峰顶 y、坡度

  let back = null, front = null, buf = null, img = null, CONDOR = null;
  const SEA = [], PLANTS = [];

  function sprite(r, id, x, y, flip) {        // 已确认的主角 / 木箱精灵（锚点底边中心），只当比例尺
    const S = window.PB.sprites;
    if (S && S.has(id)) { S.draw(r, id, id === "char.portitor" ? "idle" : "default", 0, x, y, !!flip); return; }
    if (id === "char.portitor") { r.rect(x - 4, y - 14, 8, 14, "z"); r.rect(x - 3, y - 13, 6, 4, "k"); r.rect(x - 3, y - 9, 6, 8, "i"); }
    else { r.rect(x - 8, y - 16, 16, 16, "z"); r.rect(x - 7, y - 15, 14, 14, "b"); }
  }
  const rows = (r, art, x, y, flip) => r.blitRows(art, x, y, flip);

  // ---- 背景：清晨的天、雪峰、天边的云海、远处的山脊 ----
  function drawSky(r) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const b = bay(x, y);
      let c = "v";
      if (y < 8) c = b < y * 2 ? "x" : "y";
      else if (y < 30) c = "x";
      else if (y < 38) c = b < (y - 30) * 2 ? "w" : "x";
      else if (y < 60) c = "w";
      else if (y < 68) c = b < (y - 60) * 2 ? "v" : "w";
      if (y >= 66 && y < 80 && b < (y - 66) >> 2) c = "F";   // 天边一点暖色的晨光
      r.set(x, y, c);
    }
  }
  function drawPeaks(r) {                     // 远处雪峰：左边受光，上半截积雪，峰尖带一点晨光
    const h32 = window.PB.h32;
    for (let x = 0; x < W; x++) {
      let top = 999, pk = null;
      for (const p of PEAKS) {
        const y = Math.round(p[1] + Math.abs(x - p[0]) * p[2] + 2 * Math.sin(x * 0.21 + p[0]) + ((h32(x >> 1, p[0], 6) % 3) - 1));
        if (y < top) { top = y; pk = p; }
      }
      const ridge = pk[0] + Math.round(3 * Math.sin(x * 0.3)), snow = pk[1] + 20 + ((h32(x, 2, 9) % 5) - 2);
      for (let y = Math.max(0, top); y < 92; y++) {
        const lit = x < ridge - (y - pk[1]) * 0.15;
        let c = y < snow ? (lit ? "u" : "v") : lit ? "w" : "x";
        if (y < snow && lit && y < pk[1] + 7 && bay(x, y) < 6) c = "E";
        if (y === top && !lit) c = y < snow ? "u" : "w";
        r.set(x, y, c);
      }
    }
  }
  function drawFarClouds(r) {                 // 铺到天边的云海（雪峰的山脚埋在里面）和远处两道暗山脊
    for (let x = 0; x < W; x++) {
      const top = Math.round(82 - 3 - 2 * Math.sin(x * 0.09) - 1.5 * Math.sin(x * 0.23 + 1));
      for (let y = top; y < H; y++) {
        const k = y - top;
        r.set(x, y, k === 0 ? "u" : k < 3 ? (bay(x, y) < 8 ? "u" : "v") : k < 16 ? "v" : bay(x, y) < 8 ? "v" : "w");
      }
    }
    const ridge = (x0, y0, x1, y1) => {
      const s = (y1 - y0) / (x1 - x0), lo = Math.min(x0, x1), hi = Math.max(x0, x1);
      for (let x = lo; x <= hi; x++) {
        const top = Math.round(y0 + (x - x0) * s + 1.5 * Math.sin(x * 0.4));
        for (let y = top; y < H; y++) r.set(x, y, y === top ? "w" : "x");
      }
    };
    ridge(40, 96, 156, 148); ridge(290, 94, 172, 148);
  }

  // ---- 前景：梯田、桥墩、小屋、驮货羊驼 ----
  function stones(r, x0, x1, y0, y1, seed) {  // 灰石墙：一层层大小不一的石块，石块左上一点亮、下沿和接缝暗（对比压低）
    const h32 = window.PB.h32;
    for (let y = y0; y < y1; y++) {
      const row = ((y - y0) / 4) | 0, fy = (y - y0) % 4, w = 7 + (h32(row, seed, 5) % 5), off = h32(row, seed, 3) % w;
      for (let x = x0; x < x1; x++) {
        const bx = mod(x + off, w);
        r.set(x, y, fy === 3 || bx === w - 1 ? "x" : fy === 0 && bx < 3 ? "v" : "w");
      }
    }
  }
  function grass(r, x0, x1, top) {            // 梯田面：一条翠绿的田（稍微从上往下看），前沿压一道暗
    for (let x = x0; x < x1; x++) for (let k = 0; k < 7; k++) {
      const b = bay(x, top + k);
      r.set(x, top + k, k === 0 ? "m" : k === 1 ? (b < 10 ? "m" : "n") : k < 5 ? (mod(x * 5 + k * 3, 23) === 0 ? "m" : "n") : k === 5 ? (b < 8 ? "n" : "o") : "o");
    }
    r.set(x0, top, "n"); r.set(x1 - 1, top, "n");
  }
  function drawTerraces(r) {
    for (let i = 0; i < LEFT.length; i++) {
      const [top, x1] = LEFT[i], bot = i + 1 < LEFT.length ? LEFT[i + 1][0] : H;
      grass(r, 0, x1, top); stones(r, 0, x1, top + 7, bot, i);
      for (let y = top + 7; y < bot; y++) r.set(x1 - 1, y, "x");
      r.hline(0, bot - 1, x1, "y");
    }
    for (let i = 0; i < RIGHT.length; i++) {
      const [top, x0] = RIGHT[i], bot = i + 1 < RIGHT.length ? RIGHT[i + 1][0] : H;
      grass(r, x0, W, top); stones(r, x0, W, top + 7, bot, i + 7);
      for (let y = top + 7; y < bot; y++) r.set(x0, y, "v");
      r.hline(x0, bot - 1, W - x0, "y");
    }
  }
  function post(r, x0) {                      // 桥头的石墩，草绳绕在上面
    stones(r, x0, x0 + 8, 87, GL, x0);
    r.hline(x0, 86, 8, "u"); r.vline(x0 + 7, 87, GL - 87, "x");
    for (let x = x0; x < x0 + 8; x++) { r.set(x, 89, x & 1 ? "k" : "d"); r.set(x, 90, "F"); }
  }
  function drawHut(r) {                       // 石砌小屋：灰石墙、黑门、金黄茅草顶
    stones(r, 264, 314, 82, GL, 5);
    r.vline(313, 82, GL - 82, "x");
    for (let y = 90; y < GL; y++) for (let x = 282; x < 291; x++) r.set(x, y, x === 282 || y === 90 ? "f" : "y");
    r.rect(300, 88, 5, 4, "y"); r.hline(300, 87, 5, "x");
    for (let y = 64; y < 84; y++) {
      const t = (y - 64) / 19, xl = Math.round(277 - 16 * t), xr = Math.round(301 + 16 * t);
      for (let x = xl; x <= xr; x++) {
        if (y === 83 && mod(x, 3) === 0) continue;
        const c = y >= 81 ? (x & 1 ? "F" : "e") : x - xl < 2 ? "k" : xr - x < 3 ? "F" : mod(x + (y >> 2), 3) === 0 ? "F" : "d";
        r.set(x, y, c);
      }
    }
    r.hline(277, 63, 25, "F"); r.hline(279, 62, 21, "e");
  }
  const LLAMA = pad([                         // 驮货的大羊驼（机关外观，不动），朝左：红橙紫毯子 + 两只空驮筐
    "..e.e", "..eEe", ".EEEEe", "EzEEEe", "EEEEe", "FEEe", "..EEe", "..EEe", "..EEe", "..EEe",
    "..EEEFaajjBBaajjF", "..EEFaajjBBaajjFFe", "..EFFccccccccccFFe", "..EFFdddFFdddFFFFe", "..eFFdeedFdeedFFFe",
    "...eFdddFFdddFFFee", "...eeFFFFFFFFFFee", "....FF.......FF", "....FF.......FF", "....Fe.......Fe", "....Fe.......Fe", "....ff.......ff",
  ]);

  function build() {
    const PB = window.PB, h32 = PB.h32;
    back = new PB.Raster(W, H); front = new PB.Raster(W, H); buf = new PB.Raster(W, H);
    img = new ImageData(buf.data, W, H);
    drawSky(back); drawPeaks(back); drawFarClouds(back);
    drawTerraces(front); post(front, 108); post(front, 225); drawHut(front);
    rows(front, LLAMA, 238, GL - LLAMA.length);
    sprite(front, "char.portitor", 100, GL, false);
    for (const [top, x0, x1] of [[60, 2, 32], [82, 3, 70], [104, 2, 44], [128, 4, 122], [150, 4, 130], [128, 220, 320], [150, 212, 320]])
      for (let x = x0; x < x1; x += 3) PLANTS.push({ x, top, fl: (h32(x, top, 4) & 31) === 3 });
    for (const [y, sp, cols, seed] of [[132, 0.5, ["v", "w", "x"], 1], [150, 1, ["u", "v", "w"], 2]]) {   // 谷里的两层云海
      const n = 160, prof = new Array(n).fill(0);
      for (let x = 0, i = 0; x < n; i++) {
        const w = 16 + (h32(i, seed, 8) % 16), hh = 3 + (h32(i, seed, 9) % 5);
        for (let k = 0; k < w && x + k < n; k++) { const u = (k - w / 2) / (w / 2); prof[x + k] = Math.round(hh * Math.sqrt(Math.max(0, 1 - u * u))); }
        x += w - 2;
      }
      SEA.push({ y, sp, cols, prof, n });
    }
    const half = ["z.z.z...........", ".zzzzz..........", "..zzzzzzuuuuuuuz", "....zzzzzzzzzzzz"];
    const base = half.map((s) => s + s.slice(0, 15).split("").reverse().join(""));
    const make = (amp, maxD) => {
      const out = Array.from({ length: 11 }, () => new Array(31).fill("."));
      base.forEach((row, y) => { for (let x = 0; x < 31; x++) { const d = Math.abs(x - 15); if (row[x] === "." || d > maxD) continue; out[3 + y + Math.round(amp * Math.pow(d / 15, 1.4))][x] = row[x]; } });
      return out.map((a) => a.join(""));
    };
    CONDOR = { glide: make(0, 15), up: make(-3, 15), down: make(3, 15), tuck: make(2, 10) };
  }

  // ---- 会动的部分 ----
  function drawSea(r, a4) {                   // 谷里的云海：后层慢、前层快，一起往右流
    for (const L of SEA) {
      const shift = Math.floor(a4 * L.sp), [c0, c1, c2] = L.cols;
      for (let x = 86; x < 254; x++) {
        const top = L.y - L.prof[mod(x - shift, L.n)];
        for (let y = top; y < H; y++) {
          const k = y - top;
          r.set(x, y, k === 0 ? c0 : k < 3 ? (bay(x, y) < 8 ? c0 : c1) : k < 9 ? c1 : bay(x, y) < 6 ? c1 : c2);
        }
      }
    }
  }
  function drawFarCondors(r, a4) {            // 远处盘旋的两只秃鹰（很小、很淡）
    for (const [cx, cy, rx, ry, ph] of [[70, 50, 14, 4, 0], [236, 44, 10, 3, 20]]) {
      const th = ((a4 + ph) * Math.PI) / 20, x = Math.round(cx + rx * Math.cos(th)), y = Math.round(cy + ry * Math.sin(th));
      r.set(x - 2, y - 1, "x"); r.set(x - 1, y, "x"); r.set(x, y, "y"); r.set(x + 1, y, "x"); r.set(x + 2, y - 1, "x");
    }
  }
  function drawCondor(r, tick) {              // 怪物：秃鹰在峡谷上空绕圈，转到下半圈收翅往桥上的箱子扑
    const th = (tick * Math.PI * 2) / 120, x = Math.round(170 + 52 * Math.cos(th)), y = Math.round(42 + 20 * Math.sin(th));
    const dir = Math.sin(th) > 0 ? -1 : 1, vy = Math.cos(th);
    const f = vy > 0.55 ? "tuck" : vy < -0.2 ? ["up", "glide", "down", "glide"][(tick >> 1) & 3] : "glide";
    rows(r, CONDOR[f], x - 15, y - 8);
    const hy = y - 1;
    r.set(x - 1, hy, "t"); r.set(x, hy, "t"); r.set(x + 1, hy, "t");
    r.set(x, hy + 1, "z"); r.set(x + dir, hy + 1, "D"); r.set(x + 2 * dir, hy + 1, "c");
  }
  const deckY = (x, S) => { const u = (x - 170) / 54; return GL + Math.round(S * (1 - u * u) + 3 * Math.max(0, 1 - Math.abs(x - BOX_X) / 34)); };
  const railY = (x, S) => { const u = (x - 170) / 54; return 89 + Math.round((S - 2) * (1 - u * u) + 1.5 * Math.max(0, 1 - Math.abs(x - BOX_X) / 34)); };
  function drawBridge(r, a4) {                // 草绳桥：两道扶手绳、竖的编绳、编出来的桥面；箱子压着的地方更低
    const S = 12 + tri(a4, 12, 1);
    for (let x = 116; x < 225; x++) {
      const yd = deckY(x, S), yh = railY(x, S);
      if (mod(x - 116, 4) === 0) for (let y = yh + 1; y < yd; y++) r.set(x, y, (y & 1) ? "F" : "e");
      r.set(x, yh, mod(x, 4) === 1 ? "k" : "d");
      r.set(x, yd, mod(x, 3) === 0 ? "k" : "d"); r.set(x, yd + 1, "F"); r.set(x, yd + 2, "e");
    }
    sprite(r, "obj.crate_wood", BOX_X, deckY(BOX_X, S));
  }
  function drawPlants(r, a4) {                // 风一阵阵从左往右吹过梯田：草叶和庄稼的尖一起歪过去
    for (const p of PLANTS) {
      const lean = mod(a4 - (p.x >> 3), 10) < 3 ? 1 : 0;
      r.set(p.x, p.top - 1, "n"); r.set(p.x + lean, p.top - 2, p.fl ? "B" : "m");
      if (lean && !(p.x % 2)) r.set(p.x + 1, p.top - 3, "m");
    }
  }
  const ALP_A = ["..c.c", "..cEc", ".cccc", "czccE", "Ecccc", ".EcE", "..ccE", "..ccE", "..cccccccccE", ".cccccccccccE", ".cccccccccccEc", ".EccccccccEEE", "..EEEEEEEEEE", "..E.E....E.E", "..E.E....E.E", "..F.F....F.F"];
  const ALP = {
    A: pad(ALP_A),
    B: pad(ALP_A.map((s, i) => (i === 4 ? "Eccc" : i === 5 ? "EcE" : s))),
    C: pad(ALP_A.map((s, i) => (i === 0 ? ".c...c" : s))),
  };
  const ASEQ = "AABBAABBAABBAABBAAAAAACCAAAAAAAA";
  function drawAlpaca(r, tick) { const a = ALP[ASEQ[tick & 31]]; rows(r, a, 50, GL - a.length, true); }

  scenes.andes = {
    draw(ctx, tick) {
      if (!back) build();
      const t = tick | 0, a4 = t >> 1;
      buf.data.set(back.data);
      drawSea(buf, a4);
      drawFarCondors(buf, a4);
      drawCondor(buf, t);
      buf.blit(front, 0, 0);
      drawBridge(buf, a4);
      drawPlants(buf, a4);
      drawAlpaca(buf, t);
      ctx.putImageData(img, 0, 0);
    },
  };
})();
