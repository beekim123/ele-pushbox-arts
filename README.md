# 渡界人 · PORTITOR 美术工作台

仓库：https://github.com/beekim123/ele-pushbox-arts

独立的美术、地图概念与声音工作台。双击 `workbench/index.html` 打开。游戏开发在独立的私有仓库进行。

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

已发布 Godot 原生包 `godot-art-v1.0.0` 的生产格式、无 Node 消费接口、混合许可与独立验证边界见 [godot/README.md](godot/README.md)。该固定版本与本仓库后续工作台候选分开；当前82项离线交付尚未批准、未接入原生包或游戏。

新增候选在工作台「美术 → 确认」选择「离线交付」批次查看；说明、演示数据边界和实际接收成绩见 [接收记录](art/review/OFFLINE-ART-20261020/RECEIVED.md)。

`art-pack.json` 仍是上次固定资源版本的清单，工作台新增候选后在当前main运行 `pack.mjs check` 会拒绝清单差异，这是未发布状态；不能把此目录按旧版本号直接导入游戏。旧标签和游戏资源锁保持不变，后续批准与新版本发布另行进行。
