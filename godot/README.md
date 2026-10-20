# Native Godot art candidate

This directory holds native art sources extracted before the first publication.
Release and actual-file/license approval are recorded in external review/release
evidence; a source checkout does not itself confer an additional art approval.
The original `art-v*` history, approved media and authoring tools remain intact.

The native consumer receives `addons/portitor_art/` and needs no Node or authoring
checkout. Node is used here only by the producer and its isolated tests. Native
rendering validation targets Godot 4.7.2, macOS arm64, GL Compatibility, 320×180,
integer scaling, nearest sampling and one worker. GPU/PCK checks require their
own real results; source inventory is not a rendering pass.

## Build from a real committed producer

Commit the producer source first. Then run, with that full committed SHA:

```sh
node tools/pack-godot.mjs build --source-commit <full-40-character-commit> --version 1.0.0
```

The library API is
`buildGodotPack({root, sourceCommit, packageVersion, outDir})` and returns paths
`{archive, manifest, checksums}` plus their measured identities. It reads ordinary
Git blob objects from the selected commit, not the mutable working tree. The
executing producer library must match that commit. No build/approve, latest
lookup, network fetch, tag, push or Release operation is performed. Outputs under
`dist/` are ignored. A later source change requires a new committed input and
regeneration; the generated manifest is never committed back into its own input.

`source-map.json` records the exact game extraction commit, source/target SHA and
each relative API-path rewrite. All mapped inputs, including the static
`native-coverage.json`, must match the recorded target bytes. File paths changed
where `api` moved outside `runtime`; such scripts are not described as byte copies.

## Installed files and runtime index

The archive contains only ordinary files under `addons/portitor_art/`:

- `api/` supplies the explicit provider, closed display schemas and Catalog.
- `runtime/render/` and `runtime/ui/` supply pure presentation code. Game
  controllers, SDK conversion, rules, real levels and private fixtures are absent.
- `resources/catalog.json` fixes API/schema, entry paths, host requirements,
  palette, complete selected art/audio/font identities, parameters, animation,
  anchors, dependency IDs, original approval provenance and native classification.
- `resources/sprites/` contains 178 original approved PNG sheets;
  `resources/audio/sfx/` contains 32 original approved v2 WAVs.
- `resources/fonts/` preserves two original woff2 files, all five complete
  license files and both original README files.
- `licenses/` preserves the root code/material terms, T5/T6 mixed-source tables
  and a per-file candidate rights inventory. It is not a blanket MIT grant.

All 221 art identities remain in the index; 43 procedural approval PNGs stay in
producer review material outside the runtime ZIP. Thirteen reference-only assets
have no runnable native fallback. Static 208 implemented / 13 reference-only
classification does not prove that 208 items were extracted or rendered correctly.
No music or audio-playback API is enabled.

## Manifest and independent identities

The manifest format is `portitor.art.godot-package/1`; runtime index format is
`portitor.art.runtime-index/1`; package ID is `portitor.art.godot`. The fixed source
art baseline is `art-v2026.10.20.1` at
`4976323c7bd1d7706602d4d4c3dfbc11e673d10b`. The current API is string `"1"` with
`portitor.art.world/1`, `portitor.art.ui/1` and `visual_cells/1`.

`files[]` lists every installed payload file as `{path,bytes,sha256}`, excluding
the manifest itself. Names use UTF-8 byte order. Runtime identity hashes this
exact table using the UTF-8 preimage:

```text
portitor.art.payload-files/1\n
<path>\t<decimal-byte-count>\t<lowercase-sha256>\n
...
```

Every behavior-affecting field is inside the byte-bound runtime index. Manifest
runtime summaries must agree with it. Renderer identity uses the same table-line
encoding and domain `portitor.art.renderer-files/1` over all GD/Shader/include files and
the runtime index. Approved identity is SHA256 of the domain line
`portitor.art.approved-identities/1\n`, followed by canonical JSON plus LF of
UID-sorted art/audio tuples `[uid,version,source_hash,approval,media_sha256]` and
font tuples `[font_id,font_sha256]`. New native code SHA is never written into
the original art source-hash field.

The final canonical manifest SHA hashes its original bytes and lives outside
the manifest. The ZIP SHA hashes transport bytes and lives in checksums or an
installation receipt. Neither is substituted for runtime or approval identity.

T7 introduced the finite no-report receipt
`{status:"pending",runtime_payload_sha256:<matching digest>,reports:[]}`. A
committed producer-only `godot/verification-index.json` may supply the same shape;
unknown fields, another payload or invented reports are rejected. `pending` here
means no T8 technical report is attached, and is independent of U4 file approval.
T8 extends it with `status:"recorded"` and a finite report header. Each actual
`portitor.art.native-test-report/1` body binds tested source/manifest/payload/
renderer/approved identity, verifier commit, fixture SHA, Godot/platform/backend
and explicit scopes/cases. The producer verifies committed report bytes, exact
scope coverage and results; Catalog accepts only the finite non-executing header.
Functional host/renderer/capability parameters remain in the runtime index.
Freeze the actual Catalog/payload **before** testing it. Later attach the report
outside the addon and rebuild from a new real commit with the same payload, while
checking new manifest/ZIP integrity separately. Technical results do not
automatically upgrade every static capability or game playability.

