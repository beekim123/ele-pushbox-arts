class_name PortitorArtUiView
extends Control
## Each screen has its own scene; this presenter builds shared Control widgets.
@export var screen_name: String = "lobby"
var focus_index: int = 0
var buttons: Array[Button] = []
var _issues: Array[String] = []
var _chapter_cards: Control
var _chapter_details: Control
var _chapter_nodes: Dictionary = {}
var _chapter_focus: float = 0
var _tween: Tween
var _row_records: Array[Dictionary] = []
var _details: Control
const RASTER = preload("../../render/palette_raster.gd")
const ILLUSTRATION = preload("../illustration.gd")
const DIM_SHADER: Shader = preload("../palette_dim.gdshader")
var _preview_pool: Dictionary = {}
var _card_previews: Array[Dictionary] = []
var _rule_preview: Variant = null
var _rule_bag: TextureRect
var _rule_icon: TextureRect
var _rule_icon_uid: String = ""
var _rule_icon_animation: String = "default"
var _elapsed_ticks: float = 0.0
const SETTING_FIELDS: Array[String] = ["language", "lobby_skin", "music", "sfx", "window_scale", "ambience", "show_grid", "open_all_levels", "tutorial", "controls"]
var _volume_rows: Dictionary = {}
static var _dim_materials: Dictionary = {}

signal intent_requested(id: String, payload: Dictionary)
const Contract = preload("../../../api/provider_contract.gd")
const Model = preload("../../../api/ui_model.gd")
const Widgets = preload("../widgets.gd")
const Bubble = preload("../bubble.gd")
const LobbySkin = preload("../lobby_skin.gd")
var G2: RefCounted
var provider: RefCounted
var model: Dictionary = {}
var data: Dictionary = {}
var _elements: Dictionary = {}
var _bubbles: Array[Control] = []
var _elapsed: float = 0

func _unhandled_key_input(event: InputEvent) -> void:
	if screen_name != "levels" or _details == null or not event is InputEventKey:
		return
	var key: InputEventKey = event as InputEventKey
	if not key.pressed or key.physical_keycode not in [KEY_PAGEUP, KEY_PAGEDOWN]:
		return
	var description: ScrollContainer = _details.get_node_or_null("LevelDiscoveryScroll") as ScrollContainer
	if description != null:
		description.scroll_vertical += -39 if key.physical_keycode == KEY_PAGEUP else 39
		get_viewport().set_input_as_handled()

func _exit_tree() -> void:
	for preview: Variant in _preview_pool.values():
		if is_instance_valid(preview) and preview.get_parent() == null:
			preview.free()
	_preview_pool.clear()

func _dim_item(item: Node, steps: int) -> void:
	if steps <= 0:
		return
	if not _dim_materials.has(steps):
		var material := ShaderMaterial.new()
		material.shader = DIM_SHADER
		material.set_shader_parameter("dim_steps", steps)
		_dim_materials[steps] = material
	if item is CanvasItem:
		(item as CanvasItem).material = _dim_materials[steps]
	for child: Node in item.get_children():
		# The thumbnail's own SubViewport uses verified R8 decode shaders;
		# remap only its finished RGBA TextureRect, never those internals.
		if not child is SubViewport:
			_dim_item(child, steps)

func _text(key: String, location: Vector2, width: int, params: Dictionary = {}, wrap: bool = false) -> Label:
	return _flow_label(t(key, params), location, width, false, wrap)

func _box(rect: Rect2, frame: int = 0) -> VBoxContainer:
	var outer: PanelContainer = G2.factory_panel(rect, frame)
	add_child(outer)
	var margin: MarginContainer = G2.margin()
	outer.add_child(margin)
	var column: VBoxContainer = G2.column()
	margin.add_child(column)
	return column

func _button(parent: Node, key: String, index: int, width: float, icon: String = "", icon_animation: String = "default") -> Button:
	var node: Button = G2.factory_button(t(key), func() -> void: _activate(index), width, icon, icon_animation)
	node.focus_entered.connect(func() -> void: focus_index = index)
	parent.add_child(node)
	buttons.append(node)
	return node

func _measure(text: String) -> int:
	return roundi(G2.ui_font().get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x)

func _color(code: String) -> Color:
	return RASTER.color_of(code)

func _rectangle(rect: Rect2, code: String, parent: Node = null) -> ColorRect:
	var node := ColorRect.new()
	node.position = rect.position
	node.size = rect.size
	node.color = _color(code)
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	(parent if parent != null else self).add_child(node)
	return node

func _panel(rect: Rect2, frame: int = 0, parent: Node = null) -> NinePatchRect:
	var node := NinePatchRect.new()
	var texture: AtlasTexture = _atlas("art:ui.panel", ["normal", "focused", "wood"][frame])
	if texture != null:
		node.texture = texture.atlas
		node.region_rect = texture.region
	var margins: Array = provider.metadata("art:ui.panel").get("ninepatch", [6, 6, 6, 6])
	node.patch_margin_top = int(margins[0])
	node.patch_margin_right = int(margins[1])
	node.patch_margin_bottom = int(margins[2])
	node.patch_margin_left = int(margins[3])
	node.axis_stretch_horizontal = NinePatchRect.AXIS_STRETCH_MODE_TILE
	node.axis_stretch_vertical = NinePatchRect.AXIS_STRETCH_MODE_TILE
	node.position = rect.position
	node.size = rect.size
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	(parent if parent != null else self).add_child(node)
	return node

func _flow_label(text: String, location: Vector2, width: float, small: bool = false, wrap: bool = false, parent: Node = null) -> Label:
	# The design positions text regions; containers own the text inside them.
	# Zero margins retain the original glyph origin and measured pixel width.
	var region: MarginContainer = G2.margin(0, 0, 0, 0)
	region.position = location
	region.custom_minimum_size.x = maxf(1, width)
	region.custom_maximum_size.x = maxf(1, width)
	region.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 0)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	region.add_child(row)
	var node: Label = G2.label(text, maxf(1, width), small, wrap)
	node.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	node.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	row.add_child(node)
	region.size = Vector2(maxf(1, width), node.get_combined_minimum_size().y)
	(parent if parent != null else self).add_child(region)
	return node

func _label(text: String, location: Vector2, width: float, code: String = "u", shadow: String = "", parent: Node = null) -> Label:
	var node: Label = _flow_label(text, location, width, false, false, parent)
	node.add_theme_color_override("font_color", _color(code))
	if not shadow.is_empty():
		node.add_theme_color_override("font_shadow_color", _color(shadow))
		node.add_theme_constant_override("shadow_offset_x", 0)
		node.add_theme_constant_override("shadow_offset_y", 1)
	return node

func _centered(text: String, center: int, y: int, width: int, code: String = "u", shadow: String = "") -> Label:
	var measured: int = mini(width, _measure(text))
	return _label(text, Vector2(center - measured / 2, y), measured, code, shadow)

func _text2x(text: String, location: Vector2, code: String = "l", shadow: String = "", parent: Node = null) -> Label:
	var width: int = _measure(text) + 2
	if not shadow.is_empty():
		var shade: Label = _label(text, location + Vector2(1, 2), width, shadow, "", parent)
		(shade.get_parent().get_parent() as Control).scale = Vector2(2, 2)
	var node: Label = _label(text, location, width, code, "", parent)
	(node.get_parent().get_parent() as Control).scale = Vector2(2, 2)
	return node

func _sprite(uid: String, animation: String, anchor: Vector2, parent: Node = null) -> TextureRect:
	var node := TextureRect.new()
	node.texture = _atlas(uid, animation)
	var info: Dictionary = provider.metadata(uid)
	var origin: Array = info.get("anchor", [0, 0])
	node.position = anchor - Vector2(origin[0], origin[1])
	node.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	var dimensions: Array = info.get("size", [0, 0])
	node.size = Vector2(dimensions[0], dimensions[1])
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	(parent if parent != null else self).add_child(node)
	return node

func _wrapped(text: String, width: int) -> Array[String]:
	var expression := RegEx.new()
	expression.compile("[　-鿿가-힯＀-￯]|[^\\s　-鿿가-힯＀-￯]+|\\s+")
	var lines: Array[String] = []
	var line: String = ""
	for token_match: RegExMatch in expression.search_all(text):
		var token: String = token_match.get_string()
		if token.strip_edges().is_empty():
			if not line.is_empty():
				line += " "
			continue
		if line.is_empty() or _measure(line + token) <= width:
			line += token
			continue
		if "，。：；、！？）」』”…,.:;!?)".contains(token.left(1)) and line.length() > 1:
			lines.append(line.left(-1))
			line = line.right(1) + token
			continue
		lines.append(line.rstrip(" \t\n"))
		line = token
		while _measure(line) > width and line.length() > 1:
			var cut: int = line.length() - 1
			while cut > 1 and _measure(line.left(cut)) > width:
				cut -= 1
			lines.append(line.left(cut))
			line = line.substr(cut)
	if not line.is_empty():
		lines.append(line.rstrip(" \t\n"))
	return lines

func _paragraph(text: String, location: Vector2, width: int, max_lines: int, code: String = "u", parent: Node = null) -> void:
	var lines: Array[String] = _wrapped(text, width)
	if lines.size() > max_lines:
		_issues.append("paragraph clipped: " + text)
	var region: MarginContainer = G2.margin(0, 0, 0, 0)
	region.position = location
	region.custom_minimum_size.x = width
	region.custom_maximum_size.x = width
	region.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var column: VBoxContainer = G2.column(-1) # 14px font height, 13px reference line stride.
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	region.add_child(column)
	(parent if parent != null else self).add_child(region)
	for index: int in mini(max_lines, lines.size()):
		_label(lines[index], Vector2.ZERO, width, code, "", column)

func _row(rect: Rect2, index: int, active_rect: Rect2 = Rect2(), panel_always: bool = false, activation: Callable = Callable()) -> Button:
	if panel_always:
		_panel(rect)
	var node := Button.new()
	node.position = rect.position
	node.size = rect.size
	node.custom_minimum_size = rect.size
	node.add_theme_font_override("font", G2.ui_font())
	node.add_theme_font_size_override("font_size", 12)
	for state: String in ["normal", "hover", "pressed", "focus", "disabled"]:
		node.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	add_child(node)
	var active: NinePatchRect = _panel(active_rect if active_rect.has_area() else rect, 1)
	active.visible = index == focus_index
	_row_records.append({"index": index, "active": active, "labels": []})
	node.focus_entered.connect(func() -> void:
		focus_index = index
		_sync_rows()
		if screen_name == "levels":
			_emit("select", {"row_id":str(data.rows[index].id)}))
	node.pressed.connect(activation if activation.is_valid() else func() -> void: _activate(index))
	buttons.append(node)
	return node

func _row_label(index: int, text: String, location: Vector2, width: int, normal: String = "u", selected: String = "l") -> Label:
	var node: Label = _label(text, location, width, selected if index == focus_index else normal)
	for record: Dictionary in _row_records:
		if record.index == index:
			record.labels.append({"node": node, "normal": normal, "selected": selected})
	return node

func _sync_rows() -> void:
	for record: Dictionary in _row_records:
		record.active.visible = int(record.index) == focus_index
		if record.has("pointer"):
			record.pointer.visible = int(record.index) == focus_index
		if record.get("never_highlight", false):
			record.active.visible = false
		for entry: Dictionary in record.labels:
			entry.node.add_theme_color_override("font_color", _color(entry.selected if int(record.index) == focus_index else entry.normal))

	for key: String in _volume_rows:
		refresh_volume(key)

