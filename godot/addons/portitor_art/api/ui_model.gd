class_name PortitorArtUiModel
extends RefCounted
## Closed per-view display records. No application owner, rules, map parser, or command DSL.
const Contract = preload("provider_contract.gd")
const FORMAT: String = "portitor.art.ui/1"
const VIEWS: Array[String] = ["lobby","chapters","levels","play","pause","settings","hint","complete","rulecard","dialogue","controls"]
const COMMON: Dictionary = {"tick":TYPE_INT,"focus":TYPE_INT,"runtime_error":TYPE_STRING,"placeholder":TYPE_BOOL,"reveal_speed":TYPE_FLOAT,"reveal_all":TYPE_BOOL,"theme_uid":TYPE_STRING,"actions":TYPE_ARRAY,"frame_zero":TYPE_ARRAY}
const EXTRA: Dictionary = {
	"lobby":{"skin":TYPE_STRING,"lobby_theme":TYPE_STRING,"coins":TYPE_INT,"skin_data":TYPE_DICTIONARY},
	"chapters":{"selected":TYPE_INT,"cards":TYPE_ARRAY,"chapter_body":TYPE_STRING},
	"levels":{"selected":TYPE_INT,"rows":TYPE_ARRAY,"detail":TYPE_DICTIONARY},
	"play":{"hud":TYPE_DICTIONARY},"pause":{"hud":TYPE_DICTIONARY},
	"settings":{"rows":TYPE_ARRAY},
	"hint":{"hud":TYPE_DICTIONARY,"hint_level":TYPE_INT,"body":TYPE_STRING,"keyed":TYPE_BOOL,"segments":TYPE_ARRAY,"speaker":TYPE_VECTOR2},
	"complete":{"hud":TYPE_DICTIONARY,"discovery":TYPE_STRING,"found":TYPE_BOOL},
	"rulecard":{"hud":TYPE_DICTIONARY,"visible":TYPE_BOOL,"body":TYPE_STRING,"icon_uid":TYPE_STRING,"icon_animation":TYPE_STRING,"illustration":TYPE_BOOL,"show_how":TYPE_BOOL,"how_units":TYPE_ARRAY},
	"dialogue":{"hud":TYPE_DICTIONARY,"actor_offset":TYPE_VECTOR2},
	"controls":{"has_bomb":TYPE_BOOL,"rows":TYPE_ARRAY,"secondary":TYPE_ARRAY,"notes":TYPE_ARRAY}}
