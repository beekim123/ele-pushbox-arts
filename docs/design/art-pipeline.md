# 美术流程：源数据、版本、确认与交付

本文规定美术从制作到进入 Godot 的唯一路径。规则由 `tools/art.mjs` 执行，并由 `tests/art-pipeline.test.mjs`、`tests/workbench.e2e.cjs` 检查。

原生 Godot 包的制作与独立宿主验证另见 `godot/README.md`。候选技术验证和下文的用户素材确认分别记录；两者都不能替代最终发行文件的许可/哈希确认。

## 1 数据位置

| 路径 | 内容 | 谁写 |
|---|---|---|
| `art/source/<分类>/<id>.json` | 每件资产的**唯一源数据**：像素帧（调色板字符）或程序化参数 | 美术负责人；工作台导入 |
| `art/approvals.json` | 确认记录，只追加 | 只能由 `tools/art.mjs approve` 写入 |
| `art/history/<id>@v<N>.json` | 被确认版本的源数据快照，不再修改 | `approve` 自动写入 |
| `art/export/approved/<id>@v<N>.png` | 被确认版本的导出图，不再修改 | `approve` 自动写入 |
| `art/export/preview/<id>.png` | 当前版本的导出图（未确认时只能当占位） | `build` |
| `art/export/reference/*.png` | 代表画面与关卡参考图（HTML 与游戏对照用）：`showcase.<主题>`、`chapter.<主题>`（第 2–5 章）、`lobby.<主题>`、`level.<编号>`、`<界面>.<语言>` | `build` |
| `art/export/manifest.json` | 交付清单：版本、哈希、状态、帧规格、锚点、动画、九宫格 | `build` |
| `workbench/data/bundle.js` | 工作台读取的数据包 | `build` |

## 2 源数据格式（`pushbox.art/1`）

- `kind: "sprite"`：`size`（帧宽高）、`anchor`（锚点）、`frames`（每帧为字符串行，`a`–`z`、`A`–`F` 对应 ENDESGA 32，`.` 透明）、`animations`（`{名称: {fps, loop, frames:[帧序号]}}`）、可选 `ninepatch`（上、右、下、左）。
- `kind: "procedural"`：`renderer`（绘制代码文件）、`params`（参数）、`depends`（用到的其他资产）。主题（`theme.*`）、第 2–5 章材料（`material.chapter2_5`）与界面画面属于这一类。
- 公共字段：`id`、`name`、`category`、`layer`、`version`、`stage`（`draft` 或 `review`）、`usage`、`notes`、`content_hash`（由工具维护）。

**内容哈希**：对 `kind`、`size`、`anchor`、`palette`、`frames`、`animations`、`ninepatch`、`params`、`renderer`、`depends` 做规范化 JSON 后取 SHA-256。程序化资产还要加上绘制代码文件的哈希，以及所依赖资产的内容哈希。因此修改绘制代码或改动被引用的精灵，界面画面也会生成新版本。

**新界面不碰已确认的文件**（2026-10-16，配送切片第 4 步起）：`content/i18n/*.json`、`font-data.js`、`font-small.js`、`ui.js` 参与已确认界面的哈希，改它们会让那些界面全部回到待确认。所以新的一批界面：

- 文字放自己的表 `content/i18n-<名>/<语言>.json`（配送切片是 `content/i18n-delivery/`；开发方是 `content/i18n-extra/`）。工具把所有表合并读入，一个键只能出现在一张表里，每张表都要有每种语言，否则内容检查报错。
- 缺的字形用 `python3 tools/build-font.py --ext <名>` 生成 `workbench/js/core/font-<名>.js`：只补字体里没有的字，不替换任何已有字形，已画好的东西一个像素都不变。直接运行 `build-font.py` 会拒绝改冻结的字体文件（要改必须加 `--rebuild-frozen`，只有美术负责人在用户要求下才这样做）。`art.mjs verify` 检查每条文字的每个字都有字形（缺字形会悄悄画成"?"）。
- 画法写在新文件里（配送切片：`workbench/js/core/ui-delivery.js`，把新界面登记进 `PB.ui.SCREENS`），不改 `ui.js`。新界面的 `renderer` 列出它真正用到的文件（含自己的文字表和字形文件），`depends` 列出它画的所有精灵。

## 3 版本与状态

- 每次 `build` 都会重新计算哈希。若与 `content_hash` 不同，`version + 1`，阶段回到 `review`。旧的已确认版本仍保留在 `history/` 与 `export/approved/` 中。
- 状态只由确认记录推导：当前 `id`、`version`、`hash` 三者都与某条记录一致，才是"已确认"。不存在可以手动改动的"已批准"开关。
- 工作台中的"本地修改"只存在于浏览器，不算任何版本。