func _wide_key(text: String, location: Vector2) -> int:
	var width: int = _measure(text) + 8
	_rectangle(Rect2(location + Vector2(1, 0), Vector2(width - 2, 13)), "z")
	_rectangle(Rect2(location + Vector2(0, 1), Vector2(width, 11)), "z")
	_rectangle(Rect2(location + Vector2(1, 1), Vector2(width - 2, 10)), "u")
	_rectangle(Rect2(location + Vector2(1, 11), Vector2(width - 2, 1)), "v")
	_label(text, location + Vector2(4, -1), width - 8, "y")
	return width

func _keybar(groups: Array[Dictionary]) -> void:
	_rectangle(Rect2(0, 161, 320, 19), "z")
	_rectangle(Rect2(0, 161, 320, 1), "y")
	var total: int = 0
	for group: Dictionary in groups:
		for key: String in group["keys"]:
			total += (_measure(key) + 8 if key in ["Enter", "Esc"] else 13) + 1
		total += 3 + _measure(t(group.label)) + 10
	var full: bool = total <= 304
	if not full:
		_issues.append("keybar labels dropped")
	var x: int = 8
	for group: Dictionary in groups:
		for key: String in group["keys"]:
			if key in ["Enter", "Esc"]:
				x += _wide_key(key, Vector2(x, 164)) + 1
			else:
				_sprite("art:ui.keycap", key, Vector2(x, 164))
				x += 14
		if full:
			_label(t(group.label), Vector2(x, 163), _measure(t(group.label)), "v")
			x += 3 + _measure(t(group.label))
		x += 10

func _lobby_button(skin: Control, area: Rect2, caption: String, index: int) -> void:
	var node := Button.new()
	node.name = "LobbyMenu" + str(index)
	node.position = area.position
	node.size = area.size
	node.accessibility_name = caption
	for state: String in ["normal", "hover", "pressed", "focus", "disabled"]:
		node.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	node.focus_entered.connect(func() -> void:
		focus_index = index
		skin.redraw(index))
	node.pressed.connect(func() -> void: _activate(index))
	add_child(node)
	buttons.append(node)

func _page_indicator() -> void:
	var pages := Control.new()
	pages.name = "ChapterPageIndicator"
	_elements["chapters.pages"]=pages
	pages.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_chapter_details.add_child(pages)
	var count: int = data.cards.size()
	var gap: int = mini(10, 260 / maxi(1, count - 1))
	var x: int = 160 - ((count - 1) * gap) / 2
	for index: int in count:
		var marker := Control.new()
		marker.name = "Page%d" % index
		marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
		pages.add_child(marker)
		_elements["chapters.page."+str(index)]=marker
		G2.dot(marker, Vector2(x + index * gap, 133), 2 if index == int(data.selected) else 1, "m" if index == int(data.selected) else "u" if bool(data.cards[index].available) else "x")
	_chapter_arrow("left", -1, x - 14)
	_chapter_arrow("right", 1, x + (count - 1) * gap + 12)

func _chapter_arrow(animation: String, amount: int, x: int) -> void:
	G2.arrow(_chapter_details, Vector2(x + (0 if amount < 0 else 2), 133), animation)
	var arrow := Button.new()
	arrow.position = Vector2(x - 4, 127)
	arrow.size = Vector2(11, 12)
	arrow.focus_mode = Control.FOCUS_NONE
	for state: String in ["normal", "hover", "pressed", "focus", "disabled"]: arrow.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	arrow.disabled = (amount < 0 and int(data.selected) == 0) or (amount > 0 and int(data.selected) + 1 == data.cards.size())
	arrow.pressed.connect(func() -> void: _emit("chapter_step", {"delta":amount}))
	_chapter_details.add_child(arrow)

func _prepare_thumbnails() -> void:
	if DisplayServer.get_name() == "headless" or not is_inside_tree() or is_queued_for_deletion(): return
	var tree: SceneTree = get_tree()
	for preview: Dictionary in _card_previews:
		if is_instance_valid(preview.node) and preview.node.is_inside_tree(): preview.node.begin_prepare()
	await tree.process_frame
	if not is_inside_tree() or is_queued_for_deletion(): return
	await RenderingServer.frame_post_draw
	if not is_inside_tree() or is_queued_for_deletion(): return
	for preview: Dictionary in _card_previews:
		if is_instance_valid(preview.node) and preview.node.is_inside_tree(): preview.node.finish_prepare()

func prepare_reference() -> void:
	if DisplayServer.get_name() == "headless":
		return
	if screen_name == "chapters":
		await _prepare_thumbnails()
	elif _rule_preview != null:
		await _rule_preview.prepare_reference()

func _chapter_frame(parent: Control, small: bool, well: bool = false) -> NinePatchRect:
	var source: TextureRect = G2.well(parent, Rect2(0, 0, 20, 20), not small) if well else G2.panel(parent, Rect2(0, 0, 20, 20), small)
	var frame := NinePatchRect.new()
	frame.texture = source.texture
	for side: int in [SIDE_LEFT, SIDE_TOP, SIDE_RIGHT, SIDE_BOTTOM]: frame.set_patch_margin(side, 4)
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.remove_child(source)
	source.free()
	parent.add_child(frame)
	return frame

func _make_chapter_card(index: int) -> Dictionary:
	var card := Control.new()
	card.name = "ChapterCard%d" % index
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_chapter_cards.add_child(card)
	var panels: Array[NinePatchRect] = [_chapter_frame(card, false), _chapter_frame(card, true)]
	var wells: Array[NinePatchRect] = [_chapter_frame(card, false, true), _chapter_frame(card, true, true)]
	var group: Dictionary = data.cards[index]
	var locked: bool = group.locked
	var miniature := ILLUSTRATION.ChapterPicture.new()
	miniature.name = "ThemeThumbnail%d" % index
	miniature.set_meta("theme_uid", str(group.theme))
	card.add_child(miniature)
	_elements["chapters.picture."+str(index)]=miniature
	_elements["chapters.card."+str(index)]=card
	miniature.bind_provider(provider)
	miniature.configure_chapter_display(str(group.theme),Vector2i(110,50),_visual_tick()+index*97,true)
	miniature.position = Vector2(7, 7)
	_card_previews.append({"node":miniature, "index":index})
	var lock := Control.new()
	card.add_child(lock)
	lock.visible = locked
	G2.plate(lock, Rect2(0, 0, 18, 18))
	_icon(lock, "art:ui.icons", "lock", Vector2(3, 3), "w")
	var done: int = int(group.done)
	var progress: String = str(group.progress)
	var center := Control.new()
	card.add_child(center)
	G2.plate(center, Rect2(1, 1, 24, 22))
	_icon(center, "art:ui.theme_emblem", str(group.theme).trim_prefix("art:theme."), Vector2(5, 4))
	var label: Label
	if not locked:
		for pip: int in int(group.total): G2.pip(center, Vector2(12 + pip * 7, 68), "m" if pip < done else "x", 2, pip < done)
		label = G2.text(center, Vector2(115, 75), progress, "u", true, "r", 106)
		label.name = "ChapterProgress%d" % index
		_elements["chapters.progress."+str(index)]=label
	var side: Label = G2.text(card, Vector2(36, 44), str(group.chapter_name) if locked else progress, "w" if locked else "u", true, "c", 60)
	var click := Button.new()
	click.focus_mode = Control.FOCUS_NONE
	for state: String in ["normal", "hover", "pressed", "focus", "disabled"]: click.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	card.add_child(click)
	click.pressed.connect(func() -> void:
		if index == int(data.selected): _emit("activate", {"action_id":"chapter_open"})
		else: _emit("chapter_select", {"id":str(data.cards[index].id)}))
	return {"card":card, "panels":panels, "wells":wells, "picture":miniature, "lock":lock, "locked":locked, "center":center, "side":side, "click":click, "dim":-1, "progress":label}

func _draw_cards(focus: float) -> void:
	_chapter_focus = focus
	var order: Array[int] = []
	for index: int in data.cards.size(): order.append(index)
	order.sort_custom(func(a: int, b: int) -> bool: return absf(a - focus) > absf(b - focus))
	for index: int in order:
		var distance: float = index - focus
		if not _chapter_nodes.has(index):
			if absf(distance) > 2.4: continue
			_chapter_nodes[index] = _make_chapter_card(index)
		var record: Dictionary = _chapter_nodes[index]
		var card: Control = record.card
		card.visible = absf(distance) <= 2.4
		if not card.visible: continue
		_chapter_cards.move_child(card, -1)
		var d: float = minf(2, absf(distance))
		var first: int = int(d)
		var last: int = mini(2, first + 1)
		var fraction: float = d - first
		var widths: Array[float] = [124, 72, 56]
		var heights: Array[float] = [86, 66, 54]
		var offsets: Array[float] = [0, 106, 168]
		var tops: Array[float] = [24, 36, 44]
		var dimensions := Vector2(roundf(lerpf(widths[first], widths[last], fraction)), roundf(lerpf(heights[first], heights[last], fraction)))
		var cx: float = 160 + signf(distance) * roundf(lerpf(offsets[first], offsets[last], fraction))
		var center: bool = d < 0.5
		card.position = Vector2(cx - floorf(dimensions.x / 2), roundf(lerpf(tops[first], tops[last], fraction)))
		card.size = dimensions
		var picture_height: int = roundi(lerpf(52, 34, minf(d, 1)))
		for variant: int in 2:
			record.panels[variant].size = dimensions
			record.panels[variant].visible = (variant == 0) == center
			record.wells[variant].position = Vector2(6, 6)
			record.wells[variant].size = Vector2(dimensions.x - 12, picture_height)
			record.wells[variant].visible = (variant == 0) == center
		record.picture.resize_chapter(Vector2i(int(dimensions.x) - 14, picture_height - 2), center)
		record.lock.position = Vector2(floorf((dimensions.x - 18) / 2), 6 + (picture_height - 18) / 2)
		record.center.visible = center
		if record.progress != null:
			record.progress.position = Vector2(dimensions.x - 9 - record.progress.size.x, dimensions.y - 11)
		var side: Label = record.side
		side.position.x = (dimensions.x - side.size.x) / 2
		side.visible = not center and card.position.x >= 0 and card.position.x + dimensions.x <= 320
		record.click.position.x = maxf(0, -card.position.x)
		record.click.size = Vector2(minf(dimensions.x - record.click.position.x, 320 - maxf(0, card.position.x)), dimensions.y)
		var dim: int = 0 if center else 2 if d >= 1.5 else 1
		if dim != record.dim:
			_chapter_dim(card, dim)
			if record.locked: _chapter_dim(record.picture, dim + 2)
			record.dim = dim

func _chapter_dim(node: Node, steps: int) -> void:
	if steps > 0:
		_dim_item(node, steps)
		return
	if node is CanvasItem: node.material = null
	for child: Node in node.get_children():
		if not child is SubViewport: _chapter_dim(child, 0)

func slide_chapter(_old: int, target: int) -> void:
	if _tween != null: _tween.kill()
	_update_chapter_details()
	_tween = create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_tween.tween_method(_draw_cards, _chapter_focus, float(target), 0.28)

