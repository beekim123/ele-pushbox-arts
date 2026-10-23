/* One composition for inventory and standalone previews. Interactive options
 * use local parameter copies; repository assets and frozen painters stay intact. */
(function(root){
 'use strict';
 const PB=root.PB,store=root.PBStore;
  // Chapter pictures are rendered at tick 0 by the approved composition.
  // Cache only those static backdrops; the wall and UI keep their live clock.
  const chapterPictures = new Map(), chapterLayers = new Map();
  const setFlat = PB.uiStyle.setFlat;
  PB.uiStyle.setFlat = function (...args) { chapterPictures.clear(); chapterLayers.clear(); return setFlat.apply(this, args); };
  function drawChapterScreen(r, asset, tick, state) {
    const backdrop = PB.uiStyle.backdrop;
    PB.uiStyle.backdrop = function (target, theme, pictureTick, env, props) {
      if (pictureTick !== 0 || props !== true) return backdrop.apply(this, arguments);
      const key = theme + "|" + env + "|" + target.data.length;
      const saved = chapterPictures.get(key);
      if (saved) { target.data.set(saved.pixels); return saved.theme; }
      const result = backdrop.apply(this, arguments);
      chapterPictures.set(key, { pixels: target.data.slice(), theme: result });
      return result;
    };
    const wall = PB.uiStyle.wall, dim = PB.uk.dim;
    const key = JSON.stringify([asset.params, state.focus, state.env, state.showIssues, PB.i18n.getLocale()]);
    try {
      if (!chapterLayers.has(key)) {
        const pixels = new PB.Raster(r.w, r.h), shades = [];
        PB.uiStyle.wall = () => {};
        PB.uk.dim = function(c, amount, box) {
          if (c.r === pixels) shades.push({ amount, box: box && box.slice() });
          return dim.apply(this, arguments);
        };
        try { PB.ui.render(pixels, asset, tick, state); }
        finally { PB.uiStyle.wall = wall; PB.uk.dim = dim; }
        chapterLayers.set(key, { pixels, shades });
      }
      const layer = chapterLayers.get(key), canvas = new PB.uk.C(r);
      wall(canvas, "theme.dungeon", tick, state.env);
      // Preserve the approved cards' dimming of the background at their edges.
      for (const shade of layer.shades) dim(canvas, shade.amount, shade.box);
      r.blit(layer.pixels, 0, 0);
    } finally { PB.uiStyle.backdrop = backdrop; }
  }


 function draw(r,screen,asset,tick,options={}){
  const hintTier=options.hintTier===undefined?3:options.hintTier;
  const focus=options.focus===undefined?(screen.id==='hint'?hintTier-1:0):options.focus;
  if(screen.id==='play'){
   if(options.model){
    const level=store.level('M05'),replay=PB.tilemodel.replay(level,[]),last=replay.steps[replay.steps.length-1];
    PB.scene.renderLevel(r,level,{level:replay.level,state:last.state},{tick,hud:false,pose:'idle',grid:false,observe:false});
   }else PB.scene.renderLevel(r,PB.scene.SHOWCASE,null,{tick,hud:false});
  }
  let preview=screen.id==='hint'?{...asset,params:{...asset.params,level:hintTier}}:asset;
  if(options.model&&screen.id==='play')preview={...preview,params:{...preview.params,level:'M05'}};
  if(options.interactive)preview={...preview,params:{...preview.params,focus}};
  const state={focus,specs:Object.fromEntries(store.levels().map(l=>[l.id,l])),levelSpec:store.level('M05'),ruleSpec:store.level('M03'),animate:true};
  if(options.interactive&&screen.id==='chapters')drawChapterScreen(r,preview,tick,state);else PB.ui.render(r,preview,tick,state);
 }
 root.PBScreenRenderer={draw,drawChapter:drawChapterScreen,clearChapters:()=>{chapterPictures.clear();chapterLayers.clear();}};
})(window);
