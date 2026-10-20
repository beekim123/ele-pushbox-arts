extends RefCounted
## Synthetic public display records; no map/spec/session/SDK or real story input.
const THEMES: Array[String]=["dungeon","ruins","cave","forest","sky","cosmos","diyu"]
const FRAME_ZERO: Array[String]=["art:item.sandbag","art:item.bomb","art:ui.emote","art:mech.ladder","art:obj.crate_wood"]
const SETTING_IDS: Array[String]=["language","lobby_skin","music","sfx","window_scale","ambience","show_grid","open_all_levels","tutorial","controls"]
static func hud() -> Dictionary:
	return {"visible":true,"id":"DEMO","title":"Demo","sand":7,"bomb":2,"sand_visible":true,"bomb_visible":true,"goals":[{"id":"a","lit":true},{"id":"b","lit":false}],"progress":"1 / 2","dragging":false,"drag_at":Vector2.ZERO,"class_icon":"","class_animation":""}
static func picture(theme: String) -> Dictionary:
	return {"theme_uid":theme,"dimensions":Vector2i(4,3),"origin":Vector2i(128,72),"visual_tiles":PackedByteArray([0,0,0,0,0,0,0,0,1,1,1,1]),"entities":[{"asset_uid":"art:char.portitor","animation":"idle","position":Vector2i(160,104)}],"tick":0}
static func ui(view: String, language: String="en", variant: String="base") -> Dictionary:
	var label: String="示例" if language=="zh-Hans" else "Demo"
	var texts: Dictionary={}
	for key: String in ["keys.select","keys.confirm","keys.play","keys.back","keys.adjust","levels.next","chapter.preview","dev.placeholder","pause.title","settings.title","rule.close","onb.menu.controls","dlg.sample.npc","dlg.sample.npc.name","dlg.sample.self","dlg.sample.note","onb.clear.found","complete.title","hint.more","hint.demo","hint.rewind","game.title","game.tagline","chapters.title","extra.controls.bomb"]:texts[key]=label
	var v: Dictionary={"tick":0,"focus":0,"runtime_error":"","placeholder":false,"reveal_speed":0.0,"reveal_all":true,"theme_uid":"art:theme.dungeon","actions":[],"frame_zero":FRAME_ZERO.duplicate()}
	var enabled: Dictionary={}
	var actions: Array[String]=[]
	if view in ["play","pause","hint","complete","rulecard","dialogue"]:v.hud=hud()
	match view:
		"lobby":
			actions=["start" if variant=="hub_start" else "continue","chapters","settings","quit"]
			v.merge({"skin":"generic" if variant in ["base","hub_start","lobby_generic"] else variant,"lobby_theme":"dungeon","coins":12,"skin_data":{"title":label,"titleEn":"DEMO","tag":label,"curTag":label,"cur":label,"coins":"12","keySelect":"↑↓","keyConfirm":"Enter","items":[{"label":label,"icon":"default"},{"label":label,"icon":"default"},{"label":label,"icon":"default"},{"label":label,"icon":"default"}]}})
			if variant in ["S1","S2","S3","S4","S5","S6"]:
				v.lobby_theme={"S1":"cave","S2":"dungeon","S3":"ruins","S4":"sky","S5":"forest","S6":"cosmos"}[variant];v.theme_uid="art:theme."+v.lobby_theme
			for i: int in 4:v.skin_data.items[i].icon=["continue","chapters","settings","quit"][i]
		"chapters":
			actions=["chapter_open"]
			v.merge({"selected":0,"cards":[{"id":"demo","theme":"art:theme.dungeon","chapter_name":label,"theme_name":label,"locked":false,"available":true,"done":1,"total":2,"progress":"1 / 2"}],"chapter_body":label})
		"levels":v.merge({"selected":0,"rows":[{"id":"demo-a","title":label,"status":"next"},{"id":"demo-b","title":label,"status":"check"}],"detail":{"available":true,"id":"demo-a","title":label,"goal":label,"picture":picture(v.theme_uid)}})
		"pause":actions=["resume","hint","restart","skip","levels","controls","settings","lobby"]
		"settings":
			v.rows=[]
			var kinds: Array[String]=["choice","choice","volume","volume","choice","choice","toggle","toggle","run","help"]
			for i: int in SETTING_IDS.size():
				var value: Variant=0.5 if kinds[i]=="volume" else false if kinds[i]=="toggle" else "demo"
				v.rows.append({"id":SETTING_IDS[i],"label":label,"icon":"","kind":kinds[i],"display":label,"value":value})
		"hint":
			actions=["hint_more"]
			v.merge({"hint_level":1,"body":label,"keyed":true,"segments":[{"text":label},{"items":[{"key":"cmd","held":true},{"sep":"plus"},{"key":"left"}]}],"speaker":Vector2(160,100)})
		"complete":
			actions=["complete_next","levels"]
			v.merge({"discovery":label,"found":variant=="clear_found"})
		"rulecard":
			actions=["rule_close"]
			v.merge({"visible":true,"body":label,"icon_uid":"art:obj.crate_wood","icon_animation":"default","illustration":true,"show_how":variant=="rulecard_how","how_units":[{"s":label},{"items":[{"key":"left"}]}]})
		"dialogue":v.actor_offset=Vector2.ZERO
		"controls":v.merge({"has_bomb":true,"rows":[{"id":"demo","label":label,"hold_items":[{"key":"cmd","held":true}],"alt_items":[{"key":"left"}]}],"secondary":[],"notes":[label]})
	for id: String in actions:
		v.actions.append({"id":id,"label":label,"key":"","icon_uid":"","animation":""});enabled[id]=true
	return {"format":"portitor.art.ui/1","view_id":view,"texts":texts,"values":v,"enabled":enabled,"device":{"kind":"keyboard_mac"}}
