# 美术工作包

编号统一由私有游戏仓库登记；本仓库只存美术/声音包及交付，暂不接受外部贡献请求。

当前队列：[美术仓库改造第二轮](workbench-queue-2.md)（2026-10-23，WB-14、WB-15、DSN-11、WB-16）。上一轮：[美术工作台改造队列](workbench-queue.md)（WB-08–WB-13 已合并，BR-06 美术部分已合并、游戏侧搁置）。

## 模板

- 编号、状态、预计时长：填写登记编号。
- 仓库：https://github.com/beekim123/ele-pushbox-arts.git
- 基线：origin/main；制作分支：art/<编号>。
- 目标、必读文件、可改文件、共享文件、允许换版本的资产：逐项写明，没列出的不能改。
- 冻结区和 SNAPSHOT.md 的快照不得擅自修改；不批准素材。
- 开工：git fetch origin；git worktree add ../pushbox-arts-<编号> -b art/<编号> origin/main。
- 边做边跑：本包相关定向测试。
- 最后检查：node tools/art.mjs build（只允许指定换版本）；node tools/art.mjs verify；node tools/audio.mjs verify；node --test --test-concurrency=1 tests/*.test.mjs；node tests/workbench.smoke.cjs。
- 交回：git push -u origin art/<编号>；无法推送用 git bundle create <编号>.bundle origin/main..art/<编号>。
- 交付（40 行以内）：提交号、实际检查结果、允许的换版本清单、遗留、当前阶段、下一步及执行人。包未授权的扩大修改先说明。

## 模块归属交回

- [ART-07](ART-07.md)：组合owner元数据与导出技术验收通过，69项归属供用户过目；只交回 `art/ART-07-owner`，不合main、不发布或新增批准。
