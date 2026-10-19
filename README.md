[English](https://github.com/linbin-mk/dsh-workspace-prompt/blob/main/README.en.md) | 简体中文

<p align="center">
  <img src="https://raw.githubusercontent.com/linbin-mk/dsh-workspace-prompt/main/assets/icon.png" width="112" alt="dsh-workspace-prompt 图标：一个蓝色文件夹，里面是白色的终端提示符 >_">
</p>

<h1 align="center">dsh-workspace-prompt</h1>

<p align="center">给每个工作区一段专属提示词。<br>
写一次、打开开关，这个工作区的每个新会话都会带上它；每个会话第一次带上之前，只问你一次。</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@linbin-mk/dsh-workspace-prompt"><img src="https://img.shields.io/npm/v/@linbin-mk/dsh-workspace-prompt" alt="npm 版本"></a>
  <a href="https://github.com/linbin-mk/dsh-workspace-prompt/actions/workflows/publish.yml"><img src="https://github.com/linbin-mk/dsh-workspace-prompt/actions/workflows/publish.yml/badge.svg" alt="发布流水线"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/@linbin-mk/dsh-workspace-prompt" alt="许可证"></a>
  <a href="package.json"><img src="https://img.shields.io/node/v/@linbin-mk/dsh-workspace-prompt" alt="Node"></a>
  <img src="https://img.shields.io/badge/platform-Web%20client-lightgrey" alt="平台">
</p>

> 纯第三方 DeepSeek Harness 插件，不改 Harness 源码；界面只在 Web Client 提供。

## 它解决什么问题

同一个 Harness 里常常并排开着好几个仓库：前端要 pnpm 和中文提交信息，后端要 Gradle，文档库只想要简洁回答。把这些规则塞进每次对话既啰嗦又容易漏；写进全局提示词，又会串到别的项目里。

`dsh-workspace-prompt` 把提示词挂到**工作区**上：

- **按工作区隔离** —— 以会话的绝对工作目录（`cwd`）为 key，不同工作区互不影响。
- **默认不注入** —— 保存只是存下来；打开输入框工具行的开关，才真正进入模型上下文。
- **每个会话只问一次** —— 第一次真正要注入时弹一张确认卡；选「不带」的会话不再询问、也不再注入，开关状态不变。
- **重启不丢** —— 提示词与开关保存在插件 `Config` 里，由 Harness 的 user-settings provider 写入 profile 用户层。
- **与 `AGENTS.md` 共存** —— 复用官方 `agent-instructions` 的注入形态，transcript 里显示为折叠的「上下文注入」行，而不是用户气泡。

## 界面一览

### ① 用斜杠命令配置

<img src="https://raw.githubusercontent.com/linbin-mk/dsh-workspace-prompt/main/assets/screenshots/slash-command.png" width="780" alt="在输入框输入 /workspace-prompt，命令菜单出现「配置当前工作区的特定提示词」">

在任意会话里输入 `/workspace-prompt`，选择 **配置工作区提示词**。命令只在当前会话绑定了 `cwd` 时出现。

<img src="https://raw.githubusercontent.com/linbin-mk/dsh-workspace-prompt/main/assets/screenshots/configure-modal.png" width="360" alt="配置工作区提示词弹窗：显示工作区目录、提示词文本框、清除与保存按钮">

弹窗会回显已存的值；**保存** 写入该工作区，**清除** 连同开关状态一起删除。

### ② 打开输入框工具行的开关

保存后，输入框工具行出现「**工作区提示词-关**」；点一下变成「**工作区提示词-开**」并带一层浅灰底色（与输入框里 `⊕` 按钮同一个灰）。没有任何提示词的工作区不会出现这个开关。

### ③ 每个会话首次发送时确认一次

<img src="https://raw.githubusercontent.com/linbin-mk/dsh-workspace-prompt/main/assets/screenshots/confirm-card.png" width="780" alt="会话首次发送时出现的确认卡：本次会话是否带上该工作区的工作区提示词？带上 / 不带">

开关打开后，某个会话第一次真正需要注入时会出现这张卡：

- **带上** —— 提示词并入本会话的模型上下文；
- **不带** —— 本会话不再询问、也不再注入，**开关保持原状**（下个会话会重新问一次）。

确认卡走官方 `ctx.userQuestions` 通道（审批、计划评审用的是同一个通道），所以它会出现在该会话里，并且这一步会等你回答后才继续。

### ④ 设置页集中管理

<img src="https://raw.githubusercontent.com/linbin-mk/dsh-workspace-prompt/main/assets/screenshots/settings-overview.png" width="700" alt="设置 → 工作区提示词：已配置工作区的卡片、提示词文本框与添加工作区按钮">

**设置 → 工作区提示词** 汇总所有已配置的工作区：可就地修改、清除，也能通过 **添加工作区** 从未配置的已注册工作区里挑一个补上。

## 快速开始

### 安装

把已发布的包安装进自定义 Web profile。产物不含指向 Harness checkout 的路径依赖，`dsh.bundle` patch 会自动加入 Host 和 Client 插件行：

```sh
dsh --profile web-prompt --from-default-profile web --dump-config
dsh plugin --profile web-prompt add @linbin-mk/dsh-workspace-prompt
dsh --profile web-prompt
```

改为安装本地构建的 tarball：

```sh
pnpm install
pnpm build          # tsc 产出 lib/types/*.d.ts；tsdown 产出 lib/index.js + lib/client.js
pnpm pack
dsh plugin --profile web-prompt add ./linbin-mk-dsh-workspace-prompt-<version>.tgz
```

包声明了 `dsh.client` 入口，插件进入组合树后 web shell 会自动加载 `lib/client.js`；node 端 `lib/index.js` 负责声明可实时编辑的 `Config` 并在 `agent/pre-step` 注入提示词。

### 五步用起来

1. 打开要配置的工作区里的任意会话；
2. 输入 `/workspace-prompt`，选择 **配置工作区提示词**，写好内容后点 **保存**；
3. 在输入框工具行点击「工作区提示词」，标签从 `-关` 变为 `-开`；
4. 正常发消息；本会话第一次需要注入时，在确认卡上选 **带上** 或 **不带**；
5. 不再需要时，关掉开关，或在弹窗 / 设置页点 **清除**。

## 行为细节

| 项目 | 行为 |
| --- | --- |
| 作用域 | 提示词与开关都以会话的绝对工作目录（`cwd`）为 key；会话的 `cwd` 必须与设置页里的工作区路径完全一致。 |
| 默认状态 | 关闭。没有提示词的工作区不显示开关，输入框工具行与原生完全一样。 |
| 注入时机 | 开关打开后，在 `agent/pre-step` 钩子里注入；每一步先检查该内容是否已在会话上下文中，避免重复。 |
| 会话确认 | 每个会话只在首次真正注入时问一次。选过「带上」的会话，如果提示词文本变了、或上下文被压缩掉，会直接用最新文本重新注入，不再询问。 |
| 持久化 | 存在插件 `Config` 的 `prompts` / `enabled` 两个可实时编辑字段里，由 Harness 的 settings provider 落到 profile 用户层。 |
| 无提问通道时 | profile 没有 `userQuestions`、headless 运行、子代理或被托管（`DELEGATED_CALLER`）时，退回开关语义直接注入；用户关闭/忽略（`ASK_CANCELLED`）视作本轮「不带」。 |
| 生效时机 | 改动从下一步生效：中途打开开关，当前会话的下一次请求就会带上；中途改文本，下一次请求追加新文本，历史里更早的值不变。 |

## 要求

- Node.js `^22.19` 或 `>=24`；
- DeepSeek Harness `0.2.1-rc.2` 或兼容的 `0.2.1` 预发布版本，以及提供 `ctx.settings` / `ctx.configForms` / `ctx.agent` 的 Web profile；会话首次确认还需要 `ctx.userQuestions`（Web profile 默认含 `@deepseek-ai/dsh-user-questions`，缺失时退回开关语义）；
- 本包只在 Web Client 端提供界面，不提供终端或桌面端入口。

## 工作原理

### Host 端（`src/index.ts` + `src/inject.ts`，作为 Cordis 插件加载）

- 声明 Cordis `Config`：`prompts: Record<absoluteDir, string>` 与 `enabled: Record<absoluteDir, boolean>`，都标记为 `.volatile()`，因此可以在设置表单里实时编辑。loader 行 id `workspace-prompt` 就是它的 settings 命名空间，Host 侧改动由 Harness 的 settings provider 落到 profile 用户层并实时推给插件。插件自带设置页，因此 `apply` 里用 `ctx.settings.configure({ auto: false })` 关掉自动生成的配置页。
- 监听 `agent/pre-step`。每一步读取会话的 `header.cwd`；**只有该工作区的 `enabled` 为 `true`** 时才去取 `prompts`。命中且该内容还没出现在会话上下文里时，先通过 `ctx.get('userQuestions')?.ask(...)` 问一次（每个会话只问一次，答案在整个会话里复用），选「带上」才生成一条包在 `<system-reminder>` 里的 `user/message`，在 agent inbox 中维护它，并并入该步的决策，使其进入首个模型请求与持久化日志。
- 纯注入、开关判定与 inbox 对账逻辑在 `src/inject.ts`（`promptFor` / `enabledFor`）；提问载荷与判定在 `src/confirm.ts`（`confirmQuestions` / `readInclude` / `SessionDecisions`）；`src/index.ts` 负责把它们接到 Cordis 上下文上。
- **问不到人时不阻塞**：没有 `userQuestions` 服务、没人能应答（headless 运行）、当前 agent 是子代理或被托管（`DELEGATED_CALLER`）时，插件退回开关语义直接注入。

### Client 端（`src/client/index.ts`，作为插件的 `dsh.client` 半加载）

- 注册名为 `workspace-prompt` 的 `CommandContribution`；斜杠菜单项仅在当前会话有 `cwd` 时出现。
- 注册一个 `shell.overlay` 模态框（`WorkspacePromptModal`），接到一个小的 `HostObservable` 上。选择该命令时通过共享配置表单（`ctx.configForms.get('workspace-prompt')`，entry id 与 loader 行 id 一致）读取当前值并打开模态框；表单不可写（未就绪或 Host 拒绝写入）时，保存/清除按钮保持禁用。
- **保存 / 清除** 通过同一个共享配置表单回写（`form.mutate`，对 `prompts.<cwd>` 执行 `set` / `unset` 路径操作；清除会同时 `unset` `enabled.<cwd>`；Host 拒绝时表单返回 `false`，界面按失败提示），因此回显的值与注入的值共用同一数据源。
- 注册输入框工具行的开关（`conversation.input.left`，`WorkspacePromptToggle`）：用 `useSessions` 取当前会话的 `cwd`，只在状态里存在该工作区的提示词时渲染；点击写 `enabled.<cwd>`。两态是同一个 chip 的两种底色与两种标签：关闭 = 透明底 + 次要文字色 + `-关`，开启 = `--dsw-specific-selector` 浅灰底 + 主文字色 + `-开`。写失败、配置只读、以及 **Host 半仍是升级前版本** 时，控件用 `aria-disabled` + 变灰而不是真 `disabled`（真 disabled 会吞掉 tooltip），悬停时说明原因。
- 注册 **设置 → 工作区提示词** 总览页（`settings.section`）。已配置的工作区以卡片列出，可就地修改/清除；**添加工作区** 下拉的数据来自 `useWorkspaces` 标准钩子，只列出尚未配置提示词的已注册工作区。页面同样订阅共享配置表单：写入结果与 Host 侧变更都会立即反映到列表，表单未就绪或不可写时所有写入控件禁用。

## 为什么入口是斜杠命令，而不是工作区「更多」弹出菜单

`packages/client/ui-workspace` 里的工作区操作菜单（`重命名` / `删除工作区`）在 `Rows.tsx` 中是硬编码的，**没有留给菜单项的 slot 或扩展点**。不改 Harness 源码的插件无法在那两行之间插入自己的项。本插件改用已有的 `commandUi` + `shell.overlay` 扩展点，无需改动 Harness。（如果你确实想让它出现在那个弹出菜单里，需要在 `ui-workspace` 加一行扩展点——属于改 Harness 源码。）

## 说明 / 限制

- 开关与提示词的改动都在下一步生效：中途打开开关，当前会话的下一次请求就会带上提示词；中途改文本，下一次请求追加新文本，历史里更早的值保持不变。
- 模态框入口是斜杠命令，不是工作区「更多」弹出菜单（见上文）。
- 本包要求 DeepSeek Harness `0.2.1-rc.2` 或兼容的 `0.2.1` 预发布版本（插件配置即 Cordis `Config`，浏览器侧通过 `ctx.configForms` 读写）。它是独立的第三方插件，不受 Harness `packages/*` 的测试/覆盖率门禁约束；集成效果必须在运行中的 Harness 中验证。
- 提示词只在开关打开时占用该工作区的上下文预算；写得越长，留给对话的空间越少。
- 开关按工作区记忆：在一个会话里打开，该工作区的其他会话（含之后新建的）也会带上提示词，直到再次关闭。
- 每个会话只问**首次**：选过「不带」的会话不会再问、也不会再注入（想在会话中途改主意，把开关关掉再打开即可——新会话自然重新问）。选过「带上」的会话若后来改了提示词文本、或上下文被压缩掉，会**直接**用最新文本重新注入，不再询问。
- 提问文案是**中英双语**：宿主侧发起的提问只带字面文本，Harness 的问题协议没有本地化通道；客户端自己的界面文案仍按语言字典渲染。

## 故障排查

- **斜杠菜单里没有这一项** —— 只有当前会话有 `cwd` 时才提供该命令；在未绑定工作区的会话里它不会出现。
- **提示词没有注入** —— 先看输入框工具行：开关默认是 `关`；没有这个开关就说明当前工作区还没配置提示词。开关是 `开` 时，再确认提示词保存在**当前会话所属工作区**的 key（绝对路径）下——会话的 `cwd` 与你在设置页看到的工作区路径必须完全一致。
- **输入框里没有这个开关** —— 该工作区尚未配置提示词（设计如此）；用 `/workspace-prompt` 或设置页先保存一段。
- **点了发送却没有出现确认卡** —— 说明这次发送本来就不需要注入：提示词已经在当前会话上下文里（只有真正要注入时才问），或者该 profile 没有 `userQuestions` 通道（headless / 子代理会话），此时按开关语义直接注入。
- **升级插件后开关点不动 / 只变灰** —— 浏览器里的 client 半是每次刷新从磁盘取的，Host 半只在进程启动时加载：`dsh plugin add` 之后必须**重启 `dsh web`**，否则旧的 Host 会拒绝新字段（插件会直接在开关上提示这一点）。重启后旧的提示词仍保持关闭状态，需要为各工作区重新打开开关。
- **重启后界面里没有插件** —— 用 `dsh --profile web-prompt --dump-config` 确认插件行已被组合进 profile；插件缺失时该行不会出现。

## 开发

```sh
pnpm install
pnpm build          # 构建 lib/（提交进仓库，随包发布）
pnpm test           # vitest run
```

`tests/manifest-identity.spec.ts` 断言 `package.json` 的 `name`、`cordis.patch.yml` 的 `insert[].name` 与 client bundle banner 里的 `__ModuleLoader__.load({ id })` 三者一致——改名时它会变红，而不是安静地装上一个加载不起来的包。

## 许可证

[MIT](LICENSE) © 2026 linbin-mk

本包为独立第三方插件，与 DeepSeek 无隶属关系。它不包含任何第三方素材，因此没有 `NOTICE` 文件；构建期与运行期依赖的第三方包各自遵循其自身许可证（运行时依赖以 peer dependency 形式提供，不随本包分发）。