func _pause() -> void:
	var before: Array[Node] = get_children()
	_hud()
	for child: Node in get_children():
		if not before.has(child): _dim_item(child, 1)
	var keys: Array = data.actions
	var caps: Array[String] = []
	for item: Dictionary in data.actions: caps.append(item.key)
	var icons: Array[Array] = []
	for item: Dictionary in data.actions: icons.append([item.icon_uid,item.animation])
	var width: int = maxi(132, G2.measure(t("pause.title")) + 40)
	for index: int in keys.size():
		width = maxi(width, 44 + G2.measure(str(keys[index].label)) + (G2.key_width(caps[index]) + 4 if not caps[index].is_empty() else 0))
	width = mini(304, width)
	var x: int = 160 - width / 2
	G2.panel(self, Rect2(x, 9, width, 150))
	G2.title(self, Rect2(x, 9, width, 24), t("pause.title"))
	for index: int in keys.size():
		var y: int = 33 + index * 15
		_g2_row(Rect2(x + 8, y, width - 16, 15), index, func() -> void: _activate(index))
		var room: int = width - 44 - (G2.key_width(caps[index]) + 4 if not caps[index].is_empty() else 0)
		_g2_row_text(index, str(keys[index].label), Vector2(x + 30, y + 2), room)
		var decoration := Control.new()
		add_child(decoration)
		_row_records.back()["decoration"] = decoration
		if index == 5:
			var keyboard_icon := Control.new()
			add_child(keyboard_icon)
			G2.device_keyboard(keyboard_icon, Vector2(x + 14, y + 3), "u")
			buttons[index].focus_entered.connect(func() -> void:
				for pixel: Node in keyboard_icon.get_children(): pixel.queue_free()
				G2.device_keyboard(keyboard_icon, Vector2(x + 14, y + 3), "y"))
		else:
			_row_records.back()["icon"] = {"uid": str(icons[index][0]), "animation": icons[index][1], "at": Vector2(x + 14, y + 1)}
		if not caps[index].is_empty(): G2.keycap(self, Vector2(x + width - 14 - G2.key_width(caps[index]), y + 2), caps[index])
		if index == 3:
			var rule: ColorRect = G2.rect(self, Rect2(x + 14, y + 14, width - 28, 1), "x")
			_row_records.back()["rule"] = rule
	_g2_refresh_decorations()
	_g2_keybar([{"keys": ["up", "down"], "label": "keys.select"}, {"keys": ["Enter"], "label": "keys.confirm"}, {"keys": ["Esc"], "label": "keys.back"}])

func _settings() -> void:
	_g2_wall()
	var keys: Array = data.rows
	var fields: Array[String] = SETTING_FIELDS
	G2.heading(self, Vector2(8, 3), t("settings.title"))
	var width: int = 224
	for index: int in keys.size():
		var display: String = "" if fields[index] == "controls" else _g2_setting_value(fields[index])
		var value_width: int = 65 + G2.measure(display, true) if fields[index] in ["music", "sfx"] else G2.measure(display) + (25 if fields[index] in ["show_grid", "open_all_levels"] else 22)
		width = maxi(width, G2.measure(str(keys[index].label)) + value_width + 44)
	width = mini(300, width)
	var x: int = 160 - width / 2
	G2.panel(self, Rect2(x, 24, width, 138))
	var row_nodes: Array[Array] = []
	for index: int in keys.size():
		var before: Array[Node] = get_children()
		var y: int = 29 + index * 14
		var field: String = fields[index]
		var selection: Callable = (func() -> void: set_focus(index)) if field in ["music", "sfx"] else (func() -> void: set_focus(index); _emit("setting_adjust", {"field":field,"direction":1}))
		_g2_row(Rect2(x + 5, y, width - 10, 13), index, selection)
		var display: String = "" if field == "controls" else _g2_setting_value(field)
		var value_width: int = 65 + G2.measure(display, true) if field in ["music", "sfx"] else G2.measure(display) + 25 if field in ["show_grid", "open_all_levels"] else mini(width / 2, G2.measure(display) + 22)
		_g2_row_text(index, str(keys[index].label), Vector2(x + 24, y), width - 38 - value_width)
		var decoration := Control.new()
		add_child(decoration)
		_row_records.back()["decoration"] = decoration
		if field == "controls":
			G2.device_keyboard(self, Vector2(x + 11, y + 4), "u")
			G2.arrow(self, Vector2(x + width - 13, y + 6), "right", "u")
		else:
			_row_records.back()["setting"] = {"key":str(keys[index].icon), "field": field, "at": Vector2(x, y), "width": width}
		if field in ["music", "sfx"]:
			var slider := HSlider.new()
			slider.position = Vector2(x + width - 11 - G2.measure(display, true) - 59, y)
			slider.size = Vector2(51, 15)
			slider.min_value = 0
			slider.max_value = 1
			slider.step = 0.1
			slider.set_value_no_signal(float(data.rows[index].value))
			slider.modulate.a = 0
			slider.value_changed.connect(func(volume: float) -> void: _emit("volume_set", {"field":field,"value":volume}))
			slider.focus_entered.connect(func() -> void: focus_index = index; _sync_rows(); _g2_refresh_decorations())
			add_child(slider)
			_elements["settings.slider."+field]=slider
			_volume_rows[field] = {"slider": slider, "index": index, "origin": Vector2(x, y), "width": width}
		if index in [1, 3, 6]:
			_row_records.back()["rule"] = G2.rect(self, Rect2(x + 11, y + 13, width - 22, 1), "x")
		var nodes: Array = get_children().filter(func(node: Node) -> bool: return not before.has(node))
		for node: Node in nodes:
			if node is Control: node.set_meta("settings_origin", node.position)
		row_nodes.append(nodes)
	var arrows := Control.new()
	add_child(arrows)
	var scroll_rows: Callable = func() -> void:
		var first: int = clampi(focus_index - 4, 0, maxi(0, keys.size() - 9))
		set_meta("settings_scroll_start", first)
		for row: int in row_nodes.size():
			var shown: bool = row >= first and row < first + 9
			for node: Node in row_nodes[row]:
				if not node is Control: continue
				var origin: Vector2 = node.get_meta("settings_origin", Vector2.ZERO)
				node.position = origin - Vector2(0, first * 14)
				if node is Button:
					node.mouse_filter = Control.MOUSE_FILTER_STOP if shown else Control.MOUSE_FILTER_IGNORE
					if not shown: node.position.y = 29
				else:
					node.visible = shown
			var record: Dictionary = _row_records[row]
			record.active.visible = shown and row == focus_index
			record.pointer.visible = shown and row == focus_index
			if record.has("rule"): record.rule.visible = shown and row != focus_index and row + 1 != focus_index
		for field: String in _volume_rows:
			var record: Dictionary = _volume_rows[field]
			record.origin.y = 29 + (int(record.index) - first) * 14
		for child: Node in arrows.get_children():
			arrows.remove_child(child)
			child.queue_free()
		if first > 0: G2.arrow(arrows, Vector2(160, 21), "up", "u")
		if first + 9 < keys.size(): G2.arrow(arrows, Vector2(160, 160), "down", "u")
	for button: Button in buttons: button.focus_entered.connect(scroll_rows)
	for field: String in _volume_rows: _volume_rows[field].slider.focus_entered.connect(scroll_rows)
	# Wheel navigation shares the keyboard's focus and scrolling rules.
	if not gui_input.is_connected(_settings_wheel):gui_input.connect(_settings_wheel)
	_g2_refresh_decorations()
	scroll_rows.call()
	_g2_keybar([{"keys": ["up", "down"], "label": "keys.select"}, {"keys": ["left", "right"], "label": "keys.adjust"}, {"keys": ["Esc"], "label": "keys.back"}])

func _hint() -> void:
	_g2_overlay_header()
	var labels: Array[String] = []
	for item: Dictionary in data.actions: labels.append(item.label)
	var back_width: int = G2.key_width("Esc") + 3 + G2.measure(t("keys.back"), true) + 12
	var right: int = 309 - back_width - 5
	var widths: Array[int] = []
	var total: int = 0
	for label: String in labels:
		var width: int = G2.measure(label) + 14 + (G2.key_width("H") + 4 if int(data.hint_level) < 3 else 0)
		widths.append(width)
		total += width
	total += (labels.size() - 1) * 5
	var expanded: bool = total > right - 58
	var stacked: bool = expanded and total > 304
	var heights: Array[int] = []
	for label: String in labels:
		var lines: PackedStringArray = Bubble._wrap(label, G2.font(), 292 - (G2.key_width("H") + 4 if int(data.hint_level) < 3 else 0), 12) if stacked else PackedStringArray([label])
		heights.append(maxi(17, lines.size() * 12 + 4))
	var footer_height: int = 18 if not expanded else 34
	if stacked:
		footer_height = 20 + (labels.size() - 1) * 3
		for height: int in heights: footer_height += height
	var footer_y: int = 178 - footer_height
	var controls_y: int = footer_y + 4 if expanded else 164
	var speaker: Vector2 = data.speaker
	var body: String = data.body
	var keyed: bool = data.keyed
	var shape: Dictionary = _bubble_layout(body, 100, 224, 6)
	var bubble := _new_bubble()
	add_child(bubble)
	var at := Vector2(clampf(speaker.x - 50, 4, 316 - int(shape.w)), clampf(speaker.y - int(shape.h) - 9, 34, maxi(34, footer_y - 11 - int(shape.h))))
	_configure_bubble(bubble,body,Rect2(at,Vector2(shape.w,shape.h)),speaker,t("hint.title"),false,false,data.segments if keyed else [])
	if keyed: _elements["tutorial.keys"] = bubble.query_element("dialogue.keys")
	_issues.append_array(bubble.issues)
	G2.plate(self, Rect2(4, footer_y, 312, footer_height))
	_icon(self, "art:ui.icons", "hint", Vector2(9, controls_y - 1))
	for pip: int in 3:
		G2.pip(self, Vector2(26 + pip * 7, controls_y + 5), "s" if pip < int(data.hint_level) else "x", 2, pip < int(data.hint_level))
	_draw_keybar([{"keys":["Esc"], "label":t("keys.back")}], Vector2(309 - back_width / 2, controls_y))
	var x: int = 160 - total / 2 if expanded else right - total
	var y: int = footer_y + 18 if expanded else 162
	for index: int in labels.size():
		var key: String = "H" if int(data.hint_level) < 3 else ""
		_g2_overlay_action(Rect2(8 if stacked else x, y, 304 if stacked else widths[index], heights[index] if stacked else 14), labels[index], index, key, false)
		if stacked: y += heights[index] + 3
		else: x += widths[index] + 5


func _plain_button(text: String, position: Vector2, width: int, index: int) -> Button:
	var button: Button = _row(Rect2(position, Vector2(width, 15)), index, Rect2(), true)
	_row_label(index, text, position + Vector2(7, 0), width - 14)
	return button

