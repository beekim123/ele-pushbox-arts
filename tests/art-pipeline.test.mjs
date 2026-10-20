// Art pipeline tests. Every test works on a temporary copy of art/ and content/;
// the repository's art/approvals.json must never change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const real = path.join(REPO, "art/approvals.json");
const realBefore = fs.existsSync(real) ? crypto.createHash("sha256").update(fs.readFileSync(real)).digest("hex") : null;

// A fresh copy of the sources with NO approvals, so the tests exercise the
// pipeline itself regardless of what the user has approved in the repository.
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pb-art-"));
  for (const d of ["art/source", "art/concepts", "content"]) if (fs.existsSync(path.join(REPO, d))) fs.cpSync(path.join(REPO, d), path.join(dir, d), { recursive: true });
  return dir;
}
const art = (root, ...args) => execFileSync(process.execPath, [path.join(REPO, "tools/art.mjs"), ...args, "--root", root], { encoding: "utf8" });
const json = (root, p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

test("build is reproducible and verify passes", () => {
  const root = sandbox();
  art(root, "build");
  const first = fs.readFileSync(path.join(root, "art/export/preview/char.miner.png"));
  const firstBundle = fs.readFileSync(path.join(root, "workbench/data/bundle.js"));
  art(root, "build");
  assert.deepEqual(fs.readFileSync(path.join(root, "art/export/preview/char.miner.png")), first);
  assert.ok(fs.readFileSync(path.join(root, "workbench/data/bundle.js")).equals(firstBundle), "unchanged data preserves bundle bytes");
  assert.match(art(root, "verify"), /verify ok/);
});

test("approve records exact version and hash, exports an immutable PNG", () => {
  const root = sandbox();
  art(root, "build");
  const src = json(root, "art/source/object/obj.crate_wood.json");
  art(root, "approve", "--items", `obj.crate_wood@v${src.version}`, "--by", "test", "--via", "chat");
  const rec = json(root, "art/approvals.json").records.at(-1);
  assert.equal(rec.items[0].asset, "obj.crate_wood");
  assert.equal(rec.items[0].hash, src.content_hash);
  assert.ok(fs.existsSync(path.join(root, rec.items[0].png)));
  assert.ok(fs.existsSync(path.join(root, `art/history/obj.crate_wood@v${src.version}.json`)));
  art(root, "build");
  const entry = json(root, "art/export/manifest.json").assets.find((a) => a.id === "obj.crate_wood");
  assert.equal(entry.current.status, "approved");
  assert.match(art(root, "verify"), /verify ok/);
});

test("approving a stale version is refused", () => {
  const root = sandbox();
  art(root, "build");
  const v = json(root, "art/source/object/obj.crate_iron.json").version;
  assert.throws(() => art(root, "approve", "--items", `obj.crate_iron@v${v + 5}`, "--by", "test", "--via", "chat"));
});

test("editing an approved asset creates a new version that needs approval again", () => {
  const root = sandbox();
  art(root, "build");
  const file = path.join(root, "art/source/object/obj.crate_wood.json");
  const v = JSON.parse(fs.readFileSync(file, "utf8")).version;
  art(root, "approve", "--items", `obj.crate_wood@v${v}`, "--by", "test", "--via", "chat");
  const edits = { format: "pushbox.art-edits/1", edits: [{ id: "obj.crate_wood", base_version: v, saved_at: "2026-10-15T00:00:00Z", frames: JSON.parse(fs.readFileSync(file, "utf8")).frames.map((f) => f.map((row, y) => (y === 5 ? "z" + row.slice(1) : row)).map((row, y) => (y === 6 ? row.slice(0, 7) + "t" + row.slice(8) : row))) }] };
  const ef = path.join(root, "edits.json"); fs.writeFileSync(ef, JSON.stringify(edits));
  art(root, "import", ef);
  const after = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(after.version, v + 1);
  const entry = json(root, "art/export/manifest.json").assets.find((a) => a.id === "obj.crate_wood");
  assert.equal(entry.current.status, "review");
  assert.equal(entry.approved.version, v, "previous approval still points at the old version");
  assert.ok(fs.existsSync(path.join(root, `art/export/approved/obj.crate_wood@v${v}.png`)));
});

test("workbench approval request file is checked against content hash", () => {
  const root = sandbox();
  art(root, "build");
  const src = json(root, "art/source/mechanism/mech.ladder.json");
  const req = path.join(root, "req.json");
  fs.writeFileSync(req, JSON.stringify({ format: "pushbox.approval-request/1", approve: [{ asset: "mech.ladder", version: src.version, hash: "0".repeat(64) }] }));
  assert.throws(() => art(root, "approve", "--from-file", req, "--by", "test", "--via", "workbench"));
  fs.writeFileSync(req, JSON.stringify({ format: "pushbox.approval-request/1", approve: [{ asset: "mech.ladder", version: src.version, hash: src.content_hash }] }));
  art(root, "approve", "--from-file", req, "--by", "test", "--via", "workbench");
  assert.equal(json(root, "art/approvals.json").records.at(-1).items[0].asset, "mech.ladder");
});

test("the repository's real approval log was not touched", () => {
  const now = fs.existsSync(real) ? crypto.createHash("sha256").update(fs.readFileSync(real)).digest("hex") : null;
  assert.equal(now, realBefore);
});
