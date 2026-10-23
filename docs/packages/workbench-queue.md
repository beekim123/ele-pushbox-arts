# 美术工作台改造队列（一个窗口按顺序做完）

更新：2026-10-23。用户原话：「我要一个一个给太麻烦了，你做个提交，只给我一段提示词，可以让 gpt 一个窗口全部做完的那种」。

本文件给**一个 GPT / Codex 窗口**用：在用户的 Mac 上，按第 2 节的顺序把 7 个包一个接一个做完。这个窗口同时当制作方和合并方：每个包开自己的本机短分支 → 做完、验收 → 合进 `main` 并推送 → 删分支 → 做下一个。编号在游戏仓库 `docs/packages/README.md` 登记；包正文都在本目录。

## 0 为什么做（用户 2026-10-23 的决定）

- 用户实际打开工作台：内容不完整、每个页面都很卡。排查结论和实测数字写在各包的「背景」里（WB-08、WB-09）。
- **列表一律用已生成的预览 PNG，点开放大用代码实时绘制**（用户原话：「列表展示都用 png，然后我想点击放大预览用代码绘制」）。不引入前端框架。
- **没有概念场景的地图先折叠**。
- **设计文档（美术规范、界面风格、声音、工作台设计）以后只在美术仓库维护**，游戏仓库只留链接。
- **游戏里所有页面先在 HTML 里做出来，再进游戏代码**：要一份界面清单当唯一入口，每个页面一个固定地址、能看到做到哪一步；还要一个单独页面，和游戏布局一模一样、能按游戏按键跳转。

## 1 用户的授权（只限本队列）

用户 2026-10-23 授权本窗口：
- 第 0 步：把两个仓库的 `origin/claude/peaceful-rubin-i3guy1`（只有本队列的包文档、登记表和看板）普通合并进各自 `main` 并推送；
- 按第 2 节顺序制作；每个包验收通过后，自己普通合并（`git merge --no-ff`）进**美术仓库** `main` 并推送；BR-06 的游戏仓库部分合进**游戏仓库** `main` 并推送；
- 合并推送后删除本机的包分支；更新美术仓库 `docs/v2/status.md`；BR-06 合并时同步游戏仓库登记表里本队列 7 行的状态、`docs/status.md`、`docs/board.md`。

**不授权**：
- 批准任何美术或声音（不运行 `approve`）；
- 生成资源版本、改 `art-pack.json`、打或移动 `art-v*` / `godot-art-*` 标签、发 Release；
- 改 `tools/pack-files.json` 的 `include` 清单里的任何文件（`art/**`、`audio/**`、`tools/art.mjs`、`tools/audio.mjs`、`tools/lib/*.mjs`、`workbench/js/core/**`、`third_party/fonts/**` 等；改了会让资源包内容变化）；
- 改 `SNAPSHOT.md` 列出的快照；
- force push、rebase、amend 已推送的提交；
- 碰模块隔离队列（游戏仓库 `docs/handoff/module-isolation-queue.md`）的包和分支：BR-05、CORE-01~07、STY-00、HEL-00、ART-07。

## 2 顺序

| 顺序 | 包 | 内容 | 本机分支 |
|---|---|---|---|
| 0 | — | 两个仓库合入本队列文档（第 4 节第 0 步） | — |
| 1 | [WB-08](WB-08.md) | 提速：列表用 PNG，点开放大用代码绘制，预览限帧 | `art/WB-08-fast-lists` |
| 2 | [WB-09](WB-09.md) | 内容看得见：窄窗口详情、确认页空白、概念折叠、断链 | `art/WB-09-visible-content` |
| 3 | [WB-10](WB-10.md) | 左栏收成 6 个入口、资源库合并、总览首页 | `art/WB-10-menu` |
| 4 | [WB-11](WB-11.md) | 界面清单（唯一入口）、五步进度、流程图 | `art/WB-11-screen-list` |
| 5 | [WB-12](WB-12.md) | 原样预览页（关卡模式），按游戏按键跳转 | `art/WB-12-play-preview` |
| 6 | [WB-13](WB-13.md) | 配送 / 剧情 / 伙计的跳转表，预览页接入配送（**暂停点**） | `art/WB-13-delivery-flow` |
| 7 | [BR-06](BR-06.md) | 设计文档以美术仓库为唯一来源（**暂停点**；两个仓库） | 美术 `art/BR-06-design-docs`，游戏 `docs/BR-06-design-docs` |

