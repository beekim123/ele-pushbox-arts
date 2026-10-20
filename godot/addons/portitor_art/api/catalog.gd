class_name PortitorArtCatalog
extends RefCounted
## A package instance owns its verified metadata and raw-media caches.
## Validation never loads candidate entry scripts. No game service is consulted.
const Contract = preload("provider_contract.gd")
const PREFIX: String = "addons/portitor_art/"
const FORMAT: String = "portitor.art.godot-package/1"
const INDEX_FORMAT: String = "portitor.art.runtime-index/1"
const PACKAGE_ID: String = "portitor.art.godot"
const SCHEMAS: Dictionary = {"world":"portitor.art.world/1","ui":"portitor.art.ui/1","visual_cells":"visual_cells/1"}
const ENTRIES: Dictionary = {"catalog":"api/catalog.gd","world":"runtime/render/world_view.gd","ui":"runtime/ui/views/ui_view.gd","widgets":"runtime/ui/widgets.gd","tutorial_feedback":"runtime/ui/views/tutorial_feedback.gd"}
const HOST: Dictionary = {"godot":"4.7.2","rendering_method":"gl_compatibility","viewport":[320,180],"stretch_mode":"canvas_items","scale_mode":"integer","nearest":true,"worker_pool":1}
const FONT_FILES: Array[String] = ["fusion-pixel-10px/OFL.txt","fusion-pixel-10px/README.md","fusion-pixel-10px/fusion-pixel-10px-proportional-sc.woff2","fusion-pixel-12px/OFL.txt","fusion-pixel-12px/README.md","fusion-pixel-12px/fusion-pixel-12px-proportional-zh_hans.otf.woff2","fusion-pixel-12px/LICENSES/galmuri/LICENSE.txt","fusion-pixel-12px/LICENSES/ark-pixel/OFL.txt","fusion-pixel-12px/LICENSES/cubic-11/OFL.txt"]
const FONT_HASHES: Dictionary = {"fusion-pixel-10px":"20f58ce5f54e468bc6aa86944aa2445b1e19264193496e9cd57f913cdb279e72","fusion-pixel-12px":"0ebd99e6f1e9b650a793a3f759c1c3dfa99f0c5b6502e78569b48ddb43767e40"}
const FONT_BINARIES: Dictionary = {"fusion-pixel-10px":"resources/fonts/fusion-pixel-10px/fusion-pixel-10px-proportional-sc.woff2","fusion-pixel-12px":"resources/fonts/fusion-pixel-12px/fusion-pixel-12px-proportional-zh_hans.otf.woff2"}
const REPORT_SCOPES: Array[String]=["public-contracts","public-js-reference","public-render","native-predecessor","public-pck"]
const REPORT_FIELDS: Array[String]=["report_path","report_sha256","tested_producer_commit","tested_manifest_sha256","runtime_payload_sha256","renderer_sha256","approved_identity_sha256","verifier_commit","fixture_sha256","godot","platform","backend","scope","completed","failures","case_ids"]
var resource_root: String = ""
var manifest_sha256: String = ""
var runtime_payload_sha256: String = ""
var _manifest: Dictionary = {}
var _index: Dictionary = {}
var _assets: Dictionary = {}
var _textures: Dictionary = {}

