#!/usr/bin/env node
// Art pipeline: build | approve | import | verify. Node 18+, no dependencies.
// See docs/design/art-pipeline.md. Pass --root <dir> to run against a copy
// (tests must never touch the real art/approvals.json).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT as REPO, loadCore } from "./lib/load-core.mjs";
import { encodePng, decodePng } from "./lib/png.mjs";
import { loadConcepts } from "./lib/concepts.mjs";
const contentTools = fs.existsSync(path.join(REPO, "tools/content.mjs")) ? await import("./content.mjs") : null;
const buildContent = contentTools?.buildContent || ((root, opts = {}) => {
  const issues = [], concepts = loadConcepts(root, (level, where, msg) => issues.push({ level, where, msg }));
  if (opts.write) {
    fs.mkdirSync(path.join(root, "workbench/data"), { recursive: true });
    fs.writeFileSync(path.join(root, "workbench/data/content.js"), "/* Public art concepts. Generated. */\nwindow.PB_CONTENT = " + JSON.stringify({ concepts }) + ";\n");
  }
  return { concepts, issues, summary: { errors: issues.filter(x => x.level === "error").length } };
});
const printIssues = contentTools?.printIssues || (res => { for (const i of res.issues) console.error(`${i.level}: ${i.where}: ${i.msg}`); });
import { loadTextTables, missingGlyphs } from "./lib/i18n.mjs";

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name, def) => { const i = argv.indexOf("--" + name); return i >= 0 ? argv[i + 1] : def; };
const ROOT = path.resolve(opt("root", REPO));
const rel = (...p) => path.join(ROOT, ...p);
const LOCKED = fs.existsSync(rel("art-pack.lock.json"));
if (LOCKED && ["approve", "import"].includes(cmd)) {
  console.error("美术编辑与确认请在 https://github.com/beekim123/ele-pushbox-arts 做；游戏资源已锁定。"); process.exit(2);
}
const PACK = LOCKED ? JSON.parse(fs.readFileSync(rel("art-pack.json"), "utf8")) : null;
// font-delivery / font-rooms2 / font-extra / font-ui add glyphs only; ui-delivery and ui-style register screens next to ui.js
// (neither changes what ui.js draws); ui-style (2026-10-16 interface style) replaces the older screen entries.
const PB = loadCore(["raster", "font-data", "font-small", "font-delivery", "font-extra", "font-ui", "font-rooms2", "sprites", "i18n", "tilemodel", "terrain", "terrain-diyu", "terrain-jeju", "ambient", "env", "matter", "scene", "dialogue", "ui", "ui-delivery", "ui-kit", "ui-skins", "ui-style", "ui-common", "ui-screens-level", "rooms", "mapgen", "rooms2", "mapgen2", "delivery-scene", "delivery-scene2", "ui-screens-result", "font-delivery2", "ui-screens-delivery", "font-onboarding", "onboarding-fx"], { authoringModel: false });
loadCore(["terrain-candy"], { authoringModel: false });   // ART-02a: theme.candy terrain (wraps PB.terrain)
loadCore(["font-ui11", "ui-screens-settings2"], { authoringModel: false });   // UI-11a: lobby skin row on the settings page
loadCore(["ui-onboarding"], { authoringModel: false });   // UX-05: seven onboarding screens (PB.ui.SCREENS.onb_*)
loadCore(["terrain-polar"], { authoringModel: false });   // ART-01a: theme.polar terrain (wraps PB.terrain)
const LOCALES = ["zh-Hans", "en"];
// content/i18n (frozen) plus the content/i18n-<name> tables (tools/lib/i18n.mjs).
function loadI18n() {
  const { tables, problems } = loadTextTables(REPO);
  for (const q of problems) console.error(`i18n: ${q.where}: ${q.msg}`);
  PB.i18n.setTables(tables); PB.i18n.setLocale("zh-Hans");
  return tables;
}
const I18N = loadI18n();

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function writeJson(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 1) + "\n"); }
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".json") ? [path.join(dir, e.name)] : []));
}