每个包的「前置」都是表里排在它前面的包，按顺序做就自然满足。

## 3 通用规则（每个包都适用）

- **两个仓库**：美术仓库 https://github.com/beekim123/ele-pushbox-arts.git ，本机目录在下文写作 `<美术仓库目录>`，实际路径见用户给的提示词（公开仓库：推送 `main` 就等于公开；不要把本机路径写进本仓库）。游戏仓库 https://github.com/beekim123/ele-pushbox.git （私有），本机副本位置以用户机器为准；只有 BR-06 改它，WB-13 只读。
- **冻结区一律不改**：`art/source/**`、`art/approvals.json`、`art/history/**`、`art/export/**`（含 `preview/`，只能由 build 生成）、`workbench/js/core/**`、`content/i18n*/**`、`content/levels/**`、`godot/**`、`SNAPSHOT.md` 列出的文件。任何美术换版本数必须为 0。
- 不引入前端框架、npm 依赖或构建步骤；双击 `workbench/index.html`（file://）和 HTTP 两种打开方式都必须能用。
- 包文件里写了「可改」，就只改清单里的文件。验收必须的小改动可以超出清单：每个文件 30 行以内、不碰冻结区、不碰第 1 节不授权的文件、不改测试阈值；在交付里单列「清单外的小改动」。超出这些就按第 6 节停下。
- 改了已有测试的断言，交付里写清改了哪条、为什么（只允许包里点名的那几类）。
- **原始测试输出和截图不提交**：放仓库外 `../pushbox-evidence/<编号>/`，在聊天里给路径。仓库里只留测试代码和包的交付。
- **资源预算**（用户 Mac 16 GB）：另一个窗口可能同时在跑模块隔离队列（Godot）。同时最多 2 个耗资源任务；浏览器测试单 worker、单个浏览器；开跑前看一眼有没有别的大进程；结束时清理自己启动的进程。
- **性能数字以本机实测为准**：包里写的数字是 2026-10-23 在 Linux 4 核机器上测的，只作参考；交付里贴本机「改动前 / 改动后」。
- **检查只跑必要的**：边做边跑包里的快检查；验收整套只跑一遍；失败的修好后只重跑失败项和受影响项。
- **验收整套**（每个包都跑；后面的包多几条）：
  ```bash
  node tools/art.mjs build        # 必须 0 bumped；之后 git status --porcelain art/ audio/ godot/ 为空
  node tools/art.mjs verify
  node tools/audio.mjs verify
  node --test --test-concurrency=1 tests/*.test.mjs
  node tests/workbench.smoke.cjs
  WB_HTTP=1 node tests/workbench.smoke.cjs
  node tests/workbench.perf.cjs   # WB-08 起
  node tools/screens.mjs check    # WB-11 起
  node tests/play.smoke.cjs       # WB-12 起
  ```
- `node tools/pack.mjs check` 现在本来就会报清单差异（README 写明的未发布状态），不是本队列的问题，不用跑，也不要去「修」。

## 4 每个包的步骤（照抄，换掉 `<编号>`、`<分支>`）

**第 0 步（只做一次）**：
```bash
# 美术仓库
cd <美术仓库目录>
git fetch origin
git worktree add ../pushbox-arts-merge-queue -b merge/workbench-queue origin/main
cd ../pushbox-arts-merge-queue
git merge --no-ff origin/claude/peaceful-rubin-i3guy1 -m "merge: workbench queue packages"
git push origin HEAD:main
cd <美术仓库目录>
git worktree remove ../pushbox-arts-merge-queue
git fetch origin
git merge-base --is-ancestor merge/workbench-queue origin/main && git branch -D merge/workbench-queue
# 游戏仓库（在它的本机目录里，同样做法）：普通合并 origin/claude/peaceful-rubin-i3guy1（只有登记表和看板）并推送 main。
# 有追加冲突（另一个窗口同时在改登记表或看板）：两边都留。
```

