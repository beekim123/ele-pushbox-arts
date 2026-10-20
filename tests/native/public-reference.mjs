// Independent public drawing oracle. read() must read the chosen committed tree,
// never the mutable working directory. No game/SDK/scene/model code is loaded.
import { createHash } from 'node:crypto';
import { createContext, runInContext } from 'node:vm';

const THEMES = ['dungeon', 'ruins', 'cave', 'forest', 'sky', 'cosmos', 'diyu'];
const TICKS = [0, 127];
const JS = ['raster', 'sprites', 'terrain', 'terrain-diyu'].map(x => `workbench/js/core/${x}.js`);
// These IDs are declared by public terrain.js, independently of simulation IDs.
const PUBLIC_MATERIALS = ['EMPTY', 'ROCK', 'CRACKED', 'EARTH', 'SAND', 'WATER'];
const VISUAL_CLASSES = ['EMPTY', 'ROCK', 'CRACKED_ROCK', 'SOIL', 'SAND', 'WATER',
  'RUBBLE', 'FUSE', 'ACID', 'LIMESTONE', 'LIMESTONE_ALT', 'HARD_ROCK', 'SMOKE',
  'MIST', 'PLUG', 'DECAYING_PLUG', 'WOOD', 'ICE', 'BRIDGE'];
const GRID = ['00000000', '01234500', '01133550', '02144550', '11111111'];
const POINTS = [[0,0,0], [1,1,1], [-1,-1,-1], [-17,31,53], [2147483647,-2147483648,2147483647],
  [-2147483648,2147483647,-2147483648], [65536,-65536,401]];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/**
 * @param {(relativePath:string)=>Buffer} read committed producer file reader
 * @param {object} index actual portitor.art.runtime-index/1 catalog
 * @returns {object} deterministic JSON data; palette rows use '.' for transparent
 */
export function publicReference(read, index) {
  if (!index || index.format !== 'portitor.art.runtime-index/1' || !Array.isArray(index.assets))
    throw new Error('public reference requires the actual runtime index');
  const sources = new Map();
  const bytesAt = path => {
    if (typeof path !== 'string' || path.startsWith('/') || path.includes('\\') || path.split('/').some(x => !x || x === '.' || x === '..'))
      throw new Error('invalid public reference path');
    if (!sources.has(path)) {
      const bytes = read(path);
      if (!Buffer.isBuffer(bytes)) throw new Error(`reader must return Buffer: ${path}`);
      sources.set(path, Buffer.from(bytes));
    }
    return sources.get(path);
  };
  const context = createContext(Object.create(null), {codeGeneration:{strings:false, wasm:false}});
  for (const path of JS) runInContext(bytesAt(path).toString('utf8'), context, {filename:path, timeout:10000});
  const PB = context.PB;
  for (let i=0; i<PUBLIC_MATERIALS.length; i++)
    if (PB.terrain.MAT[PUBLIC_MATERIALS[i]] !== i) throw new Error('public material IDs changed');
  const selected = [...index.assets].sort((a,b) => a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);
  const histories = new Map();
  // Register actual approved history data rather than reconstructing animations
  // from frame counts or from the native catalog's duplicated parameters.
  for (const asset of selected.filter(a => a.kind === 'sprite' || THEMES.some(t => a.id === `theme.${t}`))) {
    if (!asset.approved || asset.origin?.history_path !== `art/history/${asset.id}@v${asset.version}.json`)
      throw new Error(`missing selected approval/history: ${asset.uid}`);
    const bytes = bytesAt(asset.origin.history_path);
    if (sha256(bytes) !== asset.origin.history_sha256) throw new Error(`history SHA mismatch: ${asset.uid}`);
    const history = JSON.parse(bytes.toString('utf8'));
    if (history.id !== asset.id || history.version !== asset.version || history.content_hash !== asset.hash)
      throw new Error(`history identity mismatch: ${asset.uid}`);
    histories.set(asset.id, history);
    PB.sprites.register(history);
  }
  const frames = [];
  for (const asset of selected.filter(a => a.kind === 'sprite')) {
    const history = histories.get(asset.id);
    for (const animation of Object.keys(history.animations || {}).sort()) for (const tick of [0,1,59,60,127]) {
      const frame = PB.sprites.frameAt(PB.sprites.get(asset.id), animation, tick);
      if (!Number.isInteger(frame) || frame < 0 || frame >= history.frames.length) throw new Error(`invalid animation frame: ${asset.uid}`);
      frames.push({uid:asset.uid, animation, tick, frame});
    }
  }
  const rowsOf = raster => Array.from({length:raster.h}, (_,y) => {
    let row='';
    for(let x=0;x<raster.w;x++) row += raster.get(x,y);
    return row;
  });
  const cases=[];
  const map = {w:8,h:5,at:(x,y) => x<0 || y<0 || x>=8 || y>=5 ? 1 : Number(GRID[y][x])};
  for (const theme of THEMES) {
    const history = histories.get(`theme.${theme}`);
    if (!history?.params) throw new Error(`selected theme missing: ${theme}`);
    for (const tick of TICKS) {
      const background = new PB.Raster(320,180);
      PB.terrain.drawBackground(background, history.params, 0,0,320,180,tick);
      cases.push({id:`background.${theme}.${tick}`,kind:'background',theme_uid:`art:theme.${theme}`,tick,
        width:320,height:180,origin:[0,0],rows:rowsOf(background)});
      const terrain = new PB.Raster(128,80);
      PB.terrain.drawTerrain(terrain,map,history.params,0,0,tick);
      cases.push({id:`terrain.${theme}.${tick}`,kind:'terrain',theme_uid:`art:theme.${theme}`,tick,
        width:128,height:80,origin:[0,0],tile_size:16,grid:GRID.slice(),outside_material:1,
        public_materials:PUBLIC_MATERIALS.slice(),visual_classes:VISUAL_CLASSES.slice(),
        // Native classes 6..18 have no equivalent in this pure public renderer.
        visual_to_public_material:[0,1,2,3,4,5,...Array(13).fill(null)],variant:0,rows:rowsOf(terrain)});
    }
  }
  return {format:'portitor.art.public-reference/1',
    source_hashes:[...sources].sort(([a],[b]) => a<b?-1:a>b?1:0).map(([path,bytes]) => ({path,sha256:sha256(bytes)})),
    hashes:POINTS.map(([x,y,seed]) => ({x,y,seed,value:PB.h32(x,y,seed)})),frames,cases};
}