func load_at(package_root: String, expected_manifest_sha256: String) -> Dictionary:
	var checked: Dictionary = Contract.validate_resource_root(package_root)
	if not checked.ok: return checked
	if not _hex(expected_manifest_sha256,64): return Contract.result(["expected a fixed manifest SHA-256"])
	if not _root_is_unlinked(package_root): return Contract.result(["package root must not traverse links"])
	var manifest_path: String = package_root.path_join("manifest.json")
	if not FileAccess.file_exists(manifest_path) or FileAccess.get_sha256(manifest_path)!=expected_manifest_sha256:
		return Contract.result(["manifest original bytes are missing or changed"])
	checked = _json(FileAccess.get_file_as_bytes(manifest_path))
	if not checked.ok: return checked
	var candidate: Dictionary = checked.value
	checked = _manifest_header(candidate)
	if not checked.ok: return checked
	var table: Array = candidate.files
	var files: Dictionary = {}
	var folded: Dictionary = {}
	var total: int = 0
	var previous: String = ""
	for value: Variant in table:
		if not value is Dictionary or value.keys().size()!=3 or not value.has_all(["path","bytes","sha256"]): return Contract.result(["invalid file record"])
		if not value.path is String or not _path(value.path) or not value.path.begins_with(PREFIX) or value.path==PREFIX+"manifest.json": return Contract.result(["invalid/self-listed payload path"])
		if not _integer(value.bytes,0,67108864) or not _hex(value.sha256,64): return Contract.result(["invalid file size/SHA"])
		if files.has(value.path) or folded.has(value.path.to_lower()) or (not previous.is_empty() and previous>=value.path): return Contract.result(["duplicate/case-folded/unsorted file path"])
		previous=value.path;folded[value.path.to_lower()]=true;files[value.path]=value
		total+=int(value.bytes)
		if total>268435456: return Contract.result(["payload exceeds 256 MiB"])
	for key: String in folded:
		var parent: String=key.get_base_dir()
		while not parent.is_empty():
			if folded.has(parent): return Contract.result(["file-directory prefix conflict"])
			parent=parent.get_base_dir()
	checked = _file_set(package_root,files)
	if not checked.ok: return checked
	for key: String in files:
		var local: String=_local(package_root,key)
		var file: FileAccess=FileAccess.open(local,FileAccess.READ)
		if file==null or file.get_length()!=int(files[key].bytes) or FileAccess.get_sha256(local)!=files[key].sha256: return Contract.result(["missing/changed payload bytes: "+key])
	if _digest(table,"portitor.art.payload-files/1")!=candidate.identity.runtime_payload_sha256: return Contract.result(["runtime payload identity mismatch"])
	var renderer: Array=[]
	for file: Dictionary in table:
		if file.path.ends_with(".gd") or file.path.ends_with(".gdshader") or file.path.ends_with(".gdshaderinc") or file.path==PREFIX+"resources/catalog.json": renderer.append(file)
	if _digest(renderer,"portitor.art.renderer-files/1")!=candidate.identity.renderer_sha256: return Contract.result(["renderer identity mismatch"])
	checked = _json(FileAccess.get_file_as_bytes(package_root.path_join("resources/catalog.json")))
	if not checked.ok: return checked
	var index: Dictionary=checked.value
	checked = _validate_index(index,files,candidate)
	if not checked.ok: return checked
	checked = _host_requirements()
	if not checked.ok: return checked
	checked = _script_closure(package_root,files)
	if not checked.ok: return checked
	# Commit only after all checks succeed. Failed rebinds retain the previous state.
	resource_root=package_root;manifest_sha256=expected_manifest_sha256
	runtime_payload_sha256=candidate.identity.runtime_payload_sha256
	_manifest=candidate.duplicate(true);_index=index.duplicate(true);_assets={}
	for asset: Dictionary in index.assets: _assets[asset.uid]=asset.duplicate(true)
	clear_caches()
	return Contract.result([],{"resource_root":resource_root,"manifest_sha256":manifest_sha256,"runtime_payload_sha256":runtime_payload_sha256})

func metadata(uid: String) -> Dictionary:
	if not _assets.has(uid): return {}
	var entry: Dictionary=_assets[uid].duplicate(true)
	entry.palette=_index.palette.duplicate(true)
	entry.texture_path=resource_root.path_join(entry.texture_path) if not entry.texture_path.is_empty() else ""
	entry.texture=entry.texture_path
	return entry

func texture(uid: String) -> Texture2D:
	if _textures.has(uid): return _textures[uid]
	if not _assets.has(uid) or _assets[uid].kind!="sprite": return null
	var entry: Dictionary=_assets[uid]
	var file: String=resource_root.path_join(entry.texture_path)
	if not FileAccess.file_exists(file) or FileAccess.get_sha256(file)!=entry.png_sha256: return null
	var image: Image=Image.new()
	if image.load_png_from_buffer(FileAccess.get_file_as_bytes(file))!=OK: return null
	if image.get_size()!=Vector2i(int(entry.size[0])*int(entry.frame_count),int(entry.size[1])): return null
	var loaded: ImageTexture=ImageTexture.create_from_image(image)
	_textures[uid]=loaded
	return loaded

