/* Palette, hashing and an RGBA raster shared by the workbench and tools/art.mjs.
 * Everything here is integer-only so browser and Node produce identical pixels. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});

  // ENDESGA 32 by Endesga (free to use). Single-character codes; "." = transparent.
  const PALETTE = {
    a: "#be4a2f", b: "#d77643", c: "#ead4aa", d: "#e4a672", e: "#b86f50", f: "#733e39", g: "#3e2731", h: "#a22633",
    i: "#e43b44", j: "#f77622", k: "#feae34", l: "#fee761", m: "#63c74d", n: "#3e8948", o: "#265c42", p: "#193c3e",
    q: "#124e89", r: "#0099db", s: "#2ce8f5", t: "#ffffff", u: "#c0cbdc", v: "#8b9bb4", w: "#5a6988", x: "#3a4466",
    y: "#262b44", z: "#181425", A: "#ff0044", B: "#68386c", C: "#b55088", D: "#f6757a", E: "#e8b796", F: "#c28569",
  };
  const RGB = {};
  for (const k in PALETTE) {
    const v = parseInt(PALETTE[k].slice(1), 16);
    RGB[k] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const CODES = Object.keys(PALETTE);

  function h32(x, y, s) {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s | 0, 2147483647)) >>> 0;
    n = Math.imul((n ^ (n >>> 13)) >>> 0, 1274126177) >>> 0;
    return (n ^ (n >>> 16)) >>> 0;
  }

  class Raster {
    constructor(w, h) { this.w = w; this.h = h; this.data = new Uint8ClampedArray(w * h * 4); }
    set(x, y, code) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h || code === "." || code == null) return;
      const c = RGB[code]; if (!c) throw new Error("bad colour code " + code);
      const i = (y * this.w + x) * 4; this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255;
    }
    rect(x, y, w, h, code) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, code); }
    hline(x, y, w, code) { this.rect(x, y, w, 1, code); }
    vline(x, y, h, code) { this.rect(x, y, 1, h, code); }
    // Darken already-drawn pixels towards a palette colour (integer 50% blend is NOT used:
    // shading is done by re-painting with palette colours only).
    blitRows(rows, x, y, flip) {
      const h = rows.length;
      for (let r = 0; r < h; r++) {
        const row = rows[r], w = row.length;
        for (let c = 0; c < w; c++) {
          const code = row[flip ? w - 1 - c : c];
          if (code !== ".") this.set(x + c, y + r, code);
        }
      }
    }
    blit(src, x, y) {
      for (let yy = 0; yy < src.h; yy++) for (let xx = 0; xx < src.w; xx++) {
        const si = (yy * src.w + xx) * 4; if (!src.data[si + 3]) continue;
        const tx = x + xx, ty = y + yy; if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        const di = (ty * this.w + tx) * 4;
        this.data[di] = src.data[si]; this.data[di + 1] = src.data[si + 1]; this.data[di + 2] = src.data[si + 2]; this.data[di + 3] = 255;
      }
    }
    // Shade every opaque pixel in a rect with a fixed palette mapping (used for dimming).
    remap(x, y, w, h, map) {
      for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) {
        const i = (yy * this.w + xx) * 4; if (!this.data[i + 3]) continue;
        const code = codeOf(this.data[i], this.data[i + 1], this.data[i + 2]);
        if (code && map[code]) this.set(xx, yy, map[code]);
      }
    }
    get(x, y) { const i = (y * this.w + x) * 4; return this.data[i + 3] ? codeOf(this.data[i], this.data[i + 1], this.data[i + 2]) : "."; }
  }
  const REVERSE = new Map();
  for (const k of CODES) REVERSE.set(RGB[k].join(","), k);
  function codeOf(r, g, b) { return REVERSE.get(r + "," + g + "," + b) || null; }

  // Night/dim ramp used for background layers and the observe overlay.
  const DIM = { a: "f", b: "e", c: "v", d: "F", e: "f", f: "g", g: "z", h: "g", i: "h", j: "a", k: "b", l: "k", m: "n", n: "o", o: "p", p: "z",
    q: "y", r: "q", s: "r", t: "u", u: "v", v: "w", w: "x", x: "y", y: "z", z: "z", A: "h", B: "g", C: "B", D: "C", E: "F", F: "e" };

  // One step brighter along the palette's own ramps (lighting).
  const LIGHT = { z: "y", y: "x", x: "w", w: "v", v: "u", u: "t", t: "t", g: "f", f: "e", e: "F", F: "d", d: "c", c: "t", a: "b", b: "d",
    h: "i", i: "D", D: "E", E: "c", j: "k", k: "l", l: "t", p: "o", o: "n", n: "m", m: "l", q: "r", r: "s", s: "t", B: "C", C: "D", A: "D" };

  PB.LIGHT = LIGHT;
  PB.PALETTE = PALETTE; PB.RGB = RGB; PB.CODES = CODES; PB.h32 = h32; PB.Raster = Raster; PB.DIM = DIM; PB.codeOf = codeOf;
})(typeof window !== "undefined" ? window : globalThis);
