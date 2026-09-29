import z from "@deepseek-ai/schemastery";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
//#region src/confirm.ts
/**
* Question id echoed in the answer. Stable: the answer is matched by id, so a
* UI that reorders or renames options cannot silently link a stale answer to a
* later question.
*/
const CONFIRM_QUESTION_ID = "workspace-prompt-include";
/** Label of the answer that injects the prompt. */
const INCLUDE_LABEL = "带上 Include";
/** Label of the answer that leaves this turn without the prompt. */
const SKIP_LABEL = "不带 Skip";
/**
* The question payload.
*
* Copy is bilingual because the question protocol carries literal text and the
* answering UI renders the session's language: a host-originated question has
* no dictionary channel of its own (`.agents`-style client localization covers
* client copy only).
* @returns the single confirmation question.
*/
function confirmQuestions() {
	return [{
		id: CONFIRM_QUESTION_ID,
		header: "工作区提示词 Workspace prompt",
		question: "本次会话是否带上该工作区的工作区提示词？Include the workspace prompt in this session?",
		options: [{
			label: INCLUDE_LABEL,
			description: "并入本会话的模型上下文。Fold it into this session’s model context."
		}, {
			label: SKIP_LABEL,
			description: "本会话不再询问、也不注入，开关状态不变。Skip it for the rest of this session; the switch stays on."
		}]
	}];
}
/**
* Build the full request for one turn.
* @param agent - the session's live agent, so the question reaches its client.
* @param signal - the turn's cancellation signal; cancelling the turn settles the question.
* @returns the request to pass to `ctx.userQuestions.ask`.
*/
function confirmRequest(agent, signal) {
	return {
		questions: confirmQuestions(),
		agent,
		signal
	};
}
/**
* Read the human's decision out of one answer.
*
* Only an explicit skip skips: the switch is already on, so a custom answer, a
* missing item, or an unrecognised selection keeps the standing intent and
* injects. Dismissal is decided by the caller from the rejection code, not
* here.
* @param answer - the answered question set.
* @returns true to inject this turn, false only for the explicit skip label.
*/
function readInclude(answer) {
	const item = answer.answers.find((entry) => entry.id === CONFIRM_QUESTION_ID);
	if (item === void 0) return true;
	return !(item.selected.includes("不带 Skip") && !item.selected.includes("带上 Include"));
}
/**
* The session's answer, remembered for the session's whole life: the question
* is asked once, and a "skip" is never revisited. One boolean per live agent.
*/
var SessionDecisions = class {
	decided = /* @__PURE__ */ new Map();
	/**
	* The answer this session already gave.
	* @param agentId - session agent identity.
	* @returns the recorded decision, or undefined when this session has not answered yet.
	*/
	recall(agentId) {
		return this.decided.get(agentId);
	}
	/**
	* Remember this session's answer.
	* @param agentId - session agent identity.
	* @param include - whether the prompt is welcome in this session.
	*/
	record(agentId, include) {
		this.decided.set(agentId, include);
	}
};
//#endregion
//#region src/identity.ts
/**
* Plugin identity, exported so `inject.ts` and the client half share one name
* without importing the Cordis `Context` runtime.
*/
const name$1 = "workspace-prompt";
//#endregion
//#region src/inject.ts
/**
* Pure host injection logic for the workspace-prompt plugin.
*
* This module carries the message source declaration, the inbox-reconciliation
* rules, and the message-building rules with no Cordis runtime imports, so the
* behaviour is unit-testable without booting a Cordis app. The `apply`
* entrypoint in `index.ts` wires these helpers onto the live `agent/pre-step`
* hook and this plugin's Config.
*/
const PROMPT_INTRO = "The following workspace-specific prompt was configured by the user for this workspace. Treat it as standing guidance for work in this workspace; it does not override system, developer, or direct user instructions.";
/** Wrap a raw prompt in the same `<system-reminder>` framing the model reads. */
function renderPrompt(text) {
	return [
		"<system-reminder>",
		PROMPT_INTRO,
		"",
		text,
		"</system-reminder>"
	].join("\n");
}
/** Two messages with identical content blocks compare equal for inbox purposes. */
function sameContent(a, b) {
	return JSON.stringify(a.content) === JSON.stringify(b.content);
}
/**
* Build the context message injected for one workspace prompt.
* @param text - the raw configured prompt.
* @returns an immutable user-role message carrying the rendered prompt.
*/
function buildMessage(text) {
	return createUserMessage({
		content: [{
			type: "text",
			text: renderPrompt(text)
		}],
		source: {
			kind: name$1,
			form: "instructions"
		}
	});
}
/** Whether an untrusted config node is a plain JSON object (not null, array, or scalar). */
function isPromptMap(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Read one workspace's prompt out of the live `prompts` value.
*
* The map reaches the Host from a profile document that a user may hand-edit,
* so its contents are narrowed rather than trusted: a section that is not a
* plain object, or an entry that is not a string, yields no prompt instead of
* breaking the step.
* @param prompts - the live `prompts` Config field value.
* @param cwd - absolute workspace directory.
* @returns the configured prompt, or undefined when none stands.
*/
function promptFor(prompts, cwd) {
	if (!isPromptMap(prompts)) return void 0;
	const text = prompts[cwd];
	return typeof text === "string" ? text : void 0;
}
/**
* Whether one workspace's prompt is armed for injection.
*
* The switch defaults to off: a configured prompt enters the model context
* only after the user turns the composer's workspace-prompt control on for
* that workspace. Narrowed like {@link promptFor}, so a hand-edited document
* cannot arm anything by accident.
* @param enabled - the live `enabled` Config field value.
* @param cwd - absolute workspace directory.
* @returns true only for an explicit `true` entry of that directory.
*/
function enabledFor(enabled, cwd) {
	if (!isPromptMap(enabled)) return false;
	return enabled[cwd] === true;
}
/** Whether one recorded event carries this plugin's own message with the desired payload. */
function isOwnMessageEvent(event, desired) {
	if (event?.type !== "user/message") return false;
	const recorded = event.data;
	return recorded.source.kind === "workspace-prompt" && sameContent(recorded, desired);
}
/**
* Whether the desired message already stands in the recorded session surface.
*
* The prompt is injected once, at session start, and then left in the
* conversation: later steps skip re-injection while an identical copy is
* still visible. A changed configuration yields a different payload and
* enters again, as does a copy dropped from the surface (for example by
* compaction), restoring the standing guidance.
*/
function surfaceSupplies(surface, desired) {
	for (let index = surface.nodes.length - 1; index >= 0; index--) {
		const seq = surface.nodes[index];
		if (seq !== void 0 && isOwnMessageEvent(surface.events[seq], desired)) return true;
	}
	return false;
}
/**
* Reconcile the plugin's own inbox entries against the desired state.
*
* Called after the decision is known. When there is nothing to inject, or the
* desired message already stands among the claimed messages or in the recorded
* session surface, every pending entry the plugin owns is removed. Otherwise
* the pending entries are collapsed onto exactly one `desired` (reused when its
* content already exists, else replaced or prepended).
* @param inbox - the agent inbox to reconcile against.
* @param claimed - messages already claimed into the step (for de-duplication).
* @param isOurs - recognises the plugin's own pending entries by id.
* @param desired - the message to ensure is present, or undefined to clear.
* @param surface - the recorded session surface, or undefined when unknown.
*/
function syncInbox(inbox, claimed, isOurs, desired, surface) {
	const pending = inbox.nextStep.filter(isOurs);
	const supplied = desired !== void 0 && (claimed.some((message) => sameContent(message, desired)) || surface !== void 0 && surfaceSupplies(surface, desired));
	if (desired === void 0 || supplied) {
		for (const message of pending) inbox.remove(message.id);
		return;
	}
	const reusable = pending.find((message) => sameContent(message, desired));
	if (reusable !== void 0) {
		for (const message of pending) if (message.id !== reusable.id) inbox.remove(message.id);
		return;
	}
	const replaced = pending[0];
	if (replaced === void 0) inbox.prepend("next-step", desired);
	else inbox.replace(replaced.id, desired);
	for (const message of pending.slice(1)) inbox.remove(message.id);
}
//#endregion
//#region src/prompt-settings.ts
/** Config field carrying the per-workspace prompts map. */
const PROMPTS_FIELD = "prompts";
/**
* Config field carrying the per-workspace arm switch. A configured prompt is
* injected only while its workspace's entry here is `true`, so saving a prompt
* never changes what the next session receives by itself.
*/
const ENABLED_FIELD = "enabled";
//#endregion
//#region src/index.ts
const name = "workspace-prompt";
/**
* One prompts map as it crosses the settings boundary. The explicit schema type
* keeps the emitted declaration of `Config` portable: an annotated `dict`
* schema's inferred type would name cosmokit's `Dict`, which this package does
* not import. `volatile()` below is what makes the field live.
*
* The field is declared `any` rather than `dict`: the browser half's shared
* config form validates a section by calling its rehydrated schema, and the web
* client's snapshot store deep-freezes every section it publishes. A `dict`
* schema writes each resolved entry into that read-only map and throws
* (`Cannot assign to read only property`), so the form treats the section as
* invalid and keeps publishing its previous value — the settings page then
* shows the pre-write map until it remounts. `any` passes the same value
* through untouched. `promptFor` narrows the map before it is read, and the
* settings write path still refuses paths outside a volatile field.
*/
const promptsField = z.any().default({});
/** Live per-workspace arm switches; `any` for the same read-only-section reason as `promptsField`. */
const enabledField = z.any().default({});
/** Live per-workspace prompts and their arm switches, the only fields the settings form edits. */
const Config = z.object({
	[PROMPTS_FIELD]: promptsField.volatile(),
	[ENABLED_FIELD]: enabledField.volatile()
});
function apply(ctx, config) {
	ctx.inject(["settings"], (child) => {
		child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
	});
	const ours = /* @__PURE__ */ new Set();
	const decisions = new SessionDecisions();
	const isOurs = (message) => ours.has(message.id);
	/** The recorded session surface, read to detect previously injected copies. */
	const surfaceFor = (agent) => ({
		nodes: agent.session.surface.nodes,
		events: agent.session.snapshotEvents()
	});
	const syncInboxFor = (agent, claimed, desired) => syncInbox(agent.inbox, claimed, isOurs, desired, surfaceFor(agent));
	/**
	* Ask this session's human, once, whether the armed prompt should enter.
	*
	* Only the explicit skip label and an explicit dismissal skip: the workspace
	* is armed, so an unreadable answer keeps that standing intent. A missing
	* service, no answerer (headless runs), and a non-root or owned agent all
	* fall back to injecting instead of blocking a session on a question nobody
	* can answer — and are remembered, so the failed dispatch is not repeated on
	* every later turn. An aborted turn decides nothing.
	*/
	const confirmOnce = async (agent, signal) => {
		const questions = ctx.get("userQuestions");
		if (questions === void 0) return true;
		let include = true;
		let decided = true;
		try {
			include = readInclude(await questions.ask(confirmRequest(agent, signal)));
		} catch (error) {
			const code = error.code;
			include = code !== "ASK_CANCELLED";
			decided = code !== "ASK_ABORTED";
		}
		if (decided) decisions.record(agent.id, include);
		return include;
	};
	ctx.on("agent/pre-step", async ({ agent, messages, step, signal }, next) => {
		const decision = await next();
		const cwd = agent.session.header.cwd;
		const decided = decisions.recall(agent.id);
		const text = decided !== false && cwd !== void 0 && enabledFor(config.enabled.get(), cwd) ? promptFor(config.prompts.get(), cwd) : void 0;
		let desired = text !== void 0 && text.length > 0 ? buildMessage(text) : void 0;
		if (decision.kind === "reject" || step === 1 && decision.messages.length === 0) {
			if (desired !== void 0) ours.add(desired.id);
			syncInboxFor(agent, messages, desired);
			return decision;
		}
		const pending = desired;
		if (pending !== void 0 && !surfaceSupplies(surfaceFor(agent), pending) && !decision.messages.some((message) => sameContent(message, pending)) && !(decided ?? await confirmOnce(agent, signal))) desired = void 0;
		for (const message of agent.inbox.nextStep.filter(isOurs)) {
			ours.delete(message.id);
			agent.inbox.remove(message.id);
		}
		if (desired === void 0) return decision;
		if (surfaceSupplies(surfaceFor(agent), desired) || decision.messages.some((message) => sameContent(message, desired))) return decision;
		const lastClaimedIndex = decision.messages.findLastIndex((message) => messages.includes(message));
		return {
			kind: "enter",
			messages: decision.messages.toSpliced(lastClaimedIndex + 1, 0, desired)
		};
	});
}
//#endregion
export { Config, apply, name };
