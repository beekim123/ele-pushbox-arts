/* Test-only concept scene (WB-05): loaded by tests/workbench.e2e.cjs, never by
 * index.html. Registers a moving coloured block for the map
 * window.PB_CONCEPT_TEST_ID (default "frontier"), in the same shape as a real
 * concept scene (workbench.md 6.2). */
(function (root) {
  "use strict";
  const id = root.PB_CONCEPT_TEST_ID || "frontier";
  window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
  PB_CONCEPT_SCENES[id] = {
    draw(ctx, tick) {
      ctx.fillStyle = "#1a1c2c"; ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = "#ef7d57"; ctx.fillRect((tick * 4) % 304, 82, 16, 16);
    },
  };
})(window);