func capability(uid: String) -> Dictionary:
	if not _assets.has(uid): return {"native":"missing","implementation_kind":"missing","evidence":[],"evidence_stage":"source_inventory","verified":false}
	return _assets[uid].native.duplicate(true)

func clear_caches() -> void:
	_textures.clear()

static func _manifest_header(value: Dictionary) -> Dictionary:
	var errors: Array[String]=Contract.fields(value,{"format":TYPE_STRING,"package_id":TYPE_STRING,"package_version":TYPE_STRING,"producer":TYPE_DICTIONARY,"assets_base":TYPE_DICTIONARY,"runtime":TYPE_DICTIONARY,"files":TYPE_ARRAY,"identity":TYPE_DICTIONARY,"candidate_verification":TYPE_DICTIONARY},{},"manifest")
	if not errors.is_empty(): return Contract.result(errors)
	if value.format!=FORMAT or value.package_id!=PACKAGE_ID or not _semver(value.package_version): return Contract.result(["unsupported package identity/version"])
	var p: Dictionary=value.producer
	if p.keys().size()!=4 or p.get("repository")!="https://github.com/beekim123/ele-pushbox-arts.git" or not _hex(p.get("commit"),40) or p.get("packer_profile")!="portitor.art.store-zip/1" or p.get("packer_version")!="1": return Contract.result(["invalid committed producer identity"])
	var base: Dictionary=value.assets_base
	if base!={"tag":"art-v2026.10.20.1","commit":"4976323c7bd1d7706602d4d4c3dfbc11e673d10b","manifest_sha256":"a5f1747e6cd619675a0c46768378c7fae4f7a95ba74ca5e6588788b5c30ffbe8"}: return Contract.result(["unsupported fixed art baseline"])
	var runtime: Dictionary=value.runtime
	if runtime.keys().size()!=3 or runtime.get("index")!=PREFIX+"resources/catalog.json" or runtime.get("api_version")!="1" or runtime.get("schemas")!=SCHEMAS: return Contract.result(["unsupported runtime/API/schema"])
	if value.files.is_empty() or value.files.size()>4096: return Contract.result(["invalid file table count"])
	if value.identity.keys().size()!=3: return Contract.result(["invalid payload identities"])
	for key: String in ["runtime_payload_sha256","renderer_sha256","approved_identity_sha256"]:
		if not _hex(value.identity.get(key),64): return Contract.result(["missing payload identity: "+key])
	return _verification(value.candidate_verification,value.identity)

