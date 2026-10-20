extends SceneTree
const Catalog=preload("res://addons/portitor_art/api/catalog.gd")
const Contract=preload("res://addons/portitor_art/api/provider_contract.gd")
const WorldSchema=preload("res://addons/portitor_art/api/world_snapshot.gd")
const UiSchema=preload("res://addons/portitor_art/api/ui_model.gd")
const Cells=preload("res://addons/portitor_art/api/visual_cells.gd")
const Widgets=preload("res://addons/portitor_art/runtime/ui/widgets.gd")
const UiView=preload("res://addons/portitor_art/runtime/ui/views/ui_view.gd")
const Models=preload("res://fixtures/display_models.gd")
var checks: int=0
var failures: int=0
var cases: Array[Dictionary]=[]
var _before: Vector2i
class Denied extends RefCounted:
	var base: RefCounted
	var uid: String
	var resource_root: String
	func metadata(key: String) -> Dictionary:return base.metadata(key)
	func texture(key: String) -> Texture2D:return base.texture(key)
	func capability(key: String) -> Dictionary:
		return {"native":"reference_only","implementation_kind":"reference","evidence":["R-U"],"evidence_stage":"source_inventory","verified":false} if key==uid else base.capability(key)
func _initialize() -> void:call_deferred("_run")
func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok:failures+=1;printerr("CHECK FAILED: "+message)
func begin() -> void:_before=Vector2i(checks,failures)
func end(id: String) -> void:
	var item: Dictionary={"id":id,"scope":"public-contracts","status":"passed" if failures==_before.y else "failed","checks":checks-_before.x,"failures":failures-_before.y}
	cases.append(item);print(JSON.stringify({"case":item}))
