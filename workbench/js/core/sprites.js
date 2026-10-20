/* Asset registry, sprite drawing and bitmap text (shared with tools/art.mjs). */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const registry = new Map();

  function register(asset) { registry.set(asset.id, asset); }
  function get(id) {
    const a = registry.get(id);
    if (!a) throw new Error("unknown asset " + id);
    return a;
  }
  function has(id) { return registry.has(id); }

  // Frame index for an animation at a given time (in 1/60 s ticks).
  function frameAt(asset, anim, tick) {
    const A = asset.animations && asset.animations[anim];
    if (!A) return typeof anim === "number" ? anim : 0;
    if (!A.fps || A.frames.length === 1) return A.frames[0];
    const step = Math.floor((tick * A.fps) / 60);
    return A.loop ? A.frames[step % A.frames.length] : A.frames[Math.min(step, A.frames.length - 1)];
  }

  // Draws a frame so that its anchor lands on (x, y).
  function draw(r, id, anim, tick, x, y, flip) {
    const a = get(id);
    const f = typeof anim === "number" ? anim : frameAt(a, anim, tick || 0);
    const ax = flip ? a.size[0] - a.anchor[0] : a.anchor[0];
    r.blitRows(a.frames[f], x - ax, y - a.anchor[1], !!flip);
  }

  // Nine-patch: margins [top, right, bottom, left].
  function ninepatch(r, id, frame, x, y, w, h) {
    const a = get(id), rows = a.frames[frame], [t, rt, b, l] = a.ninepatch, sw = a.size[0], sh = a.size[1];
    const mapX = (dx) => dx < l ? dx : dx >= w - rt ? sw - (w - dx) : l + ((dx - l) % (sw - l - rt));
    const mapY = (dy) => dy < t ? dy : dy >= h - b ? sh - (h - dy) : t + ((dy - t) % (sh - t - b));
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const code = rows[mapY(dy)][mapX(dx)];
      if (code !== ".") r.set(x + dx, y + dy, code);
    }
  }

  // ---------- text (Fusion Pixel 12px baked glyphs) ----------
  function glyph(ch) {
    const g = PB.FONT && PB.FONT.glyphs[ch];
    return g || (PB.FONT && PB.FONT.glyphs["?"]) || [6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }
  function measure(str) { let w = 0; for (const ch of str) w += glyph(ch)[0]; return w; }
  // y is the top of the 14-px line box.
  function text(r, str, x, y, color, shadow) {
    let cx = x;
    for (const ch of str) {
      const g = glyph(ch), adv = g[0];
      for (let row = 0; row < 14; row++) {
        const bits = g[row + 1];
        if (!bits) continue;
        for (let col = 0; col < adv; col++) if (bits & (1 << col)) {
          if (shadow) r.set(cx + col, y + row + 1, shadow);
          r.set(cx + col, y + row, color);
        }
      }
      cx += adv;
    }
    return cx - x;
  }
  function textCentered(r, str, cx, y, color, shadow) { return text(r, str, cx - (measure(str) >> 1), y, color, shadow); }

  PB.sprites = { register, get, has, frameAt, draw, ninepatch, registry };
  PB.text = { draw: text, centered: textCentered, measure };
})(typeof window !== "undefined" ? window : globalThis);
