/* Dialogue bubbles (docs/design/dialogue.md): everything a character says —
 * hints, self-talk, NPC lines, recipients' thanks — is drawn in a speech bubble
 * attached to the speaker, in the 10px font (font-small.js). Menus and titles
 * keep the 12px font. Pure drawing + layout: no game state.
 *
 * bubble(r, {text, at: [x, y] (speaker's head, screen px), style: say|think|sign,
 *            maxW, reveal (characters shown, for the typewriter), name, id})
 * returns the laid-out box {x, y, w, h, lines, below}. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const S = () => PB.sprites, I = () => PB.i18n;
  const W = 320, H = 180, LINE = 12, PAD_X = 5, PAD_Y = 3, TAIL_H = 4, MARGIN = 3;
  const INK = { say: "g", think: "x", sign: "g" };

  function glyph(ch) {
    const F = PB.FONT_SMALL;
    return (F && (F.glyphs[ch] || F.glyphs["?"])) || [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }
  function measure(str) { let w = 0; for (const ch of str) w += glyph(ch)[0]; return w; }
  function text(r, str, x, y, color) {
    let cx = x;
    for (const ch of str) {
      const g = glyph(ch), adv = g[0];
      for (let row = 0; row < LINE; row++) {
        const bits = g[row + 1]; if (!bits) continue;
        for (let col = 0; col < adv; col++) if (bits & (1 << col)) r.set(cx + col, y + row, color);
      }
      cx += adv;
    }
    return cx - x;
  }
  function wrap(str, width) { return I() ? I().wrap(str, width, measure) : [str]; }

  // Box above the speaker if it fits, otherwise below; always inside the screen.
  function layout(o) {
    const maxW = Math.min(o.maxW || 150, W - 2 * MARGIN), maxLines = o.maxLines || 4;
    let lines = wrap(o.text || "", maxW - 2 * PAD_X);
    if (lines.length > maxLines) {
      if (I()) I().report("clip", o.id || o.text, { x: 0, y: 0, w: maxW, h: maxLines * LINE });
      lines = lines.slice(0, maxLines);
    }
    const inner = Math.max(16, ...lines.map(measure)), w = inner + 2 * PAD_X, h = lines.length * LINE + 2 * PAD_Y + 1;
    const [ax, ay] = o.at;
    let x = Math.round(ax - w / 2);
    x = Math.max(MARGIN, Math.min(W - MARGIN - w, x));
    const above = ay - TAIL_H - h - 2, below = ay + 20 + TAIL_H;
    const flip = o.place === "below" || above < (o.top || 22);
    const y = flip ? Math.min(H - MARGIN - h, below) : above;
    return { x, y, w, h, lines, below: flip, tailX: Math.max(x + 5, Math.min(x + w - 6, ax)) };
  }

  function bubble(r, o) {
    const style = o.style || "say", L = layout(o);
    S().ninepatch(r, "ui.bubble", S().get("ui.bubble").animations[style].frames[0], L.x, L.y, L.w, L.h);
    if (style !== "sign") {
      const tail = S().get("ui.bubble_tail"), f = tail.frames[tail.animations[style].frames[0]];
      // Drawn by hand so it can be flipped vertically when the bubble sits below the speaker.
      f.forEach((row, ty) => [...row].forEach((c, tx) => {
        if (c === ".") return;
        const px = L.tailX - tail.anchor[0] + tx, py = L.below ? L.y - ty : L.y + L.h - 1 + ty;
        r.set(px, py, c);
      }));
    }
    let left = o.reveal === undefined ? Infinity : o.reveal;
    L.lines.forEach((line, i) => {
      const shown = [...line].slice(0, Math.max(0, left)).join("");
      left -= [...line].length;
      text(r, shown, L.x + PAD_X, L.y + PAD_Y + i * LINE, INK[style]);
    });
    if (o.name) {
      // Speaker name tab on the top-left corner (12px font, menus style).
      const nw = PB.text.measure(o.name) + 8, nx = L.x + 4, ny = L.y - 12;
      S().ninepatch(r, "ui.panel", 2, nx, ny, nw, 14);
      PB.text.draw(r, o.name, nx + 4, ny, "c", "g");
    }
    return L;
  }

  function emote(r, kind, x, y, tick) { S().draw(r, "ui.emote", kind, tick || 0, x, y); }

  PB.dialogue = { bubble, layout, emote, measure, text, wrap, LINE };
})(typeof window !== "undefined" ? window : globalThis);
