[English](https://github.com/linbin-mk/dsh-workspace-prompt/blob/main/README.en.md) | 简体中文

# dsh-workspace-prompt

[![npm 版本](https://img.shields.io/npm/v/@linbin-mk/dsh-workspace-prompt)](https://www.npmjs.com/package/@linbin-mk/dsh-workspace-prompt)
[![发布流水线](https://github.com/linbin-mk/dsh-workspace-prompt/actions/workflows/publish.yml/badge.svg)](https://github.com/linbin-mk/dsh-workspace-prompt/actions/workflows/publish.yml)
[![许可证](https://img.shields.io/npm/l/@linbin-mk/dsh-workspace-prompt)](LICENSE)
[![Node](https://img.shields.io/node/v/@linbin-mk/dsh-workspace-prompt)](package.json)
[![平台](https://img.shields.io/badge/platform-Web%20client-lightgrey)](#要求)

`dsh-workspace-prompt` 是一个纯第三方 DeepSeek Harness 插件：为每个工作区配置一段专属提示词。你只需在某个工作区写一次，之后该工作区内每次会话启动时，它都会自动注入到模型上下文；重启 Harness 后依然保留。

它不改任何 Harness 源码，实现三件事：

1. **配置入口** —— 一个 `/workspace-prompt` 斜杠命令弹出模态框，含文本框与 **保存** / **清除** 按钮。打开时文本框回显当前已存的值；**清除** 删除该工作区的提示词。
2. **自动注入** —— 会话启动时把已存的提示词并入模型上下文，机制与官方 `agent-instructions`（`AGENTS.md`）一致：在 `agent/pre-step` 钩子里于 agent inbox 维护一条持久的 `user/message`。消息 source 为 `kind: 'plugin'`，因此 Web transcript 把它渲染成折叠的「上下文注入」行（与 AGENTS.md 同一形态），而不是一条用户气泡。
3. **持久化** —— 提示词存放在 user-settings 文档的 `workspace-prompt` 命名空间下，由 settings provider 持久化到 Harness home 的文件里，因此重启后仍然保留。

## 功能

- **按工作区生效** —— 提示词以会话的绝对工作目录（`cwd`）为 key，也就是该工作区稳定的身份标识；不同工作区互不影响。
- **会话启动即注入** —— 无需每次手动粘贴，提示词自动进入该工作区每个新会话的模型上下文。
- **两种管理入口** —— 斜杠命令 `/workspace-prompt` 就地配置；**设置 → 工作区提示词** 总览页集中管理所有已配置工作区。
- **重启不丢** —— 存储在 user-settings 文档中，由 Harness 的 settings provider 落盘。
- **与 AGENTS.md 共存** —— 复用官方 `agent-instructions` 的 inbox/决策模式，`<system-reminder>` 包装，compose 干净。

## 要求

- Node.js `^22.19` 或 `>=24`
- DeepSeek Harness `0.1.5-rc.1` 或兼容的 `0.1.5` 预发布版本，以及提供 `ctx.settings` 与 `ctx.agent` 的 Web profile
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

由于包声明了 `dsh.client` 入口，插件一旦进入组合树，web shell 会自动加载 `lib/client.js`；node 端（`lib/index.js`）负责 settings 持久化与注入。

## 使用

1. 打开要配置的工作区内的任意会话。
2. 输入 `/workspace-prompt`，选择 **配置工作区提示词**。
3. 输入提示词，点击 **保存**。它会在该工作区下一次（及之后每一次）会话启动时注入，下次打开模态框时会再次回显。点击 **清除** 可删除。

也可以直接在 **设置 → 工作区提示词** 中管理：已配置的工作区以卡片展示，点击 **添加工作区** 会列出所有尚未配置提示词的已注册工作区，选中即可编辑保存。

## 工作原理

### Host 端（`src/index.ts` + `src/inject.ts`，作为 Cordis 插件加载）

- 注册 `workspace-prompt` settings 命名空间（`{ prompts: Record<absoluteDir, string> }`）。settings provider 负责持久化（功能 3）。
- 监听 `agent/pre-step`。每一步都读取会话的 `header.cwd`，查到已配置的提示词后，就生成一条包在 `<system-reminder>` 里的 `user/message`，在 inbox 中维护它，并并入该步的决策，使其进入首个模型请求与持久化日志（功能 2）。纯注入与 inbox 对账逻辑放在 `src/inject.ts`，`src/index.ts` 负责把它接到 Cordis 上下文上。

### Client 端（`src/client/index.ts`，作为插件的 `dsh.client` 半加载）

- 注册名为 `workspace-prompt` 的 `CommandContribution`。斜杠菜单项仅在当前会话有 `cwd` 时才出现。
- 注册一个 `shell.overlay` 模态框（`WorkspacePromptModal`），接到一个小的 `HostObservable` 上。选择该命令时通过 Host settings RPC（`api.settings.describe`）读取当前值并打开模态框。
- **保存** / **清除** 通过同一个 Host settings RPC 回写（`api.settings.mutate`，对 `prompts.<cwd>` 执行 `set` / `unset` 路径操作），因此回显的值与注入的值共用同一数据源。
- 注册 **设置 → 工作区提示词** 总览页（`settings.section`）。已配置的工作区以卡片形式列出，可就地修改/清除；**添加工作区** 下拉——数据来自 `useWorkspaces` 标准钩子——只列出当前**尚未配置提示词**的已注册工作区，选中后展开一张可编辑的新卡片，保存即持久化。

## 为什么入口是斜杠命令，而不是工作区「更多」弹出菜单

`packages/client/ui-workspace` 里的工作区操作菜单（`重命名` / `删除工作区`）在 `Rows.tsx` 中是硬编码的，**没有留给菜单项的 slot 或扩展点**。不改 Harness 源码的插件无法在那两行之间插入自己的项。本插件改用已有的 `commandUi` + `shell.overlay` 扩展点，无需改动 Harness。（如果你确实想让它出现在那个弹出菜单里，需要在 `ui-workspace` 加一行扩展点——属于改 Harness 源码。）

## 说明 / 限制

- 会话中途修改提示词，会在下一次请求里追加新文本，而历史中更早的值保持不变；每次新会话都会重新读取最新值。
- 模态框入口是斜杠命令，不是工作区「更多」弹出菜单（见上文）。
- 本包要求 DeepSeek Harness `0.1.5-rc.1` 或兼容的 `0.1.5` 预发布版本。它是独立的第三方插件，不受 Harness `packages/*` 的测试/覆盖率门禁约束；集成效果必须在运行中的 Harness 中验证。
- 提示词会占用该工作区每个会话的上下文预算；写得越长，留给对话的空间越少。

## 故障排查

- **斜杠菜单里没有这一项** —— 只有当前会话有 `cwd` 时才提供该命令；在未绑定工作区的会话里它不会出现。
- **提示词没有注入** —— 确认它保存在**当前会话所属工作区**的 key（绝对路径）下。会话的 `cwd` 与你在设置页看到的工作区路径必须完全一致。
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
