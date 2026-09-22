/**
 * Workspace-specific prompt plugin (host half).
 *
 * Persistence (feature 3): a per-workspace prompt is a live field of this
 * plugin's own Config — the volatile `prompts` map. The user-settings provider
 * persists the profile's user layer to its file in the Harness home, so the
 * content survives a Harness restart with no extra work here. The loader row
 * id (`workspace-prompt`) is the settings namespace, and the browser half
 * writes the same map through `ctx.configForms`.
 *
 * Injection (feature 2): the prompt is folded into the model context at
 * session start by mirroring the official `agent-instructions` mechanism — it
 * is entered exactly once, and later steps skip re-injection while an
 * identical copy still stands in the recorded session surface. It enters
 * again only when the configured text changes (or compaction drops the
 * earlier copy). A durable `user/message` carrying the prompt is managed in
 * the agent inbox at `agent/pre-step`, so it appears in the first model
 * request and is recorded in the session log. The source declares this
 * plugin's own kind with the `instructions` context form, which marks the
 * message as producer-supplied guidance rather than a human prompt: the Web
 * transcript projects every non-`user` source as a collapsed context row, and
 * host consumers that read human input (session titles, skill and mention
 * gestures, goal authority, wake budgets) skip it. The official
 * `agent-instructions` reconciliation only manages its own
 * `kind: 'agent-instructions'` messages, so it never disturbs this one.
 *
 * Keying: prompts are keyed by the session's absolute working directory
 * (`SessionHeader.cwd`), the stable identity of the workspace the session runs
 * in. The client resolves the same `cwd` for the current session.
 */
import type { Context, Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { Session } from '@deepseek-ai/dsh-session';
import { PROMPTS_FIELD } from './prompt-settings.ts';
export declare const name = "workspace-prompt";
/** Live plugin configuration; `prompts` is re-read at every pre-step. */
export interface Config {
    /** Absolute workspace directory -> configured prompt text. */
    [PROMPTS_FIELD]: Volatile<Record<string, string>>;
}
/** Live per-workspace prompts, the only field the settings form edits. */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    prompts: z<NoInfer<Record<string, string>>, NoInfer<Record<string, string>>, "volatile">;
}>>, Schemastery.ObjectT<NoInfer<{
    prompts: z<NoInfer<Record<string, string>>, NoInfer<Record<string, string>>, "volatile">;
}>>, "plain">;
export declare function apply(ctx: Context, config: Config): void;
export type { Session };
