extends SceneTree
## T7 source-byte Catalog checks only. GPU/screens/PCK are T8 work.
const Catalog = preload("res://addons/portitor_art/api/catalog.gd")
const Contract = preload("res://addons/portitor_art/api/provider_contract.gd")
var checks: int=0
var failures: int=0
var results: Array[Dictionary]=[]
func _initialize() -> void:
	call_deferred("_run")
func check(ok: bool, message: String) -> void:
	checks+=1
	var item: Dictionary={"id":"catalog."+str(checks),"status":"passed" if ok else "failed","checks":1,"failures":0 if ok else 1,"assertion":message}
	results.append(item);print(JSON.stringify({"case":item}))
	if not ok:
		failures+=1;printerr("CHECK FAILED: "+message)
func _run() -> void:
	check(root.get_children().is_empty(),"no game Autoloads")
	var catalog: RefCounted=Catalog.new()
	var expected: String=OS.get_environment("PORTITOR_MANIFEST_SHA256")
	var loaded: Dictionary=catalog.load_at("res://addons/portitor_art",expected)
	check(loaded.ok,"real committed fixture ZIP loads: "+str(loaded.errors))
	if not loaded.ok:
		_finish();return
	check(catalog.resource_root=="res://addons/portitor_art","resource_root is package root")
	check(Contract.validate_provider(catalog).ok,"raw query provider protocol")
	check(catalog.metadata("level:synthetic").is_empty(),"no game domain metadata")
	check(catalog.capability("art:unknown").native=="missing","unknown capability remains missing")
	check(Contract.validate(catalog.capability("art:unknown")).ok,"missing remains a valid unknown-UID query state")
	check(catalog.texture("art:unknown")==null,"unknown sprite has no fallback")
	var wood: Dictionary=catalog.metadata("art:obj.crate_wood")
	check(wood.approved and not wood.placeholder and wood.size.size()==2 and int(wood.size[0])==16 and int(wood.size[1])==16,"approved wood metadata comes from history")
	check(wood.texture_path.begins_with(catalog.resource_root+"/resources/sprites/"),"texture paths resolve within root")
	var first: Texture2D=catalog.texture("art:obj.crate_wood")
	check(first!=null and first.get_size()==Vector2(16,16),"raw PNG bytes decode without an imported texture")
	check(first==catalog.texture("art:obj.crate_wood"),"one Catalog owns its texture cache")
	wood.approved=false;wood.animations.clear()
	check(catalog.metadata("art:obj.crate_wood").approved and not catalog.metadata("art:obj.crate_wood").animations.is_empty(),"query mutation cannot corrupt stored identity")
	var native: Dictionary=catalog.capability("art:theme.dungeon")
	check(native.evidence_stage=="source_inventory" and not native.verified,"T7 source classification is unverified")
	check(Contract.require_capability(catalog,"art:theme.dungeon","theme").ok,"implemented source capability is usable without a test bypass")
	var refs: Array[String]=["art:theme.candy","art:theme.jeju","art:theme.polar","art:ui.screen.confirm","art:ui.screen.delivery_hud","art:ui.screen.delivery_pause","art:ui.screen.hint_animal","art:ui.screen.hud_keys","art:ui.screen.observe","art:ui.screen.reels","art:ui.screen.settlement","art:ui.screen.settlement_fail","art:ui.screen.shop"]
	for uid: String in refs:
		check(catalog.capability(uid).native=="reference_only" and not Contract.require_capability(catalog,uid).ok,"reference-only rejects runnable binding: "+uid)
		check(catalog.texture(uid)==null,"reference PNG is outside runtime: "+uid)
	var old_root: String=catalog.resource_root
	var old_payload: String=catalog.runtime_payload_sha256
	for test_case: Dictionary in [{"root":"res://../escape","sha":expected},{"root":old_root,"sha":"0".repeat(64)},{"root":"res://missing","sha":expected}]:
		var rejected: Dictionary=catalog.load_at(test_case.root,test_case.sha)
		check(not rejected.ok and rejected.value==null and not rejected.errors.is_empty(),"invalid load has a strict failed result")
		check(catalog.resource_root==old_root and catalog.runtime_payload_sha256==old_payload and catalog.texture("art:obj.crate_wood")==first,"failed rebind preserves A root/index/texture")
	for file: String in ["resources/fonts/fusion-pixel-12px/OFL.txt","resources/fonts/fusion-pixel-12px/LICENSES/galmuri/LICENSE.txt","resources/fonts/fusion-pixel-12px/LICENSES/ark-pixel/OFL.txt","resources/fonts/fusion-pixel-12px/LICENSES/cubic-11/OFL.txt","resources/fonts/fusion-pixel-10px/OFL.txt"]:
		check(FileAccess.file_exists(old_root.path_join(file)),"upstream notice travels: "+file)
	_structured_failures(catalog,first)
	_selected_missing_failure(catalog.resource_root)
	var raw: Dictionary=Catalog._json('{"x":1,"x":2}'.to_utf8_buffer())
	check(not raw.ok,"duplicate JSON keys rejected before Dictionary collapse")
	var manifest_file: String=old_root.path_join("manifest.json")
	var manifest_bytes: PackedByteArray=FileAccess.get_file_as_bytes(manifest_file)
	var output: FileAccess=FileAccess.open(manifest_file,FileAccess.WRITE)
	output.store_buffer(manifest_bytes);output.store_string(" ");output.close()
	check(not catalog.load_at(old_root,expected).ok and catalog.texture("art:obj.crate_wood")==first,"manifest raw byte mutation rejects without clearing A")
	output=FileAccess.open(manifest_file,FileAccess.WRITE);output.store_buffer(manifest_bytes);output.close()
	check(catalog.load_at(old_root,expected).ok,"explicit valid reload restores exact package")
	check(catalog.texture("art:obj.crate_wood")!=first,"successful reload drops previous texture instance")
	_finish()