func _complete() -> void:
	_g2_overlay_header()
	var title: String = t("complete.title")
	var moves: String = t("complete.moves")
	var labels: Array[String] = [str(data.actions[0].label),str(data.actions[1].label)]
	var discovery: String = data.discovery
	var found: bool = data.found
	var need: int = maxi(52, maxi(G2.measure(labels[0]), G2.measure(labels[1])) + 14)
	var width: int = mini(304, maxi(160, maxi(need * 2 + 32, maxi(G2.measure(title) + 40, G2.measure(moves) + 24))))
	var lines: Array[String] = []
	if found:
		width = mini(304, maxi(width, G2.measure(t("onb.clear.found"), true) + 24))
		while _g2_lines(discovery, width - 24).size() > 2 and width < 304: width = mini(304, width + 16)
		lines = _g2_lines(discovery, width - 24, 3)
	var height: int = 98 + lines.size() * 12 if found else 76
	var x: int = 160 - width / 2
	var y: int = 26
	var button_width: int = (width - 32) / 2
	G2.panel(self, Rect2(x, y, width, height))
	G2.title(self, Rect2(x, y, width, height), title)
	G2.text(self, Vector2(160, y + 36), moves, "u", false, "c", width - 20)
	if found:
		set_meta("onboarding_reference", "clear_found")
		G2.rect(self, Rect2(x + 12, y + 53, width - 24, 1), "x")
		_elements["complete.found"]=G2.text(self, Vector2(160, y + 57), t("onb.clear.found"), "m", true, "c", width - 24)
		for index: int in lines.size(): G2.text(self, Vector2(160, y + 70 + index * 12), lines[index], "t", true, "c", width - 24)
	for index: int in 2:
		_g2_overlay_action(Rect2(x + 12 if index == 0 else x + width - 12 - button_width, y + height - 23, button_width, 17), labels[index], index)
	_g2_keybar([{"keys":["left", "right"], "label":"keys.select"}, {"keys":["Enter"], "label":"keys.confirm"}])


func _rulecard() -> void:
	if not data.visible: return
	_g2_overlay_header(1)
	var info: Dictionary = {"icon":data.icon_uid,"animation":data.icon_animation}
	var title: String = t("rule.title")
	var body: String = data.body
	var show_how: bool = data.show_how
	var width: int = mini(280, maxi(192, G2.measure(title) + 40))
	var lines: Array[String] = _g2_lines(body, width - 92)
	while lines.size() > 4 and width < 280:
		width = mini(280, width + 12)
		lines = _g2_lines(body, width - 92)
	var how_layout: Dictionary = G2.onboarding_how_layout(data.how_units, width-24) if show_how else {}
	while show_how and how_layout.rows.size()>1 and width<304:
		width=mini(304,width+12)
		how_layout=G2.onboarding_how_layout(data.how_units,width-24)
	lines = _g2_lines(body, width - 92, 5)
	var top: int = maxi(74, 31 + lines.size() * 12)
	var height: int = top + 6 + how_layout.rows.size() * 13 + 6 + 25 if show_how else maxi(116, 30 + lines.size() * 12 + 36)
	var x: int = 160 - width / 2
	var y: int = mini(34, 158 - height)
	G2.panel(self, Rect2(x, y, width, height))
	G2.title(self, Rect2(x, y, width, height), title)
	_icon(self, str(info.icon), str(info.animation), Vector2(x + 9, y + 7))
	for index: int in lines.size(): G2.text(self, Vector2(x + 80, y + 31 + index * 12), lines[index], "u", true)
	if data.illustration:
		_rule_preview = ILLUSTRATION.RulePicture.new()
		add_child(_rule_preview)
		_rule_preview.position = Vector2(x + 12, y + 30)
		_rule_preview.bind_provider(provider)
		_rule_preview.configure_rule_sample(data.theme_uid,_visual_tick())
		G2.well(self, Rect2(x + 11, y + 29, 58, 46))
		move_child(_rule_preview, get_child_count() - 1)
	else:
		G2.well(self, Rect2(x + 11, y + 29, 58, 46))
		_rule_icon_uid = str(info.icon)
		_rule_icon_animation = str(info.animation)
		var icon: Dictionary = provider.metadata(_rule_icon_uid)
		var dimensions: Array = icon.get("size", [16, 16])
		var anchor: Array = icon.get("anchor", [0, 0])
		_rule_icon = _sprite(_rule_icon_uid, _rule_icon_animation, Vector2(x + 12 + (56 - int(dimensions[0])) / 2 + int(anchor[0]), y + 30 + (44 - int(dimensions[1])) / 2 + int(anchor[1])))
	if show_how:
		set_meta("onboarding_reference", "rulecard_how")
		G2.rect(self, Rect2(x + 12, y + top + 2, width - 24, 1), "x")
		var keys: Control = G2.onboarding_how_row(self, Vector2(x + 12, y + top + 6), how_layout, width - 24)
		keys.name = "RuleCardHowKeys"
		_elements["tutorial.keys"] = keys
	var label: String = t("rule.close")
	var button_width: int = mini(width - 24, G2.measure(label) + G2.key_width("Esc") + 24)
	_g2_overlay_action(Rect2(x + (width - button_width) / 2, y + height - 25, button_width, 17), label, 0, "Esc")


func _dimmed_hud() -> void:
	var before: Array[Node] = get_children()
	_hud()
	for child: Node in get_children():
		if not before.has(child):
			_dim_item(child, 2)

func _dialogue() -> void:
	_g2_overlay_header()
	var offset: Vector2 = data.actor_offset
	var actor: TextureRect = _icon(self, "art:char.portitor", "idle", Vector2(146, 100) + offset)
	if actor != null: actor.flip_h = true
	_icon(self, "art:ui.emote", "default", Vector2(150, 87) + offset)
	var npc_text: String = t("dlg.sample.npc")
	var npc_shape: Dictionary = _bubble_layout(npc_text, 152, 180, 7)
	var npc_at := Vector2(clampf(128 + offset.x, 124, 316 - int(npc_shape.w)), clampf(40 + offset.y, 34, 140 - int(npc_shape.h)))
	var npc := _new_bubble()
	add_child(npc)
	_configure_bubble(npc,npc_text,Rect2(npc_at,Vector2(npc_shape.w,npc_shape.h)),Vector2(156+offset.x,0),t("dlg.sample.npc.name"))
	G2.arrow(self, npc_at + Vector2(int(npc_shape.w) - 9, int(npc_shape.h) - 5), "down")
	var self_text: String = t("dlg.sample.self")
	var self_shape: Dictionary = _bubble_layout(self_text, 102, 114, 7)
	var self_at := Vector2(clampf(10 + offset.x, 4, 120 - int(self_shape.w)), clampf(52 + offset.y, 34, 140 - int(self_shape.h)))
	var thought := _new_bubble()
	add_child(thought)
	_configure_bubble(thought,self_text,Rect2(self_at,Vector2(self_shape.w,self_shape.h)),Vector2(92+offset.x,0),"",true)
	_issues.append_array(npc.issues)
	_issues.append_array(thought.issues)
	var rows: Array[String] = _g2_lines(t("dlg.sample.note"), 280, 2)
	var width: int = 80
	for line: String in rows: width = maxi(width, G2.measure(line, true) + 28)
	var x: int = 160 - width / 2
	var height: int = rows.size() * 10 + 8
	G2.plate(self, Rect2(x, 150, width, height))
	_icon(self, "art:ui.emote", "default", Vector2(x + 4, 150 + (height - 12) / 2))
	var expression := RegEx.new()
	expression.compile("^(.*?[：:]\\s?)(.*)$")
	for index: int in rows.size():
		var parts: RegExMatch = expression.search(rows[index]) if index == 0 else null
		if parts != null:
			G2.text(self, Vector2(x + 20, 154 + index * 10), parts.get_string(1), "m", true)
			G2.text(self, Vector2(x + 20 + G2.measure(parts.get_string(1), true), 154 + index * 10), parts.get_string(2), "t", true)
		else: G2.text(self, Vector2(x + 20, 154 + index * 10), rows[index], "t", true)


func move_focus(amount: int) -> void:
	if not is_inside_tree() or buttons.is_empty():
		return
	focus_index = posmod(focus_index + amount, buttons.size())
	if is_instance_valid(buttons[focus_index]) and buttons[focus_index].is_inside_tree():
		buttons[focus_index].grab_focus()
	if screen_name == "levels":
		_emit("select", {"row_id":str(data.rows[focus_index].id)})

func _focus_first() -> void:
	if is_inside_tree() and not buttons.is_empty():
		set_focus(focus_index)

func set_focus(index: int) -> void:
	if buttons.is_empty() or not is_inside_tree():
		return
	focus_index = clampi(index, 0, buttons.size() - 1)
	if buttons[focus_index].is_inside_tree():
		buttons[focus_index].grab_focus()
	_sync_rows()

func layout_issues() -> Array:
	var result: Array = _issues.duplicate()
	_scan(self, result)
	return result

func _report_layout_issues() -> void:
	if not is_inside_tree():
		return
	for issue: String in layout_issues():
		push_warning(screen_name + ": " + issue)

func _scan(parent: Node, result: Array) -> void:
	for child: Node in parent.get_children():
		if child is Control and not (child as Control).is_visible_in_tree():
			continue
		if child is Label:
			var label: Label = child as Label
			var face: Font = label.get_theme_font("font")
			var font_size: int = label.get_theme_font_size("font_size")
			var wrap_width: float = label.size.x if label.autowrap_mode != TextServer.AUTOWRAP_OFF else -1.0
			var flags: int = TextServer.BREAK_MANDATORY
			if label.autowrap_mode == TextServer.AUTOWRAP_ARBITRARY:
				flags |= TextServer.BREAK_GRAPHEME_BOUND
			elif label.autowrap_mode != TextServer.AUTOWRAP_OFF:
				flags |= TextServer.BREAK_WORD_BOUND
				if label.autowrap_mode == TextServer.AUTOWRAP_WORD_SMART:
					flags |= TextServer.BREAK_ADAPTIVE
			var full_size: Vector2 = face.get_multiline_string_size(label.text, HORIZONTAL_ALIGNMENT_LEFT, wrap_width, font_size, -1, flags)
			if label.autowrap_mode == TextServer.AUTOWRAP_OFF and full_size.x > label.size.x + 1:
				result.append("label horizontal overflow: " + label.text)
			var full_lines: int = maxi(label.get_line_count(), ceili(full_size.y / maxf(1, face.get_height(font_size))))
			if label.max_lines_visible >= 0 and full_lines > label.max_lines_visible:
				result.append("label hidden lines: " + label.text)
			var required_height: float = full_size.y + maxi(0, full_lines - 1) * label.get_theme_constant("line_spacing")
			if required_height > label.size.y + 1:
				result.append("label vertical overflow: " + label.text)
		elif child is Button:
			var button: Button = child as Button
			var face: Font = button.get_theme_font("font")
			var font_size: int = button.get_theme_font_size("font_size")
			var style: StyleBox = button.get_theme_stylebox("normal")
			var usable: Vector2 = button.size - style.get_minimum_size()
			if button.icon != null and not button.text.is_empty():
				usable.x -= button.icon.get_width() + button.get_theme_constant("h_separation")
			if not button.text.is_empty():
				var measured: Vector2 = face.get_string_size(button.text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size)
				if measured.x > usable.x + 1 or measured.y > usable.y + 1:
					result.append("button text overflow: " + button.text)
			elif button.icon != null and (button.icon.get_width() > usable.x + 1 or button.icon.get_height() > usable.y + 1):
				result.append("button icon overflow: " + str(button.name))
		if child is Label or child is Button:
			var control: Control = child as Control
			var bounds: Rect2 = control.get_global_rect()
			var viewport_rect := Rect2(Vector2.ZERO, get_viewport_rect().size)
			var discovery_scroll: ScrollContainer = _discovery_scroll_for(control)
			var outside: bool = not viewport_rect.grow(1).encloses(bounds)
			if discovery_scroll != null:
				outside = bounds.position.x < -1 or bounds.end.x > viewport_rect.end.x + 1
			if outside:
				result.append("text outside viewport: %s %s rect=%s" % [control.name, control.get("text"), bounds])
			var ancestor: Node = control.get_parent()
			while ancestor != self and ancestor != null:
				if ancestor is Control and (ancestor as Control).clip_contents:
					var clip: Rect2 = (ancestor as Control).get_global_rect().grow(1)
					var clipped: bool = not clip.encloses(bounds)
					if ancestor == discovery_scroll:
						clipped = bounds.position.x < clip.position.x or bounds.end.x > clip.end.x
					if clipped:
						result.append("text clipped by parent: " + str(control.name))
				ancestor = ancestor.get_parent()
		_scan(child, result)

