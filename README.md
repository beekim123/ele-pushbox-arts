# 渡界人 · PORTITOR 美术工作台

仓库：https://github.com/beekim123/ele-pushbox-arts

独立的美术、地图概念与声音工作台。双击 `workbench/index.html` 打开。游戏开发在独立的私有仓库进行。

左侧「关卡模式」「配送模式」按章节主题 / 地图分别管理资源：角色与生物、物品与装饰、机关与特效、界面与引导、音效；配送另列渡口 / 伙计 / 剧情候选。每项可以进入原有预览、动画、编辑与确认流程。状态默认全部，概念稿不会隐藏。共用资源在两边引用同一ID，去重后仍是304项。完整清单也可在「美术 → 资产与动画」查看。

模式入口是公开美术资源索引，不导入游戏的私有关卡、房间、解法或SDK；分组维护在 `workbench/js/app/mode-catalog.js`，不修改冻结素材。

需要 Node.js 18+：
```sh
node tools/art.mjs build
node tools/art.mjs verify
node tools/audio.mjs build
node tools/audio.mjs verify
node --test --test-concurrency=1 tests/*.test.mjs
node tests/workbench.smoke.cjs
```

许可证：代码采用 [MIT](LICENSE)；原创美术与声音采用 [CC BY-NC-SA 4.0](LICENSE-ASSETS.md)。游戏名、标志和列明的角色素材保留权利，不在 CC 授权范围内；字体保留各自 OFL 许可证。

暂不接受外部贡献请求。确认记录只反映用户明确给出的美术确认。快照说明见 SNAPSHOT.md，来源见 PROVENANCE.md。

已发布 Godot 原生包 `godot-art-v1.0.0` 的生产格式、无 Node 消费接口、混合许可与独立验证边界见 [godot/README.md](godot/README.md)。该固定版本与本仓库后续工作台候选分开；本批76项review已于2026-10-21按用户原话记入APR-0011；6项概念仍为draft。新增批准尚未纳入新原生包或游戏。

本批资源在工作台「美术 → 确认」选择「离线交付」批次查看：选「已确认」看76项，选「全部」另含6项概念；说明、演示数据边界和实际接收成绩见 [接收记录](art/review/OFFLINE-ART-20261020/RECEIVED.md)。

`art-pack.json` 仍是上次固定资源版本的清单，工作台新增候选后在当前main运行 `pack.mjs check` 会拒绝清单差异，这是未发布状态；不能把此目录按旧版本号直接导入游戏。旧标签和游戏资源锁保持不变，后续批准与新版本发布另行进行。
