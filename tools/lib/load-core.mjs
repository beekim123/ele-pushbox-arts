// Loads the workbench's classic-script core modules into Node so that the
// tools and the browser run exactly the same code.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function loadCore(names, { authoringModel = true } = {}) {
  for (const name of names) {
    const file = path.join(ROOT, "workbench/js/core", name + ".js");
    vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
    if (name === "tilemodel" && authoringModel) {
      const runtime = path.join(ROOT, "workbench/js/core/tilemodel-runtime.js");
      vm.runInThisContext(fs.readFileSync(runtime, "utf8"), { filename: runtime });
    }
  }
  return globalThis.PB;
}

export function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

export function listJson(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJson(rel));
    else if (entry.name.endsWith(".json")) out.push(rel);
  }
  return out;
}

// Loads every mechanism plugin (workbench/js/core/mech/*.js) into the tile model.
// Call after loadCore(["tilemodel"]).
export function loadMechanisms() {
  const dir = path.join(ROOT, "workbench/js/core/mech");
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
  for (const f of names) vm.runInThisContext(fs.readFileSync(path.join(dir, f), "utf8"), { filename: path.join(dir, f) });
  return names.map((f) => f.replace(/\.js$/, ""));
}