func _run() -> void:
	begin();check(root.get_children().is_empty(),"zero game Autoloads")
	var catalog: RefCounted=Catalog.new()
	var loaded: Dictionary=catalog.load_at("res://addons/portitor_art",FileAccess.get_file_as_string("res://fixtures/manifest.sha256").strip_edges())
	check(loaded.ok,"actual ZIP Catalog: "+str(loaded.errors));end("contracts.actual-package")
	if not loaded.ok:_finish();return
	begin()
	for theme: String in Models.THEMES:check(Contract.require_capability(catalog,"art:theme."+theme,"theme").ok,"implemented theme: "+theme)
	for uid: String in ["art:theme.candy","art:theme.jeju","art:theme.polar","art:ui.screen.confirm","art:ui.screen.delivery_hud","art:ui.screen.delivery_pause","art:ui.screen.hint_animal","art:ui.screen.hud_keys","art:ui.screen.observe","art:ui.screen.reels","art:ui.screen.settlement","art:ui.screen.settlement_fail","art:ui.screen.shop"]:
		check(catalog.capability(uid).native=="reference_only" and not Contract.require_capability(catalog,uid).ok,"reference refuses binding: "+uid)
	check(not catalog.capability("art:theme.dungeon").verified,"technical receipt does not rewrite static inventory");end("contracts.capabilities")
	begin()
	var identity: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://addons/portitor_art/manifest.json")).identity
	var record: Dictionary={"report_path":"godot/verification/synthetic-schema.json","report_sha256":"d".repeat(64),"tested_producer_commit":"1".repeat(40),"tested_manifest_sha256":"e".repeat(64),"runtime_payload_sha256":identity.runtime_payload_sha256,"renderer_sha256":identity.renderer_sha256,"approved_identity_sha256":identity.approved_identity_sha256,"verifier_commit":"2".repeat(40),"fixture_sha256":"f".repeat(64),"godot":"4.7.2.stable.official.ed1daf0bf","platform":"macos-arm64","backend":"gl_compatibility","scope":["public-contracts"],"completed":true,"failures":0,"case_ids":["synthetic.schema"]}
	var envelope: Dictionary={"status":"recorded","runtime_payload_sha256":identity.runtime_payload_sha256,"reports":[record]}
	check(Catalog._verification(envelope,identity).ok,"finite synthetic recorded header accepts without claiming an actual technical result")
	for key: String in ["tested_manifest_sha256","fixture_sha256","tested_producer_commit","verifier_commit"]:
		var bad_receipt: Dictionary=envelope.duplicate(true);bad_receipt.reports[0][key]=[record[key]]
		check(not Catalog._verification(bad_receipt,identity).ok,"Godot rejects coercible array field: "+key)
	var functional: Dictionary=envelope.duplicate(true);functional.reports[0].host_requirements={"viewport":[1,1]}
	check(not Catalog._verification(functional,identity).ok,"technical header cannot carry functional host overrides");end("contracts.report-envelope")
	begin()
	for view: String in ["lobby","chapters","levels","play","pause","settings","hint","complete","rulecard","dialogue","controls"]:
		var checked: Dictionary=UiSchema.validate(Models.ui(view));check(checked.ok,"synthetic closed UI "+view+": "+str(checked.errors))
	var world: Dictionary=Models.world("dungeon");check(WorldSchema.validate(world).ok,"synthetic resolved world")
	var invalid: Dictionary=world.duplicate(true);invalid.format="unknown/1";check(not WorldSchema.validate(invalid).ok,"unknown world schema")
	invalid=world.duplicate(true);invalid["session"]=RefCounted.new();check(not WorldSchema.validate(invalid).ok,"live owner rejected")
	var model: Dictionary=Models.ui("play");var before: Dictionary=model.duplicate(true)
	model.values.hud.sand=-1;check(not UiSchema.validate(model).ok,"negative display count");model=before
	var image: Image=Models.cells();var descriptor: Dictionary={"format":"visual_cells/1","size":Vector2i(128,80),"origin":Vector2i.ZERO,"visible_rect":Rect2i(0,0,128,80)}
	check(Cells.validate_image(image,descriptor).ok,"own visual cells accepted")
	image.set_pixel(1,1,Color8(19,0,0,255));check(not Cells.validate_image(image,descriptor).ok,"unknown visual class rejected");end("contracts.display-schemas")
	begin()
	var widget: RefCounted=Widgets.new();check(widget.configure(catalog).ok,"frozen font configure")
	for small: bool in [false,true]:
		var face: FontVariation=widget.font(small);var font: FontFile=face.base_font
		check(font.antialiasing==TextServer.FONT_ANTIALIASING_NONE and font.hinting==TextServer.HINTING_NONE and font.subpixel_positioning==TextServer.SUBPIXEL_POSITIONING_DISABLED and not font.multichannel_signed_distance_field,"actual font pixel attributes")
		check(face.spacing_top==-2 and face.spacing_bottom==(-2 if small else 0),"original spacing")
		check(font.msdf_pixel_range==8 and font.msdf_size==48 and font.disable_embedded_bitmaps and not font.generate_mipmaps and font.allow_system_fallback and not font.force_autohinter and font.keep_rounding_remainders and font.oversampling==0.0,"all frozen font construction attributes")
		check(widget.g2_font(small).opentype_features=={"kern":0},"G2 kerning remains explicit")
		check(font.has_char(68) and face.get_string_size("Demo",HORIZONTAL_ALIGNMENT_LEFT,-1,10 if small else 12).x>0,"frozen face supplies Latin display glyphs and positive metrics")
	var other: RefCounted=Widgets.new();check(other.configure(catalog).ok and widget.font()!=other.font(),"configured instances do not share FontVariation cache");end("contracts.font-attributes")
	begin()
	var ui: Control=UiView.new();root.add_child(ui);check(ui.bind_provider(catalog).ok,"explicit UI provider")
	var play: Dictionary=Models.ui("play");check(ui.apply_model(play).ok,"synthetic HUD constructs")
	await process_frame
	var previous: Array[Node]=ui.get_children();var bad: Dictionary=play.duplicate(true);bad.values["owner"]=RefCounted.new()
	check(not ui.apply_model(bad).ok and ui.get_children()==previous,"failed model preserves children")
	var signals: Array[Dictionary]=[];ui.intent_requested.connect(func(id: String,payload: Dictionary)->void:signals.append({"id":id,"payload":payload.duplicate(true)}))
	var restart: Button=ui.query_element("hud.restart") as Button
	check(restart!=null,"semantic restart control")
	if restart!=null:restart.pressed.emit()
	check(signals.size()==1 and signals[0].id=="restart" and root.get_node_or_null("Save")==null,"intent emitted without a game controller or Save")
	check(ui.get_semantic_anchor("hud.goal").size.x>0,"HUD semantic goal bounds")
	ui.free();end("contracts.ui-intents-atomicity")
	for pair: Array in [["hub_start","lobby"],["lobby_generic","lobby"],["pause_help","pause"],["settings_help","settings"],["clear_found","complete"],["rulecard_how","rulecard"]]:
		begin();var denied: RefCounted=Denied.new();denied.base=catalog;denied.uid="art:ui.screen."+pair[0];denied.resource_root=catalog.resource_root
		var view: Control=UiView.new();root.add_child(view);check(view.bind_provider(denied).ok,"denial wrapper is an actual provider")
		var checked: Dictionary=view.apply_model(Models.ui(pair[1],"en",pair[0]));check(not checked.ok and view.get_child_count()==0,"embedded branch refuses missing capability: "+pair[0]);view.free();end("contracts.embedded-denial."+pair[0])
	_finish()
func _finish() -> void:
	var result: Dictionary={"suite":"native-art-contracts","completed":true,"checks":checks,"failures":failures,"cases":cases}
	print(JSON.stringify(result));quit(0 if failures==0 else 1)