static func _verification(value: Dictionary, identity: Dictionary) -> Dictionary:
	if value.keys().size()!=3 or not value.has_all(["status","runtime_payload_sha256","reports"]) or value.runtime_payload_sha256!=identity.runtime_payload_sha256 or not value.reports is Array: return Contract.result(["technical receipt identity/fields mismatch"])
	if value.status=="pending": return Contract.result([]) if value.reports.is_empty() else Contract.result(["pending has no technical reports"])
	if value.status!="recorded" or value.reports.is_empty() or value.reports.size()>32: return Contract.result(["unsupported technical receipt status"])
	var paths: Dictionary={}
	var godot_pattern: RegEx=RegEx.new();godot_pattern.compile("^4\\.7\\.2(?:[.\\-][A-Za-z0-9_-]+)*$")
	var case_pattern: RegEx=RegEx.new();case_pattern.compile("^[A-Za-z0-9_.:/-]{1,160}$")
	for record: Variant in value.reports:
		if not record is Dictionary or record.keys().size()!=REPORT_FIELDS.size() or not record.has_all(REPORT_FIELDS): return Contract.result(["unknown/functional report receipt fields"])
		if not record.report_path is String or not _path(record.report_path) or not record.report_path.begins_with("godot/verification/") or not record.report_path.ends_with(".json") or paths.has(record.report_path): return Contract.result(["invalid/duplicate report origin"])
		paths[record.report_path]=true
		for key: String in ["report_sha256","tested_manifest_sha256","runtime_payload_sha256","renderer_sha256","approved_identity_sha256","fixture_sha256"]:
			if not _hex(record[key],64): return Contract.result(["invalid technical report SHA"])
		for key: String in ["tested_producer_commit","verifier_commit"]:
			if not _hex(record[key],40): return Contract.result(["invalid tested/verifier commit"])
		for key: String in ["runtime_payload_sha256","renderer_sha256","approved_identity_sha256"]:
			if record[key]!=identity[key]: return Contract.result(["technical report belongs to another payload"])
		if not record.godot is String or godot_pattern.search(record.godot)==null or record.platform!="macos-arm64" or record.backend!="gl_compatibility": return Contract.result(["unsupported tested target"])
		if not record.completed is bool or not _integer(record.failures,0,2147483647) or not record.scope is Array or record.scope.is_empty() or not record.case_ids is Array or record.case_ids.is_empty() or record.case_ids.size()>4096: return Contract.result(["invalid technical completion/scope/cases"])
		var scopes: Dictionary={};var ids: Dictionary={}
		for scope: Variant in record.scope:
			if not scope is String or scope not in REPORT_SCOPES or scopes.has(scope): return Contract.result(["unknown/duplicate technical scope"])
			scopes[scope]=true
		for id: Variant in record.case_ids:
			if not id is String or case_pattern.search(id)==null or ids.has(id): return Contract.result(["invalid technical case identity"])
			ids[id]=true
	# Detached report bytes are checked by the committed producer, not executed here.
	# This annotation never changes resource selection or source capability status.
	return Contract.result([])