// ---------- loading and hashing ----------
const CONTENT_KEYS = ["kind", "size", "anchor", "palette", "frames", "animations", "ninepatch", "params", "renderer", "depends"];
function loadSources() {
  const list = walk(rel("art/source")).map((file) => ({ file, src: readJson(file) }));
  const byId = new Map();
  for (const it of list) {
    if (byId.has(it.src.id)) throw new Error("duplicate asset id " + it.src.id);
    byId.set(it.src.id, it);
  }
  return byId;
}
function validate(a) {
  const errs = [];
  if (a.format !== "pushbox.art/1") errs.push("format");
  if (!/^[a-z]+(\.[a-z0-9_]+)+$/.test(a.id)) errs.push("id pattern");
  if (!["draft", "review"].includes(a.stage)) errs.push("stage must be draft|review");
  if (a.kind === "sprite") {
    const [w, h] = a.size;
    a.frames.forEach((f, i) => {
      if (f.length !== h) errs.push(`frame ${i} has ${f.length} rows`);
      f.forEach((row, y) => { if (row.length !== w) errs.push(`frame ${i} row ${y} width ${row.length}`); for (const c of row) if (c !== "." && !PB.RGB[c]) errs.push(`frame ${i} bad code ${c}`); });
    });
    for (const [n, A] of Object.entries(a.animations || {})) for (const f of A.frames) if (f < 0 || f >= a.frames.length) errs.push(`anim ${n} frame ${f}`);
  } else if (a.kind === "procedural") {
    for (const r of a.renderer || []) if (!fs.existsSync(path.join(REPO, r))) errs.push("missing renderer " + r);
  } else errs.push("kind");
  return errs;
}
function contentHash(a, byId, seen = new Set()) {
  const body = {};
  for (const k of CONTENT_KEYS) if (a[k] !== undefined) body[k] = a[k];
  if (a.kind === "procedural") {
    // Procedural looks depend on renderer code and on the assets they draw.
    body.renderer_sha = (a.renderer || []).map((r) => sha(fs.readFileSync(path.join(REPO, r))));
    body.core_sha = ["raster", "sprites", "font-data"].map((n) => sha(fs.readFileSync(path.join(REPO, "workbench/js/core", n + ".js"))));
    if (seen.has(a.id)) throw new Error("dependency cycle at " + a.id);
    seen.add(a.id);
    body.depends_hash = (a.depends || []).map((d) => { const it = byId.get(d); if (!it) throw new Error(a.id + " depends on unknown " + d); return d + ":" + contentHash(it.src, byId, new Set(seen)); });
  }
  return sha(canon(body));
}

function loadApprovals() {
  const p = rel("art/approvals.json");
  return fs.existsSync(p) ? readJson(p) : { format: "pushbox.approvals/1", note: "Append-only. Written only by `node tools/art.mjs approve`.", records: [] };
}
function approvalFor(approvals, id, version, hash) {
  for (const rec of approvals.records) for (const it of rec.items) if (it.asset === id && it.version === version && it.hash === hash) return { record: rec, item: it };
  return null;
}

// ---------- rendering ----------
function sheetRaster(a) {
  const [w, h] = a.size, n = a.frames.length;
  const r = new PB.Raster(w * n, h);
  a.frames.forEach((f, i) => r.blitRows(f, i * w, 0, false));
  return r;
}
function registerAll(byId) { for (const { src } of byId.values()) PB.sprites.register(src); }
function levelSpecs() {
  return walk(rel("content/levels")).map(readJson).filter((s) => s.format === "pushbox.levelspec/1");
}
function renderProcedural(a, specs) {
  const r = new PB.Raster(320, 180);
  if (a.category === "theme") {
    PB.scene.renderLevel(r, PB.scene.SHOWCASE, null, { theme: a.id, tick: 0, hud: false });
  } else if (a.category === "screen") {
    PB.ui.render(r, a, 0, screenState(a, specs, "zh-Hans"));
  } else if (a.category === "material") {
    PB.matter.swatches(r);
  } else if (a.category === "ui" && a.params && a.params.screen) {
    // Procedural UI pieces (e.g. onboarding hints) render their sample sheet registered in PB.ui.SCREENS.
    PB.ui.render(r, a, 0, screenState(a, specs, "zh-Hans"));
  }
  return r;
}
function screenState(a, specs, locale) {
  return { focus: a.params.screen === "hint" ? 2 : a.params.screen === "levels" ? 4 : a.params.screen === "chapters" ? 1 : 0, specs: Object.fromEntries(specs.map((s) => [s.id, s])), levelSpec: specs.find((s) => s.id === "M05"), ruleSpec: specs.find((s) => s.id === "M03"), locale };
}
// Overflow check: every screen in every shipped locale must lay out without cut text.
function textIssues(byId, specs) {
  const out = [];
  for (const { src } of byId.values()) if (src.category === "screen") for (const loc of LOCALES.concat(["qps"])) {
    const issues = PB.ui.render(new PB.Raster(320, 180), src, 0, screenState(src, specs, loc));
    for (const it of issues) out.push({ screen: src.id, locale: loc, kind: it.kind, key: it.key });
  }
  return out;
}
function renderAsset(a, specs) { return a.kind === "sprite" ? sheetRaster(a) : renderProcedural(a, specs); }
function pngOf(r) { return encodePng(r.w, r.h, r.data); }