## 4 确认

1. 用户打开 `workbench/index.html` →「确认」页，勾选自己看过并认可的项，填写需要修改的意见。
2. 点「复制确认文字」发到聊天里，或「下载确认文件」交给 Claude。文字中每一项都带有 `id@v版本 #哈希前 12 位`。
3. Claude 核对后执行（只记录用户实际给出的确认）：

```sh
node tools/art.mjs approve --items char.miner@v1,obj.crate_wood@v1 --by "用户" --via chat --scope "第一批：角色与箱子" --note "聊天确认原话或链接"
node tools/art.mjs approve --from-file pushbox-approval-request-….json --by "用户" --via workbench
```

`approve` 会拒绝以下情况：版本不是当前版本；源数据在上次构建后被改过；确认文件中的哈希与当前内容不一致。批量确认的记录会逐项列出资产与版本。

用户在聊天中直接回复"通过 xxx"也算确认，但必须能对应到具体的 `id@v版本`。只说"风格认可"或"差不多"，不能当作确认。

## 5 编辑回流

工作台「编辑与对比」中的每一笔都会自动暂存在浏览器。「导出」页下载 `pushbox-art-edits-*.json`，然后：

```sh
node tools/art.mjs import pushbox-art-edits-….json   # 写回源数据，并自动 build（版本 +1，阶段改为待确认）
```

## 6 交付给 Godot

- Godot 只读取 `art/export/manifest.json`。对每个要用的资产，取 `approved` 字段给出的 PNG，并用 `png_sha256` 校验；发布构建遇到 `approved == null` 的资产时必须报错。开发构建可以加载 `current.preview` 作为占位，但界面上要显示"占位"标记。
- 精灵图是横向条带，第 i 帧位于 `x = i × 帧宽`。锚点、动画（帧序号、fps、是否循环）、九宫格边距都以 manifest 为准，不要在游戏里重新定义。
- 导入设置：最近邻采样，关闭 mipmap 与压缩（无损），不做任何颜色处理。
- 地形不是贴图：游戏着色器必须按 `workbench/js/core/terrain.js` 的规则逐像素着色，主题参数取已确认的 `theme.*` 资产的 `params`；生态按 `workbench/js/core/ambient.js` 的规则摆放。静态材料使用同一个 `h32` 位置哈希。
- 第 2–5 章的材料（`material.chapter2_5`）按 `workbench/js/core/matter.js` 的 `SHADE` 逐像素着色；机关、收集斗刻度、水上木箱、观察模式的画法按同一文件的 `drawDevices`、`floating`、`drawObserve`。气体在游戏中按 SDK cell 绘制，颜色规则不变。
- 界面画面（`ui.screen.*`）是布局参考图，每个都有简中、英文两版（`art/export/reference/<界面>.<语言>.png`）。Godot 用 Control 节点实现，元素位置、字号、颜色以参考图为准，并逐像素对照（动态文字和进度数字除外）。

## 7 一致性检查

| 检查 | 方法 | 已自动化 |
|---|---|---|
| 导出 PNG = 源数据 | `node tools/art.mjs verify`：解码 PNG，与源数据重新绘制的结果逐字节比较 | 是 |
| 工作台画面 = 导出 PNG | `tests/workbench.e2e.cjs`：浏览器内绘制的结果与参考 PNG 逐字节比较 | 是 |
| 确认记录完整 | `verify`：已确认的 PNG 与历史源数据存在且哈希一致 | 是 |
| 关卡参考图 | `level.*.png` 关闭环境效果绘制，供 Godot 逐像素对照；`showcase.*.png` 与 `chapter.*.png`（第 2–5 章代表场景）开启默认环境效果，供审稿 | 是 |
| 界面文字放得下 | `verify`：每个界面按简中、英文各排一次，不得有换行截断、省略或丢弃；伪本地化结果记录在 manifest 的 `text_issues` 中供参考 | 是 |
| Godot 画面 = 参考图 | 在 Godot 中把 `showcase.mine` 与 `level.M01–M07` 按参考图同样的状态渲染到 320×180 视口并截图，与 `art/export/reference/` 逐像素比较；沙、水只比较颜色集合（SDK 颜色位随机） | 待 GPT 实现 |

已知的跨渲染器差异必须如实记录在这里，不能用"差不多"代替。目前已知两处：(1) 游戏中沙、水的颗粒颜色来自 SDK 随机颜色位；(2) 游戏中材料按 SDK cell 形成坡面，工作台按整格绘制。
