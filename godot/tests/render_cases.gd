extends SceneTree
const Catalog=preload("res://addons/portitor_art/api/catalog.gd")
const Contract=preload("res://addons/portitor_art/api/provider_contract.gd")
const Raster=preload("res://addons/portitor_art/runtime/render/palette_raster.gd")
const Background=preload("res://addons/portitor_art/runtime/render/themes/background.gd")
const Terrain=preload("res://addons/portitor_art/runtime/render/terrain/terrain_material.gd")
const Sprites=preload("res://addons/portitor_art/runtime/render/sprites/sprite_assets.gd")
const World=preload("res://addons/portitor_art/runtime/render/world_view.gd")
const UiView=preload("res://addons/portitor_art/runtime/ui/views/ui_view.gd")
const Widgets=preload("res://addons/portitor_art/runtime/ui/widgets.gd")
const Models=preload("res://fixtures/display_models.gd")
const Cells=preload("res://addons/portitor_art/api/visual_cells.gd")
var checks: int=0
var failures: int=0
var cases: Array[Dictionary]=[]
var before: Vector2i
var output: String
var catalog: RefCounted
var phase: String
func _initialize() -> void:call_deferred("_run")
func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok:failures+=1;printerr("CHECK FAILED: "+message)
func begin() -> void:before=Vector2i(checks,failures)
func end(id: String,scope: String,extra: Dictionary={}) -> void:
	var item: Dictionary={"id":id,"scope":"public-pck" if phase=="pck" else scope,"status":"passed" if failures==before.y else "failed","checks":checks-before.x,"failures":failures-before.y}
	item.merge(extra);cases.append(item);print(JSON.stringify({"case":item}))
func viewport(size_value: Vector2i=Vector2i(320,180)) -> SubViewport:
	var view: SubViewport=SubViewport.new();view.size=size_value;view.world_2d=World2D.new();view.disable_3d=true;view.transparent_bg=true;view.use_hdr_2d=false
	view.render_target_update_mode=SubViewport.UPDATE_ALWAYS;view.canvas_item_default_texture_filter=Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
	root.add_child(view);return view
func capture(view: SubViewport,id: String) -> Image:
	await process_frame;await process_frame;await RenderingServer.frame_post_draw
	var image: Image=view.get_texture().get_image();image.convert(Image.FORMAT_RGBA8)
	check(image.get_size()==view.size,"fixed capture dimensions: "+id)
	check(image.save_png(output.path_join(id+".png"))==OK,"save screenshot")
	var file: FileAccess=FileAccess.open(output.path_join(id+".rgba"),FileAccess.WRITE);file.store_buffer(image.get_data());file.close()
	return image
func _run() -> void:
	phase=OS.get_environment("PORTITOR_PHASE");output=OS.get_environment("PORTITOR_OUTPUT")
	begin();check(DisplayServer.get_name()!="headless","actual GPU display driver required")
	check(root.get_children().is_empty() and not FileAccess.file_exists("res://ele.gdextension"),"no game Autoload or SDK")
	catalog=Catalog.new();var loaded: Dictionary=catalog.load_at("res://addons/portitor_art",FileAccess.get_file_as_string("res://fixtures/manifest.sha256").strip_edges())
	check(loaded.ok,"actual source-byte package loads: "+str(loaded.errors));end("gpu.package","public-render")
	if failures>0:_finish();return
	await _public_reference()
	for theme: String in Models.THEMES:
		for tick: int in [0,127]:
			begin();var host: SubViewport=viewport();var world: Node2D=World.new();host.add_child(world)
			check(world.configure(catalog).ok,"world explicit provider")
			var snapshot: Dictionary=Models.world(theme,tick);check(world.set_snapshot(snapshot).ok,"synthetic world binds")
			var image: Image=Models.cells();var texture: ImageTexture=ImageTexture.create_from_image(image)
			check(world.set_visual_cells(texture,{"format":"visual_cells/1","size":image.get_size(),"origin":Vector2i.ZERO,"visible_rect":Rect2i(Vector2i.ZERO,image.get_size())}).ok,"own public cells bind")
			check(world.get_anchor("hud.goal")==Rect2(230,4,16,10),"semantic world anchor")
			var frame: Image=await capture(host,"world."+theme+"."+str(tick));check(frame.get_pixel(20,20).a8>0,"world background rendered")
			world.clear_visual_cells();host.free();end("world."+theme+"."+str(tick),"public-render")
	for language: String in ["en","zh-Hans"]:
		for view: String in ["lobby","chapters","levels","play","pause","settings","hint","complete","rulecard","dialogue","controls"]:await _ui_case(view,language,"base")
	for pair: Array in [["hub_start","lobby"],["lobby_generic","lobby"],["pause_help","pause"],["settings_help","settings"],["clear_found","complete"],["rulecard_how","rulecard"]]:await _ui_case(pair[1],"en",pair[0])
	for skin: String in ["S1","S2","S3","S4","S5","S6"]:await _ui_case("lobby","en",skin)
	await _cells_matrix()
	await _dynamic_cells()
	if phase!="pck":await _root_isolation()
	_finish()
