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

本地 Godot 原生候选的生产格式、无 Node 消费接口、混合许可与独立验证边界见 [godot/README.md](godot/README.md)。候选不表示已发布、增加素材确认或完成实际文件/许可清单的用户确认。
