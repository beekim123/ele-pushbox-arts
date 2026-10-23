# 渡界人 · PORTITOR 美术工作台

仓库：https://github.com/beekim123/ele-pushbox-arts

独立的美术、地图概念与声音工作台。双击 `workbench/index.html` 打开总览；左栏有资源库、场景与界面、确认、地图概念、声音和文档。文档入口可搜索并阅读 `docs/design/` 的设计文档，新增或修改文档后运行 `node tools/docs.mjs build` 更新离线目录。资源库筛选会保存在地址中，旧地址仍可打开。游戏开发在独立的私有仓库进行。

玩法设计文档在 `docs/design/gameplay/`，工作台“文档”里可读。

在「资源库」按模式、主题 / 地图、用途、资源类别和确认状态筛选；配送可查看渡口 / 伙计 / 剧情关联素材及音效。点卡片进入预览、动画、编辑与确认流程。状态默认全部，概念稿不会隐藏；共用资源引用同一 ID，去重后为 304 项。

模式入口是公开美术资源索引，不导入游戏的私有关卡、房间、解法或SDK；分组维护在 `workbench/js/app/mode-catalog.js`，不修改冻结素材。

需要 Node.js 18+：
```sh
node tools/art.mjs build
node tools/art.mjs verify
node tools/audio.mjs build
node tools/audio.mjs verify
node tools/docs.mjs build
node tools/docs.mjs check
node --test --test-concurrency=1 tests/*.test.mjs
node tests/workbench.smoke.cjs
```

许可证：代码采用 [MIT](LICENSE)；原创美术与声音采用 [CC BY-NC-SA 4.0](LICENSE-ASSETS.md)。游戏名、标志和列明的角色素材保留权利，不在 CC 授权范围内；字体保留各自 OFL 许可证。

暂不接受外部贡献请求。确认记录只反映用户明确给出的美术确认。快照说明见 SNAPSHOT.md，来源见 PROVENANCE.md。

已发布 Godot 原生包 `godot-art-v1.0.0` 的生产格式、无 Node 消费接口、混合许可与独立验证边界见 [godot/README.md](godot/README.md)。该固定版本与本仓库后续工作台候选分开；本批76项review已于2026-10-21按用户原话记入APR-0011；6项概念仍为draft。新增批准尚未纳入新原生包或游戏。

本批资源在工作台「确认」选择「离线交付」批次查看：选「已确认」看76项，选「全部」另含6项概念；说明、演示数据边界和实际接收成绩见 [接收记录](art/review/OFFLINE-ART-20261020/RECEIVED.md)。

`art-pack.json` 仍是上次固定资源版本的清单，工作台新增候选后在当前main运行 `pack.mjs check` 会拒绝清单差异，这是未发布状态；不能把此目录按旧版本号直接导入游戏。旧标签和游戏资源锁保持不变，后续批准与新版本发布另行进行。

美术规范、界面风格、声音和工作台设计以本仓库 [`docs/design/`](docs/design/) 为唯一来源；新页面先登记到 `content/screens/screens.json`、画出 HTML 并经用户确认后，才进入游戏。