func _structured_failures(catalog: RefCounted, first: Texture2D) -> void:
	var package_root: String=catalog.resource_root
	var index_path: String=package_root.path_join("resources/catalog.json")
	var manifest_path: String=package_root.path_join("manifest.json")
	var original_index: PackedByteArray=FileAccess.get_file_as_bytes(index_path)
	var original_manifest: PackedByteArray=FileAccess.get_file_as_bytes(manifest_path)
	var binary_relative: String="resources/fonts/fusion-pixel-10px/fusion-pixel-10px-proportional-sc.woff2"
	var binary_path: String=package_root.path_join(binary_relative)
	var original_binary: PackedByteArray=FileAccess.get_file_as_bytes(binary_path)
	var include_a: String="runtime/render/terrain/fixture-a.gdshader"
	var include_b: String="runtime/render/terrain/fixture-b.gdshaderinc"
	for kind: String in ["approval","candidate","dependency","duplicate_uid","host","reference_claim","texture_path","include_depth","font_identity"]:
		var index: Dictionary=JSON.parse_string(original_index.get_string_from_utf8())
		match kind:
			"approval":index.assets[0].hash="0".repeat(64)
			"candidate":index.assets[0].approved=false
			"dependency":index.assets[0].depends=["unknown"]
			"duplicate_uid":index.assets[1].uid=index.assets[0].uid
			"host":index.host_requirements.worker_pool=0.5
			"reference_claim":
				for asset: Dictionary in index.assets:
					if asset.native.native=="reference_only":asset.native.verified=true;break
			"texture_path":index.assets[0].texture_path="../escape.png"
			"include_depth":
				_store(package_root.path_join(include_a),'shader_type canvas_item;\n#include "fixture-b.gdshaderinc"\n'.to_utf8_buffer())
				_store(package_root.path_join(include_b),'#include "missing-second-level.gdshaderinc"\n'.to_utf8_buffer())
			"font_identity":
				var changed: PackedByteArray=original_binary.duplicate();changed[0]=changed[0]^1
				_store(binary_path,changed)
				for font: Dictionary in index.fonts:
					for file: Dictionary in font.files:
						if file.path==binary_relative:file.sha256=FileAccess.get_sha256(binary_path);file.bytes=changed.size()
		var bytes: PackedByteArray=(JSON.stringify(index)+"\n").to_utf8_buffer()
		_store(index_path,bytes)
		var manifest: Dictionary=JSON.parse_string(original_manifest.get_string_from_utf8())
		if kind=="include_depth":
			for relative: String in [include_a,include_b]:
				var local: String=package_root.path_join(relative)
				manifest.files.append({"path":"addons/portitor_art/"+relative,"bytes":FileAccess.get_file_as_bytes(local).size(),"sha256":FileAccess.get_sha256(local)})
			manifest.files.sort_custom(func(a: Dictionary,b: Dictionary)->bool:return a.path<b.path)
		for file: Dictionary in manifest.files:
			if file.path=="addons/portitor_art/resources/catalog.json":file.bytes=bytes.size();file.sha256=FileAccess.get_sha256(index_path)
			if kind=="font_identity" and file.path=="addons/portitor_art/"+binary_relative:file.bytes=original_binary.size();file.sha256=FileAccess.get_sha256(binary_path)
		manifest.identity.runtime_payload_sha256=_fixture_digest(manifest.files,"portitor.art.payload-files/1")
		# A structural fixture has changed its payload. Do not borrow the real
		# archive's T8 report or let its identity mismatch mask the inner check.
		manifest.candidate_verification={"status":"pending","runtime_payload_sha256":manifest.identity.runtime_payload_sha256,"reports":[]}
		var renderer: Array=[]
		for file: Dictionary in manifest.files:
			if file.path.ends_with(".gd") or file.path.ends_with(".gdshader") or file.path.ends_with(".gdshaderinc") or file.path=="addons/portitor_art/resources/catalog.json":renderer.append(file)
		manifest.identity.renderer_sha256=_fixture_digest(renderer,"portitor.art.renderer-files/1")
		_store(manifest_path,(JSON.stringify(manifest)+"\n").to_utf8_buffer())
		var rejected: Dictionary=catalog.load_at(package_root,FileAccess.get_sha256(manifest_path))
		check(not rejected.ok and rejected.value==null and not rejected.errors.is_empty(),"valid enclosing hashes reach structural rejection: "+kind)
		if kind=="include_depth":check(str(rejected.errors).contains("source dependency"),"second-level include reaches the source closure check")
		check(catalog.texture("art:obj.crate_wood")==first and catalog.metadata("art:obj.crate_wood").approved,"structural failure preserves previous bindings: "+kind)
		_store(index_path,original_index);_store(manifest_path,original_manifest);_store(binary_path,original_binary)
		if kind=="include_depth":
			DirAccess.remove_absolute(package_root.path_join(include_a));DirAccess.remove_absolute(package_root.path_join(include_b))
	# A real byte mutation passes neither the media nor the original complete file table.
	var font_path: String=package_root.path_join("resources/fonts/fusion-pixel-10px/fusion-pixel-10px-proportional-sc.woff2")
	var font_bytes: PackedByteArray=FileAccess.get_file_as_bytes(font_path)
	_store(font_path,font_bytes.slice(0,font_bytes.size()-1))
	check(not catalog.load_at(package_root,FileAccess.get_sha256(manifest_path)).ok and catalog.texture("art:obj.crate_wood")==first,"changed raw font rejects atomically")
	_store(font_path,font_bytes)
	var foreign: String=package_root.path_join("unknown.txt")
	_store(foreign,"extra".to_utf8_buffer())
	check(not catalog.load_at(package_root,FileAccess.get_sha256(manifest_path)).ok,"unowned file in package is rejected")
	DirAccess.remove_absolute(foreign)

