extends Control
## Installed ZIP only: stage this demo through tools/verify-godot-pack.mjs.
const Catalog=preload("res://addons/portitor_art/api/catalog.gd")
const View=preload("res://addons/portitor_art/runtime/ui/views/ui_view.gd")
const Models=preload("res://fixtures/display_models.gd")
func _ready() -> void:
	var catalog: RefCounted=Catalog.new()
	var expected: String=FileAccess.get_file_as_string("res://fixtures/manifest.sha256").strip_edges()
	var checked: Dictionary=catalog.load_at("res://addons/portitor_art",expected)
	if not checked.ok:push_error(str(checked.errors));return
	var view: Control=View.new();add_child(view)
	view.bind_provider(catalog)
	view.intent_requested.connect(func(id: String,payload: Dictionary)->void:print(JSON.stringify({"intent":id,"payload":payload})))
	view.apply_model(Models.ui("lobby","en","hub_start"))
