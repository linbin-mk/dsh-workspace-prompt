English | [简体中文](https://github.com/linbin-mk/dsh-workspace-prompt/blob/main/README.md)

<p align="center">
  <img src="https://raw.githubusercontent.com/linbin-mk/dsh-workspace-prompt/main/assets/icon.png" width="112" alt="dsh-workspace-prompt icon: a blue folder holding a white terminal prompt, >_">
</p>

<h1 align="center">dsh-workspace-prompt</h1>

<p align="center">A dedicated prompt for every workspace.<br>
Write it once, turn the switch on, and every new session in that workspace carries it — after being asked once per session.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@linbin-mk/dsh-workspace-prompt"><img src="https://img.shields.io/npm/v/@linbin-mk/dsh-workspace-prompt" alt="npm version"></a>
  <a href="https://github.com/linbin-mk/dsh-workspace-prompt/actions/workflows/publish.yml"><img src="https://github.com/linbin-mk/dsh-workspace-prompt/actions/workflows/publish.yml/badge.svg" alt="publish workflow"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/@linbin-mk/dsh-workspace-prompt" alt="license"></a>
  <a href="package.json"><img src="https://img.shields.io/node/v/@linbin-mk/dsh-workspace-prompt" alt="Node"></a>
  <img src="https://img.shields.io/badge/platform-Web%20client-lightgrey" alt="platform">
</p>

> A pure third-party DeepSeek Harness plugin: it changes no Harness source, and its UI ships on the Web Client only.

## The problem it solves

One Harness session list often spans several repositories: the frontend wants pnpm and Chinese commit messages, the backend wants Gradle, the docs repo just wants short answers. Repeating those rules in every conversation is noisy and easy to forget; putting them in a global system prompt leaks them into every project.

`dsh-workspace-prompt` attaches the prompt to the **workspace** instead:

- **Scoped per workspace** — keyed by the session's absolute working directory (`cwd`), so workspaces never bleed into each other.
- **Off by default** — saving only stores the text; the prompt reaches the model context after you turn on the switch in the composer tool row.
- **Ask once per session** — the first time a session would actually inject it, a confirmation card appears. A session that answers "skip" is never asked again and never injected, and the switch state stays untouched.
- **Survives restarts** — the prompt and the switch live in the plugin's `Config`, written to the profile's user layer by the Harness user-settings provider.
- **Composes with `AGENTS.md`** — it reuses the injection shape of the official `agent-instructions`, so the transcript renders a collapsed context-injection row rather than a user bubble.

## Screenshots

### 1. Configure it with a slash command

<img src="https://raw.githubusercontent.com/linbin-mk/dsh-workspace-prompt/main/assets/screenshots/slash-command.png" width="780" alt="Typing /workspace-prompt in the composer shows the command entry 'configure a prompt for the current workspace'">

Type `/workspace-prompt` in any session and pick **配置工作区提示词**. The command is only offered when the session has a `cwd`.

<img src="https://raw.githubusercontent.com/linbin-mk/dsh-workspace-prompt/main/assets/screenshots/configure-modal.png" width="360" alt="Workspace prompt modal: workspace directory, prompt textarea, Clear and Save buttons">

The modal echoes the stored value; **Save** writes it, **Clear** removes the prompt together with the switch state.

### 2. Turn on the switch in the composer tool row

Once a prompt is saved, the composer tool row shows **工作区提示词-关** (workspace prompt, off). One click turns it into **工作区提示词-开** over a light gray fill (the same gray as the composer's `⊕` button). A workspace without a prompt shows no switch at all.

### 3. Confirm once per session

<img src="https://raw.githubusercontent.com/linbin-mk/dsh-workspace-prompt/main/assets/screenshots/confirm-card.en.png" width="780" alt="Confirmation card on the first send of a session: include this workspace’s prompt in this session? The Include option shows the configured prompt; the other option is Skip">

With the switch on, the first time a session actually needs injection it shows this card:

- **Include** — shows the workspace's own prompt right after the label, so you can see exactly what enters this session's model context;
- **Skip** — this session is never asked again and never injected, and **the switch stays as it is** (the next session asks again).

The card renders one language only, following the DSH UI language: an explicit language chosen in Settings wins, and a browser that never chose one is followed through the Host system language (the browser's default in a local `dsh web` deployment).

The card rides the official `ctx.userQuestions` channel (the same one approvals and plan review use), so it appears inside that session and the step waits for your answer.

### 4. Manage everything from Settings

<img src="https://raw.githubusercontent.com/linbin-mk/dsh-workspace-prompt/main/assets/screenshots/settings-overview.png" width="700" alt="Settings → Workspace prompts: cards for configured workspaces, prompt textareas and an Add workspace button">

**Settings → 工作区提示词** lists every configured workspace with in-place editing and clearing, and **Add workspace** picks from registered workspaces that have no prompt yet.

## Quick start

### Install

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
dsh plugin --profile web-prompt add ./linbin-mk-dsh-workspace-prompt-<version>.tgz
```

Because the package declares a `dsh.client` entry, the web shell loads `lib/client.js` automatically once the plugin is part of the composed tree; the node half (`lib/index.js`) declares the live-editable `Config` and injects the prompt at `agent/pre-step`.

### Five steps to use it

1. Open any session inside the workspace you want to configure.
2. Type `/workspace-prompt`, pick **配置工作区提示词**, write the prompt and click **保存**.
3. Click **工作区提示词** in the composer tool row; the label flips from `-关` to `-开`.
4. Send messages as usual; the first time the session needs injection, answer **带上** or **不带** on the confirmation card.
5. When you no longer need it, turn the switch off, or click **清除** in the modal / settings page.

## Behaviour details

| Item | Behaviour |
| --- | --- |
| Scope | Both the prompt and the switch are keyed by the session's absolute working directory (`cwd`); the session's `cwd` must match the workspace path shown in Settings exactly. |
| Default state | Off. A workspace without a prompt shows no switch, and the composer tool row stays exactly as it was. |
| Injection timing | With the switch on, injection happens in the `agent/pre-step` hook; every step first checks whether the payload is already in the session context, so it is never duplicated. |
| Session confirmation | Each session is asked once, the first time injection is actually needed. A session that answered "include" re-injects the newest text directly — without asking — if the text changes or compaction drops it. |
| Persistence | Stored in the plugin `Config` fields `prompts` / `enabled`, both live-editable, and written to the profile's user layer by the Harness settings provider. |
| No question channel | Without a `userQuestions` service, in headless runs, or with a child / managed agent (`DELEGATED_CALLER`), the plugin falls back to the switch's standing intent and injects; a dismissal (`ASK_CANCELLED`) counts as this turn's skip. |
| Effective from the next step | Changes apply from the next step: turning the switch on mid-session adds the prompt to that session's next request, and editing the text appends the new value while the earlier one stays in history. |

## Requirements

- Node.js `^22.19` or `>=24`;
- DeepSeek Harness `0.2.1-rc.2` or a compatible `0.2.1` prerelease, with a Web profile that provides `ctx.settings` / `ctx.configForms` / `ctx.agent`; the once-per-session confirmation also needs `ctx.userQuestions` (shipped in the Web profile through `@deepseek-ai/dsh-user-questions`; without it the plugin falls back to the switch);
- The user interface is offered on the Web Client only; there is no terminal or desktop entry point.

## How it works

### Host half (`src/index.ts` + `src/inject.ts`, loaded as a Cordis plugin)

- Declares its Cordis `Config`: `prompts: Record<absoluteDir, string>` and `enabled: Record<absoluteDir, boolean>`, both marked `.volatile()` so the settings form can edit them live. Its loader row id `workspace-prompt` is the settings namespace; the Harness settings provider writes Host-side changes to the profile's user layer and pushes them to the plugin. The plugin ships its own settings page, so `apply` turns the generated config page off with `ctx.settings.configure({ auto: false })`.
- Listens on `agent/pre-step`. For each step it reads the session's `header.cwd` and only then — **when that workspace's `enabled` is `true`** — looks the prompt up. When that payload is not already in the session context, it first asks through `ctx.get('userQuestions')?.ask(...)` (once per session; the answer stands for the whole session); only an **Include** answer mints a `user/message` wrapped in `<system-reminder>`, manages it in the agent inbox, and folds it into the step's decision so it reaches the first model request and the durable log. Before asking, it renders the copy in one UI language and puts the raw prompt in the Include option's description.
- The pure switch check, injection, and inbox-reconciliation logic lives in `src/inject.ts` (`promptFor` / `enabledFor`); the question payload, answer reading, and per-session memory live in `src/confirm.ts` (`confirmQuestions` / `readInclude` / `SessionDecisions`); the copy-language choice lives in `src/language.ts` (`locale.preference` first, else the Host system language); `src/index.ts` wires them onto the Cordis context.
- **Never blocks on a question nobody can answer**: without a `userQuestions` service, with no answerer (headless runs), or with an owned / delegated agent (`DELEGATED_CALLER`), it falls back to the switch's standing intent and injects.

### Client half (`src/client/index.ts`, loaded as the plugin's `dsh.client` half)

- Registers a `CommandContribution` named `workspace-prompt`. The slash menu entry is only offered when the current session has a `cwd`.
- Registers a `shell.overlay` modal (`WorkspacePromptModal`) wired to a small `HostObservable`. Selecting the command reads the current value through the shared configuration form (`ctx.configForms.get('workspace-prompt')`, whose entry id is the loader row id) and opens the modal; when the form refuses writes (not ready, or the Host document rejects the write), Save and Clear stay disabled.
- **Save** / **Clear** call back through the same shared configuration form (`form.mutate` with `set` / `unset` path ops on `prompts.<cwd>`; clearing also unsets `enabled.<cwd>`; a Host refusal answers `false` and the UI reports the failure), so the echoed value and the injected value share one source.
- Registers the composer tool row switch (`conversation.input.left`, `WorkspacePromptToggle`): it resolves the current session's `cwd` through `useSessions` and renders only while that workspace has a configured prompt. A click writes `enabled.<cwd>`. The two states are one chip with two fills and two labels: off is transparent with the secondary label colour and a `-关` suffix, on is the `--dsw-specific-selector` gray with the primary label colour and a `-开` suffix. A refused write, a read-only configuration, or a **Host half older than this browser half** no longer renders a real `disabled` button (that would swallow the tooltip): the chip reports `aria-disabled`, dims, and explains itself on hover.
- Registers the **Settings → 工作区提示词 / Workspace prompts** overview page (`settings.section`). It lists every configured workspace on a card (in-place edit / clear), and an **Add workspace** picker — fed by the `useWorkspaces` standard hook — offers the registered workspaces that have **no prompt yet**; picking one opens a fresh editable row that persists on **Save**. The page subscribes to the same configuration form, so a write answer or a Host-side change republishes the list, and every write control stays disabled while the form is loading or refuses writes.

## Why the entry is a slash command, not the workspace "more" popup

The workspace action popup (`重命名` / `删除工作区`) in `packages/client/ui-workspace` is hardcoded in `Rows.tsx` with **no slot or extension point** for menu items. A source-unchanged plugin therefore cannot insert an item between those two rows. This plugin uses the existing `commandUi` + `shell.overlay` extension points instead, which need no Harness changes. (If you want it literally in that popup, that requires a one-line extension point in `ui-workspace` — a Harness source change.)

## Notes / limitations

- Switch and prompt changes apply from the next step: turning the switch on mid-session adds the prompt to that session's next request, and editing the text appends the new value while the earlier one stays in history.
- The modal entry point is the slash command, not the workspace "more" popup (see above).
- This package requires DeepSeek Harness `0.2.1-rc.2` or a compatible `0.2.1` prerelease (plugin configuration is Cordis `Config`, and the browser half reads and writes it through `ctx.configForms`). It is an independent third-party plugin and is not covered by the Harness `packages/*` test / coverage gates; integration must be verified in a running Harness.
- A prompt consumes context budget only while the switch is on, so the longer it is, the less room is left for the conversation.
- The switch is remembered per workspace: turning it on in one session arms the workspace's other sessions (including later ones) until it is turned off again.
- Each session is asked **once**: a session that answered "skip" is never asked again and never injected (to change your mind mid-session, turn the switch off and on again — a new session asks fresh). A session that answered "include" re-injects the newest text directly, without asking, if the text changes or compaction drops it.
- The confirmation card follows the DSH UI language and renders **one language only**: an explicit `locale.preference` from Settings wins, and a browser that never chose one is followed through the Host system language (the question protocol carries literal text, so the Host must pick one language before it asks). The Include option's description is the configured prompt itself.

## Troubleshooting

- **The slash menu does not offer the command** — it is only offered when the current session has a `cwd`; an unbound session never shows it.
- **The prompt is not injected** — look at the composer tool row first: the switch defaults to `OFF`, and its absence means this workspace has no prompt yet. With the switch `ON`, check that the prompt is stored under the key (absolute path) of the workspace the session actually runs in. The session's `cwd` and the workspace path shown on the settings page must match exactly.
- **The composer shows no switch** — this workspace has no configured prompt yet (by design); save one with `/workspace-prompt` or from the settings page.
- **Sending shows no confirmation** — that send needed no decision: the prompt already stands in this session's context (the question appears only when it would actually be injected), or the profile composes no `userQuestions` channel (headless / child-agent sessions), where the switch's standing intent applies directly.
- **After upgrading the plugin the switch is inert or only greys out** — the browser half is fetched from disk on every page load while the Host half is loaded at process start: after `dsh plugin add` you must **restart `dsh web`**, otherwise the old Host refuses the new field (the switch says so itself). Prompts stay off after the restart until you turn each workspace's switch on again.
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