func _selected_missing_failure(package_root: String) -> void:
	# Probe an independent Catalog so an unexpectedly accepted bad fixture does
	# not contaminate the remaining original-package/cache assertions.
	var index_path: String=package_root.path_join("resources/catalog.json")
	var manifest_path: String=package_root.path_join("manifest.json")
	var original_index: PackedByteArray=FileAccess.get_file_as_bytes(index_path)
	var original_manifest: PackedByteArray=FileAccess.get_file_as_bytes(manifest_path)
	var source_manifest: Dictionary=JSON.parse_string(original_manifest.get_string_from_utf8())
	var control: Dictionary=_index_fixture_manifest(source_manifest,original_index)
	_store(manifest_path,(JSON.stringify(control)+"\n").to_utf8_buffer())
	var control_sha: String=FileAccess.get_sha256(manifest_path)
	var probe: RefCounted=Catalog.new()
	var loaded: Dictionary=probe.load_at(package_root,control_sha)
	check(loaded.ok,"selected-missing control accepts exact bytes with a matching pending envelope")
	if not loaded.ok:
		_store(index_path,original_index);_store(manifest_path,original_manifest);return
	var first: Texture2D=probe.texture("art:obj.crate_wood")
	var prior_payload: String=probe.runtime_payload_sha256
	var missing: Dictionary={"native":"missing","implementation_kind":"missing","evidence":[],"evidence_stage":"source_inventory","verified":false}
	check(Contract.validate(missing).ok,"query contract still permits an honest missing result")
	var index: Dictionary=JSON.parse_string(original_index.get_string_from_utf8())
	var replaced: bool=false
	for asset: Dictionary in index.assets:
		if asset.uid=="art:obj.crate_wood" and asset.native.native=="implemented":
			asset.native=missing.duplicate(true);replaced=true;break
	check(replaced,"selected-missing fixture replaces one implemented approval without changing221identities or13references")
	if replaced:
		var bytes: PackedByteArray=(JSON.stringify(index)+"\n").to_utf8_buffer()
		_store(index_path,bytes)
		var candidate: Dictionary=_index_fixture_manifest(source_manifest,bytes)
		_store(manifest_path,(JSON.stringify(candidate)+"\n").to_utf8_buffer())
		var rejected: Dictionary=probe.load_at(package_root,FileAccess.get_sha256(manifest_path))
		check(not rejected.ok and rejected.value==null and not rejected.errors.is_empty(),"selected approved asset cannot be missing with correct enclosing file/payload/renderer/manifest hashes")
		check(probe.manifest_sha256==control_sha and probe.runtime_payload_sha256==prior_payload and probe.capability("art:obj.crate_wood").native=="implemented" and probe.texture("art:obj.crate_wood")==first,"selected-missing rejection preserves the previous root/index/texture")
	_store(index_path,original_index);_store(manifest_path,original_manifest)