func _public_reference() -> void:
	var reference: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://fixtures/public-reference.json"))
	begin();var sprite: RefCounted=Sprites.new(catalog)
	for value: Dictionary in reference.hashes:check(Raster.h32(int(value.x),int(value.y),int(value.seed))==int(value.value),"signed integer hash")
	for value: Dictionary in reference.frames:check(sprite.frame_at(catalog.metadata(value.uid),value.animation,int(value.tick))==int(value.frame),"approved frame oracle: "+value.uid)
	end("reference.integer-and-frames","public-js-reference")
	for value: Dictionary in reference.cases:
		begin();var diff: int=0
		if value.kind=="background":
			var raster: RefCounted=Raster.new(int(value.width),int(value.height));Background.draw(raster,catalog.metadata(value.theme_uid).params,Rect2i(0,0,int(value.width),int(value.height)),int(value.tick))
			for y: int in int(value.height):
				for x: int in int(value.width):
					if raster.get_code(x,y)!=value.rows[y][x]:diff+=1
		else:
			var size_value: Vector2i=Vector2i(int(value.width),int(value.height));var host: SubViewport=viewport(size_value)
			var rect: ColorRect=ColorRect.new();rect.size=size_value;host.add_child(rect)
			var material: ShaderMaterial=Terrain.create(catalog.metadata(value.theme_uid).params);rect.material=material
			material.set_shader_parameter("grid_size",Vector2i(8,5));material.set_shader_parameter("visual_tick",int(value.tick));material.set_shader_parameter("matter_approved",true)
			var padded: Image=Image.create(160,112,false,Image.FORMAT_RGBA8)
			for y: int in 112:
				for x: int in 160:
					var gx: int=floori(float(x-16)/16.0);var gy: int=floori(float(y-16)/16.0)
					var kind: int=int(value.grid[gy][gx]) if gx>=0 and gx<8 and gy>=0 and gy<5 else int(value.outside_material)
					padded.set_pixel(x,y,Color8(kind,0,0,255))
			var texture: ImageTexture=ImageTexture.create_from_image(padded)
			check(Terrain.bind_visual_cells(material,texture,{"format":"visual_cells/1","size":padded.get_size(),"origin":Vector2i(-16,-16),"visible_rect":Rect2i(0,0,160,112),"recipe":"tile"}).ok,"padded public terrain input")
			var image: Image=await capture(host,value.id)
			for y: int in size_value.y:
				for x: int in size_value.x:
					if image.get_pixel(x,y).to_rgba32()!=Raster.color_of(value.rows[y][x]).to_rgba32():diff+=1
			host.free()
		check(diff==0,"public JS fixed-state exact comparison: "+value.id+" diff="+str(diff));end("reference."+value.id,"public-js-reference",{"diff_pixels":diff})
func _ui_case(view: String,language: String,variant: String) -> void:
	begin();var id: String="ui."+view+"."+language+"."+variant
	var host: SubViewport=viewport();var ui: Control=UiView.new();host.add_child(ui)
	check(ui.bind_provider(catalog).ok,"UI explicit provider")
	var applied: Dictionary=ui.apply_model(Models.ui(view,language,variant));check(applied.ok,"closed UI model "+id+": "+str(applied.errors))
	if applied.ok:
		ui.set_visual_tick(0)
		var image: Image=await capture(host,id)
		check(image.get_used_rect().has_area(),"actual visible UI pixels")
		if view=="lobby":check(ui.query_element("lobby.menu.0")!=null,"actual lobby menu, including resolved skin branch")
		if view=="play":check(ui.get_semantic_anchor("hud.goal").size.x>0 and ui.query_element("hud.restart")!=null,"semantic HUD bounds")
		if view=="settings":check(ui.query_element("settings.slider.music")!=null,"semantic settings volume")
		if view in ["dialogue","hint"]:
			var reveal: Dictionary=ui.reveal_state();check(reveal.total>0,"resolved display text exists")
			ui.set_reveal_progress(mini(2,int(reveal.total)),int(reveal.total));check(ui.reveal_state().visible==mini(2,int(reveal.total)),"manual visual reveal clock")
		if variant=="clear_found":check(ui.query_element("complete.found")!=null,"embedded found content exists")
		var old_children: Array[Node]=ui.get_children();var bad: Dictionary=Models.ui(view,language,variant);bad.format="unknown/2"
		check(not ui.apply_model(bad).ok and ui.get_children()==old_children,"invalid UI preserves bound nodes")
	host.free();end(id,"public-render")