func _discovery_scroll_for(control: Control) -> ScrollContainer:
	var ancestor: Node = control.get_parent()
	while ancestor != null and ancestor != self:
		if ancestor is ScrollContainer and ancestor.name == "LevelDiscoveryScroll":
			return ancestor as ScrollContainer
		ancestor = ancestor.get_parent()
	return null

func _g2_keybar(groups: Array[Dictionary]) -> void:
	var translated: Array[Dictionary] = []
	for group: Dictionary in groups:
		translated.append({"keys": group["keys"], "label": t(group.label)})
	G2.keybar(self, translated)

func _g2_row(area: Rect2, index: int, activation: Callable = Callable()) -> Button:
	var node := Button.new()
	node.position = area.position
	node.size = area.size
	for state: String in ["normal", "hover", "pressed", "focus", "disabled"]:
		node.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	add_child(node)
	var active: TextureRect = G2.row(self, area)
	active.visible = index == focus_index
	var pointer: Control = G2.cursor(self, area.position + Vector2(-2, 7))
	pointer.visible = index == focus_index
	_row_records.append({"index": index, "active": active, "pointer": pointer, "labels": []})
	node.focus_entered.connect(func() -> void:
		focus_index = index
		_sync_rows()
		if screen_name == "levels":
			_emit("select", {"row_id":str(data.rows[index].id)})
		_g2_refresh_decorations())
	node.pressed.connect(activation if activation.is_valid() else func() -> void: _activate(index))
	buttons.append(node)
	if screen_name=="settings":_elements["settings.row."+str(data.rows[index].id)]=node
	elif screen_name=="levels":_elements["levels.row."+str(data.rows[index].id)]=node
	return node

func _g2_row_text(index: int, value: String, at: Vector2, room: int, small: bool = false, normal: String = "t") -> Label:
	var node: Label = G2.text(self, at, value, "y" if index == focus_index else normal, small, "l", room)
	for record: Dictionary in _row_records:
		if record.index == index: record.labels.append({"node": node, "normal": normal, "selected": "y"})
	return node

func _g2_refresh_decorations() -> void:
	for record: Dictionary in _row_records:
		var selected: bool = int(record.index) == focus_index
		if record.has("rule"): record.rule.visible = not selected and int(record.index) + 1 != focus_index
		if not record.has("decoration"): continue
		var parent: Control = record.decoration
		for child: Node in parent.get_children():
			parent.remove_child(child)
			child.queue_free()
		if record.has("icon"):
			var icon: Dictionary = record.icon
			_icon(parent, icon.uid, icon.animation, icon.at, "y" if selected else "")
		if record.has("setting"):
			_g2_setting_decoration(parent, record.setting, selected)
		if record.has("level_status"):
			var status: Dictionary = record.level_status
			if status.kind == "next": G2.tag(parent, status.at, t("levels.next"))
			elif status.kind in ["check", "skip"]: _icon(parent, "art:ui.icons", status.kind, status.at, "y" if selected else "")

func _g2_setting_decoration(parent: Node, item: Dictionary, selected: bool) -> void:
	var at: Vector2 = item.at - Vector2(0, 1)
	var field: String = item.field
	var value: Variant = _setting_row(field).value
	var display: String = _g2_setting_value(field)
	var ink: String = "y" if selected else "t"
	_g2_setting_icon(parent, item.key, at + Vector2(11, 4), "y" if selected else "u")
	var xr: int = int(at.x) + int(item.width) - 11
	if field in ["music", "sfx"]:
		G2.text(parent, Vector2(xr, at.y + 4), display, ink, true, "r")
		G2.slider(parent, Vector2(xr - G2.measure(display, true) - 59, at.y + 3), 51, float(value))
	elif field in ["show_grid", "open_all_levels"]:
		G2.text(parent, Vector2(xr, at.y + 1), display, ink, false, "r")
		G2.toggle(parent, Vector2(xr - G2.measure(display) - 25, at.y + 2), bool(value))
	elif field == "tutorial":
		G2.tag(parent, Vector2(xr - G2.measure(display, true) - 8, at.y + 2), display, not selected)
	else:
		var value_width: int = mini(int(item.width) / 2, G2.measure(display) + 22)
		G2.text(parent, Vector2(xr - 10, at.y + 1), display, ink, false, "r", value_width - 20)
		G2.arrow(parent, Vector2(xr - value_width + 1, at.y + 7), "left", ink if selected else "w")
		G2.arrow(parent, Vector2(xr - 2, at.y + 7), "right", ink if selected else "w")

func _g2_setting_icon(parent: Node, key: String, at: Vector2, code: String) -> void:
	var points: Array = []
	match key:
		"settings.language": points = [[2,0],[3,0],[4,0],[1,1],[5,1],[0,2],[6,2],[0,3],[6,3],[0,4],[6,4],[1,5],[5,5],[2,6],[3,6],[4,6]]
		"settings.env": points = [[3,0],[3,6],[0,3],[6,3],[1,1],[5,5],[5,1],[1,5]]
		"settings.tutorial": points = [[2,0],[3,0],[4,0],[5,1],[6,2],[6,3],[6,4],[5,5],[4,6],[3,6],[2,6],[1,5],[0,4],[0,3],[1,1],[0,1],[1,2]]
	for point: Array in points: G2.rect(parent, Rect2(at + Vector2(point[0], point[1]), Vector2.ONE), code)
	var areas: Array = []
	match key:
		"settings.language": areas = [[3,1,1,5],[1,3,5,1]]
		"settings.lobby_skin": areas = [[3,0,1,1],[2,1,3,1],[1,2,5,1],[0,3,7,1],[1,4,5,3]]
		"settings.music": areas = [[4,0,1,6],[4,0,3,1],[6,1,1,1],[2,5,3,2]]
		"settings.sfx": areas = [[0,2,2,3],[2,1,1,5],[3,0,1,7],[5,2,1,1],[5,4,1,1],[6,1,1,5]]
		"settings.scale": areas = [[0,0,7,1],[0,6,7,1],[0,0,1,7],[6,0,1,7],[2,2,3,3]]
		"settings.env": areas = [[2,2,3,3]]
		"settings.grid": areas = [[0,0,7,1],[0,3,7,1],[0,6,7,1],[0,0,1,7],[3,0,1,7],[6,0,1,7]]
		"settings.unlock": areas = [[0,3,7,4],[1,0,1,3],[1,0,4,1],[4,0,1,2]]
		"settings.tutorial": areas = [[3,2,1,3],[4,3,1,1]]
	for area: Array in areas: G2.rect(parent, Rect2(at + Vector2(area[0], area[1]), Vector2(area[2], area[3])), code)
	if key == "settings.unlock": G2.rect(parent, Rect2(at + Vector2(3,4), Vector2(1,2)), "t" if code == "y" else "y")

func _g2_level_offpage(index: int) -> void:
	var node := Button.new()
	node.position = Vector2(10, 26)
	node.size = Vector2.ONE
	for state: String in ["normal", "hover", "pressed", "focus", "disabled"]: node.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	add_child(node)
	buttons.append(node)
	node.focus_entered.connect(func() -> void:
		_emit("select", {"row_id":str(data.rows[index].id)}))

func _g2_lines(value: String, width: int, count: int = 0) -> Array[String]:
	var tokens := RegEx.new()
	tokens.compile("[　-鿿가-힯＀-￯]|[^\\s　-鿿가-힯＀-￯]+|\\s+")
	var lines: Array[String] = []
	var line: String = ""
	for found: RegExMatch in tokens.search_all(value):
		var token: String = found.get_string()
		if token.strip_edges().is_empty():
			if not line.is_empty(): line += " "
		elif line.is_empty() or G2.measure(line + token, true) <= width:
			line += token
		else:
			if "，。：；、！？）」』”…,.:;!?)".contains(token.left(1)) and line.length() > 1:
				lines.append(line.left(-1))
				line = line.right(1) + token
				continue
			lines.append(line.rstrip(" \t\n"))
			line = token
	if not line.is_empty(): lines.append(line.rstrip(" \t\n"))
	if count > 0 and lines.size() > count:
		var rest: String = " ".join(lines.slice(count - 1))
		lines.resize(count)
		lines[count - 1] = G2.fit(rest, width, true)
	return lines

func _g2_wall(theme_uid: String = "art:theme.dungeon") -> void:
	var art: Dictionary = provider.metadata(theme_uid)
	if not art.get("approved", false): return
	var theme: Dictionary = art.get("params", {})
	var backdrop := TextureRect.new()
	var raster = RASTER.new(320, 180)
	ILLUSTRATION.BACKGROUND.draw(raster, theme, Rect2i(0, 0, 320, 180), _visual_tick())
	backdrop.texture = ImageTexture.create_from_image(raster.image())
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = ILLUSTRATION.PALETTE_SHADER
	backdrop.material = material
	# Decode first in a viewport, then palette-dim its final RGBA image.
	var viewport := SubViewport.new()
	viewport.size = Vector2i(320, 180)
	viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
	viewport.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
	add_child(viewport)
	viewport.add_child(backdrop)
	var shown := TextureRect.new()
	shown.texture = viewport.get_texture()
	shown.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shown)
	_dim_item(shown, 2)


func _g2_overlay_action(area: Rect2, value: String, index: int, key: String = "", pointer: bool = true) -> Button:
	var node := Button.new()
	node.position = area.position
	node.size = area.size
	for state: String in ["normal", "hover", "pressed", "focus", "disabled"]: node.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	add_child(node)
	G2.box(self, area, G2.BUTTONS.n)
	var active: TextureRect = G2.box(self, area, G2.BUTTONS.sel)
	active.visible = index == focus_index
	var record: Dictionary = {"index":index, "active":active, "labels":[]}
	if pointer:
		record["pointer"] = G2.cursor(self, area.position + Vector2(-3, 8))
		record.pointer.visible = index == focus_index
	_row_records.append(record)
	var key_width: int = G2.key_width(key) + 4 if not key.is_empty() else 0
	var lines: PackedStringArray = Bubble._wrap(value, G2.font(), area.size.x - 12 - key_width, 12)
	var y: int = int(area.position.y) + (int(area.size.y) - lines.size() * 12 - 1) / 2
	for line: String in lines:
		var x: int = int(area.position.x) + (int(area.size.x) - G2.measure(line) - key_width) / 2
		var label: Label = G2.text(self, Vector2(x, y), line, "y" if index == focus_index else "t")
		record.labels.append({"node":label, "normal":"t", "selected":"y"})
		if not key.is_empty(): G2.keycap(self, Vector2(x + G2.measure(line) + 8, y), key)
		y += 12
	node.focus_entered.connect(func() -> void: focus_index = index; _sync_rows())
	node.pressed.connect(func() -> void: _activate(index))
	buttons.append(node)
	return node