static func _validate_index(index: Dictionary, files: Dictionary, manifest: Dictionary) -> Dictionary:
	if not Contract._metadata_is_plain_data(index): return Contract.result(["runtime metadata must be finite bounded plain data"])
	var fields: Dictionary={"format":TYPE_STRING,"package_id":TYPE_STRING,"package_version":TYPE_STRING,"api_version":TYPE_STRING,"schemas":TYPE_DICTIONARY,"entries":TYPE_DICTIONARY,"host_requirements":TYPE_DICTIONARY,"palette":TYPE_DICTIONARY,"assets":TYPE_ARRAY,"audio":TYPE_ARRAY,"fonts":TYPE_ARRAY,"approval_records":TYPE_DICTIONARY}
	var errors: Array[String]=Contract.fields(index,fields,{},"runtime index")
	if not errors.is_empty(): return Contract.result(errors)
	if index.format!=INDEX_FORMAT or index.package_id!=PACKAGE_ID or index.package_version!=manifest.package_version or index.api_version!="1" or index.schemas!=SCHEMAS or index.entries!=ENTRIES or not _host_metadata(index.host_requirements): return Contract.result(["runtime protocol/entry/host metadata mismatch"])
	for file: String in index.entries.values():
		if not files.has(PREFIX+file): return Contract.result(["missing declared entry"])
	if index.assets.size()!=221 or index.audio.size()!=32 or index.fonts.size()!=2: return Contract.result(["fixed approved inventory size mismatch"])
	if index.approval_records.keys().size()!=2 or not index.approval_records.get("art") is Array or not index.approval_records.get("audio") is Array: return Contract.result(["missing original approval records"])
	var art_records: Dictionary={};var audio_records: Dictionary={}
	for kind: String in ["art","audio"]:
		var records: Dictionary=art_records if kind=="art" else audio_records
		for rec: Variant in index.approval_records[kind]:
			if not rec is Dictionary or not rec.get("items") is Array: return Contract.result(["invalid approval record"])
			for key: String in ["id","date","by","via","note"]:
				if not rec.get(key) is String or rec[key].is_empty(): return Contract.result(["missing approval provenance: "+key])
			if records.has(rec.id): return Contract.result(["duplicate approval record"])
			if kind=="art" and not rec.get("scope") is String: return Contract.result(["art approval scope required"])
			if kind=="audio" and not rec.get("selections") is Array: return Contract.result(["audio selections provenance required"])
			records[rec.id]=rec
	var assets: Dictionary={};var approved: Array=[];var sprites: int=0;var references: int=0
	for item: Variant in index.assets:
		if not item is Dictionary: return Contract.result(["invalid asset record"])
		var a: Dictionary=item
		var required: Dictionary={"uid":TYPE_STRING,"id":TYPE_STRING,"kind":TYPE_STRING,"category":TYPE_STRING,"layer":TYPE_STRING,"version":TYPE_FLOAT,"hash":TYPE_STRING,"approved":TYPE_BOOL,"placeholder":TYPE_BOOL,"approval":TYPE_STRING,"png_sha256":TYPE_STRING,"texture_path":TYPE_STRING,"size":TYPE_ARRAY,"frame_count":TYPE_FLOAT,"anchor":TYPE_ARRAY,"animations":TYPE_DICTIONARY,"params":TYPE_DICTIONARY,"depends":TYPE_ARRAY,"native":TYPE_DICTIONARY,"origin":TYPE_DICTIONARY}
		errors=Contract.fields(a,required,{"ninepatch":typeof(a.get("ninepatch"))},"asset")
		if not errors.is_empty(): return Contract.result(errors)
		if not Contract.is_art_uid(a.uid) or a.uid!="art:"+a.id or assets.has(a.uid) or a.id=="char.portitor_alt" or not _integer(a.version,1,2147483647) or not _hex(a.hash,64) or not _hex(a.png_sha256,64) or not a.approved or a.placeholder: return Contract.result(["invalid selected approval identity"])
		if not art_records.has(a.approval) or not _approval_item(art_records[a.approval].items,a,false): return Contract.result(["selected art identity lacks its original approval"])
		var valid: Dictionary=Contract.validate(a.native)
		if not valid.ok: return valid
		if a.native.evidence_stage!="source_inventory" or a.native.verified: return Contract.result(["static inventory is not candidate verification"])
		if a.native.native=="reference_only": references+=1
		if a.kind=="sprite":
			sprites+=1
			if a.size.size()!=2 or a.anchor.size()!=2 or not _integer(a.frame_count,1,4096) or not a.size.all(func(x: Variant)->bool:return _integer(x,1,4096)) or not a.anchor.all(func(x: Variant)->bool:return _integer(x,-2147483648,2147483647)): return Contract.result(["invalid sprite geometry"])
			if not _resource_path(a.texture_path) or not files.has(PREFIX+a.texture_path) or files[PREFIX+a.texture_path].sha256!=a.png_sha256: return Contract.result(["missing/changed approved sprite"])
			for animation: Variant in a.animations.values():
				if not animation is Dictionary or not animation.get("frames") is Array or animation.frames.is_empty() or not animation.get("loop") is bool or not (animation.get("fps") is float or animation.get("fps") is int) or not is_finite(float(animation.fps)) or animation.fps<0: return Contract.result(["invalid sprite animation"])
				for frame: Variant in animation.frames:
					if not _integer(frame,0,int(a.frame_count)-1): return Contract.result(["sprite animation outside approved sheet"])
		elif a.kind!="procedural" or not a.texture_path.is_empty(): return Contract.result(["procedural references are not runtime textures"])
		assets[a.uid]=a
		approved.append([a.uid,int(a.version),a.hash,a.approval,a.png_sha256])
	if sprites!=178 or references!=13: return Contract.result(["178/13 inventory differs from source baseline"])
	for a: Dictionary in assets.values():
		for dependency: Variant in a.depends:
			if not dependency is String or not assets.has("art:"+dependency): return Contract.result(["unknown approved dependency"])
	var done: Dictionary={};var visiting: Dictionary={}
	for uid: String in assets:
		if not _acyclic(uid,assets,done,visiting): return Contract.result(["cyclic approved dependencies"])
	var sound_ids: Dictionary={}
	for value: Variant in index.audio:
		if not value is Dictionary: return Contract.result(["invalid audio record"])
		var a: Dictionary=value
		if not a.get("uid") is String or not a.uid.begins_with("sfx:") or sound_ids.has(a.uid) or a.get("version")!=2 or not _hex(a.get("hash"),64) or not _hex(a.get("sha256"),64) or not a.get("origin") is Dictionary or not audio_records.has(a.get("approval")): return Contract.result(["invalid selected sound identity"])
		if not _approval_item(audio_records[a.approval].items,a,true) or not _resource_path(a.get("path")) or not files.has(PREFIX+a.path) or files[PREFIX+a.path].sha256!=a.sha256: return Contract.result(["sound bytes/approval mismatch"])
		sound_ids[a.uid]=true;approved.append([a.uid,int(a.version),a.hash,a.approval,a.sha256])
	var font_paths: Dictionary={};var font_ids: Dictionary={}
	for value: Variant in index.fonts:
		if not value is Dictionary or not FONT_HASHES.has(value.get("id")) or value.get("sha256")!=FONT_HASHES[value.id] or not value.get("files") is Array: return Contract.result(["unknown/changed frozen font"])
		if font_ids.has(value.id) or value.get("path")!=FONT_BINARIES[value.id] or not files.has(PREFIX+value.path) or files[PREFIX+value.path].sha256!=value.sha256: return Contract.result(["frozen font binary path/identity mismatch"])
		font_ids[value.id]=true
		approved.append([value.id,value.sha256])
		var binary_found: bool=false
		for item: Variant in value.files:
			if not item is Dictionary or not _resource_path(item.get("path")) or not files.has(PREFIX+item.path) or font_paths.has(item.path) or not _hex(item.get("sha256"),64) or files[PREFIX+item.path].sha256!=item.sha256 or not _integer(item.get("bytes"),0,67108864) or item.bytes!=files[PREFIX+item.path].bytes: return Contract.result(["missing/changed font notice"])
			if item.path==value.path:
				if item.sha256!=value.sha256: return Contract.result(["font file record differs from frozen binary identity"])
				binary_found=true
			font_paths[item.path]=true
		if not binary_found: return Contract.result(["frozen font is absent from its declared file set"])
	if font_paths.size()!=9: return Contract.result(["complete frozen font notices required"])
	for relative: String in FONT_FILES:
		if not font_paths.has("resources/fonts/"+relative): return Contract.result(["required upstream font declaration missing"])
	approved.sort_custom(func(a: Array,b: Array)->bool:return a[0]<b[0])
	if _sha(("portitor.art.approved-identities/1\n"+JSON.stringify(approved)+"\n").to_utf8_buffer())!=manifest.identity.approved_identity_sha256: return Contract.result(["approved identities digest mismatch"])
	return Contract.result([])

