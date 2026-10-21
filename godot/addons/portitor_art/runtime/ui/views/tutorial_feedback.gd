class_name PortitorArtTutorialFeedback
extends Control
## Finite tutorial key-strip/interaction display; policy, timing and recognition stay private.
const Contract=preload("../../../api/provider_contract.gd")
var _keys: Control
var _key_control: Control
func configure_strip(widgets: RefCounted, model: Dictionary) -> Dictionary:
	var errors: Array[String]=Contract.fields(model,{"area":TYPE_RECT2,"plate":TYPE_BOOL,"alpha":TYPE_FLOAT,"blink_alpha":TYPE_FLOAT,"parts":TYPE_ARRAY},{},"tutorial strip")
	if not errors.is_empty():return Contract.result(errors)
	if widgets==null or not widgets.is_configured() or not _geometry(model.area) or model.parts.size()>16 or not is_finite(model.alpha) or not is_finite(model.blink_alpha) or model.alpha<0 or model.alpha>1 or model.blink_alpha<0 or model.blink_alpha>1:return Contract.result(["invalid tutorial display/widgets"])
	for part: Variant in model.parts:
		if not part is Dictionary:return Contract.result(["invalid tutorial part"])
		errors.append_array(Contract.fields(part,{"prefix":TYPE_ARRAY,"arrows":TYPE_ARRAY,"prefix_width":TYPE_INT,"arrow_width":TYPE_INT,"held":TYPE_BOOL},{},"tutorial part"))
		if not errors.is_empty():return Contract.result(errors)
		if part.prefix_width<0 or part.arrow_width<0 or part.prefix_width>320 or part.arrow_width>320:return Contract.result(["invalid tutorial part width"])
		for segments: Array in [part.prefix,part.arrows]:
			var typed: Array[Dictionary]=[]
			for segment: Variant in segments:
				if not segment is Dictionary:return Contract.result(["invalid tutorial segments"])
				typed.append(segment)
			var ready: Dictionary=widgets.keycaps.validate_segments(typed)
			if not ready.ok:return ready
	for child: Node in get_children():remove_child(child);child.queue_free()
	mouse_filter=Control.MOUSE_FILTER_IGNORE;modulate.a=model.alpha
	if model.plate:widgets.plate(self,model.area)
	_keys=Control.new();_keys.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(_keys)
	_key_control=_keys
	var x: float=model.area.position.x+4
	for part: Dictionary in model.parts:
		if not part.prefix.is_empty():
			if part.held:widgets.box(_keys,Rect2(x,model.area.position.y+2,part.prefix_width,14),{"r":1,"rings":["m"],"fill":"x"})
			_draw_segments(widgets,_keys,Vector2(x+3,model.area.position.y+3+(1 if part.held else 0)),part.prefix,part.prefix_width-4)
			x+=int(part.prefix_width)
		if not part.arrows.is_empty():
			var directions: Control=_draw_segments(widgets,_keys,Vector2(x+2,model.area.position.y+3),part.arrows,part.arrow_width)
			directions.modulate.a=model.blink_alpha;x+=int(part.arrow_width)
		x+=4
	return Contract.result([])
func configure_interaction(widgets: RefCounted, area: Rect2, compact: bool, segments: Array, plate: bool) -> Dictionary:
	if widgets==null or not widgets.is_configured() or not _geometry(area):return Contract.result(["invalid interaction display/widgets"])
	var typed: Array[Dictionary]=[]
	for segment: Variant in segments:
		if not segment is Dictionary:return Contract.result(["invalid interaction segment"])
		typed.append(segment)
	var checked: Dictionary=widgets.keycaps.validate_segments(typed)
	if not checked.ok:return checked
	for child: Node in get_children():remove_child(child);child.queue_free()
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	_keys=Control.new();_keys.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(_keys)
	_key_control=_keys
	if compact:
		widgets.keycap(_keys,area.position,"up")
		_key_control=_keys.get_child(0) as Control
	else:
		if plate:widgets.plate(self,area)
		_draw_segments(widgets,_keys,area.position+Vector2(6,4),typed,int(area.size.x)-10)
	return Contract.result([])
func _draw_segments(widgets: RefCounted,parent: Node,at: Vector2,segments: Array,room: int) -> Control:
	var typed: Array[Dictionary]=[]
	for segment: Dictionary in segments:
		var normalized: Dictionary=segment.duplicate(true)
		if normalized.has("items"):
			var items: Array[Dictionary]=[]
			for item: Dictionary in normalized.items:items.append(item)
			normalized.items=items
		typed.append(normalized)
	return widgets.device_segments(parent,at,typed,room)
func query_element(id: String) -> Control:
	return _key_control if id=="tutorial.keys" and is_instance_valid(_key_control) else null
static func place(anchor: Vector2,dimensions: Vector2,protected: Array[Rect2]) -> Rect2:
	var choices: Array[Vector2]=[anchor-Vector2(dimensions.x/2,dimensions.y+8),anchor+Vector2(-dimensions.x/2,24),anchor+Vector2(20,0),anchor-Vector2(dimensions.x+20,0)]
	for point: Vector2 in choices:
		var area:=Rect2(Vector2(clampf(point.x,3,317-dimensions.x),clampf(point.y,22,178-dimensions.y)),dimensions)
		if not protected.any(func(box: Rect2)->bool:return box.intersects(area)):return area
	return Rect2(Vector2(clampf(anchor.x-dimensions.x/2,3,317-dimensions.x),22),dimensions)
static func draw_glows(canvas: CanvasItem,undo: Rect2,hint: Rect2,undo_alpha: float,hint_alpha: float) -> void:
	if undo.has_area() and undo_alpha>0:canvas.draw_rect(undo.grow(1),Color(1,1,1,undo_alpha),false,1)
	if hint.has_area() and hint_alpha>0:canvas.draw_rect(hint.grow(1),Color(0.388,0.78,0.302,hint_alpha),false,1)

static func _geometry(area: Rect2) -> bool:
	return is_finite(area.position.x) and is_finite(area.position.y) and is_finite(area.size.x) and is_finite(area.size.y) and area.size.x>0 and area.size.y>0 and area.size.x<=320 and area.size.y<=180