func _g2_overlay_header(dim: int = 0) -> void:
	# Overlay-only G2 capsules; the playable level HUD stays unchanged.
	if not data.hud.visible: return
	var header := Control.new()
	header.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(header)
	_elements["hud.goal"]=header
	G2.rect(header, Rect2(0, 0, 320, 20), "z")
	var hud: Dictionary = data.hud
	var title: String = hud.title
	var id_width: int = G2.measure(str(hud.id), true)
	var class_info: Dictionary = {"icon":hud.class_icon,"animation":hud.class_animation} if not hud.class_icon.is_empty() else {}
	var class_width: int = 15 if not class_info.is_empty() else 0
	var title_width: int = mini(190, id_width + 4 + G2.measure(title) + 10 + class_width)
	G2.overlay_capsule(header, Rect2(3, 2, title_width, 16))
	G2.text(header, Vector2(8, 6), str(hud.id), "l", true)
	G2.text(header, Vector2(13 + id_width, 4), title, "t", false, "l", title_width - id_width - 14 - class_width)
	if not class_info.is_empty(): _overlay_icon(header, str(class_info.icon), str(class_info.animation), Vector2(3 + title_width - 14, 7), dim > 0)
	var goals: Array = hud.goals
	var bag_available: bool = hud.sand_visible
	var bomb_available: bool = hud.bomb_visible
	var width: int = 5 + goals.size() * 12 + 4 + 3 * 15 + 13 + 4 + (30 if bag_available else 0) + (35 if bomb_available else 0)
	var x: int = 317 - width
	G2.overlay_capsule(header, Rect2(x, 2, width, 16))
	var at: int = x + 5
	if bomb_available:
		_icon(header, "art:item.bomb", "default", Vector2(at, 2))
		G2.text(header, Vector2(at + 17, 5), "×" + str(int(hud.bomb)), "w", true)
		at += 35
	if bag_available:
		var bag: Control = _overlay_icon(header, "art:item.sandbag", "full", Vector2(at, 2), dim > 0)
		_elements["hud.sandbag"] = bag
		_elements["hud.sandcount"] = G2.text(header, Vector2(at + 12, 6), "×" + str(int(hud.sand)), "w", true)
		at += 30
	for goal: Dictionary in goals:
		_elements["hud.goal."+str(goal.id)] = _overlay_icon(header, "art:ui.goal_lamp", "on" if goal.get("lit", false) else "off", Vector2(at - 1, 6), dim > 0)
		at += 12
	at += 4
	for action: String in ["undo", "restart", "hint", "pause"]:
		_overlay_icon(header, "art:ui.icons", action, Vector2(at, 4), dim > 0)
		var hit := Button.new()
		hit.position = Vector2(at, 3)
		hit.size = Vector2(13, 13)
		hit.focus_mode = Control.FOCUS_NONE
		for token: String in ["normal", "hover", "pressed", "focus", "disabled"]: hit.add_theme_stylebox_override(token, StyleBoxEmpty.new())
		hit.pressed.connect(func() -> void: _emit(action, {}))
		_elements["hud."+action] = hit
		header.add_child(hit)
		at += 15
	if dim > 0:
		_dim_item(header, dim)
		for child: Node in header.get_children():
			if child is CanvasItem and child.has_meta("g2_overlay_dimmed"): child.material = null


func _g2_setting_value(field: String) -> String:
	return str(_setting_row(field).display)

func _setting_row(field: String) -> Dictionary:
	for row: Dictionary in data.rows:
		if row.id==field:return row
	return {}

func refresh_volume(key: String) -> void:
	if not _volume_rows.has(key):return
	var row: Dictionary=_volume_rows[key]
	var value: float=float(_setting_row(key).value)
	(row.slider as HSlider).set_value_no_signal(value)
	(row.slider as HSlider).position=Vector2(row.origin.x+int(row.width)-11-G2.measure(str(roundi(value*10)),true)-59,row.origin.y)
	_g2_refresh_decorations()

func _visual_tick() -> int:
	return int(data.get("tick",0))

func t(key: String, _params: Dictionary={}) -> String:
	return str(model.texts.get(key,""))

func _lobby() -> void:
	set_meta("lobby_theme",data.lobby_theme)
	set_meta("lobby_skin",data.skin)
	if data.skin=="generic":
		G2.logo(self,Vector2(16,10),t("game.title"),t("game.tagline"))
		G2.coins(self,Vector2(313,6),int(data.coins))
		var width: int=104
		for item: Dictionary in data.actions:width=maxi(width,G2.measure(item.label)+24)
		for index: int in data.actions.size():
			var button: Button=_g2_overlay_action(Rect2(22,72+index*22,width,18),data.actions[index].label,index)
			button.accessibility_name=data.actions[index].label
			_elements["lobby.menu."+str(index)]=button
		var groups: Array[Dictionary]=[{"keys":["up","down"],"label":t("keys.select")},{"keys":["Enter"],"label":t("keys.confirm")}]
		var key_width: int=12
		for index: int in groups.size():
			for k: int in groups[index]["keys"].size():key_width+=G2.key_width(groups[index]["keys"][k])+(1 if k<groups[index]["keys"].size()-1 else 0)
			key_width+=3+G2.measure(groups[index].label,true)+(9 if index<groups.size()-1 else 0)
		G2.keybar(self,groups,Vector2(10+key_width/2,163))
		return
	var skin: Control=LobbySkin.new()
	add_child(skin)
	skin.configure_display(G2,data.lobby_theme,data.skin_data)
	var rows: Array[Rect2]=skin.menu_rows()
	for index: int in rows.size():
		_lobby_button(skin,rows[index],data.actions[index].label,index)
		_elements["lobby.menu."+str(index)]=buttons[index]

func _chapters() -> void:
	_g2_wall()
	G2.heading(self,Vector2(8,3),t("chapters.title"))
	_chapter_cards=Control.new();add_child(_chapter_cards)
	for index: int in data.cards.size():_chapter_nodes[index]=_make_chapter_card(index)
	_draw_cards(float(data.selected))
	call_deferred("_prepare_thumbnails")
	_update_chapter_details()
	_g2_keybar([{"keys":["left","right"],"label":"keys.select"},{"keys":["Enter"],"label":"keys.play"},{"keys":["Esc"],"label":"keys.back"}])

func _update_chapter_details() -> void:
	if _chapter_details!=null:remove_child(_chapter_details);_chapter_details.queue_free()
	_chapter_details=Control.new();add_child(_chapter_details)
	_elements["chapters.description"]=_chapter_details
	var group: Dictionary=data.cards[int(data.selected)]
	G2.text(_chapter_details,Vector2(160,114),str(group.chapter_name)+" · "+str(group.theme_name),"t",false,"c",304)
	var lines: Array[String]=_g2_lines(data.chapter_body,268,2)
	var y: int=140 if lines.size()<2 else 138
	G2.plate(_chapter_details,Rect2(20,y,280,17 if lines.size()<2 else 22))
	for index: int in lines.size():G2.text(_chapter_details,Vector2(160,y+3+index*10),lines[index],"u",true,"c")
	_page_indicator()

func _levels() -> void:
	_g2_wall(data.theme_uid)
	var list: Array=data.rows
	focus_index=int(data.selected)
	var cleared: String=t("levels.cleared")
	var cw: int = mini(140, G2.measure(cleared, true) + 28)
	G2.heading(self, Vector2(8, 3), t("levels.title"), 300 - cw)
	G2.plate(self, Rect2(312 - cw, 4, cw, 15))
	G2.icon(self, "art:ui.icons", "check", Vector2(316 - cw, 5))
	G2.text(self, Vector2(307, 7), cleared, "u", true, "r", cw - 23)
	var visible: int = mini(7, list.size())
	var start: int = clampi(focus_index - visible / 2, 0, maxi(0, list.size() - visible))
	var height: int = maxi(122, visible * 16 + 10)
	G2.panel(self, Rect2(10, 26, 152, height))
	G2.panel(self, Rect2(168, 26, 144, height))
	for index: int in list.size():
		if index < start or index >= start + visible:
			_g2_level_offpage(index)
			continue
		var item: Dictionary = list[index]
		var y: int = 31 + (index - start) * 16
		_g2_row(Rect2(15, y, 142, 15), index)
		var kind: String = item.status
		var idw: int = G2.measure(str(item.id), true)
		var lx: int = 22 + idw + 5
		var tagw: int = G2.measure(t("levels.next"), true) + 8
		var room: int = (152 - tagw - 3 if kind == "next" else 152 if kind == "open" else 138) - lx
		_g2_row_text(index, str(item.id), Vector2(22, y + 4), idw, true, "u")
		_g2_row_text(index, str(item.title), Vector2(lx, y + 2), room)
		var decoration := Control.new()
		add_child(decoration)
		_row_records.back()["decoration"] = decoration
		_row_records.back()["level_status"] = {"kind": kind, "at": Vector2(152 - tagw if kind == "next" else 140, y + 2)}
		if index - start < visible - 1: _row_records.back()["rule"] = G2.rect(self, Rect2(22, y + 15, 128, 1), "x")
	_details = Control.new()
	add_child(_details)
	_update_level_details()
	_g2_refresh_decorations()
	_g2_keybar([{"keys": ["up", "down"], "label": "keys.select"}, {"keys": ["Enter"], "label": "keys.play"}, {"keys": ["Esc"], "label": "keys.back"}])

func _update_level_details() -> void:
	if _details==null:return
	for child: Node in _details.get_children():_details.remove_child(child);child.queue_free()
	var detail: Dictionary=data.detail
	if not detail.available:
		G2.text(_details,Vector2(177,86),t("chapter.preview"),"u",true,"l",126);return
	G2.well(_details,Rect2(176,34,128,46))
	var picture: Control=ILLUSTRATION.Picture.new();_details.add_child(picture);picture.position=Vector2(177,35)
	picture.bind_provider(provider)
	var display: Dictionary=detail.picture
	picture.configure_visual(display.theme_uid,display.dimensions,display.visual_tiles,display.entities,display.tick,display.origin)
	_elements["levels.picture"]=picture
	var idw: int=G2.measure(detail.id,true)
	G2.text(_details,Vector2(177,88),detail.id,"m",true)
	G2.text(_details,Vector2(182+idw,86),detail.title,"t",false,"l",121-idw)
	G2.rect(_details,Rect2(176,101,128,1),"x")
	var description:=ScrollContainer.new();description.name="LevelDiscoveryScroll";description.position=Vector2(177,104);description.size=Vector2(126,41)
	description.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;description.vertical_scroll_mode=ScrollContainer.SCROLL_MODE_SHOW_NEVER;description.focus_mode=Control.FOCUS_NONE
	_details.add_child(description);description.get_v_scroll_bar().focus_mode=Control.FOCUS_NONE
	_elements["levels.description"]=description
	var column: VBoxContainer=G2.column(0);column.mouse_filter=Control.MOUSE_FILTER_IGNORE;description.add_child(column)
	for line: String in _g2_lines(detail.goal,126):
		var label: Label=G2.label(line,126,true);label.add_theme_font_override("font",G2.font(true));label.add_theme_color_override("font_color",_color("u"));column.add_child(label)

