/* Concept scene · 水墨江南 (ink_town), ART-04c. Look only: not a game asset, no rules.
 * A canal ferry landing on a drizzly morning, painted almost only in ink greys; the red lanterns and
 * the courier are the only warm colours (content/concepts/maps.json `look`).
 * Landmarks: stone arch bridge (its reflection closes the circle), white-walled houses with stepped
 * gables, a string of red lanterns, a willow on the bank. The black-awning boat is drawn as the
 * moving platform (moving_platform), shuttling between the quays.
 * Ambient: fine drizzle with ripple rings on the canal, ink bleeding off the far hills into a drifting
 * mist, willow strands swaying. Fauna: an ink sprite (monster) and a cat on the boat's bow (hint).
 * 320×180 in ENDESGA 32 codes on a PB.Raster: integer pixels, no anti-aliasing.
 * draw(ctx, tick): tick +8 per second; ambient effects step at 4 fps (tick >> 1), creatures at 8 fps. */
(function () {
  "use strict";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};

  const W = 320, H = 180;
  const WL = 112;               // far waterline at the foot of the bridge
  const QY = 132;               // top of the stone quays
  const GAP0 = 112, GAP1 = 224; // open water between the quays
  const BOAT_WL = 154;          // the boat's waterline
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

  // Same integer triangle wave as PB.ambient.tri: -amp..amp over `period` steps.
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    const v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  // 0 -> len -> 0, resting `rest` steps at each end.
  function shuttle(t, len, rest) {
    const c = 2 * (len + rest), p = ((t % c) + c) % c;
    if (p < rest) return 0;
    if (p < rest + len) return p - rest;
    if (p < 2 * rest + len) return len;
    return len - (p - 2 * rest - len);
  }
  function line(r, x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      r.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function ring(r, cx, cy, rx, ry, c, sparse) {
    if (rx === 0) { r.set(cx, cy, c); return; }
    for (let a = 0; a < 48; a++) {
      const t = (a * Math.PI) / 24, x = cx + Math.round(Math.cos(t) * rx), y = cy + Math.round(Math.sin(t) * ry);
      if (!sparse || ((x + y) & 1)) r.set(x, y, c);
    }
  }
  // Smooth 1-D value noise, 0..15, on a 32 px lattice.
  function noise(h32, x, salt) {
    const i = x >> 5, f = x & 31, a = h32(i, salt, 5) & 15, b = h32(i + 1, salt, 5) & 15;
    return a + (((b - a) * ((f * f * (96 - 2 * f)) >> 10)) >> 5);
  }

  // A stroke over any ink grey stays within one step of it (low contrast).
  const RAIN = { t: "u", u: "v", v: "u", w: "v", x: "w", y: "x", z: "y", i: "D", h: "i" };
  const REFLECT = { t: "u", u: "v", v: "v", w: "w", x: "w", y: "w", z: "x" };
  const REFLECT_BOAT = { t: "u", u: "v", v: "v", w: "w", x: "x", y: "x", z: "x" };

  const HERO = [
    "......zzzz......",
    ".....zlkkkz.....",
    "....zlkkkkkz....",
    "...zkkkkkkkbz...",
    "..zkkkkkkkkkbz..",
    ".zzbbbbbbbbbbzz.",
    "...zzzzzzzzzz...",
    "....zEEEEEEz....",
    "....zEEEzEzz....",
    "....zFEEEEEz....",
    "...zhiiiiiihz...",
    "..zEhiiiiiihEz..",
    "..zzhiiiiiihzz..",
    "...zyyyyyyyyz...",
    "...zyyz..zyyz...",
    "...zzzz..zzzz...",
  ];
  // White cat sitting on the bow, facing the quay; two tail poses and a blink.
  const CAT = [
    [
      ".z..z.......",
      "zuzzuz......",
      "zttttz......",
      "ztztttz.....",
      "zttttttzz...",
      ".zttttttuz..",
      ".zttttttuz.z",
      ".ztztttuuzzu",
      ".ztztttuuzz.",
      ".zzzzzzzzz..",
    ],
    [
      ".z..z.......",
      "zuzzuz......",
      "zttttz......",
      "ztztttz.....",
      "zttttttzz...",
      ".zttttttuz..",
      ".zttttttuzz.",
      ".ztztttuuzuz",
      ".ztztttuuzz.",
      ".zzzzzzzzz..",
    ],
  ];

  function crate(r, x, y, c) { // c = [outline, light, mid, dark, deepest]
    const [o, l, m, d, k] = c;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      let p = m;
      if (i === 0 || j === 0 || i === 15 || j === 15) p = o;
      else if (j === 1 || i === 1) p = l;
      else if (j === 14 || i === 14) p = k;
      else if (j === 2 || i === 2 || j === 13 || i === 13) p = d;
      else if (i + j === 15) p = l;
      else if (i + j === 16) p = d;
      r.set(x + i, y + j, p);
    }
  }

  // ---- static layers, built once ----
  const FAR = [[20, 46, 36], [92, 56, 48], [176, 40, 44], [252, 52, 40], [316, 44, 34]];
  const NEAR = [[-10, 80, 28], [58, 90, 34], [134, 98, 40], [214, 92, 36], [286, 78, 30]];
  function ridge(h32, peaks, x, salt) {
    let y = 999;
    for (const [px, py, k] of peaks) { const d = x - px; y = Math.min(y, py + Math.floor((d * d) / k)); }
    return y + ((h32(x >> 2, salt, 41) & 3) === 0 ? 1 : 0); // brush grain
  }

  function build(PB) {
    const h32 = PB.h32, L = { far: [], near: [] };
    for (let x = 0; x < W; x++) { L.far.push(ridge(h32, FAR, x, 1)); L.near.push(ridge(h32, NEAR, x, 2)); }

    // sky (wet paper) and the canal's own texture
    const bg = (L.bg = new PB.Raster(W, H));
    bg.rect(0, 0, W, H, "u");
    for (let y = WL; y < H; y++) for (let x = 0; x < W; x++) {
      const hsh = h32(x >> 3, y, 9);
      if (y < WL + 3 && (hsh & 7) === 0) bg.set(x, y, "t");
      else if ((hsh & 63) < (y - WL) >> 2) bg.set(x, y, "v");
    }

    // far town: white walls barely there, roofs as single strokes
    const town = (L.town = new PB.Raster(W, H));
    for (let x = 92, k = 0; x < 248; k++) {
      const w = 9 + (h32(k, 3, 13) % 9), top = 101 + (h32(k, 4, 13) % 4);
      town.rect(x, top + 2, w - 1, WL - top - 2, "t");
      town.hline(x - 1, top, w + 1, "w");
      town.hline(x, top + 1, w - 1, "v");
      town.set(x - 2, top - 1, "w"); town.set(x + w, top - 1, "w");
      for (let i = x + 2; i < x + w - 2; i += 4) town.set(i, top + 5, "v");
      x += w + 1 + (h32(k, 5, 13) % 4);
    }

    // stone arch bridge drawn as ink line work on pale stone: humped deck in steps, voussoir ring,
    // low parapet with posts. It and the far town are what the canal reflects.
    const br = (L.bridge = new PB.Raster(W, H));
    const CX = 168, RI = 24, RO = 28, deck = (x) => 82 + 2 * Math.floor(((x - CX) * (x - CX)) / 576);
    for (let x = 102; x <= 234; x++) {
      const top = deck(x);
      for (let y = top; y < WL; y++) {
        const dx = x - CX, dy = y - WL, rr = dx * dx + dy * dy;
        if (rr < RI * RI) continue;
        let c = "u";
        if (rr < (RI + 1) * (RI + 1)) c = "x";
        else if (rr < RO * RO) {
          const deg = Math.round((Math.atan2(-dy, dx) * 180) / Math.PI);
          c = deg % 12 === 0 ? "w" : "v";
        } else if ((y - top) % 5 === 4 && (h32(x >> 2, y, 3) & 3) !== 0) c = "v"; // stone courses
        else if (dx > 8 && bayer(x, y) < 3) c = "v"; // shade on the right
        if (y === top) c = "w";
        if (x === 102 || x === 234) c = "w";
        br.set(x, y, c);
      }
      if (deck(x - 1) > top || deck(x + 1) > top) br.set(x, top + 1, "w"); // step risers
      br.set(x, top - 3, "w"); br.set(x, top - 2, "u"); br.set(x, top - 1, "u");
      if ((x - CX) % 12 === 0) { br.set(x, top - 5, "x"); br.set(x, top - 4, "w"); br.set(x, top - 3, "w"); br.set(x, top - 2, "w"); br.set(x, top - 1, "w"); }
    }
    const rs = (L.reflectSrc = new PB.Raster(W, H));
    rs.blit(town, 0, 0); rs.blit(br, 0, 0);

    // houses: white walls, tiled roofs, stepped gables (horse-head walls) towards the canal
    const hs = (L.houses = new PB.Raster(W, H));
    const roof = (x0, x1, ridgeY, eaveY) => {
      for (let x = x0; x < x1; x++) {
        hs.set(x, ridgeY, "z");
        for (let y = ridgeY + 1; y < eaveY; y++) hs.set(x, y, x % 3 === 0 ? "y" : y > eaveY - 4 ? "y" : "x");
        hs.set(x, eaveY, "z"); hs.set(x, eaveY + 1, x % 3 === 1 ? "x" : "z");
      }
    };
    const wall = (x0, x1, y0) => {
      for (let x = x0; x < x1; x++) for (let y = y0; y < QY; y++) {
        let c = "t";
        if (y < y0 + 2) c = "u"; // eave shadow
        else if (y > QY - 12 && bayer(x, y) < ((y - (QY - 12)) * (6 + (noise(h32, x * 3, 8) >> 1))) >> 3) c = "u"; // damp
        hs.set(x, y, c);
      }
    };
    const step = (x0, x1, top, tipRight) => {
      for (let x = x0; x < x1; x++) for (let y = top; y < QY; y++) hs.set(x, y, y === top ? "u" : "t");
      hs.hline(x0 - 1, top - 3, x1 - x0 + 2, "y");
      hs.hline(x0 - 2, top - 2, x1 - x0 + 4, "z");
      hs.hline(x0 - 1, top - 1, x1 - x0 + 2, "x");
      for (let x = x0; x < x1; x += 2) hs.set(x, top - 3, "x"); // ridge tiles
      const tx = tipRight ? x1 + 1 : x0 - 2, d = tipRight ? 1 : -1; // the "horse head" curls up
      hs.set(tx, top - 3, "z"); hs.set(tx + d, top - 3, "z"); hs.set(tx + d, top - 4, "z"); hs.set(tx + 2 * d, top - 5, "z");
      hs.vline(tipRight ? x1 - 1 : x0, top + 1, QY - top - 1, "u");
    };
    const win = (x0, y0, w, h) => {
      hs.rect(x0, y0, w, h, "y");
      for (let y = y0 + 1; y < y0 + h - 1; y++) for (let x = x0 + 1; x < x0 + w - 1; x++)
        hs.set(x, y, (x - x0) % 3 === 0 || (y - y0) % 3 === 0 ? "y" : "w");
      hs.hline(x0 - 1, y0 + h, w + 2, "v");
    };
    const door = (x0, y0, w) => {
      hs.rect(x0, y0, w, QY - y0, "y");
      for (let y = y0 + 1; y < QY; y++) for (let x = x0 + 1; x < x0 + w - 1; x++) hs.set(x, y, (x - x0) % 3 === 0 ? "y" : "x");
      hs.hline(x0 - 2, y0 - 1, w + 4, "x");
    };
    roof(0, 92, 68, 80); wall(0, 98, 82);
    step(86, 98, 76, true); step(76, 90, 70, true); step(64, 80, 64, true);
    win(28, 96, 14, 10); win(50, 96, 14, 10); door(8, 110, 13); win(28, 114, 12, 9);
    roof(246, W, 74, 86); wall(238, W, 88);
    step(238, 250, 82, false); step(246, 260, 76, false); step(256, 272, 70, false);
    win(270, 100, 14, 10); win(296, 100, 14, 10); door(256, 112, 12);

    // willow: leaning trunk under a low crown; the crown's fringe hangs in tongues that sway
    const wl = (L.willow = new PB.Raster(W, H));
    for (let y = 50; y < QY; y++) {
      const t = y - 50, cx = 296 + Math.round((8 * t) / 82), half = 1 + Math.floor((2 * t) / 82) + (y > 126 ? (y - 126) >> 1 : 0);
      for (let x = cx - half; x <= cx + half; x++) wl.set(x, y, x === cx - half ? "w" : x === cx + half ? "y" : (h32(x, y, 21) & 7) === 0 ? "y" : "x");
    }
    line(wl, 296, 52, 276, 40, "x"); line(wl, 297, 52, 312, 38, "x"); line(wl, 296, 56, 262, 50, "x");
    const leaf = (x, y, k) => { const hh = h32(x, y, 25) & 7; return hh === 0 ? null : (x + y + k) % 5 === 0 ? "v" : hh < 3 ? "x" : "w"; };
    const CRX = 44, CRY = 18, CCX = 290, CCY = 46;
    for (let y = CCY - CRY; y <= CCY + 4; y++) for (let x = CCX - CRX; x <= Math.min(W - 1, CCX + CRX); x++) {
      const dx = x - CCX, dy = Math.min(0, y - CCY), ry = CRY - (noise(h32, x * 4, 27) >> 2); // ragged crown
      if (dx * dx * ry * ry + dy * dy * CRX * CRX > CRX * CRX * ry * ry) continue;
      const c = leaf(x, y, 0); if (c) wl.set(x, y, y < CCY - CRY + 3 && c === "x" ? "w" : c);
    }
    L.tongues = [];
    for (let x = CCX - CRX + 1, k = 0; x < W; k++) {
      const hh = h32(x, k, 26), reach = Math.abs(x - CCX);
      L.tongues.push({ x, y: CCY + 3 - (hh & 3), len: Math.min(QY - 12 - CCY, 14 + (reach >> 1) + (x < CCX - 24 ? 12 : 0) + (hh % 14)), phase: (hh >> 4) % 36, k });
      x += 3 + ((hh >> 9) & 1);
    }

    // quays of dressed stone, with landing steps down to the water on the left
    const fg = (L.fg = new PB.Raster(W, H));
    const quay = (x0, x1) => {
      for (let x = x0; x < x1; x++) {
        const top = x >= 100 && x < GAP0 ? QY + 5 * (((x - 100) >> 2) + 1) : QY;
        for (let y = top; y < H; y++) {
          const row = (y - QY - 4) >> 3, by = (y - QY - 4) & 7, bx = (x + (row & 1) * 8) & 15;
          let c = y === top ? "u" : y < top + 4 ? "v" : by === 0 || bx === 0 ? "w" : by === 1 ? "u" : "v";
          if (y > 160) c = c === "w" ? "x" : "w";
          if (x === GAP0 - 1 && y > top) c = "x";
          if (x === GAP1 && y > top) c = "v";
          fg.set(x, y, c);
        }
      }
    };
    quay(0, GAP0); quay(GAP1, W);
    const grey = ["z", "u", "v", "w", "x"];
    crate(fg, 68, QY - 16, grey); crate(fg, 84, QY - 16, grey);
    fg.blitRows(HERO, 50, QY - 16);

    // black-awning boat (sprite 60×19, waterline at row 18)
    const bt = (L.boat = new PB.Raster(60, 19));
    for (let x = 0; x < 60; x++) {
      const top = x < 8 ? 12 - ((8 - x) >> 1) : x > 52 ? 12 - ((x - 52) / 3 | 0) : 12;
      const bot = x < 10 ? 18 - ((10 - x) >> 1) : x > 50 ? 18 - ((x - 50) / 3 | 0) : 18;
      for (let y = top; y < bot; y++) bt.set(x, y, y === top ? "w" : y === top + 1 ? "x" : y === 15 ? "x" : y === bot - 1 ? "z" : "y");
    }
    for (let x = 18; x <= 44; x++) {
      const top = 2 + Math.floor(((x - 31) * (x - 31)) / 40);
      for (let y = top; y < 12; y++) bt.set(x, y, y === top ? "x" : x === 18 || x === 44 || y === 11 ? "y" : (x - 18) % 4 === 0 ? "y" : "z");
    }
    line(bt, 46, 5, 59, 17, "x");
    L.catPos = 3; // cat's left edge inside the sprite; it sits on the bow deck (row 10)
    return L;
  }

  // ---- per-frame effects ----
  function hill(r, x, top, body, halo, e, phase) {
    // ink bleeds out of the ridge and back (0..4 px, a slow wave travelling along the range)
    const bleed = 2 + tri(e + phase + (x >> 2) * 3, 72, 2);
    for (let d = 1; d <= bleed; d++) if (bayer(x, top - d) < (bleed - d + 1) * 3) r.set(x, top - d, halo);
    // the wash under the ridge dissolves into the mist towards the water
    const fade = top + 12 + tri(e * 2 + phase + x * 3, 160, 4);
    for (let y = top; y < WL; y++) {
      const depth = y - fade;
      if (depth < 0 || bayer(x, y) < 16 - depth * 2) r.set(x, y, body);
    }
  }
  function mist(r, h32, e, y0, y1, peak, strength, salt) {
    const drift = e >> 1;
    for (let y = y0; y < y1; y++) {
      const band = strength - Math.abs(y - peak);
      if (band <= 0) continue;
      for (let x = 0; x < W; x++) if (bayer(x, y) < (noise(h32, x + drift + (y >> 2) * 7, salt) * band) >> 3) r.set(x, y, "t");
    }
  }
  function reflection(r, L, e) {
    for (let y = WL; y < WL + 46; y++) {
      const depth = y - WL, sy = WL - 1 - depth, off = tri(depth * 3 + e, 12, 1);
      for (let x = GAP0 - 12; x < GAP1 + 12; x++) {
        const src = L.reflectSrc.get(Math.min(W - 1, Math.max(0, x + off)), sy);
        let c = REFLECT[src];
        if (!c || (depth > 26 && bayer(x, y) < (depth - 26) * 2)) continue;
        // pale stone only shows as broken strokes; the ink lines carry the shape
        if (src === "u" && ((depth & 1) || ((x + off * 3 + (depth >> 1) * 5) & 7) < 3)) continue;
        r.set(x, y, c);
      }
    }
  }
  function ripples(r, h32, e) {
    for (let i = 0; i < 7; i++) {
      const c = e + i * 5, k = Math.floor(c / 9), p = c % 9;
      if (p > 4) continue;
      const x = GAP0 + 8 + (h32(i, k, 31) % (GAP1 - GAP0 - 16)), y = WL + 6 + (h32(k, i, 32) % (H - WL - 10));
      const s = y > 140 ? 2 : 1;
      ring(r, x, y, p * s, (p * s) >> 1, p < 3 ? "v" : "w", p > 2);
    }
  }
  function lanterns(r, e) {
    const sag = (x) => 86 + 3 - Math.floor((3 * (x - 44) * (x - 44)) / (42 * 42));
    for (let x = 2; x <= 86; x++) r.set(x, sag(x), "x");
    [12, 32, 52, 72].forEach((x0, k) => {
      const y0 = sag(x0) + 1, dx = tri(e + k * 5, 20, 1);
      r.set(x0, y0, "y"); r.set(x0 + (dx > 0 ? 1 : dx < 0 ? -1 : 0), y0 + 1, "y");
      r.blitRows(["..yyy..", ".hiiih.", "hiDiiih", "hiDiiih", "hiiiiih", ".hiiih.", "..yyy..", "...h...", "..h.h.."], x0 - 3 + dx, y0 + 2);
    });
  }
  function strands(r, L, e) {
    for (const t of L.tongues) {
      const A = tri(e + t.phase, 36, 2);
      for (let i = 0; i < t.len; i++) {
        const x = t.x + Math.floor((A * i * i) / (t.len * t.len)), y = t.y + i, thin = i > (t.len * 2) / 3;
        for (let j = 0; j < (thin ? 1 : 2); j++) {
          if ((x + j + y * 3 + t.k) % 4 === 0) continue; // broken leafy edge
          r.set(x + j, y, j === 0 ? ((y + t.k) % 3 === 0 ? "v" : "w") : "x");
        }
      }
    }
  }
  function boat(r, L, e, tick) {
    const bx = 114 + shuttle(e, 50, 10), bob = tri(e, 12, 1), by = BOAT_WL - 18 + bob;
    const b = L.boat;
    // dark reflection under the hull, shivering and fading
    for (let sy = 0; sy < 18; sy++) for (let sx = 0; sx < 60; sx++) {
      const c = b.get(sx, sy); if (c === ".") continue;
      const ry = BOAT_WL + (BOAT_WL - (by + sy)) - 1, depth = ry - BOAT_WL;
      if (depth < 0 || depth > 12 || bayer(sx, ry) < depth) continue;
      r.set(bx + sx + tri(depth * 2 + e, 8, 1), ry, REFLECT_BOAT[c]);
    }
    for (let sy = 0; sy < 18; sy++) for (let sx = 0; sx < 60; sx++) {
      const c = b.get(sx, sy); if (c !== "." && by + sy < BOAT_WL) r.set(bx + sx, by + sy, c);
    }
    // the cat: tail flick every 2 s, blink every 4 s
    const cat = CAT[(tick & 15) < 4 ? 1 : 0].slice();
    if ((tick & 31) === 9) cat[3] = "zttttttz....".slice(0, 12);
    r.blitRows(cat, bx + L.catPos, by + 1);
  }
  function inkSprite(r, tick) {
    const f = [0, 1, 2, 2, 1, 0, 3, 3][tick & 7], cx = 242 + tri(tick >> 1, 40, 3), base = QY - 1;
    const rx = [7, 8, 9, 8][f], ry = [13, 12, 10, 12][f], dome = ry - 5, lean = [0, 1, 0, -1][f];
    const sxAt = (j) => (j < ry - 4 ? Math.round((lean * (ry - 4 - j)) / 4) : 0);
    for (let j = 0; j < ry; j++) {
      const y = base - ry + 1 + j, sx = sxAt(j);
      let hw = rx;
      if (j < dome) { const q = dome - j; hw = Math.round(rx * Math.sqrt(1 - (q * q) / ((dome + 1) * (dome + 1)))); }
      if (j >= ry - 2) hw += j - (ry - 3); // the foot spreads like a puddle
      for (let x = -hw; x <= hw; x++) {
        let c = "z";
        if (x < -hw / 3 && x > -hw && j > 1 && j < dome + 2) c = "y"; // sheen on the lit side
        if (j === 2 && x === 1 - (hw >> 1) - 1) c = "x";
        r.set(cx + x + sx, y, c);
      }
    }
    // eyes looking towards the courier; a blink now and then
    const ej = 4, ey = base - ry + 1 + ej, ex = cx + sxAt(ej);
    if ((tick & 31) !== 5) {
      r.rect(ex - 5, ey, 3, 3, "t"); r.rect(ex + 1, ey, 3, 3, "t");
      r.rect(ex - 5, ey + 1, 1, 2, "z"); r.rect(ex + 1, ey + 1, 1, 2, "z");
    } else { r.hline(ex - 5, ey + 2, 3, "x"); r.hline(ex + 1, ey + 2, 3, "x"); }
    // ink drops flicking off the top and the sides
    const d = (tick >> 1) & 3;
    r.set(cx - rx - 3 - d, base - 1 - (d & 1), "z"); r.set(cx + rx + 2 + (d >> 1), base - 2 - d, "y");
    if (d < 2) r.set(cx + sxAt(0) + 2, base - ry - 1 - d, "z");
  }
  function rain(r, h32, e) {
    for (let i = 0; i < 44; i++) {
      const sx = h32(i, 1, 77) % (W + 40), f = (h32(i, 2, 77) + e * 9) % 200, y = f - 10, x = sx - (f >> 2);
      for (let k = 0; k < 3; k++) {
        if (x < 0 || x >= W || y + k < 0 || y + k >= H) continue;
        const c = RAIN[r.get(x, y + k)]; if (c) r.set(x, y + k, c);
      }
    }
  }

  let L = null, frame = null, img = null;
  window.PB_CONCEPT_SCENES.ink_town = {
    draw(ctx, tick) {
      const PB = window.PB, h32 = PB.h32, e = tick >> 1;
      if (!L) L = build(PB);
      if (!frame) frame = new PB.Raster(W, H);
      const r = frame;
      r.data.set(L.bg.data);
      for (let x = 0; x < W; x++) hill(r, x, L.far[x], "v", "v", e, 0);
      mist(r, h32, e, 60, 100, 82, 9, 3);
      for (let x = 0; x < W; x++) hill(r, x, L.near[x], "w", "v", e, 37);
      mist(r, h32, e + 40, 86, WL, 102, 10, 4);
      r.blit(L.town, 0, 0);
      r.blit(L.bridge, 0, 0);
      mist(r, h32, e + 90, 104, WL, 111, 6, 5);
      reflection(r, L, e);
      ripples(r, h32, e);
      r.blit(L.houses, 0, 0);
      lanterns(r, e);
      r.blit(L.willow, 0, 0);
      strands(r, L, e);
      r.blit(L.fg, 0, 0);
      boat(r, L, e, tick);
      inkSprite(r, tick);
      rain(r, h32, e);
      if (!img) img = ctx.createImageData(W, H);
      img.data.set(r.data);
      ctx.putImageData(img, 0, 0);
    },
  };
})();