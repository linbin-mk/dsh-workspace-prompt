window.__ModuleLoader__.load({
	id: "@linbin-mk/dsh-workspace-prompt",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
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
				value: ""
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
		* `ctx`) writes the read handlers here and the section reads state via
		* React's {@link useSyncExternalStore}.
		*/
		var WorkspacePromptsObservable = class {
			listeners = /* @__PURE__ */ new Set();
			state = {
				entries: [],
				busy: false,
				error: null
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
			/** Reload the overview from the persisted prompts (no-op before activation). */
			refresh = async () => {
				const list = this.handlers?.list;
				if (list === void 0) return;
				this.state = {
					...this.state,
					busy: true,
					error: null
				};
				this.emit();
				try {
					const prompts = await list();
					this.state = {
						busy: false,
						error: null,
						entries: Object.entries(prompts).filter(([, text]) => text.length > 0).map(([cwd, text]) => ({
							cwd,
							text
						})).sort((a, b) => a.cwd.localeCompare(b.cwd))
					};
				} catch (cause) {
					this.state = {
						...this.state,
						busy: false,
						error: cause instanceof Error ? cause.message : String(cause)
					};
				}
				this.emit();
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
			"modal.title": "配置工作区提示词",
			"modal.placeholder": "为该工作区编写特定提示词，将在每次会话开始时注入模型上下文…",
			"modal.cwd": "工作区目录：{cwd}",
			"modal.save": "保存",
			"modal.clear": "清除",
			"modal.saving": "保存中…",
			"modal.cleared": "已清除",
			"modal.error": "保存失败：{message}",
			"settings.nav": "工作区提示词",
			"settings.title": "工作区提示词",
			"settings.intro": "管理每个工作区的专属提示词：已配置的工作区可以修改或清除，也可以从未配置的工作区中添加。提示词会在该工作区下一次会话启动时注入到模型上下文。",
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
			"settings.rowHint": "修改或清除后，将于该工作区下一次会话启动时生效。",
			"settings.save": "保存",
			"settings.clear": "清除",
			"settings.cancel": "取消",
			"settings.error": "操作失败：{message}"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"command.description": "Configure a workspace-specific prompt for the current workspace",
			"command.open": "Configure workspace prompt",
			"modal.title": "Configure workspace prompt",
			"modal.placeholder": "Write a workspace-specific prompt; it is injected into the model context at the start of every session…",
			"modal.cwd": "Workspace directory: {cwd}",
			"modal.save": "Save",
			"modal.clear": "Clear",
			"modal.saving": "Saving…",
			"modal.cleared": "Cleared",
			"modal.error": "Save failed: {message}",
			"settings.nav": "Workspace prompts",
			"settings.title": "Workspace prompts",
			"settings.intro": "Manage each workspace’s dedicated prompt: edit or clear configured workspaces, or add one that has no prompt yet. A prompt is injected into the model context at that workspace’s next session start.",
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
			"settings.rowHint": "Edits and removals apply at that workspace’s next session start.",
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
		* handlers the command half registered on the shared observable.
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
					disabled: busy,
					onClick: onClear,
					children: zh["modal.clear"]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					disabled: busy,
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
				isNew: true
			})), ...entries.map((entry) => ({
				cwd: entry.cwd,
				text: entry.text,
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
		* every workspace with a configured prompt — read through the Host settings
		* RPC — with in-place edit (Save) and removal (Clear) per row, plus an
		* **Add workspace** picker: workspaces without a prompt are offered in a
		* dropdown (from the live workspace list behind the `useWorkspaces` standard
		* hook), picking one opens a fresh editable row. The card list is derived in
		* one pass ({@link mergePromptRows}) — exactly one card per directory, so a
		* save's reload swaps the pending card for the persisted card atomically
		* instead of briefly rendering both. The page remounts on every visit (the
		* settings shell renders only the active section), so it always starts from a
		* fresh read of the persisted document.
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
		function PromptCard({ cwd, name, text, isNew, disabled, t, onSave, onClear, onCancel }) {
			const [draft, setDraft] = (0, react.useState)(text);
			const [busy, setBusy] = (0, react.useState)(false);
			const [focused, setFocused] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				setDraft(text);
			}, [text]);
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
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
						}), isNew && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: newBadge,
							children: t("settings.new")
						})]
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
		function WorkspacePromptsSection({ usePrompts, useWorkspaces, refresh, save, clear, t }) {
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
			const busy = state.busy;
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
				state.error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					role: "alert",
					style: {
						color: "var(--dsw-alias-state-error-primary, #c0392b)",
						marginTop: 12
					},
					children: t("settings.error").replace("{message}", state.error)
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
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }),
							disabled: busy || !workspacesReady,
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
					isNew: row.isNew,
					disabled: busy,
					t,
					onSave: save,
					onClear: clear,
					onCancel: cancelWorkspace
				}, row.cwd)),
				rows.length === 0 && !busy && state.error === null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
			"remote.settings",
			"locale"
		];
		/** Extract the prompts record from a redacted namespace value (JSON-shaped wire data). */
		function readPrompts(value) {
			if (value === null || typeof value !== "object") return void 0;
			const prompts = value.prompts;
			if (prompts === null || typeof prompts !== "object") return void 0;
			return prompts;
		}
		/** Resolve the absolute working directory of the session the command targets. */
		function currentCwd(ctx, sessionId) {
			return ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd;
		}
		/** Read every configured workspace prompt (cwd -> text) from persisted settings. */
		async function readAllPrompts(api) {
			const response = await api.describe();
			if (!response.ok) throw new Error(response.error.message);
			return { ...readPrompts(response.value.namespaces.find((view) => view.ns === "workspace-prompt")?.value) ?? {} };
		}
		/** Read the stored prompt for one workspace directory (empty string when none). */
		async function readPrompt(api, cwd) {
			return (await readAllPrompts(api))[cwd] ?? "";
		}
		async function mutatePrompt(api, ops) {
			const response = await api.mutate("workspace-prompt", ops, void 0);
			if (!response.ok) throw new Error(response.error.message);
		}
		/**
		* Client plugin body: locale, the overlay modal, the slash command, and the
		* settings overview entry.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register("workspace-prompt", {
				zh,
				en
			}), "workspace-prompt: dictionaries");
			const api = ctx.remote.settings;
			const t = ctx.locale.bind("workspace-prompt");
			const save = async (cwd, text) => {
				await mutatePrompt(api, [{
					op: "set",
					path: ["prompts", cwd],
					value: text
				}]);
			};
			const clear = async (cwd) => {
				await mutatePrompt(api, [{
					op: "unset",
					path: ["prompts", cwd]
				}]);
			};
			workspacePromptModal.handlers = {
				save,
				clear
			};
			workspacePrompts.handlers = { list: () => readAllPrompts(api) };
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "workspace-prompt"
			}, WorkspacePromptModal));
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
				}
			};
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "workspace-prompt",
				order: 16,
				label: () => t("settings.nav"),
				locale: "workspace-prompt",
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
						const value = await readPrompt(api, cwd);
						workspacePromptModal.open(cwd, value);
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