const ACTION: Dictionary = {"id":TYPE_STRING,"label":TYPE_STRING,"key":TYPE_STRING,"icon_uid":TYPE_STRING,"animation":TYPE_STRING}
const HUD: Dictionary = {"visible":TYPE_BOOL,"id":TYPE_STRING,"title":TYPE_STRING,"sand":TYPE_INT,"bomb":TYPE_INT,"sand_visible":TYPE_BOOL,"bomb_visible":TYPE_BOOL,"goals":TYPE_ARRAY,"progress":TYPE_STRING,"dragging":TYPE_BOOL,"drag_at":TYPE_VECTOR2,"class_icon":TYPE_STRING,"class_animation":TYPE_STRING}
static func validate(value: Dictionary) -> Dictionary:
	var errors: Array[String] = Contract.fields(value,{"format":TYPE_STRING,"view_id":TYPE_STRING,"texts":TYPE_DICTIONARY,"values":TYPE_DICTIONARY,"enabled":TYPE_DICTIONARY,"device":TYPE_DICTIONARY},{},"ui")
	if not errors.is_empty():return Contract.result(errors)
	if value.format!=FORMAT or value.view_id not in VIEWS:return Contract.result(["unsupported UI schema or view capability"])
	errors.append_array(_map(value.texts,TYPE_STRING,"texts"))
	errors.append_array(_map(value.enabled,TYPE_BOOL,"enabled"))
	errors.append_array(Contract.fields(value.device,{"kind":TYPE_STRING},{},"device"))
	if value.device.get("kind") not in ["keyboard_mac","keyboard_pc","mouse"]:errors.append("unknown device")
	var fields: Dictionary=COMMON.duplicate();fields.merge(EXTRA[value.view_id])
	errors.append_array(Contract.fields(value.values,fields,{},"ui.values"))
	if not errors.is_empty():return Contract.result(errors)
	var v: Dictionary=value.values
	if v.tick<0 or v.focus<0 or not is_finite(v.reveal_speed) or v.reveal_speed<0 or not Contract.is_art_uid(v.theme_uid):errors.append("invalid UI tick/focus/speed/theme")
	errors.append_array(_rows(v.actions,ACTION,"actions"))
	for uid: Variant in v.frame_zero:
		if not Contract.is_art_uid(uid):errors.append("invalid explicit frame-zero uid")
	var ids: Array[String]=[]
	for row: Variant in v.actions:
		if row is Dictionary and row.get("id") is String:ids.append(row.id)
	for key: Variant in value.enabled:
		if key not in ids:errors.append("enabled key has no declared action")
	if v.has("hud"):
		errors.append_array(Contract.fields(v.hud,HUD,{},"hud"))
		if errors.is_empty():
			errors.append_array(_rows(v.hud.goals,{"id":TYPE_STRING,"lit":TYPE_BOOL},"goals"))
			if v.hud.sand<0 or v.hud.bomb<0:errors.append("negative HUD count")
	match value.view_id:
		"lobby":
			var skin: Dictionary={"title":TYPE_STRING,"titleEn":TYPE_STRING,"tag":TYPE_STRING,"curTag":TYPE_STRING,"cur":TYPE_STRING,"coins":TYPE_STRING,"keySelect":TYPE_STRING,"keyConfirm":TYPE_STRING,"items":TYPE_ARRAY}
			errors.append_array(Contract.fields(v.skin_data,skin,{},"skin"))
			if v.skin_data.get("items") is Array:
				for item: Variant in v.skin_data.items:
					if item is Dictionary:errors.append_array(Contract.fields(item,{"label":TYPE_STRING,"icon":TYPE_STRING},{"detail":TYPE_STRING},"skin.item"))
					else:errors.append("invalid skin item")
			if v.skin not in ["generic","S1","S2","S3","S4","S5","S6"] or v.coins<0:errors.append("invalid lobby display")
		"chapters":
			errors.append_array(_rows(v.cards,{"id":TYPE_STRING,"theme":TYPE_STRING,"chapter_name":TYPE_STRING,"theme_name":TYPE_STRING,"locked":TYPE_BOOL,"available":TYPE_BOOL,"done":TYPE_INT,"total":TYPE_INT,"progress":TYPE_STRING},"cards"))
			if v.cards.is_empty() or v.selected<0 or v.selected>=v.cards.size():errors.append("invalid chapter selection")
		"levels":
			errors.append_array(_rows(v.rows,{"id":TYPE_STRING,"title":TYPE_STRING,"status":TYPE_STRING},"level.rows"))
			errors.append_array(Contract.fields(v.detail,{"available":TYPE_BOOL,"id":TYPE_STRING,"title":TYPE_STRING,"goal":TYPE_STRING,"picture":TYPE_DICTIONARY},{},"detail"))
			if v.detail.get("picture") is Dictionary:errors.append_array(_picture(v.detail.picture))
			if v.selected<0 or (not v.rows.is_empty() and v.selected>=v.rows.size()):errors.append("invalid level selection")
			for row: Variant in v.rows:
				if row is Dictionary and row.get("status") not in ["next","check","skip","open"]:errors.append("unknown level status")
		"settings":
			for row: Variant in v.rows:
				if not row is Dictionary:errors.append("invalid settings row");continue
				errors.append_array(Contract.fields(row,{"id":TYPE_STRING,"label":TYPE_STRING,"icon":TYPE_STRING,"kind":TYPE_STRING,"display":TYPE_STRING},{"value":typeof(row.get("value"))},"settings.row"))
				if row.get("id") not in ["language","lobby_skin","music","sfx","window_scale","ambience","show_grid","open_all_levels","tutorial","controls"] or row.get("kind") not in ["volume","toggle","choice","run","help"] or not _scalar(row.get("value")):errors.append("unknown setting display")
			if v.rows.size()!=10:errors.append("settings requires ten declared rows")
		"hint":
			if v.hint_level not in [1,2,3]:errors.append("invalid hint display level")
			errors.append_array(_segments(v.segments))
		"rulecard":
			for unit: Variant in v.how_units:
				if not unit is Dictionary:errors.append("invalid how unit")
				elif unit.has("items"):
					errors.append_array(Contract.fields(unit,{"items":TYPE_ARRAY},{},"how.unit"))
					if unit.items is Array:errors.append_array(_items(unit.items))
				else:errors.append_array(Contract.fields(unit,{"s":TYPE_STRING},{},"how.unit"))
		"controls":
			for rows: Array in [v.rows,v.secondary]:
				errors.append_array(_rows(rows,{"id":TYPE_STRING,"label":TYPE_STRING,"hold_items":TYPE_ARRAY,"alt_items":TYPE_ARRAY},"controls.rows"))
				for row: Variant in rows:
					if row is Dictionary and row.get("hold_items") is Array and row.get("alt_items") is Array:
						errors.append_array(_items(row.hold_items));errors.append_array(_items(row.alt_items))
			for note: Variant in v.notes:
				if not note is String:errors.append("notes require resolved String")
	var action_ids: Array[String]=[]
	for row: Variant in v.actions:
		if row is Dictionary and row.get("id") is String:action_ids.append(row.id)
	var expected: Array=[]
	match value.view_id:
		"lobby":
			expected=["start" if action_ids.has("start") else "continue","chapters","settings","quit"]
			if v.skin_data.get("items") is Array and v.skin_data.items.size()!=4:errors.append("lobby requires four skin rows")
		"chapters":expected=["chapter_open"]
		"pause":expected=["resume","hint","restart","skip","levels","controls","settings","lobby"]
		"hint":expected=["hint_more"] if v.hint_level<3 else ["hint_demo","hint_rewind"] if action_ids.has("hint_demo") else ["hint_rewind"]
		"complete":expected=["complete_next","levels"]
		"rulecard":expected=["rule_close"]
	if action_ids!=expected or value.enabled.size()!=action_ids.size():errors.append("view actions must match its declared finite action set")
	if value.view_id=="settings":
		var setting_ids: Array[String]=["language","lobby_skin","music","sfx","window_scale","ambience","show_grid","open_all_levels","tutorial","controls"]
		var kinds: Array[String]=["choice","choice","volume","volume","choice","choice","toggle","toggle","run","help"]
		for index: int in mini(v.rows.size(),setting_ids.size()):
			var row: Variant=v.rows[index]
			if not row is Dictionary:continue
			if row.get("id")!=setting_ids[index] or row.get("kind")!=kinds[index]:errors.append("settings identities/kinds must retain canonical order")
			var item: Variant=row.get("value")
			if kinds[index]=="volume":
				if not (item is float or item is int) or not is_finite(float(item)) or float(item)<0 or float(item)>1:errors.append("volume display must be finite in 0..1")
			elif kinds[index]=="toggle":
				if not item is bool:errors.append("toggle display must be bool")
			elif not item is String:errors.append("choice/run/help display must be String")
	if value.view_id=="levels" and v.detail.get("available",false) and v.detail.get("picture") is Dictionary:
		var dimensions: Variant=v.detail.picture.get("dimensions")
		if not dimensions is Vector2i or dimensions.x<=0 or dimensions.y<=0:errors.append("available level picture requires nonempty visual geometry")
	if not _finite(value):errors.append("UI display contains invalid or nonfinite data")
	return Contract.result(errors,value)
