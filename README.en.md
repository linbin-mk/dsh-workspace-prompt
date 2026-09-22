English | [简体中文](https://github.com/linbin-mk/dsh-workspace-prompt/blob/main/README.md)

# dsh-workspace-prompt

[![npm version](https://img.shields.io/npm/v/@linbin-mk/dsh-workspace-prompt)](https://www.npmjs.com/package/@linbin-mk/dsh-workspace-prompt)
[![publish workflow](https://github.com/linbin-mk/dsh-workspace-prompt/actions/workflows/publish.yml/badge.svg)](https://github.com/linbin-mk/dsh-workspace-prompt/actions/workflows/publish.yml)
[![license](https://img.shields.io/npm/l/@linbin-mk/dsh-workspace-prompt)](LICENSE)
[![node](https://img.shields.io/node/v/@linbin-mk/dsh-workspace-prompt)](package.json)
[![platform](https://img.shields.io/badge/platform-Web%20client-lightgrey)](#requirements)

`dsh-workspace-prompt` is a pure third-party DeepSeek Harness plugin that gives every workspace its own prompt. Write it once per workspace; from then on it is folded into the model context automatically at the start of every session in that workspace, and it survives a Harness restart.

It changes no Harness source and implements three things:

1. **Configuration entry** — a `/workspace-prompt` slash command opens a modal with a textarea plus **Save** / **Clear** buttons. The textarea echoes the currently stored value on open; **Clear** removes the workspace's prompt.
2. **Auto-injection** — the stored prompt is folded into the model context when a session starts, mirroring the official `agent-instructions` (`AGENTS.md`) mechanism: a durable `user/message` is managed in the agent inbox at `agent/pre-step`. The message source is the plugin's own `kind: 'workspace-prompt'` with the `form: 'instructions'` context form, so the web transcript renders it as a collapsed context-injection row (the same shape as AGENTS.md) rather than as a user bubble.
3. **Persistence** — the prompt is a live field of this plugin's own Cordis `Config` (`prompts`, the workspace directory → prompt map). Its loader row id `workspace-prompt` is the settings namespace, and the Harness user-settings provider writes the profile's user layer to a file in the Harness home, so it survives a restart.

## Features

- **Scoped per workspace** — prompts are keyed by the session's absolute working directory (`cwd`), the stable identity of the workspace, so workspaces never bleed into each other.
- **Injected at session start** — no pasting the same text into every conversation; it reaches the model context on its own.
- **Two ways to manage it** — configure in place with the `/workspace-prompt` slash command, or manage every configured workspace from the **Settings → Workspace prompts** page.
- **Survives restarts** — stored in this plugin's Config and written to the profile's user layer by the Harness user-settings provider.
- **Composes with AGENTS.md** — reuses the official `agent-instructions` inbox/decision pattern and `<system-reminder>` wrapping.

## Requirements

- Node.js `^22.19` or `>=24`
- DeepSeek Harness `0.1.7-alpha.1` or a compatible `0.1.7` prerelease, with a Web profile that provides `ctx.settings` / `ctx.configForms` and `ctx.agent`
- The user interface is offered on the Web Client only; there is no terminal or desktop entry point

## Install

Install the published package into a custom Web profile. The artifact contains no path dependency on a Harness checkout, and its `dsh.bundle` patch adds the Host and Client plugin rows automatically:

```sh
dsh --profile web-prompt --from-default-profile web --dump-config
dsh plugin --profile web-prompt add @linbin-mk/dsh-workspace-prompt
dsh --profile web-prompt
```

Or install a locally built tarball:

```sh
pnpm install
pnpm build          # tsc emits lib/types/*.d.ts; tsdown emits lib/index.js + lib/client.js
pnpm pack
dsh plugin --profile web-prompt add ./linbin-mk-dsh-workspace-prompt-0.1.0.tgz
```

Because the package declares a `dsh.client` entry, the web shell loads `lib/client.js` automatically once the plugin is part of the composed tree; the node half (`lib/index.js`) declares the live-editable `Config` and injects the prompt at `agent/pre-step`.

## Usage

1. Open any session inside the workspace you want to configure.
2. Type `/workspace-prompt` and choose **配置工作区提示词**.
3. Type the prompt, click **保存**. It is injected at the next (and every later) session start in that workspace, and re-shown next time you open the modal. Click **清除** to delete it.

You can also manage everything from **Settings → 工作区提示词**: configured workspaces are shown on cards, and the **添加工作区** button offers every registered workspace that has no prompt yet.

## How it works

### Host half (`src/index.ts` + `src/inject.ts`, loaded as a Cordis plugin)

- Declares its Cordis `Config`: one `prompts: Record<absoluteDir, string>` field marked `.volatile()`, so the settings form can edit it live. Its loader row id `workspace-prompt` is the settings namespace; the Harness user-settings provider writes Host-side changes to the profile's user layer and pushes them to the plugin (feature 3). The plugin ships its own settings page, so `apply` turns the generated config page off with `ctx.settings.configure({ auto: false })`.
- Listens on `agent/pre-step`. For each step it reads the session's `header.cwd`, looks up the configured prompt, and — when present — mints a `user/message` wrapped in `<system-reminder>`, manages it in the inbox, and folds it into the step's decision so it reaches the first model request and the durable log (feature 2). The pure injection and inbox-reconciliation logic lives in `src/inject.ts`; `src/index.ts` wires it onto the Cordis context.

### Client half (`src/client/index.ts`, loaded as the plugin's `dsh.client` half)

- Registers a `CommandContribution` named `workspace-prompt`. The slash menu entry is only offered when the current session has a `cwd`.
- Registers a `shell.overlay` modal (`WorkspacePromptModal`) wired to a small `HostObservable`. Selecting the command reads the current value through the shared configuration form (`ctx.configForms.get('workspace-prompt')`, whose entry id is the loader row id) and opens the modal; when the form refuses writes (memory mode on a non-loopback page), Save and Clear stay disabled.
- **Save** / **Clear** call back through the same shared configuration form (`form.mutate` with `set` / `unset` path ops on `prompts.<cwd>`; a Host refusal answers `false` and the UI reports the failure), so the echoed value and the injected value share one source.
- Registers the **Settings → 工作区提示词 / Workspace prompts** overview page (`settings.section`). It lists every configured workspace on a card (in-place edit / clear), and an **Add workspace** picker — fed by the `useWorkspaces` standard hook — offers the registered workspaces that have **no prompt yet**; picking one opens a fresh editable row that persists on **Save**. The page subscribes to the same configuration form, so a write answer or a Host-side change republishes the list, and every write control stays disabled while the form is loading or refuses writes.

## Why the entry is a slash command, not the workspace "more" popup

The workspace action popup (`重命名` / `删除工作区`) in `packages/client/ui-workspace` is hardcoded in `Rows.tsx` with **no slot or extension point** for menu items. A source-unchanged plugin therefore cannot insert an item between those two rows. This plugin uses the existing `commandUi` + `shell.overlay` extension points instead, which need no Harness changes. (If you want it literally in that popup, that requires a one-line extension point in `ui-workspace` — a Harness source change.)

## Notes / limitations

- Changing the prompt mid-session appends the new text to the next request while the earlier value remains in history; the prompt is re-read fresh at each new session.
- The modal entry point is the slash command, not the workspace "more" popup (see above).
- This package requires DeepSeek Harness `0.1.7-alpha.1` or a compatible `0.1.7` prerelease (plugin configuration is Cordis `Config`, and the browser half reads and writes it through `ctx.configForms`). It is an independent third-party plugin and is not covered by the Harness `packages/*` test/coverage gates; integration must be verified in a running Harness.
- A prompt consumes context budget in every session of that workspace, so the longer it is, the less room is left for the conversation.

## Troubleshooting

- **The slash menu does not offer the command** — it is only offered when the current session has a `cwd`; an unbound session never shows it.
- **The prompt is not injected** — check that it is stored under the key (absolute path) of the workspace the session actually runs in. The session's `cwd` and the workspace path shown on the settings page must match exactly.
- **The plugin is missing from the UI after a restart** — confirm the plugin row is part of the profile with `dsh --profile web-prompt --dump-config`; the row is absent when the plugin is not composed in.

## Development

```sh
pnpm install
pnpm build          # builds lib/, which is committed and shipped
pnpm test           # vitest run
```

`tests/manifest-identity.spec.ts` asserts that `package.json`'s `name`, the `insert[].name` in `cordis.patch.yml`, and the `__ModuleLoader__.load({ id })` in the client bundle banner all agree — a rename turns it red instead of quietly installing a package that never loads.

## License

[MIT](LICENSE) © 2026 linbin-mk

This is an independent third-party plugin and is not affiliated with DeepSeek. It contains no third-party assets and therefore ships no `NOTICE` file; its build-time and runtime dependencies keep their own licenses (runtime dependencies are peer dependencies and are not redistributed with this package).
