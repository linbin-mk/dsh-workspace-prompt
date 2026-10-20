window.__ModuleLoader__.load({
	id: "@linbin-mk/dsh-workspace-prompt",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/prompt-settings.ts
		/**
		* Configuration identity shared by the host and client halves.
		*
		* The profile entry id in `cordis.patch.yml` names the loader row, and the
		* Host maps this plugin's Config onto that same id as the settings namespace,
		* so the browser half addresses one entry through `ctx.configForms.get`. The
		* host half declares the Cordis Config schema over
		* {@link WorkspacePromptSettings}; the client half reads and edits that
		* section path by path.
		*/
		/** Profile entry id owning this plugin's Config; also its settings namespace. */
		const ENTRY_ID = "workspace-prompt";
		/** Config field carrying the per-workspace prompts map. */
		const PROMPTS_FIELD = "prompts";
		/**
		* Config field carrying the per-workspace arm switch. A configured prompt is
		* injected only while its workspace's entry here is `true`, so saving a prompt
		* never changes what the next session receives by itself.
		*/
		const ENABLED_FIELD = "enabled";
		//#endregion
		//#region src/client/config.ts
		/**
		* Project one config-form snapshot into the overview's vocabulary.
		* @param snapshot - current shared config-form snapshot.
		* @returns the status, write permission, prompts, and arm switches the UI renders.
		*/
		function promptsView(snapshot) {
			const value = snapshot.value;
			return {
				status: snapshot.status,
				writable: snapshot.writable,
				prompts: value?.prompts ?? {},
				enabled: value?.enabled ?? {},
				switchSupported: value === void 0 || Object.hasOwn(value, "enabled")
			};
		}
		/**
		* Read the stored prompt for one workspace directory.
		* @param form - shared config form for this plugin's entry.
		* @param cwd - absolute workspace directory.
		* @returns the stored prompt, or an empty string when none is configured.
		*/
		function promptFor(form, cwd) {
			return form.getSnapshot().value?.prompts[cwd] ?? "";
		}
		/**
		* Store (or replace) one workspace prompt.
		* @param form - shared config form for this plugin's entry.
		* @param cwd - absolute workspace directory.
		* @param text - prompt text to persist.
		* @returns whether the Host accepted the write (false for a refusal or a skipped write).
		*/
		function setPrompt(form, cwd, text) {
			return form.mutate([{
				op: "set",
				path: [PROMPTS_FIELD, cwd],
				value: text
			}]);
		}
		/**
		* Remove one workspace prompt.
		*
		* The workspace's arm switch goes with it: a switch left behind would arm the
		* workspace again the moment a new prompt is saved to it.
		* @param form - shared config form for this plugin's entry.
		* @param cwd - absolute workspace directory.
		* @returns whether the Host accepted the clear (false for a refusal or a skipped write).
		*/
		function unsetPrompt(form, cwd) {
			return form.mutate([{
				op: "unset",
				path: [PROMPTS_FIELD, cwd]
			}, {
				op: "unset",
				path: [ENABLED_FIELD, cwd]
			}]);
		}
		/**
		* Arm or disarm one workspace's prompt for the sessions started in it.
		* @param form - shared config form for this plugin's entry.
		* @param cwd - absolute workspace directory.
		* @param enabled - whether that workspace's prompt should be injected.
		* @returns whether the Host accepted the write (false for a refusal or a skipped write).
		*/
		function setEnabled(form, cwd, enabled) {
			return form.mutate([{
				op: "set",
				path: [ENABLED_FIELD, cwd],
				value: enabled
			}]);
		}
		//#endregion
		//#region src/client/stores.ts
		/**
		* Module-level observable backing the modal. `shell.overlay` is a root-scoped
		* slot, and the renderer does not deliver a per-entry `inject` face for
		* root-scoped entries — so the command half (which owns `ctx`) writes the open
		* signal and the persist handlers here, and the modal component reads them via
		* React's {@link useSyncExternalStore}. This avoids the slot inject entirely.
		*/
		var WorkspacePromptObservable = class {
			listeners = /* @__PURE__ */ new Set();
			state = {
				open: false,
				cwd: void 0,
				value: "",
				writable: false
			};
			/** Set by the command half at activation; undefined only before first activation. */
			handlers;
			getSnapshot = () => this.state;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			open = (cwd, value) => {
				this.state = {
					...this.state,
					open: true,
					cwd,
					value
				};
				this.emit();
			};
			close = () => {
				this.state = {
					...this.state,
					open: false
				};
				this.emit();
			};
			/** Adopt the shared config form's write permission. */
			setWritable = (writable) => {
				if (this.state.writable === writable) return;
				this.state = {
					...this.state,
					writable
				};
				this.emit();
			};
			emit() {
				for (const listener of this.listeners) listener();
			}
		};
		/** Single instance shared by the command half (writer) and the modal (reader). */
		const workspacePromptModal = new WorkspacePromptObservable();
		/**
		* Module-level observable backing the settings overview section, mirroring
		* the {@link WorkspacePromptObservable} pattern: `settings.section` renders
		* through the root-scoped slot machinery, so the command half (which owns
		* `ctx`) writes the read handler here and the section reads state via React's
		* {@link useSyncExternalStore}.
		*/
		var WorkspacePromptsObservable = class {
			listeners = /* @__PURE__ */ new Set();
			state = {
				entries: [],
				status: "loading",
				writable: false,
				switchSupported: true
			};
			/** Set by the command half at activation; undefined only before first activation. */
			handlers;
			getSnapshot = () => this.state;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			/**
			* Replace the live state from one config-form read. Empty prompts are
			* dropped and entries are ordered by workspace directory.
			* @param view - status, write permission, prompts, and arm switches read from the form.
			*/
			adopt = (view) => {
				this.state = {
					entries: Object.entries(view.prompts).filter(([, text]) => text.length > 0).map(([cwd, text]) => ({
						cwd,
						text,
						enabled: view.enabled[cwd] === true
					})).sort((a, b) => a.cwd.localeCompare(b.cwd)),
					status: view.status,
					writable: view.writable,
					switchSupported: view.switchSupported
				};
				this.emit();
			};
			/** Re-read the shared config form (no-op before activation). */
			refresh = async () => {
				const view = this.handlers?.view;
				if (view === void 0) return;
				this.adopt(view());
			};
			emit() {
				for (const listener of this.listeners) listener();
			}
		};
		/** Single instance shared by the command half (writer) and the settings section (reader). */
		const workspacePrompts = new WorkspacePromptsObservable();
		//#endregion
		//#region src/client/locales.ts
		/** Chinese (source of truth) dictionary for the workspace-prompt client plugin. */
		const zh = {
			"command.description": "配置当前工作区的特定提示词",
			"command.open": "配置工作区提示词",
			"chip.label.on": "工作区提示词-开",
			"chip.label.off": "工作区提示词-关",
			"chip.on.hint": "已开启：本会话首次要注入时会确认一次；选过「不带」后本会话不再询问。点击关闭。",
			"chip.off.hint": "未开启：会话不会注入这段提示词。点击开启。",
			"chip.readonly.hint": "配置当前不可写，无法切换。",
			"chip.failed.hint": "切换失败：Host 拒绝了这次写入；若刚升级插件，请重启 dsh web 后重试。",
			"chip.skew.hint": "Host 侧还是升级前的版本：重启 dsh web 后这个开关才会生效。",
			"modal.title": "配置工作区提示词",
			"modal.placeholder": "为该工作区编写特定提示词，打开「工作区提示词」开关后，它会在会话开始时注入模型上下文…",
			"modal.cwd": "工作区目录：{cwd}",
			"modal.save": "保存",
			"modal.clear": "清除",
			"modal.saving": "保存中…",
			"modal.cleared": "已清除",
			"modal.error": "保存失败：{message}",
			"error.rejected": "配置不可写，或写入已被 Host 拒绝",
			"settings.nav": "工作区提示词",
			"settings.title": "工作区提示词",
			"settings.intro": "为每个工作区保存一段专属提示词。开关打开后，会话第一次真正用到它之前只确认一次：选「带上」就注入，选「不带」该会话不再询问，开关不变。",
			"settings.card": "工作区",
			"settings.add": "添加工作区",
			"settings.add.header": "未配置提示词的工作区",
			"settings.add.empty": "所有工作区都已配置提示词",
			"settings.add.none": "当前还没有任何工作区",
			"settings.add.loading": "正在加载工作区列表…",
			"settings.count": "已配置 {count} 个工作区",
			"settings.countOf": "已配置 {configured} 个 / 共 {total} 个工作区",
			"settings.new": "新配置",
			"settings.pendingPreview": "尚未保存",
			"settings.on": "已开启",
			"settings.off": "已关闭",
			"settings.unconfigured": "未配置",
			"settings.divider": "未配置的工作区",
			"settings.emptyInline": "还没有配置任何提示词：点击右上角「添加工作区」开始。",
			"settings.editorLabel": "提示词",
			"settings.placeholder": "为该工作区编写专属提示词…",
			"settings.charCount": "{count} 字",
			"settings.editorHint": "开关打开时，每个会话首次注入前会确认一次。",
			"settings.toggleAria": "工作区提示词开关：{name}",
			"settings.toggleError": "切换失败：Host 拒绝了这次写入",
			"settings.readonly": "配置当前不可写：Host 还没有给出可用的配置表单。请稍后重试；若刚升级插件，重启 dsh web 即可。",
			"settings.skew": "Host 侧仍是升级前的版本，开关暂不可用；重启 dsh web 后即可切换。",
			"settings.save": "保存",
			"settings.clear": "清除",
			"settings.cancel": "取消",
			"settings.error": "操作失败：{message}"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"command.description": "Configure a workspace-specific prompt for the current workspace",
			"command.open": "Configure workspace prompt",
			"chip.label.on": "Workspace prompt-on",
			"chip.label.off": "Workspace prompt-off",
			"chip.on.hint": "On: the first injection in a session asks once; after a “skip” that session is never asked again. Click to turn off.",
			"chip.off.hint": "Off: sessions are not given this prompt. Click to turn on.",
			"chip.readonly.hint": "The configuration is read-only right now.",
			"chip.failed.hint": "Switch failed: the Host refused the write. If you just upgraded the plugin, restart dsh web and retry.",
			"chip.skew.hint": "The Host half is still the pre-upgrade version: restart dsh web for this switch to take effect.",
			"modal.title": "Configure workspace prompt",
			"modal.placeholder": "Write a workspace-specific prompt; once the Workspace prompt switch is on, it is injected into the model context at session start…",
			"modal.cwd": "Workspace directory: {cwd}",
			"modal.save": "Save",
			"modal.clear": "Clear",
			"modal.saving": "Saving…",
			"modal.cleared": "Cleared",
			"modal.error": "Save failed: {message}",
			"error.rejected": "the configuration is read-only, or the Host refused the write",
			"settings.nav": "Workspace prompts",
			"settings.title": "Workspace prompts",
			"settings.intro": "Save a dedicated prompt for each workspace. With the switch on, each session is asked once before the prompt is used: include it, or skip it for that session without changing the switch.",
			"settings.card": "Workspace",
			"settings.add": "Add workspace",
			"settings.add.header": "Workspaces without a prompt",
			"settings.add.empty": "Every workspace already has a prompt",
			"settings.add.none": "There are no workspaces yet",
			"settings.add.loading": "Loading workspaces…",
			"settings.count": "{count} workspace prompt(s) configured",
			"settings.countOf": "{configured} of {total} workspaces configured",
			"settings.new": "New",
			"settings.pendingPreview": "Not saved yet",
			"settings.on": "On",
			"settings.off": "Off",
			"settings.unconfigured": "Not configured",
			"settings.divider": "Workspaces without a prompt",
			"settings.emptyInline": "No workspace prompt configured yet: start with “Add workspace” in the top-right corner.",
			"settings.editorLabel": "Prompt",
			"settings.placeholder": "Write a prompt for this workspace…",
			"settings.charCount": "{count} chars",
			"settings.editorHint": "While the switch is on, each session is asked once before the prompt goes in.",
			"settings.toggleAria": "Workspace prompt switch: {name}",
			"settings.toggleError": "Switch failed: the Host refused the write",
			"settings.readonly": "The configuration is read-only: the Host has not provided a usable form yet. Retry shortly, or restart dsh web after upgrading the plugin.",
			"settings.skew": "The Host half is still the pre-upgrade version, so the switch is unavailable; restart dsh web to enable it.",
			"settings.save": "Save",
			"settings.clear": "Clear",
			"settings.cancel": "Cancel",
			"settings.error": "Operation failed: {message}"
		};
		//#endregion
		//#region src/client/WorkspacePromptModal.tsx
		/**
		* Frame-wide modal (registered into `shell.overlay`) that edits the prompt
		* configured for the workspace the current session runs in. Opened by the
		* `/workspace-prompt` slash command; saves and clears through the persist
		* handlers the command half registered on the shared observable, and disables
		* both actions while the shared config form refuses writes.
		*
		* It reads its state from the module-level {@link workspacePromptModal}
		* observable via `useSyncExternalStore` — `shell.overlay` is a root-scoped
		* slot that does not deliver a per-entry `inject` face, so the modal cannot
		* receive data through slot props.
		*/
		function WorkspacePromptModal() {
			const state = (0, react.useSyncExternalStore)(workspacePromptModal.subscribe, workspacePromptModal.getSnapshot);
			const [draft, setDraft] = (0, react.useState)(state.value);
			const [busy, setBusy] = (0, react.useState)(false);
			const [focused, setFocused] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				setDraft(state.value);
				setError(null);
			}, [state.open, state.value]);
			if (!state.open || state.cwd === void 0) return null;
			const cwd = state.cwd;
			const disabled = busy || !state.writable;
			const onSave = async () => {
				setBusy(true);
				setError(null);
				try {
					await workspacePromptModal.handlers?.save(cwd, draft);
					workspacePromptModal.close();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			const onClear = async () => {
				setBusy(true);
				setError(null);
				try {
					await workspacePromptModal.handlers?.clear(cwd);
					workspacePromptModal.close();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose: () => workspacePromptModal.close(),
				closeLabel: "关闭",
				title: zh["modal.title"],
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					disabled,
					onClick: onClear,
					children: zh["modal.clear"]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					disabled,
					onClick: onSave,
					children: zh["modal.save"]
				})] }),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							display: "inline-block",
							padding: "4px 8px",
							borderRadius: 6,
							background: "var(--dsw-alias-bg-layer-2, #f2f4f7)",
							fontSize: 12,
							lineHeight: 1.5,
							color: "var(--dsw-alias-label-secondary, #475467)",
							fontFamily: "var(--dsw-alias-font-mono, monospace)",
							wordBreak: "break-all"
						},
						children: zh["modal.cwd"].replace("{cwd}", cwd)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						value: draft,
						placeholder: zh["modal.placeholder"],
						disabled: busy,
						onFocus: () => {
							setFocused(true);
						},
						onBlur: () => {
							setFocused(false);
						},
						onChange: (event) => {
							setDraft(event.target.value);
						},
						rows: 8,
						style: {
							width: "100%",
							boxSizing: "border-box",
							marginTop: 10,
							padding: "8px 10px",
							border: `1px solid ${focused ? "var(--dsw-alias-brand-primary, #4176e6)" : "var(--dsw-alias-border-l2, #d0d5dd)"}`,
							borderRadius: 8,
							background: "var(--dsw-alias-bg-layer-1, #ffffff)",
							color: "var(--dsw-alias-label-primary, #101828)",
							fontSize: 13,
							lineHeight: 1.6,
							resize: "vertical",
							outline: "none",
							boxShadow: focused ? "0 0 0 2px rgba(65, 118, 230, 0.18)" : void 0,
							opacity: busy ? .6 : 1
						}
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "alert",
						style: {
							color: "var(--dsw-alias-state-error-primary, #c0392b)",
							marginTop: 8
						},
						children: zh["modal.error"].replace("{message}", error)
					})
				]
			});
		}
		//#endregion
		//#region src/client/WorkspacePromptToggle.tsx
		/**
		* The workspace-prompt arm control.
		*
		* One chip, two states, told apart by the label's own suffix and one step of
		* fill: off is plain (no background, secondary label) and reads
		* `Workspace prompt-off`, on carries the row's chip gray and reads
		* `Workspace prompt-on`. Clicking flips it; nothing else is drawn inside.
		*
		* {@link WorkspacePromptChipEntry} is the composer occupant: it registers into
		* `conversation.input.left`, resolves the current Session's workspace, and
		* renders nothing at all while that workspace has no configured prompt — the
		* control exists only where it can do something. {@link PromptToggleChip} is
		* the same visual reused by the settings overview rows, which pass their own
		* localized copy.
		*/
		const chipBase = {
			display: "inline-flex",
			alignItems: "center",
			gap: 6,
			height: 28,
			padding: "0 8px",
			borderRadius: "var(--dsw-radius-sm, 8px)",
			border: "none",
			font: "inherit",
			fontSize: 13,
			lineHeight: "20px",
			fontWeight: 500,
			whiteSpace: "nowrap",
			cursor: "pointer",
			userSelect: "none",
			transition: "background 160ms ease, color 160ms ease"
		};
		/** Off: the plain chip every sibling control uses — no fill, no outline. */
		const idleChip = {
			background: "transparent",
			color: "var(--dsw-alias-label-secondary, rgb(97, 102, 107))"
		};
		/** Off under the pointer: the standard hover fill, nothing more. */
		const idleChipLive = {
			background: "var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06))",
			color: "var(--dsw-alias-label-primary, rgb(15, 17, 21))"
		};
		/** On: the row's own chip gray — the fill the composer's `+` control already uses. */
		const armedChip = {
			background: "var(--dsw-specific-selector, rgb(242, 243, 245))",
			color: "var(--dsw-alias-label-primary, rgb(15, 17, 21))"
		};
		/** On under the pointer: the same gray, one step deeper. */
		const armedChipLive = {
			background: "var(--dsw-alias-interactive-bg-hover-solid, rgb(233, 235, 238))",
			color: "var(--dsw-alias-label-primary, rgb(15, 17, 21))"
		};
		/** Refused write: the label turns to the error state for a moment. */
		const failedChip = {
			background: "color-mix(in srgb, var(--dsw-alias-state-error-primary, rgb(236, 19, 19)) 10%, transparent)",
			color: "var(--dsw-alias-state-error-primary, rgb(236, 19, 19))"
		};
		/** The label the pointer currently reads. */
		function hintFor(enabled, phase, reason, labels) {
			if (phase === "failed") return labels.failedHint;
			if (reason === "skew") return labels.skewHint;
			if (reason === "readonly") return labels.readonlyHint;
			return enabled ? labels.onHint : labels.offHint;
		}
		/**
		* One arm control, rendered from plain props.
		* @param props - enabled state, write phase, inert reason, localized copy, and the click handler.
		* @returns the chip element for either state.
		*/
		function PromptToggleChip({ enabled, reason, phase, labels, onToggle }) {
			const [live, setLive] = (0, react.useState)(false);
			const state = phase === "failed" ? failedChip : enabled ? live ? armedChipLive : armedChip : live ? idleChipLive : idleChip;
			const inert = reason !== "none" || phase === "busy";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: hintFor(enabled, phase, reason, labels),
				side: "top",
				delayMs: 400,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-label": enabled ? labels.labelOn : labels.labelOff,
					"aria-pressed": enabled,
					"aria-busy": phase === "busy",
					"aria-disabled": inert,
					disabled: phase === "busy",
					style: {
						...chipBase,
						...state,
						...inert ? {
							cursor: "not-allowed",
							opacity: .55
						} : null
					},
					onClick: () => {
						if (!inert) onToggle(!enabled);
					},
					onMouseEnter: () => {
						setLive(true);
					},
					onMouseLeave: () => {
						setLive(false);
					},
					onFocus: () => {
						setLive(true);
					},
					onBlur: () => {
						setLive(false);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 13 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: enabled ? labels.labelOn : labels.labelOff })]
				})
			});
		}
		/**
		* Composer occupant of `conversation.input.left`, directly right of the
		* permission and plan controls in the composer tool row.
		*
		* It renders only while the current Session's workspace has a configured
		* prompt: an unconfigured workspace gets the row exactly as it was before the
		* plugin was installed. The switch state is the workspace's, not the
		* Session's, so arming it here also arms the next Session in the same
		* workspace.
		* @param props - composed slot props (Session identity plus the injected face).
		* @returns the chip, or null when this workspace has no prompt to arm.
		*/
		function WorkspacePromptChipEntry({ sessionId, useSessions, usePrompts, toggle, t }) {
			const cwd = useSessions((state) => state.byId[sessionId]?.cwd);
			const state = usePrompts((value) => value);
			const [phase, setPhase] = (0, react.useState)("idle");
			const entry = cwd === void 0 ? void 0 : state.entries.find((item) => item.cwd === cwd);
			(0, react.useEffect)(() => {
				if (phase !== "failed") return;
				const timer = setTimeout(() => {
					setPhase("idle");
				}, 2200);
				return () => {
					clearTimeout(timer);
				};
			}, [phase]);
			if (entry === void 0) return null;
			const reason = !state.switchSupported ? "skew" : state.status !== "ready" || !state.writable ? "readonly" : "none";
			const labels = {
				labelOn: t("chip.label.on"),
				labelOff: t("chip.label.off"),
				onHint: t("chip.on.hint"),
				offHint: t("chip.off.hint"),
				readonlyHint: t("chip.readonly.hint"),
				failedHint: t("chip.failed.hint"),
				skewHint: t("chip.skew.hint")
			};
			const switchTo = (next) => {
				setPhase("busy");
				toggle(entry.cwd, next).then(() => {
					setPhase("idle");
				}).catch(() => {
					setPhase("failed");
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptToggleChip, {
				enabled: entry.enabled,
				reason,
				phase,
				labels,
				onToggle: switchTo
			});
		}
		//#endregion
		//#region src/client/rows.ts
		/**
		* Build the card list from persisted entries and pending (unsaved) rows.
		*
		* Invariant: exactly one card per directory. A pending row is rendered only
		* while its directory is still absent from the persisted list, so a save's
		* reload swaps the pending card for the persisted card in the same render —
		* same React key, no duplicate-key frame, and no dependence on a cleanup
		* effect's timing.
		* @param entries - persisted prompts from the settings store.
		* @param pending - directories picked from the Add menu, not yet persisted.
		* @returns the card rows, pending (unsaved) cards first then persisted order.
		*/
		function mergePromptRows(entries, pending) {
			const persistedCwds = new Set(entries.map((entry) => entry.cwd));
			return [...pending.filter((row) => !persistedCwds.has(row.cwd)).map((row) => ({
				cwd: row.cwd,
				text: "",
				enabled: false,
				isNew: true
			})), ...entries.map((entry) => ({
				cwd: entry.cwd,
				text: entry.text,
				enabled: entry.enabled,
				isNew: false
			}))];
		}
		//#endregion
		//#region src/client/workspaces.ts
		/**
		* Filter the workspace list down to workspaces without a configured prompt,
		* excluding the paths already being edited (pending rows) as well. Stable
		* display order: title localeCompare, ties by path localeCompare.
		* @param workspaces - every registered workspace (`useWorkspaces` items).
		* @param excludedPaths - paths that must not appear (configured + pending).
		* @returns the selectable rows, sorted by title then path.
		*/
		function unconfiguredWorkspaces(workspaces, excludedPaths) {
			return workspaces.filter((workspace) => !excludedPaths.has(workspace.path)).map((workspace) => ({
				workspaceId: workspace.workspaceId,
				path: workspace.path,
				title: workspace.title
			})).sort((a, b) => a.title.localeCompare(b.title) || a.path.localeCompare(b.path));
		}
		//#endregion
		//#region \0wsp-css:src/client/WorkspacePromptsSection.module.css.mjs
		const css = "/* Workspace-prompt settings page.\n *\n * Design language follows the dsh-session-sync settings page: a 16/24 title\n * over a 14/22 intro, one settings card on the shipped settings-card material,\n * 0.5px hairlines between blocks, and workspace rows built from the same\n * folder-row anatomy as the sidebar tree. Every color resolves through a\n * `--dsw-alias-*` token, so light and dark themes share one stylesheet.\n *\n * Class names are scoped by the client bundle's CSS-module plugin (prefix\n * `wsp-`), so nothing here can collide with the shell or another plugin.\n */\n\n.wsp-section {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  max-width: 720px;\n  padding-bottom: 16px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.wsp-title {\n  margin: 0;\n  font-size: 16px;\n  line-height: 24px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n}\n\n.wsp-intro {\n  margin: 0;\n  font-size: 14px;\n  line-height: 22px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.wsp-banner {\n  margin: 0;\n  padding: 10px 12px;\n  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 35%, transparent);\n  border-radius: var(--dsw-radius-lg);\n  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 9%, transparent);\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-state-warn-label);\n}\n\n.wsp-card {\n  display: flex;\n  flex-direction: column;\n  padding: 14px;\n  border: 0.5px solid var(--dsw-alias-settings-card-stroke);\n  border-radius: var(--dsw-radius-xl);\n  background: var(--dsw-alias-settings-card-fill);\n}\n\n.wsp-cardHead {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  min-height: 24px;\n}\n\n.wsp-cardTitle {\n  margin: 0;\n  font-size: 13px;\n  font-weight: 600;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n}\n\n.wsp-headActions {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-width: 0;\n}\n\n.wsp-cardMeta {\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n}\n\n.wsp-list {\n  display: flex;\n  flex-direction: column;\n}\n\n.wsp-listHint {\n  margin: 12px 8px 0;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.wsp-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 10px 8px;\n  border-radius: var(--dsw-radius-md);\n  transition: background-color 600ms ease;\n}\n\n.wsp-item {\n  display: flex;\n  flex-direction: column;\n}\n\n.wsp-item + .wsp-item {\n  border-top: 0.5px solid var(--dsw-alias-border-l2);\n}\n\n.wsp-row:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n/* A workspace without a prompt has no action of its own; the add menu owns\n * that verb, so its row must not read as clickable. */\n.wsp-row[data-unconfigured='true']:hover {\n  background: transparent;\n}\n\n.wsp-item[data-flash='true'] .wsp-row {\n  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);\n}\n\n.wsp-rowMain {\n  flex: 1;\n  min-width: 0;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: inherit;\n  font-family: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n\n.wsp-rowMainStatic {\n  cursor: default;\n}\n\n.wsp-rowMain:focus-visible {\n  outline: var(--dsw-focus-ring-width, 2px) solid\n    var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));\n  outline-offset: 2px;\n  border-radius: var(--dsw-radius-sm);\n}\n\n.wsp-folder {\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 16px;\n  height: 20px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.wsp-row[data-enabled='false'] .wsp-folder,\n.wsp-row[data-unconfigured='true'] .wsp-folder {\n  color: var(--dsw-alias-label-caption);\n}\n\n.wsp-rowText {\n  flex: 1;\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n}\n\n.wsp-rowTitle {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 14px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.wsp-row[data-unconfigured='true'] .wsp-rowTitle {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.wsp-rowPreview {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.wsp-rowPreviewMono {\n  font-family: var(--dsh-font-family-code-default, monospace);\n  font-size: 11px;\n  line-height: 17px;\n}\n\n.wsp-rowState {\n  flex: none;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.wsp-row[data-enabled='false'] .wsp-rowState {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.wsp-rowStateMuted {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.wsp-rowError {\n  margin: 2px 0 0;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-state-error-primary);\n}\n\n.wsp-chevron {\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 16px;\n  height: 16px;\n  color: var(--dsw-alias-label-caption);\n  transition: transform 150ms var(--ds-ease-in-out), color 120ms linear;\n}\n\n.wsp-row:hover .wsp-chevron {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.wsp-row[data-open='true'] .wsp-chevron {\n  transform: rotate(90deg);\n}\n\n.wsp-row[data-pending='true'] .wsp-chevron {\n  visibility: hidden;\n}\n\n.wsp-divider {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 14px 8px 4px;\n  border-top: 0.5px solid var(--dsw-alias-border-l2);\n}\n\n.wsp-dividerLabel {\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.wsp-dividerCount {\n  font-size: 11px;\n  line-height: 17px;\n  color: var(--dsw-alias-label-caption);\n}\n\n.wsp-editor {\n  margin: 2px 8px 12px 32px;\n  padding: 12px;\n  border-radius: var(--dsw-radius-md);\n  background: var(--dsw-alias-bg-module-platform);\n}\n\n.wsp-editorHead {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-bottom: 6px;\n}\n\n.wsp-editorLabel {\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.wsp-editorCount {\n  flex: none;\n  font-size: 11px;\n  line-height: 17px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.wsp-textarea {\n  width: 100%;\n  min-height: 88px;\n  padding: 8px 10px;\n  border: 0.5px solid var(--dsw-alias-border-l4);\n  border-radius: var(--dsw-radius-md);\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-primary);\n  font-family: inherit;\n  font-size: 13px;\n  line-height: 22px;\n  outline: none;\n  resize: vertical;\n}\n\n.wsp-textarea:focus {\n  border-color: var(--dsw-alias-state-business-primary);\n}\n\n.wsp-textarea::placeholder {\n  color: var(--dsw-alias-label-caption);\n}\n\n.wsp-textarea:disabled {\n  color: var(--dsw-alias-label-tertiary);\n  cursor: not-allowed;\n  opacity: 0.7;\n}\n\n.wsp-editorFoot {\n  display: flex;\n  align-items: flex-end;\n  justify-content: space-between;\n  gap: 16px;\n  margin-top: 8px;\n}\n\n.wsp-hint {\n  flex: 1;\n  min-width: 0;\n  margin: 0;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.wsp-editorActions {\n  flex: none;\n  display: flex;\n  gap: 8px;\n}\n\n.wsp-error {\n  margin: 8px 0 0;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-state-error-primary);\n}\n\n.wsp-danger {\n  color: var(--dsw-alias-state-error-primary);\n}\n\n.wsp-danger:hover:not(:disabled) {\n  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);\n}\n\n.wsp-tagNew {\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  padding: 1px 8px;\n  border-radius: 999px;\n  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);\n  font-size: 11px;\n  line-height: 17px;\n  font-weight: 500;\n  color: var(--dsw-alias-state-business-primary);\n}\n\n.wsp-pickerItem {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  min-width: 0;\n  max-width: 320px;\n}\n\n.wsp-pickerTitle {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 13px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.wsp-pickerPath {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-family: var(--dsh-font-family-code-default, monospace);\n  font-size: 11px;\n  line-height: 16px;\n  color: var(--dsw-alias-label-tertiary);\n}\n";
		const tagId = "@linbin-mk/dsh-workspace-prompt/WorkspacePromptsSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"" + tagId + "\"]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linbin-mk/dsh-workspace-prompt";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var WorkspacePromptsSection_module_css_default = {
			"banner": "wsp-banner",
			"card": "wsp-card",
			"cardHead": "wsp-cardHead",
			"cardMeta": "wsp-cardMeta",
			"cardTitle": "wsp-cardTitle",
			"chevron": "wsp-chevron",
			"danger": "wsp-danger",
			"divider": "wsp-divider",
			"dividerCount": "wsp-dividerCount",
			"dividerLabel": "wsp-dividerLabel",
			"editor": "wsp-editor",
			"editorActions": "wsp-editorActions",
			"editorCount": "wsp-editorCount",
			"editorFoot": "wsp-editorFoot",
			"editorHead": "wsp-editorHead",
			"editorLabel": "wsp-editorLabel",
			"error": "wsp-error",
			"folder": "wsp-folder",
			"headActions": "wsp-headActions",
			"hint": "wsp-hint",
			"intro": "wsp-intro",
			"item": "wsp-item",
			"list": "wsp-list",
			"listHint": "wsp-listHint",
			"pickerItem": "wsp-pickerItem",
			"pickerPath": "wsp-pickerPath",
			"pickerTitle": "wsp-pickerTitle",
			"row": "wsp-row",
			"rowError": "wsp-rowError",
			"rowMain": "wsp-rowMain",
			"rowMainStatic": "wsp-rowMainStatic",
			"rowPreview": "wsp-rowPreview",
			"rowPreviewMono": "wsp-rowPreviewMono",
			"rowState": "wsp-rowState",
			"rowStateMuted": "wsp-rowStateMuted",
			"rowText": "wsp-rowText",
			"rowTitle": "wsp-rowTitle",
			"section": "wsp-section",
			"tagNew": "wsp-tagNew",
			"textarea": "wsp-textarea",
			"title": "wsp-title"
		};
		//#endregion
		//#region src/client/WorkspacePromptsSection.tsx
		/**
		* Settings overview page for the workspace-prompt plugin.
		*
		* Registered by the client plugin body as a `settings.section` contribution,
		* so it appears as its own navigation row inside the settings panel. The page
		* keeps the plugin's original verbs — add a workspace from a picker menu,
		* switch a workspace's prompt on or off, save or clear inside an editor — on
		* the settings-page design language of `dsh-session-sync`: one card, hairline
		* separated workspace rows, and an inline editor that opens under its row.
		*
		* Configured workspaces come first (sorted by title), then one divider, then
		* the registered workspaces without a prompt. Unconfigured rows are read-only:
		* adding a prompt goes through the original Add menu in the card header.
		*
		* The card list is derived in one pass ({@link mergePromptRows}) — exactly one
		* row per directory, so a save's reload swaps the pending row for the persisted
		* row atomically. The page remounts on every visit (the settings shell renders
		* only the active section), so it always starts from a fresh read of the shared
		* form, and every write surface stays disabled while the form is loading or the
		* Host document refuses writes.
		*/
		/** Last path segment of an absolute directory (title fallback for orphaned prompts). */
		function basenameOf(cwd) {
			return cwd.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? cwd;
		}
		/** One-line preview of a possibly multi-line prompt. */
		function previewOf(text) {
			return text.replace(/\s+/g, " ").trim();
		}
		/** User-perceived character count (surrogate pairs count once). */
		function charCount(text) {
			return Array.from(text).length;
		}
		/** A failure's message, whether it arrived as an Error or as anything else. */
		function messageOf(cause) {
			return cause instanceof Error ? cause.message : String(cause);
		}
		/** Two-line menu row: workspace title over its canonical path. */
		function workspaceItemLabel(name, path) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: WorkspacePromptsSection_module_css_default.pickerItem,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: WorkspacePromptsSection_module_css_default.pickerTitle,
					children: name
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: WorkspacePromptsSection_module_css_default.pickerPath,
					children: path
				})]
			});
		}
		/**
		* One workspace row plus the editor that opens under it.
		* @param props - row data, draft state, write state, and row actions.
		* @returns the row and its inline editor when open.
		*/
		function PromptRow({ row, name, open, draft, busy, disabled, switchBusy, switchReason, switchTitle, switchError, flash, error, t, onOpen, onDraft, onSave, onClear, onCancel, onSwitch }) {
			const preview = row.isNew ? t("settings.pendingPreview") : previewOf(row.text);
			const stateLabel = row.enabled ? t("settings.on") : t("settings.off");
			const canSave = !busy && !disabled && draft.trim() !== "" && (row.isNew || draft !== row.text);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: WorkspacePromptsSection_module_css_default.item,
				"data-flash": flash ? "true" : void 0,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: WorkspacePromptsSection_module_css_default.row,
					"data-open": open ? "true" : void 0,
					"data-pending": row.isNew ? "true" : void 0,
					"data-enabled": row.isNew ? void 0 : row.enabled,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: WorkspacePromptsSection_module_css_default.rowMain,
							"aria-expanded": open,
							title: row.cwd,
							onClick: onOpen,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: WorkspacePromptsSection_module_css_default.folder,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, {})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: WorkspacePromptsSection_module_css_default.rowText,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: WorkspacePromptsSection_module_css_default.rowTitle,
										children: name
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: WorkspacePromptsSection_module_css_default.rowPreview,
										children: preview
									}),
									switchError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: WorkspacePromptsSection_module_css_default.rowError,
										role: "alert",
										children: t("settings.toggleError")
									})
								]
							})]
						}),
						row.isNew ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: WorkspacePromptsSection_module_css_default.tagNew,
							children: t("settings.new")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: WorkspacePromptsSection_module_css_default.rowState,
							children: stateLabel
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
							checked: row.enabled,
							disabled: busy || switchBusy || switchReason !== "none",
							label: t("settings.toggleAria").replace("{name}", name),
							title: switchTitle,
							onChange: onSwitch
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: WorkspacePromptsSection_module_css_default.chevron,
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
						})
					]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: WorkspacePromptsSection_module_css_default.editor,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: WorkspacePromptsSection_module_css_default.editorHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: WorkspacePromptsSection_module_css_default.editorLabel,
								children: t("settings.editorLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: WorkspacePromptsSection_module_css_default.editorCount,
								children: t("settings.charCount").replace("{count}", String(charCount(draft)))
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							className: WorkspacePromptsSection_module_css_default.textarea,
							value: draft,
							rows: 4,
							autoFocus: true,
							disabled: busy || disabled,
							placeholder: t("settings.placeholder"),
							onChange: (event) => {
								onDraft(event.target.value);
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: WorkspacePromptsSection_module_css_default.editorFoot,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: WorkspacePromptsSection_module_css_default.hint,
								children: t("settings.editorHint")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: WorkspacePromptsSection_module_css_default.editorActions,
								children: [row.isNew ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									size: "sm",
									disabled: busy,
									onClick: onCancel,
									children: t("settings.cancel")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									className: WorkspacePromptsSection_module_css_default.danger,
									disabled: busy || disabled,
									onClick: onClear,
									children: t("settings.clear")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									size: "sm",
									disabled: !canSave,
									onClick: onSave,
									children: t("settings.save")
								})]
							})]
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: WorkspacePromptsSection_module_css_default.error,
							role: "alert",
							children: t("settings.error").replace("{message}", error)
						})
					]
				})]
			});
		}
		/**
		* A registered workspace without a prompt. Its only verb is the card's Add
		* menu, so the row renders no control of its own.
		* @param props - workspace name/path, flash state, and copy.
		* @returns the read-only row.
		*/
		function EmptyRow({ name, cwd, flash, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: WorkspacePromptsSection_module_css_default.item,
				"data-flash": flash ? "true" : void 0,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: WorkspacePromptsSection_module_css_default.row,
					"data-unconfigured": "true",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: `${WorkspacePromptsSection_module_css_default.rowMain} ${WorkspacePromptsSection_module_css_default.rowMainStatic}`,
						title: cwd,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: WorkspacePromptsSection_module_css_default.folder,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, {})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: WorkspacePromptsSection_module_css_default.rowText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: WorkspacePromptsSection_module_css_default.rowTitle,
								children: name
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `${WorkspacePromptsSection_module_css_default.rowPreview} ${WorkspacePromptsSection_module_css_default.rowPreviewMono}`,
								children: cwd
							})]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `${WorkspacePromptsSection_module_css_default.rowState} ${WorkspacePromptsSection_module_css_default.rowStateMuted}`,
						children: t("settings.unconfigured")
					})]
				})
			});
		}
		/**
		* Render the workspace-prompt settings page.
		* @param props - composed slot props (client plugin registration).
		* @returns the overview element tree.
		*/
		function WorkspacePromptsSection({ usePrompts, useWorkspaces, refresh, save, clear, toggle, t }) {
			const state = usePrompts((value) => value);
			const workspaces = useWorkspaces((value) => value);
			const [pending, setPending] = (0, react.useState)([]);
			const [pickerOpen, setPickerOpen] = (0, react.useState)(false);
			const [openCwd, setOpenCwd] = (0, react.useState)(void 0);
			const [draft, setDraft] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [toggleBusy, setToggleBusy] = (0, react.useState)(null);
			const [toggleError, setToggleError] = (0, react.useState)(null);
			const [flashCwd, setFlashCwd] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			(0, react.useEffect)(() => {
				setPending((previous) => previous.filter((row) => !state.entries.some((entry) => entry.cwd === row.cwd)));
			}, [state.entries]);
			(0, react.useEffect)(() => {
				if (openCwd === void 0) return;
				const persisted = state.entries.some((entry) => entry.cwd === openCwd);
				const isPending = pending.some((row) => row.cwd === openCwd);
				if (persisted || isPending) return;
				setOpenCwd(void 0);
				setDraft("");
				setError(null);
			}, [
				openCwd,
				pending,
				state.entries
			]);
			(0, react.useEffect)(() => {
				if (flashCwd === null) return;
				const timer = setTimeout(() => {
					setFlashCwd(null);
				}, 1200);
				return () => {
					clearTimeout(timer);
				};
			}, [flashCwd]);
			(0, react.useEffect)(() => {
				if (toggleError === null) return;
				const timer = setTimeout(() => {
					setToggleError(null);
				}, 2600);
				return () => {
					clearTimeout(timer);
				};
			}, [toggleError]);
			const titleByPath = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const workspace of workspaces.items) map.set(workspace.path, workspace.title);
				return map;
			}, [workspaces.items]);
			const nameFor = (0, react.useCallback)((cwd) => titleByPath.get(cwd) ?? basenameOf(cwd), [titleByPath]);
			const rows = (0, react.useMemo)(() => mergePromptRows(state.entries, pending), [pending, state.entries]);
			const orderedRows = (0, react.useMemo)(() => {
				const byName = (a, b) => nameFor(a.cwd).localeCompare(nameFor(b.cwd)) || a.cwd.localeCompare(b.cwd);
				return [...rows.filter((row) => row.isNew).sort(byName), ...rows.filter((row) => !row.isNew).sort(byName)];
			}, [nameFor, rows]);
			const configuredPaths = (0, react.useMemo)(() => new Set(state.entries.map((entry) => entry.cwd)), [state.entries]);
			const excludedPaths = (0, react.useMemo)(() => /* @__PURE__ */ new Set([...configuredPaths, ...pending.map((row) => row.cwd)]), [configuredPaths, pending]);
			const addable = (0, react.useMemo)(() => unconfiguredWorkspaces(workspaces.items, excludedPaths), [workspaces.items, excludedPaths]);
			const workspacesReady = workspaces.phase === "ready";
			const loading = state.status === "loading";
			const disabled = loading || !state.writable;
			const switchReason = !state.switchSupported ? "skew" : disabled ? "readonly" : "none";
			const switchTitle = switchReason === "skew" ? t("chip.skew.hint") : switchReason === "readonly" ? t("chip.readonly.hint") : void 0;
			const openEditor = (0, react.useCallback)((cwd, text) => {
				setOpenCwd(cwd);
				setDraft(text);
				setError(null);
			}, []);
			const closeEditor = (0, react.useCallback)(() => {
				setOpenCwd(void 0);
				setDraft("");
				setError(null);
			}, []);
			const addWorkspace = (cwd) => {
				setPickerOpen(false);
				setPending((previous) => previous.some((row) => row.cwd === cwd) ? previous : [...previous, { cwd }]);
				openEditor(cwd, "");
			};
			const cancelWorkspace = (cwd) => {
				setPending((previous) => previous.filter((row) => row.cwd !== cwd));
				closeEditor();
			};
			const saveRow = async (row) => {
				setBusy(true);
				setError(null);
				try {
					await save(row.cwd, draft);
					setPending((previous) => previous.filter((item) => item.cwd !== row.cwd));
					closeEditor();
					setFlashCwd(row.cwd);
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(false);
				}
			};
			const clearRow = async (row) => {
				setBusy(true);
				setError(null);
				try {
					await clear(row.cwd);
					closeEditor();
					setFlashCwd(row.cwd);
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy(false);
				}
			};
			const arm = (cwd, next) => {
				if (switchReason !== "none" || toggleBusy !== null) return;
				setToggleBusy(cwd);
				setToggleError(null);
				toggle(cwd, next).catch(() => {
					setToggleError(cwd);
				}).finally(() => {
					setToggleBusy(null);
				});
			};
			const toggleRow = (row) => {
				if (openCwd === row.cwd) closeEditor();
				else openEditor(row.cwd, row.text);
			};
			const menuItems = addable.length === 0 ? [{
				type: "label",
				id: "empty",
				text: workspaces.items.length === 0 ? t("settings.add.none") : t("settings.add.empty")
			}] : [{
				type: "label",
				id: "heading",
				text: t("settings.add.header")
			}, ...addable.map((workspace) => ({
				id: workspace.path,
				label: workspaceItemLabel(workspace.title, workspace.path)
			}))];
			const meta = !workspacesReady ? t("settings.add.loading") : workspaces.items.length === 0 ? t("settings.count").replace("{count}", String(state.entries.length)) : t("settings.countOf").replace("{configured}", String(state.entries.length)).replace("{total}", String(workspaces.items.length));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: WorkspacePromptsSection_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: WorkspacePromptsSection_module_css_default.title,
						children: t("settings.title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: WorkspacePromptsSection_module_css_default.intro,
						children: t("settings.intro")
					}),
					!state.switchSupported && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: WorkspacePromptsSection_module_css_default.banner,
						role: "status",
						children: t("settings.skew")
					}),
					state.switchSupported && !state.writable && !loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: WorkspacePromptsSection_module_css_default.banner,
						role: "status",
						children: t("settings.readonly")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: WorkspacePromptsSection_module_css_default.card,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: WorkspacePromptsSection_module_css_default.cardHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: WorkspacePromptsSection_module_css_default.cardTitle,
								children: t("settings.card")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: WorkspacePromptsSection_module_css_default.headActions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: WorkspacePromptsSection_module_css_default.cardMeta,
									children: meta
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
									open: pickerOpen,
									onClose: () => {
										setPickerOpen(false);
									},
									onSelect: (id) => {
										addWorkspace(id);
									},
									items: menuItems,
									portal: true,
									anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }),
										disabled: disabled || !workspacesReady || addable.length === 0,
										onClick: () => {
											setPickerOpen((open) => !open);
										},
										children: t("settings.add")
									})
								})]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: WorkspacePromptsSection_module_css_default.list,
							children: [
								orderedRows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: WorkspacePromptsSection_module_css_default.listHint,
									children: t("settings.emptyInline")
								}),
								orderedRows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptRow, {
									row,
									name: nameFor(row.cwd),
									open: openCwd === row.cwd,
									draft: openCwd === row.cwd ? draft : "",
									busy,
									disabled,
									switchBusy: toggleBusy !== null,
									switchReason,
									switchTitle,
									switchError: toggleError === row.cwd,
									flash: flashCwd === row.cwd,
									error: openCwd === row.cwd ? error : null,
									t,
									onOpen: () => {
										toggleRow(row);
									},
									onDraft: (text) => {
										setDraft(text);
										setError(null);
									},
									onSave: () => {
										saveRow(row);
									},
									onClear: () => {
										clearRow(row);
									},
									onCancel: () => {
										cancelWorkspace(row.cwd);
									},
									onSwitch: (next) => {
										arm(row.cwd, next);
									}
								}, row.cwd)),
								orderedRows.length > 0 && addable.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: WorkspacePromptsSection_module_css_default.divider,
									role: "separator",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: WorkspacePromptsSection_module_css_default.dividerLabel,
										children: t("settings.divider")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: WorkspacePromptsSection_module_css_default.dividerCount,
										children: addable.length
									})]
								}),
								addable.map((workspace) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptyRow, {
									name: workspace.title,
									cwd: workspace.path,
									flash: flashCwd === workspace.path,
									t
								}, workspace.path))
							]
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"commandUi",
			"sessions",
			"remote",
			"configForms",
			"locale"
		];
		/** Resolve the absolute working directory of the session the command targets. */
		function currentCwd(ctx, sessionId) {
			return ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd;
		}
		/**
		* Client plugin body: locale, the overlay modal, the slash command, and the
		* settings overview entry.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(ENTRY_ID, {
				zh,
				en
			}), "workspace-prompt: dictionaries");
			const t = ctx.locale.bind(ENTRY_ID);
			const form = ctx.configForms.get(ENTRY_ID);
			/** Persist one form write, refusing loudly when the Host does not accept it. */
			const write = async (accepted) => {
				if (!await accepted) throw new Error(t("error.rejected"));
			};
			const save = async (cwd, text) => {
				await write(setPrompt(form, cwd, text));
			};
			const clear = async (cwd) => {
				await write(unsetPrompt(form, cwd));
			};
			/** Arm or disarm one workspace's prompt; the Host gates injection on it. */
			const toggle = async (cwd, enabled) => {
				await write(setEnabled(form, cwd, enabled));
			};
			workspacePromptModal.handlers = {
				save,
				clear
			};
			workspacePrompts.handlers = {
				view: () => promptsView(form.getSnapshot()),
				toggle: async (cwd, enabled) => {
					await toggle(cwd, enabled);
					await workspacePrompts.refresh();
				}
			};
			const adopt = () => {
				const view = promptsView(form.getSnapshot());
				workspacePrompts.adopt(view);
				workspacePromptModal.setWritable(view.writable);
			};
			ctx.effect(() => form.subscribe(adopt), "workspace-prompt: config form adoption");
			adopt();
			const sectionInjected = {
				hooks: { prompts: workspacePrompts },
				refresh: () => workspacePrompts.refresh(),
				save: async (cwd, text) => {
					await save(cwd, text);
					await workspacePrompts.refresh();
				},
				clear: async (cwd) => {
					await clear(cwd);
					await workspacePrompts.refresh();
				},
				toggle: async (cwd, enabled) => {
					await toggle(cwd, enabled);
					await workspacePrompts.refresh();
				}
			};
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: ENTRY_ID,
				order: 0,
				locale: ENTRY_ID,
				inject: () => ({
					hooks: { prompts: workspacePrompts },
					toggle
				})
			}, WorkspacePromptChipEntry));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "workspace-prompt"
			}, WorkspacePromptModal));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "workspace-prompt",
				order: 16,
				label: () => t("settings.nav"),
				locale: ENTRY_ID,
				inject: () => sectionInjected
			}, WorkspacePromptsSection));
			ctx.commandUi.register({
				name: "workspace-prompt",
				description: () => t("command.description"),
				available: (session) => currentCwd(ctx, session.sessionId) !== void 0,
				ui: {
					kind: "popupSelect",
					options: async () => [{
						id: "open",
						label: t("command.open")
					}],
					onSelect: async (_option, session) => {
						const cwd = currentCwd(ctx, session.sessionId);
						if (cwd === void 0) return;
						await ctx.configForms.describe().ensure();
						workspacePromptModal.open(cwd, promptFor(form, cwd));
					}
				}
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