static func _picture(v: Dictionary) -> Array[String]:
	var errors: Array[String]=Contract.fields(v,{"theme_uid":TYPE_STRING,"dimensions":TYPE_VECTOR2I,"origin":TYPE_VECTOR2I,"visual_tiles":TYPE_PACKED_BYTE_ARRAY,"entities":TYPE_ARRAY,"tick":TYPE_INT},{},"picture")
	if not errors.is_empty():return errors
	if v.dimensions.x<0 or v.dimensions.y<0 or v.dimensions.x>512 or v.dimensions.y>512 or v.visual_tiles.size()!=v.dimensions.x*v.dimensions.y or v.tick<0:errors.append("invalid picture geometry")
	for cell: int in v.visual_tiles:
		if cell>18:errors.append("unknown visual tile")
	for entity: Variant in v.entities:
		if not entity is Dictionary:errors.append("invalid picture entity")
		else:errors.append_array(Contract.fields(entity,{"asset_uid":TYPE_STRING,"animation":TYPE_STRING,"position":TYPE_VECTOR2I},{},"picture.entity"))
	return errors
static func _rows(rows: Array, fields: Dictionary, path: String) -> Array[String]:
	var errors: Array[String]=[]
	var ids: Dictionary={}
	for row: Variant in rows:
		if not row is Dictionary:errors.append(path+": invalid record");continue
		errors.append_array(Contract.fields(row,fields,{},path))
		if not row.get("id") is String or row.id.is_empty() or ids.has(row.id):errors.append(path+": missing/duplicate identity")
		else:ids[row.id]=true
	return errors