func _cells_matrix() -> void:
	begin();var host: SubViewport=viewport();var rect: ColorRect=ColorRect.new();rect.size=Vector2(304,128);host.add_child(rect)
	var material: ShaderMaterial=Terrain.create(catalog.metadata("art:theme.dungeon").params);rect.material=material
	material.set_shader_parameter("grid_size",Vector2i(19,8));material.set_shader_parameter("matter_approved",true)
	material.set_shader_parameter("fire_approved",true);material.set_shader_parameter("fire_sheet",catalog.texture("art:fx.fire"));material.set_shader_parameter("fire_frame",0)
	var image: Image=Image.create(304,128,false,Image.FORMAT_RGBA8)
	for y: int in 128:
		for x: int in 304:image.set_pixel(x,y,Color8(x/16,y/16,0,255))
	var descriptor: Dictionary={"format":"visual_cells/1","size":image.get_size(),"origin":Vector2i.ZERO,"visible_rect":Rect2i(Vector2i.ZERO,image.get_size()),"recipe":"particle"}
	check(Cells.validate_image(image,descriptor).ok,"all own classes0..18/variants0..7")
	check(Terrain.bind_visual_cells(material,ImageTexture.create_from_image(image),descriptor).ok,"matrix shader binds")
	var frame: Image=await capture(host,"cells.classes-and-variants");check(frame.get_pixel(24,8).a8==255,"matrix rock draws actual GPU pixels")
	host.free();end("cells.classes-and-variants","public-render")
func _dynamic_cells() -> void:
	begin();var host: SubViewport=viewport();var world: Node2D=World.new();host.add_child(world);world.configure(catalog)
	var snapshot: Dictionary=Models.world("dungeon");snapshot.entities=[];snapshot.effects=[];snapshot.environment.mode="off"
	check(world.set_snapshot(snapshot).ok,"dynamic synthetic world")
	var image: Image=Models.cells();var texture: ImageTexture=ImageTexture.create_from_image(image)
	var descriptor: Dictionary={"format":"visual_cells/1","size":image.get_size(),"origin":Vector2i.ZERO,"visible_rect":Rect2i(Vector2i.ZERO,image.get_size())}
	check(world.set_visual_cells(texture,descriptor).ok,"first explicit cells")
	var first: Image=await capture(host,"cells.dynamic.before")
	image.set_pixel(30,30,Color8(1,0,0,255));texture.update(image)
	check(world.set_visual_cells(texture,descriptor).ok,"same texture object updates at same visual tick")
	var second: Image=await capture(host,"cells.dynamic.after")
	check(first.get_pixel(126,78)!=second.get_pixel(126,78),"updated visual pixel reaches GPU")
	world.clear_visual_cells();check(world.set_snapshot(Models.world("forest")).ok,"clear before texture owner disposal then theme rebind")
	host.free();end("cells.dynamic-lifecycle","public-render")
func _root_isolation() -> void:
	begin();var prefix: String="res://instances/b";var manifest: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://addons/portitor_art/manifest.json"))
	DirAccess.make_dir_recursive_absolute(prefix)
	for file: Dictionary in manifest.files:
		var relative: String=file.path.trim_prefix("addons/portitor_art/");var target: String=prefix.path_join(relative)
		DirAccess.make_dir_recursive_absolute(target.get_base_dir());var output_file: FileAccess=FileAccess.open(target,FileAccess.WRITE);output_file.store_buffer(FileAccess.get_file_as_bytes("res://"+file.path));output_file.close()
	var manifest_path: String=prefix.path_join("manifest.json");var copy: FileAccess=FileAccess.open(manifest_path,FileAccess.WRITE);copy.store_buffer(FileAccess.get_file_as_bytes("res://addons/portitor_art/manifest.json"));copy.close()
	var b: RefCounted=Catalog.new();check(b.load_at(prefix,FileAccess.get_sha256(manifest_path)).ok,"one trusted Catalog class loads independent raw root B without loading copied script classes")
	check(b.metadata("art:obj.crate_wood").texture_path.begins_with(prefix) and b.texture("art:obj.crate_wood")!=catalog.texture("art:obj.crate_wood"),"texture/root caches are instance-owned")
	var wa: RefCounted=Widgets.new();var wb: RefCounted=Widgets.new();check(wa.configure(catalog).ok and wb.configure(b).ok and wa.font()!=wb.font(),"font roots/caches are distinct")
	var old: Texture2D=b.texture("art:obj.crate_wood");check(not b.load_at("res://missing","0".repeat(64)).ok and b.texture("art:obj.crate_wood")==old,"failed B rebind preserves B and A")
	end("catalog.root-cache-isolation","public-render")
func _finish() -> void:
	var result: Dictionary={"suite":"native-art-render","completed":true,"checks":checks,"failures":failures,"cases":cases,"display_driver":DisplayServer.get_name(),"phase":phase}
	print(JSON.stringify(result));quit(0 if failures==0 else 1)