static func _approval_item(items: Array, asset: Dictionary, audio: bool) -> bool:
	if not asset.origin.get("media_path") is String: return false
	for value: Variant in items:
		if not value is Dictionary: continue
		if audio:
			if value.get("uid")==asset.uid and value.get("version")==asset.version and value.get("hash")==asset.hash and value.get("wav_sha256")==asset.sha256 and value.get("wav")==asset.origin.media_path: return true
		elif value.get("asset")==asset.id and value.get("version")==asset.version and value.get("hash")==asset.hash and value.get("png_sha256")==asset.png_sha256 and value.get("png")==asset.origin.media_path: return true
	return false

static func _acyclic(uid: String, assets: Dictionary, done: Dictionary, visiting: Dictionary) -> bool:
	if visiting.has(uid): return false
	if done.has(uid): return true
	visiting[uid]=true
	for id: String in assets[uid].depends:
		if not _acyclic("art:"+id,assets,done,visiting): return false
	visiting.erase(uid);done[uid]=true
	return true

static func _host_requirements() -> Dictionary:
	var version: Dictionary=Engine.get_version_info()
	if version.major!=4 or version.minor!=7 or version.patch!=2: return Contract.result(["Godot 4.7.2 required"])
	var settings: Dictionary={"rendering/renderer/rendering_method":"gl_compatibility","display/window/size/viewport_width":320,"display/window/size/viewport_height":180,"display/window/stretch/mode":"canvas_items","display/window/stretch/scale_mode":"integer","threading/worker_pool/max_threads":1,"rendering/textures/canvas_textures/default_texture_filter":0}
	for key: String in settings:
		if ProjectSettings.get_setting(key)!=settings[key]: return Contract.result(["host requirement mismatch: "+key])
	return Contract.result([])