static func world(theme: String,tick: int=0) -> Dictionary:
	var origin: Vector2i=Vector2i(96,48)
	var floor_slots: Array[Vector2i]=[];var ceiling: Array[Vector2i]=[]
	for x: int in range(1,7):floor_slots.append(Vector2i(x,4));ceiling.append(Vector2i(x,1))
	var alive: PackedByteArray=PackedByteArray();alive.resize(40);alive.fill(1)
	return {"format":"portitor.art.world/1","tick":tick,"theme_uid":"art:theme."+theme,"viewport":Vector2i(320,180),"origin":origin,"visual_seed":401,"layout_id":"public-demo","layout_revision":1,
		"entities":[{"instance_id":"hero","asset_uid":"art:char.portitor","position":origin+Vector2i(48,64),"animation":"idle","layer":2,"flip_h":false},{"instance_id":"crate","asset_uid":"art:obj.crate_wood","position":origin+Vector2i(80,64),"animation":"default","layer":2,"flip_h":false}],
		"effects":[{"kind":"highlight","id":"demo-glow","bounds":Rect2i(origin+Vector2i(64,48),Vector2i(16,16)),"progress":0.5,"style":"goal","alpha":0.5,"stage":"overlay"}],"anchors":{"hud.goal":Rect2(230,4,16,10)},
		"geometry":{"grid_size":Vector2i(8,5),"cell_size":16,"room_bounds":Rect2i(origin,Vector2i(128,80)),"ambient_area":Rect2i(origin,Vector2i(128,80)),"floor_slots":floor_slots,"ceiling_slots":ceiling,"perch_edges":[Vector2i(6,4)],"alive_mask":alive,"exclude_room":false,"ambient_mode":"one"},
		"environment":{"mode":"full","weather":"none","area":Rect2i(0,18,320,162),"lights":[],"observe":false,"show_grid":false,"dim_steps":0}}
static func cells() -> Image:
	var image: Image=Image.create(128,80,false,Image.FORMAT_RGBA8)
	for y: int in 80:
		for x: int in 128:
			var kind: int=1 if y>=64 or x<16 or x>=112 else 4 if y>=48 and x<64 else 5 if y>=48 else 0
			image.set_pixel(x,y,Color8(kind,0,0,255))
	return image