func _hud() -> void:
	if not data.hud.visible:
		return
	var hud: Dictionary=data.hud
	var background := ColorRect.new()
	background.color = Color("181425")
	background.size = Vector2(320, 20)
	add_child(background)
	var goals: Array = hud.goals
	var actions_start: int = 251 if screen_name == "play" else 264
	var lamps_left: int = actions_start - 8 - goals.size() * 10
	var count_left: int = lamps_left - 34
	var bag_available: bool=hud.sand_visible
	var bomb_available: bool=hud.bomb_visible
	var bag_left: int = count_left - (39 if bag_available else 0)
	var bomb_left: int = bag_left - (35 if bomb_available else 0)
	_flow_label(str(hud.title), Vector2(35, 3), maxi(30, bomb_left - 41))
	_label(str(hud.id), Vector2(5, 3), 28)
	var sand: Label = _flow_label(str(int(hud.sand)), Vector2(bag_left + 16, 3), 24)
	sand.name = "SandCount"
	sand.visible = bag_available
	var bag := TextureRect.new()
	bag.name = "SandBagIcon"
	bag.visible = bag_available
	bag.texture = _atlas("art:item.sandbag")
	bag.position = Vector2(bag_left, 2)
	bag.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bag)
	var bomb_count: Label = _flow_label(str(int(hud.bomb)), Vector2(bomb_left + 17, 3), 18)
	bomb_count.name = "BombCount"
	bomb_count.visible = bomb_available
	var bomb := TextureRect.new()
	bomb.name = "BombIcon"
	bomb.visible = bomb_available
	bomb.texture = _atlas("art:item.bomb")
	bomb.position = Vector2(bomb_left, 2)
	bomb.size = Vector2(16, 16)
	bomb.tooltip_text = t("extra.controls.bomb")
	bomb.gui_input.connect(func(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed and event.button_index==MOUSE_BUTTON_LEFT:_emit("bomb_drag_begin",{}))
	add_child(bomb)
	var bomb_preview := TextureRect.new()
	bomb_preview.name = "BombDragPreview"
	bomb_preview.texture = bomb.texture
	bomb_preview.size = Vector2(16, 16)
	bomb_preview.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bomb_preview.z_index = 100
	bomb_preview.visible = hud.dragging
	bomb_preview.position = hud.drag_at
	add_child(bomb_preview)
	var lit: int = 0
	var lamps := HBoxContainer.new()
	lamps.name = "GoalLamps"
	lamps.position = Vector2(lamps_left, 5)
	lamps.add_theme_constant_override("separation", 1)
	lamps.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(lamps)
	_elements["hud.goal"]=lamps
	for goal: Dictionary in goals:
		var lamp := TextureRect.new()
		lamp.texture = _atlas("art:ui.goal_lamp", "on" if goal.get("lit", false) else "off")
		lamp.custom_minimum_size = Vector2(9, 9)
		lamp.mouse_filter = Control.MOUSE_FILTER_IGNORE
		lamps.add_child(lamp)
		_elements["hud.goal."+str(goal.id)]=lamp
		if goal.get("lit", false):
			lit += 1
	var counter: Label = _flow_label(str(hud.progress), Vector2(count_left, 3), 32)
	counter.name = "GoalCount"
	var actions: Array[String] = ["undo", "restart", "hint", "pause"]
	if screen_name == "play":
		actions.append("observe")
	for index: int in actions.size():
		var button: Button = G2.factory_button("", func() -> void: _emit(actions[index],{}), 13, "art:ui.icons", actions[index])
		button.position = Vector2(actions_start + index * 13, 3)
		button.focus_mode = Control.FOCUS_NONE
		for style: String in ["normal", "hover", "pressed", "focus", "disabled"]:
			button.add_theme_stylebox_override(style, StyleBoxEmpty.new())
		if actions[index] == "observe":
			button.name = "ObserveButton"
			button.button_down.connect(func() -> void: _emit("observe_hold",{"enabled":true}))
			button.button_up.connect(func() -> void: _emit("observe_hold",{"enabled":false}))
		add_child(button)
		_elements["hud."+actions[index]]=button

	_elements["hud.sandbag"]=bag
	_elements["hud.sandcount"]=sand
	_elements["hud.progress"]=counter
	_elements["hud.bomb"]=bomb
	_elements["hud.drag"]=bomb_preview

func bind_provider(value: RefCounted) -> Dictionary:
	var next: RefCounted=Widgets.new()
	var checked: Dictionary=next.configure(value)
	if not checked.ok:return checked
	provider=value;G2=next
	return Contract.result([])

func apply_model(value: Dictionary) -> Dictionary:
	var checked: Dictionary=Model.validate(value)
	if not checked.ok:return checked
	if G2==null:return Contract.result(["UI requires an explicit provider"])
	checked=_preflight(value)
	if not checked.ok:return checked
	# All validation and resource preparation completes before replacing old bindings.
	for child: Node in get_children():remove_child(child);child.queue_free()
	_elements.clear();_bubbles.clear();buttons.clear();_row_records.clear();_issues.clear();_volume_rows.clear();_chapter_nodes.clear();_card_previews.clear()
	_chapter_details=null;_chapter_cards=null;_details=null;_rule_preview=null;_rule_icon=null;_rule_bag=null
	if _tween!=null:_tween.kill();_tween=null
	model=value.duplicate(true);data=model.values;screen_name=model.view_id;focus_index=int(data.focus)
	_normalize_records()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);mouse_filter=Control.MOUSE_FILTER_PASS
	match screen_name:
		"lobby":_lobby()
		"chapters":_chapters()
		"levels":_levels()
		"play":_hud()
		"pause":_pause()
		"settings":_settings()
		"hint":_hint()
		"complete":_complete()
		"rulecard":_rulecard()
		"dialogue":_dialogue()
		"controls":_controls_display()
	if data.placeholder:
		var marker: Label=_flow_label(t("dev.placeholder"),Vector2(4,164),110,true)
		marker.name="LevelPlaceholderLabel";marker.add_theme_color_override("font_color",Color("feae34"))
	if not data.runtime_error.is_empty():_flow_label(data.runtime_error,Vector2(8,140),300,true,true)
	if not buttons.is_empty():call_deferred("_focus_first")
	return Contract.result([],true)

func _preflight(value: Dictionary) -> Dictionary:
	var view: String=value.view_id
	if view!="play":
		var capability: Dictionary=Contract.require_capability(provider,"art:ui.screen."+view,"ui")
		if not capability.ok:return capability
	var embedded: Array[String]=[]
	if view=="lobby":
		if value.values.actions[0].id=="start":embedded.append("hub_start")
		if value.values.skin=="generic":embedded.append("lobby_generic")
	elif view=="pause":embedded.append("pause_help")
	elif view=="settings":embedded.append("settings_help")
	for id: String in embedded:
		var ready: Dictionary=Contract.require_capability(provider,"art:ui.screen."+id,"embedded_ui")
		if not ready.ok:return ready
	var required: Array[String]=["art:ui.panel","art:ui.icons"]
	if view in ["play","pause","hint","complete","rulecard","dialogue"]:required.append_array(["art:item.sandbag","art:item.bomb","art:ui.goal_lamp"])
	if view in ["hint","dialogue"]:required.append_array(["art:ui.bubble","art:ui.bubble_tail"])
	if view=="lobby":required.append_array(["art:ui.menu_icons","art:ui.theme_emblem"])
	for uid: String in required:
		var checked: Dictionary=Contract.require_capability(provider,uid)
		if not checked.ok:return checked
	for item: Dictionary in value.values.actions:
		if not item.icon_uid.is_empty() and not _sprite_available(item.icon_uid,item.animation,value.values):return Contract.result(["missing UI action animation"])
	if view=="rulecard":
		if not _sprite_available(value.values.icon_uid,value.values.icon_animation,value.values):return Contract.result(["missing rule icon animation"])
		if value.values.show_how:
			var ready: Dictionary=Contract.require_capability(provider,"art:ui.screen.rulecard_how","embedded_ui")
			if not ready.ok:return ready
	if view=="complete" and value.values.found:
		var ready: Dictionary=Contract.require_capability(provider,"art:ui.screen.clear_found","embedded_ui")
		if not ready.ok:return ready
	if view=="chapters":
		for card: Dictionary in value.values.cards:
			var ready: Dictionary=ILLUSTRATION.Style.theme(provider,card.theme)
			if not ready.ok:return ready
	if view in ["levels","settings","chapters","controls"]:
		var ready: Dictionary=ILLUSTRATION.Style.theme(provider,value.values.theme_uid if view=="levels" else "art:theme.dungeon")
		if not ready.ok:return ready
	# Prepare the exact sprite resources/frames used by the builders before clearing nodes.
	for frame: int in [0,1,2]:
		var ready: Dictionary=_require_sprite("art:ui.panel","",value.values,frame)
		if not ready.ok:return ready
	var sprites: Array[Dictionary]=[]
	for item: Dictionary in value.values.actions:
		if not item.icon_uid.is_empty():sprites.append({"asset_uid":item.icon_uid,"animation":item.animation})
	if value.values.has("hud") and value.values.hud.visible:
		sprites.append_array([{"asset_uid":"art:item.sandbag","animation":"full"},{"asset_uid":"art:item.bomb","animation":"default"},{"asset_uid":"art:ui.goal_lamp","animation":"on"},{"asset_uid":"art:ui.goal_lamp","animation":"off"}])
		for animation: String in ["undo","restart","hint","pause","observe"]:sprites.append({"asset_uid":"art:ui.icons","animation":animation})
		var hud: Dictionary=value.values.hud
		if not hud.class_icon.is_empty():sprites.append({"asset_uid":hud.class_icon,"animation":hud.class_animation})
	if view=="chapters":
		sprites.append_array([{"asset_uid":"art:char.portitor","animation":"idle"},{"asset_uid":"art:obj.crate_wood","animation":"default"},{"asset_uid":"art:ui.icons","animation":"lock"}])
		for card: Dictionary in value.values.cards:sprites.append({"asset_uid":"art:ui.theme_emblem","animation":str(card.theme).trim_prefix("art:theme.")})
	if view=="levels":
		for entity: Dictionary in value.values.detail.picture.entities:sprites.append({"asset_uid":entity.asset_uid,"animation":entity.animation})
		for animation: String in ["check","skip"]:sprites.append({"asset_uid":"art:ui.icons","animation":animation})
	if view=="dialogue":sprites.append_array([{"asset_uid":"art:char.portitor","animation":"idle"},{"asset_uid":"art:ui.emote","animation":"default"}])
	if view=="rulecard":
		sprites.append({"asset_uid":value.values.icon_uid,"animation":value.values.icon_animation})
		if value.values.illustration:sprites.append_array([{"asset_uid":"art:char.portitor","animation":"idle"},{"asset_uid":"art:deco.dungeon_moss","animation":"default"},{"asset_uid":"art:deco.dungeon_torch","animation":"flicker"}])
		for unit: Dictionary in value.values.how_units:
			if unit.has("items"):
				var typed: Array[Dictionary]=_records(unit.items)
				var ready: Dictionary=G2.keycaps.validate_items(typed)
				if not ready.ok:return ready
	if view=="hint":
		var ready: Dictionary=G2.keycaps.validate_segments(_records(value.values.segments))
		if not ready.ok:return ready
	if view=="controls":
		for rows: Array in [value.values.rows,value.values.secondary]:
			for row: Dictionary in rows:
				for items: Array in [row.hold_items,row.alt_items]:
					var ready: Dictionary=G2.keycaps.validate_items(_records(items))
					if not ready.ok:return ready
	for sprite: Dictionary in sprites:
		var ready: Dictionary=_require_sprite(sprite.asset_uid,sprite.animation,value.values)
		if not ready.ok:return ready
	return Contract.result([])

func _sprite_available(uid: String, animation: String, values: Dictionary) -> bool:
	if animation=="default" and uid in values.frame_zero:return G2.atlas_frame(uid,0)!=null
	return G2.atlas(uid,animation)!=null
func _atlas(uid: String, animation: String="", index: int=0) -> AtlasTexture:
	return G2.atlas_frame(uid,index) if animation.is_empty() or animation=="default" and uid in data.frame_zero else G2.atlas(uid,animation,index)