static func _host_metadata(value: Dictionary) -> bool:
	if value.keys().size()!=HOST.keys().size() or not value.has_all(HOST.keys()) or not value.get("viewport") is Array or value.viewport.size()!=2: return false
	if not _integer(value.viewport[0],320,320) or not _integer(value.viewport[1],180,180) or not _integer(value.get("worker_pool"),1,1): return false
	# JSON number tokens are floats; compare known bounded integers explicitly.
	var normalized: Dictionary=value.duplicate(true)
	normalized.viewport=[320,180];normalized.worker_pool=1
	return normalized==HOST

static func _script_closure(root: String, files: Dictionary) -> Dictionary:
	var refs: RegEx=RegEx.new();refs.compile("(?:\\b(?:preload|load)\\s*\\(\\s*|\\bextends\\s+|#include\\s+)[\"']([^\"']+)[\"']")
	# Split the two sentinel spellings so this validator is not its own match.
	var forbidden: RegEx=RegEx.new();forbidden.compile("(?:"+"uid"+"://|@"+"tool\\b|\\bEditorPlugin\\b|\\bEleWorld\\b|\\bPortitorSession\\b|/root/(?:Registry|Save|Settings|Locale)|res://(?:app|gameplay|sim|presentation|bin|generated)/)")
	for key: String in files:
		if not key.ends_with(".gd") and not key.ends_with(".gdshader") and not key.ends_with(".gdshaderinc"): continue
		var text: String=FileAccess.get_file_as_string(_local(root,key))
		if forbidden.search(text)!=null: return Contract.result(["private/editor source dependency"])
		for match_value: RegExMatch in refs.search_all(text):
			var ref: String=match_value.get_string(1)
			if ref.begins_with("/") or ":" in ref or "\\" in ref: return Contract.result(["absolute source dependency"])
			var resolved: String=key.get_base_dir().path_join(ref).simplify_path()
			if not resolved.begins_with(PREFIX) or not files.has(resolved): return Contract.result(["unknown/outside source dependency: "+key+" -> "+ref])
	return Contract.result([])

static func _file_set(root: String, files: Dictionary) -> Dictionary:
	var seen: Dictionary={}
	var checked: Dictionary=_walk(root,"",seen)
	if not checked.ok: return checked
	for relative: String in seen:
		var key: String=PREFIX+relative
		if key==PREFIX+"manifest.json" or files.has(key): continue
		# Godot may create only these precise sidecars for owned sources.
		var uid_source: String=relative.trim_suffix(".uid")
		if relative.ends_with(".uid") and (uid_source.ends_with(".gd") or uid_source.ends_with(".gdshader") or uid_source.ends_with(".gdshaderinc")) and files.has(PREFIX+uid_source): continue
		if relative.ends_with(".import") and files.has(PREFIX+relative.trim_suffix(".import")): continue
		return Contract.result(["unknown package file: "+relative])
	for key: String in files:
		if not seen.has(key.trim_prefix(PREFIX)): return Contract.result(["missing package file: "+key])
	return Contract.result([])

static func _walk(root: String, relative: String, seen: Dictionary) -> Dictionary:
	var dir: DirAccess=DirAccess.open(root.path_join(relative))
	if dir==null: return Contract.result(["cannot read package directory"])
	dir.include_hidden=true;dir.include_navigational=false;dir.list_dir_begin()
	var name: String=dir.get_next()
	while not name.is_empty():
		if dir.is_link(name): return Contract.result(["links are forbidden in package trees"])
		var child: String=relative.path_join(name)
		if dir.current_is_dir():
			if name in [".git",".godot","node_modules"]: return Contract.result(["cache/private directory inside package"])
			var checked: Dictionary=_walk(root,child,seen)
			if not checked.ok: return checked
		else: seen[child]=true
		name=dir.get_next()
	dir.list_dir_end()
	return Contract.result([])

