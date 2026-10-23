# ART-07 组合资产的 owner 元数据

状态：用户确认当前归属清单，已普通合并入美术 main；暂不发布、不打标签、不导入游戏。

仓库：[beekim123/ele-pushbox-arts](https://github.com/beekim123/ele-pushbox-arts)。基线为 `83b198304ebecd61fba8eef266e793e9c0655f7f`，制作分支为 `art/ART-07-owner`。本包无前置，预计 1–2 小时；单包超过 4 小时应停下交接。遵守本仓库 `AGENTS.md` 和 `SNAPSHOT.md`。

## 目标和范围

给组合资产标明 `common / lab / delivery / story / hell` 归属，使消费方能够检查组合的使用边界。单件素材保持公共。owner 属于导出元数据，不是素材内容或用户确认身份。

允许新增 `art/owners.json`、所有权读取与校验辅助文件、定向测试和本文；允许在美术清单、Godot 打包器及 Catalog 元数据校验中接入 owner。发布文件清单只补充新 metadata/helper。不得修改已确认素材、审批、历史、已批准 PNG、renderer、快照、旧版本标签或固定原生包 BASE。

## 要做

1. `theme.*`、`ui.screen.*`、其他程序化 `ui.*`、`scene.*`、`material.*` 的 owner 显式记录在独立表中。角色、装饰、动物、机关、道具、货物、怪物、特效、头像、箱子和 UI 单件图标保持 `common`，可省略映射。程序化单件 `ui.action_icon`、`ui.key_cmd` 也保持 `common`。
2. owner 不进入 `CONTENT_KEYS`、素材内容哈希、版本、PNG 哈希或 approved identity。新 producer 必须有 owners 表；缺表、表不完整、未知编号、非法 owner、单件非公共归属必须在 build 的任何素材写入之前拒绝。读取既有 native catalog 时仍允许旧包没有 owner 字段。
3. 初始归属按下列清单填写。所有主题共用；拿不准的组合先标 `common` 并列出问题，不改现有编号。
4. 新组合命名使用 `ui.<模式>.<名字>`，公共组合使用 `ui.common.<名字>`。已有组合不改名，改名意味着新编号和重新确认。内容不变时抽为公共只改 owner；内容改变则创建新编号。
5. 美术 manifest 和 Godot runtime catalog 导出 owner。原生打包只读取真实 producer commit 中的 owners 输入，并验证执行的 helper 与该提交的字节相同；不得混入未提交的归属覆盖。

不发布 release、不打标签、不批准素材、不导入游戏，也不重写旧技术票据。

## 用户确认的归属清单（2026-10-24）

完整映射在 [`art/owners.json`](../../art/owners.json)，共 69 项组合。

| owner | 数量 | 现有编号 |
|---|---:|---|
| lab | 11 | `ui.screen.chapters`、`ui.screen.levels`、`ui.screen.hint`、`ui.screen.complete`、`ui.screen.rulecard`、`ui.screen.rulecard_how`、`ui.screen.pause`、`ui.screen.pause_help`、`ui.screen.clear_found`、`ui.screen.hud_keys`、`ui.screen.observe` |
| delivery | 21 | `ui.screen.delivery_assist`、`ui.screen.delivery_help`、`ui.screen.delivery_hud`、`ui.screen.delivery_pause`、`ui.screen.delivery_practice`、`ui.screen.run_door`、`ui.screen.run_door_skull`、`ui.screen.run_event`、`ui.screen.run_lucky`、`ui.screen.run_map`、`ui.screen.run_quit`、`ui.screen.run_rest`、`ui.screen.run_result`、`ui.screen.run_shelf`、`ui.screen.run_wish_card`、`ui.screen.run_wish_give`、`ui.screen.reels`、`ui.screen.settlement`、`ui.screen.settlement_fail`、`ui.screen.shop`、`ui.screen.hint_animal` |
| story | 9 | `ui.screen.story_board`、`ui.screen.story_chapter`、`ui.screen.story_complete`、`ui.screen.story_letter`、`ui.screen.story_order`、`ui.screen.lobby_story`、`ui.screen.crew_joined`、`ui.screen.crew_pick`、`ui.screen.crew_room` |
| hell | 0 | 本次没有地狱专用组合，不创建资产或新编号 |
| common | 10 | `theme.candy`、`theme.cave`、`theme.cosmos`、`theme.diyu`、`theme.dungeon`、`theme.forest`、`theme.jeju`、`theme.polar`、`theme.ruins`、`theme.sky` |
| common | 8 | `ui.screen.lobby`、`ui.screen.lobby_generic`、`ui.screen.settings`、`ui.screen.settings_help`、`ui.screen.controls`、`ui.screen.dialogue`、`ui.screen.confirm`、`ui.screen.hub_start` |
| common | 6 | `ui.action_icon`、`ui.key_cmd`、`ui.keyhint`、`ui.hud_glow`、`ui.goal_glow`、`ui.cause_link` |
| common | 4 | `material.chapter2_5`、`scene.hub_crew`、`scene.hub_gallery`、`scene.hub_post` |

## 已知问题与发布边界

- `ui.keyhint`、`ui.hud_glow`、`ui.goal_glow`、`ui.cause_link` 的最终共享范围尚未明确，按本包默认归公共；用户于2026-10-24确认按当前清单保持。
- `ui.screen.observe` 的历史名称提到配送，但本包明确要求归 `lab`；本次遵循包规格并保留历史名称和编号。
- 没有 `ui.screen.onb_*` 资产。`onb_*` 是原有渲染参数，不能据此生成新的 owner 编号。
- 本包没有导入游戏。以后导入 owner 后，现有公共界面或冻结配送清单如果引用了 `lab` 组合，可能触发 `foreign_owner`。用户已确认保持当前归属，本次不改游戏；未来实际导入若遇到边界冲突，再由单独任务决定抽公共或随模式重做替换。
- 当前 main 的原生打包器固定于 `4976323c7bd1d7706602d4d4c3dfbc11e673d10b`。本包改动之前，直接打包 main 已因 `frozen source/media changed: art/approvals.json` 拒绝；这是较新作者审批与固定 native-v1 的既有边界，不能为本包改 BASE 或改旧审批／manifest 通过。
- 定向导出验证沿用既有测试支持的临时 committed frozen-v1 producer：仅在临时仓库恢复 BASE 审批／manifest，并移除不属于该合成 producer 的技术票。结果只证明 owner 导出与身份隔离契约，不证明当前 main 原生候选重新验收通过。catalog metadata 改变会真实改变 runtime payload／renderer SHA，旧技术报告不得回填为新 SHA。

## 验收

- 合并方正式运行 build / verify：0 bumped，确认记录条数不变；单 worker Node 和 `workbench.smoke.cjs` 通过。
- 导出 catalog 的每项组合都有合法 owner，单件仍为公共。
- 定向所有权契约在隔离输入上验证完整表、合法枚举、单件公共、内容／审批身份不变，以及真实 committed ZIP 的 owner。
- 真实源、审批、历史、批准 PNG、renderer 和快照与开工前冻结收据一致。

## 原分支交付（不超过 40 行，保留当时交回边界）

- 制作提交 `f948aba`；本分支 `art/ART-07-owner` 交回，不合美术main、不发布/打标签、不批准或导入游戏。
- 独立 owners 表登记69组合：common28、lab11、delivery21、story9、hell0；完整编号见上表，单件公共，不改已有ID。
- build写版本/哈希前验证完整表、unknown/enum和单件common；manifest/bundle/native catalog导出owner，不进CONTENT_KEYS或approved identity。
- 原生packer只读committed owner并绑定helper字节；Catalog可选owner兼容旧包，未来新payload/renderer SHA真实变化，旧技术票不升级。
- 定向7/7 GREEN；最后Catalog判定同步后仅实际ZIP单项再过。合成committed frozen-v1包221项批准身份与媒体字节不变，不等于当前main新候选验收。
- 最终合成首manifest SHA e8a1a928b22aac839263b71e4feab1334d10306d4537c10e54286c9744592b79，次manifest e4f7cfd3107501b4ecc6ba31ee83e90b7ba1372cd1479303be6e78074321475b。
- `node tools/art.mjs build`：304资产、0 bumped、117参考图、11确认记录；`verify`：304资产/11记录通过。原1条声音确认不变。
- `node --test --test-concurrency=1 tests/*.test.mjs`：145/145、0失败、0跳过，单worker。
- `node tests/workbench.smoke.cjs`：首次docs跳转竞态首败，未改main同处复现；只补等待后失败smoke整项通过，196双语言状态/46默认像素/可见内容/无浏览器错误。Node/build已过项未重跑。
- 1151冻结文件、304源资产ID/版本/内容hash、421导出图片逐字节不变；manifest除owner全等，源/审批/历史/已批准PNG/renderer/SNAPSHOT零改。
- 范围：制作12文件正向增长28821B；美术仓库无游戏scope脚本，按本包精确路径白名单/新文件1MiB/分支20MiB门槛核验，交付两文档后再核。
- 旧测试只补owner/helper复制路径各1行，断言/阈值无改；包清单补2路径。清单外必要小改：smoke等待目标article，2加1删共3行，原断言/期望/timeout和生产UI不变。
- 原始定向/首败/main复现/正式日志和合成ZIP存仓库外ART-07；仓库仅本交付摘要和正常生成物，不带本机路径/私有数据。
- 既有：当前main native-v1 pack因frozen approvals拒绝；不改BASE或旧票通过。未来导入可能遇到旧公共/配送引用lab组合，用户先过目归属再决定抽公共或随模式重做。
- 下一步及执行人：用户过目69组合及上节问题，决定候选1.1.0是否另行发布（含owner）及是否另派多模式大厅美术包；当前队列不执行这些动作。

## 用户确认与合并记录（2026-10-24）

- 用户原话：“ART-07 归属按当前清单，合并进美术仓库 main，暂不发布、不打标签，也不导入游戏。”该授权覆盖原分支交回时“不合main”的边界；不表示新增素材或声音批准。
- 69项组合映射保持原字节；制作f948aba、交付e788017普通合并为 `9a34ff9a0a3c1c779807ec23479b244b422960ea`，没有冲突，合并代码树与原已验分支完全相同。
- 合后 `tools/art.mjs verify`：304资产、11条确认记录通过；owner定向7/7、0失败/跳过。1151冻结文件原字节不变，无新增审批、素材换版或快照变动；先前Node145/完整工作台smoke原票保留，不重复整套。
- 这次仅将owner工具与元数据正式合入美术main，没有生成或发布正式版本、打标签、改旧票哈希或向游戏导入。既有native-v1固定审批基线限制保持。
- 当前阶段：ART-07归属确认和美术main集成已完成。下一步由后续另行获授权的负责人处理发布或游戏导入；当前无需用户操作，本项已结束。
