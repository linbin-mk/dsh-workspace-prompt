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
			"chip.on.hint": "已开启：该工作区发起的会话会注入这段提示词。点击关闭。",
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
			"settings.intro": "管理每个工作区的专属提示词：已配置的工作区可以修改或清除，也可以从未配置的工作区中添加。提示词默认不注入——在会话输入框打开该工作区的「工作区提示词」开关后，新会话才会带上它。",
			"settings.add": "添加工作区",
			"settings.add.header": "未配置提示词的工作区",
			"settings.add.empty": "所有工作区都已配置提示词",
			"settings.add.none": "当前还没有任何工作区",
			"settings.add.loading": "正在加载工作区列表…",
			"settings.count": "已配置 {count} 个工作区",
			"settings.countOf": "已配置 {configured} 个 / 共 {total} 个工作区",
			"settings.new": "新配置",
			"settings.empty.title": "还没有为任何工作区配置提示词",
			"settings.empty.hint": "点击右上角「添加工作区」，从尚未配置的工作区中选择一个；也可以在会话中输入 /workspace-prompt 为当前工作区配置。",
			"settings.rowHint": "开关打开时，该工作区的新会话才会注入这段提示词。",
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
			"chip.on.hint": "On: sessions started in this workspace are given this prompt. Click to turn off.",
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
			"settings.intro": "Manage each workspace’s dedicated prompt: edit or clear configured workspaces, or add one that has no prompt yet. Prompts stay inert until you arm them — with the Workspace prompt switch in the composer, new sessions in that workspace carry the prompt.",
			"settings.add": "Add workspace",
			"settings.add.header": "Workspaces without a prompt",
			"settings.add.empty": "Every workspace already has a prompt",
			"settings.add.none": "There are no workspaces yet",
			"settings.add.loading": "Loading workspaces…",
			"settings.count": "{count} workspace prompt(s) configured",
			"settings.countOf": "{configured} of {total} workspaces configured",
			"settings.new": "New",
			"settings.empty.title": "No workspace prompt configured yet",
			"settings.empty.hint": "Click “Add workspace” above and pick one without a prompt, or type /workspace-prompt in a session to configure its workspace.",
			"settings.rowHint": "While the switch is on, new sessions in this workspace are given the prompt.",
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
		//#region src/client/WorkspacePromptsSection.tsx
		/**
		* Settings overview page for the workspace-prompt plugin.
		*
		* Registered by the client plugin body as a `settings.section` contribution,
		* so it appears as its own navigation row inside the settings panel. It lists
		* every workspace with a configured prompt — read from the shared config form —
		* with in-place edit (Save) and removal (Clear) per row, plus an
		* **Add workspace** picker: workspaces without a prompt are offered in a
		* dropdown (from the live workspace list behind the `useWorkspaces` standard
		* hook), picking one opens a fresh editable row. The card list is derived in
		* one pass ({@link mergePromptRows}) — exactly one card per directory, so a
		* save's reload swaps the pending card for the persisted card atomically
		* instead of briefly rendering both. The page remounts on every visit (the
		* settings shell renders only the active section), so it always starts from a
		* fresh read of the shared form, and every write surface stays disabled while
		* the form is loading or the Host document refuses writes.
		*/
		/** Shared card chrome (design tokens with neutral fallbacks). */
		const card = {
			border: "1px solid var(--dsw-alias-border-l2, #d0d5dd)",
			borderRadius: 8,
			padding: 14,
			marginTop: 12
		};
		const title = {
			fontWeight: 600,
			fontSize: 14,
			color: "var(--dsw-alias-label-primary, #101828)"
		};
		const hint = {
			fontSize: 12,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-secondary, #475467)",
			marginTop: 4
		};
		const pathText = {
			fontSize: 12,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-secondary, #475467)",
			fontFamily: "var(--dsw-alias-font-mono, monospace)",
			wordBreak: "break-all"
		};
		const textareaBase = {
			width: "100%",
			boxSizing: "border-box",
			marginTop: 10,
			padding: "8px 10px",
			border: "1px solid var(--dsw-alias-border-l2, #d0d5dd)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1, #ffffff)",
			color: "var(--dsw-alias-label-primary, #101828)",
			fontSize: 13,
			lineHeight: 1.6,
			resize: "vertical",
			minHeight: 80,
			outline: "none"
		};
		const newBadge = {
			flexShrink: 0,
			fontSize: 11,
			lineHeight: 1,
			padding: "4px 8px",
			borderRadius: 999,
			color: "var(--dsw-alias-brand-primary, #4176e6)",
			border: "1px solid var(--dsw-alias-brand-primary, #4176e6)"
		};
		/** Last path segment of an absolute directory (title fallback for rows whose workspace left the registry). */
		function basenameOf(cwd) {
			return cwd.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? cwd;
		}
		/** One workspace card: title + path, editable prompt, footer actions. */
		function PromptCard({ cwd, name, text, enabled, isNew, reason, t, onSave, onClear, onToggle, onCancel }) {
			const disabled = reason !== "none";
			const [draft, setDraft] = (0, react.useState)(text);
			const [busy, setBusy] = (0, react.useState)(false);
			const [focused, setFocused] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [armPhase, setArmPhase] = (0, react.useState)("idle");
			(0, react.useEffect)(() => {
				setDraft(text);
			}, [text]);
			(0, react.useEffect)(() => {
				if (armPhase !== "failed") return;
				const timer = setTimeout(() => {
					setArmPhase("idle");
				}, 2200);
				return () => {
					clearTimeout(timer);
				};
			}, [armPhase]);
			const changed = draft !== text;
			const saveEnabled = !disabled && !busy && draft.trim().length > 0 && (isNew || changed);
			const save = async () => {
				setBusy(true);
				setError(null);
				try {
					await onSave(cwd, draft);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			const clear = async () => {
				setBusy(true);
				setError(null);
				try {
					await onClear(cwd);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			const arm = (next) => {
				setArmPhase("busy");
				onToggle(cwd, next).then(() => {
					setArmPhase("idle");
				}).catch(() => {
					setArmPhase("failed");
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					...card,
					borderColor: isNew ? "var(--dsw-alias-brand-primary, #4176e6)" : void 0
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "flex-start",
							gap: 12
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									flex: 1,
									minWidth: 0
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: title,
									children: name
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										...pathText,
										marginTop: 2
									},
									children: cwd
								})]
							}),
							!isNew && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptToggleChip, {
								enabled,
								reason,
								phase: armPhase,
								labels: {
									labelOn: t("chip.label.on"),
									labelOff: t("chip.label.off"),
									onHint: t("chip.on.hint"),
									offHint: t("chip.off.hint"),
									readonlyHint: t("chip.readonly.hint"),
									failedHint: t("chip.failed.hint"),
									skewHint: t("chip.skew.hint")
								},
								onToggle: arm
							}),
							isNew && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: newBadge,
								children: t("settings.new")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						value: draft,
						autoFocus: isNew,
						disabled: busy || disabled,
						placeholder: t("modal.placeholder"),
						onChange: (event) => {
							setDraft(event.target.value);
						},
						onFocus: () => {
							setFocused(true);
						},
						onBlur: () => {
							setFocused(false);
						},
						rows: 4,
						style: {
							...textareaBase,
							borderColor: focused ? "var(--dsw-alias-brand-primary, #4176e6)" : void 0,
							boxShadow: focused ? "0 0 0 2px rgba(65, 118, 230, 0.18)" : void 0,
							opacity: busy || disabled ? .6 : 1
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: 8,
							marginTop: 10
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								...hint,
								marginTop: 0,
								flex: 1,
								minWidth: 0
							},
							children: t("settings.rowHint")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: 8,
								flexShrink: 0
							},
							children: [isNew ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								disabled: busy || disabled,
								onClick: () => {
									onCancel(cwd);
								},
								children: t("settings.cancel")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								disabled: busy || disabled,
								onClick: clear,
								children: t("settings.clear")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								disabled: !saveEnabled,
								onClick: save,
								children: t("settings.save")
							})]
						})]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "alert",
						style: {
							color: "var(--dsw-alias-state-error-primary, #c0392b)",
							marginTop: 8,
							fontSize: 12
						},
						children: t("settings.error").replace("{message}", error)
					})
				]
			});
		}
		/** Two-line menu row: workspace title over its canonical path. */
		function workspaceItemLabel(name, path) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					minWidth: 0,
					maxWidth: 300
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						fontWeight: 500,
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis"
					},
					children: name
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						fontSize: 11,
						lineHeight: 1.4,
						color: "var(--dsw-alias-label-secondary, #475467)",
						fontFamily: "var(--dsw-alias-font-mono, monospace)",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis"
					},
					children: path
				})]
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
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			(0, react.useEffect)(() => {
				setPending((previous) => previous.filter((row) => !state.entries.some((entry) => entry.cwd === row.cwd)));
			}, [state.entries]);
			const configuredPaths = (0, react.useMemo)(() => new Set(state.entries.map((entry) => entry.cwd)), [state.entries]);
			const excludedPaths = (0, react.useMemo)(() => /* @__PURE__ */ new Set([...configuredPaths, ...pending.map((row) => row.cwd)]), [configuredPaths, pending]);
			const addable = (0, react.useMemo)(() => unconfiguredWorkspaces(workspaces.items, excludedPaths), [workspaces.items, excludedPaths]);
			const titleByPath = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const workspace of workspaces.items) map.set(workspace.path, workspace.title);
				return map;
			}, [workspaces.items]);
			const nameFor = (cwd) => titleByPath.get(cwd) ?? basenameOf(cwd);
			const rows = (0, react.useMemo)(() => mergePromptRows(state.entries, pending), [pending, state.entries]);
			const workspacesReady = workspaces.phase === "ready";
			const busy = state.status === "loading";
			const disabled = busy || !state.writable;
			const switchReason = !state.switchSupported ? "skew" : disabled ? "readonly" : "none";
			const addWorkspace = (cwd) => {
				setPickerOpen(false);
				setPending((previous) => previous.some((row) => row.cwd === cwd) ? previous : [...previous, { cwd }]);
			};
			const cancelWorkspace = (cwd) => {
				setPending((previous) => previous.filter((row) => row.cwd !== cwd));
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("settings.title") }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("settings.intro") }),
				!state.switchSupported && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					style: {
						...hint,
						color: "var(--dsw-alias-state-error-primary, #c0392b)"
					},
					children: t("settings.skew")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 12,
						marginTop: 12
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							...hint,
							marginTop: 0
						},
						children: !workspacesReady ? t("settings.add.loading") : workspaces.items.length === 0 ? t("settings.count").replace("{count}", String(state.entries.length)) : t("settings.countOf").replace("{configured}", String(state.entries.length)).replace("{total}", String(workspaces.items.length))
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
							disabled: disabled || !workspacesReady,
							onClick: () => {
								setPickerOpen((open) => !open);
							},
							children: t("settings.add")
						})
					})]
				}),
				rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptCard, {
					cwd: row.cwd,
					name: nameFor(row.cwd),
					text: row.text,
					enabled: row.enabled,
					isNew: row.isNew,
					reason: switchReason,
					t,
					onSave: save,
					onClear: clear,
					onToggle: toggle,
					onCancel: cancelWorkspace
				}, row.cwd)),
				rows.length === 0 && !busy && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						...card,
						textAlign: "center",
						padding: "22px 14px"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: title,
						children: t("settings.empty.title")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: hint,
						children: t("settings.empty.hint")
					})]
				})
			] });
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
