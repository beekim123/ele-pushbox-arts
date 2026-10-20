class_name PortitorArtBubble
extends Control
## Live G2 speech/thought text with speaker anchors and typewriter support.
const Contract = preload("../../api/provider_contract.gd")
var G2: RefCounted
var reveal_speed: float = 30.0
var issues: Array[String] = []
var box: Rect2
var below: bool = false
var tail_x: float = 0
var _lines: PackedStringArray = []
var _revealed: float = 0
var _total: int = 0
var _thought: bool = false
var _labels: Array[Label] = []
var _has_display: bool = false
var _key_parts: Array[Dictionary] = []
var _key_body: Control

func bind_widgets(widgets: RefCounted) -> Dictionary:
	if widgets == null or not widgets.has_method("is_configured") or not widgets.is_configured():
		return Contract.result(["bubble requires explicit configured widgets"])
	G2 = widgets
	return Contract.result([])

func layout_for_text(value: String, minimum: int = 100, maximum: int = 224, limit: int = 6) -> Dictionary:
	var width: int = minimum
	var lines: PackedStringArray = _wrap(value, G2.font(true), width - 12)
	while lines.size() > limit and width < maximum:
		width = mini(maximum, width + 12)
		lines = _wrap(value, G2.font(true), width - 12)
	return {"w":width,"h":lines.size() * 12 + 10,"lines":lines}

func configure_display(model: Dictionary) -> Dictionary:
	if G2 == null: return Contract.result(["bubble widgets are not bound"])
	var errors: Array[String] = Contract.fields(model, {"text":TYPE_STRING,"area":TYPE_RECT2,"speaker":TYPE_VECTOR2,
		"name":TYPE_STRING,"thought":TYPE_BOOL,"tail_above":TYPE_BOOL,"speed":TYPE_FLOAT,"visible":TYPE_INT}, {}, "bubble")
	if not errors.is_empty(): return Contract.result(errors)
	var required: Array[String] = ["art:ui.bubble", "art:ui.bubble_tail"]
	var available: Dictionary = G2.require_assets(required)
	if not available.ok: return available
	var area: Rect2 = model.area
	if not is_finite(area.position.x) or not is_finite(area.position.y) or not is_finite(area.size.x) or not is_finite(area.size.y) or area.size.x < 13 or area.size.y < 10 or not is_finite(model.speaker.x) or not is_finite(model.speaker.y) or not is_finite(model.speed) or model.speed < 0 or model.visible < 0:
		return Contract.result(["invalid bubble geometry or reveal settings"])
	var value: String = model.text
	var speaker_x: float = model.speaker.x
	var name_text: String = model.name
	var thought: bool = model.thought
	var tail_above: bool = model.tail_above
	for child: Node in get_children():
		remove_child(child)
		child.queue_free()
	_labels.clear()
	_key_parts.clear();_key_body=null
	issues.clear()
	box = area
	below = tail_above
	_thought = thought
	tail_x = clampf(speaker_x, box.position.x + 5, box.end.x - 6)
	_lines = _wrap(value, G2.font(true), box.size.x - 12)
	_total = 0
	for line: String in _lines: _total += line.length()
	reveal_speed = model.speed
	_revealed = mini(model.visible, _total)
	if _lines.size() * 12 + 10 > box.size.y: issues.append("bubble text exceeds available height")
	var panel: TextureRect = G2.box(self, box, {"r":4, "rings":["z", "u"], "fill":"y"})
	panel.name = "ApprovedBubble"
	panel.show_behind_parent = true
	for index: int in _lines.size():
		_labels.append(G2.text(self, box.position + Vector2(6, 6 + index * 12), _lines[index], "u" if thought else "t", true))
	if not name_text.is_empty():
		var name_width: int = G2.measure(name_text, true) + 8
		var name_at := Vector2(clampf(box.position.x + 5, 4, 316 - name_width), maxf(21, box.position.y - 9))
		G2.tag(self, name_at, name_text)
	_update_reveal()
	_has_display = true
	queue_redraw()

	return Contract.result([], reveal_state())

func follow_layout(area: Rect2, speaker: Vector2) -> void:
	# Box/text stay in their original local coordinates while the Control moves.
	position = area.position - box.position
	tail_x = clampf(speaker.x - position.x, box.position.x + 5, box.end.x - 6)
	below = area.position.y >= speaker.y
	queue_redraw()

func get_semantic_anchor(id: String) -> Rect2:
	if not _has_display: return Rect2()
	if id == "dialogue.tail": return Rect2(Vector2(position.x+tail_x,position.y+box.position.y if below else position.y+box.end.y),Vector2.ONE)
	if id == "dialogue.text": return Rect2(position + box.position + Vector2(6,6), box.size - Vector2(12,10))
	if id == "dialogue.bubble": return Rect2(position + box.position, box.size)
	return Rect2()

func reveal_state() -> Dictionary:
	return {"visible":floori(_revealed), "total":_total, "complete":_revealed >= _total}

func set_reveal_progress(visible: int, total: int) -> void:
	if total != _total or visible < 0: return
	_revealed = mini(visible, _total)
	_update_reveal()

func _process(delta: float) -> void:
	if G2 != null and _revealed < _total:
		_revealed = minf(_total, _revealed + delta * reveal_speed)
		_update_reveal()