// ---------- commands ----------
function build() {
  const byId = loadSources();
  const approvals = loadApprovals();
  let bumped = 0, errors = 0, snapshotChanged = 0;
  for (const it of byId.values()) {
    const errs = validate(it.src);
    if (errs.length) { errors++; console.error("INVALID", it.src.id, errs.slice(0, 5).join("; ")); }
  }
  if (errors) process.exit(1);
  // Versioning: any content change since the stored hash creates a new version.
  for (const it of byId.values()) {
    const h = contentHash(it.src, byId);
    if (LOCKED) { if (it.src.content_hash !== h) snapshotChanged++; continue; }
    if (!it.src.content_hash) { it.src.content_hash = h; writeJson(it.file, it.src); }
    else if (it.src.content_hash !== h) {
      it.src.version += 1; it.src.content_hash = h; if (it.src.stage !== "draft") it.src.stage = "review";
      writeJson(it.file, it.src); bumped++;
      console.log(`bumped ${it.src.id} -> v${it.src.version} (content changed)`);
    }
  }
  registerAll(byId);
  const specs = levelSpecs();
  const manifest = { format: "pushbox.art-manifest/1", note: "Generated by tools/art.mjs build. Godot must load only entries whose `approved` is non-null for release builds; `preview` files are placeholders.", palette: PB.PALETTE, assets: [] };
  const bundleAssets = [], history = {};
  fs.mkdirSync(rel("art/export/preview"), { recursive: true });
  for (const { src } of [...byId.values()].sort((x, y) => x.src.id.localeCompare(y.src.id))) {
    const previewRel = `art/export/preview/${src.id}.png`;
    const png = LOCKED ? fs.readFileSync(rel(previewRel)) : pngOf(renderAsset(src, specs));
    if (!LOCKED) fs.writeFileSync(rel(previewRel), png);
    const ap = approvalFor(approvals, src.id, src.version, src.content_hash);
    const approvedVersions = [];
    for (const rec of approvals.records) for (const item of rec.items) if (item.asset === src.id) approvedVersions.push({ version: item.version, hash: item.hash, png: item.png, png_sha256: item.png_sha256, approval: rec.id, date: rec.date });
    const latestApproved = approvedVersions.sort((a, b) => b.version - a.version)[0] || null;
    for (const v of approvedVersions) {
      const hp = rel(`art/history/${src.id}@v${v.version}.json`);
      if (fs.existsSync(hp)) history[`${src.id}@v${v.version}`] = readJson(hp);
    }
    const status = ap ? "approved" : src.stage;
    const entry = {
      id: src.id, name: src.name, category: src.category, kind: src.kind, layer: src.layer,
      current: { version: src.version, hash: src.content_hash, status, preview: previewRel, preview_sha256: sha(png) },
      approved: latestApproved, current_is_approved: !!ap,
    };
    if (src.kind === "sprite") Object.assign(entry, { frame_size: src.size, frame_count: src.frames.length, sheet: "horizontal strip, frame i at x = i * frame_width", anchor: src.anchor, animations: src.animations, ninepatch: src.ninepatch || null });
    else Object.assign(entry, { renderer: src.renderer, params: src.params, depends: src.depends || [] });
    manifest.assets.push(entry);
    bundleAssets.push(Object.assign({}, src, { status, approved_versions: approvedVersions }));
  }
  if (LOCKED) manifest.assets = PACK.assets;
  if (snapshotChanged) console.log(`${snapshotChanged} 项与资源版本不同（不影响游戏；要更新代表画面请刷新快照）`);
  // Reference composites (illustrations built from current versions).
  fs.mkdirSync(rel("art/export/reference"), { recursive: true });
  const refs = [];
  const writeRef = (name, r, uses) => {
    const p = `art/export/reference/${name}.png`;
    const pinned = LOCKED && !name.startsWith("level.");
    const buf = pinned ? fs.readFileSync(rel(p)) : pngOf(r); if (!pinned) fs.writeFileSync(rel(p), buf);
    const unapproved = uses.filter((id) => { const e = manifest.assets.find((x) => x.id === id); return !e || !e.current_is_approved; });
    refs.push({ name, file: p, sha256: sha(buf), uses, all_approved: unapproved.length === 0, unapproved });
  };
  const common = ["ui.target", "char.portitor", "obj.crate_wood", "obj.crate_iron", "mech.ladder", "mech.socket", "mech.socket_lit", "mech.exit_flag", "mech.plate", "mech.door", "mech.link_symbol", "ui.icons", "ui.goal_lamp", "item.sandbag", "item.bomb"];
  const usesFor = (themeId) => [themeId, ...((byId.get(themeId) || { src: {} }).src.depends || []), ...common];
  for (const t of PB.scene.THEMES) {
    const r = new PB.Raster(320, 180); PB.scene.renderLevel(r, PB.scene.SHOWCASE, null, { tick: 0, theme: t }); writeRef("showcase." + t.slice(6), r, usesFor(t));
    const lobby = byId.get("ui.screen.lobby");
    if (lobby) { const l = new PB.Raster(320, 180); PB.ui.render(l, lobby.src, 0, { theme: t }); writeRef("lobby." + t.slice(6), l, ["ui.screen.lobby", ...usesFor(t)]); }
  }
  // Chapter 2-5 showcases (new materials, devices and effects in their chapter's theme).
  for (const [key, spec] of Object.entries(PB.matter.SHOWCASES)) {
    const t = PB.scene.CHAPTER_THEME[key], r = new PB.Raster(320, 180);
    PB.scene.renderLevel(r, spec, null, { tick: 0 });
    writeRef("chapter." + key, r, [...new Set([...usesFor(t), "material.chapter2_5", ...PB.matter.USES[key]])]);
  }
  for (const s of specs) { const r = new PB.Raster(320, 180); PB.scene.renderLevel(r, s, null, { tick: 0, env: "off" }); writeRef("level." + s.id, r, usesFor(PB.scene.themeFor(s))); }
  for (const { src } of byId.values()) if (src.category === "screen") for (const loc of LOCALES) {
    const r = new PB.Raster(320, 180); PB.ui.render(r, src, 0, screenState(src, specs, loc));
    writeRef(`${src.id.slice(10)}.${loc}`, r, [src.id, ...(src.depends || [])]);
  }
  PB.i18n.takeIssues();
  const text = textIssues(byId, specs);
  manifest.text_issues = text;
  const shipped = text.filter((x) => x.locale !== "qps");
  console.log(`text layout: ${shipped.length} issue(s) in shipped locales, ${text.length - shipped.length} in the pseudo-locale (informational)`);
  const glyphs = missingGlyphs(PB, I18N);
  if (glyphs.length) console.log(`glyphs: ${glyphs.length} string(s) use characters the fonts lack (run python3 tools/build-font.py --ext <table>)`);
  manifest.references = refs;
  writeJson(rel("art/export/manifest.json"), manifest);
  // Workbench bundle (classic script so file:// works).
  let modelCheck = null;
  if (fs.existsSync(rel("content/model-check.generated.json"))) modelCheck = readJson(rel("content/model-check.generated.json"));
  const reviewBatches = fs.existsSync(rel("art/review-batches.json")) ? readJson(rel("art/review-batches.json")) : [];
  const bundle = { reviewBatches, built: new Date().toISOString(), assets: bundleAssets, history, approvals: approvals.records, levels: specs, modelCheck, references: refs, i18n: I18N, textIssues: text };
  // Preserve the build date when the actual bundle data did not change.
  const oldBundle = rel("workbench/data/bundle.js");
  if (fs.existsSync(oldBundle)) {
    try {
      const previous = JSON.parse(fs.readFileSync(oldBundle, "utf8").split("window.PB_BUNDLE = ")[1].split(";\n")[0]);
      if (canon({ ...previous, built: null }) === canon({ ...bundle, built: null })) bundle.built = previous.built;
    } catch { /* A missing or obsolete bundle is regenerated. */ }
  }
  fs.mkdirSync(rel("workbench/data"), { recursive: true });
  fs.writeFileSync(rel("workbench/data/bundle.js"), "/* Generated by `node tools/art.mjs build`. Do not edit. */\nwindow.PB_BUNDLE = " + JSON.stringify(bundle) + ";\n");
  console.log(`build ok: ${byId.size} assets, ${bumped} bumped, ${refs.length} reference renders, ${approvals.records.length} approval records`);
  // Content catalogs, level plan and statuses for the workbench and Godot (tools/content.mjs).
  const content = buildContent(ROOT, { write: true });
  printIssues(content);
  if (content.summary.errors) process.exitCode = 1;
}