static func _items(items: Array) -> Array[String]:
	var errors: Array[String]=[]
	for item: Variant in items:
		if not item is Dictionary:errors.append("invalid key item");continue
		var kinds: Array[String]=[]
		for key: String in ["key","sep","icon","hud"]:
			if item.has(key):kinds.append(key)
		if kinds.size()!=1:errors.append("unresolved key item");continue
		errors.append_array(Contract.fields(item,{kinds[0]:TYPE_STRING},{"held":TYPE_BOOL} if kinds[0]=="key" else {},"key item"))
	return errors
static func _segments(parts: Array) -> Array[String]:
	var errors: Array[String]=[]
	for part: Variant in parts:
		if not part is Dictionary:errors.append("invalid segment")
		elif part.has("items"):
			errors.append_array(Contract.fields(part,{"items":TYPE_ARRAY},{},"segment"))
			if part.items is Array:errors.append_array(_items(part.items))
		else:errors.append_array(Contract.fields(part,{"text":TYPE_STRING},{},"segment"))
	return errors
static func _map(v: Dictionary, kind: int, path: String) -> Array[String]:
	var errors: Array[String]=[]
	for key: Variant in v:
		if not (key is String or key is StringName) or str(key).is_empty() or typeof(v[key])!=kind:errors.append(path+": invalid key/value")
	return errors
static func _scalar(v: Variant) -> bool:
	return v is String or v is bool or v is int or v is float and is_finite(v)
static func _finite(v: Variant, depth: int=0) -> bool:
	if depth>16:return false
	if _scalar(v) or v is Vector2i or v is PackedByteArray:return true
	if v is Vector2:return is_finite(v.x) and is_finite(v.y)
	if v is Array:
		for item: Variant in v:
			if not _finite(item,depth+1):return false
		return true
	if v is Dictionary:
		for key: Variant in v:
			if not (key is String or key is StringName) or not _finite(v[key],depth+1):return false
		return true
	return false

static func validate_hud(value: Dictionary) -> Dictionary:
	var errors: Array[String]=Contract.fields(value,HUD,{},"hud")
	if not errors.is_empty():return Contract.result(errors)
	errors.append_array(_rows(value.goals,{"id":TYPE_STRING,"lit":TYPE_BOOL},"hud.goals"))
	if value.sand<0 or value.bomb<0 or not _finite(value):errors.append("invalid HUD display values")
	return Contract.result(errors,value)
