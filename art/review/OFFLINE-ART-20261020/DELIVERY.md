# OFFLINE-ART-20261020 原离线制作交付说明

> 以下成绩与354文件计数是原离线环境的历史记录。接收时未采用原UI样张/变体图；目标仓库的脱敏修正、真实验证和版本以 [接收记录](RECEIVED.md)、receipt.json、render-report.json 及当前manifest为准。

结果：82/82 项全部制作完成，全部待用户确认（伙计概念 6 项 `draft`，其余 76 项 `review`），没有生成任何确认记录。

## 完成范围（82 项）
- 配送素材 ART-05a/05b/05c 25 项：地府门牌灯笼、局内小图标、事件摊、长椅、暗缝、改签符 / 怀表 / 沙漏、13 件心愿物、地府印章 / 信号弹、冰块、地图碎片、增益图标表。
- 配送界面 UI-12a/12b/12c 11 张：门牌、骷髅门牌 + 改签、小地图、货架、歇脚、收工、事件、结算、心愿卡、上上签、交付心愿。
- 伙计概念 ART-06a 6 项（draft）；完整候选 ART-06b 6 项、ART-06c 8 项（灯花、小海女、情书、纪念物、家里摆件、纸扎小楼）。
- 渡口场景 ART-06d 3 项：邮局 / 伙计房 / 展览角，before / after 两状态 + 分层源。
- 剧情与伙计界面 UI-13a 6 张、UI-13b 3 张；教学与辅助界面 3 张（教学回顾、练习房、辅助选项）。
- 配送动作扩展 6 套（渡界人 + 5 位伙计：carry_small / carry_large / hurt / down / slide / swim / sit）。
- 地图通用补齐 5 项：石牢 / 济州门牌、通用信号弹 / 印章、白百合。

## 交付内容（delivery/new-art，354 个文件）
- 可编辑素材源 JSON 82 个；透明 PNG 图集 82 张；23 张界面中英文参考图 46 张。
- 新画法 / 字体模块 12 个（顺序见 HANDOFF.json `load_order`）；新文字表 6 组 × 中英 12 个。
- 布局合同 `art/contracts/offline-art-layout.json`：门牌两块 8×8 空位、持物点 / 镜像 / body anchor、UI 图标槽与布局常量、23 张样张参数、场景图层。
- 审阅图 `art/review/OFFLINE-ART-20261020/`：概念对比、三图对照（ART-06a/on_maps.png）、逐动作预览与带货示例（delivery/）、渡口两状态 PNG + layers.json + 分层 PNG（hub/）、各组界面中英对照与变体拼图；CHOICES.md、PROCESS-NOTES.md、本文件。
- 交接：HANDOFF.json（逐文件 sha256 与资源状态）、HANDOFF-NEW-ART-REPO.md、import-new-art.mjs。

## 实际验证（包根运行）
- `node tools/job.mjs build` → text layout: 0 issue(s) in shipped locales（伪语言 155 条仅参考）；build ok: 304 assets, 0 bumped, 117 reference renders, 10 approval records。
- `node tools/job.mjs check` → verify ok: 304 assets, 10 approval records；job check ok: 82 项候选；旧素材保持不变。
- `node tools/job.mjs export` → 生成 delivery/ 与 PORTITOR-Art-DELIVERY-20261020.zip（354 个文件 + 3 个交接文件）。
- 另：UI-12b / 12c / 13b / 教学组的参数变体样张逐张查截字缺字，0 问题（各组 variants.txt）。

## 遗留问题（不是缺项）
- 全部待用户确认；伙计外观按制作方推荐 A 方向完成，B / C 只有概念稿（见 CHOICES.md）。
- 界面数值是样张值，等玩法对齐；run_event 插图、run_rest 背景用已有素材占位合成。
- 已有文字表里 goblin_smith 英文规则 261px 超宽：按“只新增文件”没改，需在新仓库改原文。
- 未做 Godot / 玩法接入，也未在新仓库构建；接收方按 HANDOFF.json 登记模块后自行 build / verify。

## 用户确认（在新仓库 build 后执行，版本号以新仓库 manifest 为准）
`node tools/art.mjs approve --items <id>@v<N>[,<id>@v<N>] --by <用户> --via chat|workbench --scope "<范围>" --note "<用户原话>"`
