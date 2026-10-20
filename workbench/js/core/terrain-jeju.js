/* Terrain and backdrop for the 济州海女村 region (theme.jeju, delivery mode only;
 * docs/design/delivery-jeju.md). The look is a bright day by the sea: black
 * porous basalt, dry-stone walls, reefs, a timber pier, orchard terraces.
 *
 * Terrain, rock.pattern "jeju": rock is drawn by zone, from the material, world
 * pixel hashes h32(x, y, seed), the neighbouring cells and the row's distance
 * from the bottom of the map (bands of 10 rows = one row of screens), never from
 * the room id, so the result can be cached and a shader can reproduce it
 * (art-direction.md §5; delivery-puzzle-rules.md §8.3):
 * - plain rock: dark blue-grey basalt with small pores, each with a lit lower lip;
 * - the leftmost and rightmost column: a dry-stone wall (돌담) of rounded stones;
 * - the bottom row: reef with barnacles and a little green weed;
 * - a one-cell-thick strip, open above and below, in the lower half of a screen:
 *   timber pier deck on posts (no frame, no braces: not a crate, not a bridge);
 * - open tops: volcanic soil and grass (tufts up to 2 px) in the upper half of a
 *   screen, glittering black sand in the lower half (far darker than rule sand).
 * Rule materials (earth, cracked rock, sand, water) come from terrain.js
 * unchanged, block outline included (§8).
 *
 * Backdrop, background.style "jeju": a clear day. Dithered blue sky, slowly
 * drifting white clouds with ragged undersides (never a ledge), the broad flat
 * top of Hallasan and a few small cones (오름) on the horizon, then a dark sea with
 * moving wave lines and glints but no bright surface line (that is rule water),
 * and dark shore rocks at the bottom. Any width: positions follow x - x0.
 * No gulls (the seagull is a monster) and no wind streaks (gusts are a device).
 *
 * Wraps PB.terrain.drawTerrain / drawBackground and only takes over for pattern
 * "jeju" / style "jeju", so terrain.js and terrain-diyu.js stay unchanged.
 * Background "time" is in 1/60 s ticks. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const T = PB.terrain;
  if (!T || T.jeju) return;   // loaded twice: keep the first wrapper
  const h32 = PB.h32, MAT = T.MAT, baseTerrain = T.drawTerrain, baseBackground = T.drawBackground;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  // Smooth value noise 0..255 on a cw x ch lattice (integer maths only).
  function vnoise(x, y, cw, ch, seed) {
    const gx = Math.floor(x / cw), gy = Math.floor(y / ch), fx = x - gx * cw, fy = y - gy * ch;
    const a = h32(gx, gy, seed) & 255, b = h32(gx + 1, gy, seed) & 255, c = h32(gx, gy + 1, seed) & 255, d = h32(gx + 1, gy + 1, seed) & 255;
    return Math.floor(((a * (cw - fx) + b * fx) * (ch - fy) + (c * (cw - fx) + d * fx) * fy) / (cw * ch));
  }
  // Integer triangle wave in [-amp, amp] (as in ambient.js).
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    return Math.round(((p < half ? p : period - p) * 4 * amp) / period - amp);
  }

  // ---------- terrain: rock.pattern "jeju" ----------

  function drawTerrain(r, map, theme, ox, oy, time) {
    const P = theme.rock;
    if (!P || P.pattern !== "jeju") return baseTerrain(r, map, theme, ox, oy, time);
    // Rule materials from terrain.js, drawn off-screen first so its stand-in for rock never shows.
    const tmp = new PB.Raster(map.w * 16, map.h * 16);
    baseTerrain(tmp, map, theme, 0, 0, time);
    const at = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? MAT.ROCK : map.at(x, y));   // beyond the map: more rock
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
      const m = map.at(tx, ty);
      if (m === MAT.ROCK) jejuTile(r, P, map, at, tx, ty, ox, oy);
      else if (m !== MAT.EMPTY) copyTile(r, tmp, tx, ty, ox, oy);
    }
  }
  function copyTile(r, src, tx, ty, ox, oy) {
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const i = ((ty * 16 + py) * src.w + tx * 16 + px) * 4, d = src.data;
      if (d[i + 3]) r.set(ox + tx * 16 + px, oy + ty * 16 + py, PB.codeOf(d[i], d[i + 1], d[i + 2]));
    }
  }

  // Basalt: two-tone mottling and pores. One 4 x 4 world cell in three holds a pore of
  // 1-2 x 1-2 px; the pixel under it is its lit lip. Returns 0 rock, 1 pore, 2 lip.
  function poreAt(wx, wy) {
    const gx = wx >> 2, gy = wy >> 2, hs = h32(gx, gy, 911);
    if (hs % 3) return 0;
    const pw = 1 + ((hs >>> 4) & 1), ph = 1 + ((hs >>> 5) % 3 === 0 ? 1 : 0);
    const px = gx * 4 + ((hs >>> 8) % (5 - pw)), py = gy * 4 + ((hs >>> 12) % (4 - ph));
    if (wx < px || wx >= px + pw) return 0;
    return wy >= py && wy < py + ph ? 1 : wy === py + ph ? 2 : 0;
  }
  function basalt(P, wx, wy) {
    const b = bayer(wx, wy) << 1;
    let c = vnoise(wx, wy, 14, 7, 913) + b > 170 ? P.base[1] : P.base[0];
    const p = poreAt(wx, wy);
    if (p === 1) c = P.pore;
    else if (p === 2) c = P.lip;
    else if (h32(wx, wy, 915) % 61 === 0) c = P.speck;
    return c;
  }
  // Dry-stone wall: rounded stones around jittered centres on a 7 x 6 lattice; where the two
  // nearest centres are about equally far, there is a dark seam.
  function wallAt(wx, wy) {
    const gx = Math.floor(wx / 7), gy = Math.floor(wy / 6);
    let d1 = 1e9, d2 = 1e9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const hx = gx + i, hy = gy + j, hs = h32(hx, hy, 941);
      const sx = hx * 7 + 1 + (hs % 5), sy = hy * 6 + 1 + ((hs >>> 8) % 4);
      const d = (wx - sx) * (wx - sx) * 2 + (wy - sy) * (wy - sy) * 3;
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    return Math.sqrt(d2) - Math.sqrt(d1) < 1.6;   // true = seam
  }

  function jejuTile(r, P, map, at, tx, ty, ox, oy) {
    const E = MAT.EMPTY, up = at(tx, ty - 1), down = at(tx, ty + 1), left = at(tx - 1, ty), right = at(tx + 1, ty);
    const oU = up === E, oD = down === E, oL = left === E, oR = right === E;
    const lower = (map.h - 1 - ty) % 10 < 5, bottom = ty === map.h - 1, side = tx === 0 || tx === map.w - 1;
    const x0 = tx * 16, y0 = ty * 16, put = (wx, wy, c) => { if (c) r.set(ox + wx, oy + wy, c); };
    if (!bottom && side) return wallTile(P, put, x0, y0, oU, oD, oL, oR);
    if (!bottom && lower && oU && oD) return deckTile(P, put, x0, y0, oL, oR);
    const covered = up === MAT.WATER || up === MAT.SAND;
    const G = P.grass, S = P.soil, K = P.blacksand, R = P.reef;
    for (let py = 0; py < 16; py++) {
      const wy = y0 + py;
      for (let px = 0; px < 16; px++) {
        // Rounded outer corners.
        if (oL && ((oU && px + py < 2) || (oD && px + 15 - py < 2))) continue;
        if (oR && ((oU && 15 - px + py < 2) || (oD && 30 - px - py < 2))) continue;
        const wx = x0 + px, hh = h32(wx, wy, 921);
        let c = basalt(P, wx, wy);
        if (bottom) {
          // Reef: darker wet rock, barnacles (a white dot over a grey one) and weed.
          c = c === P.base[0] ? R[0] : c === P.base[1] ? R[1] : c;
          if (hh % 37 === 0) c = R[2];
          else if (h32(wx, wy - 1, 921) % 37 === 0) c = R[3];
          if (vnoise(wx, wy, 9, 5, 923) > 196 && bayer(wx, wy) < 9) c = R[4];
        }
        if (oU) {
          if (bottom) { if (py < 2) c = hh % 3 ? R[4] : R[5]; }
          else if (lower) {
            // Glittering black sand, thin and patchy at its lower edge.
            if (py === 0) c = hh % 11 === 0 ? K[2] : hh % 3 === 0 ? K[1] : K[0];
            else if (py === 1) c = hh % 13 === 0 ? K[2] : hh % 2 ? K[0] : K[1];
            else if (py === 2 && bayer(wx, wy) < 10) c = K[1];
            else if (py === 3 && bayer(wx, wy) < 3) c = K[1];
          } else {
            // Orchard top: grass over dark volcanic soil.
            if (py === 0) c = hh % 4 === 0 ? G[0] : G[1];
            else if (py === 1) c = hh % 3 === 0 ? G[1] : G[2];
            else if (py === 2) c = hh % 5 === 0 ? G[2] : S[0];
            else if (py <= 4) c = hh % 6 === 0 ? S[1] : S[0];
            else if (py === 5 && bayer(wx, wy) < 8) c = S[0];
          }
        } else if (covered && py === 0) c = P.light;
        if (oD && (py === 15 || (py === 14 && hh % 3 === 0))) c = P.dark;
        if ((px === 0 && oL) || (px === 15 && oR)) c = P.edge;
        put(wx, wy, c);
      }
    }
    // Grass tufts poking up to 2 px into the empty cell above (upper half only).
    if (oU && !lower && !bottom) for (let px = oL ? 2 : 0; px < (oR ? 14 : 16); px++) {
      const wx = x0 + px, clump = vnoise(wx, ty, 5, 1, 925);
      if (clump < 110) continue;
      const hb = h32(wx, ty, 926), hgt = clump < 170 ? 1 : 1 + (hb & 1);
      if ((hb >>> 3) % 3 === 0) continue;
      for (let k = 1; k <= hgt; k++) put(wx, y0 - k, k === hgt ? G[0] : G[1]);
    }
  }

  function wallTile(P, put, x0, y0, oU, oD, oL, oR) {
    const Wc = P.wall;   // [stone, lit rim, shadow, seam]
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const wx = x0 + px, wy = y0 + py;
      const edge = (oL && px < 2) || (oR && px > 13) || (oU && py < 2) || (oD && py > 13);
      let c;
      if (wallAt(wx, wy)) c = edge ? null : Wc[3];   // open sides: the gaps between stones show through
      else if (wallAt(wx, wy - 1) || wallAt(wx - 1, wy)) c = Wc[1];
      else if (wallAt(wx, wy + 1) || wallAt(wx + 1, wy)) c = Wc[2];
      else c = h32(wx, wy, 943) % 9 === 0 ? Wc[2] : poreAt(wx, wy) === 1 ? P.pore : Wc[0];
      if (c && oU && py === 0 && !wallAt(wx, wy)) c = Wc[1];
      put(wx, wy, c);
    }
  }

  // Pier deck: boards on top (lit top edge, grain, butt joints, nail heads), a shadow line,
  // then posts down to the cell below. Nothing else, so it reads as neither a crate nor a bridge.
  function deckTile(P, put, x0, y0, oL, oR) {
    const D = P.deck;   // [top, board, grain/joint, nail, post]
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const wx = x0 + px, wy = y0 + py;
      if ((oL && px === 0 && (py === 0 || py === 6)) || (oR && px === 15 && (py === 0 || py === 6))) continue;
      const joint = ((wx + (h32(wx >> 5, 0, 951) % 9)) % 32) === 0;
      let c = null;
      if (py === 0) c = D[0];
      else if (py <= 5) {
        c = joint || (py === 3 && h32(wx >> 3, wy, 953) % 4 === 0) ? D[2] : D[1];
        if ((py === 2 || py === 4) && (((wx + (h32(wx >> 5, 0, 951) % 9)) % 32) === 2)) c = D[3];
      } else if (py === 6) c = D[2];
      else {
        const p = (wx + 9) % 32;
        if (p === 0 || p === 1) c = p === 0 ? D[4] : D[2];
      }
      put(wx, wy, c);
    }
  }

  // ---------- backdrop: background.style "jeju" ----------

  function drawBackground(r, theme, x0, y0, w, h, time) {
    const B = theme.background;
    if (!B || B.style !== "jeju") return baseBackground(r, theme, x0, y0, w, h, time);
    const x1 = x0 + w, y1 = y0 + h, t = time | 0;
    const C = {
      sky: B.base[0], sky2: B.base[1], cloud: B.cloud || ["t", "u"], far: B.far || B.accent, far2: B.far2 || B.far || B.accent,
      mid: B.mid || B.detail, sea: B.sea || ["q", "p", "r", "q"], glint: B.glint || B.speck, shore: B.shore || [B.detail, B.detail], foam: B.foam || B.speck,
    };
    const px = (x, y, c) => { if (x >= x0 && y >= y0 && x < x1 && y < y1) r.set(x, y, c); };
    const horizon = y0 + Math.round(h * 0.58), span = Math.max(1, horizon - y0);
    // Sky: deep blue at the top, dithered into the pale blue that reaches the horizon.
    for (let y = y0; y < horizon && y < y1; y++) {
      const level = Math.floor(((y - y0) * 32) / span);
      for (let x = x0; x < x1; x++) {
        const b = bayer(x, y);
        px(x, y, level < 14 ? C.sky : level < 30 ? (b < level - 14 ? C.sky2 : C.sky) : C.sky2);
      }
    }
    // Clouds drift left by one pixel every 128 ticks.
    const drift = t >> 7;
    for (let k = Math.floor(drift / 112) - 1; (k - 1) * 112 - drift < w + 60; k++) {
      const hs = h32(k, 0, 931);
      if (hs % 5 === 0) continue;
      const cx = x0 + k * 112 + (hs >>> 4) % 80 - drift, cy = y0 + 10 + ((hs >>> 12) % Math.max(1, Math.floor(span * 0.45)));
      cloud(px, C, cx, cy, 16 + ((hs >>> 20) % 22), hs);
    }
    // Horizon: Hallasan (one broad shield with a flat top per 480 px) and small cones in front.
    for (let x = x0; x < x1; x++) {
      const xw = x - x0, hm = halla(xw), ho = oreum(xw);
      for (let k = 1; k <= hm; k++) px(x, horizon - k, k > hm - 2 && bayer(x, horizon - k) < 10 ? C.far2 : C.far);
      for (let k = 1; k <= ho; k++) px(x, horizon - k, k === ho && bayer(x, horizon - k) < 6 ? C.far : C.mid);
    }
    // Sea: [far, near, far wave, near wave]. Blue at the horizon, dithered into a darker near sea within `fade` rows so
    // the rule water (q body, r band, s line) stays brighter than the backdrop; wave lines slide with time, sparse glints.
    const S = C.sea, fade = 16;
    for (let y = horizon; y < y1; y++) {
      const d = y - horizon, wave = waveRow(d);
      for (let x = x0; x < x1; x++) {
        const xw = x - x0, bb = bayer(x, y);
        let c = d < fade && bb >= Math.floor((d * 16) / fade) ? S[0] : S[1];
        if (d < 2 && bb < 6) c = S[2];
        if (wave && vnoise(xw + (wave & 1 ? 1 : -1) * (t >> 5) + d * 13, d, 10 + d, 1, 933) > 150) c = d < fade ? S[2] : S[3] || S[2];
        const hg = h32(xw, y, 935);
        if (hg % 151 === 0 && ((t >> 4) + (hg >>> 9)) % 5 < 2) c = C.glint;
        px(x, y, c);
      }
    }
    // Shore rocks along the bottom, with a little foam where the waves meet them.
    for (let x = x0; x < x1; x++) {
      const xw = x - x0, top = y1 - 5 - Math.floor((vnoise(xw, 0, 22, 1, 961) * 9) / 255) - (h32(xw >> 1, 0, 962) & 1);
      for (let y = top; y < y1; y++) px(x, y, y === top ? C.shore[1] : C.shore[0]);
      const hf = h32(xw >> 1, 0, 963);
      if ((hf % 4 === 0) && (((t >> 4) + (hf >>> 8)) % 7) < 4) px(x, top - 1, C.foam);
    }
  }
  // Rows of the sea that carry wave lines: d = 1, 3, 6, 10, 15, 21, ... (wider apart nearer the shore).
  function waveRow(d) {
    for (let k = 1, at = 1; at <= d; k++, at += k) if (at === d) return k;
    return 0;
  }
  function halla(xw) {
    const k = Math.floor(xw / 480);
    let best = 0;
    for (let i = k - 1; i <= k + 1; i++) {
      const hs = h32(i, 0, 971), cx = i * 480 + 150 + (hs % 180), hw = 130 + ((hs >>> 8) % 40), H = 20 + ((hs >>> 16) % 6);
      const dx = Math.abs(xw - cx);
      if (dx >= hw) continue;
      let v = H - Math.floor((H * dx * dx) / (hw * hw));
      if (v > H - 4) v = H - 4 + (dx < 9 ? 0 : 1) - (dx < 5 ? 1 : 0);   // flat top with the crater rim (백록담)
      if (v > best) best = v;
    }
    return best;
  }
  function oreum(xw) {
    const k = Math.floor(xw / 90);
    let best = 0;
    for (let i = k - 1; i <= k + 1; i++) {
      const hs = h32(i, 0, 975);
      if (hs % 3 === 0) continue;
      const cx = i * 90 + 20 + (hs >>> 4) % 50, hw = 10 + ((hs >>> 12) % 10), H = 4 + ((hs >>> 18) % 5);
      const dx = Math.abs(xw - cx);
      if (dx >= hw) continue;
      const v = H - Math.floor((H * dx * dx) / (hw * hw));
      if (v > best) best = v;
    }
    return best;
  }
  // A heap of 3-4 puffs; the underside is ragged, with one shade row.
  function cloud(px, C, cx, cy, wd, hs) {
    const n = 3 + ((hs >>> 26) & 1), puffs = [];
    for (let i = 0; i < n; i++) {
      const hp = h32(hs, i, 937), rr = Math.max(3, Math.floor(wd / 4) + (hp % 4) - (i === 0 || i === n - 1 ? 2 : 0));
      puffs.push([cx - (wd >> 1) + Math.floor(((i + 0.5) * wd) / n), cy - (i === 0 || i === n - 1 ? 0 : rr >> 1), rr]);
    }
    const inside = (x, y) => puffs.some(([px0, py0, rr]) => (x - px0) * (x - px0) + (y - py0) * (y - py0) * 2 <= rr * rr) && y <= cy + 2 + (h32(x >> 1, cy, 939) % 3) - 1;
    for (let y = cy - wd; y <= cy + 4; y++) for (let x = cx - wd; x <= cx + wd; x++) {
      if (!inside(x, y)) continue;
      px(x, y, !inside(x, y + 1) || !inside(x, y + 2) ? C.cloud[1] : C.cloud[0]);
    }
  }

  T.drawTerrain = drawTerrain;
  T.drawBackground = drawBackground;
  T.jeju = { vnoise, poreAt, wallAt, jejuTile, halla, oreum };
})(typeof window !== "undefined" ? window : globalThis);