static func _root_is_unlinked(root: String) -> bool:
	var parent: String="res://"
	for segment: String in root.trim_prefix("res://").split("/"):
		var directory: DirAccess=DirAccess.open(parent)
		if directory==null or directory.is_link(segment): return false
		parent=parent.path_join(segment)
	return true

static func _local(root: String, archive_path: String) -> String:
	return root.path_join(archive_path.trim_prefix(PREFIX))
static func _integer(value: Variant, minimum: int, maximum: int) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and value>=minimum and value<=maximum and value==floor(float(value))
static func _hex(value: Variant, count: int) -> bool:
	if not value is String or value.length()!=count: return false
	for index: int in count:
		if value[index] not in "0123456789abcdef": return false
	return true
static func _semver(value: String) -> bool:
	var regex: RegEx=RegEx.new();regex.compile("^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-(?:[0-9A-Za-z-]+\\.)*[0-9A-Za-z-]+)?$")
	return regex.search(value)!=null
static func _resource_path(value: Variant) -> bool:
	return value is String and _path(value) and value.begins_with("resources/")
static func _path(value: String) -> bool:
	if value.is_empty() or value.to_utf8_buffer().size()>512 or value.begins_with("/") or value.ends_with("/") or "\\" in value or ":" in value: return false
	var parts: PackedStringArray=value.split("/")
	if parts.size()>24: return false
	for part: String in parts:
		if part.is_empty() or part in [".","..",".git",".godot","node_modules"]: return false
	for i: int in value.length():
		if value.unicode_at(i)<=32 or value.unicode_at(i)==127: return false
	return not value.ends_with(".uid") and not value.ends_with(".import")
static func _sha(bytes: PackedByteArray) -> String:
	var context: HashingContext=HashingContext.new();context.start(HashingContext.HASH_SHA256);context.update(bytes)
	return context.finish().hex_encode()
static func _digest(files: Array, domain: String) -> String:
	var text: String=domain+"\n"
	for file: Dictionary in files: text+=file.path+"\t"+str(int(file.bytes))+"\t"+file.sha256+"\n"
	return _sha(text.to_utf8_buffer())

static func _json(bytes: PackedByteArray) -> Dictionary:
	var text: String=bytes.get_string_from_utf8()
	if text.to_utf8_buffer()!=bytes or text.begins_with("\ufeff"): return Contract.result(["JSON requires original lossless UTF-8 bytes"])
	var stack: Array[Dictionary]=[];var index: int=0
	while index<text.length():
		var char_value: String=text[index]
		if char_value in ["{","["]:
			stack.append({"object":char_value=="{","keys":{},"key":char_value=="{"})
			if stack.size()>64: return Contract.result(["JSON exceeds nesting profile"])
		elif char_value in ["}","]"]:
			if stack.is_empty(): return Contract.result(["unbalanced JSON"])
			stack.pop_back()
		elif char_value=="," and not stack.is_empty() and stack[-1].object: stack[-1].key=true
		elif char_value=="\"":
			var start: int=index;index+=1
			while index<text.length():
				if text[index]=="\\": index+=2;continue
				if text[index]=="\"": break
				index+=1
			if index>=text.length(): return Contract.result(["unterminated JSON string"])
			if not stack.is_empty() and stack[-1].object and stack[-1].key:
				var key: Variant=JSON.parse_string(text.substr(start,index-start+1))
				if not key is String or stack[-1].keys.has(key): return Contract.result(["duplicate/invalid JSON key"])
				stack[-1].keys[key]=true;stack[-1].key=false
		index+=1
	var parsed: JSON=JSON.new()
	if parsed.parse(text)!=OK or not parsed.data is Dictionary: return Contract.result(["invalid package JSON object"])
	return Contract.result([],parsed.data)