func reveal_all() -> void:
	_revealed = _total
	_update_reveal()

func _update_reveal() -> void:
	var remaining: int = floori(_revealed)
	if not _key_parts.is_empty():
		for part: Dictionary in _key_parts:
			if part.node is Label:part.node.visible_characters=clampi(remaining,0,int(part.length))
			else:part.node.visible=remaining>0
			remaining-=int(part.length)
		return
	for label: Label in _labels:
		label.visible_characters = maxi(0, remaining)
		remaining -= label.text.length()

func _draw() -> void:
	if G2 == null or not _has_display: return
	var y: int = int(box.position.y if below else box.end.y) - (2 if not below else 0)
	var direction: int = -1 if below else 1
	if _thought:
		for step: int in 3:
			var radius: int = 2 if step == 0 else 1
			var center := Vector2(tail_x + step * 3, y + direction * (3 + step * 4))
			draw_circle(center, radius + 1, G2.RASTER.color_of("z"))
			draw_circle(center, radius, G2.RASTER.color_of("u"))
			if step == 0: draw_circle(center, 1, G2.RASTER.color_of("y"))
	else:
		for step: int in 6:
			var span: int = 6 - step
			draw_rect(Rect2(tail_x - 3, y + direction * step, span, 1), G2.RASTER.color_of("z"))
			if span > 2: draw_rect(Rect2(tail_x - 2, y + direction * step, span - 2, 1), G2.RASTER.color_of("u"))
			if span > 4: draw_rect(Rect2(tail_x - 1, y + direction * step, span - 4, 1), G2.RASTER.color_of("y"))

static func _wrap(value: String, face: Font, width: float, font_size: int = 10) -> PackedStringArray:
	var expression := RegEx.new()
	expression.compile("[　-鿿가-힯＀-￯]|[^\\s　-鿿가-힯＀-￯]+|\\s+")
	var lines := PackedStringArray()
	var line: String = ""
	for match_result: RegExMatch in expression.search_all(value):
		var token: String = match_result.get_string()
		if token.contains("\n"):
			lines.append(line.rstrip(" \t"))
			line = ""
		elif token.strip_edges().is_empty():
			if not line.is_empty(): line += " "
		elif line.is_empty() or face.get_string_size(line + token, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x <= width:
			line += token
		else:
			if "，。：；、！？）」』”…,.:;!?)".contains(token.left(1)) and line.length() > 1:
				lines.append(line.left(-1).rstrip(" \t"))
				line = line.right(1) + token
			else:
				lines.append(line.rstrip(" \t"))
				line = token
	if not line.is_empty(): lines.append(line.rstrip(" \t"))
	return lines

func configure_keyed_display(model: Dictionary) -> Dictionary:
	var errors: Array[String]=Contract.fields(model,{"text":TYPE_STRING,"area":TYPE_RECT2,"speaker":TYPE_VECTOR2,"name":TYPE_STRING,"thought":TYPE_BOOL,"tail_above":TYPE_BOOL,"speed":TYPE_FLOAT,"visible":TYPE_INT,"segments":TYPE_ARRAY},{},"keyed bubble")
	if not errors.is_empty():return Contract.result(errors)
	var segments: Array[Dictionary]=[]
	for part: Variant in model.segments:
		if not part is Dictionary:return Contract.result(["invalid keyed bubble segments"])
		segments.append(part)
	var checked: Dictionary=G2.keycaps.validate_segments(segments) if G2!=null else Contract.result(["bubble widgets missing"])
	if not checked.ok:return checked
	# Only normalize/copy the bounded records after all nested Variant checks.
	var normalized_segments: Array[Dictionary]=[]
	for part: Dictionary in segments:
		var normalized: Dictionary=part.duplicate(true)
		if normalized.has("items"):
			var items: Array[Dictionary]=[]
			for item: Variant in normalized.items:items.append(item)
			normalized.items=items
		normalized_segments.append(normalized)
	segments=normalized_segments
	var plain: Dictionary=model.duplicate(true);plain.erase("segments");plain.text=" "
	checked=configure_display(plain)
	if not checked.ok:return checked
	for label: Label in _labels:remove_child(label);label.queue_free()
	_labels.clear();_key_parts.clear()
	_key_body=G2.device_segments(self,box.position+Vector2(6,6),segments,int(box.size.x)-12)
	_key_body.set_meta("resolved",model.text)
	_collect_key_parts(_key_body)
	_total=0
	for part: Dictionary in _key_parts:_total+=int(part.length)
	_revealed=mini(model.visible,_total);_update_reveal()
	return Contract.result([],reveal_state())

func _collect_key_parts(parent: Node) -> void:
	for node: Node in parent.get_children():
		if node is Label and node.visible:_key_parts.append({"node":node,"length":node.text.length()})
		elif node is TextureRect and node.visible:_key_parts.append({"node":node,"length":1})
		else:_collect_key_parts(node)
func query_element(id: String) -> Control:
	return _key_body if id=="dialogue.keys" and is_instance_valid(_key_body) else null
func layout_diagnostics() -> Dictionary:
	return {"line_count":_lines.size(),"issues":issues.duplicate(),"tail_x":tail_x+position.x,"below":below,"body":get_semantic_anchor("dialogue.text"),"bubble":get_semantic_anchor("dialogue.bubble")}