**开工**（美术仓库）
```bash
cd <美术仓库目录>
git fetch origin
git worktree add ../pushbox-arts-<编号> -b <分支> origin/main
cd ../pushbox-arts-<编号>
```

**制作**：读 `docs/packages/<编号>.md`，只做这一个包；把它的状态改成「进行中」。

**验收**：照包里的「验收」和第 3 节的验收整套跑一遍。

**交付**：填包文件的「交付」（不超过 40 行），状态改「已合并」，作为本分支最后一个提交。

**合并推送**
```bash
cd <美术仓库目录>
git fetch origin
git worktree add ../pushbox-arts-merge-<编号> -b merge/<编号> origin/main
cd ../pushbox-arts-merge-<编号>
git merge --no-ff <分支>
# 合并后只做小验证：node tools/art.mjs verify、node tests/workbench.smoke.cjs、本包新增的测试
# 在 docs/v2/status.md 顶部加一节：做了什么、实际验证了什么、遗留、下一个包；单独提交
git push origin HEAD:main
```

**删分支**（包分支只在本机，不推远端）
```bash
cd <美术仓库目录>
git worktree remove ../pushbox-arts-<编号>
git worktree remove ../pushbox-arts-merge-<编号>
git fetch origin
git merge-base --is-ancestor <分支> origin/main && git branch -D <分支> merge/<编号>
```
（先确认已在 `origin/main` 里再删，所以这里用 `-D`；本机 `main` 落后时 `-d` 会误报没合并。）
停下交回时例外：把正在做的包分支推到远端，方便接手。

**报告**：在聊天里发一行【<编号> 完成】加一句结果（合并提交号、验收结果），不等回复，接着做下一个包（暂停点除外）。

## 5 暂停点（要等用户回复）

美术仓库是公开的，下面两处在**合并推送前**停下，把内容发给用户，等用户回复「同意」再推；用户要改就改完再问一次：
1. **WB-13**：新增的配送 / 剧情 / 伙计跳转表全文，以及「待定」问题清单。
2. **BR-06**：本次新增到公开仓库的文档段落清单，以及两个仓库写法冲突、需要用户裁决的条目。

## 6 什么时候停下整个队列

出现下面任何一种，就停下：已经合进 `main` 的包保留，正在做的包把进度写进它的「交付」并推它的分支，在聊天里告诉用户卡在哪、需要用户做什么。
- 验收失败，在 `main` 上同一项是通过的（说明是本包引入的），而且两次修复都没解决；
- 要改的文件超出「可改」，而且不满足第 3 节的小改动条件；
- 发现必须改冻结区或第 1 节不授权的文件才能完成；
- `node tools/art.mjs build` 出现任何换版本；
- 单个包做了超过 4 小时。

`main` 上同样失败的检查是既有未过项：照常合并，在交付和 `docs/v2/status.md` 里如实写明，不算停下。WB-08 的「三个最重画面 CPU < 30%」达不到时，记录实测数字继续，不算停下。

## 7 进度笔记

在仓库外记一个进度笔记 `../pushbox-evidence/WB-QUEUE-progress.md`：每个包开始、合并、删分支时各写一行（时间、编号、提交号）。会话被压缩或重开后，先读这个笔记和 `git log origin/main`，从下一个没合并的包接着做，不要从头重新核对已经合并的包。

## 8 全部做完

在聊天里用中文简短告诉用户：
- 7 个包各自的合并提交号（BR-06 两个仓库各一个）；
- 每个包验收的结果行和本机性能前后对照；既有未过项；
- 用户现在可以怎么用：双击 `workbench/index.html` 看总览；`workbench/play.html` 是原样预览；界面清单在「场景与界面 › 界面清单」；
- 需要用户做的事：WB-13 记下的「待定」跳转要用户决定；26 张只有文字的地图概念要不要补概念场景。
