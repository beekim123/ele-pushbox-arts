/* Environment effects: lighting and weather. Purely visual (never touches the
 * simulation or the rules) and governed by docs/design/art-direction.md §9:
 * - lighting only brightens / darkens background, terrain and plants (it runs
 *   before entities are drawn), so crates, the miner and mechanisms stay as is;
 * - at most one weather per room, sparse and low-contrast, never on the HUD;
 * - players can set effects to full / lite (lighting only) / off.
 * All motion is integer and tick-based so any renderer can reproduce it. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const h32 = PB.h32, tri = (t, p, a) => PB.ambient.tri(t, p, a);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const HUD = 20;

  function lighten(r, x, y) {
    if (x < 0 || y < HUD || x >= r.w || y >= r.h) return;
    const c = r.get(x, y); if (c !== ".") r.set(x, y, PB.LIGHT[c] || c);
  }
  function darken(r, x, y) {
    if (x < 0 || y < HUD || x >= r.w || y >= r.h) return;
    const c = r.get(x, y); if (c !== ".") r.set(x, y, PB.DIM[c] || c);
  }
  function dot(r, x, y, c) { if (x >= 0 && y >= HUD && x < r.w && y < r.h) r.set(x, y, c); }

  // Soft pool of light: one palette step brighter, dithered towards the rim.
  function pool(r, cx, cy, rad) {
    const inner = Math.floor(rad * rad * 36 / 100), outer = rad * rad;
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 > outer) continue;
      if (d2 <= inner || BAYER[(y & 3) * 4 + (x & 3)] * (outer - inner) >= (d2 - inner) * 16) lighten(r, x, y);
    }
  }

  // Light lands on the background only (drawn before terrain and entities), so
  // terrain textures and every interactive object keep their exact colours.
  function lighting(r, E, ctx) {
    const { tick, area, lights } = ctx;
    if (E.lights) for (const l of lights || []) {
      const src = E.lights.sources[l.id];
      if (!src) continue;
      const flicker = src.flicker === false ? 0 : tri(tick + l.x * 7, 18, 1);
      pool(r, l.x, l.y + (src.dy || 0), src.radius + flicker);
    }
    if (E.beams) {
      const b = E.beams, [num, den] = b.slope;
      for (let y = Math.max(HUD, area.y); y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) {
        const proj = x - Math.floor(((y - area.y) * num) / den);
        for (let k = 0; k < b.count; k++) {
          const cx = area.x + Math.floor((area.w * (k + 1)) / (b.count + 1)) + tri(tick + k * 300, 1200, 3);
          if (Math.abs(proj - cx) < (b.width >> 1) && ((x + y) & 1) === 0) { lighten(r, x, y); break; }
        }
      }
    }
    if (E.mist) {
      const y0 = area.y + area.h - 22;
      for (let y = Math.max(HUD, y0); y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) {
        const dens = Math.floor(((y - y0) * 16) / 22);
        if (BAYER[(y & 3) * 4 + ((x + (tick >> 4)) & 3)] < dens >> 1) lighten(r, x, y);
      }
    }
  }
  function vignette(r, E) {
    if (E.vignette) {
      const k = E.vignette;
      for (let y = HUD; y < r.h; y++) for (let x = 0; x < r.w; x++) {
        const d = Math.min(x, y - HUD, r.w - 1 - x, r.h - 1 - y);
        if (d < k && BAYER[(y & 3) * 4 + (x & 3)] >= (d * 16) / k) darken(r, x, y);
      }
    }
  }

  function back(r, E, ctx, weather) {
    const { tick, area } = ctx;
    if (E.sun) {
      const s = E.sun;
      pool(r, s.x, s.y, s.radius);
      for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 36) dot(r, s.x + x, s.y + y, x * x + y * y > 25 ? "u" : "t");
    }
    if (weather === "meteors") {
      const p = tick % 300;
      if (p < 24) {
        const x0 = 40 + (h32(Math.floor(tick / 300), 0, 951) % 220), y0 = HUD + 6 + (h32(Math.floor(tick / 300), 1, 951) % 40);
        for (let k = 0; k < 8; k++) dot(r, x0 + p * 3 - k, y0 + p - (k >> 1), k < 2 ? "t" : k < 5 ? "u" : "v");
      }
    }
    if (weather === "sandstorm") {
      for (let i = 0; i < 40; i++) {
        const y = HUD + (h32(i, 2, 953) % (r.h - HUD)), x = ((h32(i, 1, 953) % (r.w + 40)) + tick * 4) % (r.w + 40) - 20;
        for (let k = 0; k < 8; k += 2) dot(r, x + k, y, i & 1 ? "F" : "d");
      }
    }
    if (weather === "fireflies") {
      for (let i = 0; i < 7; i++) {
        if (((tick >> 3) + i * 5) % 9 < 3) continue;
        const x = area.x + (h32(i, 1, 955) % Math.max(1, area.w)) + tri(tick + i * 61, 400, 12);
        const y = area.y + (h32(i, 2, 955) % Math.max(1, area.h)) + tri(tick + i * 37, 300, 8);
        dot(r, x, y, "l"); dot(r, x + 1, y, "m"); dot(r, x - 1, y, "m");
      }
    }
  }

  function front(r, E, ctx, weather) {
    const { tick, area } = ctx;
    const W = r.w, Hh = r.h - HUD;
    if (weather === "rain") {
      for (let i = 0; i < 48; i++) {
        const y = HUD + ((h32(i, 2, 961) % Hh) + tick * 3) % (Hh + 12) - 12, x = ((h32(i, 1, 961) % W) + Math.floor(y / 3)) % W;
        for (let k = 0; k < 3; k++) dot(r, x - k, y - k * 2, k === 0 ? "u" : "v");
      }
    } else if (weather === "snow") {
      for (let i = 0; i < 36; i++) {
        const y = HUD + ((h32(i, 2, 963) % Hh) + (tick >> 1)) % Hh, x = (h32(i, 1, 963) % W) + tri(tick + i * 37, 200, 6);
        dot(r, x, y, "t"); if (i % 4 === 0) dot(r, x + 1, y, "u");
      }
    } else if (weather === "embers") {
      for (let i = 0; i < 10; i++) {
        if (((tick >> 2) + i * 3) % 7 === 0) continue;
        const y = area.y + area.h - (((tick >> 1) + h32(i, 2, 965)) % Math.max(1, area.h)), x = area.x + (h32(i, 1, 965) % Math.max(1, area.w)) + tri(tick + i * 29, 120, 3);
        dot(r, x, y, i & 1 ? "j" : "k");
      }
    } else if (weather === "drips") {
      for (let i = 0; i < 3; i++) {
        const p = (tick + i * 70) % 210, x = area.x + 8 + (h32(i, 1, 967) % Math.max(1, area.w - 16));
        if (p < 40) dot(r, x, area.y + 2 + Math.floor((p * p) / 30), "r");
        else if (p < 46) { dot(r, x - 1, area.y + 55, "s"); dot(r, x + 1, area.y + 55, "s"); }
      }
    } else if (weather === "wind") {
      for (let i = 0; i < 7; i++) {
        const y = HUD + 6 + (h32(i, 2, 969) % (Hh - 12)), len = 8 + (h32(i, 3, 969) % 8), x = ((h32(i, 1, 969) % (W + 60)) + tick * 5) % (W + 60) - 30;
        for (let k = 0; k < len; k += 2) dot(r, x + k, y + (k > len >> 1 ? 1 : 0), "u");
      }
    } else if (weather === "sandstorm") {
      for (let i = 0; i < 30; i++) {
        const y = HUD + (h32(i, 2, 971) % Hh), x = ((h32(i, 1, 971) % (W + 20)) + tick * 6) % (W + 20) - 10;
        dot(r, x, y, "c");
      }
    }
    if (E.motes && E.beams) {
      for (let i = 0; i < 14; i++) {
        const x = area.x + (h32(i, 1, 973) % Math.max(1, area.w)) + tri(tick + i * 53, 600, 6), y = area.y + ((h32(i, 2, 973) % Math.max(1, area.h)) + (tick >> 4)) % Math.max(1, area.h);
        if (((tick >> 3) + i) % 5) dot(r, x, y, "c");
      }
    }
  }

  // phase: "back" | "light" | "front". ctx: { tick, area, lights, weather, level: "full"|"lite"|"off" }
  function draw(r, theme, phase, ctx) {
    const E = theme.env, level = ctx.level || "full";
    if (!E || level === "off") return;
    const weather = level === "full" ? (ctx.weather === undefined || ctx.weather === null ? E.weather || "none" : ctx.weather) : "none";
    if (phase === "back") { lighting(r, E, ctx); back(r, E, ctx, weather); }
    else if (phase === "light") vignette(r, E);
    else if (phase === "front") front(r, E, ctx, weather);
  }
  const NAMES = { none: "无", rain: "雨", snow: "雪", embers: "余烬", drips: "滴水", sandstorm: "沙尘", fireflies: "萤火虫", wind: "风", meteors: "流星" };
  PB.env = { draw, NAMES };
})(typeof window !== "undefined" ? window : globalThis);
