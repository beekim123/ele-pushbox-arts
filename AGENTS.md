# 《渡界人》公开美术仓库

这是《渡界人》的公开美术仓库，游戏在私有仓库。美术仓库：https://github.com/beekim123/ele-pushbox-arts.git。

- 只有用户能确认具体 id、版本和哈希；默认选择、测试通过、风格认可不能代替确认。未经明确用户原话不得运行 approve。
- art/source、art/approvals.json、art/history、art/export/approved、绘制 core 和冻结文字表参与内容哈希；不覆盖已确认版本，不为过测试改哈希或阈值。工作包未明确允许时换版本数必须为 0。
- 新文字放 content/i18n-<名>/，新字形用独立 font-<名>.js；不改已确认画法。字体须同时追加到 art.mjs、i18n 测试和 index.html 的加载清单。
- SNAPSHOT.md 列出的快照来自游戏仓库，不手改；只有用户同意公开更新后，从游戏仓库整体刷新，再构建并重新确认变化素材。
- 自动化测试使用临时目录，不写真实源和确认记录。build/verify、Node 和浏览器检查通过也不等于用户验收。
- 编号只在私有游戏仓库登记，美术包放本仓库 docs/packages/；这里不写游戏计划、SDK、私有关卡、房间或剧情数据。
- 交回短分支或 bundle，不合 main、不强推、不删分支、不改已发布 art-v 标签。资源版本由合并方生成清单、提交、打固定标签；游戏按该标签离线导入。
- 全机最多 2 个计算任务/worker；默认单 worker，数值库线程 1。启动前检查已有计算，结束时只清理自己的进程。
- 原生 Godot 候选从真实已提交 producer 构建：`tools/pack-godot.mjs`；`tools/verify-godot-pack.mjs` 将实际 ZIP 安装到独立宿主，使用人工公开显示数据。运行前绑定源提交、ZIP/manifest/payload/renderer/fixture 身份，保留失败和未测项；技术票不能替代素材确认、游戏可玩性或正式发布。
- 测试报告放 `godot/verification/`，回执为有限非执行元数据；功能参数只在 runtime index。不得为测试带入游戏适配器、SDK 编码、真实关卡/剧情或私有截图，不刷新 SNAPSHOT。首次 native 对照来自 T7 本地载体及提取来源，不虚称已有上一正式 native 包。
