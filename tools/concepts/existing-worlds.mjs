// Render the archived snow/candy concept previews with their existing art.
// Run from any directory: node tools/concepts/existing-worlds.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { ROOT, loadCore, listJson, readJson } from "../lib/load-core.mjs";
import { encodePng } from "../lib/png.mjs";

const PB = loadCore(["raster", "sprites", "tilemodel", "terrain", "terrain-candy", "terrain-polar", "env", "matter"], { authoringModel: false });
for (const file of listJson("art/source")) PB.sprites.register(readJson(file));
globalThis.ImageData ||= class ImageData {
  constructor(data, width, height) { Object.assign(this, { data, width, height }); }
};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, "workbench/js/concepts/existing-worlds.js"), "utf8"));

export function renderExistingWorld(id, tick = 0) {
  const scene = globalThis.PB_CONCEPT_SCENES[id];
  if (!scene) throw new Error("Unknown concept scene: " + id);
  let image;
  scene.draw({ putImageData(value) { image = { width: value.width, height: value.height, data: Buffer.from(value.data) }; } }, tick);
  return image;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const id of ["polar", "candy"]) {
    const image = renderExistingWorld(id, 8);
    const file = path.join(ROOT, "art/concepts", id, "preview.png");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encodePng(image.width, image.height, image.data));
    console.log(path.relative(ROOT, file));
  }
}
