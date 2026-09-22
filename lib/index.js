import z from "@deepseek-ai/schemastery";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
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
//#endregion
//#region src/index.ts
const name = "workspace-prompt";
/**
* One prompts map as it crosses the settings boundary. The explicit schema type
* keeps the emitted declaration of `Config` portable: an annotated `dict`
* schema's inferred type would name cosmokit's `Dict`, which this package does
* not import. `volatile()` below is what makes the field live.
*/
const promptsField = z.dict(z.string()).default({});
/** Live per-workspace prompts, the only field the settings form edits. */
const Config = z.object({ [PROMPTS_FIELD]: promptsField.volatile() });
function apply(ctx, config) {
	ctx.inject(["settings"], (child) => {
		child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
	});
	const ours = /* @__PURE__ */ new Set();
	const isOurs = (message) => ours.has(message.id);
	/** The recorded session surface, read to detect previously injected copies. */
	const surfaceFor = (agent) => ({
		nodes: agent.session.surface.nodes,
		events: agent.session.snapshotEvents()
	});
	const syncInboxFor = (agent, claimed, desired) => syncInbox(agent.inbox, claimed, isOurs, desired, surfaceFor(agent));
	ctx.on("agent/pre-step", async ({ agent, messages, step, signal }, next) => {
		const decision = await next();
		const cwd = agent.session.header.cwd;
		const text = cwd === void 0 ? void 0 : config.prompts.get()[cwd];
		const desired = text !== void 0 && text.length > 0 ? buildMessage(text) : void 0;
		if (decision.kind === "reject" || step === 1 && decision.messages.length === 0) {
			if (desired !== void 0) ours.add(desired.id);
			syncInboxFor(agent, messages, desired);
			return decision;
		}
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