function approve() {
  let items = (opt("items", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const requested = new Map();
  if (opt("from-file")) {
    const req = readJson(path.resolve(opt("from-file")));
    if (req.format !== "pushbox.approval-request/1") throw new Error("not a workbench approval request");
    for (const it of req.approve) { items.push(`${it.asset}@v${it.version}`); requested.set(`${it.asset}@v${it.version}`, it.hash); }
  }
  const by = opt("by"), via = opt("via"), note = opt("note", ""), scope = opt("scope", "");
  if (!items.length || !by || !["chat", "workbench"].includes(via)) {
    console.error('usage: approve (--items id@vN[,id@vN] | --from-file request.json) --by <who> --via chat|workbench [--scope "..."] [--note "..."]');
    console.error("Only record approvals the user actually gave. Never approve on the user's behalf.");
    process.exit(2);
  }
  const byId = loadSources(); registerAll(byId);
  const approvals = loadApprovals();
  const specs = levelSpecs();
  const rec = { id: "APR-" + String(approvals.records.length + 1).padStart(4, "0"), date: new Date().toISOString(), by, via, scope, note, items: [] };
  for (const token of items) {
    const m = /^(.+)@v?(\d+)$/.exec(token);
    if (!m) throw new Error("bad item " + token);
    const it = byId.get(m[1]); if (!it) throw new Error("unknown asset " + m[1]);
    const version = Number(m[2]);
    const h = contentHash(it.src, byId);
    if (it.src.version !== version) throw new Error(`${m[1]} is at v${it.src.version}, not v${version}`);
    if (it.src.content_hash !== h) throw new Error(`${m[1]} changed since last build; run build first`);
    const want = requested.get(`${m[1]}@v${version}`);
    if (want && want !== h) throw new Error(`${m[1]}@v${version}: the request was made against different content (${want.slice(0, 12)} != ${h.slice(0, 12)})`);
    if (approvalFor(approvals, m[1], version, h)) { console.log("already approved", token); continue; }
    const png = pngOf(renderAsset(it.src, specs));
    const pngRel = `art/export/approved/${m[1]}@v${version}.png`;
    fs.mkdirSync(rel("art/export/approved"), { recursive: true });
    fs.writeFileSync(rel(pngRel), png);
    writeJson(rel(`art/history/${m[1]}@v${version}.json`), it.src);
    rec.items.push({ asset: m[1], version, hash: h, png: pngRel, png_sha256: sha(png) });
  }
  if (!rec.items.length) { console.log("nothing new to approve"); return; }
  approvals.records.push(rec);
  writeJson(rel("art/approvals.json"), approvals);
  console.log(`recorded ${rec.id}: ${rec.items.map((i) => i.asset + "@v" + i.version).join(", ")}`);
}

function importEdits() {
  const file = argv[1];
  if (!file) { console.error("usage: import <pushbox-art-edits.json>"); process.exit(2); }
  const edits = readJson(path.resolve(file));
  if (edits.format !== "pushbox.art-edits/1") throw new Error("not a workbench edits file");
  const byId = loadSources();
  for (const e of edits.edits) {
    const it = byId.get(e.id); if (!it) { console.error("skip unknown", e.id); continue; }
    if (it.src.version !== e.base_version) console.warn(`warning: ${e.id} edited from v${e.base_version}, repository has v${it.src.version}`);
    if (it.src.kind !== "sprite") { console.error("skip non-sprite", e.id); continue; }
    it.src.frames = e.frames; if (e.animations) it.src.animations = e.animations;
    it.src.stage = "review";
    if (e.note) it.src.notes = (it.src.notes ? it.src.notes + " " : "") + `[${e.saved_at}] ${e.note}`;
    writeJson(it.file, it.src);
    console.log("imported", e.id);
  }
  build();
}

function verify() {
  const byId = loadSources(); registerAll(byId);
  const approvals = loadApprovals(); const specs = levelSpecs();
  let bad = 0;
  const fail = (m) => { bad++; console.error("FAIL", m); };
  for (const it of byId.values()) {
    const a = it.src, errs = validate(a); if (errs.length) fail(`${a.id}: ${errs.join("; ")}`);
    if (!LOCKED && a.content_hash !== contentHash(a, byId)) fail(`${a.id}: content changed without build (version not bumped)`);
    const p = rel(`art/export/preview/${a.id}.png`);
    if (!fs.existsSync(p)) { fail(`${a.id}: preview missing`); continue; }
    if (LOCKED) continue;
    const dec = decodePng(fs.readFileSync(p)), want = renderAsset(a, specs);
    if (dec.w !== want.w || dec.h !== want.h || Buffer.compare(Buffer.from(dec.data), Buffer.from(want.data)) !== 0) fail(`${a.id}: preview PNG differs from source render`);
  }
  for (const rec of approvals.records) for (const item of rec.items) {
    const p = rel(item.png);
    if (!fs.existsSync(p)) { fail(`${rec.id} ${item.asset}@v${item.version}: approved PNG missing`); continue; }
    if (sha(fs.readFileSync(p)) !== item.png_sha256) fail(`${rec.id} ${item.asset}@v${item.version}: approved PNG hash mismatch`);
    const hp = rel(`art/history/${item.asset}@v${item.version}.json`);
    if (!fs.existsSync(hp)) fail(`${item.asset}@v${item.version}: history source missing`);
    else if (readJson(hp).content_hash !== item.hash) fail(`${item.asset}@v${item.version}: history hash mismatch`);
  }
  for (const x of textIssues(byId, specs)) if (x.locale !== "qps") fail(`text does not fit: ${x.screen} [${x.locale}] ${x.key} (${x.kind})`);
  for (const x of missingGlyphs(PB, I18N)) fail(`no glyph for "${x.chars}" in ${x.key} [${x.locale}] (python3 tools/build-font.py --ext <table>)`);
  for (const x of buildContent(ROOT).issues) if (x.level === "error") fail(`content: ${x.where}: ${x.msg}`);
  console.log(bad ? `verify: ${bad} problem(s)` : `verify ok: ${byId.size} assets, ${approvals.records.length} approval records`);
  process.exit(bad ? 1 : 0);
}

if (cmd === "build") build();
else if (cmd === "approve") approve();
else if (cmd === "import") importEdits();
else if (cmd === "verify") verify();
else { console.log("usage: node tools/art.mjs build|approve|import|verify [--root dir]"); process.exit(2); }

// UX-03: the workbench onboarding layer reads the onboarding data (content/onboarding/*.json,
// onboarding.md 附 3); file:// cannot fetch it, so build appends it to the bundle.
if (cmd === "build" || cmd === "import") {
  const dir = rel("content/onboarding"), onboarding = {};
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) Object.assign(onboarding, readJson(path.join(dir, f)).levels || {});
  fs.appendFileSync(rel("workbench/data/bundle.js"), "window.PB_BUNDLE.onboarding = " + JSON.stringify(onboarding) + ";\n");
}
