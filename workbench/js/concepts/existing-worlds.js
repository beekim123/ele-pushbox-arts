/* Snow village and candy previews reuse the approved terrain and sprites.
 * The arrangement lives only in the concept gallery; it is not a room spec. */
(function (root) {
  "use strict";
  const PB = root.PB, W = 320, H = 180, OY = 20;
  const scenes = root.PB_CONCEPT_SCENES = root.PB_CONCEPT_SCENES || {};
  const pace = (tick, period, distance) => {
    const t = tick % period;
    return Math.floor((t < period / 2 ? t : period - t) * distance / (period / 2));
  };

  function landscape(world) {
    const M = PB.terrain.MAT;
    const cells = Array.from({ length: 10 }, () => Array(20).fill(M.EMPTY));
    const fill = (x, y, w, h, material = M.ROCK) => {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) cells[j][i] = material;
    };
    fill(0, 9, 20, 1);
    fill(0, 7, world === "polar" ? 8 : 9, 2);
    fill(world === "polar" ? 13 : 12, 6, world === "polar" ? 7 : 8, 3);
    if (world === "polar") fill(8, 8, 5, 1, M.WATER);
    else fill(7, 5, 4, 1);
    return { w: 20, h: 10, at: (x, y) => cells[y]?.[x] ?? M.EMPTY };
  }

  function create(world, decorate) {
    let raster = null, map = null;
    return {
      draw(ctx, tick) {
        if (!raster) { raster = new PB.Raster(W, H); map = landscape(world); }
        const theme = PB.sprites.get("theme." + world).params;
        const time = Math.floor(tick * 60 / 8);
        const env = { tick: time, area: { x: 0, y: 0, w: W, h: H }, lights: [], weather: "none", level: "full" };
        PB.terrain.drawBackground(raster, theme, 0, 0, W, H, time);
        PB.env.draw(raster, theme, "back", env);
        PB.terrain.drawTerrain(raster, map, theme, 0, OY, time >> 3);
        if (world === "polar") {
          const ice = { w: 20, h: 10, at: (x, y) => y === 8 && x >= 9 && x <= 11 ? PB.tilemodel.T.ICE : PB.tilemodel.T.EMPTY };
          PB.matter.drawMaterials(raster, ice, 0, OY, time >> 3);
        }
        PB.env.draw(raster, theme, "light", env);
        const sprite = (id, action, x, y, flip = false) => PB.sprites.draw(raster, id, action, time, x, y, flip);
        decorate(sprite, tick);
        PB.env.draw(raster, theme, "front", env);
        ctx.putImageData(new ImageData(raster.data, W, H), 0, 0);
      },
    };
  }

  scenes.polar = create("polar", (sprite, tick) => {
    sprite("deco.polar_spruce", "sway", 22, 132);
    sprite("deco.polar_cabin", "smoke", 68, 132);
    sprite("deco.polar_snowhouse", "default", 284, 116);
    sprite("deco.polar_spruce", "sway", 312, 116);
    sprite("deco.polar_lingonberry", "default", 141, 164);
    sprite("fauna.polar_reindeer", "wag", 112, 132);
    sprite("monster.penguin", "walk", 220 + pace(tick, 48, 28), 116, tick % 48 >= 24);
    sprite("fauna.polar_bunting", "fly", 142 + pace(tick, 80, 54), 64 + Math.floor(tick / 2) % 3, tick % 80 >= 40);
  });

  scenes.candy = create("candy", (sprite, tick) => {
    sprite("deco.candy_lollipop_tree", "sway", 40, 132);
    sprite("deco.candy_lollipop_tree", "sway", 144, 100);
    sprite("deco.candy_mint_bush", "sway", 18, 132);
    sprite("deco.candy_frosting_flower", "sway", 74, 132);
    sprite("deco.candy_frosting_flower", "sway", 308, 116);
    sprite("fauna.candy_lamb", "wag", 112, 132);
    sprite("mech.candy_jelly", "idle", 162, 164);
    sprite("mech.candy_oven_vent", "on", 232, 116);
    sprite("fx.candy_heat", "blow", 232, 100);
    sprite("monster.gingerbread", "run", 264 + pace(tick, 40, 28), 116, tick % 40 >= 20);
    sprite("fauna.candy_hummingbird", "fly", 194 + pace(tick, 64, 34), 62 + Math.floor(tick / 2) % 3, tick % 64 >= 32);
  });
})(typeof window !== "undefined" ? window : globalThis);