## Catalog

`PortitorArtCatalog.load_at(package_root, expected_manifest_sha256)` returns
`{ok,errors,value}`. It verifies original manifest bytes, protocol, exact file
set/bytes, index, approval/native/dependency facts, host settings and static
source references before changing the current instance. Failed loads leave the
previous root/index/texture cache intact. It does not load candidate entry scripts
to validate them.

`resource_root` is the package root, for example `res://addons/portitor_art`.
`metadata(uid)` and `capability(uid)` are raw dictionary queries; `texture(uid)`
returns a Texture2D or null. Metadata queries return copies. Sprite textures are
created from approved, SHA-checked original PNG bytes, avoiding an importer/remap
dependency. Fonts load original bytes from `<root>/resources/fonts`.

`capability.verified=false` with `evidence_stage="source_inventory"` remains
usable for extraction contracts through the existing provider protocol. It is
not a test bypass or technical success. Required reference-only/missing/wrong-kind
capabilities reject explicitly. Cache state belongs to the instance/root/payload;
runtime hot-swapping script classes is not supported.

Source-byte validation must not be silently skipped in an export. PCK resource
conversion/remaps and retention of raw fonts/scripts/media require actual T8 and
consumer export evidence. A source-host result alone is not a Mac-app result.

## STORE ZIP profile 1

`portitor.art.store-zip/1` uses method 0 STORE, UTF-8 flag 0x0800, fixed DOS
1980-01-01 00:00:00, version-needed 20, Unix made-by 3/20, regular 0100644 attrs,
no directory entries, extras, comments, encryption, data descriptors, ZIP64,
multiple disks or trailing data. Local and central records agree exactly. CRC32
checks ZIP structure; SHA256 checks original file identity.

Current bounds: 4096 entries, 64 MiB per file, 256 MiB total archive/payload,
512 UTF-8 bytes and 24 segments per path. Paths reject controls, absolute/drive
paths, backslashes, dot/empty segments, links, case-folded and file-prefix
collisions, editor caches and files outside the addon. Manifest JSON is UTF-8
without BOM, sorted keys, finite values, unique keys and one final LF. Build
time and local machine paths are not part of content identity.

## Focused validation

```sh
node --test --test-concurrency=1 tests/godot-pack.test.mjs
node tests/native/run-catalog.mjs --archive <fixed-candidate.zip> --godot <Godot-4.7.2-executable>
node --single-threaded --v8-pool-size=1 tools/verify-godot-pack.mjs --source-commit <verifier-40hex> --archive <actual.zip> --baseline <T7actual.zip> --godot <absolute-binary> --out <new-absolute-directory>
node tools/art.mjs verify
node tools/audio.mjs verify
```

Tests use isolated Git commits and temporary roots. The T7 Catalog harness proves
source-byte loading and rejection contracts only. T8 independently tests actual
GPU frames, public fixtures, source comparisons and a minimal PCK. Each report
records actual completion/failure; it does not approve art or declare the private
game playable. Preserve known differences rather than rerecording them as passes.

Before local computation, inspect the shared machine budget. Use one worker,
numeric-library threads 1, `UV_THREADPOOL_SIZE=1`, test concurrency 1 and low
scheduling priority for longer work. Only clean up processes created by the task.
No public branch/tag/Release/attachment is authorized before T15's actual list.

The independent verifier installs the actual ZIP into a temporary, zero-Autoload
host and runs contracts, macOS GPU and a minimal PCK sequentially. Artificial
world/UI/visual_cells fixtures contain no game/SDK/real levels/story. The public
JS oracle loads only public raster/sprite/terrain code and selected approved
histories. Seven themes, ten standalone UI plus six embedded branches and play
HUD have explicit case coverage; sprite frame checks are not blanket sprite GPU
acceptance. First native comparison uses the T7 local source carrier and the
T1/T2/T6 extraction mapping, not a claimed previous formal native release.

The producer-demo PCK preset uses Text scripts. Its named raw exporter first
verifies every manifest-listed original byte, then adds all raw files and skips
default imported entries. Actual PCK source/PNG/WOFF2 access and rendering must
pass without skipping source SHA or duplicating fonts. PCK contains its host and
engine files as well as the addon; it is not byte-identical to the source ZIP.
Private full-game Mac export and consumer-lock tests remain separate integration
work. Every run preserves initial failures, missing cases and input/source
receipts; no original visual threshold or user approval is replaced.
