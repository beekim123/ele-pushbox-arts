@tool
extends EditorExportPlugin
## Producer demo tool, excluded from runtime ZIP and exported PCK.
var _allowed: Dictionary={}
func _get_name() -> String:return "000PortitorArtRaw"
func _export_begin(_features: PackedStringArray,_debug: bool,_path: String,_flags: int) -> void:
	_allowed.clear()
	var manifest_path: String="res://addons/portitor_art/manifest.json"
	var expected: String=FileAccess.get_file_as_string("res://fixtures/manifest.sha256").strip_edges()
	if FileAccess.get_sha256(manifest_path)!=expected:push_error("raw export manifest identity mismatch");return
	var manifest: Dictionary=JSON.parse_string(FileAccess.get_file_as_string(manifest_path))
	_allowed[manifest_path]=expected
	for file: Dictionary in manifest.files:_allowed["res://"+file.path]=file.sha256
	for file: String in _allowed:
		if FileAccess.get_sha256(file)!=_allowed[file]:_allowed.clear();push_error("raw export changed source: "+file);return
	for file: String in _allowed:
		add_file(file,FileAccess.get_file_as_bytes(file),false)
func _export_file(file: String,_type: String,_features: PackedStringArray) -> void:
	if _allowed.has(file):skip()
	elif file.begins_with("res://addons/portitor_art/") and (file.ends_with(".import") or file.ends_with(".uid")):skip()