func _index_fixture_manifest(source: Dictionary,index_bytes: PackedByteArray) -> Dictionary:
	var manifest: Dictionary=source.duplicate(true)
	var index_hash: HashingContext=HashingContext.new();index_hash.start(HashingContext.HASH_SHA256);index_hash.update(index_bytes)
	var index_sha: String=index_hash.finish().hex_encode()
	for record: Dictionary in manifest.files:
		if record.path=="addons/portitor_art/resources/catalog.json":record.bytes=index_bytes.size();record.sha256=index_sha
	manifest.identity.runtime_payload_sha256=_fixture_digest(manifest.files,"portitor.art.payload-files/1")
	var renderer: Array=[]
	for record: Dictionary in manifest.files:
		if record.path.ends_with(".gd") or record.path.ends_with(".gdshader") or record.path.ends_with(".gdshaderinc") or record.path=="addons/portitor_art/resources/catalog.json":renderer.append(record)
	manifest.identity.renderer_sha256=_fixture_digest(renderer,"portitor.art.renderer-files/1")
	manifest.candidate_verification={"status":"pending","runtime_payload_sha256":manifest.identity.runtime_payload_sha256,"reports":[]}
	return manifest

func _store(file: String, bytes: PackedByteArray) -> void:
	var output: FileAccess=FileAccess.open(file,FileAccess.WRITE)
	output.store_buffer(bytes);output.close()
func _fixture_digest(files: Array, domain: String) -> String:
	var text: String=domain+"\n"
	for file: Dictionary in files:text+=file.path+"\t"+str(int(file.bytes))+"\t"+file.sha256+"\n"
	var hash_value: HashingContext=HashingContext.new();hash_value.start(HashingContext.HASH_SHA256);hash_value.update(text.to_utf8_buffer())
	return hash_value.finish().hex_encode()
func _finish() -> void:
	print(JSON.stringify({"suite":"godot-native-catalog","completed":true,"checks":checks,"failures":failures,"cases":results,"scope":"native source-byte Catalog regression; no GPU/PCK claim"}))
	quit(0 if failures==0 else 1)
