[English](https://github.com/linbin-mk/dsh-workspace-prompt/blob/main/README.en.md) | 简体中文

# dsh-workspace-prompt

[![npm 版本](https://img.shields.io/npm/v/@linbin-mk/dsh-workspace-prompt)](https://www.npmjs.com/package/@linbin-mk/dsh-workspace-prompt)
[![发布流水线](https://github.com/linbin-mk/dsh-workspace-prompt/actions/workflows/publish.yml/badge.svg)](https://github.com/linbin-mk/dsh-workspace-prompt/actions/workflows/publish.yml)
[![许可证](https://img.shields.io/npm/l/@linbin-mk/dsh-workspace-prompt)](LICENSE)
[![Node](https://img.shields.io/node/v/@linbin-mk/dsh-workspace-prompt)](package.json)
[![平台](https://img.shields.io/badge/platform-Web%20client-lightgrey)](#要求)

`dsh-workspace-prompt` 是一个纯第三方 DeepSeek Harness 插件：为每个工作区配置一段专属提示词。提示词写完**不会自动生效**——在输入框工具行打开该工作区的「工作区提示词」开关后，这个工作区发起的会话才会把它并入模型上下文；开关与提示词都会保留到重启之后。

它不改任何 Harness 源码，实现四件事：

1. **配置入口** —— 一个 `/workspace-prompt` 斜杠命令弹出模态框，含文本框与 **保存** / **清除** 按钮。打开时文本框回显当前已存的值；**清除** 删除该工作区的提示词与它的开关状态。
2. **开关**（输入框工具行，官方插槽 `conversation.input.left`）—— 只在当前工作区**已配置提示词**时出现。未打开是虚线幽灵态、标签 `关`；打开后是实心墨色态、标签 `开`，点击即切换。状态按工作区记忆，默认关闭。
3. **按需注入** —— 开关打开时，会话启动把提示词并入模型上下文，机制与官方 `agent-instructions`（`AGENTS.md`）一致：在 `agent/pre-step` 钩子里于 agent inbox 维护一条持久的 `user/message`。消息 source 是本插件自己声明的 `kind: 'workspace-prompt'`，并带 `form: 'instructions'` 上下文形式，因此 Web transcript 把它渲染成折叠的「上下文注入」行（与 AGENTS.md 同一形态），而不是一条用户气泡。关掉开关后不再注入。
4. **持久化** —— 提示词与开关都是本插件自身 Cordis `Config` 的可实时编辑字段（`prompts` 与 `enabled`，即「工作区目录 → 提示词 / 是否开启」两张映射）。loader 行 id `workspace-prompt` 就是它的 settings 命名空间，由 Harness 的 user-settings provider 落盘到 Harness home 的 profile 文件，因此重启后仍然保留。

## 功能

- **按工作区生效** —— 提示词与开关都以会话的绝对工作目录（`cwd`）为 key，也就是该工作区稳定的身份标识；不同工作区互不影响。
- **默认不注入，开关说了算** —— 打开开关后，该工作区的新会话自动带上提示词；关掉即停止注入，历史里已经注入的内容不受影响。
- **没有提示词就没有开关** —— 未配置的工作区，输入框工具行与以前完全一样。
- **两种管理入口** —— 斜杠命令 `/workspace-prompt` 就地配置；**设置 → 工作区提示词** 总览页集中管理所有已配置工作区。
- **重启不丢** —— 存放在本插件 Config 的可编辑字段里，由 Harness 的 user-settings provider 写入 profile 的用户层。
- **与 AGENTS.md 共存** —— 复用官方 `agent-instructions` 的 inbox/决策模式，`<system-reminder>` 包装，compose 干净。

## 要求

- Node.js `^22.19` 或 `>=24`
- DeepSeek Harness `0.1.7-rc.2` 或兼容的 `0.1.7` 预发布版本，以及提供 `ctx.settings` / `ctx.configForms` 与 `ctx.agent` 的 Web profile
- 本包只在 Web Client 端提供界面；不提供终端或桌面端入口

## 安装

把已发布的包安装进自定义 Web profile。产物不含任何指向 Harness checkout 的路径依赖，`dsh.bundle` patch 会自动加入 Host 和 Client 插件行：

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
dsh plugin --profile web-prompt add ./linbin-mk-dsh-workspace-prompt-0.1.0.tgz
```

由于包声明了 `dsh.client` 入口，插件一旦进入组合树，web shell 会自动加载 `lib/client.js`；node 端（`lib/index.js`）负责声明可实时编辑的 `Config` 并在 `agent/pre-step` 注入提示词。

## 使用

1. 打开要配置的工作区内的任意会话。
2. 输入 `/workspace-prompt`，选择 **配置工作区提示词**。
3. 输入提示词，点击 **保存**。此时提示词只是被存下来，还不会注入。
4. 在输入框工具行点击「工作区提示词」（标签从 `关` 变为 `开`）。此后该工作区发起的会话都会带上这段提示词；再点一次即停止注入。点击 **清除** 会同时移除提示词与开关状态。

也可以直接在 **设置 → 工作区提示词** 中管理：已配置的工作区以卡片展示，点击 **添加工作区** 会列出所有尚未配置提示词的已注册工作区，选中即可编辑保存。

## 工作原理

### Host 端（`src/index.ts` + `src/inject.ts`，作为 Cordis 插件加载）

- 声明 Cordis `Config`：两个字段 —— `prompts: Record<absoluteDir, string>` 与 `enabled: Record<absoluteDir, boolean>`，都标记为 `.volatile()`，因此可以在设置表单里实时编辑。loader 行 id `workspace-prompt` 就是它的 settings 命名空间，Host 侧的改动由 Harness 的 settings provider 落到 profile 的用户层并实时推给插件（功能 4）。本插件自带设置页，因此在 `apply` 里通过 `ctx.settings.configure({ auto: false })` 关掉自动生成的配置页。
- 监听 `agent/pre-step`。每一步都读取会话的 `header.cwd`；**只有该工作区的 `enabled` 为 `true`** 时才去取 `prompts`，命中就生成一条包在 `<system-reminder>` 里的 `user/message`，在 inbox 中维护它，并并入该步的决策，使其进入首个模型请求与持久化日志（功能 3）。纯注入、开关判定与 inbox 对账逻辑放在 `src/inject.ts`（`promptFor` / `enabledFor`），`src/index.ts` 负责把它接到 Cordis 上下文上。

### Client 端（`src/client/index.ts`，作为插件的 `dsh.client` 半加载）

- 注册名为 `workspace-prompt` 的 `CommandContribution`。斜杠菜单项仅在当前会话有 `cwd` 时才出现。
- 注册一个 `shell.overlay` 模态框（`WorkspacePromptModal`），接到一个小的 `HostObservable` 上。选择该命令时通过共享配置表单（`ctx.configForms.get('workspace-prompt')`，entry id 与 loader 行 id 一致）读取当前值并打开模态框；表单不可写（例如非本机页面的 memory 模式）时，保存/清除按钮保持禁用。
- **保存** / **清除** 通过同一个共享配置表单回写（`form.mutate`，对 `prompts.<cwd>` 执行 `set` / `unset` 路径操作；清除会同时 `unset` `enabled.<cwd>`；Host 拒绝时表单返回 `false`，界面按失败提示），因此回显的值与注入的值共用同一数据源。
- 注册输入框工具行的开关（`conversation.input.left`，`WorkspacePromptToggle`）：它用 `useSessions` 取当前会话的 `cwd`，只在状态里存在该工作区的提示词时渲染；点击写 `enabled.<cwd>`，写失败时控件短暂转为错误态。已打开是实心墨色 + 标签 `开`，未打开是虚线幽灵 + 标签 `关`——两态除了颜色还换了标签与描边样式，不依赖颜色也能分辨。
- 注册 **设置 → 工作区提示词** 总览页（`settings.section`）。已配置的工作区以卡片形式列出，可就地修改/清除；**添加工作区** 下拉——数据来自 `useWorkspaces` 标准钩子——只列出当前**尚未配置提示词**的已注册工作区，选中后展开一张可编辑的新卡片，保存即持久化。页面同样订阅共享配置表单：写入结果与 Host 侧变更都会立即反映到列表，表单未就绪或不可写时所有写入控件禁用。

## 为什么入口是斜杠命令，而不是工作区「更多」弹出菜单

`packages/client/ui-workspace` 里的工作区操作菜单（`重命名` / `删除工作区`）在 `Rows.tsx` 中是硬编码的，**没有留给菜单项的 slot 或扩展点**。不改 Harness 源码的插件无法在那两行之间插入自己的项。本插件改用已有的 `commandUi` + `shell.overlay` 扩展点，无需改动 Harness。（如果你确实想让它出现在那个弹出菜单里，需要在 `ui-workspace` 加一行扩展点——属于改 Harness 源码。）

## 说明 / 限制

- 开关与提示词的改动都在下一步生效：中途打开开关，当前会话的下一次请求就会带上提示词；中途改文本，下一次请求追加新文本，历史里更早的值保持不变。
- 模态框入口是斜杠命令，不是工作区「更多」弹出菜单（见上文）。
- 本包要求 DeepSeek Harness `0.1.7-rc.2` 或兼容的 `0.1.7` 预发布版本（插件配置即 Cordis `Config`，浏览器侧通过 `ctx.configForms` 读写）。它是独立的第三方插件，不受 Harness `packages/*` 的测试/覆盖率门禁约束；集成效果必须在运行中的 Harness 中验证。
- 提示词只在开关打开时占用该工作区的上下文预算；写得越长，留给对话的空间越少。
- 开关按工作区记忆：在一个会话里打开，该工作区的其他会话（含之后新建的）也会带上提示词，直到再次关闭。

## 故障排查

- **斜杠菜单里没有这一项** —— 只有当前会话有 `cwd` 时才提供该命令；在未绑定工作区的会话里它不会出现。
- **提示词没有注入** —— 先看输入框工具行：开关默认是 `关`；没有这个开关就说明当前工作区还没配置提示词。开关是 `开` 时，再确认提示词保存在**当前会话所属工作区**的 key（绝对路径）下——会话的 `cwd` 与你在设置页看到的工作区路径必须完全一致。
- **输入框里没有这个开关** —— 该工作区尚未配置提示词（这是设计如此）；用 `/workspace-prompt` 或设置页先保存一段。
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