func _icon(parent: Node, uid: String, animation: String, at: Vector2, code: String="") -> TextureRect:
	return G2.icon_frame(parent,uid,0,at,code) if animation=="default" and uid in data.frame_zero else G2.icon(parent,uid,animation,at,code)
func _overlay_icon(parent: Node, uid: String, animation: String, at: Vector2, dim: bool) -> TextureRect:
	return G2.overlay_icon_frame(parent,uid,0,at,dim) if animation=="default" and uid in data.frame_zero else G2.overlay_icon(parent,uid,animation,at,dim)
func _emit(id: String, payload: Dictionary) -> void:
	intent_requested.emit(id,payload.duplicate(true))
func _activate(index: int) -> void:
	if screen_name=="levels":
		if index>=0 and index<data.rows.size():_emit("activate",{"row_id":str(data.rows[index].id)})
	elif index>=0 and index<data.actions.size():
		var item: Dictionary=data.actions[index]
		if bool(model.enabled.get(item.id,false)):_emit("activate",{"action_id":str(item.id)})
func activate_focused() -> void:
	_activate(focus_index)
func query_element(id: String) -> Control:
	var item: Variant=_elements.get(id)
	return item as Control if is_instance_valid(item) else null
func get_semantic_anchor(id: String) -> Rect2:
	if id=="hud.goal":
		var bounds:=Rect2()
		for key: String in _elements:
			var lamp: Control=query_element(key)
			if key.begins_with("hud.goal.") and lamp!=null:
				var rect: Rect2=lamp.get_global_rect();bounds=bounds.merge(rect) if bounds.has_area() else rect
		return bounds
	if id in ["dialogue.text","dialogue.bubble","dialogue.tail"] and not _bubbles.is_empty():return _bubbles[0].get_semantic_anchor(id)
	var node: Control=query_element(id)
	if node==null:return Rect2()
	if id in ["hud.undo","hud.restart","hud.hint","hud.pause","hud.observe"]:return Rect2(node.global_position,Vector2(13,13))
	return node.get_global_rect()
func reveal_state() -> Dictionary:
	var visible: int=0;var total: int=0
	for bubble: Control in _bubbles:
		var state: Dictionary=bubble.reveal_state();visible+=state.visible;total+=state.total
	return {"visible":visible,"total":total,"complete":visible>=total}
func set_reveal_progress(visible: int,total: int) -> void:
	if total!=int(reveal_state().total) or visible<0:return
	var left: int=visible
	for bubble: Control in _bubbles:
		var count: int=bubble.reveal_state().total;bubble.set_reveal_progress(mini(left,count),count);left=maxi(0,left-count)
func reveal_all() -> void:
	for bubble: Control in _bubbles:bubble.reveal_all()
func _new_bubble() -> Control:
	var bubble: Control=Bubble.new();bubble.bind_widgets(G2);_bubbles.append(bubble)
	return bubble
func _bubble_layout(value: String, minimum: int=100, maximum: int=224, limit: int=6) -> Dictionary:
	var bubble: Control=Bubble.new();bubble.bind_widgets(G2)
	var shape: Dictionary=bubble.layout_for_text(value,minimum,maximum,limit);bubble.free();return shape
func _configure_bubble(bubble: Control, text: String, area: Rect2, speaker: Vector2, name_text: String="", thought: bool=false, tail_above: bool=false, segments: Array=[]) -> void:
	var display: Dictionary={"text":text,"area":area,"speaker":speaker,"name":name_text,"thought":thought,"tail_above":tail_above,"speed":float(data.reveal_speed),"visible":10000 if data.reveal_all else 0}
	if segments.is_empty():bubble.configure_display(display)
	else:display.segments=segments;bubble.configure_keyed_display(display)
func update_hud(hud: Dictionary) -> Dictionary:
	if not data.has("hud"):return Contract.result(["view has no shared HUD"])
	var checked: Dictionary=Model.validate_hud(hud)
	if not checked.ok:return checked
	for field: String in ["id","title","class_icon","class_animation"]:
		if hud[field]!=data.hud[field]:return Contract.result(["HUD identity changed; apply a complete display model"])
	if hud.goals.size()!=data.hud.goals.size():return Contract.result(["HUD goals changed; apply a complete display model"])
	for index: int in hud.goals.size():
		if hud.goals[index].id!=data.hud.goals[index].id:return Contract.result(["HUD goal identities changed"])
	hud=checked.value
	# Counts gain visibility but do not disappear when reduced back to zero.
	hud=hud.duplicate(true)
	hud.sand_visible=bool(data.hud.sand_visible) or bool(hud.sand_visible)
	hud.bomb_visible=bool(data.hud.bomb_visible) or bool(hud.bomb_visible)
	data.hud=hud
	var sand: Label=query_element("hud.sandcount") as Label
	if sand!=null:sand.text=str(hud.sand);sand.visible=hud.sand_visible
	var bag: Control=query_element("hud.sandbag")
	if bag!=null:bag.visible=hud.sand_visible
	var bombs: Label=find_child("BombCount",true,false) as Label
	if bombs!=null:bombs.text=str(hud.bomb);bombs.visible=hud.bomb_visible
	var bomb: Control=query_element("hud.bomb")
	if bomb!=null:bomb.visible=hud.bomb_visible
	for goal: Dictionary in hud.goals:
		var lamp: TextureRect=query_element("hud.goal."+str(goal.id)) as TextureRect
		if lamp!=null:lamp.texture=_atlas("art:ui.goal_lamp","on" if goal.lit else "off")
	var progress: Label=query_element("hud.progress") as Label
	if progress!=null:progress.text=hud.progress
	var drag: Control=query_element("hud.drag")
	if drag!=null:drag.visible=hud.dragging;drag.position=hud.drag_at
	return Contract.result([],true)
func set_visual_tick(tick: int) -> void:
	if tick<0 or model.is_empty():return
	data.tick=tick
	for preview: Dictionary in _card_previews:preview.node.set_tick(tick+int(preview.index)*97)
	if _rule_preview!=null:_rule_preview.set_tick(tick)
	if _rule_icon!=null:
		var count: int=int(provider.metadata(_rule_icon_uid).get("frame_count",1))
		var phase: int=(tick/60)%mini(2,maxi(1,count))
		_rule_icon.texture=G2.atlas_frame(_rule_icon_uid,phase) if count>1 else _atlas(_rule_icon_uid,_rule_icon_animation)
func _controls_display() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);mouse_filter=Control.MOUSE_FILTER_STOP
	_g2_wall()
	G2.heading(self,Vector2(8,3),t("onb.menu.controls"))
	var label_width: int=0
	for row: Dictionary in data.rows+data.secondary:label_width=maxi(label_width,G2.measure(row.label))
	var x: int=18+label_width+10
	var alt_x: int=x
	for row: Dictionary in data.rows:alt_x=maxi(alt_x,x+G2.device_items_width(row.hold_items)+13)
	var top: int=22 if data.has_bomb else 24
	var low_height: int=12 if data.has_bomb else 13
	G2.panel(self,Rect2(8,top,304,5+data.rows.size()*13+5+data.secondary.size()*low_height+4))
	for index: int in data.rows.size():
		var row: Dictionary=data.rows[index];var y: int=top+5+index*13
		G2.text(self,Vector2(18,y),row.label);G2.device_items(self,Vector2(x,y),row.hold_items)
		if not row.alt_items.is_empty():G2.rect(self,Rect2(alt_x-7,y+1,1,10),"x");G2.device_items(self,Vector2(alt_x,y),row.alt_items)
	var divider: int=top+6+data.rows.size()*13
	G2.rect(self,Rect2(18,divider,284,1),"x")
	var note_x: int=x+G2.key_width("Tab")+14
	for index: int in data.secondary.size():
		var row: Dictionary=data.secondary[index];var y: int=divider+4+index*low_height
		G2.text(self,Vector2(18,y),row.label);G2.device_items(self,Vector2(x,y),row.hold_items)
	G2.rect(self,Rect2(note_x-8,divider+5,1,data.secondary.size()*low_height-3),"x")
	var slot: int=0
	for note: String in data.notes:
		for line: String in _g2_lines(note,302-note_x):G2.text(self,Vector2(note_x,divider+5+slot*low_height),line,"u",true);slot+=1
	_g2_keybar([{"keys":["Esc"],"label":"keys.back"}])

func layout_diagnostics() -> Dictionary:
	var cards: Array[Dictionary]=[]
	for index: int in _chapter_nodes:
		var record: Dictionary=_chapter_nodes[index]
		cards.append({"id":str(index),"card_instance":record.card.get_instance_id(),"picture_instance":record.picture.get_instance_id(),"prepared":record.picture.preparation_state().prepared})
	return {"goal_count":_created_count("hud.goal."),"chapter_cards":cards,"chapter_page_count":_created_count("chapters.page."),"issues":layout_issues()}

func _draw_keybar(groups: Array[Dictionary],at: Vector2) -> void:
	G2.keybar(self,groups,at)

func _records(rows: Array) -> Array[Dictionary]:
	var typed: Array[Dictionary]=[]
	for row: Dictionary in rows:typed.append(row)
	return typed
func _normalize_records() -> void:
	if screen_name=="levels":data.detail.picture.entities=_records(data.detail.picture.entities)
	if screen_name=="rulecard":
		data.how_units=_records(data.how_units)
		for unit: Dictionary in data.how_units:
			if unit.has("items"):unit.items=_records(unit.items)
	if screen_name=="controls":
		for rows: Array in [data.rows,data.secondary]:
			for row: Dictionary in rows:row.hold_items=_records(row.hold_items);row.alt_items=_records(row.alt_items)

func _require_sprite(uid: String, animation: String, values: Dictionary, frame: int=-1) -> Dictionary:
	if frame<0 and animation=="default" and uid in values.frame_zero:frame=0
	if frame<0:return ILLUSTRATION.Style.require_sprites(provider,[{"asset_uid":uid,"animation":animation}])
	var ready: Dictionary=Contract.require_capability(provider,uid,"sprite")
	if not ready.ok:return ready
	var metadata: Dictionary=ready.value.metadata
	var dimensions: Variant=metadata.get("size")
	var anchor: Variant=metadata.get("anchor")
	var count: Variant=metadata.get("frame_count")
	if not dimensions is Array or dimensions.size()!=2 or not anchor is Array or anchor.size()!=2 or not ILLUSTRATION.Style._pixel_integer(count):return Contract.result(["invalid UI raw sprite sheet"])
	for value: Variant in dimensions+anchor:
		if not ILLUSTRATION.Style._pixel_integer(value):return Contract.result(["invalid UI raw sprite geometry"])
	var texture: Texture2D=provider.texture(uid)
	if texture==null or dimensions[0]<=0 or dimensions[1]<=0 or count<1 or frame>=count or texture.get_width()!=int(dimensions[0])*int(count) or texture.get_height()!=int(dimensions[1]):return Contract.result(["missing or malformed UI texture: "+uid])
	return Contract.result([])

func _created_count(prefix: String) -> int:
	var count: int=0
	for id: String in _elements:
		var node: Control=query_element(id)
		if id.begins_with(prefix) and node!=null and is_ancestor_of(node) and not node.is_queued_for_deletion():count+=1
	return count

func _settings_wheel(event: InputEvent) -> void:
	if screen_name!="settings":return
	if event is InputEventMouseButton and event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]:move_focus(-1 if event.button_index==MOUSE_BUTTON_WHEEL_UP else 1)
